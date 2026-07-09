import express from 'express';
import cors from 'cors';
import jsonwebtoken from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
// TODO: Implementar rutas de transacciones aquí


// ==========================================
// Rutas de Integrante 3: Presupuestos
// ==========================================
// TODO: Implementar rutas de presupuestos aquí


// ==========================================
// Rutas de Integrante 4: Metas de Ahorro y Categorías
// ==========================================
// TODO: Implementar rutas de metas de ahorro y categorías aquí


// ==========================================
// Rutas de Integrante 5: Reportes y Funcionalidades Adicionales
// ==========================================
// TODO: Implementar rutas adicionales aquí



app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
