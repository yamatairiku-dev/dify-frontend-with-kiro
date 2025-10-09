import React, { memo, useState, useEffect, useCallback } from 'react';
import { performanceHelpers } from '../config/react-query';
import { RoutePreloader, PreloadPerformanceMonitor } from '../utils/routePreloading';

interface PerformanceMonitorProps {
  enabled?: boolean;
  showDetails?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

interface PerformanceStats {
  cacheStats: {
    totalQueries: number;
    activeQueries: number;
    staleQueries: number;
    cacheSize: number;
  };
  preloadStats: {
    preloadedRoutes: number;
    activeTimeouts: number;
    cacheSize: number;
  };
  renderStats: {
    renderCount: number;
    lastRenderTime: number;
    averageRenderTime: number;
  };
  memoryStats: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null;
}

// Performance monitoring hook
const usePerformanceStats = (enabled: boolean) => {
  const [stats, setStats] = useState<PerformanceStats>({
    cacheStats: {
      totalQueries: 0,
      activeQueries: 0,
      staleQueries: 0,
      cacheSize: 0,
    },
    preloadStats: {
      preloadedRoutes: 0,
      activeTimeouts: 0,
      cacheSize: 0,
    },
    renderStats: {
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
    },
    memoryStats: null,
  });

  const [renderTimes, setRenderTimes] = useState<number[]>([]);

  const updateStats = useCallback(() => {
    if (!enabled) return;

    const startTime = performance.now();

    // Get React Query cache stats
    const cacheStats = performanceHelpers.getCacheStats();

    // Get preload stats
    const preloadStats = RoutePreloader.getPreloadStats();

    // Get memory stats (if available)
    let memoryStats = null;
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryStats = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    setRenderTimes(prev => {
      const newTimes = [...prev, renderTime].slice(-10); // Keep last 10 render times
      const averageRenderTime = newTimes.reduce((sum, time) => sum + time, 0) / newTimes.length;

      setStats(prevStats => ({
        cacheStats,
        preloadStats,
        renderStats: {
          renderCount: prevStats.renderStats.renderCount + 1,
          lastRenderTime: renderTime,
          averageRenderTime,
        },
        memoryStats,
      }));

      return newTimes;
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    updateStats();
    const interval = setInterval(updateStats, 1000); // Update every second

    return () => clearInterval(interval);
  }, [enabled, updateStats]);

  return stats;
};

// Format bytes for display
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Performance stats display component
const PerformanceStatsDisplay = memo<{
  stats: PerformanceStats;
  showDetails: boolean;
}>(({ stats, showDetails }) => {
  const [expanded, setExpanded] = useState(false);

  if (!showDetails && !expanded) {
    return (
      <div
        style={{
          padding: '0.5rem',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          borderRadius: '4px',
          fontSize: '0.8rem',
          cursor: 'pointer',
          minWidth: '120px',
        }}
        onClick={() => setExpanded(true)}
        title="Click to expand performance details"
      >
        <div>Queries: {stats.cacheStats.totalQueries}</div>
        <div>Cache: {formatBytes(stats.cacheStats.cacheSize)}</div>
        <div>Renders: {stats.renderStats.renderCount}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        borderRadius: '8px',
        fontSize: '0.8rem',
        minWidth: '300px',
        maxWidth: '400px',
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '0.5rem'
      }}>
        <h4 style={{ margin: 0, fontSize: '1rem' }}>Performance Monitor</h4>
        {!showDetails && (
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.2rem',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* React Query Cache Stats */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>React Query Cache</div>
        <div>Total Queries: {stats.cacheStats.totalQueries}</div>
        <div>Active Queries: {stats.cacheStats.activeQueries}</div>
        <div>Stale Queries: {stats.cacheStats.staleQueries}</div>
        <div>Cache Size: {formatBytes(stats.cacheStats.cacheSize)}</div>
      </div>

      {/* Preload Stats */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Route Preloading</div>
        <div>Preloaded Routes: {stats.preloadStats.preloadedRoutes}</div>
        <div>Active Timeouts: {stats.preloadStats.activeTimeouts}</div>
      </div>

      {/* Render Stats */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Render Performance</div>
        <div>Render Count: {stats.renderStats.renderCount}</div>
        <div>Last Render: {stats.renderStats.lastRenderTime.toFixed(2)}ms</div>
        <div>Avg Render: {stats.renderStats.averageRenderTime.toFixed(2)}ms</div>
      </div>

      {/* Memory Stats */}
      {stats.memoryStats && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Memory Usage</div>
          <div>Used: {formatBytes(stats.memoryStats.usedJSHeapSize)}</div>
          <div>Total: {formatBytes(stats.memoryStats.totalJSHeapSize)}</div>
          <div>Limit: {formatBytes(stats.memoryStats.jsHeapSizeLimit)}</div>
          <div style={{ marginTop: '0.25rem' }}>
            <div
              style={{
                width: '100%',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(stats.memoryStats.usedJSHeapSize / stats.memoryStats.totalJSHeapSize) * 100}%`,
                  height: '100%',
                  backgroundColor: stats.memoryStats.usedJSHeapSize / stats.memoryStats.totalJSHeapSize > 0.8 
                    ? '#ff6b6b' 
                    : stats.memoryStats.usedJSHeapSize / stats.memoryStats.totalJSHeapSize > 0.6 
                    ? '#ffa500' 
                    : '#4caf50',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            performanceHelpers.clearStaleCache();
            RoutePreloader.clearAllPreloads();
          }}
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.7rem',
          }}
        >
          Clear Cache
        </button>
        <button
          onClick={() => {
            if (window.gc) {
              window.gc();
            } else {
              console.warn('Garbage collection not available');
            }
          }}
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.7rem',
          }}
        >
          Force GC
        </button>
      </div>
    </div>
  );
});

PerformanceStatsDisplay.displayName = 'PerformanceStatsDisplay';

// Main performance monitor component
export const PerformanceMonitor = memo<PerformanceMonitorProps>(({
  enabled = process.env['NODE_ENV'] === 'development',
  showDetails = false,
  position = 'bottom-right',
}) => {
  const stats = usePerformanceStats(enabled);

  if (!enabled) {
    return null;
  }

  const positionStyles = {
    'top-left': { top: '1rem', left: '1rem' },
    'top-right': { top: '1rem', right: '1rem' },
    'bottom-left': { bottom: '1rem', left: '1rem' },
    'bottom-right': { bottom: '1rem', right: '1rem' },
  };

  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyles[position],
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
    >
      <PerformanceStatsDisplay stats={stats} showDetails={showDetails} />
    </div>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

// Hook for performance monitoring in components
export const usePerformanceMonitoring = () => {
  const [renderCount, setRenderCount] = useState(0);
  const [renderTimes, setRenderTimes] = useState<number[]>([]);

  useEffect(() => {
    const startTime = performance.now();
    setRenderCount(prev => prev + 1);

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      setRenderTimes(prev => [...prev, renderTime].slice(-10));
    };
  }, []); // Empty dependency array to prevent infinite updates

  const averageRenderTime = renderTimes.length > 0 
    ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length 
    : 0;

  return {
    renderCount,
    averageRenderTime,
    lastRenderTime: renderTimes[renderTimes.length - 1] || 0,
    clearStats: () => {
      setRenderCount(0);
      setRenderTimes([]);
    },
  };
};