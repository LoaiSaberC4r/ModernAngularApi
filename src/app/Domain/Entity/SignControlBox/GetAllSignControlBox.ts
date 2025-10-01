export interface GetAllSignControlBox {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  ipAddress: string;
  active?: boolean;
  directions?: DirectionDto[];
}

export interface DirectionDto {
  id?: number;
  name: string;
  order: number;
  lightPatternId: number;
}
