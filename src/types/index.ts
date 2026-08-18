export type ServiceUnit = 'hours' | 'km' | 'days';

export type ServiceAnchor = 'rolling' | 'fixed';

export interface ServiceIntervalDef {
  id: string;
  name: string;
  interval: number;
  unit: ServiceUnit;
  notifyLead: number;
  anchor: ServiceAnchor;
  origin?: number;
  isActive: boolean;
}

export interface ServiceIntervalOverride extends Partial<Omit<ServiceIntervalDef, 'id'>> {
  disabled?: boolean;
}

export interface ResolvedServiceInterval extends ServiceIntervalDef {
  source: 'category' | 'unit';
  isOverridden: boolean;
}

export interface Equipment {
  id: string;
  name: string;
  description?: string;
  employee?: string;
  site?: string;
  category?: string;
  serialNumber?: string;
  year?: string;
  make?: string;
  model?: string;
  equipmentType: 'heavy' | 'field';
  repair: boolean;
  repairDescription?: string;
  serviceInterval?: number;
  largeServiceInterval?: number;
  serviceNotification?: number;
  locationNotes?: string;
  notes?: EquipmentNote[];
  isActive: boolean;
  showInInventory: boolean;
  showInTimecard: boolean;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy?: string;
  createdBy?: string;
  parentId?: string;
  customNotifications?: Array<{ description: string; threshold: number }>;
  serviceIntervals?: ServiceIntervalDef[];
  intervalOverrides?: Record<string, ServiceIntervalOverride>;
}

export interface EquipmentNote {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
  createdByRole: string;
}

export interface EquipmentMaintenance {
  hours?: number;
  lastServicedDate?: string;
  lastServiceHours?: number;
  serviceInterval?: number;
  stepsHandRails?: 'OK' | 'Repair' | 'NA';
  tiresTracks?: 'OK' | 'Repair' | 'NA';
  bucket?: 'OK' | 'Repair' | 'NA';
  cuttingEdgeTeeth?: 'OK' | 'Repair' | 'NA';
  hoses?: 'OK' | 'Repair' | 'NA';
  batteryCableBeltHosesFilterGuards?: 'OK' | 'Repair' | 'NA';
  backupAlarm?: 'OK' | 'Repair' | 'NA';
  fireExtinguisher?: 'OK' | 'Repair' | 'NA';
  gauges?: 'OK' | 'Repair' | 'NA';
  horn?: 'OK' | 'Repair' | 'NA';
  spillKit?: 'OK' | 'Repair' | 'NA';
  glass?: 'OK' | 'Repair' | 'NA';
  mirror?: 'OK' | 'Repair' | 'NA';
  rollOverProtection?: 'OK' | 'Repair' | 'NA';
  seatBeltSeat?: 'OK' | 'Repair' | 'NA';
  allFluidsLevel?: 'OK' | 'Repair' | 'NA';
  serviceNotificationTriggered?: boolean;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  managementGroup?: 'heavy' | 'field' | 'fleet';
  notificationType?: 'fleet' | 'heavy' | 'none';
  maintenanceItems?: string[];
  allocationDefault?: 'site' | 'employee';
  serviceLabels?: string[];
  serviceIntervals?: ServiceIntervalDef[];
}

export interface StockAlert {
  id: string;
  productId: string;
  productName?: string;
  type: 'low_stock' | 'out_of_stock' | 'repair' | 'change';
  message: string;
  createdAt: string;
  userId?: string;
  userName?: string;
}
