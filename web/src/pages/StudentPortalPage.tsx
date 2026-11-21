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
  AlertCircle,
  GraduationCap
} from 'lucide-react';
import type { StudentRecord } from '../types';

interface CourseRegistration {
  code: string;
  title: string;
  credits: number;
  instructor: string;
  schedule: string;
  room: string;
  attendanceRate: number;
}

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

  // Enrolled Courses Data for Semester
  const enrolledCourses: CourseRegistration[] = [
    {
      code: 'CS-401',
      title: 'Distributed Systems & Cloud Computing',
      credits: 4,
      instructor: 'Dr. Tariq Mahmood',
      schedule: 'Mon, Wed 09:00 - 10:30 AM',
      room: 'CS Lab 3',
      attendanceRate: 92,
    },
    {
      code: 'CS-405',
      title: 'Advanced Database Systems',
      credits: 4,
      instructor: 'Dr. Ayesha Siddiqa',
      schedule: 'Tue, Thu 11:00 - 12:30 PM',
      room: 'Hall B',
      attendanceRate: 88,
    },
    {
      code: 'SE-302',
      title: 'Software Quality Assurance',
      credits: 3,
      instructor: 'Engr. Bilal Farooq',
      schedule: 'Fri 09:00 - 12:00 PM',
      room: 'Auditorium 1',
      attendanceRate: 84,
    },
    {
      code: 'MG-201',
      title: 'Entrepreneurship & Technology Venturing',
      credits: 3,
      instructor: 'Ms. Zoya Khan',
      schedule: 'Mon, Wed 02:00 - 03:30 PM',
      room: 'Seminar Room 2',
      attendanceRate: 95,
    },
    {
      code: 'CS-499',
      title: 'Final Year Capstone Project I',
      credits: 2,
      instructor: 'Project Advisory Board',
      schedule: 'Sat 10:00 AM - 01:00 PM',
      room: 'Incubation Center',
      attendanceRate: 100,
    },
  ];

  const totalCredits = enrolledCourses.reduce((acc, c) => acc + c.credits, 0);

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

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
            Verified academic profile, registered semester courses, and enrollment verification.
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
            {pendingOpsCount > 0 ? (
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

        {/* Academic Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium text-zinc-500">Current Semester</span>
              <BookOpen className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
              Semester {student.semester}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Spring 2026 • 16 Credit Hours</p>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium text-zinc-500">Overall Attendance</span>
              <Calendar className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight flex items-baseline gap-2">
              {student.attendance}%
              <span className="text-xs font-medium text-zinc-600">
                {student.attendance >= 75 ? 'Good Standing' : 'Shortage Notice'}
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
              <span className="text-xs font-medium text-zinc-500">Academic Standing</span>
              <Award className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
              CGPA 3.68
            </div>
            <p className="text-[11px] text-zinc-600 font-medium mt-1">Dean's Honor List • Regular Active</p>
          </div>
        </div>

        {/* Registered Semester Courses Roster */}
        <div className="bg-white rounded-xl border border-zinc-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Semester {student.semester} Registered Course Roster
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Spring 2026 Session • {totalCredits} Total Registered Credit Hours
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
              <Check className="w-3.5 h-3.5 text-zinc-700" />
              Department Verified Roster
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/70 border-b border-zinc-200 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Course</th>
                  <th className="py-3 px-4">Credits</th>
                  <th className="py-3 px-4">Instructor</th>
                  <th className="py-3 px-4">Schedule & Venue</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {enrolledCourses.map((c) => {
                  const isGood = c.attendanceRate >= 75;
                  return (
                    <tr key={c.code} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-zinc-900">
                        <div className="font-semibold">{c.title}</div>
                        <div className="font-mono text-zinc-500 text-[11px] mt-0.5">{c.code}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-zinc-700">
                        {c.credits} Cr
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-zinc-800">{c.instructor}</span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                        <div>{c.schedule}</div>
                        <div className="text-zinc-400 font-mono text-[10px] mt-0.5">{c.room}</div>
                      </td>
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <div className="flex items-center justify-between text-[11px] font-medium mb-1">
                          <span className="font-mono font-medium text-zinc-800">{c.attendanceRate}%</span>
                          <span className="text-[10px] font-medium text-zinc-500">
                            {isGood ? 'Satisfactory' : 'Warning'}
                          </span>
                        </div>
                        <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300 bg-zinc-900"
                            style={{ width: `${Math.min(100, Math.max(0, c.attendanceRate))}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {isGood ? (
                            <>
                              <Check className="w-3 h-3 text-zinc-700" /> Exam Eligible
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-zinc-600" /> Shortage
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
          <div className="p-3 bg-zinc-50/70 border-t border-zinc-200 text-[11px] text-zinc-500 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
            <span>* 75% minimum course attendance is mandatory for semester end final exam eligibility.</span>
            <span className="font-medium text-zinc-700">Course Roster Status: Certified by Academic Registrar</span>
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
                  <p className="text-[11px] text-zinc-400">Gate 1-A • Lahore Campus</p>
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
                    <span className="block font-semibold">Lahore</span>
                    <span className="text-[10px] text-zinc-600">Home Campus</span>
                  </div>
                  <div className="bg-zinc-50 text-zinc-700 p-2 rounded-lg border border-zinc-200 font-medium">
                    <span className="block font-semibold">Islamabad</span>
                    <span className="text-[10px] text-zinc-500">Permitted</span>
                  </div>
                  <div className="bg-zinc-50 text-zinc-700 p-2 rounded-lg border border-zinc-200 font-medium">
                    <span className="block font-semibold">Abbottabad</span>
                    <span className="text-[10px] text-zinc-500">Permitted</span>
                  </div>
                </div>
              </div>

              {/* Cryptographic Signature Footer */}
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
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder="0300-1234567"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 bg-transparent text-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 transition-colors"
                  required
                />
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

          {/* Course Roster Summary for Certificate */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 mb-2">
              Semester Registered Courses:
            </h3>
            <table className="w-full text-left border border-zinc-300 text-xs">
              <thead className="bg-zinc-100 border-b border-zinc-300 font-semibold text-[11px]">
                <tr>
                  <th className="p-2 border-r border-zinc-300">Course Code</th>
                  <th className="p-2 border-r border-zinc-300">Course Title</th>
                  <th className="p-2 border-r border-zinc-300 text-center">Cr. Hrs</th>
                  <th className="p-2 border-r border-zinc-300">Instructor</th>
                  <th className="p-2 text-center">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {enrolledCourses.map((c) => (
                  <tr key={c.code}>
                    <td className="p-2 font-mono font-semibold border-r border-zinc-200">{c.code}</td>
                    <td className="p-2 border-r border-zinc-200">{c.title}</td>
                    <td className="p-2 text-center font-mono border-r border-zinc-200">{c.credits}</td>
                    <td className="p-2 border-r border-zinc-200">{c.instructor}</td>
                    <td className="p-2 text-center font-mono font-semibold">{c.attendanceRate}%</td>
                  </tr>
                ))}
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
