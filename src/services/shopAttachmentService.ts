import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';

export interface ShopAttachmentInput {
  shopReportId: string;
  equipmentId: string;
  equipmentName: string;
  file: File;
  thumbnailUrl?: string;
  uploadedBy: string;
}

export interface ShopAttachment {
  id?: string;
  shopReportId: string;
  equipmentId: string;
  equipmentName: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  createdAt: Date;
}

class ShopAttachmentService {
  private readonly collectionName = 'shopAttachments';

  async uploadAttachment(input: ShopAttachmentInput): Promise<string> {
    const filePath = `shop-attachments/${input.shopReportId}/${Date.now()}_${input.file.name}`;
    const storageRef = ref(storage, filePath);

    await uploadBytes(storageRef, input.file);
    const fileUrl = await getDownloadURL(storageRef);

    const docRef = await addDoc(collection(db, this.collectionName), {
      shopReportId: input.shopReportId,
      equipmentId: input.equipmentId,
      equipmentName: input.equipmentName,
      fileName: input.file.name,
      fileUrl,
      filePath,
      thumbnailUrl: input.thumbnailUrl,
      uploadedBy: input.uploadedBy,
      createdAt: new Date()
    });

    return docRef.id;
  }

  async getAttachmentsForReport(shopReportId: string): Promise<ShopAttachment[]> {
    const q = query(
      collection(db, this.collectionName),
      where('shopReportId', '==', shopReportId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        shopReportId: data.shopReportId,
        equipmentId: data.equipmentId,
        equipmentName: data.equipmentName,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        filePath: data.filePath,
        thumbnailUrl: data.thumbnailUrl,
        uploadedBy: data.uploadedBy,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      };
    });
  }

  async deleteAttachment(attachmentId: string, filePath: string): Promise<void> {
    // Delete the file from Storage
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);

    // Delete the metadata from Firestore
    const docRef = doc(db, this.collectionName, attachmentId);
    await deleteDoc(docRef);
  }

  async deleteAttachmentsForReport(shopReportId: string): Promise<void> {
    const attachments = await this.getAttachmentsForReport(shopReportId);
    await Promise.all(
      attachments.map(attachment => this.deleteAttachment(attachment.id!, attachment.filePath))
    );
  }
}

export const shopAttachmentService = new ShopAttachmentService();
