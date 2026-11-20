import React, { useState } from 'react';
import {
  GraduationCap,
  Calendar,
  Building2,
  Phone,
  MapPin,
  ShieldCheck,
  Edit3,
  Clock,
  Printer,
  CheckCircle2,
  QrCode,
  User,
  HeartHandshake,
  BookOpen,
  X,
  Save,
  FileCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { StudentRecord, HistoryItem } from '../types';

interface StudentPortalPageProps {
  activeSubTab?: 'overview' | 'id-card' | 'student-history';
  onNavigateSubTab?: (tab: string) => void;
}

export const StudentPortalPage: React.FC<StudentPortalPageProps> = ({
  activeSubTab = 'overview'
}) => {
  const { currentUser, simulator, queueEditOperation, addToast } = useApp();
  const currentTab = activeSubTab;

  // Modal state for editing contact information
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    phone: '',
    address: '',
    emergency_contact: '',
  });

  // Query this student's live record
  const student = useLiveQuery(async () => {
    if (!currentUser) return null;
    if (currentUser.student_id) {
      const s = await db.students.get(currentUser.student_id);
      if (s) return s;
    }
    // Fallback: match by email or return first student
    const byEmail = await db.students.where('email').equals(currentUser.email).first();
    if (byEmail) return byEmail;
    return await db.students.toCollection().first();
  }, [currentUser?.student_id, currentUser?.email]) as StudentRecord | null | undefined;

  // Query outbox mutations for this student
  const studentOutbox = useLiveQuery(
    () => (student ? db.outbox.where('studentId').equals(student.id).toArray() : []),
    [student?.id]
  );

  // Query audit history strictly scoped to this student
  const studentHistory = useLiveQuery(
    async () => {
      if (!student) return [];
      const historyItems = await db.history
        .where('studentId')
        .equals(student.id)
        .reverse()
        .sortBy('id');
      return historyItems as HistoryItem[];
    },
    [student?.id]
  );

  const pendingOpsCount = studentOutbox?.filter((o) => o.status === 'pending' || o.status === 'syncing').length || 0;

  const openContactModal = () => {
    if (!student) return;
    setContactForm({
      phone: student.phone || '',
      address: student.address || '',
      emergency_contact: student.emergency_contact || '',
    });
    setIsEditContactModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    try {
      let changeCount = 0;
      if (contactForm.phone !== student.phone) {
        await queueEditOperation(
          student.id,
          'phone',
          contactForm.phone,
          student.phone,
          student.field_versions?.phone || 1
        );
        changeCount++;
      }
      if (contactForm.address !== student.address) {
        await queueEditOperation(
          student.id,
          'address',
          contactForm.address,
          student.address,
          student.field_versions?.address || 1
        );
        changeCount++;
      }
      if (contactForm.emergency_contact !== student.emergency_contact) {
        await queueEditOperation(
          student.id,
          'emergency_contact',
          contactForm.emergency_contact,
          student.emergency_contact,
          student.field_versions?.emergency_contact || 1
        );
        changeCount++;
      }

      if (changeCount > 0) {
        addToast(
          simulator.isOffline
            ? 'Contact details saved locally (Offline mode)'
            : 'Contact details updated and synced with campus registrar',
          'success'
        );
      } else {
        addToast('No changes detected', 'info');
      }
      setIsEditContactModalOpen(false);
    } catch (err: any) {
      addToast(`Error saving contact updates: ${err.message}`, 'danger');
    }
  };

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">Loading student credentials...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-slate-200/80 pb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {currentTab === 'overview' && 'My Record'}
          {currentTab === 'id-card' && 'Student ID Card'}
          {currentTab === 'student-history' && 'Activity Log'}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {currentTab === 'overview' && 'Verified academic profile and enrollment verification.'}
          {currentTab === 'id-card' && 'Official university identification for campus access, examinations, and library services.'}
          {currentTab === 'student-history' && 'Chronological audit of administrative actions and personal profile edits.'}
        </p>
      </div>

      {/* TAB 1: OVERVIEW */}
      {currentTab === 'overview' && (
        <div className="space-y-6">
          {/* Identity Header Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg tracking-wider shrink-0 shadow-xs">
                {student.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 truncate">{student.full_name}</h2>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    {student.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500 mt-1">
                  <span className="font-mono text-slate-700 font-medium">{student.reg_no}</span>
                  <span>•</span>
                  <span>{student.program}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {student.campus} Campus
                  </span>
                </div>
              </div>
            </div>

            {/* Sync Status Badge */}
            <div className="shrink-0 flex items-center gap-2">
              {pendingOpsCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  {pendingOpsCount} change(s) queued offline
                </span>
              ) : simulator.isOffline ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Offline (Local cache verified)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Verified & Synced with Registrar
                </span>
              )}
            </div>
          </div>

          {/* Academic Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-500">Current Semester</span>
                <BookOpen className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                Semester {student.semester}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Academic Year 2025–2026</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-500">Attendance Rate</span>
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight flex items-baseline gap-2">
                {student.attendance}%
                <span className="text-xs font-semibold text-emerald-600">
                  {student.attendance >= 75 ? 'Good Standing' : 'Low Attendance'}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    student.attendance >= 75 ? 'bg-slate-800' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, student.attendance))}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-500">Enrollment Status</span>
                <ShieldCheck className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                Regular Active
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Verified across all campus nodes</p>
            </div>
          </div>

          {/* Details 2-Column Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Official Academic & Identity (Read-Only) */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-slate-600" />
                    Official Academic Record
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">Registrar Managed</span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-start justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Registration Number</span>
                    <span className="font-mono font-semibold text-slate-900">{student.reg_no}</span>
                  </div>

                  <div className="flex items-start justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">National ID (CNIC)</span>
                    <span className="font-mono text-slate-700">
                      {student.cnic
                        ? student.cnic.slice(0, 5) + '-*******-' + student.cnic.slice(-1)
                        : 'Unregistered'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Program & Degree</span>
                    <span className="font-semibold text-slate-900">{student.program}</span>
                  </div>

                  <div className="flex items-start justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Campus Allocation</span>
                    <span className="text-slate-900 font-medium">{student.campus} Campus</span>
                  </div>

                  <div className="flex items-start justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Institutional Email</span>
                    <span className="font-mono text-slate-700">{student.email}</span>
                  </div>

                  <div className="pt-2">
                    <span className="text-slate-500 block mb-1">Faculty Remarks & Advising</span>
                    <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed italic text-[11px]">
                      {student.remarks || 'No disciplinary holds or special academic advisories on record.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Record Version: #{student.version}</span>
                <span>Last Updated: {new Date(student.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Right: Personal & Contact Details (Self-Service) */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-600" />
                    Personal & Contact Information
                  </h3>
                  <button
                    onClick={openContactModal}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Update Contact
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex items-start gap-3 p-3 bg-slate-50/70 rounded-lg border border-slate-200/50">
                    <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[11px] text-slate-500 block">Personal Phone Number</span>
                      <span className="font-medium text-slate-900 mt-0.5 block">
                        {student.phone || 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/70 rounded-lg border border-slate-200/50">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[11px] text-slate-500 block">Residential Address</span>
                      <span className="font-medium text-slate-900 mt-0.5 block leading-relaxed">
                        {student.address || 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50/70 rounded-lg border border-slate-200/50">
                    <HeartHandshake className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[11px] text-slate-500 block">Emergency Contact</span>
                      <span className="font-medium text-slate-900 mt-0.5 block leading-relaxed">
                        {student.emergency_contact || 'Not provided'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Self-service contact updates sync automatically across all campuses.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DIGITAL STUDENT ID CARD */}
      {currentTab === 'id-card' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs max-w-2xl mx-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Digital Student ID Card</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official university identification for campus access, examinations, and library services.
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Verification Slip
              </button>
            </div>

            {/* Realistic Student Card Layout (Clean Light Theme) */}
            <div className="relative rounded-2xl bg-white text-slate-900 p-6 sm:p-7 shadow-sm overflow-hidden border border-slate-200/90 max-w-md mx-auto">
              {/* Top Accent Stripe */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />

              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5 pt-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center font-bold text-blue-600 shadow-2xs">
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <span className="text-[10px] tracking-wider font-bold uppercase text-slate-500 block">
                      CampusSync University
                    </span>
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      {student.campus} Campus
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  {student.status}
                </span>
              </div>

              {/* Card Body: Photo Avatar + Details */}
              <div className="flex items-start gap-4">
                <div className="w-20 h-24 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0">
                  <div className="w-10 h-10 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-700 font-bold text-sm mb-1">
                    {student.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <span className="text-[9px] font-mono tracking-wider font-medium text-slate-400">
                    VERIFIED
                  </span>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">
                      Student Name
                    </span>
                    <h4 className="text-base font-bold text-slate-900 leading-tight truncate">
                      {student.full_name}
                    </h4>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">
                      Registration ID
                    </span>
                    <span className="inline-block text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                      {student.reg_no}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">
                      Degree Program
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {student.program} • Semester {student.semester}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer: QR Code & Security Stamp */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-slate-50 rounded-lg p-1.5 shrink-0 flex items-center justify-center border border-slate-200/80">
                    <QrCode className="w-full h-full text-slate-800" />
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono leading-tight">
                    <span className="block text-slate-700 font-medium">CARD ID: {student.id.slice(0, 8)}</span>
                    <span className="text-[9px] text-slate-400">VALID THRU: 08/2028</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                    Office of the Registrar
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium flex items-center justify-end gap-1 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Digitally Verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVITY LOG */}
      {currentTab === 'student-history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  My Record Activity & Updates
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological audit of administrative actions and personal profile edits for your record.
                </p>
              </div>
            </div>

            {!studentHistory || studentHistory.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <FileCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium text-slate-500">No recent modifications recorded on this account.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {studentHistory.map((item) => (
                  <div key={item.id} className="relative group">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-slate-800 border-2 border-white shadow-xs" />
                    <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/60">
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-semibold text-slate-900">
                          {item.field === '*'
                            ? 'Record Created'
                            : `Updated ${item.field.replace(/_/g, ' ')}`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        {item.field !== '*' && (
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-slate-400 line-through truncate max-w-[150px]">
                              {String(item.oldValue || 'None')}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="text-slate-900 font-semibold truncate max-w-[180px]">
                              {String(item.newValue)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1">
                          <span>Updated by: <strong className="text-slate-700">{item.actorName}</strong> ({item.actorRole})</span>
                          <span>•</span>
                          <span>Node: {item.actorCampus || 'Central'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Self-Service Edit Contact Modal */}
      {isEditContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200/80 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Update Contact Details</h3>
                <p className="text-[11px] text-slate-500">
                  Modifications will be saved locally and synchronized across university campus nodes.
                </p>
              </div>
              <button
                onClick={() => setIsEditContactModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder="0300-1234567"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Residential Address
                </label>
                <textarea
                  rows={2}
                  value={contactForm.address}
                  onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                  placeholder="House number, Street, City"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Emergency Contact (Name & Phone)
                </label>
                <input
                  type="text"
                  value={contactForm.emergency_contact}
                  onChange={(e) => setContactForm({ ...contactForm, emergency_contact: e.target.value })}
                  placeholder="Father: 0300-9876543"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditContactModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
