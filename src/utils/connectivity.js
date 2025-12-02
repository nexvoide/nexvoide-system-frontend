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
 * Test connection speed and quality
 */
async function testConnection() {
  const startTime = performance.now();
  try {
    // Try to fetch a small resource to test connectivity
    // Use a reliable endpoint that supports CORS
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    // Try multiple endpoints for better reliability
    const endpoints = [
      '/favicon.ico', // Local resource
      'https://www.google.com/favicon.ico', // External (may have CORS)
    ];
    
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint + '?t=' + Date.now(), {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-cache',
          mode: 'no-cors' // Use no-cors to avoid CORS issues
        });
        
        clearTimeout(timeoutId);
        const endTime = performance.now();
        const latency = endTime - startTime;
        
        // If we get here, connection exists
        return {
          connected: true,
          latency,
          status: latency < 500 ? CONNECTION_STATUS.ONLINE : 
                  latency < 2000 ? CONNECTION_STATUS.SLOW : 
                  CONNECTION_STATUS.UNSTABLE
        };
      } catch (err) {
        lastError = err;
        // Continue to next endpoint
      }
    }
    
    // If all endpoints fail, return offline
    throw lastError || new Error('All connection tests failed');
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
    
    let intervalId;

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

    // Initial check
    checkConnectivity();

    // Listen to online/offline events
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic checks (every 10 seconds)
    intervalId = setInterval(checkConnectivity, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalId) clearInterval(intervalId);
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

