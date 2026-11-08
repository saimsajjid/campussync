import React, { useState } from 'react';
import {
  History,
  RotateCcw,
  ArrowRight,
  Building2,
  Filter,
  CheckCircle2,
  UserCheck,
  Clock,
  CheckCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { HistoryItem, StudentRecord } from '../types';
import { restoreStudentField } from '../services/api';
import { generateUUID } from '../utils/uuid';

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

  if (!currentUser) return null;

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
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-[var(--color-primary)]" />
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-dark)] tracking-tight">
              Append-Only Change History
            </h1>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            FR-9: Immutable event log driving pull replication cursor. Guaranteed zero silent overwrites.
          </p>
        </div>

        {/* Filter by Event Type */}
        <div className="flex items-center gap-2 bg-white border border-[var(--color-border-muted)] rounded-xl px-3 py-1.5 shadow-xs">
          <Filter className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Event Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs font-bold text-[var(--color-text-dark)] bg-transparent focus:outline-none cursor-pointer"
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

                  {/* Field Diff Line */}
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
                </div>

                {/* Right: Meta & Restore Button */}
                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 text-xs text-[var(--color-text-muted)]">
                  <div className="text-right space-y-0.5">
                    <div className="font-semibold text-[var(--color-text-dark)] flex items-center gap-1 justify-end">
                      <UserCheck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      <span>{entry.actorName}</span>
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 justify-end">
                      <Building2 className="w-3 h-3 text-[var(--color-text-subtle)]" />
                      <span>{entry.actorCampus}</span>
                      <span>•</span>
                      <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Restore Button (Admin Only) */}
                  {currentUser.role === 'admin' && entry.oldValue !== null && (
                    <button
                      onClick={() => handleRestore(entry)}
                      className="px-3 py-1.5 bg-[var(--color-surface-muted)] hover:bg-[var(--color-primary-light)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] border border-[var(--color-border-muted)] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0"
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
          <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] p-12 text-center text-[var(--color-text-muted)]">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="font-semibold">No audit history entries found for the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};
