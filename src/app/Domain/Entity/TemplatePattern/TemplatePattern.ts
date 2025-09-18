
export interface TemplatePattern {
  templateId: number;
  templateName: string;
  lightPatterns: LightPatternForTemplatePattern[];
}
export interface LightPatternForTemplatePattern {
  lightPatternId: number;
  lightPatternName: string;
  startFrom: string;
  finishBy: string;
}
