// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const BLACK_HOLE_RADIUS = 1.3;
const DISK_INNER_RADIUS = BLACK_HOLE_RADIUS + 0.2;
const DISK_OUTER_RADIUS = 8.0;
const DISK_TILT_ANGLE = Math.PI / 3.0;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020104, 0.035);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(-6.5, 5.0, 6.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
if (THREE.sRGBEncoding !== undefined) {
    // Backward compatibility check for different THREE versions
    renderer.outputColorSpace = THREE.SRGBColorSpace || (renderer.outputEncoding = THREE.sRGBEncoding);
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.6, 0.7, 0.2
);
composer.addPass(bloomPass);

const lensingShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "blackHoleScreenPos": { value: new THREE.Vector2(0.5, 0.5) },
        "lensingStrength": { value: 0.12 }, "lensingRadius": { value: 0.3 },
        "aspectRatio": { value: window.innerWidth / window.innerHeight },
        "chromaticAberration": { value: 0.015 }, "scanlineIntensity": { value: 0.15 },
        "vignetteDarkness": { value: 0.8 }
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform vec2 blackHoleScreenPos; uniform float lensingStrength;
        uniform float lensingRadius; uniform float aspectRatio; uniform float chromaticAberration;
        uniform float scanlineIntensity; uniform float vignetteDarkness; varying vec2 vUv;
        void main() {
            vec2 screenPos = vUv; vec2 toCenter = screenPos - blackHoleScreenPos;
            toCenter.x *= aspectRatio; float dist = length(toCenter);
            float distortionAmount = lensingStrength / (dist * dist + 0.003);
            distortionAmount = clamp(distortionAmount, 0.0, 0.7);
            float falloff = smoothstep(lensingRadius, lensingRadius * 0.3, dist);
            distortionAmount *= falloff; vec2 offset = normalize(toCenter) * distortionAmount;
            offset.x /= aspectRatio; vec2 distortedUvR = screenPos - offset * (1.0 + chromaticAberration);
            vec2 distortedUvG = screenPos - offset; vec2 distortedUvB = screenPos - offset * (1.0 - chromaticAberration);
            float r = texture2D(tDiffuse, distortedUvR).r; float g = texture2D(tDiffuse, distortedUvG).g;
            float b = texture2D(tDiffuse, distortedUvB).b; vec3 finalColor = vec3(r, g, b);
            float scanline = sin(vUv.y * 800.0) * 0.5 + 0.5;
            finalColor.rgb -= scanline * scanlineIntensity * finalColor.rgb;
            float vignette = length(vUv - vec2(0.5)); finalColor *= (1.0 - vignette * vignetteDarkness);
            gl_FragColor = vec4(finalColor, 1.0);
        }`
};
const lensingPass = new ShaderPass(lensingShader);
composer.addPass(lensingPass);

const CustomGlitchShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'uIntensity': { value: 0.0 },
        'uTime': { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uIntensity;
        uniform float uTime;
        varying vec2 vUv;

        float random(vec2 p) {
            return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
            vec2 uv = vUv;
            vec3 finalColor;

            float r_offset = (random(uv + uTime * 0.4) - 0.5) * 0.05 * uIntensity;
            float g_offset = (random(uv + uTime * 0.6) - 0.5) * 0.05 * uIntensity;

            vec2 uvR = uv + vec2(r_offset, 0.0);
            vec2 uvG = uv + vec2(g_offset, 0.0);
            vec2 uvB = uv;

            float r = texture2D(tDiffuse, uvR).r;
            float g = texture2D(tDiffuse, uvG).g;
            float b = texture2D(tDiffuse, uvB).b;
            
            finalColor = vec3(r, g, b);

            float line_y = floor(uv.y * 50.0 + uTime * 20.0);
            float line_shift = (random(vec2(line_y, uTime)) - 0.5) * 0.1 * uIntensity;

            if (random(vec2(line_y, uTime * 2.0)) > 0.97 - (uIntensity * 0.3)) {
                finalColor = texture2D(tDiffuse, vec2(uv.x + line_shift, uv.y)).rgb;
            }

            vec3 originalColor = texture2D(tDiffuse, vUv).rgb;
            gl_FragColor = vec4(mix(originalColor, finalColor, uIntensity), 1.0);
        }`
};
const customGlitchPass = new ShaderPass(CustomGlitchShader);
customGlitchPass.enabled = false;
composer.addPass(customGlitchPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.035;
controls.rotateSpeed = 0.4; controls.autoRotate = false;
controls.autoRotateSpeed = 0.1; controls.target.set(0, 0, 0);
controls.minDistance = 2.5; controls.maxDistance = 100;
controls.enablePan = false;
controls.update();

const starGeometry = new THREE.BufferGeometry();
const starCount = 150000;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);
const starTwinkle = new Float32Array(starCount);
const starFieldRadius = 2000;
const starPalette = [
    new THREE.Color(0x00ffff), new THREE.Color(0xff00ff),
    new THREE.Color(0x8A2BE2), new THREE.Color(0x00ff7f),
    new THREE.Color(0xccddff),
];
for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    const phi = Math.acos(-1 + (2 * i) / starCount);
    const theta = Math.sqrt(starCount * Math.PI) * phi;
    const radius = Math.cbrt(Math.random()) * starFieldRadius + 100;
    starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i3 + 2] = radius * Math.cos(phi);
    const starColor = starPalette[Math.floor(Math.random() * starPalette.length)].clone();
    starColor.multiplyScalar(Math.random() * 0.7 + 0.3);
    starColors[i3] = starColor.r; starColors[i3 + 1] = starColor.g; starColors[i3 + 2] = starColor.b;
    starSizes[i] = THREE.MathUtils.randFloat(0.8, 2.5);
    starTwinkle[i] = Math.random() * Math.PI * 2;
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
starGeometry.setAttribute('twinkle', new THREE.BufferAttribute(starTwinkle, 1));

const starMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `
        uniform float uTime; uniform float uPixelRatio;
        attribute float size; attribute float twinkle;
        varying vec3 vColor; varying float vTwinkle;
        void main() {
            vColor = color; vTwinkle = sin(uTime * 2.5 + twinkle) * 0.5 + 0.5;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }`,
    fragmentShader: `
        varying vec3 vColor; varying float vTwinkle;
        void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            float cross = abs(gl_PointCoord.x - 0.5) + abs(gl_PointCoord.y - 0.5);
            if (cross > 0.5) discard;
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            alpha *= (0.2 + vTwinkle * 0.8);
            gl_FragColor = vec4(vColor, alpha);
        }`,
    transparent: true, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false
});
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

const eventHorizonGeom = new THREE.SphereGeometry(BLACK_HOLE_RADIUS * 1.05, 128, 64);
const eventHorizonMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCameraPosition: { value: camera.position } },
    vertexShader: `
        varying vec3 vNormal; varying vec3 vPosition;
        void main() {
            vNormal = normalize(normalMatrix * normal); vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: `
        uniform float uTime; uniform vec3 uCameraPosition;
        varying vec3 vNormal; varying vec3 vPosition;
        void main() {
            vec3 viewDirection = normalize(uCameraPosition - vPosition);
            float fresnel = 1.0 - abs(dot(vNormal, viewDirection));
            fresnel = pow(fresnel, 2.0); vec3 glowColor = vec3(0.0, 1.0, 0.8);
            float pulse = sin(uTime * 3.5) * 0.2 + 0.8;
            gl_FragColor = vec4(glowColor * fresnel * pulse, fresnel * 0.5);
        }`,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide
});
const eventHorizon = new THREE.Mesh(eventHorizonGeom, eventHorizonMat);
scene.add(eventHorizon);

const blackHoleGeom = new THREE.SphereGeometry(BLACK_HOLE_RADIUS, 128, 64);
const blackHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const blackHoleMesh = new THREE.Mesh(blackHoleGeom, blackHoleMat);
blackHoleMesh.renderOrder = 0;
scene.add(blackHoleMesh);

const diskGeometry = new THREE.RingGeometry(DISK_INNER_RADIUS, DISK_OUTER_RADIUS, 256, 128);
const diskMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0.0 }, uColorHot: { value: new THREE.Color(0xffffff) },
        uColorMid1: { value: new THREE.Color(0xff00ff) }, uColorMid2: { value: new THREE.Color(0x00ffff) },
        uColorOuter: { value: new THREE.Color(0x3939f5) }, uNoiseScale: { value: 3.5 },
        uFlowSpeed: { value: 0.25 }, uDensity: { value: 1.5 }
    },
    vertexShader: `
        varying vec2 vUv; varying float vRadius; varying float vAngle;
        void main() {
            vUv = uv; vRadius = length(position.xy); vAngle = atan(position.y, position.x);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: `
        uniform float uTime; uniform vec3 uColorHot; uniform vec3 uColorMid1; uniform vec3 uColorMid2; uniform vec3 uColorOuter;
        uniform float uNoiseScale; uniform float uFlowSpeed; uniform float uDensity;
        varying vec2 vUv; varying float vRadius; varying float vAngle;
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
            vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
            vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
            i = mod289(i); vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx; vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_); vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y); vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
            vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
            vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
            m = m * m; return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
        }
        void main() {
            float normalizedRadius = smoothstep(1.50, 8.00, vRadius);
            float timeOffset = uTime * uFlowSpeed * (2.0 / (vRadius * 0.3 + 1.0));
            vec2 noiseUv = vec2(vAngle * 2.0 + timeOffset, vRadius * 0.5);
            float noiseVal1 = snoise(vec3(noiseUv * uNoiseScale, uTime * 0.15));
            float noiseVal2 = snoise(vec3(noiseUv * uNoiseScale * 2.0 + 0.8, uTime * 0.22));
            float noiseVal = (noiseVal1 * 0.6 + noiseVal2 * 0.4); noiseVal = (noiseVal + 1.0) * 0.5;
            vec3 color = mix(uColorOuter, uColorMid2, smoothstep(0.0, 0.4, normalizedRadius));
            color = mix(color, uColorMid1, smoothstep(0.3, 0.7, normalizedRadius));
            color = mix(color, uColorHot, smoothstep(0.65, 0.95, normalizedRadius));
            float brightness = pow(1.0 - normalizedRadius, 1.2) * 3.0 + 0.5;
            brightness *= (0.3 + noiseVal * 2.2);
            float radialGrid = 1.0 - (sin(vRadius * 3.0 - uTime * 0.5) * 0.5 + 0.5);
            radialGrid = pow(radialGrid, 4.0); float angleGrid = 1.0 - (sin(vAngle * 20.0) * 0.5 + 0.5);
            angleGrid = pow(angleGrid, 4.0); float grid = 1.0 - clamp(radialGrid + angleGrid, 0.0, 1.0);
            brightness *= (0.7 + grid * 0.8); float alpha = uDensity * (0.2 + noiseVal * 0.9);
            alpha *= smoothstep(0.0, 0.15, normalizedRadius); alpha *= (1.0 - smoothstep(0.85, 1.0, normalizedRadius));
            alpha = clamp(alpha, 0.0, 1.0); gl_FragColor = vec4(color * brightness, alpha);
        }`,
    transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
});
const accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
accretionDisk.rotation.x = DISK_TILT_ANGLE;
accretionDisk.renderOrder = 1;
scene.add(accretionDisk);

const gridHelper = new THREE.GridHelper(100, 50, 0x00ffff, 0x00ffff);
gridHelper.material.opacity = 0.1;
gridHelper.material.transparent = true;
gridHelper.material.blending = THREE.AdditiveBlending;
gridHelper.position.y = -10;
scene.add(gridHelper);

setTimeout(() => { const info = document.getElementById('info'); if (info) info.style.opacity = '0'; }, 5000);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    if (bloomPass && bloomPass.resolution) bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    if (lensingPass && lensingPass.uniforms && lensingPass.uniforms.aspectRatio) lensingPass.uniforms.aspectRatio.value = window.innerWidth / window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
});

const glitchButton = document.getElementById('glitch-button');
let glitchAnimationId = null;

glitchButton.addEventListener('click', () => {
    if (glitchAnimationId) return;
    
    customGlitchPass.enabled = true;
    const duration = 1000;
    const startTime = performance.now();

    function animateGlitch(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        const intensity = Math.sin(progress * Math.PI);
        customGlitchPass.uniforms.uIntensity.value = intensity;

        if (progress < 1) {
            glitchAnimationId = requestAnimationFrame(animateGlitch);
        } else {
            customGlitchPass.enabled = false;
            customGlitchPass.uniforms.uIntensity.value = 0;
            glitchAnimationId = null;
        }
    }

    glitchAnimationId = requestAnimationFrame(animateGlitch);
});

const clock = new THREE.Clock();
const blackHoleScreenPosVec3 = new THREE.Vector3();
function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = clock.getDelta();
    
    if (customGlitchPass.enabled) {
         customGlitchPass.uniforms.uTime.value = elapsedTime;
    }

    diskMaterial.uniforms.uTime.value = elapsedTime;
    starMaterial.uniforms.uTime.value = elapsedTime;
    eventHorizonMat.uniforms.uTime.value = elapsedTime;
    if (eventHorizonMat.uniforms.uCameraPosition) eventHorizonMat.uniforms.uCameraPosition.value.copy(camera.position);

    blackHoleScreenPosVec3.copy(blackHoleMesh.position).project(camera);
    if (lensingPass && lensingPass.uniforms && lensingPass.uniforms.blackHoleScreenPos) {
        lensingPass.uniforms.blackHoleScreenPos.value.set(
            (blackHoleScreenPosVec3.x + 1) / 2,
            (blackHoleScreenPosVec3.y + 1) / 2
        );
    }
    
    controls.update();
    
    stars.rotation.y += deltaTime * 0.003;
    accretionDisk.rotation.z += deltaTime * 0.005;

    composer.render();
}

animate();

