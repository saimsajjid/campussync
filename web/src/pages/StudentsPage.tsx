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
import type { StudentRecord } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';

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
  const [programFilter, setProgramFilter] = useState('all');

  const allStudents = useLiveQuery(() => {
    return db.students.toArray();
  }, []);

  if (!currentUser) return null;

  // Filter students based on role and campus scope
  const filteredStudents = allStudents?.filter((s) => {
    // 1. Role-based scoping
    if (currentUser.role === 'student' && currentUser.student_id && s.id !== currentUser.student_id) {
      return false;
    }
    if (currentUser.role === 'faculty' && currentUser.campus && s.campus !== currentUser.campus) {
      return false;
    }

    // 2. Campus selector filter (for Admin only, since Faculty is locked to currentUser.campus)
    if (currentUser.role === 'admin' && activeCampus !== 'all' && s.campus !== activeCampus) {
      return false;
    }

    // 3. Program filter
    if (programFilter !== 'all' && s.program !== programFilter) {
      return false;
    }

    // 4. Search query
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
    <div className="space-y-6 text-left max-w-[1200px] w-full mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {currentUser.role === 'student' ? 'My Profile' : 'Student Directory'}
          </h1>
        </div>

        {currentUser.role === 'admin' && (
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Student Record
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name, Reg No (CS-2026-...), or CNIC..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            />
          </div>

          {/* Program Filter Dropdown */}
          <CustomDropdown
            value={programFilter}
            onChange={(val) => setProgramFilter(val)}
            options={[
              { value: 'all', label: 'All Programs' },
              { value: 'BS CS', label: 'BS Computer Science' },
              { value: 'BS SE', label: 'BS Software Engineering' },
              { value: 'BS EE', label: 'BS Electrical Engineering' },
            ]}
            icon={<GraduationCap className="w-4 h-4" />}
            labelPrefix="Program:"
            size="sm"
          />
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end text-xs text-slate-500">
          <span className="font-medium">Showing:</span>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-semibold rounded-lg border border-slate-200/60">
            {filteredStudents?.length || 0} Records
          </span>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Reg No & CNIC</th>
                <th className="py-3 px-4">Campus & Program</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4">Attendance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStudents && filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Name & Email */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="font-semibold flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                        <span>{s.full_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal">{s.email}</div>
                    </td>

                    {/* Reg No & CNIC (Mandatory Unique Keys) */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="font-semibold text-slate-800">{s.reg_no}</div>
                      <div className="text-xs text-slate-400">{s.cnic}</div>
                    </td>

                    {/* Campus & Program */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 flex items-center gap-1 text-xs">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>{s.campus}</span>
                      </div>
                      <div className="text-xs text-slate-400">{s.program}</div>
                    </td>

                    {/* Semester */}
                    <td className="py-3.5 px-4 font-medium text-slate-800 text-xs">
                      Semester {s.semester}
                    </td>

                    {/* Attendance */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-xs border ${
                          s.attendance >= 85
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                            : s.attendance >= 75
                            ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                            : 'bg-rose-50 text-rose-700 border-rose-200/60'
                        }`}
                      >
                        {s.attendance}%
                      </span>
                    </td>

                    {/* Academic Status */}
                    <td className="py-3.5 px-4">
                      {s.status === 'Active' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      )}
                      {s.status === 'On leave' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> On leave
                        </span>
                      )}
                      {s.status === 'Graduated' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Graduated
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(s)}
                          aria-label={`Edit ${s.full_name}`}
                          title={`Edit ${s.full_name}`}
                          className="p-1.5 rounded-lg border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenHistory(s.id)}
                          aria-label={`View history for ${s.full_name}`}
                          title={`View history for ${s.full_name}`}
                          className="p-1.5 rounded-lg border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
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
