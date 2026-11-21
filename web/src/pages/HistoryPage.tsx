import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  History,
  ArrowRight,
  Building2,
  Filter,
  CheckCircle2,
  UserCheck,
  Clock,
  Calendar,
  Undo2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { HistoryItem, StudentRecord } from '../types';
import { restoreStudentField } from '../services/api';
import { generateUUID } from '../utils/uuid';
import { CustomDropdown } from '../components/CustomDropdown';

interface HistoryPageProps {
  initialStudentId?: string;
}

function formatFullDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} ${month} ${year}, ${time}`;
}

function getDayHeading(dateStr: string | Date): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Other';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - entryDate.getTime()) / (1000 * 3600 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ initialStudentId }) => {
  const { currentUser, addToast } = useApp();
  const [filterType, setFilterType] = useState<string>('all');
  const [restoreEntry, setRestoreEntry] = useState<HistoryItem | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const historyEntries = useLiveQuery(async () => {
    let query = db.history.toCollection();
    if (initialStudentId) {
      query = db.history.where('studentId').equals(initialStudentId);
    }
    let all = await query.toArray();

    // Sort strictly by timestamp descending (newest entries first)
    all.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return Number(b.id || 0) - Number(a.id || 0);
    });

    // Faculty is scoped to their campus activity
    if (currentUser?.role === 'faculty' && currentUser?.campus) {
      all = all.filter((h) => h.actorCampus === currentUser.campus);
    }

    if (filterType !== 'all') {
      return all.filter((h) => h.type === filterType);
    }
    return all;
  }, [initialStudentId, filterType, currentUser]);

  // Group history items by day heading (newest days at top, newest items within day first)
  const groupedEntries = useMemo(() => {
    if (!historyEntries || historyEntries.length === 0) return [];
    const groups: { dayHeading: string; maxTime: number; entries: HistoryItem[] }[] = [];

    historyEntries.forEach((entry) => {
      const heading = getDayHeading(entry.createdAt);
      const entryTime = new Date(entry.createdAt || 0).getTime();
      const existing = groups.find((g) => g.dayHeading === heading);
      if (existing) {
        existing.entries.push(entry);
        if (entryTime > existing.maxTime) {
          existing.maxTime = entryTime;
        }
      } else {
        groups.push({ dayHeading: heading, maxTime: entryTime, entries: [entry] });
      }
    });

    // Explicitly guarantee newest dates at top (Today -> Yesterday -> older dates)
    groups.sort((a, b) => b.maxTime - a.maxTime);

    return groups;
  }, [historyEntries]);

  // Focus Cancel button by default when confirm dialog opens
  useEffect(() => {
    if (restoreEntry) {
      cancelBtnRef.current?.focus();
    }
  }, [restoreEntry]);

  // Close confirm dialog on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && restoreEntry) {
        setRestoreEntry(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [restoreEntry]);

  if (!currentUser) return null;

  const executeRestore = async () => {
    if (!restoreEntry) return;
    const entry = restoreEntry;
    setRestoreEntry(null);

    if (currentUser.role !== 'admin') {
      addToast('Permission denied: Only Admin accounts can execute state rollbacks.', 'danger');
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
      opId: generateUUID(),
      createdAt: new Date().toISOString(),
    });

    try {
      await restoreStudentField(entry.studentId, entry.field, entry.oldValue);
    } catch (e: any) {
      console.warn('Backend restore sync warning:', e.message);
    }

    addToast(`Restored ${entry.studentName}'s ${entry.field} back to previous value`, 'success');
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'edit':
        return { label: 'Edit', class: 'bg-blue-50 text-blue-700 border-blue-200/60' };
      case 'restore':
        return { label: 'Restored', class: 'bg-purple-50 text-purple-700 border-purple-200/60' };
      case 'resolve':
        return { label: 'Resolved', class: 'bg-amber-50 text-amber-700 border-amber-200/60' };
      case 'create':
        return { label: 'New Record', class: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };
      default:
        return { label: type, class: 'bg-slate-100 text-slate-700 border-slate-200/60' };
    }
  };

  return (
    <div className="space-y-6 text-left max-w-[1200px] w-full mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Change History
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Immutable audit trail of record edits, conflict resolutions, and cross-campus sync events.
          </p>
        </div>

        {/* Filter by Event Type */}
        <CustomDropdown
          value={filterType}
          onChange={(val) => setFilterType(val)}
          options={[
            { value: 'all', label: 'All Events' },
            { value: 'edit', label: 'Field Edits' },
            { value: 'resolve', label: 'Conflict Resolutions' },
            { value: 'restore', label: 'Admin Restores' },
            { value: 'create', label: 'New Registrations' },
          ]}
          icon={<Filter className="w-3.5 h-3.5" />}
          labelPrefix="Event:"
          size="sm"
        />
      </div>

      {/* History Timeline Grouped by Day */}
      {groupedEntries && groupedEntries.length > 0 ? (
        <div className="space-y-6">
          {groupedEntries.map((group) => (
            <div key={group.dayHeading} className="space-y-3">
              {/* Day Heading */}
              <div className="flex items-center gap-2 pt-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {group.dayHeading}
                </h2>
                <div className="h-px bg-slate-200/80 flex-1 ml-2" />
              </div>

              {/* Day Entries */}
              <div className="space-y-3">
                {group.entries.map((entry) => {
                  const isCreate = entry.type === 'create';
                  const eventTypeInfo = getEventTypeLabel(entry.type);

                  // Parse create payload if applicable
                  let createSummary = '';
                  if (isCreate) {
                    let parsed: any = null;
                    if (typeof entry.newValue === 'object' && entry.newValue !== null) {
                      parsed = entry.newValue;
                    } else if (typeof entry.newValue === 'string') {
                      try {
                        parsed = JSON.parse(entry.newValue);
                      } catch {}
                    }
                    const summaryName = parsed?.full_name || entry.studentName || 'Student';
                    const summaryReg = parsed?.reg_no || entry.reg_no || '';
                    const summaryCampus = parsed?.campus || entry.actorCampus || '';
                    createSummary = `${summaryName}${summaryReg ? ` (${summaryReg})` : ''} • ${summaryCampus} Campus`;
                  }

                  return (
                    <div
                      key={entry.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Event Type, Student & Diff */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 font-medium">
                            {typeof entry.id === 'number' && entry.id > 1000000000
                              ? `#${String(entry.id).slice(-4)}`
                              : `#${entry.id}`}
                          </span>

                          {entry.isPending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Synced
                            </span>
                          )}

                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${eventTypeInfo.class}`}
                          >
                            {eventTypeInfo.label}
                          </span>

                          <span className="font-semibold text-sm text-slate-900">
                            {entry.studentName}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            ({entry.reg_no})
                          </span>
                        </div>

                        {/* Event Content Line */}
                        {isCreate ? (
                          <div className="text-xs flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="font-medium text-slate-500">Registered:</span>
                            <span className="text-slate-800 font-semibold bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md">
                              {createSummary}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="font-medium text-slate-500 capitalize">
                              {entry.field.replace(/_/g, ' ')}:
                            </span>
                            {entry.oldValue !== null && entry.oldValue !== undefined && (
                              <>
                                <span className="font-mono text-xs text-slate-400 line-through">
                                  {String(entry.oldValue)}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                              </>
                            )}
                            <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md">
                              {String(entry.newValue)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Meta & Restore Button */}
                      <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 text-xs text-slate-500">
                        <div className="text-left md:text-right space-y-0.5">
                          <div className="font-medium text-slate-800 flex items-center gap-1.5 md:justify-end">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span>{entry.actorName}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 md:justify-end">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>{entry.actorCampus} Campus</span>
                            <span>•</span>
                            <span>{formatFullDate(entry.createdAt)}</span>
                          </div>
                        </div>

                        {/* Restore Button (Admin Only, Not for Creates) */}
                        {currentUser.role === 'admin' && !isCreate && entry.oldValue !== null && (
                          <button
                            type="button"
                            onClick={() => setRestoreEntry(entry)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 bg-white hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-200 rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-2xs"
                            title="Roll back field to this historical value"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-500 shadow-xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <p className="font-semibold text-slate-800">No audit history entries found</p>
          <p className="text-xs text-slate-500 mt-1">Changes made to student records will appear in this timeline.</p>
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      {restoreEntry && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200/80 text-left">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Confirm Record Restore
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Roll back <span className="font-semibold text-slate-800">{restoreEntry.field}</span> to historical value <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">{String(restoreEntry.oldValue)}</span> from <span className="font-semibold text-slate-800">{formatFullDate(restoreEntry.createdAt)}</span>?
              <br /><br />
              This appends a new restore entry to the immutable ledger. Nothing is deleted.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => setRestoreEntry(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestore}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Confirm Restore</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
