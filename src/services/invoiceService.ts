import { collection, addDoc, getDoc, getDocs, deleteDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../firebase';
import { SurveyTimeEntry } from './surveyTimecardService';

export interface InvoiceLineItem {
  entryId: string;
  // Shown in the first ("Item Type") column: the role for work rows
  // (e.g. "Office", "Field"), "Travel", or "Product" for expenses.
  itemType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Expand survey time entries into granular invoice rows matching the sample
// invoice layout: one Service row per work role, an optional travel Service
// row, and one Product row per expense.
export function buildInvoiceLineItems(entries: SurveyTimeEntry[]): InvoiceLineItem[] {
  const rows: InvoiceLineItem[] = [];
  for (const e of entries) {
    const dateStr = format(e.date, 'MMMM d, yyyy');
    const works =
      e.workEntries && e.workEntries.length > 0
        ? e.workEntries
        : [
            {
              id: e.id || '',
              roleName: e.roleName,
              roleCostPerHour: e.roleCostPerHour,
              hours: e.hours,
              expenses: e.expenses,
              notes: e.notes,
            },
          ];
    const travelRate = works[0]?.roleCostPerHour || e.roleCostPerHour || 0;

    works.forEach(w => {
      if (w.hours > 0 || w.roleName) {
        rows.push({
          entryId: e.id || '',
          itemType: w.roleName || 'Service',
          description: w.notes ? `${dateStr} - ${w.notes}` : dateStr,
          quantity: w.hours,
          unitPrice: w.roleCostPerHour,
          amount: round2(w.hours * w.roleCostPerHour),
        });
      }
    });

    if (e.travelHours && e.travelHours > 0) {
      rows.push({
        entryId: e.id || '',
        itemType: 'Travel',
        description: dateStr,
        quantity: e.travelHours,
        unitPrice: travelRate,
        amount: round2(e.travelHours * travelRate),
      });
    }

    const expenses =
      e.workEntries && e.workEntries.length > 0
        ? e.workEntries.flatMap(w => w.expenses)
        : e.expenses;
    expenses.forEach(ex => {
      if (!ex.name && !ex.dollarValue) return;
      rows.push({
        entryId: e.id || '',
        itemType: 'Product',
        description: ex.name ? `${dateStr} - ${ex.name}` : dateStr,
        quantity: ex.quantity,
        unitPrice: ex.dollarValue,
        amount: round2(ex.quantity * ex.dollarValue),
      });
    });
  }
  return rows;
}

export interface Invoice {
  id?: string;
  invoiceNumber: string;
  seq: number;
  clientId: string;
  clientName: string;
  site: string;
  entryIds: string[];
  lineItems: InvoiceLineItem[];
  subtotal: number;
  total: number;
  dateFrom: Date;
  dateTo: Date;
  createdAt: Date;
  createdBy: string;
  createdByName?: string;
}

class InvoiceService {
  private readonly collectionName = 'invoices';

  private mapDoc(id: string, data: any): Invoice {
    const toDate = (v: any): Date =>
      v?.toDate ? v.toDate() : (v ? new Date(v) : new Date());
    return {
      id,
      invoiceNumber: data.invoiceNumber || '',
      seq: typeof data.seq === 'number' ? data.seq : parseInt(data.seq) || 0,
      clientId: data.clientId || '',
      clientName: data.clientName || '',
      site: data.site || '',
      entryIds: data.entryIds || [],
      lineItems: (data.lineItems || []).map((li: any) => ({
        entryId: li.entryId || '',
        itemType: li.itemType || 'Service',
        description: li.description || '',
        quantity: Number(li.quantity) || 0,
        unitPrice: Number(li.unitPrice) || 0,
        amount: Number(li.amount) || 0,
      })),
      subtotal: Number(data.subtotal) || 0,
      total: Number(data.total) || 0,
      dateFrom: toDate(data.dateFrom),
      dateTo: toDate(data.dateTo),
      createdAt: toDate(data.createdAt),
      createdBy: data.createdBy || '',
      createdByName: data.createdByName || '',
    };
  }

  async getAllInvoices(): Promise<Invoice[]> {
    const snapshot = await getDocs(collection(db, this.collectionName));
    return snapshot.docs
      .map(d => this.mapDoc(d.id, d.data()))
      .sort((a, b) => b.seq - a.seq);
  }

  async getInvoicesForClient(clientId: string): Promise<Invoice[]> {
    const q = query(collection(db, this.collectionName), where('clientId', '==', clientId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.mapDoc(d.id, d.data())).sort((a, b) => b.seq - a.seq);
  }

  async getInvoice(id: string): Promise<Invoice> {
    const snapshot = await getDoc(doc(db, this.collectionName, id));
    if (!snapshot.exists()) throw new Error('Invoice not found');
    return this.mapDoc(snapshot.id, snapshot.data());
  }

  // Determine the next sequential invoice number (plain integer, e.g. 1, 2, 3).
  async getNextInvoiceNumber(): Promise<{ seq: number; invoiceNumber: string }> {
    const snapshot = await getDocs(collection(db, this.collectionName));
    const maxSeq = snapshot.docs.reduce((max, d) => {
      const seq = typeof d.data().seq === 'number' ? d.data().seq : parseInt(d.data().seq) || 0;
      return Math.max(max, seq);
    }, 0);
    const seq = maxSeq + 1;
    return { seq, invoiceNumber: String(seq) };
  }

  async deleteInvoice(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }

  async createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...invoice,
      dateFrom: Timestamp.fromDate(invoice.dateFrom),
      dateTo: Timestamp.fromDate(invoice.dateTo),
      createdAt: Timestamp.fromDate(new Date()),
    });
    return docRef.id;
  }
}

export const invoiceService = new InvoiceService();
