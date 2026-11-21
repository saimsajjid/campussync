import React from 'react';
import { Check, Clock, RefreshCw, AlertTriangle, XCircle, Lock } from 'lucide-react';
import type { FieldStatusType } from '../types';

interface StatusBadgeProps {
  status: FieldStatusType;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm' }) => {
  const configs = {
    synced: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200/60',
      icon: Check,
      defaultLabel: 'Synced',
    },
    pending: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200/60',
      icon: Clock,
      defaultLabel: 'Saved locally',
    },
    syncing: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200/60',
      icon: RefreshCw,
      defaultLabel: 'Syncing...',
      spin: true,
    },
    conflict: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200/60',
      icon: AlertTriangle,
      defaultLabel: 'Conflict',
    },
    rejected: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200/60',
      icon: XCircle,
      defaultLabel: 'Not saved',
    },
    locked: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200/60',
      icon: Lock,
      defaultLabel: 'Locked',
    },
  };

  const cfg = configs[status] || configs.synced;
  const IconComponent = cfg.icon;
  const isSpin = 'spin' in cfg && cfg.spin;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <IconComponent className={`w-3.5 h-3.5 ${isSpin ? 'animate-spin' : ''}`} />
      <span>{label || cfg.defaultLabel}</span>
    </span>
  );
};
