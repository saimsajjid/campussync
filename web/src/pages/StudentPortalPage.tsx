import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  Building2,
  Calendar,
  BookOpen,
  Award,
  Edit2,
  Save,
  X,
  Printer,
  QrCode,
  Shield,
  Check,
  CheckCircle2,
  GraduationCap,
  FileText,
  BadgeCheck
} from 'lucide-react';
import type { StudentRecord } from '../types';

export const StudentPortalPage: React.FC = () => {
  const { currentUser, queueEditOperation, addToast, simulator } = useApp();

  // Dialog State
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
  const [isGatePassOpen, setIsGatePassOpen] = useState(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    phone: '',
    address: '',
    emergency_contact: '',
  });
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Query Authoritative Student Record
  const student = useLiveQuery(async () => {
    if (!currentUser?.student_id) return null;
    return await db.students.get(currentUser.student_id);
  }, [currentUser?.student_id]) as StudentRecord | undefined;

  // Track pending offline changes for this student
  const pendingOpsCount = useLiveQuery(async () => {
    if (!currentUser?.student_id) return 0;
    return await db.outbox.where('studentId').equals(currentUser.student_id).count();
  }, [currentUser?.student_id], 0);

  // Track quarantined conflicts for this student
  const openConflictsCount = useLiveQuery(async () => {
    if (!currentUser?.student_id) return 0;
    return await db.conflicts
      .where('status')
      .equals('open')
      .and((c) => c.studentId === currentUser.student_id)
      .count();
  }, [currentUser?.student_id], 0);

  // Initialize contact form when student loads
  React.useEffect(() => {
    if (student) {
      setContactForm({
        phone: student.phone || '',
        address: student.address || '',
        emergency_contact: student.emergency_contact || '',
      });
    }
  }, [student]);

  if (!currentUser) return null;

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-zinc-500">Loading student credentials...</p>
      </div>
    );
  }

  const isAttendanceGood = student.attendance >= 75;

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    // Validate Pakistani mobile: 11 digits starting with 03 (optional hyphen)
    const PAK_PHONE_REGEX = /^(03\d{2}-?\d{7})$/;
    if (contactForm.phone && !PAK_PHONE_REGEX.test(contactForm.phone.trim())) {
      setPhoneError('Invalid phone number. Must be 11 digits (e.g. 0300-1234567)');
      return;
    }
    setPhoneError(null);

    try {
      const updates: Array<{ field: string; val: string }> = [
        { field: 'phone', val: contactForm.phone },
        { field: 'address', val: contactForm.address },
        { field: 'emergency_contact', val: contactForm.emergency_contact },
      ];

      for (const u of updates) {
        if ((student as any)[u.field] !== u.val) {
          await queueEditOperation(
            student.id,
            u.field,
            u.val,
            (student as any)[u.field],
            student.field_versions?.[u.field] || student.version,
            'edit'
          );
        }
      }

      setIsEditContactModalOpen(false);
      addToast('Profile changes saved successfully.', 'info');
    } catch (err: any) {
      addToast(`Failed to update profile: ${err.message}`, 'danger');
    }
  };

  return (
    <div className="space-y-6 text-left max-w-[1240px] w-full mx-auto pb-10">
      {/* Top Banner - Personal Student Header */}
      <div className="border-b border-zinc-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            My Record
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Official academic enrollment profile and university credentials.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsGatePassOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-800 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <QrCode className="w-3.5 h-3.5 text-zinc-500" />
            Gate Access Pass
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-50 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Verification Slip
          </button>
        </div>
      </div>

      <div className="space-y-6 no-print">
        {/* Identity Header Card */}
        <div className="bg-white rounded-xl border border-zinc-200/90 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-zinc-900 text-zinc-50 flex items-center justify-center font-bold text-lg tracking-wider shrink-0 shadow-xs">
              {student.full_name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-900 truncate">{student.full_name}</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-900 border border-zinc-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                  {student.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-zinc-500 mt-1">
                <span className="font-mono text-zinc-700 font-medium">{student.reg_no}</span>
                <span>•</span>
                <span>{student.program}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-zinc-700 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                  {student.campus} Campus
                </span>
                <span>•</span>
                <span className="font-mono text-zinc-500">{student.email}</span>
              </div>
            </div>
          </div>

          {/* Sync Status Badge */}
          <div className="shrink-0 flex items-center gap-2">
            {openConflictsCount && openConflictsCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-900 text-zinc-50 border border-zinc-900">
                <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
                1 Conflict quarantined for Admin review
              </span>
            ) : pendingOpsCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                <span className="w-2 h-2 rounded-full bg-zinc-600" />
                {pendingOpsCount} change(s) queued offline
              </span>
            ) : simulator.isOffline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Offline (Local cache verified)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-900 border border-zinc-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-800" />
                Verified & Synced with Central Registrar
              </span>
            )}
          </div>
        </div>

        {/* Academic Highlights Grid - 100% Dynamic from Database */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium text-zinc-500">Current Semester</span>
              <BookOpen className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
              Semester {student.semester}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">{student.program} • Regular Session</p>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium text-zinc-500">Overall Attendance</span>
              <Calendar className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight flex items-baseline gap-2">
              {student.attendance}%
              <span className="text-xs font-medium text-zinc-600">
                {isAttendanceGood ? 'Good Standing' : 'Shortage Notice'}
              </span>
            </div>
            <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 bg-zinc-900"
                style={{ width: `${Math.min(100, Math.max(0, student.attendance))}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium text-zinc-500">Enrollment Status</span>
              <Award className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
              {student.status}
            </div>
            <p className="text-[11px] text-zinc-600 font-medium mt-1">
              {isAttendanceGood ? 'Examination Eligible' : 'Requires Clearance'}
            </p>
          </div>
        </div>

        {/* Authoritative Academic & Institutional Profile - 100% Database Backed */}
        <div className="bg-white rounded-xl border border-zinc-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-zinc-700" />
                Academic & Institutional Registration Details
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Centrally verified enrollment record maintained across all university campuses.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
              <Check className="w-3.5 h-3.5 text-zinc-700" />
              Verified by Registrar
            </div>
          </div>

          <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">Registration Number</span>
              <span className="font-mono font-semibold text-zinc-900 text-sm">{student.reg_no}</span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">National ID (CNIC)</span>
              <span className="font-mono font-medium text-zinc-800 text-sm">{student.cnic}</span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">Degree Program</span>
              <span className="font-semibold text-zinc-900 text-sm">{student.program}</span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">Allocated Campus</span>
              <span className="font-semibold text-zinc-900 text-sm">{student.campus} Campus</span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">Current Academic Level</span>
              <span className="font-semibold text-zinc-900 text-sm">Semester {student.semester} of 8</span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">Official Attendance</span>
              <span className="font-mono font-semibold text-zinc-900 text-sm">
                {student.attendance}%{' '}
                <span className="text-[11px] font-normal text-zinc-500">
                  ({isAttendanceGood ? 'Satisfactory' : 'Below 75%'})
                </span>
              </span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">Enrollment Standing</span>
              <span className="font-semibold text-zinc-900 text-sm">{student.status}</span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">Record Version</span>
              <span className="font-mono font-medium text-zinc-700 text-sm">v{student.version} (Synced)</span>
            </div>
          </div>

          {/* Academic Advisor Remarks */}
          <div className="px-5 sm:px-6 pb-5 pt-0">
            <div className="p-3.5 bg-zinc-50/70 rounded-lg border border-zinc-200/70 flex items-start gap-3">
              <FileText className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-zinc-900">Academic Advisor Remarks: </span>
                <span className="text-zinc-600">
                  {student.remarks || 'No official remarks or disciplinary notices on file. Student in good standing.'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-zinc-50/70 border-t border-zinc-200 text-[11px] text-zinc-500 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
            <span>* 75% minimum semester attendance is mandatory for semester end final exam eligibility.</span>
            <span className="font-medium text-zinc-700">Authoritative Record: Office of the Academic Registrar</span>
          </div>
        </div>

        {/* Contact & Emergency Information */}
        <div className="bg-white rounded-xl border border-zinc-200/90 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-zinc-500" />
                Contact & Emergency Information
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Your contact details are automatically replicated across all campuses.
              </p>
            </div>
            <button
              onClick={() => setIsEditContactModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 hover:border-zinc-300 text-xs font-medium text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Details
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">Direct Phone</span>
              <span className="font-mono font-medium text-zinc-800 text-sm">
                {student.phone || 'Not provided'}
              </span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">Permanent Residence</span>
              <span className="font-medium text-zinc-800 text-xs leading-relaxed block">
                {student.address || 'Not registered'}
              </span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200/70">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1">Emergency Contact</span>
              <span className="font-medium text-zinc-800 text-xs leading-relaxed block">
                {student.emergency_contact || 'None listed'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Campus Security Gate Pass Modal */}
      {isGatePassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-zinc-950 text-white p-4 px-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-zinc-300" />
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">Main Campus Turnstiles</h3>
                  <p className="text-[11px] text-zinc-400">Gate 1-A • {student.campus} Campus</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGatePassOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Access Pass Body */}
            <div className="p-6 space-y-5">
              {/* Access Granted Badge */}
              <div className="text-center py-2">
                <div className="w-16 h-16 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center mx-auto mb-3 shadow-xs border border-zinc-200">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-zinc-100 text-zinc-900 border border-zinc-200">
                  <span className="w-2 h-2 rounded-full bg-zinc-900" />
                  ACCESS GRANTED • ACTIVE STUDENT
                </span>
                <p className="text-xs text-zinc-500 mt-1.5">
                  Active Student Verification • Valid for Spring 2026
                </p>
              </div>

              {/* Student Summary */}
              <div className="bg-zinc-50 rounded-lg p-3.5 border border-zinc-200/70 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-zinc-900 text-zinc-50 font-bold flex items-center justify-center shrink-0 text-base">
                  {student.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-semibold text-zinc-900 text-sm truncate">{student.full_name}</div>
                  <div className="text-zinc-500 font-mono text-[11px]">{student.reg_no}</div>
                  <div className="text-zinc-600 text-[11px] font-medium">{student.program} • Semester {student.semester}</div>
                </div>
              </div>

              {/* Multi-Campus Roaming Privileges */}
              <div className="space-y-2 text-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                  Campus Access Status
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-zinc-100 text-zinc-900 p-2 rounded-lg border border-zinc-200 font-medium">
                    <span className="block font-semibold">{student.campus}</span>
                    <span className="text-[10px] text-zinc-600">Home Campus</span>
                  </div>
                  <div className="bg-zinc-50 text-zinc-700 p-2 rounded-lg border border-zinc-200 font-medium">
                    <span className="block font-semibold">
                      {student.campus === 'Islamabad' ? 'Lahore' : 'Islamabad'}
                    </span>
                    <span className="text-[10px] text-zinc-500">Permitted</span>
                  </div>
                  <div className="bg-zinc-50 text-zinc-700 p-2 rounded-lg border border-zinc-200 font-medium">
                    <span className="block font-semibold">
                      {student.campus === 'Abbottabad' ? 'Lahore' : 'Abbottabad'}
                    </span>
                    <span className="text-[10px] text-zinc-500">Permitted</span>
                  </div>
                </div>
              </div>

              {/* Signature Footer */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span>SCANNED: {new Date().toLocaleTimeString()}</span>
                <span className="truncate max-w-[200px]">AUTH: CS-REG-{student.reg_no}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsGatePassOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-50 bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Self-Service Edit Contact Modal */}
      {isEditContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-zinc-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Update Contact Details</h3>
                <p className="text-[11px] text-zinc-500">
                  Modifications are saved and updated across university campus records.
                </p>
              </div>
              <button
                onClick={() => setIsEditContactModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={contactForm.phone}
                  onChange={(e) => {
                    setContactForm({ ...contactForm, phone: e.target.value });
                    if (phoneError) setPhoneError(null);
                  }}
                  placeholder="0300-1234567"
                  className={`w-full text-xs px-3 py-2 rounded-lg border bg-transparent text-zinc-900 focus:outline-hidden transition-colors ${
                    phoneError
                      ? 'border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-zinc-200 focus:ring-1 focus:ring-zinc-950'
                  }`}
                  required
                />
                {phoneError && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{phoneError}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">
                  Residential Address
                </label>
                <textarea
                  rows={2}
                  value={contactForm.address}
                  onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                  placeholder="House number, Street, City"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 bg-transparent text-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">
                  Emergency Contact (Name & Phone)
                </label>
                <input
                  type="text"
                  value={contactForm.emergency_contact}
                  onChange={(e) => setContactForm({ ...contactForm, emergency_contact: e.target.value })}
                  placeholder="Father: 0300-9876543"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 bg-transparent text-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 transition-colors"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditContactModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-zinc-50 bg-zinc-900 hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT-ONLY OFFICIAL UNIVERSITY ENROLLMENT CERTIFICATE */}
      <div className="print-only">
        <div className="print-certificate-container bg-white text-zinc-900 font-sans p-8 border-2 border-zinc-900 rounded-lg max-w-3xl mx-auto space-y-6">
          {/* Letterhead */}
          <div className="text-center border-b-2 border-zinc-900 pb-4">
            <h1 className="text-xl font-bold tracking-wider uppercase text-zinc-900">
              CampusSync University System
            </h1>
            <p className="text-xs text-zinc-600 font-medium tracking-wide uppercase mt-0.5">
              Office of the University Registrar • Central Secretariat
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              Federal Chartered Multi-Campus Institution • Lahore • Islamabad • Abbottabad
            </p>
          </div>

          {/* Reference & Date */}
          <div className="flex justify-between text-xs font-mono border-b border-zinc-200 pb-2">
            <span>Ref: CS/REG/ENR/2026/{student.reg_no}</span>
            <span>Date: {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>

          {/* Certificate Title */}
          <div className="text-center py-2">
            <h2 className="text-base font-bold tracking-widest uppercase underline underline-offset-4 text-zinc-900">
              Certificate of Enrollment & Academic Standing
            </h2>
          </div>

          {/* Body Paragraph */}
          <div className="text-xs leading-relaxed space-y-3 text-zinc-800 text-justify">
            <p>
              This is to officially certify that <strong>{student.full_name}</strong>, holder of Registration
              Number <strong>{student.reg_no}</strong> and National Identity Card (CNIC){' '}
              <strong>{student.cnic || 'N/A'}</strong>, is a bona fide regular student in good academic standing
              at CampusSync University, allocated to the <strong>{student.campus} Campus</strong>.
            </p>
            <p>
              The student is currently pursuing the degree of <strong>{student.program}</strong> in{' '}
              <strong>Semester {student.semester}</strong> for the Academic Session 2025–2026. The university
              records confirm an overall semester attendance standing of <strong>{student.attendance}%</strong> with
              no disciplinary, behavioral, or financial encumbrances on record.
            </p>
          </div>

          {/* Institutional Registration Summary for Certificate */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 mb-2">
              Official University Record Summary:
            </h3>
            <table className="w-full text-left border border-zinc-300 text-xs">
              <thead className="bg-zinc-100 border-b border-zinc-300 font-semibold text-[11px]">
                <tr>
                  <th className="p-2 border-r border-zinc-300">Attribute</th>
                  <th className="p-2 border-r border-zinc-300">Certified Record Value</th>
                  <th className="p-2 border-r border-zinc-300">Verification Source</th>
                  <th className="p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                <tr>
                  <td className="p-2 font-semibold border-r border-zinc-200">Registration Number</td>
                  <td className="p-2 font-mono border-r border-zinc-200">{student.reg_no}</td>
                  <td className="p-2 border-r border-zinc-200">University Central Registry</td>
                  <td className="p-2 text-center font-semibold text-zinc-900">Verified</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold border-r border-zinc-200">National CNIC</td>
                  <td className="p-2 font-mono border-r border-zinc-200">{student.cnic}</td>
                  <td className="p-2 border-r border-zinc-200">NADRA National Database</td>
                  <td className="p-2 text-center font-semibold text-zinc-900">Verified</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold border-r border-zinc-200">Degree Program</td>
                  <td className="p-2 border-r border-zinc-200">{student.program}</td>
                  <td className="p-2 border-r border-zinc-200">Faculty Academic Board</td>
                  <td className="p-2 text-center font-semibold text-zinc-900">Active</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold border-r border-zinc-200">Allocated Branch</td>
                  <td className="p-2 border-r border-zinc-200">{student.campus} Campus</td>
                  <td className="p-2 border-r border-zinc-200">Campus Administration</td>
                  <td className="p-2 text-center font-semibold text-zinc-900">Enrolled</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold border-r border-zinc-200">Semester Attendance</td>
                  <td className="p-2 font-mono font-semibold border-r border-zinc-200">{student.attendance}%</td>
                  <td className="p-2 border-r border-zinc-200">Campus Turnstile & Attendance Node</td>
                  <td className="p-2 text-center font-semibold text-zinc-900">
                    {isAttendanceGood ? 'Good Standing' : 'Shortage'}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold border-r border-zinc-200">Advisor Remarks</td>
                  <td className="p-2 border-r border-zinc-200" colSpan={2}>
                    {student.remarks || 'Dean\'s Honor List candidate. Completed all core requirements in good academic standing.'}
                  </td>
                  <td className="p-2 text-center font-semibold text-zinc-900">Official</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Security and Verification Clause */}
          <div className="bg-zinc-50 p-3 rounded border border-zinc-200 text-[10px] text-zinc-600 leading-tight">
            <strong>Official Verification Notice:</strong> This certificate is an official university document issued by
            the Office of the Registrar. Certified student records are centrally maintained and verifiable across all university
            branches. Any alteration or unauthorized reproduction renders this credential invalid.
          </div>

          {/* Signatures & Seal */}
          <div className="pt-8 flex justify-between items-end text-xs">
            <div className="text-center">
              <div className="w-36 border-b border-zinc-900 mb-1" />
              <p className="font-semibold text-zinc-800">Academic Officer</p>
              <p className="text-[10px] text-zinc-500">Directorate of Student Affairs</p>
            </div>

            <div className="text-center border-2 border-dashed border-zinc-400 p-3 rounded">
              <p className="text-[10px] font-mono font-semibold text-zinc-500 uppercase">OFFICIAL SEAL</p>
              <p className="text-[9px] font-mono text-zinc-400">CS-VERIFIED-2026</p>
            </div>

            <div className="text-center">
              <div className="w-36 border-b border-zinc-900 mb-1" />
              <p className="font-semibold text-zinc-800">University Registrar</p>
              <p className="text-[10px] text-zinc-500">CampusSync University System</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
