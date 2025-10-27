export interface TemplatePattern {
  templateId: number;
  templateName: string;
  lightPatterns: LightPatternForTemplatePattern[];
  defaultLightPatternId?: number;
}

export interface LightPatternForTemplatePattern {
  lightPatternId: number;
  lightPatternName: string;
  startFrom: string;
  finishBy: string;
  isDefault?: boolean;
}
