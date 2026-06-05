import React from 'react';

interface ServiceIntervalBarProps {
  currentHours: number;
  nextServiceAt: number;
  serviceInterval: number;
  serviceNotification: number;
  largeServiceInterval?: number;
  completedMinorCount?: number;
}

export const ServiceIntervalBar: React.FC<ServiceIntervalBarProps> = ({
  currentHours,
  nextServiceAt,
  serviceInterval,
  serviceNotification,
  largeServiceInterval,
  completedMinorCount = 0,
}) => {
  if (!serviceInterval || serviceInterval === 0) return null;

  const isHeavyMode = !!largeServiceInterval && largeServiceInterval > serviceInterval;

  // Fleet: nextServiceAt=0 means "not configured". Heavy: 0 is a valid cycle start.
  if (!isHeavyMode && (!nextServiceAt || nextServiceAt === 0)) return null;

  // ── HEAVY EQUIPMENT MODE ──────────────────────────────────────────────────
  if (isHeavyMode) {
    // nextServiceAt here is the baseline (servicedAt of last MAJOR service)
    const cycleStart = nextServiceAt;
    const cycleEnd   = cycleStart + largeServiceInterval!;
    const hoursUsed  = currentHours - cycleStart;
    const pct        = Math.max(0, Math.min((hoursUsed / largeServiceInterval!) * 100, 100));

    // Build minor interval tick positions (every smallInterval, excluding the end)
    const minorTicks: number[] = [];
    for (let h = cycleStart + serviceInterval; h < cycleEnd; h += serviceInterval) {
      minorTicks.push(((h - cycleStart) / largeServiceInterval!) * 100);
    }

    // Build repeating notification markers (every smallInterval, starting at serviceNotification)
    const notifMarkers: { pct: number; label: number }[] = [];
    for (let base = cycleStart; base < cycleEnd; base += serviceInterval) {
      const triggerHr = base + serviceNotification;
      if (triggerHr < cycleEnd) {
        notifMarkers.push({
          pct: ((triggerHr - cycleStart) / largeServiceInterval!) * 100,
          label: triggerHr,
        });
      }
    }

    // Build all slot milestones (minor + major at end) for checkmarks and labels
    const numSlots = Math.floor(largeServiceInterval! / serviceInterval);
    const slotTicks: { pct: number; hour: number; isMajor: boolean }[] = [];
    for (let i = 1; i <= numSlots; i++) {
      const hour = cycleStart + i * serviceInterval;
      slotTicks.push({
        pct: (i / numSlots) * 100,
        hour,
        isMajor: i === numSlots,
      });
    }

    return (
      <div className="bg-white dark:bg-black rounded-lg px-4 pt-3 pb-2 mb-4">
        <div className="space-y-0.5">
          {/* Checkmark row — above the bar */}
          <div className="relative" style={{ height: '16px' }}>
            {slotTicks.map((slot, i) => {
              const isCompleted = slot.isMajor ? false : i < completedMinorCount;
              return (
                <span
                  key={i}
                  className={`absolute -translate-x-1/2 text-xs font-bold leading-none ${
                    isCompleted
                      ? 'text-green-500 dark:text-green-400'
                      : slot.isMajor
                        ? 'text-orange-400 dark:text-orange-500 opacity-40'
                        : 'text-gray-300 dark:text-gray-600'
                  }`}
                  style={{ left: `${slot.pct}%`, top: 0 }}
                >
                  {isCompleted ? '✓' : slot.isMajor ? '★' : '○'}
                </span>
              );
            })}
          </div>

          <div className="relative h-2.5 rounded-full overflow-hidden">
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, hsl(120,80%,40%), hsl(60,80%,45%), hsl(30,80%,45%), hsl(0,80%,42%))' }}
            />
            <div
              className="absolute top-0 bottom-0 right-0 bg-gray-200 dark:bg-gray-700 transition-all duration-500"
              style={{ left: `${pct}%` }}
            />
            {/* Slot dividers */}
            {slotTicks.slice(0, -1).map((slot, i) => (
              <div
                key={i}
                className={`absolute top-0 bottom-0 w-px opacity-70 ${
                  i < completedMinorCount ? 'bg-green-500' : 'bg-gray-500 dark:bg-gray-400'
                }`}
                style={{ left: `${slot.pct}%` }}
              />
            ))}
            {/* Notification threshold markers — orange */}
            {notifMarkers.map((m, i) => (
              <div key={i} className="absolute top-0 bottom-0 w-0.5 bg-orange-500 opacity-80" style={{ left: `${m.pct}%` }} />
            ))}
          </div>

          {/* Labels row */}
          <div className="relative flex items-center text-xs text-gray-500 dark:text-gray-400" style={{ height: '16px' }}>
            <span className="absolute left-0">{cycleStart.toLocaleString()}</span>
            {slotTicks.map((slot, i) => (
              <span
                key={i}
                className={`absolute -translate-x-1/2 ${
                  slot.isMajor
                    ? 'text-orange-500 dark:text-orange-400'
                    : i < completedMinorCount
                      ? 'text-green-500 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                }`}
                style={{ left: `${slot.pct}%` }}
              >
                {slot.hour.toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── FLEET MODE (original) ─────────────────────────────────────────────────
  const lastServiceValue = nextServiceAt - serviceInterval;
  const notificationValue = lastServiceValue + serviceNotification;
  const hoursUsed = currentHours - lastServiceValue;
  const percentageUsed = Math.max(0, (hoursUsed / serviceInterval) * 100);
  const notificationThresholdPercent = (serviceNotification / serviceInterval) * 100;

  return (
    <div className="bg-white dark:bg-black rounded-lg px-4 pt-3 pb-2 mb-4">
      <div className="space-y-1">
        <div className="relative h-2.5 rounded-full overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, hsl(120,80%,40%), hsl(60,80%,45%), hsl(30,80%,45%), hsl(0,80%,42%))' }}
          />
          <div
            className="absolute top-0 bottom-0 right-0 bg-gray-200 dark:bg-gray-700 transition-all duration-500"
            style={{ left: `${Math.min(percentageUsed, 100)}%` }}
          />
          {serviceNotification > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-black dark:bg-white opacity-50"
              style={{ left: `${notificationThresholdPercent}%` }}
            />
          )}
        </div>

        <div className="relative flex items-center text-xs text-gray-500 dark:text-gray-400" style={{ height: '16px' }}>
          <span className="absolute left-0">{lastServiceValue.toLocaleString()}</span>
          {serviceNotification > 0 && (
            <span
              className="absolute -translate-x-1/2 text-orange-500 dark:text-orange-400"
              style={{ left: `${notificationThresholdPercent}%` }}
            >
              {notificationValue.toLocaleString()}
            </span>
          )}
          <span className="absolute right-0">{nextServiceAt.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
