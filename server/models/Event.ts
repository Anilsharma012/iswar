import mongoose, { Schema, model, Document, Types } from 'mongoose';

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
  createdAt: Date;
}

const selectionSchema = new Schema<ISelectionItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String },
  sku: { type: String },
  unitType: { type: String },
  stockQty: { type: Number },
  qtyToSend: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
});

const eventSchema = new Schema<IEvent>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client'
  },
  dateFrom: {
    type: Date,
    required: true
  },
  dateTo: {
    type: Date,
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  budget: {
    type: Number,
    min: 0
  },
  estimate: {
    type: Number,
    min: 0
  },
  selections: { type: [selectionSchema], default: [] },
  advance: { type: Number, min: 0, default: 0 },
  security: { type: Number, min: 0, default: 0 },
  agreementTerms: { type: String, trim: true },
}, {
  timestamps: true
});

export const Event = (mongoose.models.Event as any) || model<IEvent>('Event', eventSchema);
