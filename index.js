import express from 'express';
import cors from 'cors';
import jsonwebtoken from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import transactionsRouter from './src/routes/transactions.routes.js';
import { startRecurringTransactionsJob } from './src/jobs/recurringTransactions.job.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

// Middleware JWT (exportable/disponible)
export const verifyJWT = (req, resp, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return resp.status(401).json({ msg: "No token provided", data: null });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return resp.status(401).json({ msg: "Invalid token", data: null });
  }
};

// ==========================================
// RUTAS DE INTEGRANTE 1: Autenticación
// ==========================================

app.post('/api/auth/register', async (req, resp) => {
  try {
    const { name, email, password } = req.body;

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    resp.json({ msg: "Usuario registrado con éxito", data: newUser });
  } catch (error) {
    resp.status(400).json({ msg: "Error al registrar usuario", data: error.message });
  }
});

app.post('/api/auth/login', async (req, resp) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return resp.status(400).json({ msg: "Credenciales inválidas", data: null });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return resp.status(400).json({ msg: "Credenciales inválidas", data: null });
    }

    const token = jsonwebtoken.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    resp.json({ msg: "Login exitoso", data: { user, token } });
  } catch (error) {
    resp.status(400).json({ msg: "Error en el login", data: error.message });
  }
});

app.post('/api/auth/recover', async (req, resp) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return resp.status(400).json({ msg: "Si el correo existe, se ha enviado un enlace de recuperación", data: null });
    }

    // Aquí iría la lógica de envío de email
    // ...

    resp.json({ msg: "Si el correo existe, se ha enviado un enlace de recuperación", data: null });
  } catch (error) {
    resp.status(400).json({ msg: "Error en la recuperación", data: error.message });
  }
});

// ==========================================
// Rutas de Integrante 2: Transacciones
// ==========================================
// RF-06, RF-07, RF-09, RF-10 — implemented in src/routes/transactions.routes.js
app.use('/api/transactions', transactionsRouter);


// ==========================================
// Rutas de Integrante 3: Presupuestos
// ==========================================
// TODO: Implementar rutas de presupuestos aquí


// ==========================================
// Rutas de Integrante 4: Metas de Ahorro y Categorías
// ==========================================
// TODO: Implementar rutas de metas de ahorro y categorías aquí
app.post("/api/family", verifyJWT, async (req, resp) => {
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
        msg: "Usuario no encontrado"
      });
    }
    if (user.familyId) {
      return resp.status(400).json({
        msg: "Ya pertenece a un grupo"
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
      msg: error.message
    });
  }
});

app.get("/api/family/members", verifyJWT, async (req, resp) => {
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
    resp.json(members);
  } catch (error) {
    resp.status(400).json({
      msg: error.message
    });
  }
});

app.get("/api/dashboard/personal", verifyJWT, async (req, resp) => {
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
      income: ingresos._sum.amount || 0,
      expense: egresos._sum.amount || 0,
      categories: gastos
    });
  } catch (error) {
    resp.status(400).json({
      msg: error.message
    });
  }
});

app.get("/api/family/analytics", verifyJWT, async (req, resp) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id
      }
    });
    if (user.role != "JEFE") {
      return resp.status(403).json({
        msg: "Solo el jefe puede acceder"
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
    resp.json(analytics);
  } catch (error) {
    resp.status(400).json({
      msg: error.message
    });
  }
});
// ==========================================
// Rutas de Integrante 5: Reportes y Funcionalidades Adicionales
// ==========================================
// TODO: Implementar rutas adicionales aquí



// RF-09 — start the daily job that generates transactions from recurring templates.
startRecurringTransactionsJob();

app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
