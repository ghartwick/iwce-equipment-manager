import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Invoice } from '../services/invoiceService';

const COMPANY_NAME = 'IWCE - SURVEY';

const currency = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Renders a "labelled field" with a grey label, a thin vertical divider and a
// bold value right-aligned to rightX (matches the "From" / "Invoice For" blocks).
function drawRightField(doc: jsPDF, label: string, value: string, rightX: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(25);
  doc.text(value, rightX, y, { align: 'right' });
  const valueW = doc.getTextWidth(value);
  const dividerX = rightX - valueW - 5;
  doc.setDrawColor(190);
  doc.setLineWidth(0.4);
  doc.line(dividerX, y - 3.5, dividerX, y + 0.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(label, dividerX - 3, y, { align: 'right' });
}

// Builds the invoice PDF modelled after the customer's sample (INVOICE 463).
export function generateInvoicePdf(invoice: Invoice, options?: { autoSave?: boolean }): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const rightX = pageW - margin;

  // Title + From block
  let y = margin + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(35);
  doc.text('INVOICE', margin, y);
  drawRightField(doc, 'From', COMPANY_NAME, rightX, y - 6);

  // Meta block
  y = margin + 34;
  const labelX = margin;
  const valueX = margin + 28;
  const metaRows: Array<[string, string, boolean]> = [
    ['Invoice ID', invoice.invoiceNumber, true],
    ['Issue Date', format(invoice.createdAt, 'MM/dd/yyyy'), false],
    ['Due Date', `${format(invoice.createdAt, 'MM/dd/yyyy')} (upon receipt)`, false],
    ['Subject', invoice.site || '—', false],
  ];
  doc.setFontSize(9.5);
  let my = y;
  for (const [label, value, bold] of metaRows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140);
    doc.text(label, labelX, my);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(45);
    doc.text(value, valueX, my);
    my += 6.5;
  }
  drawRightField(doc, 'Invoice For', invoice.clientName || '—', rightX, y);

  // Line items table
  const body = invoice.lineItems.map(li => [
    li.itemType,
    li.description,
    li.quantity.toFixed(2),
    currency(li.unitPrice),
    currency(li.amount),
  ]);

  autoTable(doc, {
    startY: my + 8,
    head: [['Item Type', 'Description', 'Quantity', 'Unit Price', 'Amount']],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [40, 40, 40],
      fontStyle: 'bold',
      lineColor: [215, 215, 215],
      lineWidth: 0.1,
    },
    bodyStyles: { textColor: [55, 55, 55], lineColor: [225, 225, 225], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: [244, 244, 244] },
    styles: { fontSize: 9, cellPadding: 2.6, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 'auto' },
      2: { halign: 'right', cellWidth: 22 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  // Amount Due
  y = (doc as any).lastAutoTable.finalY + 14;
  const amountStr = currency(invoice.total);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(15);
  doc.setTextColor(30);
  doc.text(amountStr, rightX, y, { align: 'right' });
  const amountW = doc.getTextWidth(amountStr);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Amount Due', rightX - amountW - 6, y, { align: 'right' });

  if (options?.autoSave !== false) {
    const safeClient = (invoice.clientName || 'invoice').replace(/[^\w-]+/g, '_');
    doc.save(`INVOICE_${invoice.invoiceNumber}_${safeClient}.pdf`);
  }
  return doc;
}
