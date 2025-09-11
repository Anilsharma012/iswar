import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { IInvoice } from '../models';

interface PDFInvoice extends IInvoice {
  clientId: {
    name: string;
    phone: string;
    address: string;
    gstin?: string;
  };
  items: Array<{
    productId: {
      name: string;
      unitType: string;
    };
    desc?: string;
    unitType: string;
    qty: number;
    rate: number;
    taxPct?: number;
  }>;
}

const translations = {
  en: {
    invoice: 'INVOICE',
    company: 'Mannat Tent House',
    invoiceNo: 'Invoice No',
    date: 'Date',
    billTo: 'Bill To',
    gstin: 'GSTIN',
    description: 'Description',
    unit: 'Unit',
    qty: 'Qty',
    rate: 'Rate',
    amount: 'Amount',
    tax: 'Tax',
    subtotal: 'Subtotal',
    discount: 'Discount',
    roundOff: 'Round Off',
    grandTotal: 'Grand Total',
    paid: 'Paid',
    pending: 'Pending',
    thankYou: 'Thank you for your business!'
  },
  hi: {
    invoice: 'चालान',
    company: 'मन्नत टेंट हाउस',
    invoiceNo: 'चालान संख्या',
    date: 'दिनांक',
    billTo: 'बिल प्राप्तकर्ता',
    gstin: 'जीएसटीआईएन',
    description: 'विवरण',
    unit: 'इकाई',
    qty: 'मात्रा',
    rate: 'दर',
    amount: 'राशि',
    tax: 'कर',
    subtotal: 'उप योग',
    discount: 'छूट',
    roundOff: 'राउंड ऑफ',
    grandTotal: 'कुल योग',
    paid: 'भुगतान',
    pending: 'बकाया',
    thankYou: 'आपके व्यापार के लिए धन्यवाद!'
  }
};

export const generateInvoicePDF = (
  invoice: PDFInvoice,
  language: 'en' | 'hi' = 'en',
  res: Response
) => {
  const doc = new PDFDocument({ margin: 50 });
  const t = translations[language];

  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.number}.pdf`);

  // Pipe the PDF to response
  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text(t.company, 50, 50);
  doc.fontSize(16).text(t.invoice, 50, 80);

  // Invoice details
  doc.fontSize(12).font('Helvetica');
  doc.text(`${t.invoiceNo}: ${invoice.number}`, 350, 50);
  doc.text(`${t.date}: ${new Date(invoice.date).toLocaleDateString()}`, 350, 70);

  // Bill to section
  doc.fontSize(14).font('Helvetica-Bold').text(t.billTo, 50, 130);
  doc.fontSize(12).font('Helvetica');
  doc.text(invoice.clientId.name, 50, 150);
  doc.text(invoice.clientId.phone, 50, 165);
  doc.text(invoice.clientId.address, 50, 180);
  
  if (invoice.withGST && invoice.clientId.gstin) {
    doc.text(`${t.gstin}: ${invoice.clientId.gstin}`, 50, 195);
  }

  // Table header
  const tableTop = 230;
  const itemCodeX = 50;
  const descriptionX = 150;
  const unitX = 300;
  const qtyX = 350;
  const rateX = 400;
  const amountX = 480;

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(t.description, descriptionX, tableTop);
  doc.text(t.unit, unitX, tableTop);
  doc.text(t.qty, qtyX, tableTop);
  doc.text(t.rate, rateX, tableTop);
  doc.text(t.amount, amountX, tableTop);

  if (invoice.withGST) {
    const taxX = 530;
    doc.text(t.tax, taxX, tableTop);
  }

  // Draw line under header
  doc.strokeColor('#000000').lineWidth(1)
     .moveTo(50, tableTop + 15)
     .lineTo(550, tableTop + 15)
     .stroke();

  // Table items
  let y = tableTop + 25;
  doc.font('Helvetica').fontSize(9);

  invoice.items.forEach((item) => {
    const lineAmount = item.qty * item.rate;
    const taxAmount = invoice.withGST && item.taxPct ? 
      (lineAmount * (item.taxPct / 100)) : 0;

    doc.text(item.desc || item.productId.name, descriptionX, y, { width: 140 });
    doc.text(item.unitType, unitX, y);
    doc.text(item.qty.toString(), qtyX, y);
    doc.text(`₹${item.rate.toFixed(2)}`, rateX, y);
    doc.text(`₹${lineAmount.toFixed(2)}`, amountX, y);

    if (invoice.withGST && taxAmount > 0) {
      doc.text(`₹${taxAmount.toFixed(2)}`, 530, y);
    }

    y += 20;
  });

  // Draw line before totals
  y += 10;
  doc.strokeColor('#000000').lineWidth(1)
     .moveTo(300, y)
     .lineTo(550, y)
     .stroke();

  // Totals section
  y += 20;
  const totalsX = 350;
  const amountColumn = 480;

  doc.fontSize(10).font('Helvetica');
  doc.text(`${t.subtotal}:`, totalsX, y);
  doc.text(`₹${invoice.totals.subTotal.toFixed(2)}`, amountColumn, y);

  if (invoice.withGST && invoice.totals.tax > 0) {
    y += 15;
    doc.text(`${t.tax}:`, totalsX, y);
    doc.text(`₹${invoice.totals.tax.toFixed(2)}`, amountColumn, y);
  }

  if (invoice.totals.discount && invoice.totals.discount > 0) {
    y += 15;
    doc.text(`${t.discount}:`, totalsX, y);
    doc.text(`-₹${invoice.totals.discount.toFixed(2)}`, amountColumn, y);
  }

  if (invoice.totals.roundOff && invoice.totals.roundOff !== 0) {
    y += 15;
    doc.text(`${t.roundOff}:`, totalsX, y);
    doc.text(`₹${invoice.totals.roundOff.toFixed(2)}`, amountColumn, y);
  }

  // Grand total
  y += 20;
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text(`${t.grandTotal}:`, totalsX, y);
  doc.text(`₹${invoice.totals.grandTotal.toFixed(2)}`, amountColumn, y);

  // Payment details
  if (invoice.totals.paid > 0 || invoice.totals.pending > 0) {
    y += 20;
    doc.fontSize(10).font('Helvetica');
    doc.text(`${t.paid}:`, totalsX, y);
    doc.text(`₹${invoice.totals.paid.toFixed(2)}`, amountColumn, y);

    y += 15;
    doc.text(`${t.pending}:`, totalsX, y);
    doc.text(`₹${invoice.totals.pending.toFixed(2)}`, amountColumn, y);
  }

  // Footer
  doc.fontSize(10).font('Helvetica-Oblique')
     .text(t.thankYou, 50, doc.page.height - 100, { align: 'center' });

  // Finalize the PDF
  doc.end();
};
