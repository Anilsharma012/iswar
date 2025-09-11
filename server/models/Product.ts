import { Schema, model, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  sku?: string;
  category: string;
  unitType: "pcs" | "meter" | "sqft" | "sqyd" | "sqmt";
  buyPrice: number;
  sellPrice: number;
  stockQty: number;
  imageUrl?: string;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    unitType: {
      type: String,
      enum: ["pcs", "meter", "sqft", "sqyd", "sqmt"],
      required: true,
    },
    buyPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    stockQty: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);


export const Product = model<IProduct>("Product", productSchema);
