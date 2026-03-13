import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface SmallTool {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export class SmallToolsManagementService {
  private readonly COLLECTION_NAME = 'smallTools';

  // Get all small tools
  async getAllSmallTools(): Promise<SmallTool[]> {
    try {
      const toolsCollection = collection(db, this.COLLECTION_NAME);
      const snapshot = await getDocs(toolsCollection);
      
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
      console.error('Error getting small tools:', error);
      throw new Error('Failed to load small tools');
    }
  }

  // Get active small tools only
  async getActiveSmallTools(): Promise<SmallTool[]> {
    const allTools = await this.getAllSmallTools();
    return allTools.filter(tool => tool.isActive);
  }

  // Add new small tool
  async addSmallTool(toolData: Omit<SmallTool, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const toolsCollection = collection(db, this.COLLECTION_NAME);
      const docRef = await addDoc(toolsCollection, {
        ...toolData,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding small tool:', error);
      throw new Error('Failed to add small tool');
    }
  }

  // Update small tool
  async updateSmallTool(toolId: string, updates: Partial<Omit<SmallTool, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const toolDoc = doc(db, this.COLLECTION_NAME, toolId);
      await updateDoc(toolDoc, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error updating small tool:', error);
      throw new Error('Failed to update small tool');
    }
  }

  // Delete small tool
  async deleteSmallTool(toolId: string): Promise<void> {
    try {
      const toolDoc = doc(db, this.COLLECTION_NAME, toolId);
      await deleteDoc(toolDoc);
    } catch (error) {
      console.error('Error deleting small tool:', error);
      throw new Error('Failed to delete small tool');
    }
  }

  // Initialize default small tools if none exist
  async initializeDefaultSmallTools(): Promise<void> {
    // Removed default small tools initialization - admins will add tools as needed
  }
}

export const smallToolsManagementService = new SmallToolsManagementService();
