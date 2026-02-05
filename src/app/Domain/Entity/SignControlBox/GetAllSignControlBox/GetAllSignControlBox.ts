import { DirectionDto } from '../DirectionDto/DirectionDto';

export interface GetAllSignControlBox {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  ipAddress: string;
  active?: boolean;
  isApplied?: boolean;
  cabinetId?: number;
  governorateId?: number;
  areaId?: number;
  trafficDepartmentNameAr?: string;
  trafficDepartmentNameEn?: string;
  directions?: DirectionDto[];
}
