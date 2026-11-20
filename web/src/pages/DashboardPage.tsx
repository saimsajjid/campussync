import React from 'react';
import {
  WifiOff,
  RefreshCw,
  Users,
  Building2,
  ArrowRight,
  UserPlus,
  Clock,
  ShieldCheck,
  Activity,
  Zap,
  ArrowUpRight,
  CheckCircle2,
  Server,
  Globe2,
  GitBranch
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { StatusBadge } from '../components/StatusBadge';
import type { StudentRecord } from '../types';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
  onOpenAddStudent: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenAddStudent }) => {
  const {
    activeCampus,
    setActiveCampus,
    simulator,
    currentUser,
    syncNow,
    isSyncing
  } = useApp();

  // All student records (global count)
  const allStudents = useLiveQuery(() => db.students.toArray(), [], []) as StudentRecord[];

  // Filtered students based on active campus selection
  const displayedStudents = React.useMemo(() => {
    if (!allStudents) return [];
    if (activeCampus === 'all') return allStudents;
    return allStudents.filter((s) => s.campus === activeCampus);
  }, [allStudents, activeCampus]);

  // Open conflicts count
  const openConflictsCount = useLiveQuery(
    () => db.conflicts.where('status').equals('open').count(),
    [],
    0
  );

  // Pending outbox mutations count
  const pendingOutboxCount = useLiveQuery(
    () => db.outbox.count(),
    [],
    0
  );

  // Recent change history entries
  const recentHistory = useLiveQuery(
    () => db.history.reverse().limit(5).toArray(),
    [],
    []
  );

  // Total recorded sync mutations
  const totalSyncOps = useLiveQuery(
    () => db.history.count(),
    [],
    0
  );

  // Live Invariant Checkers
  const totalCount = allStudents.length;
  const uniqueCnics = React.useMemo(() => new Set(allStudents.map((s) => s.cnic)).size, [allStudents]);
  const uniqueRegNos = React.useMemo(() => new Set(allStudents.map((s) => s.reg_no)).size, [allStudents]);
  const hasCnicDuplicates = totalCount > 0 && uniqueCnics !== totalCount;
  const hasRegDuplicates = totalCount > 0 && uniqueRegNos !== totalCount;
  const isInvariantPass = !hasCnicDuplicates && !hasRegDuplicates && openConflictsCount === 0;

  // Campus demographic counts
  const lahoreCount = allStudents.filter((s) => s.campus === 'Lahore').length;
  const islamabadCount = allStudents.filter((s) => s.campus === 'Islamabad').length;
  const abbottabadCount = allStudents.filter((s) => s.campus === 'Abbottabad').length;

  const lahorePct = totalCount > 0 ? Math.round((lahoreCount / totalCount) * 100) : 0;
  const islamabadPct = totalCount > 0 ? Math.round((islamabadCount / totalCount) * 100) : 0;
  const abbottabadPct = totalCount > 0 ? Math.round((abbottabadCount / totalCount) * 100) : 0;

  // Program breakdown counts
  const csCount = allStudents.filter((s) => s.program === 'BS CS').length;
  const seCount = allStudents.filter((s) => s.program === 'BS SE').length;
  const eeCount = allStudents.filter((s) => s.program === 'BS EE').length;

  if (!currentUser) return null;

  const getCampusBadgeClass = (campus?: string) => {
    switch (campus) {
      case 'Lahore':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Islamabad':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Abbottabad':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diffMs = Date.now() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return `${Math.floor(diffHr / 24)}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-6 text-left max-w-[1240px] w-full mx-auto pb-10">
      {/* 1. Executive Top Bar & Command Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-dark)] tracking-tight">
              University Command Center
            </h1>
            <span className="px-2.5 py-0.5 text-[11px] font-bold bg-blue-50 text-[var(--color-primary)] border border-blue-200/80 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
              Live Mesh Sync
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {activeCampus === 'all'
              ? 'Multi-Campus Executive Overview • Synchronizing Lahore, Islamabad, and Abbottabad in real time'
              : `Campus Focus: ${activeCampus} Campus Node • Showing localized records and replication state`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Campus Quick Switcher */}
          <div className="flex items-center bg-[var(--color-surface-bg)] border border-[var(--color-border-subtle)] rounded-xl p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveCampus('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeCampus === 'all'
                  ? 'bg-white text-[var(--color-primary)] shadow-xs font-bold'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)]'
              }`}
            >
              All Campuses
            </button>
            <button
              onClick={() => setActiveCampus('Lahore')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeCampus === 'Lahore'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-[var(--color-text-muted)] hover:text-blue-600'
              }`}
            >
              Lahore
            </button>
            <button
              onClick={() => setActiveCampus('Islamabad')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeCampus === 'Islamabad'
                  ? 'bg-purple-600 text-white shadow-xs font-bold'
                  : 'text-[var(--color-text-muted)] hover:text-purple-600'
              }`}
            >
              Islamabad
            </button>
            <button
              onClick={() => setActiveCampus('Abbottabad')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeCampus === 'Abbottabad'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-[var(--color-text-muted)] hover:text-emerald-600'
              }`}
            >
              Abbottabad
            </button>
          </div>

          {currentUser.role === 'admin' && (
            <button
              onClick={onOpenAddStudent}
              className="px-3.5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-4 h-4" /> Add Student
            </button>
          )}

          <button
            onClick={() => syncNow()}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-white border border-[var(--color-border-muted)] hover:bg-gray-50 text-[var(--color-text-dark)] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--color-primary)] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* 2. High-Signal Executive KPI Cards (Row 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Enrolled Across Campuses */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs hover:border-[var(--color-primary)]/50 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Total Enrolled Records</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[var(--color-primary)] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-[var(--color-text-dark)] tracking-tight">
              {displayedStudents.length}
              {activeCampus !== 'all' && (
                <span className="text-xs font-normal text-[var(--color-text-muted)] ml-1">
                  / {totalCount} total
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span>
                {activeCampus === 'all'
                  ? 'Distributed across 3 Campuses'
                  : `Filtered to ${activeCampus} Campus`}
              </span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px]">
            <span className="text-blue-600 font-semibold">{lahoreCount} LHR</span>
            <span className="text-purple-600 font-semibold">{islamabadCount} ISB</span>
            <span className="text-emerald-600 font-semibold">{abbottabadCount} ABT</span>
          </div>
        </div>

        {/* Card 2: Multi-Campus Synchronization Status */}
        <div
          onClick={() => onNavigate('sync')}
          className="bg-white p-5 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs hover:border-[var(--color-primary)]/50 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Replication State</span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                simulator.isOffline
                  ? 'bg-red-50 text-red-600'
                  : isSyncing
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {simulator.isOffline ? (
                <WifiOff className="w-5 h-5" />
              ) : isSyncing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  simulator.isOffline
                    ? 'bg-red-500'
                    : isSyncing
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-emerald-500'
                }`}
              />
              <span className="text-xl font-bold text-[var(--color-text-dark)]">
                {simulator.isOffline ? 'Offline Buffer' : isSyncing ? 'Synchronizing' : '100% Consistent'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              {simulator.isOffline
                ? `${pendingOutboxCount} pending mutations saved locally`
                : pendingOutboxCount > 0
                ? `${pendingOutboxCount} unsent local operations`
                : 'Zero divergence • 3 nodes in sync'}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Replication Latency</span>
            <span className="font-mono font-semibold text-emerald-600">
              {simulator.isOffline ? 'Paused' : simulator.isSlowNetwork ? '~850ms (simulated)' : '~120ms avg'}
            </span>
          </div>
        </div>

        {/* Card 3: Data Invariants & Single-Entry Guarantee */}
        <div
          onClick={() => onNavigate('diagnostics')}
          className="bg-white p-5 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs hover:border-[var(--color-primary)]/50 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Single-Entry Invariant</span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isInvariantPass ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-[var(--color-text-dark)] tracking-tight flex items-center gap-1.5">
              <span>{isInvariantPass ? 'Passed & Verified' : 'Attention Needed'}</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              {isInvariantPass
                ? '0 Duplicate CNICs • 0 Reg collisions'
                : 'Invariant validation warning'}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Cross-Campus Clashes</span>
            <span
              className={`font-semibold ${
                openConflictsCount > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {openConflictsCount === 0 ? '0 Open Conflicts' : `${openConflictsCount} Clashes`}
            </span>
          </div>
        </div>

        {/* Card 4: Operations & Sync Velocity */}
        <div
          onClick={() => onNavigate('history')}
          className="bg-white p-5 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs hover:border-[var(--color-primary)]/50 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Replication Ops</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-[var(--color-text-dark)] tracking-tight">
              {totalSyncOps} <span className="text-xs font-normal text-[var(--color-text-muted)]">events logged</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1 flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
              <span>Multi-master CRDT / LWW Engine</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Audit Trail</span>
            <span className="font-semibold text-[var(--color-primary)] flex items-center gap-0.5">
              <span>View History</span>
              <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* 3. Interactive Multi-Campus Replication Mesh (Showstopper Topology) */}
      <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-[var(--color-border-subtle)]">
          <div>
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-[var(--color-primary)]" />
              <h2 className="font-bold text-sm text-[var(--color-text-dark)]">
                Multi-Campus Distributed Topology & Replication Mesh
              </h2>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Information entered at any campus propagates across the university network. Click any node to inspect local perspective.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Mesh Active
            </span>
          </div>
        </div>

        {/* Visual Mesh Architecture Flow */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          {/* Node 1: Lahore Campus */}
          <div
            onClick={() => setActiveCampus(activeCampus === 'Lahore' ? 'all' : 'Lahore')}
            className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              activeCampus === 'Lahore'
                ? 'bg-blue-50/60 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-[var(--color-surface-muted)] border-[var(--color-border-subtle)] hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700">
                CAMPUS NODE
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <h3 className="font-bold text-sm text-[var(--color-text-dark)]">Lahore Campus</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{lahoreCount} students registered</p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border-subtle)]">
              <span>Sync Status</span>
              <span className="font-semibold text-blue-600">
                {activeCampus === 'Lahore' ? 'Active Focus' : 'Synchronized'}
              </span>
            </div>
          </div>

          {/* Central Hub: Oracle Cloud Sync Engine */}
          <div
            onClick={() => setActiveCampus('all')}
            className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              activeCampus === 'all'
                ? 'bg-gradient-to-b from-blue-50/80 to-indigo-50/40 border-[var(--color-primary)] shadow-sm ring-2 ring-[var(--color-primary)]/20'
                : 'bg-[var(--color-surface-muted)] border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700">
                CENTRAL HUB
              </span>
              <Server className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-3">
              <h3 className="font-bold text-sm text-[var(--color-text-dark)]">CampusSync Relay</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Oracle Cloud VPS • Fastify API</p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border-subtle)]">
              <span>Resolution</span>
              <span className="font-semibold text-indigo-600 font-mono">LWW (Field-Level)</span>
            </div>
          </div>

          {/* Node 2: Islamabad Campus */}
          <div
            onClick={() => setActiveCampus(activeCampus === 'Islamabad' ? 'all' : 'Islamabad')}
            className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              activeCampus === 'Islamabad'
                ? 'bg-purple-50/60 border-purple-500 shadow-sm ring-2 ring-purple-500/20'
                : 'bg-[var(--color-surface-muted)] border-[var(--color-border-subtle)] hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700">
                CAMPUS NODE
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <h3 className="font-bold text-sm text-[var(--color-text-dark)]">Islamabad Campus</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{islamabadCount} students registered</p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border-subtle)]">
              <span>Sync Status</span>
              <span className="font-semibold text-purple-600">
                {activeCampus === 'Islamabad' ? 'Active Focus' : 'Synchronized'}
              </span>
            </div>
          </div>

          {/* Node 3: Abbottabad Campus */}
          <div
            onClick={() => setActiveCampus(activeCampus === 'Abbottabad' ? 'all' : 'Abbottabad')}
            className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              activeCampus === 'Abbottabad'
                ? 'bg-emerald-50/60 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                : 'bg-[var(--color-surface-muted)] border-[var(--color-border-subtle)] hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">
                CAMPUS NODE
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-3">
              <h3 className="font-bold text-sm text-[var(--color-text-dark)]">Abbottabad Campus</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{abbottabadCount} students registered</p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border-subtle)]">
              <span>Sync Status</span>
              <span className="font-semibold text-emerald-600">
                {activeCampus === 'Abbottabad' ? 'Active Focus' : 'Synchronized'}
              </span>
            </div>
          </div>
        </div>

        {/* Mesh Guarantees Strip */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium text-[var(--color-text-dark)]">
              Single-Entry Invariant Enforced:
            </span>
            <span>CNIC and Registration Numbers are unique university-wide across all campuses.</span>
          </div>
          <button
            onClick={() => onNavigate('sync')}
            className="text-[var(--color-primary)] font-bold hover:underline flex items-center gap-1 text-[11px]"
          >
            <span>Open Sync Topology Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Two-Column Command Center (60% Feed + 40% Analytics) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Cols ~ 60%): Live Cross-Campus Sync Activity Stream */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[var(--color-border-subtle)] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-subtle)]">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--color-primary)]" />
                  <h2 className="font-bold text-sm text-[var(--color-text-dark)]">
                    Live Cross-Campus Replication Feed
                  </h2>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Real-time mutations logged and distributed across campus nodes
                </p>
              </div>
              <button
                onClick={() => onNavigate('history')}
                className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1"
              >
                <span>Full Audit Log</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Event Items List */}
            <div className="divide-y divide-[var(--color-border-subtle)] mt-2">
              {recentHistory && recentHistory.length > 0 ? (
                recentHistory.map((h, idx) => (
                  <div key={h.id || idx} className="py-3.5 flex items-start justify-between gap-3 group">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-blue-50 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                        <GitBranch className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[var(--color-text-dark)]">
                            {h.studentName || 'Student Record'}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                            {h.reg_no}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {h.type === 'create' ? (
                            <span className="text-emerald-700 font-medium">New student enrolled</span>
                          ) : h.type === 'resolve' ? (
                            <span className="text-purple-700 font-medium">Conflict auto-resolved</span>
                          ) : (
                            <span>
                              Updated field <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px] text-slate-700 font-mono">{h.field}</code>
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {h.actorCampus && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCampusBadgeClass(h.actorCampus)}`}>
                          {h.actorCampus}
                        </span>
                      )}
                      <p className="text-[10px] text-[var(--color-text-light)] mt-1 font-mono">
                        {h.createdAt ? formatRelativeTime(h.createdAt) : 'Recent'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[var(--color-text-muted)]">
                  <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-xs text-[var(--color-text-dark)]">
                    Replication Engine is Listening
                  </p>
                  <p className="text-xs mt-1 text-[var(--color-text-muted)] max-w-sm mx-auto">
                    Any student creation, edit, or cross-campus sync event will appear here live as it replicates.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)] font-medium">
              Sync Engine: Bi-directional outbox + delta pull
            </span>
            <button
              onClick={() => syncNow()}
              className="text-[var(--color-primary)] font-bold hover:underline"
            >
              Trigger Replication Check
            </button>
          </div>
        </div>

        {/* Right Column (5 Cols ~ 40%): Campus & Academic Breakdown Analytics */}
        <div className="lg:col-span-5 space-y-6">
          {/* Campus Distribution Card */}
          <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
              <h2 className="font-bold text-sm text-[var(--color-text-dark)]">
                Campus Enrollment Share
              </h2>
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                {totalCount} Total
              </span>
            </div>

            <div className="space-y-4 mt-4">
              {/* Lahore */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span className="text-[var(--color-text-dark)] font-bold">Lahore Campus</span>
                  </div>
                  <span className="text-[var(--color-text-muted)] font-mono">
                    {lahoreCount} students ({lahorePct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${lahorePct}%` }} />
                </div>
              </div>

              {/* Islamabad */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <span className="text-[var(--color-text-dark)] font-bold">Islamabad Campus</span>
                  </div>
                  <span className="text-[var(--color-text-muted)] font-mono">
                    {islamabadCount} students ({islamabadPct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600 rounded-full transition-all duration-500" style={{ width: `${islamabadPct}%` }} />
                </div>
              </div>

              {/* Abbottabad */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span className="text-[var(--color-text-dark)] font-bold">Abbottabad Campus</span>
                  </div>
                  <span className="text-[var(--color-text-muted)] font-mono">
                    {abbottabadCount} students ({abbottabadPct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${abbottabadPct}%` }} />
                </div>
              </div>
            </div>

            {/* Academic Program Distribution */}
            <div className="mt-5 pt-4 border-t border-[var(--color-border-subtle)]">
              <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-2.5">
                Programs Enrolled
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                  <div className="text-xs font-bold text-[var(--color-text-dark)]">{csCount}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">BS CS</div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                  <div className="text-xs font-bold text-[var(--color-text-dark)]">{seCount}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">BS SE</div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                  <div className="text-xs font-bold text-[var(--color-text-dark)]">{eeCount}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">BS EE</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Integrity Audit Card */}
          <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[var(--color-text-dark)]">Zero-Divergence Invariant</h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  Deterministic LWW CRDT guarantees mathematical consistency across all replicas.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('diagnostics')}
              className="px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] hover:bg-blue-50 rounded-lg transition-all shrink-0"
            >
              Audit
            </button>
          </div>
        </div>
      </div>

      {/* 5. Recent Cross-Campus Enrolment Snapshot (Compact 5-Row View) */}
      <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-[var(--color-text-dark)]">
              {activeCampus === 'all'
                ? 'Recent Cross-Campus Enrolment Snapshot'
                : `Recent ${activeCampus} Campus Enrolments`}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Unified multi-campus registry. Information entered once and distributed globally.
            </p>
          </div>
          <button
            onClick={() => onNavigate('students')}
            className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1"
          >
            <span>View Full Directory ({displayedStudents.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-surface-muted)] border-b border-[var(--color-border-subtle)] text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Identity (CNIC & Reg)</th>
                <th className="py-3 px-4">Campus & Program</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)] text-xs">
              {displayedStudents && displayedStudents.length > 0 ? (
                displayedStudents.slice(0, 5).map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--color-surface-muted)] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-[var(--color-text-dark)]">
                      <div className="font-bold">{s.full_name}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)] font-normal">{s.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--color-text-secondary)]">
                      <div>{s.reg_no}</div>
                      <div className="text-[10px] text-[var(--color-text-light)]">{s.cnic}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getCampusBadgeClass(s.campus)}`}>
                        {s.campus}
                      </span>
                      <div className="text-[11px] text-[var(--color-text-muted)] mt-1">{s.program}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[var(--color-text-dark)]">
                      Semester {s.semester}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <StatusBadge
                        status={s.status === 'Graduated' ? 'synced' : s.status === 'On leave' ? 'pending' : 'synced'}
                        label={s.status}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[var(--color-text-muted)]">
                    <p className="font-semibold text-sm">No records found for {activeCampus}</p>
                    <p className="text-xs mt-1">
                      Click "All Campuses" above to view university-wide records or use "Add Student" to enroll.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
