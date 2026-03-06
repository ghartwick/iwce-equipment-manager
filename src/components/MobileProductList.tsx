import { Equipment, Category } from '../types';
import { Edit, Trash2, Package, AlertTriangle, MapPin, User, Wrench } from 'lucide-react';

interface MobileProductListProps {
  products: Equipment[];
  categories: Category[];
  onEdit: (product: Equipment) => void;
  onDelete: (id: string) => void;
  userRole: string;
}

export function MobileProductList({ 
  products, 
  categories, 
  onEdit, 
  onDelete, 
  userRole 
}: MobileProductListProps) {

  if (products.length === 0) {
    return (
      <div className="p-8 text-center">
        <Package className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-yellow-300 mb-2">No equipment found</h3>
        <p className="text-yellow-600">Get started by adding your first equipment to the inventory.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-yellow-800">
      {products.map((product) => (
        <div 
          key={product.id}
          className={`p-4 ${product.repair ? 'bg-red-950' : 'bg-black'} hover:bg-yellow-900 hover:bg-opacity-20 transition-colors`}
        >
          {/* Equipment Name - Primary */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className={`text-lg font-medium ${product.repair ? 'text-red-400' : 'text-yellow-100'} break-words`}>
                {product.name}
              </h3>
              {product.repair && (
                <div className="flex items-center space-x-2 mt-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-red-500 text-sm font-medium">Needs Repair</span>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={() => onEdit(product)}
                className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900 hover:bg-opacity-30 rounded-lg transition-colors"
                title="Edit Equipment"
              >
                <Edit className="h-4 w-4" />
              </button>
              {(userRole === 'admin' || userRole === 'manager') && (
                <button
                  onClick={() => onDelete(product.id)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900 hover:bg-opacity-30 rounded-lg transition-colors"
                  title="Delete Equipment"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Equipment Details - Mobile Card Layout */}
          <div className="space-y-2">
            {/* Employee */}
            {product.employee && (
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-300 text-sm">{product.employee}</span>
              </div>
            )}

            {/* Site */}
            {product.site && (
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-300 text-sm">{product.site}</span>
              </div>
            )}

            {/* Repair Description */}
            {product.repair && product.repairDescription && (
              <div className="flex items-start space-x-2 mt-2 p-2 bg-red-900 bg-opacity-20 rounded">
                <Wrench className="h-4 w-4 text-red-500 mt-0.5" />
                <div>
                  <span className="text-red-400 text-sm font-medium">Repair Details:</span>
                  <p className="text-red-300 text-xs mt-1">{product.repairDescription}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
