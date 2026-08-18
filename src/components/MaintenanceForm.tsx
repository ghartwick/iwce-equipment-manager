import React, { useMemo, useState } from 'react';
import { X, Upload, AlertTriangle, Info } from 'lucide-react';
import { EquipmentMaintenance } from '../types';
import { maintenanceCategoriesService } from '../services/maintenanceCategoriesService';
import { ServiceReading } from '../services/serviceScheduleService';
import { validateReading } from '../services/readingValidation';

interface MaintenanceFormProps {
  equipmentId: string;
  equipmentName: string;
  onClose: () => void;
  onSubmit: (maintenance: EquipmentMaintenance, files?: File[]) => Promise<void>;
  categoryMaintenanceItems?: string[];
  pendingRepairKeys?: string[];
  priorReadings?: ServiceReading[];
  maxReadingPerDay?: number;
}

export function MaintenanceForm({ equipmentName, onClose, onSubmit, categoryMaintenanceItems, pendingRepairKeys, priorReadings, maxReadingPerDay }: MaintenanceFormProps) {
  const [maintenance, setMaintenance] = useState<EquipmentMaintenance>(() => {
    const initial: EquipmentMaintenance = {};
    (pendingRepairKeys || []).forEach(key => { (initial as any)[key] = 'Repair'; });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const categories = maintenanceCategoriesService.getCategories(categoryMaintenanceItems);

  // Validated live against this unit's history so a bad reading is caught at the
  // point of entry rather than silently corrupting the service schedule.
  const readingCheck = useMemo(
    () => validateReading(maintenance.hours, new Date().toISOString(), priorReadings ?? [], {
      maxPerDay: maxReadingPerDay,
      label: 'hours/km reading',
    }),
    [maintenance.hours, priorReadings, maxReadingPerDay]
  );
  const readingBlocked = readingCheck.severity === 'block';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles = [...files, ...Array.from(selectedFiles)];
    setFiles(newFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (readingBlocked) return;

    setIsSubmitting(true);
    try {
      await onSubmit(maintenance, files);
      onClose();
    } catch (error) {
      console.error('Error submitting inspection report:', error);
      alert('Error submitting inspection report: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400">
            Inspection Report - {equipmentName}
          </h2>
          <button onClick={onClose} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Inspection Section */}
          <div className="border-t border-yellow-400 dark:border-yellow-600 pt-4">
            <h3 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-3">Inspection</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* Hours */}
              <div className="md:col-span-2">
                <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1">Hours/KM</label>
                <input
                  type="number"
                  value={maintenance.hours ?? ''}
                  onChange={(e) => setMaintenance({ ...maintenance, hours: e.target.value ? parseFloat(e.target.value) : undefined })}
                  aria-invalid={readingBlocked}
                  className={`w-full px-2 py-1.5 border rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 text-xs focus:outline-none focus:ring-2 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    readingBlocked
                      ? 'border-red-600 focus:ring-red-500'
                      : readingCheck.severity === 'warn'
                        ? 'border-orange-500 focus:ring-orange-500'
                        : 'border-yellow-600 focus:ring-yellow-500'
                  }`}
                />
                {readingCheck.previous && !readingCheck.message && (
                  <p className="mt-1 text-[11px] text-yellow-700/80 dark:text-yellow-300/70">
                    Last recorded: {readingCheck.previous.value.toLocaleString()}
                  </p>
                )}
                {readingCheck.message && (
                  <p
                    role={readingBlocked ? 'alert' : undefined}
                    className={`mt-1 flex items-start gap-1 text-[11px] leading-snug ${
                      readingBlocked
                        ? 'text-red-600 dark:text-red-400'
                        : readingCheck.severity === 'warn'
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-yellow-700/80 dark:text-yellow-300/70'
                    }`}
                  >
                    {readingCheck.severity === 'ok'
                      ? <Info className="h-3 w-3 mt-px shrink-0" />
                      : <AlertTriangle className="h-3 w-3 mt-px shrink-0" />}
                    <span>{readingCheck.message}</span>
                  </p>
                )}
              </div>

              {/* OK/NA Fields */}
              {categories.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1">{label}</label>
                  <select
                    value={(maintenance as any)[key] || ''}
                    onChange={(e) => {
                      const value = e.target.value === 'OK' ? 'OK' : e.target.value === 'NA' ? 'NA' : e.target.value === 'Repair' ? 'Repair' : undefined;
                      setMaintenance(prev => ({ ...prev, [key]: value } as any));
                    }}
                    className="w-full px-2 py-1.5 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="">Select</option>
                    <option value="OK">OK</option>
                    <option value="Repair">Repair</option>
                    <option value="NA">NA</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Notes Section */}
          <div className="border-t border-yellow-400 dark:border-yellow-600 pt-4">
            <h3 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-3">Notes</h3>
            <textarea
              value={maintenance.notes || ''}
              onChange={(e) => setMaintenance({ ...maintenance, notes: e.target.value })}
              placeholder="Enter any additional notes about this inspection report..."
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
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 rounded-md border border-yellow-300 dark:border-yellow-700">
                    <span className="text-xs text-yellow-700 dark:text-yellow-300 truncate flex-1">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="ml-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4" />
                    </button>
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
              disabled={isSubmitting || readingBlocked}
              title={readingBlocked ? 'Correct the hours/km reading before submitting' : undefined}
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
