import React from 'react';
import {
  X,
  Sliders,
  WifiOff,
  Clock,
  RotateCcw,
  Zap,
  Smartphone,
  ShieldAlert,
  HelpCircle,
  Radio
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface FailureSimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FailureSimulatorDrawer: React.FC<FailureSimulatorDrawerProps> = ({ isOpen, onClose }) => {
  const {
    simulator,
    setSimulator,
    injectRemoteConflict,
    resetDemoData,
    addToast
  } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-[var(--color-border-subtle)]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--color-border-subtle)] flex items-center justify-between bg-[var(--color-surface-muted)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--color-text-dark)]">Network Simulator</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-border-subtle)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Network Latency & Connectivity */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[var(--color-primary)]" /> Network Conditions
            </h4>

            {/* Offline Toggle */}
            <div className="p-3.5 rounded-xl border border-[var(--color-border-subtle)] bg-white flex items-center justify-between shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-[var(--color-text-dark)]">Simulated Offline</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">Queue edits locally while disconnected</p>
              </div>
              <input
                type="checkbox"
                checked={simulator.isOffline}
                onChange={(e) => {
                  setSimulator((s) => ({ ...s, isOffline: e.target.checked }));
                  addToast(e.target.checked ? 'Offline mode enabled' : 'Online mode restored', 'info');
                }}
                className="w-5 h-5 accent-[var(--color-primary)] cursor-pointer"
              />
            </div>

            {/* Slow Network Toggle */}
            <div className="p-3.5 rounded-xl border border-[var(--color-border-subtle)] bg-white flex items-center justify-between shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-semibold text-[var(--color-text-dark)]">Slow Campus Latency</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">Adds 2.5s delay to demonstrate pending badges</p>
              </div>
              <input
                type="checkbox"
                checked={simulator.isSlowNetwork}
                onChange={(e) => setSimulator((s) => ({ ...s, isSlowNetwork: e.target.checked }))}
                className="w-5 h-5 accent-[var(--color-primary)] cursor-pointer"
              />
            </div>
          </div>

          {/* Section 2: Failure Injection & Idempotency */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[var(--color-status-danger-red)]" /> Failure injection
            </h4>

            {/* Drop Next Response */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                simulator.dropNextResponse
                  ? 'border-[var(--color-status-danger-red)] bg-[var(--color-status-danger-subtle)]'
                  : 'border-[var(--color-border-subtle)] bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[var(--color-status-danger-red)]" />
                    <span className="text-sm font-bold text-[var(--color-text-dark)]">Drop Next Response</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                    Server commits the change, but the response packet is discarded in transit. Tests automatic client retry and transaction idempotency.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={simulator.dropNextResponse}
                  onChange={(e) => {
                    setSimulator((s) => ({ ...s, dropNextResponse: e.target.checked }));
                    if (e.target.checked) {
                      addToast('Next response will be dropped to test idempotency retry', 'warning');
                    }
                  }}
                  className="w-5 h-5 accent-[var(--color-status-danger-red)] cursor-pointer mt-1"
                />
              </div>
            </div>

            {/* Drop Next Request */}
            <div className="p-3.5 rounded-xl border border-[var(--color-border-subtle)] bg-white flex items-center justify-between shadow-xs">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-[var(--color-text-dark)]">Drop Next Request</span>
                <p className="text-xs text-[var(--color-text-muted)]">Fails before reaching server; tests outbox backoff</p>
              </div>
              <input
                type="checkbox"
                checked={simulator.dropNextRequest}
                onChange={(e) => setSimulator((s) => ({ ...s, dropNextRequest: e.target.checked }))}
                className="w-5 h-5 accent-[var(--color-primary)] cursor-pointer"
              />
            </div>
          </div>

          {/* Section 3: Dual-Device Simulation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[var(--color-primary)]" /> Device Identity
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSimulator((s) => ({ ...s, currentDeviceId: 'Device A (Admin/Campus)' }))}
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                  simulator.currentDeviceId === 'Device A (Admin/Campus)'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] shadow-xs'
                    : 'border-[var(--color-border-subtle)] bg-white text-[var(--color-text-muted)] hover:bg-gray-50'
                }`}
              >
                <div className="font-bold">Device A</div>
                <div className="text-[11px] opacity-80">Admin Workstation</div>
              </button>

              <button
                type="button"
                onClick={() => setSimulator((s) => ({ ...s, currentDeviceId: 'Device B (Student/Mobile)' }))}
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                  simulator.currentDeviceId === 'Device B (Student/Mobile)'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] shadow-xs'
                    : 'border-[var(--color-border-subtle)] bg-white text-[var(--color-text-muted)] hover:bg-gray-50'
                }`}
              >
                <div className="font-bold">Device B</div>
                <div className="text-[11px] opacity-80">Student Mobile App</div>
              </button>
            </div>
          </div>

          {/* Section 4: Diagnostics & Reset */}
          <div className="space-y-3 pt-2 border-t border-[var(--color-border-subtle)]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Diagnostics & Environment</h4>

            <button
              onClick={injectRemoteConflict}
              className="w-full py-2.5 px-4 bg-white border border-[var(--color-status-warning-amber)] text-[var(--color-status-pending-text)] hover:bg-[var(--color-status-pending-bg)] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <Zap className="w-4 h-4" /> Simulate Remote Conflict
            </button>

            <button
              onClick={resetDemoData}
              className="w-full py-2.5 px-4 bg-white border border-[var(--color-border-muted)] text-[var(--color-text-subtle)] hover:text-[var(--color-text-dark)] hover:bg-gray-100 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Reset Database to Seed State
            </button>
          </div>
        </div>

        {/* Footer info note */}
        <div className="p-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-[11px] text-[var(--color-text-muted)] flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />
          <span>All simulation state is kept client-side and resets on session refresh.</span>
        </div>
      </div>
    </div>
  );
};
