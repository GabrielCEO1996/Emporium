'use client'

/**
 * SpaceBackground — three layered point clouds rendered behind everything
 * else on /tienda. Sutil capa cosmica: never draws attention, only adds
 * depth and movement. Lives in its own Canvas (fixed to the viewport),
 * separate from the Globe canvas (which is absolute inside the hero).
 *
 * Layers:
 *   1. Far stars       — densest, smallest, slowest twinkle, navy-tinted.
 *   2. Mid stars       — fewer, larger, with a soft cyan halo.
 *   3. Floating motes  — teal-soft, drifting upward with slight x-sway,
 *                        wrap-around when they exit the top.
 *
 * Density auto-scales with the device tier (mobile/low-cores → 50%).
 * Reduce-motion completely disables the per-frame uniform updates so the
 * GPU sits idle on the static state.
 *
 * Color note: the screen background is cream (#fafaf7), so pure white
 * would be invisible. Layers 1+2 use a navy-leaning tint at very low
 * opacity (0.05–0.20) and layer 3 uses brand-teal-soft at 0.10–0.25.
 * The halo on layer 2 picks up the teal more visibly. The whole effect
 * is closer to "paper texture" than "starfield" — by design.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Density tiers ─────────────────────────────────────────────────────────
type Tier = 'low' | 'mid' | 'high'

const COUNTS: Record<Tier, { far: number; mid: number; motes: number }> = {
  low:  { far: 100, mid: 16, motes: 12 },
  mid:  { far: 160, mid: 26, motes: 18 },
  high: { far: 200, mid: 30, motes: 22 },
}

function useDeviceTier(): Tier {
  const [tier, setTier] = useState<Tier>('high')
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    const cores = navigator.hardwareConcurrency ?? 4
    if (isMobile || cores < 4) setTier('low')
    else if (cores < 8) setTier('mid')
    else setTier('high')
  }, [])
  return tier
}

function useReduceMotion(): { current: boolean } {
  // A ref so per-frame code can sample it without resubscribing
  const ref = useRef(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    ref.current = mq.matches
    const listener = (e: MediaQueryListEvent) => { ref.current = e.matches }
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])
  return ref
}

// ─── Shared shader prelude ─────────────────────────────────────────────────
const farVertex = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    // Slow twinkle — cycle 5–9s per star via seed
    float speed = 0.2 + mod(aSeed, 1.0) * 0.18;  // 0.2..0.38
    vAlpha = aOpacity * (0.55 + 0.45 * sin(uTime * speed + aSeed));

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = aSize * uPixelRatio;
  }
`

const farFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float dist = length(c);
    if (dist > 0.5) discard;
    // Soft edge so each star isn't a hard square
    float soft = 1.0 - smoothstep(0.35, 0.5, dist);
    vec3 navyTint = vec3(0.118, 0.227, 0.373);
    gl_FragColor = vec4(navyTint, vAlpha * soft);
  }
`

const midFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float dist = length(c);
    if (dist > 0.5) discard;

    // Inner core (navy) + outer halo (teal-soft)
    float core = 1.0 - smoothstep(0.0, 0.18, dist);
    float halo = 1.0 - smoothstep(0.18, 0.5, dist);

    vec3 coreColor = vec3(0.118, 0.227, 0.373);   // navy
    vec3 haloColor = vec3(0.369, 0.749, 0.714);   // teal-soft
    vec3 col = mix(haloColor, coreColor, core);

    float a = vAlpha * (core * 0.85 + halo * 0.45);
    gl_FragColor = vec4(col, a);
  }
`

const motesVertex = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // Slow upward drift + lateral sway. Each particle has its own speed
    // derived from the seed. Wrap on the y-axis: when a mote reaches +10
    // it re-enters at -10 (mod centred at 0).
    float driftSpeed = 0.012 + mod(aSeed, 0.5) * 0.020;  // 0.012..0.032
    pos.y += uTime * driftSpeed;
    pos.y = mod(pos.y + 10.0, 20.0) - 10.0;
    pos.x += sin(uTime * 0.35 + aSeed) * 0.05;

    vAlpha = aOpacity;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = aSize * uPixelRatio;
  }
`

const motesFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float dist = length(c);
    if (dist > 0.5) discard;
    float soft = 1.0 - smoothstep(0.0, 0.5, dist);
    vec3 tealSoft = vec3(0.369, 0.749, 0.714);
    gl_FragColor = vec4(tealSoft, vAlpha * soft);
  }
`

// ─── Helper: build a points geometry ──────────────────────────────────────
function buildLayerGeometry(opts: {
  count: number
  zRange: [number, number]
  sizeRange: [number, number]
  opacityRange: [number, number]
}) {
  const { count, zRange, sizeRange, opacityRange } = opts
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const opacities = new Float32Array(count)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 30
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20
    positions[i * 3 + 2] = zRange[0] + Math.random() * (zRange[1] - zRange[0])
    sizes[i]    = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0])
    opacities[i] = opacityRange[0] + Math.random() * (opacityRange[1] - opacityRange[0])
    seeds[i]    = Math.random() * Math.PI * 2
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  g.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  return g
}

// ─── Layer component ──────────────────────────────────────────────────────
function Layer({
  geometry,
  material,
  parallax,
  reduceMotionRef,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
  parallax: number
  reduceMotionRef: { current: boolean }
}) {
  const ref = useRef<THREE.Points>(null!)
  const baseY = useRef(0)

  useFrame((state) => {
    if (!ref.current) return
    if (!reduceMotionRef.current) {
      // uTime drives twinkle (far/mid) and drift (motes)
      material.uniforms.uTime.value = state.clock.elapsedTime
    }
    // Scroll parallax — small fraction of scrollY translated down. Lerp
    // implicit via direct assign each frame; window.scrollY itself is
    // smoothed by Lenis higher up the tree.
    ref.current.position.y = baseY.current - window.scrollY * parallax * 0.001
  })

  return <points ref={ref} geometry={geometry} material={material} />
}

// ─── Scene (content of the Canvas) ────────────────────────────────────────
function SpaceScene() {
  const tier = useDeviceTier()
  const counts = COUNTS[tier]
  const reduceMotionRef = useReduceMotion()

  const pixelRatio = useMemo(() => {
    if (typeof window === 'undefined') return 1
    // Capped at 1.5 — retina above that doesn't add visible quality to
    // a starfield and doubles the fragment work.
    return Math.min(window.devicePixelRatio ?? 1, 1.5)
  }, [])

  const farGeometry = useMemo(
    () =>
      buildLayerGeometry({
        count: counts.far,
        zRange: [-12, -9],
        sizeRange: [0.6, 1.6],
        opacityRange: [0.05, 0.12], // sub-distractor on cream bg
      }),
    [counts.far],
  )

  const midGeometry = useMemo(
    () =>
      buildLayerGeometry({
        count: counts.mid,
        zRange: [-8, -6],
        sizeRange: [2.0, 3.5],
        opacityRange: [0.10, 0.20],
      }),
    [counts.mid],
  )

  const motesGeometry = useMemo(
    () =>
      buildLayerGeometry({
        count: counts.motes,
        zRange: [-5, -3.5],
        sizeRange: [1.4, 2.4],
        opacityRange: [0.10, 0.22],
      }),
    [counts.motes],
  )

  const farMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: farVertex,
        fragmentShader: farFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
        },
      }),
    [pixelRatio],
  )

  const midMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: farVertex,
        fragmentShader: midFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
        },
      }),
    [pixelRatio],
  )

  const motesMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: motesVertex,
        fragmentShader: motesFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
        },
      }),
    [pixelRatio],
  )

  return (
    <>
      <Layer geometry={farGeometry}   material={farMaterial}   parallax={0.05} reduceMotionRef={reduceMotionRef} />
      <Layer geometry={midGeometry}   material={midMaterial}   parallax={0.15} reduceMotionRef={reduceMotionRef} />
      <Layer geometry={motesGeometry} material={motesMaterial} parallax={0.30} reduceMotionRef={reduceMotionRef} />
    </>
  )
}

// ─── Public component ─────────────────────────────────────────────────────
export default function SpaceBackground() {
  return (
    <div className="tienda-space-bg" aria-hidden="true">
      <Canvas
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
        camera={{ fov: 35, position: [0, 0, 6], near: 0.1, far: 100 }}
      >
        <SpaceScene />
      </Canvas>
    </div>
  )
}
