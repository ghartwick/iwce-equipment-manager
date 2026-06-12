import { shopHistoryFirebaseService, ShopReport } from './shopHistoryFirebaseService';
import { maintenanceHistoryFirebaseService, MaintenanceReport } from './maintenanceHistoryFirebaseService';
import { equipmentManagementService } from './equipmentManagementService';
import { fleetManagementService } from './fleetManagementService';
import { getCategories } from './firebaseService';
import { Equipment, Category } from '../types';

export type ServiceStatus = 'ok' | 'schedule' | 'due';

export interface ServiceNotificationItem {
  equipmentId: string;
  equipmentName: string;
  status: ServiceStatus;
  message: string;
  currentHours: number;
  servicedAt: number;
  serviceInterval: number;
  serviceNotification: number;
  hoursUntilService: number;
  isFleet: boolean;
  isCustom?: boolean;
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

      const notifications: ServiceNotificationItem[] = [];

      for (const equipment of heavyEquipment) {
        const cat = categories.find(c => c.id === equipment.category);
        const status = this.calculateStatus(equipment, allShopReports, allMaintenanceReports, false, cat);
        if (status) notifications.push(status);
        const custom = this.calculateCustomStatuses(equipment, allMaintenanceReports, false, cat);
        notifications.push(...custom);
      }

      for (const equipment of fleetEquipment) {
        const cat = categories.find(c => c.id === equipment.category);
        const status = this.calculateStatus(equipment, allShopReports, allMaintenanceReports, true, cat);
        if (status) notifications.push(status);
        const custom = this.calculateCustomStatuses(equipment, allMaintenanceReports, true, cat);
        notifications.push(...custom);
      }

      return notifications;
    } catch (error) {
      console.error('Error calculating service notifications:', error);
      return [];
    }
  }

  calculateStatus(
    equipment: Equipment,
    shopReports: ShopReport[],
    maintenanceReports: MaintenanceReport[],
    isFleet: boolean,
    category?: Category
  ): ServiceNotificationItem | null {
    const { serviceInterval, serviceNotification, largeServiceInterval } = equipment;
    if (!serviceInterval || !serviceNotification) return null;

    const isHeavy = category?.notificationType === 'heavy' && !!largeServiceInterval;

    // For heavy: baseline is the latest MAJOR service card. For fleet: latest any card.
    const equipmentShopReports = shopReports
      .filter(r => {
        if (r.equipmentId !== equipment.id) return false;
        if (isHeavy) return r.serviceType === 'major' && r.servicedAt != null;
        return r.servicedAt != null || r.lastServiceHours != null;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (equipmentShopReports.length === 0) return null;

    const latest = equipmentShopReports[0];
    const servicedAt = latest.servicedAt
      ?? (latest.lastServiceHours != null ? latest.lastServiceHours - (latest.serviceInterval || serviceInterval) : null);
    if (servicedAt == null) return null;

    const equipmentMaintenanceReports = maintenanceReports
      .filter(r => r.equipmentId === equipment.id && r.maintenance?.hours != null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (equipmentMaintenanceReports.length === 0) return null;

    const currentHours = equipmentMaintenanceReports[0].maintenance.hours!;

    if (isHeavy) {
      // Heavy mode: repeating sub-intervals within the major cycle
      const cycleEnd = servicedAt + largeServiceInterval!;

      // Service is due if we have passed the full major interval
      if (currentHours >= cycleEnd) {
        return {
          equipmentId: equipment.id, equipmentName: equipment.name,
          status: 'due', message: 'Major Service Due',
          currentHours, servicedAt, serviceInterval, serviceNotification,
          hoursUntilService: cycleEnd - currentHours, isFleet,
        };
      }

      // Find which sub-interval we are currently in
      const subIndex = Math.floor((currentHours - servicedAt) / serviceInterval);
      const subStart = servicedAt + subIndex * serviceInterval;
      const notifThreshold = subStart + serviceNotification;

      if (currentHours >= notifThreshold) {
        const nextMinor = subStart + serviceInterval;
        return {
          equipmentId: equipment.id, equipmentName: equipment.name,
          status: 'schedule',
          message: `Schedule Service (${nextMinor.toLocaleString()} hr service)`,
          currentHours, servicedAt, serviceInterval, serviceNotification,
          hoursUntilService: nextMinor - currentHours, isFleet,
        };
      }

      // OK state — still return bar data
      const nextMinorForOk = servicedAt + (Math.floor((currentHours - servicedAt) / serviceInterval) + 1) * serviceInterval;
      return {
        equipmentId: equipment.id, equipmentName: equipment.name,
        status: 'ok', message: '',
        currentHours, servicedAt, serviceInterval, serviceNotification,
        hoursUntilService: nextMinorForOk - currentHours, isFleet,
      };
    }

    // Fleet mode (original logic)
    const hoursUntilService = (servicedAt + serviceInterval) - currentHours;

    if (currentHours >= servicedAt + serviceInterval) {
      return {
        equipmentId: equipment.id, equipmentName: equipment.name,
        status: 'due', message: 'Service Due',
        currentHours, servicedAt, serviceInterval, serviceNotification,
        hoursUntilService, isFleet,
      };
    }

    if (currentHours >= servicedAt + serviceNotification) {
      return {
        equipmentId: equipment.id, equipmentName: equipment.name,
        status: 'schedule', message: 'Schedule Service',
        currentHours, servicedAt, serviceInterval, serviceNotification,
        hoursUntilService, isFleet,
      };
    }

    // OK state — still return bar data
    return {
      equipmentId: equipment.id, equipmentName: equipment.name,
      status: 'ok', message: '',
      currentHours, servicedAt, serviceInterval, serviceNotification,
      hoursUntilService, isFleet,
    };
  }

  calculateCustomStatuses(
    equipment: Equipment,
    maintenanceReports: MaintenanceReport[],
    isFleet: boolean,
    _category?: Category
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
        status: 'due' as ServiceStatus,
        message: cn.description,
        currentHours,
        servicedAt: 0,
        serviceInterval: 0,
        serviceNotification: cn.threshold,
        hoursUntilService: 0,
        isFleet,
        isCustom: true,
      }));
  }
}

export const serviceNotificationService = new ServiceNotificationService();
