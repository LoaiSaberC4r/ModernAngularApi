import { TrafficColor } from '../PopUpSignBox/PopUpSignBox';

export interface ChatMessage {
  user: string;
  message: ReceiveMessage;
  at: Date;
}
export interface ReceiveMessage {
  L1: TrafficColor;
  L2: TrafficColor;
  T1: number;
  T2: number;
  ID: number;
}
