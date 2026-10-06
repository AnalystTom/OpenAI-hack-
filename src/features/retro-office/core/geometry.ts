import { CANVAS_H, CANVAS_W, SCALE } from "./constants";
import type { FurnitureItem } from "./types";

export const toWorld = (cx: number, cy: number): [number, number, number] => [
  cx * SCALE - CANVAS_W * SCALE * 0.5,
  0,
  cy * SCALE - CANVAS_H * SCALE * 0.5,
];

export const resolveItemTypeKey = (item: FurnitureItem) =>
  item.type === "couch" && item.vertical ? "couch_v" : item.type;

export const ITEM_FOOTPRINT: Record<string, [number, number]> = {
  desk_cubicle: [100, 55],
  chair: [24, 24],
  round_table: [120, 120],
  executive_desk: [130, 65],
  couch: [100, 40],
  couch_v: [40, 80],
  bookshelf: [80, 120],
  plant: [24, 24],
  beanbag: [40, 40],
  pingpong: [100, 60],
  table_rect: [80, 40],
  coffee_machine: [32, 34],
  fridge: [40, 80],
  water_cooler: [20, 54],
  atm: [42, 38],
  sms_booth: [58, 54],
  phone_booth: [78, 72],
  whiteboard: [10, 60],
  cabinet: [200, 40],
  computer: [30, 20],
  lamp: [30, 30],
  printer: [40, 35],
  stove: [40, 40],
  microwave: [30, 20],
  wall_cabinet: [80, 20],
  sink: [40, 40],
  vending: [40, 60],
  server_rack: [45, 90],
  server_terminal: [42, 34],
  qa_terminal: [54, 38],
  kanban_board: [130, 65],
  device_rack: [70, 36],
  test_bench: [90, 42],
  treadmill: [70, 35],
  weight_bench: [90, 45],
  dumbbell_rack: [80, 28],
  exercise_bike: [45, 65],
  punching_bag: [28, 28],
  jukebox: [60, 40],
  rowing_machine: [90, 34],
  kettlebell_rack: [70, 26],
  yoga_mat: [70, 30],
  keyboard: [30, 14],
  mouse: [16, 10],
  trash: [20, 20],
  mug: [14, 14],
  clock: [20, 20],
};

export const getItemBaseSize = (item: FurnitureItem) => {
  if (item.r !== undefined) {
    return { width: item.r * 2, height: item.r * 2 };
  }
  const [defaultWidth, defaultHeight] = ITEM_FOOTPRINT[
    resolveItemTypeKey(item)
  ] ?? [item.w ?? 40, item.h ?? 40];
  return {
    width: item.w ?? defaultWidth,
    height: item.h ?? defaultHeight,
  };
};

export const FURNITURE_ROTATION: Record<string, number> = {
  couch: Math.PI,
  couch_v: Math.PI / 2,
  executive_desk: -Math.PI / 2,
  whiteboard: Math.PI / 2,
};

export const getItemRotationRadians = (item: FurnitureItem) =>
  ((item.facing ?? 0) * Math.PI) / 180 +
  (FURNITURE_ROTATION[resolveItemTypeKey(item)] ?? 0);
