import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../Shared/environment/environment';

// Interface for nearest node response
export interface NearestRoadNode {
  roadNodeId: string;
  externalNodeId: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  incomingSegments: RoadSegment[];
}

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

export interface DirectionIdResponse {
  directions: {
    directionId: number;
    name: string;
    order: number;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class IMapAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/admin/map`;

  getNearestNodes(
    cabinetId: number,
    radiusMeters: number = 2000,
    take: number = 15,
  ): Observable<NearestRoadNode[]> {
    return this.http.get<NearestRoadNode[]>(`${this.baseUrl}/cabinets/${cabinetId}/nearest-nodes`, {
      params: {
        radiusMeters: radiusMeters.toString(),
        take: take.toString(),
      },
    });
  }

  bindCabinetToNode(cabinetId: number, roadNodeId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/cabinets/${cabinetId}/bind-node/${roadNodeId}`, {});
  }

  getReadableNode(cabinetId: number, roadNodeId?: string): Observable<ReadableNodeDirection[]> {
    const params: any = { CabinetId: cabinetId.toString() };
    if (roadNodeId) params.RoadNodeId = roadNodeId;
    return this.http.get<ReadableNodeDirection[]>(`${this.baseUrl}/GetReadableNode`, { params });
  }

  getIncomingSegments(cabinetId: number): Observable<RoadSegment[]> {
    return this.http.get<RoadSegment[]>(`${this.baseUrl}/cabinets/${cabinetId}/incoming-segments`);
  }

  getDirectionIds(cabinetId: number): Observable<DirectionIdResponse> {
    return this.http.get<DirectionIdResponse>(
      `${environment.baseUrl}/SignControlBox/GetDirectionId`,
      {
        params: { CabinetId: cabinetId.toString() },
      },
    );
  }

  bindDirectionToSegment(directionId: number, roadSegmentId: string): Observable<any> {
    return this.http.put(
      `${this.baseUrl}/directions/${directionId}/bind-incoming/${roadSegmentId}`,
      {},
    );
  }
}
