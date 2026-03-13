import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface Site {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export class SiteManagementService {
  private readonly COLLECTION_NAME = 'sites';

  // Get all sites
  async getAllSites(): Promise<Site[]> {
    try {
      const sitesCollection = collection(db, this.COLLECTION_NAME);
      const snapshot = await getDocs(sitesCollection);
      
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
      console.error('Error getting sites:', error);
      throw new Error('Failed to load sites');
    }
  }

  // Get active sites only
  async getActiveSites(): Promise<Site[]> {
    const allSites = await this.getAllSites();
    return allSites.filter(site => site.isActive);
  }

  // Add new site
  async addSite(siteData: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const sitesCollection = collection(db, this.COLLECTION_NAME);
      const docRef = await addDoc(sitesCollection, {
        ...siteData,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding site:', error);
      throw new Error('Failed to add site');
    }
  }

  // Update site
  async updateSite(siteId: string, updates: Partial<Omit<Site, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const siteDoc = doc(db, this.COLLECTION_NAME, siteId);
      await updateDoc(siteDoc, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error updating site:', error);
      throw new Error('Failed to update site');
    }
  }

  // Delete site
  async deleteSite(siteId: string): Promise<void> {
    try {
      const siteDoc = doc(db, this.COLLECTION_NAME, siteId);
      await deleteDoc(siteDoc);
    } catch (error) {
      console.error('Error deleting site:', error);
      throw new Error('Failed to delete site');
    }
  }

  // Initialize default sites if none exist
  async initializeDefaultSites(): Promise<void> {
    try {
      const sites = await this.getAllSites();
      if (sites.length === 0) {
        const defaultSites = [
          { name: 'Main Office', description: 'Main office location', isActive: true },
          { name: 'Warehouse', description: 'Storage warehouse', isActive: true },
          { name: 'Field Site A', description: 'Field location A', isActive: true }
        ];

        for (const site of defaultSites) {
          await this.addSite({
            ...site,
            createdBy: 'system'
          });
        }
      }
    } catch (error) {
      console.error('Error initializing default sites:', error);
    }
  }
}

export const siteManagementService = new SiteManagementService();
