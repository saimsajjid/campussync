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
      bg: 'bg-[#DCFCE7]',
      text: 'text-[#15803D]',
      border: 'border-[#BBF7D0]',
      icon: Check,
      defaultLabel: 'Synced',
    },
    pending: {
      bg: 'bg-[#FEF3C7]',
      text: 'text-[#B45309]',
      border: 'border-[#FDE68A]',
      icon: Clock,
      defaultLabel: 'Pending Sync',
    },
    syncing: {
      bg: 'bg-[#F0F9FF]',
      text: 'text-[#0369A1]',
      border: 'border-[#BAE6FD]',
      icon: RefreshCw,
      defaultLabel: 'Syncing...',
      spin: true,
    },
    conflict: {
      bg: 'bg-[#FEE2E2]',
      text: 'text-[#B91C1C]',
      border: 'border-[#FECACA]',
      icon: AlertTriangle,
      defaultLabel: 'Conflict',
    },
    rejected: {
      bg: 'bg-[#FFF1F2]',
      text: 'text-[#9F1239]',
      border: 'border-[#FECDD3]',
      icon: XCircle,
      defaultLabel: 'Rejected',
    },
    locked: {
      bg: 'bg-[#F1F5F9]',
      text: 'text-[#64748B]',
      border: 'border-[#CBD5E1]',
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
