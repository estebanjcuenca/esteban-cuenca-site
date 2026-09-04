window.Components = window.Components || {};

/**
 * One record/table row. `canon` is the padded column list produced by
 * `normalizeTable` (see MASTER_COLS in index.html); `raw`/`html` are the
 * per-row values it shapes. Mirrors `buildTable`'s former inline
 * row-rendering exactly, including the awards `{wip}` split and the
 * "—"/"-" placeholder-collapse rule.
 * @param {{raw: object, html: object, canon: Array<{key: string, cls: string, label: string}>}} row
 * @returns {string} HTML — a single <tr>...</tr>
 */
window.Components.recordRow = function recordRow({ raw, html, canon }) {
  let out = '<tr>';
  canon.forEach(col => {
    const c = ` class="${col.cls}"`;
    const label = col.label ? parseInline(col.label) : col.key;
    const labelAttr = col.key === 'status' ? '' :
      ` data-label="${label.replace(/"/g, '&quot;')}"`;

    if (col.key === 'status') {
      if (!raw.status) {
        out += `<td class="${col.cls} col-status-empty"${labelAttr}></td>`;
      } else {
        const done = raw.status.toLowerCase() === 'done';
        out += `<td${c}>${window.Components.statusDot(done)}</td>`;
      }
    } else if (col.key === 'entity') {
      const content = html.entity || '';
      out += `<td${c}${labelAttr}>${content}</td>`;
    } else {
      const val = raw[col.key] || '';
      // "—"/"-" are used in content.md as an explicit placeholder for
      // "nothing here" — treat them the same as a truly empty cell so
      // the record layout collapses the block instead of showing a
      // labeled row with just a dash in it.
      const isPlaceholder = /^[-—]$/.test(val.trim());
      if (col.key === 'awards' && val.includes('{wip}')) {
        const sepIdx = val.indexOf('{wip}');
        const main = val.slice(0, sepIdx).trim();
        const wip  = val.slice(sepIdx + 5).trim();
        const mainHtml = main ? parseInline(main) : '';
        const wipHtml  = wip  ? `<span class="award-wip">${main ? ' · ' : ''}${parseInline(wip)}</span>` : '';
        out += `<td${c}${labelAttr}>${mainHtml}${wipHtml}</td>`;
      } else {
        out += `<td${c}${labelAttr}>${val && !isPlaceholder ? parseInline(val) : ''}</td>`;
      }
    }
  });
  out += '</tr>';
  return out;
};
