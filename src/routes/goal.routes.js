import { Router } from 'express';
import { prisma } from '../../index.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply authorization middleware to all routes
router.use(verifyJWT);

// ==========================================
// Savings Goals & Export Reports Routes
// ==========================================

router.get('/', async (req, resp) => {
  try {
    const goals = await prisma.savingGoal.findMany({
      where: {
        userId: req.user.id
      }
    });
    resp.json({
      msg: "Lista de metas de ahorro",
      data: goals
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al obtener metas de ahorro",
      data: error.message
    });
  }
});

router.post('/', async (req, resp) => {
  try {
    const { title, targetAmount, savedAmount, deadline } = req.body;
    const newGoal = await prisma.savingGoal.create({
      data: {
        title,
        targetAmount,
        savedAmount: savedAmount || 0.0,
        deadline: new Date(deadline),
        userId: req.user.id
      }
    });
    resp.json({
      msg: "Meta de ahorro creada",
      data: newGoal
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al crear meta de ahorro",
      data: error.message
    });
  }
});

router.put('/:id', async (req, resp) => {
  try {
    const { id } = req.params;
    const { title, targetAmount, savedAmount, deadline } = req.body;

    const goal = await prisma.savingGoal.findUnique({
      where: {
        id
      }
    });

    if (!goal || goal.userId !== req.user.id) {
      return resp.status(404).json({
        msg: "Meta de ahorro no encontrada",
        data: null
      });
    }

    const updatedGoal = await prisma.savingGoal.update({
      where: {
        id
      },
      data: {
        title,
        targetAmount,
        savedAmount,
        deadline: deadline ? new Date(deadline) : undefined
      }
    });

    resp.json({
      msg: "Meta de ahorro actualizada",
      data: updatedGoal
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al actualizar meta de ahorro",
      data: error.message
    });
  }
});

router.delete('/:id', async (req, resp) => {
  try {
    const { id } = req.params;

    const goal = await prisma.savingGoal.findUnique({
      where: {
        id
      }
    });

    if (!goal || goal.userId !== req.user.id) {
      return resp.status(404).json({
        msg: "Meta de ahorro no encontrada o sin acceso",
        data: null
      });
    }

    await prisma.savingGoal.delete({
      where: {
        id
      }
    });

    resp.json({
      msg: "Meta de ahorro eliminada correctamente",
      data: null
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al eliminar meta de ahorro",
      data: error.message
    });
  }
});

export default router;
