window.Components = window.Components || {};

/**
 * Footer link/text item, shared by the footer's privacy/location/copyright/
 * email entries — each is either plain text or an `<a>`, optionally wrapped
 * in a `<span>` for layout/styling.
 * @param {{wrapCls?: string, anchorCls?: string, href?: string, text: string}} item
 *   - wrapCls: class for a wrapping <span>; omit for no wrapper
 *   - anchorCls: class on the <a> itself; omit for an unclassed <a>
 *   - href: presence of this key (even '') makes the item an <a>; omit for plain text
 *   - text: the item's visible text/content
 * @returns {string} HTML
 */
window.Components.footerLink = function footerLink({ wrapCls, anchorCls, href, text }) {
  const isLink = href !== undefined;
  const inner = isLink
    ? `<a${anchorCls ? ` class="${anchorCls}"` : ''} href="${href}">${text}</a>`
    : text;
  return wrapCls ? `<span class="${wrapCls}">${inner}</span>` : inner;
};
