import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useInventory } from '../hooks/useInventory';
import { ProductForm } from '../components/ProductForm';
import { AlertPanel } from '../components/AlertPanel';
import { ServiceIntervalBar } from '../components/ServiceIntervalBar';
import { Equipment } from '../types';
import { fleetManagementService } from '../services/fleetManagementService';
import { maintenanceHistoryFirebaseService } from '../services/maintenanceHistoryFirebaseService';
import { shopHistoryFirebaseService } from '../services/shopHistoryFirebaseService';

export default function EquipmentPage() {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { products, categories, updateProduct, loading, loadAlerts, alerts } = useInventory();

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [isFleet, setIsFleet] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertDaysAgo, setAlertDaysAgo] = useState(7);
  const [currentHours, setCurrentHours] = useState<number>(0);
  const [nextServiceAt, setNextServiceAt] = useState<number>(0);

  useEffect(() => {
    const loadEquipment = async () => {
      if (!equipmentId) return;
      
      // First check inventory products
      const found = products.find(p => p.id === equipmentId);
      if (found) {
        setEquipment(found);
        setIsFleet(false);
        return;
      }
      
      // If not found, check fleet collection
      try {
        const allFleet = await fleetManagementService.getAllEquipment();
        const fleetItem = allFleet.find(f => f.id === equipmentId);
        if (fleetItem) {
          setEquipment(fleetItem);
          setIsFleet(true);
        } else {
          setEquipment(null);
          setIsFleet(false);
        }
      } catch (err) {
        console.error('Error loading fleet equipment:', err);
        setEquipment(null);
        setIsFleet(false);
      }
    };
    
    if (!loading) {
      loadEquipment();
    }
  }, [products, equipmentId, loading]);

  // Load maintenance history for service interval calculation
  useEffect(() => {
    const loadMaintenanceHistory = async () => {
      if (!equipmentId || !equipment) return;
      
      try {
        const history = await maintenanceHistoryFirebaseService.getEquipmentMaintenanceHistory(equipmentId);
        
        if (history.length > 0) {
          const latestReport = history[0];
          setCurrentHours(latestReport.maintenance.hours || 0);
        }
        
        // Load latest shop report to get next service due point
        const shopHistory = await shopHistoryFirebaseService.getEquipmentShopHistory(equipmentId);
        if (shopHistory.length > 0) {
          const latestShopReport = shopHistory[0];
          setNextServiceAt(latestShopReport.lastServiceHours || 0);
        }
      } catch (error) {
        console.error('Error loading maintenance history:', error);
      }
    };
    
    if (equipment) {
      loadMaintenanceHistory();
    }
  }, [equipmentId, equipment]);

  // Listen for toggleAlerts custom event
  useEffect(() => {
    const handleToggleAlerts = async () => {
      if (!showAlerts) {
        setAlertDaysAgo(7);
        await loadAlerts(7);
      }
      setShowAlerts(!showAlerts);
    };

    window.addEventListener('toggleAlerts', handleToggleAlerts as EventListener);
    return () => {
      window.removeEventListener('toggleAlerts', handleToggleAlerts as EventListener);
    };
  }, [showAlerts, loadAlerts]);

  const handleLoadMoreAlerts = async () => {
    const newDaysAgo = alertDaysAgo + 7;
    setAlertDaysAgo(newDaysAgo);
    await loadAlerts(newDaysAgo);
  };

  const handleEdit = async (productData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!equipment) return;
    try {
      if (isFleet) {
        await fleetManagementService.updateEquipment(
          equipment.id,
          { ...productData, updatedAt: new Date().toISOString() },
          user ? { username: user.username, role: user.role } : undefined
        );
      } else {
        await updateProduct(equipment.id, { ...productData, updatedAt: new Date().toISOString() });
      }
      
      // Check if only notes were updated (no other fields changed)
      const notesOnly = Object.keys(productData).length === 1 && 'notes' in productData;
      
      // Only navigate back if it's not a notes-only update
      if (!notesOnly) {
        navigate('/inventory');
      }
    } catch (error) {
      console.error('Update failed:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-lg text-yellow-600 dark:text-yellow-400">Loading...</div>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">Equipment not found.</div>
          <button
            onClick={() => navigate('/inventory')}
            className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500"
          >
            Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="px-4 sm:px-6 lg:px-6 py-2 sm:py-3 -mx-4 sm:-mx-6 lg:mx-0">
      <div className="max-w-5xl mx-auto">
        {/* Alerts Section */}
        {showAlerts && (
          <div className="mb-3">
            <AlertPanel 
              alerts={alerts} 
              products={products}
              onLoadMore={handleLoadMoreAlerts}
              hasMore={alerts.length >= 50}
            />
          </div>
        )}

        <ProductForm
          categories={categories}
          product={equipment}
          onSubmit={handleEdit}
          onCancel={() => navigate('/inventory')}
          userRole={user?.role || 'field'}
          useEmployeeColumn={isFleet}
          serviceIntervalBar={equipment ? (
            <ServiceIntervalBar
              currentHours={currentHours}
              nextServiceAt={nextServiceAt}
              serviceInterval={equipment.serviceInterval || 0}
              serviceNotification={equipment.serviceNotification || 0}
            />
          ) : null}
        />
      </div>
    </main>
  );
}
