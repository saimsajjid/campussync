import React from 'react';
import { Menu, Building2, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { CampusCode } from '../types';
import { CustomDropdown } from './CustomDropdown';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { activeCampus, setActiveCampus, currentUser, logout, simulator, setSimulator } = useApp();

  const campusOptions: Array<{ value: CampusCode | 'all'; label: string }> =
    currentUser?.role === 'admin'
      ? [
          { value: 'all', label: 'All Campuses' },
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
    <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 h-16 px-4 lg:px-8 flex items-center justify-between gap-3 max-w-full">
      {/* Left: Mobile Toggle & Campus Filter */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg shrink-0 cursor-pointer transition-colors"
          aria-label="Toggle navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Campus Filter Selector / Fixed Badge */}
        <div className="max-w-[220px] sm:max-w-none">
          {currentUser?.role !== 'admin' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-800 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-zinc-500" />
              <span>{currentUser?.campus || 'Lahore'} Campus</span>
            </div>
          ) : (
            <CustomDropdown<CampusCode | 'all'>
              value={activeCampus}
              onChange={(val) => setActiveCampus(val)}
              options={campusOptions}
              icon={<Building2 className="w-3.5 h-3.5" />}
              size="sm"
            />
          )}
        </div>
      </div>

      {/* Right: Network Status, User Profile & Sign Out */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setSimulator((s) => ({ ...s, isOffline: !s.isOffline }))}
          title={simulator.isOffline ? 'Offline mode active (Click to reconnect)' : 'Online (Click to go offline)'}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            simulator.isOffline
              ? 'bg-zinc-900 text-zinc-50 border-zinc-900 hover:bg-zinc-800'
              : 'bg-zinc-100 text-zinc-800 border-zinc-200 hover:bg-zinc-200'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${simulator.isOffline ? 'bg-zinc-400' : 'bg-zinc-900'}`} />
          <span>{simulator.isOffline ? 'Offline' : 'Online'}</span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-zinc-900 text-zinc-50 flex items-center justify-center font-semibold text-xs shrink-0 shadow-2xs">
            {currentUser?.name
              ? currentUser.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
              : 'U'}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-zinc-900 leading-tight">
              {currentUser?.name || 'User'}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
              {currentUser?.role || 'Guest'} {currentUser?.campus ? `• ${currentUser.campus}` : '• Central'}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
