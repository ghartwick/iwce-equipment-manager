import { useState, useEffect } from 'react';
import { Equipment, Category, StockAlert } from '../types';
import { 
  getEquipment, 
  addEquipment, 
  updateEquipment, 
  deleteEquipment,
  getCategories,
  addCategory as _addCategory,
  updateCategory as _updateCategory,
  deleteCategory as _deleteCategory
} from '../services/firebaseService';
import { equipmentManagementService } from '../services/equipmentManagementService';
import { equipmentHistoryFirebaseService } from '../services/equipmentHistoryFirebaseService';
import { alertsFirebaseService } from '../services/alertsFirebaseService';
import { useAuth } from './useAuth';

export function useInventory(refreshKey?: number) {
  const [products, setProducts] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load data from Firebase
      const [loadedProducts, loadedCategories, heavyEquipment] = await Promise.all([
        getEquipment(),
        getCategories(),
        equipmentManagementService.getInventoryEquipment()
      ]);
      
      // Build sets for both IDs and names to support legacy (name-stored) and new (ID-stored) categories
      const validCategoryIds = new Set(loadedCategories.map(cat => cat.id));
      const validCategoryNames = new Set(loadedCategories.map(cat => cat.name));
      
      // Filter small tools (equipmentType !== 'heavy')
      const smallTools = loadedProducts.filter(product => (product as any).equipmentType !== 'heavy');
      
      // Fetch history for small tools to get actual user
      const smallToolsWithHistory = await Promise.all(
        smallTools.map(async (product) => {
          if (product.repair) {
            try {
              const history = await equipmentHistoryFirebaseService.getEquipmentHistory(product.id);
              if (history.length > 0) {
                const mostRecent = history[0];
                return {
                  ...product,
                  lastModifiedBy: mostRecent.user
                };
              }
            } catch (error) {
              console.error('Error fetching history for', product.name, error);
            }
          }
          return product;
        })
      );
      
      // Fetch history for heavy equipment to get locationNotes
      const heavyEquipmentWithHistory = await Promise.all(
        heavyEquipment.map(async (equipment) => {
          try {
            const history = await equipmentHistoryFirebaseService.getEquipmentHistory(equipment.id);
            if (history.length > 0) {
              // Get the most recent history entry and extract locationNotes from changes
              const mostRecent = history[0];
              const notesChange = mostRecent.changes?.find(c => c.field === 'locationNotes');
              if (notesChange && notesChange.newValue && notesChange.newValue !== '(empty)') {
                return {
                  ...equipment,
                  locationNotes: notesChange.newValue
                };
              }
            }
          } catch (error) {
            console.error('Error fetching history for', equipment.name, error);
          }
          return equipment;
        })
      );
      
      const cleanedSmallTools = smallToolsWithHistory.map(product => {
        const { supplier, minStockLevel, quantity, price, location, tags, description, ...cleanedProduct } = product as any;
        const hasValidCategory = validCategoryIds.has(product.category || '') || validCategoryNames.has(product.category || '');
        
        return {
          ...cleanedProduct,
          employee: (product as any).employee || '',
          site: (product as any).site || '',
          repair: (product as any).repair || false,
          repairDescription: (product as any).repairDescription || '',
          locationNotes: (product as any).locationNotes || '',
          lastModifiedBy: (product as any).lastModifiedBy || (product as any).createdBy || 'System',
          category: hasValidCategory ? product.category : 'Small Tools',
          equipmentType: 'field' as const
        };
      });
      
      // Convert heavy equipment to match inventory format
      const convertedHeavyEquipment = heavyEquipmentWithHistory.map(equipment => ({
        id: equipment.id,
        name: equipment.name,
        description: equipment.description || '',
        serialNumber: equipment.serialNumber || '',
        year: (equipment as any).year || '',
        make: (equipment as any).make || '',
        model: (equipment as any).model || '',
        category: equipment.category || 'Heavy Equipment',
        employee: equipment.employee || '',
        site: equipment.site || '',
        repair: equipment.repair || false,
        repairDescription: equipment.repairDescription || '',
        locationNotes: (equipment as any).locationNotes || '',
        notes: (equipment as any).notes || [],
        isActive: equipment.isActive ?? true,
        showInInventory: equipment.showInInventory ?? true,
        showInTimecard: equipment.showInTimecard ?? true,
        equipmentType: 'heavy' as const,
        createdAt: equipment.createdAt as string,
        updatedAt: equipment.updatedAt as string,
        lastModifiedBy: equipment.createdBy || 'System'
      }));
      
      // Merge small tools and heavy equipment
      const allProducts = [...cleanedSmallTools, ...convertedHeavyEquipment];
      
      setProducts(allProducts);
      setCategories(loadedCategories);
      // Alerts will be loaded on-demand
    } catch (error) {
      console.error('Error loading data from Firebase:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async (daysAgo: number = 7) => {
  const alerts = await alertsFirebaseService.getRecentAlerts(50, daysAgo);
  setAlerts(alerts.filter(a => a.type === 'change'));
};

  const addProduct = async (product: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Only add small tools to the inventory database
      // Heavy equipment should be added through the Equipment Management component
      if (product.equipmentType === 'heavy') {
        throw new Error('Heavy equipment must be added through the Equipment Management page');
      }
      
      const newId = await addEquipment(product);
      
      // Log the creation to history
      if (user) {
        await equipmentHistoryFirebaseService.addHistory({
          equipmentId: newId,
          equipmentName: product.name,
          action: 'created',
          timestamp: new Date(),
          user: user.name || 'Unknown User',
          userRole: user.role || 'field'
        });
      }
      
      await loadData();
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Equipment>) => {
    try {
      const product = products.find(p => p.id === id);
      
      // Heavy equipment must be updated through equipmentManagementService
      if (product?.equipmentType === 'heavy') {
        await equipmentManagementService.updateEquipment(id, updates, {
          username: user?.username || user?.name || 'Unknown User',
          role: user?.role || 'field'
        });
      } else {
        // Log the changes to history for field equipment
        if (product && user) {
          const changes: { field: string; oldValue: string; newValue: string }[] = [];
          
          Object.keys(updates).forEach(key => {
            if (key === 'updatedAt' || key === 'createdAt') return;
            
            const oldValue = product[key as keyof Equipment];
            const newValue = updates[key as keyof Equipment];
            
            if (key === 'notes' && Array.isArray(newValue)) {
              const oldNotes = Array.isArray(oldValue) ? oldValue : [];
              const newNotes = newValue;
              
              newNotes.forEach(newNote => {
                if (!oldNotes.some(oldNote => oldNote.id === newNote.id)) {
                  changes.push({
                    field: 'notes',
                    oldValue: '',
                    newValue: `"${newNote.text}"`
                  });
                }
              });
              
              oldNotes.forEach(oldNote => {
                if (!newNotes.some(newNote => newNote.id === oldNote.id)) {
                  changes.push({
                    field: 'notes',
                    oldValue: `"${oldNote.text}"`,
                    newValue: ''
                  });
                }
              });
            } else if (oldValue !== newValue && newValue !== undefined) {
              changes.push({
                field: key,
                oldValue: String(oldValue || ''),
                newValue: String(newValue)
              });
            }
          });
          
          if (changes.length > 0) {
            await equipmentHistoryFirebaseService.addHistory({
              equipmentId: id,
              equipmentName: product.name,
              action: 'updated',
              timestamp: new Date(),
              user: user.name || 'Unknown User',
              userRole: user.role || 'field',
              changes
            });
          }
        }

        await updateEquipment(id, updates);
      }
      
      // Add alerts for changes (only for field equipment, heavy equipment already handled)
      if (product && user && product.equipmentType !== 'heavy') {
        const displayName = user.name || 'Unknown User';
        const changes: string[] = [];
        
        Object.keys(updates).forEach(key => {
          const oldValue = product[key as keyof Equipment];
          const newValue = updates[key as keyof Equipment];
          
          // Skip timestamp fields, repair field, and notes field
          if (key === 'updatedAt' || key === 'createdAt' || key === 'repair' || key === 'notes') return;
          
          // Skip if no change
          if (oldValue === newValue) return;
          
          // Skip system fields
          if (['isActive', 'showInInventory', 'showInTimecard'].includes(key)) return;
          
          // Add change to alerts without field name prefix
          changes.push(String(newValue || ''));
        });
        
        if (changes.length > 0) {
          try {
            await alertsFirebaseService.addAlert({
              productId: id,
              type: 'change',
              message: changes.join('\n'),
              createdAt: new Date().toISOString(),
              userName: displayName,
            });
          } catch (error) {
            console.error('Error adding alert:', error);
          }
        }
      }
      
      await loadData();
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      // Check if this is heavy equipment by checking if it exists in our merged list
      const product = products.find(p => p.id === id);
      
      if (product?.equipmentType === 'heavy') {
        throw new Error('Heavy equipment must be deleted through the Equipment Management page');
      }
      
      await deleteEquipment(id);
      await loadData(); // Refresh data from Firebase
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const addCategory = async (category: Omit<Category, 'id'>) => {
    try {
      await _addCategory(category);
      await loadData(); // Refresh data from Firebase
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      await _deleteCategory(categoryId);
      await loadData(); // Refresh data from Firebase
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const editCategory = async (categoryId: string, categoryData: Omit<Category, 'id'>) => {
    try {
      await _updateCategory(categoryId, categoryData);
      await loadData(); // Refresh data from Firebase
    } catch (error) {
      console.error('Error editing category:', error);
    }
  };

  return {
    products,
    categories,
    alerts,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    editCategory,
    deleteCategory,
    refreshData: loadData,
    loadAlerts,
  };
}
