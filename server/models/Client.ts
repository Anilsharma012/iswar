import mongoose, { Schema, model, Document } from "mongoose";

export interface IClient extends Document {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstNumber?: string;
}

const clientSchema = new Schema<IClient>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      trim: true,
      sparse: true,
    },
    address: {
      type: String,
      trim: true,
    },
    gstNumber: {
      type: String,
      trim: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Client =
  (mongoose.models.Client as any) || model<IClient>("Client", clientSchema);
