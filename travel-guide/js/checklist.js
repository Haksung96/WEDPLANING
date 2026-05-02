// Packing checklist with real-time sync.
//
// HISTORY: Originally each device generated random per-item IDs (text +
// Date.now() + Math.random()), so when both phones logged in for the first
// time they each ran seedDefaults independently and produced two full
// duplicate sets in Firestore. Fixed by:
//   1) Using DETERMINISTIC IDs for default items — both devices write to the
//      same document IDs, so Firestore merges instead of duplicating.
//   2) One-shot dedupe on first load to clean up data created before the fix.

const Checklist = (() => {
  let state = {};
  let collapsed = new Set();
  let firstSnapshotProcessed = false;

  function init() {
    Sync.subscribe('checklist', (items) => {
      state = items;
      // Run dedup ONCE per app session, after the first remote snapshot
      // arrives. Subsequent snapshots only trigger render.
      if (!firstSnapshotProcessed) {
        firstSnapshotProcessed = true;
        deduplicateOnce();
        seedDefaultsIfEmpty();
      }
      render();
    });
    populateCategorySelect();
    document.getElementById('add-item-btn').addEventListener('click', addItem);
    document.getElementById('new-item-text').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addItem();
    });
  }

  // Drop duplicates that share (category, text). Keeps the oldest item
  // (by _updatedAt) and deletes the rest. Fire-and-forget; the snapshot
  // listener will pick up the deletes and re-render.
  function deduplicateOnce() {
    const groups = new Map();
    Object.entries(state).forEach(([id, item]) => {
      if (!item || !item.text) return;
      const key = `${item.category || ''}::${item.text.trim()}`;
      const arr = groups.get(key) || [];
      arr.push({ id, item });
      groups.set(key, arr);
    });
    let removed = 0;
    groups.forEach((arr) => {
      if (arr.length < 2) return;
      // Sort oldest first (smaller _updatedAt wins). Items with no timestamp
      // sort last so they get deleted first.
      arr.sort((a, b) => (a.item._updatedAt || Infinity) - (b.item._updatedAt || Infinity));
      const [keep, ...dups] = arr;
      // Merge any 'checked: true' from duplicates into the keeper so we don't
      // lose a check-off if the duplicate was the one that got toggled.
      const anyChecked = arr.some((x) => x.item.checked);
      if (anyChecked && !keep.item.checked) {
        Sync.setItem('checklist', keep.id, { ...keep.item, checked: true });
      }
      dups.forEach(({ id }) => {
        Sync.deleteItem('checklist', id);
        removed++;
      });
    });
    if (removed > 0) console.info(`[checklist] removed ${removed} duplicate items`);
  }

  function seedDefaultsIfEmpty() {
    if (Object.keys(state).length > 0) return;   // already populated
    DEFAULT_CHECKLIST.forEach((cat) => {
      cat.items.forEach((text) => {
        const id = defaultId(cat.category, text);
        Sync.setItem('checklist', id, {
          text,
          category: cat.category,
          checked: false,
        });
      });
    });
  }

  // Deterministic ID for default items so concurrent seeds from two phones
  // collide on the same docs (and merge) rather than producing duplicates.
  function defaultId(category, text) {
    return `default-${slug(category)}-${slug(text)}`;
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

  const slug = Utils.slug;
  const escape = Utils.escape;

  return { init };
})();
