import React, { useState, useMemo } from 'react';
import {
  RefreshCw,
  Users,
  Search,
  ArrowRight,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Clock,
  History,
  ShieldCheck,
  ChevronRight
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
    simulator,
    currentUser,
    syncNow,
    isSyncing
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all students
  const allStudents = useLiveQuery(() => db.students.toArray(), [], []) as StudentRecord[];

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
    () => db.history.reverse().limit(4).toArray(),
    [],
    []
  );

  // Filter students based on active campus and search query
  const filteredStudents = useMemo(() => {
    if (!allStudents) return [];
    let list = allStudents;

    if (activeCampus !== 'all') {
      list = list.filter((s) => s.campus === activeCampus);
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.reg_no.toLowerCase().includes(q) ||
          s.cnic.includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.campus.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allStudents, activeCampus, searchQuery]);

  // Key Counts
  const totalCount = allStudents.length;
  const activeCount = allStudents.filter((s) => s.status === 'Active').length;
  const leaveCount = allStudents.filter((s) => s.status === 'On leave').length;
  const graduatedCount = allStudents.filter((s) => s.status === 'Graduated').length;

  const lahoreCount = allStudents.filter((s) => s.campus === 'Lahore').length;
  const islamabadCount = allStudents.filter((s) => s.campus === 'Islamabad').length;
  const abbottabadCount = allStudents.filter((s) => s.campus === 'Abbottabad').length;

  const lahorePct = totalCount > 0 ? Math.round((lahoreCount / totalCount) * 100) : 0;
  const islamabadPct = totalCount > 0 ? Math.round((islamabadCount / totalCount) * 100) : 0;
  const abbottabadPct = totalCount > 0 ? Math.round((abbottabadCount / totalCount) * 100) : 0;

  const csCount = allStudents.filter((s) => s.program === 'BS CS').length;
  const seCount = allStudents.filter((s) => s.program === 'BS SE').length;
  const eeCount = allStudents.filter((s) => s.program === 'BS EE').length;

  // Recently added students fallback if change history is empty
  const recentlyAdded = useMemo(() => {
    if (!allStudents) return [];
    return [...allStudents]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 4);
  }, [allStudents]);

  if (!currentUser) return null;

  const getCampusBadgeClass = (campus: string) => {
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

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-dark)] tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Overview of student records and cross-campus sync status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={onOpenAddStudent}
              className="px-3.5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Student</span>
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

      {/* 4 Clean Metric Cards (One Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Enrolled */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs hover:border-[var(--color-primary)]/50 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Total Students</span>
            <Users className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-dark)] mt-2">
            {totalCount}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Lahore ({lahoreCount}) • Islamabad ({islamabadCount}) • Abbottabad ({abbottabadCount})
          </p>
        </div>

        {/* Card 2: Student Status */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs hover:border-[var(--color-primary)]/50 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Enrollment Status</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-dark)] mt-2">
            {activeCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">Active</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            {leaveCount} On leave • {graduatedCount} Graduated
          </p>
        </div>

        {/* Card 3: Programs */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs hover:border-[var(--color-primary)]/50 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Programs</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-dark)] mt-2">
            3 <span className="text-xs font-normal text-[var(--color-text-muted)]">Degrees</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 font-mono">
            {csCount} CS • {seCount} SE • {eeCount} EE
          </p>
        </div>

        {/* Card 4: Synchronization State */}
        <div
          onClick={() => onNavigate(openConflictsCount > 0 ? 'conflicts' : 'sync')}
          className={`bg-white p-5 rounded-2xl border shadow-xs cursor-pointer transition-all ${
            openConflictsCount > 0
              ? 'border-amber-300 hover:border-amber-400 bg-amber-50/20'
              : 'border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Sync & Data Health</span>
            {openConflictsCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            )}
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-dark)] mt-2 flex items-center gap-1.5">
            <span>
              {simulator.isOffline
                ? 'Offline'
                : openConflictsCount > 0
                ? `${openConflictsCount} Conflict${openConflictsCount > 1 ? 's' : ''}`
                : 'In Sync'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            {simulator.isOffline
              ? `${pendingOutboxCount} edits queued locally`
              : openConflictsCount > 0
              ? 'Click to resolve open conflicts'
              : pendingOutboxCount > 0
              ? `${pendingOutboxCount} pending sync`
              : 'All 3 campuses synchronized'}
          </p>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Searchable Student Roster */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[var(--color-border-subtle)] shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            {/* Table Header with Search */}
            <div className="p-4 sm:p-5 border-b border-[var(--color-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-sm text-[var(--color-text-dark)]">
                  Student Directory
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Showing {filteredStudents.length} of {totalCount} total students
                  {activeCampus !== 'all' ? ` in ${activeCampus}` : ''}
                </p>
              </div>

              {/* Instant Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, CNIC, reg..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--color-surface-bg)] border border-[var(--color-border-subtle)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-all"
                />
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--color-surface-muted)] border-b border-[var(--color-border-subtle)] text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Identity</th>
                    <th className="py-3 px-4">Campus & Program</th>
                    <th className="py-3 px-4">Semester</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)] text-xs">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.slice(0, 6).map((s) => (
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
                      <td colSpan={5} className="py-8 text-center text-[var(--color-text-muted)]">
                        <p className="font-semibold text-xs">No students match your search</p>
                        <p className="text-[11px] mt-0.5">Try searching for a different name, CNIC, or campus.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table Footer */}
          <div className="p-3.5 bg-[var(--color-surface-muted)] border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">
              Showing top {Math.min(filteredStudents.length, 6)} records
            </span>
            <button
              onClick={() => onNavigate('students')}
              className="font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1"
            >
              <span>Open Full Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (4 cols): Campus Enrollment Share & Recent Activity */}
        <div className="lg:col-span-4 space-y-6">
          {/* Campus Breakdown Card */}
          <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
              <h2 className="font-bold text-sm text-[var(--color-text-dark)]">
                Campus Enrollment
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">
                {totalCount} total
              </span>
            </div>

            <div className="space-y-3.5 mt-4">
              {/* Lahore */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-[var(--color-text-dark)]">Lahore</span>
                  <span className="text-[var(--color-text-muted)] font-mono">{lahoreCount} ({lahorePct}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${lahorePct}%` }} />
                </div>
              </div>

              {/* Islamabad */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-[var(--color-text-dark)]">Islamabad</span>
                  <span className="text-[var(--color-text-muted)] font-mono">{islamabadCount} ({islamabadPct}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600 rounded-full" style={{ width: `${islamabadPct}%` }} />
                </div>
              </div>

              {/* Abbottabad */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-[var(--color-text-dark)]">Abbottabad</span>
                  <span className="text-[var(--color-text-muted)] font-mono">{abbottabadCount} ({abbottabadPct}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${abbottabadPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Updates Feed */}
          <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                <h2 className="font-bold text-sm text-[var(--color-text-dark)]">
                  Recent Activity
                </h2>
              </div>
              <button
                onClick={() => onNavigate('history')}
                className="text-[11px] font-bold text-[var(--color-primary)] hover:underline"
              >
                View all
              </button>
            </div>

            <div className="divide-y divide-[var(--color-border-subtle)] text-xs mt-1">
              {recentHistory && recentHistory.length > 0 ? (
                recentHistory.map((h, i) => (
                  <div key={h.id || i} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-text-dark)] truncate">
                        {h.studentName}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                        {h.type === 'create'
                          ? 'Enrolled'
                          : h.type === 'resolve'
                          ? 'Conflict resolved'
                          : `Updated ${h.field}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getCampusBadgeClass(h.actorCampus)}`}>
                        {h.actorCampus || 'Central'}
                      </span>
                      <p className="text-[10px] text-[var(--color-text-light)] mt-0.5">
                        {formatRelativeTime(h.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                recentlyAdded.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-text-dark)] truncate">
                        {s.full_name}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                        {s.program} • Semester {s.semester}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getCampusBadgeClass(s.campus)}`}>
                        {s.campus}
                      </span>
                      <p className="text-[10px] text-[var(--color-text-light)] mt-0.5">
                        {formatRelativeTime(s.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick System Navigation */}
          <div className="bg-[var(--color-surface-muted)] rounded-2xl border border-[var(--color-border-subtle)] p-4 space-y-2 text-xs">
            <button
              onClick={() => onNavigate('conflicts')}
              className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)] transition-all font-medium text-[var(--color-text-dark)]"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Conflicts & Resolution</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 bg-gray-100 rounded-full font-bold">
                {openConflictsCount}
              </span>
            </button>

            <button
              onClick={() => onNavigate('history')}
              className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)] transition-all font-medium text-[var(--color-text-dark)]"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                <span>Audit Trail & Restore</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => onNavigate('integrity')}
              className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)] transition-all font-medium text-[var(--color-text-dark)]"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Database Integrity Tests</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
