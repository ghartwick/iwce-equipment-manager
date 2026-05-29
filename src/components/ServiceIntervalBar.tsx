import React from 'react';

interface ServiceIntervalBarProps {
  currentHours: number;
  nextServiceAt: number;
  serviceInterval: number;
  serviceNotification: number;
}

export const ServiceIntervalBar: React.FC<ServiceIntervalBarProps> = ({
  currentHours,
  nextServiceAt,
  serviceInterval,
  serviceNotification,
}) => {
  // If service interval is not configured, show a message
  if (!serviceInterval || serviceInterval === 0) return null;
  if (!nextServiceAt || nextServiceAt === 0) return null;

  // Start of current interval (when last service happened)
  const lastServiceValue = nextServiceAt - serviceInterval;

  // Notification fires serviceNotification units after last service
  // e.g. last=94159, notification=5000 → triggers at 99159
  const notificationValue = lastServiceValue + serviceNotification;

  // hoursUsed = distance from last service to current position
  const hoursUsed = currentHours - lastServiceValue;

  // percentage of interval used (0–100+)
  const percentageUsed = Math.max(0, (hoursUsed / serviceInterval) * 100);

  // marker sits at serviceNotification / serviceInterval along the bar
  const notificationThresholdPercent = (serviceNotification / serviceInterval) * 100;

  return (
    <div className="bg-white dark:bg-black rounded-lg px-4 pt-3 pb-2 mb-4">
      <div className="space-y-1">
        {/* Progress Bar */}
        <div className="relative h-2.5 rounded-full overflow-hidden">
          {/* Full green→red gradient always spans the whole bar */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, hsl(120,80%,40%), hsl(60,80%,45%), hsl(30,80%,45%), hsl(0,80%,42%))' }}
          />
          {/* Grey overlay covers unfilled portion from right */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-gray-200 dark:bg-gray-700 transition-all duration-500"
            style={{ left: `${Math.min(percentageUsed, 100)}%` }}
          />
          {/* Notification threshold marker */}
          {serviceNotification > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-black dark:bg-white opacity-50"
              style={{ left: `${notificationThresholdPercent}%` }}
            />
          )}
        </div>

        {/* Scale labels */}
        <div className="relative flex items-center text-xs text-gray-500 dark:text-gray-400" style={{ height: '16px' }}>
          {/* Left: last service point */}
          <span className="absolute left-0">{lastServiceValue.toLocaleString()}</span>
          {/* Notification marker label */}
          {serviceNotification > 0 && (
            <span
              className="absolute -translate-x-1/2 text-orange-500 dark:text-orange-400"
              style={{ left: `${notificationThresholdPercent}%` }}
            >
              {notificationValue.toLocaleString()}
            </span>
          )}
          {/* Right: next service due */}
          <span className="absolute right-0">{nextServiceAt.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
