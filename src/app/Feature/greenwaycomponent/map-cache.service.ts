import { Injectable } from '@angular/core';
import * as pako from 'pako';

type CacheEnvelope<T> = {
  v: string;
  t: number;
  data: T;
};

type ProcessedRoadNetwork = {
  roadNetwork: any;
  nodesCache: number[][];
};

@Injectable({ providedIn: 'root' })
export class MapCacheService {
  readonly ROAD_DATA_VERSION = '1.0';
  readonly PROCESSED_ROAD_DATA_VERSION = '1.0'; 

  private readonly LS_KEY_ROADS = 'greenway:roads.geojson';
  private readonly LS_KEY_PROCESSED_ROADS = 'greenway:processed-roads';  
  private readonly DB_NAME = 'greenway-cache-db';
  private readonly DB_VERSION = 1;
  private readonly STORE = 'kv';
  private readonly DB_KEY_ROADS = 'roads.geojson';
  private readonly DB_KEY_PROCESSED_ROADS = 'processed-roads';  

 
  async getRoadNetwork<T = unknown>(): Promise<T | null> {
    console.log('MapCacheService: Checking localStorage for raw road network...');
    const ls = this.getFromLocalStorageCompressed<T>(this.LS_KEY_ROADS, this.ROAD_DATA_VERSION);
    if (ls) {
      console.log('MapCacheService: Found raw road network in localStorage (compressed), version matches.');
      return ls;
    }
    console.log('MapCacheService: Not found or version mismatch in localStorage for raw road network.');

    console.log('MapCacheService: Checking IndexedDB for raw road network...');
    const idb = await this.getFromIndexedDbCompressed<T>(this.DB_KEY_ROADS, this.ROAD_DATA_VERSION);
    if (idb) {
      console.log('MapCacheService: Found raw road network in IndexedDB (compressed), version matches.');
      return idb;
    }
    console.log('MapCacheService: Not found or version mismatch in IndexedDB for raw road network.');

    return null;
  }

 
  async saveRoadNetwork<T = unknown>(
    data: T,
  ): Promise<{ savedTo: 'localStorage' | 'indexedDB' | 'none' }> {
    const envelope: CacheEnvelope<T> = { v: this.ROAD_DATA_VERSION, t: Date.now(), data };

     console.log('MapCacheService: Trying to save raw road network to localStorage (compressed)...');
    const savedLs = this.trySaveToLocalStorageCompressed(envelope, this.LS_KEY_ROADS);
    if (savedLs) {
      console.log('MapCacheService: Saved raw road network to localStorage (compressed).');
      return { savedTo: 'localStorage' };
    }
    console.log('MapCacheService: Failed to save raw road network to localStorage. Falling back to IndexedDB (compressed).');

     console.log('MapCacheService: Trying to save raw road network to IndexedDB (compressed)...');
    const savedDb = await this.saveToIndexedDbCompressed(envelope, this.DB_KEY_ROADS);
    if (savedDb) {
      console.log('MapCacheService: Saved raw road network to IndexedDB (compressed).');
      return { savedTo: 'indexedDB' };
    }
    console.log('MapCacheService: Failed to save raw road network to IndexedDB.');

    return { savedTo: 'none' };
  }

  clearCache(): void {
    try {
      localStorage.removeItem(this.LS_KEY_ROADS);
      localStorage.removeItem(this.LS_KEY_PROCESSED_ROADS);
    } catch {
     }
     void this.deleteFromIndexedDb(this.DB_KEY_ROADS);
    void this.deleteFromIndexedDb(this.DB_KEY_PROCESSED_ROADS);
  }

  getCacheInfo(): {
    localStorage: { exists: boolean; version: string | null; sizeBytes: number };
  } {
    try {
      const raw = localStorage.getItem(this.LS_KEY_ROADS);
      if (!raw) return { localStorage: { exists: false, version: null, sizeBytes: 0 } };
      const parsed = JSON.parse(raw) as CacheEnvelope<unknown>;
      return {
        localStorage: {
          exists: true,
          version: parsed?.v ?? null,
          sizeBytes: this.bytes(raw),
        },
      };
    } catch {
      return { localStorage: { exists: false, version: null, sizeBytes: 0 } };
    }
  }
 
  async getProcessedRoadNetwork(): Promise<ProcessedRoadNetwork | null> {
    // 1) localStorage (compressed)
    console.log('MapCacheService: Checking localStorage for processed data...');
    const ls = this.getFromLocalStorageCompressed<ProcessedRoadNetwork>(this.LS_KEY_PROCESSED_ROADS, this.PROCESSED_ROAD_DATA_VERSION);
    if (ls) {
      console.log('MapCacheService: Found processed data in localStorage (compressed), version matches.');
      return ls;
    }
    console.log('MapCacheService: Not found or version mismatch in localStorage for processed data.');

    // 2) IndexedDB (compressed)
    console.log('MapCacheService: Checking IndexedDB for processed data...');
    const idb = await this.getFromIndexedDbCompressed<ProcessedRoadNetwork>(this.DB_KEY_PROCESSED_ROADS, this.PROCESSED_ROAD_DATA_VERSION);
    if (idb) {
      console.log('MapCacheService: Found processed data in IndexedDB (compressed), version matches.');
      return idb;
    }
    console.log('MapCacheService: Not found or version mismatch in IndexedDB for processed data.');

    return null;
  }

  /**
   * Save PROCESSED data to localStorage if possible; if quota exceeded -> IndexedDB.
   */
  async saveProcessedRoadNetwork(
    data: ProcessedRoadNetwork,
  ): Promise<{ savedTo: 'localStorage' | 'indexedDB' | 'none' }> {
    const envelope: CacheEnvelope<ProcessedRoadNetwork> = { v: this.PROCESSED_ROAD_DATA_VERSION, t: Date.now(), data };

    // Try localStorage (compressed)
    console.log('MapCacheService: Trying to save processed data to localStorage (compressed)...');
    const savedLs = this.trySaveToLocalStorageCompressed(envelope, this.LS_KEY_PROCESSED_ROADS);
    if (savedLs) {
      console.log('MapCacheService: Saved processed data to localStorage (compressed).');
      return { savedTo: 'localStorage' };
    }
    console.log('MapCacheService: Failed to save processed data to localStorage. Falling back to IndexedDB (compressed).');

    // Fallback to IndexedDB (compressed)
    console.log('MapCacheService: Trying to save processed data to IndexedDB (compressed)...');
    const savedDb = await this.saveToIndexedDbCompressed(envelope, this.DB_KEY_PROCESSED_ROADS);
    if (savedDb) {
      console.log('MapCacheService: Saved processed data to IndexedDB (compressed).');
      return { savedTo: 'indexedDB' };
    }
    console.log('MapCacheService: Failed to save processed data to IndexedDB.');

    return { savedTo: 'none' };
  }

  // -------------------- localStorage helpers --------------------
  private getFromLocalStorage<T>(key: string, version: string): T | null {
    try {
      const raw = localStorage.getItem(key); // Use passed key
      if (!raw) {
        console.log(`MapCacheService: localStorage item (${key}) not found.`); // Updated log
        return null;
      }
      const parsed = JSON.parse(raw) as CacheEnvelope<T>;
      if (!parsed?.v || !('data' in parsed)) {
        console.log(`MapCacheService: localStorage item (${key}) malformed.`); // Updated log
        return null;
      }
      if (parsed.v !== version) { // Use passed version
        console.log(`MapCacheService: localStorage item (${key}) version mismatch.`, 'Cached:', parsed.v, 'Current:', version); // Updated log
        return null;
      }
      return parsed.data;
    } catch (e) {
      console.error(`MapCacheService: Error getting from localStorage (${key}):`, e); // Updated log
      return null;
    }
  }

  private trySaveToLocalStorage<T>(envelope: CacheEnvelope<T>, key: string): boolean {
    try {
      const raw = JSON.stringify(envelope);
      localStorage.setItem(key, raw); // Use passed key
      return true;
    } catch (e) {
      console.error(`MapCacheService: Error saving to localStorage (${key}):`, e); // Updated log
      return false;
    }
  }

  private bytes(str: string): number {
    try {
      return new TextEncoder().encode(str).length;
    } catch {
      return str.length * 2;
    }
  }

  // -------------------- IndexedDB helpers --------------------
  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE);
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async getFromIndexedDb<T>(key: string, version: string): Promise<T | null> {
    try {
      const db = await this.openDb();
      return await new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(this.STORE, 'readonly');
        const store = tx.objectStore(this.STORE);
        const req = store.get(key); // Use passed key

        req.onsuccess = () => {
          const envelope = req.result as CacheEnvelope<T> | undefined;
          if (!envelope?.v || !('data' in envelope)) {
            console.log(`MapCacheService: IndexedDB item (${key}) malformed.`); // Updated log
            return resolve(null);
          }
          if (envelope.v !== version) { // Use passed version
            console.log(`MapCacheService: IndexedDB item (${key}) version mismatch.`, 'Cached:', envelope.v, 'Current:', version); // Updated log
            return resolve(null);
          }
          resolve(envelope.data);
        };

        req.onerror = () => {
          console.error(`MapCacheService: IndexedDB get error (${key}):`, req.error);
          reject(req.error);
        };
      });
    } catch (e) {
      console.error(`MapCacheService: Error getting from IndexedDB (${key}):`, e);
      return null;
    }
  }

  private async saveToIndexedDb<T>(envelope: CacheEnvelope<T>, key: string): Promise<boolean> {
    try {
      const db = await this.openDb();
      return await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(this.STORE, 'readwrite');
        const store = tx.objectStore(this.STORE);
        const req = store.put(envelope, key); // Use passed key

        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          console.error(`MapCacheService: IndexedDB save error (${key}):`, req.error);
          reject(req.error);
        };

        tx.onabort = () => {
          console.log(`MapCacheService: IndexedDB save transaction (${key}) aborted.`);
          resolve(false);
        };
      });
    } catch (e) {
      console.error(`MapCacheService: Error saving to IndexedDB (${key}):`, e);
      return false;
    }
  }

  private async deleteFromIndexedDb(key: string): Promise<void> {
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(this.STORE, 'readwrite');
        const store = tx.objectStore(this.STORE);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onabort = () => resolve();
      });
    } catch {
      // ignore
    }
  }

  // -------------------- Compression helpers --------------------
  private compressData<T>(data: T): string {
    try {
      const json = JSON.stringify(data);
      const compressed = pako.deflate(json);
      
      // Convert Uint8Array to binary string in chunks to avoid stack overflow
      // (can't call String.fromCharCode with 46M+ args)
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < compressed.length; i += chunkSize) {
        const chunk = compressed.slice(i, i + chunkSize);
        binary += String.fromCharCode(...Array.from(chunk));
      }
      
      return btoa(binary); // Convert to base64 for safe storage
    } catch (e) {
      console.error('MapCacheService: Error compressing data:', e);
      throw e;
    }
  }

  private decompressData<T>(compressed: string): T {
    try {
      const binary = atob(compressed); // Convert from base64
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const json = pako.inflate(bytes, { to: 'string' });
      return JSON.parse(json);
    } catch (e) {
      console.error('MapCacheService: Error decompressing data:', e);
      throw e;
    }
  }

  private getFromLocalStorageCompressed<T>(key: string, version: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        console.log(`MapCacheService: localStorage item (${key}) not found.`);
        return null;
      }
      const parsed = JSON.parse(raw) as CacheEnvelope<string>;
      if (!parsed?.v || !('data' in parsed)) {
        console.log(`MapCacheService: localStorage item (${key}) malformed.`);
        return null;
      }
      if (parsed.v !== version) {
        console.log(`MapCacheService: localStorage item (${key}) version mismatch.`, 'Cached:', parsed.v, 'Current:', version);
        return null;
      }
      try {
        return this.decompressData<T>(parsed.data);
      } catch (decompressionError) {
        console.error(`MapCacheService: Failed to decompress localStorage item (${key}), cache is corrupted:`, decompressionError);
        // Clear corrupted cache
        localStorage.removeItem(key);
        return null;
      }
    } catch (e) {
      console.error(`MapCacheService: Error getting from localStorage (${key}):`, e);
      return null;
    }
  }

  private trySaveToLocalStorageCompressed<T>(envelope: CacheEnvelope<T>, key: string): boolean {
    try {
      const compressed = this.compressData(envelope.data);
      const envelopeCompressed: CacheEnvelope<string> = { ...envelope, data: compressed };
      const raw = JSON.stringify(envelopeCompressed);
      localStorage.setItem(key, raw);
      console.log(`MapCacheService: Saved compressed data to localStorage (${key}). Size: ${this.bytes(raw)} bytes`);
      return true;
    } catch (e) {
      console.error(`MapCacheService: Error saving to localStorage (${key}):`, e);
      return false;
    }
  }

  private async getFromIndexedDbCompressed<T>(key: string, version: string): Promise<T | null> {
    try {
      const db = await this.openDb();
      return await new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(this.STORE, 'readonly');
        const store = tx.objectStore(this.STORE);
        const req = store.get(key);

        req.onsuccess = () => {
          const envelope = req.result as CacheEnvelope<string> | undefined;
          if (!envelope?.v || !('data' in envelope)) {
            console.log(`MapCacheService: IndexedDB item (${key}) malformed.`);
            return resolve(null);
          }
          if (envelope.v !== version) {
            console.log(`MapCacheService: IndexedDB item (${key}) version mismatch.`, 'Cached:', envelope.v, 'Current:', version);
            return resolve(null);
          }
          try {
            const decompressed = this.decompressData<T>(envelope.data);
            resolve(decompressed);
          } catch (decompressionError) {
            console.error(`MapCacheService: Failed to decompress IndexedDB item (${key}), cache is corrupted:`, decompressionError);
            // Clear corrupted cache entry
            const deleteTx = db.transaction(this.STORE, 'readwrite');
            deleteTx.objectStore(this.STORE).delete(key);
            resolve(null);
          }
        };

        req.onerror = () => {
          console.error(`MapCacheService: IndexedDB get error (${key}):`, req.error);
          reject(req.error);
        };
      });
    } catch (e) {
      console.error(`MapCacheService: Error getting from IndexedDB (${key}):`, e);
      return null;
    }
  }

  private async saveToIndexedDbCompressed<T>(envelope: CacheEnvelope<T>, key: string): Promise<boolean> {
    try {
      const compressed = this.compressData(envelope.data);
      const envelopeCompressed: CacheEnvelope<string> = { ...envelope, data: compressed };
      const db = await this.openDb();
      return await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(this.STORE, 'readwrite');
        const store = tx.objectStore(this.STORE);
        const req = store.put(envelopeCompressed, key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          console.error(`MapCacheService: IndexedDB save error (${key}):`, req.error);
          reject(req.error);
        };

        tx.onabort = () => {
          console.log(`MapCacheService: IndexedDB save transaction (${key}) aborted.`);
          resolve(false);
        };
      });
    } catch (e) {
      console.error(`MapCacheService: Error saving to IndexedDB (${key}):`, e);
      return false;
    }
  }
}
