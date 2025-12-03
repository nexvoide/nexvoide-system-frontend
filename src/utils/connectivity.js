import { useState, useEffect } from 'react';

// Connection quality levels
export const CONNECTION_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  SLOW: 'slow',
  UNSTABLE: 'unstable'
};

// Signal strength levels (0-4, like WiFi bars)
export const SIGNAL_STRENGTH = {
  NONE: 0,
  WEAK: 1,
  POOR: 2,
  FAIR: 3,
  GOOD: 4
};

/**
 * Get optimized endpoints for latency testing
 * Prioritizes faster endpoints for Pakistan/Asia region
 */
function getLatencyEndpoints() {
  const endpoints = [];
  
  // 1. Custom endpoint from environment (fastest if configured)
  const customEndpoint = import.meta.env.VITE_LATENCY_TEST_URL;
  if (customEndpoint) {
    endpoints.push(customEndpoint);
  }
  
  // 2. Supabase endpoint (if configured) - Supabase has good global coverage
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    // Use Supabase REST API health endpoint (very lightweight)
    try {
      const url = new URL(supabaseUrl);
      endpoints.push(`${url.origin}/rest/v1/`);
    } catch (e) {
      // Invalid URL, skip
    }
  }
  
  // 3. Backend server endpoint (if configured)
  const backendUrl = import.meta.env.VITE_SOCKET_SERVER_URL || 
                     import.meta.env.VITE_VOICE_SERVER_URL;
  if (backendUrl) {
    try {
      const url = new URL(backendUrl);
      endpoints.push(`${url.origin}/health`); // Try health endpoint
      endpoints.push(`${url.origin}/`); // Fallback to root
    } catch (e) {
      // Invalid URL, skip
    }
  }
  
  // 4. Local resource (very fast)
  endpoints.push('/favicon.ico');
  
  // 5. Cloudflare CDN (fast globally, good for Pakistan)
  endpoints.push('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
  
  // 6. Fast global CDN endpoints optimized for Asia (fallback if custom not set)
  if (!customEndpoint) {
    endpoints.push('https://www.cloudflare.com/cdn-cgi/trace'); // Cloudflare trace (very lightweight)
    endpoints.push('https://1.1.1.1/cdn-cgi/trace'); // Cloudflare DNS (fast in Pakistan)
  }
  
  return endpoints;
}

/**
 * Test a single endpoint with timeout
 * Optimized for Cloudflare trace endpoint and other lightweight endpoints
 */
async function testEndpoint(endpoint, timeout = 3000) {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    // Cloudflare trace endpoint works better with GET, others can use HEAD
    const isCloudflareTrace = endpoint.includes('cdn-cgi/trace');
    const method = isCloudflareTrace ? 'GET' : 'HEAD';
    
    const url = endpoint + (endpoint.includes('?') ? '&' : '?') + 't=' + Date.now();
    
    await fetch(url, {
      method: method,
      signal: controller.signal,
      cache: 'no-cache',
      mode: 'no-cors',
      headers: {
        'Cache-Control': 'no-cache',
      }
    });
    
    clearTimeout(timeoutId);
    const endTime = performance.now();
    return endTime - startTime;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Test connection speed and quality
 * Uses parallel testing for faster results
 */
async function testConnection() {
  const endpoints = getLatencyEndpoints();
  
  // Test endpoints in parallel for faster results
  const testPromises = endpoints.map(endpoint => 
    testEndpoint(endpoint, 3000).catch(() => null)
  );
  
  try {
    // Wait for first successful result (Promise.any would be ideal but not all browsers support it)
    const results = await Promise.allSettled(testPromises);
    
    // Find the fastest successful result
    let fastestLatency = Infinity;
    let fastestIndex = -1;
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value !== null) {
        if (result.value < fastestLatency) {
          fastestLatency = result.value;
          fastestIndex = i;
        }
      }
    }
    
    if (fastestIndex !== -1 && fastestLatency < Infinity) {
      return {
        connected: true,
        latency: fastestLatency,
        status: fastestLatency < 500 ? CONNECTION_STATUS.ONLINE : 
                fastestLatency < 2000 ? CONNECTION_STATUS.SLOW : 
                CONNECTION_STATUS.UNSTABLE
      };
    }
    
    // If all failed, return offline
    throw new Error('All connection tests failed');
  } catch (error) {
    return {
      connected: false,
      latency: null,
      status: CONNECTION_STATUS.OFFLINE
    };
  }
}

/**
 * Calculate signal strength based on latency
 */
function calculateSignalStrength(latency) {
  if (latency === null) return SIGNAL_STRENGTH.NONE;
  if (latency < 100) return SIGNAL_STRENGTH.GOOD;
  if (latency < 300) return SIGNAL_STRENGTH.FAIR;
  if (latency < 1000) return SIGNAL_STRENGTH.POOR;
  if (latency < 3000) return SIGNAL_STRENGTH.WEAK;
  return SIGNAL_STRENGTH.NONE;
}

/**
 * Create a connectivity monitor hook
 */
export function useConnectivity() {
  const [status, setStatus] = useState(CONNECTION_STATUS.ONLINE);
  const [signalStrength, setSignalStrength] = useState(SIGNAL_STRENGTH.GOOD);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [latency, setLatency] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const checkConnectivity = async () => {
      // Check navigator.onLine first (fast check)
      const online = navigator.onLine;
      setIsOnline(online);

      if (!online) {
        setStatus(CONNECTION_STATUS.OFFLINE);
        setSignalStrength(SIGNAL_STRENGTH.NONE);
        setLatency(null);
        return;
      }

      // Perform actual connection test
      setIsLoading(true);
      const result = await testConnection();
      setIsLoading(false);

      setStatus(result.status);
      setLatency(result.latency);
      setSignalStrength(calculateSignalStrength(result.latency));
    };

    // Initial check only
    checkConnectivity();

    // Listen to online/offline events (event-driven, no polling)
    const handleOnline = () => {
      setIsOnline(true);
      checkConnectivity();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setStatus(CONNECTION_STATUS.OFFLINE);
      setSignalStrength(SIGNAL_STRENGTH.NONE);
      setLatency(null);
    };

    // Also check when page becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkConnectivity();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // REMOVED: setInterval polling - now purely event-driven
    // This eliminates 10,800+ requests per day

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    status,
    signalStrength,
    isOnline,
    latency,
    isLoading
  };
}

