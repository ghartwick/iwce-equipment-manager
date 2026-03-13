import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface Code {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export class CodeManagementService {
  private readonly COLLECTION_NAME = 'codes';

  // Get all codes
  async getAllCodes(): Promise<Code[]> {
    try {
      const codesCollection = collection(db, this.COLLECTION_NAME);
      const snapshot = await getDocs(codesCollection);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          description: data.description || '',
          isActive: data.isActive ?? true,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          createdBy: data.createdBy
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error getting codes:', error);
      throw new Error('Failed to load codes');
    }
  }

  // Get active codes only
  async getActiveCodes(): Promise<Code[]> {
    const allCodes = await this.getAllCodes();
    return allCodes.filter(code => code.isActive);
  }

  // Add new code
  async addCode(codeData: Omit<Code, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const codesCollection = collection(db, this.COLLECTION_NAME);
      const docRef = await addDoc(codesCollection, {
        ...codeData,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding code:', error);
      throw new Error('Failed to add code');
    }
  }

  // Update code
  async updateCode(codeId: string, updates: Partial<Omit<Code, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const codeDoc = doc(db, this.COLLECTION_NAME, codeId);
      await updateDoc(codeDoc, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error updating code:', error);
      throw new Error('Failed to update code');
    }
  }

  // Delete code
  async deleteCode(codeId: string): Promise<void> {
    try {
      const codeDoc = doc(db, this.COLLECTION_NAME, codeId);
      await deleteDoc(codeDoc);
    } catch (error) {
      console.error('Error deleting code:', error);
      throw new Error('Failed to delete code');
    }
  }

  // Initialize default codes if none exist
  async initializeDefaultCodes(): Promise<void> {
    try {
      const codes = await this.getAllCodes();
      if (codes.length === 0) {
        const defaultCodes = [
          { name: 'Installation', description: 'Equipment installation work', isActive: true },
          { name: 'Maintenance', description: 'Regular maintenance tasks', isActive: true },
          { name: 'Repair', description: 'Equipment repair work', isActive: true },
          { name: 'Inspection', description: 'Equipment inspection', isActive: true },
          { name: 'Training', description: 'Training and education', isActive: true }
        ];

        for (const code of defaultCodes) {
          await this.addCode({
            ...code,
            createdBy: 'system'
          });
        }
      }
    } catch (error) {
      console.error('Error initializing default codes:', error);
    }
  }
}

export const codeManagementService = new CodeManagementService();
