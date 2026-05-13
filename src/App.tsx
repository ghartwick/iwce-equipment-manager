import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    login,
    logout,
  } = useAuth();

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAlerts, setShowAlerts] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleToggleAlerts = async () => {
    if (!showAlerts) {
      await loadAlerts();
    }
    setShowAlerts(!showAlerts);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Click outside handler for alerts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAlerts) {
        // Check if the click is on the Bell button
        const clickedElement = event.target as Element;
        const isBellButton = clickedElement.closest('button')?.querySelector('svg.lucide-bell') ||
                           clickedElement.closest('svg.lucide-bell');
        
        // If the click is not on the bell button and not inside the alerts panel, close it
        if (!isBellButton && !clickedElement.closest('.bg-yellow-200.dark\\:bg-black.border.border-yellow-600')) {
          setShowAlerts(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAlerts]);

  const {
    products,
    categories,
    alerts,
    loading: inventoryLoading,
    addProduct,
    addCategory,
    editCategory,
    deleteCategory,
    loadAlerts,
  } = useInventory(refreshKey);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.employee?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (product.site?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (product.repair ? 'yes' : 'no').includes(searchTerm.toLowerCase()) ||
                         (product.repair && (product.repairDescription?.toLowerCase() || '').includes(searchTerm.toLowerCase()));
    
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

  const handleEditClick = (product: Equipment) => {
    navigate(`/inventory/equipment/${product.id}`);
  };

  const handleLogin = async (username: string, password: string, rememberMe: boolean) => {
    try {
      await login(username, password, rememberMe);
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
        }}
        alertCount={alerts.length}
        onToggleAlerts={handleToggleAlerts}
        user={user}
        onLogout={logout}
        onRefresh={handleRefresh}
      />
      
      <main className="px-4 sm:px-6 lg:px-6 py-2 sm:py-3 -mx-4 sm:-mx-6 lg:mx-0">
        {/* Desktop Layout - Original Design */}
        <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Desktop Alerts - Always Visible */}
          {showAlerts && (
            <div className="mb-3">
              <div className="max-w-4xl mx-auto">
                <AlertPanel 
                  alerts={alerts} 
                  products={products} 
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
                  product={null}
                  onSubmit={handleAddProduct}
                  onCancel={() => { setShowAddForm(false); }}
                  userRole={user?.role || 'field'}
                />
              </div>
            </div>
          )}

          {/* Desktop Equipment Table - Original Design */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-black border border-yellow-600 rounded-lg shadow overflow-hidden">
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
                  onEdit={handleEditClick}
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
                />
              </div>
            )}

            {/* Desktop Alerts - Always Visible */}
            <div className="hidden lg:block">
              <AlertPanel 
                alerts={alerts} 
                products={products} 
              />
            </div>

            {/* Forms Section */}
            {showAddForm && (
              <div className="bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2 sm:p-3">
                <ProductForm
                  categories={categories}
                  product={null}
                  onSubmit={handleAddProduct}
                  onCancel={() => { setShowAddForm(false); }}
                  userRole={user?.role || 'field'}
                />
              </div>
            )}

            {/* Mobile Equipment Table - Optimized */}
            <div className="bg-white dark:bg-black border border-yellow-600 rounded-lg shadow overflow-hidden">
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
                onEdit={handleEditClick}
                categories={categories}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
