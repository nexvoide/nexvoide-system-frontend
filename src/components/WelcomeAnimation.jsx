import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Glowing Moon Component
const GlowingMoon = () => {
  return (
    <motion.div
      className="absolute"
      style={{
        top: '15%',
        left: '12%',
        willChange: 'transform, opacity',
        transform: 'translateZ(0)', // GPU acceleration
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
      }}
      transition={{ duration: 2.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Moon glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 40%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: [0.4, 0, 0.2, 1],
        }}
      />
      
      {/* Moon */}
      <div
        className="rounded-full"
        style={{
          width: '120px',
          height: '120px',
          background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9) 0%, rgba(226, 232, 240, 0.8) 50%, rgba(148, 163, 184, 0.6) 100%)',
          boxShadow: '0 0 60px rgba(59, 130, 246, 0.4), 0 0 100px rgba(59, 130, 246, 0.2)',
        }}
      />
    </motion.div>
  );
};

// Layered Mountains Component - Dark Theme
const LayeredMountains = () => {
  const mountainLayers = [
    { color: '#0f172a', height: '55%', delay: 0, zIndex: 1 }, // Darkest - front
    { color: '#1e293b', height: '45%', delay: 0.2, zIndex: 2 },
    { color: '#334155', height: '38%', delay: 0.4, zIndex: 3 },
    { color: '#475569', height: '32%', delay: 0.6, zIndex: 4 },
    { color: '#64748b', height: '28%', delay: 0.8, zIndex: 5 }, // Lightest - back
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ height: '85%' }}>
      {mountainLayers.map((layer, index) => (
        <motion.svg
          key={index}
          className="absolute"
          style={{
            bottom: 0,
            left: 0,
            width: '100%',
            height: layer.height,
            zIndex: layer.zIndex,
            willChange: 'transform, opacity',
            transform: 'translateZ(0)', // GPU acceleration
          }}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 2.5, delay: layer.delay * 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          viewBox="0 0 1200 400"
          preserveAspectRatio="none"
        >
          <path
            d={`M0,400 L0,${150 - index * 15} L${150 + index * 30},${120 - index * 10} L${300 + index * 40},${80 - index * 8} L${450 + index * 50},${100 - index * 10} L${600 + index * 60},${60 - index * 6} L${750 + index * 70},${80 - index * 8} L${900 + index * 80},${50 - index * 5} L${1050 + index * 90},${70 - index * 7} L${1200 + index * 100},${90 - index * 8} L1200,400 Z`}
            fill={layer.color}
            opacity={0.9}
          />
        </motion.svg>
      ))}
    </div>
  );
};

// Silhouette Trees Component - Dark Theme
const SilhouetteTrees = () => {
  const trees = Array.from({ length: 15 }, (_, i) => ({
    x: (i * 8) + (Math.random() * 3),
    height: 60 + Math.random() * 40,
    width: 20 + Math.random() * 15,
    delay: 0.5 + (i * 0.05),
  }));

  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ height: '25%' }}>
      {trees.map((tree, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{
            left: `${tree.x}%`,
            bottom: 0,
            width: `${tree.width}px`,
            height: `${tree.height}px`,
            willChange: 'transform, opacity',
            transform: 'translateZ(0)', // GPU acceleration
          }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 1.5, delay: tree.delay * 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Tree trunk */}
          <div
            className="absolute bottom-0"
            style={{
              width: `${tree.width * 0.3}px`,
              height: `${tree.height * 0.3}px`,
              background: '#0f172a',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
          {/* Tree top */}
          <div
            className="absolute"
            style={{
              bottom: `${tree.height * 0.3}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: `${tree.width * 0.5}px solid transparent`,
              borderRight: `${tree.width * 0.5}px solid transparent`,
              borderBottom: `${tree.height * 0.7}px solid #0f172a`,
            }}
          />
        </motion.div>
      ))}
    </div>
  );
};

// Flying Birds Component
const FlyingBirds = () => {
  const birdGroups = [
    { x: 20, y: 25, delay: 2.5, speed: 40 },
    { x: 60, y: 30, delay: 3, speed: 45 },
    { x: 80, y: 20, delay: 3.5, speed: 42 },
  ];

  return (
    <>
      {birdGroups.map((group, groupIndex) => (
        <motion.div
          key={groupIndex}
          className="absolute"
          style={{
            left: `${group.x}%`,
            top: `${group.y}%`,
            willChange: 'transform, opacity',
            transform: 'translateZ(0)', // GPU acceleration
          }}
          initial={{ x: -100, opacity: 0 }}
          animate={{ 
            x: ['-100px', 'calc(100vw + 100px)'],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: group.speed,
            delay: group.delay,
            repeat: Infinity,
            repeatDelay: 25,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          {/* Bird silhouette */}
          <svg width="60" height="30" viewBox="0 0 60 30" fill="none">
            <path
              d="M10 15 Q20 10, 30 15 Q40 20, 50 15"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M10 15 Q20 5, 30 15"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M30 15 Q40 5, 50 15"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      ))}
    </>
  );
};

export default function WelcomeAnimation({ userName, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  // Get first name
  const nameParts = userName ? userName.split(' ') : [];
  const firstName = nameParts[0] || userName || 'User';
  
  const welcomeText = "Welcome To Nexvoide";
  const nameText = firstName;
  const welcomeChars = welcomeText.split('');
  const nameChars = nameText.split('');

  // Auto-advance steps
  useEffect(() => {
    if (currentStep === 0) {
      // Show welcome text for duration based on character count
      const timer = setTimeout(() => {
        setCurrentStep(1);
      }, welcomeChars.length * 120 + 1000);
      return () => clearTimeout(timer);
    }

    if (currentStep === 1) {
      // Show name text
      const timer = setTimeout(() => {
        setCurrentStep(2);
      }, nameChars.length * 120 + 1000);
      return () => clearTimeout(timer);
    }

    // Auto-dismiss after showing complete text
    if (currentStep === 2) {
      const timer = setTimeout(() => {
        // Start fade-out
        setIsExiting(true);
        // Call onComplete after fade-out animation completes
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 1500); // Match fade-out duration
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [currentStep, welcomeChars.length, nameChars.length, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: isExiting ? 0 : 1,
        scale: isExiting ? 0.95 : 1,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ 
        duration: isExiting ? 1.5 : 1, 
        ease: isExiting ? [0.4, 0, 0.2, 1] : [0.25, 0.46, 0.45, 0.94],
      }}
      className="fixed inset-0 z-[100] overflow-hidden bg-slate-950"
    >
      {/* Night Sky Background with Stars */}
      <div className="absolute inset-0">
        {/* Stars */}
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 50}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              willChange: 'opacity',
              transform: 'translateZ(0)', // GPU acceleration
            }}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: [0.4, 0, 0.2, 1],
          }}
          />
        ))}
      </div>

      {/* Glowing Moon */}
      <GlowingMoon />

      {/* Flying Birds */}
      <FlyingBirds />

      {/* Layered Mountains */}
      <LayeredMountains />

      {/* Silhouette Trees */}
      <SilhouetteTrees />

      {/* Welcome Text Overlay - Modern Character Animation */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center z-30"
        animate={{ 
          opacity: isExiting ? 0 : 1,
          y: isExiting ? -20 : 0,
        }}
        transition={{ 
          duration: 1.5, 
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        <div className="text-center px-4">
          {currentStep === 0 ? (
            <h1
              className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight"
              style={{
                fontFamily: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              <span className="inline-block">
                {welcomeChars.map((char, index) => (
                  <motion.span
                    key={index}
                    className="inline-block"
                    initial={{ 
                      opacity: 0, 
                      scale: 0, 
                      y: 50,
                      rotateX: -90,
                    }}
                    animate={{ 
                      opacity: isExiting ? 0 : 1, 
                      scale: isExiting ? 0.8 : 1, 
                      y: isExiting ? -30 : 0,
                      rotateX: isExiting ? 90 : 0,
                    }}
                    transition={{
                      duration: isExiting ? 0.8 : 0.6,
                      delay: isExiting ? index * 0.03 : index * 0.1,
                      ease: isExiting ? [0.4, 0, 0.2, 1] : [0.34, 1.56, 0.64, 1],
                    }}
                    style={{
                      transformStyle: 'preserve-3d',
                      willChange: 'transform, opacity',
                      transform: 'translateZ(0)', // GPU acceleration
                    }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </motion.span>
                ))}
              </span>
            </h1>
          ) : currentStep === 1 ? (
            <h2
              className="text-4xl md:text-6xl font-bold text-[#3b82f6]"
              style={{
                fontFamily: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              <span className="inline-block">
                {nameChars.map((char, index) => (
                  <motion.span
                    key={index}
                    className="inline-block"
                    initial={{ 
                      opacity: 0, 
                      scale: 0.3, 
                      y: 30,
                      rotate: -180,
                    }}
                    animate={{ 
                      opacity: isExiting ? 0 : 1, 
                      scale: isExiting ? 0.7 : 1, 
                      y: isExiting ? -20 : 0,
                      rotate: isExiting ? 180 : 0,
                    }}
                    transition={{
                      duration: isExiting ? 0.8 : 0.5,
                      delay: isExiting ? index * 0.03 : index * 0.12,
                      ease: isExiting ? [0.4, 0, 0.2, 1] : [0.34, 1.56, 0.64, 1],
                    }}
                    style={{
                      willChange: 'transform, opacity',
                      transform: 'translateZ(0)', // GPU acceleration
                    }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </motion.span>
                ))}
              </span>
            </h2>
          ) : (
            <h2
              className="text-4xl md:text-6xl font-bold text-[#3b82f6]"
              style={{
                fontFamily: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              <span className="inline-block">
                {nameChars.map((char, index) => (
                  <span key={index} className="inline-block">
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                ))}
              </span>
            </h2>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
