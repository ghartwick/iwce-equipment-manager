import { collection, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export interface MigrationResult {
  fieldToolsMigrated: number;
  heavyEquipmentMigrated: number;
  errors: string[];
}

export const migrateToNewCollections = async (): Promise<MigrationResult> => {
  const result: MigrationResult = {
    fieldToolsMigrated: 0,
    heavyEquipmentMigrated: 0,
    errors: []
  };

  // Step 1: Migrate 'equipment' → 'fieldTools'
  try {
    const oldEquipmentSnapshot = await getDocs(collection(db, 'equipment'));
    for (const docSnap of oldEquipmentSnapshot.docs) {
      try {
        await setDoc(doc(db, 'fieldTools', docSnap.id), docSnap.data());
        await deleteDoc(doc(db, 'equipment', docSnap.id));
        result.fieldToolsMigrated++;
      } catch (e: any) {
        result.errors.push(`Field tool ${docSnap.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    result.errors.push(`Failed to read equipment collection: ${e.message}`);
  }

  // Step 2: Migrate 'timesheetEquipment' → 'heavyEquipment'
  try {
    const oldHeavySnapshot = await getDocs(collection(db, 'timesheetEquipment'));
    for (const docSnap of oldHeavySnapshot.docs) {
      try {
        await setDoc(doc(db, 'heavyEquipment', docSnap.id), docSnap.data());
        await deleteDoc(doc(db, 'timesheetEquipment', docSnap.id));
        result.heavyEquipmentMigrated++;
      } catch (e: any) {
        result.errors.push(`Heavy equipment ${docSnap.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    result.errors.push(`Failed to read timesheetEquipment collection: ${e.message}`);
  }

  return result;
};
