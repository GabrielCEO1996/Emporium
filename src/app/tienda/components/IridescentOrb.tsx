'use client'

/**
 * IridescentOrb — esfera iridiscente abstracta + 80 partículas teal/gold.
 *
 * Reemplazo del globo terráqueo 3D. Más simple, más confiable y se ve
 * futurista/luxury sobre el cosmos negro.
 *
 * Composición:
 *   - Icosahedron displaced por simplex noise 3D — superficie respira
 *     y se ondula sutilmente.
 *   - Fragment iridiscente: fresnel rim + shift sinusoidal por tiempo +
 *     posición Y + influencia de mouse. Paleta navy/teal/cream/teal-soft
 *     pensada para fondo negro espacial.
 *   - 80 partículas en un shell esférico radio 2.2–3.7 alrededor del orb.
 *     Drift sinusoidal independiente por seed. Color mix gold/teal con
 *     additive blending — el "polvo cósmico" que rodea al orb.
 *
 * Performance:
 *   - IcosahedronGeometry detail 5 (~10k vertices). El usuario sugirió
 *     64 pero esa magnitud (>10^9 vertices) cuelga WebGL — 5 es el
 *     equivalente visual de SphereGeometry(96,96) que ya estaba.
 *   - dpr clamp [1, 1.5] como el resto de la app.
 *   - Mouse parallax sobre cámara, no sobre el orb.
 */

import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Simplex 3D noise (Ashima Arts, public domain) ───────────────────────
// Inline en el shader para que el orb sea autónomo. Es la implementación
// estándar usada en cientos de demos R3F.
const SIMPLEX_3D = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289_v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289_v4(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`

// ─── Orb shaders ─────────────────────────────────────────────────────────
const orbVertex = /* glsl */ `
  ${SIMPLEX_3D}
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  void main() {
    vec3 pos = position;
    float displacement = snoise(pos * 1.4 + uTime * 0.18) * 0.06;
    pos += normal * displacement;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vec4 mvPos = viewMatrix * worldPos;
    vViewPosition = -mvPos.xyz;
    vNormal = normalize(normalMatrix * normal);

    gl_Position = projectionMatrix * mvPos;
  }
`

const orbFragment = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;

  const vec3 navy     = vec3(0.118, 0.227, 0.373); // #1E3A5F
  const vec3 navyDeep = vec3(0.059, 0.133, 0.220); // #0F2238
  const vec3 teal     = vec3(0.051, 0.580, 0.533); // #0D9488
  const vec3 tealSoft = vec3(0.369, 0.749, 0.714); // #5EBFB6
  const vec3 cream    = vec3(0.980, 0.980, 0.969); // #fafaf7

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 1.8);

    // Iridescent shift — fase de tiempo + posición Y + influencia de mouse
    float shift = sin(uTime * 0.4 + vWorldPosition.y * 1.5) * 0.5 + 0.5;
    shift += uMouse.x * 0.1;

    vec3 base = mix(navy, tealSoft, smoothstep(0.3, 0.85, shift));
    vec3 rim  = mix(teal, cream, smoothstep(0.4, 1.0, fresnel));
    vec3 color = mix(base, rim, fresnel);

    // Core glow — el centro del orb tiene un teal interno cálido
    color += teal * 0.06 * (1.0 - fresnel);

    // Bottom shade — la mitad inferior se oscurece sutilmente
    color *= mix(0.78, 1.0, smoothstep(-0.4, 0.6, vNormal.y));

    // Edge depth — los rims muy profundos tiran a navy-deep
    color = mix(color, navyDeep, pow(fresnel, 6.0) * 0.25);

    gl_FragColor = vec4(color, 1.0);
  }
`

// ─── Particles shaders ───────────────────────────────────────────────────
const particlesVertex = /* glsl */ `
  attribute float aSeed;
  attribute float aColorMix;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vColorMix;

  void main() {
    vec3 pos = position;
    pos.y += sin(uTime * 0.4 + aSeed) * 0.18;
    pos.x += cos(uTime * 0.3 + aSeed * 1.3) * 0.12;

    vAlpha = 0.4 + 0.5 * sin(uTime * 0.6 + aSeed);
    vColorMix = aColorMix;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    // Perspective scale: more distant points smaller
    gl_PointSize = 2.5 * (1.0 / -mvPos.z) * 80.0 * uPixelRatio;
  }
`

const particlesFragment = /* glsl */ `
  varying float vAlpha;
  varying float vColorMix;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float dist = length(c);
    if (dist > 0.5) discard;

    vec3 gold     = vec3(0.831, 0.647, 0.456); // #d4a574
    vec3 tealSoft = vec3(0.369, 0.749, 0.714); // #5EBFB6
    vec3 col = mix(gold, tealSoft, vColorMix);

    float core = 1.0 - smoothstep(0.0, 0.18, dist);
    float halo = 1.0 - smoothstep(0.18, 0.5, dist);
    float a = vAlpha * (core + halo * 0.5);

    gl_FragColor = vec4(col, a);
  }
`

// ─── Constants ────────────────────────────────────────────────────────────
const ORB_POSITION: [number, number, number] = [1.7, 0.05, 0]
const ORB_RADIUS = 1.4
// Detail 5 → ~10k vertices. Equivalente visual a SphereGeometry(96,96).
// El usuario sugirió 64 pero esa magnitud cuelga WebGL.
const ORB_DETAIL = 5
const PARTICLES_COUNT = 80

// ─── Scene ────────────────────────────────────────────────────────────────
function OrbScene() {
  const orbRef = useRef<THREE.Mesh>(null)
  const mouseTarget = useRef({ x: 0, y: 0 })
  const cameraOffset = useRef({ x: 0, y: 0 })
  const { camera } = useThree()

  const orbMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: orbVertex,
        fragmentShader: orbFragment,
        uniforms: {
          uTime: { value: 0 },
          uMouse: { value: new THREE.Vector2(0, 0) },
        },
      }),
    [],
  )

  const pixelRatio = useMemo(() => {
    if (typeof window === 'undefined') return 1
    return Math.min(window.devicePixelRatio ?? 1, 1.5)
  }, [])

  const particlesMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: particlesVertex,
        fragmentShader: particlesFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
        },
      }),
    [pixelRatio],
  )

  const particlesGeometry = useMemo(() => {
    const positions = new Float32Array(PARTICLES_COUNT * 3)
    const seeds = new Float32Array(PARTICLES_COUNT)
    const colorMixes = new Float32Array(PARTICLES_COUNT)
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      // Punto random en una cáscara esférica radio 2.2–3.7 alrededor del orb.
      // Usamos acos uniforme en cos(phi) para distribución uniforme en sphere.
      const r = 2.2 + Math.random() * 1.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3]     = ORB_POSITION[0] + r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = ORB_POSITION[1] + r * Math.cos(phi)
      positions[i * 3 + 2] = ORB_POSITION[2] + r * Math.sin(phi) * Math.sin(theta)
      seeds[i] = Math.random() * Math.PI * 2
      // ~40% teal-soft (1), ~60% gold (0). Distribución estable por índice.
      colorMixes[i] = i % 5 < 2 ? 1 : 0
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    g.setAttribute('aColorMix', new THREE.BufferAttribute(colorMixes, 1))
    return g
  }, [])

  // Mouse parallax — refs para evitar re-renders.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      mouseTarget.current.x = nx * 0.18
      mouseTarget.current.y = -ny * 0.12
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    orbMaterial.uniforms.uTime.value = t
    orbMaterial.uniforms.uMouse.value.set(mouseTarget.current.x, mouseTarget.current.y)
    particlesMaterial.uniforms.uTime.value = t

    // Smooth parallax on camera. NO lookAt: si la cámara se reorienta al
    // orb, el orb queda visualmente centrado en pantalla y tapa el texto
    // del hero (col 1 del grid). Manteniendo la cámara mirando al origen,
    // el orb en world.x=1.7 se proyecta naturalmente a la derecha.
    cameraOffset.current.x += (mouseTarget.current.x - cameraOffset.current.x) * 0.04
    cameraOffset.current.y += (mouseTarget.current.y - cameraOffset.current.y) * 0.04
    camera.position.x = cameraOffset.current.x
    camera.position.y = cameraOffset.current.y

    // Orb rotation + breathing
    if (orbRef.current) {
      orbRef.current.rotation.y = t * 0.18 + cameraOffset.current.x * 0.6
      orbRef.current.rotation.x = cameraOffset.current.y * 0.5 - 0.1
      const breathing = 1 + Math.sin(t * 0.7) * 0.012
      orbRef.current.scale.setScalar(breathing)
    }
  })

  return (
    <>
      <mesh ref={orbRef} position={ORB_POSITION} material={orbMaterial}>
        <icosahedronGeometry args={[ORB_RADIUS, ORB_DETAIL]} />
      </mesh>
      <points geometry={particlesGeometry} material={particlesMaterial} />
    </>
  )
}

// ─── Public component ─────────────────────────────────────────────────────
export default function IridescentOrb() {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 1.5]}
      camera={{ fov: 35, position: [0, 0, 6], near: 0.1, far: 100 }}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <OrbScene />
    </Canvas>
  )
}
