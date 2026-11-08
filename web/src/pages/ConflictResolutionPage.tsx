import React, { useState } from 'react';
import {
  GitMerge,
  CheckCircle2,
  Server,
  Smartphone,
  Check,
  Building2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { ConflictItem, StudentRecord } from '../types';

export const ConflictResolutionPage: React.FC = () => {
  const { addToast, currentUser } = useApp();

  const openConflicts = useLiveQuery(() => {
    return db.conflicts.where('status').equals('open').toArray();
  }, []);

  // Decisions state: { [conflictId]: { choice: 'mine' | 'current' | 'custom', customValue?: string } }
  const [decisions, setDecisions] = useState<
    Record<string, { choice: 'mine' | 'current' | 'custom'; customValue?: string }>
  >({});

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
    const decision = decisions[conflict.id];
    if (!decision) {
      addToast('Please pick a resolution choice (Keep Mine, Keep Current, or Custom Value)', 'warning');
      return;
    }

    let finalValue = conflict.serverValue;
    if (decision.choice === 'mine') {
      finalValue = conflict.incomingValue;
    } else if (decision.choice === 'custom') {
      finalValue = decision.customValue || conflict.serverValue;
    }

    // 1. Update Student Record in Dexie
    const student = await db.students.get(conflict.studentId);
    if (student) {
      const updatedFieldVersions = {
        ...student.field_versions,
        [conflict.field]: (student.field_versions[conflict.field] || conflict.serverVersion) + 1,
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
        oldValue: conflict.serverValue,
        newValue: finalValue,
        fieldVersionAfter: updatedFieldVersions[conflict.field],
        type: 'resolve',
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorCampus: student.campus,
        device: 'Resolution Engine',
        opId: 'op-res-' + Math.random().toString(36).substring(2, 7),
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Mark conflict as resolved
    await db.conflicts.update(conflict.id, { status: 'resolved' });

    addToast(
      `Conflict #${conflict.id} resolved: Field "${conflict.field}" updated to chosen value.`,
      'success'
    );
  };

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <GitMerge className="w-6 h-6 text-[#EF4444]" />
          <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] tracking-tight">
            Concurrency Conflict Resolution
          </h1>
        </div>
        <p className="text-xs text-[#6B7280] mt-1">
          Design-Spec §6.4: Non-destructive resolution for concurrent offline edits to identical fields.
        </p>
      </div>

      {/* Conflict Cards List */}
      {openConflicts && openConflicts.length > 0 ? (
        <div className="space-y-6">
          {openConflicts.map((c) => {
            const currentDecision = decisions[c.id]?.choice;
            const customVal = decisions[c.id]?.customValue ?? '';

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border-2 border-[#EF4444]/20 shadow-sm overflow-hidden"
              >
                {/* Card Top Title Bar */}
                <div className="p-4 bg-[#FEF2F2] border-b border-[#FECACA] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#EF4444] text-white text-[11px] font-bold px-2 py-0.5 rounded">
                      CONFLICT #{c.id}
                    </span>
                    <span className="font-bold text-sm text-[#1E293B]">
                      {c.studentName} ({c.reg_no})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-[#4F7DF3]" /> {c.campus}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-[#991B1B] font-bold">
                      Field: {c.field.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Comparison: Yours vs Current */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Column 1: YOURS (This Device) */}
                    <div
                      onClick={() => handleSelectChoice(c.id, 'mine')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        currentDecision === 'mine'
                          ? 'border-[#4F7DF3] bg-[#EBF0FF]/50 shadow-xs'
                          : 'border-[#E5E7EB] bg-white hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#4F7DF3] flex items-center gap-1.5 uppercase">
                          <Smartphone className="w-4 h-4" /> Yours (Offline Edit)
                        </span>
                        <input
                          type="radio"
                          name={`choice-${c.id}`}
                          checked={currentDecision === 'mine'}
                          onChange={() => handleSelectChoice(c.id, 'mine')}
                          className="w-4 h-4 accent-[#4F7DF3]"
                        />
                      </div>

                      <div className="p-3 bg-white border border-[#E5E7EB] rounded-lg text-sm font-semibold text-[#1E293B] break-all">
                        {String(c.incomingValue)}
                      </div>

                      <div className="mt-3 text-[11px] text-[#6B7280] space-y-0.5">
                        <div>Base Version: v{c.baseVersion}</div>
                        <div>Edited on: {c.device}</div>
                        <div className="text-gray-400">Captured locally during offline transit</div>
                      </div>
                    </div>

                    {/* Column 2: CURRENT (Central Server) */}
                    <div
                      onClick={() => handleSelectChoice(c.id, 'current')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        currentDecision === 'current'
                          ? 'border-[#15803D] bg-[#DCFCE7]/40 shadow-xs'
                          : 'border-[#E5E7EB] bg-white hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#15803D] flex items-center gap-1.5 uppercase">
                          <Server className="w-4 h-4" /> Current (Server Held)
                        </span>
                        <input
                          type="radio"
                          name={`choice-${c.id}`}
                          checked={currentDecision === 'current'}
                          onChange={() => handleSelectChoice(c.id, 'current')}
                          className="w-4 h-4 accent-[#15803D]"
                        />
                      </div>

                      <div className="p-3 bg-white border border-[#E5E7EB] rounded-lg text-sm font-semibold text-[#1E293B] break-all">
                        {String(c.serverValue)}
                      </div>

                      <div className="mt-3 text-[11px] text-[#6B7280] space-y-0.5">
                        <div>Server Version: v{c.serverVersion}</div>
                        <div>Committed by: {c.actor}</div>
                        <div className="text-gray-400">Received concurrently from other campus</div>
                      </div>
                    </div>
                  </div>

                  {/* Option 3: Manual Custom Merged Value */}
                  <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        id={`custom-${c.id}`}
                        name={`choice-${c.id}`}
                        checked={currentDecision === 'custom'}
                        onChange={() => handleSelectChoice(c.id, 'custom')}
                        className="w-4 h-4 accent-[#4F7DF3]"
                      />
                      <label
                        htmlFor={`custom-${c.id}`}
                        className="text-xs font-bold text-[#1E293B] cursor-pointer"
                      >
                        Enter a Different Merged Value
                      </label>
                    </div>

                    {currentDecision === 'custom' && (
                      <input
                        type="text"
                        value={customVal}
                        onChange={(e) => handleCustomValueChange(c.id, e.target.value)}
                        placeholder={`Type verified ${c.field} value...`}
                        className="w-full text-xs font-medium p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#4F7DF3]"
                      />
                    )}
                  </div>

                  {/* Submit Resolution Action */}
                  <div className="mt-5 flex items-center justify-end">
                    <button
                      onClick={() => handleResolve(c)}
                      disabled={!currentDecision}
                      className="px-5 py-2.5 bg-[#4F7DF3] hover:bg-[#3E6AE1] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md shadow-[#4F7DF3]/20 flex items-center gap-1.5 transition-all"
                    >
                      <Check className="w-4 h-4" /> Apply Decision to Record
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-[#1E293B]">No Open Conflicts</h3>
          <p className="text-xs text-[#6B7280] max-w-sm mx-auto mt-1 leading-relaxed">
            All multi-campus edits are synchronized and converged. Non-overlapping field updates have auto-merged cleanly.
          </p>
        </div>
      )}
    </div>
  );
};
