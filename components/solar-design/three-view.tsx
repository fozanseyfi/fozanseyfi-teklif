"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useDesignStore } from "@/lib/solar-design/store";
import { detectFaces, detectOuterBoundary, faceCoords } from "@/lib/solar-design/faces";
import { FACE_COLORS } from "@/lib/solar-design/types";
import type { RNode } from "@/lib/solar-design/types";

/**
 * 3B model — çatı bölümleri (şeffaf, uydu zemini görünür) + cephe/duvarlar +
 * paneller + uydu zemini. SketchUp benzeri yükseklik düzenleme:
 *   • Yeşil tepe topu → tüm binayı kaldır (bina/saçak yüksekliği).
 *   • Nokta topları  → tek noktayı kaldır (çatı içi yükseklik farkı).
 *   • Kenar topları  → kenarın iki ucunu birlikte kaldır.
 *   • Bölüm yüzeyi   → o çatı bölümünün tüm noktalarını birlikte kaldır.
 * Fare: sol tık orbit, tekerlek zoom, sağ tık pan.
 */
/** XZ düzleminde (a,b,c) üçgeni için P noktasının baricentrik ağırlıkları. */
function bary(
  px: number, pz: number,
  ax: number, az: number, bx: number, bz: number, cx: number, cz: number,
): { u: number; v: number; w: number } | null {
  const v0x = bx - ax, v0z = bz - az, v1x = cx - ax, v1z = cz - az, v2x = px - ax, v2z = pz - az;
  const den = v0x * v1z - v1x * v0z;
  if (Math.abs(den) < 1e-9) return null;
  const v = (v2x * v1z - v1x * v2z) / den;
  const w = (v0x * v2z - v2x * v0z) / den;
  return { u: 1 - v - w, v, w };
}

export default function ThreeView({ editable = true }: { editable?: boolean } = {}) {
  const doc = useDesignStore((s) => s.active)!;
  const update = useDesignStore((s) => s.update);
  const wrapRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [labelsOn, setLabelsOn] = useState(true);

  useEffect(() => {
    if (labelsRef.current) labelsRef.current.style.display = labelsOn ? "" : "none";
  }, [labelsOn]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const mpp = doc.metersPerPixel || 0.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe7ef);

    const camera = new THREE.PerspectiveCamera(55, wrap.clientWidth / wrap.clientHeight, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    wrap.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(60, 120, 40);
    scene.add(sun);

    const xs = doc.nodes.map((n) => n.x);
    const ys = doc.nodes.map((n) => n.y);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
    const toWorld = (x: number, y: number) => ({ x: (x - cx) * mpp, z: (y - cy) * mpp });

    // Uydu zemini (statik) — çatılar şeffaf olduğu için altından bu görünür.
    if (doc.imageDataUrl) {
      const tex = new THREE.TextureLoader().load(doc.imageDataUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      const im = new window.Image();
      im.onload = () => {
        const geo = new THREE.PlaneGeometry(im.width * mpp, im.height * mpp);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((im.width / 2 - cx) * mpp, -0.02, (im.height / 2 - cy) * mpp);
        scene.add(mesh);
      };
      im.src = doc.imageDataUrl;
    }

    const faces = detectFaces(doc.nodes, doc.edges);
    const outerIds = detectOuterBoundary(doc.nodes, doc.edges);
    const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));

    // Canlı yükseklikler — sürükleme sırasında doc'a yazmadan burada tutulur.
    let baseH = doc.baseHeight || 0;
    const liveZ = new Map<string, number>();
    const zLive = (n: RNode) => (liveZ.has(n.id) ? liveZ.get(n.id)! : n.z || 0);
    const zOf = (n: RNode) => baseH + zLive(n);
    const maxLiveZ = () => doc.nodes.reduce((m, n) => Math.max(m, zLive(n)), 0);

    const span0 = Math.max(20, (xs.length ? Math.max(...xs) - Math.min(...xs) : 400) * mpp);
    const handleR = Math.max(0.35, span0 * 0.02);

    // ── Malzemeler (bir kez) ────────────────────────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.55 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x0f172a });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0b1e3f, metalness: 0.3, roughness: 0.35, side: THREE.DoubleSide });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }); // panel beyaz çerçevesi
    // Çatı yüzeyleri şeffaf — uydudaki gerçek çatı görünsün.
    const faceMats = faces.map((_, i) => new THREE.MeshStandardMaterial({ color: new THREE.Color(FACE_COLORS[i % FACE_COLORS.length]), side: THREE.DoubleSide, transparent: true, opacity: 0.16, roughness: 0.9, depthWrite: false }));
    const buildingHandleMat = new THREE.MeshStandardMaterial({ color: 0x059669, emissive: 0x059669, emissiveIntensity: 0.55, roughness: 0.4 });
    const nodeHandleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x10b981, emissiveIntensity: 0.35, roughness: 0.4 });
    const edgeHandleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.4, roughness: 0.4 });

    // Paylaşılan geometriler
    const nodeGeo = new THREE.SphereGeometry(handleR * 0.85, 18, 14);
    const edgeGeo = new THREE.SphereGeometry(handleR * 0.65, 16, 12);
    const buildGeo = new THREE.SphereGeometry(handleR * 1.15, 22, 16);

    // ── Gruplar ─────────────────────────────────────────────────────────
    const building = new THREE.Group(); // yükseklikle değişen mesh'ler (rebuild)
    scene.add(building);
    const handleGroup = new THREE.Group(); // kalıcı tutamaçlar (yalnız konumlanır)
    scene.add(handleGroup);
    const draggables: THREE.Object3D[] = [];

    // Tutamaçlar yalnız düzenlenebilir modda (çizim + kilitsiz). Kilitliyken /
    // panel önizlemesinde salt-okunur → tutamaç yok.
    // Bina tepe topu
    const buildingHandle = new THREE.Mesh(buildGeo, buildingHandleMat);
    buildingHandle.userData = { kind: "building" };
    if (editable) handleGroup.add(buildingHandle);

    // Nokta topları
    const nodeHandles = editable
      ? doc.nodes.map((n) => {
          const m = new THREE.Mesh(nodeGeo, nodeHandleMat);
          m.userData = { kind: "node", id: n.id };
          handleGroup.add(m);
          return { mesh: m, node: n };
        })
      : [];

    // Kenar topları (orta nokta) — kenarı (çizgiyi) iki ucundan birlikte kaldırır
    const edgeHandles = editable
      ? (doc.edges
          .map((e) => {
            const a = nodeById.get(e.a);
            const b = nodeById.get(e.b);
            if (!a || !b) return null;
            const m = new THREE.Mesh(edgeGeo, edgeHandleMat);
            m.userData = { kind: "edge", a: e.a, b: e.b };
            handleGroup.add(m);
            return { mesh: m, a, b };
          })
          .filter(Boolean) as { mesh: THREE.Mesh; a: RNode; b: RNode }[])
      : [];

    // Bölüm etiketleri (HTML overlay) — her karede yeniden konumlanır.
    const faceLabels = faces.map((f, i) => {
      const el = document.createElement("div");
      el.className = "pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-md bg-slate-900/85 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm ring-1 ring-white/10";
      el.textContent = doc.faceMeta[f.sig]?.name || `Çatı Bölümü ${i + 1}`;
      labelsRef.current?.appendChild(el);
      return { el, nodeIds: f.nodes };
    });

    // Çatı bölümünün yüzey yüksekliğini örnekler — merkez-üçgen (fan) yani 3B'de
    // çizilen yüzeyin AYNISI. (x,z) bölümün dışındaysa null döner. Böylece panel
    // köşeleri gerçekten çatıya oturuyorsa yerleştirilir; taşan/boşta kalan olmaz.
    function faceSampler(sig: string): ((x: number, z: number) => number | null) | null {
      const f = faces.find((ff) => ff.sig === sig);
      if (!f) return null;
      const pts = f.nodes.map((id) => {
        const n = nodeById.get(id)!;
        const w = toWorld(n.x, n.y);
        return new THREE.Vector3(w.x, zOf(n), w.z);
      });
      if (pts.length < 3) return null;
      const C = pts.reduce((a, p) => a.add(p.clone()), new THREE.Vector3()).multiplyScalar(1 / pts.length);
      return (x: number, z: number): number | null => {
        for (let k = 0; k < pts.length; k++) {
          const b = pts[k], c = pts[(k + 1) % pts.length];
          const bc = bary(x, z, C.x, C.z, b.x, b.z, c.x, c.z);
          if (bc && bc.u >= -0.01 && bc.v >= -0.01 && bc.w >= -0.01) {
            return bc.u * C.y + bc.v * b.y + bc.w * c.y;
          }
        }
        return null;
      };
    }

    function rebuild() {
      for (const c of building.children) (c as THREE.Mesh).geometry?.dispose?.();
      building.clear();
      draggables.length = 0;

      // Duvarlar
      if (outerIds && outerIds.length >= 2 && baseH + maxLiveZ() > 0.01) {
        const wallPos: number[] = [];
        for (let i = 0; i < outerIds.length; i++) {
          const a = nodeById.get(outerIds[i]);
          const b = nodeById.get(outerIds[(i + 1) % outerIds.length]);
          if (!a || !b) continue;
          const wa = toWorld(a.x, a.y), wb = toWorld(b.x, b.y);
          const za = zOf(a), zb = zOf(b);
          wallPos.push(wa.x, 0, wa.z, wb.x, 0, wb.z, wb.x, zb, wb.z, wa.x, 0, wa.z, wb.x, zb, wb.z, wa.x, za, wa.z);
        }
        if (wallPos.length) {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
          g.computeVertexNormals();
          building.add(new THREE.Mesh(g, wallMat));
        }
      }

      // Çatı yüzeyleri (şeffaf) — tıklayıp bölümü kaldırmak için draggable
      faces.forEach((f, i) => {
        if (faceCoords(f, doc.nodes).length < 3) return;
        const pts3 = f.nodes.map((id) => {
          const n = nodeById.get(id)!;
          const w = toWorld(n.x, n.y);
          return new THREE.Vector3(w.x, zOf(n) + 0.02, w.z);
        });
        const center = pts3.reduce((a, p) => a.add(p.clone()), new THREE.Vector3()).multiplyScalar(1 / pts3.length);
        const positions: number[] = [];
        for (let k = 0; k < pts3.length; k++) {
          const a = pts3[k], b = pts3[(k + 1) % pts3.length];
          positions.push(center.x, center.y, center.z, a.x, a.y, a.z, b.x, b.y, b.z);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, faceMats[i]);
        building.add(mesh);
        if (editable) { mesh.userData = { kind: "face", nodeIds: f.nodes }; draggables.push(mesh); }
      });

      // Kenarlar
      doc.edges.forEach((e) => {
        const a = nodeById.get(e.a), b = nodeById.get(e.b);
        if (!a || !b) return;
        const wa = toWorld(a.x, a.y), wb = toWorld(b.x, b.y);
        const g = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(wa.x, zOf(a) + 0.04, wa.z),
          new THREE.Vector3(wb.x, zOf(b) + 0.04, wb.z),
        ]);
        building.add(new THREE.Line(g, edgeMat));
      });

      // Paneller — yalnız çatı yüzeyine tam oturanlar çizilir (taşan/boşta yok).
      const addQuad = (v: THREE.Vector3[], yAdd: number, mat: THREE.Material) => {
        const positions = [v[0], v[1], v[2], v[0], v[2], v[3]].flatMap((q) => [q.x, q.y + yAdd, q.z]);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        g.computeVertexNormals();
        building.add(new THREE.Mesh(g, mat));
      };
      const sampCache = new Map<string, ((x: number, z: number) => number | null) | null>();
      doc.placed.forEach((p) => {
        if (!sampCache.has(p.face)) sampCache.set(p.face, faceSampler(p.face));
        const samp = sampCache.get(p.face);
        if (!samp) return; // yüzeyi bulunmayan (yetim) panel → çizme
        const rad = (p.rotationDeg * Math.PI) / 180;
        const cosr = Math.cos(rad), sinr = Math.sin(rad);
        const corner = (lxo: number, lyo: number): THREE.Vector3 | null => {
          const lx = p.x + lxo * cosr - lyo * sinr;
          const ly = p.y + lxo * sinr + lyo * cosr;
          const w = toWorld(lx, ly);
          const y = samp(w.x, w.z);
          return y === null ? null : new THREE.Vector3(w.x, y, w.z);
        };
        const outer = [corner(0, 0), corner(p.w, 0), corner(p.w, p.h), corner(0, p.h)];
        if (outer.some((v) => v === null)) return; // köşe çatı dışında → çizme (aşmasın/değsin)
        const O = outer as THREE.Vector3[];
        // Düzlemsellik: 4. köşe ilk üçün düzleminden çok saparsa panel yüzeye tam
        // oturmuyordur (kırık/kıvrım) → çizme.
        const nrm = O[1].clone().sub(O[0]).cross(O[2].clone().sub(O[0]));
        const len = nrm.length();
        if (len > 1e-9 && Math.abs(nrm.dot(O[3].clone().sub(O[0]))) / len > 0.25) return;
        const fr = Math.min(p.w, p.h) * 0.06;
        const inner = [corner(fr, fr), corner(p.w - fr, fr), corner(p.w - fr, p.h - fr), corner(fr, p.h - fr)];
        if (inner.some((v) => v === null)) return;
        addQuad(O, 0.12, frameMat); // beyaz çerçeve (dış)
        addQuad(inner as THREE.Vector3[], 0.14, panelMat); // koyu panel (iç, hafif üstte)
      });

      // Tutamaçları konumla + draggable listesini kur (yalnız düzenlenebilir modda)
      if (editable) {
        buildingHandle.position.set(toWorld(cx, cy).x, baseH + maxLiveZ() + Math.max(0.6, handleR * 2), toWorld(cx, cy).z);
        draggables.push(buildingHandle);
        for (const nh of nodeHandles) {
          const w = toWorld(nh.node.x, nh.node.y);
          nh.mesh.position.set(w.x, zOf(nh.node), w.z);
          draggables.push(nh.mesh);
        }
        for (const eh of edgeHandles) {
          const wa = toWorld(eh.a.x, eh.a.y), wb = toWorld(eh.b.x, eh.b.y);
          eh.mesh.position.set((wa.x + wb.x) / 2, (zOf(eh.a) + zOf(eh.b)) / 2, (wa.z + wb.z) / 2);
          draggables.push(eh.mesh);
        }
      }

      if (infoRef.current) infoRef.current.textContent = `Bina yüksekliği: ${baseH.toFixed(1)} m`;
    }
    rebuild();

    // ── Kamera & kontrol ────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    if (camRef.current) {
      camera.position.copy(camRef.current.pos);
      controls.target.copy(camRef.current.target);
    } else {
      camera.position.set(span0 * 0.7, span0 * 0.9, span0 * 0.9);
      controls.target.set(0, 0, 0);
    }
    controls.update();
    controls.addEventListener("change", () => {
      camRef.current = { pos: camera.position.clone(), target: controls.target.clone() };
    });

    // ── Sürükle: yükseklik verme ────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const hitPt = new THREE.Vector3();
    type Drag =
      | { kind: "building"; startY: number; startBase: number }
      | { kind: "node"; startY: number; id: string; start: number }
      | { kind: "edge"; startY: number; a: string; b: string; startA: number; startB: number }
      | { kind: "face"; startY: number; starts: Map<string, number> };
    let drag: Drag | null = null;

    const setNDC = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const clampZ = (v: number) => Math.min(200, Math.max(0, v));

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      setNDC(e);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(draggables, false);
      if (!hits.length) return;
      const ud = hits[0].object.userData as { kind: string; id?: string; a?: string; b?: string; nodeIds?: string[] };
      const hp = hits[0].point;
      controls.enabled = false;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      dragPlane.setFromNormalAndCoplanarPoint(dir, hp);
      const startY = hp.y;
      if (ud.kind === "building") drag = { kind: "building", startY, startBase: baseH };
      else if (ud.kind === "node") { const n = nodeById.get(ud.id!)!; drag = { kind: "node", startY, id: ud.id!, start: zLive(n) }; }
      else if (ud.kind === "edge") { const a = nodeById.get(ud.a!)!, b = nodeById.get(ud.b!)!; drag = { kind: "edge", startY, a: ud.a!, b: ud.b!, startA: zLive(a), startB: zLive(b) }; }
      else if (ud.kind === "face") { const starts = new Map<string, number>(); (ud.nodeIds || []).forEach((id) => { const n = nodeById.get(id); if (n) starts.set(id, zLive(n)); }); drag = { kind: "face", startY, starts }; }
      wrap.style.cursor = "ns-resize";
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      setNDC(e);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(dragPlane, hitPt)) return;
      const dY = hitPt.y - drag.startY;
      let shown = baseH;
      if (drag.kind === "building") { baseH = clampZ(drag.startBase + dY); shown = baseH; }
      else if (drag.kind === "node") { const v = clampZ(drag.start + dY); liveZ.set(drag.id, v); shown = baseH + v; }
      else if (drag.kind === "edge") { const va = clampZ(drag.startA + dY), vb = clampZ(drag.startB + dY); liveZ.set(drag.a, va); liveZ.set(drag.b, vb); shown = baseH + Math.max(va, vb); }
      else if (drag.kind === "face") { drag.starts.forEach((s, id) => liveZ.set(id, clampZ(s + dY))); shown = baseH + Math.max(...[...drag.starts.keys()].map((id) => liveZ.get(id) || 0)); }
      rebuild();
      if (infoRef.current) infoRef.current.textContent = drag.kind === "building" ? `Bina yüksekliği: ${baseH.toFixed(1)} m` : `Yükseklik: ${shown.toFixed(1)} m`;
    };
    const onUp = () => {
      if (!drag) return;
      drag = null;
      controls.enabled = true;
      wrap.style.cursor = "";
      update((d) => {
        d.baseHeight = Math.round(baseH * 100) / 100;
        for (const n of d.nodes) if (liveZ.has(n.id)) n.z = Math.round(liveZ.get(n.id)! * 100) / 100;
      }, true);
    };
    renderer.domElement.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // ── Loop + etiket konumlama ─────────────────────────────────────────
    const proj = new THREE.Vector3();
    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      // Bölüm etiketlerini ekran koordinatına yansıt
      const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
      for (const lb of faceLabels) {
        let sx = 0, sz = 0, top = -Infinity;
        const ns = lb.nodeIds.map((id) => nodeById.get(id)).filter(Boolean) as RNode[];
        if (!ns.length) { lb.el.style.display = "none"; continue; }
        for (const n of ns) { const w = toWorld(n.x, n.y); sx += w.x; sz += w.z; top = Math.max(top, zOf(n)); }
        proj.set(sx / ns.length, top + 0.3, sz / ns.length).project(camera);
        if (proj.z > 1) { lb.el.style.display = "none"; continue; }
        lb.el.style.display = "block";
        lb.el.style.transform = `translate(-50%,-50%) translate(${(proj.x * 0.5 + 0.5) * W}px, ${(-proj.y * 0.5 + 0.5) * H}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    const ro = new ResizeObserver(() => {
      if (!wrap.clientWidth) return;
      camera.aspect = wrap.clientWidth / wrap.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    });
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      controls.dispose();
      for (const lb of faceLabels) lb.el.remove();
      for (const c of building.children) (c as THREE.Mesh).geometry?.dispose?.();
      [nodeGeo, edgeGeo, buildGeo].forEach((g) => g.dispose());
      [wallMat, edgeMat, panelMat, frameMat, buildingHandleMat, nodeHandleMat, edgeHandleMat, ...faceMats].forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.nodes, doc.edges, doc.placed, doc.imageDataUrl, doc.metersPerPixel, doc.baseHeight, doc.faceMeta, editable]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-slate-200">
      <div ref={wrapRef} className="h-full w-full" />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <div ref={infoRef} className="pointer-events-none absolute left-2 top-2 rounded-md bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
        Bina yüksekliği: {(doc.baseHeight || 0).toFixed(1)} m
      </div>
      <button
        type="button"
        onClick={() => setLabelsOn((v) => !v)}
        className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-white"
      >
        {labelsOn ? "Etiketleri gizle" : "Etiketleri göster"}
      </button>
      <div className="pointer-events-none absolute bottom-2 right-2 max-w-[92%] rounded-md bg-white/85 px-2 py-1 text-[10px] text-slate-500 shadow-sm">
        {editable
          ? "Yeşil top: bina · Nokta topu: nokta · Turuncu top: kenar (çizgi) · Bölüm yüzeyi: tüm bölüm · Sol tık döndür · Tekerlek zoom · Sağ tık kaydır"
          : "Önizleme (çatı kilitli) · Sol tık döndür · Tekerlek zoom · Sağ tık kaydır"}
      </div>
    </div>
  );
}
