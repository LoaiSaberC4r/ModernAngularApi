export interface PopUpDirection {
  name: string;
  lightCode: TrafficColor;
  time: number;
}

export interface PopUpSignBox {
  Id: number;
  name: string;
  Latitude: string;
  Longitude: string;
  directions: PopUpDirection[];
}

export type TrafficColor = 'R' | 'G' | 'Y';
