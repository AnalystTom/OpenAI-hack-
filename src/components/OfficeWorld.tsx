import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Billboard,
  ContactShadows,
  Html,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";
import { InstancedFurnitureItems } from "../features/retro-office/objects/furniture";
import type { FurnitureItem } from "../features/retro-office/core/types";
import {
  createMascotCharacter,
  type MascotCharacter,
} from "./office/characters/createMascotCharacter";
import type { AgentStatus, CharacterKind, OfficeAgent } from "../types";
import { agentActivityLabel } from "../officeReplay";
import Tibo from "./office/Tibo";
import ToyHammer from "./office/ToyHammer";
import AgentFirework, { FIREWORK_DURATION } from "./office/AgentFirework";

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
import {
  DESKS,
  CHAIR_PLACEMENT,
  STATUS_LABELS,
  agentCharacter,
  officePose,
} from "../officeBehavior";
const noop = () => {};
function Label({
  text,
  subtitle,
  position,
  rotation = [0, 0, 0],
  width = 3,
  height = 0.65,
  bg = "#edf0db",
  color = "#526447",
  fontSize = 36,
}: {
  text: string;
  subtitle?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  bg?: string;
  color?: string;
  fontSize?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = subtitle ? 256 : 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 768, canvas.height);
    ctx.fillStyle = color;
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (subtitle) {
      ctx.font = "600 54px sans-serif";
      ctx.fillText(text, 384, 70, 708);
      ctx.font = "700 66px sans-serif";
      ctx.fillText(subtitle, 384, 176, 708);
    } else ctx.fillText(text, 384, 80, 720);
    const value = new THREE.CanvasTexture(canvas);
    value.colorSpace = THREE.SRGBColorSpace;
    return value;
  }, [text, subtitle, bg, color, fontSize]);
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
      add("computer", x + 0.55, z - 0.25);
      add(
        "chair",
        x + CHAIR_PLACEMENT.x,
        z + CHAIR_PLACEMENT.z,
        CHAIR_PLACEMENT.facing,
      );
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
  id,
  kind,
  index,
  total,
  paused,
  selected,
  onSelect,
  label,
  status,
  statusText,
  fireworkStartedAt,
  hammerHeld,
  hitAt,
  onHit,
}: {
  id: string;
  kind: CharacterKind;
  index: number;
  total: number;
  paused: boolean;
  selected: boolean;
  onSelect: () => void;
  label?: string;
  status: AgentStatus | "preview";
  statusText?: string;
  fireworkStartedAt: number | null;
  hammerHeld: boolean;
  hitAt?: number;
  onHit: () => void;
}) {
  const mascot = useRef<MascotCharacter | null>(null);
  const parent = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const visual = useRef<THREE.Group>(null);
  const initialPose = useRef(officePose(status, index, 0, total));
  useEffect(() => {
    const instance = createMascotCharacter(kind);
    mascot.current = instance;
    instance.group.scale.setScalar(1.02);
    visual.current?.add(instance.group);
    return () => {
      instance.dispose();
      mascot.current = null;
    };
  }, [kind]);
  useFrame((_, dt) => {
    if (!paused) elapsed.current += Math.min(dt, 0.05);
    const pose = officePose(hitAt === undefined ? status : "working", index, elapsed.current, total);
    if (visual.current) {
      const impact = hitAt === undefined ? 0 : Math.max(0, 1 - (performance.now() - hitAt) / 400);
      visual.current.scale.set(1 + impact * 0.18, 1 - impact * 0.2, 1 + impact * 0.18);
      visual.current.rotation.z = Math.sin(impact * Math.PI * 3) * 0.15;
    }
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
      name={`office-agent:${id}`}
      userData={{ hammerHitAt: hitAt, sourceStatus: status }}
      position={[
        initialPose.current.x,
        initialPose.current.y,
        initialPose.current.z,
      ]}
      rotation={[0, initialPose.current.facing, 0]}
      onClick={(e) => {
        e.stopPropagation();
        if (!hammerHeld) onSelect();
      }}
      onPointerDown={(e) => {
        if (!hammerHeld || e.button !== 0 || fireworkStartedAt !== null) return;
        e.stopPropagation();
        onHit();
      }}
      onPointerOver={() => {
        if (!hammerHeld) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <group ref={visual} name="Agent model" />
      {fireworkStartedAt !== null && <AgentFirework startedAt={fireworkStartedAt} color={CHARACTERS.find((c) => c.kind === kind)!.color} />}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.7, 0.77, 64]} />
          <meshBasicMaterial color="#f2b94a" side={THREE.DoubleSide} />
        </mesh>
      )}
      {label && fireworkStartedAt === null && (
        <Billboard position={[0, 2.75, 0]}>
          <Label
            text={label.length > 24 ? label.slice(0, 24) + "…" : label}
            subtitle={hitAt === undefined ? statusText ?? STATUS_LABELS[status] : "At desk · hammer play"}
            bg={status === "working" ? "#e7f3d8" : "#fcfcf5"}
            color="#283b23"
            position={[0, 0, 0]}
            width={4.2}
            height={1.15}
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
  const [fireworkStartedAt, setFireworkStartedAt] = useState<number | null>(null);
  const [hammerHeld, setHammerHeld] = useState(false);
  const [swingAt, setSwingAt] = useState(0);
  const [hammerHits, setHammerHits] = useState<Record<string, number>>({});
  const [lastHit, setLastHit] = useState<string | null>(null);
  function hitAgent(id: string, name: string) {
    const at = performance.now();
    setSwingAt(at);
    setHammerHits((hits) => ({ ...hits, [id]: at }));
    setLastHit(name);
  }
  const hasAgents = CHARACTERS.length > 0 || agents.length > 0;
  useEffect(() => {
    if (fireworkStartedAt === null) return;
    const timer = setTimeout(() => setFireworkStartedAt(null), FIREWORK_DURATION * 1000);
    return () => clearTimeout(timer);
  }, [fireworkStartedAt]);
  function resetWithFireworks() {
    if (hasAgents) {
      setHammerHits({});
      setLastHit(null);
      setFireworkStartedAt(performance.now());
    }
  }
  return (
    <>
    <Canvas
      shadows
      dpr={[1, 1.7]}
      camera={{ position: [22, 21, 25], fov: 38 }}
      onCreated={onReady}
      aria-label="Interactive 3D office"
      style={{ cursor: hammerHeld ? "none" : "auto" }}
      onPointerMissed={() => { if (hammerHeld) setSwingAt(performance.now()); }}
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
      <Tibo celebrating={fireworkStartedAt !== null} />
      <ToyHammer held={hammerHeld} swingAt={swingAt} onPickUp={() => { document.body.style.cursor = "auto"; onSelect(""); setHammerHeld(true); }} onDrop={() => setHammerHeld(false)} />
      {!hammerHeld && <Billboard position={[3.8, 2.4, 5.2]}>
        <Label text="TOY HAMMER" subtitle="Pick up. Tap a coworker." position={[0, 0, 0]} width={3.2} height={0.8} bg="#fff4db" color="#594b32" />
      </Billboard>}
      <group position={[8.1, 0.1, 5.6]} name="Tibo reset station">
        <Box position={[0, 0.15, 0]} size={[1.7, 0.3, 1.7]} color="#394940" />
        <Box position={[0, 0.66, 0]} size={[1.05, 0.8, 1.05]} color="#e8dec9" />
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.69, 0.69, 0.14, 48]} />
          <meshStandardMaterial color="#444c49" metalness={0.65} roughness={0.3} />
        </mesh>
        <group position={[0, fireworkStartedAt === null ? 1.3 : 1.2, 0]}>
          <mesh name="3D reset button" castShadow onClick={(event) => { event.stopPropagation(); resetWithFireworks(); }}
            onPointerOver={() => { document.body.style.cursor = hasAgents ? "pointer" : "default"; }}
            onPointerOut={() => { document.body.style.cursor = "auto"; }}>
            <cylinderGeometry args={[0.57, 0.62, 0.3, 48]} />
            <meshStandardMaterial color={hasAgents ? "#e6533d" : "#848b80"} roughness={0.3} emissive="#e6533d" emissiveIntensity={fireworkStartedAt === null ? 0 : 0.45} />
          </mesh>
          <Label text="RESET" position={[0, 0.155, 0]} rotation={[-Math.PI / 2, 0, 0]} width={0.85} height={0.3} bg={hasAgents ? "#e6533d" : "#848b80"} color="#fff7eb" fontSize={150} />
          <Html position={[0, 0.18, 0]} center zIndexRange={[10, 0]}>
            <button className="world-reset-hit" aria-label="Reset agents with fireworks" disabled={!hasAgents}
              onPointerDown={(event) => event.stopPropagation()} onClick={resetWithFireworks} />
          </Html>
        </group>
        <Billboard position={[-1.15, 4.35, 0]}>
          <Label text="TIBO" subtitle="Hit reset. Make sparks." position={[0, 0, 0]} width={3.7} height={0.9} bg="#fff6e7" color="#524b3c" />
        </Billboard>
      </group>
      {[...CHARACTERS.map((c) => ({
            id: c.kind,
            kind: c.kind,
            label: undefined,
            status: "preview" as const,
          })),
        ...agents.map((a) => ({
            id: a.id,
            kind: a.character ?? agentCharacter(a.id, a.model, a.harness),
            label: a.name,
            status: a.status,
            statusText: agentActivityLabel(a),
          }))
      ].map((a, i, array) => (
        <Walker
          key={a.id}
          {...a}
          index={i}
          total={array.length}
          paused={paused}
          fireworkStartedAt={fireworkStartedAt}
          hammerHeld={hammerHeld}
          hitAt={hammerHits[a.id]}
          onHit={() => hitAgent(a.id, a.label ?? CHARACTERS.find((c) => c.kind === a.kind)!.name)}
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
        enabled={!hammerHeld}
        target={[0, 0.2, 0]}
        minDistance={13}
        maxDistance={52}
        maxPolarAngle={Math.PI / 2.25}
        minPolarAngle={0.2}
        enableDamping
      />
    </Canvas>
    <div className="hammer-hint" role="status" aria-live="polite">
      {hammerHeld ? "Hammer in hand · click a coworker · Esc or right-click to put down" : "Pick up the toy hammer in the office"}
      <small>{lastHit ? `${lastHit} is heading back to their desk.` : "Toy interaction · character movement only"}</small>
    </div>
    <div className="tibo-reset-hint" role="status" aria-live="polite">
      {fireworkStartedAt !== null ? "Fireworks above your agents!" : hasAgents ? "Hit Tibo’s red 3D button for fireworks above your agents." : "Import agents to try Tibo’s firework reset."}
      <small>Visual reset · session data stays intact</small>
    </div>
    </>
  );
}
