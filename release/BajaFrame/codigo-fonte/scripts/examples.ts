import { mkdir, writeFile } from 'node:fs/promises';
import { initialProject, serializeProject } from '../src/model.ts';
const dir = new URL('../release/BajaFrame/exemplos/', import.meta.url);
await mkdir(dir, { recursive: true });
for (const [bracing, label] of [['rear', 'traseiro'], ['front', 'dianteiro'], ['both', 'combinado']] as const) {
  const project = { ...initialProject(), bracing, name: `Estudo - travamento ${label}` };
  await writeFile(new URL(`${label}.bajaframe.json`, dir), serializeProject(project), 'utf8');
}
