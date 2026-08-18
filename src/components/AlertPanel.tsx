import { StockAlert, Equipment, ServiceUnit } from '../types';
import { useState } from 'react';
import { ServiceNotificationItem, notificationKey, actionableNotifications } from '../services/serviceNotificationService';
import { dateFromDayNumber } from '../services/serviceScheduleService';

// Day-based intervals store day numbers, so they read as dates instead of meters.
function formatMeter(value: number, unit: ServiceUnit): string {
  if (unit === 'days') return dateFromDayNumber(value).toLocaleDateString();
  return `${Math.round(value).toLocaleString()} ${unit === 'km' ? 'km' : 'hr'}`;
}

interface AlertPanelProps {
  alerts: StockAlert[];
  products: Equipment[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  serviceNotifications?: ServiceNotificationItem[];
}

export function AlertPanel({ alerts, products, onLoadMore, hasMore, serviceNotifications = [] }: AlertPanelProps) {
  const [isLoading, setIsLoading] = useState(false);

  const getProductName = (productId: string, productName?: string) => {
    const product = products.find(p => p.id === productId);
    return product?.name || productName || 'Unknown Equipment';
  };

  const formatMessage = (message: string) => {
    // Strip "Note:" prefix if present for backward compatibility
    return message.replace(/^Note:\s*/i, '');
  };

  const handleLoadMore = async () => {
    if (isLoading || !onLoadMore) return;
    setIsLoading(true);
    try {
      await onLoadMore();
    } finally {
      setIsLoading(false);
    }
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
    const dateKey = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      groupedByDay.push({ label: dateKey, alerts: [] });
    }
    groupedByDay[groupedByDay.length - 1].alerts.push(alert);
  });

  const actionable = actionableNotifications(serviceNotifications);

  if (alerts.length === 0 && actionable.length === 0) {
    return (
      <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow p-3 sm:p-6">
        <p className="text-yellow-700 dark:text-yellow-600 text-sm sm:text-base">No equipment alerts at this time.</p>
      </div>
    );
  }

  return (
    <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow">
      <div 
        className="max-h-96 overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Service Notifications */}
        {actionable.length > 0 && (
          <div>
            <div className="sticky top-0 px-3 py-1.5 sm:px-4 sm:py-2 bg-yellow-600 dark:bg-yellow-900 border-b border-yellow-300 dark:border-yellow-700 z-10">
              <p className="text-xs sm:text-sm font-semibold text-yellow-800 dark:text-yellow-300">Service Notifications</p>
            </div>
            <div className="divide-y divide-yellow-200 dark:divide-yellow-800">
              {actionable.map((notif) => (
                <div key={notificationKey(notif)} className={`p-3 sm:p-4 ${notif.status === 'due' ? 'bg-red-50 dark:bg-red-950' : 'hover:bg-yellow-50 dark:hover:bg-yellow-950'}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs sm:text-sm font-medium ${notif.status === 'due' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-yellow-100'}`}>
                      {notif.equipmentName}
                    </p>
                    <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${notif.status === 'due' ? 'text-red-500 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                      {notif.message}
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-600 mt-1">
                      Current: {formatMeter(notif.current, notif.unit)}
                      {notif.dueAt != null && (
                        <> &middot; Due at: {formatMeter(notif.dueAt, notif.unit)}</>
                      )}
                      {notif.remaining != null && (
                        <>
                          {' '}&middot;{' '}
                          {notif.remaining < 0
                            ? `${Math.abs(Math.round(notif.remaining)).toLocaleString()} over`
                            : `${Math.round(notif.remaining).toLocaleString()} left`}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                            {getProductName(alert.productId, alert.productName)}
                          </p>
                          <div className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            {formatMessage(alert.message).split('\n').map((line, index) => (
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
        
        {onLoadMore && hasMore && (
          <div className="p-3 sm:p-4 border-t border-yellow-200 dark:border-yellow-800">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-yellow-600 text-black rounded-md hover:bg-yellow-500 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Load More Alerts'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
