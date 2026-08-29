import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const host = document.querySelector("#webgl");
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x075f99, .035);

const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, .1, 100);
camera.position.set(0, .15, 7.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
host.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.HemisphereLight(0xdff7ff, 0x00355c, 2.3));

const key = new THREE.DirectionalLight(0xffffff, 4);
key.position.set(-3, 5, 6);
scene.add(key);

const rim = new THREE.PointLight(0x49bfff, 38, 14);
rim.position.set(4, 1, 2);
scene.add(rim);

const blue = new THREE.PointLight(0x006cff, 25, 15);
blue.position.set(-5, -1, 2);
scene.add(blue);

// Flag group
const flag = new THREE.Group();
scene.add(flag);
flag.position.set(.55, .1, 0);

// Pole
const poleMat = new THREE.MeshStandardMaterial({ color: 0x1b2228, metalness: .8, roughness: .22 });
const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 5.4, 16), poleMat);
pole.position.set(-2.25, 0, 0);
flag.add(pole);

const cap = new THREE.Mesh(new THREE.SphereGeometry(.075, 16, 10), poleMat);
cap.position.set(-2.25, 2.72, 0);
flag.add(cap);

// --- CLOTH MESH (Dimensiones originales) ---
const W = 5.5, H = 3.2; 
const cols = 75, rows = 45;
const basePositions = new Float32Array((cols + 1) * (rows + 1) * 3);
const positions = new Float32Array(basePositions.length);
const uvs = new Float32Array((cols + 1) * (rows + 1) * 2);
const indices = [];

let k = 0, uv = 0;
for (let y = 0; y <= rows; y++) {
  const v = y / rows;
  for (let x = 0; x <= cols; x++) {
    const u = x / cols;
    const px = -2.18 + u * W;
    const py = 1.55 - v * H;
    const pz = 0;
    basePositions[k] = px; basePositions[k + 1] = py; basePositions[k + 2] = pz;
    positions[k] = px; positions[k + 1] = py; positions[k + 2] = pz; k += 3;
    uvs[uv++] = u; uvs[uv++] = v;
  }
}
for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) {
    const a = y * (cols + 1) + x, b = a + 1, c = a + (cols + 1), d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
}

const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
geo.setIndex(indices);
geo.computeVertexNormals();

// Cargar y ajustar la textura cuadrada para que NO se estire
const textureLoader = new THREE.TextureLoader();
const flagTexture = textureLoader.load(
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRHJElh9vVIdvjPphsAB92p0HWto-TeGznbkOQ_6WMrnQ&s"
);
flagTexture.colorSpace = THREE.SRGBColorSpace;

// Evitamos que la imagen se repita en bucle en los bordes
flagTexture.wrapS = THREE.ClampToEdgeWrapping;
flagTexture.wrapT = THREE.ClampToEdgeWrapping;

// Escala la textura para que mantenga su proporción 1:1 respecto a W y H (5.5 / 3.2)
const repeatX = W / H; // ~1.718
flagTexture.repeat.set(repeatX, 1); //
flagTexture.offset.x = (1 - repeatX) / 2; // Centra la imagen horizontalmente

const clothMat = new THREE.MeshPhysicalMaterial({
  map: flagTexture,
  roughness: .72,
  metalness: .02,
  side: THREE.DoubleSide,
  clearcoat: .15
});

const cloth = new THREE.Mesh(geo, clothMat);
cloth.castShadow = true;
cloth.receiveShadow = true;
flag.add(cloth);

// Floating dust
const count = 260;
const pts = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  pts[i * 3] = (Math.random() - .5) * 12;
  pts[i * 3 + 1] = (Math.random() - .5) * 7;
  pts[i * 3 + 2] = (Math.random() - .5) * 5;
}
const pg = new THREE.BufferGeometry();
pg.setAttribute("position", new THREE.BufferAttribute(pts, 3));
const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xd8f7ff, size: .018, transparent: true, opacity: .48 }));
scene.add(dust);

// Pointer + scroll physics
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener("pointermove", e => {
  mouse.tx = (e.clientX / innerWidth - .5) * 2;
  mouse.ty = (e.clientY / innerHeight - .5) * 2;
});
let scroll = 0, targetScroll = 0;
addEventListener("scroll", () => targetScroll = Math.min(scrollY / innerHeight, 2), { passive: true });

const clock = new THREE.Clock();

function damp(a, b, l, dt) { return THREE.MathUtils.damp(a, b, l, dt) }

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .033);
  const t = performance.now() * .001;

  mouse.x = damp(mouse.x, mouse.tx, 5, dt);
  mouse.y = damp(mouse.y, mouse.ty, 5, dt);
  scroll = damp(scroll, targetScroll, 4, dt);

  // Cloth simulation
  const pos = geo.attributes.position.array;
  const base = basePositions;
  for (let y = 0; y <= rows; y++) {
    const v = y / rows;
    for (let x = 0; x <= cols; x++) {
      const u = x / cols;
      const i = (y * (cols + 1) + x) * 3;

      const edge = u * u;
      const wind =
        Math.sin(t * 2.25 + u * 8.2 + v * 1.7) * .18 * edge +
        Math.sin(t * 1.35 + u * 15 - v * 4) * .075 * edge +
        Math.sin(t * 3.1 + u * 28) * .028 * edge;

      const dx = u - (mouse.x * .5 + .5);
      const dy = v - (mouse.y * .35 + .5);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const influence = Math.max(0, 1 - dist / .48);
      const cursorForce = Math.sin(influence * Math.PI) * .30 * edge;

      pos[i] = base[i];
      pos[i + 1] = base[i + 1];
      pos[i + 2] = wind + cursorForce;

      pos[i + 1] += Math.sin(t * 1.4 + u * 5) * .035 * edge;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();

  flag.rotation.y = damp(flag.rotation.y, -mouse.x * .12 + scroll * .38, 3.5, dt);
  flag.rotation.x = damp(flag.rotation.x, mouse.y * .06 - scroll * .06, 3.5, dt);
  flag.position.y = damp(flag.position.y, .1 - scroll * .35, 3.5, dt);

  camera.position.x = damp(camera.position.x, mouse.x * .35, 3, dt);
  camera.position.y = damp(camera.position.y, .15 - mouse.y * .18 + scroll * .2, 3, dt);
  camera.lookAt(.45, .05 - scroll * .1, 0);

  dust.rotation.y += dt * .01;
  renderer.render(scene, camera);
}
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});