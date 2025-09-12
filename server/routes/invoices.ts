import { Response } from 'express';
import mongoose from 'mongoose';
import { Invoice, Product, StockLedger, IssueRegister, Client } from '../models';
import { AuthRequest } from '../utils/auth';
import { invoiceSchema } from '../utils/validation';
import { generateInvoiceNumber } from '../utils/invoiceNumber';
import { generateInvoicePDF } from '../utils/pdfGenerator';

export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      clientId = '',
      status = '',
      fromDate = '',
      toDate = ''
    } = req.query;
    
    const query: any = {};
    
    if (search) {
      query.number = { $regex: search, $options: 'i' };
    }
    
    if (clientId) {
      query.clientId = clientId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate as string);
      if (toDate) query.date.$lte = new Date(toDate as string);
    }

    const invoices = await Invoice.find(query)
      .populate('clientId', 'name phone')
      .populate('items.productId', 'name unitType')
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1 });

    const total = await Invoice.countDocuments(query);

    res.json({
      invoices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('clientId')
      .populate('items.productId');
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createInvoice = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { error, value } = invoiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();
    
    // Create invoice
    const invoice = new Invoice({
      ...value,
      number: invoiceNumber
    });

    // If invoice is being finalized, update stock
    if (value.status === 'final') {
      for (const item of value.items) {
        // Skip adjustments (damage/shortage/late) which are not actual products to decrement
        if ((item as any).isAdjustment) continue;

        const product = await Product.findById(item.productId).session(session);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (product.stockQty < item.qty) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stockQty}, Required: ${item.qty}`);
        }

        // Update product stock
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stockQty: -item.qty } },
          { session }
        );

        // Create stock ledger entry
        const stockEntry = new StockLedger({
          productId: item.productId,
          qtyChange: -item.qty,
          reason: 'invoice',
          refType: 'Invoice',
          refId: invoice._id
        });
        await stockEntry.save({ session });

        // Create or update issue register
        await IssueRegister.findOneAndUpdate(
          { productId: item.productId, clientId: value.clientId },
          {
            $inc: { qtyIssued: item.qty },
            $setOnInsert: {
              issueDate: new Date(),
              qtyReturned: 0,
              returnDates: []
            }
          },
          { upsert: true, session }
        );
      }
    }

    await invoice.save({ session });
    await session.commitTransaction();
    
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('clientId')
      .populate('items.productId');
    
    res.status(201).json(populatedInvoice);
  } catch (error) {
    await session.abortTransaction();
    console.error('Create invoice error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  } finally {
    session.endSession();
  }
};

export const updateInvoice = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { error, value } = invoiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingInvoice = await Invoice.findById(req.params.id).session(session);
    if (!existingInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // If changing from final to draft, reverse stock changes
    if (existingInvoice.status === 'final' && value.status === 'draft') {
      for (const item of existingInvoice.items) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stockQty: item.qty } },
          { session }
        );
        
        // Remove stock ledger entries
        await StockLedger.deleteMany({
          productId: item.productId,
          refType: 'Invoice',
          refId: existingInvoice._id
        }).session(session);
        
        // Update issue register
        await IssueRegister.findOneAndUpdate(
          { productId: item.productId, clientId: existingInvoice.clientId },
          { $inc: { qtyIssued: -item.qty } },
          { session }
        );
      }
    }

    // If changing from draft to final, apply stock changes
    if (existingInvoice.status === 'draft' && value.status === 'final') {
      for (const item of value.items) {
        const product = await Product.findById(item.productId).session(session);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }
        
        if (product.stockQty < item.qty) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stockQty}, Required: ${item.qty}`);
        }
        
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stockQty: -item.qty } },
          { session }
        );
        
        const stockEntry = new StockLedger({
          productId: item.productId,
          qtyChange: -item.qty,
          reason: 'invoice',
          refType: 'Invoice',
          refId: existingInvoice._id
        });
        await stockEntry.save({ session });
        
        await IssueRegister.findOneAndUpdate(
          { productId: item.productId, clientId: value.clientId },
          {
            $inc: { qtyIssued: item.qty },
            $setOnInsert: { 
              issueDate: new Date(),
              qtyReturned: 0,
              returnDates: []
            }
          },
          { upsert: true, session }
        );
      }
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      value,
      { new: true, runValidators: true, session }
    );

    await session.commitTransaction();
    
    const populatedInvoice = await Invoice.findById(updatedInvoice!._id)
      .populate('clientId')
      .populate('items.productId');
    
    res.json(populatedInvoice);
  } catch (error) {
    await session.abortTransaction();
    console.error('Update invoice error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  } finally {
    session.endSession();
  }
};

export const deleteInvoice = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const invoice = await Invoice.findById(req.params.id).session(session);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // If invoice was finalized, restore stock
    if (invoice.status === 'final') {
      for (const item of invoice.items) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stockQty: item.qty } },
          { session }
        );
        
        await StockLedger.deleteMany({
          productId: item.productId,
          refType: 'Invoice',
          refId: invoice._id
        }).session(session);
        
        await IssueRegister.findOneAndUpdate(
          { productId: item.productId, clientId: invoice.clientId },
          { $inc: { qtyIssued: -item.qty } },
          { session }
        );
      }
    }

    await Invoice.findByIdAndDelete(req.params.id).session(session);
    await session.commitTransaction();
    
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    session.endSession();
  }
};

export const returnInvoice = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const invoice = await Invoice.findById(req.params.id).session(session);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    if (invoice.status !== 'final') {
      return res.status(400).json({ error: 'Only final invoices can be returned' });
    }

    // Restore stock for all items
    for (const item of invoice.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stockQty: item.qty } },
        { session }
      );
      
      // Create return stock ledger entry
      const stockEntry = new StockLedger({
        productId: item.productId,
        qtyChange: item.qty,
        reason: 'return',
        refType: 'Return',
        refId: invoice._id
      });
      await stockEntry.save({ session });
      
      // Update issue register
      await IssueRegister.findOneAndUpdate(
        { productId: item.productId, clientId: invoice.clientId },
        {
          $inc: { qtyReturned: item.qty },
          $push: { returnDates: new Date() }
        },
        { session }
      );
    }

    // Update invoice status
    invoice.status = 'returned';
    await invoice.save({ session });
    
    await session.commitTransaction();
    res.json({ message: 'Invoice returned successfully', invoice });
  } catch (error) {
    await session.abortTransaction();
    console.error('Return invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    session.endSession();
  }
};

export const generateInvoicePDFRoute = async (req: AuthRequest, res: Response) => {
  try {
    const { lang = 'en', gst } = req.query;

    const invoice = await Invoice.findById(req.params.id)
      .populate('clientId')
      .populate('items.productId', 'name unitType');

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const language = lang === 'hi' ? 'hi' : 'en';

    // Override GST setting if specified in query
    if (gst !== undefined) {
      invoice.withGST = gst === 'true';
    }

    generateInvoicePDF(invoice as any, language, res);
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
