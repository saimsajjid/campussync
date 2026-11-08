import type { CampusSyncDatabase } from '../db';
import type { OutboxOperation, StudentRecord } from '../types';
import { getPendingOperationsInOrder, calculateExponentialBackoff } from './outbox';

export interface ISyncApiClient {
  pushOperations(operations: OutboxOperation[]): Promise<{ results: any[]; latestCursor?: number }>;
  fetchSnapshot(): Promise<{ students: StudentRecord[]; conflicts: any[]; latestCursor: number }>;
}

export interface SyncEngineStats {
  pushedCount: number;
  appliedCount: number;
  conflictCount: number;
  duplicateCount: number;
  rejectedCount: number;
  errorCount: number;
}

export class SyncEngine {
  private db: CampusSyncDatabase;
  private api: ISyncApiClient;
  private isSyncing = false;

  constructor(db: CampusSyncDatabase, api: ISyncApiClient) {
    this.db = db;
    this.api = api;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Pushes all pending outbox operations to the server in strict FIFO order,
   * handling applied, duplicate, conflict, and rejection outcomes.
   */
  public async syncOutbox(): Promise<SyncEngineStats> {
    const stats: SyncEngineStats = {
      pushedCount: 0,
      appliedCount: 0,
      conflictCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      errorCount: 0,
    };

    if (this.isSyncing) {
      return stats;
    }

    this.isSyncing = true;
    try {
      // 1. Fetch pending operations in strict FIFO sequence
      const pendingOps = await getPendingOperationsInOrder(this.db);
      if (pendingOps.length === 0) {
        return stats;
      }

      stats.pushedCount = pendingOps.length;

      // 2. Transmit batch to server
      let pushResponse;
      try {
        pushResponse = await this.api.pushOperations(pendingOps);
      } catch (networkErr: any) {
        stats.errorCount++;
        // Apply exponential backoff to all attempted operations
        for (const op of pendingOps) {
          const nextRetryCount = (op.retryCount || 0) + 1;
          const backoffDelay = calculateExponentialBackoff(nextRetryCount);
          await this.db.outbox.update(op.opId, {
            status: 'pending',
            retryCount: nextRetryCount,
            errorReason: `Network error: ${networkErr.message}. Backing off for ${backoffDelay}ms`,
          });
        }
        return stats;
      }

      // 3. Process outcomes per operation
      const results = pushResponse?.results || [];
      for (const res of results) {
        if (!res.opId) continue;

        if (res.status === 'applied') {
          stats.appliedCount++;
          // Confirmed written on server: delete from outbox
          await this.db.outbox.delete(res.opId);

          // Update local student field version if specified
          if (res.studentId && res.field && res.fieldVersion) {
            const currentStudent = await this.db.students.get(res.studentId);
            if (currentStudent) {
              const currentVers = currentStudent.field_versions || {};
              currentVers[res.field] = res.fieldVersion;
              await this.db.students.update(res.studentId, {
                field_versions: currentVers,
                version: res.serverVersion || currentStudent.version,
              });
            }
          }
        } else if (res.status === 'duplicate') {
          stats.duplicateCount++;
          // Idempotency: Server already processed this opId, cleanly purge from outbox
          await this.db.outbox.delete(res.opId);
        } else if (res.status === 'conflict') {
          stats.conflictCount++;
          // Concurrent collision: Remove from outbox and place into local conflicts table
          await this.db.outbox.delete(res.opId);
          if (res.conflictId) {
            await this.db.conflicts.put({
              id: res.conflictId,
              studentId: res.studentId,
              field: res.field,
              baseVersion: res.fieldVersion || 1,
              serverValue: res.serverValue,
              serverVersion: res.serverVersion || 1,
              incomingValue: res.incomingValue || res.serverValue,
              actor: 'Remote Actor',
              campus: 'Central',
              device: 'Remote Device',
              status: 'open',
              createdAt: new Date().toISOString(),
            });
          }
        } else if (res.status === 'rejected') {
          stats.rejectedCount++;
          // Business validation or RBAC permission failure: mark failed (no point retrying)
          await this.db.outbox.update(res.opId, {
            status: 'failed',
            errorReason: res.reason || 'Server rejected operation',
          });
        }
      }

      // Update sync cursor if returned
      if (pushResponse.latestCursor) {
        await this.db.meta.put({ key: 'syncCursor', value: pushResponse.latestCursor });
      }

      return stats;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pulls full snapshot from server to hydrate local state
   */
  public async pullSnapshot(): Promise<void> {
    const snapshot = await this.api.fetchSnapshot();
    if (snapshot && Array.isArray(snapshot.students)) {
      await this.db.students.bulkPut(snapshot.students);
      if (Array.isArray(snapshot.conflicts) && snapshot.conflicts.length > 0) {
        await this.db.conflicts.bulkPut(snapshot.conflicts);
      }
      if (snapshot.latestCursor) {
        await this.db.meta.put({ key: 'syncCursor', value: snapshot.latestCursor });
      }
    }
  }
}
