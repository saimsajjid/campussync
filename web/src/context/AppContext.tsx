import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';
import { initializeSeedData, INITIAL_STUDENTS, INITIAL_CONFLICTS, INITIAL_HISTORY } from '../db/seed';
import type { CurrentUser, CampusCode, SimulatorState, OutboxOperation, StudentRecord } from '../types';

export const DEMO_USERS: CurrentUser[] = [
  {
    id: 'user_admin_01',
    name: 'Saim Sajid',
    email: 'admin@campussync.local',
    role: 'admin',
    campus: undefined, // Multi-campus access
  },
  {
    id: 'user_faculty_01',
    name: 'Prof. Tariq Mahmood',
    email: 'faculty.lahore@campussync.local',
    role: 'faculty',
    campus: 'Lahore',
  },
  {
    id: 'user_student_01',
    name: 'Fatima Zahra',
    email: 'student.fatima@campussync.local',
    role: 'student',
    campus: 'Lahore',
    student_id: 'e01a8f90-8431-4822-92ab-1101aa000002',
  },
];

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'danger' | 'info';
}

interface AppContextType {
  currentUser: CurrentUser;
  setCurrentUser: (user: CurrentUser) => void;
  activeCampus: CampusCode | 'all';
  setActiveCampus: (campus: CampusCode | 'all') => void;
  simulator: SimulatorState;
  setSimulator: React.Dispatch<React.SetStateAction<SimulatorState>>;
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastItem['type']) => void;
  syncNow: () => Promise<void>;
  isSyncing: boolean;
  injectRemoteConflict: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  queueEditOperation: (studentId: string, field: string, newValue: any, oldValue: any, baseVersion: number) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(DEMO_USERS[0]);
  const [activeCampus, setActiveCampus] = useState<CampusCode | 'all'>('all');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [simulator, setSimulator] = useState<SimulatorState>({
    isOffline: false,
    isSlowNetwork: false,
    dropNextRequest: false,
    dropNextResponse: false,
    currentDeviceId: 'Device A (Admin/Campus)',
  });

  useEffect(() => {
    initializeSeedData().catch(console.error);
  }, []);

  const addToast = (message: string, type: ToastItem['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const queueEditOperation = async (
    studentId: string,
    field: string,
    newValue: any,
    oldValue: any,
    baseVersion: number
  ) => {
    const student = await db.students.get(studentId);
    if (!student) return;

    const opId = 'op-' + Math.random().toString(36).substring(2, 9);
    const newFieldVersions = {
      ...student.field_versions,
      [field]: (student.field_versions[field] || baseVersion) + 1,
    };

    const updatedStudent: StudentRecord = {
      ...student,
      [field]: newValue,
      field_versions: newFieldVersions,
      version: student.version + 1,
      updated_at: new Date().toISOString(),
      last_editor_id: currentUser.name,
    };

    // 1. Optimistic write to local Dexie student table (survives offline)
    await db.students.put(updatedStudent);

    // 2. Queue operation in local Outbox
    const op: OutboxOperation = {
      opId,
      studentId,
      field,
      newValue,
      oldValue,
      baseVersion,
      deviceId: simulator.currentDeviceId,
      type: 'edit',
      status: simulator.isOffline ? 'pending' : 'syncing',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    await db.outbox.put(op);

    // 3. Add to immutable audit history
    await db.history.add({
      id: Date.now(),
      studentId,
      studentName: student.full_name,
      reg_no: student.reg_no,
      field,
      oldValue,
      newValue,
      fieldVersionAfter: newFieldVersions[field],
      type: 'edit',
      actorName: currentUser.name,
      actorRole: currentUser.role,
      actorCampus: student.campus,
      device: simulator.currentDeviceId,
      opId,
      createdAt: new Date().toISOString(),
    });

    if (simulator.isOffline) {
      addToast(`Offline: Edit queued locally in Outbox (opId: ${opId})`, 'warning');
      return;
    }

    // If online, simulate network transit
    if (simulator.dropNextRequest) {
      setSimulator((s) => ({ ...s, dropNextRequest: false }));
      op.status = 'failed';
      op.errorReason = 'Network packet dropped before reaching server';
      await db.outbox.put(op);
      addToast(`Simulated: Request dropped before server receipt. Retrying in background.`, 'danger');
      return;
    }

    if (simulator.dropNextResponse) {
      setSimulator((s) => ({ ...s, dropNextResponse: false }));
      // Server processed it, but response was dropped in transit!
      op.status = 'failed';
      op.errorReason = 'Commit acknowledged on server but response dropped in transit';
      await db.outbox.put(op);
      addToast(
        `Key Demo Moment: Server committed opId ${opId}, but network lost the response. Outbox will safely replay with idempotency!`,
        'danger'
      );
      return;
    }

    // Success commit
    setTimeout(async () => {
      await db.outbox.delete(opId);
      addToast(`Sync confirmed: ${field} updated and server version bumped to v${updatedStudent.version}`, 'success');
    }, simulator.isSlowNetwork ? 2500 : 400);
  };

  const syncNow = async () => {
    setIsSyncing(true);
    addToast('Contacting sync server...', 'info');

    if (simulator.isOffline) {
      setTimeout(() => {
        setIsSyncing(false);
        addToast('Sync failed: Device is offline. Check connection or toggle simulator.', 'danger');
      }, 600);
      return;
    }

    setTimeout(async () => {
      const pendingOps = await db.outbox.toArray();
      for (const op of pendingOps) {
        await db.outbox.delete(op.opId);
      }
      await db.meta.put({ key: 'lastSyncedAt', value: new Date().toISOString() });
      setIsSyncing(false);
      addToast(`Sync complete! All pending operations confirmed by server.`, 'success');
    }, simulator.isSlowNetwork ? 2500 : 800);
  };

  const injectRemoteConflict = async () => {
    const student = await db.students.get('e01a8f90-8431-4822-92ab-1101aa000001');
    if (!student) return;

    const conflictId = 'conf-' + Math.random().toString(36).substring(2, 7);
    await db.conflicts.add({
      id: conflictId,
      studentId: student.id,
      studentName: student.full_name,
      reg_no: student.reg_no,
      field: 'phone',
      baseVersion: student.field_versions['phone'] || 1,
      serverValue: '0300-9988111',
      serverVersion: (student.field_versions['phone'] || 1) + 1,
      incomingValue: student.phone,
      actor: 'Admin Tariq (Central Ingress)',
      campus: 'Islamabad',
      device: 'Server Background Worker',
      status: 'open',
      createdAt: new Date().toISOString(),
    });

    addToast(`Remote Edit Injected! Concurrent conflict detected on ${student.full_name} (${student.reg_no})`, 'danger');
  };

  const resetDemoData = async () => {
    await db.students.clear();
    await db.outbox.clear();
    await db.conflicts.clear();
    await db.history.clear();

    await db.students.bulkAdd(INITIAL_STUDENTS);
    await db.conflicts.bulkAdd(INITIAL_CONFLICTS);
    await db.history.bulkAdd(INITIAL_HISTORY);
    await db.meta.put({ key: 'lastSyncedAt', value: new Date().toISOString() });

    addToast('Demo data reseeded to pristine hackathon initial state', 'success');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        activeCampus,
        setActiveCampus,
        simulator,
        setSimulator,
        toasts,
        addToast,
        syncNow,
        isSyncing,
        injectRemoteConflict,
        resetDemoData,
        queueEditOperation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
