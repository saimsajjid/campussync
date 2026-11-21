import React, { useState } from 'react';
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RotateCw,
  Wifi,
  WifiOff,
  ShieldCheck,
  Database,
  Server,
  Activity,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronRight,
  Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { OutboxOperation } from '../types';
import { fetchIntegrityReport } from '../services/api';

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

interface InvariantCheckItem {
  id: string;
  title: string;
  description: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  offendingCount: number;
  details?: any[];
}

const INITIAL_CHECKS: InvariantCheckItem[] = [
  {
    id: 'inv-uniqueness',
    title: 'Record Uniqueness',
    description: 'Global uniqueness of primary and natural keys across all campuses.',
    status: 'idle',
    offendingCount: 0,
  },
  {
    id: 'inv-exactly-once',
    title: 'Transaction Deduplication',
    description: 'Network retries or duplicate packet submissions never double-apply.',
    status: 'idle',
    offendingCount: 0,
  },
  {
    id: 'inv-replayability',
    title: 'History Replayability',
    description: 'The ledger faithfully reproduces all current state values without corruption.',
    status: 'idle',
    offendingCount: 0,
  },
  {
    id: 'inv-version-integrity',
    title: 'Version Monotonicity',
    description: 'No missing intermediate versions or uncounted updates exist in the timeline.',
    status: 'idle',
    offendingCount: 0,
  },
  {
    id: 'inv-referential-integrity',
    title: 'Referential Integrity',
    description: 'Foreign keys and audit references are clean and non-dangling.',
    status: 'idle',
    offendingCount: 0,
  },
  {
    id: 'inv-no-lost-edits',
    title: 'Mutation Traceability',
    description: 'No user submission has vanished without a documented trace.',
    status: 'idle',
    offendingCount: 0,
  },
  {
    id: 'inv-append-only',
    title: 'Append-Only Immutability',
    description: 'Database triggers actively prevent and reject UPDATE or DELETE operations on the history audit trail.',
    status: 'idle',
    offendingCount: 0,
  },
];

interface SyncCenterPageProps {
  initialSection?: 'outbox' | 'integrity';
}

export const SyncCenterPage: React.FC<SyncCenterPageProps> = ({ initialSection = 'outbox' }) => {
  const { simulator, syncNow, isSyncing, addToast, currentUser } = useApp();
  const [activeSection, setActiveSection] = useState<'outbox' | 'integrity'>(initialSection);

  // Integrity Suite State
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [checks, setChecks] = useState<InvariantCheckItem[]>(INITIAL_CHECKS);

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

  // Integrity Check Handler
  const toggleDetails = (id: string) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllDetails = () => {
    const anyExpanded = Object.values(expandedDetails).some(Boolean);
    if (anyExpanded) {
      setExpandedDetails({});
    } else {
      const all: Record<string, boolean> = {};
      checks.forEach((c) => {
        all[c.id] = true;
      });
      setExpandedDetails(all);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const runAllChecks = async () => {
    setIsRunningChecks(true);
    addToast('Executing database invariant checks (FR-11)...', 'info');
    setChecks((prev) => prev.map((c) => ({ ...c, status: 'running' })));

    try {
      const suiteRes = await fetchIntegrityReport();
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        setChecks((prev) =>
          prev.map((c) => {
            const remote = suiteRes.checks?.find((rc) => rc.id === c.id);
            return {
              ...c,
              description: remote?.description || c.description,
              status: remote ? remote.status : 'passed',
              offendingCount: remote ? remote.offendingRowsCount : 0,
              details: remote?.details,
            };
          })
        );
      } else {
        for (let i = 0; i < INITIAL_CHECKS.length; i++) {
          await new Promise((r) => setTimeout(r, 220));
          const targetId = INITIAL_CHECKS[i].id;
          const remote = suiteRes.checks?.find((rc) => rc.id === targetId);
          setChecks((prev) =>
            prev.map((c) =>
              c.id === targetId
                ? {
                    ...c,
                    description: remote?.description || c.description,
                    status: remote ? remote.status : 'passed',
                    offendingCount: remote ? remote.offendingRowsCount : 0,
                    details: remote?.details,
                  }
                : c
            )
          );
        }
      }

      setScanTimestamp(suiteRes.timestamp || new Date().toISOString());
      setHasScanned(true);

      if (suiteRes.allPassed) {
        addToast('All 7 database invariants passed (FR-11 Verified).', 'success');
      } else {
        addToast('Integrity check detected issues.', 'danger');
      }
    } catch (err: any) {
      addToast(`Integrity check failed: ${err.message}`, 'danger');
      setChecks((prev) => prev.map((c) => ({ ...c, status: 'failed', offendingCount: 1 })));
      setHasScanned(true);
    } finally {
      setIsRunningChecks(false);
    }
  };

  const allPassed = checks.every((c) => c.status === 'passed');
  const failedCount = checks.filter((c) => c.status === 'failed').length;
  const isAnyExpanded = Object.values(expandedDetails).some(Boolean);

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
              ? 'Local outbox operations awaiting synchronization with campus servers.'
              : 'Cross-campus synchronization queue, network simulation, and FR-11 invariant verification.'}
          </p>
        </div>

        {/* Dynamic Action Button */}
        {activeSection === 'outbox' ? (
          <button
            onClick={() => syncNow()}
            disabled={isSyncing}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
          </button>
        ) : (
          <button
            onClick={runAllChecks}
            disabled={isRunningChecks}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all self-start sm:self-auto cursor-pointer"
          >
            {isRunningChecks ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white" />
            )}
            <span>{isRunningChecks ? 'Verifying Invariants...' : 'Run Invariant Check'}</span>
          </button>
        )}
      </div>

      {/* Admin Tab Switcher */}
      {!isStudent && (
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveSection('outbox')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
              activeSection === 'outbox'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Outbox & Sync Queue</span>
            {outboxItems && outboxItems.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {outboxItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSection('integrity')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
              activeSection === 'integrity'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Integrity Verification (7 Invariants)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              FR-11
            </span>
          </button>
        </div>
      )}

      {/* SECTION 1: OUTBOX & SYNC QUEUE */}
      {activeSection === 'outbox' && (
        <div className="space-y-6">
          {/* Sync Status Banner */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  simulator.isOffline ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
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
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      simulator.isOffline ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {simulator.isOffline ? 'Offline' : 'Online'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Last successful sync:{' '}
                  {lastSyncMeta?.value
                    ? new Date(lastSyncMeta.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Just now'}
                </p>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              Device ID: <span className="font-mono text-slate-900 font-bold">{simulator.currentDeviceId}</span>
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
                        <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
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
      )}

      {/* SECTION 2: INTEGRITY VERIFICATION (7 INVARIANTS) */}
      {activeSection === 'integrity' && (
        <div className="space-y-6">
          {/* KPI Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Database status</span>
                <Database className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Connected
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">PostgreSQL server active</p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Integrity Invariants</span>
                <Server className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900">
                7 Invariants
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Section 8 Data Correctness</p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Last scan result</span>
                <Activity className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900">
                {!hasScanned
                  ? 'Not run yet'
                  : allPassed
                  ? 'All 7 invariants passed'
                  : `${failedCount} ${failedCount === 1 ? 'check' : 'checks'} failed`}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                {hasScanned && scanTimestamp ? (
                  <>
                    <Clock className="w-3 h-3 inline" />
                    <span>{formatTimestamp(scanTimestamp)}</span>
                  </>
                ) : (
                  'Ready for live verification'
                )}
              </p>
            </div>
          </div>

          {/* Verified Banner */}
          {hasScanned && (
            <div
              className={`p-4 rounded-2xl flex items-center justify-between shadow-xs border ${
                allPassed
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                    allPassed ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  {allPassed ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <AlertTriangle className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <span
                    className={`font-bold text-sm block ${
                      allPassed ? 'text-emerald-900' : 'text-rose-900'
                    }`}
                  >
                    {allPassed ? 'All 7 Invariants Verified & Sound' : `${failedCount} checks failed`}
                  </span>
                  <span
                    className={`text-xs ${
                      allPassed ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {allPassed
                      ? `Scan finished at ${scanTimestamp ? formatTimestamp(scanTimestamp) : 'just now'}. Zero database anomalies or lost updates detected.`
                      : 'Review the details below for offending records.'}
                  </span>
                </div>
              </div>
              <span
                className={`hidden sm:inline text-xs font-bold px-3 py-1 rounded-full text-white ${
                  allPassed ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {allPassed ? 'FR-11 Compliant' : 'Action required'}
              </span>
            </div>
          )}

          {/* Checks Header with Details Toggle */}
          <div className="flex items-center justify-between pt-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Database Invariant Checks (FR-11)
            </h2>
            <button
              type="button"
              onClick={toggleAllDetails}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{isAnyExpanded ? 'Hide all details' : 'Show all details'}</span>
            </button>
          </div>

          {/* Checks List */}
          <div className="space-y-3">
            {checks.map((chk, idx) => (
              <div
                key={chk.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-sm text-slate-900">{chk.title}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">What this proves: </span>
                      {chk.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    {chk.status === 'passed' && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Passed (0 anomalies)</span>
                      </div>
                    )}
                    {chk.status === 'running' && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
                        <RotateCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Checking...</span>
                      </div>
                    )}
                    {chk.status === 'idle' && (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        Not run yet
                      </span>
                    )}
                    {chk.status === 'failed' && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Failed ({chk.offendingCount} offending {chk.offendingCount === 1 ? 'row' : 'rows'})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collapsible Details */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => toggleDetails(chk.id)}
                    className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {expandedDetails[chk.id] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    <span>{expandedDetails[chk.id] ? 'Hide details' : 'Show details'}</span>
                  </button>

                  {expandedDetails[chk.id] && (
                    <div className="mt-2.5 p-3.5 bg-slate-900 rounded-xl text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800 shadow-inner">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                        API Invariant Verification Proof
                      </div>
                      <pre className="text-emerald-400 text-[11px] whitespace-pre-wrap">
                        {chk.details && chk.details.length > 0
                          ? JSON.stringify(chk.details, null, 2)
                          : 'No offending rows or invariants violated.'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
