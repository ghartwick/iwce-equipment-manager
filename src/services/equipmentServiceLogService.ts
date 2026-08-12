import { collection, addDoc, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type ServiceLogEventType =
  | 'maintenance_flag'
  | 'maintenance_note'
  | 'service_card'
  | 'repair_resolved';

export interface ServiceLogEntry {
  id?: string;
  equipmentId: string;
  equipmentName: string;
  type: ServiceLogEventType;
  description: string;
  createdAt: string;
  createdBy: string;
  createdByRole: string;
  linkedReportId?: string;
  linkedReportType?: 'maintenance' | 'shop';
}

const COLLECTION_NAME = 'equipmentServiceLog';

class EquipmentServiceLogService {
  async addEntry(entry: Omit<ServiceLogEntry, 'id'>): Promise<void> {
    try {
      const payload: Record<string, unknown> = {
        equipmentId: entry.equipmentId,
        equipmentName: entry.equipmentName,
        type: entry.type,
        description: entry.description,
        createdAt: entry.createdAt,
        createdBy: entry.createdBy,
        createdByRole: entry.createdByRole,
        timestamp: Timestamp.fromDate(new Date(entry.createdAt)),
      };
      if (entry.linkedReportId) payload.linkedReportId = entry.linkedReportId;
      if (entry.linkedReportType) payload.linkedReportType = entry.linkedReportType;

      await addDoc(collection(db, COLLECTION_NAME), payload);
    } catch (error) {
      console.error('Failed to write equipment service log entry:', error);
    }
  }

  async getEquipmentLog(equipmentId: string): Promise<ServiceLogEntry[]> {
    try {
      const logCollection = collection(db, COLLECTION_NAME);
      const toEntry = (id: string, data: any): ServiceLogEntry => ({
        id,
        equipmentId: data.equipmentId,
        equipmentName: data.equipmentName,
        type: data.type,
        description: data.description,
        createdAt: data.createdAt,
        createdBy: data.createdBy,
        createdByRole: data.createdByRole,
        linkedReportId: data.linkedReportId,
        linkedReportType: data.linkedReportType,
      });

      try {
        const snapshot = await getDocs(
          query(logCollection, where('equipmentId', '==', equipmentId), orderBy('timestamp', 'desc'))
        );
        return snapshot.docs.map(d => toEntry(d.id, d.data()));
      } catch {
        // Missing composite index — fall back to client-side filter/sort.
        const snapshot = await getDocs(logCollection);
        return snapshot.docs
          .map(d => toEntry(d.id, d.data()))
          .filter(e => e.equipmentId === equipmentId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    } catch (error) {
      console.error('Failed to load equipment service log:', error);
      return [];
    }
  }
}

export const equipmentServiceLogService = new EquipmentServiceLogService();
