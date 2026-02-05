export interface DirectionWithSegmentDto {
  name?: string;
  templateId?: number;
  order?: number;
  left?: boolean;
  right?: boolean;
  isConflict?: boolean;
  conflictWith?: number;
  incomingSegmentId?: string;

  // PascalCase versions
  Name?: string;
  TemplateId?: number;
  Order?: number;
  Left?: boolean;
  Right?: boolean;
  IsConflict?: boolean;
  ConflictWith?: number;
  IncomingSegmentId?: string;
}
