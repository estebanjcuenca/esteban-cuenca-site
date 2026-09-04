window.Components = window.Components || {};

/**
 * A single paragraph block. Used for both the bio paragraphs and each CV
 * section's free-text paragraphs — both call sites just join already-split
 * plain-text lines and hand them here.
 * @param {string} text - plain text (markdown inline syntax), run through parseInline
 * @returns {string} HTML
 */
window.Components.paragraphBlock = function paragraphBlock(text) {
  return `<p>${parseInline(text)}</p>`;
};
