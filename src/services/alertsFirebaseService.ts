import { collection, addDoc, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { StockAlert } from '../types';

const COLLECTION_NAME = 'alerts';

export class AlertsFirebaseService {
  private static instance: AlertsFirebaseService;

  private constructor() {}

  static getInstance(): AlertsFirebaseService {
    if (!AlertsFirebaseService.instance) {
      AlertsFirebaseService.instance = new AlertsFirebaseService();
    }
    return AlertsFirebaseService.instance;
  }

  async addAlert(alert: Omit<StockAlert, 'id'>): Promise<string> {
    try {
      const alertsCollection = collection(db, COLLECTION_NAME);
      const docRef = await addDoc(alertsCollection, {
        ...alert,
        createdAt: Timestamp.fromDate(new Date(alert.createdAt))
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding alert to Firebase:', error);
      throw new Error('Failed to add alert');
    }
  }

  async getRecentAlerts(limitCount: number = 50, daysAgo: number = 7): Promise<StockAlert[]> {
    try {
      const alertsCollection = collection(db, COLLECTION_NAME);
      const q = query(alertsCollection);
      
      const querySnapshot = await getDocs(q);
      const alerts = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          productId: data.productId,
          type: data.type,
          message: data.message,
          createdAt: data.createdAt.toDate().toISOString(),
          userName: data.userName
        };
      });
      
      // Filter by date (only last X days)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      const filteredAlerts = alerts.filter(alert => new Date(alert.createdAt) >= cutoffDate);
      
      // Sort by date (newest first) in JavaScript
      filteredAlerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Limit results
      return filteredAlerts.slice(0, limitCount);
    } catch (error) {
      console.error('Error fetching alerts from Firebase:', error);
      return [];
    }
  }

  async getAlertsByProduct(productId: string): Promise<StockAlert[]> {
    try {
      const alertsCollection = collection(db, COLLECTION_NAME);
      const q = query(
        alertsCollection,
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const alerts = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          productId: data.productId,
          type: data.type,
          message: data.message,
          createdAt: data.createdAt.toDate().toISOString(),
          userName: data.userName
        };
      });
      
      return alerts.filter(alert => alert.productId === productId);
    } catch (error) {
      console.error('Error fetching alerts for product from Firebase:', error);
      return [];
    }
  }
}

export const alertsFirebaseService = AlertsFirebaseService.getInstance();
