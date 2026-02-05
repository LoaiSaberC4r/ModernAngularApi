import { PreviewGreenWaveRequest } from '../PreviewGreenWaveRequest/PreviewGreenWaveRequest';

export interface ApplyGreenWaveRequest extends PreviewGreenWaveRequest {
  planId: string;
}
