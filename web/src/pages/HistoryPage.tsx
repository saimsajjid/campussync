import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  History,
  RotateCcw,
  ArrowRight,
  Building2,
  Filter,
  CheckCircle2,
  UserCheck,
  Clock,
  CheckCircle,
  Calendar
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

  if (diffDays === 0) return 'Today';
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
    const all = await query.reverse().sortBy('id');

    if (filterType !== 'all') {
      return all.filter((h) => h.type === filterType);
    }
    return all;
  }, [initialStudentId, filterType]);

  // Group history items by day heading
  const groupedEntries = useMemo(() => {
    if (!historyEntries || historyEntries.length === 0) return [];
    const groups: { dayHeading: string; entries: HistoryItem[] }[] = [];
    historyEntries.forEach((entry) => {
      const heading = getDayHeading(entry.createdAt);
      const existing = groups.find((g) => g.dayHeading === heading);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.push({ dayHeading: heading, entries: [entry] });
      }
    });
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

  return (
    <div className="space-y-6 text-left max-w-[1200px] w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-[var(--color-primary)]" />
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-dark)] tracking-tight">
              Change History
            </h1>
          </div>
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
                <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {group.dayHeading}
                </h2>
                <div className="h-px bg-slate-200 flex-1 ml-2" />
              </div>

              {/* Day Entries */}
              <div className="space-y-3">
                {group.entries.map((entry) => {
                  const isRestore = entry.type === 'restore';
                  const isResolve = entry.type === 'resolve';
                  const isCreate = entry.type === 'create';

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
                      className="bg-white rounded-2xl border border-[var(--color-border-subtle)] p-5 shadow-xs hover:border-[var(--color-border-muted)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Event Type, Student & Diff */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-slate-100)] px-2 py-0.5 rounded">
                            #{entry.id}
                          </span>

                          {entry.isPending ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-dark)] border border-[var(--color-status-pending-border)] flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[var(--color-status-warning-orange)]" /> PENDING SYNC
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--color-status-synced-bg)] text-[var(--color-status-synced-text)] border border-[var(--color-status-synced-border)] flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-[var(--color-status-success-emerald)]" /> CONFIRMED
                            </span>
                          )}

                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              isRestore
                                ? 'bg-[var(--color-status-orange-light)] text-[var(--color-status-orange-text)] border border-[var(--color-status-orange-border)]'
                                : isResolve
                                ? 'bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)] border border-[var(--color-status-pending-border)]'
                                : isCreate
                                ? 'bg-[var(--color-status-synced-bg)] text-[var(--color-status-synced-text)] border border-[var(--color-status-synced-border)]'
                                : 'bg-[var(--color-primary-light)] text-[var(--color-status-info-text)] border border-[var(--color-status-info-border)]'
                            }`}
                          >
                            {entry.type}
                          </span>

                          <span className="font-bold text-sm text-[var(--color-text-dark)]">
                            {entry.studentName}
                          </span>
                          <span className="text-xs font-mono text-[var(--color-text-subtle)]">({entry.reg_no})</span>
                        </div>

                        {/* Event Content Line */}
                        {isCreate ? (
                          <div className="text-xs flex flex-wrap items-center gap-2 pt-1">
                            <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                              Record created
                            </span>
                            <span className="text-[var(--color-text-dark)] font-medium">
                              {createSummary}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs flex flex-wrap items-center gap-2 pt-1">
                            <span className="font-bold text-[var(--color-text-dark)] bg-gray-100 px-1.5 py-0.5 rounded">
                              {entry.field}
                            </span>
                            {entry.oldValue !== null && entry.oldValue !== undefined && (
                              <>
                                <span className="text-red-700 line-through bg-red-50 px-1.5 py-0.5 rounded">
                                  {String(entry.oldValue)}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-light)]" />
                              </>
                            )}
                            <span className="text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                              {String(entry.newValue)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Meta & Restore Button */}
                      <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 text-xs text-[var(--color-text-muted)]">
                        <div className="text-right space-y-0.5">
                          <div className="font-semibold text-[var(--color-text-dark)] flex items-center gap-1 justify-end">
                            <UserCheck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                            <span>{entry.actorName}</span>
                          </div>
                          <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5 justify-end">
                            <Building2 className="w-3 h-3 text-[var(--color-text-subtle)]" />
                            <span>{entry.actorCampus}</span>
                            <span>•</span>
                            <span>{formatFullDate(entry.createdAt)}</span>
                          </div>
                        </div>

                        {/* Restore Button (Admin Only, Not for Creates) */}
                        {currentUser.role === 'admin' && !isCreate && entry.oldValue !== null && (
                          <button
                            type="button"
                            onClick={() => setRestoreEntry(entry)}
                            className="px-3 py-1.5 bg-[var(--color-surface-muted)] hover:bg-[var(--color-primary-light)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] border border-[var(--color-border-muted)] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                            title="Roll back field to this historical value"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
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
        <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] p-12 text-center text-[var(--color-text-muted)] shadow-xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <p className="font-semibold">No audit history entries found for the selected filter.</p>
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      {restoreEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--color-border-subtle)] text-left">
            <h3 className="text-base font-bold text-[var(--color-text-dark)] mb-2">
              Confirm restore
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-6">
              Restore <span className="font-semibold text-[var(--color-text-dark)]">{restoreEntry.field}</span> to the value from <span className="font-semibold text-[var(--color-text-dark)]">{formatFullDate(restoreEntry.createdAt)}</span>? This adds a new entry to the history. Nothing is deleted.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => setRestoreEntry(null)}
                className="px-4 py-2 text-xs font-bold text-[var(--color-text-dark)] bg-[var(--color-surface-slate-100)] hover:bg-slate-200 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestore}
                className="px-4 py-2 text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Restore field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
