/* eslint-disable no-var */
// Shared constants — browse (Sound) vs music (Music) vs shared keys
window.ECAudio = window.ECAudio || {};

ECAudio.SCHEMA_V = 14;

// Per-dot synth overrides (global BPM/mix stay on Sound.params)
ECAudio.MARKER_PARAM_KEYS = [
  'wave', 'gain', 'attack', 'decay', 'browseTone', 'browseHarmonics', 'browseDrive',
  'browseFilterMin', 'browseFilterMax', 'browseFilterQ', 'browseSubMix', 'detune',
  'browseSpace', 'browseLfoRate', 'browseLfoDepth', 'browseLfoTarget'
];
ECAudio.GLOBAL_ONLY_PARAMS = [
  'bpm', 'mode', 'browseHp', 'browsePadX', 'reverbAmt',
  'browseSizeLevel', 'browseSizeSpace', 'browsePolyFloor', 'browsePolyPow'
];

ECAudio.BROWSE_PARAM_KEYS = [
  'gain', 'attack', 'decay', 'mode', 'browseTone', 'browseSpace',
  'browseFilterMin', 'browseFilterMax', 'browseFilterQ', 'browseSubMix',
  'browseHp', 'browsePadX', 'browseHarmonics', 'browseDrive',
  'browseLfoRate', 'browseLfoDepth', 'browseLfoTarget',
  'browseSizeLevel', 'browseSizeSpace', 'browsePolyFloor', 'browsePolyPow'
];
ECAudio.MUSIC_PARAM_KEYS = [
  'steps', 'quantizeNotes', 'scaleType', 'drumRack', 'bassFifth', 'sidechain',
  'noteLength', 'reverb', 'reverbAmt', 'kickGain', 'clapGain', 'bassGain',
  'noteGain', 'swing', 'humanize', 'musicSeqEnabled', 'patterns', 'trackTypes',
  'trackMutes', 'trackSolos', 'trackLocks'
];
ECAudio.SHARED_PARAM_KEYS = [
  'wave', 'detune', 'bpm', 'filmRoot', 'commRoot', 'evRoot', 'eduRoot', 'roots',
  'sectionScales'
];

ECAudio.MIDI_BANK_SLUGS = ['film-and-immersive-work', 'commercial-production'];
ECAudio.LEGACY_SECTION_IDS = {
  'sec-film': 'sec-film-and-immersive-work',
  'sec-film-immersive-work': 'sec-film-and-immersive-work',
  'sec-comm': 'sec-commercial-production',
  'sec-ev': 'sec-events-and-jury',
  'sec-events-jury': 'sec-events-and-jury',
  'sec-edu': 'sec-education-and-languages',
  'sec-education-languages': 'sec-education-and-languages'
};
ECAudio.SECTION_ROOT_KEYS = {
  filmRoot: 'sec-film-and-immersive-work',
  commRoot: 'sec-commercial-production',
  evRoot: 'sec-events-and-jury',
  eduRoot: 'sec-education-and-languages'
};

// Sound — A major pentatonic; row = octave, Y on row = keys (BROWSE_ROW_KEYS).
ECAudio.BROWSE_ROOT_HZ = 110;
ECAudio.BROWSE_SCALE = 'pent';
ECAudio.BROWSE_DEGREES = 5;
ECAudio.BROWSE_ROW_KEYS = 5;
ECAudio.LOOP_ROLES = ['kick', 'chord', 'lead', 'hat'];
ECAudio.LOOP_BEAT_STEPS = 16;
ECAudio.LOOP_ROLE_LABELS = {
  kick: 'Kick',
  chord: 'Chord',
  lead: 'Lead',
  hat: 'Hat'
};
ECAudio.LOOP_ROLE_SHORT = {
  kick: 'KCK',
  chord: 'CHD',
  lead: 'LD',
  hat: 'HAT'
};
ECAudio.LOOP_ROLE_HINTS = {
  kick: 'On-beat · drag X = when',
  chord: 'Sustained hits · warm',
  lead: 'Syncopated · bright',
  hat: 'Offbeats · short'
};
ECAudio.LOOP_DENSITY_OPTIONS = [8, 4, 2];
ECAudio.LOOP_DEFAULT_DENSITY = {
  kick: 4,
  chord: 8,
  lead: 4,
  hat: 2
};
ECAudio.LOOP_ROLE_LEGACY = {
  foundation: 'kick',
  pad: 'chord',
  air: 'hat'
};
ECAudio.SECTION_HARMONY = {
  'sec-film-and-immersive-work':   { root: 110.00, scale: 'pent' },
  'sec-commercial-production':     { root: 110.00, scale: 'pent' },
  'sec-events-and-jury':           { root: 110.00, scale: 'pent' },
  'sec-education-and-languages':   { root: 110.00, scale: 'pent' }
};

ECAudio.SOUND_BOOL_PARAMS = [
  'humanize', 'quantizeNotes', 'bassFifth', 'sidechain', 'reverb', 'musicSeqEnabled'
];

ECAudio.soundFmt = {
  gain:          function(v) { return Math.round(v * 100) + '%'; },
  browseTone:       function(v) { return Math.round(v * 100) + '%'; },
  browseSpace:      function(v) { return Math.round(v * 100) + '%'; },
  browseFilterMin:  function(v) { return Math.round(v) + ' Hz'; },
  browseFilterMax:  function(v) { return Math.round(v) + ' Hz'; },
  browseFilterQ:    function(v) { return v.toFixed(2); },
  browseSubMix:     function(v) { return Math.round(v * 100) + '%'; },
  browseHp:         function(v) { return Math.round(v) + ' Hz'; },
  browsePadX:       function(v) { return Math.round(v * 100) + '%'; },
  browseHarmonics:  function(v) { return Math.round(v * 100) + '%'; },
  browseDrive:      function(v) { return Math.round(v * 100) + '%'; },
  browseLfoRate:    function(v) { return v < 0.05 ? 'Off' : v.toFixed(2) + ' Hz'; },
  browseLfoDepth:   function(v) { return Math.round(v * 100) + '%'; },
  browseSizeLevel:  function(v) { return Math.round(v * 100) + '%'; },
  browseSizeSpace:  function(v) { return Math.round(v * 100) + '%'; },
  browsePolyFloor:  function(v) { return Math.round(v * 100) + '%'; },
  browsePolyPow:    function(v) { return v.toFixed(2); },
  attack:    function(v) { return Math.round(v * 1000) + 'ms'; },
  decay:     function(v) { return v.toFixed(1) + 's'; },
  detune:    function(v) { return (v > 0 ? '+' : '') + Math.round(v) + '¢'; },
  bpm:       function(v) { return Math.round(v); },
  kickGain:  function(v) { return Math.round(v * 100) + '%'; },
  clapGain:  function(v) { return Math.round(v * 100) + '%'; },
  bassGain:  function(v) { return Math.round(v * 100) + '%'; },
  noteGain:  function(v) { return Math.round(v * 100) + '%'; },
  swing:     function(v) { return Math.round(v * 100) + '%'; },
  reverbAmt: function(v) { return Math.round(v * 100) + '%'; }
};

function canonicalSectionId(id) {
  return ECAudio.LEGACY_SECTION_IDS[id] || id;
}
window.canonicalSectionId = canonicalSectionId;

function pickParamKeys(src, keys) {
  var out = {};
  keys.forEach(function(k) {
    if (src[k] !== undefined) out[k] = src[k];
  });
  return out;
}

function mergeParamBuckets(browse, music, shared) {
  return Object.assign({}, shared || {}, browse || {}, music || {});
}

function migrateSoundPrefs(raw) {
  if (!raw) return raw;
  if (!raw.params) return Object.assign({ v: ECAudio.SCHEMA_V }, raw);
  var p = raw.params;
  if (!raw.v || raw.v < ECAudio.SCHEMA_V) {
    Object.keys(ECAudio.LEGACY_SECTION_IDS).forEach(function(oldId) {
      var newId = ECAudio.LEGACY_SECTION_IDS[oldId];
      if (p.roots && p.roots[oldId] != null && p.roots[newId] == null) {
        p.roots[newId] = p.roots[oldId];
      }
    });
    ['patterns', 'trackTypes', 'trackMutes', 'trackSolos', 'trackLocks'].forEach(function(key) {
      if (!p[key]) return;
      Object.keys(p[key]).slice().forEach(function(tid) {
        Object.keys(ECAudio.LEGACY_SECTION_IDS).forEach(function(oldId) {
          var prefix = oldId + '-';
          if (tid.indexOf(prefix) === 0) {
            var newTid = ECAudio.LEGACY_SECTION_IDS[oldId] + tid.slice(oldId.length);
            if (p[key][newTid] == null) p[key][newTid] = p[key][tid];
          }
        });
      });
    });
    raw.v = ECAudio.SCHEMA_V;
  }
  return raw;
}
