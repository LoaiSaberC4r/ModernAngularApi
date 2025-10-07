export interface AddLightPatternCommand {
  id: number;
  name: string;
  greenTime: number;
  yellowTime: number;
  redTime: number;
  BlinkInterval: number;
  BlinkGreen: boolean;
  BlinkYellow: boolean;
  BlinkRed: boolean;
}
