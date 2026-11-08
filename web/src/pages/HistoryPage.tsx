import React, { useState } from 'react';
import {
  History,
  RotateCcw,
  ArrowRight,
  Building2,
  Filter,
  CheckCircle2,
  UserCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { HistoryItem, StudentRecord } from '../types';

interface HistoryPageProps {
  initialStudentId?: string;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ initialStudentId }) => {
  const { currentUser, addToast } = useApp();
  const [filterType, setFilterType] = useState<string>('all');

  const historyEntries = useLiveQuery(async () => {
    let query = db.history.toCollection();
    if (initialStudentId) {
      query = db.history.where('studentId').equals(initialStudentId);
    }
    const all = await query.reverse().sortBy('id');

    if (filterType !== 'all') {
      return all.filter((h) => h.type === filterType);
    }
    return all;
  }, [initialStudentId, filterType]);

  const handleRestore = async (entry: HistoryItem) => {
    if (currentUser.role !== 'admin') {
      addToast('Permission denied: Only Admin accounts can execute state rollbacks.', 'danger');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to restore "${entry.field}" on ${entry.studentName} back to "${String(
          entry.oldValue
        )}"? This appends a new RESTORE entry to preserve append-only invariants.`
      )
    ) {
      return;
    }

    const student = await db.students.get(entry.studentId);
    if (!student) return;

    const newFieldVersions = {
      ...student.field_versions,
      [entry.field]: (student.field_versions[entry.field] || entry.fieldVersionAfter) + 1,
    };

    const updatedStudent: StudentRecord = {
      ...student,
      [entry.field]: entry.oldValue,
      field_versions: newFieldVersions,
      version: student.version + 1,
      updated_at: new Date().toISOString(),
      last_editor_id: currentUser.name + ' (Restore)',
    };

    await db.students.put(updatedStudent);

    // Append new RESTORE row (never delete or mutate history)
    await db.history.add({
      id: Date.now(),
      studentId: student.id,
      studentName: student.full_name,
      reg_no: student.reg_no,
      field: entry.field,
      oldValue: entry.newValue,
      newValue: entry.oldValue,
      fieldVersionAfter: newFieldVersions[entry.field],
      type: 'restore',
      actorName: currentUser.name,
      actorRole: currentUser.role,
      actorCampus: student.campus,
      device: 'Admin Terminal',
      opId: 'op-rest-' + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString(),
    });

    addToast(`Restored ${entry.studentName}'s ${entry.field} back to previous value`, 'success');
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-[#4F7DF3]" />
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] tracking-tight">
              Append-Only Change History
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            FR-9: Immutable event log driving pull replication cursor. Guaranteed zero silent overwrites.
          </p>
        </div>

        {/* Filter by Event Type */}
        <div className="flex items-center gap-2 bg-white border border-[#CBD5E1] rounded-xl px-3 py-1.5 shadow-xs">
          <Filter className="w-3.5 h-3.5 text-[#6B7280]" />
          <span className="text-xs font-semibold text-[#6B7280]">Event Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs font-bold text-[#1E293B] bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="all">All Events</option>
            <option value="edit">Field Edits</option>
            <option value="resolve">Conflict Resolutions</option>
            <option value="restore">Admin Restores</option>
            <option value="create">New Registrations</option>
          </select>
        </div>
      </div>

      {/* History Timeline Cards */}
      <div className="space-y-3">
        {historyEntries && historyEntries.length > 0 ? (
          historyEntries.map((entry) => {
            const isRestore = entry.type === 'restore';
            const isResolve = entry.type === 'resolve';
            const isCreate = entry.type === 'create';

            return (
              <div
                key={entry.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-xs hover:border-[#CBD5E1] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Event Type, Student & Diff */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#6B7280] bg-[#F1F5F9] px-2 py-0.5 rounded">
                      #{entry.id}
                    </span>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isRestore
                          ? 'bg-[#FFEDD5] text-[#9A3412] border border-[#FED7AA]'
                          : isResolve
                          ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                          : isCreate
                          ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                          : 'bg-[#EBF0FF] text-[#1D4ED8] border border-[#BFDBFE]'
                      }`}
                    >
                      {entry.type}
                    </span>

                    <span className="font-bold text-sm text-[#1E293B]">
                      {entry.studentName}
                    </span>
                    <span className="text-xs font-mono text-[#64748B]">({entry.reg_no})</span>
                  </div>

                  {/* Field Diff Line */}
                  <div className="text-xs flex flex-wrap items-center gap-2 pt-1">
                    <span className="font-bold text-[#1E293B] bg-gray-100 px-1.5 py-0.5 rounded">
                      {entry.field}
                    </span>
                    {entry.oldValue !== null && entry.oldValue !== undefined && (
                      <>
                        <span className="text-red-700 line-through bg-red-50 px-1.5 py-0.5 rounded">
                          {String(entry.oldValue)}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8]" />
                      </>
                    )}
                    <span className="text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                      {String(entry.newValue)}
                    </span>
                  </div>
                </div>

                {/* Right: Meta & Restore Button */}
                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 text-xs text-[#6B7280]">
                  <div className="text-right space-y-0.5">
                    <div className="font-semibold text-[#1E293B] flex items-center gap-1 justify-end">
                      <UserCheck className="w-3.5 h-3.5 text-[#4F7DF3]" />
                      <span>{entry.actorName}</span>
                    </div>
                    <div className="text-[11px] text-[#6B7280] flex items-center gap-1 justify-end">
                      <Building2 className="w-3 h-3 text-[#64748B]" />
                      <span>{entry.actorCampus}</span>
                      <span>•</span>
                      <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Restore Button (Admin Only) */}
                  {currentUser.role === 'admin' && entry.oldValue !== null && (
                    <button
                      onClick={() => handleRestore(entry)}
                      className="px-3 py-1.5 bg-[#F8FAFC] hover:bg-[#EBF0FF] text-[#475569] hover:text-[#4F7DF3] border border-[#CBD5E1] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0"
                      title="Roll back field to this historical value"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center text-[#6B7280]">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="font-semibold">No audit history entries found for the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};
