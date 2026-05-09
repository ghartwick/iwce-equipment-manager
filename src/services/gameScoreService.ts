import { collection, addDoc, getDocs, deleteDoc, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'gameScores';

export interface GameScore {
  id?: string;
  name: string;
  score: number;
  date: string;
  createdAt?: Date;
}

export async function saveGameScore(entry: Omit<GameScore, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, COLLECTION), {
    ...entry,
    createdAt: Timestamp.fromDate(new Date()),
  });
}

export async function getTopGameScores(n = 10): Promise<GameScore[]> {
  const q = query(collection(db, COLLECTION), orderBy('score', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      score: data.score,
      date: data.date,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    };
  });
}

export async function clearAllGameScores(): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTION));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}
