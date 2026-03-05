import * as XLSX from 'xlsx';
import { Equipment } from '../types';

export function exportToExcel(equipment: Equipment[], filename: string = 'equipment-list') {
  // Prepare data for export
  const exportData = equipment.map(item => ({
    'Equipment Name': item.name,
    'Employee': item.employee || '',
    'Site': item.site || '',
    'Category': item.category,
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
