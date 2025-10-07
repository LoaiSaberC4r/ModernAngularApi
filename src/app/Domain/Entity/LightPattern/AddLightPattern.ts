export interface AddLightPatternCommand {
  id: number;
  name: string;
  greenTime: number;
  yellowTime: number;
  redTime: number;
  blinkMs: number;
}
