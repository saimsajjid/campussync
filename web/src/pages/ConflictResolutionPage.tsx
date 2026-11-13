import React, { useState } from 'react';
import {
  GitMerge,
  CheckCircle2,
  Server,
  Smartphone,
  Check,
  Building2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { ConflictItem, StudentRecord } from '../types';
import { resolveConflict } from '../services/api';
import { generateUUID } from '../utils/uuid';

export const ConflictResolutionPage: React.FC = () => {
  const { addToast, currentUser } = useApp();

  const openConflicts = useLiveQuery(() => {
    return db.conflicts.where('status').equals('open').toArray();
  }, []);

  // Decisions state: { [conflictId]: { choice: 'mine' | 'current' | 'custom', customValue?: string } }
  const [decisions, setDecisions] = useState<
    Record<string, { choice: 'mine' | 'current' | 'custom'; customValue?: string }>
  >({});

  // Technical details toggle state
  const [techDetailsOpen, setTechDetailsOpen] = useState<Record<string, boolean>>({});

  const toggleTechDetails = (id: string) => {
    setTechDetailsOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatFieldName = (field: string): string => {
    const names: Record<string, string> = {
      full_name: 'Full name',
      reg_no: 'Registration number',
      cnic: 'CNIC / National ID',
      campus: 'Campus',
      program: 'Program',
      semester: 'Semester',
      status: 'Status',
      phone: 'Phone number',
      email: 'Email address',
      address: 'Address',
      emergency_contact: 'Emergency contact',
      attendance: 'Attendance rate',
      remarks: 'Faculty remarks',
    };
    return names[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatFullDate = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const handleSelectChoice = (conflictId: string, choice: 'mine' | 'current' | 'custom') => {
    setDecisions((prev) => ({
      ...prev,
      [conflictId]: {
        choice,
        customValue: prev[conflictId]?.customValue || '',
      },
    }));
  };

  const handleCustomValueChange = (conflictId: string, val: string) => {
    setDecisions((prev) => ({
      ...prev,
      [conflictId]: {
        choice: 'custom',
        customValue: val,
      },
    }));
  };

  const handleResolve = async (conflict: ConflictItem) => {
    if (!currentUser) return;
    const decision = decisions[conflict.id];
    if (!decision) {
      addToast('Please pick a resolution choice before applying', 'warning');
      return;
    }

    const studentId = conflict.studentId || (conflict as any).student_id;
    const serverVal = conflict.serverValue !== undefined ? conflict.serverValue : (conflict as any).server_value;
    const incomingVal = conflict.incomingValue !== undefined ? conflict.incomingValue : (conflict as any).incoming_value;
    const sVersion = conflict.serverVersion !== undefined ? conflict.serverVersion : (conflict as any).server_version;

    let finalValue = serverVal;
    if (decision.choice === 'mine') {
      finalValue = incomingVal;
    } else if (decision.choice === 'custom') {
      finalValue = decision.customValue || serverVal;
    }

    // 1. Update Student Record in Dexie
    const student = await db.students.get(studentId);
    if (student) {
      const updatedFieldVersions = {
        ...student.field_versions,
        [conflict.field]: (student.field_versions[conflict.field] || sVersion) + 1,
      };

      const updatedStudent: StudentRecord = {
        ...student,
        [conflict.field]: finalValue,
        field_versions: updatedFieldVersions,
        version: student.version + 1,
        updated_at: new Date().toISOString(),
        last_editor_id: currentUser.name,
      };

      await db.students.put(updatedStudent);

      // 2. Append resolution event to Audit Trail
      await db.history.add({
        id: Date.now(),
        studentId: student.id,
        studentName: student.full_name,
        reg_no: student.reg_no,
        field: conflict.field,
        oldValue: serverVal,
        newValue: finalValue,
        fieldVersionAfter: updatedFieldVersions[conflict.field],
        type: 'resolve',
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorCampus: student.campus,
        device: 'Resolution Engine',
        opId: generateUUID(),
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Mark conflict as resolved locally and on server
    try {
      await resolveConflict(
        conflict.id,
        decision.choice === 'current' ? 'theirs' : decision.choice,
        decision.customValue,
        sVersion
      );
    } catch (e: any) {
      console.warn('Backend conflict resolve sync warning:', e.message);
    }
    await db.conflicts.update(conflict.id, { status: 'resolved' });

    addToast(
      `Conflict resolved: ${formatFieldName(conflict.field)} updated successfully.`,
      'success'
    );
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6 text-left max-w-[1200px] w-full mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <GitMerge className="w-6 h-6 text-[var(--color-status-conflict-text)]" />
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-dark)] tracking-tight">
            Conflict resolution
          </h1>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Review and resolve divergent edits between campuses.
        </p>
      </div>

      {/* Conflict Cards List */}
      {openConflicts && openConflicts.length > 0 ? (
        <div className="space-y-6">
          {openConflicts.map((c) => {
            const currentDecision = decisions[c.id]?.choice;
            const customVal = decisions[c.id]?.customValue ?? '';
            const incomingActor = c.actor || (c as any).actor_id || 'Unknown';
            const isMyChange =
              incomingActor === currentUser.name ||
              incomingActor === currentUser.id ||
              incomingActor === currentUser.email;
            const leftLabel = isMyChange ? 'Your change' : `${incomingActor}'s change`;
            const shortId = c.id.slice(0, 8);
            const friendlyField = formatFieldName(c.field);
            const createdAtFormatted = formatFullDate(c.createdAt || (c as any).created_at);

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-[var(--color-border-subtle)] shadow-xs overflow-hidden"
              >
                {/* Card Top Title Bar */}
                <div className="p-4 bg-[var(--color-surface-muted)] border-b border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-[var(--color-status-conflict-bg)] text-[var(--color-status-conflict-text)] border border-[var(--color-status-conflict-border)] text-[11px] font-bold px-2 py-0.5 rounded-md font-mono">
                      #{shortId}
                    </span>
                    <span className="font-bold text-sm text-[var(--color-text-dark)]">
                      {c.studentName} ({c.reg_no})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-[var(--color-primary)]" /> {c.campus}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-[var(--color-text-dark)]">
                      {friendlyField}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Comparison: Left (Incoming) vs Right (Server) */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Card: Incoming Change */}
                    <div
                      onClick={() => handleSelectChoice(c.id, 'mine')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        currentDecision === 'mine'
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]/40 shadow-xs'
                          : 'border-[var(--color-border-subtle)] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[var(--color-primary)] flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4" /> {leftLabel}
                        </span>
                        <input
                          type="radio"
                          name={`choice-${c.id}`}
                          checked={currentDecision === 'mine'}
                          onChange={() => handleSelectChoice(c.id, 'mine')}
                          className="w-4 h-4 accent-[var(--color-primary)]"
                        />
                      </div>

                      <div className="p-3 bg-white border border-[var(--color-border-subtle)] rounded-lg text-sm font-semibold text-[var(--color-text-dark)] break-all">
                        {String(c.incomingValue ?? (c as any).incoming_value ?? '')}
                      </div>

                      <div className="mt-3 text-[11px] text-[var(--color-text-muted)] space-y-0.5">
                        <div>Changed by: <span className="font-semibold text-[var(--color-text-dark)]">{incomingActor}</span></div>
                        <div>Device: {c.device || (c as any).device_id || 'Mobile Client'}</div>
                        <div>Date and time: {createdAtFormatted}</div>
                      </div>
                    </div>

                    {/* Right Card: Current value on the server */}
                    <div
                      onClick={() => handleSelectChoice(c.id, 'current')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        currentDecision === 'current'
                          ? 'border-[var(--color-status-synced-text)] bg-[var(--color-status-synced-bg)]/40 shadow-xs'
                          : 'border-[var(--color-border-subtle)] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[var(--color-status-synced-text)] flex items-center gap-1.5">
                          <Server className="w-4 h-4" /> Current value on the server
                        </span>
                        <input
                          type="radio"
                          name={`choice-${c.id}`}
                          checked={currentDecision === 'current'}
                          onChange={() => handleSelectChoice(c.id, 'current')}
                          className="w-4 h-4 accent-[var(--color-status-synced-text)]"
                        />
                      </div>

                      <div className="p-3 bg-white border border-[var(--color-border-subtle)] rounded-lg text-sm font-semibold text-[var(--color-text-dark)] break-all">
                        {String(c.serverValue ?? (c as any).server_value ?? '')}
                      </div>

                      <div className="mt-3 text-[11px] text-[var(--color-text-muted)] space-y-0.5">
                        <div>Changed by: <span className="font-semibold text-[var(--color-text-dark)]">Server state</span></div>
                        <div>Device: Central server</div>
                        <div>Date and time: {createdAtFormatted}</div>
                      </div>
                    </div>
                  </div>

                  {/* Technical Details Toggle */}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleTechDetails(c.id)}
                      className="text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {techDetailsOpen[c.id] ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span>{techDetailsOpen[c.id] ? 'Hide technical details' : 'Technical details'}</span>
                    </button>

                    {techDetailsOpen[c.id] && (
                      <div className="mt-2 p-3 bg-[var(--color-surface-slate-100)] rounded-xl border border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-muted)] space-y-1">
                        <div>Base version: <span className="font-mono font-semibold">v{c.baseVersion ?? (c as any).base_version ?? 1}</span></div>
                        <div>Server version: <span className="font-mono font-semibold">v{c.serverVersion ?? (c as any).server_version ?? 1}</span></div>
                        <div>Raw device ID: <span className="font-mono">{c.device || (c as any).device_id || 'N/A'}</span></div>
                        <div>Incoming op ID: <span className="font-mono font-xs">{(c as any).incoming_op_id || 'N/A'}</span></div>
                      </div>
                    )}
                  </div>

                  {/* Option 3: Manual Custom Merged Value */}
                  <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        id={`custom-${c.id}`}
                        name={`choice-${c.id}`}
                        checked={currentDecision === 'custom'}
                        onChange={() => handleSelectChoice(c.id, 'custom')}
                        className="w-4 h-4 accent-[var(--color-primary)]"
                      />
                      <label
                        htmlFor={`custom-${c.id}`}
                        className="text-xs font-bold text-[var(--color-text-dark)] cursor-pointer"
                      >
                        Enter custom merged value
                      </label>
                    </div>

                    {currentDecision === 'custom' && (
                      <input
                        type="text"
                        value={customVal}
                        onChange={(e) => handleCustomValueChange(c.id, e.target.value)}
                        placeholder={`Enter verified ${friendlyField.toLowerCase()} value...`}
                        className="w-full text-xs font-medium p-2.5 bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-xl text-[var(--color-text-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    )}
                  </div>

                  {/* Submit Resolution Action */}
                  <div className="mt-5 flex items-center justify-end">
                    <button
                      onClick={() => handleResolve(c)}
                      disabled={!currentDecision}
                      className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md shadow-[var(--color-primary)]/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" /> Apply decision
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-[var(--color-text-dark)]">No open conflicts</h3>
          <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto mt-1 leading-relaxed">
            All records are synchronized across campuses.
          </p>
        </div>
      )}
    </div>
  );
};
