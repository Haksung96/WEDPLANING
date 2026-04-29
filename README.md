# 💍 WEDPLANING

부부의 허니문 지중해 크루즈 여행 가이드 PWA. 일정·지도(경로 포함)·체크리스트·지출·메모·회화를 **부부가 실시간으로 공유**합니다.

🛳 **2026.05.10 ~ 05.19** · 바르셀로나 → 마르세유 → 팔레르모 → 로마 → 사보나 → 바르셀로나

---

## 📱 핸드폰에 1-클릭 설치 (가장 빠른 길)

### 📲 [👉 설치 페이지 바로 가기](https://haksung96.github.io/WEDPLANING/travel-guide/install.html)

위 링크를 핸드폰에서 열면:
1. **iPhone**: Safari → 공유 ⬆ → "홈 화면에 추가"
2. **Android**: Chrome → ⋮ 메뉴 → "앱 설치"

설치하면 홈 화면 아이콘 한 번 탭으로 실행됩니다.

### 📷 또는 QR 코드로 (다른 핸드폰에 빠르게 보낼 때)

![QR](https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=https%3A%2F%2Fhaksung96.github.io%2FWEDPLANING%2Ftravel-guide%2Finstall.html)

스캔 → 바로 설치 페이지로.

### 🌐 직접 앱 열기 (설치 안 해도 사용 가능)
👉 **https://haksung96.github.io/WEDPLANING/travel-guide/**

---

## 🖥️ PC에서 로컬로 돌리고 싶을 때

`시작하기.bat` 더블클릭 → 자동으로 서버 시작 + 브라우저 오픈.
같은 와이파이의 핸드폰에서도 PC IP로 접속 가능.

수동:
```bash
cd travel-guide
python -m http.server 8765
```

---

## 🌟 기능 한눈에

| 카테고리 | 기능 |
|---|---|
| 📅 일정 | 9일치 상세 + ⏱️ 진행중/다음 자동 표시 + 카운트다운 |
| 🗺️ 지도 | Google Maps + **일정 순서대로 경로 그리기** + 번호 마커 + 현재위치 + 250m 근접알림 |
| 🌤️ 날씨 | 도시별 일일 날씨 (Open-Meteo · 키 불필요) |
| 📋 체크리스트 | 60+ 항목 사전 입력. 카테고리별 접기. 누가 체크했는지 표시 |
| 💶 지출 | EUR/KRW · 결제자 · 카테고리 합계 · 1인당 자동 계산 |
| 🗣️ 회화 | 30+ 문장 KO → ES/IT/FR |
| 📝 메모 | 둘이서 자유 메모, 자동 저장, 실시간 동기화 |
| 🚨 긴급 | 한국대사관(스/이/프) + EU 112 + 보험 |
| ⚙️ 설정 | 앱 안에서 API 키 입력 (config.js 수정 불필요) + QR 공유 |
| 📱 PWA | 홈 화면 설치, 오프라인 지원, 푸시 알림 |

---

## 🔑 API 키 (선택)

**키 없이도 모든 기능 작동** — 단:
- **Google Maps 키 없으면**: 지도 탭은 placeholder. 일정/체크리스트/지출 등은 정상.
- **Firebase 없으면**: 로컬 모드로 작동. 같은 기기에서만 데이터 보존.

키를 넣으면:
- **Google Maps**: 실제 지도 + 도보 경로 + 현재 위치
- **Firebase**: 부부 핸드폰끼리 실시간 동기화

키 입력은 앱 안 **⋯ 더보기 → ⚙️ 설정** 에서 직접. 발급 방법은 [travel-guide/README.md](./travel-guide/README.md) 참고.

---

## 🚀 자동 배포 (개발자용)

`main` 브랜치에 push하면 GitHub Actions가 [travel-guide/](./travel-guide/) 를 GitHub Pages에 자동 배포 → https://haksung96.github.io/WEDPLANING/travel-guide/

**최초 1회만 활성화 필요**:
- Repo → Settings → Pages → Source: **GitHub Actions** 선택

---

## 🗂️ 구조

```
WEDPLANING/
├── travel-guide/                 # 메인 PWA
│   ├── index.html                # 앱 진입점
│   ├── install.html              # 설치 가이드 + QR
│   ├── manifest.json             # PWA 매니페스트
│   ├── sw.js                     # Service Worker
│   ├── css/style.css
│   ├── js/                       # 앱 모듈 (data/sync/map/app...)
│   ├── icons/                    # PWA 아이콘
│   └── README.md                 # 상세 설정 가이드
├── 여행/                          # 원본 일정 자료 (Gemini/카톡 캡처)
├── .github/workflows/pages.yml   # 자동 배포
├── 시작하기.bat                   # 로컬 PC 원클릭 실행
└── README.md                     # 이 파일
```

## 🛠️ 스택
- 순수 HTML/CSS/JS (빌드 불필요)
- Google Maps JavaScript API + Directions Service (경로)
- Firebase Firestore (실시간 동기화 — 선택)
- Open-Meteo (날씨 — 무료, 키 불필요)
- QR Code (api.qrserver.com — 무료)
- Service Worker (오프라인)
- GitHub Actions Pages 자동 배포
