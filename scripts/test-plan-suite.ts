import crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL || process.env.TEST_TARGET || 'http://127.0.0.1:3055';

interface TestResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function extractTokenFromResponse(res: Response): string {
  const cookieHeader = res.headers.get('set-cookie') || '';
  const match = cookieHeader.match(/campussync_token=([^;]+)/);
  return match ? match[1] : '';
}

function record(id: string, category: string, name: string, passed: boolean, details?: any, error?: string) {
  results.push({ id, category, name, passed, details, error });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${id}] ${category}: ${name} ${error ? `(${error})` : ''}`);
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`CampusSync Full Test Plan Execution Suite`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  // --------------------------------------------------------------------------
  // SECTION 2: SMOKE TESTS
  // --------------------------------------------------------------------------
  console.log(`--- SECTION 2: Smoke Tests ---`);

  // SM-2: Health Check
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    record('SM-2', 'Smoke', 'GET /health returns OK and database is healthy', res.status === 200 && data.status === 'ok', data);
  } catch (err: any) {
    record('SM-2', 'Smoke', 'GET /health returns OK', false, null, err.message);
  }

  // SM-3: Login as each role
  let adminToken = '';
  let facultyToken = '';
  let studentToken = '';

  try {
    const adminLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@campussync.local', password: 'password123' }),
    });
    const adminData = await adminLogin.json();
    adminToken = extractTokenFromResponse(adminLogin);
    record('SM-3.1', 'Smoke', 'Login as Admin', adminLogin.status === 200 && adminData.user.role === 'admin' && adminData.token === undefined, adminData.user);

    const facultyLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'faculty@campussync.local', password: 'password123' }),
    });
    const facultyData = await facultyLogin.json();
    facultyToken = extractTokenFromResponse(facultyLogin);
    record('SM-3.2', 'Smoke', 'Login as Faculty', facultyLogin.status === 200 && facultyData.user.role === 'faculty' && facultyData.token === undefined, facultyData.user);

    const studentLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@campussync.local', password: 'password123' }),
    });
    const studentData = await studentLogin.json();
    studentToken = extractTokenFromResponse(studentLogin);
    record('SM-3.3', 'Smoke', 'Login as Student', studentLogin.status === 200 && studentData.user.role === 'student' && studentData.token === undefined, studentData.user);
  } catch (err: any) {
    record('SM-3', 'Smoke', 'Login as each role', false, null, err.message);
  }

  // SM-9: Reset Demo Data
  try {
    const resetRes = await fetch(`${BASE_URL}/demo/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const resetData = await resetRes.json();
    record('SM-9', 'Smoke', 'Reset demo data to known clean seeded state', resetRes.status === 200 && resetData.success === true);
  } catch (err: any) {
    record('SM-9', 'Smoke', 'Reset demo data', false, null, err.message);
  }

  // SM-4: Snapshot initial records
  let seededStudents: any[] = [];
  try {
    const snapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const snapData = await snapRes.json();
    seededStudents = snapData.students || [];
    record(
      'SM-4',
      'Smoke',
      'GET /sync/snapshot returns 12 multi-campus records',
      seededStudents.length === 12 && snapData.latestCursor >= 12,
      { count: seededStudents.length, cursor: snapData.latestCursor }
    );
  } catch (err: any) {
    record('SM-4', 'Smoke', 'Snapshot initial records', false, null, err.message);
  }

  // ATT-1: GET /sync/snapshot normalizes attendance as JavaScript number
  try {
    const allNumeric = seededStudents.every((s: any) => typeof s.attendance === 'number');
    record(
      'ATT-1',
      'Attendance Normalization',
      'GET /sync/snapshot returns attendance as JavaScript number for all students',
      allNumeric && seededStudents.length === 12,
      { studentCount: seededStudents.length, allNumeric }
    );
  } catch (err: any) {
    record('ATT-1', 'Attendance Normalization', 'Snapshot attendance numeric normalization', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 3 & 4: PERMISSION MATRIX & VALIDATION
  // --------------------------------------------------------------------------
  console.log(`\n--- SECTION 3 & 4: Permissions & Validation ---`);

  const studentTarget = seededStudents[0]; // Ali Raza (Lahore, Student)

  // PM-12: Student tries to edit official field (program)
  try {
    const pushRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        operations: [
          {
            opId: 'op-unauthorized-program-' + Date.now(),
            studentId: studentTarget.id,
            field: 'program',
            newValue: 'BS EE',
            baseVersion: 1,
            deviceId: 'test-student-client',
            type: 'edit',
          },
        ],
      }),
    });
    const pushData = await pushRes.json();
    const opResult = pushData.results?.[0];
    record(
      'PM-12',
      'Permissions',
      'Server rejects student attempt to edit official field (program)',
      opResult?.status === 'rejected' && opResult?.reason?.includes('personal contact'),
      opResult
    );
  } catch (err: any) {
    record('PM-12', 'Permissions', 'Student unauthorized edit', false, null, err.message);
  }

  // PM-14: Faculty attempts to edit student on another campus (Islamabad student edited by Lahore faculty)
  const isbStudent = seededStudents.find((s) => s.campus === 'Islamabad');
  if (isbStudent) {
    try {
      const pushRes = await fetch(`${BASE_URL}/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${facultyToken}`, // Lahore faculty
        },
        body: JSON.stringify({
          operations: [
            {
              opId: 'op-faculty-diff-campus-' + Date.now(),
              studentId: isbStudent.id,
              field: 'attendance',
              newValue: 99.0,
              baseVersion: 1,
              deviceId: 'faculty-lhr-client',
              type: 'edit',
            },
          ],
        }),
      });
      const pushData = await pushRes.json();
      const opResult = pushData.results?.[0];
      record(
        'PM-14',
        'Permissions',
        'Faculty forbidden from editing students on a different campus',
        opResult?.status === 'rejected' && opResult?.reason?.includes('own campus'),
        opResult
      );
    } catch (err: any) {
      record('PM-14', 'Permissions', 'Faculty other campus edit', false, null, err.message);
    }
  }

  // VA-14: Cross-field rule: Graduated requires semester 8
  try {
    const pushRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        operations: [
          {
            opId: 'op-invalid-graduated-' + Date.now(),
            studentId: studentTarget.id,
            field: 'status',
            newValue: 'Graduated', // semester is 4!
            baseVersion: studentTarget.field_versions?.status || 1,
            deviceId: 'admin-client',
            type: 'edit',
          },
        ],
      }),
    });
    const pushData = await pushRes.json();
    const opResult = pushData.results?.[0];
    record(
      'VA-14',
      'Validation',
      'Server enforces cross-field invariant: Graduated requires Semester 8',
      opResult?.status === 'rejected' && opResult?.reason?.includes('Semester 8'),
      opResult
    );
  } catch (err: any) {
    record('VA-14', 'Validation', 'Cross-field validation', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 7B: EMERGENCY CONTACT VALIDATION (MATRIX VA-11)
  // --------------------------------------------------------------------------
  console.log(`\n--- SECTION 7B: Emergency Contact Validation (VA-11) ---`);

  // Refresh target snapshot to guarantee accurate baseVersion
  const snapRes7B = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const snapData7B = await snapRes7B.json();
  const currentTarget7B = snapData7B.students?.find((s: any) => s.id === studentTarget.id) || studentTarget;
  let currentEmergencyVer = currentTarget7B.field_versions?.emergency_contact || 1;

  // 1. Phone-only -> MUST REJECT
  try {
    const res = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [{
          opId: 'op-va11-phoneonly-' + Date.now(),
          studentId: currentTarget7B.id,
          field: 'emergency_contact',
          newValue: '0300-1234567',
          baseVersion: currentEmergencyVer,
          deviceId: 'admin-client',
          type: 'edit',
        }],
      }),
    });
    const data = await res.json();
    const op = data.results?.[0];
    record(
      'VA-11-phone-only',
      'Validation',
      'Server rejects phone-only emergency contact',
      op?.status === 'rejected' && op?.reason?.toLowerCase().includes('name') && op?.reason?.toLowerCase().includes('phone'),
      op
    );
  } catch (err: any) {
    record('VA-11-phone-only', 'Validation', 'Phone-only rejection', false, null, err.message);
  }

  // 2. Name-only -> MUST REJECT
  try {
    const res = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [{
          opId: 'op-va11-nameonly-' + Date.now(),
          studentId: currentTarget7B.id,
          field: 'emergency_contact',
          newValue: 'Muhammad Tariq',
          baseVersion: currentEmergencyVer,
          deviceId: 'admin-client',
          type: 'edit',
        }],
      }),
    });
    const data = await res.json();
    const op = data.results?.[0];
    record(
      'VA-11-name-only',
      'Validation',
      'Server rejects name-only emergency contact',
      op?.status === 'rejected' && op?.reason?.toLowerCase().includes('phone'),
      op
    );
  } catch (err: any) {
    record('VA-11-name-only', 'Validation', 'Name-only rejection', false, null, err.message);
  }

  // 3. Empty -> MUST REJECT
  try {
    const res = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [{
          opId: 'op-va11-empty-' + Date.now(),
          studentId: currentTarget7B.id,
          field: 'emergency_contact',
          newValue: '',
          baseVersion: currentEmergencyVer,
          deviceId: 'admin-client',
          type: 'edit',
        }],
      }),
    });
    const data = await res.json();
    const op = data.results?.[0];
    record(
      'VA-11-empty',
      'Validation',
      'Server rejects empty emergency contact',
      op?.status === 'rejected',
      op
    );
  } catch (err: any) {
    record('VA-11-empty', 'Validation', 'Empty rejection', false, null, err.message);
  }

  // 4. Valid (name + phone) -> MUST APPLY
  try {
    // Re-check base version in case any mutation occurred
    const refSnapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const refSnap = await refSnapRes.json();
    const refSt = refSnap.students?.find((s: any) => s.id === currentTarget7B.id);
    const validVer = refSt?.field_versions?.emergency_contact || currentEmergencyVer;

    const validContact = 'Tariq Khan (Father) - 0300-9988776';
    const res = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [{
          opId: 'op-va11-valid-' + Date.now(),
          studentId: currentTarget7B.id,
          field: 'emergency_contact',
          newValue: validContact,
          baseVersion: validVer,
          deviceId: 'admin-client',
          type: 'edit',
        }],
      }),
    });
    const data = await res.json();
    const op = data.results?.[0];
    record(
      'VA-11-valid',
      'Validation',
      'Server applies valid emergency contact (name + phone)',
      op?.status === 'applied',
      op
    );
  } catch (err: any) {
    record('VA-11-valid', 'Validation', 'Valid emergency contact', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 8: IDEMPOTENCY & EXACTLY-ONCE GUARANTEES
  // --------------------------------------------------------------------------
  console.log(`\n--- SECTION 8: Idempotency & Operation Duplication Prevention ---`);

  const idempotencyOpId = 'op-idempotency-key-' + Date.now();
  const newPhone = '0300-5559999';

  // ID-1 / ID-4: Submit op first time -> applied
  try {
    const firstCall = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        operations: [
          {
            opId: idempotencyOpId,
            studentId: studentTarget.id,
            field: 'phone',
            newValue: newPhone,
            baseVersion: studentTarget.field_versions?.phone || 1,
            deviceId: 'device-test-1',
            type: 'edit',
          },
        ],
      }),
    });
    const firstData = await firstCall.json();
    const firstResult = firstData.results?.[0];

    // Replay same opId second time -> duplicate, original result returned
    const secondCall = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        operations: [
          {
            opId: idempotencyOpId,
            studentId: studentTarget.id,
            field: 'phone',
            newValue: newPhone,
            baseVersion: studentTarget.field_versions?.phone || 1,
            deviceId: 'device-test-1',
            type: 'edit',
          },
        ],
      }),
    });
    const secondData = await secondCall.json();
    const secondResult = secondData.results?.[0];

    record(
      'ID-1 & ID-4',
      'Idempotency',
      'Replayed opId returns duplicate without double-applying',
      firstResult?.status === 'applied' && secondResult?.status === 'duplicate',
      { first: firstResult?.status, second: secondResult?.status }
    );
  } catch (err: any) {
    record('ID-1', 'Idempotency', 'Replay opId', false, null, err.message);
  }

  // ID-9: Concurrent identical ops (simulating double-click or simultaneous delivery)
  const concurrentOpId = 'op-concurrent-' + Date.now();
  try {
    const freshSnapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const freshSnapData = await freshSnapRes.json();
    const freshTarget = freshSnapData.students?.find((s: any) => s.id === studentTarget.id) || studentTarget;
    const freshRemarksVer = freshTarget.field_versions?.remarks || 1;

    const promises = Array.from({ length: 4 }).map(() =>
      fetch(`${BASE_URL}/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          operations: [
            {
              opId: concurrentOpId,
              studentId: studentTarget.id,
              field: 'remarks',
              newValue: 'Active concurrent test runner',
              baseVersion: freshRemarksVer,
              deviceId: 'device-concurrent-suite',
              type: 'edit',
            },
          ],
        }),
      }).then((r) => r.json())
    );

    const responses = await Promise.all(promises);
    const statuses = responses.map((r) => r.results?.[0]?.status);
    const appliedCount = statuses.filter((s) => s === 'applied').length;
    const duplicateCount = statuses.filter((s) => s === 'duplicate').length;

    record(
      'ID-9',
      'Idempotency',
      'Concurrent identical requests serialize cleanly: exactly 1 applied, others duplicate',
      appliedCount === 1 && duplicateCount === 3,
      { appliedCount, duplicateCount, statuses }
    );
  } catch (err: any) {
    record('ID-9', 'Idempotency', 'Concurrent requests', false, null, err.message);
  }

  // ED-3 / IN-NOOP: No-op edit followed by real edit on same field, verified against history at that point in time
  try {
    const snapNoopRes = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const snapNoopData = await snapNoopRes.json();
    const stNoop = snapNoopData.students.find((s: any) => s.id === studentTarget.id);
    const originalPhone = stNoop.phone;
    const originalPhoneVer = stNoop.field_versions?.phone || 1;

    // 1. Submit a no-op edit (same value, divergent/stale baseVersion to trigger convergence check)
    const opNoopId = 'op-noop-test-' + Date.now();
    const noopPushRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: opNoopId,
            studentId: studentTarget.id,
            field: 'phone',
            newValue: originalPhone, // Identical value
            baseVersion: 999, // Divergent base triggers convergence logic
            deviceId: 'device-noop-runner',
            type: 'edit',
          },
        ],
      }),
    });
    const noopData = await noopPushRes.json();
    const noopRes = noopData.results?.[0];

    // 2. Follow immediately with a REAL edit to the SAME field
    const opRealId = 'op-real-after-noop-' + Date.now();
    const updatedPhone = '0300-8884433';
    const realPushRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: opRealId,
            studentId: studentTarget.id,
            field: 'phone',
            newValue: updatedPhone, // New real value
            baseVersion: originalPhoneVer,
            deviceId: 'device-real-runner',
            type: 'edit',
          },
        ],
      }),
    });
    const realData = await realPushRes.json();
    const realRes = realData.results?.[0];

    // 3. Run integrity check: must pass by checking no-op value against history at that point in time
    const integCheckRes = await fetch(`${BASE_URL}/admin/integrity`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const integReport = await integCheckRes.json();
    const noLostEditsCheck = integReport.checks?.find((c: any) => c.id === 'inv-no-lost-edits');

    record(
      'ED-3 & IN-NOOP',
      'Integrity',
      'No-op op followed by real edit to same field passes integrity check against history at that point in time',
      noopRes?.status === 'applied' &&
        noopRes?.isNoOp === true &&
        realRes?.status === 'applied' &&
        integReport.allPassed === true &&
        noLostEditsCheck?.status === 'passed',
      { noopRes, realRes, integCheck: noLostEditsCheck?.status }
    );
  } catch (err: any) {
    record('ED-3', 'Integrity', 'No-op followed by real edit', false, null, err.message);
  }

  // IN-NOOP-CREATE: No-op op directly following a record creation (field '*') passes integrity
  try {
    const newStudentId = '30000000-0000-0000-0000-000000000099';
    const createOpId = 'op-create-for-noop-' + Date.now();
    const studentData = {
      id: newStudentId,
      reg_no: 'CS-2026-9999',
      cnic: '35201-9999999-1',
      full_name: 'Noop Creation Test Student',
      program: 'BS CS',
      campus: 'Lahore',
      semester: 1,
      status: 'Active',
      phone: '0300-9991122',
      email: 'noop.student@campussync.local',
      address: 'House 99, Sector Y, Phase 8, Lahore',
      emergency_contact: 'Father - 0321-9998877',
      attendance: 90,
      remarks: 'Created to test no-op following wildcard creation row',
    };

    // 1. Create the student record (field '*')
    const createRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: createOpId,
            studentId: newStudentId,
            field: '*',
            newValue: studentData,
            baseVersion: 0,
            deviceId: 'device-create-noop-runner',
            type: 'create',
          },
        ],
      }),
    });
    const createJson = await createRes.json();
    const createdStatus = createJson.results?.[0]?.status;

    // 2. Submit a no-op op immediately following creation (same phone value, divergent baseVersion)
    const noopAfterCreateId = 'op-noop-after-create-' + Date.now();
    const noopCreateRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: noopAfterCreateId,
            studentId: newStudentId,
            field: 'phone',
            newValue: '0300-9991122', // identical to creation value
            baseVersion: 999, // divergent base version triggers convergence check
            deviceId: 'device-noop-runner',
            type: 'edit',
          },
        ],
      }),
    });
    const noopCreateJson = await noopCreateRes.json();
    const noopAfterCreateRes = noopCreateJson.results?.[0];

    // 3. Run integrity check
    const integCheckRes = await fetch(`${BASE_URL}/admin/integrity`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const integReport = await integCheckRes.json();
    const noLostEditsCheck = integReport.checks?.find((c: any) => c.id === 'inv-no-lost-edits');

    record(
      'IN-NOOP-CREATE',
      'Integrity',
      'No-op op directly following a record creation (field *) passes integrity against history at that point in time',
      createdStatus === 'applied' &&
        noopAfterCreateRes?.status === 'applied' &&
        noopAfterCreateRes?.isNoOp === true &&
        integReport.allPassed === true &&
        noLostEditsCheck?.status === 'passed',
      { createdStatus, noopAfterCreateRes, integCheck: noLostEditsCheck?.status }
    );
  } catch (err: any) {
    record('IN-NOOP-CREATE', 'Integrity', 'No-op following creation', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 9: CONFLICT DETECTION & AUTO-MERGE
  // --------------------------------------------------------------------------
  console.log(`\n--- SECTION 9: Conflicts & Auto-Merge ---`);

  // CF-2: Different fields concurrently edited from same base -> Auto-Merged!
  const mergeStudentRes = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const mergeSnap = await mergeStudentRes.json();
  const targetForMerge = mergeSnap.students.find((s: any) => s.id === studentTarget.id);

  try {
    const opPhone = 'op-merge-phone-' + Date.now();
    const opRemarks = 'op-merge-remarks-' + Date.now();

    // Edit 1: change phone
    await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: opPhone,
            studentId: targetForMerge.id,
            field: 'phone',
            newValue: '0301-7778888',
            baseVersion: targetForMerge.field_versions.phone,
            deviceId: 'device-A',
            type: 'edit',
          },
        ],
      }),
    });

    // Edit 2: change remarks from the SAME base version as targetForMerge
    const res2 = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: opRemarks,
            studentId: targetForMerge.id,
            field: 'remarks',
            newValue: 'Remarks auto-merged seamlessly',
            baseVersion: targetForMerge.field_versions.remarks,
            deviceId: 'device-B',
            type: 'edit',
          },
        ],
      }),
    });
    const res2Data = await res2.json();
    const mergeStatus = res2Data.results?.[0]?.status;

    record(
      'CF-2',
      'Conflicts',
      'Edits to different fields from same base version auto-merge without conflict',
      mergeStatus === 'applied',
      { status: mergeStatus }
    );
  } catch (err: any) {
    record('CF-2', 'Conflicts', 'Auto-merge different fields', false, null, err.message);
  }

  // CF-1: Same field divergent edits -> Conflict held non-destructively
  let activeConflictId = '';
  try {
    const opConflicting = 'op-conflict-address-' + Date.now();
    const conflictPush = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: opConflicting,
            studentId: targetForMerge.id,
            field: 'address',
            newValue: 'Divergent Address (Offline Device)',
            baseVersion: 999, // Stale base version!
            deviceId: 'device-offline-loser',
            type: 'edit',
          },
        ],
      }),
    });
    const conflictData = await conflictPush.json();
    const opConfResult = conflictData.results?.[0];
    activeConflictId = opConfResult?.conflictId || '';

    record(
      'CF-1',
      'Conflicts',
      'Concurrent edit to same field detected as conflict, held non-destructively',
      opConfResult?.status === 'conflict' && Boolean(activeConflictId),
      opConfResult
    );
  } catch (err: any) {
    record('CF-1', 'Conflicts', 'Same field conflict detection', false, null, err.message);
  }

  // CR-2: Resolve Conflict
  if (activeConflictId) {
    try {
      const confItemRes = await fetch(`${BASE_URL}/conflicts`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const confList = await confItemRes.json();
      const thisConf = confList.conflicts?.find((c: any) => c.id === activeConflictId);

      // Fetch student to get the field version currently displayed to the user
      const snapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const snapData = await snapRes.json();
      const currStudent = snapData.students?.find((s: any) => s.id === targetForMerge.id);
      const versionShownToUser = currStudent?.field_versions?.[thisConf?.field || 'address'] || 1;

      const resolveRes = await fetch(`${BASE_URL}/conflicts/${activeConflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          choice: 'mine',
          expectedServerVersion: versionShownToUser,
        }),
      });
      const resolveData = await resolveRes.json();
      record(
        'CR-2',
        'Conflicts',
        'Conflict resolution commits new version and closes conflict item',
        resolveRes.status === 200 && resolveData.success === true,
        resolveData
      );
    } catch (err: any) {
      record('CR-2', 'Conflicts', 'Conflict resolution', false, null, err.message);
    }
  }

  // CR-8: Stale Resolution Protection
  // File a conflict, change the field again from another user, resolve with the old version, expect 409 stale and no write
  try {
    // 1. Get current student state
    const snap1Res = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const snap1 = await snap1Res.json();
    const stCR8 = snap1.students.find((s: any) => s.id === studentTarget.id);
    const cr8BaseVer = stCR8.field_versions?.emergency_contact || 1;

    // 2. Client A files a conflict on emergency_contact by sending stale base
    const cr8ConflictPush = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: 'op-cr8-conflict-' + Date.now(),
            studentId: studentTarget.id,
            field: 'emergency_contact',
            newValue: 'Uncle Bob (Client A) - 0300-1111222',
            baseVersion: 999, // Intentional divergence
            deviceId: 'device-client-a',
            type: 'edit',
          },
        ],
      }),
    });
    const cr8ConfData = await cr8ConflictPush.json();
    const cr8ConflictId = cr8ConfData.results?.[0]?.conflictId;

    // User inspects the conflict and sees the version before the next change
    const versionShownWhenInspected = cr8BaseVer;

    // 3. Concurrently, another user changes the field underneath!
    const interleavedValue = 'Aunt Alice (Interleaved User) - 0300-3333444';
    const interleavePush = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: 'op-cr8-interleaved-' + Date.now(),
            studentId: studentTarget.id,
            field: 'emergency_contact',
            newValue: interleavedValue,
            baseVersion: cr8BaseVer,
            deviceId: 'device-interleaved-user',
            type: 'edit',
          },
        ],
      }),
    });
    const interleaveData = await interleavePush.json();
    const interleaveApplied = interleaveData.results?.[0]?.status === 'applied';

    // 4. Client A tries to resolve using the old versionShownWhenInspected
    const staleResolveRes = await fetch(`${BASE_URL}/conflicts/${cr8ConflictId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        choice: 'mine',
        expectedServerVersion: versionShownWhenInspected, // Stale!
      }),
    });
    const staleResolveData = await staleResolveRes.json();

    // 5. Verify no write occurred (the interleaved value is preserved, conflict remains open)
    const snapVerifyRes = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const snapVerify = await snapVerifyRes.json();
    const stVerified = snapVerify.students.find((s: any) => s.id === studentTarget.id);
    const noWriteOccurred = stVerified?.emergency_contact === interleavedValue;

    const confCheckRes = await fetch(`${BASE_URL}/conflicts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const confCheckData = await confCheckRes.json();
    const conflictStillOpen = confCheckData.conflicts?.some((c: any) => c.id === cr8ConflictId && c.status === 'open');

    record(
      'CR-8',
      'Conflicts',
      'Stale conflict resolution rejected with 409 Conflict, preserving underlying write and leaving conflict open',
      staleResolveRes.status === 409 && noWriteOccurred && conflictStillOpen && interleaveApplied,
      {
        status: staleResolveRes.status,
        response: staleResolveData,
        interleavedPreserved: noWriteOccurred,
        conflictStillOpen,
      }
    );
  } catch (err: any) {
    record('CR-8', 'Conflicts', 'Stale resolution protection (CR-8)', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 10: DUPLICATE RECORD PREVENTION
  // --------------------------------------------------------------------------
  console.log(`\n--- SECTION 10: Duplicate Record Prevention ---`);

  // DR-1: Attempt to create student with duplicate registration number
  try {
    const dupRegRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: 'op-dup-reg-' + Date.now(),
            studentId: '90000000-0000-0000-0000-000000000099',
            field: '*',
            newValue: {},
            baseVersion: 1,
            deviceId: 'test-device',
            type: 'create',
            studentData: {
              id: '90000000-0000-0000-0000-000000000099',
              reg_no: 'CS-2026-0101', // Already belongs to Ali Raza!
              cnic: '38403-9999999-1',
              full_name: 'Duplicate Pretender',
              program: 'BS CS',
              campus: 'Lahore',
              semester: 2,
              status: 'Active',
              phone: '0300-8889911',
              email: 'pretender@campussync.local',
              address: 'Ferozepur Road, Lahore',
              emergency_contact: 'Father (0300-0000000)',
              attendance: 75.0,
            },
          },
        ],
      }),
    });
    const dupRegData = await dupRegRes.json();
    const dupResult = dupRegData.results?.[0];
    record(
      'DR-1',
      'Duplicates',
      'Duplicate registration number blocked with duplicate_record status',
      dupResult?.status === 'duplicate_record' && dupResult?.existingRecordId === studentTarget.id,
      dupResult
    );
  } catch (err: any) {
    record('DR-1', 'Duplicates', 'Duplicate reg_no prevention', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 11: APPEND-ONLY AUDIT & RESTORE
  // --------------------------------------------------------------------------
  console.log(`\n--- SECTION 11: Append-Only History & Admin Restore ---`);

  // HI-10: Admin Restores Previous Value
  try {
    const restoreRes = await fetch(`${BASE_URL}/students/${studentTarget.id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        field: 'phone',
        targetValue: '0300-1234567', // Original seed phone
      }),
    });
    const restoreData = await restoreRes.json();
    record(
      'HI-10',
      'History',
      'Admin restore successfully rolls back field value as a new version',
      restoreRes.status === 200 && restoreData.success === true,
      restoreData
    );
  } catch (err: any) {
    record('HI-10', 'History', 'Admin restore', false, null, err.message);
  }

  // ATT-2: GET /students/:id/history normalizes attendance values to JavaScript numbers
  try {
    const sanaId = '10000000-0000-0000-0000-000000000011';
    const histRes = await fetch(`${BASE_URL}/students/${sanaId}/history`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const histData = await histRes.json();
    const attEntries = (histData.history || []).filter((h: any) => h.field === 'attendance');
    const allAttNumbers = attEntries.every(
      (h: any) => typeof h.newValue === 'number' && (h.oldValue === null || typeof h.oldValue === 'number')
    );
    record(
      'ATT-2',
      'Attendance Normalization',
      'GET /students/:id/history normalizes attendance oldValue and newValue to JavaScript numbers',
      histRes.status === 200 && attEntries.length >= 2 && allAttNumbers,
      { attEntriesCount: attEntries.length, allAttNumbers }
    );
  } catch (err: any) {
    record('ATT-2', 'Attendance Normalization', 'History attendance numeric normalization', false, null, err.message);
  }

  // ATT-3: Restore attendance field and verify attendance is normalized to a JavaScript number
  try {
    const restoreAttRes = await fetch(`${BASE_URL}/students/${studentTarget.id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        field: 'attendance',
        targetValue: 88.5,
      }),
    });
    const restoreAttData = await restoreAttRes.json();
    const restoredStudent = restoreAttData.student;
    record(
      'ATT-3',
      'Attendance Normalization',
      'Restore attendance normalizes value to JavaScript number in API response',
      restoreAttRes.status === 200 &&
        restoreAttData.success === true &&
        typeof restoredStudent?.attendance === 'number' &&
        restoredStudent.attendance === 88.5,
      { attendance: restoredStudent?.attendance, type: typeof restoredStudent?.attendance }
    );
  } catch (err: any) {
    record('ATT-3', 'Attendance Normalization', 'Restore attendance number normalization', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 13: DEMO ENDPOINT RBAC GATING & AUTHORIZATION
  // --------------------------------------------------------------------------
  console.log(`\n--- SECTION 13: Demo Endpoint RBAC Gating ---`);

  // DM-1: POST /demo/reset without token returns 401
  try {
    const res = await fetch(`${BASE_URL}/demo/reset`, { method: 'POST' });
    record('DM-1', 'Demo Gating', 'POST /demo/reset with no auth returns 401', res.status === 401);
  } catch (err: any) {
    record('DM-1', 'Demo Gating', 'POST /demo/reset no auth', false, null, err.message);
  }

  // DM-2: POST /demo/reset with student token returns 403
  try {
    const res = await fetch(`${BASE_URL}/demo/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    record('DM-2', 'Demo Gating', 'POST /demo/reset with student role returns 403', res.status === 403);
  } catch (err: any) {
    record('DM-2', 'Demo Gating', 'POST /demo/reset student role', false, null, err.message);
  }

  // DM-3: POST /demo/reset with faculty token returns 403
  try {
    const res = await fetch(`${BASE_URL}/demo/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    record('DM-3', 'Demo Gating', 'POST /demo/reset with faculty role returns 403', res.status === 403);
  } catch (err: any) {
    record('DM-3', 'Demo Gating', 'POST /demo/reset faculty role', false, null, err.message);
  }

  // DM-4: POST /demo/reset with admin token returns 200
  try {
    const res = await fetch(`${BASE_URL}/demo/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record('DM-4', 'Demo Gating', 'POST /demo/reset with admin role returns 200', res.status === 200);
  } catch (err: any) {
    record('DM-4', 'Demo Gating', 'POST /demo/reset admin role', false, null, err.message);
  }

  // DM-5: POST /demo/inject-edit without token returns 401
  try {
    const res = await fetch(`${BASE_URL}/demo/inject-edit`, { method: 'POST' });
    record('DM-5', 'Demo Gating', 'POST /demo/inject-edit with no auth returns 401', res.status === 401);
  } catch (err: any) {
    record('DM-5', 'Demo Gating', 'POST /demo/inject-edit no auth', false, null, err.message);
  }

  // DM-6: POST /demo/inject-edit with student token returns 403
  try {
    const res = await fetch(`${BASE_URL}/demo/inject-edit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    record('DM-6', 'Demo Gating', 'POST /demo/inject-edit with student role returns 403', res.status === 403);
  } catch (err: any) {
    record('DM-6', 'Demo Gating', 'POST /demo/inject-edit student role', false, null, err.message);
  }

  // DM-7: POST /demo/inject-edit with faculty token returns 403
  try {
    const res = await fetch(`${BASE_URL}/demo/inject-edit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    record('DM-7', 'Demo Gating', 'POST /demo/inject-edit with faculty role returns 403', res.status === 403);
  } catch (err: any) {
    record('DM-7', 'Demo Gating', 'POST /demo/inject-edit faculty role', false, null, err.message);
  }

  // DM-8: POST /demo/inject-edit with admin token returns 200
  try {
    const res = await fetch(`${BASE_URL}/demo/inject-edit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record('DM-8', 'Demo Gating', 'POST /demo/inject-edit with admin role returns 200', res.status === 200);
  } catch (err: any) {
    record('DM-8', 'Demo Gating', 'POST /demo/inject-edit admin role', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 14: SIMULATOR CONTROLS & RESILIENCE (FR-13)
  // --------------------------------------------------------------------------
  console.log(`\n--- SECTION 14: Simulator Controls & Resilience ---`);

  // SIM-1: Dropped response simulation (server commits, reply lost, client retries idempotently)
  try {
    const simOpId = 'sim-drop-ack-' + Date.now();
    const freshSnapSIM = await fetch(`${BASE_URL}/sync/snapshot`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const freshDataSIM = await freshSnapSIM.json();
    const freshSIMTarget = freshDataSIM.students?.find((s: any) => s.id === studentTarget.id);
    const simBaseVersion = freshSIMTarget?.field_versions?.remarks || 1;

    // Step 1: Server receives and commits edit
    const firstRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [{
          opId: simOpId,
          studentId: studentTarget.id,
          field: 'remarks',
          newValue: 'Simulated Network Partition Verification',
          baseVersion: simBaseVersion,
          deviceId: 'sim-device-01',
          type: 'edit',
        }],
      }),
    });
    const firstData = await firstRes.json();
    const firstStatus = firstData.results?.[0]?.status;

    // Step 2: Client re-sends identical opId after dropped response
    const replayRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [{
          opId: simOpId,
          studentId: studentTarget.id,
          field: 'remarks',
          newValue: 'Simulated Network Partition Verification',
          baseVersion: simBaseVersion,
          deviceId: 'sim-device-01',
          type: 'edit',
        }],
      }),
    });
    const replayData = await replayRes.json();
    const replayStatus = replayData.results?.[0]?.status;

    record(
      'SIM-1',
      'Simulator',
      'FR-13.3: Lost-response recovery applies once and replayed op returns duplicate',
      firstStatus === 'applied' && replayStatus === 'duplicate'
    );
  } catch (err: any) {
    record('SIM-1', 'Simulator', 'Lost response simulation', false, null, err.message);
  }

  // SIM-2: Remote concurrent edit injection (FR-13.5)
  try {
    const injectRes = await fetch(`${BASE_URL}/demo/inject-edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studentId: studentTarget.id,
        field: 'remarks',
        newValue: 'Injected Concurrent Remote Edit from Simulator',
      }),
    });
    const injectData = await injectRes.json();
    record(
      'SIM-2',
      'Simulator',
      'FR-13.5: Simulator injects concurrent edit from another campus with SSE broadcast',
      injectRes.status === 200 && injectData.success === true && injectData.result?.status === 'applied'
    );

    // SIM-2a: Injected edit applies as seeded "Regional Admin (Islamabad)" with admin role
    const studentHistRes = await fetch(`${BASE_URL}/students/${studentTarget.id}/history`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const studentHistData = await studentHistRes.json();
    const latestHist = studentHistData.history?.find((h: any) => h.field === 'remarks') || studentHistData.history?.[0];
    const isRegionalAdmin =
      injectData.injectedBy === 'Regional Admin (Islamabad)' &&
      latestHist?.actorName === 'Regional Admin (Islamabad)' &&
      latestHist?.actorRole === 'admin';
    record(
      'SIM-2a',
      'Simulator',
      '/demo/inject-edit applies as seeded Regional Admin (Islamabad) with admin role',
      isRegionalAdmin,
      { injectedBy: injectData.injectedBy, latestActor: latestHist?.actorName, role: latestHist?.actorRole }
    );

    // SIM-2b: Injected edits never come from a role without permission (faculty blocked from editing official field)
    const unpermittedPushRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        operations: [
          {
            opId: 'op-unpermitted-' + Date.now(),
            studentId: studentTarget.id,
            field: 'full_name',
            newValue: 'Hacked Name',
            baseVersion: 1,
            deviceId: 'unauth-terminal',
            type: 'edit',
          },
        ],
      }),
    });
    const unpermittedPushData = await unpermittedPushRes.json();
    const wasRejected = unpermittedPushData.results?.[0]?.status === 'rejected';
    record(
      'SIM-2b',
      'Simulator',
      'Edits never come from a role without permission (faculty blocked from editing official field)',
      unpermittedPushRes.status === 200 && wasRejected,
      unpermittedPushData.results?.[0]
    );
  } catch (err: any) {
    record('SIM-2', 'Simulator', 'Concurrent edit simulation', false, null, err.message);
  }

  // SIM-3: Stale edit submission against SSE injected record produces server conflict (FR-12.2)
  try {
    const staleRemarksVersion = 1; // Prior version before SIM-2 injected edit
    const staleOpId = 'op-stale-remarks-' + Date.now();

    const stalePushRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [{
          opId: staleOpId,
          studentId: studentTarget.id,
          field: 'remarks',
          newValue: 'Concurrent Local Draft Remarks from Form',
          baseVersion: staleRemarksVersion,
          deviceId: 'browser-form-tab',
          type: 'edit',
        }],
      }),
    });
    const stalePushData = await stalePushRes.json();
    const staleResult = stalePushData.results?.[0];

    // Check conflict created in conflicts table
    const confCheckRes = await fetch(`${BASE_URL}/conflicts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const confCheckData = await confCheckRes.json();
    const remarksConflict = confCheckData.conflicts?.find(
      (c: any) => c.student_id === studentTarget.id && c.field === 'remarks'
    );

    record(
      'SIM-3',
      'Simulator',
      'FR-12.2 / SIM-3: Submitting open form edit with initial baseVersion after remote inject yields conflict row',
      staleResult?.status === 'conflict' && remarksConflict !== undefined,
      { staleResult, remarksConflict }
    );
  } catch (err: any) {
    record('SIM-3', 'Simulator', 'SSE conflict generation verification', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 15: REAL DR-3 TWO-DEVICE OFFLINE DUPLICATE DETECTION
  // --------------------------------------------------------------------------
  console.log(`\n--- SECTION 15: Real DR-3 Two-Device Duplicate Creation ---`);

  try {
    const dr3RegNo = `CS-2026-${Math.floor(10000 + Math.random() * 89999)}`;
    const dr3Cnic = `37405-${Math.floor(1000000 + Math.random() * 9000000)}-3`;

    // 1. Device A creates student online
    const devAId = 'a0000000-0000-0000-0000-' + Date.now().toString(16).padStart(12, '0').slice(-12);
    const devAOpId = 'op-dev-a-create-' + Date.now();
    const devARes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [{
          opId: devAOpId,
          studentId: devAId,
          field: '*',
          newValue: {
            id: devAId,
            reg_no: dr3RegNo,
            cnic: dr3Cnic,
            full_name: 'Device A Student',
            program: 'BS CS',
            campus: 'Lahore',
            semester: 1,
            status: 'Active',
            phone: '0300-1112233',
            email: 'dev.a@campussync.local',
            address: 'Device A Campus',
            emergency_contact: 'Father (0300-0000000)',
            attendance: 90,
          },
          baseVersion: 0,
          deviceId: 'device-a-online',
          type: 'create',
          studentData: {
            id: devAId,
            reg_no: dr3RegNo,
            cnic: dr3Cnic,
            full_name: 'Device A Student',
            program: 'BS CS',
            campus: 'Lahore',
            semester: 1,
            status: 'Active',
            phone: '0300-1112233',
            email: 'dev.a@campussync.local',
            address: 'Device A Campus',
            emergency_contact: 'Father (0300-0000000)',
            attendance: 90,
          },
        }],
      }),
    });
    const devAData = await devARes.json();
    const devAStatus = devAData.results?.[0]?.status;

    // 2. Device B (was offline) now reconnects and pushes same reg_no
    const devBId = 'b0000000-0000-0000-0000-' + Date.now().toString(16).padStart(12, '0').slice(-12);
    const devBOpId = 'op-dev-b-offline-create-' + Date.now();
    const devBRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        operations: [{
          opId: devBOpId,
          studentId: devBId,
          field: '*',
          newValue: {
            id: devBId,
            reg_no: dr3RegNo,
            cnic: `37405-${Math.floor(1000000 + Math.random() * 9000000)}-4`,
            full_name: 'Device B Offline Student',
            program: 'BS CS',
            campus: 'Islamabad',
            semester: 1,
            status: 'Active',
            phone: '0300-9998877',
            email: 'dev.b@campussync.local',
            address: 'Device B Campus',
            emergency_contact: 'Father (0300-0000000)',
            attendance: 88,
          },
          baseVersion: 0,
          deviceId: 'device-b-reconnecting',
          type: 'create',
          studentData: {
            id: devBId,
            reg_no: dr3RegNo,
            cnic: `37405-${Math.floor(1000000 + Math.random() * 9000000)}-4`,
            full_name: 'Device B Offline Student',
            program: 'BS CS',
            campus: 'Islamabad',
            semester: 1,
            status: 'Active',
            phone: '0300-9998877',
            email: 'dev.b@campussync.local',
            address: 'Device B Campus',
            emergency_contact: 'Father (0300-0000000)',
            attendance: 88,
          },
        }],
      }),
    });
    const devBData = await devBRes.json();
    const devBResult = devBData.results?.[0];

    record(
      'DR-3',
      'Duplicates',
      'Real DR-3: Device B offline creation caught as duplicate_record upon sync against Device A creation',
      devAStatus === 'applied' &&
        devBResult?.status === 'duplicate_record' &&
        devBResult?.existingRecordId === devAId &&
        devBResult?.regNo === dr3RegNo,
      { devAStatus, devBResult }
    );
  } catch (err: any) {
    record('DR-3', 'Duplicates', 'Real DR-3 verification', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 12 & 16: DATA CORRECTNESS INVARIANTS (LIVE SUITE)
  // --------------------------------------------------------------------------
  console.log(`\n--- SECTION 12 & 16: 7 SQL Correctness Invariants ---`);

  try {
    const suiteRes = await fetch(`${BASE_URL}/admin/integrity`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const suiteData = await suiteRes.json();

    for (const check of suiteData.checks || []) {
      record(
        check.id,
        'Integrity Invariants',
        `${check.name}: ${check.invariant}`,
        check.status === 'passed',
        { offendingCount: check.offendingRowsCount }
      );
    }

    record(
      'IC-ALL',
      'Integrity Invariants',
      'All 7 SQL Invariants Pass Continuously After Complete Test Sequence',
      suiteData.allPassed === true,
      suiteData
    );
  } catch (err: any) {
    record('IC-ALL', 'Integrity Invariants', 'Integrity suite check', false, null, err.message);
  }

  // --------------------------------------------------------------------------
  // FINAL SCORE & SUMMARY
  // --------------------------------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`TEST EXECUTION SUMMARY:`);
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Tests Run: ${total}`);
  console.log(`Passed:          ${passed}`);
  console.log(`Failed:          ${failed}`);
  console.log(`Success Rate:    ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    console.log('Failed test details:');
    for (const r of results) {
      if (!r.passed) {
        console.log(`- ${r.id}: ${r.name} -> Details: ${JSON.stringify(r.details)} Error: ${r.error}`);
      }
    }
    console.log('');
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      const fs = await import('fs');
      let markdown = `## CampusSync Test Plan Suite Results\n\n`;
      markdown += `| Test ID | Category | Name | Status | Details |\n`;
      markdown += `|---|---|---|---|---|\n`;
      for (const r of results) {
        markdown += `| \`${r.id}\` | ${r.category} | ${r.name} | ${r.passed ? '✅ PASS' : '❌ FAIL'} | ${r.error || ''} |\n`;
      }
      markdown += `\n**Total Tests:** ${total} | **Passed:** ${passed} | **Failed:** ${failed}\n`;
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    } catch (e) {}
  }

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
