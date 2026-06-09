import { db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';

const COLLECTION = 'repairListChecked';

export interface RepairListCheckedItem {
  itemId: string;
  checkedBy: string;
  checkedAt: string;
}

export const repairListService = {
  getCheckedItems: async (): Promise<RepairListCheckedItem[]> => {
    const snapshot = await getDocs(collection(db, COLLECTION));
    return snapshot.docs.map(d => ({ itemId: d.id, ...d.data() } as RepairListCheckedItem));
  },

  checkItem: async (itemId: string, username: string): Promise<void> => {
    await setDoc(doc(db, COLLECTION, itemId), {
      checkedBy: username,
      checkedAt: new Date().toISOString(),
    });
  },

  uncheckItem: async (itemId: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTION, itemId));
  },
};
