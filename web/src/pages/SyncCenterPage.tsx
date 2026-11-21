import React from 'react';
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RotateCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { OutboxOperation } from '../types';

const formatFieldName = (field: string): string => {
  if (field === '*') return 'Full Record Profile';
  const names: Record<string, string> = {
    full_name: 'Full Name',
    reg_no: 'Registration Number',
    cnic: 'CNIC / National ID',
    campus: 'Campus',
    program: 'Program',
    semester: 'Semester',
    status: 'Status',
    phone: 'Phone Number',
    email: 'Email Address',
    address: 'Residential Address',
    emergency_contact: 'Emergency Contact',
    attendance: 'Attendance',
    remarks: 'Faculty Remarks',
  };
  return names[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const SyncCenterPage: React.FC = () => {
  const { simulator, syncNow, isSyncing, addToast, currentUser } = useApp();

  const isStudent = currentUser?.role === 'student';

  const outboxItems = useLiveQuery(() => {
    if (isStudent && currentUser?.student_id) {
      return db.outbox.where('studentId').equals(currentUser.student_id).toArray();
    }
    return db.outbox.toArray();
  }, [isStudent, currentUser?.student_id]);

  const lastSyncMeta = useLiveQuery(() => {
    return db.meta.get('lastSyncedAt');
  }, []);

  const handleRetryItem = async (op: OutboxOperation) => {
    if (simulator.isOffline) {
      addToast('Cannot retry while offline. Restore connection first.', 'warning');
      return;
    }
    try {
      await syncNow();
      addToast(`Operation ${op.opId.slice(0, 8)} retried.`, 'info');
    } catch (err: any) {
      addToast(`Retry failed: ${err.message}`, 'danger');
    }
  };

  const handleDiscardItem = async (op: OutboxOperation) => {
    if (confirm(`Discard pending edit for field "${op.field}"? This drops the unsynced change from this device.`)) {
      await db.outbox.delete(op.opId);
      addToast(`Operation ${op.opId.slice(0, 8)} discarded from Outbox.`, 'info');
    }
  };

  return (
    <div className="space-y-6 text-left max-w-[1240px] w-full mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-6 h-6 text-zinc-900" />
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {isStudent ? 'Sync Outbox' : 'Sync Center'}
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {isStudent
              ? 'Local queued changes awaiting synchronization with central university database.'
              : 'Cross-campus synchronization status and offline mutation queue.'}
          </p>
        </div>

        <button
          onClick={() => syncNow()}
          disabled={isSyncing}
          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-50 rounded-lg text-xs font-medium shadow-xs flex items-center gap-2 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
        </button>
      </div>

      {/* Sync Status Banner */}
      <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-zinc-100 text-zinc-900 border border-zinc-200">
            {simulator.isOffline ? <WifiOff className="w-5 h-5 text-zinc-600" /> : <Wifi className="w-5 h-5 text-zinc-900" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900">
                {simulator.isOffline ? 'Offline Queue Active' : 'Connected to Central Server'}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-zinc-100 text-zinc-800 border-zinc-200">
                {simulator.isOffline ? 'Offline' : 'Online'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Last successful sync:{' '}
              {lastSyncMeta?.value
                ? new Date(lastSyncMeta.value).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : 'Just now'}
            </p>
          </div>
        </div>
      </div>

      {/* Outbox Items List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-zinc-500" /> Pending Operations ({outboxItems?.length || 0})
          </h2>
        </div>

        {outboxItems && outboxItems.length > 0 ? (
          outboxItems.map((op) => {
            const isCreate = op.type === 'create' || op.field === '*';
            const title = isCreate
              ? 'New Student Registration'
              : `Update ${formatFieldName(op.field)}`;
            const displayValue =
              typeof op.newValue === 'object' && op.newValue !== null
                ? op.newValue.full_name
                  ? `${op.newValue.full_name} (${op.newValue.reg_no || ''})`
                  : 'Student Registration Details'
                : String(op.newValue ?? '');

            return (
              <div
                key={op.opId}
                className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      #{op.opId.slice(0, 8)}
                    </span>
                    <span className="font-semibold text-sm text-zinc-900">
                      {title}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-zinc-100 text-zinc-800 border-zinc-200">
                      {op.status === 'failed' || op.errorReason ? 'Sync Failed' : 'Queued locally'}
                    </span>
                  </div>

                  <div className="text-xs flex flex-wrap items-center gap-2 text-zinc-700">
                    <span className="text-zinc-500">Target Field:</span>
                    <span className="font-medium bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-900 border border-zinc-200/60">
                      {formatFieldName(op.field)}
                    </span>
                    <span className="text-zinc-400">• New Value:</span>
                    <span className="font-mono text-xs font-medium text-zinc-900 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md">
                      {displayValue}
                    </span>
                  </div>

                  {op.errorReason && (
                    <p className="text-[11px] text-zinc-700 font-medium pt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-zinc-600" /> {op.errorReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    onClick={() => handleRetryItem(op)}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Retry synchronizing this operation"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Retry
                  </button>
                  <button
                    onClick={() => handleDiscardItem(op)}
                    className="px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-950 text-zinc-600 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Cancel & discard unsynced edit"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Discard
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200/90 p-12 text-center text-zinc-500 shadow-2xs">
            <CheckCircle2 className="w-10 h-10 text-zinc-800 mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-zinc-900">Outbox is Clean</h3>
            <p className="text-xs text-zinc-500 mt-1">
              All client operations have been acknowledged and synchronized by the central server.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
