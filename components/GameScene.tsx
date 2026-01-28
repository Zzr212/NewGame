import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, useBox, useSphere, usePlane } from '@react-three/cannon';
import { useGLTF, PerspectiveCamera, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Player, Role } from '../types';
import { MobileControls } from './MobileControls';

// --- PHYSICS COMPONENTS ---

const Floor = () => {
  const [ref] = usePlane(() => ({ rotation: [-Math.PI / 2, 0, 0], position: [0, 0, 0] }));
  return (
    <group>
        <mesh ref={ref} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        <gridHelper args={[100, 20, '#333', '#222']} position={[0, 0.01, 0]} />
    </group>
  );
};

// Map Placeholder (Walls)
const Wall = ({ position, args }: { position: [number, number, number], args: [number, number, number] }) => {
    const [ref] = useBox(() => ({ position, args, type: 'Static' }));
    return (
        <mesh ref={ref}>
            <boxGeometry args={args} />
            <meshStandardMaterial color="#444" />
        </mesh>
    );
};

// Simple Prop
const GameProp = ({ position, type, color }: { position: [number, number, number], type: number, color: string }) => {
    // 0: Box, 1: Sphere, 2: Cylinder
    const [ref] = useBox(() => ({ mass: 1, position, args: [1, 1, 1] }));
    return (
        <mesh ref={ref}>
             {type === 0 && <boxGeometry args={[1, 1, 1]} />}
             {type === 1 && <sphereGeometry args={[0.5]} />}
             {type === 2 && <cylinderGeometry args={[0.5, 0.5, 1]} />}
             <meshStandardMaterial color={color} />
        </mesh>
    );
};

// Player Character
const Character = ({ 
    position, 
    color, 
    isLocal, 
    inputRef, 
    role,
    onMove 
}: { 
    position: [number, number, number], 
    color: string, 
    isLocal: boolean, 
    inputRef?: React.MutableRefObject<{move: {x:number, y:number}, look: {x:number, y:number}}>,
    role: Role,
    onMove?: (pos: [number, number, number], rot: [number, number, number]) => void
}) => {
    const [ref, api] = useSphere(() => ({ 
        mass: 1, 
        position, 
        args: [0.5], 
        fixedRotation: true,
        linearDamping: 0.5
    }));
    
    const { camera } = useThree();
    const velocity = useRef([0, 0, 0]);
    useEffect(() => api.velocity.subscribe((v) => (velocity.current = v)), [api.velocity]);

    // Camera rig ref
    const camRigRef = useRef(new THREE.Object3D());
    
    useFrame((state, delta) => {
        if (!isLocal || !inputRef) return;

        const { move, look } = inputRef.current;

        // Camera Rotation (Right stick)
        camRigRef.current.rotation.y -= look.x;
        // Clamp Up/Down if we wanted to implement it, but horizontal rotation is key

        // Movement relative to Camera
        const frontVector = new THREE.Vector3(0, 0, (move.y * -1));
        const sideVector = new THREE.Vector3((move.x * -1), 0, 0);
        const direction = new THREE.Vector3();

        direction
            .subVectors(frontVector, sideVector)
            .normalize()
            .multiplyScalar(5) // Speed
            .applyEuler(new THREE.Euler(0, camRigRef.current.rotation.y, 0));

        api.velocity.set(direction.x, velocity.current[1], direction.z);

        // Sync Camera Position to Player
        const currentPos = new THREE.Vector3(0,0,0);
        // We need to read current position from physics, but for now we trust the ref follows simulation
        // The best way in R3F physics is updating camera based on mesh position
        // @ts-ignore
        if (ref.current) {
             // @ts-ignore
            const pos = ref.current.position;
            
            // Third person offset: Behind and slightly left
            // Calculate offset based on camRig rotation
            const offset = new THREE.Vector3(-1.5, 2, 4).applyAxisAngle(new THREE.Vector3(0, 1, 0), camRigRef.current.rotation.y);
            
            camera.position.lerp(new THREE.Vector3(pos.x + offset.x, pos.y + offset.y, pos.z + offset.z), 0.1);
            camera.lookAt(pos.x, pos.y + 1, pos.z);

            // Network Sync (Throttle this in production)
            if (onMove && (Math.abs(direction.x) > 0.1 || Math.abs(direction.z) > 0.1)) {
                 onMove([pos.x, pos.y, pos.z], [0, camRigRef.current.rotation.y, 0]);
            }
        }
    });

    return (
        <mesh ref={ref}>
            <sphereGeometry args={[0.5]} />
            <meshStandardMaterial color={role === 'HUNTER' ? '#FF4655' : color} />
        </mesh>
    );
};

// --- MAIN SCENE ---

interface GameSceneProps {
    lobbyCode: string;
    players: Player[];
    localPlayerId: string;
    roles: Record<string, Role>;
    spawnPoints: Record<string, [number, number, number]>;
    onMove: (pos: [number, number, number], rot: [number, number, number]) => void;
}

export const GameScene: React.FC<GameSceneProps> = ({ lobbyCode, players, localPlayerId, roles, spawnPoints, onMove }) => {
    const inputRef = useRef({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 } });
    const myRole = roles[localPlayerId];
    const [blind, setBlind] = useState(myRole === 'HUNTER');
    const [timeLeft, setTimeLeft] = useState(30); // Blind time

    useEffect(() => {
        if (myRole === 'HUNTER') {
            const interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setBlind(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [myRole]);

    // Handle Remote Player Movement (Simple interpolation would go here, direct update for now)
    const [remotePlayers, setRemotePlayers] = useState<Record<string, any>>({});

    useEffect(() => {
        const handleRemoteMove = (e: CustomEvent) => {
            const { id, position, rotation } = e.detail;
            if (id !== localPlayerId) {
                setRemotePlayers(prev => ({
                    ...prev,
                    [id]: { position, rotation }
                }));
            }
        };
        window.addEventListener('player-moved', handleRemoteMove as EventListener);
        return () => window.removeEventListener('player-moved', handleRemoteMove as EventListener);
    }, [localPlayerId]);

    const localPlayer = players.find(p => p.id === localPlayerId);
    const mySpawn = spawnPoints[localPlayerId] || [0, 5, 0];

    return (
        <div className="absolute inset-0 bg-[#010a13]">
            <Canvas shadows>
                <PerspectiveCamera makeDefault position={[0, 10, 10]} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 20, 10]} intensity={1} castShadow />
                <Environment preset="night" />

                <Physics gravity={[0, -9.81, 0]}>
                    <Floor />
                    {/* Basic Map Boundaries */}
                    <Wall position={[0, 2, -25]} args={[50, 4, 1]} />
                    <Wall position={[0, 2, 25]} args={[50, 4, 1]} />
                    <Wall position={[-25, 2, 0]} args={[1, 4, 50]} />
                    <Wall position={[25, 2, 0]} args={[1, 4, 50]} />

                    {/* Random Static Props */}
                    <GameProp position={[5, 1, 5]} type={0} color="#8B4513" />
                    <GameProp position={[-5, 1, -5]} type={1} color="#555" />
                    <GameProp position={[10, 1, -8]} type={2} color="#228B22" />

                    {/* Players */}
                    {players.map(p => {
                        if (p.id === localPlayerId) {
                            return (
                                <Character 
                                    key={p.id}
                                    position={mySpawn} 
                                    color={p.color} 
                                    isLocal={true} 
                                    role={roles[p.id]}
                                    inputRef={inputRef}
                                    onMove={onMove}
                                />
                            );
                        } else {
                            // Remote Players
                            const remotePos = remotePlayers[p.id]?.position || spawnPoints[p.id] || [0, 5, 0];
                            return (
                                <mesh key={p.id} position={remotePos}>
                                    <sphereGeometry args={[0.5]} />
                                    <meshStandardMaterial color={roles[p.id] === 'HUNTER' ? '#FF4655' : p.color} />
                                    {/* Name Tag */}
                                    <Html position={[0, 1, 0]} center>
                                        <div className="bg-black/50 text-white text-xs px-2 py-1 rounded">{p.name}</div>
                                    </Html>
                                </mesh>
                            );
                        }
                    })}
                </Physics>
            </Canvas>

            {/* UI Layer */}
            <MobileControls 
                onMove={(vec) => { if (inputRef.current) inputRef.current.move = vec; }} 
                onLook={(vec) => { if (inputRef.current) inputRef.current.look = vec; }}
            />

            {/* Hunter Blind Overlay */}
            {blind && (
                <div className="absolute inset-0 z-[60] backdrop-blur-xl bg-black/40 flex flex-col items-center justify-center">
                    <h1 className="text-6xl text-[#FF4655] font-bold hextech-font mb-4 animate-pulse">YOU ARE THE HUNTER</h1>
                    <p className="text-2xl text-white">Props are hiding...</p>
                    <div className="text-8xl font-mono text-white mt-8">{timeLeft}</div>
                </div>
            )}
            
            {/* Prop HUD */}
            {!blind && myRole === 'PROP' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded text-[#0AC8B9] font-bold">
                    HIDE! Hunter is coming!
                </div>
            )}
        </div>
    );
};