import { overviewView } from '../levels/overview.js';
import { level1View } from '../levels/level1.js';
import { level2View } from '../levels/level2.js';
import { level3View } from '../levels/level3.js';
import { level4View } from '../levels/level4.js';

export const routes = [
  overviewView,
  level1View,
  level2View,
  level3View,
  level4View,
];

export const routesById = Object.fromEntries(routes.map((route) => [route.id, route]));

export const sectionToRoute = new Map(
  routes.flatMap((route) => route.sections.map((section) => [section.id, route.id]))
);
