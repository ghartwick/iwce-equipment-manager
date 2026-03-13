import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface TimeEntry {
  id?: string;
  userId: string;
  date: Date;
  clockIn: Date;
  clockOut: Date;
  hours: number;
  job?: string;
  workEntries?: WorkEntryData[];
  code?: string;
  equipment?: string;
  productionQuantity?: number;
  machineHours?: number;
  labourHours?: number;
  smallTools?: string[];
  notes?: string;
  supervisorId?: string;
  entryNumber?: number;
  status: 'draft' | 'submitted' | 'rejected';
  submittedAt?: Date;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkEntryData {
  id: string;
  notes?: string;
  code?: string;
  equipment?: string;
  machineHours?: number;
  labourHours?: number;
  productionQuantity?: number;
  smallTools?: string[];
  collapsed?: boolean;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'supervisor' | 'field';
  name: string;
}

class TimecardService {
  private readonly collection = 'timeEntries';

  // Create new time entry
  async createTimeEntry(entry: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collection), {
      ...entry,
      date: Timestamp.fromDate(entry.date),
      clockIn: Timestamp.fromDate(entry.clockIn),
      clockOut: Timestamp.fromDate(entry.clockOut),
      submittedAt: entry.submittedAt ? Timestamp.fromDate(entry.submittedAt) : null,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });
    return docRef.id;
  }

  // Update time entry
  async updateTimeEntry(id: string, updates: Partial<TimeEntry>): Promise<void> {
    const docRef = doc(db, this.collection, id);
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    // Convert dates to timestamps only if they exist
    if (updates.date) {
      const date = (updates.date as any).toDate ? (updates.date as any).toDate() : updates.date;
      updateData.date = Timestamp.fromDate(date as Date);
    }
    if (updates.clockIn) {
      const clockIn = (updates.clockIn as any).toDate ? (updates.clockIn as any).toDate() : updates.clockIn;
      updateData.clockIn = Timestamp.fromDate(clockIn as Date);
    }
    if (updates.clockOut) {
      const clockOut = (updates.clockOut as any).toDate ? (updates.clockOut as any).toDate() : updates.clockOut;
      updateData.clockOut = Timestamp.fromDate(clockOut as Date);
    }
    if (updates.submittedAt) {
      const submittedAt = (updates.submittedAt as any).toDate ? (updates.submittedAt as any).toDate() : updates.submittedAt;
      updateData.submittedAt = Timestamp.fromDate(submittedAt as Date);
    }

    await updateDoc(docRef, updateData);
  }

  // Delete time entry
  async deleteTimeEntry(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collection, id));
  }

  // Get time entries for a user
  async getUserTimeEntries(userId: string): Promise<TimeEntry[]> {
    const q = query(
      collection(db, this.collection),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    const entries = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: data.date.toDate(),
        clockIn: data.clockIn.toDate(),
        clockOut: data.clockOut.toDate(),
        submittedAt: data.submittedAt?.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as TimeEntry;
    });
    
    // Sort by creation time first (oldest first), then by date to maintain creation order
    const sortedEntries = entries.sort((a, b) => {
      // First sort by creation time (oldest first)
      const createTimeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createTimeDiff !== 0) return createTimeDiff;
      
      // If same creation time, sort by date (oldest first)
      return a.date.getTime() - b.date.getTime();
    });
    
    return sortedEntries;
  }

  // Get time entries for supervisor (all entries for oversight)
  async getSupervisorTimeEntries(): Promise<TimeEntry[]> {
    // Get all entries for supervisor oversight
    const q = query(
      collection(db, this.collection)
    );
    
    const querySnapshot = await getDocs(q);
    
    const entries = querySnapshot.docs.map(doc => {
      const data = doc.data();
      let dateObj;
      if (data.date && 'toDate' in data.date && typeof (data.date as any).toDate === 'function') {
        dateObj = (data.date as any).toDate();
      } else {
        dateObj = new Date(data.date);
      }
      
      return {
        id: doc.id,
        date: dateObj,
        clockIn: data.clockIn?.toDate ? data.clockIn.toDate() : new Date(data.clockIn),
        clockOut: data.clockOut?.toDate ? data.clockOut.toDate() : new Date(data.clockOut),
        submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : (data.submittedAt ? new Date(data.submittedAt) : undefined),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        ...data,
      } as TimeEntry;
    });
    
    // Sort by creation time first (oldest first), then by date to maintain creation order
    const sortedEntries = entries.sort((a, b) => {
      // First sort by creation time (oldest first)
      const createTimeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const createTimeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      const createTimeDiff = createTimeA - createTimeB;
      if (createTimeDiff !== 0) return createTimeDiff;
      
      // If same creation time, sort by date (oldest first)
      const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
      const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
      return dateA - dateB;
    });
    
    return sortedEntries;
  }

  // Get all time entries (admin only)
  async getAllTimeEntries(): Promise<TimeEntry[]> {
    const q = query(
      collection(db, this.collection)
    );
    
    const querySnapshot = await getDocs(q);
    const entries = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        clockIn: data.clockIn.toDate(),
        clockOut: data.clockOut.toDate(),
        submittedAt: data.submittedAt?.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as TimeEntry;
    });
    
    // Sort by creation time first (oldest first), then by date to maintain creation order
    const sortedEntries = entries.sort((a, b) => {
      // First sort by creation time (oldest first)
      const createTimeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createTimeDiff !== 0) return createTimeDiff;
      
      // If same creation time, sort by date (oldest first)
      return a.date.getTime() - b.date.getTime();
    });
    
    return sortedEntries;
  }

  // Submit time entry
  async submitTimeEntry(id: string): Promise<void> {
    await this.updateTimeEntry(id, {
      status: 'submitted',
      isLocked: true,
      submittedAt: new Date(),
    });
  }

  // Calculate hours between clock in and clock out
  calculateHours(clockIn: Date, clockOut: Date): number {
    const diff = clockOut.getTime() - clockIn.getTime();
    const hours = diff / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100;
  }

  // Check if user can edit entry
  canEditEntry(entry: TimeEntry, user: User): boolean {
    if (user.role === 'admin') return true;
    if (user.role === 'supervisor') return true;
    // Field users can only edit their own draft entries (not submitted or locked)
    if (user.role === 'field' && entry.userId === user.id && entry.status === 'draft' && !entry.isLocked) return true;
    return false;
  }

  // Check if user can view entry (read-only access)
  canViewEntry(entry: TimeEntry, user: User): boolean {
    if (user.role === 'admin') return true;
    if (user.role === 'supervisor') return true;
    // Field users can only view their own draft entries (submitted entries are locked from view)
    if (user.role === 'field' && entry.userId === user.id && entry.status === 'draft' && !entry.isLocked) return true;
    return false;
  }

  // Check if user can see entry in list (but not necessarily access it)
  canSeeEntry(entry: TimeEntry, user: User): boolean {
    if (user.role === 'admin') return true;
    if (user.role === 'supervisor') return true;
    // Field users can see their own entries regardless of status
    if (user.role === 'field' && entry.userId === user.id) return true;
    return false;
  }

  // Check if user can approve entry
  canApproveEntry(user: User): boolean {
    return user.role === 'supervisor' || user.role === 'admin';
  }

  // Get status color for UI
  getStatusColor(status: TimeEntry['status']): string {
    switch (status) {
      case 'draft': return 'bg-gray-600';
      case 'submitted': return 'bg-yellow-600';
      case 'rejected': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  }

  // Get status text for UI
  getStatusText(status: TimeEntry['status']): string {
    switch (status) {
      case 'draft': return 'Draft';
      case 'submitted': return 'Submitted';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  }
}

export const timecardService = new TimecardService();
