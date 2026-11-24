import type { AuthUser } from 'src/common/types/auth-user';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
