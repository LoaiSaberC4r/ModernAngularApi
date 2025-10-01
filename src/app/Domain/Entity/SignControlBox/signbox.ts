export interface DirectionDto {
  name: string;
  lightPatternId: number;
  order: number;
}

export interface AddSignBoxCommandDto {
  name: string;
  areaId: number;
  ipAddress: string;
  latitude: string;
  longitude: string;
  directions: DirectionDto[];
}
