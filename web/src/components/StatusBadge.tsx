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
      bg: 'bg-zinc-100 text-zinc-900 border-zinc-200',
      icon: Check,
      defaultLabel: 'Synced',
    },
    pending: {
      bg: 'bg-zinc-100 text-zinc-700 border-zinc-200',
      icon: Clock,
      defaultLabel: 'Saved locally',
    },
    syncing: {
      bg: 'bg-zinc-100 text-zinc-900 border-zinc-200',
      icon: RefreshCw,
      defaultLabel: 'Syncing...',
      spin: true,
    },
    conflict: {
      bg: 'bg-zinc-200 text-zinc-900 border-zinc-300 font-semibold',
      icon: AlertTriangle,
      defaultLabel: 'Conflict',
    },
    rejected: {
      bg: 'bg-zinc-100 text-zinc-600 border-zinc-200',
      icon: XCircle,
      defaultLabel: 'Not saved',
    },
    locked: {
      bg: 'bg-zinc-100 text-zinc-500 border-zinc-200',
      icon: Lock,
      defaultLabel: 'Locked',
    },
  };

  const cfg = configs[status] || configs.synced;
  const IconComponent = cfg.icon;
  const isSpin = 'spin' in cfg && cfg.spin;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors ${cfg.bg} ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <IconComponent className={`w-3 h-3 ${isSpin ? 'animate-spin' : ''}`} />
      <span>{label || cfg.defaultLabel}</span>
    </span>
  );
};
