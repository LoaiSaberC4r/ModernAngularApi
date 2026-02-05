import { Injectable } from '@angular/core';
import { environment } from '../../Shared/environment/environment';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface GreenwayDB extends DBSchema {
  'key-value': {
    key: string;
    value: any;
  };
}

@Injectable({ providedIn: 'root' })
export class MapCacheService {
  readonly PROCESSED_ROAD_DATA_VERSION = environment.mapCacheVersion;
  private readonly DB_NAME = 'greenway-cache-db';
  private readonly STORE_NAME = 'key-value';
  private readonly KEY_PROCESSED_ROADS = 'processed-roads';

  private dbPromise: Promise<IDBPDatabase<GreenwayDB>>;

  constructor() {
    this.dbPromise = openDB<GreenwayDB>(this.DB_NAME, 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('key-value')) {
          db.createObjectStore('key-value');
        }
      },
    });
  }

  async getProcessedRoadNetwork(): Promise<any | null> {
    console.log('MapCacheService: Checking IndexedDB for processed data...');
    try {
      const db = await this.dbPromise;
      const envelope = await db.get(this.STORE_NAME, this.KEY_PROCESSED_ROADS);

      if (!envelope) {
        console.log('MapCacheService: No data found in IndexedDB.');
        return null;
      }

      if (envelope.v !== this.PROCESSED_ROAD_DATA_VERSION) {
        console.log('MapCacheService: Version mismatch.', {
          cached: envelope.v,
          current: this.PROCESSED_ROAD_DATA_VERSION,
        });
        return null;
      }

      console.log('MapCacheService: Found processed data in IndexedDB.');
      return envelope.data;
    } catch (err) {
      console.error('MapCacheService: Error reading from IndexedDB:', err);
      return null;
    }
  }

  async saveProcessedRoadNetwork(data: any): Promise<{ savedTo: 'indexedDB' | 'none' }> {
    console.log('MapCacheService: Saving processed data to IndexedDB...');
    try {
      const envelope = {
        v: this.PROCESSED_ROAD_DATA_VERSION,
        t: Date.now(),
        data: data,
      };

      const db = await this.dbPromise;
      await db.put(this.STORE_NAME, envelope, this.KEY_PROCESSED_ROADS);

      console.log('MapCacheService: Successfully saved processed data to IndexedDB.');
      return { savedTo: 'indexedDB' };
    } catch (err) {
      console.error('MapCacheService: Failed to save to IndexedDB:', err);
      return { savedTo: 'none' };
    }
  }

  async clearCache(): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.delete(this.STORE_NAME, this.KEY_PROCESSED_ROADS);
      console.log('MapCacheService: Cache cleared.');
    } catch (err) {
      console.error('MapCacheService: Error clearing cache:', err);
    }
  }

  // --- NEW: Cache Storage API for raw assets (larger files) ---

  private readonly RAW_ASSETS_CACHE = `road-assets-cache-${environment.mapCacheVersion}`;

  async getCachedRoadGeoJSON(url: string): Promise<any | null> {
    console.log(`MapCacheService: Checking CacheStorage for ${url}...`);
    try {
      if (!('caches' in window)) return null;

      const cache = await caches.open(this.RAW_ASSETS_CACHE);
      const response = await cache.match(url);

      if (!response) {
        console.log('MapCacheService: CacheStorage miss.');
        return null;
      }

      console.log('MapCacheService: CacheStorage hit.');
      return await response.json();
    } catch (err) {
      console.error('MapCacheService: CacheStorage error:', err);
      return null;
    }
  }

  async cacheRoadGeoJSON(url: string, data: any): Promise<void> {
    console.log(`MapCacheService: Storing raw data in CacheStorage for ${url}...`);
    try {
      if (!('caches' in window)) return;

      const cache = await caches.open(this.RAW_ASSETS_CACHE);
      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=7776000', // 90 days
        },
      });
      await cache.put(url, response);
      console.log('MapCacheService: Successfully cached raw GeoJSON.');
    } catch (err) {
      console.error('MapCacheService: Failed to cache raw GeoJSON:', err);
    }
  }

  getCacheInfo() {
    return { info: 'Using IndexedDB for processed data and CacheStorage for raw assets' };
  }
}
