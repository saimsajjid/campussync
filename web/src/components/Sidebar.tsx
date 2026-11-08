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
  const { currentUser, setCurrentUser, addToast } = useApp();

  const openConflictsCount = useLiveQuery(
    () => db.conflicts.where('status').equals('open').count(),
    [],
    0
  );

  const pendingOutboxCount = useLiveQuery(
    () => db.outbox.count(),
    [],
    0
  );

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    {
      id: 'conflicts',
      label: 'Conflicts',
      icon: GitMerge,
      badge: openConflictsCount && openConflictsCount > 0 ? openConflictsCount : undefined,
      badgeColor: 'bg-[#FEE2E2] text-[#DC2626]',
    },
    { id: 'history', label: 'Change History', icon: History },
    {
      id: 'sync',
      label: 'Sync Center',
      icon: RefreshCw,
      badge: pendingOutboxCount && pendingOutboxCount > 0 ? pendingOutboxCount : undefined,
      badgeColor: 'bg-[#FEF3C7] text-[#D97706]',
    },
    { id: 'integrity', label: 'Integrity Suite', icon: ShieldCheck },
  ];

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
        className={`fixed top-0 bottom-0 left-0 w-[260px] bg-white border-r border-[#E5E7EB] flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* University Brand Header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#E5E7EB]">
          <div className="w-11 h-11 bg-[#4F7DF3] rounded-xl flex items-center justify-center text-white shadow-md shadow-[#4F7DF3]/20 flex-shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[16px] text-[#1E293B] leading-tight tracking-tight">
              CampusSync
            </span>
            <span className="text-xs text-[#6B7280] font-medium flex items-center gap-1">
              <Building2 className="w-3 h-3 text-[#4F7DF3]" /> Multi-Campus
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
                    ? 'bg-[#4F7DF3] text-white shadow-md shadow-[#4F7DF3]/30'
                    : 'text-[#6B7280] hover:bg-[#EBF0FF] hover:text-[#4F7DF3]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#6B7280]'}`} />
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
        <div className="p-3 border-t border-[#E5E7EB] bg-[#F8FAFC]">
          <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#4F7DF3]" /> Active Role
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  currentUser.role === 'admin'
                    ? 'bg-[#DCFCE7] text-[#15803D]'
                    : currentUser.role === 'faculty'
                    ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                    : 'bg-[#FEF3C7] text-[#B45309]'
                }`}
              >
                {currentUser.role}
              </span>
            </div>

            <select
              value={currentUser.id}
              onChange={(e) => {
                const user = DEMO_USERS.find((u) => u.id === e.target.value);
                if (user) {
                  setCurrentUser(user);
                  addToast(`Switched active session to ${user.name} (${user.role.toUpperCase()})`, 'info');
                }
              }}
              className="w-full text-xs font-semibold bg-[#F4F6FA] border border-[#CBD5E1] rounded-lg p-1.5 text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#4F7DF3]"
            >
              {DEMO_USERS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>

            <p className="text-[10px] text-[#6B7280] mt-2 leading-relaxed">
              {currentUser.role === 'admin' && 'Full multi-campus read/write, conflicts & integrity.'}
              {currentUser.role === 'faculty' && 'Attendance & remarks scoped to Lahore campus.'}
              {currentUser.role === 'student' && 'Own contact info updates with outbox sync.'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
