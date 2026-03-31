import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * One-time utility to fix time entries where the userId was incorrectly changed.
 * Restores userId from the submittedBy field.
 */
export async function fixOrphanedEntry(entryId: string): Promise<void> {
  const docRef = doc(db, 'timeEntries', entryId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error(`Entry ${entryId} not found`);
  }

  const data = docSnap.data();
  console.log('Current entry data:', data);

  if (!data.submittedBy) {
    throw new Error('No submittedBy field found on entry');
  }

  // Restore userId from submittedBy
  await updateDoc(docRef, { userId: data.submittedBy });
  console.log(`Fixed entry ${entryId}: userId restored to ${data.submittedBy}`);
}
