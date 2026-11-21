import React, { useState, useMemo } from 'react';
import {
  RefreshCw,
  Users,
  Search,
  ArrowRight,
  UserPlus,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { StudentRecord } from '../types';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
  onOpenAddStudent: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenAddStudent }) => {
  const {
    activeCampus,
    currentUser,
    syncNow,
    isSyncing
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all students
  const allStudents = useLiveQuery(() => db.students.toArray(), [], []) as StudentRecord[];

  // Recent change history entries
  const recentHistory = useLiveQuery(
    async () => {
      const items = await db.history.toArray();
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return items.slice(0, 4);
    },
    [],
    []
  );

  // Scope students for faculty or active campus
  const facultyCampus = currentUser?.role === 'faculty' ? currentUser?.campus : null;
  const baseStudents = useMemo(() => {
    if (!allStudents) return [];
    if (facultyCampus) {
      return allStudents.filter((s) => s.campus === facultyCampus);
    }
    return allStudents;
  }, [allStudents, facultyCampus]);

  const campusStudents = useMemo(() => {
    if (!facultyCampus && activeCampus !== 'all') {
      return baseStudents.filter((s) => s.campus === activeCampus);
    }
    return baseStudents;
  }, [baseStudents, facultyCampus, activeCampus]);

  // Filter students based on active campus and search query
  const filteredStudents = useMemo(() => {
    let list = campusStudents;

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
  }, [campusStudents, searchQuery]);

  // Key Counts
  const totalCount = campusStudents.length;
  const activeCount = campusStudents.filter((s) => s.status === 'Active').length;
  const leaveCount = campusStudents.filter((s) => s.status === 'On leave').length;
  const graduatedCount = campusStudents.filter((s) => s.status === 'Graduated').length;

  const lahoreCount = baseStudents.filter((s) => s.campus === 'Lahore').length;
  const islamabadCount = baseStudents.filter((s) => s.campus === 'Islamabad').length;
  const abbottabadCount = baseStudents.filter((s) => s.campus === 'Abbottabad').length;

  const totalAllCampuses = baseStudents.length;
  const lahorePct = totalAllCampuses > 0 ? Math.round((lahoreCount / totalAllCampuses) * 100) : 0;
  const islamabadPct = totalAllCampuses > 0 ? Math.round((islamabadCount / totalAllCampuses) * 100) : 0;
  const abbottabadPct = totalAllCampuses > 0 ? Math.round((abbottabadCount / totalAllCampuses) * 100) : 0;

  // Program breakdown for faculty view
  const programBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    campusStudents.forEach((s) => {
      const prog = s.program || 'Other';
      counts[prog] = (counts[prog] || 0) + 1;
    });
    return Object.entries(counts).map(([program, count]) => ({
      program,
      count,
      pct: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    }));
  }, [campusStudents, totalCount]);

  // Recently added students fallback if change history is empty
  const recentlyAdded = useMemo(() => {
    if (!allStudents) return [];
    return [...allStudents]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 4);
  }, [allStudents]);

  if (!currentUser) return null;

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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentUser.role === 'faculty'
              ? `${currentUser.campus || 'Campus'} branch student roster and academic records.`
              : 'Student records and cross-campus sync status.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={onOpenAddStudent}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Student</span>
            </button>
          )}

          <button
            onClick={() => syncNow()}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* 2 Clean Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Total Enrolled */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {activeCampus === 'all' || facultyCampus ? 'Total Students' : `${activeCampus} Students`}
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {totalCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {facultyCampus
              ? `${facultyCampus} branch verified roster`
              : activeCampus === 'all'
              ? 'Enrolled across all university branches'
              : `${activeCampus} branch verified roster`}
          </p>
        </div>

        {/* Card 2: Student Status */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Student Status</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {activeCount} <span className="text-xs font-normal text-slate-500">Active</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {leaveCount} On leave • {graduatedCount} Graduated
          </p>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Searchable Student Roster */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            {/* Table Header with Search */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-sm text-slate-900">
                  Student Directory
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredStudents.length} of {totalCount} total students
                  {facultyCampus ? ` in ${facultyCampus}` : activeCampus !== 'all' ? ` in ${activeCampus}` : ''}
                </p>
              </div>

              {/* Instant Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, CNIC, reg..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Identity</th>
                    <th className="py-3 px-4">Campus & Program</th>
                    <th className="py-3 px-4">Semester</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.slice(0, 6).map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          <div className="font-semibold text-slate-900">{s.full_name}</div>
                          <div className="text-[11px] text-slate-500 font-normal">{s.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                          <div>{s.reg_no}</div>
                          <div className="text-[10px] text-slate-400">{s.cnic}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                            {s.campus}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1">{s.program}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          Semester {s.semester}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                s.status === 'Active'
                                  ? 'bg-emerald-500'
                                  : s.status === 'On leave'
                                  ? 'bg-amber-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                            <span>{s.status}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        <p className="font-semibold text-xs text-slate-700">No students match your search</p>
                        <p className="text-[11px] mt-0.5 text-slate-400">Try searching for a different name, CNIC, or campus.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table Footer */}
          <div className="p-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Showing top {Math.min(filteredStudents.length, 6)} records
            </span>
            <button
              onClick={() => onNavigate('students')}
              className="font-semibold text-slate-800 hover:text-slate-900 hover:underline flex items-center gap-1"
            >
              <span>Open Full Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (4 cols): Campus Enrollment Share & Recent Activity */}
        <div className="lg:col-span-4 space-y-6">
          {/* Breakdown Card: Program Breakdown for Faculty, Campus Breakdown for Admin */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            {facultyCampus ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h2 className="font-semibold text-sm text-slate-900">
                    Program Enrollment
                  </h2>
                  <span className="text-xs text-slate-500 font-mono">
                    {totalCount} total
                  </span>
                </div>

                <div className="space-y-3.5 mt-4">
                  {programBreakdown.map((item) => (
                    <div key={item.program}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-700">{item.program}</span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {item.count} student{item.count !== 1 ? 's' : ''} ({item.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-800 rounded-full transition-all duration-300"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h2 className="font-semibold text-sm text-slate-900">
                    Campus Enrollment
                  </h2>
                  <span className="text-xs text-slate-500 font-mono">
                    {totalAllCampuses} total
                  </span>
                </div>

                <div className="space-y-3.5 mt-4">
                  {/* Lahore */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">Lahore</span>
                      <span className="text-slate-500 font-mono text-[11px]">{lahoreCount} students ({lahorePct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-800 rounded-full transition-all duration-300" style={{ width: `${lahorePct}%` }} />
                    </div>
                  </div>

                  {/* Islamabad */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">Islamabad</span>
                      <span className="text-slate-500 font-mono text-[11px]">{islamabadCount} students ({islamabadPct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-800 rounded-full transition-all duration-300" style={{ width: `${islamabadPct}%` }} />
                    </div>
                  </div>

                  {/* Abbottabad */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">Abbottabad</span>
                      <span className="text-slate-500 font-mono text-[11px]">{abbottabadCount} students ({abbottabadPct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-800 rounded-full transition-all duration-300" style={{ width: `${abbottabadPct}%` }} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Recent Updates Feed */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <h2 className="font-semibold text-sm text-slate-900">
                  Recent Activity
                </h2>
              </div>
              <button
                onClick={() => onNavigate('history')}
                className="text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs mt-1">
              {recentHistory && recentHistory.length > 0 ? (
                recentHistory.map((h, i) => (
                  <div key={h.id || i} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {h.studentName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {h.type === 'create'
                          ? 'Enrolled'
                          : h.type === 'resolve'
                          ? 'Conflict resolved'
                          : `Updated ${h.field}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                        {h.actorCampus || 'Central'}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {formatRelativeTime(h.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                recentlyAdded.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {s.full_name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {s.program} • Semester {s.semester}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                        {s.campus}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {formatRelativeTime(s.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
