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
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-900 border border-zinc-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-zinc-800" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-zinc-900">
              Duplicate Record Detected
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-left">
          <p className="text-xs text-zinc-600 leading-relaxed">
            The registration number or CNIC you entered already exists in the authoritative registry.
          </p>

          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 font-mono break-words">
            {reason}
          </div>

          <p className="text-xs text-zinc-500">
            Choose an action below to proceed without data loss or duplicate records:
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-zinc-50/70 border-t border-zinc-200 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            type="button"
            onClick={onCancelCreation}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-700 border border-zinc-200 hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Cancel Creation
          </button>

          <button
            type="button"
            onClick={() => onOpenExisting(existingRecordId || '')}
            className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-50 bg-zinc-900 hover:bg-zinc-800 shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open Existing Record
          </button>
        </div>
      </div>
    </div>
  );
};
