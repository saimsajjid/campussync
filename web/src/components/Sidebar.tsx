import React from 'react';
import {
  LayoutDashboard,
  Users,
  GitMerge,
  History,
  RefreshCw,
  GraduationCap
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { BrandLogo } from './BrandLogo';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, isOpen, onCloseMobile }) => {
  const { currentUser, simulator } = useApp();

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

  let navItems: Array<{
    id: string;
    label: string;
    icon: any;
    badge?: number;
  }> = [];

  if (currentUser.role === 'student') {
    navItems = [
      { id: 'overview', label: 'My Record', icon: GraduationCap },
    ];
  } else if (currentUser.role === 'faculty') {
    navItems = [
      { id: 'dashboard', label: 'Campus Dashboard', icon: LayoutDashboard },
      { id: 'students', label: 'Students Roster', icon: Users },
      { id: 'history', label: 'Campus History', icon: History },
    ];
  } else {
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'students', label: 'Students', icon: Users },
      {
        id: 'conflicts',
        label: 'Conflicts',
        icon: GitMerge,
        badge: openConflictsCount && openConflictsCount > 0 ? openConflictsCount : undefined,
      },
      { id: 'history', label: 'Change History', icon: History },
      {
        id: 'sync',
        label: 'Sync Center',
        icon: RefreshCw,
        badge: pendingOutboxCount && pendingOutboxCount > 0 ? pendingOutboxCount : undefined,
      },
    ];
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 w-[260px] bg-white border-r border-zinc-200/90 flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-zinc-200/90">
          <BrandLogo className="w-8 h-8 rounded-lg shadow-2xs" />
          <div className="flex flex-col">
            <span className="font-semibold text-base text-zinc-900 tracking-tight leading-none">
              CampusSync
            </span>
            <span className="text-[10px] text-zinc-500 tracking-wider uppercase font-medium mt-1">
              Multi-Campus SIS
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Menu
          </div>
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
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative text-left cursor-pointer ${
                  isActive
                    ? 'bg-zinc-900 text-zinc-50 shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-zinc-50' : 'text-zinc-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-zinc-100 text-zinc-900 border border-zinc-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer: System Status */}
        <div className="p-3 border-t border-zinc-200/90">
          <div className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${simulator.isOffline ? 'bg-zinc-400' : 'bg-zinc-900'}`} />
              <span className="font-medium text-zinc-800 text-xs">
                {simulator.isOffline ? 'Offline Queue' : 'Connected'}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">
              v1.0
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
