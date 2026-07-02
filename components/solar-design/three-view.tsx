"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useDesignStore } from "@/lib/solar-design/store";
import { detectFaces, faceCoords } from "@/lib/solar-design/faces";
import { FACE_COLORS } from "@/lib/solar-design/types";

/**
 * 3B görünüm — çatı çizimi (nokta yükseklikleriyle) + paneller + uydu zemini.
 * Fare ile orbit (döndür), tekerlek (zoom), sağ tık (pan). Three.js OrbitControls.
 */
export default function ThreeView() {
  const doc = useDesignStore((s) => s.active)!;
  const wrapRef = useRef<HTMLDivElement>(null);

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

    // Uydu zemini
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
    const zById = new Map(doc.nodes.map((n) => [n.id, n.z || 0]));

    // Yüzeyler
    faces.forEach((f, i) => {
      const coords = faceCoords(f, doc.nodes);
      if (coords.length < 3) return;
      const pts3 = f.nodes.map((id) => {
        const n = doc.nodes.find((x) => x.id === id)!;
        const w = toWorld(n.x, n.y);
        return new THREE.Vector3(w.x, (n.z || 0) + 0.03, w.z);
      });
      // merkez üzerinden fan üçgenleme
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
      const col = new THREE.Color(FACE_COLORS[i % FACE_COLORS.length]);
      const mat = new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.5, roughness: 0.9 });
      scene.add(new THREE.Mesh(geo, mat));
    });

    // Kenarlar
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x0f172a });
    doc.edges.forEach((e) => {
      const a = doc.nodes.find((n) => n.id === e.a);
      const b = doc.nodes.find((n) => n.id === e.b);
      if (!a || !b) return;
      const wa = toWorld(a.x, a.y);
      const wb = toWorld(b.x, b.y);
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(wa.x, (a.z || 0) + 0.05, wa.z),
        new THREE.Vector3(wb.x, (b.z || 0) + 0.05, wb.z),
      ]);
      scene.add(new THREE.Line(g, edgeMat));
    });

    // Panel yüzey düzlemi (yükseklik enterpolasyonu için)
    function planeYFn(sig: string): (x: number, z: number) => number {
      const f = faces.find((ff) => ff.sig === sig);
      if (!f) return () => 0;
      const p3 = f.nodes.map((id) => {
        const n = doc.nodes.find((x) => x.id === id)!;
        const w = toWorld(n.x, n.y);
        return new THREE.Vector3(w.x, n.z || 0, w.z);
      });
      if (p3.length < 3) { const avg = p3.reduce((s, p) => s + p.y, 0) / (p3.length || 1); return () => avg; }
      const P0 = p3[0], v1 = p3[1].clone().sub(P0), v2 = p3[2].clone().sub(P0);
      const nrm = v1.clone().cross(v2);
      if (Math.abs(nrm.y) < 1e-6) { const avg = p3.reduce((s, p) => s + p.y, 0) / p3.length; return () => avg; }
      return (x: number, z: number) => P0.y - (nrm.x * (x - P0.x) + nrm.z * (z - P0.z)) / nrm.y;
    }
    const planeCache = new Map<string, (x: number, z: number) => number>();
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0b1e3f, metalness: 0.3, roughness: 0.35, side: THREE.DoubleSide });
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
      scene.add(new THREE.Mesh(geo, panelMat));
    });

    // Kamera & kontrol
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    const span = Math.max(20, (xs.length ? (Math.max(...xs) - Math.min(...xs)) : 400) * mpp);
    camera.position.set(span * 0.7, span * 0.9, span * 0.9);
    controls.update();

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
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.nodes, doc.edges, doc.placed, doc.imageDataUrl, doc.metersPerPixel]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-slate-200">
      <div ref={wrapRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/85 px-2 py-1 text-[10px] text-slate-500 shadow-sm">
        Sol tık: döndür · Tekerlek: zoom · Sağ tık: kaydır
      </div>
    </div>
  );
}
