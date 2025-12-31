export interface AddLightPatternCommand {
  id: number;
  name: string;
  redTime: number;
  yellowTime: number;
  greenTime: number;
  BlinkInterval: number;
  BlinkGreen: boolean;
  BlinkYellow: boolean;
  BlinkRed: boolean;
  IsMerged: boolean;
  MergedWith: number;
  IsOverLap: boolean;
  OverLapTime: number;
}
