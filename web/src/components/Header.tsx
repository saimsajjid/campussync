import React from 'react';
import { Menu, Building2, UserCircle2, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { CampusCode } from '../types';
import { CustomDropdown } from './CustomDropdown';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenSimulator?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { activeCampus, setActiveCampus, currentUser, logout } = useApp();

  const campusOptions: Array<{ value: CampusCode | 'all'; label: string }> =
    currentUser?.role === 'admin'
      ? [
          { value: 'all', label: 'All Campuses (Combined)' },
          { value: 'Islamabad', label: 'Islamabad Campus' },
          { value: 'Lahore', label: 'Lahore Campus' },
          { value: 'Abbottabad', label: 'Abbottabad Campus' },
        ]
      : [
          {
            value: (currentUser?.campus as CampusCode) || 'Lahore',
            label: `${currentUser?.campus || 'Campus'} Branch`,
          },
        ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 h-[70px] px-3 sm:px-4 lg:px-8 flex items-center justify-between gap-2 max-w-full">
      {/* Left: Mobile Toggle & Campus Filter */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg shrink-0"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Campus Filter Selector / Fixed Badge */}
        <div className="max-w-[220px] sm:max-w-none">
          {currentUser?.role === 'student' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{currentUser?.campus || 'Lahore'} Campus</span>
            </div>
          ) : (
            <CustomDropdown<CampusCode | 'all'>
              value={activeCampus}
              onChange={(val) => setActiveCampus(val)}
              options={campusOptions}
              icon={<Building2 className="w-4 h-4" />}
              size="sm"
            />
          )}
        </div>
      </div>

      {/* Right: User Profile Info & Logout */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2.5 pl-2">
          <UserCircle2 className="w-8 h-8 text-slate-400 shrink-0" />
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-900 leading-tight">
              {currentUser?.name || 'User'}
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
              {currentUser?.role || 'Guest'} {currentUser?.campus ? `• ${currentUser.campus}` : '• Central'}
            </span>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
