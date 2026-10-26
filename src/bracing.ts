import { add, baseAnchors, distance, lerp } from './model';
import type { Project, Vec3 } from './model';
export type FrontPart = 'upper' | 'lower';
export type BraceMetric = 'length' | 'angle';
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const sub = (a: Vec3, b: Vec3) => a.map((n, i) => n - b[i]) as Vec3;

/** Inverse edits use the left side; right-side results follow its own anchors/offsets. */
function geometry(project: Project, part: FrontPart) {
  const base = baseAnchors(project.params);
  const at = (id: string) => add(base[id], project.offsets[id] ?? [0, 0, 0]);
  const fixed = lerp(at('S_L'), at('D_L'), project.params.frontSidePosition / 100);
  const a = at(part === 'upper' ? 'C_L' : 'A_L'), b = at(part === 'upper' ? 'D_L' : 'F_L');
  const key = part === 'upper' ? 'frontUpperPosition' : 'frontFloorPosition';
  return { fixed, a, b, key, t: project.params[key] / 100 } as const;
}
export function frontBraceMeasure(project: Project, part: FrontPart) {
  const { fixed, a, b, t } = geometry(project, part), tip = lerp(a, b, t);
  const length = distance(fixed, tip);
  return { length, angle: length ? Math.asin(Math.min(1, Math.abs(tip[2] - fixed[2]) / length)) * 180 / Math.PI : 0 };
}
function candidates(project: Project, part: FrontPart, metric: BraceMetric) {
  const g = geometry(project, part), u = sub(g.a, g.fixed), v = sub(g.b, g.a);
  const aa = dot(v, v), bb = 2 * dot(u, v), cc = dot(u, u);
  const result = [.05, .95];
  const critical = metric === 'length' ? -bb / (2 * aa)
    : (u[2] * bb / 2 - v[2] * cc) / (v[2] * bb / 2 - u[2] * aa);
  if (Number.isFinite(critical) && critical > .05 && critical < .95) result.push(critical);
  if (metric === 'angle' && v[2]) {
    const zero = -u[2] / v[2]; if (zero > .05 && zero < .95) result.push(zero);
  }
  const measure = (t: number) => {
    const tip = lerp(g.a, g.b, t), length = distance(g.fixed, tip);
    return metric === 'length' ? length : length ? Math.asin(Math.min(1, Math.abs(tip[2] - g.fixed[2]) / length)) * 180 / Math.PI : 0;
  };
  return { ...g, aa, bb, cc, u, v, result, measure };
}
export function frontBraceRange(project: Project, part: FrontPart, metric: BraceMetric) {
  const c = candidates(project, part, metric), values = c.result.map(c.measure);
  return { min: Math.min(...values), max: Math.max(...values) };
}
export function setFrontBraceMetric(project: Project, part: FrontPart, metric: BraceMetric, requested: number): Project {
  if (!Number.isFinite(requested)) throw new Error('Medida de travamento inválida.');
  const c = candidates(project, part, metric), range = frontBraceRange(project, part, metric);
  const target = Math.max(range.min, Math.min(range.max, requested));
  const sine2 = Math.sin(target * Math.PI / 180) ** 2;
  const a = metric === 'length' ? c.aa : c.v[2] ** 2 - sine2 * c.aa;
  const b = metric === 'length' ? c.bb : 2 * c.u[2] * c.v[2] - sine2 * c.bb;
  const d = metric === 'length' ? c.cc - target ** 2 : c.u[2] ** 2 - sine2 * c.cc;
  let roots: number[] = [];
  if (Math.abs(a) < 1e-9) { if (Math.abs(b) > 1e-9) roots = [-d / b]; }
  else {
    const discriminant = b * b - 4 * a * d;
    if (discriminant >= -1e-5) {
      const sqrt = Math.sqrt(Math.max(0, discriminant));
      roots = [(-b + sqrt) / (2 * a), (-b - sqrt) / (2 * a)];
    }
  }
  roots = roots.filter(t => t >= .05 - 1e-9 && t <= .95 + 1e-9 && Math.abs(c.measure(t) - target) < 1e-4);
  // Prefer the solution nearest the current support when two positions have the same metric.
  const t = roots.length ? roots.sort((a, b) => Math.abs(a - c.t) - Math.abs(b - c.t))[0]
    : [...c.result, c.t].sort((a, b) => Math.abs(c.measure(a) - target) - Math.abs(c.measure(b) - target))[0];
  return { ...project, params: { ...project.params, [c.key]: Math.max(5, Math.min(95, t * 100)) } };
}
