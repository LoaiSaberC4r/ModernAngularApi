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

        postMessage({
          type: 'init-complete',
          payload: {
            roadNetwork: roadNetwork,
            nodesCache: nodesCache
          }
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

        postMessage({
          type: 'init-complete',
          payload: {
            roadNetwork: roadNetwork,
            nodesCache: nodesCache
          }
        });
      } catch (err) {
        console.error('Worker Init Raw Error:', err);
        postMessage({ type: 'error', payload: 'Failed to initialize routing engine from raw data' });
      }
      break;

    case 'init-from-cache':  
      try {
        roadNetwork = payload.roadNetwork;
        nodesCache = payload.nodesCache; 
        pathFinder = new PathFinder(roadNetwork); 
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
          { type: 'Feature', geometry: { type: 'Point', coordinates: endCoords } }
        );

        postMessage({
          type: 'path-found',
          payload: {
            index: payload.index,
            path: pathResult ? pathResult.path : null,
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
  const COORDINATE_PRECISION = 5;

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
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
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
            Math.round(coord[0] * Math.pow(10, COORDINATE_PRECISION)) / Math.pow(10, COORDINATE_PRECISION),
            Math.round(coord[1] * Math.pow(10, COORDINATE_PRECISION)) / Math.pow(10, COORDINATE_PRECISION),
          ]),
        },
      })),
  };
}

function getSnapPoint(latLng: { lat: number; lng: number }): number[] {
  if (nodesCache.length === 0) return [latLng.lng, latLng.lat];

  let minDistanceSq = Infinity;
  let closestPoint = nodesCache[0];

  const targetLng = latLng.lng;
  const targetLat = latLng.lat;

  // Use squared distance for performance in the loop
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
