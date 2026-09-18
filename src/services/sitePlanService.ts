import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';

/**
 * Site plans: drawings/PDFs/images attached to a site, uploaded by admins on
 * the site edit page and viewed by anyone from the Plans page. Files live in
 * Firebase Storage under site-plans/{siteId}/; this collection holds the
 * metadata. Unlike timecard attachments, files are stored as-is - no PDF
 * conversion, since plans need their original resolution.
 */

export interface SitePlan {
  id: string;
  siteId: string;
  /** Denormalized so the Plans page can group without a sites lookup. */
  siteName: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  contentType: string;
  uploadedBy: string;
  createdAt: Date;
}

class SitePlanService {
  private readonly collectionName = 'sitePlans';

  async uploadPlan(siteId: string, siteName: string, file: File, uploadedBy: string): Promise<string> {
    const safeName = file.name.replace(/[^\w.\-() ]/g, '_');
    const filePath = `site-plans/${siteId}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, filePath);

    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);

    const docRef = await addDoc(collection(db, this.collectionName), {
      siteId,
      siteName,
      fileName: file.name,
      fileUrl,
      filePath,
      contentType: file.type || 'application/octet-stream',
      uploadedBy,
      createdAt: Timestamp.fromDate(new Date())
    });

    return docRef.id;
  }

  async getPlansForSite(siteId: string): Promise<SitePlan[]> {
    const q = query(
      collection(db, this.collectionName),
      where('siteId', '==', siteId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.mapDoc(d.id, d.data()));
  }

  async getAllPlans(): Promise<SitePlan[]> {
    const q = query(collection(db, this.collectionName), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.mapDoc(d.id, d.data()));
  }

  async deletePlan(plan: SitePlan): Promise<void> {
    await deleteObject(ref(storage, plan.filePath));
    await deleteDoc(doc(db, this.collectionName, plan.id));
  }

  /** Keeps the denormalized siteName in sync when a site is renamed. */
  async renameSite(siteId: string, newName: string): Promise<void> {
    const plans = await this.getPlansForSite(siteId);
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    for (const plan of plans) {
      batch.update(doc(db, this.collectionName, plan.id), { siteName: newName });
    }
    await batch.commit();
  }

  private mapDoc(id: string, data: any): SitePlan {
    return {
      id,
      siteId: data.siteId ?? '',
      siteName: data.siteName ?? '',
      fileName: data.fileName ?? '',
      fileUrl: data.fileUrl ?? '',
      filePath: data.filePath ?? '',
      contentType: data.contentType ?? '',
      uploadedBy: data.uploadedBy ?? '',
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
    };
  }
}

export const sitePlanService = new SitePlanService();
