import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle2, Save, UserPlus, AlertTriangle, GraduationCap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { StatusBadge } from './StatusBadge';
import { CustomDropdown, DropdownOption } from './CustomDropdown';
import { db } from '../db';
import type { StudentRecord, CampusCode, ProgramCode, StudentStatus } from '../types';
import { generateUUID } from '../utils/uuid';

const CAMPUS_OPTIONS: DropdownOption<CampusCode>[] = [
  { value: 'Islamabad', label: 'Islamabad Campus' },
  { value: 'Lahore', label: 'Lahore Campus' },
  { value: 'Abbottabad', label: 'Abbottabad Campus' },
];

const PROGRAM_OPTIONS: DropdownOption<ProgramCode>[] = [
  { value: 'BS CS', label: 'BS Computer Science' },
  { value: 'BS SE', label: 'BS Software Engineering' },
  { value: 'BS EE', label: 'BS Electrical Engineering' },
];

const SEMESTER_OPTIONS: DropdownOption<number>[] = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
  value: s,
  label: `Semester ${s}`,
}));

const STATUS_OPTIONS: DropdownOption<StudentStatus>[] = [
  { value: 'Active', label: 'Active', badge: 'Active' },
  { value: 'On leave', label: 'On leave', badge: 'Leave' },
  { value: 'Graduated', label: 'Graduated', badge: 'Alumni' },
];

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentToEdit?: StudentRecord | null;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  onClose,
  studentToEdit,
}) => {
  const { currentUser, queueEditOperation, addToast, simulator, syncNow, setDuplicateRecordPrompt } = useApp();

  const isEditing = Boolean(studentToEdit);
  const prevIsOpenRef = useRef(false);
  const isDirtyRef = useRef(false);
  const initialStudentRef = useRef<StudentRecord | null>(null);

  // Live queries for field status tracking
  const studentOutboxOps = useLiveQuery(
    () => (studentToEdit ? db.outbox.where('studentId').equals(studentToEdit.id).toArray() : []),
    [studentToEdit?.id]
  );
  const studentConflicts = useLiveQuery(
    () => (studentToEdit ? db.conflicts.where('studentId').equals(studentToEdit.id).toArray() : []),
    [studentToEdit?.id]
  );

  // Form State
  const [formData, setFormData] = useState({
    reg_no: '',
    cnic: '',
    full_name: '',
    program: 'BS CS' as ProgramCode,
    campus: 'Islamabad' as CampusCode,
    semester: 1,
    status: 'Active' as StudentStatus,
    phone: '',
    email: '',
    address: '',
    emergency_contact: '',
    attendance: 85,
    remarks: '',
  });

  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [externalUpdateNotice, setExternalUpdateNotice] = useState<boolean>(false);

  const fillSampleData = () => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const randomCnic = Math.floor(1000000 + Math.random() * 9000000);
    setFormData({
      reg_no: `CS-2026-${randomId}`,
      cnic: `37405-${randomCnic}-1`,
      full_name: 'Zainab Bibi',
      program: 'BS CS',
      campus: currentUser?.campus || 'Lahore',
      semester: 4,
      status: 'Active',
      phone: '0300-5551234',
      email: `zainab.${randomId}@campussync.edu.pk`,
      address: 'House 42, Street 8, G-10/2, Islamabad',
      emergency_contact: 'Tariq Mehmood (0321-9876543)',
      attendance: 90,
      remarks: 'Consistent academic performance',
    });
  };

  useEffect(() => {
    // Only re-initialize form state when modal transitions from closed to open
    if (isOpen && !prevIsOpenRef.current) {
      isDirtyRef.current = false;
      initialStudentRef.current = studentToEdit ? JSON.parse(JSON.stringify(studentToEdit)) : null;
      setExternalUpdateNotice(false);
      if (studentToEdit) {
        setFormData({
          reg_no: studentToEdit.reg_no,
          cnic: studentToEdit.cnic,
          full_name: studentToEdit.full_name,
          program: studentToEdit.program,
          campus: studentToEdit.campus,
          semester: studentToEdit.semester,
          status: studentToEdit.status,
          phone: studentToEdit.phone,
          email: studentToEdit.email,
          address: studentToEdit.address,
          emergency_contact: studentToEdit.emergency_contact,
          attendance: studentToEdit.attendance,
          remarks: studentToEdit.remarks || '',
        });
      } else {
        setFormData({
          reg_no: '',
          cnic: '',
          full_name: '',
          program: 'BS CS',
          campus: currentUser?.campus || 'Islamabad',
          semester: 1,
          status: 'Active',
          phone: '',
          email: '',
          address: '',
          emergency_contact: '',
          attendance: 85,
          remarks: '',
        });
      }
      setDuplicateWarning(null);
      setValidationError(null);
    }
    prevIsOpenRef.current = isOpen;
  }, [studentToEdit, isOpen, currentUser]);

  // Monitor background database updates to this record while form is open (FR-12.2)
  useEffect(() => {
    if (!isOpen || !studentToEdit) return;

    const checkBackgroundUpdate = async () => {
      const currentInDb = await db.students.get(studentToEdit.id);
      if (currentInDb && initialStudentRef.current) {
        if (currentInDb.version > initialStudentRef.current.version) {
          setExternalUpdateNotice(true);
        }
      }
    };

    const interval = setInterval(checkBackgroundUpdate, 500);
    const handleSyncEvent = () => checkBackgroundUpdate();
    window.addEventListener('campussync:sync_event', handleSyncEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('campussync:sync_event', handleSyncEvent);
    };
  }, [isOpen, studentToEdit]);

  // Subtle presenter shortcut: Alt+D to populate sample data without showing a prototype button
  useEffect(() => {
    if (!isOpen || isEditing) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        fillSampleData();
        addToast('Sample record details loaded', 'info');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isEditing]);

  // Real-time duplicate check (FR-10)
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!formData.reg_no && !formData.cnic) return;
      const match = await db.students
        .filter(
          (s) =>
            (s.reg_no === formData.reg_no || s.cnic === formData.cnic) &&
            (!studentToEdit || s.id !== studentToEdit.id)
        )
        .first();

      if (match) {
        setDuplicateWarning(
          `Duplicate suspect found: ${match.full_name} (${match.reg_no}, Campus: ${match.campus}) already exists!`
        );
      } else {
        setDuplicateWarning(null);
      }
    };
    checkDuplicate();
  }, [formData.reg_no, formData.cnic, studentToEdit]);

  if (!isOpen || !currentUser) return null;

  // Permission helpers
  const canEditOfficial = currentUser.role === 'admin';
  const canEditContact = currentUser.role === 'admin' || currentUser.role === 'student';
  const canEditAcademic = currentUser.role === 'admin' || currentUser.role === 'faculty';

  const renderFieldStatus = (field: string) => {
    if (!isEditing) return null;

    const conflict = studentConflicts?.find((c) => c.field === field && c.status === 'open');
    if (conflict) {
      return <StatusBadge status="conflict" label="Needs your decision" />;
    }

    const op = studentOutboxOps
      ?.filter((o) => o.field === field)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (op) {
      if (op.status === 'rejected' || op.status === 'failed') {
        return <StatusBadge status="rejected" label={op.errorReason ? `Not saved: ${op.errorReason}` : 'Not saved'} />;
      }
      if (op.status === 'conflict') {
        return <StatusBadge status="conflict" label="Needs your decision" />;
      }
      return <StatusBadge status="pending" label="Saved on this device" />;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Cross-field validation: Graduated requires semester 8
    if (formData.status === 'Graduated' && formData.semester !== 8) {
      setValidationError('Validation Error: A student with status "Graduated" must be in Semester 8.');
      return;
    }

    if (isEditing && studentToEdit) {
      // Find modified fields and queue operations using original baseVersion
      let changedCount = 0;
      const initial = initialStudentRef.current || studentToEdit;
      for (const [key, val] of Object.entries(formData)) {
        const fieldKey = key as keyof typeof formData;
        if (initial[fieldKey] !== val) {
          await queueEditOperation(
            studentToEdit.id,
            fieldKey,
            val,
            initial[fieldKey],
            initial.field_versions[fieldKey] || 1
          );
          changedCount++;
        }
      }

      if (changedCount === 0) {
        addToast('No changes detected', 'info');
      }
      onClose();
    } else {
      // Create new student record with client-generated UUID (D8)
      // Check if duplicate exists locally
      const match = await db.students
        .filter((s) => s.reg_no === formData.reg_no || s.cnic === formData.cnic)
        .first();

      if (match) {
        // Open the Duplicate Record Dialog immediately (FR-6)
        setDuplicateRecordPrompt({
          isOpen: true,
          reason: `A student with ${match.reg_no === formData.reg_no ? 'registration number ' + match.reg_no : 'CNIC ' + match.cnic} already exists (${match.full_name}, ${match.campus}).`,
          existingRecordId: match.id,
          studentName: match.full_name,
          regNo: match.reg_no,
          cnic: match.cnic,
          isOfflineSync: false,
        });
        onClose();
        return;
      }

      const newId = generateUUID();
      const initialFieldVersions: Record<string, number> = {};
      Object.keys(formData).forEach((k) => (initialFieldVersions[k] = 1));

      const newStudent: StudentRecord = {
        id: newId,
        ...formData,
        field_versions: initialFieldVersions,
        version: 1,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_editor_id: currentUser.name,
      };

      await db.students.add(newStudent);
      await queueEditOperation(newId, '*', newStudent, null, 0, 'create', newStudent);

      if (!simulator.isOffline) {
        // Online: sync immediately and check if server flagged duplicate_record
        await syncNow();
        const failedOp = await db.outbox.get(newId);
        if (failedOp && failedOp.status === 'failed' && (failedOp.errorReason?.includes('already exists') || failedOp.errorReason?.includes('Duplicate'))) {
          setDuplicateRecordPrompt({
            isOpen: true,
            reason: failedOp.errorReason,
            existingRecordId: undefined,
            opId: newId,
            studentId: newId,
            studentName: newStudent.full_name,
            regNo: newStudent.reg_no,
            isOfflineSync: false,
          });
        } else {
          addToast(`Student ${newStudent.full_name} (${newStudent.reg_no}) created and synced!`, 'success');
        }
      } else {
        addToast(`New student ${newStudent.full_name} (${newStudent.reg_no}) registered offline`, 'success');
      }
      onClose();
    }
  };

  // ─── FACULTY WORKFLOW: MINIMALIST ACADEMIC EVALUATION ───
  if (currentUser.role === 'faculty' && isEditing && studentToEdit) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Academic Evaluation
                </h3>
                <p className="text-xs text-slate-500">
                  {studentToEdit.campus} Campus • Verified Student Record
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-left">
            {externalUpdateNotice && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold block">Notice:</span>
                  <span>This record was updated by someone else.</span>
                </div>
              </div>
            )}

            {/* Verified Student Summary Card */}
            <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                    {studentToEdit.full_name
                      ? studentToEdit.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'S'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{studentToEdit.full_name}</h4>
                    <p className="text-xs text-slate-500 font-mono">{studentToEdit.reg_no}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {studentToEdit.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">Campus</span>
                  <span className="font-semibold text-slate-800">{studentToEdit.campus}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">Program</span>
                  <span className="font-semibold text-slate-800">{studentToEdit.program}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">Semester</span>
                  <span className="font-semibold text-slate-800">Semester {studentToEdit.semester}</span>
                </div>
              </div>
            </div>

            {/* Academic Evaluation Fields */}
            <div className="space-y-4 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Attendance Rate (%)
                  </label>
                  {renderFieldStatus('attendance')}
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  required
                  value={formData.attendance}
                  onChange={(e) => setFormData({ ...formData, attendance: parseFloat(e.target.value) || 0 })}
                  className="w-full text-sm font-semibold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                  {formData.attendance >= 85 ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Good Standing (Eligible for Final Examinations)
                    </span>
                  ) : formData.attendance >= 75 ? (
                    <span className="text-amber-700 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Warning Standing (Borderline Attendance)
                    </span>
                  ) : (
                    <span className="text-rose-700 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Attendance Shortage (Course Ineligibility Risk)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-800">
                    Faculty Remarks & Notes
                  </label>
                  {renderFieldStatus('remarks')}
                </div>
                <textarea
                  rows={3}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter academic remarks, lab performance, or coursework notes..."
                  className="w-full text-xs font-medium bg-white border border-slate-200 rounded-xl p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Academic Record</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              {isEditing ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {isEditing ? `Edit Student: ${studentToEdit?.full_name}` : 'Register New Student Record'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? `Registration: ${studentToEdit?.reg_no}` : 'Enter student details below'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
          {/* Non-blocking External Update Notice (FR-12.2) */}
          {externalUpdateNotice && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold block">Notice:</span>
                <span>This record was updated by someone else.</span>
              </div>
            </div>
          )}

          {/* Duplicate Warning Alert */}
          {duplicateWarning && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start gap-3 text-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold block">Duplicate Record Detected:</span>
                <span>{duplicateWarning}</span>
              </div>
            </div>
          )}

          {/* Validation Error Alert */}
          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start gap-3 text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-semibold">{validationError}</div>
            </div>
          )}

          {/* Group 1: Identity & Official Records */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Official University Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Full Name</label>
                  {renderFieldStatus('full_name')}
                </div>
                <input
                  type="text"
                  required
                  disabled={!canEditOfficial}
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Muhammad Ahmed"
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Registration Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Registration Number (Unique)</label>
                  {renderFieldStatus('reg_no')}
                </div>
                <input
                  type="text"
                  required
                  disabled={!canEditOfficial}
                  value={formData.reg_no}
                  onChange={(e) => setFormData({ ...formData, reg_no: e.target.value })}
                  placeholder="e.g. CS-2026-0147"
                  className="w-full text-xs font-mono font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* CNIC (National ID) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">National ID / CNIC (13 Digits)</label>
                  {renderFieldStatus('cnic')}
                </div>
                <input
                  type="text"
                  required
                  disabled={!canEditOfficial}
                  value={formData.cnic}
                  onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  placeholder="e.g. 37405-1234567-1"
                  className="w-full text-xs font-mono font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Campus */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Campus</label>
                  {renderFieldStatus('campus')}
                </div>
                <CustomDropdown<CampusCode>
                  value={formData.campus}
                  onChange={(val) => setFormData({ ...formData, campus: val })}
                  options={CAMPUS_OPTIONS}
                  disabled={!canEditOfficial}
                  className="w-full"
                />
              </div>

              {/* Program */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Program</label>
                  {renderFieldStatus('program')}
                </div>
                <CustomDropdown<ProgramCode>
                  value={formData.program}
                  onChange={(val) => setFormData({ ...formData, program: val })}
                  options={PROGRAM_OPTIONS}
                  disabled={!canEditOfficial}
                  className="w-full"
                />
              </div>

              {/* Semester & Status */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Semester</label>
                    {renderFieldStatus('semester')}
                  </div>
                  <CustomDropdown<number>
                    value={formData.semester}
                    onChange={(val) => setFormData({ ...formData, semester: val })}
                    options={SEMESTER_OPTIONS}
                    disabled={!canEditOfficial}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Status</label>
                    {renderFieldStatus('status')}
                  </div>
                  <CustomDropdown<StudentStatus>
                    value={formData.status}
                    onChange={(val) => setFormData({ ...formData, status: val })}
                    options={STATUS_OPTIONS}
                    disabled={!canEditOfficial}
                    className="w-full"
                    align="right"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Personal / Contact Details */}
          <div className="space-y-3 pt-3 border-t border-slate-200/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Contact Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Mobile Phone</label>
                  {renderFieldStatus('phone')}
                </div>
                <input
                  type="tel"
                  required
                  disabled={!canEditContact}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0300-1234567"
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Email Address</label>
                  {renderFieldStatus('email')}
                </div>
                <input
                  type="email"
                  required
                  disabled={!canEditContact}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="student@campussync.edu.pk"
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Emergency Contact</label>
                  {renderFieldStatus('emergency_contact')}
                </div>
                <input
                  type="text"
                  required
                  disabled={!canEditContact}
                  value={formData.emergency_contact}
                  onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                  placeholder="Name (Phone)"
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Home / Residency Address</label>
                  {renderFieldStatus('address')}
                </div>
                <input
                  type="text"
                  required
                  disabled={!canEditContact}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address, City"
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Group 3: Academic Fields */}
          <div className="space-y-3 pt-3 border-t border-slate-200/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Academic Records
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Attendance Rate (%)</label>
                  {renderFieldStatus('attendance')}
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  required
                  disabled={!canEditAcademic}
                  value={formData.attendance}
                  onChange={(e) => setFormData({ ...formData, attendance: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Faculty Remarks</label>
                  {renderFieldStatus('remarks')}
                </div>
                <input
                  type="text"
                  disabled={!canEditAcademic}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="e.g. Lab performance notes"
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs shadow-blue-500/10 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Register Student'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
