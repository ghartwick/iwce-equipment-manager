import { describe, expect, it } from 'vitest';
import { ServiceIntervalDef } from '../types';
import {
  ServiceCompletion,
  ServiceReading,
  computeDueState,
  dayNumber,
  resolveIntervalsForUnit,
  sortByUrgency,
} from './serviceScheduleService';
import {
  LEGACY_MAJOR_ID,
  LEGACY_MINOR_ID,
  LEGACY_SINGLE_ID,
  completionsFromShopReports,
  computeUnitSchedule,
  deriveLegacyIntervals,
  readingsFromMaintenanceReports,
} from './serviceScheduleMigration';

const minor: ServiceIntervalDef = {
  id: 'minor',
  name: '500 Hr Service',
  interval: 500,
  unit: 'hours',
  notifyLead: 50,
  anchor: 'rolling',
  isActive: true,
};

function reading(value: number, date: string): ServiceReading {
  return { value, date };
}

function completion(intervalId: string, at: number, date: string): ServiceCompletion {
  return { intervalId, at, date };
}

describe('computeDueState — rolling anchor', () => {
  it('moves the next service DOWN when serviced early', () => {
    const state = computeDueState(
      minor,
      [completion('minor', 490, '2026-01-10')],
      [reading(490, '2026-01-10')]
    );
    expect(state.lastDoneAt).toBe(490);
    expect(state.dueAt).toBe(990);
  });

  it('moves the next service UP when serviced late', () => {
    const state = computeDueState(
      minor,
      [completion('minor', 530, '2026-01-10')],
      [reading(530, '2026-01-10')]
    );
    expect(state.dueAt).toBe(1030);
  });

  it('schedules exactly one interval out when serviced on time', () => {
    const state = computeDueState(
      minor,
      [completion('minor', 500, '2026-01-10')],
      [reading(500, '2026-01-10')]
    );
    expect(state.dueAt).toBe(1000);
  });

  it('anchors on the most recent completion, not the first', () => {
    const state = computeDueState(
      minor,
      [
        completion('minor', 490, '2026-01-10'),
        completion('minor', 1010, '2026-03-01'),
      ],
      [reading(1010, '2026-03-01')]
    );
    expect(state.lastDoneAt).toBe(1010);
    expect(state.dueAt).toBe(1510);
  });

  it('reports no-baseline until a first service is logged', () => {
    const state = computeDueState(minor, [], [reading(120, '2026-01-10')]);
    expect(state.status).toBe('no-baseline');
    expect(state.dueAt).toBeNull();
  });
});

describe('computeDueState — status thresholds', () => {
  const completions = [completion('minor', 500, '2026-01-10')];

  it('is ok below the notification threshold', () => {
    const state = computeDueState(minor, completions, [reading(900, '2026-02-01')]);
    expect(state.status).toBe('ok');
    expect(state.notifyAt).toBe(950);
  });

  it('is due-soon at the notification threshold', () => {
    const state = computeDueState(minor, completions, [reading(950, '2026-02-01')]);
    expect(state.status).toBe('due-soon');
  });

  it('escalates to overdue past the due point with negative remaining', () => {
    const state = computeDueState(minor, completions, [reading(1120, '2026-02-01')]);
    expect(state.status).toBe('overdue');
    expect(state.remaining).toBe(-120);
  });
});

describe('computeDueState — sticky ratchet', () => {
  const completions = [completion('minor', 500, '2026-01-10')];

  it('stays tripped when a later reading reports fewer hours', () => {
    const state = computeDueState(minor, completions, [
      reading(960, '2026-02-01'),
      reading(700, '2026-02-05'),
    ]);
    expect(state.current).toBe(960);
    expect(state.status).toBe('due-soon');
  });

  it('honours a voided reading so a mistyped value can be corrected', () => {
    const state = computeDueState(minor, completions, [
      { ...reading(9600, '2026-02-01'), voided: true },
      reading(700, '2026-02-05'),
    ]);
    expect(state.current).toBe(700);
    expect(state.status).toBe('ok');
  });

  it('ignores readings taken before the last completion', () => {
    const state = computeDueState(
      minor,
      [completion('minor', 1000, '2026-03-01')],
      [reading(980, '2026-02-01'), reading(1010, '2026-03-02')]
    );
    expect(state.current).toBe(1010);
    expect(state.dueAt).toBe(1500);
    expect(state.status).toBe('ok');
  });
});

describe('computeDueState — fixed anchor', () => {
  const fixed: ServiceIntervalDef = { ...minor, id: 'fixed', anchor: 'fixed' };

  it('does not drift when serviced early', () => {
    const state = computeDueState(
      fixed,
      [completion('fixed', 490, '2026-01-10')],
      [reading(490, '2026-01-10')]
    );
    expect(state.dueAt).toBe(1000);
  });

  it('does not drift when serviced late', () => {
    const state = computeDueState(
      fixed,
      [completion('fixed', 530, '2026-01-10')],
      [reading(530, '2026-01-10')]
    );
    expect(state.dueAt).toBe(1000);
  });

  it('derives a schedule with no baseline completion', () => {
    const state = computeDueState(fixed, [], [reading(120, '2026-01-10')]);
    expect(state.status).toBe('ok');
    expect(state.dueAt).toBe(500);
  });
});

describe('computeDueState — independence', () => {
  it('does not treat a major completion as satisfying the minor', () => {
    const state = computeDueState(
      minor,
      [completion('major', 1000, '2026-03-01')],
      [reading(1000, '2026-03-01')]
    );
    expect(state.status).toBe('no-baseline');
  });
});

describe('computeDueState — day based intervals', () => {
  const annual: ServiceIntervalDef = {
    id: 'annual',
    name: 'Annual Inspection',
    interval: 365,
    unit: 'days',
    notifyLead: 30,
    anchor: 'rolling',
    isActive: true,
  };

  it('counts elapsed calendar days from the last completion', () => {
    const done = '2026-01-01T00:00:00.000Z';
    const state = computeDueState(annual, [completion('annual', 0, done)], [], new Date('2026-12-20T00:00:00.000Z'));
    expect(state.dueAt).toBe(dayNumber(done) + 365);
    expect(state.status).toBe('due-soon');
  });
});

describe('sortByUrgency', () => {
  it('orders overdue first, then due-soon, then by least remaining', () => {
    const completions = [completion('minor', 500, '2026-01-10')];
    const overdue = computeDueState(minor, completions, [reading(1200, '2026-02-01')]);
    const ok = computeDueState({ ...minor, id: 'b' }, [completion('b', 500, '2026-01-10')], [reading(600, '2026-02-01')]);
    const dueSoon = computeDueState({ ...minor, id: 'c' }, [completion('c', 500, '2026-01-10')], [reading(960, '2026-02-01')]);

    expect(sortByUrgency([ok, dueSoon, overdue]).map(s => s.status)).toEqual([
      'overdue',
      'due-soon',
      'ok',
    ]);
  });
});

describe('resolveIntervalsForUnit', () => {
  const category = { serviceIntervals: [minor] };

  it('inherits category templates', () => {
    const resolved = resolveIntervalsForUnit({}, category);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].source).toBe('category');
    expect(resolved[0].isOverridden).toBe(false);
  });

  it('applies a unit override without mutating the template', () => {
    const resolved = resolveIntervalsForUnit(
      { intervalOverrides: { minor: { interval: 400 } } },
      category
    );
    expect(resolved[0].interval).toBe(400);
    expect(resolved[0].isOverridden).toBe(true);
    expect(minor.interval).toBe(500);
  });

  it('removes a disabled inherited interval', () => {
    const resolved = resolveIntervalsForUnit({ intervalOverrides: { minor: { disabled: true } } }, category);
    expect(resolved).toHaveLength(0);
  });

  it('appends unit-only intervals and flags their source', () => {
    const unitOnly: ServiceIntervalDef = { ...minor, id: 'unit-1', name: 'Track Tension' };
    const resolved = resolveIntervalsForUnit({ serviceIntervals: [unitOnly] }, category);
    expect(resolved.map(r => r.source)).toEqual(['category', 'unit']);
  });

  it('drops inactive intervals', () => {
    const resolved = resolveIntervalsForUnit({}, { serviceIntervals: [{ ...minor, isActive: false }] });
    expect(resolved).toHaveLength(0);
  });

  it('returns an empty list when the category has no templates', () => {
    expect(resolveIntervalsForUnit({}, null)).toEqual([]);
  });
});

describe('legacy migration', () => {
  it('derives minor and major intervals for heavy units', () => {
    const defs = deriveLegacyIntervals(
      { serviceInterval: 500, largeServiceInterval: 2000, serviceNotification: 450 },
      { notificationType: 'heavy' }
    );
    expect(defs.map(d => d.id)).toEqual([LEGACY_MINOR_ID, LEGACY_MAJOR_ID]);
    expect(defs[0].interval).toBe(500);
    expect(defs[1].interval).toBe(2000);
    // Legacy notification was an offset from the last service; the new model
    // stores the complement as a lead before the due point.
    expect(defs[0].notifyLead).toBe(50);
    expect(defs.every(d => d.anchor === 'rolling')).toBe(true);
  });

  it('derives a single interval for fleet units', () => {
    const defs = deriveLegacyIntervals({ serviceInterval: 5000, serviceNotification: 4500 }, { notificationType: 'fleet' });
    expect(defs.map(d => d.id)).toEqual([LEGACY_SINGLE_ID]);
    expect(defs[0].notifyLead).toBe(500);
  });

  it('derives nothing when no interval is configured', () => {
    expect(deriveLegacyIntervals({}, { notificationType: 'heavy' })).toEqual([]);
  });

  it('backfills untagged legacy reports onto the derived ids', () => {
    const completions = completionsFromShopReports([
      { servicedAt: 500, serviceType: 'minor', createdAt: '2026-01-10' },
      { servicedAt: 2000, serviceType: 'major', createdAt: '2026-06-10' },
      { servicedAt: 300, createdAt: '2025-12-01' },
    ]);
    expect(completions.map(c => c.intervalId)).toEqual([
      LEGACY_MINOR_ID,
      LEGACY_MAJOR_ID,
      LEGACY_SINGLE_ID,
    ]);
  });

  it('fans a tagged report out to every interval it completed', () => {
    const completions = completionsFromShopReports([
      { servicedAt: 1000, intervalIds: ['a', 'b'], createdAt: '2026-01-10' },
    ]);
    expect(completions).toHaveLength(2);
    expect(completions.map(c => c.intervalId)).toEqual(['a', 'b']);
    expect(completions.every(c => c.at === 1000)).toBe(true);
  });

  it('skips reports with no serviced reading', () => {
    expect(completionsFromShopReports([{ createdAt: '2026-01-10', notes: 'no reading' } as any])).toEqual([]);
  });

  it('extracts readings from inspection cards', () => {
    const readings = readingsFromMaintenanceReports([
      { maintenance: { hours: 940 }, createdAt: '2026-02-01' },
      { maintenance: {}, createdAt: '2026-02-02' },
    ]);
    expect(readings).toEqual([{ value: 940, date: '2026-02-01', voided: undefined }]);
  });

  it('carries a voided reading through so the engine excludes it', () => {
    const readings = readingsFromMaintenanceReports([
      { maintenance: { hours: 99999 }, createdAt: '2026-02-01', readingVoided: true },
    ]);
    expect(readings[0].voided).toBe(true);
  });

  it('excludes a voided reading from the computed current position', () => {
    const readings = readingsFromMaintenanceReports([
      { maintenance: { hours: 600 }, createdAt: '2026-02-01' },
      { maintenance: { hours: 99999 }, createdAt: '2026-02-02', readingVoided: true },
    ]);
    const state = computeDueState(
      { ...minor, id: LEGACY_MINOR_ID },
      [completion(LEGACY_MINOR_ID, 500, '2026-01-10')],
      readings
    );
    expect(state.current).toBe(600);
    expect(state.status).toBe('ok');
  });
});

describe('notifyPct — bar marker placement', () => {
  it('places the marker proportionally along the same span as progressPct', () => {
    const state = computeDueState(
      minor,
      [completion('minor', 500, '2026-01-10')],
      [reading(750, '2026-02-01')]
    );
    // Span 500..1000, warning at 950 => 90%, current 750 => 50%.
    expect(state.notifyPct).toBeCloseTo(90, 5);
    expect(state.progressPct).toBeCloseTo(50, 5);
  });

  it('is zero when there is no schedule', () => {
    expect(computeDueState(minor, [], [reading(120, '2026-01-10')]).notifyPct).toBe(0);
  });

  it('clamps the bar fill at 100 percent when overdue', () => {
    const state = computeDueState(
      minor,
      [completion('minor', 500, '2026-01-10')],
      [reading(2000, '2026-02-01')]
    );
    expect(state.progressPct).toBe(100);
    expect(state.remaining).toBeLessThan(0);
  });
});

describe('computeUnitSchedule', () => {
  const heavyCategory = { notificationType: 'heavy' } as any;

  it('falls back to legacy config so unmigrated units still display', () => {
    const equipment = {
      serviceInterval: 500,
      largeServiceInterval: 2000,
      serviceNotification: 450,
    } as any;
    const states = computeUnitSchedule(
      equipment,
      heavyCategory,
      [{ servicedAt: 490, serviceType: 'minor', createdAt: '2026-02-01' }],
      [{ maintenance: { hours: 940 }, createdAt: '2026-03-01' }]
    );
    expect(states).toHaveLength(2);
    const minorState = states.find(s => s.intervalId === LEGACY_MINOR_ID)!;
    expect(minorState.dueAt).toBe(990);
    expect(minorState.status).toBe('due-soon');
  });

  it('prefers configured intervals over the legacy fallback', () => {
    const equipment = {
      serviceInterval: 500,
      largeServiceInterval: 2000,
      serviceIntervals: [{ ...minor, id: 'unit-1', name: 'Track Tension', interval: 250 }],
    } as any;
    const states = computeUnitSchedule(equipment, null, [], []);
    expect(states).toHaveLength(1);
    expect(states[0].name).toBe('Track Tension');
  });

  it('returns nothing when the unit has no configuration at all', () => {
    expect(computeUnitSchedule({} as any, null, [], [])).toEqual([]);
  });

  it('excludes voided readings end to end', () => {
    const equipment = { serviceInterval: 500, serviceNotification: 450 } as any;
    const states = computeUnitSchedule(
      equipment,
      { notificationType: 'fleet' } as any,
      [{ servicedAt: 500, createdAt: '2026-01-10' }],
      [
        { maintenance: { hours: 600 }, createdAt: '2026-02-01' },
        { maintenance: { hours: 99999 }, createdAt: '2026-02-02', readingVoided: true },
      ]
    );
    expect(states[0].current).toBe(600);
    expect(states[0].status).toBe('ok');
  });
});

describe('one card completing several intervals', () => {
  const defA: ServiceIntervalDef = { ...minor, id: 'a', name: 'A', interval: 500, notifyLead: 50 };
  const defB: ServiceIntervalDef = { ...minor, id: 'b', name: 'B', interval: 1000, notifyLead: 100 };

  it('advances every interval listed on the card', () => {
    const completions = completionsFromShopReports([
      { servicedAt: 1000, intervalIds: ['a', 'b'], createdAt: '2026-03-01' },
    ]);
    const readings = readingsFromMaintenanceReports([
      { maintenance: { hours: 1000 }, createdAt: '2026-03-01' },
    ]);

    expect(computeDueState(defA, completions, readings).dueAt).toBe(1500);
    expect(computeDueState(defB, completions, readings).dueAt).toBe(2000);
  });

  it('leaves an interval absent from the card untouched', () => {
    const completions = completionsFromShopReports([
      { servicedAt: 1000, intervalIds: ['a'], createdAt: '2026-03-01' },
    ]);
    const readings = readingsFromMaintenanceReports([
      { maintenance: { hours: 1000 }, createdAt: '2026-03-01' },
    ]);

    expect(computeDueState(defA, completions, readings).dueAt).toBe(1500);
    // B never got a baseline, so it must not silently inherit A's completion.
    expect(computeDueState(defB, completions, readings).status).toBe('no-baseline');
  });

  it('carries the interval length and anchor through for UI previews', () => {
    const state = computeDueState(defA, [], []);
    expect(state.interval).toBe(500);
    expect(state.anchor).toBe('rolling');
  });
});

describe('end to end: the reported bug', () => {
  it('keeps subsequent minors anchored to actual service points', () => {
    const defs = deriveLegacyIntervals(
      { serviceInterval: 500, largeServiceInterval: 2000, serviceNotification: 450 },
      { notificationType: 'heavy' }
    );
    const minorDef = defs[0];

    // Major at 0 starts the cycle, minor performed 10 hours early at 490.
    const completions = completionsFromShopReports([
      { servicedAt: 0, serviceType: 'major', createdAt: '2026-01-01' },
      { servicedAt: 490, serviceType: 'minor', createdAt: '2026-02-01' },
    ]);
    const readings = readingsFromMaintenanceReports([
      { maintenance: { hours: 940 }, createdAt: '2026-03-01' },
    ]);

    const state = computeDueState(minorDef, completions, readings);

    // Legacy behaviour pinned this to 1000 and would already be warning.
    expect(state.dueAt).toBe(990);
    expect(state.notifyAt).toBe(940);
    expect(state.status).toBe('due-soon');
  });
});
