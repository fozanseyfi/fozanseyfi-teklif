"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useDesignStore } from "@/lib/solar-design/store";
import { massRoof } from "@/lib/solar-design/roof-model";
import { pointInPolygon } from "@/lib/solar-design/geometry";
import { FACE_COLORS } from "@/lib/solar-design/types";

/**
 * 3B bina — kompoze kütle modeli. Çatılara UYDU DOKUSU yansıtılır (resim kalkmış
 * gibi); duvarlar opak (içerisi görünmez); aynı seviyedeki kütleler otomatik
 * BİRLEŞİR (iç duvarlar gizlenir → tek bina). Paneller çatı düzlemlerine oturur.
 */
export default function ThreeView() {
  const doc = useDesignStore((s) => s.active)!;
  const wrapRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [labelsOn, setLabelsOn] = useState(true);

  const mpp = doc.metersPerPixel || 0.05;
  const built = useMemo(
    () => doc.masses.map((m) => ({ mass: m, roof: massRoof(m, mpp) })),
    [doc.masses, mpp],
  );

  useEffect(() => {
    if (labelsRef.current) labelsRef.current.style.display = labelsOn ? "" : "none";
  }, [labelsOn]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe7ef);
    const camera = new THREE.PerspectiveCamera(55, wrap.clientWidth / wrap.clientHeight, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    wrap.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(60, 120, 40);
    scene.add(sun);

    const allPts = built.flatMap((b) => b.mass.footprint);
    const xs = allPts.map((p) => p.x), ys = allPts.map((p) => p.y);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
    const span = Math.max(20, (xs.length ? Math.max(...xs) - Math.min(...xs) : 400) * mpp);
    const toWorld = (x: number, y: number) => ({ x: (x - cx) * mpp, z: (y - cy) * mpp });

    // Opak duvar (içerisi görünmez), çizgi, panel, çerçeve
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.9, side: THREE.DoubleSide });
    const parapetMat = new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.9, side: THREE.DoubleSide });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0f172a });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0b1e3f, metalness: 0.3, roughness: 0.35, side: THREE.DoubleSide });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide });
    const disposables: THREE.Material[] = [wallMat, parapetMat, lineMat, panelMat, frameMat];
    const planeIndex = new Map<string, { z: (x: number, y: number) => number; poly: { x: number; y: number }[] }>();
    const faceLabels: { el: HTMLDivElement; cxp: number; cyp: number; z: number }[] = [];

    const addMesh = (positions: number[], mat: THREE.Material, uvs?: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      if (uvs) g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, mat));
    };
    const addQuad = (v: THREE.Vector3[], mat: THREE.Material) => addMesh([v[0], v[1], v[2], v[0], v[2], v[3]].flatMap((q) => [q.x, q.y, q.z]), mat);

    function buildAll(tex: THREE.Texture | null, imgW: number, imgH: number) {
      if (tex && imgW) {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(imgW * mpp, imgH * mpp), new THREE.MeshBasicMaterial({ map: tex }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set((imgW / 2 - cx) * mpp, -0.02, (imgH / 2 - cy) * mpp);
        scene.add(ground);
      }
      const roofTexMat = tex ? new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }) : null;
      if (roofTexMat) disposables.push(roofTexMat);
      const dormerMat = new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.9, side: THREE.DoubleSide });
      disposables.push(dormerMat);
      const uvOf = (x: number, y: number) => [x / imgW, 1 - y / imgH];

      let colorI = 0;
      built.forEach(({ mass, roof }) => {
        const eavesM = roof.eavesM;
        const bnd = roof.boundary;
        const siblings = built.filter((b) => (b.mass.parentId ?? null) === (mass.parentId ?? null) && b.mass.id !== mass.id).map((b) => b.mass);
        const cxb = bnd.reduce((s, p) => s + p.x, 0) / (bnd.length || 1);
        const cyb = bnd.reduce((s, p) => s + p.y, 0) / (bnd.length || 1);
        // Bir kenar "iç" sayılır: kenarın DIŞ tarafı (komşuya bakan yüz) bir kardeş
        // kütlenin içindeyse → bitişik/örtüşen paylaşılan duvar gizlenir (combine).
        const isInternal = (a: { x: number; y: number }, b: { x: number; y: number }) => {
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          let nx = b.y - a.y, ny = -(b.x - a.x);
          const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
          if ((mid.x - cxb) * nx + (mid.y - cyb) * ny < 0) { nx = -nx; ny = -ny; }
          const probe = { x: mid.x + nx * 4, y: mid.y + ny * 4 };
          return siblings.some((s) => pointInPolygon(probe, s.footprint) || pointInPolygon(mid, s.footprint));
        };
        // Duvarlar (iç/paylaşılan kenarlar gizlenir → combine)
        if (bnd.length >= 2) {
          const wp: number[] = [];
          for (let i = 0; i < bnd.length; i++) {
            const a = bnd[i], b = bnd[(i + 1) % bnd.length];
            if (isInternal(a, b)) continue;
            const wa = toWorld(a.x, a.y), wb = toWorld(b.x, b.y);
            const za = roof.boundaryZ(a), zb = roof.boundaryZ(b);
            wp.push(wa.x, mass.baseM, wa.z, wb.x, mass.baseM, wb.z, wb.x, zb, wb.z, wa.x, mass.baseM, wa.z, wb.x, zb, wb.z, wa.x, za, wa.z);
          }
          if (wp.length) addMesh(wp, wallMat);
        }
        // Parapet (düz çatı kenar duvarı)
        if (mass.parapet && mass.roofType === "flat" && !mass.roofEditable && mass.parapetM > 0 && bnd.length >= 2) {
          const pp: number[] = [];
          for (let i = 0; i < bnd.length; i++) {
            const a = bnd[i], b = bnd[(i + 1) % bnd.length];
            if (isInternal(a, b)) continue;
            const wa = toWorld(a.x, a.y), wb = toWorld(b.x, b.y), top = eavesM + mass.parapetM;
            pp.push(wa.x, eavesM, wa.z, wb.x, eavesM, wb.z, wb.x, top, wb.z, wa.x, eavesM, wa.z, wb.x, top, wb.z, wa.x, top, wa.z);
          }
          if (pp.length) addMesh(pp, parapetMat);
        }
        // Çatı yüzeyleri — uydu dokusu (ya da renk) + kenar çizgisi + etiket
        roof.faces.forEach((face) => {
          const pts = face.poly;
          if (pts.length < 3) return;
          const cxp = pts.reduce((s, p) => s + p.x, 0) / pts.length;
          const cyp = pts.reduce((s, p) => s + p.y, 0) / pts.length;
          const w3 = pts.map((p) => { const w = toWorld(p.x, p.y); return new THREE.Vector3(w.x, face.zAbs(p.x, p.y) + 0.02, w.z); });
          const wc = toWorld(cxp, cyp);
          const center = new THREE.Vector3(wc.x, face.zAbs(cxp, cyp) + 0.02, wc.z);
          const positions: number[] = [];
          const uvs: number[] = [];
          for (let k = 0; k < w3.length; k++) {
            const a = w3[k], b = w3[(k + 1) % w3.length];
            const pa = pts[k], pb = pts[(k + 1) % pts.length];
            positions.push(center.x, center.y, center.z, a.x, a.y, a.z, b.x, b.y, b.z);
            if (roofTexMat) uvs.push(...uvOf(cxp, cyp), ...uvOf(pa.x, pa.y), ...uvOf(pb.x, pb.y));
          }
          let mat: THREE.Material;
          if (roofTexMat) mat = roofTexMat;
          else { mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(FACE_COLORS[colorI++ % FACE_COLORS.length]), side: THREE.DoubleSide, roughness: 0.9 }); disposables.push(mat); }
          addMesh(positions, mat, roofTexMat ? uvs : undefined);
          const loop = [...w3.map((v) => v.clone().setY(v.y + 0.03)), w3[0].clone().setY(w3[0].y + 0.03)];
          scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(loop), lineMat));
          planeIndex.set(`${mass.id}:${face.id}`, { z: face.zAbs, poly: face.poly });
          const el = document.createElement("div");
          el.className = "pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-md bg-slate-900/85 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm ring-1 ring-white/10";
          el.textContent = built.length > 1 ? `${mass.name} · ${face.name}` : face.name;
          labelsRef.current?.appendChild(el);
          faceLabels.push({ el, cxp, cyp, z: face.zAbs(cxp, cyp) });
        });

        // Dormerlar — çatı yüzeyine oturan (eğimi izleyen) küçük çatı çıkıntısı.
        // Yerel: x=genişlik, y=derinlik (+y ÖN/oluk yönü, -y ARKA/ana çatıya gömülü).
        // Sırt sırt (rH) yükseklikte; arka AÇIK (ana çatıya kaynaşır) → yarım dormer.
        mass.dormers.forEach((dm) => {
          if (dm.widthM <= 0 || dm.depthM <= 0) return;
          const face0 = roof.faces.find((f) => pointInPolygon({ x: dm.x, y: dm.y }, f.poly));
          const hw = dm.widthM / 2 / mpp, hd = dm.depthM / 2 / mpp;
          const ang = ((dm.dirDeg || 0) * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
          const cpx = (lx: number, ly: number) => ({ x: dm.x + lx * ca - ly * sa, y: dm.y + lx * sa + ly * ca });
          const P = (lx: number, ly: number, h: number): number[] => { const q = cpx(lx, ly); const w = toWorld(q.x, q.y); return [w.x, h, w.z]; };
          const quad = (a: number[], b: number[], c: number[], d: number[]) => [...a, ...b, ...c, ...a, ...c, ...d];
          const tri = (a: number[], b: number[], c: number[]) => [...a, ...b, ...c];
          const pos: number[] = [];
          const zc = face0 ? face0.zAbs(dm.x, dm.y) : roof.eavesM; // saçak = çatı yüzeyi kotu
          const base = mass.baseM; // taban = zemin kotu → duvarlar zeminden yükselir
          const eaveH = zc, ridgeH = zc + dm.ridgeM;
          const ry = Math.max(-hd, Math.min(hd, (dm.ridgeYM || 0) / mpp)); // sırt orta noktası (y)
          const dl = (a: number[], b: number[]) => scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2])]), lineMat));
          if (dm.type === "shed") {
            pos.push(...quad(P(-hw, hd, eaveH), P(hw, hd, eaveH), P(hw, -hd, ridgeH), P(-hw, -hd, ridgeH))); // tek eğim çatı
            pos.push(...quad(P(-hw, hd, base), P(hw, hd, base), P(hw, hd, eaveH), P(-hw, hd, eaveH))); // ön duvar
            pos.push(...quad(P(-hw, -hd, base), P(hw, -hd, base), P(hw, -hd, ridgeH), P(-hw, -hd, ridgeH))); // arka duvar (yüksek)
            pos.push(...quad(P(-hw, hd, base), P(-hw, -hd, base), P(-hw, -hd, ridgeH), P(-hw, hd, eaveH))); // sol
            pos.push(...quad(P(hw, hd, base), P(hw, -hd, base), P(hw, -hd, ridgeH), P(hw, hd, eaveH))); // sağ
            dl(P(-hw, -hd, ridgeH), P(hw, -hd, ridgeH));
          } else {
            // 4 duvar (zeminden saçağa)
            pos.push(...quad(P(-hw, hd, base), P(hw, hd, base), P(hw, hd, eaveH), P(-hw, hd, eaveH)));
            pos.push(...quad(P(-hw, -hd, base), P(hw, -hd, base), P(hw, -hd, eaveH), P(-hw, -hd, eaveH)));
            pos.push(...quad(P(-hw, hd, base), P(-hw, -hd, base), P(-hw, -hd, eaveH), P(-hw, hd, eaveH)));
            pos.push(...quad(P(hw, hd, base), P(hw, -hd, base), P(hw, -hd, eaveH), P(hw, hd, eaveH)));
            const rt = dm.type === "hip" ? hw * 0.3 : hw; // beşik: sırt tam genişlik; kırma: kısa sırt
            pos.push(...quad(P(-hw, hd, eaveH), P(hw, hd, eaveH), P(rt, ry, ridgeH), P(-rt, ry, ridgeH))); // ön eğim
            pos.push(...quad(P(-hw, -hd, eaveH), P(hw, -hd, eaveH), P(rt, ry, ridgeH), P(-rt, ry, ridgeH))); // arka eğim
            pos.push(...tri(P(-hw, hd, eaveH), P(-hw, -hd, eaveH), P(-rt, ry, ridgeH))); // sol (beşik alınlık / kırma hip yüzü)
            pos.push(...tri(P(hw, hd, eaveH), P(hw, -hd, eaveH), P(rt, ry, ridgeH))); // sağ
            dl(P(-rt, ry, ridgeH), P(rt, ry, ridgeH)); // sırt
            if (dm.type === "hip") { dl(P(-hw, hd, eaveH), P(-rt, ry, ridgeH)); dl(P(hw, hd, eaveH), P(rt, ry, ridgeH)); dl(P(-hw, -hd, eaveH), P(-rt, ry, ridgeH)); dl(P(hw, -hd, eaveH), P(rt, ry, ridgeH)); }
          }
          addMesh(pos, dormerMat);
          dl(P(-hw, hd, eaveH), P(hw, hd, eaveH));
          dl(P(-hw, -hd, eaveH), P(hw, -hd, eaveH));
        });
      });

      // Engeller (baca/pencere) — kırmızı bloklar; oturdukları çatı yüzeyinden yükselir
      if (doc.obstacles.length) {
        const obsMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.85, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
        disposables.push(obsMat);
        doc.obstacles.forEach((o) => {
          if (o.poly.length < 3) return;
          const ox = o.poly.reduce((s, p) => s + p.x, 0) / o.poly.length;
          const oy = o.poly.reduce((s, p) => s + p.y, 0) / o.poly.length;
          let zBase = 0;
          for (const b of built) { const f = b.roof.faces.find((ff) => pointInPolygon({ x: ox, y: oy }, ff.poly)); if (f) { zBase = f.zAbs(ox, oy); break; } }
          const top = zBase + (o.heightM || 1);
          const wp: number[] = [];
          for (let i = 0; i < o.poly.length; i++) {
            const a = o.poly[i], b = o.poly[(i + 1) % o.poly.length];
            const wa = toWorld(a.x, a.y), wb = toWorld(b.x, b.y);
            wp.push(wa.x, zBase, wa.z, wb.x, zBase, wb.z, wb.x, top, wb.z, wa.x, zBase, wa.z, wb.x, top, wb.z, wa.x, top, wa.z);
          }
          addMesh(wp, obsMat);
          const capC = toWorld(ox, oy);
          const cap: number[] = [];
          for (let i = 0; i < o.poly.length; i++) {
            const a = o.poly[i], b = o.poly[(i + 1) % o.poly.length];
            const wa = toWorld(a.x, a.y), wb = toWorld(b.x, b.y);
            cap.push(capC.x, top, capC.z, wa.x, top, wa.z, wb.x, top, wb.z);
          }
          addMesh(cap, obsMat);
        });
      }

      // Paneller — düzleme oturur; poligon dışına taşan köşe varsa çizme
      doc.placed.forEach((p) => {
        const pl = planeIndex.get(p.face);
        if (!pl) return;
        const rad = (p.rotationDeg * Math.PI) / 180, cr = Math.cos(rad), sr = Math.sin(rad);
        const corner = (lxo: number, lyo: number): THREE.Vector3 | null => {
          const lx = p.x + lxo * cr - lyo * sr, ly = p.y + lxo * sr + lyo * cr;
          if (!pointInPolygon({ x: lx, y: ly }, pl.poly)) return null;
          const w = toWorld(lx, ly);
          return new THREE.Vector3(w.x, pl.z(lx, ly) + 0.12, w.z);
        };
        const outer = [corner(0, 0), corner(p.w, 0), corner(p.w, p.h), corner(0, p.h)];
        if (outer.some((v) => v === null)) return;
        const fr = Math.min(p.w, p.h) * 0.06;
        const inner = [corner(fr, fr), corner(p.w - fr, fr), corner(p.w - fr, p.h - fr), corner(fr, p.h - fr)];
        if (inner.some((v) => v === null)) return;
        addQuad(outer as THREE.Vector3[], frameMat);
        addQuad((inner as THREE.Vector3[]).map((v) => v.clone().setY(v.y + 0.02)), panelMat);
      });

      if (infoRef.current) infoRef.current.textContent = built.length ? `${built.length} kütle · ${doc.placed.length} panel` : "Bina hattı çizin";
    }

    if (doc.imageDataUrl) {
      const im = new window.Image();
      im.onload = () => {
        const tex = new THREE.Texture(im);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        buildAll(tex, im.width, im.height);
      };
      im.src = doc.imageDataUrl;
    } else {
      buildAll(null, 0, 0);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    if (camRef.current) { camera.position.copy(camRef.current.pos); controls.target.copy(camRef.current.target); }
    else { camera.position.set(span * 0.7, span * 0.9, span * 0.9); controls.target.set(0, 0, 0); }
    controls.update();
    controls.addEventListener("change", () => { camRef.current = { pos: camera.position.clone(), target: controls.target.clone() }; });

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
      disposables.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, doc.imageDataUrl, doc.metersPerPixel, doc.placed]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-slate-200">
      <div ref={wrapRef} className="h-full w-full" />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <div ref={infoRef} className="pointer-events-none absolute left-2 top-2 rounded-md bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm" />
      <button type="button" onClick={() => setLabelsOn((v) => !v)} className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-white">
        {labelsOn ? "Etiketleri gizle" : "Etiketleri göster"}
      </button>
      <div className="pointer-events-none absolute bottom-2 right-2 max-w-[92%] rounded-md bg-white/85 px-2 py-1 text-[10px] text-slate-500 shadow-sm">
        Çatı = uydu görüntüsü (kalkmış) · aynı seviye kütleler birleşir · Sol tık döndür · Tekerlek zoom · Sağ tık kaydır
      </div>
    </div>
  );
}
