import type { CampusSyncDatabase } from '../db';
import type { OutboxOperation, StudentRecord, UserRole } from '../types';

export interface QueueOperationInput {
  studentId: string;
  field: string;
  newValue: any;
  oldValue: any;
  baseVersion: number;
  deviceId: string;
  type?: 'edit' | 'create' | 'resolve' | 'restore';
  studentData?: Partial<StudentRecord>;
  actorName: string;
  actorRole: UserRole;
  actorCampus?: string;
  isOffline?: boolean;
}

/**
 * Calculates exponential backoff with ceiling in milliseconds
 */
export function calculateExponentialBackoff(retryCount: number, baseMs = 1000, maxMs = 30000): number {
  const exp = Math.min(retryCount, 6);
  const delay = baseMs * Math.pow(2, exp);
  return Math.min(delay, maxMs);
}

/**
 * Builds an immutable outbox operation payload
 */
export function createOutboxPayload(input: QueueOperationInput, opId?: string): OutboxOperation {
  const generatedId = opId || 'op-' + Math.random().toString(36).substring(2, 9);
  return {
    opId: generatedId,
    studentId: input.studentId,
    field: input.field,
    newValue: input.studentData || input.newValue,
    oldValue: input.oldValue,
    baseVersion: input.baseVersion,
    deviceId: input.deviceId,
    type: input.type || 'edit',
    status: input.isOffline ? 'pending' : 'syncing',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Atomically commits local student state, audit ledger entry, and outbox queue entry
 * in a single IndexedDB (Dexie) transaction.
 */
export async function queueOperationAtomically(
  db: CampusSyncDatabase,
  input: QueueOperationInput,
  customOpId?: string
): Promise<OutboxOperation> {
  const op = createOutboxPayload(input, customOpId);
  const student = await db.students.get(input.studentId);

  await db.transaction('rw', db.students, db.history, db.outbox, async () => {
    if (student) {
      const newFieldVersions = {
        ...student.field_versions,
        [input.field]: (student.field_versions[input.field] || input.baseVersion) + 1,
      };

      const updatedStudent: StudentRecord = {
        ...student,
        [input.field]: input.newValue,
        field_versions: newFieldVersions,
        version: student.version + 1,
        updated_at: new Date().toISOString(),
        last_editor_id: input.actorName,
      };

      // 1. Optimistic write to local Dexie student table
      await db.students.put(updatedStudent);

      // 2. Add local audit ledger entry (marked as pending server sync)
      await db.history.add({
        id: Date.now(),
        studentId: input.studentId,
        studentName: student.full_name,
        reg_no: student.reg_no,
        field: input.field,
        oldValue: input.oldValue,
        newValue: input.newValue,
        fieldVersionAfter: newFieldVersions[input.field],
        type: input.type || 'edit',
        actorName: input.actorName,
        actorRole: input.actorRole,
        actorCampus: student.campus,
        device: input.deviceId,
        opId: op.opId,
        isPending: true,
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Queue in Local Outbox
    await db.outbox.put(op);
  });

  return op;
}

/**
 * Retrieves pending outbox operations ordered by FIFO creation time
 */
export async function getPendingOperationsInOrder(db: CampusSyncDatabase): Promise<OutboxOperation[]> {
  const allOps = await db.outbox.toArray();
  // Filter for actionable states and sort ascending by createdAt (FIFO)
  return allOps
    .filter((op: OutboxOperation) => op.status === 'pending' || op.status === 'syncing')
    .sort((a: OutboxOperation, b: OutboxOperation) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
