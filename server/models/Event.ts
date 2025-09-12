import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface ISelectionItem {
  productId: Types.ObjectId;
  name?: string;
  sku?: string;
  unitType?: string;
  stockQty?: number;
  qtyToSend: number;
  rate: number;
  amount: number;
}

export interface IEvent extends Document {
  name: string;
  location?: string;
  clientId?: Types.ObjectId;
  dateFrom: Date;
  dateTo: Date;
  notes?: string;
  budget?: number;
  estimate?: number;
  selections?: ISelectionItem[];
  advance?: number;
  security?: number;
  agreementTerms?: string;
  agreementSnapshot?: {
    items: ISelectionItem[];
    advance: number;
    security: number;
    terms: string;
    grandTotal: number;
    savedAt: Date;
  };
  status?: "new" | "confirmed" | "reserved" | "dispatched" | "returned";
  dispatches?: Array<{
    items: ISelectionItem[];
    date: Date;
    total: number;
    note?: any;
  }>;
  dispatchDrafts?: Array<{
    items: ISelectionItem[];
    date: Date;
    total: number;
    note?: any;
  }>;
  returns?: Array<{
    items: ISelectionItem[];
    date: Date;
    total: number;
    shortages?: number;
    damages?: number;
    lateFee?: number;
  }>;
  createdAt: Date;
}

const selectionSchema = new Schema<ISelectionItem>({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String },
  sku: { type: String },
  unitType: { type: String },
  stockQty: { type: Number },
  qtyToSend: { type: Number, required: true, min: 0 },
  returnedQty: { type: Number, default: 0, min: 0 },
  completed: { type: Boolean, default: false },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
});

const eventSchema = new Schema<IEvent>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
    },
    dateFrom: {
      type: Date,
      required: true,
    },
    dateTo: {
      type: Date,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    budget: {
      type: Number,
      min: 0,
    },
    estimate: {
      type: Number,
      min: 0,
    },
    selections: { type: [selectionSchema], default: [] },
    advance: { type: Number, min: 0, default: 0 },
    security: { type: Number, min: 0, default: 0 },
    agreementTerms: { type: String, trim: true },
    agreementSnapshot: {
      type: new Schema(
        {
          items: { type: [selectionSchema], default: [] },
          advance: { type: Number, default: 0 },
          security: { type: Number, default: 0 },
          terms: { type: String, default: "" },
          grandTotal: { type: Number, default: 0 },
          savedAt: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
      default: undefined,
    },
    clientSign: { type: String, trim: true },
    companySign: { type: String, trim: true },
    status: {
      type: String,
      enum: ["new", "confirmed", "reserved", "dispatched", "returned"],
      default: "confirmed",
    },
    dispatches: {
      type: [
        new Schema({
          items: { type: [selectionSchema], default: [] },
          date: { type: Date, default: Date.now },
          total: { type: Number, default: 0 },
          note: { type: Schema.Types.Mixed },
        }),
      ],
      default: [],
    },
    dispatchDrafts: {
      type: [
        new Schema({
          items: { type: [selectionSchema], default: [] },
          date: { type: Date, default: Date.now },
          total: { type: Number, default: 0 },
          note: { type: Schema.Types.Mixed },
        }),
      ],
      default: [],
    },
    returns: {
      type: [
        new Schema({
          items: { type: [selectionSchema], default: [] },
          date: { type: Date, default: Date.now },
          total: { type: Number, default: 0 },
          shortages: { type: Number, default: 0 },
          damages: { type: Number, default: 0 },
          lateFee: { type: Number, default: 0 },
        }),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const Event =
  (mongoose.models.Event as any) || model<IEvent>("Event", eventSchema);
