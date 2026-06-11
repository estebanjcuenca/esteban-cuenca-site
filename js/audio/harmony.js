/* eslint-disable no-var */
// One A major pentatonic map — row = octave, Y inside row = keys (see theory.js).
window.ECAudio = window.ECAudio || {};

ECAudio.Harmony = {
  GLOBAL_KEY: 'A',
  GLOBAL_SCALE: 'pent',
  ROOT_HZ: 110,
  NOTES: 'A · B · C# · E · F#',
  PENT_NAMES: ['A', 'B', 'C#', 'E', 'F#'],

  SCALE_INFO: {
    pent: {
      name: 'Major pentatonic',
      degrees: 5,
      intervals: '1 · 2 · 3 · 5 · 6',
      mood: 'Up/down = keys on the row · left/right = tone'
    }
  },

  SECTIONS: {
    'sec-film-and-immersive-work': { label: 'Film' },
    'sec-commercial-production': { label: 'Commercial' },
    'sec-events-and-jury': { label: 'Events' },
    'sec-education-and-languages': { label: 'Education' }
  }
};

function applyDesignedHarmony() {
  if (!ECAudio.params.roots) ECAudio.params.roots = {};
  if (!ECAudio.params.sectionScales) ECAudio.params.sectionScales = {};
  Object.keys(ECAudio.Harmony.SECTIONS).forEach(function(secId) {
    ECAudio.params.roots[secId] = ECAudio.Harmony.ROOT_HZ;
    ECAudio.params.sectionScales[secId] = 'pent';
    if (ECAudio.SECTION_HARMONY) {
      ECAudio.SECTION_HARMONY[secId] = { root: ECAudio.Harmony.ROOT_HZ, scale: 'pent' };
    }
  });
  ECAudio.params.scaleType = 'pent';
  ECAudio.params.filmRoot = ECAudio.Harmony.ROOT_HZ;
  ECAudio.params.commRoot = ECAudio.Harmony.ROOT_HZ;
  ECAudio.params.evRoot = ECAudio.Harmony.ROOT_HZ;
  ECAudio.params.eduRoot = ECAudio.Harmony.ROOT_HZ;
}

ECAudio.Harmony.applyDesigned = applyDesignedHarmony;
