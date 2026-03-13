import * as XLSX from 'xlsx';
import { Equipment, Category } from '../types';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export function exportToExcel(equipment: Equipment[], filename: string = 'equipment-list', categories: Category[] = []) {
  // Create category ID to name mapping
  const categoryMap = new Map<string, string>();
  categories.forEach(category => {
    categoryMap.set(category.id, category.name);
  });
  
  // Prepare data for export
  const exportData = equipment.map(item => ({
    'Equipment Name': item.name,
    'Employee': item.employee || '',
    'Site': item.site || '',
    'Category': categoryMap.get(item.category) || item.category || '', // Convert ID to name
    'Serial Number': item.serialNumber,
    'Repair Status': item.repair ? 'Yes' : 'No',
    'Repair Description': item.repairDescription || '',
    'Created Date': new Date(item.createdAt).toLocaleDateString(),
    'Last Updated': new Date(item.updatedAt).toLocaleDateString()
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);

  // Set column widths
  const colWidths = [
    { wch: 20 }, // Equipment Name
    { wch: 15 }, // Employee
    { wch: 15 }, // Site
    { wch: 15 }, // Category
    { wch: 15 }, // Serial Number
    { wch: 12 }, // Repair Status
    { wch: 30 }, // Repair Description
    { wch: 12 }, // Created Date
    { wch: 12 }, // Last Updated
  ];
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Equipment List');

  // Generate Excel file and download
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export interface ImportedEquipment {
  'Equipment Name': string;
  'Employee'?: string;
  'Site'?: string;
  'Category': string;
  'Serial Number'?: string;
  'Repair Status'?: string;
  'Repair Description'?: string;
}

export function importFromExcel(file: File, existingCategories: Category[]): Promise<Partial<Equipment>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first worksheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ImportedEquipment[];
        
        // Map to Equipment format and handle categories
        const equipmentData: Partial<Equipment>[] = [];
        const categoryNames = existingCategories.map(cat => cat.name.toLowerCase());
        const categoryMap = new Map<string, string>(); // name -> id mapping
        
        // Create category name to ID mapping
        existingCategories.forEach(category => {
          categoryMap.set(category.name.toLowerCase(), category.id);
        });
        
        for (const row of jsonData) {
          // Validate required fields
          if (!row['Equipment Name'] || !row['Category']) {
            console.warn(`Row ${jsonData.indexOf(row) + 1}: Missing required fields (Equipment Name or Category)`);
            continue;
          }
          
          const categoryName = row['Category']?.trim();
          
          let categoryId = '';
          
          // Create category if it doesn't exist
          if (categoryName && !categoryNames.includes(categoryName.toLowerCase())) {
            try {
              // Create the category and get its ID
              const docRef = await addDoc(collection(db, 'categories'), {
                name: categoryName,
                description: `Category for ${categoryName} equipment`,
                color: '#FFB700' // Default gold color
              });
              
              categoryId = docRef.id; // Get the ID of the newly created category
              categoryNames.push(categoryName.toLowerCase());
              categoryMap.set(categoryName.toLowerCase(), categoryId);
            } catch (error) {
              console.error(`Failed to create category ${categoryName}:`, error);
            }
          } else {
            categoryId = categoryMap.get(categoryName.toLowerCase()) || '';
          }
          
          equipmentData.push({
            name: row['Equipment Name']?.trim() || '',
            employee: row['Employee']?.trim() || '',
            site: row['Site']?.trim() || '',
            category: categoryId, // Store category ID instead of name
            serialNumber: row['Serial Number']?.trim() || '',
            repair: row['Repair Status']?.toLowerCase() === 'yes',
            repairDescription: row['Repair Description']?.trim() || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
        resolve(equipmentData);
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + error));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
