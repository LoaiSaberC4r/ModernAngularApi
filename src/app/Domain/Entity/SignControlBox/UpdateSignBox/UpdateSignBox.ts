import { SignDirection } from '../SignDirection/SignDirection';
export interface UpdateSignControlBox {
  id: number;
  name: string;
  ipAddress: string;
  latitude: string;
  longitude: string;
  areaId: number;
  cabinetId: number;
  directions: SignDirection[];
}
