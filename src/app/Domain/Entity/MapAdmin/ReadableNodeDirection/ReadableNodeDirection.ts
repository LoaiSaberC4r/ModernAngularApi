export interface ReadableNodeDirection {
  roadNodeId: string;
  distanceMeters: number;
  from: string;
  to: string;
  fromIsReverse: boolean;
  toIsReverse: boolean;
  fromSampleRoadSegmentId: string;
  toSampleRoadSegmentId: string;
  turnType: number;
  turnLabel: string;
}
