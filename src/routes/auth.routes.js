import { Router } from 'express';
import bcrypt from 'bcrypt';
import jsonwebtoken from 'jsonwebtoken';
import { prisma } from '../../index.js';

const router = Router();

// ==========================================
// Authentication Routes
// ==========================================

router.post('/register', async (req, resp) => {
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

    const { password: _, ...userWithoutPassword } = newUser;

    resp.json({ msg: "Usuario registrado con éxito", data: userWithoutPassword });
  } catch (error) {
    resp.status(400).json({ msg: "Error al registrar usuario", data: error.message });
  }
});

router.post('/login', async (req, resp) => {
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
      { id: user.id, email: user.email, role: user.role, familyId: user.familyId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { password: _, ...userWithoutPassword } = user;

    resp.json({ msg: "Login exitoso", data: { user: userWithoutPassword, token } });
  } catch (error) {
    resp.status(400).json({ msg: "Error en el login", data: error.message });
  }
});

router.post('/recover', async (req, resp) => {
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

export default router;
