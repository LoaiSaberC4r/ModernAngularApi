import { TrafficColor } from '../PopUpSignBox/PopUpSignBox';

export interface CabinetStatusMessage {
  id: number; // server: msg.Id
  l1: TrafficColor; // msg.L1
  t1: number; // msg.T1
  l2: TrafficColor;
  t2: number;
  l3: TrafficColor;
  t3: number;
  l4: TrafficColor;
  t4: number;
}
