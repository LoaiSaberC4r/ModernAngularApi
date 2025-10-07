import { DirectionWithPatternDto } from './AddSignBoxCommandDto';

export interface AddSignBoxWithUpdateLightPattern {
  id: number;
  name: string;
  areaId: number;
  ipAddress: string;
  ipCabinet: number;
  latitude: string;
  longitude: string;
  directions: DirectionWithPatternDto[];
}
