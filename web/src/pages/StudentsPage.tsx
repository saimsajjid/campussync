import React, { useState } from 'react';
import {
  Search,
  UserPlus,
  Edit3,
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
  onOpenHistory?: (studentId: string) => void;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({
  onOpenAddModal,
  onOpenEditModal,
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
    <div className="space-y-6 text-left max-w-[1240px] w-full mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {currentUser.role === 'student' ? 'My Profile' : 'Student Directory'}
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Authoritative multi-campus registry and student profile management.
          </p>
        </div>

        {currentUser.role === 'admin' && (
          <button
            onClick={onOpenAddModal}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 text-xs font-medium rounded-lg shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Student Record
          </button>
        )}
      </div>

      {/* Filter and Search Bar - shadcn Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name, Reg No, or CNIC..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 transition-colors"
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

        <div className="flex items-center gap-2 justify-between sm:justify-end text-xs text-zinc-500">
          <span className="font-normal">Showing:</span>
          <span className="px-2.5 py-1 bg-zinc-100 text-zinc-800 font-medium rounded-md border border-zinc-200 font-mono text-xs">
            {filteredStudents?.length || 0} Records
          </span>
        </div>
      </div>

      {/* Students Data Table - shadcn Table */}
      <div className="bg-white rounded-xl border border-zinc-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/70 border-b border-zinc-200 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Reg No & CNIC</th>
                <th className="py-3 px-4">Campus & Program</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4">Attendance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {filteredStudents && filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50/70 transition-colors">
                    {/* Name & Email */}
                    <td className="py-3.5 px-4 font-medium text-zinc-900">
                      <div className="font-semibold text-zinc-900">{s.full_name}</div>
                      <div className="text-[11px] text-zinc-500 font-normal">{s.email}</div>
                    </td>

                    {/* Reg No & CNIC */}
                    <td className="py-3.5 px-4 font-mono text-xs text-zinc-600">
                      <div className="font-medium text-zinc-800">{s.reg_no}</div>
                      <div className="text-[11px] text-zinc-400">{s.cnic}</div>
                    </td>

                    {/* Campus & Program */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-zinc-800 flex items-center gap-1.5 text-xs">
                        <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{s.campus}</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">{s.program}</div>
                    </td>

                    {/* Semester */}
                    <td className="py-3.5 px-4 font-medium text-zinc-700 text-xs">
                      Semester {s.semester}
                    </td>

                    {/* Attendance */}
                    <td className="py-3.5 px-4">
                      <span className="font-medium px-2 py-0.5 rounded-full text-[11px] border bg-zinc-100 text-zinc-800 border-zinc-200">
                        {s.attendance}%
                      </span>
                    </td>

                    {/* Academic Status */}
                    <td className="py-3.5 px-4">
                      {s.status === 'Active' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-900 border border-zinc-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" /> Active
                        </span>
                      )}
                      {s.status === 'On leave' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-50 text-zinc-600 border border-zinc-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" /> On leave
                        </span>
                      )}
                      {s.status === 'Graduated' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> Graduated
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(s)}
                          aria-label={`Edit ${s.full_name}`}
                          title={`Edit ${s.full_name}`}
                          className="p-1.5 rounded-md border border-zinc-200 hover:border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    <p className="text-sm font-medium text-zinc-700">No student records match the active criteria.</p>
                    <p className="text-xs mt-1 text-zinc-400">Try switching campus scope or resetting search filters.</p>
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
