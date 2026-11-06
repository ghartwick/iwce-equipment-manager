import React, { useState } from 'react';
import { X } from 'lucide-react';
import { shopHistoryFirebaseService } from '../services/shopHistoryFirebaseService';
import { equipmentServiceLogService } from '../services/equipmentServiceLogService';

export interface ResolveRepairTarget {
  equipmentId: string;
  equipmentName: string;
  site?: string;
  itemIds: string[];
  label: string;
  kind: 'repair' | 'note';
}

interface ResolveRepairModalProps {
  target: ResolveRepairTarget;
  user: { username: string; name?: string; role: string };
  onCancel: () => void;
  // Called once the service card has been recorded — the caller performs the
  // actual check-off so each screen can update its own local state.
  onConfirm: () => Promise<void>;
}

// Prompts the user to record a service card describing the repair whenever they
// clear a flagged repair or a note off the repair list. This keeps a complete
// service/repair history for the unit rather than silently dropping the item.
export function ResolveRepairModal({ target, user, onCancel, onConfirm }: ResolveRepairModalProps) {
  const [description, setDescription] = useState('');
  const [servicedDate, setServicedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [servicedAt, setServicedAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const displayName = user.name || user.username;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!description.trim()) {
      alert('Please describe the repair that was completed.');
      return;
    }

    setSubmitting(true);
    try {
      const hours = servicedAt ? parseFloat(servicedAt) : undefined;
      const notes = `Repair completed — ${target.label}\n${description.trim()}`;

      const reportId = await shopHistoryFirebaseService.addShopReport(
        target.equipmentId,
        target.equipmentName,
        target.site || '',
        {
          lastServicedDate: servicedDate || undefined,
          servicedAt: Number.isFinite(hours as number) ? hours : undefined,
          notes,
        },
        { username: displayName, role: user.role }
      );

      await equipmentServiceLogService.addEntry({
        equipmentId: target.equipmentId,
        equipmentName: target.equipmentName,
        type: 'repair_resolved',
        description: `${target.kind === 'note' ? 'Note' : 'Repair'} cleared — ${target.label}: ${description.trim()}`,
        createdAt: new Date().toISOString(),
        createdBy: displayName,
        createdByRole: user.role,
        linkedReportId: reportId,
        linkedReportType: 'shop',
      });

      await onConfirm();
    } catch (error) {
      console.error('Failed to record repair resolution:', error);
      alert('Error recording the service card: ' + (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-yellow-600"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-yellow-600 bg-yellow-600 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-black">Create Service Card</h2>
            <p className="text-xs text-black/70 mt-0.5">
              {target.equipmentName} — {target.label}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-yellow-700 text-black transition-colors"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Clearing this item records a service card so the unit keeps a full repair history.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              What was done? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Describe the repair performed, parts used, etc."
              className="w-full px-3 py-2 border border-yellow-600 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Repair Date</label>
              <input
                type="date"
                value={servicedDate}
                onChange={e => setServicedDate(e.target.value)}
                className="w-full px-3 py-2 border border-yellow-600 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hours/KM (optional)</label>
              <input
                type="number"
                value={servicedAt}
                onChange={e => setServicedAt(e.target.value)}
                className="w-full px-3 py-2 border border-yellow-600 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 border border-yellow-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-yellow-50 dark:hover:bg-gray-800 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save & Clear Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
