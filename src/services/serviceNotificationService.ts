import { shopHistoryFirebaseService, ShopReport } from './shopHistoryFirebaseService';
import { maintenanceHistoryFirebaseService, MaintenanceReport } from './maintenanceHistoryFirebaseService';
import { equipmentManagementService } from './equipmentManagementService';
import { fleetManagementService } from './fleetManagementService';
import { Equipment } from '../types';

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
}

class ServiceNotificationService {
  async getServiceStatuses(): Promise<ServiceNotificationItem[]> {
    try {
      // Load all equipment from both services
      const [heavyEquipment, fleetEquipment] = await Promise.all([
        equipmentManagementService.getAllEquipment(),
        fleetManagementService.getAllEquipment(),
      ]);
      const allEquipment = [...heavyEquipment, ...fleetEquipment];

      // Load all service reports and maintenance reports
      const [allShopReports, allMaintenanceReports] = await Promise.all([
        shopHistoryFirebaseService.getAllShopHistory(),
        maintenanceHistoryFirebaseService.getAllMaintenanceHistory(),
      ]);

      const notifications: ServiceNotificationItem[] = [];

      for (const equipment of allEquipment) {
        const status = this.calculateStatus(equipment, allShopReports, allMaintenanceReports);
        if (status) {
          notifications.push(status);
        }
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
    maintenanceReports: MaintenanceReport[]
  ): ServiceNotificationItem | null {
    const { serviceInterval, serviceNotification } = equipment;

    // Skip if service interval or notification are not set
    if (!serviceInterval || !serviceNotification) return null;

    // Get latest service report for this equipment (most recent serviced at value)
    const equipmentShopReports = shopReports
      .filter(r => r.equipmentId === equipment.id && r.lastServiceHours != null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (equipmentShopReports.length === 0) return null;

    const servicedAt = equipmentShopReports[0].lastServiceHours!;

    // Get latest maintenance report for this equipment (most recent hours/km)
    const equipmentMaintenanceReports = maintenanceReports
      .filter(r => r.equipmentId === equipment.id && r.maintenance?.hours != null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (equipmentMaintenanceReports.length === 0) return null;

    const currentHours = equipmentMaintenanceReports[0].maintenance.hours!;
    const hoursUntilService = (servicedAt + serviceInterval) - currentHours;

    // Check if service is due (past interval)
    if (currentHours >= servicedAt + serviceInterval) {
      return {
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        status: 'due',
        message: 'Service Due',
        currentHours,
        servicedAt,
        serviceInterval,
        serviceNotification,
        hoursUntilService,
      };
    }

    // Check if notification threshold reached
    if (currentHours >= servicedAt + serviceNotification) {
      return {
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        status: 'schedule',
        message: 'Schedule Service',
        currentHours,
        servicedAt,
        serviceInterval,
        serviceNotification,
        hoursUntilService,
      };
    }

    return null;
  }
}

export const serviceNotificationService = new ServiceNotificationService();
