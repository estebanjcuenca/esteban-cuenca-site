/* eslint-disable no-var */
window.ECAudio = window.ECAudio || {};
ECAudio.State = {
  ctx: null,
  masterBus: null,
  browseBus: null,
  browseToneIn: null,
  browseHp: null,
  musicBus: null,
  reverbSend: null,
  reverbGain: null,
  limiterNode: null,
  activeNodes: new Map(),
  holdVoice: null,
  inTableZone: false,
  hoverZone: null,
  hoverSecId: null,
  hoverToken: 0,
  lastZone: null,
  ptrX: -1,
  ptrY: -1,
  kaossX: 0.5,
  kaossY: 0.5,
  tableLeaveTimer: null,
  clapBursts: null,
  markers: [],
  markerData: [],
  markerSeq: 0,
  PARTIALS: [1, 2, 1.5, 1.25, 1.75, 2.25, 1.333, 1.667],
  SCALE_DEFS: {
    major: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24],
    minor: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24],
    pent:  [0, 2, 4, 7, 9, 12, 14, 17, 19, 21, 24, 26, 28, 31, 33]
  }
};
