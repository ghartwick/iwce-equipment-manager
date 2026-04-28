import { useState, useEffect } from 'react';
import { User, X, Wrench } from 'lucide-react';
import { Equipment } from '../types';
import { maintenanceHistoryFirebaseService, MaintenanceReport } from '../services/maintenanceHistoryFirebaseService';

interface MaintenanceHistoryProps {
  equipment: Equipment | null;
  onClose: () => void;
}

export function MaintenanceHistory({ equipment, onClose }: MaintenanceHistoryProps) {
  const [history, setHistory] = useState<MaintenanceReport[]>([]);

  useEffect(() => {
    if (equipment) {
      const updateHistory = async () => {
        if (!equipment) return;
        
        try {
          const historyData = await maintenanceHistoryFirebaseService.getEquipmentMaintenanceHistory(equipment.id);
          setHistory(historyData);
        } catch (error) {
          console.error('Failed to load maintenance history:', error);
          setHistory([]);
        }
      };
      
      updateHistory();
      
      const interval = setInterval(updateHistory, 5000);
      
      return () => clearInterval(interval);
    }
  }, [equipment]);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const getMaintenanceSummary = (maintenance: any): string => {
    const fields: string[] = [];
    
    if (maintenance.hours) fields.push(`Hours: ${maintenance.hours}`);
    if (maintenance.lastServicedDate) fields.push(`Last Serviced: ${maintenance.lastServicedDate}`);
    if (maintenance.lastServiceHours) fields.push(`Last Service Hours: ${maintenance.lastServiceHours}`);
    if (maintenance.serviceInterval) fields.push(`Service Interval: ${maintenance.serviceInterval}`);
    
    const okFields = [
      'stepsHandRails', 'tiresTracks', 'bucket', 'cuttingEdgeTeeth', 'hoses',
      'batteryCableBeltHosesFilterGuards', 'backupAlarm', 'fireExtinguisher',
      'gauges', 'horn', 'spillKit', 'glass', 'mirror', 'rollOverProtection', 'seatBeltSeat'
    ];
    
    const okCount = okFields.filter(f => maintenance[f] === 'OK').length;
    const naCount = okFields.filter(f => maintenance[f] === 'NA').length;
    
    if (okCount > 0 || naCount > 0) {
      fields.push(`Checks: ${okCount} OK, ${naCount} NA`);
    }
    
    if (maintenance.allFluidsLevel === 'OK') fields.push('All Fluids: OK');
    if (maintenance.needsRepairsService) fields.push('Needs Repairs');
    
    return fields.length > 0 ? fields.join(' | ') : 'No data';
  };

  if (!equipment) {
    return null;
  }

  return (
    <div className="bg-yellow-200 dark:bg-black p-2 sm:p-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400 flex items-center space-x-2">
          <Wrench className="h-5 w-5" />
          <span>Maintenance History</span>
        </h2>
        <button
          onClick={onClose}
          className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
        <h3 className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Equipment</h3>
        <p className="text-gray-900 dark:text-yellow-100 font-medium">{equipment.name}</p>
        <p className="text-yellow-700 dark:text-yellow-600 text-sm">Serial: {equipment.serialNumber}</p>
      </div>

      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400">No maintenance reports available</p>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className="border border-yellow-600 rounded-lg p-3 bg-yellow-100 dark:bg-yellow-900"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <User className="h-3 w-3" />
                  <span className="text-sm">{entry.createdBy}</span>
                  <span className="text-xs opacity-75">({entry.createdByRole})</span>
                </div>
                <span className="text-xs opacity-75">
                  {formatDate(entry.createdAt)}
                </span>
              </div>

              <div className="mt-2 text-xs bg-white dark:bg-black dark:bg-opacity-30 rounded p-2">
                <p className="text-gray-900 dark:text-yellow-100">{getMaintenanceSummary(entry.maintenance)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
