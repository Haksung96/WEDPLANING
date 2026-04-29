// Packing checklist with real-time sync.

const Checklist = (() => {
  let state = {};   // { itemId: { text, category, checked, _updatedBy, _updatedAt } }
  let collapsed = new Set();

  function init() {
    seedDefaultsIfEmpty();
    Sync.subscribe('checklist', (items) => {
      state = items;
      render();
    });
    populateCategorySelect();
    document.getElementById('add-item-btn').addEventListener('click', addItem);
    document.getElementById('new-item-text').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addItem();
    });
  }

  function seedDefaultsIfEmpty() {
    // Seed only on first run (when nothing in storage and we're in local mode).
    const seedKey = `wedplan:${Sync.getUser().tripCode}:checklist:seeded`;
    if (localStorage.getItem(seedKey)) return;

    DEFAULT_CHECKLIST.forEach((cat) => {
      cat.items.forEach((text, i) => {
        const id = `${slug(cat.category)}-${i}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
        Sync.setItem('checklist', id, {
          text,
          category: cat.category,
          checked: false,
        });
      });
    });
    localStorage.setItem(seedKey, '1');
  }

  function populateCategorySelect() {
    const sel = document.getElementById('new-item-cat');
    sel.innerHTML = '';
    DEFAULT_CHECKLIST.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.category;
      opt.textContent = cat.category;
      sel.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = '기타';
    customOpt.textContent = '기타';
    sel.appendChild(customOpt);
  }

  function addItem() {
    const textEl = document.getElementById('new-item-text');
    const catEl = document.getElementById('new-item-cat');
    const text = textEl.value.trim();
    if (!text) return;
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    Sync.setItem('checklist', id, {
      text,
      category: catEl.value,
      checked: false,
    });
    textEl.value = '';
  }

  function toggle(id) {
    const item = state[id];
    if (!item) return;
    Sync.setItem('checklist', id, { ...item, checked: !item.checked });
  }

  function remove(id) {
    if (!confirm('삭제할까요?')) return;
    Sync.deleteItem('checklist', id);
  }

  function render() {
    const root = document.getElementById('checklist-content');
    if (!root) return;

    // Group by category
    const byCategory = {};
    Object.entries(state).forEach(([id, item]) => {
      const cat = item.category || '기타';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({ id, ...item });
    });

    // Order categories by DEFAULT_CHECKLIST order, with custom at end
    const orderedCats = [
      ...DEFAULT_CHECKLIST.map((c) => c.category),
      ...Object.keys(byCategory).filter((c) => !DEFAULT_CHECKLIST.find((d) => d.category === c)),
    ];

    root.innerHTML = '';
    orderedCats.forEach((cat) => {
      const items = byCategory[cat];
      if (!items || items.length === 0) return;

      const total = items.length;
      const done = items.filter((i) => i.checked).length;
      const isCollapsed = collapsed.has(cat);

      const catDiv = document.createElement('div');
      catDiv.className = 'checklist-category';
      catDiv.innerHTML = `
        <div class="cat-header" data-cat="${escape(cat)}">
          <span>${escape(cat)} ${isCollapsed ? '▸' : '▾'}</span>
          <span class="cat-progress">${done}/${total}</span>
        </div>
      `;

      if (!isCollapsed) {
        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'cat-items';
        items
          .sort((a, b) => a.text.localeCompare(b.text, 'ko'))
          .forEach((item) => {
            const row = document.createElement('div');
            row.className = 'checklist-item' + (item.checked ? ' checked' : '');
            const updatedBy = item._updatedBy ? `· ${escape(item._updatedBy)}` : '';
            row.innerHTML = `
              <input type="checkbox" ${item.checked ? 'checked' : ''} data-id="${item.id}" />
              <label data-id="${item.id}">
                ${escape(item.text)}
                <div class="item-meta">${updatedBy}</div>
              </label>
              <button class="delete-btn" data-del="${item.id}" title="삭제">✕</button>
            `;
            itemsDiv.appendChild(row);
          });
        catDiv.appendChild(itemsDiv);
      }

      root.appendChild(catDiv);
    });

    // Wire events
    root.querySelectorAll('.cat-header').forEach((el) => {
      el.addEventListener('click', () => {
        const cat = el.dataset.cat;
        if (collapsed.has(cat)) collapsed.delete(cat); else collapsed.add(cat);
        render();
      });
    });
    root.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => toggle(cb.dataset.id));
    });
    root.querySelectorAll('label[data-id]').forEach((lb) => {
      lb.addEventListener('click', (e) => {
        e.preventDefault();
        toggle(lb.dataset.id);
      });
    });
    root.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        remove(btn.dataset.del);
      });
    });
  }

  function slug(s) {
    return s.replace(/\s+/g, '-').toLowerCase();
  }
  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { init };
})();
