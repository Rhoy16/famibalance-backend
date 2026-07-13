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
      msg: "Lista de metas de ahorro (Cascarón)",
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
    const { title, targetAmount, deadline } = req.body;
    const newGoal = await prisma.savingGoal.create({
      data: {
        title,
        targetAmount,
        savedAmount: 0.0,
        deadline: new Date(deadline),
        userId: req.user.id
      }
    });
    resp.json({
      msg: "Meta de ahorro creada (Cascarón)",
      data: newGoal
    });
  } catch (error) {
    resp.status(400).json({
      msg: "Error al crear meta de ahorro",
      data: error.message
    });
  }
});

export default router;
