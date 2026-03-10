import { useState } from 'react';
import { useInventory } from './hooks/useInventory';
import { useAuth } from './hooks/useAuth';
import { Header } from './components/Header';
import { ProductList } from './components/ProductList';
import { MobileProductList } from './components/MobileProductList';
import { ProductForm } from './components/ProductForm';
import { AlertPanel } from './components/AlertPanel';
import { SearchBar } from './components/SearchBar';
import { FilterPanel } from './components/FilterPanel';
import { LoginPage } from './components/LoginPage';
import { Equipment } from './types';
import { equipmentHistoryService } from './services/equipmentHistoryService';

function App() {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    login,
    logout,
  } = useAuth();

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
  } = useInventory();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Equipment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAlerts, setShowAlerts] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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
    // Sort by equipment name alphabetically and numerically
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    
    // Try numeric comparison first
    const numA = parseFloat(nameA);
    const numB = parseFloat(nameB);
    
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    
    // Fall back to alphabetical comparison
    return nameA.localeCompare(nameB);
  });

  const handleAddProduct = (productData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (user) {
      // Create new equipment object
      const newEquipment: Equipment = {
        ...productData,
        id: `eq-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Track the creation in history
      equipmentHistoryService.trackEquipmentChange(
        'created',
        newEquipment,
        { username: user.username, role: user.role }
      );
      
      addProduct(productData);
      setShowAddForm(false);
    }
  };

  const handleEditProduct = (productData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    console.log('handleEditProduct called - repair:', productData.repair);
    if (editingProduct && user) {
      // Create updated equipment object
      const updatedEquipment: Equipment = {
        ...editingProduct,
        ...productData,
        updatedAt: new Date().toISOString()
      };
      
      // Track the change in history
      equipmentHistoryService.trackEquipmentChange(
        'updated',
        updatedEquipment,
        { username: user.username, role: user.role },
        editingProduct
      );
      
      updateProduct(editingProduct.id, productData);
      setEditingProduct(null);
    }
  };

  const handleEditClick = (product: Equipment) => {
    setEditingProduct(product);
    setShowAddForm(false);
  };

  const handleLogin = async (username: string, password: string) => {
    try {
      await login(username, password);
    } catch (error) {
      // Error is handled in useAuth hook
    }
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <div className="text-lg text-yellow-400">Loading...</div>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginPage 
        onLogin={handleLogin}
        error={authError || undefined}
      />
    );
  }

  // Show loading screen while loading inventory
  if (inventoryLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-lg text-yellow-400">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header 
        onAddProduct={() => {
          setShowAddForm(!showAddForm);
          setEditingProduct(null); // Clear any selected equipment when adding
        }}
        alertCount={alerts.length}
        onToggleAlerts={() => setShowAlerts(!showAlerts)}
        user={user}
        onLogout={logout}
      />
      
      <main className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3">
        {/* Desktop Layout - Original Design */}
        <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Desktop Alerts - Always Visible */}
          {showAlerts && (
            <div className="mb-3">
              <div className="max-w-4xl mx-auto">
                <AlertPanel 
                  alerts={alerts} 
                  products={products} 
                  onClearAlert={clearAlert} 
                />
              </div>
            </div>
          )}

          {/* Desktop Forms Section */}
          {showAddForm && (
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
            <div className="bg-black border border-yellow-600 rounded-lg shadow overflow-hidden">
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
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <ProductList
                  products={filteredProducts}
                  categories={categories}
                  onEdit={handleEditClick}
                  onDelete={deleteProduct}
                  selectedEquipmentId={editingProduct?.id}
                  onEditProduct={handleEditProduct}
                  onCancelEdit={() => setEditingProduct(null)}
                  userRole={user?.role || 'field'}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout - Optimized */}
        <div className="lg:hidden">
          <div className="space-y-3 sm:space-y-4">
            {/* Mobile Alerts - Collapsible */}
            {showAlerts && (
              <div>
                <AlertPanel 
                  alerts={alerts} 
                  products={products} 
                  onClearAlert={clearAlert} 
                />
              </div>
            )}

            {/* Desktop Alerts - Always Visible */}
            <div className="hidden lg:block">
              <AlertPanel 
                alerts={alerts} 
                products={products} 
                onClearAlert={clearAlert} 
              />
            </div>

            {/* Forms Section */}
            {showAddForm && (
              <div className="bg-black border border-yellow-600 rounded-lg shadow-lg p-2 sm:p-3">
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
            <div className="bg-black border border-yellow-600 rounded-lg shadow overflow-hidden">
              <div className="p-2 sm:p-3">
                {/* Mobile Filter Toggle */}
                <div className="mb-2">
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="w-full p-1 bg-yellow-900 bg-opacity-30 rounded-lg hover:bg-opacity-50 transition-colors flex items-center justify-between"
                  >
                    <span className="text-yellow-300 text-xs">Filters</span>
                    <span className="text-yellow-400 transform transition-transform">
                      {showMobileFilters ? '▼' : '▶'}
                    </span>
                  </button>
                </div>

                <div className="flex flex-col space-y-2">
                  {/* Search - Mobile Full Width */}
                  <div className="flex-1">
                    <SearchBar 
                      searchTerm={searchTerm} 
                      onSearchChange={setSearchTerm} 
                    />
                  </div>

                  {/* Mobile Filters - Collapsible */}
                  {showMobileFilters && (
                    <div className="mt-2">
                      <FilterPanel
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onCategoryChange={setSelectedCategory}
                        onAddCategory={addCategory}
                        onDeleteCategory={deleteCategory}
                        onEditCategory={editCategory}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Equipment List */}
              <MobileProductList
                products={filteredProducts}
                onEdit={handleEditClick}
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
    </div>
  );
}

export default App;
