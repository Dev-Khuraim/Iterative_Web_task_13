import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-this';

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
      req.user = decoded;
    } catch {
      // Token invalid, but continue without auth
    }
  }

  next();
};

export const generateToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): AuthPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
};
