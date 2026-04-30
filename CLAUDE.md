# CLAUDE.md — WEDPLANING (허니문 지중해 크루즈 가이드)

> 이 파일은 프로젝트 루트의 지침으로, 글로벌 [`~/.claude/CLAUDE.md`](file://C:/Users/user/.claude/CLAUDE.md) 와 그 산하 규칙(`rules/common/*.md`, `rules/typescript/*.md`)을 **상속**합니다. 충돌 시 이 파일 우선.

---

## 0. 프로젝트 정체성

| 항목 | 값 |
|---|---|
| 이름 | **WEDPLANING** — 허니문 지중해 크루즈 가이드 PWA |
| 사용자 | 부부 (남편 + 와이프) — 모바일 1차 사용자 |
| 여행 기간 | **2026.05.10 ~ 05.19** (10일) |
| 크루즈 | MSC · 7박 · 5/11 승선 → 5/18 하선 |
| 루트 | 바르셀로나 → At Sea → 튀니지 → 팔레르모 → 로마/치비타베키아 → 사보나 → 마르세유 → 바르셀로나 |
| GitHub | https://github.com/Haksung96/WEDPLANING |
| Live | https://mellifluous-genie-58fe8c.netlify.app/ |
| Repo 가시성 | Public |

---

## 1. 언어 정책 (필수)

- **응답/리포트/문서/UI 텍스트**: **한글**
- **코드/주석/변수명/함수명/커밋 메시지**: **영어** 유지
- **파일 경로 참조**: `[파일명](경로)` 마크다운 링크 (VSCode 환경)
- 출처: 글로벌 §1

---

## 2. 기술 스택 (불변 — 변경 시 사용자 승인)

| 계층 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **순수 HTML/CSS/JS** (빌드 X) | 정적 호스팅 호환, 빠른 시작, 의존성 0 |
| 호스팅 | **Netlify** (자동 배포) | Private repo 무료 지원, 즉각 CDN |
| 지도 | **Google Maps JavaScript + Directions API** | 도보 경로 정확도 |
| 실시간 동기화 | **Firebase Firestore** (`wedplaning-50226`) | 부부 핸드폰 간 즉각 sync |
| 날씨 | **Open-Meteo** (키 불필요) | 무료 무한 |
| QR | `api.qrserver.com` | 무료 무한 |
| PWA | Service Worker (network-first for `config.js` + `index.html`) | 키 변경 시 1회 reload로 적용 |

> ⚠️ **React/Vue/Webpack 등 추가 금지** — 빌드 시스템 도입은 사용자 명시 승인 후.

---

## 3. 모바일 우선 원칙 (이 프로젝트의 핵심)

- **타겟**: iPhone Safari + Android Chrome PWA. 데스크톱은 보조.
- **Apple HIG 준수**: 모든 터치 타깃 최소 **44×44 px**.
- **iOS 자동 줌 차단**: 모든 `<input>` 폰트 16px 이상.
- **iOS Safari URL 바**: `100vh` 대신 `100dvh` 사용.
- **Safe-area inset**: `env(safe-area-inset-*)` 노치/홈바 인지.
- **300ms 탭 지연 제거**: `touch-action: manipulation`.
- **햅틱 피드백**: Vibration API (가벼움/중간/성공/오류 패턴).
- **글래스 모피즘**: 하단 nav, status bar 일관 적용.
- **한글 줄바꿈**: 모든 텍스트 컨테이너에 `word-break: keep-all`.
- **반응형 분기**: 360px 미만 (작은 폰), 420px 이상 (Pro Max).

> 새 UI 추가 시 위 원칙 자체 점검 후 사용자 확인.

---

## 4. 데이터 구조 (편집 시 주의)

### 4.1 일정 ([travel-guide/js/data.js](travel-guide/js/data.js))

`TRIP.days[i].events[j]` 가 핵심 구조. 각 이벤트는:

```js
{
  time: 'HH:MM' or 'HH:MM ~ HH:MM' or '종일',
  title: '...',
  desc: '...',           // optional
  location: { name, lat, lng },  // optional but enables map + 길찾기
  radius: 100~500,       // 근접 알림 반경(m)
  tag: 'food|walk|shop|attraction|hotel|cruise|transport|flight|rest',
}
```

**재승선 자동 카운트다운**은 `tag === 'cruise' || tag === 'transport'` + 키워드 (`재승선`, `복귀`, `항구`)로 자동 감지 — 위 형식 준수해야 작동.

### 4.2 체크리스트 / 팁

`DEFAULT_CHECKLIST`, `TRAVEL_TIPS` 도 같은 파일. 카테고리별 구조 유지.

### 4.3 데이터 변경 워크플로우

1. `data.js` 수정 → push
2. Netlify 자동 재배포 (1~2분)
3. PWA는 SW v7 이후 `index.html`만 network-first 라 `data.js`는 캐시됨 → **사용자 두 번째 reload 부터 반영**. (혹은 SW 캐시 키 bump)

---

## 5. 보안 / 키 관리

| 키 종류 | 위치 | 노출 안전도 |
|---|---|---|
| Google Maps API | [config.js](travel-guide/js/config.js) | ✅ 안전 (HTTP 리퍼러 + API 제한) |
| Firebase Web Config | [config.js](travel-guide/js/config.js) | ✅ 안전 (Firestore Rules로 보호 + 트립 코드 비밀) |
| Firestore Rules | Firebase Console | `match /trips/{tripCode}/*` allow if true |

**금지**: 사용자 비밀 (passwords, tokens 등)을 코드/메모에 저장.

---

## 6. 자주 하는 실수 (피해야 함)

- **Windows bat 파일을 UTF-8로 저장**: cmd.exe 가 한글 깨짐. 반드시 CP949로 변환 (Python `open(path, 'w', encoding='cp949')`).
- **bat에 유니코드 특수문자**: `✔ ╔ ═ ╗ ║ ▶ ─` 등 금지. ASCII (`[OK]`, `====`, `*`, `---`) 사용.
- **`https://` 접두어를 Maps API HTTP 리퍼러에 포함**: 일부 환경에서 매칭 실패. 도메인만 (`*.netlify.app/*`).
- **API 키를 한 칸에 4개 다 입력**: Google Cloud는 chip 별 분리 필요.
- **`config.js` 캐시 갱신 누락**: 사용자가 Settings에서 직접 입력 + 자동 마이그레이션 둘 다 작동.

---

## 7. 핵심 명령어 / 흐름

### 로컬 실행
```bash
# Windows
시작하기.bat                 # CP949 인코딩, 자동 서버+브라우저
# 또는
cd travel-guide
python -m http.server 8765
```

### 배포
```bash
git push                     # Netlify가 자동 배포 (~2분)
```

### 키 검증
- Google Maps: `curl -H "Referer: https://...netlify.app/" https://maps.googleapis.com/maps/api/staticmap?...&key=...` → HTTP 200 + PNG
- Firestore: REST POST 시도 → 200 OK 면 Rules 정상

### Pull/Push 체크
```bash
git status --short
git ls-remote https://github.com/Haksung96/WEDPLANING.git HEAD
```

---

## 8. 워크플로우 (글로벌 §6 적용)

```
[0. Research] → [1. Strategy] → [2. Dev] → [3. Review] → [4. Verify] → [5. Ops]
```

이 프로젝트의 작은 변경(text 수정, 좌표 보정 등)은 **2 → 3** 만으로도 OK. 새 기능 (예: 사진 첨부, 새 모듈)은 전 단계.

### 게이트
- 2→3: JS syntax `node --check` PASS, 빌드 PASS
- 3→4: 사용자 검증 (모바일 실 사용)
- 4→5: 라이브 사이트 200 OK + 자산 누락 0
- 5→종료: README 동기화, 커밋 메시지 영문 conventional

---

## 9. 에이전트 활성화 (글로벌 §5 적용)

이 프로젝트의 일반 트리거:
- "기능 추가/수정" → **planner** (선택) → 메인 작업자
- "코드 작성 직후" → **typescript-reviewer** (자동, MUST)
- "보안 관련 변경" → **security-reviewer** (MUST)
- "버그 수정" → **tdd-guide** + 메인 작업자
- "API 키 / 호스팅 이슈" → 메인 작업자 직접

병렬 실행 패턴은 글로벌 [rules/teams.md](file://C:/Users/user/.claude/rules/teams.md) 따름.

---

## 10. 커밋 메시지 형식

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

> 사용자 환경(`~/.claude/settings.json`)에서 attribution 비활성화됨.

---

## 11. 산출물 / 파일 인덱스

| 파일 | 역할 |
|---|---|
| [travel-guide/index.html](travel-guide/index.html) | 메인 진입점 |
| [travel-guide/install.html](travel-guide/install.html) | 핸드폰 설치 가이드 + QR |
| [travel-guide/manifest.json](travel-guide/manifest.json) | PWA 매니페스트 |
| [travel-guide/sw.js](travel-guide/sw.js) | Service Worker (network-first config + index) |
| [travel-guide/css/style.css](travel-guide/css/style.css) | 모바일 우선 다크 테마 |
| [travel-guide/js/config.js](travel-guide/js/config.js) | Google Maps + Firebase 키 |
| [travel-guide/js/settings.js](travel-guide/js/settings.js) | In-app 설정 + 자동 마이그레이션 |
| [travel-guide/js/data.js](travel-guide/js/data.js) | 일정/체크리스트/팁 데이터 |
| [travel-guide/js/sync.js](travel-guide/js/sync.js) | Firestore 실시간 동기화 |
| [travel-guide/js/checklist.js](travel-guide/js/checklist.js) | 준비물 체크리스트 |
| [travel-guide/js/expenses.js](travel-guide/js/expenses.js) | EUR/KRW 지출 트래커 |
| [travel-guide/js/weather.js](travel-guide/js/weather.js) | Open-Meteo 날씨 |
| [travel-guide/js/presence.js](travel-guide/js/presence.js) | 부부 위치 실시간 공유 |
| [travel-guide/js/reboarding.js](travel-guide/js/reboarding.js) | 재승선 카운트다운 |
| [travel-guide/js/map.js](travel-guide/js/map.js) | Google Maps + Directions |
| [travel-guide/js/mobile.js](travel-guide/js/mobile.js) | 햅틱 + 스와이프 + 더블탭 줌 차단 |
| [travel-guide/js/phrases.js](travel-guide/js/phrases.js) | 회화 (KO→ES/IT/FR) |
| [travel-guide/js/app.js](travel-guide/js/app.js) | 메인 컨트롤러 |
| [.github/workflows/pages.yml](.github/workflows/pages.yml) | (옵션) GitHub Pages |
| [netlify.toml](netlify.toml) | Netlify 빌드 + 헤더 설정 |
| [시작하기.bat](시작하기.bat) | Windows 로컬 원클릭 (CP949) |
| [README.md](README.md) | 사용자 가이드 |

---

## 12. 일정 정확성 (Single Source of Truth)

**SoT**: [travel-guide/js/data.js](travel-guide/js/data.js) > `TRIP.days`

원본 자료:
- [여행/](여행/) 폴더 — KakaoTalk + 바르셀로나 캡처 + MSC 앱 캡처
- 일정 변경 시 이미지 + data.js 동시 업데이트

**현재 확정 일정** (MSC 앱 캡처 기준):
| Day | Date | Port | 입항 | 승선 | 출항 |
|---|---|---|---|---|---|
| 1 | 5/11 (월) | Barcelona | 09:00 | 17:30 | 18:00 |
| 2 | 5/12 (화) | At Sea | — | — | — |
| 3 | 5/13 (수) | La Goulette/Tunis | 08:00 | 17:30 | 18:00 |
| 4 | 5/14 (목) | Palermo | 08:00 | 16:00 | 16:30 |
| 5 | 5/15 (금) | Civitavecchia/Rome | 08:30 | 18:30 | 19:00 |
| 6 | 5/16 (토) | Savona | 08:30 | 17:00 | 17:30 |
| 7 | 5/17 (일) | Marseille | 08:30 | 17:30 | 18:00 |
| 8 | 5/18 (월) | Barcelona (하선) | 08:00 | — | — |

---

## 13. 우선순위 (현재)

1. ✅ 모든 키/배포 완료 (Maps + Firebase + Netlify)
2. ✅ 모바일 최적화 완료
3. ✅ 부부 공유 + 재승선 알림 + 실시간 동기화
4. 🔄 핸드폰 PWA 자동 마이그레이션 (캐시 갱신) — 라이브 검증 진행
5. ⏳ 출국 5/10 전까지 데이터 정확도 점검

---

## 14. 사용자 컨텍스트

- **OS**: Windows 11 한글
- **Shell**: bash + PowerShell
- **Python**: 3.13
- **Editor**: VSCode
- **Git user**: Haksung96
- **Email**: hikwon1129@gmail.com (또는 dhkim@geodong.co.kr)
