import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { innerDiameter, tubeSectionArea, tubeVolume, tubeMass, validatePhysicalProperties } from '../src/model.ts';
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
  for (const m of computeFrame(p).members) assert.equal(m.outerDiameter, m.category === 'primary' ? 40 : 20);
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
  for (const input of [null, [], {}, { ...initialProject(), schemaVersion: 99 }, { ...initialProject(), name: '' }, { ...initialProject(), bracing: 'invalid' },
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

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${actual} ≈ ${expected}`);
}
const legacyCases = JSON.parse(readFileSync(new URL('./fixtures/legacy-v1.json', import.meta.url), 'utf8'));

test('new projects use V2 with the default walls and steel density', () => {
  const p = initialProject();
  assert.equal(p.schemaVersion, 2);
  assert.equal(p.params.primaryThickness, 1.6);
  assert.equal(p.params.secondaryThickness, 1.2);
  assert.equal(p.materialDensity, 7850);
});

test('each category inherits its diameter and wall across all bracing configurations', () => {
  for (const bracing of ['rear', 'front', 'both'] as Bracing[]) {
    const p = initialProject(); p.bracing = bracing;
    p.params.primaryDiameter = 40; p.params.primaryThickness = 2.5;
    p.params.secondaryDiameter = 22; p.params.secondaryThickness = 0.8;
    for (const m of computeFrame(p).members) {
      assert.equal(m.outerDiameter, m.category === 'primary' ? 40 : 22);
      assert.equal(m.wallThickness, m.category === 'primary' ? 2.5 : 0.8);
      close(m.innerDiameter, m.category === 'primary' ? 35 : 20.4);
      close(m.sectionArea, tubeSectionArea(m.outerDiameter, m.wallThickness));
      close(m.volume, m.sectionArea * m.length);
      close(m.estimatedMass, m.volume * 7850 / 1e9);
    }
  }
});

test('inner diameter subtracts two walls, in mm', () => {
  close(innerDiameter(31.8, 1.6), 28.6);
});
test('area of a 10 mm tube with 1 mm wall is 9π mm²', () => {
  close(tubeSectionArea(10, 1), 9 * Math.PI);
});
test('volume uses the complete centerline length and returns mm³', () => {
  close(tubeVolume(10, 1, 1000), 9000 * Math.PI);
  assert.equal(tubeVolume(10, 1, 0), 0);
});
test('mass converts mm³ to m³ before applying kg/m³ density', () => {
  close(tubeMass(10, 1, 1000, 7850), 0.07065 * Math.PI);
  assert.equal(tubeMass(10, 1, 0, 7850), 0);
});

test('frame mass equals member sums and category sums in every bracing configuration', () => {
  for (const bracing of ['rear', 'front', 'both'] as Bracing[]) {
    const f = computeFrame(movePoint({ ...initialProject(), bracing }, 'B_L', [-100, 420, 1250]));
    close(f.totalMass, f.members.reduce((s, m) => s + m.estimatedMass, 0));
    close(f.primaryMass, f.members.filter(m => m.category === 'primary').reduce((s, m) => s + m.estimatedMass, 0));
    close(f.secondaryMass, f.members.filter(m => m.category === 'secondary').reduce((s, m) => s + m.estimatedMass, 0));
    close(f.totalMass, f.primaryMass + f.secondaryMass);
    assert.ok(f.primaryMass > 0 && f.secondaryMass > 0);
  }
});

test('wall and density changes affect mass without moving points or changing external geometry', () => {
  const p = initialProject(), before = computeFrame(p);
  const denser = computeFrame({ ...p, materialDensity: p.materialDensity * 2 });
  close(denser.totalMass, before.totalMass * 2);
  const thicker = computeFrame({ ...p, params: { ...p.params, primaryThickness: 3 } });
  assert.ok(thicker.primaryMass > before.primaryMass);
  close(thicker.secondaryMass, before.secondaryMass);
  for (const f of [denser, thicker]) {
    assert.deepEqual(f.points, before.points);
    assert.deepEqual(f.bounds, before.bounds);
    assert.deepEqual(f.members.map(({ id, nodes, length, outerDiameter }) => ({ id, nodes, length, outerDiameter })),
      before.members.map(({ id, nodes, length, outerDiameter }) => ({ id, nodes, length, outerDiameter })));
  }
});

test('invalid sections are rejected by every pure formula including the equality boundary', () => {
  for (const [D, t] of [[10, 0], [10, -1], [10, 5], [10, 6], [10, NaN], [10, Infinity], [0, 1], [-10, 1], [Infinity, 1], [NaN, 1]]) {
    assert.throws(() => innerDiameter(D, t));
    assert.throws(() => tubeSectionArea(D, t));
    assert.throws(() => tubeVolume(D, t, 1000));
    assert.throws(() => tubeMass(D, t, 1000, 7850));
  }
  assert.ok(innerDiameter(10, 4.999) > 0);
  for (const length of [-1, NaN, Infinity]) assert.throws(() => tubeVolume(10, 1, length));
  for (const density of [0, -1, NaN, Infinity]) assert.throws(() => tubeMass(10, 1, 1000, density));
});

test('JSON rejects missing, nonfinite, nonpositive and excessive walls for both categories', () => {
  for (const key of ['primaryThickness', 'secondaryThickness'] as const) {
    for (const value of [undefined, null, '1.6', NaN, Infinity, 0, -1, 0.4, 5.1, 15.9, 20]) {
      assert.throws(() => parseProject({ ...initialProject(), params: { ...initialProject().params, [key]: value } }));
    }
    const p = initialProject();
    p.params[key] = p.params[key === 'primaryThickness' ? 'primaryDiameter' : 'secondaryDiameter'] / 2;
    assert.throws(() => validatePhysicalProperties(p));
    assert.throws(() => computeFrame(p));
  }
});

test('density is validated on import and at the model boundary', () => {
  for (const materialDensity of [undefined, null, '7850', 0, -1, NaN, Infinity, 30001]) {
    assert.throws(() => parseProject({ ...initialProject(), materialDensity }));
  }
  for (const materialDensity of [0, NaN, Infinity, 30001]) {
    assert.throws(() => computeFrame({ ...initialProject(), materialDensity }));
  }
});

test('real V1 fixtures migrate with identical geometry, independent offsets and bracing', () => {
  // Captured from the unmodified V1 model before adding physical properties.
  for (const { project, geometry } of legacyCases) {
    const original = structuredClone(project), loaded = parseProject(project), f = computeFrame(loaded);
    assert.equal(loaded.schemaVersion, 2);
    assert.equal(loaded.params.primaryThickness, 1.6);
    assert.equal(loaded.params.secondaryThickness, 1.2);
    assert.equal(loaded.materialDensity, 7850);
    assert.deepEqual(loaded.offsets, project.offsets);
    assert.equal(loaded.symmetry, false);
    assert.deepEqual(f.points, geometry.points);
    assert.deepEqual(f.bounds, geometry.bounds);
    assert.equal(f.totalLength, geometry.totalLength);
    assert.deepEqual(f.members.map(({ id, label, category, nodes, outerDiameter, length }) =>
      ({ id, label, category, nodes, diameter: outerDiameter, length })), geometry.members);
    assert.deepEqual(project, original, 'migration must not mutate the supplied object');
  }
});

test('V1 symmetric saves also migrate and reserialize as V2', () => {
  const legacy = { ...legacyCases[0].project, symmetry: true };
  const migrated = parseProject(legacy);
  assertConnected(migrated);
  assert.equal(JSON.parse(serializeProject(migrated)).schemaVersion, 2);
});

test('V2 roundtrip preserves physical inputs and serializes no derived properties', () => {
  const p = movePoint(setSymmetry(initialProject(), false), 'C_R', [830, -390, 1200]);
  p.params.primaryThickness = 2.3; p.params.secondaryThickness = 1.9; p.materialDensity = 2700;
  const json = serializeProject(p), raw = JSON.parse(json), loaded = parseProject(raw);
  assert.deepEqual(loaded, JSON.parse(JSON.stringify(p)), 'JSON normalizes negative zero');
  assert.deepEqual(computeFrame(loaded), computeFrame(p));
  assert.deepEqual(Object.keys(raw).sort(), ['schemaVersion', 'materialDensity', 'name', 'params', 'bracing', 'symmetry', 'offsets'].sort());
  for (const field of ['members', 'totalMass', 'sectionArea', 'volume', 'estimatedMass', 'innerDiameter']) assert.equal(json.includes(`"${field}"`), false);
});
