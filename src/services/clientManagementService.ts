import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface Client {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  allowFieldUsers?: boolean;
  allowSupervisorUsers?: boolean;
  showSitesInInventory?: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export class ClientManagementService {
  private readonly COLLECTION_NAME = 'clients';

  private mapDoc(id: string, data: any): Client {
    return {
      id,
      name: data.name,
      description: data.description || '',
      isActive: data.isActive ?? true,
      // Migrate the legacy single-default flag into the new field-user access flag
      allowFieldUsers: data.allowFieldUsers ?? data.isDefaultForFieldCrews ?? false,
      allowSupervisorUsers: data.allowSupervisorUsers ?? false,
      showSitesInInventory: data.showSitesInInventory ?? false,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      createdBy: data.createdBy,
    };
  }

  async getAllClients(): Promise<Client[]> {
    try {
      const snapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      return snapshot.docs
        .map(d => this.mapDoc(d.id, d.data()))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error getting clients:', error);
      throw new Error('Failed to load clients');
    }
  }

  async getActiveClients(): Promise<Client[]> {
    const all = await this.getAllClients();
    return all.filter(c => c.isActive);
  }

  async getClient(id: string): Promise<Client> {
    const snapshot = await getDoc(doc(db, this.COLLECTION_NAME, id));
    if (!snapshot.exists()) throw new Error('Client not found');
    return this.mapDoc(snapshot.id, snapshot.data());
  }

  async addClient(clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...clientData,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding client:', error);
      throw new Error('Failed to add client');
    }
  }

  async updateClient(clientId: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>): Promise<void> {
    try {
      await updateDoc(doc(db, this.COLLECTION_NAME, clientId), {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error('Error updating client:', error);
      throw new Error('Failed to update client');
    }
  }

  async deleteClient(clientId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION_NAME, clientId));
    } catch (error) {
      console.error('Error deleting client:', error);
      throw new Error('Failed to delete client');
    }
  }

  // Returns active clients a user with the given role is allowed to see in the timecard app.
  async getClientsForRole(role: 'admin' | 'supervisor' | 'field'): Promise<Client[]> {
    const all = await this.getActiveClients();
    if (role === 'admin') return all;
    if (role === 'supervisor') return all.filter(c => c.allowSupervisorUsers);
    return all.filter(c => c.allowFieldUsers);
  }
}

export const clientManagementService = new ClientManagementService();
