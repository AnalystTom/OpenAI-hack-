import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { InstancedFurnitureItems } from "../features/retro-office/objects/furniture";
import type { FurnitureItem } from "../features/retro-office/core/types";
import {
  createMascotCharacter,
  type MascotCharacter,
} from "./office/characters/createMascotCharacter";
import type { AgentStatus, CharacterKind, OfficeAgent } from "../types";

export const CHARACTERS: {
  kind: CharacterKind;
  name: string;
  color: string;
  description: string;
}[] = [
  {
    kind: "blue-dot",
    name: "The creative",
    color: "#30aaff",
    description: "A blue Dot with big ideas and a very small beret.",
  },
  {
    kind: "frog-dot",
    name: "The debugger",
    color: "#a7cd42",
    description: "Two extra eyes. Still looking for that missing semicolon.",
  },
  {
    kind: "yellow-dot",
    name: "The thinker",
    color: "#edc339",
    description: "Deep in thought. Please do not tap the context window.",
  },
  {
    kind: "pink-dot",
    name: "The shipper",
    color: "#ec5caf",
    description: "Ships with heart. And suspiciously good sunglasses.",
  },
  {
    kind: "purple-dot",
    name: "The night owl",
    color: "#a580e0",
    description: "One more tiny change before calling it a night.",
  },
  {
    kind: "lovable",
    name: "The Lovable",
    color: "#ff805f",
    description: "A little heart with a whole lot of build energy.",
  },
];
import { DESKS, agentCharacter, officePose } from "../officeBehavior";
const noop = () => {};
function Label({
  text,
  position,
  rotation = [0, 0, 0],
  width = 3,
  height = 0.65,
  bg = "#edf0db",
  color = "#526447",
}: {
  text: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  bg?: string;
  color?: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 768, 160);
    ctx.fillStyle = color;
    ctx.font = "600 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 384, 80, 720);
    const value = new THREE.CanvasTexture(canvas);
    value.colorSpace = THREE.SRGBColorSpace;
    return value;
  }, [text, bg, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}
function Furniture() {
  const items = useMemo(() => {
    const result: FurnitureItem[] = [];
    const add = (type: string, x: number, z: number, facing = 0) =>
      result.push({
        _uid: `${type}-${result.length}`,
        type,
        x: (x + 16.2) / 0.018,
        y: (z + 16.2) / 0.018,
        facing,
      });
    for (const { x, z } of DESKS) {
      add("desk_cubicle", x, z);
      add("computer", x + 0.25, z + 0.1);
      add("chair", x + 0.45, z + 1);
    }
    add("couch", 6, -3, 270);
    add("round_table", 6.2, 0.6);
    add("couch_v", 6.8, 3.1);
    add("bookshelf", -7.5, -5.4);
    add("bookshelf", -5.2, -5.4);
    add("coffee_machine", 3.6, -5.2);
    add("cabinet", 3.2, -5.5);
    for (const [x, z] of [
      [-7.6, 4.5],
      [7.7, -5],
      [-7.6, -2],
      [4.8, 4.8],
    ])
      add("plant", x, z);
    add("lamp", 7.9, 4.4);
    return result;
  }, []);
  return (
    <group scale={[1.15, 1.15, 1.15]}>
      {[...new Set(items.map((i) => i.type))].map((type) => (
        <InstancedFurnitureItems
          key={type}
          itemType={type}
          items={items.filter((i) => i.type === type)}
          onItemClick={noop}
        />
      ))}
    </group>
  );
}
function Box({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <RoundedBox
      args={size}
      radius={0.06}
      smoothness={2}
      position={position}
      receiveShadow
      castShadow
    >
      <meshStandardMaterial color={color} roughness={0.85} />
    </RoundedBox>
  );
}
function Room({ night }: { night: boolean }) {
  return (
    <>
      <Box
        position={[0, -0.32, 0]}
        size={[21, 0.6, 16]}
        color={night ? "#3e4548" : "#e2dccf"}
      />
      <Box
        position={[0, 0.015, 0]}
        size={[20.7, 0.06, 15.7]}
        color={night ? "#67746c" : "#d7dccc"}
      />
      {Array.from({ length: 20 }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-9.8 + i, 0.052, 0]}
        >
          <planeGeometry args={[0.016, 15.5]} />
          <meshStandardMaterial color={night ? "#667369" : "#c5cdbc"} />
        </mesh>
      ))}
      <Box
        position={[0, 1.35, -7.9]}
        size={[21, 2.7, 0.22]}
        color={night ? "#4c5954" : "#eeeae0"}
      />
      <Box
        position={[-10.4, 1.35, 0]}
        size={[0.22, 2.7, 16]}
        color={night ? "#44504c" : "#e7e4db"}
      />
      <Box
        position={[-2.5, 0.07, -0.05]}
        size={[12, 0.05, 3.7]}
        color={night ? "#547366" : "#94ad90"}
      />
      <Box
        position={[7.6, 0.075, 0.5]}
        size={[4.8, 0.06, 8.3]}
        color={night ? "#806955" : "#d2b997"}
      />
      {[-7, -2, 3].map((x) => (
        <group key={x} position={[x, 1.7, -7.74]}>
          <Box position={[0, 0, 0]} size={[3.1, 1.55, 0.12]} color="#a6bdbb" />
          <Box
            position={[0, 0, 0.08]}
            size={[2.83, 1.3, 0.035]}
            color={night ? "#495b75" : "#d9e8e4"}
          />
          <Box
            position={[0, 0, 0.12]}
            size={[0.07, 1.35, 0.04]}
            color="#f4f0e7"
          />
        </group>
      ))}
      <Label
        text="LESS TABS. MORE LITTLE GUYS."
        position={[7.5, 1.8, -7.69]}
        width={3.8}
        height={0.85}
      />
      <Label
        text="MAKE ROOM FOR IDEAS"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-2.4, 0.12, -0.1]}
        width={5.5}
        height={0.7}
        bg="#94ad90"
        color="#dce5cf"
      />
      <Label
        text="D O T S   H Q"
        position={[0, -0.25, 8.05]}
        width={2.7}
        height={0.35}
        bg="#e2dccf"
      />
      <Furniture />
    </>
  );
}
function Walker({
  kind,
  index,
  total,
  paused,
  selected,
  onSelect,
  label,
  status,
}: {
  kind: CharacterKind;
  index: number;
  total: number;
  paused: boolean;
  selected: boolean;
  onSelect: () => void;
  label?: string;
  status: AgentStatus | "preview";
}) {
  const mascot = useRef<MascotCharacter | null>(null);
  const parent = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  useEffect(() => {
    const instance = createMascotCharacter(kind);
    mascot.current = instance;
    instance.group.scale.setScalar(1.02);
    parent.current?.add(instance.group);
    return () => {
      instance.dispose();
      mascot.current = null;
    };
  }, [kind]);
  useFrame((_, dt) => {
    if (!paused) elapsed.current += Math.min(dt, 0.05);
    const pose = officePose(status, index, elapsed.current, total);
    if (parent.current) {
      const target = new THREE.Vector3(pose.x, pose.y, pose.z);
      const moving = parent.current.position.distanceTo(target) > 0.12;
      parent.current.position.lerp(target, 1 - Math.exp(-dt * 5));
      parent.current.rotation.y = pose.facing;
      mascot.current?.update(
        elapsed.current,
        paused ? 0 : pose.walking || moving ? 1 : 0,
        pose.sitting && !moving,
      );
    }
  });
  return (
    <group
      ref={parent}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.7, 0.77, 64]} />
          <meshBasicMaterial color="#f2b94a" side={THREE.DoubleSide} />
        </mesh>
      )}
      {label && (
        <Billboard position={[0, 2.35, 0]}>
          <Label
            text={`${status === "working" ? "● " : ""}${label.length > 34 ? label.slice(0, 34) + "…" : label}`}
            position={[0, 0, 0]}
            width={2.5}
            height={0.45}
          />
        </Billboard>
      )}
    </group>
  );
}
function CameraReset({ resetKey }: { resetKey: number }) {
  const { camera, controls, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(22, 21, 25);
    const orbit = controls as unknown as {
      target: THREE.Vector3;
      update: () => void;
    } | null;
    orbit?.target.set(0, 0.2, 0);
    orbit?.update();
    invalidate();
  }, [resetKey, camera, controls, invalidate]);
  return null;
}
export default function OfficeWorld({
  agents,
  preview,
  paused,
  night,
  cameraKey,
  selected,
  onSelect,
  onReady,
}: {
  agents: OfficeAgent[];
  preview: boolean;
  paused: boolean;
  night: boolean;
  cameraKey: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onReady: () => void;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.7]}
      camera={{ position: [22, 21, 25], fov: 38 }}
      onCreated={onReady}
      aria-label="Interactive 3D office"
    >
      <color attach="background" args={[night ? "#252e32" : "#e9ebe5"]} />
      <ambientLight intensity={night ? 0.8 : 1.6} />
      <hemisphereLight args={["#fff8e9", "#748575", 1.6]} />
      <directionalLight
        position={[-6, 18, 8]}
        intensity={night ? 1.1 : 2.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.001}
      />
      <Suspense fallback={null}>
        <Room night={night} />
      </Suspense>
      {(preview
        ? CHARACTERS.map((c) => ({
            id: c.kind,
            kind: c.kind,
            label: undefined,
            status: "preview" as const,
          }))
        : agents.map((a) => ({
            id: a.id,
            kind: a.character ?? agentCharacter(a.id, a.model, a.harness),
            label: a.name,
            status: a.status,
          }))
      ).map((a, i, array) => (
        <Walker
          key={a.id}
          {...a}
          index={i}
          total={array.length}
          paused={paused}
          selected={selected === a.id}
          onSelect={() => onSelect(a.id)}
        />
      ))}
      <ContactShadows
        position={[0, -0.66, 0]}
        opacity={0.3}
        scale={45}
        blur={2.6}
        far={10}
        resolution={512}
        frames={1}
      />
      <CameraReset resetKey={cameraKey} />
      <OrbitControls
        makeDefault
        target={[0, 0.2, 0]}
        minDistance={13}
        maxDistance={52}
        maxPolarAngle={Math.PI / 2.25}
        minPolarAngle={0.2}
        enableDamping
      />
    </Canvas>
  );
}
