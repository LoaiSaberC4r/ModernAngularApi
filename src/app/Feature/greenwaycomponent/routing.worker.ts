import { openDB } from 'idb';
import PathFinder from 'geojson-path-finder';
import * as turf from '@turf/turf';

let pathFinder: any;
let roadNetwork: any;
let nodesCache: number[][] = [];

const DB_NAME = 'greenway-cache-db';
const STORE_NAME = 'key-value';
const KEY_PROCESSED_ROADS = 'processed-roads';
const RAW_ASSETS_CACHE = 'road-assets-cache';
const PROCESSED_VERSION = '1.0';

addEventListener('message', async ({ data }) => {
  const { type, payload } = data;

  switch (type) {
    case 'init-smart':
      try {
        const url = payload.url;
        console.log('Worker: Starting smart init for', url);
        const totalStart = performance.now();

        // 1. Try Processed Cache (IndexedDB)
        const cached = await getProcessedFromDB();
        if (cached) {
          console.log('Worker: Loaded FROM PROCESSED CACHE (IndexedDB)');
          roadNetwork = cached.roadNetwork;
          nodesCache = cached.nodesCache;

          const pfStart = performance.now();
          pathFinder = new PathFinder(roadNetwork);
          console.log(
            `Worker: PathFinder re-init took ${(performance.now() - pfStart).toFixed(2)}ms`,
          );

          buildEdgeMap();
          postMessage({ type: 'init-complete', payload: { isFromCache: true } });
          console.log(
            `Worker: Total warmth reload took ${(performance.now() - totalStart).toFixed(2)}ms`,
          );
          return;
        }

        // 2. Try Raw Cache (Cache API) or Download
        const ioStart = performance.now();
        let rawData = await getRawFromCache(url);
        if (rawData) {
          console.log(
            `Worker: Loaded FROM RAW CACHE (Cache API) in ${(performance.now() - ioStart).toFixed(2)}ms`,
          );
        } else {
          console.log('Worker: Downloading raw GeoJSON...');
          const response = await fetch(url);
          rawData = await response.json();
          await saveRawToCache(url, rawData);
          console.log(
            `Worker: Download + Raw Cache took ${(performance.now() - ioStart).toFixed(2)}ms`,
          );
        }

        // 3. Process
        console.log('Worker: Processing raw network...');
        roadNetwork = optimizeRoadNetworkInWorker(rawData);

        const pfStart = performance.now();
        pathFinder = new PathFinder(roadNetwork);
        console.log(
          `Worker: PathFinder fresh init took ${(performance.now() - pfStart).toFixed(2)}ms`,
        );

        const snapStart = performance.now();
        const nodes = new Set<string>();
        roadNetwork.features.forEach((f: any) => {
          if (f.geometry.type === 'LineString') {
            f.geometry.coordinates.forEach((c: number[]) => {
              nodes.add(`${c[0].toFixed(5)},${c[1].toFixed(5)}`);
            });
          }
        });
        nodesCache = Array.from(nodes).map((s) => s.split(',').map(Number));
        console.log(
          `Worker: Nodes Cache built with ${nodesCache.length} nodes in ${(performance.now() - snapStart).toFixed(2)}ms`,
        );

        buildEdgeMap();

        // 4. Save to Processed Cache
        const saveStart = performance.now();
        console.log('Worker: Saving processed data to IndexedDB...');
        await saveProcessedToDB({ roadNetwork, nodesCache });
        console.log(
          `Worker: Saving to IndexedDB took ${(performance.now() - saveStart).toFixed(2)}ms`,
        );

        postMessage({
          type: 'init-complete',
          payload: {
            roadNetwork: roadNetwork,
            nodesCache: nodesCache,
            isFromCache: false,
          },
        });
        console.log(
          `Worker: Total fresh init took ${(performance.now() - totalStart).toFixed(2)}ms`,
        );
      } catch (err) {
        console.error('Worker Smart Init Error:', err);
        postMessage({ type: 'error', payload: 'Failed to initialize routing engine (smart)' });
      }
      break;

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
  const MIN_LENGTH_KM = 0.01;
  const COORDINATE_PRECISION = 5; // 5 decimal places is approx 1.1m, sufficient for routing

  console.log('Worker: Optimizing road network features...');
  const start = performance.now();

  const optimized = {
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
        type: 'Feature',
        properties: {}, // STRIP ALL PROPERTIES TO SAVE MEMORY
        geometry: {
          type: 'LineString',
          coordinates: feature.geometry.coordinates.map((coord: number[]) => [
            Math.round(coord[0] * 100000) / 100000,
            Math.round(coord[1] * 100000) / 100000,
          ]),
        },
      })),
  };

  console.log(
    `Worker: Optimization took ${(performance.now() - start).toFixed(2)}ms. Features remained: ${optimized.features.length}`,
  );
  return optimized;
}

const edgeMap = new Map<string, { coords: number[][]; forward: boolean }>();

function buildEdgeMap() {
  console.log('Worker: Building Edge Map...');
  const start = performance.now();
  edgeMap.clear();
  if (!roadNetwork) return;

  const features = roadNetwork.features;
  for (let fIdx = 0; fIdx < features.length; fIdx++) {
    const f = features[fIdx];
    if (f.geometry.type === 'LineString') {
      const coords = f.geometry.coordinates;
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];

        // Faster key generation
        const k1 = `${Math.round(p1[0] * 100000)},${Math.round(p1[1] * 100000)}`;
        const k2 = `${Math.round(p2[0] * 100000)},${Math.round(p2[1] * 100000)}`;

        edgeMap.set(`${k1}->${k2}`, { coords, forward: true });
        edgeMap.set(`${k2}->${k1}`, { coords, forward: false });
      }
    }
  }
  console.log(
    `Worker: Edge Map built with ${edgeMap.size} sub-segments in ${(performance.now() - start).toFixed(2)}ms`,
  );
}

async function generateRouteSegments(path: number[][]): Promise<string[]> {
  console.log(`🔍 Generating segments for path with ${path.length} points`);
  const start = performance.now();
  const result: string[] = [];
  let lastSegId = '';

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    const k1 = `${Math.round(p1[0] * 100000)},${Math.round(p1[1] * 100000)}`;
    const k2 = `${Math.round(p2[0] * 100000)},${Math.round(p2[1] * 100000)}`;
    const key = `${k1}->${k2}`;
    const edge = edgeMap.get(key);

    if (edge) {
      const segId = await getExternalSegmentId(edge.coords, edge.forward);
      if (segId !== lastSegId) {
        result.push(segId);
        lastSegId = segId;
      }
    } else {
      console.warn('⚠️ No edge found for:', key);
    }
  }
  console.log(
    `✅ Generated ${result.length} unique segments in ${(performance.now() - start).toFixed(2)}ms`,
  );
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

// --- Helper Functions for Caching inside Worker ---

async function getProcessedFromDB() {
  try {
    const db = await openDB(DB_NAME, 2);
    const envelope = await db.get(STORE_NAME, KEY_PROCESSED_ROADS);
    if (envelope && envelope.v === PROCESSED_VERSION) {
      return envelope.data;
    }
  } catch (err) {
    console.warn('Worker: Failed to read from IndexedDB', err);
  }
  return null;
}

async function saveProcessedToDB(data: any) {
  try {
    const db = await openDB(DB_NAME, 2);
    const envelope = {
      v: PROCESSED_VERSION,
      t: Date.now(),
      data: data,
    };
    await db.put(STORE_NAME, envelope, KEY_PROCESSED_ROADS);
  } catch (err) {
    console.warn('Worker: Failed to save to IndexedDB', err);
  }
}

async function getRawFromCache(url: string) {
  try {
    const cache = await caches.open(RAW_ASSETS_CACHE);
    const response = await cache.match(url);
    if (response) {
      return await response.json();
    }
  } catch (err) {
    console.warn('Worker: Failed to read from Cache API', err);
  }
  return null;
}

async function saveRawToCache(url: string, data: any) {
  try {
    const cache = await caches.open(RAW_ASSETS_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=7776000',
      },
    });
    await cache.put(url, response);
  } catch (err) {
    console.warn('Worker: Failed to save to Cache API', err);
  }
}
