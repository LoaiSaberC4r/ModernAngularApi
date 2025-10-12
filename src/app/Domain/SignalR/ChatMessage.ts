import { TrafficColor } from '../PopUpSignBox/PopUpSignBox';
import { TrafficBroadcast } from './TrafficBroadcast';

export interface ChatMessage<T = TrafficBroadcast> {
  user: string;
  message: T;
  at: Date;
}

export type ReceiveMessage = TrafficBroadcast;
