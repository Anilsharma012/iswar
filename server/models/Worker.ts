import { Schema, model, Document } from 'mongoose';

export interface IWorker extends Document {
  name: string;
  phone: string;
  dailyRate: number;
  halfDayRate?: number;
}

const workerSchema = new Schema<IWorker>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  dailyRate: {
    type: Number,
    required: true,
    min: 0
  },
  halfDayRate: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

export const Worker = model<IWorker>('Worker', workerSchema);
