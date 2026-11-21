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
    <div className="space-y-6 text-left max-w-[1200px] w-full mx-auto pb-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <GitMerge className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Conflict Resolution
          </h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Review divergent edits between campuses, inspect versions, and apply deterministic field resolutions.
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
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
              >
                {/* Card Top Title Bar */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400 font-medium bg-white px-2 py-0.5 rounded border border-slate-200/60">
                      #{shortId}
                    </span>
                    <span className="font-semibold text-sm text-slate-900">
                      {c.studentName}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ({c.reg_no})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" /> {c.campus} Campus
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-slate-800">
                      {friendlyField}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Comparison: Left (Incoming) vs Right (Server) */}
                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Card: Incoming Change */}
                    <div
                      onClick={() => handleSelectChoice(c.id, 'mine')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        currentDecision === 'mine'
                          ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-2 ring-blue-500/10'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-blue-600" /> {leftLabel}
                        </span>
                        <input
                          type="radio"
                          name={`choice-${c.id}`}
                          checked={currentDecision === 'mine'}
                          onChange={() => handleSelectChoice(c.id, 'mine')}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />
                      </div>

                      <div className="p-3 bg-white border border-slate-200/80 rounded-lg text-sm font-mono font-semibold text-slate-900 break-all shadow-2xs">
                        {String(c.incomingValue ?? (c as any).incoming_value ?? '')}
                      </div>

                      <div className="mt-3 text-[11px] text-slate-500 space-y-0.5">
                        <div>Submitted by: <span className="font-medium text-slate-800">{incomingActor}</span></div>
                        <div>Client device: {c.device || (c as any).device_id || 'Client Terminal'}</div>
                        <div>Timestamp: {createdAtFormatted}</div>
                      </div>
                    </div>

                    {/* Right Card: Current value on the server */}
                    <div
                      onClick={() => handleSelectChoice(c.id, 'current')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        currentDecision === 'current'
                          ? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-2 ring-emerald-500/10'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                          <Server className="w-4 h-4 text-emerald-600" /> Current Authoritative Value
                        </span>
                        <input
                          type="radio"
                          name={`choice-${c.id}`}
                          checked={currentDecision === 'current'}
                          onChange={() => handleSelectChoice(c.id, 'current')}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        />
                      </div>

                      <div className="p-3 bg-white border border-slate-200/80 rounded-lg text-sm font-mono font-semibold text-slate-900 break-all shadow-2xs">
                        {String(c.serverValue ?? (c as any).server_value ?? '')}
                      </div>

                      <div className="mt-3 text-[11px] text-slate-500 space-y-0.5">
                        <div>Stored in: <span className="font-medium text-slate-800">Central PostgreSQL</span></div>
                        <div>Version: v{c.serverVersion ?? (c as any).server_version ?? 1}</div>
                        <div>Timestamp: {createdAtFormatted}</div>
                      </div>
                    </div>
                  </div>

                  {/* Technical Details Toggle */}
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => toggleTechDetails(c.id)}
                      className="text-xs font-medium text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {techDetailsOpen[c.id] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <span>{techDetailsOpen[c.id] ? 'Hide technical metadata' : 'View technical metadata'}</span>
                    </button>

                    {techDetailsOpen[c.id] && (
                      <div className="mt-2.5 p-3.5 bg-slate-900 rounded-xl text-slate-300 font-mono text-xs space-y-1 border border-slate-800 shadow-inner">
                        <div>Base version: <span className="text-amber-400 font-bold">v{c.baseVersion ?? (c as any).base_version ?? 1}</span></div>
                        <div>Server version: <span className="text-emerald-400 font-bold">v{c.serverVersion ?? (c as any).server_version ?? 1}</span></div>
                        <div>Device fingerprint: <span>{c.device || (c as any).device_id || 'N/A'}</span></div>
                        <div>Incoming mutation ID: <span className="text-slate-400 font-xs">{(c as any).incoming_op_id || 'N/A'}</span></div>
                      </div>
                    )}
                  </div>

                  {/* Option 3: Manual Custom Merged Value */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        id={`custom-${c.id}`}
                        name={`choice-${c.id}`}
                        checked={currentDecision === 'custom'}
                        onChange={() => handleSelectChoice(c.id, 'custom')}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                      <label
                        htmlFor={`custom-${c.id}`}
                        className="text-xs font-semibold text-slate-800 cursor-pointer"
                      >
                        Enter custom merged value manually
                      </label>
                    </div>

                    {currentDecision === 'custom' && (
                      <input
                        type="text"
                        value={customVal}
                        onChange={(e) => handleCustomValueChange(c.id, e.target.value)}
                        placeholder={`Enter verified ${friendlyField.toLowerCase()} value...`}
                        className="w-full text-xs font-medium p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                      />
                    )}
                  </div>

                  {/* Submit Resolution Action */}
                  <div className="mt-5 flex items-center justify-end">
                    <button
                      onClick={() => handleResolve(c)}
                      disabled={!currentDecision}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" /> Apply Resolution
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200/60 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-slate-900">No Open Conflicts</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
            All multi-campus student records are fully converged and in sync.
          </p>
        </div>
      )}
    </div>
  );
};
