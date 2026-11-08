import React, { useState, useEffect } from 'react';
import { X, Lock, AlertCircle, CheckCircle2, Save, UserPlus, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from './StatusBadge';
import { db } from '../db';
import type { StudentRecord, CampusCode, ProgramCode, StudentStatus, FieldStatusType } from '../types';

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
  const { currentUser, queueEditOperation, addToast } = useApp();

  const isEditing = Boolean(studentToEdit);

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

  useEffect(() => {
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
        reg_no: `CS-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        cnic: `37405-${Math.floor(1000000 + Math.random() * 9000000)}-1`,
        full_name: '',
        program: 'BS CS',
        campus: 'Islamabad',
        semester: 1,
        status: 'Active',
        phone: '0300-5551234',
        email: '',
        address: '',
        emergency_contact: 'Guardian (0300-0000000)',
        attendance: 85,
        remarks: '',
      });
    }
    setDuplicateWarning(null);
    setValidationError(null);
  }, [studentToEdit, isOpen]);

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

  const getFieldStatus = (field: string): FieldStatusType => {
    if (currentUser.role === 'student' && !['phone', 'email', 'address', 'emergency_contact'].includes(field)) {
      return 'locked';
    }
    if (currentUser.role === 'faculty' && !['attendance', 'remarks'].includes(field)) {
      return 'locked';
    }
    return 'synced';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Cross-field validation: Graduated requires semester 8
    if (formData.status === 'Graduated' && formData.semester !== 8) {
      setValidationError('Validation Error: A student with status "Graduated" must be in Semester 8.');
      return;
    }

    if (duplicateWarning) {
      setValidationError('Cannot save: Resolve the duplicate registration number or CNIC first.');
      return;
    }

    if (isEditing && studentToEdit) {
      // Find modified fields and queue operations
      let changedCount = 0;
      for (const [key, val] of Object.entries(formData)) {
        const fieldKey = key as keyof typeof formData;
        if (studentToEdit[fieldKey] !== val) {
          await queueEditOperation(
            studentToEdit.id,
            fieldKey,
            val,
            studentToEdit[fieldKey],
            studentToEdit.field_versions[fieldKey] || 1
          );
          changedCount++;
        }
      }

      if (changedCount === 0) {
        addToast('No changes detected', 'info');
      }
    } else {
      // Create new student record with client-generated UUID (D8)
      const newId = 'e01a8f90-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
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
      await queueEditOperation(newId, '*', newStudent, null, 0);
      addToast(`New student ${newStudent.full_name} (${newStudent.reg_no}) registered offline`, 'success');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[var(--color-border-subtle)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
              {isEditing ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--color-text-dark)]">
                {isEditing ? `Edit Student: ${studentToEdit?.full_name}` : 'Register New Student Record'}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {isEditing ? `ID: ${studentToEdit?.reg_no} • Server Version: v${studentToEdit?.version}` : 'Creates offline-safe client UUID'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-border-subtle)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
          {/* Duplicate Warning Alert */}
          {duplicateWarning && (
            <div className="p-3.5 rounded-xl bg-[var(--color-status-danger-subtle)] border border-[var(--color-status-conflict-border)] flex items-start gap-3 text-[var(--color-status-danger-text)]">
              <AlertTriangle className="w-5 h-5 text-[var(--color-status-danger-red)] flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold block">Duplicate Detected (FR-10):</span>
                <span>{duplicateWarning}</span>
              </div>
            </div>
          )}

          {/* Validation Error Alert */}
          {validationError && (
            <div className="p-3.5 rounded-xl bg-[var(--color-status-rejected-bg)] border border-[var(--color-status-rejected-border)] flex items-start gap-3 text-[var(--color-status-rejected-text)]">
              <AlertCircle className="w-5 h-5 text-[var(--color-status-rejected-text)] flex-shrink-0 mt-0.5" />
              <div className="text-xs font-semibold">{validationError}</div>
            </div>
          )}

          {/* Group 1: Identity & Official Records */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center justify-between">
              <span>Official University Details</span>
              {!canEditOfficial && (
                <span className="text-[10px] text-amber-700 flex items-center gap-1 font-semibold">
                  <Lock className="w-3 h-3" /> Admin Only
                </span>
              )}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">Full Name</label>
                  <StatusBadge status={getFieldStatus('full_name')} />
                </div>
                <input
                  type="text"
                  required
                  disabled={!canEditOfficial}
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Muhammad Ahmed"
                  className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                />
              </div>

              {/* Registration Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">Registration Number (Unique)</label>
                  <StatusBadge status={getFieldStatus('reg_no')} />
                </div>
                <input
                  type="text"
                  required
                  disabled={!canEditOfficial}
                  value={formData.reg_no}
                  onChange={(e) => setFormData({ ...formData, reg_no: e.target.value })}
                  placeholder="e.g. CS-2026-0147"
                  className="w-full text-xs font-mono font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                />
              </div>

              {/* CNIC (National ID) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">National ID / CNIC (13 Digits)</label>
                  <StatusBadge status={getFieldStatus('cnic')} />
                </div>
                <input
                  type="text"
                  required
                  disabled={!canEditOfficial}
                  value={formData.cnic}
                  onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  placeholder="e.g. 37405-1234567-1"
                  className="w-full text-xs font-mono font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                />
              </div>

              {/* Campus */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">Campus</label>
                  <StatusBadge status={getFieldStatus('campus')} />
                </div>
                <select
                  disabled={!canEditOfficial}
                  value={formData.campus}
                  onChange={(e) => setFormData({ ...formData, campus: e.target.value as CampusCode })}
                  className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                >
                  <option value="Islamabad">Islamabad</option>
                  <option value="Lahore">Lahore</option>
                  <option value="Abbottabad">Abbottabad</option>
                </select>
              </div>

              {/* Program */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">Program</label>
                  <StatusBadge status={getFieldStatus('program')} />
                </div>
                <select
                  disabled={!canEditOfficial}
                  value={formData.program}
                  onChange={(e) => setFormData({ ...formData, program: e.target.value as ProgramCode })}
                  className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                >
                  <option value="BS CS">BS Computer Science</option>
                  <option value="BS SE">BS Software Engineering</option>
                  <option value="BS EE">BS Electrical Engineering</option>
                </select>
              </div>

              {/* Semester & Status */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[var(--color-text-dark)]">Semester</label>
                  </div>
                  <select
                    disabled={!canEditOfficial}
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })}
                    className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Sem {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[var(--color-text-dark)]">Status</label>
                  </div>
                  <select
                    disabled={!canEditOfficial}
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as StudentStatus })}
                    className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                  >
                    <option value="Active">Active</option>
                    <option value="On leave">On leave</option>
                    <option value="Graduated">Graduated</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Personal / Contact Details */}
          <div className="space-y-3 pt-3 border-t border-[var(--color-border-subtle)]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center justify-between">
              <span>Contact Information (Editable by Student & Admin)</span>
              {!canEditContact && (
                <span className="text-[10px] text-amber-700 flex items-center gap-1 font-semibold">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">Mobile Phone</label>
                  <StatusBadge status={getFieldStatus('phone')} />
                </div>
                <input
                  type="tel"
                  required
                  disabled={!canEditContact}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0300-1234567"
                  className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">Email Address</label>
                  <StatusBadge status={getFieldStatus('email')} />
                </div>
                <input
                  type="email"
                  required
                  disabled={!canEditContact}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="student@campussync.edu.pk"
                  className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">Emergency Contact</label>
                  <StatusBadge status={getFieldStatus('emergency_contact')} />
                </div>
                <input
                  type="text"
                  required
                  disabled={!canEditContact}
                  value={formData.emergency_contact}
                  onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                  placeholder="Name (Phone)"
                  className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">Home / Residency Address</label>
                  <StatusBadge status={getFieldStatus('address')} />
                </div>
                <input
                  type="text"
                  required
                  disabled={!canEditContact}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address, City"
                  className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                />
              </div>
            </div>
          </div>

          {/* Group 3: Academic Fields */}
          <div className="space-y-3 pt-3 border-t border-[var(--color-border-subtle)]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center justify-between">
              <span>Academic Data (Editable by Faculty & Admin)</span>
              {!canEditAcademic && (
                <span className="text-[10px] text-amber-700 flex items-center gap-1 font-semibold">
                  <Lock className="w-3 h-3" /> Faculty Only
                </span>
              )}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">Attendance Rate (%)</label>
                  <StatusBadge status={getFieldStatus('attendance')} />
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  disabled={!canEditAcademic}
                  value={formData.attendance}
                  onChange={(e) => setFormData({ ...formData, attendance: parseInt(e.target.value) || 0 })}
                  className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--color-text-dark)]">Faculty Remarks</label>
                  <StatusBadge status={getFieldStatus('remarks')} />
                </div>
                <input
                  type="text"
                  disabled={!canEditAcademic}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="e.g. Lab performance notes"
                  className="w-full text-xs font-medium bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-lg p-2 text-[var(--color-text-dark)] disabled:opacity-60 disabled:bg-[var(--color-surface-slate-100)]"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)] hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl shadow-md shadow-[var(--color-primary)]/20 flex items-center gap-1.5 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes to Outbox' : 'Register Student'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
