import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';

export interface EquipmentPhoto {
  id: string;
  equipmentId: string;
  fileUrl: string;
  filePath: string;
  fileName: string;
  uploadedBy: string;
  createdAt: string;
}

class EquipmentPhotoService {
  private readonly collectionName = 'equipmentPhotos';

  async uploadPhoto(equipmentId: string, file: File, uploadedBy: string): Promise<EquipmentPhoto> {
    const filePath = `equipment-photos/${equipmentId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);

    const docRef = await addDoc(collection(db, this.collectionName), {
      equipmentId,
      fileUrl,
      filePath,
      fileName: file.name,
      uploadedBy,
      createdAt: new Date().toISOString(),
    });

    return { id: docRef.id, equipmentId, fileUrl, filePath, fileName: file.name, uploadedBy, createdAt: new Date().toISOString() };
  }

  async getPhotosForEquipment(equipmentId: string): Promise<EquipmentPhoto[]> {
    const q = query(collection(db, this.collectionName), where('equipmentId', '==', equipmentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EquipmentPhoto));
  }

  async deletePhoto(photoId: string, filePath: string): Promise<void> {
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
    await deleteDoc(doc(db, this.collectionName, photoId));
  }
}

export const equipmentPhotoService = new EquipmentPhotoService();
