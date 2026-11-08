import React from 'react';
import { Menu, Wifi, WifiOff, Sliders, Building2, UserCircle2, LogOut, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { CampusCode } from '../types';

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

  const campuses: Array<CampusCode | 'all'> = ['all', 'Islamabad', 'Lahore', 'Abbottabad'];

  const toggleConnection = () => {
    const nextState = !simulator.isOffline;
    setSimulator((prev) => ({ ...prev, isOffline: nextState }));
    addToast(
      nextState
        ? 'Offline Mode Activated: Writes will queue safely to IndexedDB Outbox'
        : 'Online Mode Restored: Outbox background sync enabled',
      nextState ? 'warning' : 'success'
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[var(--color-border-subtle)] h-[70px] px-4 lg:px-8 flex items-center justify-between">
      {/* Left: Mobile Toggle & Campus Filter */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-surface-bg)] rounded-lg"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Campus Filter Selector */}
        <div className="flex items-center gap-2 bg-[var(--color-surface-bg)] border border-[var(--color-border-subtle)] rounded-xl px-3 py-1.5">
          <Building2 className="w-4 h-4 text-[var(--color-primary)]" />
          <span className="text-xs text-[var(--color-text-muted)] font-medium hidden sm:inline">Campus Scope:</span>
          <select
            value={activeCampus}
            onChange={(e) => setActiveCampus(e.target.value as CampusCode | 'all')}
            className="text-xs font-semibold bg-transparent text-[var(--color-text-dark)] focus:outline-none cursor-pointer"
          >
            {campuses.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Campuses (Combined)' : `${c} Campus`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Simulator Controls, Connection Pill & User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Connection Status Pill */}
        <button
          onClick={toggleConnection}
          className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer ${
            simulator.isOffline
              ? 'bg-[var(--color-status-danger-subtle)] border-[var(--color-status-conflict-border)] text-[var(--color-status-danger-text)] hover:bg-[var(--color-status-conflict-bg)]'
              : 'bg-[var(--color-status-success-bg)] border-[var(--color-status-synced-border)] text-[var(--color-status-synced-dark)] hover:bg-[var(--color-status-synced-bg)]'
          }`}
          title="Click to toggle simulated connection state"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              simulator.isOffline ? 'bg-[var(--color-status-danger-red)]' : 'bg-[var(--color-status-success-green)] pulse-green'
            }`}
          />
          <span>{simulator.isOffline ? 'Offline' : 'Online'}</span>
          {simulator.isOffline ? (
            <WifiOff className="w-3.5 h-3.5 opacity-80" />
          ) : (
            <Wifi className="w-3.5 h-3.5 opacity-80" />
          )}
        </button>

        {/* Header Pending Counter linking to Sync Center */}
        <button
          onClick={() => onNavigateTab?.('sync')}
          className="px-3 py-1.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-bg)] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)]/30 text-xs font-semibold text-[var(--color-text-dark)] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          title="Open Sync Outbox"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[var(--color-primary)] ${pendingCount > 0 ? 'animate-spin' : ''}`} />
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
            className="p-2 rounded-xl border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)]/30 transition-all text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            title="Open Hackathon Failure Simulator"
          >
            <Sliders className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="hidden md:inline">Simulator</span>
          </button>
        )}

        {/* User Profile Info & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-border-subtle)]">
          <UserCircle2 className="w-8 h-8 text-[var(--color-primary)]" />
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-[var(--color-text-dark)] leading-tight">{currentUser?.name || 'User'}</span>
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
              {currentUser?.role || 'Guest'} {currentUser?.campus ? `• ${currentUser.campus}` : '• Central'}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 ml-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Sign Out / Switch Demo Profile"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
