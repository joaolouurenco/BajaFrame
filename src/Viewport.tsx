import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { Frame, Vec3 } from './model';

export type View = 'perspective' | 'side' | 'top' | 'front';
export interface Display { points: boolean; labels: boolean; dimensions: boolean; primary: boolean; secondary: boolean; wireframe: boolean }
export type Selection = { type: 'point' | 'member'; id: string } | null;
interface Props {
  frame: Frame; display: Display; selection: Selection; view: View; fitCounter: number;
  editing: boolean; snap: boolean;
  onSelect: (s: Selection) => void; onMove: (id: string, p: Vec3) => void;
  onBegin: () => void; onEnd: () => void; onReady: (ready: boolean) => void;
}
type Engine = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; group: THREE.Group;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  perspective: THREE.PerspectiveCamera; orthographic: THREE.OrthographicCamera;
  orbit: OrbitControls; transform: TransformControls; proxy: THREE.Object3D;
  dragging: boolean; initialized: boolean; fit: () => void; dispose: () => void;
};
const v3 = (p: Vec3) => new THREE.Vector3(...p);

function labelSprite(text: string, color = '#dce5ee', scale = 100): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '600 30px Arial';
  const w = Math.min(380, ctx.measureText(text).width + 28);
  ctx.fillStyle = '#111923ee'; ctx.beginPath(); ctx.roundRect((384 - w) / 2, 6, w, 66, 14); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 192, 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(scale * 4.8, scale, 1); sprite.renderOrder = 4;
  sprite.userData.screenHeight = scale >= 64 ? 32 : 28;
  return sprite;
}
function disposeGroup(group: THREE.Group) {
  group.traverse(object => {
    if ('geometry' in object) (object as THREE.Mesh).geometry.dispose();
    if ('material' in object) {
      const raw = (object as THREE.Mesh).material;
      for (const material of Array.isArray(raw) ? raw : [raw]) {
        if ('map' in material) (material.map as THREE.Texture | null)?.dispose();
        material.dispose();
      }
    }
  });
  group.clear();
}

export default function Viewport(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const engine = useRef<Engine | null>(null);
  const [error, setError] = useState('');
  const [hover, setHover] = useState('');

  useEffect(() => {
    const host = hostRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setError('Não foi possível iniciar o 3D. Ative a aceleração gráfica do navegador ou tente outro navegador atualizado. Os controles e projetos salvos continuam disponíveis.');
      latest.current.onReady(false); return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor('#141c26');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', 'Visualização 3D do frame. Use os botões de vista e os campos de coordenadas para operar sem arrastar.');
    renderer.domElement.setAttribute('role', 'img');
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const group = new THREE.Group(); scene.add(group);
    const perspective = new THREE.PerspectiveCamera(38, 1, 1, 50000);
    const orthographic = new THREE.OrthographicCamera(-1800, 1800, 1400, -1400, 1, 50000);
    perspective.up.set(0, 0, 1); orthographic.up.set(0, 0, 1);
    const orbit = new OrbitControls(perspective, renderer.domElement);
    orbit.enableDamping = true; orbit.dampingFactor = .09; orbit.minDistance = 250; orbit.maxDistance = 14000;
    orbit.maxPolarAngle = Math.PI * .95; orbit.target.set(350, 0, 500);
    scene.add(new THREE.HemisphereLight('#e7f3ff', '#6d788b', 2.8));
    const light = new THREE.DirectionalLight('#ffffff', 3.2); light.position.set(900, -1000, 2500); scene.add(light);
    const fill = new THREE.DirectionalLight('#c9e7ff', 2); fill.position.set(-1500, 1800, 1000); scene.add(fill);
    const grid = new THREE.GridHelper(8000, 80, '#425264', '#293744');
    grid.rotation.x = Math.PI / 2; grid.position.z = -35;
    (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = .40;
    scene.add(grid);
    const axes = new THREE.AxesHelper(250); axes.position.set(-1050, -950, -25); scene.add(axes);
    const proxy = new THREE.Object3D(); scene.add(proxy);
    const transform = new TransformControls(perspective, renderer.domElement);
    transform.setMode('translate'); transform.setSpace('world'); transform.setSize(.85);
    const helper = transform.getHelper(); scene.add(helper);
    const e: Engine = { renderer, scene, group, camera: perspective, perspective, orthographic, orbit, transform, proxy,
      dragging: false, initialized: false, fit: () => {}, dispose: () => {} };
    engine.current = e;
    const fit = () => {
      const { frame, view } = latest.current;
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      const center = v3(frame.bounds.center), size = v3(frame.bounds.size);
      const aspect = width / height;
      const radius = Math.max(size.length() / 2, 400);
      const distance = radius / Math.sin(THREE.MathUtils.degToRad(38 / 2)) * (aspect < 1 ? 1 / aspect : 1) * 1.12;
      const viewDirection = view === 'side' ? new THREE.Vector3(0, -1, 0) : view === 'front' ? new THREE.Vector3(1, 0, 0)
        : view === 'top' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1.45, -2.4, 1.35).normalize();
      e.camera = view === 'perspective' ? perspective : orthographic;
      const extent = (view === 'front' ? Math.max(size.y / aspect, size.z) : view === 'top' ? Math.max(size.x / aspect, size.y) : Math.max(size.x / aspect, size.z)) * .72 + 110;
      orthographic.left = -extent * aspect; orthographic.right = extent * aspect;
      orthographic.top = extent; orthographic.bottom = -extent; orthographic.zoom = 1;
      orthographic.updateProjectionMatrix();
      e.camera.up.set(...(view === 'top' ? [0, 1, 0] : [0, 0, 1]) as Vec3);
      e.camera.position.copy(center).addScaledVector(viewDirection, distance);
      e.camera.lookAt(center);
      orbit.object = e.camera; orbit.target.copy(center); orbit.enableRotate = view === 'perspective'; orbit.update();
      transform.camera = e.camera;
    };
    e.fit = fit;
    const resize = () => {
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height); perspective.aspect = width / height; perspective.updateProjectionMatrix();
      if (e.camera === orthographic) { const half = orthographic.top; orthographic.left = -half * width / height; orthographic.right = half * width / height; orthographic.updateProjectionMatrix(); }
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    transform.addEventListener('dragging-changed', event => {
      e.dragging = Boolean(event.value); orbit.enabled = !e.dragging;
      if (e.dragging) latest.current.onBegin(); else latest.current.onEnd();
    });
    transform.addEventListener('objectChange', () => {
      const selected = latest.current.selection;
      if (e.dragging && selected?.type === 'point') latest.current.onMove(selected.id, proxy.position.toArray() as Vec3);
    });
    const raycaster = new THREE.Raycaster(); raycaster.params.Line.threshold = 10; const mouse = new THREE.Vector2();
    let down: [number, number] | null = null;
    const hitAt = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      mouse.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height * 2 - 1));
      raycaster.setFromCamera(mouse, e.camera);
      return raycaster.intersectObjects(group.children, true).find(hit => hit.object.userData.selectable)?.object;
    };
    const pointerDown = (event: PointerEvent) => { down = [event.clientX, event.clientY]; };
    const pointerUp = (event: PointerEvent) => {
      if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5 || transform.axis || e.dragging) { down = null; return; }
      down = null;
      const hit = hitAt(event);
      if (hit) latest.current.onSelect(hit.userData.selection);
    };
    const pointerMove = (event: PointerEvent) => {
      if (e.dragging || event.buttons) return;
      const hit = hitAt(event);
      setHover(hit?.userData.title ?? '');
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    };
    const lost = (event: Event) => { event.preventDefault(); setError('A visualização perdeu a conexão gráfica. Salve seu projeto e recarregue a página.'); latest.current.onReady(false); };
    const element = renderer.domElement;
    element.addEventListener('pointerdown', pointerDown);
    element.addEventListener('pointerup', pointerUp);
    element.addEventListener('pointermove', pointerMove);
    element.addEventListener('webglcontextlost', lost);
    const cameraSpace = new THREE.Vector3();
    renderer.setAnimationLoop(() => {
      orbit.update(); e.camera.updateMatrixWorld();
      group.children.forEach(object => {
        if (!(object instanceof THREE.Sprite)) return;
        cameraSpace.copy(object.position).applyMatrix4(e.camera.matrixWorldInverse);
        const worldPerPixel = e.camera instanceof THREE.PerspectiveCamera
          ? 2 * Math.abs(cameraSpace.z) * Math.tan(THREE.MathUtils.degToRad(e.camera.fov / 2)) / Math.max(host.clientHeight, 1)
          : (e.camera.top - e.camera.bottom) / e.camera.zoom / Math.max(host.clientHeight, 1);
        const height = worldPerPixel * object.userData.screenHeight;
        object.scale.set(height * 4.8, height, 1);
      });
      renderer.render(scene, e.camera);
    });
    latest.current.onReady(true);
    e.dispose = () => {
      observer.disconnect(); renderer.setAnimationLoop(null);
      element.removeEventListener('pointerdown', pointerDown); element.removeEventListener('pointerup', pointerUp); element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('webglcontextlost', lost);
      transform.dispose(); orbit.dispose(); disposeGroup(group);
      grid.geometry.dispose(); (grid.material as THREE.Material).dispose(); axes.geometry.dispose();
      for (const m of Array.isArray(axes.material) ? axes.material : [axes.material]) m.dispose();
      renderer.dispose(); element.remove(); engine.current = null;
    };
    return () => e.dispose();
  }, []);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    disposeGroup(e.group);
    const { frame, display, selection } = props;
    const position = (id: string) => v3(frame.points[id].position);
    for (const member of frame.members) {
      if (!display[member.category]) continue;
      const selected = selection?.type === 'member' && selection.id === member.id;
      const color = selected ? '#55dcee' : member.category === 'primary' ? '#d3dce6' : '#ccec85';
      for (let i = 1; i < member.nodes.length; i++) {
        const a = position(member.nodes[i - 1]), b = position(member.nodes[i]);
        const delta = b.clone().sub(a), length = delta.length();
        if (length < .01) continue;
        let object: THREE.Mesh | THREE.Line;
        if (display.wireframe) {
          object = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color }));
        } else {
          const radius = member.diameter / 2;
          object = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), new THREE.MeshStandardMaterial({ color, roughness: .40, metalness: .25, emissive: selected ? '#063c45' : '#000000' }));
          object.position.copy(a).lerp(b, .5);
          object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
        }
        object.userData = { selectable: true, selection: { type: 'member', id: member.id }, title: `${member.id} · ${member.label}` };
        e.group.add(object);
      }
    }
    for (const point of Object.values(frame.points)) {
      const selected = selection?.type === 'point' && selection.id === point.id;
      if (display.points || selected) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(selected ? 24 : point.editable ? 15 : 10, 12, 8),
          new THREE.MeshStandardMaterial({ color: selected ? '#55dcee' : point.editable ? '#e9a168' : '#687d92', roughness: .5, metalness: .1 }));
        mesh.position.copy(v3(point.position));
        mesh.userData = { selectable: true, selection: { type: 'point', id: point.id }, title: `${point.id} · ${point.description}${point.editable ? '' : ' (vinculado)'}` };
        e.group.add(mesh);
      }
      if (display.labels && point.editable || selected && selection?.type === 'point') {
        const label = labelSprite(point.id, selected ? '#55dcee' : '#dce5ee', 52);
        label.position.copy(v3(point.position)).add(new THREE.Vector3(0, 0, 60)); e.group.add(label);
      }
    }
    if (display.dimensions) {
      const { min, max, size } = frame.bounds;
      const dim = (a: Vec3, b: Vec3, text: string, labelOffset: Vec3) => {
        const material = new THREE.LineBasicMaterial({ color: '#758aa0', transparent: true, opacity: .8 });
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(a), v3(b)]), material); e.group.add(line);
        const label = labelSprite(text, '#acbfd1', 64); label.position.copy(v3(a)).lerp(v3(b), .5).add(v3(labelOffset)); e.group.add(label);
        for (const point of [a, b]) { const dot = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 6), new THREE.MeshBasicMaterial({ color: '#758aa0' })); dot.position.copy(v3(point)); e.group.add(dot); }
      };
      if (props.view !== 'front') dim([min[0], min[1] - 150, -35], [max[0], min[1] - 150, -35], `${Math.round(size[0])} mm`, [0, 0, -25]);
      if (props.view !== 'side') dim([max[0] + 140, min[1], -35], [max[0] + 140, max[1], -35], `${Math.round(size[1])} mm`, [100, 0, 0]);
      if (props.view !== 'top') dim([min[0] - 100, max[1] + 80, min[2]], [min[0] - 100, max[1] + 80, max[2]], `${Math.round(size[2])} mm`, [-60, 0, 0]);
    }
    const selectedPoint = selection?.type === 'point' ? frame.points[selection.id] : undefined;
    if (selectedPoint?.editable && props.editing) {
      e.proxy.position.copy(v3(selectedPoint.position));
      if (e.transform.object !== e.proxy) e.transform.attach(e.proxy);
      e.transform.setTranslationSnap(props.snap ? 10 : 1);
    } else e.transform.detach();
    if (!e.initialized) { e.fit(); e.initialized = true; }
  }, [props.frame, props.display, props.selection, props.editing, props.snap, props.view]);

  useEffect(() => { engine.current?.fit(); }, [props.view, props.fitCounter]);
  return <div className="viewport-host" ref={hostRef} data-testid="viewport">
    {error && <div className="viewport-error" role="alert"><strong>Visualização indisponível</strong><p>{error}</p></div>}
    {hover && !error && <div className="hover-label">{hover}</div>}
  </div>;
}
