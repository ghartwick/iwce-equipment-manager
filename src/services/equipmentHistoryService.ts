import { Equipment } from '../types';

export interface EditHistory {
  id: string;
  equipmentId: string;
  equipmentName: string;
  action: 'created' | 'updated' | 'deleted';
  timestamp: Date;
  user: string;
  userRole: string;
  changes?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

class EquipmentHistoryService {
  private static instance: EquipmentHistoryService;
  private history: EditHistory[] = [];

  static getInstance(): EquipmentHistoryService {
    if (!EquipmentHistoryService.instance) {
      EquipmentHistoryService.instance = new EquipmentHistoryService();
    }
    return EquipmentHistoryService.instance;
  }

  // Add history entry
  addHistory(entry: Omit<EditHistory, 'id' | 'timestamp'>): void {
    const historyEntry: EditHistory = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    this.history.unshift(historyEntry); // Add to beginning (most recent first)
  }

  // Get history for specific equipment
  getEquipmentHistory(equipmentId: string): EditHistory[] {
    return this.history.filter(entry => entry.equipmentId === equipmentId);
  }

  // Get all history
  getAllHistory(): EditHistory[] {
    return this.history;
  }

  // Clear all history (for testing)
  clearHistory(): void {
    this.history = [];
  }

  // Track equipment changes
  trackEquipmentChange(
    action: 'created' | 'updated' | 'deleted',
    equipment: Equipment,
    user: { username: string; role: string },
    oldEquipment?: Equipment
  ): void {
    const changes: { field: string; oldValue: string; newValue: string }[] = [];

    if (action === 'updated' && oldEquipment) {
      // For restricted fields (name, serialNumber, category), only include if changed
      const restrictedFields = ['name', 'serialNumber', 'category'];
      const otherFields = ['employee', 'site', 'repairDescription']; // Removed 'repair'
      
      // Check restricted fields - only include if actually changed
      restrictedFields.forEach(field => {
        const oldValue = oldEquipment[field as keyof Equipment] as string;
        const newValue = equipment[field as keyof Equipment] as string;
        
        if (oldValue !== newValue && newValue && newValue.toString().trim() !== '') {
          changes.push({
            field,
            oldValue: oldValue || '(empty)',
            newValue: newValue
          });
        }
      });
      
      // For other fields, include all completed fields
      otherFields.forEach(field => {
        const newValue = equipment[field as keyof Equipment];
        
        // For string fields, include if they have a value (completed)
        if (newValue != null && String(newValue).trim() !== '') {
          const oldValue = oldEquipment[field as keyof Equipment];
          changes.push({
            field,
            oldValue: oldValue != null ? String(oldValue) : '(empty)',
            newValue: String(newValue)
          });
        }
      });
    } else if (action === 'created') {
      // For created equipment, show all initial values
      const fieldsToTrack = ['name', 'serialNumber', 'category', 'employee', 'site', 'repairDescription']; // Removed 'repair'
      
      fieldsToTrack.forEach(field => {
        const value = equipment[field as keyof Equipment];
        
        // For string fields, include if they have a value (completed)
        if (value != null && String(value).trim() !== '') {
          changes.push({
            field,
            oldValue: '(empty)',
            newValue: String(value)
          });
        }
      });
    }

    this.addHistory({
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      action,
      user: user.username,
      userRole: user.role,
      changes: changes.length > 0 ? changes : undefined
    });
  }
}

export const equipmentHistoryService = EquipmentHistoryService.getInstance();
