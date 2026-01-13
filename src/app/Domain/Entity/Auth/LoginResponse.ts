import { TokenData } from './TokenData';

export interface LoginResponse {
  requiresPasswordChange: boolean;
  token: TokenData;
}
