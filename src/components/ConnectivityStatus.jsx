import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, AlertCircle, Loader2, X } from "lucide-react";
import { useConnectivity, CONNECTION_STATUS, SIGNAL_STRENGTH } from "../utils/connectivity.js";
import { motion, AnimatePresence } from "framer-motion";

export default function ConnectivityStatus() {
  const { status, signalStrength, isOnline, latency, isLoading } = useConnectivity();
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  // Show/hide notices based on status
  useEffect(() => {
    if (!isOnline) {
      setShowOfflineNotice(true);
      setShowSlowNotice(false);
    } else if (status === CONNECTION_STATUS.SLOW) {
      setShowOfflineNotice(false);
      setShowSlowNotice(true);
    } else {
      setShowOfflineNotice(false);
      // Auto-dismiss slow notice after 5 seconds if connection improves
      if (showSlowNotice) {
        const timer = setTimeout(() => setShowSlowNotice(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isOnline, status, showSlowNotice]);

  // Render WiFi signal bars (like mobile signal indicator)
  const renderSignalBars = () => {
    const bars = [];
    for (let i = 1; i <= 4; i++) {
      const isActive = i <= signalStrength;
      bars.push(
        <div
          key={i}
          className={`w-1 rounded-t ${
            isActive
              ? signalStrength >= SIGNAL_STRENGTH.FAIR
                ? 'bg-green-500'
                : signalStrength >= SIGNAL_STRENGTH.POOR
                ? 'bg-yellow-500'
                : 'bg-red-500'
              : 'bg-slate-300 dark:bg-slate-600'
          }`}
          style={{ height: `${i * 4 + 2}px` }}
        />
      );
    }
    return bars;
  };

  const getStatusColor = () => {
    switch (status) {
      case CONNECTION_STATUS.ONLINE:
        return 'text-green-500';
      case CONNECTION_STATUS.SLOW:
        return 'text-yellow-500';
      case CONNECTION_STATUS.UNSTABLE:
        return 'text-orange-500';
      case CONNECTION_STATUS.OFFLINE:
        return 'text-red-500';
      default:
        return 'text-slate-500';
    }
  };

  const getStatusText = () => {
    if (!isOnline) return 'No Internet';
    if (isLoading) return 'Checking...';
    switch (status) {
      case CONNECTION_STATUS.ONLINE:
        return latency ? `${Math.round(latency)}ms` : 'Connected';
      case CONNECTION_STATUS.SLOW:
        return latency ? `Slow (${Math.round(latency)}ms)` : 'Slow Connection';
      case CONNECTION_STATUS.UNSTABLE:
        return 'Unstable';
      case CONNECTION_STATUS.OFFLINE:
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <>
      {/* Status Indicator - Always visible */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        {isLoading ? (
          <Loader2 className="text-blue-500 animate-spin" size={16} />
        ) : isOnline ? (
          <div className="flex items-end gap-0.5 h-5">
            {renderSignalBars()}
          </div>
        ) : (
          <WifiOff className="text-red-500" size={16} />
        )}
        <span className={`text-xs font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* Disconnect Notice - Shows when offline */}
      <AnimatePresence>
        {showOfflineNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500 text-white shadow-2xl border-2 border-red-600">
              <AlertCircle size={20} className="flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">No Internet Connection</div>
                <div className="text-xs text-red-100">Please check your internet connection</div>
              </div>
              <button
                onClick={() => setShowOfflineNotice(false)}
                className="flex-shrink-0 hover:bg-red-600 rounded p-1 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slow Connection Warning */}
      <AnimatePresence>
        {showSlowNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-500 text-white shadow-2xl border-2 border-yellow-600">
              <Wifi size={20} className="flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Slow Internet Connection</div>
                <div className="text-xs text-yellow-100">
                  {latency ? `Latency: ${Math.round(latency)}ms` : 'Connection is slower than usual'}
                </div>
              </div>
              <button
                onClick={() => setShowSlowNotice(false)}
                className="flex-shrink-0 hover:bg-yellow-600 rounded p-1 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

