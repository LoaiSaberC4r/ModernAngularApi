export interface DirectionWithPatternDto {
  name: string;
  order: number;
  templateId: number;
  left: boolean;
  right: boolean;
  isConflict: boolean;
  conflictWith: number;
}
