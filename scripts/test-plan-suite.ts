import { pool } from '../server/src/db/pool.js';
import crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL || 'http://150.136.103.208.sslip.io';

interface TestResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

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
    adminToken = adminData.token;
    record('SM-3.1', 'Smoke', 'Login as Admin', adminLogin.status === 200 && adminData.user.role === 'admin', adminData.user);

    const facultyLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'faculty@campussync.local', password: 'password123' }),
    });
    const facultyData = await facultyLogin.json();
    facultyToken = facultyData.token;
    record('SM-3.2', 'Smoke', 'Login as Faculty', facultyLogin.status === 200 && facultyData.user.role === 'faculty', facultyData.user);

    const studentLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@campussync.local', password: 'password123' }),
    });
    const studentData = await studentLogin.json();
    studentToken = studentData.token;
    record('SM-3.3', 'Smoke', 'Login as Student', studentLogin.status === 200 && studentData.user.role === 'student', studentData.user);
  } catch (err: any) {
    record('SM-3', 'Smoke', 'Login as each role', false, null, err.message);
  }

  // SM-9: Reset Demo Data
  try {
    const resetRes = await fetch(`${BASE_URL}/demo/reset`, { method: 'POST' });
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
      'GET /sync/snapshot returns 3 multi-campus records',
      seededStudents.length === 3 && snapData.latestCursor >= 3,
      { count: seededStudents.length, cursor: snapData.latestCursor }
    );
  } catch (err: any) {
    record('SM-4', 'Smoke', 'Snapshot initial records', false, null, err.message);
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
              baseVersion: studentTarget.field_versions?.remarks || 1,
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
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
