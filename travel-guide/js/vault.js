// Travel-document vault — passport, flight PNR, hotel/cruise reservation
// numbers, insurance hotline, etc. Synced via Sync('vault'). Each entry is
// a free-form set of label:value pairs grouped under a category.

const Vault = (() => {
  let state = {};
  let editingId = null;

  // Predefined categories with suggested fields. Users can still add free-
  // form items.
  const TEMPLATES = [
    {
      key: 'passport',
      icon: '🛂',
      label: '여권',
      fields: ['이름 (영문)', '여권번호', '발급일', '만료일', '발급기관'],
    },
    {
      key: 'flight',
      icon: '✈️',
      label: '항공편',
      fields: ['항공사', '편명', '출발지 → 도착지', '날짜/시간', 'PNR (예약번호)', '좌석'],
    },
    {
      key: 'cruise',
      icon: '🛳️',
      label: 'MSC 크루즈',
      fields: ['예약번호', '룸번호 (Cabin)', '다이닝 시간', '식당 (Main Dining)', '와이파이 패키지'],
    },
    {
      key: 'hotel',
      icon: '🏨',
      label: '호텔',
      fields: ['호텔명', '주소', '전화', '체크인', '체크아웃', '예약번호'],
    },
    {
      key: 'insurance',
      icon: '🏥',
      label: '여행자 보험',
      fields: ['보험사', '증권번호', '24시 핫라인', '담당자'],
    },
    {
      key: 'card',
      icon: '💳',
      label: '카드/은행',
      fields: ['카드사', '분실신고 번호', '한도', '메모 (해외승인 한도 등)'],
    },
    {
      key: 'other',
      icon: '📋',
      label: '기타',
      fields: ['항목명', '내용', '비고'],
    },
  ];

  function init() {
    Sync.subscribe('vault', (items) => {
      state = items || {};
      render();
    });
  }

  function bind() {
    const root = document.getElementById('view-vault');
    if (!root) return;
    if (!root.dataset.bound) {
      root.innerHTML = `
        <div class="section-header">
          <h3>🔐 여행 보관함</h3>
          <p>여권·항공·예약번호·보험 핫라인 등 중요 정보를 둘이서 공유. 잠금 해제된 폰에서 누구나 볼 수 있으니 비밀번호/카드번호 풀스트링은 적지 마세요.</p>
        </div>
        <div class="vault-tabs" id="vault-tabs"></div>
        <div class="vault-list" id="vault-list"></div>
        <div class="vault-add-fab">
          <button id="vault-add-btn" class="btn-primary">＋ 항목 추가</button>
        </div>
        <div id="vault-editor" class="vault-editor hidden"></div>
      `;
      root.dataset.bound = '1';
      document.getElementById('vault-add-btn').addEventListener('click', () => openEditor(null));
    }
    render();
  }

  let activeTab = 'all';

  function render() {
    const tabsEl = document.getElementById('vault-tabs');
    const listEl = document.getElementById('vault-list');
    if (!tabsEl || !listEl) return;

    // Group items by category
    const byCat = {};
    Object.entries(state).forEach(([id, item]) => {
      if (!item) return;
      const c = item.category || 'other';
      (byCat[c] = byCat[c] || []).push({ id, ...item });
    });

    // Tabs: 전체 + each category that has items + add empty placeholder
    const allCount = Object.keys(state).length;
    let tabsHtml = `<button class="vault-tab ${activeTab==='all' ? 'active' : ''}" data-tab="all">📂 전체 <small>${allCount}</small></button>`;
    TEMPLATES.forEach((t) => {
      const n = (byCat[t.key] || []).length;
      if (n === 0) return;
      tabsHtml += `<button class="vault-tab ${activeTab===t.key ? 'active' : ''}" data-tab="${t.key}">${t.icon} ${t.label} <small>${n}</small></button>`;
    });
    tabsEl.innerHTML = tabsHtml;
    tabsEl.querySelectorAll('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => { activeTab = b.dataset.tab; render(); });
    });

    // List
    const visible = activeTab === 'all'
      ? Object.entries(state).map(([id, v]) => ({ id, ...v }))
      : (byCat[activeTab] || []);
    visible.sort((a, b) => (a._updatedAt || 0) - (b._updatedAt || 0));

    if (!visible.length) {
      listEl.innerHTML = '<p class="empty-state">아직 보관된 항목이 없습니다.<br/>＋ 버튼으로 추가해보세요.</p>';
      return;
    }

    listEl.innerHTML = visible.map((item) => {
      const tpl = TEMPLATES.find((t) => t.key === item.category) || TEMPLATES[TEMPLATES.length - 1];
      const fields = item.fields || {};
      const rows = Object.entries(fields)
        .filter(([_, v]) => v)
        .map(([k, v]) => `
          <div class="vault-field">
            <span class="vault-field-label">${esc(k)}</span>
            <span class="vault-field-value">${linkify(esc(v))}</span>
            <button class="vault-copy" data-copy="${esc(v)}" title="복사">📋</button>
          </div>
        `).join('');
      return `
        <div class="vault-item">
          <div class="vault-item-head">
            <span class="vault-item-icon">${tpl.icon}</span>
            <strong>${esc(item.title || tpl.label)}</strong>
            <button class="vault-edit-btn" data-edit="${item.id}">✏️</button>
            <button class="vault-del-btn" data-del="${item.id}">🗑️</button>
          </div>
          ${rows || '<div class="vault-empty-fields">내용 없음</div>'}
          ${item._updatedBy ? `<div class="vault-meta">${esc(item._updatedBy)} · ${formatTime(item._updatedAt)}</div>` : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openEditor(b.dataset.edit)));
    listEl.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => deleteItem(b.dataset.del)));
    listEl.querySelectorAll('[data-copy]').forEach((b) =>
      b.addEventListener('click', () => copyText(b.dataset.copy)));
  }

  function openEditor(id) {
    editingId = id;
    const item = id ? state[id] : null;
    const editor = document.getElementById('vault-editor');
    const cat = (item && item.category) || 'passport';
    const tpl = TEMPLATES.find((t) => t.key === cat) || TEMPLATES[0];
    const existingFields = (item && item.fields) || {};

    editor.innerHTML = `
      <div class="vault-editor-backdrop" data-vault-close></div>
      <div class="vault-editor-panel">
        <div class="vault-editor-head">
          <strong>${id ? '✏️ 항목 편집' : '＋ 새 항목'}</strong>
          <button class="vault-editor-close" data-vault-close>✕</button>
        </div>
        <div class="vault-editor-body">
          <label>분류</label>
          <select id="vault-cat">
            ${TEMPLATES.map((t) => `<option value="${t.key}" ${t.key===cat ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
          </select>
          <label>제목</label>
          <input id="vault-title" type="text" placeholder="${tpl.label}" value="${esc(item && item.title ? item.title : '')}" />
          <div id="vault-fields"></div>
          <div class="vault-editor-actions">
            <button id="vault-save" class="btn-primary">저장</button>
            <button class="btn-secondary" data-vault-close>취소</button>
          </div>
        </div>
      </div>
    `;
    editor.classList.remove('hidden');

    const renderFields = (catKey) => {
      const t = TEMPLATES.find((x) => x.key === catKey) || TEMPLATES[0];
      const wrap = document.getElementById('vault-fields');
      wrap.innerHTML = t.fields.map((f) => `
        <label>${esc(f)}</label>
        <input type="text" data-field="${esc(f)}" value="${esc(existingFields[f] || '')}" />
      `).join('');
    };
    renderFields(cat);
    document.getElementById('vault-cat').addEventListener('change', (e) => renderFields(e.target.value));
    document.getElementById('vault-save').addEventListener('click', save);
    editor.querySelectorAll('[data-vault-close]').forEach((el) =>
      el.addEventListener('click', closeEditor));
  }

  function save() {
    const cat = document.getElementById('vault-cat').value;
    const title = (document.getElementById('vault-title').value || '').trim();
    const fields = {};
    document.querySelectorAll('[data-field]').forEach((inp) => {
      const v = (inp.value || '').trim();
      if (v) fields[inp.dataset.field] = v;
    });
    if (!title && Object.keys(fields).length === 0) {
      alert('제목 또는 내용을 하나 이상 입력하세요.');
      return;
    }
    const id = editingId || `vault-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    Sync.setItem('vault', id, { category: cat, title, fields });
    closeEditor();
  }

  function closeEditor() {
    const editor = document.getElementById('vault-editor');
    if (editor) editor.classList.add('hidden');
    editingId = null;
  }

  function deleteItem(id) {
    const item = state[id];
    if (!confirm(`"${(item && item.title) || '항목'}" 을 삭제할까요?`)) return;
    Sync.deleteItem('vault', id);
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text).then(() => {
      if (typeof Mobile !== 'undefined') Mobile.tap('success');
    }).catch(() => {});
  }

  // Convert phone numbers to tel: links and URLs to clickable links.
  function linkify(s) {
    return String(s)
      .replace(/(\+?[\d-]{8,}\d)/g, '<a href="tel:$1">$1</a>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { init, bind };
})();
