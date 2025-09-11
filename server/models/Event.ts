import mongoose, { Schema, model, Document, Types } from 'mongoose';

export interface IEvent extends Document {
  name: string;
  location?: string;
  clientId?: Types.ObjectId;
  dateFrom: Date;
  dateTo: Date;
  notes?: string;
  budget?: number;
  estimate?: number;
  createdAt: Date;
}

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
  }
}, {
  timestamps: true
});

export const Event = (mongoose.models.Event as any) || model<IEvent>('Event', eventSchema);
