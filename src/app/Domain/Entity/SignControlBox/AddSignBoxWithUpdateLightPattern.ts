export interface DirectionWithPatternDto {
  name: string;
  order: number;
  lightPatternId: number;
  redTime: number;
  yellowTime: number;
  greenTime: number;
}

export interface AddSignBoxWithUpdateLightPattern {
  name: string;
  areaId: number;
  ipAddress: string;
  latitude: string;
  longitude: string;
  lightPatternId: number;

  redTime: number;
  yellowTime: number;
  greenTime: number;
  directions: DirectionWithPatternDto[];
}
