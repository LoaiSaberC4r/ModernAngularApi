import { TokenData } from '../TokenData/TokenData';

export interface LoginResponse {
  requiresPasswordChange: boolean;
  token: TokenData;
}
