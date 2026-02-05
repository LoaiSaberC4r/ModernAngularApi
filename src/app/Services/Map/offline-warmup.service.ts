import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '../../Shared/environment/environment';
import { MapCacheService } from '../../Feature/greenwaycomponent/map-cache.service';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OfflineWarmupService {
  private readonly ngZone = inject(NgZone);
  private readonly mapCache = inject(MapCacheService);

  private worker?: Worker;
  private isWarmedUp = false;

  // RxJS stream for all worker messages
  public readonly workerMessages$ = new Subject<{ type: string; payload: any }>();

  constructor() {}

  /**
   * Initializes the routing graph in the background
   */
  async warmup(): Promise<void> {
    if (this.isWarmedUp) return;

    console.log('OfflineWarmupService: Starting background warmup...');

    this.ngZone.runOutsideAngular(() => {
      try {
        this.worker = new Worker(
          new URL('../../Feature/greenwaycomponent/routing.worker', import.meta.url),
        );

        this.worker.addEventListener('message', ({ data }) => {
          const { type, payload } = data;

          // Universal broadcast
          this.workerMessages$.next({ type, payload });

          if (type === 'init-complete') {
            console.log('OfflineWarmupService: Background warmup complete ✅');
            this.isWarmedUp = true;

            if (payload && payload.roadNetwork && !payload.isFromCache) {
              this.mapCache.saveProcessedRoadNetwork({
                roadNetwork: payload.roadNetwork,
                nodesCache: payload.nodesCache,
              });
            }
          }

          if (type === 'error') {
            console.error('OfflineWarmupService: Warmup failed', payload);
          }
        });

        this.worker.postMessage({
          type: 'init-smart',
          payload: { url: 'http://localhost:8081/roads.geojson' },
        });
      } catch (err) {
        console.error('OfflineWarmupService: Could not start worker', err);
      }
    });

    return Promise.resolve();
  }

  /**
   * Helper to send pathfinding requests to the shared worker
   */
  requestPath(payload: any) {
    if (this.worker) {
      this.worker.postMessage({ type: 'findPath', payload });
    } else {
      console.warn('OfflineWarmupService: Worker not initialized yet.');
    }
  }

  getWorker(): Worker | undefined {
    return this.worker;
  }

  getIsWarmedUp(): boolean {
    return this.isWarmedUp;
  }
}
