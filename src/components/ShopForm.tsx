import React, { useEffect, useMemo, useState } from 'react';
import { X, Upload, AlertTriangle } from 'lucide-react';
import { ServiceDueState } from '../services/serviceScheduleService';
import { LEGACY_MAJOR_ID, LEGACY_MINOR_ID } from '../services/serviceScheduleMigration';

interface ShopReport {
  lastServicedDate?: string;
  servicedAt?: number;
  serviceInterval?: number;
  serviceType?: 'minor' | 'major';
  intervalIds?: string[];
  notes?: string;
  files?: File[];
}

interface ShopFormProps {
  equipmentId: string;
  equipmentName: string;
  onClose: () => void;
  onSubmit: (shopReport: ShopReport, previews?: string[]) => Promise<void>;
  intervalStates?: ServiceDueState[];
}

export function AddService({ equipmentName, onClose, onSubmit, intervalStates }: ShopFormProps) {
  const [shopReport, setShopReport] = useState<ShopReport>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [touchedSelection, setTouchedSelection] = useState(false);

  const states = useMemo(() => intervalStates ?? [], [intervalStates]);

  // Joined into a string so the seeding effect depends on a stable primitive.
  // Depending on a freshly built array would re-run it on every render.
  const dueIdsKey = useMemo(
    () => states
      .filter(s => s.status === 'overdue' || s.status === 'due-soon')
      .map(s => s.intervalId)
      .join('|'),
    [states]
  );

  // Whatever is already due is pre-checked, since that is nearly always what the
  // technician just did. Left alone once the user changes the selection.
  useEffect(() => {
    if (touchedSelection) return;
    setSelectedIds(dueIdsKey ? dueIdsKey.split('|') : []);
  }, [dueIdsKey, touchedSelection]);

  const toggleInterval = (intervalId: string) => {
    setTouchedSelection(true);
    setSelectedIds(prev => prev.includes(intervalId)
      ? prev.filter(id => id !== intervalId)
      : [...prev, intervalId]);
  };

  const nothingSelected = states.length > 0 && selectedIds.length === 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles = [...files, ...Array.from(selectedFiles)];
    const newPreviews = [...filePreviews];

    // Generate previews for image files
    for (const file of Array.from(selectedFiles)) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews.push(e.target?.result as string);
          setFilePreviews([...newPreviews]);
        };
        reader.readAsDataURL(file);
      } else {
        newPreviews.push('');
      }
    }

    setFiles(newFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = filePreviews.filter((_, i) => i !== index);
    setFiles(newFiles);
    setFilePreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    if (nothingSelected) return;

    // Legacy serviceType is still derived so the not-yet-migrated views and
    // notification service keep working during the transition.
    const serviceType = selectedIds.includes(LEGACY_MAJOR_ID)
      ? 'major'
      : selectedIds.includes(LEGACY_MINOR_ID)
        ? 'minor'
        : shopReport.serviceType;

    setIsSubmitting(true);
    try {
      await onSubmit(
        { ...shopReport, intervalIds: selectedIds, serviceType, files },
        filePreviews
      );
      onClose();
    } catch (error) {
      console.error('Error submitting shop report:', error);
      alert('Error submitting shop report: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400">
            Service Report - {equipmentName}
          </h2>
          <button onClick={onClose} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Service Section */}
          <div className="border-t border-yellow-400 dark:border-yellow-600 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Serviced Date */}
              <div>
                <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1">Serviced Date</label>
                <input
                  type="date"
                  value={shopReport.lastServicedDate || ''}
                  onChange={(e) => setShopReport({ ...shopReport, lastServicedDate: e.target.value })}
                  className="w-full px-2 py-1.5 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              {/* Serviced At (hours/km when service was performed) */}
              <div>
                <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1">Serviced At (hrs/km)</label>
                <input
                  type="number"
                  value={shopReport.servicedAt ?? ''}
                  onChange={(e) => setShopReport({ ...shopReport, servicedAt: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full px-2 py-1.5 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

            </div>

            {/* Which intervals this card completes. Independent, so one card can
                clear several at once. */}
            {states.length > 0 && (
              <div className="mt-3">
                <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1">
                  Services performed
                </label>
                <div className="space-y-1">
                  {states.map(state => {
                    const checked = selectedIds.includes(state.intervalId);
                    const isDue = state.status === 'overdue' || state.status === 'due-soon';
                    // Rolling intervals restart from the reading entered above,
                    // which is exactly the behaviour the old model got wrong.
                    const nextDue = state.anchor === 'rolling' && shopReport.servicedAt != null
                      ? shopReport.servicedAt + state.interval
                      : null;
                    return (
                      <label
                        key={state.intervalId}
                        className={`flex items-start gap-2 px-2 py-1.5 border rounded-md cursor-pointer transition-colors ${
                          checked
                            ? 'border-yellow-600 bg-yellow-100 dark:bg-yellow-900/30'
                            : 'border-yellow-400 dark:border-yellow-800 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInterval(state.intervalId)}
                          className="mt-0.5 accent-yellow-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-gray-900 dark:text-yellow-100 font-medium">
                              {state.name}
                            </span>
                            {state.status === 'overdue' && (
                              <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-red-700 text-white">
                                OVERDUE
                              </span>
                            )}
                            {state.status === 'due-soon' && (
                              <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                                DUE SOON
                              </span>
                            )}
                          </span>
                          <span className="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            Every {state.interval.toLocaleString()} {state.unit}
                            {state.dueAt != null && ` · was due at ${Math.round(state.dueAt).toLocaleString()}`}
                            {checked && nextDue != null && ` · next due at ${Math.round(nextDue).toLocaleString()}`}
                          </span>
                        </span>
                        {!checked && isDue && (
                          <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
                {nothingSelected && (
                  <p role="alert" className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                    Select at least one service so this card updates a schedule.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="pt-2">
            <h3 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-3">Notes</h3>
            <textarea
              value={shopReport.notes || ''}
              onChange={(e) => setShopReport({ ...shopReport, notes: e.target.value })}
              placeholder="Enter any additional notes about this service report..."
              rows={3}
              className="w-full px-2 py-1.5 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
            />
          </div>

          {/* Attachments Section */}
          <div className="border-t border-yellow-400 dark:border-yellow-600 pt-4">
            <h3 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-3">Attachments</h3>
            <div>
              <input
                type="file"
                id="file-upload"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={isSubmitting}
              />
              <label
                htmlFor="file-upload"
                className={`inline-flex items-center space-x-2 px-3 py-2 bg-yellow-600 text-black rounded-md hover:bg-yellow-500 text-sm font-medium transition-colors cursor-pointer ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Upload className="h-4 w-4" />
                <span>Upload Files</span>
              </label>
            </div>
            
            {files.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {files.map((file, index) => (
                  <div key={index} className="relative bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-md border border-yellow-300 dark:border-yellow-700">
                    {filePreviews[index] ? (
                      <img 
                        src={filePreviews[index]} 
                        alt={file.name}
                        className="w-full h-24 object-cover rounded mb-1"
                      />
                    ) : (
                      <div className="w-full h-24 bg-yellow-100 dark:bg-yellow-800 flex items-center justify-center rounded mb-1">
                        <span className="text-xs text-yellow-600 dark:text-yellow-400">{file.type.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-yellow-700 dark:text-yellow-300 truncate flex-1 mr-2">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex-shrink-0"
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-3 border border-yellow-600 rounded-md text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || nothingSelected}
              title={nothingSelected ? 'Select at least one service performed' : undefined}
              className="px-4 py-3 bg-yellow-600 text-black rounded-md hover:bg-yellow-500 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
