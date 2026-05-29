export interface MaintenanceCategory {
  key: string;
  label: string;
}

export const DEFAULT_MAINTENANCE_CATEGORIES: MaintenanceCategory[] = [
  { key: 'stepsHandRails', label: 'Steps/Hand Rails' },
  { key: 'tiresTracks', label: 'Tires/Tracks' },
  { key: 'bucket', label: 'Bucket' },
  { key: 'cuttingEdgeTeeth', label: 'Cutting Edge/Teeth' },
  { key: 'hoses', label: 'Hoses' },
  { key: 'batteryCableBeltHosesFilterGuards', label: 'Battery Cable, Belt, Hoses, Filter, Guards' },
  { key: 'backupAlarm', label: 'Backup Alarm' },
  { key: 'fireExtinguisher', label: 'Fire Extinguisher' },
  { key: 'gauges', label: 'Gauges' },
  { key: 'horn', label: 'Horn' },
  { key: 'spillKit', label: 'Spill Kit' },
  { key: 'glass', label: 'Glass (all sides)' },
  { key: 'mirror', label: 'Mirror' },
  { key: 'rollOverProtection', label: 'Roll Over Protection' },
  { key: 'seatBeltSeat', label: 'Seat Belt/Seat' },
  { key: 'allFluidsLevel', label: 'All Fluids Level' },
];

class MaintenanceCategoriesService {
  getCategories(categoryMaintenanceItems?: string[]): MaintenanceCategory[] {
    if (!categoryMaintenanceItems || categoryMaintenanceItems.length === 0) {
      return [];
    }

    return categoryMaintenanceItems.map(itemKey => {
      // Check if it's a custom item (starts with "custom:")
      if (itemKey.startsWith('custom:')) {
        return { key: itemKey, label: itemKey.slice(7) };
      }
      // Find in default categories
      const defaultItem = DEFAULT_MAINTENANCE_CATEGORIES.find(c => c.key === itemKey);
      if (defaultItem) {
        return defaultItem;
      }
      // Fallback for unknown keys - use the key as the label
      return { key: itemKey, label: itemKey };
    });
  }
}

export const maintenanceCategoriesService = new MaintenanceCategoriesService();
