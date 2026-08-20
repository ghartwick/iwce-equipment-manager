import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { convertAttachmentToLetterPdf } from '../utils/attachmentConverter';

export interface MaintenanceAttachmentInput {
  maintenanceReportId: string;
  equipmentId: string;
  equipmentName: string;
  file: File;
  uploadedBy: string;
}

export interface MaintenanceAttachment {
  id?: string;
  maintenanceReportId: string;
  equipmentId: string;
  equipmentName: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  uploadedBy: string;
  createdAt: Date;
}

class MaintenanceAttachmentService {
  private readonly collectionName = 'maintenanceAttachments';

  async uploadAttachment(input: MaintenanceAttachmentInput): Promise<string> {
    const fileToUpload = await convertAttachmentToLetterPdf(input.file);
    const filePath = `maintenance-attachments/${input.maintenanceReportId}/${Date.now()}_${fileToUpload.name}`;
    const storageRef = ref(storage, filePath);

    await uploadBytes(storageRef, fileToUpload);
    const fileUrl = await getDownloadURL(storageRef);

    const docRef = await addDoc(collection(db, this.collectionName), {
      maintenanceReportId: input.maintenanceReportId,
      equipmentId: input.equipmentId,
      equipmentName: input.equipmentName,
      fileName: fileToUpload.name,
      fileUrl,
      filePath,
      uploadedBy: input.uploadedBy,
      createdAt: new Date()
    });

    return docRef.id;
  }

  async getAttachmentsForReport(maintenanceReportId: string): Promise<MaintenanceAttachment[]> {
    const q = query(
      collection(db, this.collectionName),
      where('maintenanceReportId', '==', maintenanceReportId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        maintenanceReportId: data.maintenanceReportId,
        equipmentId: data.equipmentId,
        equipmentName: data.equipmentName,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        filePath: data.filePath,
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

  async deleteAttachmentsForReport(maintenanceReportId: string): Promise<void> {
    const attachments = await this.getAttachmentsForReport(maintenanceReportId);
    await Promise.all(
      attachments.map(attachment => this.deleteAttachment(attachment.id!, attachment.filePath))
    );
  }
}

export const maintenanceAttachmentService = new MaintenanceAttachmentService();
