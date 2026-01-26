import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface GreenwayDB extends DBSchema {
  'key-value': {
    key: string;
    value: any;
  };
}

@Injectable({ providedIn: 'root' })
export class MapCacheService {
  readonly PROCESSED_ROAD_DATA_VERSION = '1.0';
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

  getCacheInfo() {
    return { info: 'Using IndexedDB directly via idb library' };
  }
}
