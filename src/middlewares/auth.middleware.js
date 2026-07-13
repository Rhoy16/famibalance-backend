import jsonwebtoken from 'jsonwebtoken';

export const verifyJWT = (req, resp, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return resp.status(401).json({ msg: "Acceso no autorizado: Token no proporcionado", data: null });
  }
  const token = authHeader.split(' ')[1];
  jsonwebtoken.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return resp.status(401).json({ msg: "Acceso no autorizado: Token inválido o expirado", data: null });
    }
    req.user = decoded;
    next();
  });
};
