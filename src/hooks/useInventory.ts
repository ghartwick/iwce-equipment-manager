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
  deleteCategory as _deleteCategory,
  getAlerts,
  addAlert as _addAlert,
  deleteAlert as _deleteAlert
} from '../services/firebaseService';
import { equipmentManagementService } from '../services/equipmentManagementService';
import { equipmentHistoryFirebaseService } from '../services/equipmentHistoryFirebaseService';
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
      const [loadedProducts, loadedCategories, loadedAlerts, heavyEquipment] = await Promise.all([
        getEquipment(),
        getCategories(),
        getAlerts(),
        equipmentManagementService.getInventoryEquipment()
      ]);
      
      // Build sets for both IDs and names to support legacy (name-stored) and new (ID-stored) categories
      const validCategoryIds = new Set(loadedCategories.map(cat => cat.id));
      const validCategoryNames = new Set(loadedCategories.map(cat => cat.name));
      
      // Filter small tools (equipmentType !== 'heavy')
      const smallTools = loadedProducts.filter(product => (product as any).equipmentType !== 'heavy');
      
      const cleanedSmallTools = smallTools.map(product => {
        const { supplier, minStockLevel, quantity, price, location, tags, description, ...cleanedProduct } = product as any;
        const hasValidCategory = validCategoryIds.has(product.category || '') || validCategoryNames.has(product.category || '');
        
        return {
          ...cleanedProduct,
          employee: (product as any).employee || '',
          site: (product as any).site || '',
          repair: (product as any).repair || false,
          repairDescription: (product as any).repairDescription || '',
          category: hasValidCategory ? product.category : 'Small Tools',
          equipmentType: 'field' as const
        };
      });
      
      // Convert heavy equipment to match inventory format
      const convertedHeavyEquipment = heavyEquipment.map(equipment => ({
        id: equipment.id,
        name: equipment.name,
        description: equipment.description || '',
        serialNumber: equipment.serialNumber || '',
        category: equipment.category || 'Heavy Equipment',
        employee: equipment.employee || '',
        site: equipment.site || '',
        repair: equipment.repair || false,
        repairDescription: equipment.repairDescription || '',
        notes: (equipment as any).notes || [],
        equipmentType: 'heavy' as const,
        createdAt: equipment.createdAt.toISOString(),
        updatedAt: equipment.updatedAt.toISOString(),
        lastModifiedBy: equipment.createdBy || 'System'
      }));
      
      // Merge small tools and heavy equipment
      const allProducts = [...cleanedSmallTools, ...convertedHeavyEquipment];
      
      // Generate repair alerts for equipment that needs repair
      const repairAlerts = generateRepairAlerts(allProducts, loadedAlerts);
      
      setProducts(allProducts);
      setCategories(loadedCategories);
      setAlerts(repairAlerts);
    } catch (error) {
      console.error('Error loading data from Firebase:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRepairAlerts = (products: Equipment[], existingAlerts: StockAlert[]): StockAlert[] => {
    const repairAlerts = products
      .filter(product => product.repair)
      .map(product => {
        // Check if alert already exists for this product
        const existingAlert = existingAlerts.find(alert => 
          alert.productId === product.id && alert.type === 'repair'
        );
        
        if (existingAlert) {
          // Update the alert with the latest timestamp and user from the product
          return {
            ...existingAlert,
            message: `${product.name} has an alert${product.repairDescription ? ': ' + product.repairDescription : ''}`,
            createdAt: product.updatedAt || existingAlert.createdAt,
            userName: product.lastModifiedBy || existingAlert.userName,
          };
        }
        
        // Create new repair alert
        const newAlert: StockAlert = {
          id: `repair-${product.id}-${Date.now()}`,
          productId: product.id,
          type: 'repair',
          message: `${product.name} has an alert${product.repairDescription ? ': ' + product.repairDescription : ''}`,
          createdAt: product.updatedAt || new Date().toISOString(),
          userName: product.lastModifiedBy || 'Unknown User',
        };
        return newAlert;
      });
    
    // Remove repair alerts for products that no longer need repair
    const validRepairProductIds = new Set(products.filter(p => p.repair).map(p => p.id));
    const filteredAlerts = existingAlerts.filter(alert => 
      alert.type !== 'repair' || validRepairProductIds.has(alert.productId)
    );
    
    // Combine existing non-repair alerts with current repair alerts
    const nonRepairAlerts = filteredAlerts.filter(alert => alert.type !== 'repair');
    return [...nonRepairAlerts, ...repairAlerts];
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
      
            
      // Log the changes to history
      if (product && user) {
        const changes: { field: string; oldValue: string; newValue: string }[] = [];
        
        // Check each field for changes (excluding timestamp fields)
        Object.keys(updates).forEach(key => {
          // Skip timestamp fields as they're updated automatically
          if (key === 'updatedAt' || key === 'createdAt') return;
          
          const oldValue = product[key as keyof Equipment];
          const newValue = updates[key as keyof Equipment];
          
          // Special handling for notes array
          if (key === 'notes' && Array.isArray(newValue)) {
            const oldNotes = Array.isArray(oldValue) ? oldValue : [];
            const newNotes = newValue;
            
            // Check for added notes
            newNotes.forEach(newNote => {
              if (!oldNotes.some(oldNote => oldNote.id === newNote.id)) {
                changes.push({
                  field: 'notes',
                  oldValue: '',
                  newValue: `"${newNote.text}"`
                });
              }
            });
            
            // Check for deleted notes
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
        
        // Add history entry if there are changes
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
      
      if (product?.equipmentType === 'heavy') {
        // Route heavy equipment updates through equipmentManagementService
        // Convert the updates to match the heavy equipment service format
        const heavyUpdates: any = {};
        if (updates.name !== undefined) heavyUpdates.name = updates.name;
        if (updates.description !== undefined) heavyUpdates.description = updates.description;
        if (updates.serialNumber !== undefined) heavyUpdates.serialNumber = updates.serialNumber;
        if (updates.category !== undefined) heavyUpdates.category = updates.category;
        if (updates.site !== undefined) heavyUpdates.site = updates.site;
        if (updates.employee !== undefined) heavyUpdates.employee = updates.employee;
        if (updates.repair !== undefined) heavyUpdates.repair = updates.repair;
        if (updates.repairDescription !== undefined) heavyUpdates.repairDescription = updates.repairDescription;
        if (updates.notes !== undefined) heavyUpdates.notes = updates.notes;
        
                await equipmentManagementService.updateEquipment(id, heavyUpdates);
      } else {
        await updateEquipment(id, updates);
      }
      
      await loadData();
    } catch (error) {
      console.error('Error updating product:', error);
      throw error; // Re-throw the error so it can be caught by the caller
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

  const clearAlert = async (alertId: string) => {
    try {
      await _deleteAlert(alertId);
      await loadData(); // Refresh data from Firebase
    } catch (error) {
      console.error('Error clearing alert:', error);
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
    clearAlert,
    addCategory,
    editCategory,
    deleteCategory,
    refreshData: loadData,
  };
}
