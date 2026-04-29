// Simple shared expense tracker — EUR/KRW with running totals.

const Expenses = (() => {
  let state = {};   // { id: { amount, currency, category, payer, memo, date, _updatedBy } }
  // Approximate fallback rate; user can override in settings later.
  const DEFAULT_RATE_EUR_TO_KRW = 1500;

  const CATEGORIES = ['🍽️ 식비', '🚕 교통', '🛍️ 쇼핑', '🎫 입장료', '🏨 숙박', '☕ 카페', '💧 생수/간식', '기타'];

  function init() {
    Sync.subscribe('expenses', (items) => {
      state = items;
      render();
    });
  }

  function bind() {
    const root = document.getElementById('view-expenses');
    if (!root) return;
    if (!root.dataset.bound) {
      root.innerHTML = `
        <div class="section-header">
          <h3>💶 지출 기록</h3>
          <p>매 결제마다 한 줄씩. 합계와 1인당이 자동 계산됩니다.</p>
        </div>

        <div class="settings-card">
          <div class="exp-form">
            <input id="exp-amount" type="number" inputmode="decimal" placeholder="금액" />
            <select id="exp-currency">
              <option value="EUR">EUR</option>
              <option value="KRW">KRW</option>
            </select>
            <select id="exp-cat">
              ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <select id="exp-payer">
              <option value="남편">남편 결제</option>
              <option value="와이프">와이프 결제</option>
              <option value="공동">공동</option>
            </select>
            <input id="exp-memo" type="text" placeholder="메모 (예: 라 보케리아 점심)" />
            <button id="exp-add" class="btn-primary">추가</button>
          </div>
        </div>

        <div id="exp-summary" class="exp-summary"></div>
        <div id="exp-list" class="exp-list"></div>
      `;
      root.dataset.bound = '1';

      document.getElementById('exp-add').addEventListener('click', addItem);
      document.getElementById('exp-payer').value = Sync.getUser().name === '와이프' ? '와이프' : '남편';
    }
    render();
  }

  function addItem() {
    const amount = Number(document.getElementById('exp-amount').value);
    if (!amount || amount <= 0) { alert('금액을 입력하세요'); return; }
    const data = {
      amount,
      currency: document.getElementById('exp-currency').value,
      category: document.getElementById('exp-cat').value,
      payer: document.getElementById('exp-payer').value,
      memo: document.getElementById('exp-memo').value.trim(),
      date: new Date().toISOString(),
    };
    const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    Sync.setItem('expenses', id, data);
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-memo').value = '';
  }

  function remove(id) {
    if (!confirm('이 지출을 삭제할까요?')) return;
    Sync.deleteItem('expenses', id);
  }

  function render() {
    const root = document.getElementById('view-expenses');
    if (!root || !root.dataset.bound) return;

    const items = Object.entries(state).map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let totalEUR = 0, totalKRW = 0;
    const byCategory = {};
    items.forEach((it) => {
      const eur = it.currency === 'EUR' ? it.amount : it.amount / DEFAULT_RATE_EUR_TO_KRW;
      const krw = it.currency === 'KRW' ? it.amount : it.amount * DEFAULT_RATE_EUR_TO_KRW;
      totalEUR += eur;
      totalKRW += krw;
      byCategory[it.category] = (byCategory[it.category] || 0) + eur;
    });

    const summary = document.getElementById('exp-summary');
    summary.innerHTML = `
      <div class="exp-totals">
        <div><span>총합</span><strong>€${totalEUR.toFixed(2)}</strong><small>≈ ₩${Math.round(totalKRW).toLocaleString()}</small></div>
        <div><span>1인당</span><strong>€${(totalEUR/2).toFixed(2)}</strong><small>≈ ₩${Math.round(totalKRW/2).toLocaleString()}</small></div>
      </div>
      ${Object.keys(byCategory).length ? `
        <div class="exp-bycat">
          ${Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([cat, sum]) =>
            `<div class="exp-cat-row"><span>${esc(cat)}</span><strong>€${sum.toFixed(2)}</strong></div>`
          ).join('')}
        </div>
      ` : ''}
    `;

    const list = document.getElementById('exp-list');
    if (!items.length) {
      list.innerHTML = '<p class="empty-state">아직 기록된 지출이 없습니다.</p>';
      return;
    }
    list.innerHTML = items.map((it) => {
      const date = it.date ? new Date(it.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const symbol = it.currency === 'EUR' ? '€' : '₩';
      return `
        <div class="exp-item">
          <div class="exp-main">
            <div class="exp-cat-tag">${esc(it.category)}</div>
            <div class="exp-memo">${esc(it.memo || '-')}</div>
            <div class="exp-meta">${esc(date)} · ${esc(it.payer)}${it._updatedBy && it._updatedBy !== it.payer ? ` (입력: ${esc(it._updatedBy)})` : ''}</div>
          </div>
          <div class="exp-amount">${symbol}${Number(it.amount).toLocaleString()}</div>
          <button class="delete-btn" data-del="${it.id}">✕</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => remove(btn.dataset.del));
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { init, bind };
})();
