import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../db';
import type { CurrentUser, CampusCode, SimulatorState, StudentRecord } from '../types';
import { queueOperationAtomically } from '../sync/outbox';
import {
  fetchSnapshot,
  pushBatch,
  pullChanges,
  injectRemoteConflictServer,
  resetDemoServer,
} from '../services/api';

export const DEMO_USERS: CurrentUser[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    name: 'Central Admin',
    email: 'admin@campussync.local',
    role: 'admin',
    campus: undefined, // Central Multi-Campus Scope
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    name: 'Prof. Ahmed (Lahore)',
    email: 'faculty@campussync.local',
    role: 'faculty',
    campus: 'Lahore',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000004',
    name: 'Ali Raza (Student)',
    email: 'student@campussync.local',
    role: 'student',
    campus: 'Lahore',
    student_id: '10000000-0000-0000-0000-000000000001',
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
  isLoggedIn: boolean;
  logout: () => void;
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
  queueEditOperation: (
    studentId: string,
    field: string,
    newValue: any,
    oldValue: any,
    baseVersion: number,
    type?: 'edit' | 'create' | 'resolve' | 'restore',
    studentData?: Partial<StudentRecord>
  ) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(DEMO_USERS[0]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('campussync_auth') !== 'false';
  });
  const [activeCampus, setActiveCampus] = useState<CampusCode | 'all'>('all');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const isSyncingRef = useRef(false);

  const handleSetCurrentUser = (user: CurrentUser) => {
    localStorage.setItem('campussync_auth', 'true');
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const logout = () => {
    localStorage.setItem('campussync_auth', 'false');
    setIsLoggedIn(false);
  };

  const [simulator, setSimulator] = useState<SimulatorState>({
    isOffline: false,
    isSlowNetwork: false,
    dropNextRequest: false,
    dropNextResponse: false,
    currentDeviceId: 'Device A (Admin/Campus)',
  });

  const addToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // 1. Initial Hydration from Server API
  const hydrateFromServer = useCallback(async () => {
    try {
      const snapshot = await fetchSnapshot();
      if (snapshot && Array.isArray(snapshot.students)) {
        // Save authoritative students into local Dexie
        await db.students.bulkPut(snapshot.students);

        // Save open conflicts
        if (Array.isArray(snapshot.conflicts) && snapshot.conflicts.length > 0) {
          await db.conflicts.bulkPut(snapshot.conflicts);
        }

        // Store sync cursor
        await db.meta.put({ key: 'syncCursor', value: snapshot.latestCursor });
        await db.meta.put({ key: 'lastSyncedAt', value: new Date().toISOString() });
        addToast(`Connected to CampusSync VPS! Loaded ${snapshot.students.length} records.`, 'success');
      }
    } catch (err: any) {
      console.warn('Initial server hydration warning (will use offline local data):', err.message);
    }
  }, [addToast]);

  useEffect(() => {
    hydrateFromServer();
  }, [hydrateFromServer]);

  // 2. The Core Sync Loop (Outbox Sender + Incremental Pull)
  const syncNow = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      if (simulator.isOffline) {
        addToast('Device is offline. Changes remain safely stored in local Outbox.', 'warning');
        return;
      }

      if (simulator.isSlowNetwork) {
        await new Promise((r) => setTimeout(r, 1500));
      }

      // Check Outbox for pending operations
      const pendingOps = await db.outbox.toArray();

      if (pendingOps.length > 0) {
        // Handle Failure Simulator: Drop Next Request (before reaching server)
        if (simulator.dropNextRequest) {
          setSimulator((s) => ({ ...s, dropNextRequest: false }));
          for (const op of pendingOps) {
            await db.outbox.update(op.opId, {
              status: 'failed',
              errorReason: 'Simulated packet dropped before reaching server',
            });
          }
          addToast('Simulated: Request packet dropped before reaching server. Retaining in Outbox.', 'danger');
          return;
        }

        // Handle Failure Simulator: Drop Next Response (KEY DEMO MOMENT: server commits, response lost)
        if (simulator.dropNextResponse) {
          setSimulator((s) => ({ ...s, dropNextResponse: false }));
          // Fire push to server so PostgreSQL COMMITS and records processed_ops
          await pushBatch({
            operations: pendingOps.map((op) => ({
              opId: op.opId,
              studentId: op.studentId,
              field: op.field,
              newValue: op.newValue,
              baseVersion: op.baseVersion,
              deviceId: op.deviceId,
              type: op.type,
            })),
          }).catch(() => null);

          // Discard response locally and mark as failed
          for (const op of pendingOps) {
            await db.outbox.update(op.opId, {
              status: 'failed',
              errorReason: 'Server committed edit, but network dropped response in transit.',
            });
          }
          addToast(
            'DEMO: Server committed change to Postgres, but reply was lost! Outbox will replay with idempotency.',
            'danger'
          );
          return;
        }

        // Standard batch push to server
        const pushRes = await pushBatch({
          operations: pendingOps.map((op) => ({
            opId: op.opId,
            studentId: op.studentId,
            field: op.field,
            newValue: op.newValue,
            baseVersion: op.baseVersion,
            deviceId: op.deviceId,
            type: op.type,
          })),
        });

        // Process individual results
        for (const res of pushRes.results) {
          if (res.status === 'applied' || res.status === 'duplicate') {
            await db.outbox.delete(res.opId);
            await db.history.filter((h) => h.opId === res.opId).modify({ isPending: false });
            if (res.status === 'duplicate') {
              addToast(`Idempotency verified: duplicate opId ${res.opId} safely acknowledged!`, 'info');
            }
          } else if (res.status === 'conflict') {
            await db.outbox.update(res.opId, {
              status: 'conflict',
              errorReason: res.reason,
            });
            addToast(`Conflict raised on ${res.field}: Server value preserved.`, 'danger');
          } else if (res.status === 'rejected') {
            await db.outbox.update(res.opId, {
              status: 'rejected',
              errorReason: res.reason,
            });
            addToast(`Server rejected operation: ${res.reason}`, 'danger');
          }
        }
      }

      // Pull incremental changes since cursor
      const cursorMeta = await db.meta.get('syncCursor');
      const currentCursor = cursorMeta?.value || 0;
      const pullRes = await pullChanges(currentCursor);

      if (pullRes.changes && pullRes.changes.length > 0) {
        for (const change of pullRes.changes) {
          // Merge history entry
          await db.history.put({
            ...change,
            isPending: false,
          });

          // Update student record if exists locally
          const s = await db.students.get(change.studentId);
          if (s && change.field && change.field !== '*') {
            const fv = { ...s.field_versions, [change.field]: change.fieldVersionAfter };
            await db.students.update(change.studentId, {
              [change.field]: change.newValue,
              field_versions: fv,
              version: s.version + 1,
              updated_at: change.createdAt,
              last_editor_id: change.actorName,
            });
          }
        }

        // Also refresh open conflicts
        const snapshot = await fetchSnapshot();
        if (snapshot.conflicts) {
          await db.conflicts.clear();
          await db.conflicts.bulkPut(snapshot.conflicts);
        }
      }

      // Update sync metadata
      if (pullRes.latestCursor !== undefined) {
        await db.meta.put({ key: 'syncCursor', value: pullRes.latestCursor });
      }
      await db.meta.put({ key: 'lastSyncedAt', value: new Date().toISOString() });
      addToast('Sync complete! State synchronized with VPS backend.', 'success');
    } catch (err: any) {
      console.error('Sync failed:', err);
      addToast(`Sync error: ${err.message}`, 'danger');
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [simulator, addToast]);

  // 3. Server-Sent Events (SSE) Live Broadcast Listener
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/events');
      es.addEventListener('sync_event', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.reset) {
            hydrateFromServer();
          } else {
            syncNow();
          }
        } catch (err) {
          console.error('Error handling SSE sync_event', err);
        }
      });
    } catch (err) {
      console.warn('SSE connection warning:', err);
    }

    return () => {
      es?.close();
    };
  }, [hydrateFromServer, syncNow]);

  // 4. Queue Edit Operation (Offline-First Outbox Pattern via Pure Outbox Module)
  const queueEditOperation = async (
    studentId: string,
    field: string,
    newValue: any,
    oldValue: any,
    baseVersion: number,
    type: 'edit' | 'create' | 'resolve' | 'restore' = 'edit',
    studentData?: Partial<StudentRecord>
  ) => {
    // Atomically commit local student record mutation, local audit log, and outbox queue entry
    // in a single IndexedDB (Dexie) transaction using pure outbox module
    const op = await queueOperationAtomically(db, {
      studentId,
      field,
      newValue,
      oldValue,
      baseVersion,
      deviceId: simulator.currentDeviceId,
      type,
      studentData,
      actorName: currentUser?.name || 'Local User',
      actorRole: currentUser?.role || 'student',
      actorCampus: currentUser?.campus,
      isOffline: simulator.isOffline,
    });

    if (simulator.isOffline) {
      addToast(`Offline: Operation ${op.opId} safely queued in Outbox.`, 'warning');
      return;
    }

    // Trigger sync automatically if online
    syncNow();
  };

  // 5. Inject Remote Conflict (Calls VPS Backend Demo Endpoint)
  const injectRemoteConflict = async () => {
    try {
      addToast('Injecting remote cross-campus edit from Islamabad...', 'info');
      await injectRemoteConflictServer();
      await syncNow();
      addToast('Remote edit committed on server! Conflict detected and held for resolution.', 'danger');
    } catch (err: any) {
      addToast(`Failed to inject remote edit: ${err.message}`, 'danger');
    }
  };

  // 6. Reset Demo Data (Calls VPS Backend Reset)
  const resetDemoData = async () => {
    try {
      addToast('Resetting VPS database and local caches...', 'info');
      await resetDemoServer();
      await db.students.clear();
      await db.outbox.clear();
      await db.conflicts.clear();
      await db.history.clear();
      await db.meta.clear();
      await hydrateFromServer();
      addToast('Database & cache reset to clean 3-campus seeded state!', 'success');
    } catch (err: any) {
      addToast(`Reset failed: ${err.message}`, 'danger');
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser: handleSetCurrentUser,
        isLoggedIn,
        logout,
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
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
