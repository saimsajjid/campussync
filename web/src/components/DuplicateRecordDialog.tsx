import React from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';

interface DuplicateRecordDialogProps {
  isOpen: boolean;
  reason: string;
  existingRecordId?: string;
  onOpenExisting: (recordId: string) => void;
  onCancelCreation: () => void;
}

export const DuplicateRecordDialog: React.FC<DuplicateRecordDialogProps> = ({
  isOpen,
  reason,
  existingRecordId,
  onOpenExisting,
  onCancelCreation,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[var(--color-border-subtle)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-status-conflict-border)] bg-[var(--color-status-danger-subtle)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-status-danger-red)]/10 text-[var(--color-status-danger-red)] flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-[var(--color-status-danger-red)]" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[var(--color-status-danger-dark)]">
              Duplicate Student Record Detected
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-left">
          <p className="text-sm text-[var(--color-text-dark)] leading-relaxed">
            The registration number or CNIC you entered already exists in the university database.
          </p>

          <div className="p-3.5 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border-muted)] text-xs text-[var(--color-text-dark)] font-mono break-words">
            {reason}
          </div>

          <p className="text-xs text-[var(--color-text-muted)]">
            Choose an action below to proceed without data loss or record duplication:
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-[var(--color-surface-bg)] border-t border-[var(--color-border-subtle)] flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            type="button"
            onClick={onCancelCreation}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[var(--color-text-dark)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-muted)] transition-colors flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" /> Cancel Creation
          </button>

          <button
            type="button"
            onClick={() => onOpenExisting(existingRecordId || '')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4" /> Open Existing Record
          </button>
        </div>
      </div>
    </div>
  );
};
