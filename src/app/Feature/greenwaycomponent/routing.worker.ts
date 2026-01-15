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

        postMessage({ type: 'init-complete' });
      } catch (err) {
        console.error('Worker Init Error:', err);
        postMessage({ type: 'error', payload: 'Failed to initialize routing engine' });
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
