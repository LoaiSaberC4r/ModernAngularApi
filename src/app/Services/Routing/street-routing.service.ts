import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import * as L from 'leaflet';

interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  neighbors: { nodeId: string; weight: number }[];
}

@Injectable({
  providedIn: 'root',
})
export class StreetRoutingService {
  private http = inject(HttpClient);

  private graph = new Map<string, GraphNode>();
  private isGraphReady = new BehaviorSubject<boolean>(false);
  public isReady$ = this.isGraphReady.asObservable();

  constructor() {
    this.loadGraph();
  }

  private loadGraph() {
    this.http.get<any>('assets/data/roads.geojson').subscribe({
      next: (data) => {
        this.buildGraph(data);
        this.isGraphReady.next(true);
        console.log('Road Graph Loaded. Nodes:', this.graph.size);
      },
      error: (err) => {
        console.error('Failed to load road network', err);
        // Even if file fails, we want to allow manual roads
        this.isGraphReady.next(true);
      },
    });
  }

  private buildGraph(geoJson: any) {
    if (!geoJson || !geoJson.features) return;

    geoJson.features.forEach((feature: any) => {
      if (feature.geometry && feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates; // [lng, lat]

        for (let i = 0; i < coords.length - 1; i++) {
          const p1 = coords[i];
          const p2 = coords[i + 1];

          const n1 = this.addNode(p1[1], p1[0]);
          const n2 = this.addNode(p2[1], p2[0]);

          const dist = this.distance(n1.lat, n1.lng, n2.lat, n2.lng);

          n1.neighbors.push({ nodeId: n2.id, weight: dist });
          n2.neighbors.push({ nodeId: n1.id, weight: dist });
        }
      }
    });
  }

  private addNode(lat: number, lng: number): GraphNode {
    const id = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (!this.graph.has(id)) {
      this.graph.set(id, { id, lat, lng, neighbors: [] });
    }
    return this.graph.get(id)!;
  }

  private distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private findNearestNode(lat: number, lng: number): GraphNode | null {
    let nearest: GraphNode | null = null;
    let minMsg = Infinity;

    for (const node of this.graph.values()) {
      const dist = this.distance(lat, lng, node.lat, node.lng);
      if (dist < minMsg) {
        minMsg = dist;
        nearest = node;
      }
    }

    if (minMsg > 2000) return null;
    return nearest;
  }

  getRoutePoints(start: L.LatLng, end: L.LatLng): Observable<L.LatLng[]> {
    if (!this.isGraphReady.value) {
      return of([start, end]);
    }

    const startNode = this.findNearestNode(start.lat, start.lng);
    const endNode = this.findNearestNode(end.lat, end.lng);

    if (!startNode || !endNode) {
      return of([start, end]);
    }

    const path = this.astar(startNode, endNode);
    if (path.length > 0) {
      const result = path.map((n) => L.latLng(n.lat, n.lng));
      return of([start, ...result, end]);
    }

    return of([start, end]);
  }

  public addManualRoad(points: L.LatLng[]) {
    if (points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const n1 = this.addNode(p1.lat, p1.lng);
      const n2 = this.addNode(p2.lat, p2.lng);

      const dist = this.distance(n1.lat, n1.lng, n2.lat, n2.lng);

      if (!n1.neighbors.some((n) => n.nodeId === n2.id)) {
        n1.neighbors.push({ nodeId: n2.id, weight: dist });
      }
      if (!n2.neighbors.some((n) => n.nodeId === n1.id)) {
        n2.neighbors.push({ nodeId: n1.id, weight: dist });
      }
    }
  }

  public getCurrentGeoJSON(): string {
    const features: any[] = [];
    const visitedEdges = new Set<string>();

    this.graph.forEach((node) => {
      node.neighbors.forEach((neighbor) => {
        const edgeId = [node.id, neighbor.nodeId].sort().join('-');
        if (!visitedEdges.has(edgeId)) {
          visitedEdges.add(edgeId);
          const neighborNode = this.graph.get(neighbor.nodeId)!;
          features.push({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [node.lng, node.lat],
                [neighborNode.lng, neighborNode.lat],
              ],
            },
          });
        }
      });
    });

    return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
  }

  private astar(start: GraphNode, end: GraphNode): GraphNode[] {
    const openSet = new Set<string>([start.id]);
    const cameFrom = new Map<string, string>();

    const gScore = new Map<string, number>();
    gScore.set(start.id, 0);

    const fScore = new Map<string, number>();
    fScore.set(start.id, this.distance(start.lat, start.lng, end.lat, end.lng));

    while (openSet.size > 0) {
      let currentId: string | null = null;
      let minF = Infinity;

      openSet.forEach((id) => {
        const score = fScore.get(id) ?? Infinity;
        if (score < minF) {
          minF = score;
          currentId = id;
        }
      });

      if (currentId === end.id) {
        return this.reconstructPath(cameFrom, currentId, this.graph);
      }

      openSet.delete(currentId!);
      const currentNode = this.graph.get(currentId!)!;

      for (const neighbor of currentNode.neighbors) {
        const tentativeG = (gScore.get(currentId!) ?? Infinity) + neighbor.weight;

        if (tentativeG < (gScore.get(neighbor.nodeId) ?? Infinity)) {
          cameFrom.set(neighbor.nodeId, currentId!);
          gScore.set(neighbor.nodeId, tentativeG);

          const neighborNode = this.graph.get(neighbor.nodeId)!;
          fScore.set(
            neighbor.nodeId,
            tentativeG + this.distance(neighborNode.lat, neighborNode.lng, end.lat, end.lng)
          );

          if (!openSet.has(neighbor.nodeId)) {
            openSet.add(neighbor.nodeId);
          }
        }
      }
    }

    return [];
  }

  private reconstructPath(
    cameFrom: Map<string, string>,
    currentId: string,
    graph: Map<string, GraphNode>
  ): GraphNode[] {
    const totalPath = [graph.get(currentId)!];
    while (cameFrom.has(currentId)) {
      currentId = cameFrom.get(currentId)!;
      totalPath.unshift(graph.get(currentId)!);
    }
    return totalPath;
  }
}
