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

    if (!event) return res.status(404).json({ error: "Event not found" });

    res.json(event);
  } catch (error) {
    console.error("Save agreement error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const dispatchEvent = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { dispatchedBy, dispatchDate } = req.body || {};

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    event.status = "dispatched";
    // store who dispatched and when (if provided)
    (event as any).dispatchedBy = dispatchedBy || (req as any)?.user?.id || null;
    (event as any).dispatchedAt = dispatchDate ? new Date(dispatchDate) : new Date();

    await event.save();

    const populated = await Event.findById(event._id).populate("clientId");
    res.json(populated);
  } catch (error) {
    console.error("Dispatch event error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const returnEvent = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { returnNotes = "", returnedBy } = req.body || {};

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    event.status = "returned";
    (event as any).returnedBy = returnedBy || (req as any)?.user?.id || null;
    (event as any).returnedAt = new Date();
    (event as any).returnNotes = String(returnNotes || "");

    await event.save();

    const populated = await Event.findById(event._id).populate("clientId");
    res.json(populated);
  } catch (error) {
    console.error("Return event error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
