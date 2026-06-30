import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface Expense {
  id: string;
  name: string;
  dollarValue: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export class ExpenseManagementService {
  private readonly COLLECTION_NAME = 'expenses';

  async getAllExpenses(): Promise<Expense[]> {
    try {
      const snapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      return snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          dollarValue: typeof data.dollarValue === 'number' ? data.dollarValue : parseFloat(data.dollarValue) || 0,
          isActive: data.isActive ?? true,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          createdBy: data.createdBy,
        } as Expense;
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error getting expenses:', error);
      throw new Error('Failed to load expenses');
    }
  }

  async getActiveExpenses(): Promise<Expense[]> {
    const all = await this.getAllExpenses();
    return all.filter(e => e.isActive);
  }

  async addExpense(expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...expenseData,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding expense:', error);
      throw new Error('Failed to add expense');
    }
  }

  async updateExpense(expenseId: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>): Promise<void> {
    try {
      await updateDoc(doc(db, this.COLLECTION_NAME, expenseId), {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error('Error updating expense:', error);
      throw new Error('Failed to update expense');
    }
  }

  async deleteExpense(expenseId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION_NAME, expenseId));
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw new Error('Failed to delete expense');
    }
  }
}

export const expenseManagementService = new ExpenseManagementService();
