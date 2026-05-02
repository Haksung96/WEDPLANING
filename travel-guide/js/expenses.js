// Simple shared expense tracker — EUR/KRW with running totals.

const Expenses = (() => {
  let state = {};   // { id: { amount, currency, category, payer, memo, date, _updatedBy } }
  // Live rate fetched from frankfurter.app (free, no auth, CORS-OK).
  // Cached in localStorage for 6h. Falls back to a reasonable hardcoded rate
  // if the API is unreachable (e.g. cruise wifi is dead).
  const DEFAULT_RATE_EUR_TO_KRW = 1500;
  const RATE_CACHE_KEY = 'wedplan:fxrate';
  const RATE_TTL = 6 * 60 * 60 * 1000;
  let rateEurToKrw = DEFAULT_RATE_EUR_TO_KRW;
  let rateUpdatedAt = null;
  let rateOnChange = null;

  function getRate() { return rateEurToKrw; }

  function loadCachedRate() {
    try {
      const raw = localStorage.getItem(RATE_CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (cached && cached.rate) {
        rateEurToKrw = cached.rate;
        rateUpdatedAt = cached.at || null;
      }
    } catch {}
  }

  async function fetchLiveRate() {
    if (rateUpdatedAt && Date.now() - rateUpdatedAt < RATE_TTL) return;
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=KRW', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const rate = data && data.rates && data.rates.KRW;
      if (rate && rate > 100) {
        rateEurToKrw = rate;
        rateUpdatedAt = Date.now();
        localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, at: rateUpdatedAt }));
        if (rateOnChange) rateOnChange();
      }
    } catch {
      // Offline — keep cached/fallback rate.
    }
  }

  const CATEGORIES = ['🍽️ 식비', '🚕 교통', '🛍️ 쇼핑', '🎫 입장료', '🏨 숙박', '☕ 카페', '💧 생수/간식', '기타'];

  function init() {
    loadCachedRate();
    fetchLiveRate();
    rateOnChange = () => render();
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

        <!-- Live FX converter — EUR ↔ KRW -->
        <div class="fx-card">
          <div class="fx-header">
            <span class="fx-title">💱 환율</span>
            <span id="fx-rate" class="fx-rate">1 € = ${Math.round(rateEurToKrw).toLocaleString()} ₩</span>
            <button id="fx-refresh" class="fx-refresh" title="환율 새로고침">↻</button>
          </div>
          <div class="fx-row">
            <div class="fx-input">
              <label>EUR</label>
              <input id="fx-eur" type="number" inputmode="decimal" placeholder="0" />
            </div>
            <span class="fx-equals">=</span>
            <div class="fx-input">
              <label>KRW</label>
              <input id="fx-krw" type="number" inputmode="decimal" placeholder="0" />
            </div>
          </div>
          <div class="fx-meta" id="fx-meta"></div>
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
      bindFxConverter();
    }
    render();
    updateFxMeta();
  }

  function bindFxConverter() {
    const eurEl = document.getElementById('fx-eur');
    const krwEl = document.getElementById('fx-krw');
    const refreshBtn = document.getElementById('fx-refresh');
    if (!eurEl || !krwEl) return;

    let editing = null;
    eurEl.addEventListener('input', () => {
      editing = 'eur';
      const v = Number(eurEl.value);
      krwEl.value = v ? Math.round(v * rateEurToKrw) : '';
    });
    krwEl.addEventListener('input', () => {
      editing = 'krw';
      const v = Number(krwEl.value);
      eurEl.value = v ? (v / rateEurToKrw).toFixed(2) : '';
    });

    refreshBtn?.addEventListener('click', async () => {
      refreshBtn.classList.add('spin');
      rateUpdatedAt = null;   // force refetch
      await fetchLiveRate();
      refreshBtn.classList.remove('spin');
      const rateEl = document.getElementById('fx-rate');
      if (rateEl) rateEl.textContent = `1 € = ${Math.round(rateEurToKrw).toLocaleString()} ₩`;
      updateFxMeta();
      // Re-fill the un-edited side so values stay consistent with the new rate
      if (editing === 'eur') krwEl.dispatchEvent(new Event('input'));
      if (editing === 'krw') eurEl.dispatchEvent(new Event('input'));
    });
  }

  function updateFxMeta() {
    const el = document.getElementById('fx-meta');
    if (!el) return;
    if (!rateUpdatedAt) {
      el.textContent = '※ 기본 환율 사용 중 — ↻ 눌러 최신화';
      return;
    }
    const ageMin = Math.floor((Date.now() - rateUpdatedAt) / 60000);
    const ageStr = ageMin < 60 ? `${ageMin}분 전` : `${Math.floor(ageMin/60)}시간 전`;
    el.textContent = `frankfurter.app · ${ageStr} 갱신`;
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
      const eur = it.currency === 'EUR' ? it.amount : it.amount / rateEurToKrw;
      const krw = it.currency === 'KRW' ? it.amount : it.amount * rateEurToKrw;
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
