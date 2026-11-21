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
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200/80">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Network Diagnostics</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Network Latency & Connectivity */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-blue-600" /> Network Conditions
            </h4>

            {/* Offline Toggle */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-slate-900">Simulated Offline</span>
                </div>
                <p className="text-xs text-slate-500">Queue edits locally while disconnected</p>
              </div>
              <input
                type="checkbox"
                checked={simulator.isOffline}
                onChange={(e) => {
                  setSimulator((s) => ({ ...s, isOffline: e.target.checked }));
                  addToast(e.target.checked ? 'Offline mode enabled' : 'Online mode restored', 'info');
                }}
                className="w-5 h-5 accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Slow Network Toggle */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-semibold text-slate-900">Slow Campus Latency</span>
                </div>
                <p className="text-xs text-slate-500">Adds 2.5s delay to demonstrate pending badges</p>
              </div>
              <input
                type="checkbox"
                checked={simulator.isSlowNetwork}
                onChange={(e) => setSimulator((s) => ({ ...s, isSlowNetwork: e.target.checked }))}
                className="w-5 h-5 accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Section 2: Failure Injection & Idempotency */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Failure injection
            </h4>

            {/* Drop Next Response */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                simulator.dropNextResponse
                  ? 'border-rose-300 bg-rose-50/50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-rose-600" />
                    <span className="text-sm font-bold text-slate-900">Drop Next Response</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
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
                  className="w-5 h-5 accent-rose-600 cursor-pointer mt-1"
                />
              </div>
            </div>

            {/* Drop Next Request */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-slate-900">Drop Next Request</span>
                <p className="text-xs text-slate-500">Fails before reaching server; tests outbox backoff</p>
              </div>
              <input
                type="checkbox"
                checked={simulator.dropNextRequest}
                onChange={(e) => setSimulator((s) => ({ ...s, dropNextRequest: e.target.checked }))}
                className="w-5 h-5 accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Section 3: Dual-Device Simulation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" /> Device Identity
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSimulator((s) => ({ ...s, currentDeviceId: 'Device A (Admin/Campus)' }))}
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                  simulator.currentDeviceId === 'Device A (Admin/Campus)'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold">Device A</div>
                <div className="text-[11px] opacity-80">Admin Workstation</div>
              </button>

              <button
                type="button"
                onClick={() => setSimulator((s) => ({ ...s, currentDeviceId: 'Device B (Student/Mobile)' }))}
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                  simulator.currentDeviceId === 'Device B (Student/Mobile)'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold">Device B</div>
                <div className="text-[11px] opacity-80">Student Mobile App</div>
              </button>
            </div>
          </div>

          {/* Section 4: Diagnostics & Reset */}
          <div className="space-y-3 pt-2 border-t border-slate-200/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Diagnostics & Environment</h4>

            <button
              onClick={injectRemoteConflict}
              className="w-full py-2.5 px-4 bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-600" /> Simulate Remote Conflict
            </button>

            <button
              onClick={resetDemoData}
              className="w-full py-2.5 px-4 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" /> Reset Database to Seed State
            </button>
          </div>
        </div>

        {/* Footer info note */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/70 text-[11px] text-slate-500 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>All simulation state is kept client-side and resets on session refresh.</span>
        </div>
      </div>
    </div>
  );
};
