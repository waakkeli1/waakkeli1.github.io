import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

const VERSION = "0.9.3-cardboard";
const STORAGE_KEY = "viper-deck-vr-settings-v1";
const SHINECON_G05A = Object.freeze({
  ipdMeters: 0.064,
  fovDeg: 78,
});

const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (value, digits = 0) => Number(value).toFixed(digits);

const canvas = document.getElementById("gameCanvas");
const startOverlay = document.getElementById("startOverlay");
const startVrButton = document.getElementById("startVrButton");
const startMonoButton = document.getElementById("startMonoButton");
const versionBadge = document.getElementById("versionBadge");
const errorBanner = document.getElementById("errorBanner");
const controllerStatus = document.getElementById("controllerStatus");
const calibrationStatus = document.getElementById("calibrationStatus");
const hintStrip = document.getElementById("hintStrip");
const liveMode = document.getElementById("liveMode");

versionBadge.textContent = `v${VERSION}`;

const savedSettings = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
})();

const state = {
  running: false,
  stereo: true,
  menuOpen: false,
  viewIndex: 0,
  score: 0,
  shots: 0,
  hits: 0,
  targetStreak: 0,
  elapsed: 0,
  timeScale: 1,
  width: 1,
  height: 1,
  fovDeg: savedSettings.fovDeg || SHINECON_G05A.fovDeg,
  ipdMeters: savedSettings.ipdMeters || SHINECON_G05A.ipdMeters,
  comfortAssist: savedSettings.comfortAssist ?? true,
  throttle: 0.58,
  pitchRate: 0,
  rollRate: 0,
  yawRate: 0,
  gLoad: 1,
  stall: false,
  speed: 176,
  altitude: 260,
  lastButton: "ei painalluksia",
  gamepadName: "",
  gamepadConnected: false,
  lastInputAt: 0,
  fireCooldown: 0,
  saveCooldown: 0,
  baseCameraPosition: new THREE.Vector3(),
  baseCameraQuaternion: new THREE.Quaternion(),
  gazeDirection: new THREE.Vector3(0, 0, -1),
};

const flight = {
  position: new THREE.Vector3(0, 260, 520),
  velocity: new THREE.Vector3(0, 0, -176),
  quaternion: new THREE.Quaternion(),
};

const input = {
  pitch: 0,
  roll: 0,
  yaw: 0,
  throttle: 0,
  fire: false,
  keys: new Set(),
  buttons: new Map(),
  axes: [0, 0, 0, 0],
  pointerActive: false,
  pointerX: 0,
  pointerY: 0,
  manualYaw: 0,
  manualPitch: 0,
};

const views = [
  {
    name: "Cockpit",
    offset: new THREE.Vector3(0, 0.86, -1.32),
    pitchDeg: -1,
    showExterior: false,
    showCockpit: true,
  },
  {
    name: "FPV nose",
    offset: new THREE.Vector3(0, 0.58, -3.72),
    pitchDeg: -2,
    showExterior: false,
    showCockpit: false,
  },
  {
    name: "Chase",
    offset: new THREE.Vector3(0, 2.35, 9.2),
    pitchDeg: -5,
    showExterior: true,
    showCockpit: false,
  },
  {
    name: "Wing",
    offset: new THREE.Vector3(-3.1, 0.42, -0.7),
    pitchDeg: -2,
    showExterior: true,
    showCockpit: false,
  },
];

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x07111f, 1);
renderer.autoClear = true;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8fb7d0, 0.00036);

const camera = new THREE.PerspectiveCamera(state.fovDeg, 1, 0.03, 7200);
camera.matrixAutoUpdate = true;
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xb9e8ff, 0x10202c, 2.25);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight(0xfff1c2, 3.1);
sunLight.position.set(-420, 860, 230);
scene.add(sunLight);

const clock = new THREE.Clock();
const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler();

const world = createWorld();
const aircraft = createFighter();
const targets = [];
const bullets = [];
const explosions = [];
const contrails = [];
const hud = createHudPlane();
const menuPanel = createMenuPlane();
const audio = createAudioEngine();

scene.add(world.sky, world.ocean, world.sun, world.islands, world.clouds, world.carrier);
scene.add(aircraft.root);
camera.add(hud.mesh);
camera.add(menuPanel.mesh);

spawnTargets();
resizeCanvas();
updateCalibrationText();
setView(0);
requestAnimationFrame(frame);

window.addEventListener("resize", resizeCanvas, { passive: true });
window.visualViewport?.addEventListener("resize", resizeCanvas, { passive: true });
window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 120), { passive: true });

startVrButton.addEventListener("click", () => startGame(true));
startMonoButton.addEventListener("click", () => startGame(false));
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", (event) => input.keys.delete(event.code));
window.addEventListener("gamepadconnected", (event) => {
  state.gamepadConnected = true;
  state.gamepadName = event.gamepad.id;
});
window.addEventListener("gamepaddisconnected", () => {
  state.gamepadConnected = false;
  state.gamepadName = "";
});
window.addEventListener("deviceorientation", onDeviceOrientation, { passive: true });
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);

window.addEventListener("error", (event) => showError(event.error || event.message || event));
window.addEventListener("unhandledrejection", (event) => showError(event.reason || event));

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function startGame(stereo) {
  resetFlight();
  state.running = true;
  state.stereo = stereo;
  state.menuOpen = false;
  startOverlay.classList.add("hidden");
  updateModeLabel();
  setView(state.viewIndex);
  document.documentElement.requestFullscreen?.().catch(() => {});
  screen.orientation?.lock?.("landscape").catch(() => {});
  audio.resume();
  requestMotionPermission();
  recenterHead();
  resizeCanvas();
}

function updateModeLabel() {
  liveMode.textContent = state.stereo ? "VR stereo" : "Testitila";
  hintStrip.style.display = state.stereo ? "none" : "flex";
}

function resetFlight() {
  flight.position.set(0, 260, 520);
  flight.velocity.set(0, 0, -176);
  flight.quaternion.identity();
  state.throttle = 0.58;
  state.pitchRate = 0;
  state.rollRate = 0;
  state.yawRate = 0;
  state.gLoad = 1;
  state.stall = false;
  state.speed = 176;
  state.altitude = 260;
  state.score = 0;
  state.shots = 0;
  state.hits = 0;
  state.targetStreak = 0;
  state.fireCooldown = 0;
  targets.forEach((target, index) => {
    target.group.position.set((Math.random() - 0.5) * 620, 170 + Math.random() * 360, -350 - index * 260);
    target.alive = true;
    target.group.visible = true;
  });
}

function showError(error) {
  const message = error?.stack || error?.message || String(error);
  errorBanner.style.display = "block";
  errorBanner.textContent = `JavaScript-virhe:\n${message}`;
}

function resizeCanvas() {
  const vv = window.visualViewport;
  const width = Math.max(1, Math.floor(vv?.width || window.innerWidth || document.documentElement.clientWidth));
  const height = Math.max(1, Math.floor(vv?.height || window.innerHeight || document.documentElement.clientHeight));
  state.width = width;
  state.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
  renderer.setSize(width, height, false);
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ipdMeters: state.ipdMeters,
      fovDeg: state.fovDeg,
      comfortAssist: state.comfortAssist,
    }),
  );
}

function updateCalibrationText() {
  const text = `IPD ${fmt(state.ipdMeters * 1000)} mm, FOV ${fmt(state.fovDeg)}°`;
  calibrationStatus.textContent = `${text}. D-pad vasen/oikea säätää IPD:tä, ylös/alas FOVia.`;
}

function onKeyDown(event) {
  input.keys.add(event.code);
  if (event.code === "Escape" || event.code === "KeyM") toggleMenu();
  if (event.code === "KeyV") cycleView();
  if (event.code === "KeyC") {
    state.comfortAssist = !state.comfortAssist;
    saveSettings();
  }
  if (event.code === "KeyR") recenterHead();
  if (event.code === "KeyX") {
    state.stereo = !state.stereo;
    updateModeLabel();
    resizeCanvas();
  }
  if (event.code === "BracketLeft") adjustIpd(-0.001);
  if (event.code === "BracketRight") adjustIpd(0.001);
  if (event.code === "Minus") adjustFov(-1);
  if (event.code === "Equal") adjustFov(1);
}

function onPointerDown(event) {
  input.pointerActive = true;
  input.pointerX = event.clientX;
  input.pointerY = event.clientY;
  canvas.setPointerCapture?.(event.pointerId);
  if (!state.running) return;
  if (event.clientY < state.height * 0.2) toggleMenu();
}

function onPointerMove(event) {
  if (!input.pointerActive) return;
  const dx = event.clientX - input.pointerX;
  const dy = event.clientY - input.pointerY;
  input.pointerX = event.clientX;
  input.pointerY = event.clientY;
  input.manualYaw -= dx * 0.0026;
  input.manualPitch = clamp(input.manualPitch - dy * 0.0021, -0.85, 0.85);
}

function onPointerUp(event) {
  input.pointerActive = false;
  canvas.releasePointerCapture?.(event.pointerId);
}

function toggleMenu() {
  if (!state.running) return;
  state.menuOpen = !state.menuOpen;
  menuPanel.mesh.visible = state.menuOpen;
  updateMenuTexture();
}

function cycleView() {
  setView((state.viewIndex + 1) % views.length);
}

function setView(index) {
  state.viewIndex = index;
  const view = views[state.viewIndex];
  aircraft.exterior.visible = view.showExterior;
  aircraft.cockpit.visible = view.showCockpit;
}

function resetShineconCalibration() {
  state.ipdMeters = SHINECON_G05A.ipdMeters;
  state.fovDeg = SHINECON_G05A.fovDeg;
  updateCalibrationText();
  saveSettings();
}

function adjustIpd(delta) {
  state.ipdMeters = clamp(state.ipdMeters + delta, 0.052, 0.074);
  updateCalibrationText();
  saveSettings();
}

function adjustFov(delta) {
  state.fovDeg = clamp(state.fovDeg + delta, 62, 94);
  updateCalibrationText();
  saveSettings();
}

function frame(now) {
  requestAnimationFrame(frame);
  try {
    const dt = Math.min(0.033, clock.getDelta()) * state.timeScale;
    state.elapsed += dt;
    pollGamepad(dt);
    if (!state.running && input.buttons.get("A")?.pressedEdge) startGame(true);
    if (state.running) {
      updateInputFromKeyboard(dt);
      updateFlight(dt);
      updateCamera();
      updateWeapons(dt);
      updateTargets(dt);
      updateEffects(dt);
      updateWorld(dt);
      updateHudTexture(now);
      updateAudio();
      if (state.menuOpen) updateMenuTexture();
      state.saveCooldown -= dt;
    } else {
      updateStartStatus();
      updateAttractCamera(now);
    }
    render();
  } catch (error) {
    showError(error);
  }
}

function pollGamepad(dt) {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const pad = pads[0];
  state.gamepadConnected = Boolean(pad);
  state.gamepadName = pad?.id || "";
  const previous = new Map(input.buttons);
  input.buttons.clear();
  input.axes = [0, 0, 0, 0];
  if (!pad) return;

  const names = [
    "A",
    "B",
    "X",
    "Y",
    "LB",
    "RB",
    "LT",
    "RT",
    "Back",
    "Start",
    "LS",
    "RS",
    "D-up",
    "D-down",
    "D-left",
    "D-right",
  ];

  pad.buttons.forEach((button, index) => {
    const name = names[index] || `B${index}`;
    const wasPressed = previous.get(name)?.pressed || false;
    const pressed = button.pressed || button.value > 0.55;
    input.buttons.set(name, {
      pressed,
      pressedEdge: pressed && !wasPressed,
      value: button.value,
    });
    if (pressed) state.lastButton = `${name} (${fmt(button.value, 2)})`;
  });

  for (let i = 0; i < Math.min(4, pad.axes.length); i += 1) {
    input.axes[i] = Math.abs(pad.axes[i]) > 0.08 ? pad.axes[i] : 0;
  }

  if (input.buttons.get("Start")?.pressedEdge || input.buttons.get("Back")?.pressedEdge) toggleMenu();
  if (input.buttons.get("B")?.pressedEdge) cycleView();
  if (input.buttons.get("X")?.pressedEdge) {
    state.stereo = !state.stereo;
    updateModeLabel();
    resizeCanvas();
  }
  if (input.buttons.get("Y")?.pressedEdge) resetShineconCalibration();
  if (input.buttons.get("RS")?.pressedEdge || input.buttons.get("LS")?.pressedEdge) recenterHead();

  const ipdDir = (input.buttons.get("D-right")?.pressed ? 1 : 0) - (input.buttons.get("D-left")?.pressed ? 1 : 0);
  const fovDir = (input.buttons.get("D-up")?.pressed ? 1 : 0) - (input.buttons.get("D-down")?.pressed ? 1 : 0);
  if (ipdDir) {
    state.ipdMeters = clamp(state.ipdMeters + ipdDir * 0.006 * dt, 0.052, 0.074);
    updateCalibrationText();
  }
  if (fovDir) {
    state.fovDeg = clamp(state.fovDeg + fovDir * 24 * dt, 62, 94);
    updateCalibrationText();
  }
  if ((ipdDir || fovDir) && state.saveCooldown <= 0) {
    saveSettings();
    state.saveCooldown = 0.3;
  }
}

function updateInputFromKeyboard() {
  const key = (code) => input.keys.has(code);
  const keyRoll = (key("KeyD") || key("ArrowRight") ? 1 : 0) - (key("KeyA") || key("ArrowLeft") ? 1 : 0);
  const keyPitch = (key("KeyS") || key("ArrowDown") ? 1 : 0) - (key("KeyW") || key("ArrowUp") ? 1 : 0);
  const keyYaw = (key("KeyE") ? 1 : 0) - (key("KeyQ") ? 1 : 0);
  const keyThrottle = (key("ShiftLeft") || key("ShiftRight") ? 1 : 0) - (key("ControlLeft") || key("ControlRight") ? 1 : 0);

  const gpPitch = -input.axes[1];
  const gpRoll = input.axes[0];
  const gpYaw = input.axes[2] || ((input.buttons.get("RB")?.pressed ? 1 : 0) - (input.buttons.get("LB")?.pressed ? 1 : 0)) * 0.7;
  const triggerThrottle =
    (input.buttons.get("RT")?.value || 0) - (input.buttons.get("LT")?.value || 0) + (input.axes[3] ? -input.axes[3] * 0.35 : 0);

  input.pitch = clamp(gpPitch || keyPitch, -1, 1);
  input.roll = clamp(gpRoll || keyRoll, -1, 1);
  input.yaw = clamp(gpYaw || keyYaw, -1, 1);
  input.throttle = clamp(triggerThrottle || keyThrottle, -1, 1);
  input.fire = Boolean(input.buttons.get("A")?.pressed || input.buttons.get("RT")?.pressed || key("Space"));
}

function updateFlight(dt) {
  state.throttle = clamp(state.throttle + input.throttle * 0.42 * dt, 0.18, 1);

  const speed = Math.max(1, flight.velocity.length());
  const forward = LOCAL_FORWARD.clone().applyQuaternion(flight.quaternion);
  const right = LOCAL_RIGHT.clone().applyQuaternion(flight.quaternion);
  const up = LOCAL_UP.clone().applyQuaternion(flight.quaternion);
  const forwardSpeed = flight.velocity.dot(forward);
  const verticalThroughWing = flight.velocity.dot(up);
  const aoa = Math.atan2(verticalThroughWing, Math.max(35, forwardSpeed));
  const stallFactor = Math.abs(aoa) > 0.42 || speed < 78 ? 0.38 : 1;
  const dynamicPressure = speed * speed;
  const trimLiftCoeff = clamp(9.81 / Math.max(1, dynamicPressure * 0.00092), 0.1, 0.42);
  const liftCoeff = clamp(trimLiftCoeff + aoa * 1.85 + input.pitch * 0.14, -0.75, 1.18) * stallFactor;
  const liftAccel = up.multiplyScalar(dynamicPressure * 0.00092 * liftCoeff);
  const dragMagnitude = dynamicPressure * (0.000085 + Math.abs(liftCoeff) * 0.000045);
  const dragAccel = flight.velocity.clone().normalize().multiplyScalar(-dragMagnitude);
  const thrustAccel = forward.multiplyScalar(2.8 + state.throttle * 14.5);
  const gravity = new THREE.Vector3(0, -9.81, 0);
  const sideSlip = right.multiplyScalar(-flight.velocity.dot(right) * 0.18);
  const acceleration = liftAccel.clone().add(dragAccel).add(thrustAccel).add(gravity).add(sideSlip);

  flight.velocity.addScaledVector(acceleration, dt);
  const maxSpeed = lerp(205, 315, state.throttle);
  if (flight.velocity.length() > maxSpeed) flight.velocity.setLength(maxSpeed);
  if (flight.velocity.length() < 62) flight.velocity.setLength(62);
  flight.position.addScaledVector(flight.velocity, dt);

  const controlAuthority = clamp((speed - 55) / 145, 0.28, 1.18);
  const rollLimit = state.comfortAssist ? 1.8 : 2.8;
  const pitchLimit = state.comfortAssist ? 0.72 : 1.05;
  const yawLimit = state.comfortAssist ? 0.45 : 0.72;
  state.rollRate = lerp(state.rollRate, -input.roll * rollLimit * controlAuthority, 1 - Math.exp(-3.8 * dt));
  state.pitchRate = lerp(state.pitchRate, input.pitch * pitchLimit * controlAuthority, 1 - Math.exp(-2.9 * dt));
  state.yawRate = lerp(state.yawRate, input.yaw * yawLimit * controlAuthority, 1 - Math.exp(-2.2 * dt));

  if (state.comfortAssist && Math.abs(input.roll) < 0.08) {
    const roll = getAircraftRoll();
    state.rollRate -= clamp(roll * 0.55, -0.42, 0.42) * dt;
  }

  tempEuler.set(state.pitchRate * dt, state.yawRate * dt, state.rollRate * dt, "XYZ");
  tempQuaternion.setFromEuler(tempEuler);
  flight.quaternion.multiply(tempQuaternion).normalize();

  const stability = state.comfortAssist ? 0.034 : 0.018;
  tempVector.copy(LOCAL_FORWARD).applyQuaternion(flight.quaternion).multiplyScalar(flight.velocity.length());
  flight.velocity.lerp(tempVector, stability * dt);

  if (flight.position.y < 12) {
    flight.position.y = 12;
    flight.velocity.y = Math.max(8, Math.abs(flight.velocity.y) * 0.22);
    flight.velocity.multiplyScalar(0.88);
  }
  if (flight.position.y > 1500) {
    flight.velocity.y -= 18 * dt;
  }

  state.speed = flight.velocity.length();
  state.altitude = flight.position.y;
  state.gLoad = clamp(liftAccel.length() / 9.81, 0, 9.5);
  state.stall = stallFactor < 1;

  aircraft.root.position.copy(flight.position);
  aircraft.root.quaternion.copy(flight.quaternion);
  aircraft.afterburner.scale.setScalar(0.85 + state.throttle * 0.75 + Math.sin(state.elapsed * 60) * 0.05);
  aircraft.nozzle.material.emissiveIntensity = 1.2 + state.throttle * 4.5;
  updateControlSurfaces();
}

function getAircraftRoll() {
  tempVector.copy(LOCAL_UP).applyQuaternion(flight.quaternion);
  return Math.atan2(tempVector.x, tempVector.y);
}

function updateControlSurfaces() {
  aircraft.leftAileron.rotation.x = input.roll * 0.22;
  aircraft.rightAileron.rotation.x = -input.roll * 0.22;
  aircraft.leftTail.rotation.x = -input.pitch * 0.17;
  aircraft.rightTail.rotation.x = -input.pitch * 0.17;
}

const head = {
  raw: new THREE.Quaternion(),
  zero: new THREE.Quaternion(),
  current: new THREE.Quaternion(),
  available: false,
  calibrated: false,
};

function requestMotionPermission() {
  const request = globalThis.DeviceOrientationEvent?.requestPermission;
  if (typeof request === "function") {
    request()
      .then((result) => {
        head.available = result === "granted";
      })
      .catch(() => {
        head.available = false;
      });
  }
}

function onDeviceOrientation(event) {
  if (event.alpha == null || event.beta == null || event.gamma == null) return;
  head.available = true;
  const alpha = THREE.MathUtils.degToRad(event.alpha || 0);
  const beta = THREE.MathUtils.degToRad(event.beta || 0);
  const gamma = THREE.MathUtils.degToRad(event.gamma || 0);
  const orient = THREE.MathUtils.degToRad(screen.orientation?.angle || window.orientation || 0);
  const zee = new THREE.Vector3(0, 0, 1);
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  const q0 = new THREE.Quaternion();
  tempEuler.set(beta, alpha, -gamma, "YXZ");
  head.raw.setFromEuler(tempEuler);
  head.raw.multiply(q1);
  head.raw.multiply(q0.setFromAxisAngle(zee, -orient));
  if (!head.calibrated) recenterHead();
}

function recenterHead() {
  head.zero.copy(head.raw).invert();
  head.calibrated = true;
}

function updateHeadQuaternion() {
  if (head.available) {
    head.current.copy(head.zero).multiply(head.raw).normalize();
  } else {
    tempEuler.set(input.manualPitch, input.manualYaw, 0, "YXZ");
    head.current.setFromEuler(tempEuler);
  }
}

function updateCamera() {
  updateHeadQuaternion();
  const view = views[state.viewIndex];
  const viewRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(view.pitchDeg), 0, 0, "XYZ"));
  const localOffset = view.offset.clone();
  state.baseCameraPosition.copy(localOffset.applyQuaternion(flight.quaternion)).add(flight.position);
  state.baseCameraQuaternion.copy(flight.quaternion).multiply(viewRot).multiply(head.current).normalize();
  camera.getWorldDirection(state.gazeDirection);
}

function render() {
  const w = state.width;
  const h = state.height;
  renderer.setScissorTest(false);
  renderer.clear();
  camera.fov = state.fovDeg;

  if (!state.stereo) {
    camera.aspect = w / h;
    camera.position.copy(state.baseCameraPosition);
    camera.quaternion.copy(state.baseCameraQuaternion);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    renderer.setViewport(0, 0, w, h);
    renderer.render(scene, camera);
    return;
  }

  const half = Math.floor(w / 2);
  camera.aspect = half / h;
  camera.updateProjectionMatrix();
  renderer.setScissorTest(true);

  for (let eye = 0; eye < 2; eye += 1) {
    const x = eye === 0 ? 0 : half;
    const sign = eye === 0 ? -1 : 1;
    tempVector.set(sign * state.ipdMeters * 0.5, 0, 0).applyQuaternion(state.baseCameraQuaternion);
    camera.position.copy(state.baseCameraPosition).add(tempVector);
    camera.quaternion.copy(state.baseCameraQuaternion);
    camera.updateMatrixWorld(true);
    renderer.setViewport(x, 0, half, h);
    renderer.setScissor(x, 0, half, h);
    renderer.render(scene, camera);
  }
  renderer.setScissorTest(false);
}

function updateWeapons(dt) {
  state.fireCooldown -= dt;
  if (input.fire && state.fireCooldown <= 0) {
    fireGun();
    state.fireCooldown = 0.105;
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.life -= dt;
    bullet.mesh.position.addScaledVector(bullet.velocity, dt);
    bullet.mesh.material.opacity = clamp(bullet.life * 3, 0, 1);
    if (bullet.life <= 0) {
      scene.remove(bullet.mesh);
      bullets.splice(i, 1);
      continue;
    }

    for (const target of targets) {
      if (!target.alive) continue;
      const distance = bullet.mesh.position.distanceTo(target.group.position);
      if (distance < target.radius) {
        target.alive = false;
        target.group.visible = false;
        scene.remove(bullet.mesh);
        bullets.splice(i, 1);
        state.hits += 1;
        state.targetStreak += 1;
        state.score += 100 + state.targetStreak * 25;
        createExplosion(target.group.position);
        audio.shoot(true);
        break;
      }
    }
  }
}

function fireGun() {
  state.shots += 1;
  state.targetStreak = Math.max(0, state.targetStreak - 0.15);
  tempVector.set(0, -0.04, -3.5).applyQuaternion(flight.quaternion).add(flight.position);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(state.baseCameraQuaternion).normalize();
  const geometry = new THREE.SphereGeometry(0.055, 8, 8);
  const material = new THREE.MeshBasicMaterial({
    color: 0x9efcff,
    transparent: true,
    opacity: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(tempVector);
  scene.add(mesh);
  bullets.push({
    mesh,
    velocity: direction.multiplyScalar(680).add(flight.velocity),
    life: 1.45,
  });
  audio.shoot(false);
}

function spawnTargets() {
  for (let i = 0; i < 9; i += 1) {
    const target = createTarget();
    target.group.position.set((Math.random() - 0.5) * 620, 170 + Math.random() * 360, -350 - i * 260);
    targets.push(target);
    scene.add(target.group);
  }
}

function updateTargets(dt) {
  for (const target of targets) {
    target.group.rotation.y += dt * 1.1;
    target.group.rotation.z += dt * 0.45;
    const distanceAhead = target.group.position.clone().sub(flight.position).dot(LOCAL_FORWARD.clone().applyQuaternion(flight.quaternion));
    if (!target.alive || distanceAhead < -160 || target.group.position.distanceTo(flight.position) > 2200) {
      recycleTarget(target);
    }
  }
}

function recycleTarget(target) {
  const forward = LOCAL_FORWARD.clone().applyQuaternion(flight.quaternion);
  const right = LOCAL_RIGHT.clone().applyQuaternion(flight.quaternion);
  const up = LOCAL_UP.clone().applyQuaternion(flight.quaternion);
  const ahead = 780 + Math.random() * 900;
  target.group.position
    .copy(flight.position)
    .addScaledVector(forward, ahead)
    .addScaledVector(right, (Math.random() - 0.5) * 680)
    .addScaledVector(up, 40 + Math.random() * 320);
  target.alive = true;
  target.group.visible = true;
}

function createExplosion(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffda76,
    transparent: true,
    opacity: 0.95,
  });
  for (let i = 0; i < 12; i += 1) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18 + Math.random() * 0.16, 8, 8), material.clone());
    mesh.position.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
    mesh.userData.velocity = mesh.position.clone().normalize().multiplyScalar(8 + Math.random() * 12);
    group.add(mesh);
  }
  scene.add(group);
  explosions.push({ group, life: 0.8 });
}

function updateEffects(dt) {
  if (state.throttle > 0.56 && contrails.length < 42) {
    const left = new THREE.Vector3(-1.65, -0.03, 1.15).applyQuaternion(flight.quaternion).add(flight.position);
    const right = new THREE.Vector3(1.65, -0.03, 1.15).applyQuaternion(flight.quaternion).add(flight.position);
    addContrail(left);
    addContrail(right);
  }

  for (let i = contrails.length - 1; i >= 0; i -= 1) {
    const trail = contrails[i];
    trail.life -= dt;
    trail.mesh.scale.multiplyScalar(1 + dt * 0.65);
    trail.mesh.material.opacity = clamp(trail.life * 0.28, 0, 0.35);
    if (trail.life <= 0) {
      scene.remove(trail.mesh);
      contrails.splice(i, 1);
    }
  }

  for (let i = explosions.length - 1; i >= 0; i -= 1) {
    const exp = explosions[i];
    exp.life -= dt;
    exp.group.children.forEach((child) => {
      child.position.addScaledVector(child.userData.velocity, dt);
      child.material.opacity = clamp(exp.life * 1.5, 0, 1);
    });
    if (exp.life <= 0) {
      scene.remove(exp.group);
      explosions.splice(i, 1);
    }
  }
}

function addContrail(position) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.2 }),
  );
  mesh.position.copy(position);
  scene.add(mesh);
  contrails.push({ mesh, life: 3.2 });
}

function updateWorld(dt) {
  world.ocean.material.uniforms.uTime.value += dt;
  world.ocean.position.x = flight.position.x;
  world.ocean.position.z = flight.position.z;
  world.clouds.children.forEach((cloud, i) => {
    cloud.position.x += dt * (4 + (i % 5));
    const dx = cloud.position.x - flight.position.x;
    const dz = cloud.position.z - flight.position.z;
    if (Math.abs(dx) > 1900 || Math.abs(dz) > 1900) {
      cloud.position.set(
        flight.position.x + (Math.random() - 0.5) * 2200,
        460 + Math.random() * 620,
        flight.position.z - 900 - Math.random() * 1300,
      );
    }
  });
}

function updateAttractCamera(now) {
  const t = now * 0.00018;
  state.baseCameraPosition.set(Math.sin(t) * 14, 270 + Math.sin(t * 0.7) * 8, 555 + Math.cos(t) * 18);
  state.baseCameraQuaternion.setFromEuler(new THREE.Euler(-0.03, Math.sin(t) * 0.18, 0, "YXZ"));
  aircraft.root.position.copy(flight.position);
  aircraft.root.quaternion.copy(flight.quaternion);
  aircraft.exterior.visible = true;
  aircraft.cockpit.visible = false;
  world.ocean.material.uniforms.uTime.value += 0.012;
}

function updateStartStatus() {
  const gp = state.gamepadConnected ? `${state.gamepadName || "Bluetooth-ohjain"}\nPainike: ${state.lastButton}` : "Ei tunnistettua ohjainta. Liitä Bluetooth-ohjain ja paina mitä tahansa nappia.";
  controllerStatus.textContent = gp;
}

function createWorld() {
  const sky = createSkyDome();
  const ocean = createOcean();
  const sun = createSunSprite();
  const islands = createIslands();
  const clouds = createClouds();
  const carrier = createCarrier();
  return { sky, ocean, sun, islands, clouds, carrier };
}

function createSkyDome() {
  const geometry = new THREE.SphereGeometry(5200, 36, 18);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x0b2d5c) },
      horizon: { value: new THREE.Color(0x9dd7e5) },
      low: { value: new THREE.Color(0xffc184) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = normalize(world.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 low;
      void main() {
        float h = clamp(vWorld.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(low, horizon, smoothstep(0.06, 0.38, h));
        col = mix(col, top, smoothstep(0.38, 1.0, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

function createOcean() {
  const geometry = new THREE.PlaneGeometry(6200, 6200, 126, 126);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      deep: { value: new THREE.Color(0x083a55) },
      shallow: { value: new THREE.Color(0x1ca6ba) },
    },
    vertexShader: `
      uniform float uTime;
      varying float vWave;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        float wave = sin((p.x + uTime * 36.0) * 0.018) * 1.7;
        wave += sin((p.z - uTime * 28.0) * 0.024) * 1.25;
        wave += sin((p.x + p.z + uTime * 20.0) * 0.011) * 2.1;
        p.y += wave;
        vWave = wave;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 deep;
      uniform vec3 shallow;
      varying float vWave;
      varying vec3 vWorld;
      void main() {
        float stripe = sin(vWorld.x * 0.04 + vWorld.z * 0.025) * 0.5 + 0.5;
        vec3 col = mix(deep, shallow, smoothstep(-2.0, 3.0, vWave) * 0.55 + stripe * 0.12);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

function createSunSprite() {
  const texture = makeRadialTexture("#fff6bd", "#ffb25b");
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(-1000, 1150, -1180);
  sprite.scale.setScalar(260);
  return sprite;
}

function createIslands() {
  const group = new THREE.Group();
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x3b664d, roughness: 0.92, metalness: 0.02 });
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x596a61, roughness: 0.96 });
  for (let i = 0; i < 12; i += 1) {
    const island = new THREE.Group();
    const x = (Math.random() - 0.5) * 2100;
    const z = -250 - Math.random() * 2300;
    island.position.set(x, -1, z);
    const radius = 70 + Math.random() * 150;
    const base = new THREE.Mesh(new THREE.ConeGeometry(radius, 18, 9), baseMaterial);
    base.position.y = 6;
    base.scale.z = 0.7 + Math.random() * 0.8;
    island.add(base);
    const peaks = 2 + Math.floor(Math.random() * 4);
    for (let p = 0; p < peaks; p += 1) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(radius * (0.25 + Math.random() * 0.22), 70 + Math.random() * 150, 7), rockMaterial);
      peak.position.set((Math.random() - 0.5) * radius * 0.8, 30, (Math.random() - 0.5) * radius * 0.55);
      peak.rotation.y = Math.random() * Math.PI;
      island.add(peak);
    }
    group.add(island);
  }
  return group;
}

function createClouds() {
  const group = new THREE.Group();
  const texture = makeCloudTexture();
  for (let i = 0; i < 46; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.26 + Math.random() * 0.24,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set((Math.random() - 0.5) * 2400, 430 + Math.random() * 620, -300 - Math.random() * 2600);
    const scale = 80 + Math.random() * 180;
    sprite.scale.set(scale * (1.6 + Math.random()), scale, 1);
    group.add(sprite);
  }
  return group;
}

function createCarrier() {
  const group = new THREE.Group();
  group.position.set(120, 8, 170);
  group.rotation.y = -0.08;
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3842, roughness: 0.78, metalness: 0.2 });
  const hullMaterial = new THREE.MeshStandardMaterial({ color: 0x16202a, roughness: 0.9, metalness: 0.15 });
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xf4f2dd });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(74, 6, 330), deckMaterial);
  deck.position.y = 8;
  group.add(deck);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(37, 72, 4), hullMaterial);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.z = Math.PI / 4;
  bow.position.set(0, 4, -198);
  group.add(bow);
  const island = new THREE.Mesh(new THREE.BoxGeometry(16, 34, 34), deckMaterial);
  island.position.set(28, 30, 20);
  group.add(island);
  const runway = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 255), stripeMaterial);
  runway.position.set(0, 11.2, -18);
  group.add(runway);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(54, 0.25, 3), stripeMaterial);
  cross.position.set(0, 11.3, -130);
  group.add(cross);
  return group;
}

function createFighter() {
  const root = new THREE.Group();
  const exterior = new THREE.Group();
  const cockpit = new THREE.Group();
  root.add(exterior, cockpit);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x637785, roughness: 0.44, metalness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111922, roughness: 0.62, metalness: 0.2 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x63d6ff,
    roughness: 0.08,
    metalness: 0.0,
    transmission: 0.15,
    transparent: true,
    opacity: 0.52,
  });
  const burnerMat = new THREE.MeshStandardMaterial({ color: 0xff8f3b, emissive: 0xff641f, emissiveIntensity: 3.5 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.78, 5.4, 24), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.1;
  exterior.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.43, 1.9, 24), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.48;
  exterior.add(nose);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 12), glassMat);
  canopy.scale.set(0.72, 0.33, 1.18);
  canopy.position.set(0, 0.52, -1.42);
  exterior.add(canopy);

  const wingGeo = makeWingGeometry(1);
  const leftWing = new THREE.Mesh(wingGeo, bodyMat);
  const rightWing = new THREE.Mesh(makeWingGeometry(-1), bodyMat);
  exterior.add(leftWing, rightWing);

  const leftAileron = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.05, 0.34), darkMat);
  leftAileron.position.set(-2.35, -0.06, 1.05);
  const rightAileron = leftAileron.clone();
  rightAileron.position.x = 2.35;
  exterior.add(leftAileron, rightAileron);

  const leftTail = new THREE.Mesh(makeTailPlaneGeometry(-1), bodyMat);
  const rightTail = new THREE.Mesh(makeTailPlaneGeometry(1), bodyMat);
  exterior.add(leftTail, rightTail);

  const fin = new THREE.Mesh(makeFinGeometry(), bodyMat);
  exterior.add(fin);
  const fin2 = fin.clone();
  fin2.position.x = -0.48;
  fin.position.x = 0.48;
  exterior.add(fin2);

  const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 1.7), darkMat);
  intakeL.position.set(-0.62, -0.26, -0.3);
  const intakeR = intakeL.clone();
  intakeR.position.x = 0.62;
  exterior.add(intakeL, intakeR);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.55, 0.62, 24), burnerMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = 2.98;
  exterior.add(nozzle);

  const afterburner = new THREE.Mesh(new THREE.ConeGeometry(0.52, 2.0, 24, 1, true), new THREE.MeshBasicMaterial({
    color: 0x5ce7ff,
    transparent: true,
    opacity: 0.33,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  afterburner.rotation.x = Math.PI / 2;
  afterburner.position.z = 3.75;
  exterior.add(afterburner);

  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.14, 0.28), darkMat);
  dash.position.set(0, 0.34, -2.24);
  cockpit.add(dash);
  const coaming = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.02, 8, 28, Math.PI), darkMat);
  coaming.position.set(0, 0.52, -2.12);
  coaming.rotation.z = Math.PI;
  cockpit.add(coaming);
  const hudGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.42),
    new THREE.MeshBasicMaterial({ color: 0x65ffe7, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
  );
  hudGlass.position.set(0, 0.76, -2.42);
  cockpit.add(hudGlass);
  const canopyFrame = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.022, 8, 40, Math.PI), darkMat);
  canopyFrame.scale.z = 1.8;
  canopyFrame.position.set(0, 0.98, -1.22);
  canopyFrame.rotation.z = Math.PI;
  cockpit.add(canopyFrame);

  return {
    root,
    exterior,
    cockpit,
    afterburner,
    nozzle,
    leftAileron,
    rightAileron,
    leftTail,
    rightTail,
  };
}

function makeWingGeometry(sign) {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0.12 * sign, -0.08, -0.92,
    3.65 * sign, -0.12, 0.42,
    0.38 * sign, -0.1, 1.72,
    0.12 * sign, 0.02, -0.92,
    3.65 * sign, 0.01, 0.42,
    0.38 * sign, 0.01, 1.72,
  ]);
  const indices = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeTailPlaneGeometry(sign) {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0.28 * sign, 0.02, 1.85,
    1.52 * sign, 0.08, 2.66,
    0.36 * sign, 0.04, 2.98,
  ]);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  return geometry;
}

function makeFinGeometry() {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, 0.15, 1.76,
    0, 1.38, 2.28,
    0, 0.18, 2.85,
  ]);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  return geometry;
}

function createTarget() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.12, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff5b6e, transparent: true, opacity: 0.9 }),
  );
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.8, 0),
    new THREE.MeshStandardMaterial({ color: 0xffd16b, emissive: 0xff401a, emissiveIntensity: 0.85, roughness: 0.35 }),
  );
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.08, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x424c58, roughness: 0.55, metalness: 0.35 }),
  );
  group.add(ring, core, wing);
  return { group, radius: 4.1, alive: true };
}

function createHudPlane() {
  const hudCanvas = document.createElement("canvas");
  hudCanvas.width = 1024;
  hudCanvas.height = 512;
  const ctx = hudCanvas.getContext("2d");
  const texture = new THREE.CanvasTexture(hudCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.42, 1.21), material);
  mesh.position.set(0, 0, -2.25);
  mesh.renderOrder = 20;
  return { mesh, canvas: hudCanvas, ctx, texture };
}

function updateHudTexture() {
  const ctx = hud.ctx;
  ctx.clearRect(0, 0, hud.canvas.width, hud.canvas.height);
  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.strokeStyle = "#79ffe7";
  ctx.fillStyle = "#bffdf3";
  ctx.lineWidth = 3;
  ctx.font = "700 34px ui-monospace, Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 255, 230, 0.52)";
  ctx.shadowBlur = 12;

  const cx = 512;
  const cy = 256;
  const roll = getAircraftRoll();
  const pitchOffset = clamp(state.pitchRate * 120, -80, 80);
  ctx.translate(cx, cy + pitchOffset);
  ctx.rotate(-roll);
  ctx.beginPath();
  ctx.moveTo(-220, 0);
  ctx.lineTo(-70, 0);
  ctx.moveTo(70, 0);
  ctx.lineTo(220, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-35, 0);
  ctx.lineTo(0, 22);
  ctx.lineTo(35, 0);
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  drawReticle(ctx, cx, cy);
  ctx.textAlign = "left";
  ctx.font = "700 28px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(`${fmt(state.speed * 1.944)} kt`, 64, 92);
  ctx.fillText(`${fmt(state.altitude)} m`, 64, 132);
  ctx.fillText(`THR ${fmt(state.throttle * 100)}%`, 64, 172);
  ctx.fillText(`G ${fmt(state.gLoad, 1)}`, 64, 212);

  ctx.textAlign = "right";
  ctx.fillText(views[state.viewIndex].name, 960, 92);
  ctx.fillText(`IPD ${fmt(state.ipdMeters * 1000)}mm`, 960, 132);
  ctx.fillText(`FOV ${fmt(state.fovDeg)}°`, 960, 172);
  ctx.fillText(state.stereo ? "VR" : "MONO", 960, 212);

  ctx.textAlign = "center";
  ctx.font = "700 24px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(`SCORE ${state.score}   HIT ${state.hits}/${state.shots}`, cx, 454);
  ctx.font = "700 21px ui-monospace, Menlo, Consolas, monospace";
  const gpText = state.gamepadConnected ? `PAD ${state.lastButton}` : "PAD ei tunnistettu";
  ctx.fillText(`${gpText}   START: MENU`, cx, 488);
  if (state.stall) {
    ctx.fillStyle = "#ff5e6c";
    ctx.font = "900 42px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText("STALL", cx, 92);
  }
  ctx.restore();
  hud.texture.needsUpdate = true;
}

function drawReticle(ctx, cx, cy) {
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.moveTo(cx - 62, cy);
  ctx.lineTo(cx - 22, cy);
  ctx.moveTo(cx + 22, cy);
  ctx.lineTo(cx + 62, cy);
  ctx.moveTo(cx, cy - 62);
  ctx.lineTo(cx, cy - 22);
  ctx.moveTo(cx, cy + 22);
  ctx.lineTo(cx, cy + 62);
  ctx.stroke();
}

function createMenuPlane() {
  const menuCanvas = document.createElement("canvas");
  menuCanvas.width = 1024;
  menuCanvas.height = 640;
  const ctx = menuCanvas.getContext("2d");
  const texture = new THREE.CanvasTexture(menuCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.18, 1.36), material);
  mesh.position.set(0, 0, -2.0);
  mesh.visible = false;
  mesh.renderOrder = 30;
  return { mesh, canvas: menuCanvas, ctx, texture };
}

function updateMenuTexture() {
  const ctx = menuPanel.ctx;
  ctx.clearRect(0, 0, menuPanel.canvas.width, menuPanel.canvas.height);
  ctx.fillStyle = "rgba(2, 8, 14, 0.84)";
  roundRect(ctx, 34, 34, 956, 572, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(132, 244, 255, 0.72)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#ecfbff";
  ctx.font = "900 56px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("VR MENU", 84, 118);
  ctx.font = "700 30px ui-monospace, Menlo, Consolas, monospace";
  const rows = [
    `A / Space: ammu    Start/Esc: jatka`,
    `B: näkymä (${views[state.viewIndex].name})`,
    `X: ${state.stereo ? "testaa ilman laseja" : "palaa VR-stereoon"}`,
    `Y: Shinecon G05A -kalibrointi`,
    `D-pad ←/→ IPD ${fmt(state.ipdMeters * 1000, 1)} mm`,
    `D-pad ↑/↓ FOV ${fmt(state.fovDeg, 1)}°`,
    `Ohjain: ${state.gamepadConnected ? state.gamepadName || "tunnistettu" : "ei tunnistettu"}`,
    `Viimeisin nappi: ${state.lastButton}`,
    `Mukavuusavustin: ${state.comfortAssist ? "päällä" : "pois"}  (C vaihtaa)`,
  ];
  rows.forEach((row, index) => {
    ctx.fillStyle = index < 6 ? "#bffdf3" : "rgba(236, 251, 255, 0.78)";
    ctx.fillText(row, 86, 190 + index * 43);
  });
  menuPanel.texture.needsUpdate = true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeRadialTexture(inner, outer) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 2, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner);
  g.addColorStop(1, `${outer}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCloudTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 64, 10, 128, 64, 120);
  g.addColorStop(0, "rgba(255,255,255,0.86)");
  g.addColorStop(0.42, "rgba(255,255,255,0.54)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 8; i += 1) {
    const x = 42 + Math.random() * 172;
    const y = 42 + Math.random() * 38;
    const r = 28 + Math.random() * 42;
    const blob = ctx.createRadialGradient(x, y, 4, x, y, r);
    blob.addColorStop(0, "rgba(255,255,255,0.78)");
    blob.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, 256, 128);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createAudioEngine() {
  let ctx;
  let engine;
  let gain;
  return {
    resume() {
      try {
        ctx ||= new (window.AudioContext || window.webkitAudioContext)();
        if (!engine) {
          gain = ctx.createGain();
          gain.gain.value = 0.028;
          engine = ctx.createOscillator();
          engine.type = "sawtooth";
          engine.frequency.value = 72;
          engine.connect(gain).connect(ctx.destination);
          engine.start();
        }
        ctx.resume();
      } catch {}
    },
    update() {
      if (!ctx || !engine || !gain) return;
      engine.frequency.setTargetAtTime(58 + state.throttle * 72 + state.speed * 0.18, ctx.currentTime, 0.04);
      gain.gain.setTargetAtTime(0.018 + state.throttle * 0.028, ctx.currentTime, 0.05);
    },
    shoot(hit) {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const shotGain = ctx.createGain();
      osc.type = hit ? "triangle" : "square";
      osc.frequency.value = hit ? 240 : 118;
      shotGain.gain.value = hit ? 0.065 : 0.035;
      shotGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (hit ? 0.24 : 0.08));
      osc.connect(shotGain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (hit ? 0.26 : 0.09));
    },
  };
}

function updateAudio() {
  audio.update();
}
