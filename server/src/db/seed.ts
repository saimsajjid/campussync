import { pool, withTransaction } from './pool.js';
import { processOperation } from '../services/applyEdit.js';
import type { CurrentUser } from '@campussync/shared';
import crypto from 'crypto';

function hashPassword(password: string): string {
  // Simple sha256 hash with salt for demo accounts
  return crypto.createHash('sha256').update(password + 'campussync-salt').digest('hex');
}

export async function seedDatabase(forceClean = false) {
  const startTime = Date.now();
  const res = await withTransaction(async (client) => {
    if (forceClean) {
      console.log('Resetting demo database to clean seeded state...');
      await client.query('DELETE FROM conflicts');
      await client.query('DELETE FROM processed_ops');
      // History is append-only with trigger; disable trigger temporarily for clean reset
      await client.query('ALTER TABLE history DISABLE TRIGGER trg_prevent_history_update');
      await client.query('DELETE FROM history');
      await client.query('ALTER TABLE history ENABLE TRIGGER trg_prevent_history_update');
      await client.query('DELETE FROM students');
      await client.query('DELETE FROM users');
    }

    // 1. Seed Demo Users (3 faculty - one per campus, 2 admins, demo accounts for student, faculty, admin)
    const usersCountRes = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCountRes.rows[0].count, 10) === 0) {
      console.log('Seeding demo users (2 admins, 3 faculty across campuses, 1 student)...');
      const defaultPasswordHash = hashPassword('password123');

      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, campus) VALUES
        ('c0000000-0000-0000-0000-000000000001', 'Central Admin', 'admin@campussync.local', $1, 'admin', NULL),
        ('c0000000-0000-0000-0000-000000000012', 'Regional Admin (Islamabad)', 'admin.regional@campussync.local', $1, 'admin', NULL),
        ('c0000000-0000-0000-0000-000000000002', 'Prof. Ahmed (Lahore)', 'faculty@campussync.local', $1, 'faculty', 'Lahore'),
        ('c0000000-0000-0000-0000-000000000003', 'Dr. Tariq (Islamabad)', 'faculty.isb@campussync.local', $1, 'faculty', 'Islamabad'),
        ('c0000000-0000-0000-0000-000000000005', 'Dr. Zafar (Abbottabad)', 'faculty.atd@campussync.local', $1, 'faculty', 'Abbottabad'),
        ('c0000000-0000-0000-0000-000000000004', 'Ali Raza (Student)', 'student@campussync.local', $1, 'student', 'Lahore')`,
        [defaultPasswordHash]
      );
    }

    // 2. Seed Initial Student Records (12 students across 3 campuses, semesters 1-8, varied programs)
    const studentsCountRes = await client.query('SELECT COUNT(*) FROM students');
    if (parseInt(studentsCountRes.rows[0].count, 10) === 0) {
      console.log('Seeding 12 students across Lahore, Islamabad, and Abbottabad...');

      const initialStudents = [
        // --- LAHORE CAMPUS (4 Students) ---
        {
          // Student 1: Prepared for conflict story (student offline edit vs admin edit on address)
          id: '10000000-0000-0000-0000-000000000001',
          reg_no: 'CS-2026-0101',
          cnic: '35201-1234567-1',
          full_name: 'Ali Raza',
          program: 'BS CS',
          campus: 'Lahore',
          semester: 4,
          status: 'Active',
          phone: '0300-1234567',
          email: 'ali.raza@campussync.local',
          address: 'House 42, Sector G, DHA Phase 5, Lahore',
          emergency_contact: 'Muhammad Raza (Father) - 0300-9876543',
          attendance: 88.5,
          remarks: 'Prepared for concurrent offline address conflict demo.',
        },
        {
          // Student 2: High-achieving senior
          id: '10000000-0000-0000-0000-000000000002',
          reg_no: 'SE-2026-0102',
          cnic: '35201-7654321-2',
          full_name: 'Fatima Noor',
          program: 'BS SE',
          campus: 'Lahore',
          semester: 6,
          status: 'Active',
          phone: '0301-2345678',
          email: 'fatima.noor@campussync.local',
          address: 'Flat 12-B, Askari 10, Airport Road, Lahore',
          emergency_contact: 'Tariq Noor (Father) - 0301-8765432',
          attendance: 92.0,
          remarks: 'Dean list honor student in software engineering.',
        },
        {
          // Student 3: Near-duplicate pair member A
          id: '10000000-0000-0000-0000-000000000003',
          reg_no: 'CS-2026-0103',
          cnic: '35202-1122334-1',
          full_name: 'Bilal Ahmed',
          program: 'BS CS',
          campus: 'Lahore',
          semester: 2,
          status: 'Active',
          phone: '0302-3456789',
          email: 'bilal.ahmed@campussync.local',
          address: 'House 18, Block B, Model Town, Lahore',
          emergency_contact: 'Ahmed Bilal (Father) - 0302-9876541',
          attendance: 85.0,
          remarks: 'Member of near-duplicate pair for duplicate registration demo.',
        },
        {
          // Student 4: Near-duplicate pair member B (same name, distinct registration number & CNIC)
          id: '10000000-0000-0000-0000-000000000004',
          reg_no: 'CS-2026-0104',
          cnic: '35202-1122334-3',
          full_name: 'Bilal Ahmed',
          program: 'BS CS',
          campus: 'Lahore',
          semester: 2,
          status: 'Active',
          phone: '0303-4567890',
          email: 'bilal.ahmed2@campussync.local',
          address: 'Street 7, Cavalry Ground, Lahore Cantt',
          emergency_contact: 'Farooq Ahmed (Uncle) - 0303-1122334',
          attendance: 81.5,
          remarks: 'Second student with identical name; registration CS-2026-0103 is blocked if reused.',
        },

        // --- ISLAMABAD CAMPUS (4 Students) ---
        {
          // Student 5: Mid-program leader
          id: '10000000-0000-0000-0000-000000000005',
          reg_no: 'SE-2026-0201',
          cnic: '61101-2233445-1',
          full_name: 'Zainab Bibi',
          program: 'BS SE',
          campus: 'Islamabad',
          semester: 5,
          status: 'Active',
          phone: '0312-5556677',
          email: 'zainab.bibi@campussync.local',
          address: 'House 55, Street 22, F-10/2, Islamabad',
          emergency_contact: 'Dr. Aslam Bibi (Father) - 0312-9988776',
          attendance: 95.5,
          remarks: 'AI society president, organizing national hackathon.',
        },
        {
          // Student 6: On leave student
          id: '10000000-0000-0000-0000-000000000006',
          reg_no: 'EE-2026-0202',
          cnic: '61101-3344556-2',
          full_name: 'Hamza Tariq',
          program: 'BS EE',
          campus: 'Islamabad',
          semester: 7,
          status: 'On leave',
          phone: '0313-6667788',
          email: 'hamza.tariq@campussync.local',
          address: 'Sector I-8/4, Street 9, Islamabad',
          emergency_contact: 'Tariq Mehmood (Father) - 0313-2233445',
          attendance: 74.0,
          remarks: 'Semester leave approved for industrial robotics internship.',
        },
        {
          // Student 7: Freshman
          id: '10000000-0000-0000-0000-000000000007',
          reg_no: 'CS-2026-0203',
          cnic: '61101-4455667-3',
          full_name: 'Ayesha Siddiqui',
          program: 'BS CS',
          campus: 'Islamabad',
          semester: 1,
          status: 'Active',
          phone: '0314-7778899',
          email: 'ayesha.siddiqui@campussync.local',
          address: 'House 102, Margalla Town, Phase 1, Islamabad',
          emergency_contact: 'Rashid Siddiqui (Father) - 0314-5566778',
          attendance: 96.0,
          remarks: 'Freshman merit scholarship recipient.',
        },
        {
          // Student 8: Graduated EE student (Semester 8)
          id: '10000000-0000-0000-0000-000000000008',
          reg_no: 'EE-2026-0204',
          cnic: '61101-5566778-4',
          full_name: 'Omer Farooq',
          program: 'BS EE',
          campus: 'Islamabad',
          semester: 8,
          status: 'Graduated',
          phone: '0315-8889900',
          email: 'omer.farooq@campussync.local',
          address: 'Apartment 304, Silver Oaks, F-10, Islamabad',
          emergency_contact: 'Farooq Azam (Father) - 0315-6677889',
          attendance: 90.0,
          remarks: 'Graduated with high honors in telecommunications.',
        },

        // --- ABBOTTABAD CAMPUS (4 Students) ---
        {
          // Student 9: Graduated engineer (Semester 8)
          id: '10000000-0000-0000-0000-000000000009',
          reg_no: 'EE-2026-0301',
          cnic: '13101-9988776-5',
          full_name: 'Usman Khan',
          program: 'BS EE',
          campus: 'Abbottabad',
          semester: 8,
          status: 'Graduated',
          phone: '0345-7788990',
          email: 'usman.khan@campussync.local',
          address: 'Supply Area, Mansehra Road, Abbottabad',
          emergency_contact: 'Hamid Khan (Brother) - 0345-1122334',
          attendance: 91.2,
          remarks: 'Final Year Project completed in renewable power grids.',
        },
        {
          // Student 10: Sophomore
          id: '10000000-0000-0000-0000-000000000010',
          reg_no: 'CS-2026-0302',
          cnic: '13101-8877665-6',
          full_name: 'Maryam Nawaz',
          program: 'BS CS',
          campus: 'Abbottabad',
          semester: 3,
          status: 'Active',
          phone: '0346-8899001',
          email: 'maryam.nawaz@campussync.local',
          address: 'Pine View Road, Jinnahabad, Abbottabad',
          emergency_contact: 'Nawaz Sharif (Father) - 0346-3344556',
          attendance: 89.0,
          remarks: 'Competitive programming team finalist.',
        },
        {
          // Student 11: Prepared with 8+ sequential history entries via processOperation!
          id: '10000000-0000-0000-0000-000000000011',
          reg_no: 'SE-2026-0303',
          cnic: '13101-7766554-7',
          full_name: 'Sana Javed',
          program: 'BS SE',
          campus: 'Abbottabad',
          semester: 6,
          status: 'Active',
          phone: '0347-9900112',
          email: 'sana.javed@campussync.local',
          address: 'House 77, Habibullah Colony, Abbottabad',
          emergency_contact: 'Javed Iqbal (Father) - 0347-4455667',
          attendance: 87.0,
          remarks: 'Audited record with rich multi-stage revision history.',
        },
        {
          // Student 12: Senior CS student
          id: '10000000-0000-0000-0000-000000000012',
          reg_no: 'CS-2026-0304',
          cnic: '13101-6655443-8',
          full_name: 'Danial Aslam',
          program: 'BS CS',
          campus: 'Abbottabad',
          semester: 7,
          status: 'Active',
          phone: '0348-1234567',
          email: 'danial.aslam@campussync.local',
          address: 'Karakoram Highway Near Mandian, Abbottabad',
          emergency_contact: 'Aslam Pervez (Father) - 0348-7654321',
          attendance: 86.5,
          remarks: 'Cybersecurity club lead, participating in defense drills.',
        },
      ];

      const initialFieldVersions: Record<string, number> = {
        phone: 1,
        email: 1,
        address: 1,
        emergency_contact: 1,
        attendance: 1,
        remarks: 1,
        full_name: 1,
        program: 1,
        campus: 1,
        semester: 1,
        status: 1,
        reg_no: 1,
        cnic: 1,
      };

      for (const s of initialStudents) {
        const studentPayload = {
          ...s,
          field_versions: initialFieldVersions,
          version: 1,
          last_editor_id: 'Central Admin',
        };

        await client.query(
          `INSERT INTO students (
            id, reg_no, cnic, full_name, program, campus, semester, status,
            phone, email, address, emergency_contact, attendance, remarks,
            field_versions, version, active, last_editor_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1, TRUE, $16)`,
          [
            s.id,
            s.reg_no,
            s.cnic,
            s.full_name,
            s.program,
            s.campus,
            s.semester,
            s.status,
            s.phone,
            s.email,
            s.address,
            s.emergency_contact,
            s.attendance,
            s.remarks,
            JSON.stringify(initialFieldVersions),
            'Central Admin',
          ]
        );

        const createOpId = 'op-seed-' + s.reg_no.toLowerCase();

        // Record initial create in history
        await client.query(
          `INSERT INTO history (
            student_id, field, old_value, new_value, field_version_after,
            type, actor_id, actor_role, actor_campus, device_id, op_id
          ) VALUES ($1, '*', NULL, $2, 1, 'create', 'Central Admin', 'admin', $3, 'System Seed', $4)`,
          [s.id, JSON.stringify(studentPayload), s.campus, createOpId]
        );

        // Record create op in processed_ops for complete ledger invariant
        await client.query(
          `INSERT INTO processed_ops (op_id, result) VALUES ($1, $2)`,
          [
            createOpId,
            JSON.stringify({
              opId: createOpId,
              status: 'applied',
              studentId: s.id,
              serverVersion: 1,
              fieldVersion: 1,
            }),
          ]
        );
      }

      // Link Ali Raza's student user to his record
      await client.query(
        `UPDATE users SET student_id = '10000000-0000-0000-0000-000000000001' WHERE email = 'student@campussync.local'`
      );

      // 3. Create 8 sequential history entries on Student 11 (Sana Javed) via processOperation
      // This guarantees every single invariant (monotonicity, replayability, ledger accounting) holds.
      const targetStudent11Id = '10000000-0000-0000-0000-000000000011';
      const adminActor: CurrentUser = {
        id: 'c0000000-0000-0000-0000-000000000001',
        name: 'Central Admin',
        email: 'admin@campussync.local',
        role: 'admin',
      };

      const sequentialEdits = [
        { field: 'phone', newValue: '0347-1111222', baseVersion: 1, opId: 'op-seed-hist-01' },
        { field: 'address', newValue: 'House 85, PMA Road, Kakul, Abbottabad', baseVersion: 1, opId: 'op-seed-hist-02' },
        { field: 'attendance', newValue: 90.5, baseVersion: 1, opId: 'op-seed-hist-03' },
        { field: 'remarks', newValue: 'Transferred to Software Architecture research group.', baseVersion: 1, opId: 'op-seed-hist-04' },
        { field: 'emergency_contact', newValue: 'Dr. Javed Iqbal (Father) - 0347-9988112', baseVersion: 1, opId: 'op-seed-hist-05' },
        { field: 'phone', newValue: '0347-2222333', baseVersion: 2, opId: 'op-seed-hist-06' },
        { field: 'attendance', newValue: 93.0, baseVersion: 2, opId: 'op-seed-hist-07' },
        { field: 'remarks', newValue: 'Appointed peer tutor for distributed databases.', baseVersion: 2, opId: 'op-seed-hist-08' },
      ];

      for (const edit of sequentialEdits) {
        const opRes = await processOperation(client, {
          opId: edit.opId,
          studentId: targetStudent11Id,
          field: edit.field,
          newValue: edit.newValue,
          baseVersion: edit.baseVersion,
          deviceId: 'Audit Station (Abbottabad)',
          type: 'edit',
          actor: adminActor,
        });

        if (opRes.status !== 'applied') {
          throw new Error(`Failed to apply sequential edit ${edit.opId}: ${opRes.reason}`);
        }
      }

      console.log('Seeded 12 students across 3 campuses, with Student 11 having 9 history entries applied via processOperation.');
    }
  });

  const durationMs = Date.now() - startTime;
  console.log(`seedDatabase completed in ${durationMs}ms`);
  return { success: true, durationMs };
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase(true)
    .then((r) => {
      console.log(`Seeding complete in ${r.durationMs}ms`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
