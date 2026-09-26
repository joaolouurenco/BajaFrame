/** X forward, Y left, Z up. Geometry: mm; area: mm²; volume: mm³; mass: kg. */
export type Vec3 = [number, number, number];
export type Bracing = 'rear' | 'front' | 'both';
export type Category = 'primary' | 'secondary';
export type Anchor = 'A' | 'S' | 'B' | 'C' | 'D' | 'F' | 'R';
export type Side = 'L' | 'R';
export const ANCHORS: Anchor[] = ['A', 'S', 'B', 'C', 'D', 'F', 'R'];
export const PARAMS = {
  baseWidth: { label: 'Largura da base', min: 400, max: 1100, step: 10, unit: 'mm', group: 'shape' },
  topWidth: { label: 'Largura do teto', min: 400, max: 1000, step: 10, unit: 'mm', group: 'shape' },
  simWidth: { label: 'Largura das laterais', min: 450, max: 1200, step: 10, unit: 'mm', group: 'shape' },
  frontWidth: { label: 'Largura do bico', min: 250, max: 850, step: 10, unit: 'mm', group: 'shape' },
  rrhHeight: { label: 'Altura do arco traseiro', min: 800, max: 1600, step: 10, unit: 'mm', group: 'shape' },
  rrhAngle: { label: 'Inclinação do arco', min: 0, max: 25, step: 1, unit: '°', group: 'shape' },
  simHeight: { label: 'Altura das laterais', min: 250, max: 700, step: 10, unit: 'mm', group: 'shape' },
  roofLength: { label: 'Comprimento do teto', min: 450, max: 1200, step: 10, unit: 'mm', group: 'shape' },
  cockpitLength: { label: 'Comprimento das laterais', min: 700, max: 1600, step: 10, unit: 'mm', group: 'shape' },
  noseLength: { label: 'Extensão do bico', min: 100, max: 650, step: 10, unit: 'mm', group: 'shape' },
  rearLength: { label: 'Extensão traseira', min: 250, max: 850, step: 10, unit: 'mm', group: 'bracing' },
  rearHeight: { label: 'Altura do vértice traseiro', min: 250, max: 1000, step: 10, unit: 'mm', group: 'bracing' },
  floorPosition: { label: 'Travessa I ao longo da base', min: 40, max: 80, step: 1, unit: '%', group: 'bracing' },
  primaryDiameter: { label: 'Diâmetro dos primários', min: 20, max: 50, step: 0.1, unit: 'mm', group: 'tubes' },
  secondaryDiameter: { label: 'Diâmetro dos secundários', min: 15, max: 40, step: 0.1, unit: 'mm', group: 'tubes' },
  primaryThickness: { label: 'Espessura dos primários', min: 0.5, max: 5, step: 0.1, unit: 'mm', group: 'tubes' },
  secondaryThickness: { label: 'Espessura dos secundários', min: 0.5, max: 5, step: 0.1, unit: 'mm', group: 'tubes' },
} as const;
export const DEFAULT_PRIMARY_THICKNESS = 1.6;
export const DEFAULT_SECONDARY_THICKNESS = 1.2;
export const MATERIAL_DENSITY = { min: 1, max: 30000, step: 10, default: 7850 } as const;
export type ParamKey = keyof typeof PARAMS;
export type Parameters = Record<ParamKey, number>;
export interface Project {
  schemaVersion: 2;
  materialDensity: number; // kg/m³; shared by all members
  name: string;
  params: Parameters;
  bracing: Bracing;
  symmetry: boolean;
  offsets: Record<string, Vec3>;
}
export interface FramePoint { id: string; position: Vec3; editable: boolean; description: string }
export interface Member {
  id: string; label: string; category: Category; nodes: string[];
  outerDiameter: number; wallThickness: number; length: number; innerDiameter: number; // mm
  sectionArea: number; // mm²
  volume: number; // mm³
  estimatedMass: number; // kg
}
export interface Frame {
  points: Record<string, FramePoint>;
  members: Member[];
  bounds: { min: Vec3; max: Vec3; size: Vec3; center: Vec3 };
  totalLength: number;
  totalMass: number; primaryMass: number; secondaryMass: number; // kg
  warnings: string[];
}
export const POINT_NAMES: Record<string, string> = {
  A: 'Base do arco traseiro', S: 'União da lateral ao arco', B: 'Topo do arco traseiro',
  C: 'Encontro do teto com a dianteira', D: 'Extremidade da lateral', F: 'Extremidade do bico',
  R: 'Vértice do travamento traseiro', H: 'Travessa do arco', I: 'Travessa intermediária da base',
  U: 'Travessa sob o assento', V: 'Travessa antissubmarina', P: 'Apoio dianteiro na lateral',
  Q: 'Apoio dianteiro no membro superior', J: 'Apoio dianteiro na base',
};
export function initialProject(): Project {
  return {
    schemaVersion: 2, materialDensity: MATERIAL_DENSITY.default,
    name: 'Frame de estudo 01', symmetry: true, bracing: 'rear', offsets: {},
    params: { baseWidth: 660, topWidth: 760, simWidth: 740, frontWidth: 440,
      rrhHeight: 1180, rrhAngle: 10, simHeight: 420, roofLength: 860,
      cockpitLength: 1120, noseLength: 300, rearLength: 520, rearHeight: 580,
      floorPosition: 64, primaryDiameter: 31.8, secondaryDiameter: 25.4,
      primaryThickness: DEFAULT_PRIMARY_THICKNESS, secondaryThickness: DEFAULT_SECONDARY_THICKNESS },
  };
}

/** Circular hollow section. All dimensional arguments are in mm. */
export function innerDiameter(outerDiameter: number, wallThickness: number): number {
  if (!Number.isFinite(outerDiameter) || !Number.isFinite(wallThickness) ||
      outerDiameter <= 0 || wallThickness <= 0 || 2 * wallThickness >= outerDiameter) {
    throw new Error('Seção tubular inválida: a parede deve ser positiva e menor que metade do diâmetro externo.');
  }
  return outerDiameter - 2 * wallThickness;
}
export function tubeSectionArea(outerDiameter: number, wallThickness: number): number {
  const d = innerDiameter(outerDiameter, wallThickness);
  return Math.PI / 4 * (outerDiameter ** 2 - d ** 2);
}
export function tubeVolume(outerDiameter: number, wallThickness: number, length: number): number {
  if (!Number.isFinite(length) || length < 0) throw new Error('Comprimento de tubo inválido.');
  return tubeSectionArea(outerDiameter, wallThickness) * length;
}
export function tubeMass(outerDiameter: number, wallThickness: number, length: number, density: number): number {
  if (!Number.isFinite(density) || density <= 0) throw new Error('Densidade inválida.');
  return tubeVolume(outerDiameter, wallThickness, length) * 1e-9 * density;
}
/** Shared validation at the UI, JSON and derived-model boundaries. */
export function validatePhysicalProperties(project: Pick<Project, 'params' | 'materialDensity'>): void {
  const p = project.params;
  innerDiameter(p.primaryDiameter, p.primaryThickness);
  innerDiameter(p.secondaryDiameter, p.secondaryThickness);
  if (!Number.isFinite(project.materialDensity) || project.materialDensity < MATERIAL_DENSITY.min || project.materialDensity > MATERIAL_DENSITY.max) {
    throw new Error(`Densidade inválida: use de ${MATERIAL_DENSITY.min} a ${MATERIAL_DENSITY.max} kg/m³.`);
  }
}
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => a.map((v, i) => v + (b[i] - v) * t) as Vec3;
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const mirror = (p: Vec3): Vec3 => [p[0], -p[1], p[2]];
export const isAnchorId = (id: string) => /^(A|S|B|C|D|F|R)_[LR]$/.test(id);

export function baseAnchors(p: Parameters): Record<string, Vec3> {
  const lean = Math.tan(p.rrhAngle * Math.PI / 180);
  const base: Record<Anchor, Vec3> = {
    A: [0, p.baseWidth / 2, 0], S: [-p.simHeight * lean, p.simWidth / 2, p.simHeight],
    B: [-p.rrhHeight * lean, p.topWidth / 2, p.rrhHeight],
    C: [-p.rrhHeight * lean + p.roofLength, p.topWidth / 2, p.rrhHeight],
    D: [-p.simHeight * lean + p.cockpitLength, p.simWidth / 2, p.simHeight],
    F: [-p.simHeight * lean + p.cockpitLength + p.noseLength, p.frontWidth / 2, 0],
    R: [-p.rrhHeight * lean - p.rearLength, p.baseWidth / 2, p.rearHeight],
  };
  return Object.fromEntries(ANCHORS.flatMap(k => [[`${k}_L`, base[k]], [`${k}_R`, mirror(base[k])]]));
}

export function computeFrame(project: Project): Frame {
  validatePhysicalProperties(project);
  const p = project.params;
  const base = baseAnchors(p);
  const points: Record<string, FramePoint> = {};
  const put = (id: string, position: Vec3, editable = false) => {
    points[id] = { id, position, editable, description: POINT_NAMES[id.split('_')[0]] };
  };
  for (const [id, pos] of Object.entries(base)) {
    if (id.startsWith('R_') && project.bracing === 'front') continue;
    const leftId = id.replace(/_R$/, '_L');
    const offset = project.symmetry && id.endsWith('_R')
      ? mirror(project.offsets[leftId] ?? [0, 0, 0]) : project.offsets[id] ?? [0, 0, 0];
    put(id, add(pos, offset), true);
  }
  const pos = (id: string) => points[id].position;
  for (const side of ['L', 'R']) {
    put(`H_${side}`, lerp(pos(`S_${side}`), pos(`B_${side}`), .46));
    put(`I_${side}`, lerp(pos(`A_${side}`), pos(`F_${side}`), p.floorPosition / 100));
    put(`U_${side}`, lerp(pos(`A_${side}`), pos(`I_${side}`), .60));
    put(`V_${side}`, lerp(pos(`A_${side}`), pos(`I_${side}`), .32));
    if (project.bracing !== 'rear') {
      put(`P_${side}`, lerp(pos(`S_${side}`), pos(`D_${side}`), .62));
      put(`Q_${side}`, lerp(pos(`C_${side}`), pos(`D_${side}`), .15));
      put(`J_${side}`, lerp(pos(`A_${side}`), pos(`F_${side}`), .52));
    }
  }
  const members: Member[] = [];
  const member = (id: string, label: string, category: Category, nodes: string[]) => {
    const outerDiameter = category === 'primary' ? p.primaryDiameter : p.secondaryDiameter;
    const wallThickness = category === 'primary' ? p.primaryThickness : p.secondaryThickness;
    const length = nodes.slice(1).reduce((sum, name, i) => sum + distance(pos(nodes[i]), pos(name)), 0);
    members.push({ id, label, category, nodes, outerDiameter, wallThickness, length,
      innerDiameter: innerDiameter(outerDiameter, wallThickness),
      sectionArea: tubeSectionArea(outerDiameter, wallThickness),
      volume: tubeVolume(outerDiameter, wallThickness, length),
      estimatedMass: tubeMass(outerDiameter, wallThickness, length, project.materialDensity) });
  };
  for (const side of ['L', 'R']) {
    member(`RRH_${side}`, 'Arco traseiro', 'primary', ['A', 'S', 'H', 'B'].map(n => `${n}_${side}`));
    member(`RHO_FBM_${side}`, 'Teto e membro dianteiro superior', 'primary', ['B', 'C', ...(project.bracing === 'rear' ? [] : ['Q']), 'D'].map(n => `${n}_${side}`));
    member(`FBMLOW_${side}`, 'Membro dianteiro inferior', 'primary', [`D_${side}`, `F_${side}`]);
    const floor = ['A', 'V', 'U', 'I', 'F'].map(n => `${n}_${side}`);
    if (project.bracing !== 'rear') {
      floor.push(`J_${side}`);
      floor.sort((a, b) => distance(pos(`A_${side}`), pos(a)) - distance(pos(`A_${side}`), pos(b)));
    }
    member(`LFS_${side}`, 'Longarina inferior', 'primary', floor);
    member(`SIM_${side}`, 'Proteção lateral', 'secondary', ['S', ...(project.bracing === 'rear' ? [] : ['P']), 'D'].map(n => `${n}_${side}`));
    if (project.bracing !== 'front') {
      for (const [n, anchor] of [['UP', 'B'], ['MID', 'S'], ['LOW', 'A']]) {
        member(`FAB${n}_${side}`, 'Travamento traseiro', 'secondary', [`${anchor}_${side}`, `R_${side}`]);
      }
    }
    if (project.bracing !== 'rear') {
      member(`FAB_FRONT_UP_${side}`, 'Travamento dianteiro superior', 'secondary', [`Q_${side}`, `P_${side}`]);
      member(`FAB_FRONT_LOW_${side}`, 'Travamento dianteiro inferior', 'secondary', [`P_${side}`, `J_${side}`]);
    }
  }
  for (const [n, id, label, cat] of [
    ['A', 'ALC', 'Travessa da base traseira', 'primary'], ['B', 'BLC', 'Travessa superior traseira', 'primary'],
    ['C', 'CLC', 'Travessa superior dianteira', 'primary'], ['D', 'DLC', 'Travessa das laterais', 'primary'],
    ['F', 'FLC', 'Travessa do bico', 'primary'], ['H', 'SHC', 'Travessa do arco', 'primary'],
    ['I', 'ILC', 'Travessa intermediária', 'secondary'], ['U', 'USM', 'Travessa sob o assento', 'secondary'],
    ['V', 'ASB', 'Travessa antissubmarina', 'secondary'],
  ]) member(id, label, cat as Category, [`${n}_L`, `${n}_R`]);
  if (project.bracing !== 'front') member('RLC', 'Travessa traseira', 'secondary', ['R_L', 'R_R']);
  member('LDB_1', 'Diagonal do arco traseiro', 'secondary', ['A_L', 'B_R']);
  member('LDB_2', 'Diagonal do arco traseiro', 'secondary', ['A_R', 'B_L']);
  member('LFDB_1', 'Diagonal do assoalho', 'secondary', ['A_L', 'I_R']);
  member('LFDB_2', 'Diagonal do assoalho', 'secondary', ['A_R', 'I_L']);
  const used = Object.values(points).map(v => v.position);
  const min = [0, 1, 2].map(i => Math.min(...used.map(v => v[i]))) as Vec3;
  const max = [0, 1, 2].map(i => Math.max(...used.map(v => v[i]))) as Vec3;
  const warnings: string[] = [];
  for (const m of members) {
    if (m.nodes.slice(1).some((n, i) => distance(pos(n), pos(m.nodes[i])) < 1)) warnings.push(`${m.id}: há pontos praticamente coincidentes.`);
  }
  if (Object.values(points).some(n => !n.position.every(Number.isFinite))) warnings.push('Há coordenadas inválidas. Restaure a configuração.');
  if (['L', 'R'].some(s => pos(`C_${s}`)[0] >= pos(`D_${s}`)[0])) warnings.push('A parte superior da dianteira ultrapassa a lateral. Confira a forma do frame.');
  if (Object.values(project.offsets).some(v => v.some(n => Math.abs(n) > 0))) warnings.push('Ajustes locais ativos: as medidas dos controles descrevem a base, antes dos deslocamentos dos pontos.');
  const primaryMass = members.filter(m => m.category === 'primary').reduce((sum, m) => sum + m.estimatedMass, 0);
  const secondaryMass = members.filter(m => m.category === 'secondary').reduce((sum, m) => sum + m.estimatedMass, 0);
  return { points, members, bounds: { min, max, size: max.map((v, i) => v - min[i]) as Vec3, center: lerp(min, max, .5) },
    totalLength: members.reduce((sum, m) => sum + m.length, 0),
    totalMass: primaryMass + secondaryMass, primaryMass, secondaryMass, warnings };
}

export function movePoint(project: Project, id: string, target: Vec3): Project {
  if (!isAnchorId(id) || !target.every(Number.isFinite)) return project;
  const base = baseAnchors(project.params)[id];
  const position = target.map((v, i) => Math.max(i === 2 ? 0 : -3000, Math.min(i === 2 ? 2600 : 4000, v))) as Vec3;
  position[1] = id.endsWith('_L') ? Math.max(40, position[1]) : Math.min(-40, position[1]);
  const offset = position.map((v, i) => Math.round((v - base[i]) * 10) / 10) as Vec3;
  const offsets = { ...project.offsets, [id]: offset };
  if (project.symmetry) offsets[id.endsWith('_L') ? id.replace(/_L$/, '_R') : id.replace(/_R$/, '_L')] = mirror(offset);
  return { ...project, offsets };
}

export function setSymmetry(project: Project, symmetry: boolean): Project {
  const offsets = { ...project.offsets };
  if (symmetry || project.symmetry) for (const name of ANCHORS) offsets[`${name}_R`] = mirror(offsets[`${name}_L`] ?? [0, 0, 0]);
  return { ...project, offsets, symmetry };
}

export function parseProject(input: unknown): Project {
  if (!input || typeof input !== 'object') throw new Error('Arquivo de projeto inválido.');
  const v = input as Record<string, unknown>;
  if (v.schemaVersion !== 1 && v.schemaVersion !== 2) throw new Error('Versão de projeto não suportada. Use um arquivo BajaFrame versão 1 ou 2.');
  if (!['rear', 'front', 'both'].includes(v.bracing as string) || typeof v.symmetry !== 'boolean') throw new Error('Configuração de travamento ou simetria inválida.');
  if (!v.params || typeof v.params !== 'object') throw new Error('Parâmetros ausentes.');
  const raw = v.params as Record<string, unknown>;
  const params = {} as Parameters;
  for (const key of Object.keys(PARAMS) as ParamKey[]) {
    const n = v.schemaVersion === 1 && key === 'primaryThickness' ? DEFAULT_PRIMARY_THICKNESS
      : v.schemaVersion === 1 && key === 'secondaryThickness' ? DEFAULT_SECONDARY_THICKNESS : raw[key];
    const def = PARAMS[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < def.min || n > def.max) throw new Error(`Parâmetro inválido: ${def.label}.`);
    params[key] = n;
  }
  const materialDensity = v.schemaVersion === 1 ? MATERIAL_DENSITY.default : v.materialDensity;
  if (typeof materialDensity !== 'number') throw new Error('Densidade ausente ou inválida.');
  validatePhysicalProperties({ params, materialDensity });
  if (!v.offsets || typeof v.offsets !== 'object' || Array.isArray(v.offsets)) throw new Error('Ajustes de pontos inválidos.');
  const offsets: Record<string, Vec3> = {};
  for (const [key, val] of Object.entries(v.offsets)) {
    if (!isAnchorId(key) || !Array.isArray(val) || val.length !== 3 || !val.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 8000)) throw new Error(`Ajuste de ponto inválido: ${key}.`);
    offsets[key] = [...val] as Vec3;
  }
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 80) throw new Error('Nome de projeto inválido.');
  const project: Project = { schemaVersion: 2, materialDensity, name: v.name.trim(), params, bracing: v.bracing as Bracing, symmetry: v.symmetry, offsets };
  return project.symmetry ? setSymmetry(project, true) : project;
}

export function serializeProject(project: Project): string { return JSON.stringify(parseProject(project), null, 2); }
