import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface SiteCode {
  name: string;
  description?: string;
}

export interface SiteRole {
  name: string;
  costPerHour: number;
}

export interface Site {
  id: string;
  name: string;
  description?: string;
  codes?: SiteCode[];
  roles?: SiteRole[];
  linkedSites?: string[];
  clientId?: string;
  isActive: boolean;
  flagRed?: boolean;
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
        const codes = (data.codes || []).map((c: any) =>
          typeof c === 'string' ? { name: c, description: '' } : c
        );
        return {
          id: doc.id,
          name: data.name,
          description: data.description || '',
          codes: codes.sort((a: SiteCode, b: SiteCode) => {
            const numA = parseFloat(a.name);
            const numB = parseFloat(b.name);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.name.localeCompare(b.name);
          }),
          roles: (data.roles || []).map((r: any) => ({
            name: r.name,
            costPerHour: typeof r.costPerHour === 'number' ? r.costPerHour : parseFloat(r.costPerHour) || 0,
          })),
          linkedSites: data.linkedSites || [],
          clientId: data.clientId || '',
          isActive: data.isActive ?? true,
          flagRed: data.flagRed ?? false,
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

  // Get a single site by ID
  async getSite(id: string): Promise<Site> {
    try {
      const siteDoc = doc(db, this.COLLECTION_NAME, id);
      const snapshot = await getDoc(siteDoc);
      
      if (!snapshot.exists()) {
        throw new Error('Site not found');
      }
      
      const data = snapshot.data();
      const codes = (data.codes || []).map((c: any) =>
        typeof c === 'string' ? { name: c, description: '' } : c
      );
      return {
        id: snapshot.id,
        name: data.name,
        description: data.description || '',
        codes: codes.sort((a: SiteCode, b: SiteCode) => {
          const numA = parseFloat(a.name);
          const numB = parseFloat(b.name);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.name.localeCompare(b.name);
        }),
        roles: (data.roles || []).map((r: any) => ({
          name: r.name,
          costPerHour: typeof r.costPerHour === 'number' ? r.costPerHour : parseFloat(r.costPerHour) || 0,
        })),
        linkedSites: data.linkedSites || [],
        clientId: data.clientId || '',
        isActive: data.isActive ?? true,
        flagRed: data.flagRed ?? false,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        createdBy: data.createdBy
      };
    } catch (error) {
      console.error('Error getting site:', error);
      throw error;
    }
  }

  // Get active sites only
  async getActiveSites(): Promise<Site[]> {
    const allSites = await this.getAllSites();
    return allSites.filter(site => site.isActive);
  }

  // Get active sites for field crews: restricted to the default field-crew client.
  // Falls back to all active sites when no default client has been set.
  async getFieldCrewSites(): Promise<Site[]> {
    const { clientManagementService } = await import('./clientManagementService');
    const [activeSites, defaultClient] = await Promise.all([
      this.getActiveSites(),
      clientManagementService.getDefaultFieldClient(),
    ]);
    if (!defaultClient) return activeSites;
    return activeSites.filter(site => site.clientId === defaultClient.id);
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
