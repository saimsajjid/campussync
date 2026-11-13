import React from 'react';
import { Menu, Wifi, WifiOff, Sliders, Building2, UserCircle2, LogOut, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { CampusCode } from '../types';
import { CustomDropdown } from './CustomDropdown';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenSimulator: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, onOpenSimulator, onNavigateTab }) => {
  const { activeCampus, setActiveCampus, simulator, setSimulator, currentUser, logout, addToast, isDemoMode } = useApp();

  const pendingCount = useLiveQuery(
    () => {
      if (currentUser?.role === 'student' && currentUser?.student_id) {
        return db.outbox.where('studentId').equals(currentUser.student_id).count();
      }
      return db.outbox.count();
    },
    [currentUser?.role, currentUser?.student_id],
    0
  );

  const campusOptions: Array<{ value: CampusCode | 'all'; label: string }> = [
    { value: 'all', label: 'All Campuses (Combined)' },
    { value: 'Islamabad', label: 'Islamabad Campus' },
    { value: 'Lahore', label: 'Lahore Campus' },
    { value: 'Abbottabad', label: 'Abbottabad Campus' },
  ];

  const toggleConnection = () => {
    const nextState = !simulator.isOffline;
    setSimulator((prev) => ({ ...prev, isOffline: nextState }));
    addToast(
      nextState
        ? 'Offline Mode: Edits will save locally and sync when reconnected'
        : 'Online Mode: Background synchronization active',
      nextState ? 'warning' : 'success'
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[var(--color-border-subtle)] h-[70px] px-3 sm:px-4 lg:px-8 flex items-center justify-between gap-2 max-w-full">
      {/* Left: Mobile Toggle & Campus Filter */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 sm:p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-surface-bg)] rounded-lg shrink-0"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Campus Filter Selector */}
        <div className="max-w-[150px] sm:max-w-none truncate">
          <CustomDropdown<CampusCode | 'all'>
            value={activeCampus}
            onChange={(val) => setActiveCampus(val)}
            options={campusOptions}
            icon={<Building2 className="w-4 h-4" />}
            size="sm"
          />
        </div>
      </div>

      {/* Right: Simulator Controls, Connection Pill & User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Connection Status Pill */}
        <button
          onClick={toggleConnection}
          className={`px-2 sm:px-3.5 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all shadow-xs cursor-pointer ${
            simulator.isOffline
              ? 'bg-[var(--color-status-danger-subtle)] border-[var(--color-status-conflict-border)] text-[var(--color-status-danger-text)] hover:bg-[var(--color-status-conflict-bg)]'
              : 'bg-[var(--color-status-success-bg)] border-[var(--color-status-synced-border)] text-[var(--color-status-synced-dark)] hover:bg-[var(--color-status-synced-bg)]'
          }`}
          title="Click to toggle simulated connection state"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              simulator.isOffline ? 'bg-[var(--color-status-danger-red)]' : 'bg-[var(--color-status-success-green)] pulse-green'
            }`}
          />
          <span className="hidden xs:inline">{simulator.isOffline ? 'Offline' : 'Online'}</span>
          {simulator.isOffline ? (
            <WifiOff className="w-3.5 h-3.5 opacity-80 shrink-0" />
          ) : (
            <Wifi className="w-3.5 h-3.5 opacity-80 shrink-0" />
          )}
        </button>

        {/* Header Pending Counter linking to Sync Center */}
        <button
          onClick={() => onNavigateTab?.('sync')}
          className="px-2 sm:px-3 py-1.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-bg)] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)]/30 text-xs font-semibold text-[var(--color-text-dark)] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          title="Open Sync Outbox"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 ${pendingCount > 0 ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Outbox</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              pendingCount > 0
                ? 'bg-[var(--color-status-warning-amber)] text-white'
                : 'bg-[var(--color-surface-slate-100)] text-[var(--color-text-muted)]'
            }`}
          >
            {pendingCount}
          </span>
        </button>

        {/* Simulator Drawer Trigger (Only in DEMO_MODE) */}
        {isDemoMode && (
          <button
            onClick={onOpenSimulator}
            className="p-1.5 sm:p-2 rounded-xl border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)]/30 transition-all text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            title="Network & Connectivity Simulator"
          >
            <Sliders className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="hidden md:inline">Simulator</span>
          </button>
        )}

        {/* User Profile Info & Logout */}
        <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-[var(--color-border-subtle)]">
          <UserCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--color-primary)] shrink-0" />
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-[var(--color-text-dark)] leading-tight">{currentUser?.name || 'User'}</span>
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
              {currentUser?.role || 'Guest'} {currentUser?.campus ? `• ${currentUser.campus}` : '• Central'}
            </span>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
