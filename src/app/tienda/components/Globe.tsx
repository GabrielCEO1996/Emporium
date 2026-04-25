'use client'

/**
 * Globe — 3D Earth con shader custom, 8 arcos de distribución desde Chicago,
 *         atmosphere teal y stars background.
 *
 * Portado del HTML standalone emporium-tienda-hero.html (Three.js r128) a
 * React Three Fiber + Three.js 0.160. Cambios necesarios:
 *   - THREE.Math.degToRad → THREE.MathUtils.degToRad (r150+)
 *   - useFrame en lugar del rAF loop manual
 *   - Texturas procedurales generadas via canvas en useMemo (client-only por
 *     'use client' + el wrapper GlobeStage que monta sin SSR)
 *
 * Performance:
 *   - SphereGeometry 1.4 radius, 96x96 subdivisions
 *   - Atmosphere SphereGeometry 1.55, 64x64 (BackSide additive)
 *   - 8 arcos = 8 lines + 8 dots + 8 flash spheres + 8 pulse rings
 *   - 120 stars points
 *   Total ~30 meshes — confortable en GPU media; mobile usa MobileGlobeFallback.
 */

import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Brand colors (keep in sync with tienda.css) ─────────────────────────────
const COLOR_TEAL_HEX = 0x0d9488
const COLOR_TEAL_SOFT_HEX = 0x5ebfb6
const COLOR_CREAM_HEX = 0xfafaf7

// ─── Lat/lng → 3D position on a sphere ────────────────────────────────────
function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lng + 180) * Math.PI) / 180
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

// ─── Earth procedural texture: continents in equirectangular ───────────────
function createEarthTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1024
  const ctx = c.getContext('2d')!

  // Ocean base
  ctx.fillStyle = '#2a5a8a'
  ctx.fillRect(0, 0, 2048, 1024)

  // Subtle deeper-ocean radial
  const grad = ctx.createRadialGradient(700, 512, 100, 700, 512, 800)
  grad.addColorStop(0, 'rgba(20,50,90,0.4)')
  grad.addColorStop(1, 'rgba(20,50,90,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 2048, 1024)

  // Land color — earthy/green so shader detects via warmth
  ctx.fillStyle = '#9a8b5a'

  // North America
  ctx.beginPath()
  ctx.moveTo(380, 200)
  ctx.bezierCurveTo(440, 170, 520, 165, 580, 195)
  ctx.bezierCurveTo(640, 185, 700, 200, 720, 230)
  ctx.bezierCurveTo(740, 270, 730, 320, 700, 350)
  ctx.bezierCurveTo(680, 380, 660, 400, 640, 405)
  ctx.bezierCurveTo(610, 430, 580, 445, 555, 440)
  ctx.bezierCurveTo(540, 460, 520, 470, 510, 460)
  ctx.bezierCurveTo(490, 470, 480, 490, 475, 510)
  ctx.bezierCurveTo(465, 525, 450, 520, 440, 510)
  ctx.bezierCurveTo(420, 495, 410, 470, 400, 440)
  ctx.bezierCurveTo(380, 410, 360, 380, 350, 350)
  ctx.bezierCurveTo(330, 320, 320, 280, 330, 250)
  ctx.bezierCurveTo(340, 220, 360, 205, 380, 200)
  ctx.closePath()
  ctx.fill()

  // Greenland
  ctx.beginPath()
  ctx.moveTo(720, 150)
  ctx.bezierCurveTo(770, 140, 810, 155, 800, 200)
  ctx.bezierCurveTo(790, 240, 760, 250, 730, 230)
  ctx.bezierCurveTo(710, 200, 705, 170, 720, 150)
  ctx.closePath()
  ctx.fill()

  // South America
  ctx.beginPath()
  ctx.moveTo(530, 510)
  ctx.bezierCurveTo(570, 505, 600, 540, 605, 580)
  ctx.bezierCurveTo(610, 620, 600, 660, 590, 700)
  ctx.bezierCurveTo(580, 750, 565, 800, 545, 830)
  ctx.bezierCurveTo(530, 850, 515, 855, 510, 830)
  ctx.bezierCurveTo(495, 790, 490, 740, 495, 700)
  ctx.bezierCurveTo(495, 650, 500, 600, 510, 560)
  ctx.bezierCurveTo(515, 530, 525, 510, 530, 510)
  ctx.closePath()
  ctx.fill()

  // Europe
  ctx.beginPath()
  ctx.moveTo(960, 200)
  ctx.bezierCurveTo(1010, 195, 1080, 210, 1110, 240)
  ctx.bezierCurveTo(1130, 280, 1115, 320, 1080, 335)
  ctx.bezierCurveTo(1040, 345, 990, 340, 960, 320)
  ctx.bezierCurveTo(940, 295, 935, 250, 960, 200)
  ctx.closePath()
  ctx.fill()

  // Africa
  ctx.beginPath()
  ctx.moveTo(1010, 380)
  ctx.bezierCurveTo(1080, 370, 1140, 400, 1170, 450)
  ctx.bezierCurveTo(1185, 500, 1180, 560, 1160, 620)
  ctx.bezierCurveTo(1140, 680, 1110, 730, 1080, 760)
  ctx.bezierCurveTo(1050, 780, 1020, 770, 1000, 740)
  ctx.bezierCurveTo(980, 700, 970, 650, 975, 600)
  ctx.bezierCurveTo(975, 540, 985, 480, 1000, 430)
  ctx.bezierCurveTo(1005, 400, 1010, 380, 1010, 380)
  ctx.closePath()
  ctx.fill()

  // Asia
  ctx.beginPath()
  ctx.moveTo(1140, 200)
  ctx.bezierCurveTo(1240, 180, 1380, 175, 1500, 195)
  ctx.bezierCurveTo(1620, 200, 1720, 220, 1780, 260)
  ctx.bezierCurveTo(1820, 300, 1800, 340, 1740, 360)
  ctx.bezierCurveTo(1660, 380, 1560, 390, 1450, 380)
  ctx.bezierCurveTo(1340, 380, 1240, 370, 1180, 360)
  ctx.bezierCurveTo(1140, 340, 1130, 280, 1140, 200)
  ctx.closePath()
  ctx.fill()

  // India peninsula
  ctx.beginPath()
  ctx.moveTo(1380, 380)
  ctx.bezierCurveTo(1410, 390, 1430, 430, 1420, 470)
  ctx.bezierCurveTo(1410, 500, 1390, 510, 1370, 490)
  ctx.bezierCurveTo(1360, 460, 1365, 420, 1380, 380)
  ctx.closePath()
  ctx.fill()

  // Indonesia islands
  ctx.beginPath(); ctx.arc(1620, 480, 35, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(1680, 510, 25, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(1720, 525, 18, 0, Math.PI * 2); ctx.fill()

  // Australia
  ctx.beginPath()
  ctx.moveTo(1700, 600)
  ctx.bezierCurveTo(1760, 590, 1830, 605, 1850, 640)
  ctx.bezierCurveTo(1860, 680, 1830, 710, 1780, 715)
  ctx.bezierCurveTo(1730, 720, 1690, 700, 1680, 670)
  ctx.bezierCurveTo(1680, 630, 1690, 610, 1700, 600)
  ctx.closePath()
  ctx.fill()

  // Antarctica band
  ctx.fillStyle = '#aa9d70'
  ctx.fillRect(0, 940, 2048, 84)

  // UK / Ireland
  ctx.fillStyle = '#9a8b5a'
  ctx.beginPath(); ctx.arc(940, 230, 18, 0, Math.PI * 2); ctx.fill()

  // Japan
  ctx.beginPath(); ctx.ellipse(1810, 280, 12, 28, -0.3, 0, Math.PI * 2); ctx.fill()

  // New Zealand
  ctx.beginPath(); ctx.ellipse(1920, 730, 10, 25, 0.2, 0, Math.PI * 2); ctx.fill()

  // Edge texture noise
  ctx.globalCompositeOperation = 'source-atop'
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 2048
    const y = Math.random() * 1024
    const alpha = Math.random() * 0.15
    ctx.fillStyle = `rgba(100,80,40,${alpha})`
    ctx.fillRect(x, y, 2, 2)
  }
  ctx.globalCompositeOperation = 'source-over'

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 16
  tex.wrapS = THREE.RepeatWrapping
  return tex
}

// ─── City lights texture ──────────────────────────────────────────────────
function createLightsTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1024
  const ctx = c.getContext('2d')!

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 2048, 1024)

  const cities: Array<{ lat: number; lng: number; w: number; r: number }> = [
    // North America
    { lat: 40.71, lng: -74.01, w: 1.0, r: 14 }, // New York
    { lat: 34.05, lng: -118.24, w: 1.0, r: 13 }, // LA
    { lat: 41.88, lng: -87.63, w: 1.0, r: 14 }, // Chicago HQ
    { lat: 25.76, lng: -80.19, w: 0.85, r: 11 }, // Miami
    { lat: 37.77, lng: -122.42, w: 0.8, r: 10 }, // SF
    { lat: 43.65, lng: -79.38, w: 0.75, r: 10 }, // Toronto
    { lat: 19.43, lng: -99.13, w: 0.85, r: 11 }, // Mexico City
    { lat: 29.76, lng: -95.37, w: 0.7, r: 9 }, // Houston
    { lat: 47.61, lng: -122.33, w: 0.7, r: 9 }, // Seattle
    { lat: 42.36, lng: -71.06, w: 0.7, r: 9 }, // Boston
    { lat: 49.28, lng: -123.12, w: 0.65, r: 8 }, // Vancouver
    // South America
    { lat: -23.55, lng: -46.63, w: 0.95, r: 12 }, // São Paulo
    { lat: -34.61, lng: -58.38, w: 0.85, r: 11 }, // Buenos Aires
    { lat: 4.71, lng: -74.07, w: 0.75, r: 10 }, // Bogotá
    { lat: -12.05, lng: -77.04, w: 0.7, r: 9 }, // Lima
    { lat: -22.91, lng: -43.17, w: 0.8, r: 10 }, // Rio
    { lat: -33.45, lng: -70.67, w: 0.7, r: 9 }, // Santiago
    // Europe
    { lat: 51.51, lng: -0.13, w: 1.0, r: 13 }, // London
    { lat: 48.86, lng: 2.35, w: 0.95, r: 12 }, // Paris
    { lat: 40.42, lng: -3.7, w: 0.8, r: 10 }, // Madrid
    { lat: 41.9, lng: 12.5, w: 0.75, r: 10 }, // Rome
    { lat: 52.52, lng: 13.41, w: 0.85, r: 11 }, // Berlin
    { lat: 52.37, lng: 4.9, w: 0.7, r: 9 }, // Amsterdam
    { lat: 55.76, lng: 37.62, w: 0.85, r: 11 }, // Moscow
    { lat: 41.01, lng: 28.98, w: 0.85, r: 11 }, // Istanbul
    // Africa
    { lat: 30.04, lng: 31.24, w: 0.85, r: 11 }, // Cairo
    { lat: 6.52, lng: 3.38, w: 0.8, r: 10 }, // Lagos
    { lat: -26.2, lng: 28.05, w: 0.7, r: 9 }, // Johannesburg
    { lat: 33.57, lng: -7.59, w: 0.65, r: 8 }, // Casablanca
    { lat: -1.29, lng: 36.82, w: 0.6, r: 8 }, // Nairobi
    // Asia
    { lat: 35.68, lng: 139.69, w: 1.0, r: 14 }, // Tokyo
    { lat: 39.9, lng: 116.4, w: 1.0, r: 14 }, // Beijing
    { lat: 31.23, lng: 121.47, w: 1.0, r: 14 }, // Shanghai
    { lat: 22.32, lng: 114.17, w: 0.9, r: 12 }, // Hong Kong
    { lat: 37.57, lng: 126.98, w: 0.9, r: 12 }, // Seoul
    { lat: 1.35, lng: 103.82, w: 0.85, r: 11 }, // Singapore
    { lat: 19.08, lng: 72.88, w: 1.0, r: 13 }, // Mumbai
    { lat: 28.61, lng: 77.21, w: 1.0, r: 13 }, // Delhi
    { lat: 13.76, lng: 100.5, w: 0.85, r: 11 }, // Bangkok
    { lat: -6.21, lng: 106.85, w: 0.85, r: 11 }, // Jakarta
    { lat: 14.6, lng: 120.98, w: 0.8, r: 10 }, // Manila
    { lat: 25.2, lng: 55.27, w: 0.85, r: 11 }, // Dubai
    { lat: 24.71, lng: 46.68, w: 0.7, r: 9 }, // Riyadh
    // Oceania
    { lat: -33.87, lng: 151.21, w: 0.85, r: 11 }, // Sydney
    { lat: -37.81, lng: 144.96, w: 0.75, r: 10 }, // Melbourne
    { lat: -36.85, lng: 174.76, w: 0.6, r: 8 }, // Auckland
  ]

  cities.forEach((city) => {
    const u = (city.lng + 180) / 360
    const v = (90 - city.lat) / 180
    const x = u * 2048
    const y = v * 1024

    const outer = ctx.createRadialGradient(x, y, 0, x, y, city.r * 2)
    outer.addColorStop(0, `rgba(255,220,140,${city.w * 0.5})`)
    outer.addColorStop(0.5, `rgba(255,180,80,${city.w * 0.18})`)
    outer.addColorStop(1, 'rgba(255,160,60,0)')
    ctx.fillStyle = outer
    ctx.beginPath(); ctx.arc(x, y, city.r * 2, 0, Math.PI * 2); ctx.fill()

    const core = ctx.createRadialGradient(x, y, 0, x, y, city.r * 0.6)
    core.addColorStop(0, `rgba(255,240,200,${city.w})`)
    core.addColorStop(1, `rgba(255,220,140,0)`)
    ctx.fillStyle = core
    ctx.beginPath(); ctx.arc(x, y, city.r * 0.6, 0, Math.PI * 2); ctx.fill()
  })

  // Subtle scatter
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 600; i++) {
    const ref = cities[Math.floor(Math.random() * cities.length)]
    const u = (ref.lng + 180) / 360 + (Math.random() - 0.5) * 0.04
    const v = (90 - ref.lat) / 180 + (Math.random() - 0.5) * 0.04
    const x = u * 2048
    const y = v * 1024
    const intensity = Math.random() * 0.4 + 0.1
    ctx.fillStyle = `rgba(255,220,140,${intensity})`
    ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 16
  return tex
}

// ─── Shaders (paste from emporium-tienda-hero.html, untouched) ─────────────
const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const earthFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform sampler2D uMap;
  uniform sampler2D uLights;
  uniform float uTime;

  const vec3 cream    = vec3(0.980, 0.980, 0.969);
  const vec3 navy     = vec3(0.118, 0.227, 0.373);
  const vec3 navyDeep = vec3(0.059, 0.133, 0.220);
  const vec3 navyNight = vec3(0.030, 0.080, 0.140);
  const vec3 teal     = vec3(0.051, 0.580, 0.533);
  const vec3 cityWarm = vec3(1.0, 0.86, 0.55);

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    vec4 lights = texture2D(uLights, vUv);

    float warmth = (tex.r + tex.g * 0.6) - tex.b * 1.4;
    float landMask = smoothstep(-0.05, 0.10, warmth);
    float lum = (tex.r + tex.g + tex.b) / 3.0;
    vec3 landDay = mix(cream * 0.88, cream, smoothstep(0.3, 0.7, lum));
    vec3 oceanDay = mix(navyDeep, navy, smoothstep(0.0, 0.5, lum));
    vec3 baseDay = mix(oceanDay, landDay, landMask);

    vec3 lightDir = normalize(vec3(0.5, 0.55, 0.85));
    float NdotL = dot(vNormal, lightDir);
    float dayMix = smoothstep(-0.18, 0.32, NdotL);

    float ambient = 0.32;
    float diffuse = max(NdotL, 0.0) * 0.85;
    vec3 dayColor = baseDay * (ambient + diffuse);

    vec3 nightLand = navyNight * 1.4;
    vec3 nightOcean = navyNight * 0.8;
    vec3 nightBase = mix(nightOcean, nightLand, landMask);

    float lightIntensity = max(lights.r, max(lights.g, lights.b)) * 1.8;
    vec3 cityGlow = cityWarm * lightIntensity;
    vec3 nightWithCities = nightBase + cityGlow * (1.0 - dayMix * 0.85);

    vec3 baseColor = mix(nightWithCities, dayColor, dayMix);

    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);
    baseColor = mix(baseColor, teal * 0.85, fresnel * 0.22);

    baseColor = baseColor / (baseColor + 0.55);

    gl_FragColor = vec4(baseColor, 1.0);
  }
`

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const atmosphereFragment = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.62 - dot(vNormal, vec3(0, 0, 1.0)), 2.4);
    gl_FragColor = vec4(0.051, 0.580, 0.533, 1.0) * intensity;
  }
`

const starsVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    vAlpha = 0.15 + 0.25 * sin(uTime * 0.5 + aSeed);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = 1.5;
  }
`

const starsFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (length(c) > 0.5) discard;
    gl_FragColor = vec4(0.369, 0.749, 0.714, vAlpha);
  }
`

// ─── Distribution destinations from Chicago ──────────────────────────────
const SPHERE_RADIUS = 1.4
const ARC_SEGMENTS = 60
const ARC_LIFT = 0.32
const ARC_DURATION = 4.5

const CHICAGO = { lat: 41.88, lng: -87.63 }

const DESTINATIONS = [
  { name: 'Miami',       lat:  25.76, lng:  -80.19 },
  { name: 'New York',    lat:  40.71, lng:  -74.01 },
  { name: 'Los Angeles', lat:  34.05, lng: -118.24 },
  { name: 'México City', lat:  19.43, lng:  -99.13 },
  { name: 'Bogotá',      lat:   4.71, lng:  -74.07 },
  { name: 'São Paulo',   lat: -23.55, lng:  -46.63 },
  { name: 'Madrid',      lat:  40.42, lng:   -3.70 },
  { name: 'Tokyo',       lat:  35.68, lng:  139.69 },
] as const

// ─── EarthScene — todo el contenido 3D dentro del <Canvas> ─────────────────
function EarthScene() {
  const earthRef = useRef<THREE.Mesh>(null)
  const atmosphereRef = useRef<THREE.Mesh>(null)
  const hqRingRef = useRef<THREE.Mesh>(null)
  const arcRefs = useRef<
    Array<{
      line: THREE.Line
      lineMat: THREE.LineBasicMaterial
      destDot: THREE.Mesh
      destMat: THREE.MeshBasicMaterial
      flash: THREE.Mesh
      flashMat: THREE.MeshBasicMaterial
      pulseRing: THREE.Mesh
      pulseMat: THREE.MeshBasicMaterial
      delay: number
    }>
  >([])

  // Mouse parallax — uses refs not state to avoid re-renders.
  const mouseTarget = useRef({ x: 0, y: 0 })
  const cameraOffset = useRef({ x: 0, y: 0 })
  const { camera } = useThree()

  // Generate textures + materials once per mount
  const earthMaterial = useMemo(() => {
    const earthTex = createEarthTexture()
    const lightsTex = createLightsTexture()
    return new THREE.ShaderMaterial({
      vertexShader: earthVertex,
      fragmentShader: earthFragment,
      uniforms: {
        uMap: { value: earthTex },
        uLights: { value: lightsTex },
        uTime: { value: 0 },
      },
    })
  }, [])

  const atmosphereMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
      }),
    [],
  )

  // Try to upgrade to real Earth/lights textures from CDN — silent fallback
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    loader.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg',
      (tex) => {
        tex.anisotropy = 16
        ;(earthMaterial.uniforms.uMap.value as THREE.Texture).dispose()
        earthMaterial.uniforms.uMap.value = tex
      },
      undefined,
      () => { /* offline / CORS — keep procedural */ },
    )
    loader.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_lights_2048.png',
      (tex) => {
        tex.anisotropy = 16
        ;(earthMaterial.uniforms.uLights.value as THREE.Texture).dispose()
        earthMaterial.uniforms.uLights.value = tex
      },
      undefined,
      () => { /* offline / CORS — keep procedural */ },
    )
  }, [earthMaterial])

  // Mouse parallax listener
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

  // Pre-compute Chicago + arc geometries
  const chicagoLocal = useMemo(
    () => latLngToVec3(CHICAGO.lat, CHICAGO.lng, SPHERE_RADIUS),
    [],
  )

  const arcs = useMemo(() => {
    return DESTINATIONS.map((dest, i) => {
      const endVec = latLngToVec3(dest.lat, dest.lng, SPHERE_RADIUS)
      const points: THREE.Vector3[] = []
      for (let j = 0; j <= ARC_SEGMENTS; j++) {
        const t = j / ARC_SEGMENTS
        const p = new THREE.Vector3().lerpVectors(chicagoLocal, endVec, t)
        const lift = Math.sin(t * Math.PI) * ARC_LIFT
        p.normalize().multiplyScalar(SPHERE_RADIUS + lift)
        points.push(p)
      }
      return {
        endVec,
        points,
        delay: (i / DESTINATIONS.length) * ARC_DURATION,
      }
    })
  }, [chicagoLocal])

  // Stars
  const starsGeometry = useMemo(() => {
    const count = 120
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = 8 + Math.random() * 6
      const theta = Math.random() * Math.PI * 2
      const phi = (Math.random() - 0.5) * Math.PI
      positions[i * 3]     = r * Math.cos(theta) * Math.cos(phi)
      positions[i * 3 + 1] = r * Math.sin(phi)
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.cos(phi) - 4
      seeds[i] = Math.random() * Math.PI * 2
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    return g
  }, [])

  const starsMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: earthMaterial.uniforms.uTime },
        vertexShader: starsVertex,
        fragmentShader: starsFragment,
      }),
    [earthMaterial],
  )

  // Per-frame: time, parallax, earth rotation, arcs phases, hq pulse
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    earthMaterial.uniforms.uTime.value = t

    // Smooth parallax
    cameraOffset.current.x += (mouseTarget.current.x - cameraOffset.current.x) * 0.04
    cameraOffset.current.y += (mouseTarget.current.y - cameraOffset.current.y) * 0.04
    camera.position.x = cameraOffset.current.x
    camera.position.y = cameraOffset.current.y
    if (earthRef.current) camera.lookAt(earthRef.current.position)

    // Earth slow rotation
    if (earthRef.current) earthRef.current.rotation.y += 0.0008
    if (atmosphereRef.current && earthRef.current) {
      atmosphereRef.current.position.copy(earthRef.current.position)
    }

    // HQ Chicago pulsing ring
    if (hqRingRef.current) {
      const pulse = 1 + Math.sin(t * 1.6) * 0.35
      hqRingRef.current.scale.set(pulse, pulse, pulse)
      const m = hqRingRef.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.8 - (pulse - 1) * 0.6
    }

    // Distribution arcs — 4 phases
    arcRefs.current.forEach((a) => {
      const local = ((t + a.delay) % ARC_DURATION) / ARC_DURATION
      const draw = (n: number) => a.line.geometry.setDrawRange(0, n)

      if (local < 0.45) {
        const drawT = local / 0.45
        const eased = 1 - Math.pow(1 - drawT, 2.2)
        draw(Math.floor(eased * (ARC_SEGMENTS + 1)))
        a.lineMat.opacity = 0.85
        a.flashMat.opacity = 0
        a.pulseMat.opacity = 0
        a.pulseRing.scale.set(1, 1, 1)
        a.destMat.opacity = 0.55
      } else if (local < 0.55) {
        const flashT = (local - 0.45) / 0.10
        draw(ARC_SEGMENTS + 1)
        a.lineMat.opacity = 0.85
        a.flashMat.opacity = (1 - flashT) * 0.9
        a.flash.scale.set(1 + flashT * 1.5, 1 + flashT * 1.5, 1 + flashT * 1.5)
        a.pulseRing.scale.set(1 + flashT * 1.5, 1 + flashT * 1.5, 1)
        a.pulseMat.opacity = 0.85
        a.destMat.opacity = 1.0
      } else if (local < 0.95) {
        const fadeT = (local - 0.55) / 0.40
        draw(ARC_SEGMENTS + 1)
        a.lineMat.opacity = 0.85 * (1 - fadeT)
        a.flashMat.opacity = 0
        const ringScale = 1.5 + fadeT * 4
        a.pulseRing.scale.set(ringScale, ringScale, 1)
        a.pulseMat.opacity = 0.85 * (1 - fadeT)
        a.destMat.opacity = 1.0 - fadeT * 0.45
      } else {
        draw(0)
        a.lineMat.opacity = 0
        a.flashMat.opacity = 0
        a.pulseMat.opacity = 0
        a.pulseRing.scale.set(1, 1, 1)
        a.destMat.opacity = 0.55
      }
    })
  })

  // Initial Earth orientation: bring Chicago roughly forward + tilt
  const initialRot: [number, number, number] = [
    THREE.MathUtils.degToRad(-15),
    THREE.MathUtils.degToRad(87.63 - 90),
    0,
  ]

  return (
    <>
      {/* Background stars */}
      <points geometry={starsGeometry} material={starsMaterial} />

      {/* Atmosphere — fresnel teal, additive */}
      <mesh ref={atmosphereRef} position={[1.6, 0, 0]} material={atmosphereMaterial}>
        <sphereGeometry args={[1.55, 64, 64]} />
      </mesh>

      {/* Earth */}
      <mesh
        ref={earthRef}
        position={[1.6, 0, 0]}
        rotation={initialRot}
        material={earthMaterial}
      >
        <sphereGeometry args={[SPHERE_RADIUS, 96, 96]} />

        {/* Chicago HQ — dot + pulsing ring */}
        <mesh position={chicagoLocal}>
          <sphereGeometry args={[0.032, 16, 16]} />
          <meshBasicMaterial color={COLOR_TEAL_SOFT_HEX} />
        </mesh>
        <mesh
          ref={hqRingRef}
          position={chicagoLocal}
          // The lookAt + rotateY in the original orients the ring tangent to
          // the sphere. With R3F we approximate via lookAt on mount via a
          // useEffect-style ref handler.
        >
          <ringGeometry args={[0.04, 0.055, 32]} />
          <meshBasicMaterial
            color={COLOR_TEAL_HEX}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* 8 distribution arcs */}
        {arcs.map((a, i) => (
          <ArcGroup
            key={i}
            points={a.points}
            endVec={a.endVec}
            delay={a.delay}
            register={(refs) => { arcRefs.current[i] = { ...refs, delay: a.delay } }}
          />
        ))}
      </mesh>
    </>
  )
}

// Each arc has a line + dest dot + flash + pulse ring. Encapsulated so the
// parent `EarthScene` stays readable. Refs are bubbled up via the register
// callback so the per-frame loop can mutate materials/geometries directly
// (avoiding state churn).
function ArcGroup({
  points,
  endVec,
  delay: _delay,
  register,
}: {
  points: THREE.Vector3[]
  endVec: THREE.Vector3
  delay: number
  register: (refs: {
    line: THREE.Line
    lineMat: THREE.LineBasicMaterial
    destDot: THREE.Mesh
    destMat: THREE.MeshBasicMaterial
    flash: THREE.Mesh
    flashMat: THREE.MeshBasicMaterial
    pulseRing: THREE.Mesh
    pulseMat: THREE.MeshBasicMaterial
  }) => void
}) {
  const lineRef = useRef<THREE.Line>(null)
  const destDotRef = useRef<THREE.Mesh>(null)
  const flashRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef<THREE.Mesh>(null)

  // Build the line geometry once
  const lineGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points)
    g.setDrawRange(0, 0)
    return g
  }, [points])

  useEffect(() => {
    if (!lineRef.current || !destDotRef.current || !flashRef.current || !pulseRef.current) return
    const lineMat = lineRef.current.material as THREE.LineBasicMaterial
    const destMat = destDotRef.current.material as THREE.MeshBasicMaterial
    const flashMat = flashRef.current.material as THREE.MeshBasicMaterial
    const pulseMat = pulseRef.current.material as THREE.MeshBasicMaterial

    // Orient pulse ring tangent to the sphere by looking at the origin
    pulseRef.current.lookAt(new THREE.Vector3(0, 0, 0))
    pulseRef.current.rotateY(Math.PI)

    register({
      line: lineRef.current,
      lineMat,
      destDot: destDotRef.current,
      destMat,
      flash: flashRef.current,
      flashMat,
      pulseRing: pulseRef.current,
      pulseMat,
    })
  }, [register])

  return (
    <>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <primitive
        object={
          new THREE.Line(
            lineGeometry,
            new THREE.LineBasicMaterial({
              color: COLOR_TEAL_SOFT_HEX,
              transparent: true,
              opacity: 0,
            }),
          )
        }
        ref={lineRef as any}
      />
      <mesh ref={destDotRef} position={endVec}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshBasicMaterial color={COLOR_TEAL_SOFT_HEX} transparent opacity={0.55} />
      </mesh>
      <mesh ref={flashRef} position={endVec}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshBasicMaterial color={COLOR_CREAM_HEX} transparent opacity={0} />
      </mesh>
      <mesh ref={pulseRef} position={endVec}>
        <ringGeometry args={[0.025, 0.04, 32]} />
        <meshBasicMaterial
          color={COLOR_TEAL_HEX}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  )
}

// ─── Top-level Globe — the <Canvas> wrapper ───────────────────────────────
// The parent must be `position: relative` so the canvas absolutely fills it
// (typically the hero section at 100vh). We DO NOT use position: fixed even
// though the standalone HTML did — that page didn't scroll. Here the page
// scrolls past the hero and the globe must be clipped along with it.
export default function Globe() {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      camera={{ fov: 35, position: [0, 0, 6], near: 0.1, far: 100 }}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <EarthScene />
    </Canvas>
  )
}
