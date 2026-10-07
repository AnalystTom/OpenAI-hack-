import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export function AgentNameplate({ name, color, selected }: {
  name: string; color: string; selected: boolean;
}) {
  const camera = useThree(state => state.camera);
  const viewportHeight = useThree(state => state.size.height);
  const plate = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = "600 12px sans-serif";
    const width = Math.ceil(Math.min(88, Math.max(36, ctx.measureText(name).width + 24)));
    const height = 22;
    canvas.width = width * 3;
    canvas.height = height * 3;
    ctx.scale(3, 3);
    ctx.fillStyle = "#fffef6";
    ctx.strokeStyle = selected ? "#526b4d" : "#b8c6ad";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, width - 1, height - 1, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(9, 11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "600 12px sans-serif";
    ctx.fillStyle = "#253629";
    ctx.textBaseline = "middle";
    let visible = name;
    if (ctx.measureText(visible).width > width - 24) {
      while (visible.length && ctx.measureText(visible + "…").width > width - 24) visible = visible.slice(0, -1);
      visible += "…";
    }
    ctx.fillText(visible, 17, 11);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { texture, width, height };
  }, [name, color, selected]);
  useEffect(() => () => plate.texture.dispose(), [plate]);
  // Keep one compact line fixed above its character at every camera distance.
  const unit = 2 / camera.projectionMatrix.elements[5] / viewportHeight;
  return <sprite name="Agent nameplate" position={[0, 2.05, 0]} center={[0.5, 0]}
    scale={[plate.width * unit, plate.height * unit, 1]} renderOrder={selected ? 1001 : 1000}
    userData={{ agentNameplate: true, name, width: plate.width, height: plate.height, selected }}>
    <spriteMaterial map={plate.texture} sizeAttenuation={false} depthTest={false} depthWrite={false} toneMapped={false} />
  </sprite>;
}
