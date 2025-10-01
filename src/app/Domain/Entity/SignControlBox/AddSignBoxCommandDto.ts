
export interface AddSignBoxCommandDto {
  name: string;
  areaId: number;
  ipAddress: string;
  latitude: string;
  longitude: string;
  directions: DirectionWithPatternDto[];
}

export interface DirectionWithPatternDto {
  name: string;
  order: number;
  lightPatternId: number;

}
