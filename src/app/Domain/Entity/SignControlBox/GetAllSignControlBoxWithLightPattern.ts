import { SignDirection } from './AddSignBoxCommandDto';

export interface GetAllSignControlBoxWithLightPattern {
  id: number;
  name: string;
  latitude?: string | null;
  longitude?: string | null;
  ipAddress: string;
  active?: boolean;
  lightPatterName: string;
  lightPatternId: number;
  directions?: SignDirection[];
}
