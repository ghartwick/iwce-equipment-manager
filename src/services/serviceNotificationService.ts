import { shopHistoryFirebaseService } from './shopHistoryFirebaseService';
import { maintenanceHistoryFirebaseService, MaintenanceReport } from './maintenanceHistoryFirebaseService';
import { equipmentManagementService } from './equipmentManagementService';
import { fleetManagementService } from './fleetManagementService';
import { getCategories } from './firebaseService';
import { computeUnitSchedule } from './serviceScheduleMigration';
import { ServiceDueState, dateFromDayNumber } from './serviceScheduleService';
import { Equipment, ServiceUnit } from '../types';

export type ServiceStatus = 'ok' | 'schedule' | 'due';

// One item per (unit, interval). A unit with four intervals now produces four
// independent notifications rather than a single blended one.
export interface ServiceNotificationItem {
  equipmentId: string;
  equipmentName: string;
  isFleet: boolean;
  intervalId: string;
  intervalName: string;
  status: ServiceStatus;
  message: string;
  unit: ServiceUnit;
  current: number;
  dueAt: number | null;
  remaining: number | null;
  progressPct: number;
  isCustom?: boolean;
  // Full engine output, so list views can render bars without recomputing.
  state?: ServiceDueState;
}

const STATUS_RANK: Record<ServiceStatus, number> = { due: 0, schedule: 1, ok: 2 };

// Day-based intervals carry day numbers, so they read as dates rather than meters.
function formatTarget(state: ServiceDueState): string {
  if (state.dueAt == null) return 'unscheduled';
  if (state.unit === 'days') return dateFromDayNumber(state.dueAt).toLocaleDateString();
  const suffix = state.unit === 'km' ? 'km' : 'hr';
  return `${state.dueAt.toLocaleString()} ${suffix}`;
}

// Stable React key, since equipmentId alone is no longer unique.
export function notificationKey(item: ServiceNotificationItem): string {
  return `${item.equipmentId}:${item.intervalId}`;
}

// Worst status per unit, for list views that only have room for one summary.
export function mostUrgentPerEquipment(
  items: ServiceNotificationItem[]
): Record<string, ServiceNotificationItem> {
  const byEquipment: Record<string, ServiceNotificationItem> = {};
  for (const item of items) {
    const existing = byEquipment[item.equipmentId];
    if (!existing) {
      byEquipment[item.equipmentId] = item;
      continue;
    }
    const rank = STATUS_RANK[item.status] - STATUS_RANK[existing.status];
    if (rank < 0) {
      byEquipment[item.equipmentId] = item;
    } else if (rank === 0) {
      const a = item.remaining ?? Number.POSITIVE_INFINITY;
      const b = existing.remaining ?? Number.POSITIVE_INFINITY;
      if (a < b) byEquipment[item.equipmentId] = item;
    }
  }
  return byEquipment;
}

// The engine also emits healthy intervals so list views can draw bars. Alert
// surfaces only want the ones needing action, most urgent first.
export function actionableNotifications(
  items: ServiceNotificationItem[]
): ServiceNotificationItem[] {
  return items
    .filter(item => item.status !== 'ok')
    .sort((a, b) => {
      const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (rank !== 0) return rank;
      const left = a.remaining ?? Number.POSITIVE_INFINITY;
      const right = b.remaining ?? Number.POSITIVE_INFINITY;
      return left - right;
    });
}

function groupByEquipment<T extends { equipmentId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.equipmentId);
    if (list) list.push(row);
    else map.set(row.equipmentId, [row]);
  }
  return map;
}

class ServiceNotificationService {
  async getServiceStatuses(): Promise<ServiceNotificationItem[]> {
    try {
      const [heavyEquipment, fleetEquipment, categories] = await Promise.all([
        equipmentManagementService.getAllEquipment(),
        fleetManagementService.getAllEquipment(),
        getCategories(),
      ]);

      const [allShopReports, allMaintenanceReports] = await Promise.all([
        shopHistoryFirebaseService.getAllShopHistory(),
        maintenanceHistoryFirebaseService.getAllMaintenanceHistory(),
      ]);

      // Grouped up front so each unit is a map lookup instead of a full scan.
      const shopByEquipment = groupByEquipment(allShopReports);
      const maintenanceByEquipment = groupByEquipment(allMaintenanceReports);

      const notifications: ServiceNotificationItem[] = [];

      const addFor = (equipment: Equipment, isFleet: boolean) => {
        const cat = categories.find(c => c.id === equipment.category);
        const states = computeUnitSchedule(
          equipment,
          cat ?? null,
          shopByEquipment.get(equipment.id) ?? [],
          maintenanceByEquipment.get(equipment.id) ?? []
        );
        for (const state of states) {
          const item = this.toNotification(equipment, state, isFleet);
          if (item) notifications.push(item);
        }
        notifications.push(
          ...this.calculateCustomStatuses(equipment, allMaintenanceReports, isFleet)
        );
      };

      for (const equipment of heavyEquipment) addFor(equipment, false);
      for (const equipment of fleetEquipment) addFor(equipment, true);

      return notifications;
    } catch (error) {
      console.error('Error calculating service notifications:', error);
      return [];
    }
  }

  // Maps one interval's due state onto a notification. 'ok' and 'no-baseline'
  // states still surface so list views can draw a bar, but only due/schedule
  // states carry a message.
  private toNotification(
    equipment: Equipment,
    state: ServiceDueState,
    isFleet: boolean
  ): ServiceNotificationItem | null {
    if (state.status === 'no-baseline') return null;

    let status: ServiceStatus = 'ok';
    if (state.status === 'overdue') status = 'due';
    else if (state.status === 'due-soon') status = 'schedule';

    return {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      isFleet,
      intervalId: state.intervalId,
      intervalName: state.name,
      status,
      message: this.messageFor(state, status),
      unit: state.unit,
      current: state.current,
      dueAt: state.dueAt,
      remaining: state.remaining,
      progressPct: state.progressPct,
      state,
    };
  }

  private messageFor(state: ServiceDueState, status: ServiceStatus): string {
    if (status === 'ok') return '';
    if (status === 'due') return `${state.name} Due`;
    return `Schedule ${state.name} (${formatTarget(state)})`;
  }

  calculateCustomStatuses(
    equipment: Equipment,
    maintenanceReports: MaintenanceReport[],
    isFleet: boolean
  ): ServiceNotificationItem[] {
    const customNotifications = equipment.customNotifications;
    if (!customNotifications || customNotifications.length === 0) return [];

    const equipmentReports = maintenanceReports
      .filter(r => r.equipmentId === equipment.id && r.maintenance?.hours != null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (equipmentReports.length === 0) return [];

    const currentHours = equipmentReports[0].maintenance.hours!;

    return customNotifications
      .filter(cn => currentHours >= cn.threshold)
      .map(cn => ({
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        isFleet,
        intervalId: `custom-${cn.threshold}-${cn.description}`,
        intervalName: cn.description,
        status: 'due' as ServiceStatus,
        message: cn.description,
        unit: 'hours' as ServiceUnit,
        current: currentHours,
        dueAt: cn.threshold,
        remaining: cn.threshold - currentHours,
        progressPct: 100,
        isCustom: true,
      }));
  }
}

export const serviceNotificationService = new ServiceNotificationService();
