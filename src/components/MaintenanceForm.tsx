import React, { useState } from 'react';
import { X } from 'lucide-react';
import { EquipmentMaintenance } from '../types';

interface MaintenanceFormProps {
  equipmentId: string;
  equipmentName: string;
  onClose: () => void;
  onSubmit: (maintenance: EquipmentMaintenance) => Promise<void>;
}

export function MaintenanceForm({ equipmentName, onClose, onSubmit }: MaintenanceFormProps) {
  const [maintenance, setMaintenance] = useState<EquipmentMaintenance>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(maintenance);
      onClose();
    } catch (error) {
      console.error('Error submitting maintenance report:', error);
      alert('Error submitting maintenance report: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400">
            Maintenance Report - {equipmentName}
          </h2>
          <button onClick={onClose} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Maintenance Section */}
          <div className="border-t border-yellow-400 dark:border-yellow-600 pt-4">
            <h3 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-3">Maintenance</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* Hours */}
              <div>
                <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1">Hours</label>
                <input
                  type="number"
                  value={maintenance.hours || ''}
                  onChange={(e) => setMaintenance({ ...maintenance, hours: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full px-2 py-1.5 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* OK/NA Fields */}
              {[
                { key: 'stepsHandRails', label: 'Steps/Hand Rails' },
                { key: 'tiresTracks', label: 'Tires/Tracks' },
                { key: 'bucket', label: 'Bucket' },
                { key: 'cuttingEdgeTeeth', label: 'Cutting Edge/Teeth' },
                { key: 'hoses', label: 'Hoses' },
                { key: 'batteryCableBeltHosesFilterGuards', label: 'Battery Cable, Belt, Hoses, Filter, Guards' },
                { key: 'backupAlarm', label: 'Backup Alarm' },
                { key: 'fireExtinguisher', label: 'Fire Extinguisher' },
                { key: 'gauges', label: 'Gauges' },
                { key: 'horn', label: 'Horn' },
                { key: 'spillKit', label: 'Spill Kit' },
                { key: 'glass', label: 'Glass (all sides)' },
                { key: 'mirror', label: 'Mirror' },
                { key: 'rollOverProtection', label: 'Roll Over Protection' },
                { key: 'seatBeltSeat', label: 'Seat Belt/Seat' },
              ].map(({ key, label }) => (
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

              {/* All Fluids Level */}
              <div>
                <label className="block text-xs text-yellow-700 dark:text-yellow-300 mb-1">All Fluids Level</label>
                <select
                  value={maintenance.allFluidsLevel || ''}
                  onChange={(e) => {
                    const value = e.target.value === 'OK' ? 'OK' : e.target.value === 'NA' ? 'NA' : e.target.value === 'Repair' ? 'Repair' : undefined;
                    setMaintenance({ ...maintenance, allFluidsLevel: value });
                  }}
                  className="w-full px-2 py-1.5 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">Select</option>
                  <option value="OK">OK</option>
                  <option value="Repair">Repair</option>
                  <option value="NA">NA</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="border-t border-yellow-400 dark:border-yellow-600 pt-4">
            <h3 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-3">Notes</h3>
            <textarea
              value={maintenance.notes || ''}
              onChange={(e) => setMaintenance({ ...maintenance, notes: e.target.value })}
              placeholder="Enter any additional notes about this maintenance report..."
              rows={3}
              className="w-full px-2 py-1.5 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
            />
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
              disabled={isSubmitting}
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
