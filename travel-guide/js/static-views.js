// Pure-render modules for static views — TIPS / PHRASES / EMERGENCY.
// Extracted from app.js to keep that file focused on app lifecycle and
// today/map orchestration. These renderers are read-only (no Sync) and
// pull from data.js (TRAVEL_TIPS, TRIP.emergency) / phrases.js (PHRASES).

const StaticViews = (() => {
  const esc = Utils.escape;

  function renderTips() {
    const root = document.getElementById('tips-content');
    if (!root) return;
    root.innerHTML = '';
    TRAVEL_TIPS.forEach((cat) => {
      const div = document.createElement('div');
      div.className = 'tip-category';
      div.innerHTML = `
        <h4>${cat.icon} ${esc(cat.category)}</h4>
        <ul>${cat.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>
      `;
      root.appendChild(div);
    });
  }

  function renderPhrases() {
    const root = document.getElementById('view-phrases');
    if (!root) return;
    let html = `
      <div class="section-header">
        <h3>🗣️ 여행 회화</h3>
        <p>한국어 → 🇪🇸 스페인어 / 🇮🇹 이탈리아어 / 🇫🇷 프랑스어</p>
      </div>
    `;
    PHRASES.forEach((cat) => {
      html += `<div class="phrase-cat"><h4>${esc(cat.category)}</h4>`;
      cat.items.forEach((p) => {
        html += `
          <div class="phrase-row">
            <div class="phrase-ko">${esc(p.ko)}</div>
            <div class="phrase-tr"><span class="flag">🇪🇸</span> ${esc(p.es)}</div>
            <div class="phrase-tr"><span class="flag">🇮🇹</span> ${esc(p.it)}</div>
            <div class="phrase-tr"><span class="flag">🇫🇷</span> ${esc(p.fr)}</div>
          </div>
        `;
      });
      html += '</div>';
    });
    root.innerHTML = html;
  }

  // Emergency contacts list — uses TRIP.emergency from data.js.
  // Each value is rendered as a tel: link so tapping dials the embassy/EU 112.
  function renderEmergency() {
    const root = document.getElementById('emergency-list');
    if (!root) return;
    const labels = {
      korea_embassy_spain: '🇪🇸 주스페인 한국대사관',
      korea_embassy_italy: '🇮🇹 주이탈리아 한국대사관',
      korea_embassy_france: '🇫🇷 주프랑스 한국대사관',
      korea_embassy_tunisia: '🇹🇳 주튀니지 한국대사관',
      eu_emergency: '🚨 EU 긴급 (경찰/응급)',
      travel_insurance: '🏥 여행자보험',
    };
    root.innerHTML = '';
    Object.entries(TRIP.emergency).forEach(([k, v]) => {
      const div = document.createElement('div');
      div.className = 'em-item';
      const tel = v.replace(/[^\d+]/g, '');
      div.innerHTML = `<span>${labels[k] || k}</span><a href="tel:${tel}">${esc(v)}</a>`;
      root.appendChild(div);
    });
  }

  return { renderTips, renderPhrases, renderEmergency };
})();
