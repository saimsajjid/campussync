/**
 * CampusSync Test Plan - Section 12: Integrity Negative Suite (IC-4 to IC-9)
 *
 * Proves that the integrity suite is authentic and reliably detects
 * data corruption, replay drift, version tampering, and orphaned audit trails.
 */

import { execSync } from 'child_process';

const BASE_URL = process.env.TEST_TARGET || 'http://150.136.103.208.sslip.io';
const SSH_HOST = 'ubuntu@150.136.103.208';
const SSH_KEY = 'C:\\priv.key';

function runSql(sql: string): string {
  const b64 = Buffer.from(sql).toString('base64');
  const cmd = `ssh.exe -i "${SSH_KEY}" ${SSH_HOST} "echo ${b64} | base64 -d | sudo docker exec -i campussync-db psql -U campussync -d campussync"`;
  return execSync(cmd, { encoding: 'utf8' });
}

interface TestResult {
  id: string;
  name: string;
  detected: boolean;
  checkId: string;
  details?: any;
}

const results: TestResult[] = [];

async function getIntegrityReport() {
  const res = await fetch(`${BASE_URL}/admin/integrity`);
  return res.json();
}

async function resetDemo() {
  await fetch(`${BASE_URL}/demo/reset`, { method: 'POST' });
}

async function runNegativeSuite() {
  console.log(`\n======================================================`);
  console.log(`CampusSync Integrity Negative Suite (IC-4 to IC-9)`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  // Start with clean state
  await resetDemo();
  let cleanReport = await getIntegrityReport();
  if (!cleanReport.allPassed) {
    throw new Error('Initial integrity check failed on clean state!');
  }
  console.log('✅ Baseline confirmed: Clean database passes all 7 integrity checks.\n');

  // IC-4: Detects Duplicate Unique Value
  console.log('Testing IC-4: Duplicate unique natural key injection...');
  try {
    runSql('ALTER TABLE students DROP CONSTRAINT IF EXISTS students_reg_no_key;');
    runSql(`INSERT INTO students (id, reg_no, cnic, full_name, program, campus, semester, status, phone, email, address, emergency_contact, attendance, remarks, field_versions, version, active, last_editor_id)
            VALUES ('10000000-0000-0000-0000-999999999999', 'CS-2026-0101', '35201-9999999-9', 'Duplicate Student', 'BS CS', 'Lahore', 4, 'Active', '0300-9999999', 'dup@campussync.local', 'Test Address', 'Test Contact', 90, 'None', '{}', 1, TRUE, 'Tester');`);
    const report = await getIntegrityReport();
    const uniqCheck = report.checks?.find((c: any) => c.id === 'inv-uniqueness');
    const detected = report.allPassed === false && uniqCheck?.status === 'failed' && uniqCheck?.offendingRowsCount > 0;
    results.push({
      id: 'IC-4',
      name: 'Detects Duplicate Unique Key',
      detected,
      checkId: 'inv-uniqueness',
      details: uniqCheck?.details,
    });
    console.log(detected ? '✅ PASS [IC-4] Duplicate registration number correctly detected and flagged' : '❌ FAIL [IC-4]');
  } finally {
    await resetDemo();
    runSql('ALTER TABLE students ADD CONSTRAINT students_reg_no_key UNIQUE (reg_no);');
  }

  // IC-5: Detects Replay Mismatch
  // Modify student full_name directly in SQL without appending to history
  console.log('Testing IC-5: Direct database modification bypassing history ledger...');
  try {
    runSql("UPDATE students SET full_name = 'Corrupted Injected Name' WHERE id = '10000000-0000-0000-0000-000000000001'");
    const report = await getIntegrityReport();
    const replayCheck = report.checks?.find((c: any) => c.id === 'inv-replayability');
    const detected = report.allPassed === false && replayCheck?.status === 'failed' && replayCheck?.offendingRowsCount > 0;
    results.push({
      id: 'IC-5',
      name: 'Detects Replay Mismatch',
      detected,
      checkId: 'inv-replayability',
      details: replayCheck?.details,
    });
    console.log(detected ? '✅ PASS [IC-5] Replay mismatch correctly detected and flagged' : '❌ FAIL [IC-5]');
  } finally {
    await resetDemo();
  }

  // IC-6: Detects Version Mismatch
  // Alter record version number directly so version != count(history)
  console.log('\nTesting IC-6: Alter record version number directly...');
  try {
    runSql("UPDATE students SET version = 99 WHERE id = '10000000-0000-0000-0000-000000000001'");
    const report = await getIntegrityReport();
    const verCheck = report.checks?.find((c: any) => c.id === 'inv-version-integrity');
    const detected = report.allPassed === false && verCheck?.status === 'failed' && verCheck?.offendingRowsCount > 0;
    results.push({
      id: 'IC-6',
      name: 'Detects Version Mismatch',
      detected,
      checkId: 'inv-version-integrity',
      details: verCheck?.details,
    });
    console.log(detected ? '✅ PASS [IC-6] Version mismatch correctly detected and flagged' : '❌ FAIL [IC-6]');
  } finally {
    await resetDemo();
  }

  // IC-7: Detects Orphan History Row
  console.log('\nTesting IC-7: Orphan history row referencing non-existent student...');
  try {
    runSql('ALTER TABLE history DROP CONSTRAINT IF EXISTS history_student_id_fkey;');
    runSql('ALTER TABLE history DISABLE TRIGGER trg_prevent_history_update;');
    runSql(`INSERT INTO history (student_id, field, old_value, new_value, field_version_after, type, actor_id, actor_role, actor_campus, device_id, op_id)
            VALUES ('99999999-9999-9999-9999-999999999999', 'phone', '"0300-0000000"', '"0300-1111111"', 1, 'edit', 'Test', 'admin', 'Lahore', 'dev-1', 'op-orphan-test');`);
    runSql('ALTER TABLE history ENABLE TRIGGER trg_prevent_history_update;');

    const report = await getIntegrityReport();
    const refCheck = report.checks?.find((c: any) => c.id === 'inv-referential-integrity');
    const detected = report.allPassed === false && refCheck?.status === 'failed' && refCheck?.offendingRowsCount > 0;
    results.push({
      id: 'IC-7',
      name: 'Detects Orphan History Row',
      detected,
      checkId: 'inv-referential-integrity',
      details: refCheck?.details,
    });
    console.log(detected ? '✅ PASS [IC-7] Orphan history row correctly detected and flagged' : '❌ FAIL [IC-7]');
  } finally {
    await resetDemo();
    runSql('ALTER TABLE history ADD CONSTRAINT history_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;');
  }

  // IC-8: Detects Double-Applied Operation ID
  // Insert two history entries with identical op_id
  console.log('\nTesting IC-8: Insert duplicated history entry with same op_id...');
  try {
    // Disable trigger temporarily to test detection
    runSql('ALTER TABLE history DISABLE TRIGGER trg_prevent_history_update');
    runSql(`INSERT INTO history (student_id, field, old_value, new_value, field_version_after, type, actor_id, actor_role, actor_campus, device_id, op_id)
            VALUES ('10000000-0000-0000-0000-000000000001', 'phone', '"0300-1111111"', '"0300-2222222"', 2, 'edit', 'Test', 'admin', 'Lahore', 'dev-1', 'op-dup-test-key');
            INSERT INTO history (student_id, field, old_value, new_value, field_version_after, type, actor_id, actor_role, actor_campus, device_id, op_id)
            VALUES ('10000000-0000-0000-0000-000000000001', 'phone', '"0300-2222222"', '"0300-3333333"', 3, 'edit', 'Test', 'admin', 'Lahore', 'dev-1', 'op-dup-test-key');`);
    runSql('ALTER TABLE history ENABLE TRIGGER trg_prevent_history_update');

    const report = await getIntegrityReport();
    const dupOpCheck = report.checks?.find((c: any) => c.id === 'inv-exactly-once');
    const detected = report.allPassed === false && dupOpCheck?.status === 'failed' && dupOpCheck?.offendingRowsCount > 0;
    results.push({
      id: 'IC-8',
      name: 'Detects Double-Applied Operation ID',
      detected,
      checkId: 'inv-exactly-once',
      details: dupOpCheck?.details,
    });
    console.log(detected ? '✅ PASS [IC-8] Duplicate op_id correctly detected and flagged' : '❌ FAIL [IC-8]');
  } finally {
    await resetDemo();
  }

  // IC-9: Detects Lost/Orphaned Processed Op
  // Insert an op with status 'applied' in processed_ops without corresponding history row
  console.log('\nTesting IC-9: Insert orphaned applied processed_op with no history record...');
  try {
    runSql(`INSERT INTO processed_ops (op_id, result) VALUES ('op-phantom-audit-loss', '{"status":"applied","studentId":"10000000-0000-0000-0000-000000000001"}')`);
    const report = await getIntegrityReport();
    const lostCheck = report.checks?.find((c: any) => c.id === 'inv-no-lost-edits');
    const detected = report.allPassed === false && lostCheck?.status === 'failed' && lostCheck?.offendingRowsCount > 0;
    results.push({
      id: 'IC-9',
      name: 'Detects Lost Processed Op',
      detected,
      checkId: 'inv-no-lost-edits',
      details: lostCheck?.details,
    });
    console.log(detected ? '✅ PASS [IC-9] Silent edit loss correctly detected and flagged' : '❌ FAIL [IC-9]');
  } finally {
    await resetDemo();
  }

  // Final verification: Clean reset returns to 100% pass
  const finalReport = await getIntegrityReport();
  const restoredClean = finalReport.allPassed === true;
  console.log(`\nFinal reset restored clean status: ${restoredClean ? 'YES (All 7 passed)' : 'NO'}`);

  console.log(`\n======================================================`);
  const total = results.length;
  const passed = results.filter((r) => r.detected).length;
  console.log(`INTEGRITY NEGATIVE TEST SUMMARY:`);
  console.log(`Total:     ${total}`);
  console.log(`Detected:  ${passed}`);
  console.log(`Rate:      ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`Restored:  ${restoredClean ? 'PASSED' : 'FAILED'}`);
  console.log(`======================================================\n`);

  if (passed !== total || !restoredClean) {
    process.exit(1);
  }
}

runNegativeSuite().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
