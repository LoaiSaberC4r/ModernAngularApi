import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { environment } from '../../Shared/environment/environment';

@Injectable({
  providedIn: 'root',
})
export class TileCacheService {
  private readonly CACHE_NAME = `map-tiles-cache-${environment.mapCacheVersion}`;

  constructor() {}

  /**
   * Creates a custom Leaflet TileLayer that uses CacheStorage
   */
  createCachedTileLayer(urlPattern: string, options: L.TileLayerOptions = {}): L.TileLayer {
    const self = this;
    const CachedLayer = L.TileLayer.extend({
      createTile: function (coords: L.Coords, done: L.DoneCallback) {
        const tile = document.createElement('img');
        const url = (this as any).getTileUrl(coords);

        L.DomEvent.on(
          tile,
          'load',
          L.Util.bind((this as any)._tileOnLoad, this as any, done, tile),
        );
        L.DomEvent.on(
          tile,
          'error',
          L.Util.bind((this as any)._tileOnError, this as any, done, tile),
        );

        if ((this as any).options.crossOrigin || (this as any).options.crossOrigin === '') {
          tile.crossOrigin =
            (this as any).options.crossOrigin === true ? '' : (this as any).options.crossOrigin;
        }

        tile.alt = '';
        tile.setAttribute('role', 'presentation');

        // Logic for caching
        self
          .getTileFromCacheOrDownload(url)
          .then((blobUrl) => {
            tile.src = blobUrl;
          })
          .catch(() => {
            tile.src = url; // Fallback to direct URL if anything fails
          });

        return tile;
      },
    });

    return new (CachedLayer as any)(urlPattern, {
      ...options,
      crossOrigin: true,
    });
  }

  private async getTileFromCacheOrDownload(url: string): Promise<string> {
    if (!('caches' in window)) return url;

    try {
      const cache = await caches.open(this.CACHE_NAME);
      const cachedResponse = await cache.match(url);

      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        return URL.createObjectURL(blob);
      }

      // Not in cache, download and store
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response.clone());
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
    } catch (err) {
      console.warn('TileCacheService: Cache failure', err);
    }

    return url;
  }
}
