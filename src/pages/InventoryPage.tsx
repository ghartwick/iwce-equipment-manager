import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { siteManagementService, Site } from '../services/siteManagementService';
import { userManagementService, AppUser } from '../services/userManagementService';
import { fleetManagementService } from '../services/fleetManagementService';

function InventoryPage() {
  const navigate = useNavigate();
  const {
    products,
    categories,
    alerts,
    loading: inventoryLoading,
    addProduct,
    updateProduct,
    addCategory,
    editCategory,
    deleteCategory,
    refreshData,
    loadAlerts,
  } = useInventory();

  const { user } = useAuth();

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertDaysAgo, setAlertDaysAgo] = useState(7);
  const alertsRef = useRef<HTMLDivElement>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [fleetProducts, setFleetProducts] = useState<Equipment[]>([]);

  const loadFleetData = async () => {
    try {
      const loadedFleet = await fleetManagementService.getAllEquipment();
      setFleetProducts(loadedFleet);
    } catch (error) {
      console.error('Error loading fleet data:', error);
    }
  };

  const handleRefreshData = async () => {
    await refreshData();
    await loadFleetData();
  };

  const hasRestored = useRef(false);

  // Fetch sites, users, and fleet data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [loadedSites, loadedUsers, loadedFleet] = await Promise.all([
          siteManagementService.getActiveSites(),
          userManagementService.getAllUsers(),
          fleetManagementService.getAllEquipment(),
        ]);
        setSites(loadedSites);
        setAppUsers(loadedUsers);
        setFleetProducts(loadedFleet);
      } catch (error) {
        console.error('Error fetching sites/users/fleet:', error);
      }
    };
    fetchData();
  }, []);

  // Restore scroll position and filter state when component mounts
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    
    const savedPosition = localStorage.getItem('inventoryScrollPosition');
    const savedSearchTerm = localStorage.getItem('inventorySearchTerm');
    const savedSelectedCategory = localStorage.getItem('inventorySelectedCategory');
    
    // Restore search term
    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
    
    // Restore selected category
    if (savedSelectedCategory) {
      setSelectedCategory(savedSelectedCategory);
    }
    
    // Restore scroll position
    if (savedPosition) {
      const position = parseInt(savedPosition, 10);
      // Use setTimeout to ensure the page has rendered before scrolling
      setTimeout(() => {
        window.scrollTo(0, position);
      }, 100);
    }
    
    // Clear localStorage after a delay to ensure state is restored
    setTimeout(() => {
      localStorage.removeItem('inventoryScrollPosition');
      localStorage.removeItem('inventorySearchTerm');
      localStorage.removeItem('inventorySelectedCategory');
    }, 200);
  }, []);

  // Save inventory state when navigating away
  useEffect(() => {
    const saveInventoryState = () => {
      localStorage.setItem('inventorySearchTerm', searchTerm);
      localStorage.setItem('inventorySelectedCategory', selectedCategory);
    };
    
    // Save state when component unmounts or when navigating
    window.addEventListener('beforeunload', saveInventoryState);
    
    return () => {
      window.removeEventListener('beforeunload', saveInventoryState);
      saveInventoryState();
    };
  }, [searchTerm, selectedCategory]);

  // Handle custom events from Layout component
  useEffect(() => {
    const handleAddProduct = () => {
      setShowAddForm(true);
    };

    const handleToggleAlerts = async () => {
      if (!showAlerts) {
        setAlertDaysAgo(7);
        await loadAlerts(7);
      }
      setShowAlerts(!showAlerts);
    };

    window.addEventListener('addProduct', handleAddProduct);
    window.addEventListener('toggleAlerts', handleToggleAlerts);

    return () => {
      window.removeEventListener('addProduct', handleAddProduct);
      window.removeEventListener('toggleAlerts', handleToggleAlerts);
    };
  }, [showAlerts]);

  const handleLoadMoreAlerts = async () => {
    const newDaysAgo = alertDaysAgo + 7;
    setAlertDaysAgo(newDaysAgo);
    await loadAlerts(newDaysAgo);
  };

  // Click outside handler for alerts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAlerts && alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        // Check if the click is on the Bell button
        const clickedElement = event.target as Element;
        const isBellButton = clickedElement.closest('button')?.querySelector('svg.lucide-bell') ||
                           clickedElement.closest('svg.lucide-bell');
        
        if (!isBellButton) {
          setShowAlerts(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAlerts]);

  const allProducts = [...products, ...fleetProducts];

  const filteredProducts = allProducts.filter(product => {
    const getCategoryName = (categoryId: string) => {
      const category = categories.find(cat => cat.id === categoryId);
      return category ? category.name.toLowerCase() : categoryId.toLowerCase();
    };
    
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.employee?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (product.site?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         getCategoryName(product.category || '').includes(searchTerm.toLowerCase()) ||
                         (product.repair ? 'yes' : 'no').includes(searchTerm.toLowerCase()) ||
                         (product.repair && (product.repairDescription?.toLowerCase() || '').includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    // Natural sort: extract and compare numbers from strings
    const extractNumber = (str: string): number => {
      const match = str.match(/\d+/);
      return match ? parseInt(match[0], 10) : NaN;
    };
    
    const numA = extractNumber(a.name);
    const numB = extractNumber(b.name);
    
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) return numA - numB;
    }
    
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

  
  const handleInlineUpdate = async (productId: string, updates: Partial<Equipment>) => {
    try {
      // Check if this is a fleet item
      const isFleet = fleetProducts.some(p => p.id === productId);
      if (isFleet) {
        await fleetManagementService.updateEquipment(productId, updates, user ? { username: user.username, role: user.role } : undefined);
        await loadFleetData();
      } else {
        await updateProduct(productId, updates);
      }
    } catch (error) {
      console.error('Error updating product inline:', error);
    }
  };

  const handleEditClick = (product: Equipment) => {
    // Save current state before navigating
    localStorage.setItem('inventoryScrollPosition', window.scrollY.toString());
    localStorage.setItem('inventorySearchTerm', searchTerm);
    localStorage.setItem('inventorySelectedCategory', selectedCategory);
    navigate(`/inventory/equipment/${product.id}`);
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
    <main className="px-4 sm:px-6 lg:px-6 py-2 sm:py-3 -mx-4 sm:-mx-6 lg:mx-0">
      {/* Desktop Layout - Original Design */}
      <div className="hidden lg:block max-w-5xl mx-auto py-4">
        {/* Desktop Alerts - Always Visible */}
        {showAlerts && (
          <div className="mb-3" ref={alertsRef}>
            <AlertPanel 
              alerts={alerts} 
              products={allProducts}
              onLoadMore={handleLoadMoreAlerts}
              hasMore={alerts.length >= 50}
            />
          </div>
        )}

        {/* Desktop Forms Section - Admin Only */}
        {showAddForm && user?.role === 'admin' && (
          <div className="mb-3">
            <ProductForm
              categories={categories}
              product={null}
              onSubmit={handleAddProduct}
              onCancel={() => { setShowAddForm(false); }}
              userRole={user?.role || 'field'}
            />
          </div>
        )}

        {/* Desktop Equipment Table - Original Design */}
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl overflow-hidden">
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
                  fleetProducts={fleetProducts}
                  onAddCategory={addCategory}
                  onDeleteCategory={deleteCategory}
                  onEditCategory={editCategory}
                  userRole={user?.role}
                  products={products}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <ProductList
                products={filteredProducts}
                categories={categories}
                onEdit={handleEditClick}
                userRole={user?.role || 'field'}
                showCategoryHeadings={true}
                refreshData={handleRefreshData}
                onImportComplete={() => setSelectedCategory('all')}
                sites={sites}
                users={appUsers}
                onInlineUpdate={handleInlineUpdate}
                fleetProducts={fleetProducts}
              />
            </div>
          </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden max-w-5xl mx-auto py-4">
        <div className="space-y-3 sm:space-y-4">
          {/* Mobile Alerts - Collapsible */}
          {showAlerts && (
            <div ref={alertsRef}>
              <AlertPanel 
                alerts={alerts} 
                products={allProducts}
                onLoadMore={handleLoadMoreAlerts}
                hasMore={alerts.length >= 50}
              />
            </div>
          )}

          {/* Forms Section - Admin Only */}
          {showAddForm && user?.role === 'admin' && (
            <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl p-2 sm:p-3">
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
          <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl overflow-hidden">
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
                    fleetProducts={fleetProducts}
                    onAddCategory={addCategory}
                    onDeleteCategory={deleteCategory}
                    onEditCategory={editCategory}
                    userRole={user?.role}
                    products={products}
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
  );
}

export default InventoryPage;
