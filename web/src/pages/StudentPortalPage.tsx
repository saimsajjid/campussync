import React, { useState } from 'react';
import {
  GraduationCap,
  Calendar,
  Building2,
  Phone,
  MapPin,
  ShieldCheck,
  Edit3,
  Printer,
  CheckCircle2,
  QrCode,
  HeartHandshake,
  BookOpen,
  X,
  Save,
  Award,
  Shield,
  Check,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { StudentRecord } from '../types';

interface EnrolledCourse {
  code: string;
  title: string;
  credits: number;
  instructor: string;
  room: string;
  schedule: string;
  attendanceRate: number;
  isPrimarySyncCourse?: boolean;
}

export const StudentPortalPage: React.FC = () => {
  const { currentUser, simulator, queueEditOperation, addToast } = useApp();

  // Modal state for editing contact information
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    phone: '',
    address: '',
    emergency_contact: '',
  });

  // Modal state for Interactive Security Gate Pass
  const [isGatePassOpen, setIsGatePassOpen] = useState(false);

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

  // Course Roster for Semester 4 (CS-304 connects dynamically to student.attendance!)
  const enrolledCourses: EnrolledCourse[] = [
    {
      code: 'CS-304',
      title: 'Database Systems',
      credits: 4,
      instructor: 'Prof. Ahmed (Lahore)',
      room: 'CS Lab 3',
      schedule: 'Mon, Wed 10:00 - 11:30',
      attendanceRate: student.attendance, // Dynamically driven by live faculty updates!
      isPrimarySyncCourse: true,
    },
    {
      code: 'CS-301',
      title: 'Data Structures & Algorithms',
      credits: 4,
      instructor: 'Dr. Tariq Khan',
      room: 'Hall B',
      schedule: 'Tue, Thu 08:30 - 10:00',
      attendanceRate: 92,
    },
    {
      code: 'SE-302',
      title: 'Software Engineering Processes',
      credits: 3,
      instructor: 'Assoc. Prof. Sara Malik',
      room: 'Room 204',
      schedule: 'Mon, Fri 12:00 - 01:15',
      attendanceRate: 88,
    },
    {
      code: 'MT-202',
      title: 'Linear Algebra & Diff Equations',
      credits: 3,
      instructor: 'Dr. Usman Farooq',
      room: 'Hall C',
      schedule: 'Tue, Thu 11:30 - 01:00',
      attendanceRate: 85,
    },
    {
      code: 'HU-104',
      title: 'Technical & Professional Writing',
      credits: 2,
      instructor: 'Lecturer Ayesha Noor',
      room: 'Room 102',
      schedule: 'Wed 02:00 - 03:30',
      attendanceRate: 94,
    },
  ];

  const totalCredits = enrolledCourses.reduce((acc, c) => acc + c.credits, 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="border-b border-slate-200/80 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            My Record
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified academic profile, registered semester courses, and enrollment verification.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsGatePassOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/70 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <QrCode className="w-3.5 h-3.5 text-blue-600" />
            Gate Access Pass
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Verification Slip
          </button>
        </div>
      </div>

      <div className="space-y-6 no-print">
        {/* Identity Header Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg tracking-wider shrink-0 shadow-xs">
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
                <span>•</span>
                <span className="font-mono text-slate-600">{student.email}</span>
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
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              Semester {student.semester}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Spring 2026 • 16 Credit Hours</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium text-slate-500">Overall Attendance</span>
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight flex items-baseline gap-2">
              {student.attendance}%
              <span className={`text-xs font-semibold ${student.attendance >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {student.attendance >= 75 ? 'Good Standing' : 'Shortage Notice'}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  student.attendance >= 75 ? 'bg-blue-600' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, student.attendance))}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium text-slate-500">Academic Standing</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              CGPA 3.68
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">Dean's Honor List • Regular Active</p>
          </div>
        </div>

        {/* Registered Semester Courses Roster */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Semester {student.semester} Registered Course Roster
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Spring 2026 Academic Session • {totalCredits} Total Registered Credit Hours
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium border border-blue-200/50">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Course Registration Confirmed
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/75 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="py-3 px-4 sm:px-6">Course Code & Title</th>
                  <th className="py-3 px-4">Credits</th>
                  <th className="py-3 px-4">Instructor</th>
                  <th className="py-3 px-4">Schedule / Room</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {enrolledCourses.map((c) => {
                  const isGood = c.attendanceRate >= 75;
                  return (
                    <tr key={c.code} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="font-semibold text-slate-900">{c.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50">
                            {c.code}
                          </span>
                          {c.isPrimarySyncCourse && (
                            <span className="text-[10px] text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50">
                              Core Course
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {c.credits} Cr
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800">{c.instructor}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div>{c.schedule}</div>
                        <div className="text-slate-400 font-mono text-[10px] mt-0.5">{c.room}</div>
                      </td>
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <div className="flex items-center justify-between text-[11px] font-medium mb-1">
                          <span className="font-mono font-bold text-slate-800">{c.attendanceRate}%</span>
                          <span className={`text-[10px] font-semibold ${isGood ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {isGood ? 'Satisfactory' : 'Warning'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isGood ? 'bg-blue-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, c.attendanceRate))}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                            isGood
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}
                        >
                          {isGood ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" /> Exam Eligible
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-amber-600" /> Shortage
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
            <span>* 75% minimum course attendance is mandatory for semester end final exam eligibility.</span>
            <span className="font-medium text-slate-700">Course Roster Status: Certified by Academic Registrar</span>
          </div>
        </div>

        {/* Contact & Residency Information (Self-Service) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                Contact & Emergency Information
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Your contact information is maintained and updated across all university campus systems.
              </p>
            </div>
            <button
              onClick={openContactModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 rounded-lg transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Update Contact
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="flex items-start gap-3 p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/50">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 block font-medium">Personal Phone</span>
                <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                  {student.phone || 'Not provided'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/50">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 block font-medium">Residential Address</span>
                <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                  {student.address || 'Not provided'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-slate-50/70 rounded-lg border border-slate-200/50">
              <HeartHandshake className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 block font-medium">Emergency Contact</span>
                <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                  {student.emergency_contact || 'Not provided'}
                </span>
              </div>
            </div>
          </div>

          {student.remarks && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600 bg-slate-50/50 p-2.5 rounded-lg border border-slate-200/40">
              <span className="font-semibold text-slate-800 shrink-0">Academic Advisor Remarks:</span>
              <span className="italic text-slate-600">{student.remarks}</span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Campus Security Gate Pass Modal */}
      {isGatePassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 px-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Main Campus Turnstiles</h3>
                  <p className="text-[11px] text-slate-400">Gate 1-A • Lahore Campus</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGatePassOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Access Pass Body */}
            <div className="p-6 space-y-5">
              {/* Access Granted Badge */}
              <div className="text-center py-2">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-sm ring-8 ring-emerald-50">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-emerald-50 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  ACCESS GRANTED • ACTIVE STUDENT
                </span>
                <p className="text-xs text-slate-500 mt-1.5">
                  Active Student Verification • Valid for Spring 2026
                </p>
              </div>

              {/* Student Summary */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-base">
                  {student.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-bold text-slate-900 text-sm truncate">{student.full_name}</div>
                  <div className="text-slate-500 font-mono text-[11px]">{student.reg_no}</div>
                  <div className="text-slate-600 text-[11px] font-medium">{student.program} • Semester {student.semester}</div>
                </div>
              </div>

              {/* Multi-Campus Roaming Privileges */}
              <div className="space-y-2 text-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Campus Access Status
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200/60 font-medium">
                    <span className="block font-bold">Lahore</span>
                    <span className="text-[10px] text-emerald-600">Home Campus</span>
                  </div>
                  <div className="bg-blue-50 text-blue-800 p-2 rounded-lg border border-blue-200/60 font-medium">
                    <span className="block font-bold">Islamabad</span>
                    <span className="text-[10px] text-blue-600">Access Permitted</span>
                  </div>
                  <div className="bg-blue-50 text-blue-800 p-2 rounded-lg border border-blue-200/60 font-medium">
                    <span className="block font-bold">Abbottabad</span>
                    <span className="text-[10px] text-blue-600">Access Permitted</span>
                  </div>
                </div>
              </div>

              {/* Security Zones Authorized */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Authorized University Areas
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded border border-slate-200/50">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Main Turnstiles 1-A</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded border border-slate-200/50">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Central Library</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded border border-slate-200/50">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>CS Laboratories</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded border border-slate-200/50">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Hostel & Cafeteria</span>
                  </div>
                </div>
              </div>

              {/* Cryptographic Signature Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>SCANNED: {new Date().toLocaleTimeString()}</span>
                <span className="truncate max-w-[200px]">AUTH CODE: CS-REG-{student.reg_no}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsGatePassOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Self-Service Edit Contact Modal */}
      {isEditContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200/80 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Update Contact Details</h3>
                <p className="text-[11px] text-slate-500">
                  Modifications are saved and updated across university campus records.
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
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
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
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
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
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
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
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
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
        <div className="print-certificate-container bg-white text-slate-900 font-sans p-8 border-2 border-slate-900 rounded-lg max-w-3xl mx-auto space-y-6">
          {/* Letterhead */}
          <div className="text-center border-b-2 border-slate-900 pb-4">
            <h1 className="text-xl font-bold tracking-wider uppercase text-slate-900">
              CampusSync University System
            </h1>
            <p className="text-xs text-slate-600 font-medium tracking-wide uppercase mt-0.5">
              Office of the University Registrar • Central Secretariat
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Federal Chartered Multi-Campus Institution • Lahore • Islamabad • Abbottabad
            </p>
          </div>

          {/* Reference & Date */}
          <div className="flex justify-between text-xs font-mono border-b border-slate-200 pb-2">
            <span>Ref: CS/REG/ENR/2026/{student.reg_no}</span>
            <span>Date: {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>

          {/* Certificate Title */}
          <div className="text-center py-2">
            <h2 className="text-base font-bold tracking-widest uppercase underline underline-offset-4 text-slate-900">
              Certificate of Enrollment & Academic Standing
            </h2>
          </div>

          {/* Body Paragraph */}
          <div className="text-xs leading-relaxed space-y-3 text-slate-800 text-justify">
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

          {/* Course Roster Summary for Certificate */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
              Semester Registered Courses:
            </h3>
            <table className="w-full text-left border border-slate-300 text-xs">
              <thead className="bg-slate-100 border-b border-slate-300 font-semibold text-[11px]">
                <tr>
                  <th className="p-2 border-r border-slate-300">Course Code</th>
                  <th className="p-2 border-r border-slate-300">Course Title</th>
                  <th className="p-2 border-r border-slate-300 text-center">Cr. Hrs</th>
                  <th className="p-2 border-r border-slate-300">Instructor</th>
                  <th className="p-2 text-center">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {enrolledCourses.map((c) => (
                  <tr key={c.code}>
                    <td className="p-2 font-mono font-semibold border-r border-slate-200">{c.code}</td>
                    <td className="p-2 border-r border-slate-200">{c.title}</td>
                    <td className="p-2 text-center font-mono border-r border-slate-200">{c.credits}</td>
                    <td className="p-2 border-r border-slate-200">{c.instructor}</td>
                    <td className="p-2 text-center font-mono font-semibold">{c.attendanceRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Security and Verification Clause */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200 text-[10px] text-slate-600 leading-tight">
            <strong>Official Verification Notice:</strong> This certificate is an official university document issued by
            the Office of the Registrar. Certified student records are centrally maintained and verifiable across all university
            branches. Any alteration or unauthorized reproduction renders this credential invalid.
          </div>

          {/* Signatures & Seal */}
          <div className="pt-8 flex justify-between items-end text-xs">
            <div className="text-center">
              <div className="w-36 border-b border-slate-900 mb-1" />
              <p className="font-semibold text-slate-800">Academic Officer</p>
              <p className="text-[10px] text-slate-500">Directorate of Student Affairs</p>
            </div>

            <div className="text-center border-2 border-dashed border-slate-400 p-3 rounded">
              <p className="text-[10px] font-mono font-semibold text-slate-500 uppercase">OFFICIAL SEAL</p>
              <p className="text-[9px] font-mono text-slate-400">CS-VERIFIED-2026</p>
            </div>

            <div className="text-center">
              <div className="w-36 border-b border-slate-900 mb-1" />
              <p className="font-semibold text-slate-800">University Registrar</p>
              <p className="text-[10px] text-slate-500">CampusSync University System</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
