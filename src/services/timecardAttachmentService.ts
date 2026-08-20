import { addDoc, collection, deleteDoc, doc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { convertAttachmentToLetterPdf } from '../utils/attachmentConverter';

export interface TimecardAttachmentInput {
  date: Date;
  site: string;
  code?: string;
  description?: string;
  file: File;
  uploadedBy: string;
}

export interface TimecardAttachment {
  id?: string;
  date: Date;
  site: string;
  code?: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  uploadedBy: string;
  createdAt: Date;
}

class TimecardAttachmentService {
  private readonly collectionName = 'timecardAttachments';

  async uploadAttachment(input: TimecardAttachmentInput): Promise<string> {
    const fileToUpload = await convertAttachmentToLetterPdf(input.file);
    const dateKey = this.formatDateKey(input.date);
    const filePath = `timecard-attachments/${dateKey}/${Date.now()}_${fileToUpload.name}`;
    const storageRef = ref(storage, filePath);

    await uploadBytes(storageRef, fileToUpload);
    const fileUrl = await getDownloadURL(storageRef);

    const docRef = await addDoc(collection(db, this.collectionName), {
      date: Timestamp.fromDate(input.date),
      site: input.site,
      code: input.code ?? '',
      description: input.description ?? '',
      fileName: fileToUpload.name,
      fileUrl,
      filePath,
      uploadedBy: input.uploadedBy,
      createdAt: Timestamp.fromDate(new Date())
    });

    return docRef.id;
  }

  async getAttachmentsForRange(startDate: Date, endDate: Date): Promise<TimecardAttachment[]> {
    const q = query(
      collection(db, this.collectionName),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate))
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const rawDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      return {
        id: docSnap.id,
        date: rawDate,
        site: data.site,
        code: data.code ?? '',
        description: data.description ?? '',
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        filePath: data.filePath,
        uploadedBy: data.uploadedBy,
        createdAt
      };
    });
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async deleteAttachment(attachmentId: string, filePath: string): Promise<void> {
    // Delete the file from Storage
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);

    // Delete the metadata from Firestore
    const docRef = doc(db, this.collectionName, attachmentId);
    await deleteDoc(docRef);
  }
}

export const timecardAttachmentService = new TimecardAttachmentService();
