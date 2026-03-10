import { Request, Response } from 'express';
import authService from '../services/AuthService';

// Mock data for demo mode
const mockUsers: any[] = [];
const mockTokens: Map<string, any> = new Map();

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if user exists in mock
      if (mockUsers.find(u => u.username === username)) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const userId = Math.random().toString(36).substr(2, 9);
      mockUsers.push({ id: userId, username, email, password });

      const token = `token_${userId}_${Date.now()}`;
      mockTokens.set(token, { userId, username, email });

      res.status(201).json({
        token,
        expiresIn: '7d',
      });
    } catch (error: any) {
      console.error('Register error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const user = mockUsers.find(u => u.username === username && u.password === password);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = `token_${user.id}_${Date.now()}`;
      mockTokens.set(token, { userId: user.id, username: user.username, email: user.email });

      res.json({
        token,
        expiresIn: '7d',
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message });
    }
  }
}

export default new AuthController();
