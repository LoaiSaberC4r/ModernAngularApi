export interface RoadSegment {
  roadSegmentId: string;
  externalSegmentId: string;
  name: string;
  lengthMeters: number;
  speedKmh: number | null;
  isReverse?: boolean;
  direction?: number;
  directionLabel?: string;
  directionArrow?: string;
  displayName?: string;
  outgoingSegments?: RoadSegment[];
}
