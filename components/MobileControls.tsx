import React, { useRef, useState, useEffect } from 'react';

interface ControlsProps {
  onMove: (vector: { x: number; y: number }) => void;
  onLook: (vector: { x: number; y: number }) => void;
}

export const MobileControls: React.FC<ControlsProps> = ({ onMove, onLook }) => {
  const [joystickPos, setJoystickPos] = useState<{x: number, y: number} | null>(null);
  const [currentTouchId, setCurrentTouchId] = useState<number | null>(null);
  const joystickOrigin = useRef<{x: number, y: number} | null>(null);

  // --- JOYSTICK LOGIC (Left Screen) ---
  const handleTouchStart = (e: React.TouchEvent) => {
    Array.from(e.changedTouches).forEach((touch: any) => {
      const halfWidth = window.innerWidth / 2;
      
      // Left side: Movement Joystick
      if (touch.clientX < halfWidth && currentTouchId === null) {
        setJoystickPos({ x: touch.clientX, y: touch.clientY });
        joystickOrigin.current = { x: touch.clientX, y: touch.clientY };
        setCurrentTouchId(touch.identifier);
      }
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    Array.from(e.changedTouches).forEach((touch: any) => {
      // Handle Joystick Move
      if (touch.identifier === currentTouchId && joystickOrigin.current) {
        const dx = touch.clientX - joystickOrigin.current.x;
        const dy = touch.clientY - joystickOrigin.current.y;
        
        // Clamp visually
        const maxDist = 50;
        const distance = Math.min(Math.sqrt(dx*dx + dy*dy), maxDist);
        const angle = Math.atan2(dy, dx);
        
        const visualX = joystickOrigin.current.x + Math.cos(angle) * distance;
        const visualY = joystickOrigin.current.y + Math.sin(angle) * distance;
        
        setJoystickPos({ x: visualX, y: visualY });

        // Normalize output -1 to 1
        onMove({ 
          x: (Math.cos(angle) * distance) / maxDist, 
          y: (Math.sin(angle) * distance) / maxDist 
        });
      }
      // Handle Look Move (Right side)
      else if (touch.clientX > window.innerWidth / 2) {
        // Calculate delta roughly based on previous event or just simple sensitivity
        // React touch events don't give "movementX" easily, 
        // but for a look-pad, we treat it as a trackpad. 
        // For simplicity here, we rely on the parent to handle delta, 
        // or we need to track previous position.
        // Let's implement a simple relative check in parent or use a ref here.
      }
    });
  };

  // We need a ref to track 'look' previous position to calculate delta
  const prevLook = useRef<{ [key: number]: {x: number, y: number} }>({});

  const handleGlobalTouchMove = (e: TouchEvent) => {
    Array.from(e.changedTouches).forEach((touch: any) => {
        if (touch.clientX > window.innerWidth / 2) {
            const prev = prevLook.current[touch.identifier];
            if (prev) {
                const dx = touch.clientX - prev.x;
                const dy = touch.clientY - prev.y;
                onLook({ x: dx * 0.005, y: dy * 0.005 });
            }
            prevLook.current[touch.identifier] = { x: touch.clientX, y: touch.clientY };
        }
    });
  }

  const handleGlobalTouchEnd = (e: TouchEvent) => {
      Array.from(e.changedTouches).forEach((touch: any) => {
          delete prevLook.current[touch.identifier];
      });
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    Array.from(e.changedTouches).forEach((touch: any) => {
      if (touch.identifier === currentTouchId) {
        setJoystickPos(null);
        joystickOrigin.current = null;
        setCurrentTouchId(null);
        onMove({ x: 0, y: 0 });
      }
    });
  };

  useEffect(() => {
    // Add global non-passive listeners for look to prevent scrolling
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd);
    return () => {
        window.removeEventListener('touchmove', handleGlobalTouchMove);
        window.removeEventListener('touchend', handleGlobalTouchEnd);
    }
  }, []);

  return (
    <div 
      className="absolute inset-0 z-50 select-none touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Joystick Visual */}
      {joystickPos && joystickOrigin.current && (
        <>
          {/* Base */}
          <div 
            className="absolute w-24 h-24 rounded-full border-2 border-[#C8AA6E]/30 bg-black/20 backdrop-blur-sm -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: joystickOrigin.current.x, top: joystickOrigin.current.y }}
          />
          {/* Stick */}
          <div 
            className="absolute w-12 h-12 rounded-full bg-[#0AC8B9]/80 shadow-[0_0_15px_#0AC8B9] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: joystickPos.x, top: joystickPos.y }}
          />
        </>
      )}

      {/* Right Side Hint */}
      <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-0"></div>
    </div>
  );
};