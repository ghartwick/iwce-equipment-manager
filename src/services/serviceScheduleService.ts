import {
  Category,
  Equipment,
  ResolvedServiceInterval,
  ServiceAnchor,
  ServiceIntervalDef,
  ServiceUnit,
} from '../types';

export const MS_PER_DAY = 86400000;

export type ServiceDueStatus = 'ok' | 'due-soon' | 'overdue' | 'no-baseline';

// A single logged completion of one specific interval. `at` is the meter reading
// for hours/km intervals and is ignored for day-based intervals, which anchor on
// `date` instead.
export interface ServiceCompletion {
  intervalId: string;
  at?: number;
  date: string;
}

// A meter reading captured by an inspection card. `voided` lets an admin discard
// a mistyped reading without deleting the underlying inspection record.
export interface ServiceReading {
  value: number;
  date: string;
  voided?: boolean;
}

export interface ServiceDueState {
  intervalId: string;
  name: string;
  unit: ServiceUnit;
  // Definition context the UI needs to preview the effect of logging a service.
  interval: number;
  anchor: ServiceAnchor;
  status: ServiceDueStatus;
  current: number;
  lastDoneAt: number | null;
  lastDoneDate: string | null;
  dueAt: number | null;
  notifyAt: number | null;
  remaining: number | null;
  progressPct: number;
  // Position of the warning threshold along the same 0-100 span as progressPct,
  // so a bar can mark it without recomputing the span.
  notifyPct: number;
}

export function dayNumber(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.floor(d.getTime() / MS_PER_DAY);
}

// Day-based intervals carry day numbers rather than meter values, so display
// code needs to turn them back into calendar dates.
export function dateFromDayNumber(day: number): Date {
  return new Date(day * MS_PER_DAY);
}

export function newIntervalId(): string {
  return `si_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function timeOf(date: string): number {
  return new Date(date).getTime();
}

// Grid point that a service performed at `position` is considered to satisfy.
// Rounding means a service done slightly early or late still clears the nearest
// scheduled milestone instead of creating a near-instant duplicate.
function satisfiedGridPoint(position: number, interval: number, origin: number): number {
  return origin + Math.round((position - origin) / interval) * interval;
}

function nextGridPointAfter(position: number, interval: number, origin: number): number {
  return origin + (Math.floor((position - origin) / interval) + 1) * interval;
}

/**
 * Computes the due state of a single service interval.
 *
 * Anchoring:
 *  - 'rolling' anchors on the ACTUAL last completion, so a service done early or
 *    late moves the next one with it. Requires a baseline completion.
 *  - 'fixed' anchors on an absolute grid so long-cycle services never drift.
 *
 * Stickiness: for meter-based intervals the current position is the MAXIMUM
 * reading observed since the last completion, never the latest. Once an alert
 * trips it cannot untrip itself if a later inspection reports a lower reading.
 */
export function computeDueState(
  def: ServiceIntervalDef,
  completions: ServiceCompletion[],
  readings: ServiceReading[],
  now: Date = new Date()
): ServiceDueState {
  const interval = def.interval;
  const origin = def.origin ?? 0;

  const own = completions
    .filter(c => c.intervalId === def.id)
    .sort((a, b) => timeOf(b.date) - timeOf(a.date));
  const lastCompletion = own[0] ?? null;

  const base: ServiceDueState = {
    intervalId: def.id,
    name: def.name,
    unit: def.unit,
    interval: def.interval,
    anchor: def.anchor,
    status: 'no-baseline',
    current: 0,
    lastDoneAt: null,
    lastDoneDate: lastCompletion?.date ?? null,
    dueAt: null,
    notifyAt: null,
    remaining: null,
    progressPct: 0,
    notifyPct: 0,
  };

  if (!interval || interval <= 0) return base;

  let current: number;
  let anchor: number | null;

  if (def.unit === 'days') {
    // Calendar time always advances, so no ratchet is required.
    current = dayNumber(now);
    anchor = lastCompletion ? dayNumber(lastCompletion.date) : null;
  } else {
    const valid = readings.filter(r => !r.voided);
    anchor = lastCompletion?.at ?? null;
    const pool = lastCompletion
      ? valid.filter(r => timeOf(r.date) >= timeOf(lastCompletion.date))
      : valid;
    const highest = pool.reduce((max, r) => (r.value > max ? r.value : max), Number.NEGATIVE_INFINITY);
    const observed = highest === Number.NEGATIVE_INFINITY ? null : highest;
    // Ratchet: never fall below the anchor or the highest reading seen since it.
    current = Math.max(anchor ?? 0, observed ?? 0);
  }

  base.current = current;
  base.lastDoneAt = anchor;

  let dueAt: number;
  if (def.anchor === 'rolling') {
    // Rolling has no meaningful schedule until a first service establishes the anchor.
    if (anchor == null) return base;
    dueAt = anchor + interval;
  } else if (anchor == null) {
    dueAt = nextGridPointAfter(current, interval, origin);
  } else {
    dueAt = satisfiedGridPoint(anchor, interval, origin) + interval;
  }

  const notifyAt = dueAt - Math.max(0, def.notifyLead);
  const remaining = dueAt - current;

  let status: ServiceDueStatus;
  if (current >= dueAt) status = 'overdue';
  else if (current >= notifyAt) status = 'due-soon';
  else status = 'ok';

  const spanStart = anchor != null ? Math.min(anchor, dueAt - interval) : dueAt - interval;
  const span = dueAt - spanStart;
  const pctOf = (value: number) =>
    span > 0 ? Math.max(0, Math.min(((value - spanStart) / span) * 100, 100)) : 0;

  return {
    ...base,
    status,
    dueAt,
    notifyAt,
    remaining,
    progressPct: pctOf(current),
    notifyPct: pctOf(notifyAt),
  };
}

const STATUS_RANK: Record<ServiceDueStatus, number> = {
  overdue: 0,
  'due-soon': 1,
  ok: 2,
  'no-baseline': 3,
};

// Most urgent first: overdue, then due soon, then by least remaining.
export function sortByUrgency(states: ServiceDueState[]): ServiceDueState[] {
  return [...states].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    const ar = a.remaining ?? Number.POSITIVE_INFINITY;
    const br = b.remaining ?? Number.POSITIVE_INFINITY;
    return ar - br;
  });
}

/**
 * Effective interval list for a unit: category templates (with per-unit
 * overrides applied, disabled ones removed) plus any unit-only intervals.
 */
export function resolveIntervalsForUnit(
  equipment: Pick<Equipment, 'serviceIntervals' | 'intervalOverrides'>,
  category?: Pick<Category, 'serviceIntervals'> | null
): ResolvedServiceInterval[] {
  const overrides = equipment.intervalOverrides ?? {};
  const templates = category?.serviceIntervals ?? [];

  const inherited: ResolvedServiceInterval[] = [];
  for (const template of templates) {
    const override = overrides[template.id];
    if (override?.disabled) continue;
    const { disabled: _disabled, ...patch } = override ?? {};
    inherited.push({
      ...template,
      ...patch,
      id: template.id,
      source: 'category',
      isOverridden: Object.keys(patch).length > 0,
    });
  }

  const unitOnly: ResolvedServiceInterval[] = (equipment.serviceIntervals ?? []).map(def => ({
    ...def,
    source: 'unit',
    isOverridden: false,
  }));

  return [...inherited, ...unitOnly].filter(def => def.isActive);
}
