import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { equipmentHistoryFirebaseService } from './equipmentHistoryFirebaseService';
import { alertsFirebaseService } from './alertsFirebaseService';
import { Equipment } from '../types';

export class FleetManagementService {
  private readonly COLLECTION_NAME = 'fleetEquipment';

  async getAllEquipment(): Promise<Equipment[]> {
    try {
      const equipmentCollection = collection(db, this.COLLECTION_NAME);
      const snapshot = await getDocs(equipmentCollection);

      return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        let createdAt = new Date().toISOString();
        let updatedAt = new Date().toISOString();
        try {
          if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate().toISOString();
          } else if (data.createdAt) {
            createdAt = data.createdAt;
          }
          if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
            updatedAt = data.updatedAt.toDate().toISOString();
          } else if (data.updatedAt) {
            updatedAt = data.updatedAt;
          }
        } catch (e) {
          // Fallback to current date if timestamp conversion fails
        }
        return {
          id: docSnap.id,
          name: data.name || '',
          description: data.description || '',
          serialNumber: data.serialNumber || '',
          year: data.year || '',
          make: data.make || '',
          model: data.model || '',
          category: data.category || '',
          site: data.site || '',
          employee: data.employee || '',
          equipmentType: 'heavy' as const,
          repair: data.repair ?? false,
          repairDescription: data.repairDescription || '',
          notes: data.notes || [],
          isActive: data.isActive ?? true,
          showInInventory: data.showInInventory ?? true,
          showInTimecard: data.showInTimecard ?? true,
          createdAt,
          updatedAt,
          createdBy: data.createdBy,
          parentId: data.parentId || undefined
        };
      }).filter(item => item.name.length > 0).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error: any) {
      console.error('Error getting fleet equipment:', error);
      throw new Error(error?.message || 'Failed to load fleet equipment');
    }
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
      console.error('Error adding fleet equipment:', error);
      throw new Error('Failed to add fleet equipment');
    }
  }

  async updateEquipment(id: string, updates: Partial<Omit<Equipment, 'id' | 'createdAt'>>, user?: { username: string; role: string }): Promise<void> {
    try {
      const equipmentDoc = doc(db, this.COLLECTION_NAME, id);
      const oldDoc = await getDoc(equipmentDoc);
      const oldEquipment = oldDoc.exists() ? { id: oldDoc.id, ...oldDoc.data() } as Equipment : undefined;

      await updateDoc(equipmentDoc, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      });

      if (user && oldEquipment) {
        const newEquipment = { ...oldEquipment, ...updates } as Equipment;

        await equipmentHistoryFirebaseService.trackEquipmentChange(
          'updated',
          newEquipment,
          user,
          oldEquipment
        );

        const changes: string[] = [];
        Object.keys(updates).forEach(key => {
          const oldValue = oldEquipment[key as keyof Equipment];
          const newValue = updates[key as keyof Omit<Equipment, 'id' | 'createdAt'>];
          if (key === 'updatedAt' || key === 'createdAt' || key === 'repair' || key === 'notes') return;
          if (oldValue === newValue) return;
          if (['isActive', 'showInInventory', 'showInTimecard'].includes(key)) return;
          changes.push(String(newValue || ''));
        });

        if (changes.length > 0) {
          try {
            await alertsFirebaseService.addAlert({
              productId: id,
              type: 'change',
              message: changes.join('\n'),
              createdAt: new Date().toISOString(),
              userName: user.username || 'Unknown User',
            });
          } catch (error) {
            console.error('Error adding alert for fleet equipment:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error updating fleet equipment:', error);
      throw new Error('Failed to update fleet equipment');
    }
  }

  async deleteEquipment(id: string): Promise<void> {
    try {
      const equipmentDoc = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(equipmentDoc);
    } catch (error) {
      console.error('Error deleting fleet equipment:', error);
      throw new Error('Failed to delete fleet equipment');
    }
  }
}

export const fleetManagementService = new FleetManagementService();
