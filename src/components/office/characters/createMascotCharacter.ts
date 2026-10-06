import * as THREE from "three";

export type MascotKind =
  | "blue-dot"
  | "frog-dot"
  | "yellow-dot"
  | "pink-dot"
  | "purple-dot"
  | "lovable";

export const MASCOT_KINDS: readonly MascotKind[] = [
  "blue-dot",
  "frog-dot",
  "yellow-dot",
  "pink-dot",
  "purple-dot",
  "lovable",
];

export interface MascotCharacter {
  /** Faces +Z, stands on y=0. Move, rotate, or scale this group freely. */
  group: THREE.Group;
  /** timeSeconds is elapsed time; walking is a 0–1 gait intensity. */
  update: (timeSeconds: number, walking?: number) => void;
  dispose: () => void;
}

const COLORS: Record<MascotKind, string> = {
  "blue-dot": "#20a9ff",
  "frog-dot": "#b6e645",
  "yellow-dot": "#ffd64a",
  "pink-dot": "#f344bc",
  "purple-dot": "#a365ed",
  lovable: "#f961aa",
};

/** Original procedural geometry, shaped after the supplied character references. */
export function createMascotCharacter(kind: MascotKind): MascotCharacter {
  const group = new THREE.Group();
  group.name = `mascot:${kind}`;
  const body = new THREE.Group();
  group.add(body);

  const material = (color: string, roughness = 0.48) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
  const skin = material(COLORS[kind]);
  const ink = material("#151524", 0.36);
  const white = material("#fffdf0", 0.32);
  const shoe = material(COLORS[kind], 0.36);
  const sphereGeometry = new THREE.SphereGeometry(1, 32, 24);

  function ellipsoid(
    parent: THREE.Group,
    mat: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number],
  ) {
    const mesh = new THREE.Mesh(sphereGeometry, mat);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function outline(
    shape: THREE.Shape,
    mat: THREE.Material,
    depth = 0.4,
    bevel = 0.11,
  ) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 28,
    });
    geometry.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    body.add(mesh);
    return mesh;
  }

  function stroke(
    points: THREE.Vector3[],
    radius = 0.024,
    mat: THREE.Material = ink,
  ) {
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, radius, 8, false),
      mat,
    );
    mesh.castShadow = true;
    body.add(mesh);
    return mesh;
  }

  function eyes(y: number, z: number, spacing = 0.23) {
    for (const x of [-spacing, spacing]) {
      ellipsoid(body, ink, [x, y, z], [0.059, 0.108, 0.044]);
      ellipsoid(
        body,
        white,
        [x - 0.014, y + 0.038, z + 0.039],
        [0.012, 0.019, 0.008],
      );
    }
  }

  function glasses(y: number, z: number, sunglasses: boolean) {
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.222, 0.025, 10, 48),
        ink,
      );
      ring.position.set(side * 0.25, y, z);
      ring.scale.y = sunglasses ? 1 : 1.13;
      ring.castShadow = true;
      body.add(ring);
      if (sunglasses) {
        ellipsoid(body, ink, [side * 0.25, y, z], [0.222, 0.222, 0.045]);
        const sheen = material("#3e3d50", 0.22);
        ellipsoid(
          body,
          sheen,
          [side * 0.25 - 0.06, y + 0.065, z + 0.045],
          [0.066, 0.02, 0.005],
        ).rotation.z = -0.55;
      } else {
        stroke(
          [
            new THREE.Vector3(side * 0.25 - 0.092, y + 0.004, z - 0.018),
            new THREE.Vector3(side * 0.25, y - 0.073, z - 0.01),
            new THREE.Vector3(side * 0.25 + 0.092, y + 0.004, z - 0.018),
          ],
          0.019,
        );
      }
      stroke(
        [
          new THREE.Vector3(side * 0.47, y + 0.02, z),
          new THREE.Vector3(side * 0.57, y + 0.05, z - 0.08),
          new THREE.Vector3(side * 0.59, y + 0.04, 0),
        ],
        0.023,
      );
    }
    stroke(
      [
        new THREE.Vector3(-0.045, y + 0.03, z),
        new THREE.Vector3(0, y + 0.049, z + 0.012),
        new THREE.Vector3(0.045, y + 0.03, z),
      ],
      0.025,
    );
  }

  if (kind === "blue-dot") {
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, 0.4);
    shape.bezierCurveTo(-0.78, 0.48, -0.68, 1.14, -0.45, 1.39);
    shape.bezierCurveTo(-0.23, 1.69, 0.32, 1.69, 0.48, 1.36);
    shape.bezierCurveTo(0.58, 1.18, 0.44, 1.11, 0.49, 1.01);
    shape.bezierCurveTo(0.78, 0.73, 0.68, 0.42, 0.47, 0.39);
    shape.quadraticCurveTo(0, 0.3, -0.5, 0.4);
    outline(shape, skin, 0.46, 0.12);
    eyes(1.11, 0.37, 0.21);
    const beret = new THREE.Group();
    beret.position.set(-0.07, 1.57, 0);
    beret.rotation.z = 0.15;
    body.add(beret);
    ellipsoid(beret, ink, [0, 0, 0], [0.54, 0.115, 0.34]);
    ellipsoid(beret, ink, [-0.045, 0.105, -0.01], [0.61, 0.195, 0.36]);
    ellipsoid(beret, ink, [-0.06, 0.3, -0.025], [0.069, 0.076, 0.06]);
  } else if (kind === "frog-dot") {
    ellipsoid(body, skin, [0, 0.91, 0], [0.66, 0.61, 0.4]);
    for (const side of [-1, 1]) {
      ellipsoid(body, skin, [side * 0.31, 1.47, -0.01], [0.278, 0.32, 0.265]);
      ellipsoid(body, white, [side * 0.31, 1.5, 0.197], [0.187, 0.218, 0.112]);
      ellipsoid(
        body,
        ink,
        [side * 0.31 + 0.021, 1.493, 0.29],
        [0.105, 0.135, 0.065],
      );
      ellipsoid(
        body,
        white,
        [side * 0.31 - 0.008, 1.545, 0.346],
        [0.027, 0.033, 0.012],
      );
      ellipsoid(
        body,
        material("#91bf2f"),
        [side * 0.2, 1.1, 0.373],
        [0.022, 0.016, 0.009],
      );
    }
    stroke(
      [
        new THREE.Vector3(-0.17, 0.9, 0.395),
        new THREE.Vector3(0, 0.84, 0.411),
        new THREE.Vector3(0.17, 0.9, 0.395),
      ],
      0.014,
      material("#52721e"),
    );
  } else if (kind === "yellow-dot") {
    const shape = new THREE.Shape();
    shape.moveTo(-0.58, 0.39);
    shape.quadraticCurveTo(-0.7, 0.41, -0.61, 0.62);
    shape.lineTo(-0.25, 1.43);
    shape.bezierCurveTo(-0.15, 1.7, 0.15, 1.7, 0.26, 1.43);
    shape.lineTo(0.61, 0.62);
    shape.quadraticCurveTo(0.73, 0.38, 0.48, 0.37);
    shape.quadraticCurveTo(0, 0.32, -0.58, 0.39);
    outline(shape, skin, 0.43, 0.12);
    glasses(1.03, 0.36, false);
  } else if (kind === "pink-dot") {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.4);
    shape.bezierCurveTo(-0.19, 0.49, -0.69, 0.94, -0.69, 1.27);
    shape.bezierCurveTo(-0.69, 1.68, -0.22, 1.79, 0, 1.44);
    shape.bezierCurveTo(0.25, 1.8, 0.69, 1.67, 0.69, 1.28);
    shape.bezierCurveTo(0.69, 0.91, 0.22, 0.52, 0, 0.4);
    outline(shape, skin, 0.34, 0.12);
    glasses(1.11, 0.325, true);
  } else if (kind === "purple-dot") {
    const shape = new THREE.Shape();
    shape.moveTo(-0.61, 0.47);
    shape.lineTo(-0.58, 1.01);
    shape.bezierCurveTo(-0.58, 1.86, 0.56, 1.86, 0.58, 1.01);
    shape.lineTo(0.62, 0.46);
    shape.quadraticCurveTo(0.57, 0.32, 0.43, 0.44);
    shape.quadraticCurveTo(0.29, 0.57, 0.15, 0.43);
    shape.quadraticCurveTo(0, 0.29, -0.15, 0.43);
    shape.quadraticCurveTo(-0.29, 0.56, -0.42, 0.44);
    shape.quadraticCurveTo(-0.58, 0.31, -0.61, 0.47);
    outline(shape, skin, 0.42, 0.12);
    eyes(1.15, 0.34, 0.2);
  } else {
    // Preserve the reference's asymmetric L/heart outline, including its flat base.
    const shape = new THREE.Shape();
    shape.moveTo(-0.61, 0.39);
    shape.lineTo(0.29, 0.39);
    shape.bezierCurveTo(0.88, 0.39, 0.92, 1.2, 0.34, 1.23);
    shape.lineTo(0.1, 1.23);
    shape.lineTo(0.1, 1.45);
    shape.bezierCurveTo(0.1, 2.03, -0.61, 2.03, -0.61, 1.45);
    shape.closePath();
    const gradient = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.42,
      metalness: 0.02,
    });
    // Sample the ramp per pixel: vertex colors produce diagonal bands on large cap triangles.
    const ramp = ["#7472ff", "#bd66f3", "#f64fb4", "#ff444f", "#ff7900"].map(
      (hex) => {
        const color = new THREE.Color(hex);
        return `vec3(${color.r.toFixed(6)}, ${color.g.toFixed(6)}, ${color.b.toFixed(6)})`;
      },
    );
    gradient.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vMascotHeight;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvMascotHeight = position.y + position.x * 0.16;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vMascotHeight;",
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec3 mascotColor = mix(${ramp[0]}, ${ramp[1]}, smoothstep(0.32, 0.67, vMascotHeight));
          mascotColor = mix(mascotColor, ${ramp[2]}, smoothstep(0.67, 1.00, vMascotHeight));
          mascotColor = mix(mascotColor, ${ramp[3]}, smoothstep(1.00, 1.30, vMascotHeight));
          mascotColor = mix(mascotColor, ${ramp[4]}, smoothstep(1.30, 1.67, vMascotHeight));
          diffuseColor.rgb *= mascotColor;`,
        );
    };
    gradient.customProgramCacheKey = () => "lovable-gradient-v1";
    outline(shape, gradient, 0.38, 0.075);
    eyes(0.9, 0.283, 0.18);
  }

  const legs: THREE.Group[] = [];
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.265, 0.43, 0);
    group.add(leg);
    ellipsoid(leg, ink, [0, -0.145, 0], [0.054, 0.18, 0.055]);
    ellipsoid(leg, shoe, [0, -0.327, 0.064], [0.148, 0.103, 0.218]);
    legs.push(leg);

    const arm = new THREE.Group();
    arm.position.set(side * (kind === "pink-dot" ? 0.67 : 0.6), 0.91, 0);
    arm.rotation.z = side * 0.22;
    body.add(arm);
    ellipsoid(arm, skin, [side * 0.075, -0.12, 0], [0.091, 0.23, 0.095]);
    ellipsoid(arm, skin, [side * 0.095, -0.3, 0.015], [0.115, 0.12, 0.12]);
    arms.push(arm);
  }

  return {
    group,
    update(timeSeconds, walking = 0) {
      const amount = THREE.MathUtils.clamp(walking, 0, 1);
      const step = timeSeconds * 8.5;
      const stride = Math.sin(step) * amount;
      body.position.y =
        Math.abs(Math.cos(step)) * 0.046 * amount +
        Math.sin(timeSeconds * 2.2) * 0.014;
      body.rotation.z = stride * 0.038;
      body.rotation.x = amount * 0.045;
      legs[0].rotation.x = stride * 0.58;
      legs[1].rotation.x = -stride * 0.58;
      legs[0].position.y = 0.43 + Math.max(0, stride) * 0.075;
      legs[1].position.y = 0.43 + Math.max(0, -stride) * 0.075;
      arms[0].rotation.x = -stride * 0.4;
      arms[1].rotation.x = stride * 0.4;
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        for (const mat of Array.isArray(object.material)
          ? object.material
          : [object.material])
          materials.add(mat);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const mat of materials) mat.dispose();
      group.removeFromParent();
    },
  };
}
