import { AlertTriangle, X, Package, Wrench } from 'lucide-react';
import { StockAlert, Equipment } from '../types';

interface AlertPanelProps {
  alerts: StockAlert[];
  products: Equipment[];
  onClearAlert: (alertId: string) => void;
}

export function AlertPanel({ alerts, products, onClearAlert }: AlertPanelProps) {
  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Equipment';
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-black border border-yellow-600 rounded-lg shadow p-6">
        <div className="flex items-center space-x-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-medium text-yellow-400">Equipment Alerts</h3>
        </div>
        <p className="text-yellow-600 text-sm">No equipment alerts at this time.</p>
      </div>
    );
  }

  return (
    <div className="bg-black border border-yellow-600 rounded-lg shadow">
      <div className="p-6 border-b border-yellow-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-medium text-yellow-400">Equipment Alerts</h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
              {alerts.length}
            </span>
          </div>
        </div>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        <div className="divide-y divide-yellow-800">
          {alerts.map((alert) => (
            <div key={alert.id} className="p-4 hover:bg-yellow-950">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {alert.type === 'repair' ? (
                    <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                      <Wrench className="h-4 w-4 text-white" />
                    </div>
                  ) : alert.type === 'out_of_stock' ? (
                    <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                      <Package className="h-4 w-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-black" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-100">
                        {getProductName(alert.productId)}
                      </p>
                      <p className="text-sm text-yellow-300 mt-1">
                        {alert.message}
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => onClearAlert(alert.id)}
                      className="ml-2 text-yellow-400 hover:text-yellow-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
