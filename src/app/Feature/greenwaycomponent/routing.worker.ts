/// <reference lib="webworker" />

import PathFinder from 'geojson-path-finder';
import * as turf from '@turf/turf';

let pathFinder: any;
let roadNetwork: any;

addEventListener('message', async ({ data }) => {
  const { type, payload } = data;

  switch (type) {
    case 'init':
      try {
        roadNetwork = payload.roadNetwork;
        pathFinder = new PathFinder(roadNetwork);
        postMessage({ type: 'init-complete' });
      } catch (err) {
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
        postMessage({ type: 'error', payload: 'Pathfinding error' });
      }
      break;
  }
});

function getSnapPoint(latLng: { lat: number; lng: number }): number[] {
  if (!roadNetwork || !roadNetwork.features) return [latLng.lng, latLng.lat];

  const point = turf.point([latLng.lng, latLng.lat]);
  let minDistance = Infinity;
  let closestPoint = [latLng.lng, latLng.lat];

  // Snapping to the nearest node in the network
  // In the worker, we can afford more detailed Turf operations
  roadNetwork.features.forEach((feature: any) => {
    if (feature.geometry.type === 'LineString') {
      feature.geometry.coordinates.forEach((coord: number[]) => {
        const dist = turf.distance(point, turf.point(coord));
        if (dist < minDistance) {
          minDistance = dist;
          closestPoint = coord;
        }
      });
    }
  });

  return closestPoint;
}
