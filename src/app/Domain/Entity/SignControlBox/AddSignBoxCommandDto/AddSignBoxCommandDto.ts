import { DirectionWithPatternDto } from '../DirectionWithPatternDto/DirectionWithPatternDto';

export interface AddSignBoxCommandDto {
  name: string;
  areaId: number;
  ipAddress: string;
  latitude: string;
  longitude: string;
  cabinetId: number;
  trafficDepartmentId: string;
  directions?: DirectionWithPatternDto[];
}
