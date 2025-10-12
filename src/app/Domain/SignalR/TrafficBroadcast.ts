import { TrafficColor } from '../PopUpSignBox/PopUpSignBox';

export interface TrafficBroadcast {
  ID: number;
  L1: TrafficColor;
  T1: number;
  L2: TrafficColor;
  T2: number;
  L3: TrafficColor;
  T3: number;
  L4: TrafficColor;
  T4: number;
}
