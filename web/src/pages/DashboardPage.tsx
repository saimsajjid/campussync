import React from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Users,
  Building2,
  ArrowRight,
  UserPlus,
  Clock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
  onOpenAddStudent: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenAddStudent }) => {
  const { activeCampus, simulator, currentUser, syncNow, isSyncing } = useApp();

  const students = useLiveQuery(() => {
    if (activeCampus === 'all') {
      return db.students.toArray();
    }
    return db.students.where('campus').equals(activeCampus).toArray();
  }, [activeCampus], []);

  const openConflictsCount = useLiveQuery(
    () => db.conflicts.where('status').equals('open').count(),
    [],
    0
  );

  const pendingOutboxCount = useLiveQuery(
    () => db.outbox.count(),
    [],
    0
  );

  const totalCampusesCount = 3;

  if (!currentUser) return null;

  return (
    <div className="space-y-6 text-left max-w-[1200px] w-full mx-auto">
      {/* Top Banner / Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-dark)] tracking-tight">
            Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={onOpenAddStudent}
              className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-md shadow-[var(--color-primary)]/20 flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-4 h-4" /> Add Student
            </button>
          )}

          <button
            onClick={() => syncNow()}
            disabled={isSyncing}
            className="px-4 py-2 bg-white border border-[var(--color-border-muted)] hover:bg-gray-50 text-[var(--color-text-dark)] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--color-primary)] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Status Summary Row (Design-Spec §6.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Connection State */}
        <div className="bg-white p-5 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Connection State</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  simulator.isOffline ? 'bg-[var(--color-status-danger-red)]' : 'bg-[var(--color-status-success-green)] pulse-green'
                }`}
              />
              <span className="text-lg font-bold text-[var(--color-text-dark)]">
                {simulator.isOffline ? 'Offline' : 'Online'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              {simulator.isOffline ? 'Working offline • Local storage' : 'Connected to server'}
            </p>
          </div>
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              simulator.isOffline ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {simulator.isOffline ? <WifiOff className="w-6 h-6" /> : <Wifi className="w-6 h-6" />}
          </div>
        </div>

        {/* Tile 2: Outbox Pending Mutations */}
        <div
          onClick={() => onNavigate('sync')}
          className={`bg-white p-5 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            pendingOutboxCount > 0
              ? 'border-amber-300 hover:border-amber-400 bg-amber-50/20'
              : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-muted)]'
          }`}
        >
          <div>
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Outbox queue</span>
            <div className="text-lg font-bold text-[var(--color-text-dark)] mt-1">
              {pendingOutboxCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">pending</span>
            </div>
            <p
              className={`text-[11px] font-medium mt-1 flex items-center gap-1 ${
                pendingOutboxCount > 0 ? 'text-amber-700' : 'text-[var(--color-text-muted)]'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>
                {pendingOutboxCount > 0 ? 'Unsent local edits' : 'All changes are saved to the server'}
              </span>
            </p>
          </div>
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              pendingOutboxCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <RefreshCw className="w-6 h-6" />
          </div>
        </div>

        {/* Tile 3: Open Conflicts */}
        <div
          onClick={() => onNavigate('conflicts')}
          className={`bg-white p-5 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            openConflictsCount > 0
              ? 'border-[var(--color-status-conflict-border)] hover:border-[var(--color-status-conflict-text)] bg-[var(--color-status-conflict-bg)]/30'
              : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-muted)]'
          }`}
        >
          <div>
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Needs attention</span>
            <div className="text-lg font-bold text-[var(--color-text-dark)] mt-1">
              {openConflictsCount}{' '}
              <span className="text-xs font-normal text-[var(--color-text-muted)]">
                {openConflictsCount === 1 ? 'conflict' : 'conflicts'}
              </span>
            </div>
            <p
              className={`text-[11px] font-medium mt-1 flex items-center gap-1 ${
                openConflictsCount > 0 ? 'text-[var(--color-status-conflict-text)]' : 'text-[var(--color-text-muted)]'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>
                {openConflictsCount > 0
                  ? `${openConflictsCount} field ${openConflictsCount === 1 ? 'clash' : 'clashes'}`
                  : 'Zero open conflicts'}
              </span>
            </p>
          </div>
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              openConflictsCount > 0
                ? 'bg-[var(--color-status-conflict-bg)] text-[var(--color-status-conflict-text)]'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Tile 4: Total Student Records */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs flex items-center justify-between cursor-pointer hover:border-[var(--color-primary)]/50 transition-all"
        >
          <div>
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Total Shared Records</span>
            <div className="text-lg font-bold text-[var(--color-text-dark)] mt-1">
              {students?.length || 0} <span className="text-xs font-normal text-[var(--color-text-muted)]">enrolled</span>
            </div>
            <p className="text-[11px] text-[var(--color-primary)] font-medium mt-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Across {totalCampusesCount} Campuses
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[var(--color-primary)] flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Student Directory Snapshot */}
      <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-[var(--color-text-dark)]">Student Records</h2>
          </div>
          <button
            onClick={() => onNavigate('students')}
            className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-surface-muted)] border-b border-[var(--color-border-subtle)] text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Reg No / CNIC</th>
                <th className="py-3 px-4">Campus & Program</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)] text-xs">
              {students && students.length > 0 ? (
                students.slice(0, 5).map((s) => (
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
                      <span className="font-semibold text-[var(--color-text-dark)]">{s.campus}</span>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{s.program}</div>
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
                    <p className="font-semibold text-sm">Zero records in database</p>
                    <p className="text-xs mt-1">Database is completely fresh. Use "Add Student" above to register your first record.</p>
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
