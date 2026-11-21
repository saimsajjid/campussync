import React, { useState } from 'react';
import {
  History,
  Clock,
  CheckCircle2,
  Undo2,
  Search,
  UserCheck,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { HistoryItem, StudentRecord } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';

interface HistoryPageProps {
  initialStudentId?: string;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ initialStudentId }) => {
  const { addToast, currentUser, queueEditOperation } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [restoreEntry, setRestoreEntry] = useState<HistoryItem | null>(null);

  // Read Local Audit Trail from Dexie
  const historyEntries = useLiveQuery(
    async () => {
      let query = db.history.toCollection();

      // If initialStudentId was passed (e.g. from Students page drill-down), pre-filter
      if (initialStudentId) {
        query = db.history.where('studentId').equals(initialStudentId);
      }

      const items = await query.toArray();

      // Faculty scoping: show history for students in their campus only
      if (currentUser?.role === 'faculty' && currentUser.campus) {
        return items
          .filter((item) => item.actorCampus === currentUser.campus)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [initialStudentId, currentUser?.role, currentUser?.campus],
    []
  );

  // Read pending outbox items to cross-reference unconfirmed changes
  const outboxItems = useLiveQuery(() => db.outbox.toArray(), [], []);

  if (!currentUser) return null;

  // Enhance history entries with pending status if still in outbox
  const enhancedEntries = historyEntries.map((entry) => {
    const isStillInOutbox = outboxItems.some((op) => op.opId === entry.opId);
    return {
      ...entry,
      isPending: isStillInOutbox,
    };
  });

  // Filter entries based on search and field filter
  const filteredEntries = enhancedEntries.filter((item) => {
    if (fieldFilter !== 'all' && item.field !== fieldFilter) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchName = item.studentName.toLowerCase().includes(q);
      const matchReg = item.reg_no.toLowerCase().includes(q);
      const matchField = item.field.toLowerCase().includes(q);
      const matchActor = item.actorName.toLowerCase().includes(q);
      return matchName || matchReg || matchField || matchActor;
    }
    return true;
  });

  // Group by Date for cleaner presentation
  const groupedEntries: Record<string, typeof filteredEntries> = {};
  filteredEntries.forEach((entry) => {
    const d = new Date(entry.createdAt);
    const dateKey = isNaN(d.getTime())
      ? 'Recent'
      : d.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
    if (!groupedEntries[dateKey]) groupedEntries[dateKey] = [];
    groupedEntries[dateKey].push(entry);
  });

  const formatFullDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreEntry) return;
    const entry = restoreEntry;
    setRestoreEntry(null);

    // Rollback field on student
    const student = await db.students.get(entry.studentId);
    if (!student) {
      addToast('Cannot restore: Student record no longer exists locally', 'danger');
      return;
    }

    if (entry.oldValue === null || entry.oldValue === undefined) {
      addToast('Cannot restore: No previous historical value recorded', 'warning');
      return;
    }

    const currentServerVersion = student.field_versions?.[entry.field] || student.version;

    // Queue operation as a restore edit
    await queueEditOperation(
      student.id,
      entry.field,
      entry.oldValue,
      (student as any)[entry.field],
      currentServerVersion,
      'restore'
    );

    // Append a new history audit log of the restoration action
    const nowIso = new Date().toISOString();
    await db.history.add({
      id: Date.now(),
      studentId: student.id,
      studentName: student.full_name,
      reg_no: student.reg_no,
      field: entry.field,
      oldValue: (student as any)[entry.field],
      newValue: entry.oldValue,
      fieldVersionAfter: currentServerVersion + 1,
      type: 'restore',
      actorName: currentUser.name,
      actorRole: currentUser.role,
      actorCampus: student.campus,
      device: 'Admin Portal',
      opId: `restore-${Date.now()}`,
      createdAt: nowIso,
    });

    // Update local student object immediately
    const updatedStudent: StudentRecord = {
      ...student,
      [entry.field]: entry.oldValue,
      field_versions: {
        ...student.field_versions,
        [entry.field]: currentServerVersion + 1,
      },
      version: student.version + 1,
      updated_at: nowIso,
      last_editor_id: currentUser.name,
    };
    await db.students.put(updatedStudent);

    addToast(`Restored ${entry.studentName}'s ${entry.field} back to previous value`, 'info');
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'edit':
        return { label: 'Edit', class: 'bg-zinc-100 text-zinc-800 border-zinc-200' };
      case 'restore':
        return { label: 'Restored', class: 'bg-zinc-100 text-zinc-900 border-zinc-300 font-semibold' };
      case 'resolve':
        return { label: 'Resolved', class: 'bg-zinc-100 text-zinc-800 border-zinc-200' };
      case 'create':
        return { label: 'New Record', class: 'bg-zinc-100 text-zinc-900 border-zinc-200' };
      default:
        return { label: type, class: 'bg-zinc-100 text-zinc-700 border-zinc-200' };
    }
  };

  return (
    <div className="space-y-6 text-left max-w-[1240px] w-full mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <History className="w-6 h-6 text-zinc-900" />
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Change History
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Tamper-evident audit timeline of all modifications across campuses with 1-click restore.
          </p>
        </div>

        {initialStudentId && (
          <div className="px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-800 flex items-center gap-2">
            <span>Filtered by student:</span>
            <span className="font-mono text-zinc-900 font-bold">{initialStudentId.slice(0, 8)}</span>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by student, reg no, editor, or field..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 transition-colors"
            />
          </div>

          <CustomDropdown
            value={fieldFilter}
            onChange={(val) => setFieldFilter(val)}
            options={[
              { value: 'all', label: 'All Fields' },
              { value: 'status', label: 'Academic Status' },
              { value: 'attendance', label: 'Attendance' },
              { value: 'semester', label: 'Semester' },
              { value: 'phone', label: 'Phone' },
              { value: 'address', label: 'Address' },
              { value: 'emergency_contact', label: 'Emergency Contact' },
            ]}
            labelPrefix="Field:"
            size="sm"
          />
        </div>

        <div className="text-xs text-zinc-500 font-mono self-end md:self-center">
          {filteredEntries.length} log events recorded
        </div>
      </div>

      {/* Grouped Audit Timeline */}
      {Object.keys(groupedEntries).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedEntries).map(([dateLabel, entries]) => (
            <div key={dateLabel} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                  {dateLabel}
                </span>
                <div className="h-px bg-zinc-200 flex-1" />
              </div>

              <div className="bg-white rounded-xl border border-zinc-200/90 shadow-2xs divide-y divide-zinc-100 overflow-hidden">
                {entries.map((entry) => {
                  const eventTypeInfo = getEventTypeLabel(entry.type || 'edit');
                  const isCreate = entry.type === 'create';
                  let createSummary = '';
                  if (isCreate && typeof entry.newValue === 'object' && entry.newValue !== null) {
                    createSummary = `${entry.newValue.full_name} (${entry.newValue.reg_no}) enrolled in ${entry.newValue.program}`;
                  }

                  return (
                    <div
                      key={entry.id}
                      className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-50/70 transition-colors"
                    >
                      {/* Left: Event Details */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-zinc-400 font-medium">
                            {typeof entry.id === 'number' && entry.id > 1000000000
                              ? `#${String(entry.id).slice(-4)}`
                              : `#${entry.id}`}
                          </span>

                          {entry.isPending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                              <Clock className="w-3 h-3 text-zinc-600" /> Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                              <CheckCircle2 className="w-3 h-3 text-zinc-800" /> Synced
                            </span>
                          )}

                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${eventTypeInfo.class}`}
                          >
                            {eventTypeInfo.label}
                          </span>

                          <span className="font-semibold text-sm text-zinc-900">
                            {entry.studentName}
                          </span>
                          <span className="text-xs font-mono text-zinc-400">
                            ({entry.reg_no})
                          </span>
                        </div>

                        {/* Event Content Line */}
                        {isCreate ? (
                          <div className="text-xs flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="font-medium text-zinc-500">Registered:</span>
                            <span className="text-zinc-800 font-medium bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md">
                              {createSummary}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="font-medium text-zinc-500 capitalize">
                              {entry.field.replace(/_/g, ' ')}:
                            </span>
                            {entry.oldValue !== null && entry.oldValue !== undefined && (
                              <>
                                <span className="font-mono text-xs text-zinc-400 line-through">
                                  {String(entry.oldValue)}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                              </>
                            )}
                            <span className="font-mono text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md">
                              {String(entry.newValue)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Meta & Restore Button */}
                      <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100 text-xs text-zinc-500">
                        <div className="text-left md:text-right space-y-0.5">
                          <div className="font-medium text-zinc-800 flex items-center gap-1.5 md:justify-end">
                            <UserCheck className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{entry.actorName}</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 md:justify-end">
                            <Building2 className="w-3 h-3 text-zinc-400" />
                            <span>{entry.actorCampus} Campus</span>
                            <span>•</span>
                            <span>{formatFullDate(entry.createdAt)}</span>
                          </div>
                        </div>

                        {/* Restore Button */}
                        {currentUser.role === 'admin' && !isCreate && entry.oldValue !== null && (
                          <button
                            type="button"
                            onClick={() => setRestoreEntry(entry)}
                            className="px-3 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-2xs"
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
        <div className="bg-white rounded-xl border border-zinc-200/90 p-12 text-center text-zinc-500 shadow-2xs">
          <CheckCircle2 className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p className="font-medium text-zinc-800">No audit history entries found</p>
          <p className="text-xs text-zinc-400 mt-1">Changes made to student records will appear in this timeline.</p>
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      {restoreEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 text-left">
            <h3 className="text-base font-semibold text-zinc-900 mb-2">
              Confirm Record Restore
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed mb-6">
              Are you sure you want to revert <strong>{restoreEntry.studentName}</strong>'s field{' '}
              <strong className="text-zinc-800 font-mono">{restoreEntry.field}</strong> back to{' '}
              <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-900 border border-zinc-200">
                {String(restoreEntry.oldValue)}
              </span>
              ? This rollback will be versioned, logged, and synchronized across all campuses.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRestoreEntry(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-50 bg-zinc-900 hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" /> Confirm & Revert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
