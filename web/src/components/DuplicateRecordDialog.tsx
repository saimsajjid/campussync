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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-rose-100 bg-rose-50/70 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-bold text-base text-rose-950">
              Duplicate Student Record Detected
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-left">
          <p className="text-sm text-slate-700 leading-relaxed">
            The registration number or CNIC you entered already exists in the university database.
          </p>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono break-words">
            {reason}
          </div>

          <p className="text-xs text-slate-500">
            Choose an action below to proceed without data loss or record duplication:
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            type="button"
            onClick={onCancelCreation}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" /> Cancel Creation
          </button>

          <button
            type="button"
            onClick={() => onOpenExisting(existingRecordId || '')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" /> Open Existing Record
          </button>
        </div>
      </div>
    </div>
  );
};
