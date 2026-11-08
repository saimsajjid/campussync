import React, { useState } from 'react';
import {
  Search,
  UserPlus,
  Edit3,
  History,
  Building2,
  GraduationCap
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { StatusBadge } from '../components/StatusBadge';
import type { StudentRecord } from '../types';

interface StudentsPageProps {
  onOpenAddModal: () => void;
  onOpenEditModal: (student: StudentRecord) => void;
  onOpenHistory: (studentId: string) => void;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({
  onOpenAddModal,
  onOpenEditModal,
  onOpenHistory,
}) => {
  const { activeCampus, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const allStudents = useLiveQuery(() => {
    return db.students.toArray();
  }, []);

  // Filter students based on role and campus scope
  const filteredStudents = allStudents?.filter((s) => {
    // 1. Role-based scoping
    if (currentUser.role === 'student' && currentUser.student_id && s.id !== currentUser.student_id) {
      return false;
    }
    if (currentUser.role === 'faculty' && currentUser.campus && s.campus !== currentUser.campus) {
      return false;
    }

    // 2. Campus selector filter
    if (activeCampus !== 'all' && s.campus !== activeCampus) {
      return false;
    }

    // 3. Search query
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchName = s.full_name.toLowerCase().includes(q);
      const matchReg = s.reg_no.toLowerCase().includes(q);
      const matchCnic = s.cnic.includes(q);
      const matchEmail = s.email.toLowerCase().includes(q);
      const matchProgram = s.program.toLowerCase().includes(q);
      return matchName || matchReg || matchCnic || matchEmail || matchProgram;
    }

    return true;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] tracking-tight">
            Student Records Directory
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            {currentUser.role === 'admin' && 'Viewing all student records across all university campuses.'}
            {currentUser.role === 'faculty' && `Scoped to ${currentUser.campus} Campus academic records.`}
            {currentUser.role === 'student' && 'Viewing your official enrolled record and contact info.'}
          </p>
        </div>

        {currentUser.role === 'admin' && (
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 bg-[#4F7DF3] hover:bg-[#3E6AE1] text-white text-xs font-bold rounded-xl shadow-md shadow-[#4F7DF3]/20 flex items-center gap-1.5 transition-all self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" /> Add Student Record
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name, Reg No (CS-2026-...), or CNIC..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#4F7DF3]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end text-xs text-[#6B7280]">
          <span className="font-semibold">Showing:</span>
          <span className="px-2.5 py-1 bg-[#F1F5F9] text-[#1E293B] font-bold rounded-lg border border-[#E2E8F0]">
            {filteredStudents?.length || 0} Records
          </span>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Reg No & CNIC</th>
                <th className="py-3 px-4">Campus & Program</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4">Attendance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-xs">
              {filteredStudents && filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8FAFC] transition-colors">
                    {/* Name & Email */}
                    <td className="py-3.5 px-4 font-semibold text-[#1E293B]">
                      <div className="font-bold flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-[#4F7DF3]" />
                        <span>{s.full_name}</span>
                      </div>
                      <div className="text-[11px] text-[#6B7280] font-normal">{s.email}</div>
                    </td>

                    {/* Reg No & CNIC (Mandatory Unique Keys) */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#475569]">
                      <div className="font-bold text-[#1E293B]">{s.reg_no}</div>
                      <div className="text-[10px] text-[#94A3B8]">{s.cnic}</div>
                    </td>

                    {/* Campus & Program */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#1E293B] flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-[#4F7DF3]" />
                        <span>{s.campus}</span>
                      </div>
                      <div className="text-[11px] text-[#6B7280]">{s.program}</div>
                    </td>

                    {/* Semester */}
                    <td className="py-3.5 px-4 font-semibold text-[#1E293B]">
                      Semester {s.semester}
                    </td>

                    {/* Attendance */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          s.attendance >= 85
                            ? 'bg-emerald-50 text-emerald-700'
                            : s.attendance >= 75
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {s.attendance}%
                      </span>
                    </td>

                    {/* Academic Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge
                        status={s.status === 'Graduated' ? 'synced' : s.status === 'On leave' ? 'pending' : 'synced'}
                        label={s.status}
                      />
                    </td>

                    {/* Server Version Tag */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#64748B]">
                      v{s.version}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenEditModal(s)}
                          className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#475569] hover:text-[#4F7DF3] hover:bg-[#EBF0FF] hover:border-[#4F7DF3]/30 transition-all"
                          title="View or Edit Record Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onOpenHistory(s.id)}
                          className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#475569] hover:text-[#4F7DF3] hover:bg-[#EBF0FF] hover:border-[#4F7DF3]/30 transition-all"
                          title="View Complete Field-Level Audit Trail"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#6B7280]">
                    <p className="text-sm font-semibold">No student records match the active criteria.</p>
                    <p className="text-xs mt-1">Try switching campus scope or resetting search filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
