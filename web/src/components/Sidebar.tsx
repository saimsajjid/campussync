import React from 'react';
import {
  LayoutDashboard,
  Users,
  GitMerge,
  History,
  RefreshCw,
  ShieldCheck,
  Building2,
  Shield,
  UserCheck
} from 'lucide-react';
import { useApp, DEMO_USERS } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, isOpen, onCloseMobile }) => {
  const { currentUser, login, addToast } = useApp();

  const openConflictsCount = useLiveQuery(
    () => db.conflicts.where('status').equals('open').count(),
    [],
    0
  );

  const pendingOutboxCount = useLiveQuery(
    () => {
      if (currentUser?.role === 'student' && currentUser?.student_id) {
        return db.outbox.where('studentId').equals(currentUser.student_id).count();
      }
      return db.outbox.count();
    },
    [currentUser?.role, currentUser?.student_id],
    0
  );

  if (!currentUser) return null;

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'faculty', 'student'] },
    {
      id: 'students',
      label: currentUser?.role === 'student' ? 'My record' : 'Students',
      icon: Users,
      roles: ['admin', 'faculty', 'student'],
    },
    {
      id: 'conflicts',
      label: 'Conflicts',
      icon: GitMerge,
      badge: openConflictsCount && openConflictsCount > 0 ? openConflictsCount : undefined,
      badgeColor: 'bg-[var(--color-status-conflict-bg)] text-[var(--color-status-danger-dark)]',
      roles: ['admin'],
    },
    { id: 'history', label: 'Change History', icon: History, roles: ['admin', 'faculty', 'student'] },
    {
      id: 'sync',
      label: 'Sync Center',
      icon: RefreshCw,
      badge: pendingOutboxCount && pendingOutboxCount > 0 ? pendingOutboxCount : undefined,
      badgeColor: 'bg-[var(--color-status-pending-bg)] text-[var(--color-status-warning-orange)]',
      roles: ['admin', 'faculty', 'student'],
    },
    { id: 'integrity', label: 'Integrity Suite', icon: ShieldCheck, roles: ['admin'] },
  ];

  const role = currentUser?.role || 'student';
  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 w-[260px] bg-white border-r border-[var(--color-border-subtle)] flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* University Brand Header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--color-border-subtle)]">
          <div className="w-11 h-11 bg-[var(--color-primary)] rounded-xl flex items-center justify-center text-white shadow-md shadow-[var(--color-primary)]/20 flex-shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[16px] text-[var(--color-text-dark)] leading-tight tracking-tight">
              CampusSync
            </span>
            <span className="text-xs text-[var(--color-text-muted)] font-medium flex items-center gap-1">
              <Building2 className="w-3 h-3 text-[var(--color-primary)]" /> Multi-Campus
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative text-left ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/30'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[var(--color-text-muted)]'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/25 text-white' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Demo Role Switcher */}
        <div className="p-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)]">
          <div className="bg-white p-3 rounded-xl border border-[var(--color-border-subtle)] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[var(--color-primary)]" /> Active Role
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  currentUser.role === 'admin'
                    ? 'bg-[var(--color-status-synced-bg)] text-[var(--color-status-synced-text)]'
                    : currentUser.role === 'faculty'
                    ? 'bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]'
                    : 'bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]'
                }`}
              >
                {currentUser.role}
              </span>
            </div>

            <select
              value={currentUser?.id || ''}
              onChange={async (e) => {
                const user = DEMO_USERS.find((u) => u.id === e.target.value);
                if (user) {
                  try {
                    await login(user.email, 'password123');
                    addToast(`Switched active session to ${user.name} (${user.role.toUpperCase()})`, 'info');
                  } catch (err: any) {
                    addToast(`Failed to switch profile: ${err.message}`, 'danger');
                  }
                }
              }}
              className="w-full text-xs font-semibold bg-[var(--color-surface-bg)] border border-[var(--color-border-muted)] rounded-lg p-1.5 text-[var(--color-text-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              {DEMO_USERS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>

            <p className="text-[10px] text-[var(--color-text-muted)] mt-2 leading-relaxed">
              {currentUser?.role === 'admin' && 'Full multi-campus read/write, conflicts & integrity.'}
              {currentUser?.role === 'faculty' && 'Attendance & remarks scoped to Lahore campus.'}
              {currentUser?.role === 'student' && 'Own contact info updates with outbox sync.'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
