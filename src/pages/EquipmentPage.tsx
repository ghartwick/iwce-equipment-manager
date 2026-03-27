import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useInventory } from '../hooks/useInventory';
import { ProductForm } from '../components/ProductForm';
import { Equipment } from '../types';

export default function EquipmentPage() {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { products, categories, updateProduct, loading } = useInventory();

  const [equipment, setEquipment] = useState<Equipment | null>(null);

  useEffect(() => {
    // Save current scroll position when entering edit mode
    sessionStorage.setItem('inventoryScrollPosition', window.scrollY.toString());
    
    if (!loading && equipmentId) {
      const found = products.find(p => p.id === equipmentId);
      setEquipment(found || null);
    }
  }, [products, equipmentId, loading]);

  const handleEdit = async (productData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!equipment) return;
    console.log('Updating equipment:', equipment.id);
    try {
      await updateProduct(equipment.id, { ...productData, updatedAt: new Date().toISOString() });
      console.log('Update successful, navigating back');
      navigate(-1);
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
        <ProductForm
          categories={categories}
          product={equipment}
          onSubmit={handleEdit}
          onCancel={() => navigate(-1)}
          userRole={user?.role || 'field'}
        />
      </div>
    </main>
  );
}
