import { useState } from 'react';
import { useInventory } from './hooks/useInventory';
import { useAuth } from './hooks/useAuth';
import { Header } from './components/Header';
import { ProductList } from './components/ProductList';
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
  const [showAlerts, setShowAlerts] = useState(true);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.site.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.repair ? 'yes' : 'no').includes(searchTerm.toLowerCase()) ||
                         (product.repair && product.repairDescription.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
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
        onAddProduct={() => setShowAddForm(!showAddForm)}
        alertCount={alerts.length}
        onToggleAlerts={() => setShowAlerts(!showAlerts)}
        user={user}
        onLogout={logout}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sidebar Forms - Stack on top when utilized */}
        {(showAlerts || showAddForm) && (
          <div className="mb-6 space-y-6">
            <div className="max-w-4xl mx-auto">
              {showAlerts && (
                <AlertPanel
                  alerts={alerts}
                  products={products}
                  onClearAlert={clearAlert}
                />
              )}
              
              {showAddForm && (
                <ProductForm
                  categories={categories}
                  product={null}
                  onSubmit={handleAddProduct}
                  onCancel={() => setShowAddForm(false)}
                  userRole={user?.role}
                />
              )}
            </div>
          </div>
        )}
        
        {/* Centered Table */}
        <div className="flex justify-center">
          <div className="w-full max-w-4xl">
            <div className="mb-6 space-y-4">
              <SearchBar 
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
              />
              <FilterPanel
                categories={categories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onAddCategory={addCategory}
                onDeleteCategory={deleteCategory}
                onEditCategory={editCategory}
              />
            </div>
            
            <ProductList
              products={filteredProducts}
              categories={categories}
              onEdit={handleEditClick}
              onDelete={deleteProduct}
              selectedEquipmentId={editingProduct?.id}
              onEditProduct={handleEditProduct}
              onCancelEdit={() => setEditingProduct(null)}
              userRole={user?.role}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
