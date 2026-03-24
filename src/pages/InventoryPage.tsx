import { useState, useEffect, useRef } from 'react';
import { useInventory } from '../hooks/useInventory';
import { useAuth } from '../hooks/useAuth';
import { ProductList } from '../components/ProductList';
import { MobileProductList } from '../components/MobileProductList';
import { ProductForm } from '../components/ProductForm';
import { AlertPanel } from '../components/AlertPanel';
import { SearchBar } from '../components/SearchBar';
import { FilterPanel } from '../components/FilterPanel';
import { Equipment } from '../types';
import { equipmentHistoryFirebaseService } from '../services/equipmentHistoryFirebaseService';

function InventoryPage() {
  const {
    products,
    categories,
    alerts,
    loading: inventoryLoading,
    addProduct,
    updateProduct,
    deleteProduct,
    clearAlert,
    addCategory,
    editCategory,
    deleteCategory,
    refreshData,
  } = useInventory();

  const { user } = useAuth();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Equipment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAlerts, setShowAlerts] = useState(false);
  const alertsRef = useRef<HTMLDivElement>(null);

  // Handle custom events from Layout component
  useEffect(() => {
    const handleAddProduct = () => {
      setShowAddForm(true);
    };

    const handleToggleAlerts = () => {
      setShowAlerts(!showAlerts);
    };

    window.addEventListener('addProduct', handleAddProduct);
    window.addEventListener('toggleAlerts', handleToggleAlerts);

    return () => {
      window.removeEventListener('addProduct', handleAddProduct);
      window.removeEventListener('toggleAlerts', handleToggleAlerts);
    };
  }, [showAlerts]);

  // Click outside handler for alerts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAlerts && alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        // Check if the click is not on the Bell button
        const bellButton = (event.target as Element).closest('button[aria-label*="Alerts"], button:has(.bell)');
        if (!bellButton) {
          setShowAlerts(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAlerts]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.site.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.repair ? 'yes' : 'no').includes(searchTerm.toLowerCase()) ||
                         (product.repair && product.repairDescription.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    // If "All Categories" is selected, sort by category first, then by name
    if (selectedCategory === 'all') {
      // Get category names for sorting
      const getCategoryName = (categoryId: string) => {
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.name.toLowerCase() : categoryId.toLowerCase();
      };
      
      const categoryA = getCategoryName(a.category);
      const categoryB = getCategoryName(b.category);
      
      if (categoryA !== categoryB) {
        return categoryA.localeCompare(categoryB);
      }
    }
    
    // Sort by name
    return a.name.localeCompare(b.name);
  });

  const handleAddProduct = async (productData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (user) {
      // Create new equipment object
      const newEquipment: Equipment = {
        ...productData,
        id: `eq-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      try {
        // Track the creation in Firebase history
        await equipmentHistoryFirebaseService.trackEquipmentChange(
          'created',
          newEquipment,
          { username: user.username, role: user.role }
        );
      } catch (error) {
        console.error('Failed to track history:', error);
      }
      
      await addProduct(productData);
      setShowAddForm(false);
    }
  };

  const handleEditProduct = async (productData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingProduct && user) {
      const updatedEquipment: Equipment = {
        ...editingProduct,
        name: productData.name,
        employee: productData.employee,
        site: productData.site,
        category: productData.category,
        serialNumber: productData.serialNumber,
        equipmentType: productData.equipmentType,
        repair: productData.repair,
        repairDescription: productData.repairDescription,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: user.name
      };
      
      try {
        // Track the change in Firebase history
        await equipmentHistoryFirebaseService.trackEquipmentChange(
          'updated',
          updatedEquipment,
          { username: user.username, role: user.role },
          editingProduct
        );
      } catch (error) {
        console.error('Failed to track Firebase history:', error);
      }
      
      await updateProduct(editingProduct.id, updatedEquipment);
      setEditingProduct(null);
    }
  };

  const handleEditClick = (product: Equipment) => {
    setEditingProduct(product);
    setShowAddForm(false);
  };

  // Show loading screen while loading inventory
  if (inventoryLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-lg text-yellow-600 dark:text-yellow-400">Loading inventory...</div>
      </div>
    );
  }

  return (
    <main className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3">
      {/* Desktop Layout - Original Design */}
      <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Desktop Alerts - Always Visible */}
        {showAlerts && (
          <div className="mb-3" ref={alertsRef}>
            <div className="max-w-4xl mx-auto">
              <AlertPanel 
                alerts={alerts} 
                products={products} 
                onClearAlert={clearAlert} 
              />
            </div>
          </div>
        )}

        {/* Desktop Forms Section - Admin Only */}
        {showAddForm && user?.role === 'admin' && (
          <div className="mb-3">
            <div className="max-w-4xl mx-auto">
              <ProductForm
                categories={categories}
                product={editingProduct}
                onSubmit={editingProduct ? handleEditProduct : handleAddProduct}
                onCancel={() => { setShowAddForm(false); setEditingProduct(null); }}
                onDelete={editingProduct ? () => { deleteProduct(editingProduct.id); setEditingProduct(null); } : undefined}
                userRole={user?.role || 'field'}
              />
            </div>
          </div>
        )}

        {/* Desktop Equipment Table - Original Design */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl overflow-hidden">
            <div className="p-6">
              {/* Search Field - Above */}
              <div className="mb-4">
                <SearchBar 
                  searchTerm={searchTerm} 
                  onSearchChange={setSearchTerm} 
                />
              </div>

              {/* Category Filter - Below */}
              <div className="hidden lg:block">
                <FilterPanel
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  onAddCategory={addCategory}
                  onDeleteCategory={deleteCategory}
                  onEditCategory={editCategory}
                  userRole={user?.role}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <ProductList
                products={filteredProducts}
                categories={categories}
                onEdit={user?.role === 'admin' ? handleEditClick : undefined}
                onDelete={user?.role === 'admin' ? deleteProduct : undefined}
                selectedEquipmentId={editingProduct?.id}
                onEditProduct={handleEditProduct}
                onAddProduct={handleAddProduct}
                onCancelEdit={() => setEditingProduct(null)}
                userRole={user?.role || 'field'}
                showCategoryHeadings={true}
                refreshData={refreshData}
                onImportComplete={() => setSelectedCategory('all')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="space-y-3 sm:space-y-4">
          {/* Mobile Alerts - Collapsible */}
          {showAlerts && (
            <div ref={alertsRef}>
              <AlertPanel 
                alerts={alerts} 
                products={products} 
                onClearAlert={clearAlert} 
              />
            </div>
          )}

          {/* Forms Section - Admin Only */}
          {showAddForm && user?.role === 'admin' && (
            <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl p-2 sm:p-3">
              <ProductForm
                categories={categories}
                product={editingProduct}
                onSubmit={editingProduct ? handleEditProduct : handleAddProduct}
                onCancel={() => { setShowAddForm(false); setEditingProduct(null); }}
                onDelete={editingProduct ? () => { deleteProduct(editingProduct.id); setEditingProduct(null); } : undefined}
                userRole={user?.role || 'field'}
              />
            </div>
          )}

          {/* Mobile Equipment Table - Optimized */}
          <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 sm:p-3">
              <div className="flex flex-col space-y-2">
                {/* Search - Mobile Full Width */}
                <div className="flex-1">
                  <SearchBar 
                    searchTerm={searchTerm} 
                    onSearchChange={setSearchTerm} 
                  />
                </div>

                {/* Mobile Categories - Always Visible */}
                <div className="mt-2">
                  <FilterPanel
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    onAddCategory={addCategory}
                    onDeleteCategory={deleteCategory}
                    onEditCategory={editCategory}
                    userRole={user?.role}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Equipment List */}
            <MobileProductList
              products={filteredProducts}
              onEdit={user?.role === 'admin' ? handleEditClick : undefined}
              selectedEquipmentId={editingProduct?.id}
              onEditProduct={handleEditProduct}
              onCancelEdit={() => setEditingProduct(null)}
              categories={categories}
              userRole={user?.role || 'field'}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default InventoryPage;
