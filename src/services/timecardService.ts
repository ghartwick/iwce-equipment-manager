import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserManagementService } from './userManagementService';

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
  travelHours?: number;
  smallTools?: string[];
  notes?: string;
  supervisorId?: string;
  entryNumber?: number;
  status: 'draft' | 'submitted' | 'rejected';
  submittedAt?: Date;
  submittedBy?: string; // Original submitter
  lastEditedBy?: string; // Last editor (supervisor/admin)
  lastEditedAt?: Date; // When it was last edited by supervisor/admin
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
  theme?: 'light' | 'dark';
}

class TimecardService {
  private readonly collection = 'timeEntries';
  private userManagementService = new UserManagementService();

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
  async updateTimeEntry(id: string, updates: Partial<TimeEntry>, editedBy?: string): Promise<void> {
    const docRef = doc(db, this.collection, id);
    // Filter out undefined values to prevent Firestore errors
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    const updateData: any = {
      ...filteredUpdates,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    // If edited by supervisor/admin, track the edit
    if (editedBy) {
      updateData.lastEditedBy = editedBy;
      updateData.lastEditedAt = Timestamp.fromDate(new Date());
    }

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
    // Note: lastEditedAt is set above when editedBy is provided, so we don't need to handle it here

    await updateDoc(docRef, updateData);
  }

  // Delete time entry
  async deleteTimeEntry(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collection, id));
  }

  // Find an existing entry for the same user, date, and site (to prevent duplicates)
  async findDuplicateEntry(userId: string, date: Date, job: string): Promise<TimeEntry | null> {
    const q = query(
      collection(db, this.collection),
      where('userId', '==', userId),
      where('job', '==', job)
    );
    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const entryDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
      const same =
        entryDate.getFullYear() === date.getFullYear() &&
        entryDate.getMonth() === date.getMonth() &&
        entryDate.getDate() === date.getDate();
      if (same) {
        return { id: docSnap.id, ...data } as TimeEntry;
      }
    }
    return null;
  }

  // Get a single time entry by ID
  async getTimeEntry(id: string): Promise<TimeEntry> {
    const docRef = doc(db, this.collection, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Time entry not found');
    }
    
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      date: this.normalizeDate(data.date),
      clockIn: data.clockIn.toDate(),
      clockOut: data.clockOut.toDate(),
      submittedAt: data.submittedAt?.toDate(),
      submittedBy: data.submittedBy,
      lastEditedBy: data.lastEditedBy,
      lastEditedAt: data.lastEditedAt?.toDate(),
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    } as TimeEntry;
  }

  // Normalize a Firestore date to local noon using its UTC date components
  // This ensures entries stored at midnight UTC show on the correct local calendar day
  private normalizeDate(raw: any): Date {
    const d = raw?.toDate ? raw.toDate() : (raw instanceof Date ? raw : new Date(raw));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
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
        date: this.normalizeDate(data.date),
        clockIn: data.clockIn.toDate(),
        clockOut: data.clockOut.toDate(),
        submittedAt: data.submittedAt?.toDate(),
        submittedBy: data.submittedBy,
        lastEditedBy: data.lastEditedBy,
        lastEditedAt: data.lastEditedAt?.toDate(),
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

  // Get time entries for supervisor (their own entries + submitted entries from others, excluding other supervisors)
  async getSupervisorTimeEntries(supervisorId: string): Promise<TimeEntry[]> {
    // Get all users to determine roles
    const allUsers = await this.userManagementService.getAllUsers();
    const supervisorUserIds = new Set(
      allUsers.filter(u => u.role === 'supervisor').map(u => u.id)
    );
    
    // Get all entries
    const q = query(
      collection(db, this.collection)
    );
    
    const querySnapshot = await getDocs(q);
    
    const entries = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        date: this.normalizeDate(data.date),
        clockIn: data.clockIn?.toDate ? data.clockIn.toDate() : new Date(data.clockIn),
        clockOut: data.clockOut?.toDate ? data.clockOut.toDate() : new Date(data.clockOut),
        submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : (data.submittedAt ? new Date(data.submittedAt) : undefined),
        lastEditedAt: data.lastEditedAt?.toDate ? data.lastEditedAt.toDate() : undefined,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      } as TimeEntry;
    });
    
    // Filter: supervisor's own entries (all statuses) + submitted entries from field users (not other supervisors)
    const filteredEntries = entries.filter(entry => {
      // Always show supervisor's own entries
      if (entry.userId === supervisorId) return true;
      
      // For other users' entries, only show if submitted AND not from another supervisor
      if (entry.status === 'submitted' && !supervisorUserIds.has(entry.userId)) return true;
      
      return false;
    });
    
    // Sort by creation time first (oldest first), then by date to maintain creation order
    const sortedEntries = filteredEntries.sort((a, b) => {
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
        date: this.normalizeDate(data.date),
        clockIn: data.clockIn.toDate(),
        clockOut: data.clockOut.toDate(),
        submittedAt: data.submittedAt?.toDate(),
        submittedBy: data.submittedBy,
        lastEditedBy: data.lastEditedBy,
        lastEditedAt: data.lastEditedAt?.toDate(),
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
  async submitTimeEntry(id: string, userId?: string): Promise<void> {
    const entry = await this.getTimeEntry(id);
    await this.updateTimeEntry(id, {
      status: 'submitted',
      isLocked: true,
      submittedAt: new Date(),
      submittedBy: userId || entry.userId,
    });
  }

  // Find all duplicate entries for a user/date/site combination (admin utility)
  async findAllDuplicates(): Promise<Array<{key: string, entries: TimeEntry[]}>> {
    const q = query(collection(db, this.collection));
    const snapshot = await getDocs(q);
    const entries: TimeEntry[] = snapshot.docs.map(doc => {
      const data = doc.data();
      let dateObj;
      if (data.date && 'toDate' in data.date && typeof (data.date as any).toDate === 'function') {
        dateObj = (data.date as any).toDate();
      } else {
        dateObj = new Date(data.date);
      }
      return {
        id: doc.id,
        ...data,
        date: dateObj,
        clockIn: data.clockIn?.toDate ? data.clockIn.toDate() : new Date(data.clockIn),
        clockOut: data.clockOut?.toDate ? data.clockOut.toDate() : new Date(data.clockOut),
        submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : (data.submittedAt ? new Date(data.submittedAt) : undefined),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      } as TimeEntry;
    });

    // Group by user+date+site
    const groups = new Map<string, TimeEntry[]>();
    entries.forEach(entry => {
      const key = `${entry.userId}-${entry.date.toISOString().split('T')[0]}-${entry.job || 'no-site'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    });

    // Return only groups with more than 1 entry
    return Array.from(groups.entries())
      .filter(([_, entries]) => entries.length > 1)
      .map(([key, entries]) => ({ key, entries }));
  }

  // Fix entries where userId was incorrectly changed (admin utility)
  async fixOrphanedEntries(validUserIds: string[]): Promise<number> {
    const q = query(collection(db, this.collection));
    const snapshot = await getDocs(q);
    let fixed = 0;
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const needsFix =
        // Case 1: userId is not a valid user but submittedBy is
        (!validUserIds.includes(data.userId) && data.submittedBy && validUserIds.includes(data.submittedBy)) ||
        // Case 2: userId doesn't match submittedBy (card was reassigned to wrong user)
        (data.submittedBy && data.userId !== data.submittedBy && validUserIds.includes(data.submittedBy));
      if (needsFix) {
        await updateDoc(doc(db, this.collection, docSnap.id), { userId: data.submittedBy });
        fixed++;
      }
    }
    return fixed;
  }

  // Calculate hours between clock in and clock out
  calculateHours(clockIn: Date, clockOut: Date): number {
    const diff = clockOut.getTime() - clockIn.getTime();
    const hours = diff / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100;
  }

  // Check if user can edit entry
  canEditEntry(entry: TimeEntry, user: User): boolean {
    // Admins and supervisors can always edit
    if (user.role === 'admin' || user.role === 'supervisor') {
      return true;
    }
    // Field users can only edit their own draft entries (not submitted or locked)
    // Treat undefined/null status as draft
    const isDraft = !entry.status || entry.status === 'draft';
    if (user.role === 'field' && entry.userId === user.id && isDraft && !entry.isLocked) return true;
    return false;
  }

  // Check if user can view entry (read-only access)
  canViewEntry(entry: TimeEntry, user: User): boolean {
    // Admins and supervisors can always view entries
    if (user.role === 'admin' || user.role === 'supervisor') return true;
    // Field users can only view their own draft/unsaved entries
    const isDraftOrUnsaved = !entry.status || entry.status === 'draft';
    if (user.role === 'field' && entry.userId === user.id && isDraftOrUnsaved && !entry.isLocked) return true;
    return false;
  }

  // Check if user can see entry in list (but not necessarily access it)
  // supervisorUserIds: Set of user IDs who are supervisors (optional, for filtering)
  canSeeEntry(entry: TimeEntry, user: User, supervisorUserIds?: Set<string>): boolean {
    if (user.role === 'admin') return true;
    
    if (user.role === 'supervisor') {
      // Supervisors can see their own entries
      if (entry.userId === user.id) return true;
      
      // If we have supervisor IDs, check if the entry belongs to another supervisor
      if (supervisorUserIds && supervisorUserIds.has(entry.userId)) {
        return false; // Don't show entries from other supervisors
      }
      
      // Show entries from field users
      return true;
    }
    
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
