import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface TimeEntry {
  id?: string;
  userId: string;
  date: Date;
  clockIn: Date;
  clockOut: Date;
  hours: number;
  notes?: string;
  supervisorId: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
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
      approvedAt: entry.approvedAt ? Timestamp.fromDate(entry.approvedAt) : null,
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
    if (updates.date) updateData.date = Timestamp.fromDate(updates.date);
    if (updates.clockIn) updateData.clockIn = Timestamp.fromDate(updates.clockIn);
    if (updates.clockOut) updateData.clockOut = Timestamp.fromDate(updates.clockOut);
    if (updates.submittedAt) updateData.submittedAt = Timestamp.fromDate(updates.submittedAt);
    if (updates.approvedAt) updateData.approvedAt = Timestamp.fromDate(updates.approvedAt);

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
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        clockIn: data.clockIn.toDate(),
        clockOut: data.clockOut.toDate(),
        submittedAt: data.submittedAt?.toDate(),
        approvedAt: data.approvedAt?.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as TimeEntry;
    });
  }

  // Get time entries for supervisor (entries submitted to them)
  async getSupervisorTimeEntries(supervisorId: string): Promise<TimeEntry[]> {
    const q = query(
      collection(db, this.collection),
      where('supervisorId', '==', supervisorId),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        clockIn: data.clockIn.toDate(),
        clockOut: data.clockOut.toDate(),
        submittedAt: data.submittedAt?.toDate(),
        approvedAt: data.approvedAt?.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as TimeEntry;
    });
  }

  // Get all time entries (admin only)
  async getAllTimeEntries(): Promise<TimeEntry[]> {
    const q = query(
      collection(db, this.collection),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        clockIn: data.clockIn.toDate(),
        clockOut: data.clockOut.toDate(),
        submittedAt: data.submittedAt?.toDate(),
        approvedAt: data.approvedAt?.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as TimeEntry;
    });
  }

  // Submit time entry
  async submitTimeEntry(id: string): Promise<void> {
    await this.updateTimeEntry(id, {
      status: 'submitted',
      isLocked: true,
      submittedAt: new Date(),
    });
  }

  // Approve time entry
  async approveTimeEntry(id: string, approvedBy: string): Promise<void> {
    await this.updateTimeEntry(id, {
      status: 'approved',
      isLocked: true,
      approvedAt: new Date(),
      approvedBy,
    });
  }

  // Reject time entry
  async rejectTimeEntry(id: string, approvedBy: string): Promise<void> {
    await this.updateTimeEntry(id, {
      status: 'rejected',
      isLocked: false,
      approvedBy,
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
    if (user.role === 'field' && entry.status === 'draft' && entry.userId === user.id) return true;
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
      case 'approved': return 'bg-green-600';
      case 'rejected': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  }

  // Get status text for UI
  getStatusText(status: TimeEntry['status']): string {
    switch (status) {
      case 'draft': return 'Draft';
      case 'submitted': return 'Submitted';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  }
}

export const timecardService = new TimecardService();
