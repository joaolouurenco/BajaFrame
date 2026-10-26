import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addExtraTube, computeFrame, distance, initialProject, movePoint, parseProject, serializeProject, setBracingEnabled, setRearEnabled } from '../src/model.ts';
import type { FramePoint, Member, Project, Vec3 } from '../src/model.ts';
import { closestSegments, connectMembers, junctionInset, renderSegments } from '../src/connections.ts';
import { frontBraceMeasure, frontBraceRange, setFrontBraceMetric } from '../src/bracing.ts';

const close = (a: number, b: number, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
const front = () => setBracingEnabled(setBracingEnabled(initialProject(), 'rear', false), 'front', true);

test('front-only bracing retains independently editable post-firewall structure', () => {
  const p = front();
  assert.equal(p.bracing, 'front'); assert.equal(p.rearEnabled, true);
  const f = computeFrame(p);
  assert.ok(f.points.R_L); assert.ok(f.members.some(m => m.id === 'FABMID_L'));
  assert.ok(!f.members.some(m => m.id === 'FABUP_L')); assert.equal(f.members.length, 32);
  const changed = computeFrame({ ...p, params: { ...p.params, rearLength: 800, rearHeight: 700, rearWidth: 900 } });
  assert.notDeepEqual(changed.points.R_L.position, f.points.R_L.position);
  assert.equal(changed.points.R_L.position[1], 450);
  assert.deepEqual(changed.points.P_L.position, f.points.P_L.position);
});

test('rear toggles preserve offsets and settings, disable dependent rear braces only', () => {
  let p = setBracingEnabled(initialProject(), 'front', true);
  p = movePoint(p, 'R_L', [-900, 400, 700]);
  const before = computeFrame(p).points.R_L.position;
  const hidden = setRearEnabled(p, false);
  assert.equal(hidden.bracing, 'front'); assert.ok(!computeFrame(hidden).points.R_L);
  const restored = setRearEnabled(hidden, true);
  assert.equal(restored.bracing, 'front'); assert.deepEqual(computeFrame(restored).points.R_L.position, before);
  assert.equal(setBracingEnabled(hidden, 'rear', true).rearEnabled, true);
  const none = setBracingEnabled(setBracingEnabled(initialProject(), 'rear', false), 'front', false);
  assert.equal(none.bracing, 'none'); assert.ok(computeFrame(none).points.R_L);
});

test('legacy V2 migration preserves physical properties and presence/absence of rear geometry', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/legacy-v1.json', import.meta.url), 'utf8'));
  for (const { project: old } of fixtures) {
    const p = parseProject({ ...old, schemaVersion: 2, materialDensity: 2700, params: { ...old.params, primaryThickness: 2, secondaryThickness: 1.5 } });
    assert.equal(p.schemaVersion, 3); assert.equal(p.materialDensity, 2700);
    assert.equal(p.params.primaryThickness, 2); assert.equal(p.params.secondaryThickness, 1.5);
    assert.equal(p.rearEnabled, old.bracing !== 'front'); assert.equal(p.params.rearWidth, old.params.baseWidth);
    assert.equal(p.params.frontUpperPosition, 15); assert.deepEqual(p.extraTubes, []);
    assert.deepEqual(p.offsets, old.offsets);
  }
});

test('inverse front angle and length edits remain on supports and preserve other settings', () => {
  for (const p of [front(), movePoint(front(), 'C_L', [720, 420, 1400])]) {
    for (const part of ['upper', 'lower'] as const) for (const metric of ['angle', 'length'] as const) {
      const range = frontBraceRange(p, part, metric);
      for (const fraction of [0, .25, .5, .75, 1]) {
        const value = range.min + fraction * (range.max - range.min);
        const edited = setFrontBraceMetric(p, part, metric, value);
        close(frontBraceMeasure(edited, part)[metric], value, 1e-4);
        assert.deepEqual(edited.offsets, p.offsets); assert.equal(edited.params.frontSidePosition, p.params.frontSidePosition);
        const f = computeFrame(edited);
        const point = f.points[part === 'upper' ? 'Q_L' : 'J_L'].position;
        const [a, b] = part === 'upper' ? ['C_L', 'D_L'] : ['A_L', 'F_L'];
        close(closestSegments(point, point, f.points[a].position, f.points[b].position).distance, 0);
      }
    }
  }
});

test('inverse edits clamp infeasible requests and reject nonfinite requests', () => {
  for (const part of ['upper', 'lower'] as const) for (const metric of ['angle', 'length'] as const) {
    const p = front(), range = frontBraceRange(p, part, metric);
    close(frontBraceMeasure(setFrontBraceMetric(p, part, metric, -999), part)[metric], range.min, 1e-4);
    close(frontBraceMeasure(setFrontBraceMetric(p, part, metric, 99999), part)[metric], range.max, 1e-4);
    assert.throws(() => setFrontBraceMetric(p, part, metric, NaN));
  }
});

test('nearby supports flag branch interference without flagging their intentional receiver joints', () => {
  let p = setFrontBraceMetric(front(), 'upper', 'angle', 70);
  p = setFrontBraceMetric(p, 'lower', 'length', 500);
  const f = computeFrame(p);
  assert.ok(f.interferences.some(i => i.members.includes('FAB_FRONT_LOW_L') && i.members.includes('ILC')));
  assert.ok(!f.interferences.some(i => i.members.includes('LFS_L') && i.members.includes('FAB_FRONT_LOW_L')));
  assert.ok(!f.interferences.some(i => i.members.includes('LFS_L') && i.members.includes('ILC')));
});

test('additional tubes mirror, contribute mass and survive a V3 roundtrip', () => {
  const p = front(), base = computeFrame(p);
  const edited = addExtraTube(p, { from: 'Q_L', to: 'F_L', category: 'secondary', mirrored: true });
  const f = computeFrame(edited);
  assert.equal(f.members.length, base.members.length + 2);
  const extras = f.members.filter(m => m.id.startsWith('EXTRA_'));
  assert.equal(extras.length, 2); close(extras[0].length, extras[1].length);
  close(f.totalMass - base.totalMass, extras.reduce((s, m) => s + m.estimatedMass, 0));
  assert.deepEqual(computeFrame(parseProject(JSON.parse(serializeProject(edited)))), f);
});

test('extra tubes suspend and resume when their supporting region is toggled', () => {
  const p = addExtraTube(front(), { from: 'Q_L', to: 'F_L', category: 'secondary', mirrored: true });
  const off = setBracingEnabled(p, 'front', false), f = computeFrame(off);
  assert.ok(!f.members.some(m => m.id.startsWith('EXTRA_'))); assert.match(f.warnings.join(' '), /inativos/);
  assert.deepEqual(off.extraTubes, p.extraTubes);
  assert.deepEqual(computeFrame(setBracingEnabled(off, 'front', true)), computeFrame(p));
});

test('duplicate/overlapping extras are rejected and transverse mirror does not double count', () => {
  const p = front();
  assert.throws(() => addExtraTube(p, { from: 'C_L', to: 'D_L', category: 'secondary', mirrored: false }), /sobrepõe/);
  const added = addExtraTube(p, { from: 'Q_L', to: 'F_L', category: 'secondary', mirrored: true });
  assert.throws(() => addExtraTube(added, { from: 'F_R', to: 'Q_R', category: 'primary', mirrored: false }), /duplicados/);
  const cross = addExtraTube(p, { from: 'P_L', to: 'P_R', category: 'secondary', mirrored: true });
  assert.equal(cross.extraTubes[0].mirrored, false);
  assert.equal(computeFrame(cross).members.length, computeFrame(p).members.length + 1);
});

test('V3 rejects malformed rear settings, attachment positions and additional tubes', () => {
  const p = initialProject();
  for (const v of [
    { ...p, rearEnabled: false }, { ...p, rearEnabled: 'yes' }, { ...p, extraTubes: null },
    { ...p, params: { ...p.params, frontUpperPosition: 0 } }, { ...p, params: { ...p.params, frontSidePosition: Infinity } },
    { ...p, extraTubes: [{ id: 'T1', from: 'N1', to: 'B_L', category: 'secondary', mirrored: false }] },
    { ...p, extraTubes: [{ id: 'T1', from: 'B_L', to: 'B_L', category: 'secondary', mirrored: false }] },
    { ...p, extraTubes: Array(33).fill({ id: 'T', from: 'A_L', to: 'B_L', category: 'secondary', mirrored: false }) },
  ]) assert.throws(() => parseProject(v));
});

const point = (id: string, position: Vec3): FramePoint => ({ id, position, editable: false, description: id });
function member(id: string, nodes: string[]): Member {
  return { id, nodes, category: 'secondary', label: id, outerDiameter: 10, wallThickness: 1, length: 100, innerDiameter: 8, sectionArea: 9 * Math.PI, volume: 900 * Math.PI, estimatedMass: 0.0222 };
}
test('true X crossing becomes one shared node with branches ending outside the through tube', () => {
  const points = { A: point('A', [-100, 0, 0]), B: point('B', [100, 0, 0]), C: point('C', [0, -100, 0]), D: point('D', [0, 100, 0]) };
  const members = [member('host', ['A', 'B']), member('branch', ['C', 'D'])];
  const result = connectMembers(points, members);
  assert.equal(result.interferences.length, 0); assert.equal(result.joints.length, 1);
  const id = result.joints[0].pointId;
  assert.ok(members.every(m => m.nodes.includes(id)));
  const rendered = renderSegments(points, members, result.joints, members[1]);
  assert.equal(rendered.length, 2); close(rendered[0].b[1], -5); close(rendered[1].a[1], 5);
  close(junctionInset(points, members, result.joints, members[1], id, [0, 0, 3], [0, 1, 0]), 4);
  close(junctionInset(points, members, result.joints, members[1], id, [0, 0, 5], [0, 1, 0]), 0);
  assert.equal(members[1].length, 100, 'visual cuts do not change axis-derived physical properties');
});

test('skew proximity is reported without inventing a 3D connection; parallel overlap is explicit', () => {
  const points = { A: point('A', [-100, 0, 0]), B: point('B', [100, 0, 0]), C: point('C', [0, -100, 4]), D: point('D', [0, 100, 4]) };
  const result = connectMembers(points, [member('a', ['A', 'B']), member('b', ['C', 'D'])]);
  assert.equal(result.joints.length, 0); assert.equal(result.interferences[0].kind, 'clearance');
  points.C.position = [-50, 0, 0]; points.D.position = [50, 0, 0];
  assert.equal(connectMembers(points, [member('a', ['A', 'B']), member('b', ['C', 'D'])]).interferences[0].kind, 'overlap');
});

test('closest finite segments handles endpoint, parallel and zero-length cases', () => {
  close(closestSegments([0, 0, 0], [10, 0, 0], [20, -1, 0], [20, 1, 0]).distance, 10);
  close(closestSegments([0, 0, 0], [10, 0, 0], [0, 4, 0], [10, 4, 0]).distance, 4);
  close(closestSegments([5, 3, 0], [5, 3, 0], [0, 0, 0], [10, 0, 0]).distance, 3);
});

test('pieces fully inside neighbouring junctions are reported without deleting project axes', () => {
  const p = initialProject(); p.params.frontWidth = 300;
  const f = computeFrame(p);
  assert.ok(f.warnings.some(w => w.includes('muito curto')));
  const m = f.members.find(m => m.id === 'LFDB_2')!;
  assert.ok(renderSegments(f.points, f.members, f.joints, m).length < m.nodes.length - 1);
  assert.ok(m.length > 0 && m.estimatedMass > 0);
});

test('default layouts have connected crossings, no flagged clashes and finite visible tubes', () => {
  for (const bracing of ['front', 'rear', 'both', 'none'] as const) {
    const p = { ...initialProject(), bracing }, f = computeFrame(p);
    assert.equal(f.interferences.length, 0);
    const first = f.members.find(m => m.id === 'LFDB_1')!, second = f.members.find(m => m.id === 'LFDB_2')!;
    assert.ok(first.nodes.some(id => second.nodes.includes(id)), 'floor X has a shared crossing');
    for (const m of f.members) {
      const segments = renderSegments(f.points, f.members, f.joints, m);
      assert.ok(segments.length, `${m.id} remains visible`);
      assert.equal(segments.length, m.nodes.length - 1, 'default layouts do not hide short pieces');
      for (const s of segments) { assert.ok([...s.a, ...s.b].every(Number.isFinite)); assert.ok(distance(s.a, s.b) > 0); }
    }
  }
});
