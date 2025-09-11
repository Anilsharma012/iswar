import Joi from 'joi';

export const loginSchema = Joi.object({
  phone: Joi.string().required().trim(),
  password: Joi.string().required().min(6)
});

export const clientSchema = Joi.object({
  name: Joi.string().required().trim(),
  phone: Joi.string().required().trim(),
  email: Joi.string().email().optional().allow('').allow(null),
  address: Joi.string().optional().allow('').allow(null),
  gstNumber: Joi.string().optional().allow('').allow(null)
});

export const productSchema = Joi.object({
  name: Joi.string().required().trim(),
  category: Joi.string().required().trim(),
  unitType: Joi.string().valid('pcs', 'meter', 'sqft', 'sqyd', 'sqmt').required(),
  buyPrice: Joi.number().min(0).required(),
  sellPrice: Joi.number().min(0).required(),
  stockQty: Joi.number().min(0).default(0),
  imageUrl: Joi.string().optional().trim()
});

export const invoiceItemSchema = Joi.object({
  productId: Joi.string().required(),
  desc: Joi.string().optional().trim(),
  unitType: Joi.string().valid('pcs', 'meter', 'sqft', 'sqyd', 'sqmt').required(),
  qty: Joi.number().min(0).required(),
  rate: Joi.number().min(0).required(),
  taxPct: Joi.number().min(0).max(100).optional()
});

export const invoiceSchema = Joi.object({
  clientId: Joi.string().required(),
  withGST: Joi.boolean().default(false),
  language: Joi.string().valid('en', 'hi').default('en'),
  items: Joi.array().items(invoiceItemSchema).min(1).required(),
  totals: Joi.object({
    subTotal: Joi.number().min(0).required(),
    tax: Joi.number().min(0).required(),
    discount: Joi.number().min(0).optional(),
    roundOff: Joi.number().optional(),
    grandTotal: Joi.number().min(0).required(),
    paid: Joi.number().min(0).default(0),
    pending: Joi.number().min(0).required()
  }).required(),
  status: Joi.string().valid('draft', 'final', 'returned').default('draft')
});

export const eventSchema = Joi.object({
  name: Joi.string().required().trim(),
  location: Joi.string().optional().trim(),
  clientId: Joi.string().optional(),
  dateFrom: Joi.date().required(),
  dateTo: Joi.date().required().min(Joi.ref('dateFrom')),
  notes: Joi.string().optional().trim(),
  budget: Joi.number().min(0).optional(),
  estimate: Joi.number().min(0).optional()
});

export const workerSchema = Joi.object({
  name: Joi.string().required().trim(),
  phone: Joi.string().required().trim(),
  dailyRate: Joi.number().min(0).required(),
  halfDayRate: Joi.number().min(0).optional()
});

export const attendanceSchema = Joi.object({
  workerId: Joi.string().required(),
  date: Joi.date().required(),
  shift: Joi.string().valid('full', 'half', 'absent').required(),
  eventId: Joi.string().optional(),
  notes: Joi.string().optional().trim()
});

export const payrollSchema = Joi.object({
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
  workerId: Joi.string().required(),
  daysFull: Joi.number().min(0).required(),
  daysHalf: Joi.number().min(0).required(),
  advances: Joi.number().min(0).default(0),
  totalPay: Joi.number().min(0).required(),
  notes: Joi.string().optional().trim()
});

export const stockUpdateSchema = Joi.object({
  productId: Joi.string().required(),
  type: Joi.string().valid('in', 'out', 'adjustment').required(),
  quantity: Joi.number().min(0).required(),
  reason: Joi.string().required().trim()
});

export const eventExpenseSchema = Joi.object({
  category: Joi.string().valid('travel', 'food', 'material', 'misc').required(),
  amount: Joi.number().min(0).required(),
  notes: Joi.string().optional().trim(),
  date: Joi.date().required(),
  billImage: Joi.string().optional().trim()
});

export const eventWorkerSchema = Joi.object({
  name: Joi.string().required().trim(),
  role: Joi.string().required().trim(),
  phone: Joi.string().optional().trim(),
  payRate: Joi.number().min(0).required(),
  agreedAmount: Joi.number().min(0).optional()
});

export const workerPaymentSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  paymentMode: Joi.string().valid('cash', 'bank_transfer', 'upi', 'cheque', 'online').required(),
  paymentDate: Joi.date().required(),
  notes: Joi.string().optional().trim(),
  referenceNumber: Joi.string().optional().trim()
});
