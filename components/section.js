window.Components = window.Components || {};

/**
 * CV section wrapper: header (label + hide/show toggle) plus body.
 * Mirrors the former inline template in the `sections.map(...)` call site
 * exactly, whitespace included.
 * @param {{id: string, title: string, bodyHtml: string}} section
 * @returns {string} HTML
 */
window.Components.section = function section({ id, title, bodyHtml }) {
  return `<section class="cv-section visible" id="${id}">
      <div class="sec-head">
        <span class="sec-label">${parseInline(title)}</span>
        <button class="sec-toggle" onclick="toggleSection('${id}')">Hide</button>
      </div>
      <div class="sec-body"><div class="sec-body-inner">${bodyHtml}</div></div>
    </section>`;
};
