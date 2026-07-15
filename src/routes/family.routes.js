import { Router } from 'express';
import { prisma } from '../../index.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

export const familyRouter = Router();
export const dashboardRouter = Router();

// Apply authorization middleware to all routes
familyRouter.use(verifyJWT);
dashboardRouter.use(verifyJWT);

// ==========================================
// Family Routes
// ==========================================

familyRouter.post('/', async (req, resp) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      }
    });
    if (!user) {
      return resp.status(404).json({
        msg: "Usuario no encontrado",
        data: null
      });
    }
    if (user.familyId) {
      return resp.status(400).json({
        msg: "Ya pertenece a un grupo",
        data: null
      });
    }

    const family = await prisma.familyGroup.create({
      data: {
        name
      }
    });
    await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        familyId: family.id,
        role: "JEFE"
      }
    });
    resp.json({
      msg: "Grupo creado",
      data: family
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al crear el grupo familiar",
      data: error.message
    });
  }
});

familyRouter.get('/members', async (req, resp) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id
      }
    });

    const members = await prisma.user.findMany({
      where: {
        familyId: user.familyId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });
    resp.json({
      msg: "Miembros del grupo familiar obtenidos",
      data: members
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al obtener los miembros",
      data: error.message
    });
  }
});

familyRouter.get('/analytics', async (req, resp) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id
      }
    });
    if (user.role !== "JEFE") {
      return resp.status(403).json({
        msg: "Solo el jefe puede acceder",
        data: null
      });
    }

    const analytics = await prisma.transaction.groupBy({
      by: ["userId"],
      where: {
        user: {
          familyId: user.familyId
        }
      },
      _sum: {
        amount: true
      }
    });
    resp.json({
      msg: "Analíticas familiares obtenidas",
      data: analytics
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al obtener las analíticas del grupo familiar",
      data: error.message
    });
  }
});

// ==========================================
// Dashboard Routes
// ==========================================

dashboardRouter.get('/personal', async (req, resp) => {
  try {
    const gastos = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId: req.user.id
      },
      _sum: {
        amount: true
      }
    });

    const ingresos = await prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        type: "INGRESO"
      },
      _sum: {
        amount: true
      }
    });

    const egresos = await prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        type: "EGRESO"
      },
      _sum: {
        amount: true
      }
    });
    resp.json({
      msg: "Dashboard personal obtenido",
      data: {
        income: ingresos._sum.amount || 0,
        expense: egresos._sum.amount || 0,
        categories: gastos
      }
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al obtener el dashboard personal",
      data: error.message
    });
  }
});
