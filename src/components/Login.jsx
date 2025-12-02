import React, { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAppStore } from "../stores/appStore.js";

// Thunderstorm Clouds
const ThunderstormClouds = () => {
  const clouds = [
    { x: '5%', y: '10%', width: 300, delay: 0 },
    { x: '40%', y: '5%', width: 400, delay: 0.5 },
    { x: '70%', y: '12%', width: 350, delay: 1 },
  ];

  return (
    <>
      {clouds.map((cloud, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{
            left: cloud.x,
            top: cloud.y,
            width: `${cloud.width}px`,
            height: `${cloud.width * 0.6}px`,
            willChange: 'transform, opacity',
            transform: 'translateZ(0)', // GPU acceleration
          }}
          initial={{ opacity: 0, x: -100 }}
          animate={{ 
            opacity: 1, 
            x: 0,
          }}
          transition={{ duration: 2, delay: cloud.delay }}
        >
          {/* Cloud shape using multiple circles */}
          <div className="relative w-full h-full">
            <div
              className="absolute rounded-full bg-slate-800/80"
              style={{
                width: '40%',
                height: '60%',
                top: '20%',
                left: '10%',
              }}
            />
            <div
              className="absolute rounded-full bg-slate-800/80"
              style={{
                width: '50%',
                height: '80%',
                top: '10%',
                left: '30%',
              }}
            />
            <div
              className="absolute rounded-full bg-slate-800/80"
              style={{
                width: '40%',
                height: '60%',
                top: '20%',
                left: '60%',
              }}
            />
            <div
              className="absolute rounded-full bg-slate-800/80"
              style={{
                width: '30%',
                height: '50%',
                top: '30%',
                left: '75%',
              }}
            />
          </div>
        </motion.div>
      ))}
    </>
  );
};

// Lightning Bolts
const LightningBolts = () => {
  const [lightning, setLightning] = useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setLightning(true);
      setTimeout(() => setLightning(false), 100);
      setTimeout(() => {
        setLightning(true);
        setTimeout(() => setLightning(false), 50);
      }, 150);
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, []);

  const bolts = [
    { x: '15%', y: '20%', path: 'M50,0 L45,40 L50,40 L40,80 L50,80 L35,120' },
    { x: '50%', y: '15%', path: 'M50,0 L55,35 L50,35 L60,70 L50,70 L65,110' },
    { x: '75%', y: '22%', path: 'M50,0 L45,38 L50,38 L40,75 L50,75 L35,115' },
  ];

  return (
    <>
      {bolts.map((bolt, index) => (
        <motion.svg
          key={index}
          className="absolute pointer-events-none"
          style={{
            left: bolt.x,
            top: bolt.y,
            width: '100px',
            height: '150px',
            willChange: 'opacity',
            transform: 'translateZ(0)', // GPU acceleration
          }}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: lightning ? 1 : 0,
          }}
          transition={{ duration: 0.1 }}
        >
          <defs>
            <filter id={`glow-${index}`}>
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <path
            d={bolt.path}
            stroke="#60a5fa"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            filter={`url(#glow-${index})`}
            style={{
              filter: 'drop-shadow(0 0 8px rgba(96, 165, 250, 0.8))',
            }}
          />
        </motion.svg>
      ))}
    </>
  );
};

// Rain Drops - Optimized for performance
const RainDrops = () => {
  const drops = Array.from({ length: 80 }, (_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 0.5 + Math.random() * 0.5,
    length: 10 + Math.random() * 20,
  }));

  return (
    <>
      {drops.map((drop, index) => (
        <motion.div
          key={index}
          className="absolute bg-blue-400/60"
          style={{
            left: `${drop.x}%`,
            top: '-10px',
            width: '2px',
            height: `${drop.length}px`,
            willChange: 'transform, opacity',
            transform: 'translateZ(0)', // GPU acceleration
          }}
          animate={{
            y: ['0vh', '110vh'],
            opacity: [0.8, 0.2],
          }}
          transition={{
            duration: drop.duration,
            delay: drop.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </>
  );
};

// Screen Flash Effect (when lightning strikes)
const ScreenFlash = () => {
  const [flash, setFlash] = useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setFlash(true);
      setTimeout(() => setFlash(false), 50);
      setTimeout(() => {
        setFlash(true);
        setTimeout(() => setFlash(false), 30);
      }, 150);
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'rgba(255, 255, 255, 0.1)',
        willChange: 'opacity',
        transform: 'translateZ(0)', // GPU acceleration
      }}
      animate={{
        opacity: flash ? 1 : 0,
      }}
      transition={{ duration: 0.1 }}
    />
  );
};

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const store = useAppStore();
  const login = store?.login || (async () => {
    throw new Error('Login function not available');
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError("Invalid username or password");
      }
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 overflow-hidden">
      {/* Thunderstorm Background */}
      <div className="absolute inset-0">
        {/* Screen Flash Effect */}
        <ScreenFlash />
        
        {/* Thunderstorm Clouds */}
        <ThunderstormClouds />
        
        {/* Lightning Bolts */}
        <LightningBolts />
        
        {/* Rain Drops */}
        <RainDrops />
      </div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-50 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200/20 dark:border-slate-800/50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden mx-4"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-center mb-6">
            <img
              src="/logo.svg"
              alt="Nexvoide"
              width={120}
              height={120}
              className="object-contain"
              onError={(e) => {
                if (e.currentTarget.src.endsWith('/logo.svg')) {
                  e.currentTarget.src = '/logo.png';
                }
              }}
            />
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-center text-slate-900 dark:text-slate-100 mb-2">
            Welcome Back
          </h2>
          <p className="text-xs md:text-sm text-center text-slate-500 dark:text-slate-400 mb-6">
            Sign in to your account
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 flex items-center gap-2 text-red-700 dark:text-red-300 text-sm"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="glass w-full px-3 h-11 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="glass w-full px-3 h-11 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full btn btn-primary h-11 md:h-12 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation text-sm md:text-base"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

