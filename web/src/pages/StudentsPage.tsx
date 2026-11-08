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
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-dark)] tracking-tight">
            {currentUser.role === 'student' ? 'My Record' : 'Student Records Directory'}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {currentUser.role === 'admin' && 'Viewing all student records across all university campuses.'}
            {currentUser.role === 'faculty' && `Scoped to ${currentUser.campus} Campus academic records.`}
            {currentUser.role === 'student' && 'Viewing your official enrolled record and contact info.'}
          </p>
        </div>

        {currentUser.role === 'admin' && (
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-md shadow-[var(--color-primary)]/20 flex items-center gap-1.5 transition-all self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" /> Add Student Record
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[var(--color-border-subtle)] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-[var(--color-text-light)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name, Reg No (CS-2026-...), or CNIC..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] rounded-xl text-[var(--color-text-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end text-xs text-[var(--color-text-muted)]">
          <span className="font-semibold">Showing:</span>
          <span className="px-2.5 py-1 bg-[var(--color-surface-slate-100)] text-[var(--color-text-dark)] font-bold rounded-lg border border-[var(--color-border-light)]">
            {filteredStudents?.length || 0} Records
          </span>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-2xl border border-[var(--color-border-subtle)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-surface-muted)] border-b border-[var(--color-border-subtle)] text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
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
            <tbody className="divide-y divide-[var(--color-border-subtle)] text-xs">
              {filteredStudents && filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--color-surface-muted)] transition-colors">
                    {/* Name & Email */}
                    <td className="py-3.5 px-4 font-semibold text-[var(--color-text-dark)]">
                      <div className="font-bold flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        <span>{s.full_name}</span>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)] font-normal">{s.email}</div>
                    </td>

                    {/* Reg No & CNIC (Mandatory Unique Keys) */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--color-text-secondary)]">
                      <div className="font-bold text-[var(--color-text-dark)]">{s.reg_no}</div>
                      <div className="text-[10px] text-[var(--color-text-light)]">{s.cnic}</div>
                    </td>

                    {/* Campus & Program */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--color-text-dark)] flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-[var(--color-primary)]" />
                        <span>{s.campus}</span>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{s.program}</div>
                    </td>

                    {/* Semester */}
                    <td className="py-3.5 px-4 font-semibold text-[var(--color-text-dark)]">
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
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--color-text-subtle)]">
                      v{s.version}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenEditModal(s)}
                          className="p-1.5 rounded-lg border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)]/30 transition-all"
                          title="View or Edit Record Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onOpenHistory(s.id)}
                          className="p-1.5 rounded-lg border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)]/30 transition-all"
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
                  <td colSpan={8} className="py-12 text-center text-[var(--color-text-muted)]">
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
