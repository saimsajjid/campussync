import type { PoolClient } from 'pg';
import { safeJsonParse } from '../utils/json.js';
import {
  type OperationResult,
  type StudentRecord,
  type CurrentUser,
  type OperationType,
  FieldValidators,
  canUserEditField,
  StudentSchema,
} from '@campussync/shared';

export interface ApplyEditInput {
  opId: string;
  studentId: string;
  field: string;
  newValue: any;
  baseVersion: number;
  deviceId: string;
  type: OperationType;
  studentData?: Partial<StudentRecord>;
  actor: CurrentUser;
}

export async function processOperation(
  client: PoolClient,
  input: ApplyEditInput
): Promise<OperationResult> {
  const { opId, studentId, field, newValue, baseVersion, deviceId, type, studentData, actor } = input;

  // 1. Idempotency Check (FR-5.5, FR-6.1)
  const existingOpRes = await client.query(
    'SELECT result FROM processed_ops WHERE op_id = $1',
    [opId]
  );
  if (existingOpRes.rows.length > 0) {
    const cachedResult = existingOpRes.rows[0].result as OperationResult;
    return {
      ...cachedResult,
      status: 'duplicate', // Signal that it was recognized via idempotency
    };
  }

  // Helper to record result in processed_ops before returning
  const recordAndReturn = async (res: OperationResult): Promise<OperationResult> => {
    await client.query(
      'INSERT INTO processed_ops (op_id, result) VALUES ($1, $2)',
      [opId, JSON.stringify(res)]
    );
    return res;
  };

  // 2. Handle CREATE Operation (FR-6.2, FR-6.3)
  if (type === 'create') {
    if (actor.role !== 'admin') {
      return recordAndReturn({
        opId,
        status: 'rejected',
        reason: 'Only admins may create new student records',
      });
    }

    const payload = studentData || (newValue as Partial<StudentRecord>);
    if (!payload || !payload.reg_no || !payload.cnic) {
      return recordAndReturn({
        opId,
        status: 'rejected',
        reason: 'Missing required student data for creation',
      });
    }

    // Validate full payload against Zod schema
    const parsed = StudentSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return recordAndReturn({
        opId,
        status: 'rejected',
        reason: `Validation failed: ${msg}`,
      });
    }

    const s = parsed.data;

    // Check duplicate reg_no or cnic
    const dupCheck = await client.query(
      'SELECT id, reg_no, cnic, full_name, campus FROM students WHERE reg_no = $1 OR cnic = $2',
      [s.reg_no, s.cnic]
    );
    if (dupCheck.rows.length > 0) {
      const existing = dupCheck.rows[0];
      return recordAndReturn({
        opId,
        status: 'duplicate_record',
        studentId: existing.id,
        existingRecordId: existing.id,
        studentName: existing.full_name,
        regNo: existing.reg_no,
        cnic: existing.cnic,
        reason: `A student with ${existing.reg_no === s.reg_no ? 'registration number ' + s.reg_no : 'CNIC ' + s.cnic} already exists (${existing.full_name}, ${existing.campus}).`,
      });
    }

    const fieldVersions: Record<string, number> = {
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
        s.remarks || null,
        JSON.stringify(fieldVersions),
        actor.name,
      ]
    );

    await client.query(
      `INSERT INTO history (
        student_id, field, old_value, new_value, field_version_after,
        type, actor_id, actor_role, actor_campus, device_id, op_id
      ) VALUES ($1, '*', NULL, $2, 1, 'create', $3, $4, $5, $6, $7)`,
      [s.id, JSON.stringify(s), actor.name, actor.role, s.campus, deviceId, opId]
    );

    return recordAndReturn({
      opId,
      status: 'applied',
      studentId: s.id,
      serverVersion: 1,
      fieldVersion: 1,
    });
  }

  // 3. Acquire Row Lock for Student (`SELECT ... FOR UPDATE`)
  const studentRes = await client.query<StudentRecord>(
    'SELECT * FROM students WHERE id = $1 FOR UPDATE',
    [studentId]
  );
  if (studentRes.rows.length === 0) {
    return recordAndReturn({
      opId,
      status: 'rejected',
      reason: `Student record ${studentId} not found`,
    });
  }

  const student = studentRes.rows[0];

  // 4. Server-Side Permission Check (FR-1.2, FR-4.1)
  const perm = canUserEditField(actor.role, actor.campus, actor.student_id, field, student);
  if (!perm.allowed) {
    return recordAndReturn({
      opId,
      status: 'rejected',
      studentId,
      field,
      reason: perm.reason || 'Permission denied for this field',
    });
  }

  // 5. Server-Side Field Validation (FR-3.3, FR-3.4)
  const validator = FieldValidators[field];
  if (validator) {
    const valCheck = validator.safeParse(newValue);
    if (!valCheck.success) {
      return recordAndReturn({
        opId,
        status: 'rejected',
        studentId,
        field,
        reason: valCheck.error.issues[0]?.message || `Invalid value for ${field}`,
      });
    }
  }

  // Cross-Field Check: Graduated requires semester 8
  if (field === 'status' && newValue === 'Graduated' && student.semester !== 8) {
    return recordAndReturn({
      opId,
      status: 'rejected',
      studentId,
      field,
      reason: 'Cross-field invariant failed: Graduated students must be in Semester 8',
    });
  }
  if (field === 'semester' && newValue !== 8 && student.status === 'Graduated') {
    return recordAndReturn({
      opId,
      status: 'rejected',
      studentId,
      field,
      reason: 'Cross-field invariant failed: Graduated students cannot change semester from 8',
    });
  }

  // Uniqueness check if updating reg_no or cnic
  if (field === 'reg_no' || field === 'cnic') {
    const dupCheck = await client.query(
      `SELECT id FROM students WHERE ${field} = $1 AND id != $2`,
      [newValue, studentId]
    );
    if (dupCheck.rows.length > 0) {
      return recordAndReturn({
        opId,
        status: 'duplicate_record',
        studentId,
        field,
        reason: `${field === 'reg_no' ? 'Registration number' : 'CNIC'} already registered to another student`,
        existingRecordId: dupCheck.rows[0].id,
      });
    }
  }

  // 6. Version Comparison & Conflict Detection (FR-7.1, FR-7.2, FR-7.3)
  const fieldVersions = safeJsonParse(student.field_versions) || {};

  const currentFieldVersion = fieldVersions[field] || 1;
  const currentFieldValue = (student as any)[field];

  if (type === 'edit') {
    if (baseVersion !== currentFieldVersion) {
      // Divergence detected!
      // Sub-rule: If incoming value equals the current value, it is a no-op convergence!
      if (JSON.stringify(newValue) === JSON.stringify(currentFieldValue)) {
        return recordAndReturn({
          opId,
          status: 'applied',
          isNoOp: true,
          studentId,
          field,
          serverVersion: student.version,
          fieldVersion: currentFieldVersion,
          serverValue: currentFieldValue,
        });
      }

      // True conflict: Save to conflicts table and do NOT overwrite server value (FR-7.4)
      const conflictRes = await client.query(
        `INSERT INTO conflicts (
          student_id, field, base_version, server_value, server_version,
          incoming_value, incoming_op_id, actor_id, device_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open')
        RETURNING id`,
        [
          studentId,
          field,
          baseVersion,
          JSON.stringify(currentFieldValue),
          currentFieldVersion,
          JSON.stringify(newValue),
          opId,
          actor.name,
          deviceId,
        ]
      );

      return recordAndReturn({
        opId,
        status: 'conflict',
        studentId,
        field,
        serverVersion: student.version,
        fieldVersion: currentFieldVersion,
        serverValue: currentFieldValue,
        conflictId: conflictRes.rows[0].id,
        reason: `Concurrent conflict on ${field}: Server holds version ${currentFieldVersion}, edit was based on version ${baseVersion}`,
      });
    }
  }

  // If type is 'resolve', close open conflicts for this field
  if (type === 'resolve') {
    await client.query(
      `UPDATE conflicts SET status = 'resolved', resolved_by = $1, resolved_at = NOW(), resolution = $2
       WHERE student_id = $3 AND field = $4 AND status = 'open'`,
      [actor.name, 'Manual user resolution', studentId, field]
    );
  }

  // 7. Apply the Update Atomically (FR-5.8)
  const newFieldVersion = currentFieldVersion + 1;
  const newRecordVersion = student.version + 1;
  fieldVersions[field] = newFieldVersion;

  await client.query(
    `UPDATE students SET
      ${field} = $1,
      field_versions = $2,
      version = $3,
      updated_at = NOW(),
      last_editor_id = $4
    WHERE id = $5`,
    [newValue, JSON.stringify(fieldVersions), newRecordVersion, actor.name, studentId]
  );

  // Append to History
  await client.query(
    `INSERT INTO history (
      student_id, field, old_value, new_value, field_version_after,
      type, actor_id, actor_role, actor_campus, device_id, op_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      studentId,
      field,
      JSON.stringify(currentFieldValue),
      JSON.stringify(newValue),
      newFieldVersion,
      type,
      actor.name,
      actor.role,
      student.campus,
      deviceId,
      opId,
    ]
  );

  return recordAndReturn({
    opId,
    status: 'applied',
    studentId,
    field,
    serverVersion: newRecordVersion,
    fieldVersion: newFieldVersion,
  });
}
