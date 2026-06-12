/* eslint-disable no-var */
window.ECAudio = window.ECAudio || {};

ECAudio.params = {
  wave:        'sawtooth',
  gain:        0.09,
  attack:      0.06,
  decay:       1.0,
  detune:      0,
  mode:        'harmonic',
  browseTone:  0.68,
  browseSpace: 0.06,
  browseFilterMin: 600,
  browseFilterMax: 4800,
  browseFilterQ: 0.75,
  browseSubMix: 0.012,
  browseHp: 80,
  browsePadX: 1,
  browseHarmonics: 0.45,
  browseDrive: 0.45,
  browseLfoRate: 0,
  browseLfoDepth: 0.4,
  browseLfoTarget: 'filter',
  browseSizeLevel: 1,
  browseSizeSpace: 0.12,
  browsePolyFloor: 0.28,
  browsePolyPow: 0.48,
  bpm:         92,
  kickGain:    0.18,
  clapGain:    0.14,
  bassGain:    0.16,
  noteGain:    0.10,
  swing:       0.54,
  humanize:    false,
  musicSeqEnabled: true,
  quantizeNotes: true,
  scaleType:   'pent',
  drumRack:    'kickClap',
  bassFifth:   true,
  sidechain:   true,
  noteLength:  0.72,
  reverb:      true,
  reverbAmt:   0.14,
  steps:       16,
  patterns:    {},
  trackTypes:  {},
  trackMutes:  {},
  trackSolos:  {},
  trackLocks:  {},
  filmRoot:    110,
  commRoot:    110,
  evRoot:      110,
  eduRoot:     110,
  roots: {
    'sec-film-and-immersive-work':   110.00,
    'sec-commercial-production':     110.00,
    'sec-events-and-jury':           110.00,
    'sec-education-and-languages':   110.00
  },
  sectionScales: {}
};

ECAudio.applySectionHarmony = function() {
  if (!ECAudio.params.sectionScales) ECAudio.params.sectionScales = {};
  if (!ECAudio.params.roots) ECAudio.params.roots = {};
  Object.keys(ECAudio.SECTION_HARMONY).forEach(function(secId) {
    var spec = ECAudio.SECTION_HARMONY[secId];
    ECAudio.params.sectionScales[secId] = spec.scale;
    if (ECAudio.params.roots[secId] == null) ECAudio.params.roots[secId] = spec.root;
  });
  ECAudio.params.useComplementaryScales = true;
  Object.keys(ECAudio.SECTION_ROOT_KEYS).forEach(function(param) {
    var secId = ECAudio.SECTION_ROOT_KEYS[param];
    if (ECAudio.params.roots[secId] != null) ECAudio.params[param] = ECAudio.params.roots[secId];
  });
};

ECAudio.setSectionRoot = function(param, val) {
  var secId = ECAudio.SECTION_ROOT_KEYS[param];
  if (!secId) return;
  ECAudio.params.roots[secId] = val;
  ECAudio.params[param] = val;
};

// Prefs: one runtime ECAudio.params; persisted in localStorage as ec-sound with
// browse (hover/table), music (sequencer), shared (wave, detune, per-section roots).
// Studio dot overrides live in sessionStorage (ec-sound-markers), not in ec-sound.
ECAudio.saveSoundPrefs = function() {
  try {
    var flat = JSON.parse(JSON.stringify(ECAudio.params));
    localStorage.setItem('ec-sound', JSON.stringify({
      v: ECAudio.SCHEMA_V,
      enabled: !!window.soundEnabled,
      activePreset: ECAudio._activePreset || ECAudio.DEFAULT_SOUND_PRESET || 'bright',
      browse: pickParamKeys(flat, ECAudio.BROWSE_PARAM_KEYS),
      music: pickParamKeys(flat, ECAudio.MUSIC_PARAM_KEYS),
      shared: pickParamKeys(flat, ECAudio.SHARED_PARAM_KEYS)
    }));
  } catch (e) { /* ignore */ }
};

ECAudio.loadSoundPrefs = function() {
  try {
    ECAudio.applySectionHarmony();
    var stored = JSON.parse(localStorage.getItem('ec-sound') || 'null');
    var needsSave = !!(stored && (!stored.v || stored.v < ECAudio.SCHEMA_V || stored.params));
    var raw = migrateSoundPrefs(stored);
    if (!raw) {
      if (ECAudio.applyDefaultSoundPreset) ECAudio.applyDefaultSoundPreset();
      else if (ECAudio.BrowseSound && ECAudio.BrowseSound.resetPanelDefaults) {
        ECAudio.BrowseSound.resetPanelDefaults();
      }
      ECAudio.finishSoundPrefsBoot();
      return;
    }
    var flatParams = raw.params;
    if (raw.v >= ECAudio.SCHEMA_V && (raw.browse || raw.music || raw.shared)) {
      flatParams = mergeParamBuckets(raw.browse, raw.music, raw.shared);
    }
    if (flatParams) {
      var defaults = ECAudio.params;
      Object.assign(ECAudio.params, flatParams);
      ECAudio.params.roots = Object.assign({}, defaults.roots, flatParams.roots || {});
      ECAudio.params.sectionScales = Object.assign(
        {}, defaults.sectionScales, flatParams.sectionScales || {}
      );
      ECAudio.applySectionHarmony();
      Object.keys(ECAudio.LEGACY_SECTION_IDS).forEach(function(oldId) {
        var newId = ECAudio.LEGACY_SECTION_IDS[oldId];
        if (ECAudio.params.roots[oldId] != null && ECAudio.params.roots[newId] == null) {
          ECAudio.params.roots[newId] = ECAudio.params.roots[oldId];
        }
      });
      if (flatParams.filmRoot != null) ECAudio.setSectionRoot('filmRoot', flatParams.filmRoot);
      ['commRoot', 'evRoot', 'eduRoot'].forEach(function(key) {
        if (flatParams[key] != null) ECAudio.setSectionRoot(key, flatParams[key]);
        else if (ECAudio.params.roots[ECAudio.SECTION_ROOT_KEYS[key]] != null) {
          ECAudio.params[key] = ECAudio.params.roots[ECAudio.SECTION_ROOT_KEYS[key]];
        }
      });
      ECAudio.SOUND_BOOL_PARAMS.forEach(function(key) {
        if (flatParams[key] != null) ECAudio.params[key] = !!flatParams[key];
      });
      if (flatParams.mode) ECAudio.params.mode = flatParams.mode;
      if (ECAudio.params.browseTone == null) {
        var bright = ECAudio.params.browseBright != null ? ECAudio.params.browseBright : 0.58;
        var warm = ECAudio.params.browseWarmth != null ? ECAudio.params.browseWarmth : 0.22;
        ECAudio.params.browseTone = bright * 0.7 + (1 - warm) * 0.3;
      }
      if (ECAudio.params.browseSpace == null) ECAudio.params.browseSpace = 0.07;
      if (stored && stored.v != null && stored.v < 4 && ECAudio.BrowseSound) {
        ECAudio.BrowseSound.resetPanelDefaults();
        needsSave = true;
      }
      if (stored && stored.v != null && stored.v < 6 && ECAudio.Harmony && ECAudio.Harmony.applyDesigned) {
        ECAudio.Harmony.applyDesigned();
        needsSave = true;
      }
      if (stored && stored.v != null && stored.v < 7 && !stored.activePreset) {
        ECAudio._activePreset = ECAudio.DEFAULT_SOUND_PRESET || 'bright';
        needsSave = true;
      }
      if (stored && stored.v != null && stored.v < 8 && ECAudio.Harmony && ECAudio.Harmony.applyDesigned) {
        ECAudio.Harmony.applyDesigned();
        needsSave = true;
      }
      if (stored && stored.v != null && stored.v < 9 && ECAudio.Harmony && ECAudio.Harmony.applyDesigned) {
        ECAudio.Harmony.applyDesigned();
        if (ECAudio.Zones && ECAudio.Zones.refreshRowPads) ECAudio.Zones.refreshRowPads();
        needsSave = true;
      }
      if (stored && stored.v != null && stored.v < 10) {
        if (ECAudio.Harmony && ECAudio.Harmony.applyDesigned) ECAudio.Harmony.applyDesigned();
        try { sessionStorage.removeItem('ec-sound-markers'); } catch (e) { /* ignore */ }
        ECAudio.State.markerData = [];
        if (ECAudio.Markers && ECAudio.Markers.clearAll) ECAudio.Markers.clearAll();
        if (ECAudio.Zones && ECAudio.Zones.refreshRowPads) ECAudio.Zones.refreshRowPads();
        needsSave = true;
      }
      if (stored && stored.v != null && stored.v < 11) {
        try {
          var rawMk = sessionStorage.getItem('ec-sound-markers');
          if (rawMk) {
            var mkList = JSON.parse(rawMk);
            if (Array.isArray(mkList)) {
              mkList.forEach(function(d) {
                if (d.step == null && d.normX != null && ECAudio.Theory.stepFromNormX) {
                  d.step = ECAudio.Theory.stepFromNormX(d.normX);
                  d.toneNorm = d.toneNorm != null ? d.toneNorm : d.normX;
                  d.normX = ECAudio.Theory.normXFromStep(d.step);
                }
              });
              sessionStorage.setItem('ec-sound-markers', JSON.stringify(mkList));
              ECAudio.State.markerData = mkList;
            }
          }
        } catch (e) { /* ignore */ }
        needsSave = true;
      }
      if (stored && stored.v != null && stored.v < 13) {
        try {
          var rawMk13 = sessionStorage.getItem('ec-sound-markers');
          if (rawMk13) {
            var mkList13 = JSON.parse(rawMk13);
            if (Array.isArray(mkList13)) {
              mkList13.forEach(function(d) {
                if (!d.params && ECAudio.Markers && ECAudio.Markers.defaultMarkerParams) {
                  d.params = ECAudio.Markers.defaultMarkerParams();
                }
              });
              sessionStorage.setItem('ec-sound-markers', JSON.stringify(mkList13));
              ECAudio.State.markerData = mkList13;
            }
          }
        } catch (e) { /* ignore */ }
        needsSave = true;
      }
      if (stored && stored.v != null && stored.v < 12) {
        try {
          var rawMk12 = sessionStorage.getItem('ec-sound-markers');
          if (rawMk12) {
            var mkList12 = JSON.parse(rawMk12);
            if (Array.isArray(mkList12)) {
              mkList12.forEach(function(d) {
                if (d.density == null && ECAudio.Theory && ECAudio.Theory.defaultDensityForRole) {
                  d.density = ECAudio.Theory.defaultDensityForRole(d.role);
                }
              });
              sessionStorage.setItem('ec-sound-markers', JSON.stringify(mkList12));
              ECAudio.State.markerData = mkList12;
            }
          }
        } catch (e) { /* ignore */ }
        needsSave = true;
      }
      if (stored && stored.v != null && stored.v < 14) {
        try { sessionStorage.removeItem('ec-sound-markers'); } catch (e) { /* ignore */ }
        ECAudio.State.markerData = [];
        if (ECAudio.Markers && ECAudio.Markers.initOnLoad) ECAudio.Markers.initOnLoad();
        else if (ECAudio.Markers && ECAudio.Markers.clearAll) ECAudio.Markers.clearAll();
        needsSave = true;
      }
      if (ECAudio.BrowseSound) {
        var v5 = {
          browseFilterMin: 'FILTER_MIN', browseFilterMax: 'FILTER_MAX',
          browseFilterQ: 'FILTER_Q', browseSubMix: 'SUB_MIX', browseHp: 'HP',
          browsePadX: 'PAD_X', browseHarmonics: 'HARMONICS', browseDrive: 'HARMONICS',
          browseLfoRate: 'LFO_RATE', browseLfoDepth: 'LFO_DEPTH',
          browseLfoTarget: 'LFO_TARGET', browseSizeSpace: 'SIZE_SPACE_MAX',
          browsePolyFloor: 'POLY_FLOOR', browsePolyPow: 'POLY_POW'
        };
        Object.keys(v5).forEach(function(key) {
          if (ECAudio.params[key] == null) ECAudio.params[key] = ECAudio.BrowseSound[v5[key]];
        });
        if (ECAudio.params.browseSizeLevel == null) ECAudio.params.browseSizeLevel = 1;
        if (ECAudio.params.browseHarmonics == null && ECAudio.params.browseDrive != null) {
          ECAudio.params.browseHarmonics = ECAudio.params.browseDrive;
        }
      }
      if (ECAudio.BrowseSound && ECAudio.BrowseSound.applyEngine) ECAudio.BrowseSound.applyEngine();
      if (flatParams.bpm) ECAudio.params.bpm = flatParams.bpm;
      if (ECAudio.params.clapGain == null) {
        ECAudio.params.clapGain = (ECAudio.params.kickGain || 0.18) * 0.78;
      }
      if (ECAudio.params.bassGain == null) {
        ECAudio.params.bassGain = (ECAudio.params.gain || 0.12) * 0.85;
      }
      if (ECAudio.params.noteGain == null) {
        ECAudio.params.noteGain = (ECAudio.params.gain || 0.12) * 0.62;
      }
      if (ECAudio.params.swing == null) ECAudio.params.swing = 0.54;
      if (ECAudio.params.humanize == null) ECAudio.params.humanize = false;
      if (!ECAudio.params.trackMutes) ECAudio.params.trackMutes = {};
      if (!ECAudio.params.trackSolos) ECAudio.params.trackSolos = {};
      if (!ECAudio.params.trackLocks) ECAudio.params.trackLocks = {};
      if (ECAudio.params.quantizeNotes == null) ECAudio.params.quantizeNotes = true;
      if (!ECAudio.params.scaleType) ECAudio.params.scaleType = 'major';
      if (!ECAudio.params.drumRack) ECAudio.params.drumRack = 'kickClap';
      if (ECAudio.params.bassFifth == null) ECAudio.params.bassFifth = true;
      if (ECAudio.params.sidechain == null) ECAudio.params.sidechain = true;
      if (ECAudio.params.noteLength == null) ECAudio.params.noteLength = 0.72;
      if (ECAudio.params.reverb == null) ECAudio.params.reverb = true;
      if (ECAudio.params.reverbAmt == null) ECAudio.params.reverbAmt = 0.14;
      ['commRoot', 'evRoot', 'eduRoot'].forEach(function(key) {
        if (ECAudio.params[key] != null) return;
        var secId = ECAudio.SECTION_ROOT_KEYS[key];
        if (secId && ECAudio.params.roots[secId] != null) {
          ECAudio.params[key] = ECAudio.params.roots[secId];
        }
      });
    }
    if (raw.activePreset) ECAudio._activePreset = raw.activePreset;
    ECAudio.finishSoundPrefsBoot();
    if (needsSave) ECAudio.saveSoundPrefs();
  } catch (e) {
    if (ECAudio.debugError) ECAudio.debugError('loadSoundPrefs failed', e);
  }
};

ECAudio.finishSoundPrefsBoot = function() {
  soundEnabled = false;
  window.soundEnabled = false;
  if (ECAudio.syncPresetUI) {
    ECAudio.syncPresetUI(ECAudio._activePreset || ECAudio.DEFAULT_SOUND_PRESET || 'bright');
  }
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
  if (typeof applySoundMode === 'function') applySoundMode();
};
