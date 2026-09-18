import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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

  // Sorted client-side: a where+orderBy combo would need a composite index
  // that isn't declared anywhere in this project.
  async getPlansForSite(siteId: string): Promise<SitePlan[]> {
    const q = query(collection(db, this.collectionName), where('siteId', '==', siteId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => this.mapDoc(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllPlans(): Promise<SitePlan[]> {
    const snapshot = await getDocs(collection(db, this.collectionName));
    return snapshot.docs
      .map(d => this.mapDoc(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Downloads a plan with its original filename. The `download` attribute is
   * ignored on cross-origin URLs, so we fetch the bytes and save via blob. */
  async downloadPlan(plan: SitePlan): Promise<void> {
    const res = await fetch(plan.fileUrl);
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = plan.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
