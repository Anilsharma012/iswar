import { Response } from "express";
import mongoose from "mongoose";
import { Event, EventExpense, EventWorker } from "../models";
import { AuthRequest } from "../utils/auth";
import { eventSchema } from "../utils/validation";

// Check if database is connected
const isDatabaseConnected = () => {
  return mongoose.connection.readyState === 1;
};

export const getEvents = async (req: AuthRequest, res: Response) => {
  try {
    // Check if database is connected
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        error: "Database connection unavailable",
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });
    }

    const {
      page = 1,
      limit = 10,
      search = "",
      clientId = "",
      fromDate = "",
      toDate = "",
    } = req.query;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    if (clientId) {
      query.clientId = clientId;
    }

    if (fromDate || toDate) {
      query.$or = [
        {
          dateFrom: {
            ...(fromDate && { $gte: new Date(fromDate as string) }),
            ...(toDate && { $lte: new Date(toDate as string) }),
          },
        },
        {
          dateTo: {
            ...(fromDate && { $gte: new Date(fromDate as string) }),
            ...(toDate && { $lte: new Date(toDate as string) }),
          },
        },
      ];
    }

    const events = await Event.find(query)
      .populate("clientId", "name phone")
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .sort({ dateFrom: -1 });

    const total = await Event.countDocuments(query);

    res.json({
      events,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get events error:", error);
    if (
      error.name === "MongooseError" ||
      error.message?.includes("buffering timed out")
    ) {
      return res.status(503).json({
        error: "Database connection unavailable",
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getEvent = async (req: AuthRequest, res: Response) => {
  try {
    const event = await Event.findById(req.params.id).populate("clientId");
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("Get event error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createEvent = async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = eventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const event = new Event(value);
    await event.save();

    const populatedEvent = await Event.findById(event._id).populate("clientId");
    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = eventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const event = await Event.findByIdAndUpdate(req.params.id, value, {
      new: true,
      runValidators: true,
    }).populate("clientId");

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(event);
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getEventSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id).populate("clientId");
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Get expenses total
    const expenses = await EventExpense.find({ eventId: id });
    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

    // Get workers and payments total
    const workers = await EventWorker.find({ eventId: id });
    const totalWorkerCost = workers.reduce((sum, worker) => {
      const baseAmount = worker.agreedAmount || worker.payRate;
      return sum + baseAmount;
    }, 0);
    const totalPaidToWorkers = workers.reduce(
      (sum, worker) => sum + worker.totalPaid,
      0,
    );

    // Calculate totals
    const budget = event.budget || 0;
    const estimate = event.estimate || 0;
    const totalSpent = totalExpenses + totalPaidToWorkers;
    const budgetBalance = budget - totalSpent;
    const estimateBalance = estimate - totalSpent;

    // Get breakdown by category
    const expensesByCategory = {
      travel: 0,
      food: 0,
      material: 0,
      misc: 0,
    };

    expenses.forEach((expense) => {
      expensesByCategory[expense.category] += expense.amount;
    });

    res.json({
      event,
      summary: {
        budget,
        estimate,
        totalExpenses,
        totalWorkerCost,
        totalPaidToWorkers,
        totalSpent,
        budgetBalance,
        estimateBalance,
        remainingWorkerPayments: totalWorkerCost - totalPaidToWorkers,
      },
      breakdown: {
        expenses: {
          total: totalExpenses,
          byCategory: expensesByCategory,
        },
        workers: {
          total: totalWorkerCost,
          paid: totalPaidToWorkers,
          remaining: totalWorkerCost - totalPaidToWorkers,
          count: workers.length,
        },
      },
    });
  } catch (error) {
    console.error("Get event summary error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const saveAgreement = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      selections = [],
      advance = 0,
      security = 0,
      agreementTerms = "",
    } = req.body || {};

    // Basic validation
    if (!Array.isArray(selections)) {
      return res.status(400).json({ error: "selections must be an array" });
    }

    // Check cold lead
    const existingEvent = await Event.findById(id).populate("clientId");
    if (!existingEvent)
      return res.status(404).json({ error: "Event not found" });
    const client = existingEvent.clientId as any;
    if (client && client.phone) {
      const Lead = mongoose.models.Lead as any;
      const lead = await Lead.findOne({ phone: client.phone });
      if (lead && lead.priority === "cold") {
        return res
          .status(403)
          .json({ error: "Cold lead - actions disabled", code: "COLD_LEAD" });
      }
    }

    const sanitized = selections.map((s: any) => ({
      productId: s.productId,
      name: s.name,
      sku: s.sku,
      unitType: s.unitType,
      stockQty: Number(s.stockQty || 0),
      qtyToSend: Number(s.qtyToSend || 0),
      rate: Number(s.rate || 0),
      amount: Number(s.amount || 0),
    }));

    const event = await Event.findByIdAndUpdate(
      id,
      {
        selections: sanitized,
        advance: Number(advance || 0),
        security: Number(security || 0),
        agreementTerms: String(agreementTerms || ""),
      },
      { new: true },
    ).populate("clientId");

    res.json(event);
  } catch (error) {
    console.error("Save agreement error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const dispatchEvent = async (req: AuthRequest, res: Response) => {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const { id } = req.params;
      const { items = [], dryRun: bodyDryRun } = req.body || {};
      const dryRun = (req.query?.dryRun === "1" || req.query?.dryRun === "true") || !!bodyDryRun;

      if (!Array.isArray(items) || items.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "items are required" });
      }

      const event = await Event.findById(id).session(session);
      if (!event) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Event not found" });
      }

      // Cold lead guard
      const clientPop = await Event.findById(id).populate("clientId");
      const client = clientPop?.clientId as any;
      if (client && client.phone) {
        const Lead = mongoose.models.Lead as any;
        const lead = await Lead.findOne({ phone: client.phone }).session(
          session,
        );
        if (lead && lead.priority === "cold") {
          await session.abortTransaction();
          session.endSession();
          return res
            .status(403)
            .json({ error: "Cold lead - actions disabled", code: "COLD_LEAD" });
        }
      }

      let total = 0;
      const sanitized: any[] = [];

      for (const it of items) {
        const pid = it.productId;
        const qty = Number(it.qty || 0);
        const rate = Number(it.rate || 0);
        if (!pid || qty <= 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: "Invalid item payload" });
        }

        const product = await (mongoose.models.Product as any)
          .findById(pid)
          .session(session);
        if (!product) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ error: `Product ${pid} not found` });
        }

        if (product.stockQty < qty) {
          await session.abortTransaction();
          session.endSession();
          return res
            .status(400)
            .json({ error: `Insufficient stock for product ${product.name}` });
        }

        if (!dryRun) {
          product.stockQty = Number(product.stockQty) - qty;
          await product.save({ session });
        }

        const amount = Number((qty * rate).toFixed(2));
        total += amount;

        sanitized.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          unitType: product.unitType,
          stockQty: product.stockQty,
          qtyToSend: qty,
          rate,
          amount,
        });
      }

      if (dryRun) {
        event.dispatchDrafts = event.dispatchDrafts || [];
        event.dispatchDrafts.push({ items: sanitized, date: new Date(), total, note: { mode: "reserve" } });
        event.status = "reserved";
      } else {
        event.dispatches = event.dispatches || [];
        event.dispatches.push({ items: sanitized, date: new Date(), total });
        event.status = "dispatched";
      }
      await event.save({ session });

      await (mongoose.models.AuditLog as any).create(
        [
          {
            action: dryRun ? "reserve" : "dispatch",
            entity: "Event",
            entityId: event._id,
            userId: req.adminId
              ? new mongoose.Types.ObjectId(req.adminId)
              : undefined,
            meta: { items: sanitized, total },
          },
        ],
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      const populatedEvent = await Event.findById(event._id).populate(
        "clientId",
      );
      return res.json(populatedEvent);
    } catch (error: any) {
      try {
        await session.abortTransaction();
      } catch (e) {
        /* ignore */
      }
      session.endSession();

      // Retry on transient transaction errors / write conflicts
      const isTransient =
        error &&
        (error.errorLabelSet?.has("TransientTransactionError") ||
          error.codeName === "WriteConflict");

      console.error(`Dispatch event error (attempt ${attempt}):`, error);

      if (isTransient && attempt < maxRetries) {
        // small backoff
        await new Promise((r) => setTimeout(r, 100 * attempt));
        continue;
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }
};

export const returnEvent = async (req: AuthRequest, res: Response) => {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const { id } = req.params;
      const { items = [] } = req.body || {};

      if (!Array.isArray(items)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "items must be an array" });
      }

      const event = await Event.findById(id).session(session);
      if (!event) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Event not found" });
      }

      // Cold lead guard
      const populated = await Event.findById(id).populate("clientId");
      const client = populated?.clientId as any;
      if (client && client.phone) {
        const Lead = mongoose.models.Lead as any;
        const lead = await Lead.findOne({ phone: client.phone }).session(
          session,
        );
        if (lead && lead.priority === "cold") {
          await session.abortTransaction();
          session.endSession();
          return res
            .status(403)
            .json({ error: "Cold lead - actions disabled", code: "COLD_LEAD" });
        }
      }

      // Work against the last confirmed dispatch if available, else selections
      const lastDispatch = (event.dispatches && event.dispatches.length)
        ? event.dispatches[event.dispatches.length - 1]
        : null;
      const targetItems = lastDispatch ? lastDispatch.items : event.selections || [];

      const sanitized: any[] = [];
      let totalShortageCost = 0;
      let totalDamage = 0;
      let totalLate = 0;

      for (const it of items) {
        // Expect each item: { itemId, expected, returned, shortage, damageAmount, lateFee, lossPrice?, rate }
        const pid = it.productId || it.itemId || it._id || null;
        const expected = Number(it.expected || 0);
        const returned = Number(it.returned || 0);
        const shortage = Number(it.shortage ?? Math.max(0, expected - returned));
        const damageAmount = Number(it.damageAmount || 0);
        const lateFee = Number(it.lateFee || 0);

        if (!pid || expected < 0 || returned < 0 || shortage < 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: "Invalid item payload" });
        }

        const product = await (mongoose.models.Product as any)
          .findById(pid)
          .session(session);
        if (!product) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ error: `Product ${pid} not found` });
        }

        // Increase stock by returned qty
        product.stockQty = Number(product.stockQty) + returned;
        await product.save({ session });

        // Create stock ledger entry for this return
        await (mongoose.models.StockLedger as any).create(
          [
            {
              productId: product._id,
              qtyChange: returned,
              reason: 'return',
              refType: 'Return',
              refId: event._id,
              at: new Date(),
            },
          ],
          { session },
        );

        // Create an inventory txn (issue txn) record
        await (mongoose.models.IssueTxn as any).create(
          [
            {
              clientId: event.clientId,
              productId: product._id,
              qty: returned,
              type: 'return',
              ref: `Event:${event._id}`,
              at: new Date(),
            },
          ],
          { session },
        );

        // Determine loss price: prefer provided lossPrice, then buyPrice, then rate, else 0
        const lossPrice = Number(it.lossPrice ?? product.buyPrice ?? it.rate ?? 0);
        const shortageCost = Number((shortage * lossPrice).toFixed(2));
        const lineAdjust = Number((shortageCost + damageAmount + lateFee).toFixed(2));

        totalShortageCost += shortageCost;
        totalDamage += damageAmount;
        totalLate += lateFee;

        // Update dispatched/selection line returnedQty and completed flag
        const matching = targetItems.find((ti: any) => String(ti.productId) === String(product._id));
        if (matching) {
          matching.returnedQty = (matching.returnedQty || 0) + returned;
          matching.completed = Boolean(matching.returnedQty >= (matching.qtyToSend || matching.qty || 0));
        }

        const rate = Number(it.rate ?? product.sellPrice ?? product.buyPrice ?? 0);
        const amount = Number((returned * rate).toFixed(2));

        sanitized.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          unitType: product.unitType,
          stockQty: product.stockQty,
          qtyToSend: expected,
          qtyReturned: returned,
          shortage,
          damageAmount,
          lateFee,
          lossPrice,
          shortageCost,
          rate,
          amount,
          lineAdjust,
        });
      }

      // persist changes to event dispatch items
      if (lastDispatch) {
        // replace lastDispatch items with updated targetItems
        lastDispatch.items = targetItems;
      } else {
        event.selections = targetItems;
      }

      event.returns = event.returns || [];
      event.returns.push({
        items: sanitized,
        date: new Date(),
        total: Number((totalShortageCost + totalDamage + totalLate).toFixed(2)),
        shortages: sanitized.reduce((s, it) => s + it.shortage, 0),
        damages: sanitized.reduce((s, it) => s + it.damageAmount, 0),
        lateFee: sanitized.reduce((s, it) => s + it.lateFee, 0),
      });

      // determine if all dispatch lines completed
      const allCompleted = (targetItems.length === 0) || targetItems.every((ti: any) => Boolean(ti.completed));
      if (allCompleted) {
        event.status = 'returned';
      }

      await event.save({ session });

      await (mongoose.models.AuditLog as any).create(
        [
          {
            action: 'return',
            entity: 'Event',
            entityId: event._id,
            userId: req.adminId ? new mongoose.Types.ObjectId(req.adminId) : undefined,
            meta: { items: sanitized, totals: { totalShortageCost, totalDamage, totalLate } },
          },
        ],
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      const populatedEvent = await Event.findById(event._id).populate('clientId');

      return res.json({
        event: populatedEvent,
        summary: {
          totalShortageCost: Number(totalShortageCost.toFixed(2)),
          totalDamage: Number(totalDamage.toFixed(2)),
          totalLate: Number(totalLate.toFixed(2)),
          lines: sanitized,
          allCompleted: allCompleted,
        },
      });
    } catch (error: any) {
      try {
        await session.abortTransaction();
      } catch (e) {
        /* ignore */
      }
      session.endSession();

      const isTransient =
        error &&
        (error.errorLabelSet?.has('TransientTransactionError') ||
          error.codeName === 'WriteConflict');

      console.error(`Return event error (attempt ${attempt}):`, error);

      if (isTransient && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
        continue;
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export const generateAgreementPDFRoute = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const event = await Event.findById(req.params.id).populate("clientId");
    if (!event) return res.status(404).json({ error: "Event not found" });

    const { generateAgreementPDF } = await import("../utils/pdfGenerator");
    generateAgreementPDF(event, "en", res);
  } catch (error) {
    console.error("Generate agreement PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
