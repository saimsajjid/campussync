import React from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Users,
  Building2,
  GraduationCap,
  ArrowRight,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
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

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner / Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] tracking-tight">
            Multi-Campus Sync Dashboard
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Challenge HS-0146: Real-time conflict resolution, offline outbox, and proven data consistency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={onOpenAddStudent}
              className="px-4 py-2 bg-[#4F7DF3] hover:bg-[#3E6AE1] text-white text-xs font-bold rounded-xl shadow-md shadow-[#4F7DF3]/20 flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-4 h-4" /> Add Student
            </button>
          )}

          <button
            onClick={() => syncNow()}
            disabled={isSyncing}
            className="px-4 py-2 bg-white border border-[#CBD5E1] hover:bg-gray-50 text-[#1E293B] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#4F7DF3] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Status Summary Row (Design-Spec §6.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Connection State */}
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#6B7280]">Connection State</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  simulator.isOffline ? 'bg-[#EF4444]' : 'bg-[#22C55E] pulse-green'
                }`}
              />
              <span className="text-lg font-bold text-[#1E293B]">
                {simulator.isOffline ? 'Offline Mode' : 'Online / Live'}
              </span>
            </div>
            <p className="text-[11px] text-[#6B7280] mt-1">
              {simulator.isOffline ? 'Local IndexedDB active' : 'Connected to Fastify'}
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
          className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#F59E0B]/50 transition-all"
        >
          <div>
            <span className="text-xs font-semibold text-[#6B7280]">Outbox Queue</span>
            <div className="text-lg font-bold text-[#1E293B] mt-1">
              {pendingOutboxCount} <span className="text-xs font-normal text-[#6B7280]">pending</span>
            </div>
            <p className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Unsent local edits
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <RefreshCw className="w-6 h-6" />
          </div>
        </div>

        {/* Tile 3: Open Conflicts */}
        <div
          onClick={() => onNavigate('conflicts')}
          className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#EF4444]/50 transition-all"
        >
          <div>
            <span className="text-xs font-semibold text-[#6B7280]">Needs Attention</span>
            <div className="text-lg font-bold text-[#1E293B] mt-1">
              {openConflictsCount} <span className="text-xs font-normal text-[#6B7280]">conflicts</span>
            </div>
            <p className="text-[11px] text-red-700 font-medium mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Field-level clashing
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Tile 4: Total Student Records */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between cursor-pointer hover:border-[#4F7DF3]/50 transition-all"
        >
          <div>
            <span className="text-xs font-semibold text-[#6B7280]">Total Shared Records</span>
            <div className="text-lg font-bold text-[#1E293B] mt-1">
              {students?.length || 0} <span className="text-xs font-normal text-[#6B7280]">enrolled</span>
            </div>
            <p className="text-[11px] text-[#4F7DF3] font-medium mt-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Across {totalCampusesCount} Campuses
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#4F7DF3] flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Student Directory Snapshot & Quick Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Student Table Snapshot */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden">
          <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-[#1E293B]">Multi-Campus Records Directory</h2>
              <p className="text-xs text-[#6B7280]">
                Single Source of Truth with Field-Level Versioning
              </p>
            </div>
            <button
              onClick={() => onNavigate('students')}
              className="text-xs font-bold text-[#4F7DF3] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Reg No / CNIC</th>
                  <th className="py-3 px-4">Campus & Program</th>
                  <th className="py-3 px-4">Semester</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-xs">
                {students?.slice(0, 5).map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-[#1E293B]">
                      <div className="font-bold">{s.full_name}</div>
                      <div className="text-[11px] text-[#6B7280] font-normal">{s.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#475569]">
                      <div>{s.reg_no}</div>
                      <div className="text-[10px] text-[#94A3B8]">{s.cnic}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-[#1E293B]">{s.campus}</span>
                      <div className="text-[11px] text-[#6B7280]">{s.program}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#1E293B]">
                      Sem {s.semester}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <StatusBadge
                        status={s.status === 'Graduated' ? 'synced' : s.status === 'On leave' ? 'pending' : 'synced'}
                        label={s.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Invariant Checks & Quick Info */}
        <div className="space-y-6">
          {/* Invariant Health Card */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-[#1E293B]">Correctness Guarantees</h3>
            </div>
            <p className="text-xs text-[#6B7280] leading-relaxed mb-4">
              CampusSync enforces 7 strict SQL invariants ensuring that no offline sync or network replay corrupts academic records.
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
                <span className="font-medium text-[#1E293B]">CNIC & RegNo Unique</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Enforced
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
                <span className="font-medium text-[#1E293B]">Idempotent opId Replay</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Guaranteed
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
                <span className="font-medium text-[#1E293B]">Append-Only Audit History</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Immutable
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('integrity')}
              className="w-full mt-4 py-2 bg-[#EBF0FF] hover:bg-[#DBEAFE] text-[#4F7DF3] rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Run SQL Integrity Suite</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Architecture Note */}
          <div className="bg-linear-to-br from-[#EBF0FF] to-[#DBEAFE] rounded-2xl p-5 text-left border border-[#BFDBFE]">
            <div className="flex items-center gap-2 mb-1.5">
              <GraduationCap className="w-5 h-5 text-[#1D4ED8]" />
              <h4 className="font-bold text-sm text-[#1E3A8A]">Build for Campus 2026</h4>
            </div>
            <p className="text-xs text-[#1E40AF] leading-relaxed">
              <strong>Team CrackHacks</strong> • Challenge HS-0146
              <br />
              Offline-first PWA backed by PostgreSQL 16 row locks and Fastify schema validation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
