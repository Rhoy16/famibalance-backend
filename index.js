import express from 'express';
import cors from 'cors';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

import { startRecurringTransactionsJob } from './src/jobs/recurringTransactions.job.js';

// Routers
import authRouter from './src/routes/auth.routes.js';
import transactionRouter from './src/routes/transaction.routes.js';
import { budgetRouter, categoryRouter } from './src/routes/budget.routes.js';
import { familyRouter, dashboardRouter } from './src/routes/family.routes.js';
import goalRouter from './src/routes/goal.routes.js';
import reportRouter from './src/routes/report.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

// Re-export verifyJWT middleware to keep external references clean
export { verifyJWT } from './src/middlewares/auth.middleware.js';

// Health Check Endpoint
app.get('/api/health', (req, resp) => {
  resp.json({
    msg: "Servidor Express v5 funcionando correctamente",
    data: {
      status: "OK",
      uptime: process.uptime()
    }
  });
});

// Mounting Routers
app.use('/api/auth', authRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/budgets', budgetRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/family', familyRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/goals', goalRouter);
app.use('/api/reports', reportRouter);

// Start recurring transactions job
startRecurringTransactionsJob();

app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
