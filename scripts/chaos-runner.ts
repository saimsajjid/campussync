/**
 * CampusSync Test Plan - Section 19: Redesigned Chaos & Concurrency Harness
 *
 * Requirements:
 * 1. Mixed fields so most ops do not conflict (>80% applied).
 * 2. Dropped responses: Simulates network drop after commit followed by immediate retry.
 * 3. Offline reordering: Queues multiple field edits offline and delivers in reversed/interleaved order.
 * 4. Reference Model Comparison: Verifies actual PostgreSQL state matches reference shadow model exactly.
 * 5. Runs against local compose environment (http://127.0.0.1:3055).
 */

const BASE_URL = process.env.TEST_TARGET || 'http://127.0.0.1:3055';

interface ReferenceStudent {
  id: string;
  phone: string;
  address: string;
  remarks: string;
  emergency_contact: string;
  field_versions: Record<string, number>;
  version: number;
}

const referenceModel: Record<string, ReferenceStudent> = {};

interface ChaosStats {
  totalSent: number;
  applied: number;
  duplicate: number;
  conflict: number;
  rejected: number;
  serverErrors: number;
  droppedRetriesSent: number;
  reorderedBatchesSent: number;
}

const stats: ChaosStats = {
  totalSent: 0,
  applied: 0,
  duplicate: 0,
  conflict: 0,
  rejected: 0,
  serverErrors: 0,
  droppedRetriesSent: 0,
  reorderedBatchesSent: 0,
};

async function loginAdmin(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@campussync.local', password: 'password123' }),
  });
  const data = await res.json();
  return data.token;
}

async function initReferenceModel(adminToken: string) {
  const res = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await res.json();
  for (const s of data.students) {
    referenceModel[s.id] = {
      id: s.id,
      phone: s.phone,
      address: s.address,
      remarks: s.remarks || '',
      emergency_contact: s.emergency_contact,
      field_versions: { ...s.field_versions },
      version: s.version,
    };
  }
}

async function runWorker(
  workerId: number,
  adminToken: string,
  studentId: string,
  assignedField: 'phone' | 'address' | 'remarks' | 'emergency_contact'
) {
  const deviceId = `chaos-worker-${workerId}`;

  // 1. Regular Clean Edit (Assigned field unique to this worker per student)
  const opId1 = `op-clean-${workerId}-${Date.now()}`;
  let baseVer = referenceModel[studentId].field_versions[assignedField] || 1;

  let val1 = '';
  if (assignedField === 'phone') val1 = `0300-555${String(workerId).padStart(4, '0')}`;
  else if (assignedField === 'address') val1 = `House ${workerId}, Street 7, Model Town`;
  else if (assignedField === 'remarks') val1 = `Worker ${workerId} verification notes passed`;
  else val1 = `Guardian ${workerId} - 0300-444${String(workerId).padStart(4, '0')}`;

  const pushRes1 = await fetch(`${BASE_URL}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      operations: [
        {
          opId: opId1,
          studentId,
          field: assignedField,
          newValue: val1,
          baseVersion: baseVer,
          deviceId,
          type: 'edit',
        },
      ],
    }),
  });

  stats.totalSent++;
  if (pushRes1.status >= 500) {
    stats.serverErrors++;
  } else {
    const resData1 = await pushRes1.json();
    const opRes1 = resData1.results?.[0];
    if (opRes1?.status === 'applied') {
      stats.applied++;
      // Update reference model
      referenceModel[studentId][assignedField] = val1;
      referenceModel[studentId].field_versions[assignedField] = (referenceModel[studentId].field_versions[assignedField] || 1) + 1;
      referenceModel[studentId].version++;
    } else if (opRes1?.status === 'duplicate') stats.duplicate++;
    else if (opRes1?.status === 'conflict') stats.conflict++;
    else stats.rejected++;
  }

  // 2. Dropped Response Simulation: Worker retries opId1 simulating lost ACK
  stats.droppedRetriesSent++;
  const retryRes = await fetch(`${BASE_URL}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      operations: [
        {
          opId: opId1,
          studentId,
          field: assignedField,
          newValue: val1,
          baseVersion: baseVer,
          deviceId,
          type: 'edit',
        },
      ],
    }),
  });

  stats.totalSent++;
  if (retryRes.status >= 500) {
    stats.serverErrors++;
  } else {
    const retryData = await retryRes.json();
    const retryOpRes = retryData.results?.[0];
    if (retryOpRes?.status === 'duplicate') {
      stats.duplicate++;
    } else if (retryOpRes?.status === 'applied') {
      stats.applied++;
    } else if (retryOpRes?.status === 'conflict') {
      stats.conflict++;
    } else {
      stats.rejected++;
    }
  }
}

async function runOfflineReorderingTest(adminToken: string, studentId: string) {
  stats.reorderedBatchesSent++;
  const deviceId = 'offline-reordering-client';

  // Queue 3 offline edits to different fields on the student
  const curPhoneVer = referenceModel[studentId].field_versions.phone;
  const curRemarksVer = referenceModel[studentId].field_versions.remarks;
  const curAddressVer = referenceModel[studentId].field_versions.address;

  const phoneVal = '0300-8889911';
  const remarksVal = 'Reordered offline submission applied successfully';
  const addressVal = 'Reordered Plot 100, Sector H-12, Islamabad';

  const opA = {
    opId: `op-reorder-A-${Date.now()}`,
    studentId,
    field: 'phone',
    newValue: phoneVal,
    baseVersion: curPhoneVer,
    deviceId,
    type: 'edit' as const,
  };

  const opB = {
    opId: `op-reorder-B-${Date.now()}`,
    studentId,
    field: 'remarks',
    newValue: remarksVal,
    baseVersion: curRemarksVer,
    deviceId,
    type: 'edit' as const,
  };

  const opC = {
    opId: `op-reorder-C-${Date.now()}`,
    studentId,
    field: 'address',
    newValue: addressVal,
    baseVersion: curAddressVer,
    deviceId,
    type: 'edit' as const,
  };

  // Submit in reverse order: [opC, opB, opA]
  const reorderRes = await fetch(`${BASE_URL}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      operations: [opC, opB, opA],
    }),
  });

  stats.totalSent += 3;
  if (reorderRes.status >= 500) {
    stats.serverErrors += 3;
  } else {
    const data = await reorderRes.json();
    for (const r of data.results || []) {
      if (r.status === 'applied') {
        stats.applied++;
        referenceModel[studentId][r.field as 'phone' | 'remarks' | 'address'] =
          r.field === 'phone' ? phoneVal : r.field === 'remarks' ? remarksVal : addressVal;
        referenceModel[studentId].field_versions[r.field] =
          (referenceModel[studentId].field_versions[r.field] || 1) + 1;
        referenceModel[studentId].version++;
      } else if (r.status === 'duplicate') stats.duplicate++;
      else if (r.status === 'conflict') stats.conflict++;
      else stats.rejected++;
    }
  }
}

async function runRedesignedChaos() {
  console.log(`\n======================================================`);
  console.log(`CampusSync Section 19: Redesigned Concurrency & Chaos Harness`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  const adminToken = await loginAdmin();

  // 1. Reset baseline demo state
  console.log('Resetting demo baseline before chaos run...');
  await fetch(`${BASE_URL}/demo/reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  await initReferenceModel(adminToken);

  const studentIds = Object.keys(referenceModel);
  console.log(`Targeting ${studentIds.length} seeded student records.`);
  console.log(`Starting 12 parallel non-conflicting field workers + dropped ACK retries...`);

  const fields: Array<'phone' | 'address' | 'remarks' | 'emergency_contact'> = [
    'phone',
    'address',
    'remarks',
    'emergency_contact',
  ];

  // Create 12 parallel tasks: 4 distinct fields across 3 students
  const tasks: Promise<void>[] = [];
  let workerId = 0;
  for (let sIdx = 0; sIdx < studentIds.length; sIdx++) {
    for (let fIdx = 0; fIdx < fields.length; fIdx++) {
      tasks.push(runWorker(workerId++, adminToken, studentIds[sIdx], fields[fIdx]));
    }
  }

  const startTime = Date.now();
  await Promise.all(tasks);

  // Run offline reordering on student 1
  console.log(`Running offline reordering delivery test...`);
  await runOfflineReorderingTest(adminToken, studentIds[0]);

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nChaos workload finished in ${elapsedSec}s.\n`);

  console.log(`--- WORKLOAD METRICS ---`);
  console.log(`Total Operations Sent:   ${stats.totalSent}`);
  console.log(`Applied (Non-conflict):  ${stats.applied}`);
  console.log(`Duplicates Handled:      ${stats.duplicate}`);
  console.log(`Conflicts Held:          ${stats.conflict}`);
  console.log(`Rejected (Rule errors):  ${stats.rejected}`);
  console.log(`Server 500 Errors:       ${stats.serverErrors}`);
  console.log(`Dropped ACKs Simulated:  ${stats.droppedRetriesSent}`);
  console.log(`Reordered Batches Sent:  ${stats.reorderedBatchesSent}`);

  const nonConflictRate = ((stats.applied / (stats.applied + stats.conflict)) * 100).toFixed(1);
  console.log(`Non-Conflict Rate:       ${nonConflictRate}% (Requirement: Most ops do not conflict)`);

  // Compare Final Database to Reference Model
  console.log(`\n--- REFERENCE MODEL COMPARISON ---`);
  const finalSnapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const finalSnap = await finalSnapRes.json();

  let stateDiscrepancies = 0;
  for (const s of finalSnap.students) {
    const ref = referenceModel[s.id];
    if (!ref) {
      console.error(`❌ Student ${s.id} not found in reference model!`);
      stateDiscrepancies++;
      continue;
    }

    const checkFields: Array<'phone' | 'address' | 'remarks' | 'emergency_contact'> = [
      'phone',
      'address',
      'remarks',
      'emergency_contact',
    ];

    for (const f of checkFields) {
      if (s[f] !== ref[f]) {
        console.error(`❌ Discrepancy on student ${s.reg_no} field ${f}: Actual="${s[f]}" vs Reference="${ref[f]}"`);
        stateDiscrepancies++;
      }
    }

    if (s.version !== ref.version) {
      console.error(`❌ Version mismatch on student ${s.reg_no}: Actual=${s.version} vs Reference=${ref.version}`);
      stateDiscrepancies++;
    }
  }

  const modelMatch = stateDiscrepancies === 0;
  console.log(`Reference Model Comparison: ${modelMatch ? 'PERFECT MATCH (0 discrepancies) ✅' : 'FAILED ❌'}`);

  // Invariant Suite Verification
  console.log(`\n--- POST-CHAOS INTEGRITY AUDIT ---`);
  const integRes = await fetch(`${BASE_URL}/admin/integrity`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const integrityReport = await integRes.json();

  console.log(`Integrity Suite Status: ${integrityReport.allPassed ? 'ALL 7 PASSED ✅' : 'FAILED ❌'}`);
  integrityReport.checks?.forEach((c: any) => {
    const icon = c.status === 'passed' ? '✅' : '❌';
    console.log(`  ${icon} [${c.id}] ${c.name}: ${c.status} (${c.offendingRowsCount} offending rows)`);
  });

  const chaosPassed =
    stats.serverErrors === 0 &&
    Number(nonConflictRate) > 80 &&
    modelMatch &&
    integrityReport.allPassed === true;

  console.log(`\n======================================================`);
  console.log(`REDESIGNED CHAOS TEST CONCLUSION: ${chaosPassed ? 'PASSED (0 VIOLATIONS, 100% PARITY)' : 'FAILED'}`);
  console.log(`======================================================\n`);

  if (!chaosPassed) {
    process.exit(1);
  }
}

runRedesignedChaos().catch((err) => {
  console.error('Fatal chaos error:', err);
  process.exit(1);
});
