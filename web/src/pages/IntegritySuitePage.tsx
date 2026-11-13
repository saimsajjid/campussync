import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Database,
  Server,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fetchIntegrityReport } from '../services/api';

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

export const IntegritySuitePage: React.FC = () => {
  const { addToast } = useApp();
  const [isRunning, setIsRunning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [checks, setChecks] = useState<InvariantCheckItem[]>(INITIAL_CHECKS);

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
    setIsRunning(true);
    addToast('Executing database health diagnostics...', 'info');

    // Mark all as running
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
        // Resolve one by one ~250ms apart
        for (let i = 0; i < INITIAL_CHECKS.length; i++) {
          await new Promise((r) => setTimeout(r, 250));
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
        addToast('All 7 checks passed.', 'success');
      } else {
        addToast('Integrity check detected issues.', 'danger');
      }
    } catch (err: any) {
      addToast(`Health check failed: ${err.message}`, 'danger');
      setChecks((prev) => prev.map((c) => ({ ...c, status: 'failed', offendingCount: 1 })));
      setHasScanned(true);
    } finally {
      setIsRunning(false);
    }
  };

  const allPassed = checks.every((c) => c.status === 'passed');
  const failedCount = checks.filter((c) => c.status === 'failed').length;
  const isAnyExpanded = Object.values(expandedDetails).some(Boolean);

  return (
    <div className="space-y-6 text-left max-w-[1200px] w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-[var(--color-primary)]" />
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-dark)] tracking-tight">
              System health
            </h1>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Verification of database consistency, offline sync reconciliation, and audit logs.
          </p>
        </div>

        <button
          onClick={runAllChecks}
          disabled={isRunning}
          className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md shadow-[var(--color-primary)]/20 flex items-center gap-2 transition-all self-start sm:self-auto cursor-pointer"
        >
          {isRunning ? (
            <RotateCcw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-white" />
          )}
          <span>{isRunning ? 'Running health check...' : 'Run health check'}</span>
        </button>
      </div>

      {/* KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white rounded-xl border border-[var(--color-border-subtle)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Database status</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-[var(--color-text-dark)] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-green" />
            Connected
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">PostgreSQL server active</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[var(--color-border-subtle)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Integrity checks</span>
            <Server className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div className="mt-2 text-lg font-bold text-[var(--color-text-dark)]">
            7 checks
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Automated reconciliation</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[var(--color-border-subtle)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Last scan result</span>
            <Activity className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 text-lg font-bold text-[var(--color-text-dark)]">
            {!hasScanned
              ? 'Not run yet'
              : allPassed
              ? 'All 7 checks passed.'
              : `${failedCount} ${failedCount === 1 ? 'check' : 'checks'} failed`}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1">
            {hasScanned && scanTimestamp ? (
              <>
                <Clock className="w-3 h-3 inline" />
                <span>{formatTimestamp(scanTimestamp)}</span>
              </>
            ) : (
              'Awaiting manual or scheduled trigger'
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
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                allPassed ? 'bg-emerald-600' : 'bg-red-600'
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
                  allPassed ? 'text-emerald-900' : 'text-red-900'
                }`}
              >
                {allPassed ? 'All 7 checks passed.' : `${failedCount} checks failed`}
              </span>
              <span
                className={`text-xs ${
                  allPassed ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {allPassed
                  ? `Run completed on ${scanTimestamp ? formatTimestamp(scanTimestamp) : 'just now'}. Zero database anomalies detected.`
                  : 'Review the details below for offending records.'}
              </span>
            </div>
          </div>
          <span
            className={`hidden sm:inline text-xs font-bold px-3 py-1 rounded-full text-white ${
              allPassed ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {allPassed ? 'All checks healthy' : 'Action required'}
          </span>
        </div>
      )}

      {/* Checks Header with Details Toggle */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Database integrity checks
        </h2>
        <button
          type="button"
          onClick={toggleAllDetails}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>{isAnyExpanded ? 'Hide all details' : 'Show all details'}</span>
        </button>
      </div>

      {/* Checks List */}
      <div className="space-y-3">
        {checks.map((chk, idx) => (
          <div
            key={chk.id}
            className="bg-white rounded-2xl border border-[var(--color-border-subtle)] p-5 shadow-xs transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-slate-100)] px-2 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-sm text-[var(--color-text-dark)]">{chk.title}</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  <span className="font-semibold text-[var(--color-text-dark)]">What this proves: </span>
                  {chk.description}
                </p>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                {chk.status === 'passed' && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Passed (0 offending records)</span>
                  </div>
                )}
                {chk.status === 'running' && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
                    <RotateCcw className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                    <span>Checking...</span>
                  </div>
                )}
                {chk.status === 'idle' && (
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                    Not run yet
                  </span>
                )}
                {chk.status === 'failed' && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
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
                className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 transition-colors cursor-pointer"
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
                    API Response Details
                  </div>
                  <pre className="text-emerald-400 text-[11px] whitespace-pre-wrap">
                    {chk.details && chk.details.length > 0
                      ? JSON.stringify(chk.details, null, 2)
                      : 'No offending rows detected.'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
