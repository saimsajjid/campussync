import { pool, withTransaction } from './pool.js';
import crypto from 'crypto';

function hashPassword(password: string): string {
  // Simple sha256 hash with salt for demo accounts
  return crypto.createHash('sha256').update(password + 'campussync-salt').digest('hex');
}

export async function seedDatabase(forceClean = false) {
  return withTransaction(async (client) => {
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

    // 1. Seed Demo Users
    const usersCountRes = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCountRes.rows[0].count, 10) === 0) {
      console.log('Seeding demo users...');
      const defaultPasswordHash = hashPassword('password123');

      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, campus) VALUES
        ('c0000000-0000-0000-0000-000000000001', 'Central Admin', 'admin@campussync.local', $1, 'admin', NULL),
        ('c0000000-0000-0000-0000-000000000002', 'Prof. Ahmed (Lahore)', 'faculty@campussync.local', $1, 'faculty', 'Lahore'),
        ('c0000000-0000-0000-0000-000000000003', 'Dr. Tariq (Islamabad)', 'faculty.isb@campussync.local', $1, 'faculty', 'Islamabad'),
        ('c0000000-0000-0000-0000-000000000004', 'Ali Raza (Student)', 'student@campussync.local', $1, 'student', 'Lahore')`,
        [defaultPasswordHash]
      );
    }

    // 2. Seed Initial Student Records if empty
    const studentsCountRes = await client.query('SELECT COUNT(*) FROM students');
    if (parseInt(studentsCountRes.rows[0].count, 10) === 0) {
      console.log('Seeding initial student records across campuses...');

      const initialStudents = [
        {
          id: 's0000000-0000-0000-0000-000000000001',
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
          remarks: 'Good academic standing, active in software lab.',
          field_versions: {
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
          },
          version: 1,
          last_editor_id: 'Central Admin',
        },
        {
          id: 's0000000-0000-0000-0000-000000000002',
          reg_no: 'SE-2026-0204',
          cnic: '61101-7654321-3',
          full_name: 'Fatima Noor',
          program: 'BS SE',
          campus: 'Islamabad',
          semester: 6,
          status: 'Active',
          phone: '0333-5551234',
          email: 'fatima.noor@campussync.local',
          address: 'Street 15, F-8/2, Islamabad',
          emergency_contact: 'Mrs. Noor (Mother) - 0333-8889900',
          attendance: 94.0,
          remarks: 'Team lead on mobile distributed systems project.',
          field_versions: {
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
          },
          version: 1,
          last_editor_id: 'Central Admin',
        },
        {
          id: 's0000000-0000-0000-0000-000000000003',
          reg_no: 'EE-2026-0309',
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
          remarks: 'Graduated with Honors. Final Year Project submitted.',
          field_versions: {
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
          },
          version: 1,
          last_editor_id: 'Central Admin',
        },
      ];

      for (const s of initialStudents) {
        await client.query(
          `INSERT INTO students (
            id, reg_no, cnic, full_name, program, campus, semester, status,
            phone, email, address, emergency_contact, attendance, remarks,
            field_versions, version, active, last_editor_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, TRUE, $17)`,
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
            JSON.stringify(s.field_versions),
            s.version,
            s.last_editor_id,
          ]
        );

        // Record initial create in history
        await client.query(
          `INSERT INTO history (
            student_id, field, old_value, new_value, field_version_after,
            type, actor_id, actor_role, actor_campus, device_id, op_id
          ) VALUES ($1, '*', NULL, $2, 1, 'create', 'Central Admin', 'admin', $3, 'System Seed', $4)`,
          [s.id, JSON.stringify(s), s.campus, 'op-seed-' + s.reg_no.toLowerCase()]
        );
      }

      // Link Ali Raza's student user to his record
      await client.query(
        `UPDATE users SET student_id = 's0000000-0000-0000-0000-000000000001' WHERE email = 'student@campussync.local'`
      );

      console.log('Seeded 3 students with history audit records.');
    }
  });
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
