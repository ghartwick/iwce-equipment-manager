import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import {
  ServiceDueState,
  ServiceDueStatus,
  dateFromDayNumber,
  sortByUrgency,
} from '../services/serviceScheduleService';
import { ServiceUnit } from '../types';

interface ServiceScheduleBarsProps {
  states: ServiceDueState[];
  // How many of the most urgent intervals to expand up front.
  initiallyExpanded?: number;
  compact?: boolean;
}

// Colour is driven purely by status, never by position along the bar. The old
// gradient bar could show green while already past the warning threshold.
const STATUS_STYLE: Record<ServiceDueStatus, {
  fill: string;
  pill: string;
  text: string;
  label: string;
}> = {
  ok: {
    fill: 'bg-green-500',
    pill: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    text: 'text-green-700 dark:text-green-400',
    label: 'OK',
  },
  'due-soon': {
    fill: 'bg-red-500',
    pill: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    text: 'text-red-600 dark:text-red-400',
    label: 'DUE SOON',
  },
  overdue: {
    fill: 'bg-red-800',
    pill: 'bg-red-700 text-white',
    text: 'text-red-700 dark:text-red-400',
    label: 'OVERDUE',
  },
  'no-baseline': {
    fill: 'bg-gray-400 dark:bg-gray-600',
    pill: 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    text: 'text-gray-500 dark:text-gray-400',
    label: 'NO BASELINE',
  },
};

const UNIT_SUFFIX: Record<ServiceUnit, string> = {
  hours: 'hrs',
  km: 'km',
  days: 'days',
};

function formatPosition(value: number | null, unit: ServiceUnit): string {
  if (value == null) return '—';
  if (unit === 'days') {
    return dateFromDayNumber(value).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }
  return Math.round(value).toLocaleString();
}

function formatRemaining(state: ServiceDueState): string {
  if (state.remaining == null) return '—';
  const suffix = UNIT_SUFFIX[state.unit];
  if (state.remaining < 0) {
    return `${Math.abs(Math.round(state.remaining)).toLocaleString()} ${suffix} over`;
  }
  return `${Math.round(state.remaining).toLocaleString()} ${suffix} left`;
}

export function ServiceScheduleBars({
  states,
  initiallyExpanded = 2,
  compact = false,
}: ServiceScheduleBarsProps) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => sortByUrgency(states), [states]);

  if (sorted.length === 0) return null;

  const expanded = showAll ? sorted : sorted.slice(0, initiallyExpanded);
  const hidden = sorted.length - expanded.length;

  return (
    <div className={compact ? '' : 'bg-white dark:bg-black rounded-lg px-4 pt-3 pb-2 mb-4'}>
      {/* At-a-glance strip so nothing urgent is hidden behind the fold. */}
      {sorted.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {sorted.map(state => {
            const style = STATUS_STYLE[state.status];
            return (
              <span
                key={state.intervalId}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${style.pill}`}
                title={`${state.name} — ${formatRemaining(state)}`}
              >
                {state.status === 'overdue' && <AlertTriangle className="h-2.5 w-2.5" />}
                <span className="truncate max-w-[9rem]">{state.name}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="space-y-2.5">
        {expanded.map(state => {
          const style = STATUS_STYLE[state.status];
          const showNotifyMarker =
            state.status !== 'no-baseline' && state.notifyPct > 0 && state.notifyPct < 100;

          return (
            <div key={state.intervalId}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-gray-900 dark:text-yellow-100 truncate">
                  {state.name}
                </span>
                <span className={`text-xs whitespace-nowrap ${style.text}`}>
                  {state.status === 'overdue' && (
                    <span className="mr-1 px-1 py-0.5 rounded bg-red-700 text-white text-[10px] font-bold align-middle">
                      OVERDUE
                    </span>
                  )}
                  {formatRemaining(state)}
                </span>
              </div>

              {state.status === 'no-baseline' ? (
                <p className="flex items-start gap-1 mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                  <HelpCircle className="h-3 w-3 mt-px shrink-0" />
                  <span>Log a service card for this interval to start its schedule.</span>
                </p>
              ) : (
                <>
                  <div className="relative h-2.5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mt-1">
                    <div
                      className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ${style.fill}`}
                      style={{ width: `${state.progressPct}%` }}
                    />
                    {showNotifyMarker && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-gray-900 dark:bg-white opacity-60"
                        style={{ left: `${state.notifyPct}%` }}
                        title={`Warning at ${formatPosition(state.notifyAt, state.unit)}`}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                    <span>
                      {state.lastDoneAt != null || state.lastDoneDate
                        ? `Last: ${state.unit === 'days' && state.lastDoneDate
                            ? new Date(state.lastDoneDate).toLocaleDateString()
                            : formatPosition(state.lastDoneAt, state.unit)}`
                        : 'Last: —'}
                    </span>
                    <span>
                      Now {formatPosition(state.current, state.unit)}
                    </span>
                    <span>
                      Due: {formatPosition(state.dueAt, state.unit)}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-yellow-700 dark:text-yellow-400 hover:text-yellow-500"
        >
          <ChevronDown className="h-3 w-3" />
          Show {hidden} more interval{hidden === 1 ? '' : 's'}
        </button>
      )}
      {showAll && sorted.length > initiallyExpanded && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-yellow-700 dark:text-yellow-400 hover:text-yellow-500"
        >
          <ChevronUp className="h-3 w-3" />
          Show less
        </button>
      )}
    </div>
  );
}
