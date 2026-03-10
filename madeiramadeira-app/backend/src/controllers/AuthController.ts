import { Request, Response } from 'express';
import authService from '../services/AuthService';

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await authService.register(username, email, password);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Register error:', error);
      if (error.message.includes('duplicate key')) {
        return res.status(409).json({ error: 'User already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await authService.login(username, password);
      res.json(result);
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message });
    }
  }
}

export default new AuthController();
