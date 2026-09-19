import { copyFile, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'release', 'BajaFrame');
await mkdir(out, { recursive: true });
await copyFile(path.join(root, 'dist/index.html'), path.join(out, 'BajaFrame.html'));
for (const name of ['README.md', 'LEIA-ME.html', 'AUDITORIA.md']) await copyFile(path.join(root, name), path.join(out, name));

const packages = ['react', 'react-dom', 'scheduler', 'three', 'lucide-react'];
const notices = ['BAJAFRAME - BIBLIOTECAS INCLUIDAS NA VERSÃO PORTÁTIL\n'];
for (const name of packages) {
  const folder = path.join(root, 'node_modules', name);
  const manifest = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8'));
  const licenseFiles = (await readdir(folder)).filter(n => /^licen[cs]e(?:\.|$)/i.test(n));
  if (!licenseFiles.length) throw new Error(`Licença ausente para ${name}.`);
  notices.push(`\n${'='.repeat(70)}\n${name} ${manifest.version}\n${'='.repeat(70)}\n`);
  for (const file of licenseFiles) notices.push(await readFile(path.join(folder, file), 'utf8'));
}
await writeFile(path.join(out, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n'), 'utf8');

async function copyFolder(source, target) {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isDirectory()) await copyFolder(path.join(source, entry.name), path.join(target, entry.name));
    else if (entry.isFile()) await copyFile(path.join(source, entry.name), path.join(target, entry.name));
  }
}
const source = path.join(out, 'codigo-fonte');
await mkdir(source, { recursive: true });
for (const folder of ['src', 'tests', 'scripts']) await copyFolder(path.join(root, folder), path.join(source, folder));
for (const name of ['README.md', 'LEIA-ME.html', 'AUDITORIA.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', '.gitignore']) await copyFile(path.join(root, name), path.join(source, name));
// Execute our own TypeScript model, using the installed and locked test runner.
execFileSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), path.join(root, 'scripts/examples.ts')], { cwd: root, stdio: 'inherit' });
console.log(`Pacote preparado em ${out}`);
