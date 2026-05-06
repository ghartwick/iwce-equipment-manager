import { StockAlert, Equipment } from '../types';

interface AlertPanelProps {
  alerts: StockAlert[];
  products: Equipment[];
}

export function AlertPanel({ alerts, products }: AlertPanelProps) {
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
      <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow p-3 sm:p-6">
        <div className="flex items-center space-x-2 mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-medium text-yellow-600 dark:text-yellow-400">Equipment Alerts</h3>
        </div>
        <p className="text-yellow-700 dark:text-yellow-600 text-sm sm:text-base">No equipment alerts at this time.</p>
      </div>
    );
  }

  return (
    <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow">
      <div className="p-3 sm:p-6 border-b border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-base sm:text-lg font-medium text-yellow-600 dark:text-yellow-400">Equipment Alerts</h3>
          </div>
        </div>
      </div>
      
      <div 
        className="max-h-96 overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {groupedByDay.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 px-3 py-1.5 sm:px-4 sm:py-2 bg-yellow-600 dark:bg-yellow-900 border-b border-yellow-300 dark:border-yellow-700 z-10">
              <p className="text-xs sm:text-sm font-semibold text-yellow-800 dark:text-yellow-300">{group.label}</p>
            </div>
            <div className="divide-y divide-yellow-200 dark:divide-yellow-800">
              {group.alerts.map((alert) => (
                <div key={alert.id} className="p-3 sm:p-4 hover:bg-yellow-50 dark:hover:bg-yellow-950">
                  <div className="flex items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start">
                        <div>
                          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-yellow-100">
                            {getProductName(alert.productId)}
                          </p>
                          <div className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            {alert.message.split('\n').map((line, index) => (
                              <p key={index} className={index > 0 ? 'mt-1' : ''}>
                                {line}
                              </p>
                            ))}
                          </div>
                          <p className="text-xs text-yellow-600 dark:text-yellow-600 mt-1">
                            {new Date(alert.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            {alert.userName && <span> &middot; by {alert.userName}</span>}
                          </p>
                        </div>
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
