import type { FramePoint, Member, Vec3 } from './model';

const sub = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v - b[i]) as Vec3;
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, i) => s + v * b[i], 0);
const at = (a: Vec3, d: Vec3, t: number): Vec3 => a.map((v, i) => v + t * d[i]) as Vec3;
const norm = (a: Vec3) => Math.hypot(...a);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const EPS = 1e-5; // mm: only genuine centerline meetings are connected

/** Closest locations on two finite segments, including parallel/degenerate cases. */
export function closestSegments(a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
  const u = sub(b, a), v = sub(d, c), w = sub(a, c);
  const uu = dot(u, u), vv = dot(v, v), uv = dot(u, v), uw = dot(u, w), vw = dot(v, w);
  let s = 0, t = 0;
  if (uu < EPS ** 2) t = vv ? clamp(vw / vv) : 0;
  else if (vv < EPS ** 2) s = clamp(-uw / uu);
  else {
    const denominator = uu * vv - uv * uv;
    s = denominator > 1e-12 * uu * vv ? clamp((uv * vw - uw * vv) / denominator) : 0;
    t = (uv * s + vw) / vv;
    if (t < 0) { t = 0; s = clamp(-uw / uu); }
    else if (t > 1) { t = 1; s = clamp((uv - uw) / uu); }
  }
  const first = at(a, u, s), second = at(c, v, t);
  return { first, second, s, t, distance: norm(sub(first, second)) };
}

export interface Interference { members: [string, string]; kind: 'overlap' | 'clearance'; gap: number }
export interface Joint { pointId: string; members: string[]; hostMember: string }
type Segment = { member: Member; index: number; a: string; b: string; cuts: { t: number; id: string }[] };

/** Splits real crossings into shared nodes. Does not move user points or recalculate tube mass. */
export function connectMembers(points: Record<string, FramePoint>, members: Member[]) {
  const segments: Segment[] = members.flatMap(member => member.nodes.slice(1).map((b, i) =>
    ({ member, index: i, a: member.nodes[i], b, cuts: [] })));
  const candidates: (Interference & { locations: Vec3[]; reach: number })[] = [];
  const position = (id: string) => points[id].position;
  let sequence = 0;
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const x = segments[i], y = segments[j];
    if (x.member === y.member) continue;
    const a = position(x.a), b = position(x.b), c = position(y.a), d = position(y.b);
    const u = sub(b, a), v = sub(d, c), lu = norm(u), lv = norm(v);
    if (lu < EPS || lv < EPS) continue;
    const closest = closestSegments(a, b, c, d);
    const parallel = Math.abs(dot(u, v) / (lu * lv)) > 1 - 1e-10;
    const projection = [dot(sub(c, a), u) / lu, dot(sub(d, a), u) / lu].sort((a, b) => a - b);
    const overlap = parallel && closest.distance < EPS && Math.min(lu, projection[1]) - Math.max(0, projection[0]) > EPS;
    if (overlap) {
      candidates.push({ members: [x.member.id, y.member.id], kind: 'overlap', gap: -Math.min(x.member.outerDiameter, y.member.outerDiameter), locations: [], reach: 0 });
      continue;
    }
    if ([x.a, x.b].some(id => id === y.a || id === y.b)) continue;
    if (closest.distance < EPS && !parallel) {
      // Reuse named endpoints when possible; coordinates of an existing anchor never change.
      let id = Object.keys(points).find(id => norm(sub(position(id), closest.first)) < EPS);
      if (!id) {
        id = `N${++sequence}`;
        points[id] = { id, position: closest.first, editable: false, description: 'Encontro compartilhado de tubos' };
      }
      x.cuts.push({ t: closest.s, id }); y.cuts.push({ t: closest.t, id });
    } else if (closest.distance < (x.member.outerDiameter + y.member.outerDiameter) / 2 - EPS) {
      const gap = closest.distance - (x.member.outerDiameter + y.member.outerDiameter) / 2;
      const sine = Math.sqrt(Math.max(0, 1 - (dot(u, v) / (lu * lv)) ** 2));
      const reach = (x.member.outerDiameter + y.member.outerDiameter) / (2 * Math.max(.05, sine));
      candidates.push({ members: [x.member.id, y.member.id], kind: 'clearance', gap, locations: [closest.first, closest.second], reach });
    }
  }
  for (const member of members) {
    const path: string[] = [];
    for (const s of segments.filter(s => s.member === member)) {
      const cuts = [{ t: 0, id: s.a }, ...s.cuts, { t: 1, id: s.b }].sort((a, b) => a.t - b.t);
      for (const cut of cuts) if (!path.length || norm(sub(position(path.at(-1)!), position(cut.id))) > EPS) path.push(cut.id);
    }
    member.nodes = path;
  }
  const joints: Joint[] = [];
  for (const id of Object.keys(points)) {
    const attached = members.filter(m => m.nodes.includes(id));
    // Only internal meetings require a through member; ordinary end-to-end joints remain unchanged.
    const through = attached.filter(m => m.nodes.indexOf(id) > 0 && m.nodes.indexOf(id) < m.nodes.length - 1);
    if (attached.length < 2 || !through.length) continue;
    through.sort((a, b) => (a.category === 'primary' ? 0 : 1) - (b.category === 'primary' ? 0 : 1) || members.indexOf(a) - members.indexOf(b));
    joints.push({ pointId: id, members: attached.map(m => m.id), hostMember: through[0].id });
  }
  const issues = new Map<string, Interference>();
  for (const { locations, reach, ...issue } of candidates) {
    const a = members.find(m => m.id === issue.members[0])!, b = members.find(m => m.id === issue.members[1])!;
    // Segmentation can put a witness just beside an existing joint. Its local tube contact is intentional.
    const atJoint = issue.kind === 'clearance' && a.nodes.some(id => b.nodes.includes(id) && locations.every(p => norm(sub(p, position(id))) <= reach + EPS));
    if (atJoint) continue;
    const key = [...issue.members].sort().join('|'), previous = issues.get(key);
    if (!previous || issue.kind === 'overlap' || previous.kind !== 'overlap' && issue.gap < previous.gap) issues.set(key, issue);
  }
  return { joints, interferences: [...issues.values()] };
}

/** Visible centerline spans, used to omit pieces wholly inside receiving tubes. */
export function renderSegments(points: Record<string, FramePoint>, members: Member[], joints: Joint[], member: Member) {
  const trim = (id: string, other: string) => {
    const joint = joints.find(j => j.pointId === id);
    if (!joint || joint.hostMember === member.id) return 0;
    const host = members.find(m => m.id === joint.hostMember)!;
    const index = host.nodes.indexOf(id), p = points[id].position;
    const axis = sub(points[other].position, p), length = norm(axis);
    if (length < EPS) return 0;
    return Math.max(...[host.nodes[index - 1], host.nodes[index + 1]].map(neighbour => {
      const direction = sub(points[neighbour].position, p);
      const cosine = Math.abs(dot(axis, direction) / (length * norm(direction)));
      const sine = Math.sqrt(Math.max(0, 1 - cosine ** 2));
      return sine < 1e-5 ? length : host.outerDiameter / (2 * sine);
    }));
  };
  return member.nodes.slice(1).flatMap((id, i) => {
    const a = points[member.nodes[i]].position, b = points[id].position, d = sub(b, a), length = norm(d);
    const start = trim(member.nodes[i], id), end = trim(id, member.nodes[i]);
    if (length < EPS || start + end >= length) return [];
    return [{ from: member.nodes[i], to: id, a: at(a, d, start / length), b: at(a, d, 1 - end / length) }];
  });
}

/** Distance along an end-ring vertex until it leaves the receiving tube's outer surface. */
export function junctionInset(points: Record<string, FramePoint>, members: Member[], joints: Joint[], member: Member,
  node: string, radial: Vec3, inward: Vec3): number {
  const joint = joints.find(j => j.pointId === node);
  if (!joint || joint.hostMember === member.id) return 0;
  const host = members.find(m => m.id === joint.hostMember)!;
  const index = host.nodes.indexOf(node), origin = points[node].position;
  return Math.max(...[host.nodes[index - 1], host.nodes[index + 1]].map(neighbour => {
    const delta = sub(points[neighbour].position, origin), size = norm(delta);
    if (size < EPS) return 0;
    const axis = delta.map(v => v / size) as Vec3;
    const q = sub(radial, axis.map(v => v * dot(radial, axis)) as Vec3);
    const w = sub(inward, axis.map(v => v * dot(inward, axis)) as Vec3);
    const a = dot(w, w), b = 2 * dot(q, w), c = dot(q, q) - (host.outerDiameter / 2) ** 2;
    const discriminant = b * b - 4 * a * c;
    if (a < 1e-10 || discriminant < 0) return 0;
    return Math.max(0, (-b + Math.sqrt(discriminant)) / (2 * a));
  }));
}
