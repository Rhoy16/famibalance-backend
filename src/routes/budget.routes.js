import { Router } from 'express';
import { prisma } from '../../index.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

export const budgetRouter = Router();
export const categoryRouter = Router();

// Apply authorization middleware to all routes
budgetRouter.use(verifyJWT);
categoryRouter.use(verifyJWT);

// ==========================================
// Category Routes
// ==========================================

categoryRouter.get('/', async (req, resp) => {
  try {
    const categories = await prisma.category.findMany();
    resp.json({
      msg: "Lista de categorías",
      data: categories
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al obtener categorías",
      data: error.message
    });
  }
});

categoryRouter.post('/', async (req, resp) => {
  try {
    const { name, isCustom } = req.body;
    const newCategory = await prisma.category.create({
      data: {
        name,
        isCustom,
        userId: req.user.id
      }
    });
    resp.json({
      msg: "Categoría creada",
      data: newCategory
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al crear categoría",
      data: error.message
    });
  }
});

// ==========================================
// Budget Routes
// ==========================================

budgetRouter.get('/', async (req, resp) => {
  try {
    const budgets = await prisma.budget.findMany({
      include: {
        category: true
      }
    });
    resp.json({
      msg: "Lista de presupuestos",
      data: budgets
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al obtener presupuestos",
      data: error.message
    });
  }
});

budgetRouter.post('/', async (req, resp) => {
  try {
    const { limitAmount, month, categoryId } = req.body;
    const newBudget = await prisma.budget.create({
      data: {
        limitAmount,
        month,
        categoryId
      }
    });
    resp.json({
      msg: "Presupuesto creado",
      data: newBudget
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al crear presupuesto",
      data: error.message
    });
  }
});

budgetRouter.put('/:id', async (req, resp) => {
  try {
    const { id } = req.params;
    const { limitAmount, month, categoryId } = req.body;
    const budget = await prisma.budget.update({
      where: {
        id
      },
      data: {
        limitAmount,
        month,
        categoryId
      }
    });
    const alerta = await checkBudgetAlert(categoryId, month);
    resp.json({
      msg: "Presupuesto actualizado",
      data: budget,
      alerta
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al actualizar presupuesto",
      data: error.message
    });
  }
});

async function checkBudgetAlert(categoryId, month) {
  const budget = await prisma.budget.findFirst({
    where: {
      categoryId,
      month
    }
  });
  if (!budget) {
    return {
      alertTrigger: false
    };
  }
  const gastos = await prisma.transaction.aggregate({
    where: {
      categoryId,
      type: "EGRESO"
    },
    _sum: {
      amount: true
    }
  });
  const totalGastado = gastos._sum.amount || 0;
  const porcentaje = (totalGastado / budget.limitAmount) * 100;
  if (porcentaje >= 100) {
    return {
      alertTrigger: true,
      mensaje: "Presupuesto agotado"
    };
  }
  if (porcentaje >= 80) {
    return {
      alertTrigger: true,
      mensaje: "Ya alcanzó el 80% del presupuesto"
    };
  }
  return {
    alertTrigger: false
  };
}
