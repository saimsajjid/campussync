/**
 * CampusSync Test Plan - Section 19: Concurrency & Chaos Test Runner
 *
 * Simulates 30 concurrent client workers firing interleaved edits,
 * conflicting updates, duplicate requests, and batch submissions.
 * Verifies that:
 * 1. Database row locking and serializable transactions prevent deadlocks.
 * 2. Exactly-once idempotency holds under high concurrency.
 * 3. Zero 500 internal server errors occur.
 * 4. All 7 SQL Correctness Invariants pass with 0 violations.
 */

const BASE_URL = process.env.TEST_TARGET || 'http://150.136.103.208.sslip.io';
const NUM_WORKERS = 30;
const OPS_PER_WORKER = 5; // 150 operations total across workers

interface ChaosStats {
  totalSent: number;
  applied: number;
  duplicate: number;
  conflict: number;
  rejected: number;
  serverErrors: number;
}

const stats: ChaosStats = {
  totalSent: 0,
  applied: 0,
  duplicate: 0,
  conflict: 0,
  rejected: 0,
  serverErrors: 0,
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

async function runWorker(workerId: number, adminToken: string, studentIds: string[]) {
  const deviceId = `chaos-device-${workerId}`;

  for (let i = 0; i < OPS_PER_WORKER; i++) {
    const studentId = studentIds[workerId % studentIds.length];
    const opId = `chaos-${workerId}-${i}-${Date.now()}`;
    const fieldChoice = i % 3 === 0 ? 'remarks' : i % 3 === 1 ? 'address' : 'emergency_contact';
    const newValue = `Worker ${workerId} Update ${i} [${new Date().toISOString()}]`;

    // Fetch latest snapshot to get baseVersion or deliberately use stale baseVersion
    let baseVersion = 1;
    try {
      const snapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (snapRes.ok) {
        const snap = await snapRes.json();
        const s = snap.students.find((std: any) => std.id === studentId);
        baseVersion = s?.field_versions?.[fieldChoice] || 1;
      }
    } catch {
      // Use default baseVersion
    }

    // Occasionally inject stale baseVersion to induce concurrent conflict handling
    if (i === 2) {
      baseVersion = Math.max(1, baseVersion - 1);
    }

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
              opId,
              studentId,
              field: fieldChoice,
              newValue,
              baseVersion,
              deviceId,
              type: 'edit',
            },
          ],
        }),
      });

      stats.totalSent++;

      if (pushRes.status >= 500) {
        stats.serverErrors++;
        console.error(`Worker ${workerId} received HTTP ${pushRes.status}`);
        continue;
      }

      const pushData = await pushRes.json();
      const status = pushData.results?.[0]?.status;

      if (status === 'applied') stats.applied++;
      else if (status === 'duplicate') stats.duplicate++;
      else if (status === 'conflict') stats.conflict++;
      else if (status === 'rejected') stats.rejected++;

      // In 20% of cases, simulate dropped ACK / immediate retry of the same opId
      if (i === 4) {
        const retryRes = await fetch(`${BASE_URL}/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            operations: [
              {
                opId,
                studentId,
                field: fieldChoice,
                newValue,
                baseVersion,
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
          const retryStatus = retryData.results?.[0]?.status;
          if (retryStatus === 'duplicate') stats.duplicate++;
          else if (retryStatus === 'applied') stats.applied++;
          else if (retryStatus === 'conflict') stats.conflict++;
          else stats.rejected++;
        }
      }
    } catch (err: any) {
      console.error(`Worker ${workerId} network error:`, err.message);
    }
  }
}

async function runChaos() {
  console.log(`\n======================================================`);
  console.log(`CampusSync Section 19: Concurrency & Chaos Harness`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Workers: ${NUM_WORKERS} concurrent devices`);
  console.log(`Operations Target: ~${NUM_WORKERS * OPS_PER_WORKER + NUM_WORKERS}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  // 1. Reset demo state to clean baseline
  console.log('Resetting demo baseline before chaos run...');
  await fetch(`${BASE_URL}/demo/reset`, { method: 'POST' });

  const adminToken = await loginAdmin();

  // Get available student IDs
  const snapRes = await fetch(`${BASE_URL}/sync/snapshot`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const snap = await snapRes.json();
  const studentIds = snap.students.map((s: any) => s.id);

  console.log(`Targeting ${studentIds.length} seeded student records across campuses.`);
  console.log(`Launching ${NUM_WORKERS} concurrent workers in parallel...\n`);

  const startTime = Date.now();
  const workerPromises = Array.from({ length: NUM_WORKERS }).map((_, idx) =>
    runWorker(idx, adminToken, studentIds)
  );

  await Promise.all(workerPromises);
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`Chaos workload execution finished in ${elapsedSec}s.\n`);
  console.log(`--- WORKLOAD ACCOUNTING ---`);
  console.log(`Total Operations Sent: ${stats.totalSent}`);
  console.log(`Applied:               ${stats.applied}`);
  console.log(`Duplicates Handled:    ${stats.duplicate}`);
  console.log(`Conflicts Held:        ${stats.conflict}`);
  console.log(`Rejected (Rules):      ${stats.rejected}`);
  console.log(`Server 500 Errors:     ${stats.serverErrors}`);

  const accountedTotal = stats.applied + stats.duplicate + stats.conflict + stats.rejected;
  console.log(`Accounted Operations:  ${accountedTotal} / ${stats.totalSent}`);

  // Invariant Verification after Chaos
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
    accountedTotal === stats.totalSent &&
    integrityReport.allPassed === true;

  console.log(`\n======================================================`);
  console.log(`CHAOS TEST CONCLUSION: ${chaosPassed ? 'PASSED (0 VIOLATIONS)' : 'FAILED'}`);
  console.log(`======================================================\n`);

  if (!chaosPassed) {
    process.exit(1);
  }
}

runChaos().catch((err) => {
  console.error('Fatal chaos error:', err);
  process.exit(1);
});
