import { Router } from 'express';
import { prisma } from '../../index.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyJWT);

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  return `"${String(value).replaceAll('"', '""')}"`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-PE');
}

async function buildTransactionWhere(req, resp) {
  const { scope, startDate, endDate, type, categoryId, category, paymentMethod, userId } = req.query;
  let where = { userId: req.user.id };

  if (scope === 'family') {
    if (req.user.role !== 'JEFE') {
      resp.status(403).json({ msg: "Solo el jefe puede exportar reportes familiares", data: null });
      return null;
    }
    if (!req.user.familyId) {
      resp.status(400).json({ msg: "No pertenece a un grupo familiar", data: null });
      return null;
    }

    const familyMembers = await prisma.user.findMany({
      where: {
        familyId: req.user.familyId
      },
      select: {
        id: true
      }
    });

    where = {
      userId: {
        in: familyMembers.map((user) => user.id)
      }
    };
  }

  if (userId) {
    if (scope !== 'family' || req.user.role !== 'JEFE') {
      resp.status(403).json({ msg: "Solo el jefe puede filtrar por usuario", data: null });
      return null;
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

  return where;
}

function buildCsv(transactions) {
  const headers = ['Fecha', 'Descripcion', 'Tipo', 'Categoria', 'Metodo de pago', 'Usuario', 'Monto', 'Moneda'];
  const rows = transactions.map((transaction) => [
    formatDate(transaction.date),
    transaction.description,
    transaction.type,
    transaction.category?.name || '',
    transaction.paymentMethod,
    transaction.user?.name || '',
    transaction.amount,
    transaction.currency
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');
}

async function buildPdf(transactions) {
  const { default: PDFDocument } = await import('pdfkit');
  const doc = new PDFDocument({ margin: 40 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  const finished = new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const totalIncome = transactions
    .filter((transaction) => transaction.type === 'INGRESO')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalExpense = transactions
    .filter((transaction) => transaction.type === 'EGRESO')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  doc.fontSize(18).text('Reporte de movimientos FamiBalance');
  doc.moveDown();
  doc.fontSize(11).text(`Fecha de exportacion: ${formatDate(new Date())}`);
  doc.text(`Ingresos: S/. ${totalIncome.toFixed(2)}`);
  doc.text(`Egresos: S/. ${totalExpense.toFixed(2)}`);
  doc.text(`Balance: S/. ${(totalIncome - totalExpense).toFixed(2)}`);
  doc.moveDown();

  if (transactions.length === 0) {
    doc.text('No hay movimientos para los filtros seleccionados.');
  }

  transactions.forEach((transaction) => {
    doc
      .fontSize(10)
      .text(`${formatDate(transaction.date)} | ${transaction.type} | ${transaction.description}`)
      .text(`Categoria: ${transaction.category?.name || '-'} | Usuario: ${transaction.user?.name || '-'} | Monto: ${transaction.currency} ${transaction.amount.toFixed(2)}`)
      .moveDown(0.5);
  });

  doc.end();
  return finished;
}

router.get('/export', async (req, resp) => {
  try {
    const { format } = req.query;
    const exportFormat = format || 'csv';
    const where = await buildTransactionWhere(req, resp);

    if (!where) return;

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    if (exportFormat === 'pdf') {
      const pdfBuffer = await buildPdf(transactions);
      resp.setHeader('Content-Type', 'application/pdf');
      resp.setHeader('Content-Disposition', 'attachment; filename="reporte-famibalance.pdf"');
      return resp.send(pdfBuffer);
    }

    const csv = buildCsv(transactions);
    resp.setHeader('Content-Type', 'text/csv; charset=utf-8');
    resp.setHeader('Content-Disposition', 'attachment; filename="reporte-famibalance.csv"');
    return resp.send(Buffer.from(csv, 'utf-8'));
  } catch (error) {
    resp.status(400).json({
      msg: "Error al exportar reporte",
      data: error.message
    });
  }
});

export default router;
