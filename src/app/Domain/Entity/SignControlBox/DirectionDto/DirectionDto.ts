export interface DirectionDto {
  id?: number;
  name: string;
  order: number;
  templateId: number;
  templateName: string;
  isConflict: boolean;
  left: boolean;
  right: boolean;
  conflictWith: string;
}
