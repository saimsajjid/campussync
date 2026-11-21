import React from 'react';
import {
  LayoutDashboard,
  Users,
  GitMerge,
  History,
  RefreshCw,
  CreditCard
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
  const { currentUser } = useApp();

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
    badgeColor?: string;
  }> = [];

  if (currentUser.role === 'student') {
    navItems = [
      { id: 'overview', label: 'My Record', icon: LayoutDashboard },
      { id: 'id-card', label: 'Student ID Card', icon: CreditCard },
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
        badgeColor: 'bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold',
      },
      { id: 'history', label: 'Change History', icon: History },
      {
        id: 'sync',
        label: 'Sync Center',
        icon: RefreshCw,
        badge: pendingOutboxCount && pendingOutboxCount > 0 ? pendingOutboxCount : undefined,
        badgeColor: 'bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold',
      },
    ];
  }

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
        className={`fixed top-0 bottom-0 left-0 w-[260px] bg-white border-r border-slate-200/80 flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* University Brand Header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200/80">
          <BrandLogo className="w-10 h-10" />
          <span className="font-bold text-[17px] text-slate-900 leading-tight tracking-tight">
            CampusSync
          </span>
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
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative text-left cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
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
      </aside>
    </>
  );
};
