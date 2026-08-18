import { describe, it, expect } from 'vitest';
import {
  ServiceNotificationItem,
  ServiceStatus,
  notificationKey,
  mostUrgentPerEquipment,
  actionableNotifications,
  serviceNotificationService,
} from './serviceNotificationService';
import { Equipment } from '../types';
import { MaintenanceReport } from './maintenanceHistoryFirebaseService';

function item(
  overrides: Partial<ServiceNotificationItem> & { intervalId: string; status: ServiceStatus }
): ServiceNotificationItem {
  return {
    equipmentId: 'eq1',
    equipmentName: 'Unit 1',
    isFleet: false,
    intervalName: overrides.intervalId,
    message: '',
    unit: 'hours',
    current: 100,
    dueAt: 500,
    remaining: 400,
    progressPct: 20,
    ...overrides,
  };
}

describe('notificationKey', () => {
  it('distinguishes intervals on the same unit', () => {
    const a = item({ intervalId: 'i1', status: 'ok' });
    const b = item({ intervalId: 'i2', status: 'ok' });
    expect(notificationKey(a)).toBe('eq1:i1');
    expect(notificationKey(b)).toBe('eq1:i2');
    expect(notificationKey(a)).not.toBe(notificationKey(b));
  });
});

describe('mostUrgentPerEquipment', () => {
  it('prefers due over schedule over ok', () => {
    const result = mostUrgentPerEquipment([
      item({ intervalId: 'ok', status: 'ok' }),
      item({ intervalId: 'soon', status: 'schedule' }),
      item({ intervalId: 'now', status: 'due' }),
    ]);
    expect(result.eq1.intervalId).toBe('now');
  });

  it('breaks status ties with the smallest remaining', () => {
    const result = mostUrgentPerEquipment([
      item({ intervalId: 'far', status: 'schedule', remaining: 90 }),
      item({ intervalId: 'near', status: 'schedule', remaining: 10 }),
    ]);
    expect(result.eq1.intervalId).toBe('near');
  });

  it('treats a null remaining as least urgent within a status', () => {
    const result = mostUrgentPerEquipment([
      item({ intervalId: 'unscheduled', status: 'schedule', remaining: null }),
      item({ intervalId: 'measured', status: 'schedule', remaining: 1000 }),
    ]);
    expect(result.eq1.intervalId).toBe('measured');
  });

  it('keys each unit separately', () => {
    const result = mostUrgentPerEquipment([
      item({ intervalId: 'a', status: 'due' }),
      item({ equipmentId: 'eq2', intervalId: 'b', status: 'schedule' }),
    ]);
    expect(result.eq1.intervalId).toBe('a');
    expect(result.eq2.intervalId).toBe('b');
  });

  it('returns an empty map for no items', () => {
    expect(mostUrgentPerEquipment([])).toEqual({});
  });
});

describe('actionableNotifications', () => {
  it('drops healthy intervals', () => {
    const result = actionableNotifications([
      item({ intervalId: 'healthy', status: 'ok' }),
      item({ intervalId: 'soon', status: 'schedule' }),
    ]);
    expect(result.map(r => r.intervalId)).toEqual(['soon']);
  });

  it('sorts due before schedule, then by remaining', () => {
    const result = actionableNotifications([
      item({ intervalId: 'soon-far', status: 'schedule', remaining: 200 }),
      item({ intervalId: 'due-far', status: 'due', remaining: -5 }),
      item({ intervalId: 'soon-near', status: 'schedule', remaining: 20 }),
      item({ intervalId: 'due-near', status: 'due', remaining: -300 }),
    ]);
    expect(result.map(r => r.intervalId)).toEqual([
      'due-near',
      'due-far',
      'soon-near',
      'soon-far',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [
      item({ intervalId: 'soon', status: 'schedule' }),
      item({ intervalId: 'now', status: 'due' }),
    ];
    actionableNotifications(input);
    expect(input.map(r => r.intervalId)).toEqual(['soon', 'now']);
  });
});

describe('calculateCustomStatuses', () => {
  const equipment = {
    id: 'eq1',
    name: 'Unit 1',
    customNotifications: [
      { description: 'Replace brake pads', threshold: 1000 },
      { description: 'Rotate tires', threshold: 5000 },
    ],
  } as Equipment;

  const reading = (hours: number, createdAt: string): MaintenanceReport =>
    ({
      equipmentId: 'eq1',
      createdAt,
      maintenance: { hours },
    } as MaintenanceReport);

  it('returns only thresholds the latest reading has reached', () => {
    const result = serviceNotificationService.calculateCustomStatuses(
      equipment,
      [reading(1200, '2026-01-02T00:00:00Z')],
      false
    );
    expect(result).toHaveLength(1);
    expect(result[0].intervalName).toBe('Replace brake pads');
    expect(result[0].status).toBe('due');
    expect(result[0].isCustom).toBe(true);
    expect(result[0].remaining).toBe(-200);
  });

  it('uses the newest reading rather than the first in the list', () => {
    const result = serviceNotificationService.calculateCustomStatuses(
      equipment,
      [reading(900, '2026-01-01T00:00:00Z'), reading(6000, '2026-02-01T00:00:00Z')],
      false
    );
    expect(result.map(r => r.intervalName)).toEqual([
      'Replace brake pads',
      'Rotate tires',
    ]);
    expect(result[0].current).toBe(6000);
  });

  it('ignores readings for other units', () => {
    const other = { ...reading(9000, '2026-03-01T00:00:00Z'), equipmentId: 'eq2' };
    const result = serviceNotificationService.calculateCustomStatuses(
      equipment,
      [other],
      false
    );
    expect(result).toEqual([]);
  });

  it('returns nothing when the unit has no custom notifications', () => {
    const bare = { id: 'eq1', name: 'Unit 1' } as Equipment;
    const result = serviceNotificationService.calculateCustomStatuses(
      bare,
      [reading(9000, '2026-03-01T00:00:00Z')],
      false
    );
    expect(result).toEqual([]);
  });

  it('produces keys that stay unique against interval notifications', () => {
    const result = serviceNotificationService.calculateCustomStatuses(
      equipment,
      [reading(6000, '2026-02-01T00:00:00Z')],
      false
    );
    const keys = result.map(notificationKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
