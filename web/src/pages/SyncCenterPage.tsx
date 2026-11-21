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
      addToast('Cannot retry while offline. Toggle connection first.', 'warning');
      return;
    }
    try {
      await syncNow();
      addToast(`Operation ${op.opId} retried.`, 'info');
    } catch (err: any) {
      addToast(`Retry failed: ${err.message}`, 'danger');
    }
  };

  const handleDiscardItem = async (op: OutboxOperation) => {
    if (confirm(`Discard pending edit for field "${op.field}"? This drops the unsynced change from this device.`)) {
      await db.outbox.delete(op.opId);
      addToast(`Operation ${op.opId} discarded from Outbox.`, 'info');
    }
  };

  return (
    <div className="space-y-6 text-left max-w-[1200px] w-full mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isStudent ? 'Sync Outbox' : 'Sync Center'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isStudent
              ? 'Local changes awaiting synchronization with campus servers.'
              : 'Cross-campus synchronization status and pending change queue.'}
          </p>
        </div>

        <button
          onClick={() => syncNow()}
          disabled={isSyncing}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
        </button>
      </div>

      {/* Sync Status Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              simulator.isOffline
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}
          >
            {simulator.isOffline ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {simulator.isOffline ? 'Offline Queue Active' : 'Connected to Server'}
              </span>
              <span
                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  simulator.isOffline
                    ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                }`}
              >
                {simulator.isOffline ? 'Offline' : 'Online'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Operations ({outboxItems?.length || 0})
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
                className="bg-white rounded-2xl border border-amber-200/90 bg-amber-50/20 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      #{op.opId.slice(0, 8)}
                    </span>
                    <span className="font-bold text-sm text-slate-900">
                      {title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        op.status === 'failed' || op.errorReason
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {op.status === 'failed' || op.errorReason ? 'Sync Failed' : 'Saved on this device'}
                    </span>
                  </div>

                  <div className="text-xs flex flex-wrap items-center gap-2 text-slate-700">
                    <span className="text-slate-500">Target Field:</span>
                    <span className="font-semibold bg-gray-100 px-1.5 py-0.5 rounded">
                      {formatFieldName(op.field)}
                    </span>
                    <span className="text-slate-500">• New Value:</span>
                    <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                      {displayValue}
                    </span>
                  </div>

                  {op.errorReason && (
                    <p className="text-[11px] text-rose-600 font-semibold pt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {op.errorReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    onClick={() => handleRetryItem(op)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Retry synchronizing this operation"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Retry
                  </button>
                  <button
                    onClick={() => handleDiscardItem(op)}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Cancel & discard unsynced edit"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Discard
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-500 shadow-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-900">Outbox is Empty</h3>
            <p className="text-xs text-slate-500 mt-1">
              All client operations have been acknowledged and committed by the server.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
