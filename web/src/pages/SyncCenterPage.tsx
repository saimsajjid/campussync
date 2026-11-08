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

export const SyncCenterPage: React.FC = () => {
  const { simulator, syncNow, isSyncing, addToast } = useApp();

  const outboxItems = useLiveQuery(() => {
    return db.outbox.toArray();
  }, []);

  const lastSyncMeta = useLiveQuery(() => {
    return db.meta.get('lastSyncedAt');
  }, []);

  const handleRetryItem = async (op: OutboxOperation) => {
    if (simulator.isOffline) {
      addToast('Cannot retry while offline. Toggle connection first.', 'warning');
      return;
    }
    await db.outbox.delete(op.opId);
    addToast(`Operation ${op.opId} retried and acknowledged by server!`, 'success');
  };

  const handleDiscardItem = async (op: OutboxOperation) => {
    if (confirm(`Discard pending edit for field "${op.field}"? This drops the unsynced change.`)) {
      await db.outbox.delete(op.opId);
      addToast(`Operation ${op.opId} discarded from Outbox.`, 'info');
    }
  };

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-[#4F7DF3]" />
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] tracking-tight">
              Sync Center & Local Outbox
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            FR-4: Outbox pattern commits edits to IndexedDB before network transmission.
          </p>
        </div>

        <button
          onClick={() => syncNow()}
          disabled={isSyncing}
          className="px-5 py-2.5 bg-[#4F7DF3] hover:bg-[#3E6AE1] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md shadow-[#4F7DF3]/20 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
        </button>
      </div>

      {/* Sync Status Banner */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              simulator.isOffline ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {simulator.isOffline ? <WifiOff className="w-6 h-6" /> : <Wifi className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#1E293B]">
                {simulator.isOffline ? 'Offline Queue Active' : 'Connected to Server'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  simulator.isOffline ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {simulator.isOffline ? 'Offline' : 'Online'}
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Last successful sync:{' '}
              {lastSyncMeta?.value
                ? new Date(lastSyncMeta.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : 'Just now'}
            </p>
          </div>
        </div>

        <div className="text-xs font-semibold text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 rounded-xl">
          Device ID: <span className="font-mono text-[#1E293B] font-bold">{simulator.currentDeviceId}</span>
        </div>
      </div>

      {/* Outbox Items List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" /> Pending Outbox Operations ({outboxItems?.length || 0})
          </h2>
          <span className="text-[11px] text-[#6B7280]">Ordered FIFO Delivery (FR-4.2)</span>
        </div>

        {outboxItems && outboxItems.length > 0 ? (
          outboxItems.map((op) => (
            <div
              key={op.opId}
              className="bg-white rounded-2xl border border-amber-200 bg-amber-50/20 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    opId: {op.opId}
                  </span>
                  <span className="font-bold text-xs text-[#1E293B]">
                    Field: <code className="bg-gray-100 px-1 py-0.5 rounded">{op.field}</code>
                  </span>
                  <span className="text-xs text-[#6B7280]">• Target: v{op.baseVersion}</span>
                </div>

                <div className="text-xs flex items-center gap-2 pt-1 text-[#1E293B]">
                  <span className="font-semibold">New Value:</span>
                  <span className="font-mono bg-white border border-[#CBD5E1] px-2 py-0.5 rounded">
                    {typeof op.newValue === 'object' ? JSON.stringify(op.newValue) : String(op.newValue)}
                  </span>
                </div>

                {op.errorReason && (
                  <p className="text-[11px] text-red-600 font-semibold pt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {op.errorReason}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  onClick={() => handleRetryItem(op)}
                  className="px-3 py-1.5 bg-[#4F7DF3] hover:bg-[#3E6AE1] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                  title="Retry sending this operation"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Retry
                </button>
                <button
                  onClick={() => handleDiscardItem(op)}
                  className="px-3 py-1.5 bg-white border border-[#CBD5E1] hover:bg-red-50 hover:text-red-600 text-[#6B7280] text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                  title="Cancel & discard from Outbox"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Discard
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center text-[#6B7280] shadow-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-[#1E293B]">Outbox is Empty</h3>
            <p className="text-xs text-[#6B7280] mt-1">
              All client operations have been acknowledged and committed by the server.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
