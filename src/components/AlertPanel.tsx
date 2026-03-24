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

  // Sort alerts by date (newest first)
  const sortedAlerts = [...alerts].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  // Group sorted alerts by day
  const groupedByDay: { label: string; alerts: StockAlert[] }[] = [];
  let currentDateKey = '';
  sortedAlerts.forEach((alert) => {
    const date = new Date(alert.createdAt);
    const dateKey = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      groupedByDay.push({ label: dateKey, alerts: [] });
    }
    groupedByDay[groupedByDay.length - 1].alerts.push(alert);
  });

  if (alerts.length === 0) {
    return (
      <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow p-3 sm:p-6">
        <div className="flex items-center space-x-2 mb-3 sm:mb-4">
          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />
          <h3 className="text-base sm:text-lg font-medium text-yellow-600 dark:text-yellow-400">Equipment Alerts</h3>
        </div>
        <p className="text-yellow-700 dark:text-yellow-600 text-sm sm:text-base">No equipment alerts at this time.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#fffff0] dark:bg-black border border-yellow-600 rounded-lg shadow">
      <div className="p-3 sm:p-6 border-b border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
            <h3 className="text-base sm:text-lg font-medium text-yellow-600 dark:text-yellow-400">Equipment Alerts</h3>
            <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
              {alerts.length}
            </span>
          </div>
        </div>
      </div>
      
      <div 
        className="max-h-96 overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {groupedByDay.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 px-3 py-1.5 sm:px-4 sm:py-2 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-50 border-b border-yellow-300 dark:border-yellow-700">
              <p className="text-xs sm:text-sm font-semibold text-yellow-800 dark:text-yellow-300">{group.label}</p>
            </div>
            <div className="divide-y divide-yellow-200 dark:divide-yellow-800">
              {group.alerts.map((alert) => (
                <div key={alert.id} className="p-3 sm:p-4 hover:bg-yellow-50 dark:hover:bg-yellow-950">
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="flex-shrink-0">
                      {alert.type === 'repair' ? (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-600 rounded-full flex items-center justify-center">
                          <Wrench className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                        </div>
                      ) : alert.type === 'out_of_stock' ? (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-600 rounded-full flex items-center justify-center">
                          <Package className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                          <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-black" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-yellow-100">
                            {getProductName(alert.productId)}
                          </p>
                          <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            {alert.message}
                          </p>
                          <p className="text-xs text-yellow-600 dark:text-yellow-600 mt-1">
                            {new Date(alert.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            {alert.userName && <span> &middot; by {alert.userName}</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => onClearAlert(alert.id)}
                          className="flex-shrink-0 p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
