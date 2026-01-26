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

export interface DirectionDto {
  id?: number;
  name: string;
  order: number;
  templateId: number;
  templateName: string;
  isConflict: boolean;
  left: boolean;
  right: boolean;
  conflictWith: string;
}
