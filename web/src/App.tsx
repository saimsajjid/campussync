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
import { IntegritySuitePage } from './pages/IntegritySuitePage';
import { LoginPage } from './pages/LoginPage';
import { useApp } from './context/AppContext';
import { WifiOff, AlertTriangle, CheckCircle, Info } from 'lucide-react';
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
  } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-dark)] flex flex-col items-center justify-center text-white p-4">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">Validating session with server...</p>
      </div>
    );
  }

  if (!isLoggedIn || !currentUser) {
    return <LoginPage />;
  }

  // Enforce strict RBAC tab access
  let effectiveTab = currentTab;
  if (currentUser.role === 'student' && ['conflicts', 'integrity'].includes(effectiveTab)) {
    effectiveTab = 'dashboard';
  } else if (currentUser.role === 'faculty' && ['conflicts', 'integrity'].includes(effectiveTab)) {
    effectiveTab = 'dashboard';
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
    <div className="min-h-screen bg-[var(--color-surface-bg)] flex text-[var(--color-text-dark)]">
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
          <div className="bg-[var(--color-status-pending-bg)] border-b border-[var(--color-status-pending-border)] px-4 py-2 text-xs font-semibold text-[var(--color-status-pending-dark)] flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-[var(--color-status-warning-orange)]" />
              <span>
                You are currently <strong>offline</strong>. Changes are saved locally on this device and will sync automatically when reconnected.
              </span>
            </div>
            <span className="bg-[var(--color-status-pending-text)] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
              Offline Cache
            </span>
          </div>
        )}

        {/* Active Page View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
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

          {effectiveTab === 'integrity' && <IntegritySuitePage />}
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
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 transition-all ${
              t.type === 'success'
                ? 'bg-[var(--color-status-synced-text)] text-white border-emerald-600'
                : t.type === 'danger'
                ? 'bg-[var(--color-status-conflict-text)] text-white border-red-600'
                : t.type === 'warning'
                ? 'bg-[var(--color-status-pending-text)] text-white border-amber-600'
                : 'bg-[var(--color-text-dark)] text-white border-slate-700'
            }`}
          >
            {t.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
            {t.type === 'danger' && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 flex-shrink-0" />}
            <span className="flex-1 leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
