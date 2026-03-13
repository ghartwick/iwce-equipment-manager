import { collection, addDoc, updateDoc, deleteDoc, getDocs, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Equipment, Category, StockAlert } from '../types';

// Equipment CRUD operations
export const getEquipment = async (): Promise<Equipment[]> => {
  const q = query(collection(db, 'equipment'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  const equipment = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Equipment[];
  
  return equipment;
};

export const addEquipment = async (equipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  await addDoc(collection(db, 'equipment'), {
    ...equipment,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
};

export const updateEquipment = async (id: string, equipment: Partial<Equipment>): Promise<void> => {
  const docRef = doc(db, 'equipment', id);
  await updateDoc(docRef, {
    ...equipment,
    updatedAt: new Date().toISOString()
  });
};

export const deleteEquipment = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'equipment', id));
};

// Category CRUD operations
export const getCategories = async (): Promise<Category[]> => {
  const querySnapshot = await getDocs(collection(db, 'categories'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Category[];
};

export const addCategory = async (category: Omit<Category, 'id'>): Promise<void> => {
  await addDoc(collection(db, 'categories'), category);
};

export const updateCategory = async (id: string, category: Partial<Category>): Promise<void> => {
  const docRef = doc(db, 'categories', id);
  await updateDoc(docRef, category);
};

export const deleteCategory = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'categories', id));
};

// Alert operations
export const getAlerts = async (): Promise<StockAlert[]> => {
  const querySnapshot = await getDocs(collection(db, 'alerts'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as StockAlert[];
};

export const addAlert = async (alert: Omit<StockAlert, 'id'>): Promise<void> => {
  await addDoc(collection(db, 'alerts'), alert);
};

export const deleteAlert = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'alerts', id));
};
