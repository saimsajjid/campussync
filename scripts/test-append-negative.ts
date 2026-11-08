import { pool } from '../server/src/db/pool.js';
import { runIntegritySuite } from '../server/src/services/integrity.js';

async function main() {
  console.log('===============================================================');
  console.log('  NEGATIVE TEST: APPEND-ONLY TAMPERING TRIGGER DROP & RESTORE  ');
  console.log('===============================================================\n');

  // 1. Initial State: Trigger is active, active mutation check must PASS
  console.log('--- STEP 1: Verify Baseline Invariant 7 (Append-Only) Passes ---');
  let baseline = await runIntegritySuite();
  let appendCheck = baseline.checks.find(c => c.id === 'inv-append-only');
  console.log(`Baseline status: ${appendCheck?.status.toUpperCase()}`);
  if (appendCheck?.status !== 'passed') {
    throw new Error('Baseline integrity check failed before mutation test!');
  }
  console.log('✅ Baseline confirmed: inv-append-only passed with active trigger.\n');

  // 2. Drop Trigger: In test database, drop the tampering trigger
  console.log('--- STEP 2: Drop Trigger trg_prevent_history_update ---');
  await pool.query('DROP TRIGGER IF EXISTS trg_prevent_history_update ON history;');
  console.log('Trigger trg_prevent_history_update dropped.\n');

  try {
    // 3. Negative Assertion: Check must FAIL because update/delete mutations now succeed
    console.log('--- STEP 3: Run Integrity Suite with Trigger Dropped ---');
    let negativeReport = await runIntegritySuite();
    let negativeCheck = negativeReport.checks.find(c => c.id === 'inv-append-only');
    console.log(`Report allPassed: ${negativeReport.allPassed}`);
    console.log(`inv-append-only status: ${negativeCheck?.status.toUpperCase()}`);
    console.log(`inv-append-only offendingCount: ${negativeCheck?.offendingRowsCount}`);
    console.log(`inv-append-only details:`, JSON.stringify(negativeCheck?.details, null, 2));

    const checkFailed = negativeReport.allPassed === false &&
                        negativeCheck?.status === 'failed' &&
                        negativeCheck.offendingRowsCount > 0;

    if (!checkFailed) {
      throw new Error('FAILED: Integrity check falsely passed when trigger was dropped!');
    }
    console.log('✅ PASS [NEG-1]: Dropped trigger was immediately detected and flagged as failed by active mutation check!\n');
  } finally {
    // 4. Restore Trigger
    console.log('--- STEP 4: Restore Trigger trg_prevent_history_update ---');
    await pool.query(`
      CREATE OR REPLACE FUNCTION prevent_history_tampering()
      RETURNS TRIGGER AS $$
      BEGIN
          RAISE EXCEPTION 'History entries are immutable and append-only. Modifying or deleting is forbidden.';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_prevent_history_update ON history;
      CREATE TRIGGER trg_prevent_history_update
      BEFORE UPDATE OR DELETE ON history
      FOR EACH ROW EXECUTE FUNCTION prevent_history_tampering();
    `);
    console.log('Trigger trg_prevent_history_update recreated.\n');

    // 5. Verification after restore: Invariant 7 must PASS again
    console.log('--- STEP 5: Verify Restoration ---');
    let restoredReport = await runIntegritySuite();
    let restoredCheck = restoredReport.checks.find(c => c.id === 'inv-append-only');
    console.log(`Restored status: ${restoredCheck?.status.toUpperCase()}`);
    if (restoredCheck?.status !== 'passed') {
      throw new Error('Integrity check failed after restoring trigger!');
    }
    console.log('✅ PASS [NEG-2]: Invariant 7 passed cleanly after restoring trigger.\n');
  }

  console.log('===============================================================');
  console.log('  NEGATIVE TEST COMPLETED: 100% SUCCESS                       ');
  console.log('===============================================================');
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error during negative test:', err);
  process.exit(1);
});
