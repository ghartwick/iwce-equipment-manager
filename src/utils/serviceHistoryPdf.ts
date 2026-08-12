import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface ServiceHistoryPdfEvent {
  date: string;
  kind: string;
  summary: string;
  user: string;
  details: string[];
}

export interface ServiceHistoryPdfInput {
  equipmentName: string;
  site?: string;
  events: ServiceHistoryPdfEvent[];
}

// Builds a printable maintenance / service / repair history for a single unit.
// Each event renders as a row with an indented detail block so the exported PDF
// contains the full contents of every maintenance and service card.
export function generateServiceHistoryPdf(input: ServiceHistoryPdfInput): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const margin = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Service & Repair History', margin, 18);

  doc.setFontSize(12);
  doc.text(input.equipmentName, margin, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  const subtitle = [input.site ? `Site: ${input.site}` : null, `Generated ${format(new Date(), 'MMM d, yyyy HH:mm')}`]
    .filter(Boolean)
    .join('   |   ');
  doc.text(subtitle, margin, 32);
  doc.setTextColor(0);

  if (input.events.length === 0) {
    doc.setFontSize(10);
    doc.text('No history recorded for this unit.', margin, 44);
    doc.save(`${input.equipmentName}-service-history.pdf`);
    return;
  }

  const body = input.events.map(e => [
    format(new Date(e.date), 'MMM d, yyyy HH:mm'),
    e.kind,
    [e.summary, ...e.details.map(d => `  - ${d}`)].join('\n'),
    e.user,
  ]);

  autoTable(doc, {
    startY: 38,
    head: [['Date', 'Type', 'Details', 'User']],
    body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [202, 138, 4], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 26 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 26 },
    },
    margin: { left: margin, right: margin },
  });

  doc.save(`${input.equipmentName}-service-history.pdf`);
}
