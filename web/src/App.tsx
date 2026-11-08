import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FailureSimulatorDrawer } from './components/FailureSimulatorDrawer';
import { StudentFormModal } from './components/StudentFormModal';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { ConflictResolutionPage } from './pages/ConflictResolutionPage';
import { HistoryPage } from './pages/HistoryPage';
import { SyncCenterPage } from './pages/SyncCenterPage';
import { IntegritySuitePage } from './pages/IntegritySuitePage';
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

  const { simulator, toasts } = useApp();

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
    <div className="min-h-screen bg-[#F4F6FA] flex text-[#1E293B]">
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
        />

        {/* Offline Alert Strip */}
        {simulator.isOffline && (
          <div className="bg-[#FEF3C7] border-b border-[#FDE68A] px-4 py-2 text-xs font-semibold text-[#92400E] flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-[#D97706]" />
              <span>
                You are currently <strong>offline</strong>. Changes are saved locally on this device and will sync automatically when reconnected.
              </span>
            </div>
            <span className="bg-[#B45309] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
              Offline Cache
            </span>
          </div>
        )}

        {/* Active Page View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenAddStudent={handleOpenAddStudent}
            />
          )}

          {currentTab === 'students' && (
            <StudentsPage
              onOpenAddModal={handleOpenAddStudent}
              onOpenEditModal={handleOpenEditStudent}
              onOpenHistory={handleOpenHistory}
            />
          )}

          {currentTab === 'conflicts' && <ConflictResolutionPage />}

          {currentTab === 'history' && (
            <HistoryPage initialStudentId={selectedStudentHistoryId} />
          )}

          {currentTab === 'sync' && <SyncCenterPage />}

          {currentTab === 'integrity' && <IntegritySuitePage />}
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

      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 transition-all ${
              t.type === 'success'
                ? 'bg-[#15803D] text-white border-emerald-600'
                : t.type === 'danger'
                ? 'bg-[#B91C1C] text-white border-red-600'
                : t.type === 'warning'
                ? 'bg-[#B45309] text-white border-amber-600'
                : 'bg-[#1E293B] text-white border-slate-700'
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
