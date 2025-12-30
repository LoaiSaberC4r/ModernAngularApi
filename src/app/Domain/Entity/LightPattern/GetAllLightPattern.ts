export interface GetAllLightPattern {
  name: string;
  id: number;
  red: number;
  green: number;
  yellow: number;
  blinkInterval: number;
  blinkGreen: boolean;
  blinkYellow: boolean;
  blinkRed: boolean;
  mergeWith?: number;
  MergeWith?: number;
}
