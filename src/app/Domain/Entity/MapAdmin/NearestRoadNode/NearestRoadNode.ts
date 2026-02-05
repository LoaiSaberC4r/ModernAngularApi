import { RoadSegment } from '../RoadSegment/RoadSegment';

export interface NearestRoadNode {
  roadNodeId: string;
  externalNodeId: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  incomingSegments: RoadSegment[];
}
