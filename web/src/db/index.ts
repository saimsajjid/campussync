import Dexie, { type Table } from 'dexie';
import type { StudentRecord, OutboxOperation, ConflictItem, HistoryItem } from '../types';

export class CampusSyncDatabase extends Dexie {
  students!: Table<StudentRecord, string>;
  outbox!: Table<OutboxOperation, string>;
  conflicts!: Table<ConflictItem, string>;
  history!: Table<HistoryItem, number>;
  meta!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('CampusSyncDB');
    this.version(1).stores({
      students: 'id, reg_no, cnic, campus, program, status, version',
      outbox: 'opId, studentId, status, createdAt',
      conflicts: 'id, studentId, status, createdAt',
      history: '++id, studentId, field, type, createdAt',
      meta: 'key',
    });
  }
}

export const db = new CampusSyncDatabase();
