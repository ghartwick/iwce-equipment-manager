import { useState, useEffect } from 'react';
import { Equipment, Category, StockAlert } from '../types';
import { LocalStorage } from '../lib/storage';

export function useInventory() {
  const [products, setProducts] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const loadedProducts = LocalStorage.getProducts();
      const loadedCategories = LocalStorage.getCategories();
      const loadedAlerts = LocalStorage.getAlerts();
      
      // Clean up products with invalid category references and remove supplier/minStockLevel/quantity/price/location/tags/description fields
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
      
      // Save cleaned products if any were changed
      if (JSON.stringify(cleanedProducts) !== JSON.stringify(loadedProducts)) {
        LocalStorage.saveProducts(cleanedProducts);
      }
      
      setProducts(cleanedProducts);
      setCategories(loadedCategories);
      setAlerts(repairAlerts);
    } catch (error) {
      console.error('Error loading data:', error);
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

  const addProduct = (product: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProduct: Equipment = {
      ...product,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const updatedProducts = [...products, newProduct];
    setProducts(updatedProducts);
    LocalStorage.saveProducts(updatedProducts);
    
    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Equipment>) => {
    const updatedProducts = products.map(product =>
      product.id === id
        ? { ...product, ...updates, updatedAt: new Date().toISOString() }
        : product
    );
    
    setProducts(updatedProducts);
    LocalStorage.saveProducts(updatedProducts);
    
    // Update alerts for this product if repair status changed
    if (updates.repair !== undefined) {
      const updatedAlerts = generateRepairAlerts(updatedProducts, alerts);
      setAlerts(updatedAlerts);
      LocalStorage.saveAlerts(updatedAlerts);
    }
  };

  const deleteProduct = (id: string) => {
    const updatedProducts = products.filter(product => product.id !== id);
    setProducts(updatedProducts);
    LocalStorage.saveProducts(updatedProducts);
    
    const updatedAlerts = alerts.filter(alert => alert.productId !== id);
    setAlerts(updatedAlerts);
    LocalStorage.saveAlerts(updatedAlerts);
  };

  const clearAlert = (alertId: string) => {
    const updatedAlerts = alerts.filter(alert => alert.id !== alertId);
    setAlerts(updatedAlerts);
    LocalStorage.saveAlerts(updatedAlerts);
  };

  const addCategory = (category: Omit<Category, 'id'>) => {
    const newCategory: Category = {
      ...category,
      id: Date.now().toString(),
    };
    
    const updatedCategories = [...categories, newCategory];
    setCategories(updatedCategories);
    LocalStorage.saveCategories(updatedCategories);
    return newCategory;
  };

  const deleteCategory = (categoryId: string) => {
    const updatedCategories = categories.filter(category => category.id !== categoryId);
    setCategories(updatedCategories);
    LocalStorage.saveCategories(updatedCategories);
    
    // Remove products that belong to the deleted category
    const updatedProducts = products.filter(product => product.category !== categoryId);
    setProducts(updatedProducts);
    LocalStorage.saveProducts(updatedProducts);
    
    // Also remove alerts for deleted products
    const deletedProductIds = products
      .filter(product => product.category === categoryId)
      .map(product => product.id);
    const updatedAlerts = alerts.filter(alert => !deletedProductIds.includes(alert.productId));
    setAlerts(updatedAlerts);
    LocalStorage.saveAlerts(updatedAlerts);
  };

  const editCategory = (categoryId: string, categoryData: Omit<Category, 'id'>) => {
    const updatedCategories = categories.map(category =>
      category.id === categoryId
        ? { ...category, ...categoryData }
        : category
    );
    setCategories(updatedCategories);
    LocalStorage.saveCategories(updatedCategories);
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
