import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = path.join(root, 'release', 'BajaFrame');
const html = await readFile(path.join(release, 'BajaFrame.html'), 'utf8');
assert.ok(html.includes('<html lang="pt-BR">'));
assert.equal(/<script\b[^>]*\bsrc\s*=/i.test(html), false, 'scripts must be inline');
assert.equal(/<link\b[^>]*rel=["'](?:stylesheet|modulepreload)["']/i.test(html), false, 'styles and JS must be embedded');
assert.equal(/<img\b[^>]*src=["'](?:https?:|\/src)/i.test(html), false, 'no external UI images');
assert.ok(html.includes('<style'));
assert.ok(html.length > 100000, 'application script must be present');
assert.equal(html, await readFile(path.join(root, 'dist', 'index.html'), 'utf8'), 'portable build must be current');
for (const file of ['LEIA-ME.html', 'README.md', 'AUDITORIA.md', 'REFINAMENTOS.md', 'THIRD-PARTY-NOTICES.txt', 'codigo-fonte/package-lock.json', 'codigo-fonte/tests/model.test.ts', 'codigo-fonte/tests/refinement.test.ts']) assert.ok((await readFile(path.join(release, file))).length > 0);
const examples = await readdir(path.join(release, 'exemplos'));
assert.equal(examples.filter(n => n.endsWith('.json')).length, 3);
for (const name of examples.filter(n => n.endsWith('.json'))) {
  const project = JSON.parse(await readFile(path.join(release, 'exemplos', name), 'utf8'));
  assert.equal(project.schemaVersion, 3);
  assert.equal(project.rearEnabled, true);
  assert.deepEqual(project.extraTubes, []);
  assert.equal(project.params.frontUpperPosition, 15);
  assert.equal(project.materialDensity, 7850);
  assert.equal(project.params.primaryThickness, 1.6);
  assert.equal(project.params.secondaryThickness, 1.2);
  assert.equal('members' in project || 'totalMass' in project, false);
}
// Distributed source must match the implementation and carry the V1 regression fixtures.
for (const folder of ['src', 'tests', 'scripts']) {
  for (const name of await readdir(path.join(root, folder), { recursive: true, withFileTypes: true })) {
    if (!name.isFile()) continue;
    const original = path.join(name.parentPath, name.name);
    const relative = path.relative(root, original);
    assert.deepEqual(await readFile(path.join(release, 'codigo-fonte', relative)), await readFile(original), `stale source: ${relative}`);
  }
}
console.log('PASS: HTML único, recursos embutidos, documentação, licenças, código-fonte, lockfile e 3 exemplos.');
console.log('PASS: exemplos V3 com espessuras e densidade; fontes e fixtures idênticos aos originais.');
console.log('Abertura file://, controles e WebGL devem ser verificados também em navegador real, conforme AUDITORIA.md.');
