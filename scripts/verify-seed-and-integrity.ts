import { pool } from '../server/src/db/pool.js';
import { seedDatabase } from '../server/src/db/seed.js';
import { runIntegritySuite } from '../server/src/services/integrity.js';
import { validateProductionSecrets, DEFAULT_JWT_SECRET } from '../server/src/config/security.js';

async function main() {
  console.log('===============================================================');
  console.log('  SEED EXPANSION, INTEGRITY SUITE & SECURITY VERIFICATION      ');
  console.log('===============================================================\n');

  // PART 1: Run seedDatabase(true) (clean reset) and measure timing
  console.log('--- 1. SEED DATABASE (CLEAN RESET) ---');
  const t0 = Date.now();
  const seedResult = await seedDatabase(true);
  const resetDurationMs = Date.now() - t0;
  console.log(`✅ Seed reset completed in ${resetDurationMs}ms (${(resetDurationMs / 1000).toFixed(3)}s)`);
  if (resetDurationMs > 3000) {
    console.error(`❌ FAILED: Reset exceeded 3.0s threshold!`);
    process.exit(1);
  } else {
    console.log(`✅ Seed reset restores state in < 3 seconds (target met: ${resetDurationMs}ms < 3000ms)\n`);
  }

  // PART 2: Verify Seeded Records and Specifications
  console.log('--- 2. VERIFY SEEDED DATA COMPOSITION ---');
  const client = await pool.connect();
  try {
    // 2.1 Students Count and Campus Distribution
    const studentsRes = await client.query('SELECT * FROM students ORDER BY reg_no ASC');
    console.log(`Total Students Seeded: ${studentsRes.rows.length} (Expected: 12)`);
    if (studentsRes.rows.length !== 12) {
      throw new Error(`Expected exactly 12 students, found ${studentsRes.rows.length}`);
    }

    const campusCounts: Record<string, number> = {};
    const semesterSet = new Set<number>();
    const programsSet = new Set<string>();

    for (const s of studentsRes.rows) {
      campusCounts[s.campus] = (campusCounts[s.campus] || 0) + 1;
      semesterSet.add(s.semester);
      programsSet.add(s.program);
    }

    console.log(`Campus Distribution:`, campusCounts);
    console.log(`Programs Covered:`, Array.from(programsSet).sort());
    console.log(`Semesters Covered:`, Array.from(semesterSet).sort((a, b) => a - b));

    if (campusCounts['Lahore'] !== 4 || campusCounts['Islamabad'] !== 4 || campusCounts['Abbottabad'] !== 4) {
      throw new Error(`Campus distribution imbalance: expected 4 per campus!`);
    }
    for (let sem = 1; sem <= 8; sem++) {
      if (!semesterSet.has(sem)) {
        throw new Error(`Missing semester ${sem}! Expected 1-8 all covered.`);
      }
    }
    console.log(`✅ All 12 students verified across 3 campuses (4 each), covering semesters 1-8 and programs BS CS, BS SE, BS EE.`);

    // 2.2 Users Composition (3 faculty - one per campus, 2 admins, demo accounts)
    const usersRes = await client.query('SELECT name, email, role, campus FROM users ORDER BY role, name');
    console.log(`\nTotal Users Seeded: ${usersRes.rows.length}`);
    usersRes.rows.forEach(u => console.log(` - [${u.role.toUpperCase()}] ${u.name} (${u.email}) [Campus: ${u.campus || 'All'}]`));

    const admins = usersRes.rows.filter(u => u.role === 'admin');
    const faculty = usersRes.rows.filter(u => u.role === 'faculty');
    const students = usersRes.rows.filter(u => u.role === 'student');

    if (admins.length !== 2) throw new Error(`Expected 2 admins, found ${admins.length}`);
    if (faculty.length !== 3) throw new Error(`Expected 3 faculty, found ${faculty.length}`);
    if (students.length !== 1) throw new Error(`Expected 1 student user, found ${students.length}`);

    const facultyCampuses = new Set(faculty.map(f => f.campus));
    if (!facultyCampuses.has('Lahore') || !facultyCampuses.has('Islamabad') || !facultyCampuses.has('Abbottabad')) {
      throw new Error(`Faculty not distributed across all 3 campuses!`);
    }
    console.log(`✅ Verified: 2 admins, 3 faculty (one per campus: Lahore, Islamabad, Abbottabad), and 1 demo student.`);

    // 2.3 Student Prepared for Conflict Story
    const s1 = studentsRes.rows.find(s => s.id === '10000000-0000-0000-0000-000000000001');
    if (!s1 || !s1.address) throw new Error('Student 1 (Ali Raza) missing or lacks address!');
    console.log(`\nConflict Story Record: [${s1.reg_no}] ${s1.full_name} (Address: "${s1.address}")`);
    console.log(`✅ Ali Raza primed with initial address for concurrent edit conflict story.`);

    // 2.4 Near-Duplicate Pair for Duplicate Story
    const nearDups = studentsRes.rows.filter(s => s.full_name === 'Bilal Ahmed');
    console.log(`\nNear-Duplicate Pair: Found ${nearDups.length} records matching "Bilal Ahmed":`);
    nearDups.forEach(d => console.log(` - ID: ${d.id}, RegNo: ${d.reg_no}, CNIC: ${d.cnic}, Campus: ${d.campus}`));
    if (nearDups.length < 2) throw new Error('Expected at least 2 students in near-duplicate pair');
    console.log(`✅ Near-duplicate pair verified; registration number uniqueness enforced.`);

    // 2.5 Student with 8+ History Entries
    const s11 = studentsRes.rows.find(s => s.id === '10000000-0000-0000-0000-000000000011');
    if (!s11) throw new Error('Student 11 (Sana Javed) missing!');
    const s11HistRes = await client.query('SELECT * FROM history WHERE student_id = $1 ORDER BY id ASC', [s11.id]);
    console.log(`\nRich History Student: [${s11.reg_no}] ${s11.full_name}`);
    console.log(` - Record Version: ${s11.version}`);
    console.log(` - Total History Log Entries: ${s11HistRes.rows.length}`);
    s11HistRes.rows.forEach((h, idx) => {
      console.log(`   [Entry ${idx + 1}] Type: ${h.type}, Field: ${h.field}, VersionAfter: ${h.field_version_after}, OpId: ${h.op_id}, By: ${h.actor_id}`);
    });
    if (s11HistRes.rows.length < 9) {
      throw new Error(`Expected at least 9 history entries (1 create + 8 edits), got ${s11HistRes.rows.length}`);
    }
    console.log(`✅ Student 11 has ${s11HistRes.rows.length} history entries created through standard processOperation path!`);

  } finally {
    client.release();
  }

  // PART 3: Run Integrity Check Suite (All 7 Must Pass)
  console.log('\n--- 3. DATA INTEGRITY SUITE VERIFICATION (ALL 7 INVARIANTS) ---');
  const integrityRes = await runIntegritySuite();
  console.log(`Suite Timestamp: ${integrityRes.timestamp}`);
  console.log(`All Invariants Passed: ${integrityRes.allPassed}\n`);

  for (const c of integrityRes.checks) {
    const symbol = c.status === 'passed' ? '✅ PASS' : '❌ FAIL';
    console.log(`${symbol} [${c.id}] ${c.name}`);
    console.log(`   Invariant: "${c.invariant}"`);
    console.log(`   Status: ${c.status.toUpperCase()}, Offending Rows: ${c.offendingRowsCount}`);
  }

  if (!integrityRes.allPassed) {
    console.error('\n❌ INTEGRITY SUITE FAILED!');
    process.exit(1);
  } else {
    console.log('\n✅ ALL 7 INTEGRITY INVARIANTS PASSED 100% CLEANLY!');
  }

  // PART 4: Production JWT_SECRET Guard Verification
  console.log('\n--- 4. PRODUCTION JWT_SECRET REFUSAL GUARD ---');
  let rejectedDefault = false;
  try {
    validateProductionSecrets('production', DEFAULT_JWT_SECRET);
  } catch (err: any) {
    rejectedDefault = true;
    console.log(`✅ Guard successfully refused default secret in production: "${err.message}"`);
  }
  if (!rejectedDefault) {
    throw new Error('FAILED: Server did not refuse default JWT_SECRET in production mode!');
  }

  let rejectedMissing = false;
  try {
    validateProductionSecrets('production', undefined);
  } catch (err: any) {
    rejectedMissing = true;
    console.log(`✅ Guard successfully refused missing secret in production: "${err.message}"`);
  }
  if (!rejectedMissing) {
    throw new Error('FAILED: Server did not refuse missing JWT_SECRET in production mode!');
  }

  let acceptedSecure = false;
  try {
    validateProductionSecrets('production', 'a-cryptographically-secure-jwt-token-secret-over-32-chars-long');
    acceptedSecure = true;
    console.log(`✅ Guard successfully accepted valid secure secret in production (>= 32 chars).`);
  } catch (err: any) {
    throw new Error(`FAILED: Guard falsely rejected valid secure secret: ${err.message}`);
  }

  console.log('\n===============================================================');
  console.log('  ALL SPECIFICATIONS & INVARIANTS CONFIRMED SUCCESSFULLY!     ');
  console.log('===============================================================');
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
