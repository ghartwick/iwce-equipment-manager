import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { convertAttachmentToLetterPdf } from '../utils/attachmentConverter';

export interface POLineItem {
  id: string;
  description: string;
  quantity: number;
  code: string;
}

export interface PurchaseOrder {
  id?: string;
  poNumber: number;
  to: string;
  site: string;
  items: POLineItem[];
  date: Date;
  submittedBy: string;
  submittedById?: string;
  createdAt: Date;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentPath?: string;
}

export interface PurchaseOrderInput {
  to: string;
  site: string;
  items: Omit<POLineItem, 'id'>[];
  date: Date;
  submittedBy: string;
  submittedById?: string;
  attachmentFile?: File;
}

class PurchaseOrderService {
  private readonly collectionName = 'purchaseOrders';

  async getNextPONumber(): Promise<number> {
    const q = query(collection(db, this.collectionName), orderBy('poNumber', 'desc'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 1;
    const max = snapshot.docs[0].data().poNumber as number;
    return max + 1;
  }

  async createPO(input: PurchaseOrderInput): Promise<string> {
    const poNumber = await this.getNextPONumber();

    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    let attachmentPath: string | undefined;

    if (input.attachmentFile) {
      const attachmentFile = await convertAttachmentToLetterPdf(input.attachmentFile);
      const path = `purchase-orders/PO-${poNumber}/${Date.now()}_${attachmentFile.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, attachmentFile);
      attachmentUrl = await getDownloadURL(storageRef);
      attachmentName = attachmentFile.name;
      attachmentPath = path;
    }

    const docRef = await addDoc(collection(db, this.collectionName), {
      poNumber,
      to: input.to,
      site: input.site,
      items: input.items,
      date: Timestamp.fromDate(input.date),
      submittedBy: input.submittedBy,
      ...(input.submittedById && { submittedById: input.submittedById }),
      createdAt: Timestamp.fromDate(new Date()),
      ...(attachmentUrl && { attachmentUrl, attachmentName, attachmentPath }),
    });

    return docRef.id;
  }

  async getPOsForRange(startDate: Date, endDate: Date): Promise<PurchaseOrder[]> {
    const q = query(
      collection(db, this.collectionName),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.mapDoc(d));
  }

  async getPOsForDate(date: Date): Promise<PurchaseOrder[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, this.collectionName),
      where('date', '>=', Timestamp.fromDate(startOfDay)),
      where('date', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.mapDoc(d));
  }

  async getAllPOs(): Promise<PurchaseOrder[]> {
    const q = query(collection(db, this.collectionName), orderBy('poNumber', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.mapDoc(d));
  }

  private mapDoc(docSnap: { id: string; data: () => Record<string, any> }): PurchaseOrder {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      poNumber: data.poNumber,
      to: data.to,
      site: data.site,
      items: (data.items ?? []) as POLineItem[],
      date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
      submittedBy: data.submittedBy,
      submittedById: data.submittedById,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      attachmentUrl: data.attachmentUrl,
      attachmentName: data.attachmentName,
      attachmentPath: data.attachmentPath,
    };
  }
}

export const purchaseOrderService = new PurchaseOrderService();
