import { useState, useEffect } from 'react';
import { Clock, User, X } from 'lucide-react';
import { Equipment } from '../types';
import { equipmentHistoryFirebaseService, EditHistory } from '../services/equipmentHistoryFirebaseService';

interface EquipmentLogProps {
  equipment: Equipment | null;
  onClose: () => void;
}

export function EquipmentLog({ equipment, onClose }: EquipmentLogProps) {
  const [history, setHistory] = useState<EditHistory[]>([]);

  // Update history whenever equipment changes or component mounts
  useEffect(() => {
    if (equipment) {
      const updateHistory = async () => {
        if (!equipment) return;
        
        try {
          const historyData = await equipmentHistoryFirebaseService.getEquipmentHistory(equipment.id);
          setHistory(historyData);
        } catch (error) {
          console.error('Failed to load equipment history:', error);
          setHistory([]);
        }
      };
      
      // Initial load
      updateHistory();
      
      // Set up a timer to check for updates (simple polling approach)
      const interval = setInterval(updateHistory, 5000); // Increased to 5 seconds for Firebase
      
      return () => clearInterval(interval);
    }
  }, [equipment]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'text-green-400 border-green-800';
      case 'updated':
        return 'text-yellow-400 border-yellow-800';
      case 'deleted':
        return 'text-red-400 border-red-800';
      default:
        return 'text-gray-400 border-gray-800';
    }
  };

  if (!equipment) {
    return null;
  }

  return (
    <div className="bg-black border border-yellow-600 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-yellow-400 flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Equipment Edit History</span>
        </h2>
        <button
          onClick={onClose}
          className="p-1 text-yellow-400 hover:text-yellow-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4 p-3 bg-yellow-900 rounded-lg">
        <h3 className="text-sm font-medium text-yellow-300 mb-1">Current Equipment</h3>
        <p className="text-yellow-100 font-medium">{equipment.name}</p>
        <p className="text-yellow-600 text-sm">Serial: {equipment.serialNumber}</p>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {history.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400">No edit history available</p>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className={`border rounded-lg p-3 ${getActionColor(entry.action)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <User className="h-3 w-3" />
                  <span className="text-sm">{entry.user}</span>
                  <span className="text-xs opacity-75">({entry.userRole})</span>
                </div>
                <span className="text-xs opacity-75">
                  {formatDate(entry.timestamp)}
                </span>
              </div>

              {entry.changes && entry.changes.length > 0 && (
                <div className="mt-0.5 space-y-0">
                  {entry.changes.map((change, index) => (
                    <div key={index} className="text-xs bg-black bg-opacity-30 rounded p-1">
                      <span className="font-medium capitalize">{change.field}:</span> <span className="text-green-400">{change.newValue || '(empty)'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
