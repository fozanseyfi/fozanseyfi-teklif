"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useDesignStore } from "@/lib/solar-design/store";
import { detectFaces, detectOuterBoundary, faceCoords } from "@/lib/solar-design/faces";
import { FACE_COLORS } from "@/lib/solar-design/types";
import type { RNode } from "@/lib/solar-design/types";

/**
 * 3B görünüm — çatı + cephe (duvarlar) + paneller + uydu zemini.
 * Bina yüksekliği (baseHeight): çatıyı ya da tepedeki tutamacı fareyle yukarı/aşağı
 * çekerek verilir; bırakınca kaydedilir. Duvarlar zeminden çatı hattına yükselir.
 * Fare: sol tık orbit, tekerlek zoom, sağ tık pan (Three.js OrbitControls).
 */
export default function ThreeView() {
  const doc = useDesignStore((s) => s.active)!;
  const update = useDesignStore((s) => s.update);
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  // Kamera konumu — yeniden kurulumlarda (yükseklik değişince) sıçramayı önlemek için korunur.
  const camRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

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

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(60, 120, 40);
    scene.add(sun);

    // Koordinat merkezi: node bbox ya da görüntü merkezi
    const xs = doc.nodes.map((n) => n.x);
    const ys = doc.nodes.map((n) => n.y);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
    const toWorld = (x: number, y: number) => ({ x: (x - cx) * mpp, z: (y - cy) * mpp });

    // Uydu zemini (statik)
    if (doc.imageDataUrl) {
      const tex = new THREE.TextureLoader().load(doc.imageDataUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      const im = new window.Image();
      im.onload = () => {
        const w = im.width * mpp;
        const h = im.height * mpp;
        const geo = new THREE.PlaneGeometry(w, h);
        const mat = new THREE.MeshBasicMaterial({ map: tex });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        // Görüntü merkezi ile node merkezi farkı
        mesh.position.set((im.width / 2 - cx) * mpp, -0.02, (im.height / 2 - cy) * mpp);
        scene.add(mesh);
      };
      im.src = doc.imageDataUrl;
    }

    const faces = detectFaces(doc.nodes, doc.edges);
    const outerIds = detectOuterBoundary(doc.nodes, doc.edges);
    const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
    const maxNodeZ = doc.nodes.reduce((m, n) => Math.max(m, n.z || 0), 0);

    // Canlı bina yüksekliği (sürükleme sırasında bunu değiştirip yeniden inşa ederiz)
    let baseH = doc.baseHeight || 0;
    const zOf = (n: RNode) => baseH + (n.z || 0);

    // Yükseklikle değişen tüm meshler bu grupta; sürüklerken temizlenip yeniden dolar.
    const building = new THREE.Group();
    scene.add(building);
    const draggables: THREE.Object3D[] = [];

    // Malzemeler bir kez oluşturulur (yeniden inşada yalnız geometriler değişir).
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x0f172a });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0b1e3f, metalness: 0.3, roughness: 0.35, side: THREE.DoubleSide });
    const faceMats = faces.map((_, i) => new THREE.MeshStandardMaterial({ color: new THREE.Color(FACE_COLORS[i % FACE_COLORS.length]), side: THREE.DoubleSide, transparent: true, opacity: 0.72, roughness: 0.85 }));

    // Tepe tutamacı (çekmek için) — kalıcı, yeniden inşada yalnız konumu güncellenir.
    const span0 = Math.max(20, (xs.length ? (Math.max(...xs) - Math.min(...xs)) : 400) * mpp);
    const handleR = Math.max(0.4, span0 * 0.02);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x059669, emissive: 0x059669, emissiveIntensity: 0.55, roughness: 0.4 });
    const handle = new THREE.Mesh(new THREE.SphereGeometry(handleR, 20, 16), handleMat);
    handle.userData.draggable = true;
    const centerW = toWorld(cx, cy);
    scene.add(handle);

    function planeYFn(sig: string): (x: number, z: number) => number {
      const f = faces.find((ff) => ff.sig === sig);
      if (!f) return () => 0;
      const p3 = f.nodes.map((id) => {
        const n = nodeById.get(id)!;
        const w = toWorld(n.x, n.y);
        return new THREE.Vector3(w.x, zOf(n), w.z);
      });
      if (p3.length < 3) { const avg = p3.reduce((s, p) => s + p.y, 0) / (p3.length || 1); return () => avg; }
      const P0 = p3[0], v1 = p3[1].clone().sub(P0), v2 = p3[2].clone().sub(P0);
      const nrm = v1.clone().cross(v2);
      if (Math.abs(nrm.y) < 1e-6) { const avg = p3.reduce((s, p) => s + p.y, 0) / p3.length; return () => avg; }
      return (x: number, z: number) => P0.y - (nrm.x * (x - P0.x) + nrm.z * (z - P0.z)) / nrm.y;
    }

    function rebuild() {
      // Grubu boşalt + geometrileri serbest bırak (malzemeler korunur)
      for (const c of building.children) {
        const g = (c as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        g?.dispose?.();
      }
      building.clear();
      draggables.length = 0;

      // --- Cephe / duvarlar: dış çevreyi zeminden çatı hattına kadar yükselt ---
      if (outerIds && outerIds.length >= 2 && baseH + maxNodeZ > 0.01) {
        const wallPos: number[] = [];
        for (let i = 0; i < outerIds.length; i++) {
          const a = nodeById.get(outerIds[i]);
          const b = nodeById.get(outerIds[(i + 1) % outerIds.length]);
          if (!a || !b) continue;
          const wa = toWorld(a.x, a.y), wb = toWorld(b.x, b.y);
          const za = zOf(a), zb = zOf(b);
          const A0 = [wa.x, 0, wa.z], B0 = [wb.x, 0, wb.z];
          const Bt = [wb.x, zb, wb.z], At = [wa.x, za, wa.z];
          // iki üçgen: (A0,B0,Bt) + (A0,Bt,At)
          wallPos.push(...A0, ...B0, ...Bt, ...A0, ...Bt, ...At);
        }
        if (wallPos.length) {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
          g.computeVertexNormals();
          const wall = new THREE.Mesh(g, wallMat);
          wall.userData.draggable = true; // duvarı da tutup çekebil
          building.add(wall);
          draggables.push(wall);
        }
      }

      // --- Çatı yüzeyleri ---
      faces.forEach((f, i) => {
        const coords = faceCoords(f, doc.nodes);
        if (coords.length < 3) return;
        const pts3 = f.nodes.map((id) => {
          const n = nodeById.get(id)!;
          const w = toWorld(n.x, n.y);
          return new THREE.Vector3(w.x, zOf(n) + 0.03, w.z);
        });
        const center = pts3.reduce((a, p) => a.add(p.clone()), new THREE.Vector3()).multiplyScalar(1 / pts3.length);
        const positions: number[] = [];
        for (let k = 0; k < pts3.length; k++) {
          const a = pts3[k];
          const b = pts3[(k + 1) % pts3.length];
          positions.push(center.x, center.y, center.z, a.x, a.y, a.z, b.x, b.y, b.z);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, faceMats[i]);
        mesh.userData.draggable = true; // çatıyı tutup çek
        building.add(mesh);
        draggables.push(mesh);
      });

      // --- Kenarlar (çatı hattı) ---
      doc.edges.forEach((e) => {
        const a = nodeById.get(e.a);
        const b = nodeById.get(e.b);
        if (!a || !b) return;
        const wa = toWorld(a.x, a.y);
        const wb = toWorld(b.x, b.y);
        const g = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(wa.x, zOf(a) + 0.05, wa.z),
          new THREE.Vector3(wb.x, zOf(b) + 0.05, wb.z),
        ]);
        building.add(new THREE.Line(g, edgeMat));
      });

      // --- Paneller (çatı düzlemine oturur) ---
      const planeCache = new Map<string, (x: number, z: number) => number>();
      doc.placed.forEach((p) => {
        if (!planeCache.has(p.face)) planeCache.set(p.face, planeYFn(p.face));
        const yAt = planeCache.get(p.face)!;
        const rad = (p.rotationDeg * Math.PI) / 180;
        const corners = [
          { x: 0, y: 0 },
          { x: p.w, y: 0 },
          { x: p.w, y: p.h },
          { x: 0, y: p.h },
        ].map((c) => {
          const lx = p.x + c.x * Math.cos(rad) - c.y * Math.sin(rad);
          const ly = p.y + c.x * Math.sin(rad) + c.y * Math.cos(rad);
          const w = toWorld(lx, ly);
          return new THREE.Vector3(w.x, yAt(w.x, w.z) + 0.12, w.z);
        });
        const positions = [
          corners[0], corners[1], corners[2],
          corners[0], corners[2], corners[3],
        ].flatMap((v) => [v.x, v.y, v.z]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        building.add(new THREE.Mesh(geo, panelMat));
      });

      // Tutamacı bina tepesine konumla
      handle.position.set(centerW.x, baseH + maxNodeZ + Math.max(0.6, handleR * 2), centerW.z);
      draggables.push(handle);

      if (labelRef.current) labelRef.current.textContent = `Bina yüksekliği: ${baseH.toFixed(1)} m`;
    }
    rebuild();

    // Kamera & kontrol
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    if (camRef.current) {
      camera.position.copy(camRef.current.pos);
      controls.target.copy(camRef.current.target);
    } else {
      const span = span0;
      camera.position.set(span * 0.7, span * 0.9, span * 0.9);
      controls.target.set(0, 0, 0);
    }
    controls.update();
    controls.addEventListener("change", () => {
      camRef.current = { pos: camera.position.clone(), target: controls.target.clone() };
    });

    // --- Sürükle: çatıyı/tutamacı yukarı-aşağı çekerek bina yüksekliği ver ---
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const hitPt = new THREE.Vector3();
    let dragging = false;
    let startY = 0, startBase = 0;

    const setNDC = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };

    // Capture fazında: OrbitControls'tan önce çalışır; hedefe isabet varsa kontrolü kapat.
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      setNDC(e);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(draggables, false);
      if (!hits.length) return;
      dragging = true;
      controls.enabled = false;
      const hp = hits[0].point;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      dragPlane.setFromNormalAndCoplanarPoint(dir, hp);
      startY = hp.y;
      startBase = baseH;
      wrap.style.cursor = "ns-resize";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      setNDC(e);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(dragPlane, hitPt)) return;
      baseH = Math.min(200, Math.max(0, startBase + (hitPt.y - startY)));
      rebuild();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      controls.enabled = true;
      wrap.style.cursor = "";
      update((d) => { d.baseHeight = Math.round(baseH * 100) / 100; }, true);
    };
    renderer.domElement.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    let raf = 0;
    const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
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
      // geometrileri + malzemeleri serbest bırak
      for (const c of building.children) (c as THREE.Mesh).geometry?.dispose?.();
      handle.geometry.dispose();
      [wallMat, edgeMat, panelMat, handleMat, ...faceMats].forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.nodes, doc.edges, doc.placed, doc.imageDataUrl, doc.metersPerPixel, doc.baseHeight]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-slate-200">
      <div ref={wrapRef} className="h-full w-full" />
      <div ref={labelRef} className="pointer-events-none absolute left-2 top-2 rounded-md bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
        Bina yüksekliği: {(doc.baseHeight || 0).toFixed(1)} m
      </div>
      <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/85 px-2 py-1 text-[10px] text-slate-500 shadow-sm">
        Yeşil topu / çatıyı yukarı çek: bina yükselir · Sol tık: döndür · Tekerlek: zoom · Sağ tık: kaydır
      </div>
    </div>
  );
}
