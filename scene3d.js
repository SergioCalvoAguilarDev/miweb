import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

(function initScene3D() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 22);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:5;cursor:pointer;';
  document.body.prepend(canvas);

  // Lighting — brighter, cinematic PlayStation style
  scene.add(new THREE.AmbientLight(0x667788, 1.8));
  const d1 = new THREE.DirectionalLight(0xffffff, 2.2);
  d1.position.set(5, 8, 6);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0x4499dd, 1.4);
  d2.position.set(-6, -2, 4);
  scene.add(d2);
  const d3 = new THREE.DirectionalLight(0x0070d1, 0.8);
  d3.position.set(0, -6, 3);
  scene.add(d3);
  const d4 = new THREE.DirectionalLight(0xaaccff, 0.6);
  d4.position.set(-3, 5, -2);
  scene.add(d4);

  // Rim light (backlight for silhouette definition)
  const rimLight = new THREE.DirectionalLight(0x0088ff, 1.0);
  rimLight.position.set(0, 0, -8);
  scene.add(rimLight);

  // ── Inspection light rig (all off by default) ──
  // Key light — main illumination from front-right
  const inspectKey = new THREE.SpotLight(0xffffff, 0, 60, Math.PI / 3, 0.4, 0.5);
  inspectKey.position.set(4, 3, 19);
  scene.add(inspectKey);
  scene.add(inspectKey.target);

  // Fill light — softer from front-left to reduce shadows
  const inspectFill = new THREE.SpotLight(0x88bbff, 0, 60, Math.PI / 2.5, 0.5, 0.5);
  inspectFill.position.set(-4, 1, 19);
  scene.add(inspectFill);
  scene.add(inspectFill.target);

  // Rim/back light — blue edge highlight from behind
  const inspectRim = new THREE.SpotLight(0x0070d1, 0, 60, Math.PI / 2.5, 0.3, 0.5);
  inspectRim.position.set(0, 0, 12);
  scene.add(inspectRim);
  scene.add(inspectRim.target);

  // Top light — subtle overhead
  const inspectTop = new THREE.SpotLight(0xccddff, 0, 60, Math.PI / 3, 0.4, 0.5);
  inspectTop.position.set(0, 6, 18);
  scene.add(inspectTop);
  scene.add(inspectTop.target);

  // Bottom fill — subtle uplight
  const inspectBottom = new THREE.PointLight(0x4488bb, 0, 40);
  inspectBottom.position.set(0, -4, 17);
  scene.add(inspectBottom);

  function setInspectLights(on, targetPos) {
    const key = on ? 80 : 0;
    const fill = on ? 50 : 0;
    const rim = on ? 40 : 0;
    const top = on ? 35 : 0;
    const bottom = on ? 20 : 0;

    inspectKey.intensity = key;
    inspectFill.intensity = fill;
    inspectRim.intensity = rim;
    inspectTop.intensity = top;
    inspectBottom.intensity = bottom;

    if (targetPos) {
      inspectKey.target.position.copy(targetPos);
      inspectFill.target.position.copy(targetPos);
      inspectRim.target.position.set(targetPos.x, targetPos.y, targetPos.z + 4);
      inspectTop.target.position.copy(targetPos);
    }
  }

  // Simple environment for reflections
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x101018);
  const envTop = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({ color: 0x1a2a44 })
  );
  envTop.position.set(0, 30, 0);
  envTop.rotation.x = Math.PI / 2;
  envScene.add(envTop);
  const pmremGen = new THREE.PMREMGenerator(renderer);
  const envMap = pmremGen.fromScene(envScene, 0.04).texture;
  scene.environment = envMap;
  pmremGen.dispose();

  // ── Config ──
  const TARGET_SIZE = 7;
  const COPIES_PER_MODEL = 1;

  const MODEL_COLOR = 0x8888a0;
  const MODEL_EMISSIVE = 0x111122;

  const modelSources = [
    { file: 'models/Black_Kat.fbx', type: 'fbx', name: 'Black Kat' },
    { file: 'models/CocheParaTex.fbx', type: 'fbx', name: 'Coche' },
    { file: 'models/FIGURA_LOW.fbx', type: 'fbx', name: 'Figura' },
    { file: 'models/chica.FBX', type: 'fbx', name: 'Chica' },
    { file: 'models/VanellopeTpose.fbx', type: 'fbx', name: 'Vanellope' },
    { file: 'models/Spyro.fbx', type: 'fbx', name: 'Spyro' },
    { file: 'models/pikaprueba.fbx', type: 'fbx', name: 'Pikachu' },
    { file: 'models/Cassette.obj', type: 'obj', name: 'Cassette' },
  ];

  const floatingObjects = [];
  const fbxLoader = new FBXLoader();
  const objLoader = new OBJLoader();
  const WIREFRAME_COLOR = 0x0070d1;

  // ── Inspection state ──
  let inspecting = null;       // { entry, savedPos, savedRot, savedScale }
  let inspectTransition = 0;   // 0 = floating, 1 = fully inspecting
  let inspectTarget = 0;       // target value for transition
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let inspectRotation = { x: 0, y: 0 };
  let inspectZoom = 1.0;

  // UI overlay for inspection
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 12; pointer-events: none;
    background: rgba(0,0,0,0); transition: background 0.4s;
  `;
  document.body.appendChild(overlay);

  const nameLabel = document.createElement('div');
  nameLabel.style.cssText = `
    position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
    z-index: 13; font-family: 'Space Grotesk', sans-serif; font-size: 14px;
    font-weight: 600; color: #2e8fe0; letter-spacing: 0.05em;
    background: rgba(4,6,14,0.9); border: 1px solid rgba(0,112,209,0.2);
    padding: 8px 20px; border-radius: 10px; backdrop-filter: blur(12px);
    opacity: 0; transition: opacity 0.3s; pointer-events: none;
  `;
  document.body.appendChild(nameLabel);

  const hintLabel = document.createElement('div');
  hintLabel.style.cssText = `
    position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
    z-index: 13; font-family: 'Inter', sans-serif; font-size: 12px;
    color: rgba(255,255,255,0.4); letter-spacing: 0.04em;
    opacity: 0; transition: opacity 0.3s; pointer-events: none;
  `;
  hintLabel.textContent = 'Arrastra para rotar \u00b7 Clic o ESC para cerrar';
  document.body.appendChild(hintLabel);

  // ── Helpers ──

  function applyMaterial(object) {
    object.traverse(function (child) {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: MODEL_COLOR,
          emissive: MODEL_EMISSIVE,
          emissiveIntensity: 0.4,
          metalness: 0.6,
          roughness: 0.25,
          envMap: envMap,
          envMapIntensity: 0.8,
        });
      }
    });
  }

  function centerAndNormalize(object) {
    object.scale.set(1, 1, 1);
    object.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    object.position.set(0, 0, 0);
    object.updateMatrixWorld(true);

    const wrapper = new THREE.Group();
    wrapper.add(object);
    object.position.set(-center.x, -center.y, -center.z);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      wrapper.scale.setScalar(TARGET_SIZE / maxDim);
    }
    wrapper.updateMatrixWorld(true);
    return wrapper;
  }

  function createFloatingEntry(sourceWrapper, modelName) {
    const clone = sourceWrapper.clone();
    applyMaterial(clone);

    const spreadX = 26;
    const spreadY = 18;
    const x = (Math.random() - 0.5) * spreadX;
    const y = (Math.random() - 0.5) * spreadY;
    const z = (Math.random() - 0.5) * 10 - 4;

    clone.position.set(x, y, z);
    clone.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    scene.add(clone);

    const angle = Math.random() * Math.PI * 2;
    const speed = 0.04 + Math.random() * 0.06;

    floatingObjects.push({
      object: clone,
      name: modelName,
      velocity: new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, 0),
      angularVel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03
      ),
      speed: speed,
      frozen: false
    });
  }

  // ── Load all models ──

  function onLoaded(object, cfg) {
    object.animations = [];
    const wrapper = centerAndNormalize(object);
    for (let i = 0; i < COPIES_PER_MODEL; i++) {
      createFloatingEntry(wrapper, cfg.name);
    }
    console.log('Loaded:', cfg.file);
  }

  modelSources.forEach(function (cfg) {
    const loader = cfg.type === 'obj' ? objLoader : fbxLoader;
    loader.load(
      cfg.file,
      function (object) { onLoaded(object, cfg); },
      function (xhr) {
        if (xhr.total) console.log(cfg.file, Math.round(xhr.loaded / xhr.total * 100) + '%');
      },
      function (err) { console.error('Error loading:', cfg.file, err); }
    );
  });

  // ── Inspection functions ──

  function startInspect(entry) {
    if (inspecting) return;

    inspecting = {
      entry: entry,
      savedPos: entry.object.position.clone(),
      savedRot: entry.object.rotation.clone(),
      savedScale: entry.object.scale.clone(),
      savedVel: entry.velocity.clone(),
      savedAngVel: entry.angularVel.clone()
    };

    entry.frozen = true;
    entry.velocity.set(0, 0, 0);
    entry.angularVel.set(0, 0, 0);

    inspectRotation.x = entry.object.rotation.x;
    inspectRotation.y = entry.object.rotation.y;
    inspectZoom = 1.0;
    inspectTarget = 1;

    // Show UI
    overlay.style.background = 'rgba(0,0,0,0)';
    nameLabel.textContent = entry.name;
    nameLabel.style.opacity = '1';
    hintLabel.style.opacity = '1';
    canvas.style.cursor = 'grab';
    setInspectLights(true, getInspectPos());

    // Hide the interaction hint permanently
    const hint = document.getElementById('interactHint');
    if (hint) hint.classList.add('hidden');

    // Brighten the inspected model
    entry.object.traverse(function (child) {
      if (child.isMesh && child.name !== '__wireframe__') {
        child.material.color.set(0xbbbbcc);
        child.material.emissive.set(0x222233);
        child.material.emissiveIntensity = 1.0;
        child.material.envMapIntensity = 2.0;
        child.material.metalness = 0.4;
        child.material.roughness = 0.3;
      }
    });

    // Add wireframe overlay to inspected model
    entry.object.traverse(function (child) {
      if (child.isMesh && child.name !== '__wireframe__') {
        const wireMat = new THREE.MeshBasicMaterial({
          color: WIREFRAME_COLOR,
          wireframe: true,
          transparent: true,
          opacity: 0.35,
        });
        const wireMesh = new THREE.Mesh(child.geometry, wireMat);
        wireMesh.name = '__wireframe__';
        wireMesh.position.copy(child.position);
        wireMesh.rotation.copy(child.rotation);
        wireMesh.scale.copy(child.scale);
        child.parent.add(wireMesh);
      }
    });

    // Dim other objects
    floatingObjects.forEach(function (e) {
      if (e !== entry) {
        e.object.traverse(function (child) {
          if (child.isMesh && child.name !== '__wireframe__') {
            child.material.transparent = true;
            child.material.opacity = 0.15;
          }
        });
      }
    });
  }

  function endInspect() {
    if (!inspecting) return;

    const entry = inspecting.entry;
    inspectTarget = 0;

    // Remove wireframes and restore material
    const toRemove = [];
    entry.object.traverse(function (child) {
      if (child.name === '__wireframe__') toRemove.push(child);
      if (child.isMesh && child.name !== '__wireframe__') {
        child.material.color.set(MODEL_COLOR);
        child.material.emissive.set(MODEL_EMISSIVE);
        child.material.emissiveIntensity = 0.4;
        child.material.envMapIntensity = 0.8;
        child.material.metalness = 0.6;
        child.material.roughness = 0.25;
      }
    });
    toRemove.forEach(function (w) { w.parent.remove(w); });

    // Restore others
    floatingObjects.forEach(function (e) {
      e.object.traverse(function (child) {
        if (child.isMesh && child.name !== '__wireframe__') {
          child.material.transparent = false;
          child.material.opacity = 1.0;
        }
      });
    });

    // Hide UI
    overlay.style.background = 'rgba(0,0,0,0)';
    nameLabel.style.opacity = '0';
    hintLabel.style.opacity = '0';
    canvas.style.cursor = 'pointer';
    setInspectLights(false, null);

    // We'll animate back in the loop, then unfreeze
    // Save the target we need to return to
    inspecting._returning = true;
  }

  // ── Mouse / Input ──

  const raycaster = new THREE.Raycaster();
  const mouse3D = new THREE.Vector2();
  const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const mouseWorld = new THREE.Vector3();
  let mouseScreenX = 0, mouseScreenY = 0, mouseDown = false;
  let clickStart = { x: 0, y: 0, time: 0 };

  canvas.addEventListener('mousemove', function (e) {
    mouseScreenX = e.clientX;
    mouseScreenY = e.clientY;
    mouse3D.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse3D, camera);
    raycaster.ray.intersectPlane(mousePlane, mouseWorld);

    // Drag rotation in inspect mode
    if (inspecting && !inspecting._returning && isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      inspectRotation.y = dragStart.rotY + dx * 0.008;
      inspectRotation.x = dragStart.rotX + dy * 0.008;
      canvas.style.cursor = 'grabbing';
    }

    // Hover highlight when not inspecting
    if (!inspecting) {
      raycaster.setFromCamera(mouse3D, camera);
      const sceneObjs = floatingObjects.map(function (e) { return e.object; });
      const hits = raycaster.intersectObjects(sceneObjs, true);
      canvas.style.cursor = hits.length > 0 ? 'pointer' : 'default';
    }
  });

  canvas.addEventListener('mousedown', function (e) {
    mouseDown = true;
    clickStart = { x: e.clientX, y: e.clientY, time: Date.now() };

    if (inspecting && !inspecting._returning) {
      isDragging = true;
      dragStart = {
        x: e.clientX,
        y: e.clientY,
        rotX: inspectRotation.x,
        rotY: inspectRotation.y
      };
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('mouseup', function (e) {
    mouseDown = false;
    const dx = Math.abs(e.clientX - clickStart.x);
    const dy = Math.abs(e.clientY - clickStart.y);
    const dt = Date.now() - clickStart.time;
    const isClick = dx < 5 && dy < 5 && dt < 300;

    if (inspecting && !inspecting._returning) {
      if (isClick && !isDragging) {
        endInspect();
      }
      isDragging = false;
      if (inspecting) canvas.style.cursor = 'grab';
      return;
    }

    isDragging = false;

    // Check if clicked on a model
    if (isClick && !inspecting) {
      raycaster.setFromCamera(mouse3D, camera);

      // Collect all scene objects from floating entries
      const sceneObjects = floatingObjects.map(function (e) { return e.object; });
      const hits = raycaster.intersectObjects(sceneObjects, true);

      if (hits.length > 0) {
        // Walk up from hit mesh to find which floating entry owns it
        let hitObj = hits[0].object;
        let found = null;
        while (hitObj) {
          for (let i = 0; i < floatingObjects.length; i++) {
            if (floatingObjects[i].object === hitObj) {
              found = floatingObjects[i];
              break;
            }
          }
          if (found) break;
          hitObj = hitObj.parent;
        }
        if (found) startInspect(found);
      }
    }
  });

  // ESC to close
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && inspecting && !inspecting._returning) {
      endInspect();
    }
  });

  // Mouse wheel zoom in inspect mode
  canvas.addEventListener('wheel', function (e) {
    if (inspecting && !inspecting._returning) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.93 : 1.07;
      inspectZoom = Math.max(0.2, Math.min(3.0, inspectZoom * delta));
    }
  }, { passive: false });

  // ── Animation ──

  const PUSH_RADIUS = 4.5;
  const PUSH_FORCE = 0.15;
  const CLICK_FORCE = 0.6;
  const clock = new THREE.Clock();

  // Inspect target position: center of screen, in front of camera
  const INSPECT_SCALE = 0.4;

  function getInspectPos() {
    return new THREE.Vector3(0, 0, 16);
  }

  function animate() {
    requestAnimationFrame(animate);
    const vFov = camera.fov * Math.PI / 180;

    // Smooth inspection transition
    inspectTransition += (inspectTarget - inspectTransition) * 0.08;

    floatingObjects.forEach(function (entry) {
      const obj = entry.object;
      const pos = obj.position;
      const vel = entry.velocity;

      // If this is the inspected object
      if (inspecting && inspecting.entry === entry) {
        if (inspectTarget === 1 && !inspecting._returning) {
          // Move toward inspect position
          const target = getInspectPos();
          pos.x += (target.x - pos.x) * 0.08;
          pos.y += (target.y - pos.y) * 0.08;
          pos.z += (target.z - pos.z) * 0.08;

          // Scale down to fit screen, with user zoom
          const ts = INSPECT_SCALE * inspectZoom;
          obj.scale.x += (inspecting.savedScale.x * ts - obj.scale.x) * 0.08;
          obj.scale.y += (inspecting.savedScale.y * ts - obj.scale.y) * 0.08;
          obj.scale.z += (inspecting.savedScale.z * ts - obj.scale.z) * 0.08;

          // Apply user rotation
          obj.rotation.x += (inspectRotation.x - obj.rotation.x) * 0.12;
          obj.rotation.y += (inspectRotation.y - obj.rotation.y) * 0.12;
        } else if (inspecting._returning) {
          // Animate back to saved position
          const sp = inspecting.savedPos;
          pos.x += (sp.x - pos.x) * 0.08;
          pos.y += (sp.y - pos.y) * 0.08;
          pos.z += (sp.z - pos.z) * 0.08;

          // Restore scale
          const ss = inspecting.savedScale;
          obj.scale.x += (ss.x - obj.scale.x) * 0.08;
          obj.scale.y += (ss.y - obj.scale.y) * 0.08;
          obj.scale.z += (ss.z - obj.scale.z) * 0.08;

          const sr = inspecting.savedRot;
          obj.rotation.x += (sr.x - obj.rotation.x) * 0.08;
          obj.rotation.y += (sr.y - obj.rotation.y) * 0.08;
          obj.rotation.z += (sr.z - obj.rotation.z) * 0.08;

          // Check if close enough to release
          const d = pos.distanceTo(sp);
          if (d < 0.1) {
            pos.copy(sp);
            obj.rotation.copy(sr);
            obj.scale.copy(ss);
            entry.velocity.copy(inspecting.savedVel);
            entry.angularVel.copy(inspecting.savedAngVel);
            entry.frozen = false;
            inspecting = null;
          }
        }
        return;
      }

      // Skip frozen entries
      if (entry.frozen) return;

      // (mouse repulsion disabled to allow clicking models)

      // Restore cruising speed
      const currentSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (currentSpeed > 0.001) {
        const newSpeed = currentSpeed + (entry.speed - currentSpeed) * 0.01;
        vel.x = (vel.x / currentSpeed) * newSpeed;
        vel.y = (vel.y / currentSpeed) * newSpeed;
      }

      // Move
      pos.x += vel.x;
      pos.y += vel.y;

      // Bounce off screen edges
      const distZ = Math.abs(camera.position.z - pos.z);
      const visibleH = 2 * Math.tan(vFov / 2) * distZ;
      const visibleW = visibleH * camera.aspect;
      const mx = visibleW / 2 - 1;
      const my = visibleH / 2 - 1;

      if (pos.x > mx) { pos.x = mx; vel.x = -Math.abs(vel.x); }
      if (pos.x < -mx) { pos.x = -mx; vel.x = Math.abs(vel.x); }
      if (pos.y > my) { pos.y = my; vel.y = -Math.abs(vel.y); }
      if (pos.y < -my) { pos.y = -my; vel.y = Math.abs(vel.y); }

      // Spin
      obj.rotation.x += entry.angularVel.x;
      obj.rotation.y += entry.angularVel.y;
      obj.rotation.z += entry.angularVel.z;
      entry.angularVel.multiplyScalar(0.998);
      if (entry.angularVel.length() < 0.005) {
        entry.angularVel.set(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        );
      }
    });

    // Camera parallax (reduced when inspecting)
    const parallaxAmount = inspecting ? 0.3 : 1.0;
    const camTx = (mouseScreenX / window.innerWidth - 0.5) * 3 * parallaxAmount;
    const camTy = -(mouseScreenY / window.innerHeight - 0.5) * 3 * parallaxAmount;
    camera.position.x += (camTx - camera.position.x) * 0.02;
    camera.position.y += (camTy - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
