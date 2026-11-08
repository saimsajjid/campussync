import React from 'react';
import { Menu, Wifi, WifiOff, Sliders, Building2, UserCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { CampusCode } from '../types';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenSimulator: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, onOpenSimulator }) => {
  const { activeCampus, setActiveCampus, simulator, setSimulator, currentUser, addToast } = useApp();

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
    <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] h-[70px] px-4 lg:px-8 flex items-center justify-between">
      {/* Left: Mobile Toggle & Campus Filter */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-[#6B7280] hover:text-[#1E293B] hover:bg-[#F4F6FA] rounded-lg"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Campus Filter Selector */}
        <div className="flex items-center gap-2 bg-[#F4F6FA] border border-[#E5E7EB] rounded-xl px-3 py-1.5">
          <Building2 className="w-4 h-4 text-[#4F7DF3]" />
          <span className="text-xs text-[#6B7280] font-medium hidden sm:inline">Campus Scope:</span>
          <select
            value={activeCampus}
            onChange={(e) => setActiveCampus(e.target.value as CampusCode | 'all')}
            className="text-xs font-semibold bg-transparent text-[#1E293B] focus:outline-none cursor-pointer"
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
              ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B] hover:bg-[#FEE2E2]'
              : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534] hover:bg-[#DCFCE7]'
          }`}
          title="Click to toggle simulated connection state"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              simulator.isOffline ? 'bg-[#EF4444]' : 'bg-[#22C55E] pulse-green'
            }`}
          />
          <span>{simulator.isOffline ? 'Offline' : 'Online'}</span>
          {simulator.isOffline ? (
            <WifiOff className="w-3.5 h-3.5 opacity-80" />
          ) : (
            <Wifi className="w-3.5 h-3.5 opacity-80" />
          )}
        </button>

        {/* Simulator Drawer Trigger */}
        <button
          onClick={onOpenSimulator}
          className="p-2 rounded-xl border border-[#E5E7EB] text-[#6B7280] hover:text-[#4F7DF3] hover:bg-[#EBF0FF] hover:border-[#4F7DF3]/30 transition-all text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          title="Open Hackathon Failure Simulator"
        >
          <Sliders className="w-4 h-4 text-[#4F7DF3]" />
          <span className="hidden md:inline">Simulator</span>
        </button>

        {/* User Profile Info */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#E5E7EB]">
          <UserCircle2 className="w-8 h-8 text-[#4F7DF3]" />
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-[#1E293B] leading-tight">{currentUser.name}</span>
            <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold">
              {currentUser.role} {currentUser.campus ? `• ${currentUser.campus}` : '• Central'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
