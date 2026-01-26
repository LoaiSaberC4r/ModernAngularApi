import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, shareReplay } from 'rxjs';
import { MapCacheService } from './map-cache.service';

@Injectable({ providedIn: 'root' })
export class RoadNetworkRepository {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(MapCacheService);

  private loadOncePromise: Promise<any> | null = null;

  async loadRoadNetworkOnce(url: string): Promise<any> {
    if (this.loadOncePromise) return this.loadOncePromise;

    this.loadOncePromise = (async () => {
      const cached = await this.cache.getProcessedRoadNetwork();
      if (cached) return cached;

      const data = await firstValueFrom(this.http.get<any>(url));

      await this.cache.saveProcessedRoadNetwork(data);

      return data;
    })();

    return this.loadOncePromise;
  }
}
