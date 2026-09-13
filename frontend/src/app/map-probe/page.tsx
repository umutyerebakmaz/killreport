'use client';

/**
 * THROWAWAY SPIKE. Delete with the branch.
 *
 * Two jobs. It measured whether a plain scene graph holds 5,241 sprites plus
 * 6,959 lines (it does: counter-scale maxes at 0.60 ms), and it now carries
 * four visual treatments on the real galaxy so the look can be chosen by
 * looking rather than by description.
 */

import type { Sprite, Texture } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';

const GRAPHQL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql';

const QUERY = `{
  mapGeometry(scope: NEW_EDEN) {
    bounds { minX maxX minZ maxZ }
    nodes { systemId x z radius securityStatus }
    edges { from to }
  }
}`;

type Node = {
  systemId: number;
  x: number;
  z: number;
  radius: number;
  securityStatus: number;
};

/** Phase 1's ramp, unchanged, so the variants differ only in treatment. */
function securityTint(s: number): number {
  if (s >= 0.5) return 0x4ccf4c;
  if (s > 0.0) return 0xe8a33d;
  return 0xd24b4b;
}

type Preset = {
  key: string;
  label: string;
  note: string;
  star: 'flat' | 'glow';
  additive: boolean;
  lineAlpha: number;
  lineColor: number;
  background: number;
  vignette: boolean;
  pulse: boolean;
  minPx: number;
};

const PRESETS: Preset[] = [
  {
    key: 'baseline',
    label: '1 · Bugünkü hâli',
    note: 'Faz 1/2 ne çiziyorsa o: düz daire, security rengi, ince gri hat.',
    star: 'flat',
    additive: false,
    lineAlpha: 0.55,
    lineColor: 0x94a3b8,
    background: 0x0b0d10,
    vignette: false,
    pulse: false,
    minPx: 1.5,
  },
  {
    key: 'glow',
    label: '2 · Parlama',
    note: 'Yıldız radyal gradyan + toplamalı harman. Yoğun bölgeler kendiliğinden aydınlanıyor.',
    star: 'glow',
    additive: true,
    lineAlpha: 0.4,
    lineColor: 0x7c8da3,
    background: 0x07090c,
    vignette: false,
    pulse: false,
    minPx: 2,
  },
  {
    key: 'depth',
    label: '3 · Derinlik',
    note: 'Parlama + vinyet, hatlar geri çekilmiş. Göz merkeze gidiyor.',
    star: 'glow',
    additive: true,
    lineAlpha: 0.22,
    lineColor: 0x5b6b80,
    background: 0x05070a,
    vignette: true,
    pulse: false,
    minPx: 2,
  },
  {
    key: 'pulse',
    label: '4 · Nabız',
    note: 'Derinlik + yıldız başına faz kaymalı ışıltı. Her karede 5.241 sprite.',
    star: 'glow',
    additive: true,
    lineAlpha: 0.22,
    lineColor: 0x5b6b80,
    background: 0x05070a,
    vignette: true,
    pulse: true,
    minPx: 2,
  },
];

export default function MapProbe() {
  const host = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Record<string, string>>({});
  const [preset, setPreset] = useState(0);
  const applyPreset = useRef<(i: number) => void>(() => {});

  useEffect(() => {
    let destroy = () => {};
    let cancelled = false;

    (async () => {
      const t0 = performance.now();
      const res = await fetch(GRAPHQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY }),
      });
      const g = (await res.json()).data.mapGeometry;
      const fetchMs = performance.now() - t0;
      if (cancelled || !host.current) return;

      const PIXI = await import('pixi.js');
      const app = new PIXI.Application();
      await app.init({
        background: 0x0b0d10,
        resizeTo: host.current,
        antialias: true,
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      host.current.appendChild(app.canvas);

      // Two star textures, built once. The flat one is what ships today; the
      // glow one is a radial gradient whose falloff does the work a shader
      // would otherwise have to.
      function flatTexture(): Texture {
        const gfx = new PIXI.Graphics().circle(0, 0, 32).fill(0xffffff);
        return app.renderer.generateTexture(gfx);
      }
      function glowTexture(): Texture {
        const size = 128;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d')!;
        const grd = ctx.createRadialGradient(
          size / 2,
          size / 2,
          0,
          size / 2,
          size / 2,
          size / 2,
        );
        grd.addColorStop(0.0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.12, 'rgba(255,255,255,0.85)');
        grd.addColorStop(0.35, 'rgba(255,255,255,0.28)');
        grd.addColorStop(1.0, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, size, size);
        return PIXI.Texture.from(c);
      }
      const TEX = { flat: flatTexture(), glow: glowTexture() };
      const TEX_R = { flat: 32, glow: 64 };

      const originX = (g.bounds.minX + g.bounds.maxX) / 2;
      const originZ = (g.bounds.minZ + g.bounds.maxZ) / 2;

      // Behind everything and outside the camera, so it never pans.
      const backdrop = new PIXI.Graphics();
      app.stage.addChild(backdrop);

      const world = new PIXI.Container();
      app.stage.addChild(world);

      const buildStart = performance.now();

      const byId = new Map<number, Node>(
        g.nodes.map((n: Node) => [n.systemId, n]),
      );
      const lines = new PIXI.Graphics();
      let drawn = 0;
      for (const e of g.edges) {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) continue;
        lines.moveTo(a.x - originX, a.z - originZ);
        lines.lineTo(b.x - originX, b.z - originZ);
        drawn++;
      }
      world.addChild(lines);

      const systems = new PIXI.Container();
      const sprites: Sprite[] = [];
      const radii: number[] = [];
      const phases: number[] = [];
      for (const n of g.nodes as Node[]) {
        const s = new PIXI.Sprite(TEX.flat);
        s.anchor.set(0.5);
        s.position.set(n.x - originX, n.z - originZ);
        s.tint = securityTint(n.securityStatus);
        sprites.push(s);
        radii.push(n.radius);
        phases.push(Math.random() * Math.PI * 2);
        systems.addChild(s);
      }
      world.addChild(systems);
      const buildMs = performance.now() - buildStart;

      const w = app.renderer.width;
      const h = app.renderer.height;
      let scale =
        Math.min(
          w / (g.bounds.maxX - g.bounds.minX),
          h / (g.bounds.maxZ - g.bounds.minZ),
        ) * 0.9;
      let panX = w / 2;
      let panZ = h / 2;

      let active = PRESETS[0];
      let scaleMs = 0;

      function applyScales() {
        const t = performance.now();
        const texR = TEX_R[active.star];
        for (let i = 0; i < sprites.length; i++) {
          const px = Math.max(radii[i] * scale, active.minPx);
          sprites[i].scale.set(px / texR / scale);
        }
        scaleMs = performance.now() - t;
      }

      function redrawLines() {
        lines.clear();
        for (const e of g.edges) {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) continue;
          lines.moveTo(a.x - originX, a.z - originZ);
          lines.lineTo(b.x - originX, b.z - originZ);
        }
        lines.stroke({
          width: 1 / scale,
          color: active.lineColor,
          alpha: active.lineAlpha,
        });
      }

      function drawBackdrop() {
        backdrop.clear();
        backdrop.rect(0, 0, app.renderer.width, app.renderer.height);
        backdrop.fill(active.background);
        if (active.vignette) {
          // Concentric rings standing in for a radial fade — cheap, and enough
          // to judge whether the depth is wanted at all.
          const cx = app.renderer.width / 2;
          const cy = app.renderer.height / 2;
          const maxR = Math.hypot(cx, cy);
          for (let i = 10; i >= 1; i--) {
            backdrop
              .circle(cx, cy, (maxR * i) / 10)
              .fill({ color: 0x000000, alpha: 0.06 });
          }
        }
      }

      function apply(index: number) {
        active = PRESETS[index];
        app.renderer.background.color = active.background;
        for (const s of sprites) {
          s.texture = TEX[active.star];
          s.blendMode = active.additive ? 'add' : 'normal';
          s.alpha = 1;
        }
        drawBackdrop();
        redrawLines();
        applyScales();
      }
      applyPreset.current = apply;
      apply(0);

      function applyCamera() {
        world.scale.set(scale);
        world.position.set(panX, panZ);
        redrawLines();
        applyScales();
      }
      applyCamera();

      const canvas = app.canvas;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      canvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      });
      canvas.addEventListener('pointerup', () => (dragging = false));
      canvas.addEventListener('pointerleave', () => (dragging = false));
      canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        panX += e.clientX - lastX;
        panZ += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        world.position.set(panX, panZ);
      });
      canvas.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const k = Math.pow(2, -e.deltaY / 300);
          const r = canvas.getBoundingClientRect();
          const mx = e.clientX - r.left;
          const my = e.clientY - r.top;
          panX = mx - (mx - panX) * k;
          panZ = my - (my - panZ) * k;
          scale *= k;
          applyCamera();
        },
        { passive: false },
      );

      let frames = 0;
      let last = performance.now();
      let pulseMs = 0;
      app.ticker.add(() => {
        if (active.pulse) {
          const t = performance.now();
          const time = t / 1000;
          for (let i = 0; i < sprites.length; i++) {
            sprites[i].alpha = 0.75 + 0.25 * Math.sin(time * 1.6 + phases[i]);
          }
          pulseMs = performance.now() - t;
        }
        frames++;
        const now = performance.now();
        if (now - last >= 500) {
          setStats({
            FPS: ((frames * 1000) / (now - last)).toFixed(0),
            'Sistem (sprite)': String(sprites.length),
            'Gate hattı': String(drawn),
            'Counter-scale': `${scaleMs.toFixed(2)} ms`,
            'Nabız geçişi': active.pulse ? `${pulseMs.toFixed(2)} ms` : '—',
            'Sahne inşası': `${buildMs.toFixed(0)} ms`,
            'Veri': `${fetchMs.toFixed(0)} ms`,
            Zoom: scale.toExponential(2),
          });
          frames = 0;
          last = now;
        }
      });

      destroy = () => app.destroy(true, { children: true, texture: true });
    })();

    return () => {
      cancelled = true;
      destroy();
    };
  }, []);

  return (
    <div className="relative w-full h-[88vh] bg-black">
      <div ref={host} className="absolute inset-0" />

      <div className="absolute top-3 left-3 rounded bg-black/80 p-3 font-mono text-xs text-green-300 leading-5">
        <div className="mb-1 text-green-500">PIXI SPIKE — atılacak</div>
        {Object.entries(stats).map(([k, v]) => (
          <div key={k}>
            {k}: <span className="text-white">{v}</span>
          </div>
        ))}
        <div className="mt-2 text-gray-400">sürükle = pan · tekerlek = zoom</div>
      </div>

      <div className="absolute top-3 right-3 w-72 rounded bg-black/80 p-3 text-xs text-gray-300">
        {PRESETS.map((p, i) => (
          <button
            key={p.key}
            onClick={() => {
              setPreset(i);
              applyPreset.current(i);
            }}
            className={`mb-2 block w-full rounded px-2 py-1.5 text-left ${
              preset === i
                ? 'bg-green-600 text-black'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <div className="font-semibold">{p.label}</div>
            <div
              className={preset === i ? 'text-black/70' : 'text-gray-400'}
            >
              {p.note}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
