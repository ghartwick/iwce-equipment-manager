import { collection, addDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { EquipmentMaintenance } from '../types';

export interface Attachment {
  fileName: string;
  fileUrl: string;
  filePath: string;
}

export interface MaintenanceReport {
  id: string;
  equipmentId: string;
  equipmentName: string;
  maintenance: EquipmentMaintenance;
  attachments?: Attachment[];
  createdAt: string;
  createdBy: string;
  createdByRole: string;
}

class MaintenanceHistoryFirebaseService {
  private static instance: MaintenanceHistoryFirebaseService;
  private readonly COLLECTION_NAME = 'maintenanceHistory';

  static getInstance(): MaintenanceHistoryFirebaseService {
    if (!MaintenanceHistoryFirebaseService.instance) {
      MaintenanceHistoryFirebaseService.instance = new MaintenanceHistoryFirebaseService();
    }
    return MaintenanceHistoryFirebaseService.instance;
  }

  // Add maintenance report to Firebase
  async addMaintenanceReport(
    equipmentId: string,
    equipmentName: string,
    maintenance: EquipmentMaintenance,
    user: { username: string; role: string }
  ): Promise<string> {
    try {
      const historyCollection = collection(db, this.COLLECTION_NAME);
      const docRef = await addDoc(historyCollection, {
        equipmentId,
        equipmentName,
        maintenance,
        createdAt: Timestamp.fromDate(new Date()),
        createdBy: user.username,
        createdByRole: user.role
      });
      return docRef.id;
    } catch (error) {
      console.error('Failed to save maintenance report to Firebase:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      throw error;
    }
  }

  // Get maintenance reports for specific equipment from Firebase
  async getEquipmentMaintenanceHistory(equipmentId: string): Promise<MaintenanceReport[]> {
    try {
      const historyCollection = collection(db, this.COLLECTION_NAME);
      
      let q = query(
        historyCollection,
        where('equipmentId', '==', equipmentId),
        orderBy('createdAt', 'desc')
      );
      
      try {
        const querySnapshot = await getDocs(q);
        const history = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            equipmentId: data.equipmentId,
            equipmentName: data.equipmentName,
            maintenance: data.maintenance,
            createdAt: data.createdAt.toDate().toISOString(),
            createdBy: data.createdBy,
            createdByRole: data.createdByRole
          };
        });
        
        return history;
        
      } catch (indexError) {
        console.log('Indexed query failed, trying fallback query...');
        
        const fallbackQuery = query(historyCollection);
        const fallbackSnapshot = await getDocs(fallbackQuery);
        
        const allHistory = fallbackSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            equipmentId: data.equipmentId,
            equipmentName: data.equipmentName,
            maintenance: data.maintenance,
            createdAt: data.createdAt.toDate().toISOString(),
            createdBy: data.createdBy,
            createdByRole: data.createdByRole
          };
        });
        
        const filteredHistory = allHistory
          .filter(item => item.equipmentId === equipmentId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        return filteredHistory;
      }
      
    } catch (error) {
      console.error('Failed to retrieve maintenance history from Firebase:', error);
      return [];
    }
  }

  // Get all maintenance reports from Firebase
  async getAllMaintenanceHistory(): Promise<MaintenanceReport[]> {
    try {
      const historyCollection = collection(db, this.COLLECTION_NAME);
      const q = query(historyCollection, orderBy('createdAt', 'desc'));
      
      const querySnapshot = await getDocs(q);
      const history = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          equipmentId: data.equipmentId,
          equipmentName: data.equipmentName,
          maintenance: data.maintenance,
          createdAt: data.createdAt.toDate().toISOString(),
          createdBy: data.createdBy,
          createdByRole: data.createdByRole
        };
      }) as MaintenanceReport[];

      return history;
    } catch (error) {
      console.error('Failed to retrieve all maintenance history from Firebase:', error);
      return [];
    }
  }
}

export const maintenanceHistoryFirebaseService = MaintenanceHistoryFirebaseService.getInstance();
