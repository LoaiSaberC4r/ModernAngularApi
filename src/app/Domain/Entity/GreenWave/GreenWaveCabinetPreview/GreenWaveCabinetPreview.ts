export interface GreenWaveCabinetPreview {
  cabinetId: number;
  roadNodeId: string;
  roadNodeLat: number;
  roadNodeLon: number;
  cabinetLat: number;
  cabinetLon: number;
  distanceToRouteMeters: number;
  incomingSegmentIdOnRoute: string;
  incomingExternalSegmentIdOnRoute: string;
  openDirectionId: number;
  blockedDirectionIds: number[];
  offsetSeconds: number;
  missingDirectionMapping?: boolean;
  selectedIncomingSegmentId?: string;
  selectedIncomingExternalSegmentId?: string;
}
