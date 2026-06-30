import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface Client {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefaultForFieldCrews?: boolean;
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
      isDefaultForFieldCrews: data.isDefaultForFieldCrews ?? false,
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

  // Returns the client currently marked as the field-crew default, or null.
  async getDefaultFieldClient(): Promise<Client | null> {
    const all = await this.getAllClients();
    return all.find(c => c.isDefaultForFieldCrews) || null;
  }

  // Marks the given client as the field-crew default and clears the flag on all others.
  async setDefaultFieldClient(clientId: string): Promise<void> {
    try {
      const all = await this.getAllClients();
      await Promise.all(
        all
          .filter(c => (c.id === clientId) !== !!c.isDefaultForFieldCrews)
          .map(c =>
            updateDoc(doc(db, this.COLLECTION_NAME, c.id), {
              isDefaultForFieldCrews: c.id === clientId,
              updatedAt: Timestamp.fromDate(new Date()),
            })
          )
      );
    } catch (error) {
      console.error('Error setting default field client:', error);
      throw new Error('Failed to set default field-crew client');
    }
  }
}

export const clientManagementService = new ClientManagementService();
