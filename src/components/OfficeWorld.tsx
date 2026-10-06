import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { KnowledgeBook, RoomProfile, RoomProject, RoomTheme } from "../socialRoom";

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
  officeLayout,
  CHAIR_PLACEMENT,
  STATUS_LABELS,
  agentCharacter,
  officePose,
  type LiveInteraction,
} from "../officeBehavior";
const noop = () => {};
const PALETTES: Record<RoomTheme, { backdrop: string; floor: string; wall: string; rug: string; lounge: string; window: string; accent: string }> = {
  studio: { backdrop: "#e9ebe5", floor: "#d7dccc", wall: "#eeeae0", rug: "#94ad90", lounge: "#d2b997", window: "#d9e8e4", accent: "#7f9c77" },
  grove: { backdrop: "#dce9da", floor: "#c8ddc3", wall: "#e3ebdb", rug: "#75a88b", lounge: "#c7ad8e", window: "#c3e7d0", accent: "#4f9878" },
  coastal: { backdrop: "#dcebed", floor: "#d2e1df", wall: "#e9f1ee", rug: "#83b7c2", lounge: "#e2c49d", window: "#b9e0ed", accent: "#57a9bd" },
  cosmic: { backdrop: "#dedbe9", floor: "#d9d5e7", wall: "#eeeaf2", rug: "#978bc2", lounge: "#c2adc5", window: "#c6bee9", accent: "#8272bb" },
};
const STATUS_COLOR: Record<AgentStatus, string> = {
  working: "#55b67a", idle: "#d9aa56", blocked: "#e49352",
  error: "#d96b6b", offline: "#909b9c", unknown: "#9a96b1",
};
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
function Furniture({ total }: { total: number }) {
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
    for (const { x, z } of officeLayout(total).desks) {
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
  }, [total]);
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
function FirstAidKit({ onOpen }: { onOpen: () => void }) {
  return <group position={[-10.05, .4, -3.5]} rotation={[0, Math.PI / 2, 0]} onClick={(e) => { e.stopPropagation(); onOpen(); }}
    onPointerOver={() => { document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "auto"; }}>
    <Box position={[0, 1.05, 0]} size={[1.6, .9, .65]} color="#52765a" />
    <Box position={[0, 1.58, 0]} size={[.65, .13, .18]} color="#3c5540" />
    <Box position={[-.29, 1.48, 0]} size={[.1, .25, .18]} color="#3c5540" />
    <Box position={[.29, 1.48, 0]} size={[.1, .25, .18]} color="#3c5540" />
    <Box position={[0, 1.05, .34]} size={[.18, .55, .04]} color="#f5f3e7" />
    <Box position={[0, 1.05, .37]} size={[.55, .18, .04]} color="#f5f3e7" />
    <Billboard position={[0, 2, 0]}><Label text="FIRST AID" position={[0, 0, 0]} width={1.9} height={.4} /></Billboard>
  </group>;
}
function Room({ night, profile, total }: { night: boolean; profile: RoomProfile; total: number }) {
  const layout = officeLayout(total);
  const palette = PALETTES[profile.theme];
  return (
    <>
      <Box
        position={[layout.x, -0.32, layout.z]}
        size={[layout.width, 0.6, layout.depth]}
        color={night ? "#3e4548" : palette.lounge}
      />
      <Box
        position={[layout.x, 0.015, layout.z]}
        size={[layout.width - 0.3, 0.06, layout.depth - 0.3]}
        color={night ? "#67746c" : palette.floor}
      />
      {Array.from({ length: Math.floor(layout.width) }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[layout.x - layout.width / 2 + 0.7 + i, 0.052, layout.z]}
        >
          <planeGeometry args={[0.016, layout.depth - 0.5]} />
          <meshStandardMaterial color={night ? "#667369" : palette.wall} />
        </mesh>
      ))}
      <Box
        position={[layout.x, 1.35, -7.9]}
        size={[layout.width, 2.7, 0.22]}
        color={night ? "#4c5954" : palette.wall}
      />
      <Box
        position={[layout.x - layout.width / 2 + 0.1, 1.35, layout.z]}
        size={[0.22, 2.7, layout.depth]}
        color={night ? "#44504c" : palette.wall}
      />
      <Box
        position={[layout.carpet.x, 0.07, layout.carpet.z]}
        size={[layout.carpet.width, 0.05, layout.carpet.depth]}
        color={night ? "#547366" : palette.rug}
      />
      <Box
        position={[7.6, 0.075, 0.5]}
        size={[4.8, 0.06, 8.3]}
        color={night ? "#806955" : palette.lounge}
      />
      {[-7, -2, 3].map((x) => (
        <group key={x} position={[x, 1.7, -7.74]}>
          <Box position={[0, 0, 0]} size={[3.1, 1.55, 0.12]} color="#a6bdbb" />
          <Box
            position={[0, 0, 0.08]}
            size={[2.83, 1.3, 0.035]}
            color={night ? "#495b75" : palette.window}
          />
          <Box
            position={[0, 0, 0.12]}
            size={[0.07, 1.35, 0.04]}
            color="#f4f0e7"
          />
        </group>
      ))}
      <Label
        text={`${profile.displayName.toUpperCase().slice(0, 24)} · ${profile.theme.toUpperCase()}`}
        position={[7.5, 1.8, -7.69]}
        width={3.8}
        height={0.85}
        bg={palette.accent}
        color="#f9f9f2"
        fontSize={55}
      />
      <Label
        text="MAKE ROOM FOR IDEAS"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[layout.carpet.x, 0.12, layout.carpet.z]}
        width={5.5}
        height={0.7}
        bg={palette.rug}
        color="#dce5cf"
      />
      <Label
        text={`${profile.displayName.toUpperCase().slice(0, 22)}  HQ`}
        position={[0, -0.25, 8.05]}
        width={2.7}
        height={0.35}
        bg={palette.lounge}
      />
      {profile.theme === "cosmic" && Array.from({ length: 12 }, (_, index) => <mesh key={index} position={[-8.7 + (index % 6) * 3.2, 1.8 + (index % 2) * 0.38, -7.72]}><sphereGeometry args={[0.055, 8, 8]} /><meshBasicMaterial color="#fcf5c9" /></mesh>)}
      <Label text="WORK STATIONS" rotation={[-Math.PI / 2, 0, 0]} position={[-2.5, 0.12, -1.75]} width={3.1} height={0.42} bg={night ? "#547366" : palette.rug} color="#f7f8ef" />
      <Label text="COFFEE BREAK" rotation={[-Math.PI / 2, 0, 0]} position={[5.7, 0.12, -1.7]} width={2.7} height={0.42} bg={night ? "#806955" : palette.lounge} color="#fffaf0" />
      <Furniture total={total} />
    </>
  );
}
function KnowledgeDisplay({ books, selected, onSelect, accent }: {
  books: KnowledgeBook[]; selected: string | null; onSelect: (id: string) => void; accent: string;
}) {
  if (!books.length) return null;
  const covers = ["#e8a36f", "#78afad", "#ad91c6", "#d1b46f", "#91b98b", "#d8899a", "#7c9ac1", "#d5a881"];
  return <group position={[5.5, 0, 1.5]}>
    <RoundedBox args={[3.2, 0.24, 2.2]} radius={0.08} smoothness={2} position={[0, 0.2, 0]} castShadow receiveShadow><meshStandardMaterial color="#e5d8be" roughness={0.8} /></RoundedBox>
    <Label text="THE LEARNING LIBRARY" position={[0, 0.32, 1.13]} width={2.3} height={0.28} bg={accent} color="#fffdf4" fontSize={68} />
    {books.slice(0, 8).map((book, index) => {
      const x = -0.9 + (index % 3) * 0.9;
      const z = -0.65 + Math.floor(index / 3) * 0.62;
      return <group key={book.id} position={[books.length === 1 ? 0 : x, 0.42, books.length === 1 ? -0.05 : z]} scale={books.length === 1 ? 2 : 1.12} rotation={[0, (index % 2 ? 0.13 : -0.1), 0]}
        onClick={(event) => { event.stopPropagation(); onSelect(book.id); }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}>
        <mesh castShadow receiveShadow><boxGeometry args={[0.72, 0.14, 0.46]} /><meshStandardMaterial color={covers[index]} roughness={0.63} /></mesh>
        <mesh position={[-0.32, 0.01, 0]}><boxGeometry args={[0.045, 0.16, 0.46]} /><meshStandardMaterial color="#f8e5ba" /></mesh>
        <Label text={book.title.slice(0, 28)} rotation={[-Math.PI / 2, 0, 0]} position={[0.03, 0.077, 0]} width={0.61} height={0.34} bg={covers[index]} color="#253029" fontSize={70} />
        {selected === book.id && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}><ringGeometry args={[0.47, 0.53, 32]} /><meshBasicMaterial color="#f8ca57" side={THREE.DoubleSide} /></mesh>}
      </group>;
    })}
  </group>;
}
function ProjectWall({ projects, selected, onSelect, accent }: {
  projects: RoomProject[]; selected: string | null; onSelect: (id: string) => void; accent: string;
}) {
  return <group>{projects.slice(0, 8).map((project, index) => <group key={project.id}
    position={[-10.22, index < 4 ? 1.85 : 0.75, -4.5 + (index % 4) * 2.4]}
    rotation={[0, Math.PI / 2, 0]}
    onClick={(event) => { event.stopPropagation(); onSelect(project.id); }}
    onPointerOver={() => { document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "auto"; }}>
    <mesh><boxGeometry args={[1.75, 0.86, 0.09]} /><meshStandardMaterial color={selected === project.id ? "#f0c55d" : accent} /></mesh>
    <Label text={project.title.slice(0, 30)} position={[0, 0, 0.052]} width={1.6} height={0.48} bg="#fbfaf1" color="#334335" fontSize={67} />
  </group>)}</group>;
}
function InvitePortal({ onInvite, accent }: { onInvite?: () => void; accent: string }) {
  if (!onInvite) return null;
  return <group position={[8.7, 0.1, 5.7]}
    onClick={(event) => { event.stopPropagation(); onInvite(); }}
    onPointerOver={() => { document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "auto"; }}>
    <mesh position={[0, 1.06, 0]}><torusGeometry args={[0.67, 0.13, 12, 48]} /><meshStandardMaterial color={accent} metalness={0.2} roughness={0.35} emissive={accent} emissiveIntensity={0.18} /></mesh>
    <mesh position={[0, 1.06, -0.05]}><circleGeometry args={[0.61, 48]} /><meshBasicMaterial color={accent} transparent opacity={0.25} side={THREE.DoubleSide} /></mesh>
    <Label text="INVITE FRIENDS" position={[0, 2.04, 0]} width={1.75} height={0.32} bg={accent} color="#fffdf4" fontSize={72} />
  </group>;
}
function ContextMeter({ agent }: { agent: OfficeAgent }) {
  const known = agent.contextUsed !== null && agent.contextWindow !== null;
  const fraction = known ? THREE.MathUtils.clamp(agent.contextUsed! / agent.contextWindow!, 0, 1) : 0;
  return <group position={[0.87, 0, 0.25]}>
    <RoundedBox args={[0.23, 0.92, 0.12]} radius={0.06} smoothness={2} position={[0, 1.02, 0]}><meshStandardMaterial color="#e7e9e2" /></RoundedBox>
    {known ? <RoundedBox args={[0.13, Math.max(0.005, fraction * 0.75), 0.14]} radius={0.03} smoothness={2} position={[0, 0.63 + fraction * 0.375, 0.015]}><meshStandardMaterial color={fraction > 0.85 ? "#e79d57" : "#7cbd86"} /></RoundedBox> : <Label text="?" position={[0, 1.02, 0.08]} width={0.16} height={0.25} bg="#e7e9e2" color="#6d7a73" fontSize={90} />}
  </group>;
}
function TeamUp({ slot, accent, paused, reducedMotion }: { slot: number; accent: string; paused: boolean; reducedMotion: boolean }) {
  const orb = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const x = slot === 0 ? 3.6 : -4.2;
  useFrame((_, dt) => {
    if (!paused && !reducedMotion) elapsed.current += Math.min(dt, 0.05);
    if (orb.current) {
      orb.current.position.x = Math.sin(elapsed.current * 2.6) * 0.72;
      orb.current.position.y = 1.16 + Math.abs(Math.sin(elapsed.current * 2.6)) * 0.42;
      orb.current.rotation.y = elapsed.current * 2;
    }
  });
  return <group position={[x, 0, 2.5]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
      <ringGeometry args={[1.38, 1.46, 48]} />
      <meshBasicMaterial color={accent} transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>
    <group ref={orb}>
      <mesh><sphereGeometry args={[0.22, 20, 16]} /><meshStandardMaterial color="#fff8d7" emissive={accent} emissiveIntensity={0.8} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.32, 0.035, 8, 32]} /><meshBasicMaterial color={accent} /></mesh>
    </group>
    <Billboard position={[0, 2.85, 0]}><Label text="TEAM UP" position={[0, 0, 0]} width={1.65} height={0.38} bg={accent} color="#fffdf2" fontSize={75} /></Billboard>
  </group>;
}
// Keep late imports on the same circuit as the residents already in the room.
function OfficeAnimationClock({ paused, time }: { paused: boolean; time: { current: number } }) {
  useFrame((_, dt) => {
    if (!paused) time.current += Math.min(dt, 0.1);
  }, -1);
  return null;
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
  retrying = false,
  animationTime,
  agent,
  reducedMotion,
  interaction,
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
  retrying?: boolean;
  animationTime: { current: number };
  agent?: OfficeAgent;
  reducedMotion: boolean;
  interaction?: { slot: number; side: "from" | "to" };
}) {
  const mascot = useRef<MascotCharacter | null>(null);
  const parent = useRef<THREE.Group>(null);
  const visual = useRef<THREE.Group>(null);
  const initialPose = useRef(officePose(status, index, animationTime.current, total));
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
    const pose = officePose(hitAt === undefined ? status : "working", index, reducedMotion ? 0 : animationTime.current, total, hitAt === undefined && retrying, hitAt === undefined ? interaction : undefined);
    if (visual.current) {
      const impact = hitAt === undefined || reducedMotion ? 0 : Math.max(0, 1 - (performance.now() - hitAt) / 400);
      visual.current.scale.set(1 + impact * 0.18, 1 - impact * 0.2, 1 + impact * 0.18);
      visual.current.rotation.z = Math.sin(impact * Math.PI * 3) * 0.15;
    }
    if (parent.current) {
      const target = new THREE.Vector3(pose.x, pose.y, pose.z);
      const moving = parent.current.position.distanceTo(target) > 0.12;
      if (reducedMotion) parent.current.position.copy(target);
      else parent.current.position.lerp(target, 1 - Math.exp(-dt * 5));
      parent.current.rotation.y = pose.facing;
      mascot.current?.update(
        reducedMotion ? 0 : animationTime.current,
        paused || reducedMotion ? 0 : pose.walking || moving ? 1 : 0,
        pose.sitting && (!moving || reducedMotion),
      );
    }
  });
  return (
    <group
      ref={parent}
      name={`office-agent:${id}`}
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
      {hammerHeld && <mesh name="Hammer hit area" position={[0, 1, 0]} visible={false}>
        <sphereGeometry args={[1.8, 12, 8]} />
      </mesh>}
      {fireworkStartedAt !== null && <AgentFirework startedAt={fireworkStartedAt} color={CHARACTERS.find((c) => c.kind === kind)!.color} />}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.7, 0.77, 64]} />
          <meshBasicMaterial color="#f2b94a" side={THREE.DoubleSide} />
        </mesh>
      )}
      {agent ? <Billboard>
        <ContextMeter agent={agent} />
        <Label text={agent.name.length > 26 ? `${agent.name.slice(0, 23)}…` : agent.name} subtitle={statusText ?? STATUS_LABELS[agent.status]} position={[0, 2.85, 0]} width={3.1} height={0.88} bg={STATUS_COLOR[agent.status]} color="#233026" />
      </Billboard> : label && (
        <Billboard position={[0, 2.35, 0]}>
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
function CameraReset({ resetKey, total }: { resetKey: number; total: number }) {
  const { camera, controls, invalidate } = useThree();
  useEffect(() => {
    const layout = officeLayout(total);
    const zoom = Math.max(layout.width / 21, layout.depth / 16);
    camera.position.set(layout.x + 18 * zoom, 17 * zoom, layout.z + 20 * zoom);
    const orbit = controls as unknown as {
      target: THREE.Vector3;
      update: () => void;
    } | null;
    orbit?.target.set(layout.x, 0.2, layout.z);
    orbit?.update();
    invalidate();
  }, [resetKey, total, camera, controls, invalidate]);
  return null;
}
export default function OfficeWorld({
  agents,
  interactions,
  preview,
  paused,
  night,
  cameraKey,
  selected,
  onSelect,
  profile,
  books,
  projects,
  selectedBook,
  selectedProject,
  onSelectBook,
  onSelectProject,
  onInvite,
  onReady,
  onFirstAid,
}: {
  agents: OfficeAgent[];
  interactions: LiveInteraction[];
  preview: boolean;
  paused: boolean;
  night: boolean;
  cameraKey: number;
  selected: string | null;
  onSelect: (id: string) => void;
  profile: RoomProfile;
  books: KnowledgeBook[];
  projects: RoomProject[];
  selectedBook: string | null;
  selectedProject: string | null;
  onSelectBook: (id: string) => void;
  onSelectProject: (id: string) => void;
  onInvite?: () => void;
  onReady: () => void;
  onFirstAid?: () => void;
}) {
  const [fireworkStartedAt, setFireworkStartedAt] = useState<number | null>(null);
  const animationTime = useRef(0);
  const [hammerHeld, setHammerHeld] = useState(false);
  const [swingAt, setSwingAt] = useState(0);
  const [hammerHits, setHammerHits] = useState<Record<string, number>>({});
  const [lastHit, setLastHit] = useState<string | null>(null);
  const dropHammer = useCallback(() => setHammerHeld(false), []);
  const swingHammer = useCallback(() => setSwingAt(performance.now()), []);
  function hitAgent(id: string, name: string) {
    const at = performance.now();
    setSwingAt(at);
    setHammerHits((hits) => ({ ...hits, [id]: at }));
    setLastHit(name);
  }
  const hasAgents = preview || agents.length > 0;
  useEffect(() => {
    if (fireworkStartedAt === null) return;
    const timer = setTimeout(() => setFireworkStartedAt(null), FIREWORK_DURATION * 1000);
    return () => clearTimeout(timer);
  }, [fireworkStartedAt]);
  function resetWithFireworks() {
    if (hasAgents) {
      setFireworkStartedAt(performance.now());
    }
  }
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const palette = PALETTES[profile.theme];
  return (
    <>
    <Canvas
      shadows
      dpr={[1, 1.7]}
      camera={{ position: [18, 17, 20], fov: 38 }}
      onCreated={onReady}
      aria-label={`Interactive 3D office · ${officeLayout(agents.length).desks.length} desks`}
      style={{ cursor: hammerHeld ? "none" : "auto" }}
    >
      <OfficeAnimationClock paused={paused} time={animationTime} />
      <color attach="background" args={[night ? "#252e32" : palette.backdrop]} />
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
        <Room night={night} profile={profile} total={agents.length} />
        {onFirstAid && <FirstAidKit onOpen={onFirstAid} />}
      </Suspense>
      <KnowledgeDisplay books={books} selected={selectedBook} onSelect={onSelectBook} accent={palette.accent} />
      <ProjectWall projects={projects} selected={selectedProject} onSelect={onSelectProject} accent={palette.accent} />
      <group position={[-15, 0, 0]}><InvitePortal onInvite={onInvite} accent={palette.accent} /></group>
      {interactions.map((link) => <TeamUp key={`${link.fromId}-${link.toId}`} slot={link.slot} accent={palette.accent} paused={paused} reducedMotion={reducedMotion} />)}
      <Tibo celebrating={fireworkStartedAt !== null} />
      <ToyHammer held={hammerHeld} swingAt={swingAt} reducedMotion={reducedMotion} onPickUp={() => { document.body.style.cursor = "auto"; onSelect(""); setHammerHeld(true); }} onDrop={dropHammer} onSwing={swingHammer} />
      {!hammerHeld && <Billboard position={[0, 2.4, 6.4]}>
        <Label text="TOY HAMMER" subtitle="Pick up. Tap a coworker." position={[0, 0, 0]} width={2.7} height={0.7} bg="#fff4db" color="#594b32" />
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
      {[...(preview ? CHARACTERS.map((c) => ({
            id: c.kind,
            kind: c.kind,
            label: undefined,
            status: "preview" as const,
          })) : []),
        ...(!preview ? agents.map((a) => ({
            id: a.id,
            kind: a.character ?? agentCharacter(a.id),
            label: a.name,
            status: a.status,
            statusText: agentActivityLabel(a),
            retrying: a.health?.retrying,
            agent: a,
            interaction: (() => {
              const link = interactions.find((item) => item.fromId === a.id || item.toId === a.id);
              return link ? { slot: link.slot, side: link.fromId === a.id ? "from" as const : "to" as const } : undefined;
            })(),
          })) : [])
      ].map((a, i, array) => (
        <Walker
          key={a.id}
          {...a}
          index={i}
          total={array.length}
          animationTime={animationTime}
          paused={paused}
          fireworkStartedAt={fireworkStartedAt}
          hammerHeld={hammerHeld}
          hitAt={hammerHits[a.id]}
          onHit={() => hitAgent(a.id, a.label ?? CHARACTERS.find((c) => c.kind === a.kind)!.name)}
          reducedMotion={reducedMotion}
          selected={selected === a.id}
          onSelect={() => onSelect(a.id)}
        />
      ))}
      <ContactShadows
        position={[0, -0.66, 0]}
        opacity={0.3}
        scale={120}
        blur={2.6}
        far={10}
        resolution={512}
        frames={1}
      />
      <CameraReset resetKey={cameraKey} total={agents.length} />
      <OrbitControls
        makeDefault
        enabled={!hammerHeld}
        target={[0, 0.2, 0]}
        minDistance={13}
        maxDistance={160}
        maxPolarAngle={Math.PI / 2.25}
        minPolarAngle={0.2}
        enableDamping
      />
    </Canvas>
    <div className="hammer-hint" role="status" aria-live="polite">
      {hammerHeld ? "Hammer in hand · click near a coworker · Esc or right-click to put down" : "Pick up the toy hammer in the office"}
      <small>{lastHit ? `${lastHit} is heading back to their desk.` : "Toy interaction · character movement only"}</small>
    </div>
    <div className="tibo-reset-hint" role="status" aria-live="polite">
      {fireworkStartedAt !== null ? "Fireworks above your agents!" : hasAgents ? "Hit Tibo’s red 3D button for fireworks above your agents." : "Import agents to try Tibo’s firework reset."}
      <small>Visual reset · session data stays intact</small>
    </div>
    </>
  );
}
