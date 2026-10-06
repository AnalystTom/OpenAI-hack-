import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const FIREWORK_DURATION = 3.6;
export const FIREWORK_BURST = 0.65;
const COUNT = 72;

/** Particles follow the agent's own position; their colours match its model. */
export default function AgentFirework({ startedAt, color }: { startedAt: number; color: string }) {
  const sparks = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const directions = useMemo(() => Array.from({ length: COUNT }, (_, i) => {
    const y = 1 - 2 * (i + 0.5) / COUNT;
    const radius = Math.sqrt(1 - y * y);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  }), []);
  useFrame(() => {
    if (!sparks.current || !material.current) return;
    const age = (performance.now() - startedAt) / 1000 - FIREWORK_BURST;
    sparks.current.visible = age >= 0 && age < 2.5;
    if (!sparks.current.visible) return;
    material.current.opacity = Math.max(0, 1 - age / 2.5);
    directions.forEach((direction, i) => {
      const trail = i % 3 * 0.035;
      const t = Math.max(0, age - trail);
      const radius = (1.65 + i % 4 * 0.06) * (1 - Math.exp(-t * 3));
      dummy.position.copy(direction).multiplyScalar(radius);
      dummy.position.y += 4.8 - 0.06 * t * t;
      const size = (0.065 + (i % 3) * 0.025) * Math.max(0.1, 1 - t / 2.5);
      dummy.scale.set(size, size * (1 + t * 3), size);
      dummy.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, direction);
      dummy.updateMatrix();
      sparks.current!.setMatrixAt(i, dummy.matrix);
    });
    sparks.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={sparks} args={[undefined, undefined, COUNT]} visible={false} frustumCulled={false} name="Agent fireworks">
    <sphereGeometry args={[1, 6, 4]} />
    <meshBasicMaterial ref={material} color={color} transparent depthWrite={false} toneMapped={false} />
  </instancedMesh>;
}
