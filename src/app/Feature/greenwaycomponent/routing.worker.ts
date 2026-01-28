/// <reference lib="webworker" />

import PathFinder from 'geojson-path-finder';
import * as turf from '@turf/turf';

let pathFinder: any;
let roadNetwork: any;
let nodesCache: number[][] = [];

addEventListener('message', async ({ data }) => {
  const { type, payload } = data;

  switch (type) {
    case 'init':
      try {
        roadNetwork = payload.roadNetwork;
        pathFinder = new PathFinder(roadNetwork);

        // Build a cache of all unique nodes to speed up snapping
        const nodes = new Set<string>();
        roadNetwork.features.forEach((f: any) => {
          if (f.geometry.type === 'LineString') {
            f.geometry.coordinates.forEach((c: number[]) => {
              nodes.add(`${c[0]},${c[1]}`);
            });
          }
        });
        nodesCache = Array.from(nodes).map((s) => s.split(',').map(Number));
        buildEdgeMap();

        postMessage({
          type: 'init-complete',
          payload: {
            roadNetwork: roadNetwork,
            nodesCache: nodesCache,
          },
        });
      } catch (err) {
        console.error('Worker Init Error:', err);
        postMessage({ type: 'error', payload: 'Failed to initialize routing engine' });
      }
      break;

    case 'init-raw': // Optimize + init raw road network (parallel processing)
      try {
        const rawNetwork = payload.roadNetwork;
        console.time('Worker: Optimize + Init');
        roadNetwork = optimizeRoadNetworkInWorker(rawNetwork);
        console.timeEnd('Worker: Optimize + Init');
        pathFinder = new PathFinder(roadNetwork);

        // Build a cache of all unique nodes to speed up snapping
        const nodes = new Set<string>();
        roadNetwork.features.forEach((f: any) => {
          if (f.geometry.type === 'LineString') {
            f.geometry.coordinates.forEach((c: number[]) => {
              nodes.add(`${c[0]},${c[1]}`);
            });
          }
        });
        nodesCache = Array.from(nodes).map((s) => s.split(',').map(Number));
        buildEdgeMap();

        postMessage({
          type: 'init-complete',
          payload: {
            roadNetwork: roadNetwork,
            nodesCache: nodesCache,
          },
        });
      } catch (err) {
        console.error('Worker Init Raw Error:', err);
        postMessage({
          type: 'error',
          payload: 'Failed to initialize routing engine from raw data',
        });
      }
      break;

    case 'init-from-cache':
      try {
        roadNetwork = payload.roadNetwork;
        nodesCache = payload.nodesCache;
        pathFinder = new PathFinder(roadNetwork);
        buildEdgeMap();
        postMessage({ type: 'init-complete', payload: { isFromCache: true } });
      } catch (err) {
        console.error('Worker Init From Cache Error:', err);
        postMessage({ type: 'error', payload: 'Failed to initialize routing engine from cache' });
      }
      break;

    case 'findPath':
      if (!pathFinder) {
        postMessage({ type: 'error', payload: 'Routing engine not ready' });
        return;
      }

      try {
        const { start, end } = payload;
        const startCoords = getSnapPoint(start);
        const endCoords = getSnapPoint(end);

        const pathResult = pathFinder.findPath(
          { type: 'Feature', geometry: { type: 'Point', coordinates: startCoords } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: endCoords } },
        );

        let segments: string[] = [];
        if (pathResult && pathResult.path) {
          segments = await generateRouteSegments(pathResult.path);
        }

        postMessage({
          type: 'path-found',
          payload: {
            index: payload.index,
            path: pathResult ? pathResult.path : null,
            routeSegments: segments,
            startCoords,
            endCoords,
          },
        });
      } catch (err) {
        console.error('Pathfinding Error:', err);
        postMessage({ type: 'error', payload: 'Pathfinding error' });
      }
      break;
  }
});

function optimizeRoadNetworkInWorker(roadNetwork: any): any {
  const MIN_LENGTH_KM = 0.1;
  const COORDINATE_PRECISION = 6;

  return {
    type: 'FeatureCollection',
    features: roadNetwork.features
      .filter((feature: any) => {
        if (feature.geometry?.type !== 'LineString') return false;
        const coords = feature.geometry.coordinates;
        if (!coords || coords.length < 2) return false;

        let length = 0;
        for (let i = 0; i < coords.length - 1; i++) {
          const [lng1, lat1] = coords[i];
          const [lng2, lat2] = coords[i + 1];
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLng = ((lng2 - lng1) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          length += 6371 * c;
        }
        return length >= MIN_LENGTH_KM;
      })
      .map((feature: any) => ({
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: feature.geometry.coordinates.map((coord: number[]) => [
            Math.round(coord[0] * Math.pow(10, COORDINATE_PRECISION)) /
              Math.pow(10, COORDINATE_PRECISION),
            Math.round(coord[1] * Math.pow(10, COORDINATE_PRECISION)) /
              Math.pow(10, COORDINATE_PRECISION),
          ]),
        },
      })),
  };
}

const edgeMap = new Map<string, { feature: any; forward: boolean }>();

function buildEdgeMap() {
  edgeMap.clear();
  if (!roadNetwork) return;

  roadNetwork.features.forEach((f: any) => {
    if (f.geometry.type === 'LineString') {
      const coords = f.geometry.coordinates;

      for (let i = 0; i < coords.length - 1; i++) {
        const start = coords[i];
        const end = coords[i + 1];

        // Round to 6 decimal places for consistent matching
        const startKey = `${start[0].toFixed(6)},${start[1].toFixed(6)}`;
        const endKey = `${end[0].toFixed(6)},${end[1].toFixed(6)}`;

        // Index this specific sub-segment
        // We store the whole feature so we can get its ID later
        edgeMap.set(`${startKey}->${endKey}`, { feature: f, forward: true });
        edgeMap.set(`${endKey}->${startKey}`, { feature: f, forward: false });
      }
    }
  });
  console.log('🗺️ Edge Map built with', edgeMap.size, 'sub-segments');
}

async function generateRouteSegments(path: number[][]): Promise<string[]> {
  console.log('🔍 Generating segments for path with', path.length, 'points');
  const result: string[] = [];
  let lastSegId = '';

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    // Round to 6 decimal places to match edge map keys
    const p1Key = `${p1[0].toFixed(6)},${p1[1].toFixed(6)}`;
    const p2Key = `${p2[0].toFixed(6)},${p2[1].toFixed(6)}`;
    const key = `${p1Key}->${p2Key}`;
    const edge = edgeMap.get(key);

    if (edge) {
      const segId = await getExternalSegmentId(edge.feature.geometry.coordinates, edge.forward);
      if (segId !== lastSegId) {
        result.push(segId);
        lastSegId = segId;
      }
    } else {
      console.warn('⚠️ No edge found for:', key);
    }
  }
  console.log('✅ Generated', result.length, 'unique segments');
  return result;
}

async function getExternalSegmentId(coords: number[][], isForward: boolean): Promise<string> {
  const first = coords[0];
  const last = coords[coords.length - 1];

  const fromNodeId = `N_${first[1].toFixed(6)}_${first[0].toFixed(6)}`;
  const toNodeId = `N_${last[1].toFixed(6)}_${last[0].toFixed(6)}`;

  // SHA256 on all points: {lat:F6},{lon:F6};
  let hashInput = '';
  for (const p of coords) {
    hashInput += `${p[1].toFixed(6)},${p[0].toFixed(6)};`;
  }

  const hash12 = await calculateHash12(hashInput);
  const baseId = `SEG_${fromNodeId}_${toNodeId}_${hash12}`;

  return isForward ? baseId : `${baseId}_REV`;
}

async function calculateHash12(input: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return hashHex.substring(0, 12);
}

function getSnapPoint(latLng: { lat: number; lng: number }): number[] {
  if (nodesCache.length === 0) return [latLng.lng, latLng.lat];

  let minDistanceSq = Infinity;
  let closestPoint = nodesCache[0];

  const targetLng = latLng.lng;
  const targetLat = latLng.lat;

  for (let i = 0; i < nodesCache.length; i++) {
    const node = nodesCache[i];
    const dlng = node[0] - targetLng;
    const dlat = node[1] - targetLat;
    const distSq = dlng * dlng + dlat * dlat;

    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closestPoint = node;
    }
  }

  return closestPoint;
}
