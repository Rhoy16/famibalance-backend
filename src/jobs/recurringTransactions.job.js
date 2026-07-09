// src/jobs/recurringTransactions.job.js
//
// RF-09 — Recurring transactions.
// Once a day, finds every recurring template whose nextRunDate has
// already passed, creates a regular (non-recurring) Transaction copy
// dated today, and advances the template's nextRunDate according to its
// frequency so it isn't picked up again until it's actually due.

import cron from 'node-cron';
import { prisma } from '../../index.js';

function addInterval(date, frequency) {
  const next = new Date(date);
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
  return next;
}

export async function runRecurringTransactionsCheck() {
  const now = new Date();

  const dueTemplates = await prisma.transaction.findMany({
    where: { isRecurring: true, nextRunDate: { lte: now } },
  });

  console.log(`[recurring-job] ${dueTemplates.length} template(s) due at ${now.toISOString()}`);

  for (const template of dueTemplates) {
    try {
      await prisma.transaction.create({
        data: {
          description: template.description,
          amount: template.amount,
          currency: template.currency,
          exchangeRate: template.exchangeRate,
          baseAmount: template.baseAmount,
          date: now,
          type: template.type,
          paymentMethod: template.paymentMethod,
          userId: template.userId,
          categoryId: template.categoryId,
          isRecurring: false,
          parentRecurringId: template.id,
        },
      });

      await prisma.transaction.update({
        where: { id: template.id },
        data: { nextRunDate: addInterval(template.nextRunDate, template.frequency) },
      });
    } catch (error) {
      // One bad template should never stop the rest of the batch.
      console.error(`[recurring-job] Failed to process template ${template.id}:`, error);
    }
  }
}

export function startRecurringTransactionsJob() {
  // Runs every day at 00:05. Change the cron expression if you need a
  // shorter interval for a live demo (e.g. '*/2 * * * *' = every 2 minutes).
  cron.schedule('5 0 * * *', () => {
    runRecurringTransactionsCheck().catch((error) =>
      console.error('[recurring-job] Unhandled error:', error)
    );
  });

  console.log('[recurring-job] Scheduled daily at 00:05');
}
