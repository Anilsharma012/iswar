import { Response } from "express";
import { Product, StockLedger, IssueRegister, Event } from "../models";
import { AuthRequest } from "../utils/auth";
import { stockUpdateSchema } from "../utils/validation";
import { consumeProductStock } from "../utils/b2bStock";

export const getCurrentStock = async (req: AuthRequest, res: Response) => {
  try {
    const { search = "", category = "", stockLevel = "" } = req.query;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      query.category = { $regex: category, $options: "i" };
    }

    let products = await Product.find(query).sort({ name: 1 });

    // Apply stock level filter
    if (stockLevel) {
      switch (stockLevel) {
        case "out":
          products = products.filter((p) => p.stockQty === 0);
          break;
        case "low":
          products = products.filter((p) => p.stockQty > 0 && p.stockQty < 10);
          break;
        case "medium":
          products = products.filter(
            (p) => p.stockQty >= 10 && p.stockQty <= 50,
          );
          break;
        case "good":
          products = products.filter((p) => p.stockQty > 50);
          break;
      }
    }

    res.json({ products });
  } catch (error) {
    console.error("Get current stock error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getStockLedger = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      productId = "",
      reason = "",
      fromDate = "",
      toDate = "",
    } = req.query;

    const query: any = {};

    if (productId) {
      query.productId = productId;
    }

    if (reason) {
      query.reason = reason;
    }

    if (fromDate || toDate) {
      query.at = {};
      if (fromDate) query.at.$gte = new Date(fromDate as string);
      if (toDate) query.at.$lte = new Date(toDate as string);
    }

    const ledgerEntries = await StockLedger.find(query)
      .populate("productId", "name category unitType")
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .sort({ at: -1 });

    const total = await StockLedger.countDocuments(query);

    // Transform ledger entries to match frontend expectations
    const transformedEntries = ledgerEntries.map((entry) => ({
      _id: entry._id,
      productId: entry.productId,
      type:
        entry.qtyChange > 0 ? "in" : entry.qtyChange < 0 ? "out" : "adjustment",
      quantity: Math.abs(entry.qtyChange),
      reason: "Manual stock update",
      balanceAfter: 0, // We don't track this in current model
      date: entry.at,
      createdAt: entry.createdAt,
    }));

    res.json({
      ledger: transformedEntries,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get stock ledger error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getIssueRegister = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50 } = req.query;

    const issueRegisters = await IssueRegister.find({})
      .populate("productId", "name category unitType")
      .populate("clientId", "name phone")
      .limit(Number(limit))
      .sort({ issueDate: -1 });

    res.json({ issues: issueRegisters });
  } catch (error) {
    console.error("Get issue register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getReturnable = async (req: AuthRequest, res: Response) => {
  try {
    // Fetch recent events that are not explicitly closed
    const events = await Event.find({
      $or: [
        { returnClosed: { $ne: true } },
        { returnClosed: { $exists: false } },
      ],
    })
      .populate("clientId", "name phone")
      .sort({ dateFrom: -1 })
      .limit(200);

    const result: any[] = [];

    for (const ev of events) {
      const lastDispatch =
        ev.dispatches && ev.dispatches.length
          ? ev.dispatches[ev.dispatches.length - 1]
          : null;
      const lines = lastDispatch ? lastDispatch.items : ev.selections || [];
      const hasOutstanding = lines.some((li: any) => {
        const dispatched = Number(li.qtyToSend || li.qty || 0);
        const ret = Number(li.returnedQty || 0);
        return dispatched > ret;
      });
      if (!hasOutstanding) continue;
      result.push({
        _id: ev._id,
        name: ev.name,
        client: ev.clientId,
        dateFrom: ev.dateFrom,
        dateTo: ev.dateTo,
        status: ev.status,
      });
    }

    res.json({ events: result });
  } catch (error) {
    console.error("Get returnable events error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateStock = async (req: AuthRequest, res: Response) => {
  try {
    // Validate request body
    const { error, value } = stockUpdateSchema.validate(req.body);
    if (error) {
      console.log("Stock update validation error:", error.details);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { productId, type, quantity, reason } = value;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Calculate quantity change based on type
    let qtyChange = 0;
    let newQty = product.stockQty;
    let allocation = null as
      | (Awaited<ReturnType<typeof consumeProductStock>> & { reason: string })
      | null;

    if (type === "in") {
      qtyChange = quantity;
      newQty = product.stockQty + quantity;
      product.stockQty = newQty;
      await product.save();
    } else if (type === "out") {
      qtyChange = -quantity;
      const result = await consumeProductStock({
        product,
        quantity,
      });
      newQty = result.projectedStock;
      allocation = { ...result, reason: "manual" };
    } else if (type === "adjustment") {
      qtyChange = quantity - product.stockQty;
      newQty = quantity;
      product.stockQty = newQty;
      await product.save();
    }

    // Create stock ledger entry
    const stockEntry = new StockLedger({
      productId,
      qtyChange,
      reason: "manual",
      refType: "Invoice",
      refId: product._id,
    });
    await stockEntry.save();

    res.json({
      message: "Stock updated successfully",
      product,
      ledgerEntry: stockEntry,
      allocation,
    });
  } catch (error) {
    console.error("Update stock error:", error);
    if ((error as any)?.code === "INSUFFICIENT_STOCK") {
      return res
        .status(400)
        .json({ error: "Insufficient stock for this operation" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};
