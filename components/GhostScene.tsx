import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Float, Stars, Html, Torus } from '@react-three/drei';
import { Player } from '../types';
import * as THREE from 'three';

// Fix for missing JSX types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      sphereGeometry: any;
      ambientLight: any;
      pointLight: any;
      fog: any;
    }
  }
}

interface GhostProps {
  player: Player;
  position: [number, number, number];
  isLocal: boolean;
  isAdminClient: boolean;
  isSelected: boolean;
  isStarting: boolean;
  onSelect: (id: string) => void;
  onKick: (id: string) => void;
}

const Ghost: React.FC<GhostProps> = ({ 
  player, 
  position, 
  isLocal, 
  isAdminClient, 
  isSelected, 
  isStarting,
  onSelect, 
  onKick 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  // Starting animation state
  const startAnimProgress = useRef(0);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      meshRef.current.rotation.z += 0.002;
    }
    if (ringRef.current && player.isReady) {
      ringRef.current.rotation.z -= 0.02;
      ringRef.current.rotation.x = (Math.PI / 2) + Math.sin(state.clock.elapsedTime) * 0.1;
    }

    // Vortex Animation
    if (isStarting && groupRef.current) {
        startAnimProgress.current += delta;
        const p = startAnimProgress.current;
        
        // Move towards center (0,0,0)
        groupRef.current.position.lerp(new THREE.Vector3(0, 0, 0), delta * 1.5);
        
        // Rotate rapidly around center (simulating vortex)
        const radius = groupRef.current.position.length();
        const angle = Math.atan2(groupRef.current.position.z, groupRef.current.position.x) + (delta * (5 / (radius + 0.1)));
        groupRef.current.position.x = Math.cos(angle) * radius;
        groupRef.current.position.z = Math.sin(angle) * radius;

        // Scale down
        const scale = Math.max(0, 1 - (p * 0.2));
        groupRef.current.scale.setScalar(scale);
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect(player.id);
  };

  return (
    <Float speed={isStarting ? 0 : 2} rotationIntensity={0.5} floatIntensity={1} floatingRange={[-0.2, 0.2]}>
      <group ref={groupRef} position={position}>
        {/* Main Sphere */}
        <mesh 
          ref={meshRef} 
          onClick={handleClick}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          <sphereGeometry args={[0.8, 64, 64]} />
          <MeshDistortMaterial
            color={player.color}
            envMapIntensity={0.4}
            clearcoat={1}
            clearcoatRoughness={0.1}
            metalness={0.1}
            roughness={0.4}
            distort={0.4}
            speed={2}
            emissive={player.isReady ? player.color : '#000000'}
            emissiveIntensity={player.isReady ? 1.5 : 0}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Ready Ring */}
        {player.isReady && (
          <group rotation={[Math.PI / 2, 0, 0]}>
             <Torus ref={ringRef} args={[1.3, 0.05, 16, 100]}>
              <meshStandardMaterial color="#0AC8B9" emissive="#0AC8B9" emissiveIntensity={2} toneMapped={false} />
            </Torus>
          </group>
        )}
        
        {/* UI Overlay - Hide during start */}
        {!isStarting && (
            <Html position={[0, -1.6, 0]} center transform sprite zIndexRange={[100, 0]}>
            <div className="flex flex-col items-center select-none pointer-events-none w-48">
                {player.isAdmin && <div className="text-[#C8AA6E] text-[10px] uppercase font-bold mb-1">Owner</div>}
                <div className={`
                px-4 py-1.5 bg-black/60 border rounded backdrop-blur-md text-white font-bold text-sm whitespace-nowrap
                ${isLocal ? 'border-[#0AC8B9] ring-1 ring-[#0AC8B9]/50' : 'border-[#C8AA6E]/50'}
                ${player.isReady ? 'shadow-[0_0_15px_rgba(10,200,185,0.4)] border-[#0AC8B9]' : ''}
                `}>
                {player.name}
                </div>
                {player.isReady && <div className="mt-2 text-[#0AC8B9] text-xs font-bold uppercase animate-pulse">READY</div>}
                {isSelected && isAdminClient && !isLocal && (
                <div className="mt-3 pointer-events-auto">
                    <button onClick={(e) => { e.stopPropagation(); onKick(player.id); }} className="bg-[#280909] border border-[#FF4655] text-[#FF4655] text-[10px] px-4 py-1.5 font-bold uppercase hover:bg-[#FF4655] hover:text-white">KICK</button>
                </div>
                )}
            </div>
            </Html>
        )}
      </group>
    </Float>
  );
};

interface GhostSceneProps {
  players: Player[];
  localPlayerId: string;
  isStarting?: boolean;
  onKick: (id: string) => void;
}

export const GhostScene: React.FC<GhostSceneProps> = ({ players, localPlayerId, isStarting = false, onKick }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const localPlayer = players.find(p => p.id === localPlayerId);
  const isAdminClient = localPlayer?.isAdmin || false;

  const getPosition = (index: number, total: number): [number, number, number] => {
    const spacing = 3.0; 
    const totalWidth = (total - 1) * spacing;
    const startX = -totalWidth / 2;
    return [startX + index * spacing, 0, 0];
  };

  return (
    <div className="absolute inset-0 z-0">
      <Canvas 
        camera={{ position: [0, 1, 8], fov: 50 }} 
        onPointerMissed={() => setSelectedId(null)}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#0AC8B9" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#C8AA6E" />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {players.map((player, idx) => (
          <Ghost 
            key={player.id} 
            player={player} 
            position={getPosition(idx, players.length)}
            isLocal={player.id === localPlayerId}
            isAdminClient={isAdminClient}
            isSelected={selectedId === player.id}
            isStarting={isStarting}
            onSelect={setSelectedId}
            onKick={onKick}
          />
        ))}

        <fog attach="fog" args={['#010a13', 5, 25]} />
      </Canvas>
    </div>
  );
};