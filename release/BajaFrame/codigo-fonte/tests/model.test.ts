import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANCHORS, PARAMS, computeFrame, initialProject, movePoint, setSymmetry, parseProject, serializeProject, distance, lerp, mirror } from '../src/model.ts';
import type { Bracing, ParamKey, Project, Vec3 } from '../src/model.ts';

function assertConnected(project: Project) {
  const frame = computeFrame(project);
  const ids = frame.members.map(m => m.id);
  assert.equal(ids.length, new Set(ids).size, 'member identifiers are unique');
  const neighbours = new Map<string, Set<string>>();
  for (const m of frame.members) {
    assert.ok(Number.isFinite(m.length) && m.length > 0, `${m.id} has a positive length`);
    for (const id of m.nodes) {
      assert.ok(frame.points[id], `member ${m.id} uses existing point ${id}`);
      assert.ok(frame.points[id].position.every(Number.isFinite));
      if (!neighbours.has(id)) neighbours.set(id, new Set());
    }
    m.nodes.slice(1).forEach((id, i) => { neighbours.get(id)!.add(m.nodes[i]); neighbours.get(m.nodes[i])!.add(id); });
  }
  const visited = new Set<string>(), stack = ['A_L'];
  while (stack.length) { const id = stack.pop()!; if (visited.has(id)) continue; visited.add(id); stack.push(...neighbours.get(id)!); }
  assert.equal(visited.size, Object.keys(frame.points).length, 'all named points belong to one connected graph');
  if (project.symmetry) for (const [id, p] of Object.entries(frame.points)) {
    if (id.endsWith('_L')) assert.deepEqual(frame.points[id.replace(/_L$/, '_R')].position, mirror(p.position));
  }
  return frame;
}

test('all three bracing configurations form a connected, symmetric frame', () => {
  for (const bracing of ['rear', 'front', 'both'] as Bracing[]) {
    const f = assertConnected({ ...initialProject(), bracing });
    assert.equal(f.members.some(m => m.id === 'FABMID_L'), bracing !== 'front');
    assert.equal(f.members.some(m => m.id === 'FAB_FRONT_LOW_L'), bracing !== 'rear');
    assert.equal(Boolean(f.points.R_L), bracing !== 'front');
  }
});
test('all parameter extrema preserve connections and finite geometry', () => {
  for (const key of Object.keys(PARAMS) as ParamKey[]) for (const value of [PARAMS[key].min, PARAMS[key].max]) {
    for (const bracing of ['rear', 'front', 'both'] as Bracing[]) {
      const p = initialProject(); p.bracing = bracing; p.params[key] = value; assertConnected(p);
    }
  }
});
test('seeded combinations of parameters preserve shared point connections', () => {
  let seed = 16192026;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let i = 0; i < 120; i++) {
    const p = initialProject(); p.bracing = (['rear', 'front', 'both'] as Bracing[])[i % 3];
    for (const key of Object.keys(PARAMS) as ParamKey[]) p.params[key] = PARAMS[key].min + random() * (PARAMS[key].max - PARAMS[key].min);
    assertConnected(p);
  }
});
test('dragging either side mirrors the position and keeps all attached members connected', () => {
  for (const side of ['L', 'R']) for (const anchor of ANCHORS) {
    const p = initialProject(), id = `${anchor}_${side}`;
    const before = computeFrame(p).points[id].position;
    const moved = movePoint(p, id, [before[0] + 80, before[1] + (side === 'L' ? 30 : -30), before[2] + 40]);
    const f = assertConnected(moved);
    assert.ok(distance(f.points[id].position, before) > 80);
    assert.deepEqual(f.points[`${anchor}_R`].position, mirror(f.points[`${anchor}_L`].position));
    assert.deepEqual(p.offsets, {}, 'original project is not mutated');
  }
});
test('independent editing and re-enabling symmetry use the left side as reference', () => {
  let p = setSymmetry(initialProject(), false);
  const old = computeFrame(p).points.A_L.position;
  p = movePoint(p, 'A_R', [100, -500, 50]);
  assert.deepEqual(computeFrame(p).points.A_L.position, old);
  assert.deepEqual(computeFrame(setSymmetry(p, true)).points.A_R.position, mirror(old));
});
test('disabling symmetry preserves an existing symmetric edit', () => {
  const p = movePoint(initialProject(), 'B_L', [0, 420, 1280]);
  assert.deepEqual(computeFrame(setSymmetry(p, false)).points.B_R.position, computeFrame(p).points.B_R.position);
});
test('derived points follow their supporting members after free anchor moves', () => {
  let p = { ...initialProject(), bracing: 'both' as Bracing };
  p = movePoint(p, 'F_L', [1450, 320, 200]); p = movePoint(p, 'S_L', [10, 420, 480]);
  const f = assertConnected(p), at = (id: string) => f.points[id].position;
  assert.deepEqual(at('I_L'), lerp(at('A_L'), at('F_L'), p.params.floorPosition / 100));
  assert.deepEqual(at('H_L'), lerp(at('S_L'), at('B_L'), .46));
  assert.deepEqual(at('P_L'), lerp(at('S_L'), at('D_L'), .62));
  assert.deepEqual(at('U_L'), lerp(at('A_L'), at('I_L'), .60));
});
test('different tube categories retain independent diameters', () => {
  const p = initialProject(); p.params.primaryDiameter = 40; p.params.secondaryDiameter = 20;
  for (const m of computeFrame(p).members) assert.equal(m.diameter, m.category === 'primary' ? 40 : 20);
});
test('derived points cannot be detached using the free-move function', () => {
  const p = initialProject(); assert.strictEqual(movePoint(p, 'I_L', [500, 0, 500]), p);
});
test('point inputs enforce coordinate bounds and correct side', () => {
  const f = computeFrame(movePoint(initialProject(), 'A_L', [99999, -99999, -50]));
  assert.deepEqual(f.points.A_L.position, [4000, 40, 0]);
  const p = initialProject(); assert.strictEqual(movePoint(p, 'B_L', [NaN, 0, 0]), p);
});
test('saving and reloading preserves geometry and project state', () => {
  let p = movePoint(initialProject(), 'C_R', [830, -390, 1200]);
  p = { ...p, bracing: 'both', name: 'Configuração da equipe' };
  const loaded = parseProject(JSON.parse(serializeProject(p)));
  assert.deepEqual(computeFrame(loaded), computeFrame(p));
  assert.equal(loaded.name, p.name);
});
test('invalid imports are rejected before changing a project', () => {
  for (const input of [null, [], {}, { ...initialProject(), schemaVersion: 2 }, { ...initialProject(), name: '' }, { ...initialProject(), bracing: 'invalid' },
    { ...initialProject(), params: { ...initialProject().params, rrhHeight: -10 } },
    { ...initialProject(), params: { ...initialProject().params, baseWidth: NaN } },
    { ...initialProject(), offsets: { 'I_L': [0, 1, 2] } },
    { ...initialProject(), offsets: { 'A_L': [0, 'evil', 2] } },
    { ...initialProject(), offsets: { 'A_L': [0, 2] } },
    { ...initialProject(), offsets: { 'A_L': [Infinity, 0, 0] } },
  ]) assert.throws(() => parseProject(input));
});
test('unknown imported properties are dropped', () => {
  const loaded = parseProject({ ...initialProject(), executable: 'untrusted', params: { ...initialProject().params, extra: 77 } });
  assert.equal('executable' in loaded, false); assert.equal('extra' in loaded.params, false);
});
test('overall dimensions and lengths are calculated from actual modified centerlines', () => {
  const p = initialProject(), f = computeFrame(p);
  assert.equal(f.bounds.size[2], p.params.rrhHeight);
  assert.equal(f.bounds.size[1], Math.max(p.params.topWidth, p.params.simWidth));
  const changed = computeFrame(movePoint(p, 'B_L', [0, 500, 1450]));
  assert.equal(changed.bounds.size[2], 1450); assert.equal(changed.bounds.size[1], 1000);
  const manual = changed.members.reduce((sum, m) => sum + m.nodes.slice(1).reduce((sub, id, i) => sub + distance(changed.points[m.nodes[i]].position, changed.points[id].position), 0), 0);
  assert.equal(changed.totalLength, manual);
});
test('local edits survive base parameter changes as offsets', () => {
  const p = movePoint(initialProject(), 'A_L', [100, 350, 20]); p.params.baseWidth += 100;
  assert.deepEqual(computeFrame(p).points.A_L.position, [100, 400, 20]);
});
test('coincident points are reported without invalid geometry', () => {
  const p = initialProject(); const target = computeFrame(p).points.A_L.position;
  const f = computeFrame(movePoint(p, 'S_L', target));
  assert.ok(f.warnings.some(w => w.includes('coincidentes')));
  assert.ok(f.members.every(m => Number.isFinite(m.length)));
});
