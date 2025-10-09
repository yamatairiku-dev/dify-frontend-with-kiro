import { queryClient, prefetchQueries } from '../config/react-query';
import type { DifyWorkflow } from '../types/dify';

// Route preloading utilities for improved navigation performance
export class RoutePreloader {
  private static preloadedRoutes = new Set<string>();
  private static preloadTimeouts = new Map<string, NodeJS.Timeout>();

  // Preload data for workflow list route
  static async preloadWorkflowList(filters?: Record<string, any>): Promise<void> {
    const routeKey = `workflows-list-${JSON.stringify(filters || {})}`;
    
    if (this.preloadedRoutes.has(routeKey)) {
      return; // Already preloaded
    }

    try {
      await prefetchQueries.workflowsList(filters);
      this.preloadedRoutes.add(routeKey);
      
      // Clear preload flag after 5 minutes
      const timeout = setTimeout(() => {
        this.preloadedRoutes.delete(routeKey);
      }, 5 * 60 * 1000);
      
      this.preloadTimeouts.set(routeKey, timeout);
    } catch (error) {
      console.warn('Failed to preload workflow list:', error);
    }
  }

  // Preload data for specific workflow route
  static async preloadWorkflow(workflowId: string): Promise<void> {
    const routeKey = `workflow-${workflowId}`;
    
    if (this.preloadedRoutes.has(routeKey)) {
      return; // Already preloaded
    }

    try {
      await prefetchQueries.workflowDetail(workflowId);
      this.preloadedRoutes.add(routeKey);
      
      // Clear preload flag after 10 minutes (workflow data is more stable)
      const timeout = setTimeout(() => {
        this.preloadedRoutes.delete(routeKey);
      }, 10 * 60 * 1000);
      
      this.preloadTimeouts.set(routeKey, timeout);
    } catch (error) {
      console.warn(`Failed to preload workflow ${workflowId}:`, error);
    }
  }

  // Preload multiple workflows in batch
  static async preloadWorkflows(workflowIds: string[]): Promise<void> {
    const preloadPromises = workflowIds.map(id => this.preloadWorkflow(id));
    await Promise.allSettled(preloadPromises);
  }

  // Smart preloading based on user behavior patterns
  static async smartPreload(currentRoute: string, workflows?: DifyWorkflow[]): Promise<void> {
    switch (currentRoute) {
      case '/':
      case '/dashboard':
        // On dashboard, preload workflow list
        await this.preloadWorkflowList();
        break;
        
      case '/workflows':
        // On workflow list, preload first few workflows
        if (workflows && workflows.length > 0) {
          const topWorkflows = workflows.slice(0, 3).map(w => w.id);
          await this.preloadWorkflows(topWorkflows);
        }
        break;
        
      default:
        // For workflow detail pages, preload related workflows
        if (currentRoute.startsWith('/workflows/') && workflows) {
          const currentWorkflowId = currentRoute.split('/')[2];
          const currentWorkflow = workflows.find(w => w.id === currentWorkflowId);
          
          if (currentWorkflow) {
            // Preload workflows in the same category
            const relatedWorkflows = workflows
              .filter(w => w.category === currentWorkflow.category && w.id !== currentWorkflowId)
              .slice(0, 2)
              .map(w => w.id);
            
            await this.preloadWorkflows(relatedWorkflows);
          }
        }
        break;
    }
  }

  // Clear all preload timeouts and flags
  static clearAllPreloads(): void {
    this.preloadTimeouts.forEach(timeout => clearTimeout(timeout));
    this.preloadTimeouts.clear();
    this.preloadedRoutes.clear();
  }

  // Get preload statistics
  static getPreloadStats(): {
    preloadedRoutes: number;
    activeTimeouts: number;
    cacheSize: number;
  } {
    return {
      preloadedRoutes: this.preloadedRoutes.size,
      activeTimeouts: this.preloadTimeouts.size,
      cacheSize: queryClient.getQueryCache().getAll().length,
    };
  }
}

// Hook for route-based preloading
export const useRoutePreloading = () => {
  const preloadWorkflowList = async (filters?: Record<string, any>) => {
    await RoutePreloader.preloadWorkflowList(filters);
  };

  const preloadWorkflow = async (workflowId: string) => {
    await RoutePreloader.preloadWorkflow(workflowId);
  };

  const smartPreload = async (currentRoute: string, workflows?: DifyWorkflow[]) => {
    await RoutePreloader.smartPreload(currentRoute, workflows);
  };

  return {
    preloadWorkflowList,
    preloadWorkflow,
    smartPreload,
    getStats: RoutePreloader.getPreloadStats,
    clearAll: RoutePreloader.clearAllPreloads,
  };
};

// Link component with preloading
export interface PreloadLinkProps {
  to: string;
  children: React.ReactNode;
  preloadData?: boolean;
  workflowId?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

// Note: This would need to be moved to a .tsx file to use JSX
// For now, we'll export the interface and let components implement it
export const createPreloadLink = () => {
  return {
    handleMouseEnter: async (to: string, workflowId?: string, preloadData = true) => {
      if (!preloadData) return;

      if (to === '/workflows') {
        await RoutePreloader.preloadWorkflowList();
      } else if (workflowId) {
        await RoutePreloader.preloadWorkflow(workflowId);
      } else if (to.startsWith('/workflows/')) {
        const id = to.split('/')[2];
        if (id) {
          await RoutePreloader.preloadWorkflow(id);
        }
      }
    }
  };
};

// Performance monitoring for preloading
export class PreloadPerformanceMonitor {
  private static metrics = new Map<string, {
    preloadTime: number;
    cacheHit: boolean;
    loadTime: number;
  }>();

  static recordPreload(routeKey: string, startTime: number): void {
    const preloadTime = Date.now() - startTime;
    this.metrics.set(routeKey, {
      preloadTime,
      cacheHit: false,
      loadTime: 0,
    });
  }

  static recordCacheHit(routeKey: string, loadTime: number): void {
    const existing = this.metrics.get(routeKey);
    if (existing) {
      existing.cacheHit = true;
      existing.loadTime = loadTime;
    }
  }

  static getMetrics(): Array<{
    route: string;
    preloadTime: number;
    cacheHit: boolean;
    loadTime: number;
    efficiency: number;
  }> {
    return Array.from(this.metrics.entries()).map(([route, metrics]) => ({
      route,
      ...metrics,
      efficiency: metrics.cacheHit ? (metrics.preloadTime / (metrics.loadTime || 1)) : 0,
    }));
  }

  static clearMetrics(): void {
    this.metrics.clear();
  }
}

// Intersection Observer for automatic preloading
export class IntersectionPreloader {
  private static observer: IntersectionObserver | null = null;
  private static observedElements = new WeakMap<Element, string>();

  static init(): void {
    if (typeof window === 'undefined' || this.observer) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const workflowId = this.observedElements.get(entry.target);
            if (workflowId) {
              RoutePreloader.preloadWorkflow(workflowId);
              this.observer?.unobserve(entry.target);
            }
          }
        });
      },
      {
        rootMargin: '100px', // Start preloading 100px before element is visible
        threshold: 0.1,
      }
    );
  }

  static observe(element: Element, workflowId: string): void {
    if (!this.observer) this.init();
    
    this.observedElements.set(element, workflowId);
    this.observer?.observe(element);
  }

  static unobserve(element: Element): void {
    this.observer?.unobserve(element);
    this.observedElements.delete(element);
  }

  static disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}