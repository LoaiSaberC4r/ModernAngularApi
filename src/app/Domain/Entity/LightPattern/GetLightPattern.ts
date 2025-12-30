export interface GetLightPattern {
  name: string;
  id: number;
  red: number;
  yellow: number;
  green: number;
  blinkInterval: number;
  blinkGreen: boolean;
  blinkYellow: boolean;
  blinkRed: boolean;
  mergeWith: number;
  MergeWith?: number;
}
