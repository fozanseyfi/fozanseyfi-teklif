"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useDesignStore } from "@/lib/solar-design/store";
import { massRoof, dormerRoofFaces } from "@/lib/solar-design/roof-model";
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
        // Alt kapak (bina tabanı kapalı — altından bakınca içi boş görünmesin)
        if (bnd.length >= 3) {
          const fc: number[] = [];
          const c0 = toWorld(bnd[0].x, bnd[0].y);
          for (let i = 1; i < bnd.length - 1; i++) {
            const a = toWorld(bnd[i].x, bnd[i].y), b = toWorld(bnd[i + 1].x, bnd[i + 1].y);
            fc.push(c0.x, mass.baseM, c0.z, a.x, mass.baseM, a.z, b.x, mass.baseM, b.z);
          }
          if (fc.length) addMesh(fc, wallMat);
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

        // Dormer — ana çatıya OTURAN birleşik eklenti (ayrı bina DEĞİL). Saçak köşeleri ana çatı
        // yüzeyinin yüksekliğine oturur; sırt üzerine çıkar. Zemine inen duvar/kutu YOK.
        // Yerel: x=genişlik, y=derinlik (+y ön). Tüm kırılımlar siyah çizgi.
        const roofZAt = (x: number, y: number): number => {
          for (const f of roof.faces) if (pointInPolygon({ x, y }, f.poly)) return f.zAbs(x, y);
          return roof.boundaryZ({ x, y });
        };
        mass.dormers.forEach((dm) => {
          if (dm.widthM <= 0 || dm.depthM <= 0) return;
          dormerRoofFaces(dm, roofZAt, mass.pitchDeg, mpp).forEach((f) => planeIndex.set(`${mass.id}:${f.id}`, { z: f.zAbs, poly: f.poly })); // panel yüzeyleri
          const hw = dm.widthM / 2 / mpp, hd = dm.depthM / 2 / mpp;
          const ang = ((dm.dirDeg || 0) * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
          const WL = (lx: number, ly: number) => ({ wx: dm.x + lx * ca - ly * sa, wy: dm.y + lx * sa + ly * ca });
          const P = (lx: number, ly: number, h: number): number[] => { const { wx, wy } = WL(lx, ly); const w = toWorld(wx, wy); return [w.x, h, w.z]; };
          const rz = (lx: number, ly: number): number => { const { wx, wy } = WL(lx, ly); return roofZAt(wx, wy); }; // saçak = ana çatı yüzeyi
          const Pe = (lx: number, ly: number): number[] => P(lx, ly, rz(lx, ly)); // çatıya oturan köşe
          const UV = (lx: number, ly: number): number[] => uvOf(dm.x + lx * ca - ly * sa, dm.y + lx * sa + ly * ca);
          const dl = (a: number[], b: number[]) => scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2])]), lineMat));
          const rise = hw * mpp * Math.tan(((mass.pitchDeg || 25) * Math.PI) / 180); // eğim = bina
          const ridgeBase = Math.max(rz(-hw, hd), rz(hw, hd), rz(-hw, -hd), rz(hw, -hd));
          const ridgeH = ridgeBase + rise;
          const wpos: number[] = [], rpos: number[] = [], ruv: number[] = [];
          const wt = (a: number[], b: number[], c: number[]) => wpos.push(...a, ...b, ...c);
          // [lx,ly,h] köşeleri — h verilmezse çatı yüzeyine oturur
          const V = (c: number[]) => (c.length === 3 ? P(c[0], c[1], c[2]) : Pe(c[0], c[1]));
          const U = (c: number[]) => UV(c[0], c[1]);
          const rq = (c1: number[], c2: number[], c3: number[], c4: number[]) => { rpos.push(...V(c1), ...V(c2), ...V(c3), ...V(c1), ...V(c3), ...V(c4)); ruv.push(...U(c1), ...U(c2), ...U(c3), ...U(c1), ...U(c3), ...U(c4)); };
          const rt = (c1: number[], c2: number[], c3: number[]) => { rpos.push(...V(c1), ...V(c2), ...V(c3)); ruv.push(...U(c1), ...U(c2), ...U(c3)); };
          if (dm.type === "shed") {
            const hi = ridgeBase + 2 * rise;
            rq([-hw, hd], [hw, hd], [hw, -hd, hi], [-hw, -hd, hi]); // tek eğim
            wt(Pe(-hw, hd), Pe(-hw, -hd), P(-hw, -hd, hi)); // sol üçgen alınlık
            wt(Pe(hw, hd), Pe(hw, -hd), P(hw, -hd, hi)); // sağ üçgen alınlık
            wpos.push(...P(-hw, -hd, hi), ...P(hw, -hd, hi), ...Pe(hw, -hd), ...P(-hw, -hd, hi), ...Pe(hw, -hd), ...Pe(-hw, -hd)); // arka yüksek yüz
            dl(P(-hw, -hd, hi), P(hw, -hd, hi)); dl(Pe(-hw, hd), P(-hw, -hd, hi)); dl(Pe(hw, hd), P(hw, -hd, hi));
          } else {
            const rl = dm.type === "hip" ? (dm.ridgeHalfM != null ? Math.max(0, Math.min(hd * 0.95, dm.ridgeHalfM / mpp)) : hd * 0.6) : hd;
            const rf = rl, rb = -rl;
            rq([-hw, hd], [-hw, -hd], [0, rb, ridgeH], [0, rf, ridgeH]); // sol eğim
            rq([hw, hd], [hw, -hd], [0, rb, ridgeH], [0, rf, ridgeH]); // sağ eğim
            if (dm.type === "gable") {
              wt(Pe(-hw, hd), Pe(hw, hd), P(0, hd, ridgeH)); // ön alınlık (dikey üçgen yüz)
              wt(Pe(-hw, -hd), Pe(hw, -hd), P(0, -hd, ridgeH)); // arka alınlık
            } else {
              rt([-hw, hd], [hw, hd], [0, rf, ridgeH]); // ön hip
              rt([-hw, -hd], [hw, -hd], [0, rb, ridgeH]); // arka hip
            }
            dl(P(0, rf, ridgeH), P(0, rb, ridgeH)); // sırt
            dl(P(0, rf, ridgeH), Pe(-hw, hd)); dl(P(0, rf, ridgeH), Pe(hw, hd)); // ön mahyalar
            dl(P(0, rb, ridgeH), Pe(-hw, -hd)); dl(P(0, rb, ridgeH), Pe(hw, -hd)); // arka mahyalar
          }
          if (wpos.length) addMesh(wpos, wallMat);
          addMesh(rpos, roofTexMat ?? dormerMat, roofTexMat ? ruv : undefined);
          // saçak (dormer ↔ ana çatı birleşim/dere hattı) — siyah
          dl(Pe(-hw, hd), Pe(hw, hd)); dl(Pe(hw, hd), Pe(hw, -hd)); dl(Pe(hw, -hd), Pe(-hw, -hd)); dl(Pe(-hw, -hd), Pe(-hw, hd));
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
