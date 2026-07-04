"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useDesignStore } from "@/lib/solar-design/store";
import { detectOuterBoundary } from "@/lib/solar-design/faces";
import { generateRoof } from "@/lib/solar-design/roof-model";
import { pointInPolygon } from "@/lib/solar-design/geometry";
import { FACE_COLORS } from "@/lib/solar-design/types";
import type { Vec } from "@/lib/solar-design/types";

/**
 * 3B bina — parametrik çatı (roof-model) render'ı. Ayak izi (dış hat) +
 * çatı tipi/eğim'den üretilen DÜZLEMSEL çatı düzlemleri + cephe/duvarlar +
 * paneller + uydu zemini. Serbest nokta sürükleme yok; çatı parametreleri
 * sağ panelden verilir → her zaman temiz, su geçirmez model.
 */
const ROOF_LABEL: Record<string, string> = { flat: "Düz", gable: "Beşik", hip: "Kırma" };

export default function ThreeView() {
  const doc = useDesignStore((s) => s.active)!;
  const wrapRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [labelsOn, setLabelsOn] = useState(true);

  // Ayak izi (dış hat) + parametrik çatı modeli — doc değişince yeniden üretilir.
  const footprint = useMemo<Vec[]>(() => {
    const ids = detectOuterBoundary(doc.nodes, doc.edges);
    if (!ids) return [];
    const byId = new Map(doc.nodes.map((n) => [n.id, n]));
    return ids.map((id) => byId.get(id)).filter(Boolean).map((n) => ({ x: n!.x, y: n!.y }));
  }, [doc.nodes, doc.edges]);

  const model = useMemo(
    () => generateRoof(footprint, doc.roofType, doc.pitchDeg, doc.ridgeAxisDeg, doc.baseHeight || 0, doc.metersPerPixel || 0.05),
    [footprint, doc.roofType, doc.pitchDeg, doc.ridgeAxisDeg, doc.baseHeight, doc.metersPerPixel],
  );

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

    // Uydu zemini
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

    // Malzemeler
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0f172a });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0b1e3f, metalness: 0.3, roughness: 0.35, side: THREE.DoubleSide });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide });
    const planeMats = model.planes.map((_, i) => new THREE.MeshStandardMaterial({ color: new THREE.Color(FACE_COLORS[i % FACE_COLORS.length]), side: THREE.DoubleSide, transparent: true, opacity: 0.28, roughness: 0.9, depthWrite: false }));

    // Duvarlar (cephe) — ayak izi 0..sınır çatı yüksekliği
    if (footprint.length >= 2) {
      const wallPos: number[] = [];
      for (let i = 0; i < footprint.length; i++) {
        const a = footprint[i], b = footprint[(i + 1) % footprint.length];
        const wa = toWorld(a.x, a.y), wb = toWorld(b.x, b.y);
        const za = model.heightAtBoundary(a), zb = model.heightAtBoundary(b);
        wallPos.push(wa.x, 0, wa.z, wb.x, 0, wb.z, wb.x, zb, wb.z, wa.x, 0, wa.z, wb.x, zb, wb.z, wa.x, za, wa.z);
      }
      if (wallPos.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
        g.computeVertexNormals();
        scene.add(new THREE.Mesh(g, wallMat));
      }
    }

    // Çatı düzlemleri (şeffaf) + kenar çizgileri (hip/ridge görünür)
    model.planes.forEach((plane, i) => {
      const pts = plane.poly;
      if (pts.length < 3) return;
      const w3 = pts.map((p) => { const w = toWorld(p.x, p.y); return new THREE.Vector3(w.x, plane.z(p.x, p.y) + 0.02, w.z); });
      const cxp = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cyp = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const wc = toWorld(cxp, cyp);
      const center = new THREE.Vector3(wc.x, plane.z(cxp, cyp) + 0.02, wc.z);
      const positions: number[] = [];
      for (let k = 0; k < w3.length; k++) {
        const a = w3[k], b = w3[(k + 1) % w3.length];
        positions.push(center.x, center.y, center.z, a.x, a.y, a.z, b.x, b.y, b.z);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.computeVertexNormals();
      scene.add(new THREE.Mesh(geo, planeMats[i]));
      // kenar çizgileri
      const loop = [...w3.map((v) => v.clone().setY(v.y + 0.03)), w3[0].clone().setY(w3[0].y + 0.03)];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(loop), lineMat));
    });

    // Paneller — düzleme oturur (düzlemsel); poligon dışına taşan köşe varsa çizme
    const planeById = new Map(model.planes.map((p) => [p.id, p]));
    const addQuad = (v: THREE.Vector3[], yAdd: number, mat: THREE.Material) => {
      const positions = [v[0], v[1], v[2], v[0], v[2], v[3]].flatMap((q) => [q.x, q.y + yAdd, q.z]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, mat));
    };
    doc.placed.forEach((p) => {
      const plane = planeById.get(p.face);
      if (!plane) return;
      const rad = (p.rotationDeg * Math.PI) / 180, cr = Math.cos(rad), sr = Math.sin(rad);
      const corner = (lxo: number, lyo: number): THREE.Vector3 | null => {
        const lx = p.x + lxo * cr - lyo * sr;
        const ly = p.y + lxo * sr + lyo * cr;
        if (!pointInPolygon({ x: lx, y: ly }, plane.poly)) return null;
        const w = toWorld(lx, ly);
        return new THREE.Vector3(w.x, plane.z(lx, ly), w.z);
      };
      const outer = [corner(0, 0), corner(p.w, 0), corner(p.w, p.h), corner(0, p.h)];
      if (outer.some((v) => v === null)) return;
      const fr = Math.min(p.w, p.h) * 0.06;
      const inner = [corner(fr, fr), corner(p.w - fr, fr), corner(p.w - fr, p.h - fr), corner(fr, p.h - fr)];
      if (inner.some((v) => v === null)) return;
      addQuad(outer as THREE.Vector3[], 0.12, frameMat);
      addQuad(inner as THREE.Vector3[], 0.14, panelMat);
    });

    // Bölüm etiketleri (HTML overlay)
    const faceLabels = model.planes.map((plane) => {
      const el = document.createElement("div");
      el.className = "pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-md bg-slate-900/85 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm ring-1 ring-white/10";
      el.textContent = plane.name;
      labelsRef.current?.appendChild(el);
      const cxp = plane.poly.reduce((s, p) => s + p.x, 0) / plane.poly.length;
      const cyp = plane.poly.reduce((s, p) => s + p.y, 0) / plane.poly.length;
      return { el, cxp, cyp, z: plane.z(cxp, cyp) };
    });

    // Kamera & kontrol
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const span = Math.max(20, (xs.length ? Math.max(...xs) - Math.min(...xs) : 400) * mpp);
    if (camRef.current) { camera.position.copy(camRef.current.pos); controls.target.copy(camRef.current.target); }
    else { camera.position.set(span * 0.7, span * 0.9, span * 0.9); controls.target.set(0, 0, 0); }
    controls.update();
    controls.addEventListener("change", () => { camRef.current = { pos: camera.position.clone(), target: controls.target.clone() }; });

    if (infoRef.current) infoRef.current.textContent = `Çatı: ${ROOF_LABEL[doc.roofType] ?? doc.roofType} · Eğim ${doc.pitchDeg}° · Saçak ${(doc.baseHeight || 0).toFixed(1)} m`;

    const proj = new THREE.Vector3();
    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
      for (const lb of faceLabels) {
        const w = toWorld(lb.cxp, lb.cyp);
        proj.set(w.x, lb.z + 0.3, w.z).project(camera);
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
      controls.dispose();
      for (const lb of faceLabels) lb.el.remove();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      [wallMat, lineMat, panelMat, frameMat, ...planeMats].forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.nodes, doc.imageDataUrl, doc.metersPerPixel, doc.placed, model]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-slate-200">
      <div ref={wrapRef} className="h-full w-full" />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <div ref={infoRef} className="pointer-events-none absolute left-2 top-2 rounded-md bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm" />
      <button
        type="button"
        onClick={() => setLabelsOn((v) => !v)}
        className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-white"
      >
        {labelsOn ? "Etiketleri gizle" : "Etiketleri göster"}
      </button>
      <div className="pointer-events-none absolute bottom-2 right-2 max-w-[92%] rounded-md bg-white/85 px-2 py-1 text-[10px] text-slate-500 shadow-sm">
        Çatı sağ panelden ayarlanır (tip · eğim · yükseklik) · Sol tık döndür · Tekerlek zoom · Sağ tık kaydır
      </div>
    </div>
  );
}
