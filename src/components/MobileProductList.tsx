import { User, MapPin, AlertTriangle, Wrench } from 'lucide-react';
import { Equipment } from '../types';

interface MobileProductListProps {
  products: Equipment[];
  onEdit: (product: Equipment) => void;
}

export function MobileProductList({ 
  products, 
  onEdit
}: MobileProductListProps) {

  if (products.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="h-12 w-12 bg-yellow-400 rounded-full mx-auto mb-4 flex items-center justify-center">
          <span className="text-black text-xl font-bold">!</span>
        </div>
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
          className={`p-3 ${product.repair ? 'bg-red-950' : 'bg-black'} hover:bg-yellow-900 hover:bg-opacity-20 transition-colors cursor-pointer`}
          onTouchStart={() => onEdit(product)}
          onClick={() => onEdit(product)}
          title="Tap to edit equipment"
        >
          {/* Equipment Name - Primary */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className={`text-sm font-medium ${product.repair ? 'text-red-400' : 'text-yellow-100'} break-words`}>
                {product.name}
              </h3>
              {product.repair && (
                <div className="flex items-center space-x-2 mt-1">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <span className="text-red-500 text-xs font-medium">Needs Repair</span>
                </div>
              )}
            </div>
          </div>

          {/* Equipment Details - Mobile Card Layout */}
          <div className="space-y-2">
            {/* Employee */}
            {product.employee && (
              <div className="flex items-center space-x-2">
                <User className="h-3 w-3 text-yellow-600" />
                <span className="text-yellow-300 text-xs">{product.employee}</span>
              </div>
            )}

            {/* Site */}
            {product.site && (
              <div className="flex items-center space-x-2">
                <MapPin className="h-3 w-3 text-yellow-600" />
                <span className="text-yellow-300 text-xs">{product.site}</span>
              </div>
            )}

            {/* Repair Description */}
            {product.repair && product.repairDescription && (
              <div className="flex items-start space-x-2 mt-2 p-2 bg-red-900 bg-opacity-20 rounded">
                <Wrench className="h-3 w-3 text-red-500 mt-0.5" />
                <div>
                  <span className="text-red-400 text-xs font-medium">Repair Details:</span>
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
