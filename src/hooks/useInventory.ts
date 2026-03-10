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
} from '../services/mockService';

export function useInventory() {
  const [products, setProducts] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load data from Firebase
      const [loadedProducts, loadedCategories, loadedAlerts] = await Promise.all([
        getEquipment(),
        getCategories(),
        getAlerts()
      ]);
      
      // Clean up products with invalid category references
      const validCategoryIds = new Set(loadedCategories.map(cat => cat.id));
      const cleanedProducts = loadedProducts.map(product => {
        const { supplier, minStockLevel, quantity, price, location, tags, description, ...cleanedProduct } = product as any;
        return {
          ...cleanedProduct,
          employee: (product as any).employee || '',
          site: (product as any).site || '',
          repair: (product as any).repair || false,
          repairDescription: (product as any).repairDescription || '',
          category: validCategoryIds.has(product.category) ? product.category : ''
        };
      });
      
      // Generate repair alerts for equipment that needs repair
      const repairAlerts = generateRepairAlerts(cleanedProducts, loadedAlerts);
      
      setProducts(cleanedProducts);
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
          return existingAlert;
        }
        
        // Create new repair alert
        const newAlert: StockAlert = {
          id: `repair-${product.id}-${Date.now()}`,
          productId: product.id,
          type: 'repair',
          message: `${product.name} needs repair${product.repairDescription ? ': ' + product.repairDescription : ''}`,
          createdAt: new Date().toISOString(),
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
      await addEquipment(product);
      await loadData(); // Refresh data from Firebase
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const updateProduct = async (id: string, updates: Partial<Equipment>) => {
    try {
      await updateEquipment(id, updates);
      await loadData(); // Refresh data from Firebase
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
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
