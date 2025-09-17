export interface PopUpSignBox {
  L1: TrafficColor;
  L2: TrafficColor;
  T1: number;
  T2: number;
  Id: number;
  name: string;
  Latitude: string;
  Longitude: string;
}

export type TrafficColor = 'R' | 'G' | 'Y';
