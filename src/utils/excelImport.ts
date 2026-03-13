import * as XLSX from 'xlsx';

export interface ImportedRow {
  name: string;
  description?: string;
}

/**
 * Parse an Excel or CSV file and extract rows with name and optional description columns.
 * Accepts .xlsx, .xls, and .csv files.
 * Looks for columns named "name" and "description" (case-insensitive).
 * If no header match, assumes first column is name, second is description.
 */
export function parseExcelFile(file: File): Promise<ImportedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with header detection
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          reject(new Error('The file is empty or has no data rows.'));
          return;
        }

        // Try to find name and description columns (case-insensitive)
        const firstRow = jsonData[0];
        const keys = Object.keys(firstRow);

        let nameKey = keys.find(k => k.toLowerCase().trim() === 'name');
        let descKey = keys.find(k => k.toLowerCase().trim() === 'description');

        // If no "name" column found, use first column as name
        if (!nameKey) {
          nameKey = keys[0];
        }
        // If no "description" column found, use second column if available
        if (!descKey && keys.length > 1) {
          descKey = keys[1] !== nameKey ? keys[1] : undefined;
        }

        const rows: ImportedRow[] = jsonData
          .map((row) => ({
            name: String(row[nameKey!] || '').trim(),
            description: descKey ? String(row[descKey] || '').trim() : ''
          }))
          .filter((row) => row.name.length > 0);

        if (rows.length === 0) {
          reject(new Error('No valid entries found in the file. Make sure there is a "Name" column.'));
          return;
        }

        resolve(rows);
      } catch (err) {
        reject(new Error('Failed to parse the file. Please ensure it is a valid Excel or CSV file.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the file.'));
    };

    reader.readAsArrayBuffer(file);
  });
}
