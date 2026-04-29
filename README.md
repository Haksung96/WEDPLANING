# 💍 WEDPLANING

부부의 허니문 지중해 크루즈 여행 가이드 PWA. 일정·지도(경로 포함)·체크리스트·지출·메모·회화를 **실시간 공유**합니다.

🛳 **2026.05.10 ~ 05.19** · 바르셀로나 → 마르세유 → 팔레르모 → 로마 → 사보나 → 바르셀로나

---

## 🚀 핸드폰에서 1-클릭으로 쓰기 — 두 가지 길

### 🅰️ GitHub Pages (Repo Public 필수)

**먼저 한 번만 설정**:
1. https://github.com/Haksung96/WEDPLANING/settings → 맨 아래 **Change visibility → Make public**
   *(GitHub 무료 플랜은 Private Repo에서 Pages 사용 불가)*
2. https://github.com/Haksung96/WEDPLANING/settings/pages → **Source: GitHub Actions** 선택

이후 push 할 때마다 자동 배포됩니다.

배포 URL:
- **앱**: https://haksung96.github.io/WEDPLANING/
- **설치 가이드**: https://haksung96.github.io/WEDPLANING/install.html

### 🅱️ Netlify (Private Repo에서도 무료, 추천)

1. https://app.netlify.com/start 접속 → GitHub 로그인
2. **Import existing project** → GitHub → `WEDPLANING` 선택
3. 자동으로 `netlify.toml` 읽어서 `travel-guide/` 폴더 배포
4. 1~2분 후 `xxxxx.netlify.app` URL 발급 → 즉시 사용 가능

> 💡 Repo가 private인 채로 그대로 둘 수 있고, 커스텀 도메인도 무료.

---

## 📲 핸드폰에 설치 (위 URL 받은 뒤)

### iPhone (Safari)
1. 받은 URL을 Safari로 열기
2. 하단 **공유 ⬆** → **"홈 화면에 추가"** → **추가**

### Android (Chrome)
1. 받은 URL을 Chrome으로 열기
2. 주소창 옆 **설치** 버튼 또는 ⋮ 메뉴 → **앱 설치**

설치 후 홈 화면 아이콘 한 번 탭으로 실행 ✓

### 와이프 핸드폰에 빠르게 보내기
앱 안 **⋯ 더보기 → ⚙️ 설정** → QR 코드를 와이프 핸드폰 카메라로 스캔.

---

## 🖥️ PC에서 즉시 테스트

`시작하기.bat` 더블클릭 → 자동으로 서버 시작 + 브라우저 오픈 (`http://localhost:8765`).

같은 와이파이의 핸드폰에서도 PC IP로 접속 가능 (`ipconfig` 으로 IP 확인).

---

## 🌟 기능

| 영역 | 내용 |
|---|---|
| 📅 일정 | 9일치 상세, ⏱️ 진행중/다음 자동 표시 + 카운트다운, 자동 스크롤 |
| 🗺️ 지도 | Google Maps + **일정 순서대로 도보 경로 그리기** (Directions API) + 번호 마커 |
| 📍 알림 | 일정 장소 250m 이내 진입 시 자동 배너 + 푸시 |
| 🌤️ 날씨 | Open-Meteo 일일 예보 (API 키 불필요) |
| 📋 체크리스트 | 60+ 사전 입력, 카테고리별 접기, 누가 체크했는지 표시 |
| 💶 지출 | EUR/KRW · 결제자 · 카테고리 · 1인당 자동 |
| 🗣️ 회화 | 30+ 표현 KO → ES/IT/FR |
| 📝 메모 | 둘이서 자유 메모, 자동 저장, 실시간 동기화 |
| 🚨 긴급 | 한국대사관(스/이/프) + EU 112 + 보험 핫라인 |
| ⚙️ 설정 | 앱 안에서 API 키 입력 · QR 공유 |
| 📱 PWA | 홈 화면 설치, 오프라인 지원 |

---

## 🔑 API 키 (선택)

**키 없이도 일정/체크리스트/지출/메모/회화/날씨 모두 작동.**

키를 넣으면 추가 기능:
- **Google Maps**: 실제 지도 + 경로 그리기 + 현재 위치 추적
- **Firebase**: 부부 핸드폰 간 실시간 동기화

키 입력은 앱 안 **⋯ 더보기 → ⚙️ 설정** 에서. 발급 방법 → [travel-guide/README.md](./travel-guide/README.md)

---

## 🗂️ 구조

```
WEDPLANING/
├── travel-guide/                 # 메인 PWA (Pages/Netlify의 publish 디렉토리)
│   ├── index.html                # 앱 진입점
│   ├── install.html              # 설치 가이드 + QR
│   ├── manifest.json
│   ├── sw.js
│   ├── css/style.css
│   ├── js/                       # 모든 앱 모듈
│   ├── icons/
│   └── README.md                 # 상세 설정 가이드
├── 여행/                          # 원본 일정 자료
├── .github/workflows/pages.yml   # GitHub Pages 자동 배포
├── netlify.toml                  # Netlify 설정
├── 시작하기.bat                   # 로컬 PC 원클릭 실행
└── README.md                     # 이 파일
```

## 🛠️ 스택
- 순수 HTML/CSS/JS (빌드 불필요)
- Google Maps JavaScript + Directions Service
- Firebase Firestore (선택)
- Open-Meteo (날씨 — 키 불필요)
- QR Code (api.qrserver.com — 키 불필요)
- Service Worker (오프라인)
- GitHub Actions Pages 자동 배포 / Netlify 호환
