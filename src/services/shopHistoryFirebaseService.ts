import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';

export interface ShopReport {
  id?: string;
  equipmentId: string;
  equipmentName: string;
  site?: string;
  lastServicedDate?: string;
  lastServiceHours?: number;
  serviceInterval?: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
  createdByRole: string;
}

const SHOP_REPORTS_COLLECTION = 'shopReports';

export const shopHistoryFirebaseService = {
  addShopReport: async (
    equipmentId: string,
    equipmentName: string,
    site: string,
    shopReport: {
      lastServicedDate?: string;
      lastServiceHours?: number;
      serviceInterval?: number;
      notes?: string;
    },
    user: { username: string; role: string }
  ): Promise<string> => {
    try {
      const reportData: Record<string, any> = {
        equipmentId,
        equipmentName,
        createdAt: new Date().toISOString(),
        createdBy: user.username,
        createdByRole: user.role,
      };
      if (site !== undefined) reportData.site = site;
      if (shopReport.lastServicedDate !== undefined) reportData.lastServicedDate = shopReport.lastServicedDate;
      if (shopReport.lastServiceHours !== undefined) reportData.lastServiceHours = shopReport.lastServiceHours;
      if (shopReport.serviceInterval !== undefined) reportData.serviceInterval = shopReport.serviceInterval;
      if (shopReport.notes !== undefined) reportData.notes = shopReport.notes;

      const docRef = await addDoc(collection(db, SHOP_REPORTS_COLLECTION), reportData);
      return docRef.id;
    } catch (error) {
      console.error('Error adding shop report:', error);
      throw error;
    }
  },

  getEquipmentShopHistory: async (equipmentId: string): Promise<ShopReport[]> => {
    try {
      const q = query(
        collection(db, SHOP_REPORTS_COLLECTION),
        where('equipmentId', '==', equipmentId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const reports: ShopReport[] = [];
      
      querySnapshot.forEach((doc) => {
        reports.push({
          id: doc.id,
          ...doc.data(),
        } as ShopReport);
      });

      return reports;
    } catch (error: any) {
      console.error('Error getting shop history:', error);
      
      // If the error is about missing index, try fallback query
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.log('Indexed query failed, trying fallback query...');
        
        try {
          const fallbackQuery = query(collection(db, SHOP_REPORTS_COLLECTION));
          const fallbackSnapshot = await getDocs(fallbackQuery);
          const reports: ShopReport[] = [];
          
          fallbackSnapshot.forEach((doc) => {
            const data = doc.data() as ShopReport;
            if (data.equipmentId === equipmentId) {
              reports.push({
                id: doc.id,
                ...data,
              });
            }
          });

          // Sort by createdAt in descending order
          reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          return reports;
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          throw error;
        }
      }
      
      throw error;
    }
  },

  getAllShopHistory: async (): Promise<ShopReport[]> => {
    try {
      const q = query(
        collection(db, SHOP_REPORTS_COLLECTION),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const reports: ShopReport[] = [];
      
      querySnapshot.forEach((doc) => {
        reports.push({
          id: doc.id,
          ...doc.data(),
        } as ShopReport);
      });

      return reports;
    } catch (error: any) {
      console.error('Error getting all shop history:', error);
      
      // If the error is about missing index, try fallback query
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.log('Indexed query failed, trying fallback query...');
        
        try {
          const fallbackQuery = query(collection(db, SHOP_REPORTS_COLLECTION));
          const fallbackSnapshot = await getDocs(fallbackQuery);
          const reports: ShopReport[] = [];
          
          fallbackSnapshot.forEach((doc) => {
            reports.push({
              id: doc.id,
              ...doc.data(),
            } as ShopReport);
          });

          // Sort by createdAt in descending order
          reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          return reports;
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          throw error;
        }
      }
      
      throw error;
    }
  },

  deleteShopReport: async (reportId: string): Promise<void> => {
    try {
      const reportRef = doc(db, SHOP_REPORTS_COLLECTION, reportId);
      await deleteDoc(reportRef);
    } catch (error) {
      console.error('Failed to delete shop report:', error);
      throw error;
    }
  },
};
