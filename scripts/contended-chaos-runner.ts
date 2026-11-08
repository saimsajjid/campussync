/**
 * CampusSync Contended Chaos Runner
 *
 * Requirements (Task 6):
 * - 12 students
 * - 500+ operations
 * - ~25% same-field conflicts
 * - Dropped responses (idempotent retries)
 * - Full accounting (totalSent = applied + conflict + rejected + droppedRetries)
 * - Reference shadow model validation against final database snapshot
 * - Targets isolated compose environment: http://127.0.0.1:3055
 */

const BASE_URL = process.env.TEST_TARGET || 'http://127.0.0.1:3055';

interface StudentModel {
  id: string;
  reg_no: string;
  full_name: string;
  phone: string;
  address: string;
  emergency_contact: string;
  remarks: string;
  field_versions: Record<string, number>;
  version: number;
}

const referenceModel: Map<string, StudentModel> = new Map();

interface ChaosAccounting {
  totalSent: number;
  applied: number;
  conflict: number;
  idempotentRetries: number;
  rejected: number;
  serverErrors: number;
}

const accounting: ChaosAccounting = {
  totalSent: 0,
  applied: 0,
  conflict: 0,
  idempotentRetries: 0,
  rejected: 0,
  serverErrors: 0,
};

async function loginAdmin(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@campussync.local', password: 'admin' }),
  });
  if (!res.ok) throw new Error(`Admin login failed: ${res.statusText}`);
  const data = await res.json();
  return data.token;
}

async function prepare12Students(token: string): Promise<string[]> {
  console.log('Resetting test database to clean baseline...');
  await fetch(`${BASE_URL}/demo/reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const snapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const snapData = await snapRes.json();
  const studentIds: string[] = snapData.students.map((s: any) => s.id);

  console.log(`Initial students available: ${studentIds.length}`);

  // If fewer than 12 students, create additional students
  let idx = studentIds.length + 1;
  while (studentIds.length < 12) {
    const newId = `20000000-0000-0000-0000-${String(idx).padStart(12, '0')}`;
    const regNo = `FA26-BSE-${String(idx).padStart(3, '0')}`;
    const cnic = `35201-${String(idx).padStart(7, '0')}-1`;
    const pushRes = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        operations: [
          {
            opId: `op-create-std-${idx}-${Date.now()}`,
            studentId: newId,
            field: '*',
            newValue: {
              id: newId,
              reg_no: regNo,
              cnic: cnic,
              full_name: `Chaos Student ${idx}`,
              program: 'BS Software Engineering',
              campus: idx % 2 === 0 ? 'Lahore' : 'Islamabad',
              semester: 4,
              status: 'Enrolled',
              phone: `0300-${String(idx).padStart(7, '0')}`,
              email: `student${idx}@campussync.edu.pk`,
              address: `House ${idx}, Campus Town`,
              emergency_contact: `0321-${String(idx).padStart(7, '0')}`,
              attendance: 85,
              remarks: 'Initial seed',
            },
            baseVersion: 0,
            deviceId: 'chaos-init-device',
            type: 'create',
          },
        ],
      }),
    });

    if (pushRes.ok) {
      studentIds.push(newId);
    }
    idx++;
  }

  // Reload snapshot and build initial reference model
  const finalSnapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const finalSnap = await finalSnapRes.json();

  for (const s of finalSnap.students) {
    referenceModel.set(s.id, {
      id: s.id,
      reg_no: s.reg_no,
      full_name: s.full_name,
      phone: s.phone,
      address: s.address,
      emergency_contact: s.emergency_contact,
      remarks: s.remarks || '',
      field_versions: { ...s.field_versions },
      version: s.version,
    });
  }

  console.log(`Prepared ${studentIds.slice(0, 12).length} students for contended chaos test.`);
  return studentIds.slice(0, 12);
}

async function runContendedChaos() {
  console.log('===============================================================');
  console.log('   CAMPUSSYNC HIGH-CONTENTION CHAOS & STRESS HARNESS           ');
  console.log('   12 Students | 500+ Operations | ~25% Conflicts | Drop-Retry ');
  console.log(`   Target: ${BASE_URL}                                         `);
  console.log('===============================================================\n');

  const token = await loginAdmin();
  const studentIds = await prepare12Students(token);

  const EDIT_FIELDS = ['phone', 'address', 'remarks', 'emergency_contact'] as const;

  // We will generate 520 operations across the 12 students.
  // ~75% clean distinct field edits
  // ~25% deliberate same-field conflicts (competing edits with stale baseVersion)
  // 50 simulated dropped-response retries (submitting exact same opId again)
  const TOTAL_TARGET_OPS = 520;
  console.log(`Generating and executing ${TOTAL_TARGET_OPS} operations with high contention...\n`);

  const seenOpIds = new Set<string>();

  // Process in batches of 40 concurrent operations to prevent local socket starvation
  const BATCH_SIZE = 40;
  let opCounter = 0;

  while (opCounter < TOTAL_TARGET_OPS) {
    const batchOps: any[] = [];
    const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_TARGET_OPS - opCounter);

    // Determine how many conflicts in this batch (~25%)
    for (let i = 0; i < currentBatchSize; i++) {
      const currentOpIndex = opCounter + i;
      const studentId = studentIds[currentOpIndex % studentIds.length];
      const model = referenceModel.get(studentId)!;

      const isConflictAttempt = currentOpIndex % 4 === 3; // ~25%
      const field = isConflictAttempt
        ? 'phone' // Collide heavily on phone field
        : EDIT_FIELDS[currentOpIndex % EDIT_FIELDS.length];

      const opId = `op-contended-${currentOpIndex}-${Date.now()}`;
      seenOpIds.add(opId);

      let baseVersion = model.field_versions[field] || 1;
      let newValue: any = '';

      if (isConflictAttempt) {
        // Deliberately pass a stale base version (-1 or 0) to induce conflicting divergence
        baseVersion = Math.max(1, baseVersion - 1);
        newValue = `0300-999${String(currentOpIndex).padStart(4, '0')}`;
      } else {
        if (field === 'phone') newValue = `0300-${String(1000000 + currentOpIndex)}`;
        else if (field === 'address') newValue = `Plot ${currentOpIndex}, Contention Block, Phase 5`;
        else if (field === 'remarks') newValue = `Audit verification stamp #${currentOpIndex}`;
        else if (field === 'emergency_contact') newValue = `0321-${String(2000000 + currentOpIndex)}`;
      }

      batchOps.push({
        opId,
        studentId,
        field,
        newValue,
        baseVersion,
        deviceId: `device-worker-${currentOpIndex % 12}`,
        type: 'edit',
        expectedConflict: isConflictAttempt,
      });
    }

    // Execute batch against server
    const batchPromises = batchOps.map(async (opPayload) => {
      accounting.totalSent++;
      try {
        const res = await fetch(`${BASE_URL}/sync/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            operations: [
              {
                opId: opPayload.opId,
                studentId: opPayload.studentId,
                field: opPayload.field,
                newValue: opPayload.newValue,
                baseVersion: opPayload.baseVersion,
                deviceId: opPayload.deviceId,
                type: 'edit',
              },
            ],
          }),
        });

        if (!res.ok) {
          accounting.serverErrors++;
          return;
        }

        const data = await res.json();
        const outcome = data.results?.[0];

        if (outcome?.status === 'applied') {
          accounting.applied++;
          // Update reference shadow model on accepted write
          const model = referenceModel.get(opPayload.studentId)!;
          (model as any)[opPayload.field] = opPayload.newValue;
          model.field_versions[opPayload.field] = (model.field_versions[opPayload.field] || 1) + 1;
          model.version += 1;
        } else if (outcome?.status === 'conflict') {
          accounting.conflict++;
          // On conflict, server holds write and keeps previous value -> reference model remains untouched
        } else {
          accounting.rejected++;
        }
      } catch (err) {
        accounting.serverErrors++;
      }
    });

    await Promise.all(batchPromises);
    opCounter += currentBatchSize;
    process.stdout.write(`  Executed ${opCounter}/${TOTAL_TARGET_OPS} ops...\r`);
  }

  console.log(`\nAll ${TOTAL_TARGET_OPS} base ops submitted.`);

  // -------------------------------------------------------------
  // SIMULATE DROPPED RESPONSES & IDEMPOTENT RETRIES (50 operations)
  // -------------------------------------------------------------
  console.log('Simulating 50 dropped responses: retrying already-sent opIds...');
  const opArray = Array.from(seenOpIds).slice(0, 50);

  const retryPromises = opArray.map(async (opId) => {
    accounting.totalSent++;
    accounting.idempotentRetries++;
    try {
      const res = await fetch(`${BASE_URL}/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          operations: [
            {
              opId,
              studentId: studentIds[0],
              field: 'remarks',
              newValue: 'Idempotency retry packet',
              baseVersion: 1,
              deviceId: 'device-retry-worker',
              type: 'edit',
            },
          ],
        }),
      });

      if (!res.ok) {
        accounting.serverErrors++;
      }
    } catch {
      accounting.serverErrors++;
    }
  });

  await Promise.all(retryPromises);

  // -------------------------------------------------------------
  // FULL ACCOUNTING AUDIT
  // -------------------------------------------------------------
  console.log('\n--- CONTENDED CHAOS EXECUTION ACCOUNTING ---');
  console.log(`Total Requests Sent:         ${accounting.totalSent}`);
  console.log(`Applied Operations:          ${accounting.applied}`);
  console.log(`Conflicting Operations:      ${accounting.conflict}`);
  console.log(`Rejected Operations:         ${accounting.rejected}`);
  console.log(`Idempotent Retries Sent:     ${accounting.idempotentRetries}`);
  console.log(`Server Errors (5xx):         ${accounting.serverErrors}`);

  const conflictRate = ((accounting.conflict / TOTAL_TARGET_OPS) * 100).toFixed(1);
  console.log(`Actual Conflict Rate:        ${conflictRate}% (Target ~25%)`);

  // Accounting verification
  const totalAccounted = accounting.applied + accounting.conflict + accounting.rejected + accounting.idempotentRetries;
  const isAccountingSound = totalAccounted === accounting.totalSent && accounting.serverErrors === 0;
  console.log(`Full Accounting Balanced:    ${isAccountingSound ? 'YES (100% Accounted)' : 'NO'}`);

  // -------------------------------------------------------------
  // SHADOW REFERENCE MODEL VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- SHADOW REFERENCE MODEL VERIFICATION ---');
  const verifySnapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const verifySnap = await verifySnapRes.json();

  let modelMismatches = 0;
  for (const dbStudent of verifySnap.students) {
    if (!referenceModel.has(dbStudent.id)) continue;
    const ref = referenceModel.get(dbStudent.id)!;

    for (const f of EDIT_FIELDS) {
      const dbVal = dbStudent[f] || '';
      const refVal = (ref as any)[f] || '';
      if (dbVal !== refVal) {
        console.error(`  ❌ Mismatch on student ${dbStudent.reg_no} field '${f}': DB="${dbVal}" vs MODEL="${refVal}"`);
        modelMismatches++;
      }
    }
  }

  const modelMatches = modelMismatches === 0;
  console.log(`Reference Model vs DB Match: ${modelMatches ? 'PERFECT (0 Mismatches across all 12 students)' : `FAILED (${modelMismatches} mismatches)`}`);

  // -------------------------------------------------------------
  // POST-CHAOS INTEGRITY SUITE RUN
  // -------------------------------------------------------------
  console.log('\n--- POST-CHAOS DATABASE INTEGRITY SUITE ---');
  const integRes = await fetch(`${BASE_URL}/admin/integrity`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const integ = await integRes.json();

  console.log(`Integrity Suite Status:      ${integ.allPassed ? 'ALL INVARIANTS PASSED' : 'FAILED'}`);
  for (const c of integ.checks || []) {
    console.log(`  - [${c.status.toUpperCase()}] ${c.id}: ${c.name} (${c.offendingRowsCount} violations)`);
  }

  const allPassed =
    accounting.serverErrors === 0 &&
    isAccountingSound &&
    modelMatches &&
    integ.allPassed === true &&
    accounting.totalSent >= 550;

  console.log('\n===============================================================');
  console.log(`CONCLUSION: CONTENDED CHAOS RUN ${allPassed ? 'PASSED SUCCESSFULLY' : 'FAILED'}`);
  console.log('===============================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runContendedChaos().catch((err) => {
  console.error('Fatal error during contended chaos run:', err);
  process.exit(1);
});
