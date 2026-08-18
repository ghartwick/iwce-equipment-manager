import { Category, Equipment, ServiceIntervalDef } from '../types';
import {
  ServiceCompletion,
  ServiceDueState,
  ServiceReading,
  computeDueState,
  resolveIntervalsForUnit,
} from './serviceScheduleService';

// Stable ids for the intervals derived from the legacy
// serviceInterval / largeServiceInterval fields. Existing shop reports are
// backfilled onto these so no service history is orphaned.
export const LEGACY_SINGLE_ID = 'legacy-service';
export const LEGACY_MINOR_ID = 'legacy-minor';
export const LEGACY_MAJOR_ID = 'legacy-major';

// Structural shapes only, so this module stays free of Firebase imports and
// remains unit-testable.
export interface LegacyShopReportLike {
  servicedAt?: number;
  serviceType?: 'minor' | 'major';
  intervalIds?: string[];
  createdAt: string;
  lastServicedDate?: string;
}

export interface LegacyMaintenanceReportLike {
  maintenance?: { hours?: number };
  createdAt: string;
  readingVoided?: boolean;
}

type LegacyEquipment = Pick<
  Equipment,
  'serviceInterval' | 'largeServiceInterval' | 'serviceNotification'
>;

// The old model stored the notification as an offset measured forward from the
// last service. The new model stores it as a lead measured back from the due
// point, so the two are complements of each other within one interval.
function leadFromLegacyNotification(interval: number, notification?: number): number {
  if (!notification || notification <= 0) return 0;
  return Math.max(0, interval - notification);
}

/**
 * Builds interval definitions equivalent to a unit's legacy configuration.
 * Heavy units with a large interval yield a minor plus a major definition;
 * everything else yields a single service definition.
 *
 * Both use the 'rolling' anchor, which matches the legacy behaviour for majors
 * and fixes it for minors.
 */
export function deriveLegacyIntervals(
  equipment: LegacyEquipment,
  category?: Pick<Category, 'notificationType' | 'serviceLabels'> | null
): ServiceIntervalDef[] {
  const { serviceInterval, largeServiceInterval, serviceNotification } = equipment;
  const isHeavy = category?.notificationType === 'heavy' && !!largeServiceInterval;

  if (isHeavy && serviceInterval) {
    return [
      {
        id: LEGACY_MINOR_ID,
        name: category?.serviceLabels?.[0] || 'Minor Service',
        interval: serviceInterval,
        unit: 'hours',
        notifyLead: leadFromLegacyNotification(serviceInterval, serviceNotification),
        anchor: 'rolling',
        isActive: true,
      },
      {
        id: LEGACY_MAJOR_ID,
        name: 'Major Service',
        interval: largeServiceInterval!,
        unit: 'hours',
        notifyLead: leadFromLegacyNotification(serviceInterval, serviceNotification),
        anchor: 'rolling',
        isActive: true,
      },
    ];
  }

  if (serviceInterval) {
    return [
      {
        id: LEGACY_SINGLE_ID,
        name: 'Service',
        interval: serviceInterval,
        unit: 'hours',
        notifyLead: leadFromLegacyNotification(serviceInterval, serviceNotification),
        anchor: 'rolling',
        isActive: true,
      },
    ];
  }

  return [];
}

/**
 * Converts shop reports into per-interval completions. Reports already tagged
 * with intervalIds fan out to each id; untagged legacy reports fall back to the
 * derived legacy interval ids based on their serviceType.
 */
export function completionsFromShopReports(reports: LegacyShopReportLike[]): ServiceCompletion[] {
  const completions: ServiceCompletion[] = [];

  for (const report of reports) {
    if (report.servicedAt == null) continue;
    const date = report.lastServicedDate || report.createdAt;

    if (report.intervalIds && report.intervalIds.length > 0) {
      for (const intervalId of report.intervalIds) {
        completions.push({ intervalId, at: report.servicedAt, date });
      }
      continue;
    }

    const legacyId =
      report.serviceType === 'major'
        ? LEGACY_MAJOR_ID
        : report.serviceType === 'minor'
          ? LEGACY_MINOR_ID
          : LEGACY_SINGLE_ID;
    completions.push({ intervalId: legacyId, at: report.servicedAt, date });
  }

  return completions;
}

// Inspection cards are the source of meter readings.
export function readingsFromMaintenanceReports(
  reports: LegacyMaintenanceReportLike[]
): ServiceReading[] {
  return reports
    .filter(r => r.maintenance?.hours != null)
    .map(r => ({ value: r.maintenance!.hours!, date: r.createdAt, voided: r.readingVoided }));
}

/**
 * Effective interval definitions for a unit, falling back to the legacy
 * configuration when nothing has been migrated yet. This is what lets existing
 * units display correctly without anyone running a migration first.
 */
export function effectiveIntervalsForUnit(
  equipment: Equipment,
  category?: Category | null
): ServiceIntervalDef[] {
  const resolved = resolveIntervalsForUnit(equipment, category);
  if (resolved.length > 0) return resolved;
  return deriveLegacyIntervals(equipment, category);
}

/**
 * Single entry point for turning a unit's stored data into per-interval due
 * state. Every page uses this so the four previously duplicated schedule
 * calculations cannot drift apart again.
 *
 * `shopReports` and `maintenanceReports` must already be filtered to this unit.
 */
export function computeUnitSchedule(
  equipment: Equipment,
  category: Category | null | undefined,
  shopReports: LegacyShopReportLike[],
  maintenanceReports: LegacyMaintenanceReportLike[],
  now: Date = new Date()
): ServiceDueState[] {
  const defs = effectiveIntervalsForUnit(equipment, category);
  if (defs.length === 0) return [];
  const completions = completionsFromShopReports(shopReports);
  const readings = readingsFromMaintenanceReports(maintenanceReports);
  return defs.map(def => computeDueState(def, completions, readings, now));
}
