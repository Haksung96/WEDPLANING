# WEDPLANING 💍

부부의 허니문 지중해 크루즈 여행 가이드 PWA + 일정 자료.

## 📁 구조

| 폴더 | 내용 |
|---|---|
| [`travel-guide/`](./travel-guide/) | 모바일 PWA 여행 가이드 (실제 앱). 자세한 설치/배포 안내는 [travel-guide/README.md](./travel-guide/README.md) |
| [`여행/`](./여행/) | 일정 계획 원본 자료 (KakaoTalk·Gemini 캡처) |

## 🚀 빠른 시작

```bash
git clone https://github.com/Haksung96/WEDPLANING.git
cd WEDPLANING/travel-guide
# 1) js/config.js 에 Firebase + Google Maps API 키 입력
# 2) index.html 열기 (또는 Netlify/Vercel/Firebase Hosting 배포)
```

상세 설정은 [travel-guide/README.md](./travel-guide/README.md) 참고.

## 📅 여행 정보

- **기간**: 2026.05.10 ~ 2026.05.19 (9박 10일)
- **루트**: 바르셀로나 → 마르세유 → 팔레르모 → 치비타베키아/로마 → 사보나 → 바르셀로나
- **여행자**: 남편 + 와이프

## 🌟 주요 기능

- 📅 9일치 상세 일정 (시간/장소/지도 좌표 포함)
- 🗺️ Google Maps 통합 + 현재 위치 추적
- 📍 일정 장소 250m 진입 시 자동 알림
- 📋 60+ 항목 준비물 체크리스트 (실시간 부부 공유)
- 📝 공유 메모장 (실시간 동기화)
- 🚨 한국 대사관 + EU 긴급 연락처
- 📱 PWA — 홈 화면 설치, 오프라인 지원

## 🛠️ 스택

- 순수 HTML/CSS/JS (빌드 불필요)
- Google Maps JavaScript API
- Firebase Firestore (실시간 동기화)
- Service Worker (오프라인)
