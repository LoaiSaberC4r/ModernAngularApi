import { GreenWaveCabinetPreview } from '../GreenWaveCabinetPreview/GreenWaveCabinetPreview';

export interface GreenWavePreview {
  planId: string;
  speedKmh: number;
  greenSeconds: number;
  cabinets: GreenWaveCabinetPreview[];
}
