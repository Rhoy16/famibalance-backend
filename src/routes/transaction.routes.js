// src/routes/transaction.routes.js
//
// Owner: Integrante 2
// Covers:
//   RF-06 — CRUD for transactions
//   RF-07 — Create a transaction from an OCR-scanned receipt
//   RF-09 — Recurring transaction templates (creation side; the daily
//           generation job lives in src/jobs/recurringTransactions.job.js)
//   RF-10 — Multi-currency support
//
// Mounted in index.js as: app.use('/api/transactions', transactionRouter)

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

import { prisma } from '../../index.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { convertToBaseCurrency } from '../services/currencyConversion.service.js';
import { extractReceiptData } from '../services/receiptExtraction.service.js';
import { checkBudgetAlert } from './budget.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// NOTE on `type`: the dashboard/analytics endpoints (Integrante 4) already
// filter transactions using the Spanish literals "INGRESO" and "EGRESO".
// We keep those exact values here for compatibility instead of switching
// to "INCOME"/"EXPENSE" — changing them would silently break
// GET /api/dashboard/personal and /api/family/analytics.
const VALID_TYPES = ['INGRESO', 'EGRESO'];
const VALID_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// Every route in this file requires a valid JWT.
router.use(verifyJWT);

// ------------------------------------------------------------------
// GET /api/transactions
// Scope comes straight from the JWT: own transactions by default;
// ?scope=family lets the JEFE see the whole family's transactions
// (Integrante 5 adds richer filters on top for RF-16).
// ------------------------------------------------------------------
router.get('/', async (req, resp) => {
  try {
    const { scope, startDate, endDate, type, categoryId, category, paymentMethod, userId } = req.query;
    let where = { userId: req.user.id };

    if (scope === 'family') {
      if (req.user.role !== 'JEFE') {
        return resp.status(403).json({ msg: 'Only the JEFE can view family-wide transactions', data: null });
      }
      if (!req.user.familyId) {
        return resp.status(400).json({ msg: 'You are not part of a family group', data: null });
      }
      const familyMembers = await prisma.user.findMany({
        where: { familyId: req.user.familyId },
        select: { id: true },
      });
      where = { userId: { in: familyMembers.map((u) => u.id) } };
    }

    if (userId) {
      if (scope !== 'family' || req.user.role !== 'JEFE') {
        return resp.status(403).json({ msg: 'Only the JEFE can filter by user', data: null });
      }
      where.userId = userId;
      where.user = {
        familyId: req.user.familyId
      };
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (category) {
      where.category = {
        name: category
      };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'desc' },
    });

    resp.json({ msg: 'Transactions retrieved', data: transactions });
  } catch (error) {
    resp.status(400).json({ msg: 'Error fetching transactions', data: error.message });
  }
});

// ------------------------------------------------------------------
// POST /api/transactions
// RF-10: converts to the base currency and stores both the rate and the
// converted amount. Also runs the budget-alert check right after saving.
// ------------------------------------------------------------------
router.post('/', async (req, resp) => {
  try {
    const { description, amount, currency, date, type, paymentMethod, categoryId } = req.body;

    if (!description || amount === undefined || !type || !paymentMethod || !categoryId) {
      return resp.status(400).json({ msg: 'Missing required fields', data: null });
    }
    if (!VALID_TYPES.includes(type)) {
      return resp.status(400).json({ msg: `type must be one of: ${VALID_TYPES.join(', ')}`, data: null });
    }

    const txDate = date ? new Date(date) : new Date();
    const txCurrency = currency || 'PEN';
    const { baseAmount, exchangeRate } = await convertToBaseCurrency(amount, txCurrency);

    const transaction = await prisma.transaction.create({
      data: {
        description,
        amount,
        currency: txCurrency,
        exchangeRate,
        baseAmount,
        date: txDate,
        type,
        paymentMethod,
        userId: req.user.id,
        categoryId,
        isRecurring: false,
      },
    });

    const alertInfo = type === 'EGRESO'
      ? await checkBudgetAlert({ categoryId, date: txDate })
      : { alertTrigger: false };

    resp.status(201).json({ msg: 'Transaction created', data: { transaction, ...alertInfo } });
  } catch (error) {
    const status = error.statusCode || 400;
    resp.status(status).json({ msg: 'Error creating transaction', data: error.message });
  }
});

// ------------------------------------------------------------------
// PUT /api/transactions/:id
// ------------------------------------------------------------------
router.put('/:id', async (req, resp) => {
  try {
    const { id } = req.params;

    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) {
      return resp.status(404).json({ msg: 'Transaction not found', data: null });
    }

    const { description, amount, currency, date, type, paymentMethod, categoryId } = req.body;

    if (type && !VALID_TYPES.includes(type)) {
      return resp.status(400).json({ msg: `type must be one of: ${VALID_TYPES.join(', ')}`, data: null });
    }

    let updateData = {
      description,
      date: date ? new Date(date) : undefined,
      type,
      paymentMethod,
      categoryId,
    };

    // Only recompute the currency conversion if amount or currency changed.
    if (amount !== undefined || currency !== undefined) {
      const newAmount = amount ?? existing.amount;
      const newCurrency = currency ?? existing.currency;
      const { baseAmount, exchangeRate } = await convertToBaseCurrency(newAmount, newCurrency);
      updateData = { ...updateData, amount: newAmount, currency: newCurrency, baseAmount, exchangeRate };
    }

    const updated = await prisma.transaction.update({ where: { id }, data: updateData });
    resp.json({ msg: 'Transaction updated', data: updated });
  } catch (error) {
    resp.status(400).json({ msg: 'Error updating transaction', data: error.message });
  }
});

// ------------------------------------------------------------------
// DELETE /api/transactions/:id
// ------------------------------------------------------------------
router.delete('/:id', async (req, resp) => {
  try {
    const { id } = req.params;

    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) {
      return resp.status(404).json({ msg: 'Transaction not found', data: null });
    }

    await prisma.transaction.delete({ where: { id } });
    resp.json({ msg: 'Transaction deleted', data: null });
  } catch (error) {
    resp.status(400).json({ msg: 'Error deleting transaction', data: error.message });
  }
});

// ------------------------------------------------------------------
// POST /api/transactions/ocr   (multipart/form-data, field: "receipt")
// RF-07 — returns extracted fields for the user to confirm; it does NOT
// save a transaction by itself, so a wrong OCR read never pollutes data.
// ------------------------------------------------------------------
router.post('/ocr', upload.single('receipt'), async (req, resp) => {
  try {
    if (!req.file) {
      return resp.status(400).json({ msg: 'No receipt file uploaded', data: null });
    }

    const extracted = await extractReceiptData(req.file.path);
    resp.json({ msg: 'Receipt processed, review before confirming', data: extracted });
  } catch (error) {
    const status = error.statusCode || 400;
    resp.status(status).json({ msg: 'Error processing receipt', data: error.message });
  }
});

// ------------------------------------------------------------------
// POST /api/transactions/recurring
// RF-09 — creates the recurring template. The daily cron job (see
// src/jobs/recurringTransactions.job.js) generates the actual
// transactions from it going forward.
// ------------------------------------------------------------------
router.post('/recurring', async (req, resp) => {
  try {
    const { description, amount, currency, type, paymentMethod, categoryId, frequency, startDate } = req.body;

    if (!description || amount === undefined || !type || !paymentMethod || !categoryId || !frequency) {
      return resp.status(400).json({ msg: 'Missing required fields for a recurring template', data: null });
    }
    if (!VALID_TYPES.includes(type)) {
      return resp.status(400).json({ msg: `type must be one of: ${VALID_TYPES.join(', ')}`, data: null });
    }
    if (!VALID_FREQUENCIES.includes(frequency)) {
      return resp.status(400).json({ msg: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`, data: null });
    }

    const nextRunDate = startDate ? new Date(startDate) : new Date();
    const txCurrency = currency || 'PEN';
    const { baseAmount, exchangeRate } = await convertToBaseCurrency(amount, txCurrency);

    const template = await prisma.transaction.create({
      data: {
        description,
        amount,
        currency: txCurrency,
        exchangeRate,
        baseAmount,
        date: nextRunDate,
        type,
        paymentMethod,
        userId: req.user.id,
        categoryId,
        isRecurring: true,
        frequency,
        nextRunDate,
      },
    });

    resp.status(201).json({ msg: 'Recurring template created', data: template });
  } catch (error) {
    const status = error.statusCode || 400;
    resp.status(status).json({ msg: 'Error creating recurring template', data: error.message });
  }
});

export default router;
