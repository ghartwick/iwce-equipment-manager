import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface Equipment {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export class EquipmentManagementService {
  private readonly COLLECTION_NAME = 'equipment';

  async getAllEquipment(): Promise<Equipment[]> {
    try {
      const equipmentCollection = collection(db, this.COLLECTION_NAME);
      const snapshot = await getDocs(equipmentCollection);
      
      return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        let createdAt = new Date();
        let updatedAt = new Date();
        try {
          if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
          }
          if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
            updatedAt = data.updatedAt.toDate();
          }
        } catch (e) {
          // Fallback to current date if timestamp conversion fails
        }
        return {
          id: docSnap.id,
          name: data.name || '',
          description: data.description || '',
          isActive: data.isActive ?? true,
          createdAt,
          updatedAt,
          createdBy: data.createdBy
        };
      }).filter(item => item.name.length > 0).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error: any) {
      console.error('Error getting equipment:', error);
      throw new Error(error?.message || 'Failed to load equipment');
    }
  }

  async getActiveEquipment(): Promise<Equipment[]> {
    const all = await this.getAllEquipment();
    return all.filter(item => item.isActive);
  }

  async addEquipment(data: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const equipmentCollection = collection(db, this.COLLECTION_NAME);
      const docRef = await addDoc(equipmentCollection, {
        ...data,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding equipment:', error);
      throw new Error('Failed to add equipment');
    }
  }

  async updateEquipment(id: string, updates: Partial<Omit<Equipment, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const equipmentDoc = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(equipmentDoc, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error updating equipment:', error);
      throw new Error('Failed to update equipment');
    }
  }

  async deleteEquipment(id: string): Promise<void> {
    try {
      const equipmentDoc = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(equipmentDoc);
    } catch (error) {
      console.error('Error deleting equipment:', error);
      throw new Error('Failed to delete equipment');
    }
  }
}

export const equipmentManagementService = new EquipmentManagementService();
