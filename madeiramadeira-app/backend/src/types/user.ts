export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuthPayload {
  userId: string;
  username: string;
  email: string;
}

export interface JWTToken {
  token: string;
  expiresIn: string;
}
