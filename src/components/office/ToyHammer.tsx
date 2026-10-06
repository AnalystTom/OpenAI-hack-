import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export default function ToyHammer({ held, swingAt, onPickUp, onDrop }: {
  held: boolean;
  swingAt: number;
  onPickUp: () => void;
  onDrop: () => void;
}) {
  const model = useRef<THREE.Group>(null);
  const { gl } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -2.8), []);
  const point = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const raycast = held ? () => {} : THREE.Mesh.prototype.raycast;
  useEffect(() => {
    if (!held) return;
    const drop = (event: KeyboardEvent) => { if (event.key === "Escape") onDrop(); };
    const rightClick = (event: MouseEvent) => { event.preventDefault(); onDrop(); };
    window.addEventListener("keydown", drop);
    gl.domElement.addEventListener("contextmenu", rightClick);
    return () => {
      window.removeEventListener("keydown", drop);
      gl.domElement.removeEventListener("contextmenu", rightClick);
    };
  }, [held, gl, onDrop]);
  useFrame(({ pointer, camera }) => {
    if (!model.current) return;
    if (held) {
      ray.setFromCamera(pointer, camera);
      if (ray.ray.intersectPlane(plane, point)) model.current.position.copy(point);
      const age = (performance.now() - swingAt) / 1000;
      model.current.rotation.set(0, Math.PI / 4, age >= 0 && age < 0.32 ? -Math.sin(age / 0.32 * Math.PI) * 1.4 : -0.2);
    } else {
      model.current.position.set(3.8, 0.65, 5.2);
      model.current.rotation.set(0, -Math.PI / 5, -Math.PI / 2);
    }
  });
  function pickUp(event: ThreeEvent<PointerEvent>) {
    if (held || event.button !== 0) return;
    event.stopPropagation();
    onPickUp();
  }
  return <group ref={model} name="Toy hammer" position={[3.8, 0.65, 5.2]} onPointerDown={pickUp}>
    <RoundedBox name="Rubber hammer head" args={[1.65, 0.72, 0.72]} radius={0.17} smoothness={4} castShadow raycast={raycast}>
      <meshStandardMaterial color="#ee64a6" roughness={0.5} />
    </RoundedBox>
    {[-1, 1].map((side) => <mesh key={side} position={[side * 0.82, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow raycast={raycast}>
      <cylinderGeometry args={[0.38, 0.38, 0.15, 32]} />
      <meshStandardMaterial color="#9a83ed" roughness={0.6} />
    </mesh>)}
    <mesh position={[0, -0.76, 0]} castShadow raycast={raycast}>
      <cylinderGeometry args={[0.12, 0.15, 1.1, 24]} />
      <meshStandardMaterial color="#f0c760" roughness={0.7} />
    </mesh>
    <RoundedBox args={[0.33, 0.5, 0.33]} radius={0.09} position={[0, -1.22, 0]} castShadow raycast={raycast}>
      <meshStandardMaterial color="#5abbb4" roughness={0.8} />
    </RoundedBox>
    {!held && <Html position={[0, 0, 0]} center zIndexRange={[8, 0]}>
      <button className="hammer-pickup" aria-label="Pick up toy hammer" title="Pick up toy hammer"
        onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPickUp(); }} />
    </Html>}
  </group>;
}
