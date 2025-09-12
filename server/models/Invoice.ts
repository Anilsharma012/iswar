import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IInvoiceItem {
  productId: Types.ObjectId;
  desc?: string;
  unitType: "pcs" | "meter" | "sqft" | "sqyd" | "sqmt";
  qty: number;
  rate: number;
  taxPct?: number;
}

export interface IInvoiceTotals {
  subTotal: number;
  tax: number;
  discount?: number;
  roundOff?: number;
  grandTotal: number;
  paid: number;
  pending: number;
}

export interface IInvoice extends Document {
  number: string;
  clientId: Types.ObjectId;
  date: Date;
  withGST: boolean;
  language: "en" | "hi";
  items: IInvoiceItem[];
  totals: IInvoiceTotals;
  status: "draft" | "final" | "returned";
}

const invoiceItemSchema = new Schema<IInvoiceItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  desc: {
    type: String,
    trim: true,
  },
  unitType: {
    type: String,
    enum: ["pcs", "meter", "sqft", "sqyd", "sqmt"],
    required: true,
  },
  qty: {
    type: Number,
    required: true,
    min: 0,
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
  },
  taxPct: {
    type: Number,
    min: 0,
    max: 100,
  },
});

const invoiceTotalsSchema = new Schema<IInvoiceTotals>({
  subTotal: {
    type: Number,
    required: true,
    min: 0,
  },
  tax: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    min: 0,
  },
  roundOff: {
    type: Number,
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0,
  },
  paid: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  pending: {
    type: Number,
    required: true,
    min: 0,
  },
});

const invoiceSchema = new Schema<IInvoice>(
  {
    number: {
      type: String,
      required: true,
      unique: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    withGST: {
      type: Boolean,
      required: true,
      default: false,
    },
    language: {
      type: String,
      enum: ["en", "hi"],
      required: true,
      default: "en",
    },
    items: [invoiceItemSchema],
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: false },
    totals: {
      type: invoiceTotalsSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "final", "returned"],
      required: true,
      default: "draft",
    },
  },
  {
    timestamps: true,
  },
);

export const Invoice =
  (mongoose.models.Invoice as any) || model<IInvoice>("Invoice", invoiceSchema);
