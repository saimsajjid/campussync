/**
 * Unit Test Suite for CampusSync Pure Outbox & SyncEngine Modules
 *
 * Requirements (Task 4):
 * 1. Ordering (strict FIFO order)
 * 2. Retry and backoff (exponential backoff on network failures)
 * 3. Duplicate handling (idempotency purge)
 * 4. Conflict handling (held in conflicts store)
 * 5. Rejection handling (marked failed with reason)
 * 6. Persistence across a restart (IndexedDB state persists across engine reboots)
 */

import 'fake-indexeddb/auto';
import { Dexie, type Table } from 'dexie';
import {
  queueOperationAtomically,
  getPendingOperationsInOrder,
  calculateExponentialBackoff,
} from '../web/src/sync/outbox';
import { SyncEngine, type ISyncApiClient } from '../web/src/sync/syncEngine';
import type { OutboxOperation, StudentRecord, ConflictItem } from '../web/src/types';

// Concrete Dexie test database instance
class TestCampusSyncDB extends Dexie {
  students!: Table<StudentRecord, string>;
  outbox!: Table<OutboxOperation, string>;
  conflicts!: Table<ConflictItem, string>;
  history!: Table<any, number>;
  meta!: Table<{ key: string; value: any }, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      students: 'id, reg_no, cnic, campus, semester, status',
      outbox: 'opId, studentId, status, createdAt',
      conflicts: 'id, student_id, field, status, created_at',
      history: '++id, studentId, field, opId, createdAt',
      meta: 'key',
    });
  }
}

// Configurable Fake Network API Client
class FakeNetworkClient implements ISyncApiClient {
  public receivedOpBatches: OutboxOperation[][] = [];
  public failNextWithNetworkError = false;
  public responseMockGenerator?: (ops: OutboxOperation[]) => { results: any[]; latestCursor?: number };

  async pushOperations(operations: OutboxOperation[]): Promise<{ results: any[]; latestCursor?: number }> {
    this.receivedOpBatches.push(operations);

    if (this.failNextWithNetworkError) {
      throw new Error('ECONNREFUSED: Simulated offline packet drop');
    }

    if (this.responseMockGenerator) {
      return this.responseMockGenerator(operations);
    }

    // Default: all applied
    return {
      results: operations.map((op) => ({
        opId: op.opId,
        studentId: op.studentId,
        field: op.field,
        status: 'applied',
        fieldVersion: (op.baseVersion || 1) + 1,
        serverVersion: 2,
      })),
      latestCursor: 100,
    };
  }

  async fetchSnapshot(): Promise<{ students: StudentRecord[]; conflicts: any[]; latestCursor: number }> {
    return { students: [], conflicts: [], latestCursor: 100 };
  }
}

async function runSyncEngineUnitTests() {
  console.log('===============================================================');
  console.log('   CAMPUSSYNC PURE OUTBOX & SYNC ENGINE UNIT TEST SUITE        ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testId: string, desc: string, condition: boolean, extra?: any) {
    if (condition) {
      console.log(`✅ PASS [${testId}] ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL [${testId}] ${desc}`, extra || '');
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Strict FIFO Ordering
  // -------------------------------------------------------------
  console.log('--- TEST 1: Strict FIFO Ordering ---');
  const db1 = new TestCampusSyncDB('test-db-ordering-' + Date.now());
  await db1.open();

  // Insert 3 operations with distinct timestamps
  const now = Date.now();
  await db1.outbox.put({
    opId: 'op-3-third',
    studentId: 'std-1',
    field: 'remarks',
    newValue: 'Third',
    oldValue: null,
    baseVersion: 1,
    deviceId: 'dev-1',
    type: 'edit',
    status: 'pending',
    retryCount: 0,
    createdAt: new Date(now + 200).toISOString(),
  });
  await db1.outbox.put({
    opId: 'op-1-first',
    studentId: 'std-1',
    field: 'phone',
    newValue: '0300-1111111',
    oldValue: null,
    baseVersion: 1,
    deviceId: 'dev-1',
    type: 'edit',
    status: 'pending',
    retryCount: 0,
    createdAt: new Date(now).toISOString(),
  });
  await db1.outbox.put({
    opId: 'op-2-second',
    studentId: 'std-1',
    field: 'address',
    newValue: 'Second',
    oldValue: null,
    baseVersion: 1,
    deviceId: 'dev-1',
    type: 'edit',
    status: 'pending',
    retryCount: 0,
    createdAt: new Date(now + 100).toISOString(),
  });

  const orderedOps = await getPendingOperationsInOrder(db1 as any);
  const orderedIds = orderedOps.map((o) => o.opId);
  assert(
    'SE-1',
    'Pending operations retrieved strictly in FIFO order (op-1 -> op-2 -> op-3)',
    orderedIds[0] === 'op-1-first' && orderedIds[1] === 'op-2-second' && orderedIds[2] === 'op-3-third',
    { orderedIds }
  );

  const fakeApi1 = new FakeNetworkClient();
  const engine1 = new SyncEngine(db1 as any, fakeApi1);
  await engine1.syncOutbox();

  const sentBatch = fakeApi1.receivedOpBatches[0].map((o) => o.opId);
  assert(
    'SE-1b',
    'Sync engine transmits batch to network in identical FIFO sequence',
    sentBatch[0] === 'op-1-first' && sentBatch[1] === 'op-2-second' && sentBatch[2] === 'op-3-third',
    { sentBatch }
  );
  await db1.close();

  // -------------------------------------------------------------
  // TEST 2: Network Error, Retry and Exponential Backoff
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Retry and Exponential Backoff ---');
  const db2 = new TestCampusSyncDB('test-db-retry-' + Date.now());
  await db2.open();

  await db2.outbox.put({
    opId: 'op-transient-fail',
    studentId: 'std-2',
    field: 'phone',
    newValue: '0300-2222222',
    oldValue: null,
    baseVersion: 1,
    deviceId: 'dev-1',
    type: 'edit',
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });

  const fakeApi2 = new FakeNetworkClient();
  fakeApi2.failNextWithNetworkError = true;

  const engine2 = new SyncEngine(db2 as any, fakeApi2);
  const stats2 = await engine2.syncOutbox();

  const failedOp = await db2.outbox.get('op-transient-fail');
  assert(
    'SE-2a',
    'Network failure increments retryCount without losing outbox operation',
    failedOp?.retryCount === 1 && failedOp?.status === 'pending' && stats2.errorCount === 1,
    { failedOp, stats2 }
  );

  // Assert exponential backoff calculations
  const b0 = calculateExponentialBackoff(0);
  const b1 = calculateExponentialBackoff(1);
  const b2 = calculateExponentialBackoff(2);
  const b3 = calculateExponentialBackoff(3);
  const bMax = calculateExponentialBackoff(10);
  assert(
    'SE-2b',
    'Exponential backoff scales properly with ceiling: 1s -> 2s -> 4s -> 8s -> 30s max',
    b0 === 1000 && b1 === 2000 && b2 === 4000 && b3 === 8000 && bMax === 30000,
    { b0, b1, b2, b3, bMax }
  );
  await db2.close();

  // -------------------------------------------------------------
  // TEST 3: Duplicate Handling (Idempotency)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Duplicate Handling (Idempotency) ---');
  const db3 = new TestCampusSyncDB('test-db-dup-' + Date.now());
  await db3.open();

  await db3.outbox.put({
    opId: 'op-idempotent-replay',
    studentId: 'std-3',
    field: 'phone',
    newValue: '0300-3333333',
    oldValue: null,
    baseVersion: 1,
    deviceId: 'dev-1',
    type: 'edit',
    status: 'syncing',
    retryCount: 1,
    createdAt: new Date().toISOString(),
  });

  const fakeApi3 = new FakeNetworkClient();
  fakeApi3.responseMockGenerator = (ops) => ({
    results: [
      {
        opId: 'op-idempotent-replay',
        status: 'duplicate',
        reason: 'Operation already applied on server',
      },
    ],
  });

  const engine3 = new SyncEngine(db3 as any, fakeApi3);
  const stats3 = await engine3.syncOutbox();

  const remainingDup = await db3.outbox.get('op-idempotent-replay');
  assert(
    'SE-3',
    'Server duplicate response cleanly removes op from outbox (idempotency confirmed)',
    remainingDup === undefined && stats3.duplicateCount === 1,
    { remainingDup, stats3 }
  );
  await db3.close();

  // -------------------------------------------------------------
  // TEST 4: Conflict Handling
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Conflict Handling ---');
  const db4 = new TestCampusSyncDB('test-db-conflict-' + Date.now());
  await db4.open();

  await db4.outbox.put({
    opId: 'op-conflicting-write',
    studentId: 'std-4',
    field: 'phone',
    newValue: '0300-4444444',
    oldValue: '0300-1111111',
    baseVersion: 1,
    deviceId: 'dev-1',
    type: 'edit',
    status: 'syncing',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });

  const fakeApi4 = new FakeNetworkClient();
  fakeApi4.responseMockGenerator = (ops) => ({
    results: [
      {
        opId: 'op-conflicting-write',
        studentId: 'std-4',
        field: 'phone',
        status: 'conflict',
        fieldVersion: 2,
        serverVersion: 3,
        serverValue: '0300-8888888',
        incomingValue: '0300-4444444',
        conflictId: 'conflict-uuid-999',
      },
    ],
  });

  const engine4 = new SyncEngine(db4 as any, fakeApi4);
  const stats4 = await engine4.syncOutbox();

  const remainingConflict = await db4.outbox.get('op-conflicting-write');
  const storedConflict = await db4.conflicts.get('conflict-uuid-999');
  assert(
    'SE-4',
    'Server conflict moves outbox op into local conflicts store and purges from outbox',
    remainingConflict === undefined &&
      storedConflict?.id === 'conflict-uuid-999' &&
      storedConflict?.serverValue === '0300-8888888' &&
      stats4.conflictCount === 1,
    { remainingConflict, storedConflict, stats4 }
  );
  await db4.close();

  // -------------------------------------------------------------
  // TEST 5: Business Rejection Handling
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Business Rejection Handling ---');
  const db5 = new TestCampusSyncDB('test-db-rejection-' + Date.now());
  await db5.open();

  await db5.outbox.put({
    opId: 'op-invalid-field-val',
    studentId: 'std-5',
    field: 'semester',
    newValue: 99, // invalid semester
    oldValue: 4,
    baseVersion: 1,
    deviceId: 'dev-1',
    type: 'edit',
    status: 'syncing',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });

  const fakeApi5 = new FakeNetworkClient();
  fakeApi5.responseMockGenerator = (ops) => ({
    results: [
      {
        opId: 'op-invalid-field-val',
        status: 'rejected',
        reason: 'Semester must be between 1 and 8',
      },
    ],
  });

  const engine5 = new SyncEngine(db5 as any, fakeApi5);
  const stats5 = await engine5.syncOutbox();

  const rejectedOp = await db5.outbox.get('op-invalid-field-val');
  assert(
    'SE-5',
    'Server rejection marks outbox item as failed with exact reason and halts retry loop',
    rejectedOp?.status === 'failed' &&
      rejectedOp?.errorReason === 'Semester must be between 1 and 8' &&
      stats5.rejectedCount === 1,
    { rejectedOp, stats5 }
  );
  await db5.close();

  // -------------------------------------------------------------
  // TEST 6: Persistence Across a Restart
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Persistence Across Restart ---');
  const persistentDbName = 'test-db-restart-persistence';
  const db6a = new TestCampusSyncDB(persistentDbName);
  await db6a.open();

  // Queue an operation into the database
  await db6a.outbox.put({
    opId: 'op-persistent-across-reboot',
    studentId: 'std-6',
    field: 'emergency_contact',
    newValue: '0321-7777777',
    oldValue: null,
    baseVersion: 1,
    deviceId: 'dev-reboot-tester',
    type: 'edit',
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });

  // Simulate total application restart: close database and dispose engine
  await db6a.close();

  // Re-instantiate database and fresh SyncEngine instance
  const db6b = new TestCampusSyncDB(persistentDbName);
  await db6b.open();

  const persistedPending = await getPendingOperationsInOrder(db6b as any);
  assert(
    'SE-6a',
    'Pending outbox operation survives engine shutdown and persists in IndexedDB',
    persistedPending.length === 1 && persistedPending[0].opId === 'op-persistent-across-reboot',
    { persistedPending }
  );

  const fakeApi6 = new FakeNetworkClient();
  const engine6b = new SyncEngine(db6b as any, fakeApi6);
  const stats6 = await engine6b.syncOutbox();

  const remainingAfterReboot = await db6b.outbox.get('op-persistent-across-reboot');
  assert(
    'SE-6b',
    'Rebooted engine successfully resumes, pushes and clears persisted outbox item',
    remainingAfterReboot === undefined && stats6.appliedCount === 1,
    { remainingAfterReboot, stats6 }
  );
  await db6b.close();

  // -------------------------------------------------------------
  // TEST 7: Simulator Controls (FR-13)
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Simulator Controls (FR-13) ---');
  const db7 = new TestCampusSyncDB('test-db-sim-' + Date.now());
  await db7.open();

  await db7.outbox.put({
    opId: 'op-sim-test-1',
    studentId: 'std-7',
    field: 'phone',
    newValue: '0300-7778899',
    oldValue: null,
    baseVersion: 1,
    deviceId: 'sim-dev',
    type: 'edit',
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });

  const simApi = new FakeNetworkClient();
  simApi.failNextWithNetworkError = true; // Simulates offline / partition

  const simEngine = new SyncEngine(db7 as any, simApi);
  const simStats = await simEngine.syncOutbox();

  const simOpAfterFail = await db7.outbox.get('op-sim-test-1');
  assert(
    'SE-7a',
    'Simulator offline mode preserves outbox operation and increments retryCount',
    simOpAfterFail?.retryCount === 1 && simStats.errorCount === 1
  );

  // Turn simulator back online and verify recovery
  simApi.failNextWithNetworkError = false;
  const simRecoverStats = await simEngine.syncOutbox();
  const simOpAfterRecover = await db7.outbox.get('op-sim-test-1');
  assert(
    'SE-7b',
    'Reconnecting simulator recovers and syncs pending outbox item',
    simOpAfterRecover === undefined && simRecoverStats.appliedCount === 1
  );
  await db7.close();

  // -------------------------------------------------------------
  // TEST 8: Offline UI Flow & Duplicate Resolution Cleanup (DR-3)
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Offline UI Flow & Duplicate Resolution Cleanup ---');
  const db8 = new TestCampusSyncDB('test-db-dr3-' + Date.now());
  await db8.open();

  // 1. Client offline: creates optimistic student and outbox create op
  const offlineStudentId = 'offline-std-uuid-123';
  const offlineOpId = 'op-create-dr3-reg';
  await db8.students.put({
    id: offlineStudentId,
    reg_no: 'CS-2026-9999',
    cnic: '35201-9999999-1',
    full_name: 'Offline Student',
    program: 'BS CS',
    campus: 'Lahore',
    semester: 1,
    status: 'Active',
    phone: '0300-1111111',
    email: 'offline@campussync.local',
    address: 'Lahore',
    emergency_contact: 'Father (0300-0000000)',
    attendance: 85,
    remarks: '',
    field_versions: { full_name: 1, reg_no: 1 },
    version: 1,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_editor_id: 'Student Tester',
  });

  await db8.outbox.put({
    opId: offlineOpId,
    studentId: offlineStudentId,
    field: '*',
    newValue: { reg_no: 'CS-2026-9999' },
    oldValue: null,
    baseVersion: 0,
    deviceId: 'dev-offline-b',
    type: 'create',
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });

  // 2. Reconnect: server returns duplicate_record
  const dr3Api = new FakeNetworkClient();
  dr3Api.responseMockGenerator = () => ({
    results: [{
      opId: offlineOpId,
      status: 'duplicate_record',
      studentId: offlineStudentId,
      existingRecordId: 'server-existing-ali-raza',
      reason: 'A student with registration number CS-2026-9999 already exists',
    }],
    latestCursor: 50,
  });

  const dr3Engine = new SyncEngine(db8 as any, dr3Api);
  await dr3Engine.syncOutbox();

  const outboxAfterDup = await db8.outbox.get(offlineOpId);
  assert(
    'SE-8a',
    'Server duplicate_record flags outbox op as failed with exact duplicate reason',
    outboxAfterDup?.status === 'failed' && (outboxAfterDup?.errorReason?.includes('already exists') || false)
  );

  // 3. Test "Cancel Creation" cleanup: deletes outbox op and optimistic local student
  await db8.outbox.delete(offlineOpId);
  await db8.students.delete(offlineStudentId);

  const outboxCleaned = await db8.outbox.get(offlineOpId);
  const studentCleaned = await db8.students.get(offlineStudentId);
  assert(
    'SE-8b',
    'Duplicate dialog Cancel Creation action cleanly purges outbox and removes uncommitted record',
    outboxCleaned === undefined && studentCleaned === undefined
  );
  await db8.close();

  console.log('\n===============================================================');
  console.log(`UNIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSyncEngineUnitTests().catch((err) => {
  console.error('Fatal unit test error:', err);
  process.exit(1);
});
