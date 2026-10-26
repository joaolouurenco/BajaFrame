import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Box, Check, ChevronRight, CircleHelp, Expand, Eye, EyeOff, Focus, Layers3, Maximize2, Move3d, Redo2, RotateCcw, SlidersHorizontal, Undo2, X, GitBranch, AlertTriangle, MousePointer2, Settings2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Viewport from './Viewport';
import type { Display, Selection, View } from './Viewport';
import { ANCHORS, PARAMS, MATERIAL_DENSITY, computeFrame, initialProject, movePoint, parseProject, serializeProject, setSymmetry, validatePhysicalProperties, hasFrontBracing, hasRearBracing, setRearEnabled, setBracingEnabled, addExtraTube, isTubePointId } from './model';
import type { ExtraTube, ParamKey, Project, Vec3 } from './model';
import { frontBraceMeasure, frontBraceRange, setFrontBraceMetric } from './bracing';
import type { FrontPart, BraceMetric } from './bracing';

// Keep the original key: parseProject migrates existing V1/V2 browser saves to V3.
const STORAGE_KEY = 'bajaframe.project.v1';
const format = (n: number, decimals = 0) => n.toLocaleString('pt-BR', { maximumFractionDigits: decimals });
function load(): Project {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return parseProject(JSON.parse(raw)); } catch { /* A missing or invalid local copy never blocks the editor. */ }
  return initialProject();
}
function NumberInput({ value, label, min, max, step = 1, onCommit }: { value: number; label: string; min: number; max: number; step?: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(Math.round(value * 10) / 10));
  const active = useRef(false);
  useEffect(() => { if (!active.current) setDraft(String(Math.round(value * 10) / 10)); }, [value]);
  const commit = () => {
    active.current = false;
    const n = Number(draft.replace(',', '.'));
    if (!draft.trim() || !Number.isFinite(n)) { setDraft(String(Math.round(value * 10) / 10)); return; }
    const clamped = Math.max(min, Math.min(max, Math.round(n * 10) / 10));
    setDraft(String(clamped)); onCommit(clamped);
  };
  return <input type="number" aria-label={label} value={draft} min={min} max={max} step={step}
    onFocus={() => { active.current = true; }} onChange={e => setDraft(e.target.value)} onBlur={commit}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(String(Math.round(value * 10) / 10)); active.current = false; } }} />;
}

export default function App() {
  const [project, setProject] = useState<Project>(load);
  const current = useRef(project); current.current = project;
  const undo = useRef<Project[]>([]), redo = useRef<Project[]>([]), gesture = useRef<Project | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [tab, setTab] = useState<'dimensions' | 'structure' | 'points'>('dimensions');
  const [display, setDisplay] = useState<Display>({ points: false, labels: false, dimensions: false, primary: true, secondary: true, wireframe: false });
  const [selection, setSelection] = useState<Selection>(null);
  const [tubeDraft, setTubeDraft] = useState<Omit<ExtraTube, 'id'>>({ from: 'Q_L', to: 'F_L', category: 'secondary', mirrored: true });
  const [view, setView] = useState<View>('perspective');
  const [fitCounter, setFitCounter] = useState(0);
  const [editing, setEditing] = useState(false), [snap, setSnap] = useState(true);
  const [ready, setReady] = useState(false), [saved, setSaved] = useState('Salvamento local');
  const [toast, setToast] = useState(''), [sidebar, setSidebar] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null), helpDialog = useRef<HTMLDialogElement>(null), resetDialog = useRef<HTMLDialogElement>(null);
  const frame = useMemo(() => computeFrame(project), [project]);
  const point = selection?.type === 'point' ? frame.points[selection.id] : undefined;
  const member = selection?.type === 'member' ? frame.members.find(m => m.id === selection.id) : undefined;
  const tubePoints = Object.keys(frame.points).filter(isTubePointId);
  const tubeFrom = tubePoints.includes(tubeDraft.from) ? tubeDraft.from : tubePoints[0];
  const tubeTo = tubePoints.includes(tubeDraft.to) ? tubeDraft.to : tubePoints[1];

  const begin = () => { if (!gesture.current) gesture.current = structuredClone(current.current); };
  const end = () => {
    if (gesture.current && JSON.stringify(gesture.current) !== JSON.stringify(current.current)) {
      undo.current = [...undo.current.slice(-49), gesture.current]; redo.current = []; setHistoryRevision(r => r + 1);
    }
    gesture.current = null;
  };
  const alter = (fn: (prev: Project) => Project) => {
    let next: Project;
    try { next = fn(structuredClone(current.current)); validatePhysicalProperties(next); }
    catch (error) { setToast((error as Error).message); return; }
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    if (!gesture.current) { undo.current = [...undo.current.slice(-49), current.current]; redo.current = []; }
    current.current = next; setProject(next); setHistoryRevision(r => r + 1);
  };
  const undoAction = () => {
    end(); const previous = undo.current.pop(); if (!previous) return;
    redo.current.push(current.current); current.current = previous; setProject(previous); setHistoryRevision(r => r + 1);
  };
  const redoAction = () => {
    end(); const next = redo.current.pop(); if (!next) return;
    undo.current.push(current.current); current.current = next; setProject(next); setHistoryRevision(r => r + 1);
  };
  const callbacks = useRef({ end, undoAction, redoAction }); callbacks.current = { end, undoAction, redoAction };
  useEffect(() => {
    const release = () => callbacks.current.end();
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, textarea, select') || helpDialog.current?.open || resetDialog.current?.open) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? callbacks.current.redoAction() : callbacks.current.undoAction(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); callbacks.current.redoAction(); }
    };
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release); window.addEventListener('blur', release); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); window.removeEventListener('blur', release); window.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => {
    setSaved('Salvando…');
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, serializeProject(project)); setSaved('Salvo neste navegador'); }
      catch { setSaved('Use “Salvar projeto” para guardar'); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [project]);
  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(''), 6000); return () => window.clearTimeout(timer); } }, [toast]);
  useEffect(() => { if (selection?.type === 'point' && !frame.points[selection.id] || selection?.type === 'member' && !frame.members.some(m => m.id === selection.id)) setSelection(null); }, [frame, selection]);

  const select = (s: Selection) => {
    setSelection(s);
    if (s?.type === 'point') { setTab('points'); setSidebar(true); setEditing(frame.points[s.id]?.editable ?? false); setDisplay(prev => ({ ...prev, points: true })); }
    else if (s?.type === 'member') { setTab('structure'); setSidebar(true); setEditing(false); }
  };
  const download = () => {
    const blob = new Blob([serializeProject(current.current)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `${project.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'bajaframe'}.bajaframe.json`;
    a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast('Projeto baixado. Compartilhe o JSON junto com o visualizador.');
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 256000) throw new Error('O arquivo excede o limite de 256 KB para configurações.');
      const next = parseProject(JSON.parse(await file.text()));
      alter(() => next); setSelection(null); setFitCounter(c => c + 1); setToast('Projeto aberto. Você pode desfazer para voltar à configuração anterior.');
    } catch (error) { setToast(error instanceof SyntaxError ? 'Não foi possível ler esse JSON. Use um projeto salvo pelo BajaFrame.' : (error as Error).message); }
    if (fileInput.current) fileInput.current.value = '';
  };
  const toggle = (key: keyof Display) => setDisplay(prev => ({ ...prev, [key]: !prev[key] }));
  const field = (key: ParamKey, label?: string) => {
    const def = PARAMS[key], value = project.params[key];
    const change = (n: number) => alter(prev => ({ ...prev, params: { ...prev.params, [key]: n } }));
    return <div className="parameter" key={key}>
      <div className="parameter-top"><label htmlFor={`slider-${key}`}>{label ?? def.label}</label><div className="number-unit"><NumberInput value={value} label={`${def.label} (${def.unit})`} min={def.min} max={def.max} step={def.step} onCommit={change} /><span>{def.unit}</span></div></div>
      <input id={`slider-${key}`} type="range" aria-label={`${def.label} — slider`} min={def.min} max={def.max} step={def.step} value={value} onPointerDown={begin} onChange={e => change(Number(e.target.value))} style={{ '--fill': `${(value - def.min) / (def.max - def.min) * 100}%` } as React.CSSProperties} />
    </div>;
  };
  const braceField = (part: FrontPart, metric: BraceMetric) => {
    const value = frontBraceMeasure(project, part)[metric], range = frontBraceRange(project, part, metric);
    const name = `${metric === 'angle' ? 'Inclinação' : 'Comprimento'} ${part === 'upper' ? 'Q–P' : 'P–J'}`;
    const unit = metric === 'angle' ? '°' : 'mm';
    const change = (n: number) => alter(prev => setFrontBraceMetric(prev, part, metric, n));
    return <div className="parameter" key={`${part}-${metric}`}>
      <div className="parameter-top"><label htmlFor={`brace-${part}-${metric}`}>{name}</label><div className="number-unit"><NumberInput label={`${name} (${unit})`} value={value} min={range.min} max={range.max} step={0.1} onCommit={change}/><span>{unit}</span></div></div>
      <input id={`brace-${part}-${metric}`} aria-label={`${name} — slider`} type="range" min={range.min} max={range.max} step="any" value={value} disabled={range.max - range.min < 1e-6} onPointerDown={begin} onChange={e => change(Number(e.target.value))} style={{ '--fill': `${(value - range.min) / Math.max(1e-6, range.max - range.min) * 100}%` } as React.CSSProperties}/>
    </div>;
  };

  return <div className={`app ${sidebar ? '' : 'sidebar-closed'}`}>
    <header className="topbar">
      <a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="BajaFrame, início"><span className="brand-symbol"><GitBranch size={23} strokeWidth={2.2} /></span><span>BAJA<span className="brand-light">FRAME</span><small>ESTÚDIO DO FRAME</small></span></a>
      <div className="project-title"><span className="project-folder">ESTUDOS</span><ChevronRight size={14}/><span>{project.name}</span><span className="local-badge">LOCAL</span></div>
      <div className="header-actions"><button className="button subtle" onClick={() => fileInput.current?.click()} title="Abrir configuração JSON"><ArrowUpFromLine size={16}/><span>Abrir</span></button><button className="button save-button" onClick={download}><ArrowDownToLine size={16}/><span>Salvar projeto</span></button><button className="icon-button" aria-label="Como usar" title="Como usar" onClick={() => helpDialog.current?.showModal()}><CircleHelp size={19}/></button></div>
      <input type="file" accept=".json,application/json" hidden ref={fileInput} onChange={e => importFile(e.target.files?.[0])} aria-label="Abrir arquivo de projeto" />
    </header>

    <aside className="sidebar" aria-label="Editor do frame">
      <div className="sidebar-intro"><div className="eyebrow"><span className="live-dot"/> EDITOR PARAMÉTRICO <span className="version">V1.2</span></div><h1>Explore a estrutura.</h1><p>Uma base comum para as ideias da equipe.</p></div>
      <div className="editor-tabs" role="tablist" aria-label="Ferramentas de edição">
        <button role="tab" aria-selected={tab === 'dimensions'} onClick={() => setTab('dimensions')}><SlidersHorizontal size={15}/>Dimensões</button>
        <button role="tab" aria-selected={tab === 'structure'} onClick={() => setTab('structure')}><Layers3 size={15}/>Estrutura</button>
        <button role="tab" aria-selected={tab === 'points'} onClick={() => { setTab('points'); setDisplay(d => ({ ...d, points: true })); }}><Move3d size={15}/>Pontos</button>
      </div>
      <div className="editor-scroll" role="tabpanel" aria-label={tab === 'dimensions' ? 'Dimensões do frame' : tab === 'structure' ? 'Estrutura e tubos' : 'Pontos do frame'}>
        {tab === 'dimensions' && <>
          <div className="section-heading"><span>01</span><h2>Proporções do frame</h2><Box size={16}/></div>
          <p className="section-caption">Medidas em milímetros. Os tubos acompanham cada alteração.</p>
          {(['rrhHeight', 'cockpitLength', 'roofLength', 'noseLength', 'rrhAngle', 'simHeight'] as ParamKey[]).map(key => field(key))}
          <div className="section-heading divider"><span>02</span><h2>Larguras</h2><Expand size={16}/></div>
          {(['baseWidth', 'topWidth', 'simWidth', 'frontWidth'] as ParamKey[]).map(key => field(key))}
          <div className="editor-note"><InfoMark/>Os controles alteram a geometria-base. Deslocamentos feitos em “Pontos” são somados a ela.</div>
        </>}
        {tab === 'structure' && <>
          <div className="section-heading"><span>01</span><h2>Pós-firewall</h2><Box size={16}/></div>
          <p className="section-caption">Configure a região traseira independentemente dos travamentos. A referência é o arco traseiro; o painel firewall não é modelado.</p>
          <button className={`switch-row ${project.rearEnabled ? 'on' : ''}`} role="switch" aria-label="Estrutura pós-firewall" aria-checked={project.rearEnabled} onClick={() => alter(prev => setRearEnabled(prev, !prev.rearEnabled))}><span><strong>Estrutura pós-firewall</strong><small>Conexões S–R, A–R e travessa R.</small></span><span className="switch-track"><span/></span></button>
          {project.rearEnabled && <>{field('rearLength')}{field('rearHeight')}{field('rearWidth')}<p className="mini-note">Para ajustes livres, edite R_L ou R_R na aba Pontos.</p></>}
          <div className="section-heading divider"><span>02</span><h2>Travamentos</h2><GitBranch size={16}/></div>
          <div className="brace-toggles">
            <button className={`switch-row ${hasFrontBracing(project) ? 'on' : ''}`} role="switch" aria-label="Travamento dianteiro" aria-checked={hasFrontBracing(project)} onClick={() => alter(prev => setBracingEnabled(prev, 'front', !hasFrontBracing(prev)))}><span><strong>Dianteiro</strong><small>Ligações Q–P e P–J.</small></span><span className="switch-track"><span/></span></button>
            <button className={`switch-row ${hasRearBracing(project) ? 'on' : ''}`} role="switch" aria-label="Travamento traseiro" aria-checked={hasRearBracing(project)} onClick={() => alter(prev => setBracingEnabled(prev, 'rear', !hasRearBracing(prev)))}><span><strong>Traseiro</strong><small>Ligações B–R.{!project.rearEnabled && ' Ativa também a estrutura traseira.'}</small></span><span className="switch-track"><span/></span></button>
          </div>
          {hasFrontBracing(project) && <details className="advanced-section" open>
            <summary><Move3d size={15}/><span>Ajustar dianteiro</span><ChevronRight size={15}/></summary>
            <div className="advanced-content">
              <p className="section-caption">Inclinação em relação ao plano horizontal, de 0° a 90°. Comprimento e ângulo movem o mesmo apoio; os limites acompanham a geometria.</p>
              <h3>Superior · Q–P</h3>{braceField('upper', 'angle')}{braceField('upper', 'length')}
              <h3>Inferior · P–J</h3>{braceField('lower', 'angle')}{braceField('lower', 'length')}
              <p className="mini-note">Referência: lado esquerdo. Os dois lados compartilham percentuais de apoio; offsets independentes podem produzir medidas diferentes.</p>
              <h3>Posição dos apoios</h3>{field('frontUpperPosition')}{field('frontSidePosition')}{field('frontFloorPosition')}
              <p className="mini-note">Q percorre C → D; P percorre S → D; J percorre A → F. Os apoios permanecem ligados aos tubos.</p>
            </div>
          </details>}
          {field('floorPosition')}
          <details className="advanced-section">
            <summary><GitBranch size={15}/><span>Tubos adicionais</span><ChevronRight size={15}/></summary>
            <div className="advanced-content">
              <p className="section-caption">Ligue dois pontos existentes. Cada tubo acompanha seus apoios e entra no cálculo de massa.</p>
              <div className="tube-selects"><label>De<select aria-label="Apoio inicial do tubo" value={tubeFrom} onChange={e => setTubeDraft(d => ({ ...d, from: e.target.value }))}>{tubePoints.map(id => <option key={id}>{id}</option>)}</select></label><label>Até<select aria-label="Apoio final do tubo" value={tubeTo} onChange={e => setTubeDraft(d => ({ ...d, to: e.target.value }))}>{tubePoints.map(id => <option key={id}>{id}</option>)}</select></label></div>
              <label className="tube-category">Categoria<select aria-label="Categoria do tubo adicional" value={tubeDraft.category} onChange={e => setTubeDraft(d => ({ ...d, category: e.target.value as ExtraTube['category'] }))}><option value="secondary">Secundário</option><option value="primary">Primário</option></select></label>
              <label className="check-row"><input type="checkbox" checked={tubeDraft.mirrored} onChange={e => setTubeDraft(d => ({ ...d, mirrored: e.target.checked }))}/>Adicionar par espelhado</label>
              <button className="button outline full" disabled={project.extraTubes.length >= 32} onClick={() => alter(prev => addExtraTube(prev, { ...tubeDraft, from: tubeFrom, to: tubeTo }))}>Adicionar tubo</button>
              <div className="extra-list">{project.extraTubes.map(t => <div key={t.id}><button onClick={() => select({ type: 'member', id: `EXTRA_${t.id}` })} disabled={!frame.members.some(m => m.id === `EXTRA_${t.id}`)}>{t.id} · {t.from} → {t.to}{t.mirrored ? ' + par' : ''}</button><button aria-label={`Remover tubo ${t.id}`} onClick={() => alter(prev => ({ ...prev, extraTubes: prev.extraTubes.filter(item => item.id !== t.id) }))}><X size={14}/></button></div>)}</div>
              <p className="mini-note">Até 32 definições. Se um apoio for ocultado, o tubo fica inativo e volta quando o apoio reaparece. Remoções podem ser desfeitas.</p>
            </div>
          </details>
          <details className="advanced-section" open={frame.interferences.length > 0}>
            <summary><AlertTriangle size={15}/><span>Encontros e interferências ({frame.interferences.length})</span><ChevronRight size={15}/></summary>
            <div className="advanced-content"><p className="section-caption">{frame.joints.length} encontros com tubos contínuos. As terminações são esquemáticas; não representam cortes de fabricação.</p>
              {frame.interferences.length === 0 ? <p className="mini-note">Nenhuma interferência entre membros detectada pelo teste de distância dos eixos.</p> : <div className="interference-list">{frame.interferences.map(issue => <div key={issue.members.join('|')}><strong>{issue.kind === 'overlap' ? 'Tubos sobrepostos' : 'Diâmetros se sobrepõem'}</strong><span>{issue.members.map(id => <button key={id} onClick={() => select({ type: 'member', id })}>{id}</button>)}</span></div>)}</div>}
            </div>
          </details>
          <div className="section-heading divider"><span>03</span><h2>Tubos e visualização</h2><Settings2 size={16}/></div>
          <details className="advanced-section">
            <summary><Settings2 size={15}/><span>Avançado</span><ChevronRight size={15}/></summary>
            <div className="advanced-content">
              <h3>Tubos primários</h3>
              {field('primaryDiameter', 'Diâmetro externo')}{field('primaryThickness', 'Espessura')}
              <h3>Tubos secundários</h3>
              {field('secondaryDiameter', 'Diâmetro externo')}{field('secondaryThickness', 'Espessura')}
              <h3>Material</h3>
              <div className="parameter-top density-field"><span>Densidade</span><div className="number-unit"><NumberInput value={project.materialDensity} label="Densidade do material (kg/m³)" min={MATERIAL_DENSITY.min} max={MATERIAL_DENSITY.max} step={MATERIAL_DENSITY.step} onCommit={n => alter(prev => ({ ...prev, materialDensity: n }))}/><span>kg/m³</span></div></div>
              <p className="mini-note">Padrão: aço, 7.850 kg/m³. Uma densidade para todo o frame.</p>
              <div className="mass-summary" aria-label="Massas estimadas">
                <span>Massa estimada do frame</span><strong data-testid="total-mass">{format(frame.totalMass, 2)} <small>kg</small></strong>
                <dl className="physical-properties"><div><dt>Primários</dt><dd data-testid="primary-mass">{format(frame.primaryMass, 2)} kg</dd></div><div><dt>Secundários</dt><dd data-testid="secondary-mass">{format(frame.secondaryMass, 2)} kg</dd></div></dl>
              </div>
              <p className="mini-note">Estimativa pela seção e pelo comprimento dos eixos. Não inclui soldas, recortes, encaixes ou correções de dobra.</p>
            </div>
          </details>
          <div className="visibility-list">
            <button onClick={() => toggle('primary')} aria-pressed={display.primary}><span className="color-dot primary"/>Membros primários {display.primary ? <Eye size={16}/> : <EyeOff size={16}/>}</button>
            <button onClick={() => toggle('secondary')} aria-pressed={display.secondary}><span className="color-dot secondary"/>Membros secundários {display.secondary ? <Eye size={16}/> : <EyeOff size={16}/>}</button>
          </div>
          <div className="section-heading divider"><span>04</span><h2>Membros do frame</h2><span className="count">{frame.members.length}</span></div>
          {member && <div className="selection-info" aria-label="Propriedades do membro selecionado"><strong>{member.id} · {member.label}</strong>
            <dl className="physical-properties">
              <div><dt>Categoria</dt><dd>{member.category === 'primary' ? 'Primário' : 'Secundário'}</dd></div>
              <div><dt>Comprimento</dt><dd>{format(member.length, 1)} mm</dd></div>
              <div><dt>Ø externo</dt><dd>{format(member.outerDiameter, 1)} mm</dd></div>
              <div><dt>Parede</dt><dd>{format(member.wallThickness, 1)} mm</dd></div>
              <div><dt>Ø interno</dt><dd>{format(member.innerDiameter, 1)} mm</dd></div>
              <div><dt>Massa estimada</dt><dd>{format(member.estimatedMass, 3)} kg</dd></div>
            </dl><small>Ligações: {member.nodes.join(' → ')}</small></div>}
          <div className="member-list">{frame.members.map(m => <button key={m.id} className={member?.id === m.id ? 'selected' : ''} onClick={() => select({ type: 'member', id: m.id })} aria-label={`Selecionar membro ${m.id}`}><span className={`color-dot ${m.category}`}/><span><strong>{m.id}</strong><small>{m.label}</small></span><span className="member-length">{format(m.length)}<small>mm</small></span></button>)}</div>
        </>}
        {tab === 'points' && <>
          <div className="section-heading"><span>01</span><h2>Editar pontos</h2><Move3d size={16}/></div>
          <p className="section-caption">Selecione um ponto. Arraste os eixos no 3D ou informe suas coordenadas.</p>
          <button className={`switch-row ${project.symmetry ? 'on' : ''}`} role="switch" aria-checked={project.symmetry} onClick={() => alter(prev => setSymmetry(prev, !prev.symmetry))}><span><strong>Simetria entre os lados</strong><small>{project.symmetry ? 'Cada ajuste é espelhado.' : 'Os lados podem ser editados separadamente.'}</small></span><span className="switch-track"><span/></span></button>
          <p className="mini-note">Ao reativar, o lado esquerdo é a referência.</p>
          <div className="point-matrix"><div className="point-matrix-head"><span>REFERÊNCIA</span><span>ESQUERDO</span><span>DIREITO</span></div>{ANCHORS.filter(n => n !== 'R' || project.rearEnabled).map(n => <div className="point-row" key={n}><span>{n}</span>{(['L', 'R'] as const).map(s => <button key={s} className={point?.id === `${n}_${s}` ? 'active' : ''} onClick={() => select({ type: 'point', id: `${n}_${s}` })} aria-label={`Ponto ${n}_${s}`}>{n}<sub>{s}</sub><Move3d size={12}/></button>)}</div>)}</div>
          {point ? <div className="point-editor">
            <div className="point-editor-title"><span className="point-badge">{point.id}</span><strong>{point.description}</strong></div>
            {point.editable ? <>
              <div className="coordinate-fields">{(['X', 'Y', 'Z'] as const).map((axis, i) => <label key={axis}><span className={`axis-${axis.toLowerCase()}`}>{axis}</span><NumberInput label={`Coordenada ${axis} de ${point.id}`} value={point.position[i]} min={i === 2 ? 0 : -3000} max={i === 2 ? 2600 : 4000} onCommit={n => alter(prev => { const next = [...point.position] as Vec3; next[i] = n; return movePoint(prev, point.id, next); })}/><small>mm</small></label>)}</div>
              <button className={`button full ${editing ? 'editing-active' : 'outline'}`} aria-pressed={editing} onClick={() => setEditing(!editing)}><Move3d size={16}/>{editing ? 'Eixos 3D ativados' : 'Ativar eixos 3D'}</button>
              <label className="check-row"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)}/>Mover em passos de 10 mm</label>
              <button className="text-button" onClick={() => alter(prev => { const offsets = { ...prev.offsets }; delete offsets[point.id]; if (prev.symmetry) delete offsets[point.id.endsWith('_L') ? point.id.replace(/_L$/, '_R') : point.id.replace(/_R$/, '_L')]; return { ...prev, offsets }; })}><RotateCcw size={13}/>Restaurar este ponto</button>
            </> : <p className="section-caption">Ponto vinculado: acompanha seus tubos de apoio. Edite as extremidades ou a posição da travessa.</p>}
          </div> : <div className="empty-selection"><MousePointer2 size={24}/><p>Escolha um ponto acima<br/>ou clique no modelo.</p></div>}
          <button className="text-button reset-local" disabled={!Object.values(project.offsets).some(v => v.some(n => n !== 0))} onClick={() => alter(prev => ({ ...prev, offsets: {} }))}><RotateCcw size={13}/>Remover todos os ajustes locais</button>
        </>}
      </div>
      <div className="sidebar-footer"><span><span className="live-dot"/> {saved}</span><button className="text-button" onClick={() => resetDialog.current?.showModal()} title="Restaurar configuração inicial"><RotateCcw size={13}/>Reiniciar</button></div>
    </aside>

    <main className="workspace" aria-label="Estúdio 3D">
      <div className="workspace-toolbar"><div className="toolbar-left"><button className="icon-button" aria-label={sidebar ? 'Recolher editor' : 'Mostrar editor'} onClick={() => setSidebar(!sidebar)}>{sidebar ? <PanelLeftClose size={18}/> : <PanelLeftOpen size={18}/>}</button><span className="toolbar-separator"/><div className="view-switch" aria-label="Vistas do frame">{([['perspective', '3D'], ['side', 'Lateral'], ['top', 'Superior'], ['front', 'Frontal']] as const).map(([value, label]) => <button aria-pressed={view === value} className={view === value ? 'active' : ''} key={value} onClick={() => setView(value)}>{value === 'perspective' && <Box size={14}/>} {label}</button>)}</div></div><div className="toolbar-actions"><button className="icon-button" aria-label="Desfazer" title="Desfazer · Ctrl+Z" disabled={!undo.current.length} onClick={undoAction}><Undo2 size={17}/></button><button className="icon-button" aria-label="Refazer" title="Refazer · Ctrl+Shift+Z" disabled={!redo.current.length} onClick={redoAction}><Redo2 size={17}/></button><span className="toolbar-separator"/><button className="icon-button" aria-label="Enquadrar frame" title="Enquadrar frame" onClick={() => setFitCounter(n => n + 1)}><Focus size={19}/></button></div></div>
      <div className="stage">
        <Viewport frame={frame} display={display} selection={selection} view={view} fitCounter={fitCounter} editing={editing} snap={snap} onSelect={select} onMove={(id, p) => alter(prev => movePoint(prev, id, p))} onBegin={begin} onEnd={end} onReady={setReady}/>
        <div className="stage-heading"><div className="eyebrow">FRAME / ESTUDO GEOMÉTRICO</div><h2>{project.bracing === 'rear' ? 'Travamento traseiro' : project.bracing === 'front' ? 'Travamento dianteiro' : project.bracing === 'both' ? 'Travamento combinado' : 'Sem travamentos adicionais'}</h2><p><span className={`status-dot ${ready ? 'ready' : ''}`}/>{ready ? 'Visualização em tempo real' : 'Preparando visualização'}<span className="stage-dot">·</span>{project.symmetry ? 'Pontos simétricos' : 'Edição independente'}</p></div>
        <div className="display-tools" aria-label="Opções de visualização"><button aria-pressed={display.points} onClick={() => toggle('points')} title="Mostrar pontos"><Move3d size={16}/><span>Pontos</span></button><button aria-pressed={display.labels} onClick={() => toggle('labels')} title="Mostrar nomes dos pontos"><span className="label-icon">A</span><span>Nomes</span></button><button aria-pressed={display.dimensions} onClick={() => toggle('dimensions')} title="Dimensões entre eixos"><Maximize2 size={15}/><span>Cotas</span></button><button aria-pressed={display.wireframe} onClick={() => toggle('wireframe')} title="Mostrar linhas de centro"><GitBranch size={15}/><span>Eixos</span></button></div>
        <div className="stage-legend"><span><i className="color-dot primary"/>Primários</span><span><i className="color-dot secondary"/>Secundários</span>{display.points && <span><i className="color-dot point"/>Pontos</span>}</div>
        <div className="axis-key"><span className="axis-x">X <small>frente</small></span><span className="axis-y">Y <small>esquerda</small></span><span className="axis-z">Z <small>cima</small></span></div>
        {frame.warnings.length > 0 && <div className="geometry-notice"><AlertTriangle size={14}/><span>{frame.warnings[0]}</span>{frame.warnings.length > 1 && <span title={frame.warnings.slice(1).join('\n')}>+{frame.warnings.length - 1}</span>}</div>}
      </div>
      <div className="metrics" aria-label="Medidas atuais do frame"><div><span>COMPRIMENTO</span><strong data-testid="length">{format(frame.bounds.size[0])}<small>mm</small></strong></div><div><span>LARGURA</span><strong data-testid="width">{format(frame.bounds.size[1])}<small>mm</small></strong></div><div><span>ALTURA</span><strong data-testid="height">{format(frame.bounds.size[2])}<small>mm</small></strong></div><div><span>MEMBROS</span><strong data-testid="members">{frame.members.length}<small>no frame</small></strong></div><div className="tube-metric"><span>COMPRIMENTO DOS EIXOS</span><strong>{format(frame.totalLength / 1000, 2)}<small>m</small></strong></div></div>
      <footer className="workspace-footer"><span><MousePointer2 size={13}/><span>Arraste para girar · roda para zoom · botão direito para deslocar</span></span><span>Dimensões entre eixos · esboço visual</span></footer>
    </main>
    {toast && <div className="toast" role="status"><Check size={17}/><span>{toast}</span><button aria-label="Fechar aviso" onClick={() => setToast('')}><X size={15}/></button></div>}
    <dialog ref={helpDialog} className="help-dialog"><div className="dialog-top"><span className="eyebrow">GUIA RÁPIDO</span><button className="icon-button" aria-label="Fechar ajuda" onClick={() => helpDialog.current?.close()}><X size={20}/></button></div><h2>Um frame. Muitas possibilidades.</h2><p>Explore a estrutura com a equipe. Tudo funciona localmente, sem conta e sem envio de dados.</p><ol><li><strong>Ajuste as dimensões.</strong> Use os sliders ou digite uma medida e pressione Enter. Os pontos e tubos acompanham a mudança.</li><li><strong>Compare os travamentos.</strong> Em “Estrutura”, alterne o arranjo e a visibilidade. Abra “Avançado” para editar diâmetros, paredes e densidade e consultar a massa estimada.</li><li><strong>Edite pontos no espaço.</strong> Selecione um ponto em “Pontos”. Arraste uma seta colorida ou informe X, Y e Z. Com simetria, o outro lado acompanha.</li><li><strong>Guarde e compartilhe.</strong> “Salvar projeto” baixa um JSON. Outra pessoa pode usar “Abrir” no seu próprio visualizador. Ctrl+Z desfaz alterações.</li></ol><div className="help-note">Este é um esboço visual da estrutura. Os tubos são representados pelo diâmetro externo; o interior oco, curvas, cortes e soldas não são desenhados. A parede e a densidade servem à estimativa de massa. Encontros dos eixos são conectados e têm terminações visuais esquemáticas. A lista de interferências aponta aproximações sem conexão; nenhuma dessas representações detalha uma junta fabricada. As cotas são entre eixos. Não há validação de conformidade regulamentar ou análise estrutural.</div><p className="mini-note">Arquivo portátil: abra <strong>BajaFrame.html</strong> em um navegador moderno. Internet não é necessária. O salvamento automático depende do armazenamento local do navegador; mantenha um JSON para transportar o projeto.</p><button className="button dark full" onClick={() => helpDialog.current?.close()}>Entendi, explorar o frame<ChevronRight size={16}/></button></dialog>
    <dialog ref={resetDialog} className="reset-dialog"><h2>Voltar ao frame inicial?</h2><p>As medidas e os ajustes locais serão restaurados. Você poderá desfazer essa ação.</p><div className="dialog-actions"><button className="button outline" onClick={() => resetDialog.current?.close()}>Cancelar</button><button className="button dark" onClick={() => { alter(() => initialProject()); setSelection(null); setView('perspective'); setFitCounter(n => n + 1); resetDialog.current?.close(); }}>Restaurar frame</button></div></dialog>
    <span className="sr-only" aria-live="polite">{historyRevision > 0 ? 'Configuração atualizada.' : ''}</span>
  </div>;
}

function InfoMark() { return <CircleHelp size={16} style={{ flexShrink: 0 }}/>; }
