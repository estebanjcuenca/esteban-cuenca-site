/* eslint-disable no-var */
// Beat studio — Three.js molecule view (X time · Y pitch · Z presence).
window.ECAudio = window.ECAudio || {};

var PRESET_HEX = {
  kick: 0xd45a2a, hat: 0x3a9eb8, clap: 0xc9922e, bass: 0x7a3eb8,
  bright: 0x6aaa30, minimal: 0x6a7a9a
};

var POS_SCALE = { x: 9.2, y: 6.4, z: 9.8 };
var LERP = 0.34;

var _root, _canvas, _renderer, _scene, _camera, _meshes = {}, _bondGroup, _playhead, _playheadGlow;
var _timeGroup, _guidesGroup, _affinityGroup, _stereoGroup, _patternGroup, _patternMeshes = {}, _patternPulses = {};
var _vecA = null;
var _vecB = null;
var _vecDir = null;
var _raf = 0, _running = false, _inited = false;
var _rotY = 0.72, _rotX = 0.38, _radius = 15;
var _camDrag = false, _lastX = 0, _lastY = 0, _autoSpin = true;
var _pulses = {};
var _selectedId = null;
var _stepLabel = null;
var _sphereDrag = null;
var _hoverId = null;
var _selectionRing = null;
var _raycaster, _mouse, _dragPlane, _planeNormal, _intersect;
var PICK_MOVE_PX = 5;
var _tubeUnitGeo = null;
var _tubeYAxis = null;
var _bondEntries = {};
var _decorDirty = true;
var _snapMeshes = false;
var SPHERE_SEGMENTS = 12;
var SPHERE_RINGS = 10;

function beatMarkers() {
  var beatSec = ECAudio.BEAT_STUDIO_SEC_ID || 'beat-studio';
  return (ECAudio.State.markers || []).filter(function(m) {
    return m && m.secId === beatSec;
  });
}

function markerZ(m) {
  return ECAudio.BeatPresence && ECAudio.BeatPresence.normZ
    ? ECAudio.BeatPresence.normZ(m) : 0.55;
}

function stepToX(step) {
  var steps = ECAudio.LOOP_BEAT_STEPS || 16;
  return ((step % steps) / Math.max(1, steps - 1) - 0.5) * POS_SCALE.x;
}

function markerPatternPos(marker, step, vel) {
  var nx = ECAudio.Theory && ECAudio.Theory.normXFromStep
    ? ECAudio.Theory.normXFromStep(step) : (step + 0.5) / (ECAudio.LOOP_BEAT_STEPS || 16);
  return markerPos3({
    normX: nx,
    normY: marker.normY != null ? marker.normY : 0.5,
    normZ: vel === 2 ? 0.4 : markerZ(marker)
  });
}

function normYToWorldY(ny) {
  // Pad top = higher pitch; 3D low pitch should read toward the bottom of the view.
  return (0.5 - ny) * POS_SCALE.y;
}

function worldYToNormY(y) {
  return Math.max(0, Math.min(1, 0.5 - y / POS_SCALE.y));
}

function markerPos3(m) {
  var nx = m.normX != null ? m.normX : 0.5;
  var ny = m.normY != null ? m.normY : 0.5;
  var nz = markerZ(m);
  return {
    x: (nx - 0.5) * POS_SCALE.x,
    y: normYToWorldY(ny),
    z: (nz - 0.5) * POS_SCALE.z
  };
}

function pos3ToNorm(x, y, z) {
  return {
    normX: Math.max(0, Math.min(1, x / POS_SCALE.x + 0.5)),
    normY: worldYToNormY(y),
    normZ: Math.max(0, Math.min(1, z / POS_SCALE.z + 0.5))
  };
}

function findBeatMarker(id) {
  var beatSec = ECAudio.BEAT_STUDIO_SEC_ID || 'beat-studio';
  return (ECAudio.State.markers || []).filter(function(m) {
    return m && m.id === id && m.secId === beatSec;
  })[0] || null;
}

function ensurePickHelpers() {
  if (typeof THREE === 'undefined') return;
  if (!_raycaster) _raycaster = new THREE.Raycaster();
  if (!_mouse) _mouse = new THREE.Vector2();
  if (!_dragPlane) _dragPlane = new THREE.Plane();
  if (!_planeNormal) _planeNormal = new THREE.Vector3();
  if (!_intersect) _intersect = new THREE.Vector3();
  if (!_vecA) _vecA = new THREE.Vector3();
  if (!_vecB) _vecB = new THREE.Vector3();
  if (!_vecDir) _vecDir = new THREE.Vector3();
}

function disposeGroup(group) {
  if (!group) return;
  while (group.children.length) {
    var ch = group.children[0];
    group.remove(ch);
    if (ch.geometry) ch.geometry.dispose();
    if (ch.material) ch.material.dispose();
  }
}

function ensureTubeUnitGeo() {
  if (typeof THREE === 'undefined') return null;
  if (!_tubeUnitGeo) _tubeUnitGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  if (!_tubeYAxis) _tubeYAxis = new THREE.Vector3(0, 1, 0);
  return _tubeUnitGeo;
}

function makeTubeMesh() {
  var geo = ensureTubeUnitGeo();
  if (!geo) return null;
  var mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false
  });
  return new THREE.Mesh(geo, mat);
}

function updateTubeMesh(mesh, ax, ay, az, bx, by, bz, radius, color, opacity) {
  if (!mesh) return false;
  ensurePickHelpers();
  _vecA.set(ax, ay, az);
  _vecB.set(bx, by, bz);
  _vecDir.subVectors(_vecB, _vecA);
  var len = _vecDir.length();
  if (len < 0.006) {
    mesh.visible = false;
    return false;
  }
  mesh.visible = true;
  mesh.material.color.setHex(color);
  mesh.material.opacity = opacity;
  mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  mesh.quaternion.setFromUnitVectors(_tubeYAxis || new THREE.Vector3(0, 1, 0), _vecDir.normalize());
  mesh.scale.set(radius, len, radius);
  return true;
}

function bondEntryKey(aId, bId) {
  return aId < bId ? aId + '|' + bId : bId + '|' + aId;
}

function releaseBondEntry(key) {
  var entry = _bondEntries[key];
  if (!entry || !_bondGroup) return;
  _bondGroup.remove(entry.main);
  if (entry.glow) _bondGroup.remove(entry.glow);
  if (entry.main && entry.main.material) entry.main.material.dispose();
  if (entry.glow && entry.glow.material) entry.glow.material.dispose();
  delete _bondEntries[key];
}

function bondTubeStyle(bond) {
  if (bond.time && bond.harm) {
    return { color: 0xffc858, radius: 0.062, opacity: 0.82 };
  }
  if (bond.harm) {
    return { color: 0x5fd88a, radius: 0.05, opacity: 0.72 };
  }
  if (bond.time) {
    return { color: 0x4db8e8, radius: 0.044, opacity: 0.68 };
  }
  return { color: 0xb090d8, radius: 0.032, opacity: 0.48 };
}

function setMouseFromEvent(e) {
  if (!_canvas) return;
  var rect = _canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function meshPickList() {
  var list = [];
  Object.keys(_meshes).forEach(function(id) {
    var mesh = _meshes[id];
    if (!mesh || !mesh.visible) return;
    mesh.updateMatrixWorld(true);
    list.push(mesh);
  });
  return list;
}

function pickSphereId(e) {
  if (!_camera || !_scene) return null;
  ensurePickHelpers();
  setMouseFromEvent(e);
  _raycaster.setFromCamera(_mouse, _camera);
  _raycaster.params.Mesh = _raycaster.params.Mesh || {};
  _raycaster.params.Mesh.threshold = 0.08;
  var list = meshPickList();
  if (!list.length) return null;
  var hits = _raycaster.intersectObjects(list, false);
  if (hits.length) return hits[0].object.userData.markerId;
  var bestId = null;
  var bestDist = 1.15;
  list.forEach(function(mesh) {
    var dist = _raycaster.ray.distanceToPoint(mesh.position);
    var pickR = Math.max(0.42, (mesh.scale.x || 0.2) * 2.1);
    if (dist < pickR && dist < bestDist) {
      bestDist = dist;
      bestId = mesh.userData.markerId;
    }
  });
  return bestId;
}

function previewSelectIn3d(id) {
  _selectedId = id || null;
  markDecorDirty();
}

function confirmSelectIn3d(id) {
  if (!id) return;
  previewSelectIn3d(id);
  if (ECAudio.Markers && ECAudio.Markers.handleDotTap) {
    ECAudio.Markers.handleDotTap(id);
    return;
  }
  if (ECAudio.Markers && ECAudio.Markers.selectDot) {
    ECAudio.Markers.selectDot(id);
    return;
  }
  if (ECAudio.Markers && ECAudio.Markers.select) ECAudio.Markers.select(id);
}

function syncSelectionFromMarkers() {
  var id = null;
  if (ECAudio.Markers && ECAudio.Markers.layerSettingsOpen) {
    id = ECAudio.Markers.layerSettingsOpen();
  }
  if (!id && ECAudio.Markers && ECAudio.Markers.getSelected) {
    var sel = ECAudio.Markers.getSelected();
    if (sel && sel.id) id = sel.id;
  }
  _selectedId = id || null;
  markDecorDirty();
}

function ensureSelectionRing() {
  if (_selectionRing || !_scene || typeof THREE === 'undefined') return;
  var geo = new THREE.RingGeometry(1.05, 1.24, 40);
  var mat = new THREE.MeshBasicMaterial({
    color: 0xfff0dc,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  _selectionRing = new THREE.Mesh(geo, mat);
  _selectionRing.rotation.x = -Math.PI / 2;
  _selectionRing.visible = false;
  _selectionRing.renderOrder = 4;
  _scene.add(_selectionRing);
}

function updateSelectionRing() {
  if (!_selectionRing) return;
  var mesh = _selectedId ? _meshes[_selectedId] : null;
  if (!mesh) {
    _selectionRing.visible = false;
    return;
  }
  _selectionRing.visible = true;
  _selectionRing.position.copy(mesh.position);
  _selectionRing.position.y -= (mesh.scale.x || 0.25) * 0.08;
  var s = (mesh.scale.x || 0.25) * 1.14;
  _selectionRing.scale.set(s, s, s);
}

function updateHoverCursor(e) {
  if (!_canvas || _sphereDrag || _camDrag) return;
  var id = pickSphereId(e);
  if (id === _hoverId) return;
  _hoverId = id;
  _canvas.classList.toggle('can-pick-sphere', !!id);
  markDecorDirty();
}

function dotSoloMuted(m) {
  if (!document.documentElement.classList.contains('dot-solo')) return false;
  var soloId = ECAudio.Markers && ECAudio.Markers.soloDotId
    ? ECAudio.Markers.soloDotId() : null;
  return !!(soloId && m && m.id !== soloId);
}

function presetHex(m) {
  var t = m.presetId || (m.envId ? m.envId.replace(/^env-/, '') : 'kick');
  return PRESET_HEX[t] != null ? PRESET_HEX[t] : 0x6688aa;
}

function envMuted(m) {
  if (dotSoloMuted(m)) return true;
  if (!ECAudio.Environments || !ECAudio.Environments.isOverview ||
      !ECAudio.Environments.getActive) return false;
  if (ECAudio.Environments.isOverview()) return false;
  var active = ECAudio.Environments.getActive();
  return !!(active && m.envId && active.id !== m.envId);
}

function updateCamera() {
  if (!_camera) return;
  _camera.position.x = _radius * Math.sin(_rotY) * Math.cos(_rotX);
  _camera.position.y = _radius * Math.sin(_rotX) + 1.2;
  _camera.position.z = _radius * Math.cos(_rotY) * Math.cos(_rotX);
  _camera.lookAt(0, 0, 0);
}

function readThemeBg() {
  try {
    var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (bg && bg.indexOf('#') === 0) {
      var hex = parseInt(bg.slice(1), 16);
      if (!isNaN(hex)) return hex;
    }
  } catch (e) { /* ignore */ }
  return document.documentElement.classList.contains('dark') ? 0x0f0d09 : 0xf0ede7;
}

function disable3dPanel(reason) {
  document.documentElement.classList.add('beat-view3d-off');
  var btn = document.getElementById('btn-beat-3d');
  if (btn) {
    btn.classList.remove('active');
    btn.title = reason || '3D view unavailable — click to retry';
  }
  var hud = document.querySelector('.beat-view3d-hud');
  if (hud) {
    hud.innerHTML = '<span class="beat-view3d-title">3D off</span>' +
      '<span class="beat-view3d-axes">' + (reason || 'Click 3D to retry · pad still works') + '</span>';
  }
}

function enable3dPanel() {
  document.documentElement.classList.remove('beat-view3d-off');
  var btn = document.getElementById('btn-beat-3d');
  if (btn) {
    btn.classList.add('active');
    btn.title = 'Toggle 3D loop view';
  }
}

function buildScene() {
  _scene = new THREE.Scene();
  _scene.background = new THREE.Color(readThemeBg());
  _scene.fog = new THREE.Fog(_scene.background, 18, 42);

  var amb = new THREE.AmbientLight(0xffffff, 0.62);
  _scene.add(amb);
  var key = new THREE.DirectionalLight(0xfff8f0, 0.85);
  key.position.set(6, 10, 8);
  _scene.add(key);
  var fill = new THREE.DirectionalLight(0xaabbff, 0.35);
  fill.position.set(-8, 2, -6);
  _scene.add(fill);

  var grid = new THREE.GridHelper(10, 16, 0x777777, 0xbbbbbb);
  grid.position.y = -3.35;
  grid.material.opacity = 0.38;
  grid.material.transparent = true;
  _scene.add(grid);

  _timeGroup = new THREE.Group();
  var steps = ECAudio.LOOP_BEAT_STEPS || 16;
  var si;
  for (si = 0; si < steps; si++) {
    var tx = stepToX(si);
    var down = si % 4 === 0;
    var tGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(tx, -3.55, -5.4),
      new THREE.Vector3(tx, 3.75, 5.2)
    ]);
    var tMat = new THREE.LineBasicMaterial({
      color: down ? 0x444444 : 0x888888,
      transparent: true,
      opacity: down ? 0.55 : 0.22
    });
    var tick = new THREE.Line(tGeo, tMat);
    tick.userData.step = si;
    _timeGroup.add(tick);
  }
  _scene.add(_timeGroup);

  _guidesGroup = new THREE.Group();
  buildMusicalGuides();
  _scene.add(_guidesGroup);

  _affinityGroup = new THREE.Group();
  _scene.add(_affinityGroup);

  _stereoGroup = new THREE.Group();
  _scene.add(_stereoGroup);

  var axes = new THREE.AxesHelper(4.8);
  axes.position.y = -3.3;
  _scene.add(axes);

  _bondGroup = new THREE.Group();
  _scene.add(_bondGroup);

  _patternGroup = new THREE.Group();
  _scene.add(_patternGroup);

  var playMat = new THREE.MeshBasicMaterial({
    color: 0x1a1a1a, transparent: true, opacity: 0.5, side: THREE.DoubleSide
  });
  _playhead = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 7.4), playMat);
  _playhead.position.y = 0;
  _playhead.position.z = -0.05;
  _scene.add(_playhead);

  var glowMat = new THREE.MeshBasicMaterial({
    color: 0xffeed8, transparent: true, opacity: 0.14, side: THREE.DoubleSide
  });
  _playheadGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.35), glowMat);
  _playheadGlow.rotation.x = -Math.PI / 2;
  _playheadGlow.position.y = -3.28;
  _scene.add(_playheadGlow);
  ensureSelectionRing();
}

function buildMusicalGuides() {
  if (!_guidesGroup || typeof THREE === 'undefined') return;
  disposeGroup(_guidesGroup);
  var keys = ECAudio.Theory && ECAudio.Theory.browseRowKeyCount
    ? ECAudio.Theory.browseRowKeyCount() : 5;
  var ki;
  for (ki = 0; ki < keys; ki++) {
    var keyNorm = keys <= 1 ? 0.5 : ki / (keys - 1);
    var rowNorm = ECAudio.Theory && ECAudio.Theory.rowNormFromKeyNorm
      ? ECAudio.Theory.rowNormFromKeyNorm(keyNorm) : (1 - keyNorm);
    var wy = normYToWorldY(rowNorm);
    var laneGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-POS_SCALE.x * 0.5, wy, -4.8),
      new THREE.Vector3(POS_SCALE.x * 0.5, wy, 4.8)
    ]);
    var laneMat = new THREE.LineBasicMaterial({
      color: 0x8a9ab8,
      transparent: true,
      opacity: ki === 0 || ki === keys - 1 ? 0.34 : 0.22
    });
    _guidesGroup.add(new THREE.Line(laneGeo, laneMat));
  }
}

function syncAffinityGuides() {
  if (!_affinityGroup) return;
  disposeGroup(_affinityGroup);
  var focusId = (_sphereDrag && _sphereDrag.id) || _selectedId;
  if (!focusId) return;
  var sel = findBeatMarker(focusId);
  if (!sel) return;
  var markers = beatMarkers();
  var i;
  for (i = 0; i < markers.length; i++) {
    var peer = markers[i];
    if (!peer || peer.id === sel.id) continue;
    var meta = ECAudio.BeatBonds && ECAudio.BeatBonds.meta
      ? ECAudio.BeatBonds.meta(sel, peer) : null;
    if (!meta) continue;
    var pp = markerPos3(peer);
    var sp = markerPos3(sel);
    var zMid = (sp.z + pp.z) * 0.5;

    if (meta.time) {
      var colGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pp.x, -3.5, zMid),
        new THREE.Vector3(pp.x, 3.7, zMid)
      ]);
      var colMat = new THREE.LineBasicMaterial({
        color: 0x4db8e8,
        transparent: true,
        opacity: 0.38 + meta.strength * 0.22
      });
      _affinityGroup.add(new THREE.Line(colGeo, colMat));
    }
    if (meta.harm) {
      var rowGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-POS_SCALE.x * 0.46, pp.y, zMid),
        new THREE.Vector3(POS_SCALE.x * 0.46, pp.y, zMid)
      ]);
      var rowMat = new THREE.LineBasicMaterial({
        color: 0x5fd88a,
        transparent: true,
        opacity: 0.36 + meta.strength * 0.2
      });
      _affinityGroup.add(new THREE.Line(rowGeo, rowMat));
    }
    if (meta.time && meta.harm) {
      var sweet = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xffc858,
          transparent: true,
          opacity: 0.55,
          depthWrite: false
        })
      );
      sweet.position.set(pp.x, pp.y, zMid);
      _affinityGroup.add(sweet);
    }
    if (meta.clash) {
      var clashGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(sp.x, sp.y, zMid),
        new THREE.Vector3(pp.x, pp.y, zMid)
      ]);
      var clashMat = new THREE.LineBasicMaterial({
        color: 0xc45a2a,
        transparent: true,
        opacity: 0.78
      });
      _affinityGroup.add(new THREE.Line(clashGeo, clashMat));
    }
  }
}

function syncStereoSpread() {
  if (!_stereoGroup || typeof THREE === 'undefined') return;
  disposeGroup(_stereoGroup);
  beatMarkers().forEach(function(m) {
    var pan = ECAudio.BeatMix && ECAudio.BeatMix.stereoPan
      ? ECAudio.BeatMix.stereoPan(m) : 0;
    if (Math.abs(pan) < 0.05) return;
    var p = markerPos3(m);
    var r = sphereRadius(m);
    var spread = pan * POS_SCALE.x * 0.38;
    var col = presetHex(m);
    var floorY = p.y - r - 0.14;
    var wingGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p.x, floorY, p.z + 0.06),
      new THREE.Vector3(p.x + spread, floorY - 0.08, p.z + 0.14)
    ]);
    var wingMat = new THREE.LineBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.42 + Math.abs(pan) * 0.28
    });
    _stereoGroup.add(new THREE.Line(wingGeo, wingMat));
    var arcGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p.x - Math.abs(spread) * 0.35, floorY - 0.1, p.z),
      new THREE.Vector3(p.x + spread, floorY - 0.1, p.z)
    ]);
    var arcMat = new THREE.LineBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.22
    });
    _stereoGroup.add(new THREE.Line(arcGeo, arcMat));
  });
}

function sphereRadius(m) {
  var s = m.sizeNorm != null ? m.sizeNorm : 0.35;
  var z = markerZ(m);
  return 0.2 + s * 0.3 + z * 0.22;
}

function upsertMesh(m) {
  var mesh = _meshes[m.id];
  var col = presetHex(m);
  var r = sphereRadius(m);
  var p = markerPos3(m);
  var muted = envMuted(m);

  if (!mesh) {
    var geo = new THREE.SphereGeometry(1, SPHERE_SEGMENTS, SPHERE_RINGS);
    var mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.08,
      metalness: 0.18,
      roughness: 0.42,
      transparent: true,
      opacity: muted ? 0.28 : 0.92
    });
    mesh = new THREE.Mesh(geo, mat);
    mesh.userData.markerId = m.id;
    mesh.position.set(p.x, p.y, p.z);
    mesh.scale.setScalar(r);
    _scene.add(mesh);
    _meshes[m.id] = mesh;
  }

  mesh.material.color.setHex(col);
  mesh.material.emissive.setHex(col);
  mesh.material.opacity = muted ? 0.26 : 0.92;
  mesh.material.emissiveIntensity = emissiveForMesh(m.id);
  if (_pulses[m.id]) mesh.material.emissiveIntensity = Math.max(mesh.material.emissiveIntensity, 0.95);
}

function emissiveForMesh(id) {
  if (_selectedId === id) return 0.58;
  if (_hoverId === id) return 0.26;
  return 0.1;
}

function clearStaleMeshes(liveIds) {
  Object.keys(_meshes).forEach(function(id) {
    if (liveIds[id]) return;
    _scene.remove(_meshes[id]);
    _meshes[id].geometry.dispose();
    _meshes[id].material.dispose();
    delete _meshes[id];
  });
  if (_selectedId && !liveIds[_selectedId]) {
    _selectedId = null;
    markDecorDirty();
  }
}

function disposeAllMeshes() {
  if (!_scene) return;
  Object.keys(_meshes).forEach(function(id) {
    var mesh = _meshes[id];
    if (!mesh) return;
    _scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    delete _meshes[id];
  });
  if (_patternGroup) {
    Object.keys(_patternMeshes).forEach(function(key) {
      var mesh = _patternMeshes[key];
      if (!mesh) return;
      _patternGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      delete _patternMeshes[key];
    });
  }
  Object.keys(_bondEntries).forEach(function(key) {
    releaseBondEntry(key);
  });
  markDecorDirty();
}

function syncBondLines() {
  if (!_bondGroup || !ECAudio.BeatBonds || !ECAudio.BeatBonds.compute) return;
  var end = ECAudio.perf && ECAudio.perf.mark ? ECAudio.perf.mark('3d-bonds') : null;
  var overview = ECAudio.Environments && ECAudio.Environments.isOverview
    ? ECAudio.Environments.isOverview() : true;
  var active = ECAudio.Environments && ECAudio.Environments.getActive
    ? ECAudio.Environments.getActive() : null;
  var bonds = ECAudio.BeatBonds.compute(
    beatMarkers(), overview, active ? active.id : null
  );
  var used = {};
  bonds.forEach(function(b) {
    var key = bondEntryKey(b.a.id, b.b.id);
    used[key] = true;
    var entry = _bondEntries[key];
    if (!entry) {
      entry = { main: makeTubeMesh(), glow: makeTubeMesh() };
      _bondEntries[key] = entry;
      if (entry.main) _bondGroup.add(entry.main);
      if (entry.glow) _bondGroup.add(entry.glow);
    }
    var pa = markerPos3(b.a);
    var pb = markerPos3(b.b);
    var style = bondTubeStyle(b);
    var prox = ECAudio.BeatSpatial && ECAudio.BeatSpatial.proximity
      ? ECAudio.BeatSpatial.proximity(b.a, b.b) : 0.5;
    updateTubeMesh(
      entry.main,
      pa.x, pa.y, pa.z, pb.x, pb.y, pb.z,
      style.radius * (0.88 + prox * 0.28),
      style.color,
      Math.min(0.95, style.opacity + b.strength * 0.12)
    );
    if (b.time && b.harm && entry.glow) {
      updateTubeMesh(
        entry.glow,
        pa.x, pa.y, pa.z, pb.x, pb.y, pb.z,
        style.radius * 1.65,
        style.color,
        0.16 + b.strength * 0.1
      );
    } else if (entry.glow) {
      entry.glow.visible = false;
    }
  });
  Object.keys(_bondEntries).forEach(function(key) {
    if (!used[key]) releaseBondEntry(key);
  });
  if (end) end();
}

function applyMeshStyle(m, mesh) {
  var col = presetHex(m);
  var muted = envMuted(m);
  mesh.material.color.setHex(col);
  mesh.material.emissive.setHex(col);
  mesh.material.opacity = muted ? 0.26 : 0.92;
  mesh.material.emissiveIntensity = emissiveForMesh(m.id);
  if (_pulses[m.id]) mesh.material.emissiveIntensity = Math.max(mesh.material.emissiveIntensity, 0.95);
}

function tickMeshMotion() {
  if (!_inited || !_scene) return;
  var markers = beatMarkers();
  var live = {};
  markers.forEach(function(m) {
    live[m.id] = true;
    var mesh = _meshes[m.id];
    if (!mesh) {
      upsertMesh(m);
      mesh = _meshes[m.id];
    }
    if (!mesh) return;
    applyMeshStyle(m, mesh);
    var p = markerPos3(m);
    var r = sphereRadius(m);
    var snap = (_sphereDrag && _sphereDrag.id === m.id) || _snapMeshes;
    var lerp = snap ? 1 : LERP;
    mesh.position.x += (p.x - mesh.position.x) * lerp;
    mesh.position.y += (p.y - mesh.position.y) * lerp;
    mesh.position.z += (p.z - mesh.position.z) * lerp;
    if (!_pulses[m.id]) {
      var cs = mesh.scale.x || r;
      mesh.scale.setScalar(cs + (r - cs) * lerp);
    }
  });
  clearStaleMeshes(live);
  updateSelectionRing();
  _snapMeshes = false;
}

function syncDecorLayers() {
  if (!_inited || !_scene || !_decorDirty) return;
  _decorDirty = false;
  syncBondLines();
  syncAffinityGuides();
  syncStereoSpread();
}

function markDecorDirty() {
  _decorDirty = true;
}

function syncPatternMeshes() {
  if (!_patternGroup) return;
  var live = {};
  var steps = ECAudio.LOOP_BEAT_STEPS || 16;
  beatMarkers().forEach(function(marker) {
    var seqInfo = ECAudio.BeatSeq && ECAudio.BeatSeq.patternForMarker
      ? ECAudio.BeatSeq.patternForMarker(marker) : null;
    var pat = seqInfo && seqInfo.pattern ? seqInfo.pattern : null;
    if (!pat || seqInfo.hits <= 1) return;
    var type = ECAudio.BeatSeq && ECAudio.BeatSeq.markerType
      ? ECAudio.BeatSeq.markerType(marker) : (marker.presetId || 'kick');
    var si;
    for (si = 0; si < steps; si++) {
      var vel = pat[si] || 0;
      var key = marker.id + ':' + si;
      live[key] = true;
      if (!vel) {
        if (_patternMeshes[key]) {
          _patternGroup.remove(_patternMeshes[key]);
          _patternMeshes[key].geometry.dispose();
          _patternMeshes[key].material.dispose();
          delete _patternMeshes[key];
        }
        continue;
      }
      var p = markerPatternPos(marker, si, vel);
      var col = PRESET_HEX[type] != null ? PRESET_HEX[type] : 0x6688aa;
      var mesh = _patternMeshes[key];
      if (!mesh) {
        var geo = new THREE.BoxGeometry(0.3, 0.18, 0.18);
        var mat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.12,
          metalness: 0.1,
          roughness: 0.55,
          transparent: true,
          opacity: vel === 2 ? 0.38 : 0.58
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.userData.step = si;
        mesh.userData.markerId = marker.id;
        mesh.userData.envType = type;
        mesh.userData.active = true;
        _patternGroup.add(mesh);
        _patternMeshes[key] = mesh;
      }
      mesh.position.set(p.x, p.y - 0.08, p.z);
      mesh.material.opacity = vel === 2 ? 0.36 : 0.58;
    }
  });
  Object.keys(_patternMeshes).forEach(function(key) {
    if (live[key]) return;
    var mesh = _patternMeshes[key];
    _patternGroup.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    delete _patternMeshes[key];
  });
}

function decayPatternPulses() {
  var now = performance.now();
  Object.keys(_patternPulses).forEach(function(uuid) {
    if (_patternPulses[uuid] > now) return;
    delete _patternPulses[uuid];
    if (!_patternGroup) return;
    _patternGroup.children.forEach(function(ch) {
      if (ch.uuid !== uuid || !ch.material || !ch.material.emissiveIntensity) return;
      ch.material.emissiveIntensity = 0.12;
    });
  });
}

function pulsePatternStep(step) {
  if (!_patternGroup) return;
  var now = performance.now();
  _patternGroup.children.forEach(function(ch) {
    if (ch.userData.step !== step) return;
    if (!ch.material) return;
    ch.material.emissiveIntensity = 0.95;
    _patternPulses[ch.uuid] = now + 200;
  });
}

function syncView3d(opts) {
  if (!_inited || !_scene) return;
  if (opts && opts.rebuild) disposeAllMeshes();
  syncSelectionFromMarkers();
  _snapMeshes = true;
  markDecorDirty();
  tickMeshMotion();
  syncPatternMeshes();
  syncDecorLayers();
}

function setPlayheadStep(step) {
  if (step < 0) {
    if (_playhead) _playhead.visible = false;
    if (_playheadGlow) _playheadGlow.visible = false;
    if (_stepLabel) _stepLabel.textContent = '—';
    return;
  }
  var steps = ECAudio.LOOP_BEAT_STEPS || 16;
  var x = stepToX(step);
  if (_playhead) {
    _playhead.visible = true;
    _playhead.position.x = x;
  }
  if (_playheadGlow) {
    _playheadGlow.visible = true;
    _playheadGlow.position.x = x;
  }
  if (_timeGroup) {
    _timeGroup.children.forEach(function(tick) {
      if (tick.userData.step == null) return;
      var on = tick.userData.step === step;
      tick.material.opacity = on ? 0.88 : (tick.userData.step % 4 === 0 ? 0.52 : 0.24);
    });
  }
  if (_stepLabel) {
    _stepLabel.textContent = 'step ' + (step + 1) + '/' + steps + ' · X = time →';
  }
}

function pulseMarkers(step) {
  var now = performance.now();
  beatMarkers().forEach(function(m) {
    if (!ECAudio.BeatKaoss || !ECAudio.BeatKaoss.markerHitsStep) return;
    if (!ECAudio.BeatKaoss.markerHitsStep(m, step)) return;
    _pulses[m.id] = now + 220;
    if (_meshes[m.id]) {
      _meshes[m.id].material.emissiveIntensity = 1.1;
      _meshes[m.id].scale.setScalar(sphereRadius(m) * 1.38);
    }
  });
}

function decayPulses() {
  var now = performance.now();
  Object.keys(_pulses).forEach(function(id) {
    if (_pulses[id] > now) return;
    delete _pulses[id];
    var mesh = _meshes[id];
    if (!mesh) return;
    var m = (ECAudio.State.markers || []).filter(function(x) { return x.id === id; })[0];
    if (m) {
      mesh.scale.setScalar(sphereRadius(m));
      mesh.material.emissiveIntensity = emissiveForMesh(id);
    }
  });
}

function onBeatStep(step, hitRoles) {
  if (!_running) return;
  setPlayheadStep(step);
  pulseMarkers(step);
  pulsePatternStep(step);
  if (hitRoles && hitRoles.length && _stepLabel) {
    _stepLabel.textContent = 'step ' + (step + 1) + ' · ' + hitRoles.join(' + ') + ' · X = time →';
  }
}

function setSelected(id) {
  _selectedId = id || null;
  markDecorDirty();
  if (_inited && _scene) {
    tickMeshMotion();
    syncDecorLayers();
  }
}

function resize() {
  if (!_renderer || !_camera || !_root) return;
  var w = _root.clientWidth;
  var h = _root.clientHeight;
  if (w < 2 || h < 2) return;
  _camera.aspect = w / h;
  _camera.updateProjectionMatrix();
  _renderer.setSize(w, h, false);
}

function pushMarkerFrom3d(id, x, y, z, finalize) {
  var marker = findBeatMarker(id);
  if (!marker) return;
  var norms = pos3ToNorm(x, y, z);
  if (marker.envId && ECAudio.BeatKaoss && ECAudio.BeatKaoss.mapPlacement) {
    var mapped = ECAudio.BeatKaoss.mapPlacement(
      norms.normX, norms.normY, marker.envId, marker.id,
      finalize ? { settle: true } : { dragging: true }
    );
    norms.normX = mapped.normX;
    norms.normY = mapped.normY;
    marker.beatPhase = mapped.beatPhase;
    marker.step = mapped.step;
    marker.toneNorm = mapped.toneNorm;
  } else if (ECAudio.Theory && ECAudio.Theory.stepFromNormX) {
    marker.step = ECAudio.Theory.stepFromNormX(norms.normX);
  }
  marker.normX = norms.normX;
  marker.normY = norms.normY;
  marker.normZ = norms.normZ;
  if (finalize) {
    var autoHarm = !ECAudio.BeatInfluence || !ECAudio.BeatInfluence.autoHarmonizeOn ||
      ECAudio.BeatInfluence.autoHarmonizeOn(marker);
    if (autoHarm && ECAudio.BeatSpatial && ECAudio.BeatSpatial.applyField) {
      ECAudio.BeatSpatial.applyField(id, { beatLock: true, pullScale: 0.55 });
    }
    marker = findBeatMarker(id);
    if (marker && ECAudio.Markers && ECAudio.Markers.update) {
      ECAudio.Markers.update(id, {
        normX: marker.normX,
        normY: marker.normY,
        normZ: marker.normZ,
        step: marker.step
      });
    }
    if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
      ECAudio.BeatSeq.refreshAllPatterns();
    }
    if (ECAudio.BeatSeq && ECAudio.BeatSeq.syncGravityUI && ECAudio.Markers) {
      var sel = ECAudio.Markers.layerSettingsOpen
        ? (ECAudio.State.markers || []).filter(function(m) {
          return m.id === ECAudio.Markers.layerSettingsOpen();
        })[0] : null;
      if (sel) ECAudio.BeatSeq.syncGravityUI(sel);
    }
    return;
  }
  if (ECAudio.Markers && ECAudio.Markers.syncPositions) ECAudio.Markers.syncPositions();
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
    ECAudio.BeatSeq.refreshAllPatterns();
  }
}

function onPointerDown(e) {
  if (!_inited || !_canvas) return;
  if (e.button !== 0) return;
  var id = pickSphereId(e);
  if (id) {
    var dragMarker = findBeatMarker(id);
    _sphereDrag = {
      id: id,
      mesh: _meshes[id],
      lastY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      zOnly: !!e.shiftKey,
      startNormX: dragMarker && dragMarker.normX != null ? dragMarker.normX : 0.5,
      startNormY: dragMarker && dragMarker.normY != null ? dragMarker.normY : 0.5,
      startNormZ: dragMarker ? markerZ(dragMarker) : 0.55
    };
    _autoSpin = false;
    _camDrag = false;
    previewSelectIn3d(id);
    try { _canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  _camDrag = true;
  _autoSpin = false;
  _lastX = e.clientX;
  _lastY = e.clientY;
}

function onPointerMove(e) {
  if (_sphereDrag && _sphereDrag.mesh) {
    var mesh = _sphereDrag.mesh;
    var mdx = e.clientX - _sphereDrag.startX;
    var mdy = e.clientY - _sphereDrag.startY;
    if (mdx * mdx + mdy * mdy > PICK_MOVE_PX * PICK_MOVE_PX) _sphereDrag.moved = true;
    var marker = findBeatMarker(_sphereDrag.id);
    if (_sphereDrag.zOnly || e.shiftKey) {
      _sphereDrag.lastY = e.clientY;
      if (marker) {
        var nzOnly = _sphereDrag.startNormZ - (e.clientY - _sphereDrag.startY) * 0.0028;
        nzOnly = Math.max(0, Math.min(1, nzOnly));
        marker.normZ = nzOnly;
        mesh.position.z = (nzOnly - 0.5) * POS_SCALE.z;
        var zR = sphereRadius(marker);
        mesh.scale.setScalar(zR);
        if (ECAudio.Markers && ECAudio.Markers.syncPresence) {
          ECAudio.Markers.syncPresence(marker);
        }
        if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
        markDecorDirty();
      }
      return;
    }
    if (marker) {
      var nx = Math.max(0.01, Math.min(0.99,
        _sphereDrag.startNormX + mdx * 0.00145));
      var ny = Math.max(0.02, Math.min(0.98,
        _sphereDrag.startNormY - mdy * 0.00145));
      var p = markerPos3({ normX: nx, normY: ny, normZ: _sphereDrag.startNormZ });
      mesh.position.set(p.x, p.y, p.z);
      pushMarkerFrom3d(_sphereDrag.id, p.x, p.y, p.z, false);
      markDecorDirty();
    }
    e.preventDefault();
    return;
  }
  if (!_camDrag) {
    updateHoverCursor(e);
    return;
  }
  var dx = e.clientX - _lastX;
  var dy = e.clientY - _lastY;
  _lastX = e.clientX;
  _lastY = e.clientY;
  _rotY += dx * 0.008;
  _rotX = Math.max(-0.2, Math.min(1.15, _rotX + dy * 0.006));
  updateCamera();
}

function onPointerUp(e) {
  if (_sphereDrag) {
    var drag = _sphereDrag;
    _sphereDrag = null;
    if (!drag.moved) {
      confirmSelectIn3d(drag.id);
    } else if (drag.mesh) {
      pushMarkerFrom3d(
        drag.id, drag.mesh.position.x, drag.mesh.position.y, drag.mesh.position.z, true
      );
      if (ECAudio.Markers && ECAudio.Markers.selectDot) ECAudio.Markers.selectDot(drag.id);
    }
    if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
    try { _canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    updateHoverCursor(e);
    return;
  }
  _camDrag = false;
  updateHoverCursor(e);
}

function onWheel(e) {
  e.preventDefault();
  var id = pickSphereId(e);
  if (id) {
    var marker = findBeatMarker(id);
    if (marker) {
      var nz = markerZ(marker) + (e.deltaY > 0 ? -0.05 : 0.05);
      nz = Math.max(0, Math.min(1, nz));
      if (ECAudio.Markers && ECAudio.Markers.update) {
        ECAudio.Markers.update(id, { normZ: nz });
      } else {
        marker.normZ = nz;
        if (_meshes[id]) {
          _meshes[id].position.z = (nz - 0.5) * POS_SCALE.z;
          _meshes[id].scale.setScalar(sphereRadius(marker));
        }
      }
      if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
      markDecorDirty();
    }
    return;
  }
  _radius = Math.max(8, Math.min(28, _radius + e.deltaY * 0.012));
  updateCamera();
}

function animate() {
  if (!_running) return;
  _raf = requestAnimationFrame(animate);
  if (_autoSpin && !_camDrag && !_sphereDrag) _rotY += 0.0016;
  tickMeshMotion();
  if (_decorDirty) syncDecorLayers();
  decayPulses();
  decayPatternPulses();
  updateCamera();
  _renderer.render(_scene, _camera);
}

function onVisibilityChange() {
  if (document.hidden) {
    pauseBeatView3d();
    return;
  }
  if (!isBeatStudioActive() || document.documentElement.classList.contains('beat-view3d-off')) return;
  resumeBeatView3d();
}

function bindVisibilityPause() {
  if (bindVisibilityPause.bound) return;
  bindVisibilityPause.bound = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function bindControls() {
  if (!_canvas || _canvas.dataset.bound) return;
  _canvas.dataset.bound = '1';
  _canvas.addEventListener('pointerdown', onPointerDown, { capture: true });
  _canvas.addEventListener('pointermove', updateHoverCursor, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  _canvas.addEventListener('wheel', onWheel, { passive: false });
  _canvas.addEventListener('pointerleave', function() {
    _hoverId = null;
    if (_canvas) _canvas.classList.remove('can-pick-sphere');
    markDecorDirty();
  });
  window.addEventListener('resize', resize);
}

function bindToggle() {
  var btn = document.getElementById('btn-beat-3d');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', function() {
    var isOff = document.documentElement.classList.contains('beat-view3d-off');
    if (isOff) {
      if (!_inited) initBeatView3d();
      if (!_inited) return;
      enable3dPanel();
      resize();
      syncView3d();
      resume();
      return;
    }
    document.documentElement.classList.add('beat-view3d-off');
    btn.classList.remove('active');
    pause();
  });
}

function initBeatView3d() {
  if (typeof THREE === 'undefined') {
    disable3dPanel('Three.js not loaded');
    return;
  }
  if (_inited) {
    enable3dPanel();
    resume();
    resize();
    syncView3d();
    return;
  }
  _root = document.getElementById('beat-view3d');
  _canvas = document.getElementById('beat-view3d-canvas');
  _stepLabel = document.getElementById('beat-view3d-step');
  if (!_root || !_canvas) return;

  try {
    _renderer = new THREE.WebGLRenderer({
      canvas: _canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false
    });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    _camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    updateCamera();

    buildScene();
    bindControls();
    bindToggle();
    bindVisibilityPause();
    setPlayheadStep(0);
    _inited = true;
    enable3dPanel();
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        resize();
        syncView3d();
        resume();
      });
    });
  } catch (err) {
    disable3dPanel('WebGL unavailable — click 3D to retry');
  }
}

function pauseBeatView3d() {
  _running = false;
  if (_raf) cancelAnimationFrame(_raf);
  _raf = 0;
}

function resumeBeatView3d() {
  if (!_inited || document.documentElement.classList.contains('beat-view3d-off')) return;
  syncSelectionFromMarkers();
  if (_running) return;
  _running = true;
  animate();
}

ECAudio.BeatView3d = {
  init: initBeatView3d,
  sync: syncView3d,
  schedule: function() {
    markDecorDirty();
    _snapMeshes = true;
    if (_inited && _scene) {
      tickMeshMotion();
      syncPatternMeshes();
    }
    if (!_running) syncDecorLayers();
  },
  onBeatStep: onBeatStep,
  setSelected: setSelected,
  pause: pauseBeatView3d,
  resume: resumeBeatView3d
};
