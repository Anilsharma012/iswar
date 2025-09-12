import { Response } from "express";
import mongoose from "mongoose";
import { Invoice, Payment } from "../models";
import { AuthRequest } from "../utils/auth";
import { invoicePaymentSchema } from "../utils/validation";

export const createInvoicePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = invoicePaymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { invoiceId, amount, mode, ref, at } = value;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const currentPaid = Number(invoice.totals?.paid || 0);
    const grand = Number(invoice.totals?.grandTotal || 0);
    const pendingBefore = Math.max(0, grand - currentPaid);

    if (amount <= 0) return res.status(400).json({ error: "Amount must be > 0" });

    const credit = Math.min(Number(amount), pendingBefore);

    // Record payment
    const payment = new Payment({
      invoiceId: invoice._id,
      amount: credit,
      mode,
      ref: ref || undefined,
      date: new Date(at),
    });
    await payment.save();

    // Update invoice totals
    const newPaid = Number((currentPaid + credit).toFixed(2));
    const newPending = Math.max(0, Number((grand - newPaid).toFixed(2)));

    invoice.totals.paid = newPaid;
    invoice.totals.pending = newPending;

    // Keep status enum intact; UI will show green when pending == 0
    await invoice.save();

    const populated = await Invoice.findById(invoice._id)
      .populate("clientId", "name phone")
      .populate("items.productId", "name unitType");

    res.status(201).json({ payment, invoice: populated });
  } catch (err: any) {
    console.error("Create invoice payment error:", err);
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};
