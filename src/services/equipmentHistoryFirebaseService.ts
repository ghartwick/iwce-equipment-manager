import { collection, addDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Equipment } from '../types';

export interface EditHistory {
  id?: string;
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

class EquipmentHistoryFirebaseService {
  private static instance: EquipmentHistoryFirebaseService;
  private readonly COLLECTION_NAME = 'equipmentHistory';

  static getInstance(): EquipmentHistoryFirebaseService {
    if (!EquipmentHistoryFirebaseService.instance) {
      EquipmentHistoryFirebaseService.instance = new EquipmentHistoryFirebaseService();
    }
    return EquipmentHistoryFirebaseService.instance;
  }

  // Add history entry to Firebase
  async addHistory(entry: Omit<EditHistory, 'id'>): Promise<void> {
    try {
      console.log('=== FIREBASE SAVE DEBUG ===');
      console.log('Attempting to save to Firebase:', entry);
      console.log('Collection:', this.COLLECTION_NAME);
      
      const historyCollection = collection(db, this.COLLECTION_NAME);
      const docRef = await addDoc(historyCollection, {
        ...entry,
        timestamp: Timestamp.fromDate(entry.timestamp)
      });
      
      console.log('Document saved successfully with ID:', docRef.id);
      console.log('========================');
    } catch (error) {
      console.error('=== FIREBASE SAVE ERROR ===');
      console.error('Failed to save history to Firebase:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      console.log('============================');
    }
  }

  // Get history for specific equipment from Firebase
  async getEquipmentHistory(equipmentId: string): Promise<EditHistory[]> {
    try {
      console.log('=== FIREBASE RETRIEVE DEBUG ===');
      console.log('Retrieving history for equipment:', equipmentId);
      console.log('Collection:', this.COLLECTION_NAME);
      
      const historyCollection = collection(db, this.COLLECTION_NAME);
      
      // Try the indexed query first
      let q = query(
        historyCollection,
        where('equipmentId', '==', equipmentId),
        orderBy('timestamp', 'desc')
      );
      
      try {
        const querySnapshot = await getDocs(q);
        console.log('Indexed query executed, found documents:', querySnapshot.docs.length);
        
        const history = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Document data:', data);
          return {
            id: doc.id,
            equipmentId: data.equipmentId,
            equipmentName: data.equipmentName,
            action: data.action,
            timestamp: data.timestamp.toDate(),
            user: data.user,
            userRole: data.userRole,
            changes: data.changes
          };
        });
        
        console.log('History retrieved successfully:', history);
        console.log('=============================');
        return history;
        
      } catch (indexError) {
        console.log('Indexed query failed, trying fallback query...');
        console.log('Index error:', indexError);
        
        // Fallback: Get all documents and filter in JavaScript
        const fallbackQuery = query(historyCollection);
        const fallbackSnapshot = await getDocs(fallbackQuery);
        console.log('Fallback query executed, total documents:', fallbackSnapshot.docs.length);
        
        const allHistory = fallbackSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            equipmentId: data.equipmentId,
            equipmentName: data.equipmentName,
            action: data.action,
            timestamp: data.timestamp.toDate(),
            user: data.user,
            userRole: data.userRole,
            changes: data.changes
          };
        });
        
        // Filter for this equipment and sort manually
        const filteredHistory = allHistory
          .filter(item => item.equipmentId === equipmentId)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        console.log('Filtered history for equipment:', filteredHistory);
        console.log('=============================');
        return filteredHistory;
      }
      
    } catch (error) {
      console.error('=== FIREBASE RETRIEVE ERROR ===');
      console.error('Failed to retrieve history from Firebase:', error);
      console.error('Error details:', error);
      console.error('=============================');
      return [];
    }
  }

  // Get all history from Firebase
  async getAllHistory(): Promise<EditHistory[]> {
    try {
      const historyCollection = collection(db, this.COLLECTION_NAME);
      const q = query(historyCollection, orderBy('timestamp', 'desc'));
      
      const querySnapshot = await getDocs(q);
      const history = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          equipmentId: data.equipmentId,
          equipmentName: data.equipmentName,
          action: data.action,
          timestamp: data.timestamp.toDate(),
          user: data.user,
          userRole: data.userRole,
          changes: data.changes
        };
      }) as EditHistory[];

      console.log('Retrieved all history from Firebase:', history.length, 'entries');
      return history;
    } catch (error) {
      console.error('Failed to retrieve all history from Firebase:', error);
      return [];
    }
  }

  // Track equipment changes and save to Firebase
  async trackEquipmentChange(
    action: 'created' | 'updated' | 'deleted',
    equipment: Equipment,
    user: { username: string; role: string },
    oldEquipment?: Equipment
  ): Promise<void> {
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

    await this.addHistory({
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      action,
      user: user.username,
      userRole: user.role,
      timestamp: new Date(),
      changes: changes.length > 0 ? changes : undefined
    });
  }
}

export const equipmentHistoryFirebaseService = EquipmentHistoryFirebaseService.getInstance();
