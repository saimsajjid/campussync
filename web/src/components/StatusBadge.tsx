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
      bg: 'bg-[var(--color-status-synced-bg)]',
      text: 'text-[var(--color-status-synced-text)]',
      border: 'border-[var(--color-status-synced-border)]',
      icon: Check,
      defaultLabel: 'Synced',
    },
    pending: {
      bg: 'bg-[var(--color-status-pending-bg)]',
      text: 'text-[var(--color-status-pending-text)]',
      border: 'border-[var(--color-status-pending-border)]',
      icon: Clock,
      defaultLabel: 'Saved on this device',
    },
    syncing: {
      bg: 'bg-[var(--color-status-sky-light)]',
      text: 'text-[var(--color-status-sky-text)]',
      border: 'border-[var(--color-status-sky-border)]',
      icon: RefreshCw,
      defaultLabel: 'Syncing...',
      spin: true,
    },
    conflict: {
      bg: 'bg-[var(--color-status-conflict-bg)]',
      text: 'text-[var(--color-status-conflict-text)]',
      border: 'border-[var(--color-status-conflict-border)]',
      icon: AlertTriangle,
      defaultLabel: 'Needs your decision',
    },
    rejected: {
      bg: 'bg-[var(--color-status-rejected-bg)]',
      text: 'text-[var(--color-status-rejected-text)]',
      border: 'border-[var(--color-status-rejected-border)]',
      icon: XCircle,
      defaultLabel: 'Not saved',
    },
    locked: {
      bg: 'bg-[var(--color-surface-slate-100)]',
      text: 'text-[var(--color-text-subtle)]',
      border: 'border-[var(--color-border-muted)]',
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
