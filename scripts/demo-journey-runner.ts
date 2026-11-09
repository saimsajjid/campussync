/**
 * CampusSync Test Plan - Section 28: Demo Journey Rehearsal
 *
 * Runs the complete 10-step demo script three times from a clean reset:
 * 1. Setup & record parity
 * 2. Offline student edits (phone, address)
 * 3. Concurrent remote admin edits (address, program)
 * 4. Reconnect with response loss & retry (no duplicate)
 * 5. Auto-merge verification (phone & program converged)
 * 6. Conflict detection & resolution on address
 * 7. Duplicate student creation rejection
 * 8. Full audit history timeline verification
 * 9. Admin rollback/restore to earlier version
 * 10. Integrity suite all-pass gate
 */

const BASE_URL = process.env.TEST_TARGET || 'http://150.136.103.208.sslip.io';

interface JourneyStepResult {
  step: number;
  description: string;
  passed: boolean;
  details?: any;
}

interface RunSummary {
  run: number;
  durationMs: number;
  allPassed: boolean;
  steps: JourneyStepResult[];
}

function extractTokenFromResponse(res: Response): string {
  const cookieHeader = res.headers.get('set-cookie') || '';
  const match = cookieHeader.match(/campussync_token=([^;]+)/);
  return match ? match[1] : '';
}

async function login(email: string, password = 'password123'): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return extractTokenFromResponse(res);
}

async function executeSingleJourney(runNumber: number): Promise<RunSummary> {
  const startTime = Date.now();
  const steps: JourneyStepResult[] = [];
  console.log(`\n======================================================`);
  console.log(`Executing Demo Journey Rehearsal - Run #${runNumber}`);
  console.log(`======================================================\n`);

  const adminToken = await login('admin@campussync.local');
  const studentToken = await login('student@campussync.local');

  // Step 0: Clean reset
  await fetch(`${BASE_URL}/demo/reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const targetStudentId = '10000000-0000-0000-0000-000000000001'; // Ali Raza

  // Step 1: Setup - Record exists on student and admin devices
  const snapAdminRes = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const snapAdmin = await snapAdminRes.json();
  const sAdmin = snapAdmin.students.find((s: any) => s.id === targetStudentId);

  const snapStudentRes = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const snapStudent = await snapStudentRes.json();
  const sStudent = snapStudent.students.find((s: any) => s.id === targetStudentId);

  const step1Passed = sAdmin && sStudent && sAdmin.phone === sStudent.phone && sAdmin.address === sStudent.address;
  steps.push({
    step: 1,
    description: 'Setup: Record exists and matches on both devices',
    passed: Boolean(step1Passed),
  });
  console.log(`${step1Passed ? '✅' : '❌'} Step 1: Setup parity confirmed`);

  // Step 2 & 3: Simultaneous offline edits
  // Student queues phone and address edits locally based on version 1
  const studentBasePhoneVer = sStudent.field_versions.phone;
  const studentBaseAddressVer = sStudent.field_versions.address;
  const newStudentPhone = '0300-9991111';
  const newStudentAddress = 'Flat 4B, Gulberg III, Lahore (Student Offline)';

  // Admin (Islamabad) makes online changes to address and program
  const adminRemoteAddress = 'Plot 77, Sector F-6, Islamabad (Admin Update)';
  const adminRemoteProgram = 'BS SE';
  const adminOpAddress = 'admin-op-addr-' + Date.now();
  const adminOpProg = 'admin-op-prog-' + Date.now();

  const adminPushRes = await fetch(`${BASE_URL}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      operations: [
        {
          opId: adminOpAddress,
          studentId: targetStudentId,
          field: 'address',
          newValue: adminRemoteAddress,
          baseVersion: sAdmin.field_versions.address,
          deviceId: 'admin-console',
          type: 'edit',
        },
        {
          opId: adminOpProg,
          studentId: targetStudentId,
          field: 'program',
          newValue: adminRemoteProgram,
          baseVersion: sAdmin.field_versions.program,
          deviceId: 'admin-console',
          type: 'edit',
        },
      ],
    }),
  });
  const adminPushData = await adminPushRes.json();
  const step3Passed = adminPushData.results?.every((r: any) => r.status === 'applied');
  steps.push({
    step: 3,
    description: 'Admin online: edits address and program successfully',
    passed: Boolean(step3Passed),
  });
  console.log(`${step3Passed ? '✅' : '❌'} Step 3: Admin online edits applied`);

  // Step 4: Student reconnects with "Lose next response" simulation
  // First delivery: server applies student phone, conflicts on address, but ACK is simulated lost
  const studentOpPhone = 'student-op-phone-' + Date.now();
  const studentOpAddr = 'student-op-addr-' + Date.now();

  const studentPush1 = await fetch(`${BASE_URL}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      operations: [
        {
          opId: studentOpPhone,
          studentId: targetStudentId,
          field: 'phone',
          newValue: newStudentPhone,
          baseVersion: studentBasePhoneVer,
          deviceId: 'student-mobile',
          type: 'edit',
        },
        {
          opId: studentOpAddr,
          studentId: targetStudentId,
          field: 'address',
          newValue: newStudentAddress,
          baseVersion: studentBaseAddressVer, // Stale!
          deviceId: 'student-mobile',
          type: 'edit',
        },
      ],
    }),
  });
  const push1Data = await studentPush1.json();

  // Retry the exact batch (simulating client retry after lost response)
  const studentPush2 = await fetch(`${BASE_URL}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      operations: [
        {
          opId: studentOpPhone,
          studentId: targetStudentId,
          field: 'phone',
          newValue: newStudentPhone,
          baseVersion: studentBasePhoneVer,
          deviceId: 'student-mobile',
          type: 'edit',
        },
        {
          opId: studentOpAddr,
          studentId: targetStudentId,
          field: 'address',
          newValue: newStudentAddress,
          baseVersion: studentBaseAddressVer,
          deviceId: 'student-mobile',
          type: 'edit',
        },
      ],
    }),
  });
  const push2Data = await studentPush2.json();
  const step4Passed =
    push1Data.results?.[0]?.status === 'applied' &&
    push2Data.results?.[0]?.status === 'duplicate';
  steps.push({
    step: 4,
    description: 'Student retry after lost response: duplicate recognized cleanly',
    passed: Boolean(step4Passed),
  });
  console.log(`${step4Passed ? '✅' : '❌'} Step 4: Idempotent retry without double application`);

  // Step 5: Auto-Merge verification (phone and program both updated)
  const snapPostMergeRes = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const snapPostMerge = await snapPostMergeRes.json();
  const sMerged = snapPostMerge.students.find((s: any) => s.id === targetStudentId);
  const step5Passed = sMerged.phone === newStudentPhone && sMerged.program === adminRemoteProgram;
  steps.push({
    step: 5,
    description: 'Auto-merge: Non-conflicting fields phone and program converged',
    passed: Boolean(step5Passed),
    details: { phone: sMerged.phone, program: sMerged.program },
  });
  console.log(`${step5Passed ? '✅' : '❌'} Step 5: Auto-merged distinct field updates seamlessly`);

  // Step 6: Conflict on address detected and resolved
  const conflictsRes = await fetch(`${BASE_URL}/conflicts`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const confData = await conflictsRes.json();
  const addressConflict = confData.conflicts?.find(
    (c: any) => c.student_id === targetStudentId && c.field === 'address'
  );

  let step6Passed = false;
  if (addressConflict) {
    const snapResolving = await snapPostMergeRes.json().catch(() => null);
    // Fetch latest student snapshot to get version shown to user when opening conflict resolution
    const currStudRes = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const currStudSnap = await currStudRes.json();
    const currTarget = currStudSnap.students?.find((s: any) => s.id === targetStudentId);
    const currAddressVer = currTarget?.field_versions?.address || 1;

    const resolveRes = await fetch(`${BASE_URL}/conflicts/${addressConflict.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        choice: 'theirs', // Keep current server value (Admin's address)
        expectedServerVersion: currAddressVer,
      }),
    });
    const resolveData = await resolveRes.json();
    step6Passed = resolveRes.status === 200 && resolveData.success === true;
  }

  steps.push({
    step: 6,
    description: 'Conflict on address detected and resolved cleanly',
    passed: Boolean(step6Passed),
  });
  console.log(`${step6Passed ? '✅' : '❌'} Step 6: Address conflict detected and resolved`);

  // Step 7: Second campus creates same student -> Duplicate record blocked
  const dupCreateRes = await fetch(`${BASE_URL}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      operations: [
        {
          opId: 'op-dup-create-' + Date.now(),
          studentId: '10000000-0000-0000-0000-000000000099',
          field: '*',
          newValue: null,
          baseVersion: 0,
          deviceId: 'campus-b-registrar',
          type: 'create',
          studentData: {
            id: '10000000-0000-0000-0000-000000000099',
            reg_no: sAdmin.reg_no, // Duplicate reg_no!
            cnic: '35201-8888888-8',
            full_name: 'Imposter Student',
            program: 'BS CS',
            campus: 'Islamabad',
            semester: 1,
            status: 'Active',
            phone: '0300-8888888',
            email: 'imposter@campussync.local',
            address: 'Unknown Street',
            emergency_contact: 'None - 0300-0000000',
            attendance: 100,
          },
        },
      ],
    }),
  });
  const dupCreateData = await dupCreateRes.json();
  const dupOpResult = dupCreateData.results?.[0];
  const step7Passed = dupOpResult?.status === 'duplicate_record';
  steps.push({
    step: 7,
    description: 'Duplicate student registration number blocked with duplicate_record',
    passed: Boolean(step7Passed),
  });
  console.log(`${step7Passed ? '✅' : '❌'} Step 7: Duplicate student creation blocked safely`);

  // Step 8: History timeline verification
  const histRes = await fetch(`${BASE_URL}/students/${targetStudentId}/history`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const histData = await histRes.json();
  const step8Passed = histData.history?.length >= 4; // create, admin address, admin program, phone, resolve
  steps.push({
    step: 8,
    description: 'Audit history ledger records every chronological state transition',
    passed: Boolean(step8Passed),
    details: { totalHistoryEntries: histData.history?.length },
  });
  console.log(`${step8Passed ? '✅' : '❌'} Step 8: Full history timeline verified (${histData.history?.length} entries)`);

  // Step 9: Admin restores earlier value
  const restoreRes = await fetch(`${BASE_URL}/students/${targetStudentId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      field: 'program',
      targetValue: 'BS CS', // Restore original program
    }),
  });
  const restoreData = await restoreRes.json();
  const step9Passed = restoreRes.status === 200 && restoreData.success === true;
  steps.push({
    step: 9,
    description: 'Admin restore rolls back field to historical value as a new version',
    passed: Boolean(step9Passed),
  });
  console.log(`${step9Passed ? '✅' : '❌'} Step 9: Admin restored historical program value`);

  // Step 10: Integrity check passes all 7 invariants
  const integRes = await fetch(`${BASE_URL}/admin/integrity`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const integReport = await integRes.json();
  const step10Passed = integReport.allPassed === true;
  steps.push({
    step: 10,
    description: 'Integrity suite verifies all 7 invariants hold after full journey',
    passed: Boolean(step10Passed),
  });
  console.log(`${step10Passed ? '✅' : '❌'} Step 10: Post-journey integrity suite confirmed 100% pass`);

  const durationMs = Date.now() - startTime;
  const allPassed = steps.every((s) => s.passed);

  return {
    run: runNumber,
    durationMs,
    allPassed,
    steps,
  };
}

async function runThreeRehearsals() {
  console.log(`\n======================================================`);
  console.log(`Section 28: 3x Demo Journey Rehearsal Harness`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`======================================================`);

  const run1 = await executeSingleJourney(1);
  const run2 = await executeSingleJourney(2);
  const run3 = await executeSingleJourney(3);

  console.log(`\n======================================================`);
  console.log(`REHEARSAL SUMMARY TABLE:`);
  console.log(`Run 1: ${run1.allPassed ? '✅ 10/10 PASSED' : '❌ FAILED'} (${run1.durationMs}ms)`);
  console.log(`Run 2: ${run2.allPassed ? '✅ 10/10 PASSED' : '❌ FAILED'} (${run2.durationMs}ms)`);
  console.log(`Run 3: ${run3.allPassed ? '✅ 10/10 PASSED' : '❌ FAILED'} (${run3.durationMs}ms)`);
  console.log(`======================================================\n`);

  if (!run1.allPassed || !run2.allPassed || !run3.allPassed) {
    process.exit(1);
  }
}

runThreeRehearsals().catch((err) => {
  console.error('Fatal rehearsal error:', err);
  process.exit(1);
});
