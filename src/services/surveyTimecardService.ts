import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserManagementService } from './userManagementService';

export interface SurveyExpenseLine {
  expenseId: string;
  name: string;
  dollarValue: number;
  quantity: number;
}

export interface SurveyWorkEntry {
  id: string;
  roleName: string;
  roleCostPerHour: number;
  hours: number;
  expenses: SurveyExpenseLine[];
  notes?: string;
}

export interface SurveyTimeEntry {
  id?: string;
  userId: string;
  date: Date;
  clientId: string;
  clientName: string;
  site: string;
  roleName: string;
  roleCostPerHour: number;
  hours: number;
  travelHours: number;
  notes?: string;
  expenses: SurveyExpenseLine[];
  workEntries?: SurveyWorkEntry[];
  status: 'draft' | 'submitted' | 'rejected';
  submittedAt?: Date;
  submittedBy?: string;
  lastEditedBy?: string;
  lastEditedAt?: Date;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Minimal user shape for permission checks (matches timecardService.User)
export interface SurveyUser {
  id: string;
  username: string;
  role: 'admin' | 'supervisor' | 'field';
  name: string;
}

class SurveyTimecardService {
  private readonly collection = 'surveyTimeEntries';
  private userManagementService = new UserManagementService();

  private normalizeDate(raw: any): Date {
    const d = raw?.toDate ? raw.toDate() : (raw instanceof Date ? raw : new Date(raw));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
  }

  private mapDoc(id: string, data: any): SurveyTimeEntry {
    return {
      id,
      userId: data.userId,
      date: this.normalizeDate(data.date),
      clientId: data.clientId || '',
      clientName: data.clientName || '',
      site: data.site || '',
      roleName: data.roleName || '',
      roleCostPerHour: typeof data.roleCostPerHour === 'number' ? data.roleCostPerHour : parseFloat(data.roleCostPerHour) || 0,
      hours: typeof data.hours === 'number' ? data.hours : parseFloat(data.hours) || 0,
      travelHours: typeof data.travelHours === 'number' ? data.travelHours : parseFloat(data.travelHours) || 0,
      notes: data.notes || '',
      expenses: (data.expenses || []).map((e: any) => ({
        expenseId: e.expenseId || '',
        name: e.name || '',
        dollarValue: typeof e.dollarValue === 'number' ? e.dollarValue : parseFloat(e.dollarValue) || 0,
        quantity: typeof e.quantity === 'number' ? e.quantity : parseFloat(e.quantity) || 0,
      })),
      workEntries: (data.workEntries || []).map((we: any) => ({
        id: we.id || '',
        roleName: we.roleName || '',
        roleCostPerHour: typeof we.roleCostPerHour === 'number' ? we.roleCostPerHour : parseFloat(we.roleCostPerHour) || 0,
        hours: typeof we.hours === 'number' ? we.hours : parseFloat(we.hours) || 0,
        expenses: (we.expenses || []).map((e: any) => ({
          expenseId: e.expenseId || '',
          name: e.name || '',
          dollarValue: typeof e.dollarValue === 'number' ? e.dollarValue : parseFloat(e.dollarValue) || 0,
          quantity: typeof e.quantity === 'number' ? e.quantity : parseFloat(e.quantity) || 0,
        })),
        notes: we.notes || '',
      })),
      status: data.status || 'draft',
      submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : (data.submittedAt ? new Date(data.submittedAt) : undefined),
      submittedBy: data.submittedBy,
      lastEditedBy: data.lastEditedBy,
      lastEditedAt: data.lastEditedAt?.toDate ? data.lastEditedAt.toDate() : undefined,
      isLocked: data.isLocked ?? false,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
    };
  }

  async createEntry(entry: Omit<SurveyTimeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const cleanEntry = Object.fromEntries(
      Object.entries(entry).filter(([_, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, this.collection), {
      ...cleanEntry,
      date: Timestamp.fromDate(entry.date),
      submittedAt: entry.submittedAt ? Timestamp.fromDate(entry.submittedAt) : null,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });
    return docRef.id;
  }

  async updateEntry(id: string, updates: Partial<SurveyTimeEntry>, editedBy?: string): Promise<void> {
    const docRef = doc(db, this.collection, id);
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    const updateData: any = {
      ...filteredUpdates,
      updatedAt: Timestamp.fromDate(new Date()),
    };
    if (editedBy) {
      updateData.lastEditedBy = editedBy;
      updateData.lastEditedAt = Timestamp.fromDate(new Date());
    }
    if (updates.date) {
      const date = (updates.date as any).toDate ? (updates.date as any).toDate() : updates.date;
      updateData.date = Timestamp.fromDate(date as Date);
    }
    if (updates.submittedAt) {
      const submittedAt = (updates.submittedAt as any).toDate ? (updates.submittedAt as any).toDate() : updates.submittedAt;
      updateData.submittedAt = Timestamp.fromDate(submittedAt as Date);
    }
    await updateDoc(docRef, updateData);
  }

  async deleteEntry(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collection, id));
  }

  async getEntry(id: string): Promise<SurveyTimeEntry> {
    const snapshot = await getDoc(doc(db, this.collection, id));
    if (!snapshot.exists()) throw new Error('Survey time entry not found');
    return this.mapDoc(snapshot.id, snapshot.data());
  }

  private sortEntries(entries: SurveyTimeEntry[]): SurveyTimeEntry[] {
    return entries.sort((a, b) => {
      const createDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createDiff !== 0) return createDiff;
      return a.date.getTime() - b.date.getTime();
    });
  }

  async getUserEntries(userId: string): Promise<SurveyTimeEntry[]> {
    const q = query(collection(db, this.collection), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return this.sortEntries(snapshot.docs.map(d => this.mapDoc(d.id, d.data())));
  }

  async getAllEntries(): Promise<SurveyTimeEntry[]> {
    const snapshot = await getDocs(collection(db, this.collection));
    return this.sortEntries(snapshot.docs.map(d => this.mapDoc(d.id, d.data())));
  }

  async getSupervisorEntries(supervisorId: string): Promise<SurveyTimeEntry[]> {
    const allUsers = await this.userManagementService.getAllUsers();
    const supervisorUserIds = new Set(allUsers.filter(u => u.role === 'supervisor').map(u => u.id));
    const snapshot = await getDocs(collection(db, this.collection));
    const entries = snapshot.docs.map(d => this.mapDoc(d.id, d.data()));
    const filtered = entries.filter(entry => {
      if (entry.userId === supervisorId) return true;
      if (entry.status === 'submitted' && !supervisorUserIds.has(entry.userId)) return true;
      return false;
    });
    return this.sortEntries(filtered);
  }

  async findDuplicateEntry(userId: string, date: Date, clientId: string, site: string): Promise<SurveyTimeEntry | null> {
    const q = query(
      collection(db, this.collection),
      where('userId', '==', userId),
      where('clientId', '==', clientId),
      where('site', '==', site)
    );
    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const entryDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
      if (
        entryDate.getFullYear() === date.getFullYear() &&
        entryDate.getMonth() === date.getMonth() &&
        entryDate.getDate() === date.getDate()
      ) {
        return this.mapDoc(docSnap.id, data);
      }
    }
    return null;
  }

  async submitEntry(id: string, userId?: string): Promise<void> {
    const entry = await this.getEntry(id);
    await this.updateEntry(id, {
      status: 'submitted',
      isLocked: true,
      submittedAt: new Date(),
      submittedBy: userId || entry.userId,
    });
  }

  // Permission helpers (mirror timecardService semantics)
  canEditEntry = (entry: SurveyTimeEntry, user: SurveyUser): boolean => {
    if (user.role === 'admin' || user.role === 'supervisor') return true;
    const isDraft = !entry.status || entry.status === 'draft';
    return user.role === 'field' && entry.userId === user.id && isDraft && !entry.isLocked;
  };

  canViewEntry = (entry: SurveyTimeEntry, user: SurveyUser): boolean => {
    if (user.role === 'admin' || user.role === 'supervisor') return true;
    const isDraftOrUnsaved = !entry.status || entry.status === 'draft';
    return user.role === 'field' && entry.userId === user.id && isDraftOrUnsaved && !entry.isLocked;
  };

  canSeeEntry = (entry: SurveyTimeEntry, user: SurveyUser, supervisorUserIds?: Set<string>): boolean => {
    if (user.role === 'admin') return true;
    if (user.role === 'supervisor') {
      if (entry.userId === user.id) return true;
      if (supervisorUserIds && supervisorUserIds.has(entry.userId)) return false;
      return true;
    }
    return user.role === 'field' && entry.userId === user.id;
  };

  entryTotalCost(entry: SurveyTimeEntry): number {
    if (entry.workEntries && entry.workEntries.length > 0) {
      const labour = entry.workEntries.reduce((sum, we) => sum + we.hours * we.roleCostPerHour, 0);
      const travelRate = entry.workEntries[0]?.roleCostPerHour || 0;
      const travelCost = entry.travelHours * travelRate;
      const expenses = entry.workEntries.reduce((sum, we) =>
        sum + we.expenses.reduce((s, e) => s + e.dollarValue * e.quantity, 0), 0);
      return Math.round((labour + travelCost + expenses) * 100) / 100;
    }
    const labour = (entry.hours + entry.travelHours) * entry.roleCostPerHour;
    const expenses = entry.expenses.reduce((sum, e) => sum + e.dollarValue * e.quantity, 0);
    return Math.round((labour + expenses) * 100) / 100;
  }
}

export const surveyTimecardService = new SurveyTimecardService();
