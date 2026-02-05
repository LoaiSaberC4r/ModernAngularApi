import { RouteReuseStrategy, ActivatedRouteSnapshot, DetachedRouteHandle } from '@angular/router';

export class AppRouteReuseStrategy implements RouteReuseStrategy {
  private handlers: { [key: string]: DetachedRouteHandle } = {};

  /**
   * Routes that should be reused (persisted in memory)
   */
  private reusableRoutes = ['map', 'trafficWizard'];

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const path = this.getRoutePath(route);
    return this.reusableRoutes.includes(path);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    if (!handle) return;
    const path = this.getRoutePath(route);
    this.handlers[path] = handle;
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const path = this.getRoutePath(route);
    return !!this.handlers[path];
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const path = this.getRoutePath(route);
    return this.handlers[path] || null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  private getRoutePath(route: ActivatedRouteSnapshot): string {
    return route.routeConfig ? route.routeConfig.path || '' : '';
  }
}
