window.Components = window.Components || {};

/**
 * Status dot for the table's status column.
 * @param {boolean} done
 * @returns {string} HTML
 */
window.Components.statusDot = function statusDot(done) {
  return `<span class="dot ${done ? 'dot-done' : 'dot-wip'}"></span>`;
};
