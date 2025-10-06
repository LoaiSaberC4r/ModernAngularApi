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
  left?: boolean;
  right?: boolean;
  isConflict?: boolean;
}

export interface AddSignBoxWithUpdateLightPattern {
  name: string;
  areaId: number;
  ipAddress: string;
  latitude: string;
  longitude: string;
  directions: DirectionWithPatternDto[];
}

export interface SignDirection {
  name?: string;
  order?: number;
  lightPatternId?: number;
  lightPatternName?: string;
  left?: boolean;
  right?: boolean;
  isConflict?: boolean;
}

export interface GetAllSignControlBoxWithLightPattern {
  id: number;
  name?: string;
  ipAddress?: string;
  latitude?: string;
  longitude?: string;
  active?: boolean;
  lightPatternId?: number;
  directions?: SignDirection[];
}
