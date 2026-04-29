# WEDPLANING 💍

부부의 허니문 지중해 크루즈 여행 가이드 PWA + 일정 자료.

## 📁 구조

| 폴더 | 내용 |
|---|---|
| [`travel-guide/`](./travel-guide/) | 모바일 PWA 여행 가이드 (실제 앱). 자세한 설치/배포 안내는 [travel-guide/README.md](./travel-guide/README.md) |
| [`여행/`](./여행/) | 일정 계획 원본 자료 (KakaoTalk·Gemini 캡처) |

## 🚀 빠른 시작

### 가장 쉬운 방법 (Windows)
1. `시작하기.bat` 더블클릭
2. 자동으로 로컬 서버가 켜지고 브라우저가 `http://localhost:8765` 를 엽니다
3. 같은 와이파이의 핸드폰에서도 접속 가능 (PC IP 주소 사용)

### 수동
```bash
cd travel-guide
python -m http.server 8765
# 브라우저: http://localhost:8765
```

### 핸드폰에서 영구 사용 (배포)
1. GitHub Repo → Settings → **Pages** → Source: **GitHub Actions** 선택
2. 다음 push 시 [.github/workflows/pages.yml](.github/workflows/pages.yml) 가 자동 배포
3. 배포 후 URL: **https://haksung96.github.io/WEDPLANING/travel-guide/**

### API 키 입력 (지도 + 실시간 공유)
앱 안에서 **⋯ 더보기 → ⚙️ 설정** 으로 Google Maps · Firebase 키 입력 가능 (config.js 수정 불필요).

상세 설정은 [travel-guide/README.md](./travel-guide/README.md) 참고.

## 📅 여행 정보

- **기간**: 2026.05.10 ~ 2026.05.19 (9박 10일)
- **루트**: 바르셀로나 → 마르세유 → 팔레르모 → 치비타베키아/로마 → 사보나 → 바르셀로나
- **여행자**: 남편 + 와이프

## 🌟 주요 기능

- 📅 9일치 상세 일정 (시간/장소/지도 좌표 포함)
- ⏱️ "진행중 / 다음" 자동 표시 + 카운트다운
- 🌤️ 도시별 일일 날씨 (Open-Meteo · API 키 불필요)
- 🗺️ Google Maps 통합 + 현재 위치 추적
- 📍 일정 장소 250m 진입 시 자동 알림
- 📋 60+ 항목 준비물 체크리스트 (실시간 부부 공유)
- 💶 EUR/KRW 지출 트래커 (1인당 자동 계산)
- 🗣️ 30+ 여행 회화 (KO → ES/IT/FR)
- 📝 공유 메모장 (실시간 동기화)
- ⚙️ 앱 안에서 API 키 입력 (config.js 수정 불필요)
- 🚨 한국 대사관 + EU 긴급 연락처
- 📱 PWA — 홈 화면 설치, 오프라인 지원

## 🛠️ 스택

- 순수 HTML/CSS/JS (빌드 불필요)
- Google Maps JavaScript API
- Firebase Firestore (실시간 동기화, 선택)
- Open-Meteo (무료 날씨 API)
- Service Worker (오프라인)
- GitHub Actions Pages auto-deploy
