import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { roomCameraFrame } from "../src/components/office/camera.ts";
import { officeLayout } from "../src/officeBehavior.ts";

test("overview and top view keep the room inside desktop and phone viewports", () => {
  for (const total of [0, 12, 20, 50]) {
    const layout = officeLayout(total);
    for (const aspect of [0.55, 1, 1.5, 2.4]) {
      for (const view of ["overview", "overhead"]) {
        const frame = roomCameraFrame(total, aspect, 38, view);
        const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 1000);
        camera.position.copy(frame.position);
        camera.lookAt(frame.target);
        camera.updateMatrixWorld();
        for (const x of [-layout.width / 2, layout.width / 2]) {
          for (const y of [-0.65, 4.9]) {
            for (const z of [-layout.depth / 2, layout.depth / 2]) {
              const point = new THREE.Vector3(layout.x + x, y, layout.z + z).project(camera);
              assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1,
                `${total} residents, aspect ${aspect}, ${view}: every corner must be visible`);
            }
          }
        }
      }
    }
  }
});
