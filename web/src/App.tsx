import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FailureSimulatorDrawer } from './components/FailureSimulatorDrawer';
import { StudentFormModal } from './components/StudentFormModal';
import { DuplicateRecordDialog } from './components/DuplicateRecordDialog';
import { db } from './db';
import { DashboardPage } from './pages/DashboardPage';

import { StudentsPage } from './pages/StudentsPage';
import { ConflictResolutionPage } from './pages/ConflictResolutionPage';
import { HistoryPage } from './pages/HistoryPage';
import { SyncCenterPage } from './pages/SyncCenterPage';
import { StudentPortalPage } from './pages/StudentPortalPage';
import { LoginPage } from './pages/LoginPage';
import { BrandLogo } from './components/BrandLogo';
import { useApp } from './context/AppContext';
import {
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  X
} from 'lucide-react';
import type { StudentRecord } from './types';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Modal State
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<StudentRecord | null>(null);
  const [selectedStudentHistoryId, setSelectedStudentHistoryId] = useState<string | undefined>(undefined);

  const {
    simulator,
    toasts,
    isLoggedIn,
    currentUser,
    authLoading,
    duplicateRecordPrompt,
    setDuplicateRecordPrompt,
    syncNow,
    addToast,
    removeToast,
  } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <BrandLogo className="w-12 h-12 mb-3.5 shadow-sm animate-pulse" />
        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const renderToasts = () => {
    if (!toasts || toasts.length === 0) return null;
    return (
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-lg shadow-slate-900/5 flex items-start gap-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            {/* Status Micro-Badge */}
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && (
                <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
              {t.type === 'danger' && (
                <div className="w-5 h-5 rounded-full bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
              )}
              {t.type === 'warning' && (
                <div className="w-5 h-5 rounded-full bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              )}
              {t.type === 'info' && (
                <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
                  <Info className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            {/* Notification Text */}
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs font-medium text-slate-800 leading-relaxed">
                {t.message}
              </p>
            </div>

            {/* Micro Close Button */}
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0 -mr-1 -mt-0.5"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  if (!isLoggedIn || !currentUser) {
    return (
      <>
        <LoginPage />
        {renderToasts()}
      </>
    );
  }

  // Enforce strict RBAC tab access
  let effectiveTab = currentTab;
  if (currentUser.role === 'student') {
    effectiveTab = 'overview';
  } else if (currentUser.role === 'faculty') {
    if (['conflicts', 'integrity', 'overview', 'id-card', 'sync'].includes(effectiveTab)) {
      effectiveTab = 'dashboard';
    }
  } else {
    // Admin
    if (['overview', 'id-card'].includes(effectiveTab)) {
      effectiveTab = 'dashboard';
    }
  }

  const handleOpenAddStudent = () => {
    setStudentToEdit(null);
    setIsStudentModalOpen(true);
  };

  const handleOpenEditStudent = (student: StudentRecord) => {
    setStudentToEdit(student);
    setIsStudentModalOpen(true);
  };

  const handleOpenHistory = (studentId: string) => {
    setSelectedStudentHistoryId(studentId);
    setCurrentTab('history');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab !== 'history') setSelectedStudentHistoryId(undefined);
          setCurrentTab(tab);
        }}
        isOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[260px] flex flex-col min-w-0">
        {/* Sticky Top Header */}
        <Header
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
          onNavigateTab={(tab) => setCurrentTab(tab)}
        />

        {/* Offline Alert Strip */}
        {simulator.isOffline && (
          <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 text-xs font-medium text-amber-900 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-600" />
              <span>
                You are currently <strong>offline</strong>. Changes are saved locally on this device and will sync automatically when reconnected.
              </span>
            </div>
            <span className="bg-amber-600 text-white text-[10px] px-2.5 py-0.5 rounded-full font-semibold">
              Offline Mode
            </span>
          </div>
        )}

        {/* Active Page View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {effectiveTab === 'overview' && (
            <StudentPortalPage />
          )}

          {effectiveTab === 'dashboard' && (
            <DashboardPage
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenAddStudent={handleOpenAddStudent}
            />
          )}

          {effectiveTab === 'students' && (
            <StudentsPage
              onOpenAddModal={handleOpenAddStudent}
              onOpenEditModal={handleOpenEditStudent}
              onOpenHistory={handleOpenHistory}
            />
          )}

          {effectiveTab === 'conflicts' && <ConflictResolutionPage />}

          {effectiveTab === 'history' && (
            <HistoryPage initialStudentId={selectedStudentHistoryId} />
          )}

          {effectiveTab === 'sync' && <SyncCenterPage />}
        </main>
      </div>

      {/* Modals & Drawers */}
      <FailureSimulatorDrawer
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />

      <StudentFormModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        studentToEdit={studentToEdit}
      />

      {/* Duplicate Record Dialog (FR-6) */}
      {duplicateRecordPrompt && duplicateRecordPrompt.isOpen && (
        <DuplicateRecordDialog
          isOpen={duplicateRecordPrompt.isOpen}
          reason={duplicateRecordPrompt.reason}
          existingRecordId={duplicateRecordPrompt.existingRecordId}
          onOpenExisting={async (recordId) => {
            if (duplicateRecordPrompt.opId) {
              await db.outbox.delete(duplicateRecordPrompt.opId);
            }
            if (duplicateRecordPrompt.studentId && duplicateRecordPrompt.studentId !== recordId) {
              await db.students.delete(duplicateRecordPrompt.studentId);
            }
            setDuplicateRecordPrompt(null);
            setIsStudentModalOpen(false);

            // Open existing authoritative record
            let existing = await db.students.get(recordId);
            if (!existing) {
              await syncNow();
              existing = await db.students.get(recordId);
            }
            if (existing) {
              setStudentToEdit(existing);
              setIsStudentModalOpen(true);
            }
            addToast('Opened existing authoritative record', 'info');
          }}
          onCancelCreation={async () => {
            if (duplicateRecordPrompt.opId) {
              await db.outbox.delete(duplicateRecordPrompt.opId);
            }
            if (duplicateRecordPrompt.studentId) {
              await db.students.delete(duplicateRecordPrompt.studentId);
            }
            setDuplicateRecordPrompt(null);
            setIsStudentModalOpen(false);
            addToast('Cancelled duplicate student creation', 'info');
          }}
        />
      )}

      {/* Toast Notification Container */}
      {renderToasts()}
    </div>
  );
};
