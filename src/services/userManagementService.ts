import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export interface AppUser {
  id: string;
  username: string;
  password: string; // In production, this should be hashed
  role: 'admin' | 'field';
  name: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string; // Admin who created this user
  isActive: boolean;
}

export class UserManagementService {
  private readonly COLLECTION_NAME = 'users';

  // Get all users
  async getAllUsers(): Promise<AppUser[]> {
    try {
      const usersCollection = collection(db, this.COLLECTION_NAME);
      const q = query(usersCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppUser[];
    } catch (error) {
      console.error('Failed to get users:', error);
      throw error;
    }
  }

  // Add new user
  async addUser(userData: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Check if username already exists
      const existingUsers = await this.getAllUsers();
      const usernameExists = existingUsers.some(user => 
        user.username.toLowerCase() === userData.username.toLowerCase()
      );
      
      if (usernameExists) {
        throw new Error('Username already exists');
      }

      const newUser: Omit<AppUser, 'id'> = {
        ...userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), newUser);
      console.log('User added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Failed to add user:', error);
      throw error;
    }
  }

  // Update user
  async updateUser(id: string, updates: Partial<AppUser>): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      console.log('User updated successfully');
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }

  // Delete user
  async deleteUser(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(docRef);
      console.log('User deleted successfully');
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }

  // Get user by username
  async getUserByUsername(username: string): Promise<AppUser | null> {
    try {
      const users = await this.getAllUsers();
      return users.find(user => 
        user.username.toLowerCase() === username.toLowerCase() && user.isActive
      ) || null;
    } catch (error) {
      console.error('Failed to get user by username:', error);
      throw error;
    }
  }

  // Initialize default users if no users exist
  async initializeDefaultUsers(): Promise<void> {
    try {
      const existingUsers = await this.getAllUsers();
      
      if (existingUsers.length === 0) {
        console.log('No users found, creating default users...');
        
        const defaultUsers: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'>[] = [
          {
            username: 'Admin',
            password: 'Admin123', // In production, hash this
            role: 'admin',
            name: 'System Administrator',
            isActive: true,
          },
          {
            username: 'Field',
            password: 'Field123', // In production, hash this
            role: 'field',
            name: 'Field Technician',
            isActive: true,
          }
        ];

        for (const user of defaultUsers) {
          await this.addUser(user);
        }

        console.log('Default users created successfully');
      }
    } catch (error) {
      console.error('Failed to initialize default users:', error);
      throw error;
    }
  }
}

export const userManagementService = new UserManagementService();
