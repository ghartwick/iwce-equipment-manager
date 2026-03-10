import React, { useState } from 'react';
import { Equipment } from '../types';
import { equipmentHistoryFirebaseService } from '../services/equipmentHistoryFirebaseService';
import { EquipmentLog } from '../components/EquipmentLog';
import { Clock } from 'lucide-react';

interface InventoryPageCleanProps {
  // Props will be added later
}

function InventoryPageClean({}: InventoryPageCleanProps) {
  console.log('InventoryPageClean component rendered');
  
  // State for equipment log and editing
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [showLog, setShowLog] = useState(false);
  
  // Mock data for testing
  const mockProducts: Equipment[] = [
    {
      id: 'eq-1',
      name: 'Radio Set 1',
      serialNumber: 'RS001',
      category: 'Radio Equipment',
      employee: 'John Doe',
      site: 'Site A',
      repair: false,
      repairDescription: 'No issues',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'eq-2', 
      name: 'Radio Set 2',
      serialNumber: 'RS002',
      category: 'Radio Equipment',
      employee: 'Jane Smith',
      site: 'Site B',
      repair: true,
      repairDescription: 'Needs maintenance',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // Handle viewing equipment history
  const handleViewHistory = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setShowLog(true);
  };

  // Test Firebase history tracking
  const testFirebaseHistory = async () => {
    console.log('=== TESTING FIREBASE HISTORY ===');
    
    // Use mock data to test
    const testEquipment = mockProducts[0];
    const mockUser = { username: 'Admin', role: 'admin' };
    
    console.log('Test equipment:', testEquipment);
    console.log('Mock user:', mockUser);
    console.log('Enabling Firebase service...');
    
    try {
      await equipmentHistoryFirebaseService.trackEquipmentChange(
        'updated',
        testEquipment,
        mockUser,
        testEquipment
      );
      alert('✅ Firebase history test successful! History saved to Firebase.');
    } catch (error) {
      console.error('❌ Firebase history test failed:', error);
      alert('❌ Firebase history test failed: ' + (error as Error).message);
    }
    
    console.log('=============================');
  };

  return (
    <div className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-yellow-400">Equipment Inventory</h1>
        <p className="text-yellow-600">Clean InventoryPage for testing</p>
      </div>

      {/* Test Button for Firebase History */}
      <div className="mb-4 flex justify-center">
        <button
          onClick={testFirebaseHistory}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          TEST FIREBASE HISTORY
        </button>
      </div>

      {/* Equipment List */}
      <div className="bg-black border border-yellow-600 rounded-lg shadow overflow-hidden">
        <div className="min-w-full divide-y divide-yellow-800">
          <thead className="bg-yellow-900 bg-opacity-20">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-yellow-400 uppercase tracking-wider">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-yellow-400 uppercase tracking-wider">Serial</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-yellow-400 uppercase tracking-wider">Category</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-yellow-400 uppercase tracking-wider">Employee</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-yellow-400 uppercase tracking-wider">Site</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-yellow-400 uppercase tracking-wider">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-yellow-400 uppercase tracking-wider">History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-yellow-800">
            {mockProducts.map((product) => (
              <tr key={product.id} className="hover:bg-yellow-900 hover:bg-opacity-10">
                <td className="px-3 py-2 whitespace-nowrap text-sm text-yellow-100">{product.name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-yellow-300">{product.serialNumber}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-yellow-300">{product.category}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-yellow-300">{product.employee}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-yellow-300">{product.site}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-900 bg-opacity-30 text-green-400">
                    Active
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleViewHistory(product)}
                    className="p-1 text-yellow-400 hover:text-yellow-300 transition-colors"
                    title="View edit history"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </div>
      </div>

      {/* Equipment Log - Shows when Clock icon is clicked */}
      {showLog && selectedEquipment && (
        <div className="mt-4">
          <EquipmentLog
            equipment={selectedEquipment}
            onClose={() => setShowLog(false)}
          />
        </div>
      )}
    </div>
  );
}

export default InventoryPageClean;
