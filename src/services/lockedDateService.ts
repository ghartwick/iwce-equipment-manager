import { collection, deleteDoc, doc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface LockedDate {
  id?: string;
  date: Date;
  lockedBy: string;
  lockedAt: Date;
}

class LockedDateService {
  private readonly collectionName = 'lockedDates';

  async lockDate(date: Date, userId: string): Promise<string> {
    const dateKey = this.formatDateKey(date);
    const docRef = doc(db, this.collectionName, dateKey);
    await setDoc(docRef, {
      date: Timestamp.fromDate(date),
      lockedBy: userId,
      lockedAt: Timestamp.fromDate(new Date())
    });
    return dateKey;
  }

  async unlockDate(date: Date): Promise<void> {
    const dateKey = this.formatDateKey(date);
    const docRef = doc(db, this.collectionName, dateKey);
    await deleteDoc(docRef);
  }

  async getLockedDates(startDate: Date, endDate: Date): Promise<Set<string>> {
    const q = query(
      collection(db, this.collectionName),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate))
    );
    const snapshot = await getDocs(q);
    const lockedDates = new Set<string>();
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const rawDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
      lockedDates.add(this.formatDateKey(rawDate));
    });
    return lockedDates;
  }

  async isDateLocked(date: Date): Promise<boolean> {
    const dateKey = this.formatDateKey(date);
    const snapshot = await getDocs(query(collection(db, this.collectionName), where('__name__', '==', dateKey)));
    return !snapshot.empty;
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export const lockedDateService = new LockedDateService();
