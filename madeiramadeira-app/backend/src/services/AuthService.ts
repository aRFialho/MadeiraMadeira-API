import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { query } from '../database/connection';
import { User, AuthPayload, JWTToken } from '../types';

export class AuthService {
  async register(username: string, email: string, password: string): Promise<JWTToken> {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email`,
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = this.generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    return token;
  }

  async login(username: string, password: string): Promise<JWTToken> {
    const result = await query(
      `SELECT id, username, email, password_hash FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    const token = this.generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    return token;
  }

  private generateToken(payload: AuthPayload): JWTToken {
    const secret = process.env.JWT_SECRET || 'dev-secret-key';
    const expiresInValue = process.env.JWT_EXPIRES_IN || '7d';
    
    const token = jwt.sign(payload, secret, { expiresIn: expiresInValue as any });

    return {
      token,
      expiresIn: expiresInValue,
    };
  }
}

export default new AuthService();
