window.Components = window.Components || {};

/**
 * Entity title/sub block: a bold title span, optionally followed by a
 * secondary "sub" span. Shared by `formatCell` (title + inline sub) and
 * `splitEntityCell` (title only — the remainder is shaped into separate
 * role/premiere/degree fields by the caller instead of a sub span), which
 * previously implemented this same rendering step independently.
 * @param {string} title - already-trimmed title text (markdown inline syntax)
 * @param {string} [sub] - already-trimmed subtitle text; omitted if falsy
 * @returns {string} HTML
 */
window.Components.entityBlock = function entityBlock(title, sub) {
  const titleHtml = `<span class="ent-title">${parseInline(title)}</span>`;
  const subHtml = sub ? `<span class="ent-sub">${parseInline(sub)}</span>` : '';
  return titleHtml + subHtml;
};
