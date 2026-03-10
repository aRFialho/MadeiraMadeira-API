import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';
import { DEFAULT_USER_ID } from '../database/connection';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Bypass authentication for development/simplified access
  req.user = {
    userId: DEFAULT_USER_ID,
    username: 'admin',
    email: 'admin@madeiramadeira.com.br'
  };
  next();
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
}
