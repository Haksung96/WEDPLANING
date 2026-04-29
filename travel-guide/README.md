# 💍 허니문 지중해 크루즈 가이드 (PWA)

부부가 함께 쓰는 모바일 여행 가이드. 일정·지도·체크리스트·메모를 **실시간 공유**합니다.

📅 **여행 기간**: 2026.05.10 ~ 2026.05.19
🛳️ **루트**: 바르셀로나 → 마르세유 → 팔레르모 → 치비타베키아/로마 → 사보나 → 바르셀로나

---

## ✨ 주요 기능

| 기능 | 설명 |
|---|---|
| 📅 **일정 뷰** | 9일치 상세 스케줄. 시간순으로 정리, 완료 체크 가능 (서로 보임) |
| 🗺️ **지도 뷰** | Google Maps에 일정 핀 + **현재 위치**. 일정 장소 250m 이내 진입 시 자동 알림 |
| 📋 **준비물 체크리스트** | 60+ 항목 사전 입력. 둘이서 실시간으로 체크/추가/삭제 |
| 💡 **팁 & 주의사항** | 크루즈 재승선, 소매치기, 면세, 결제 등 |
| 📝 **공유 메모** | 자유 메모. 입력하는 즉시 상대방에게 동기화 |
| 🚨 **긴급 연락처** | 한국 대사관(스페인/이탈리아/프랑스), EU 긴급(112) |
| 📱 **PWA** | 홈 화면에 설치 가능. 오프라인에서도 일정/체크리스트 열림 |

---

## 🚀 사용법 (가장 빠른 방법)

### 1. Firebase 없이 즉시 사용 (단일 기기)

1. 이 폴더를 그대로 사용. (열기: `index.html` 더블클릭 → 브라우저)
2. **Firebase 미설정 시 로컬 모드**로 동작 — 데이터는 그 기기 내에서만 보존됨.
3. 둘이서 같은 기기를 돌려쓰면 그래도 작동.

### 2. 둘이서 실시간 공유 (권장)

**Firebase Firestore** + **Google Maps API** 두 개만 세팅하면 됩니다. 둘 다 무료 한도 내에서 충분.

#### A. Firebase 설정 (실시간 공유용)

1. [Firebase 콘솔](https://console.firebase.google.com/) 접속 → **프로젝트 만들기** (이름: `wedplan-honeymoon` 등)
2. **Firestore Database** → **데이터베이스 만들기** → **테스트 모드** 선택 (30일간 모두 읽기/쓰기 가능)
3. 좌측 톱니바퀴 → **프로젝트 설정** → 하단 **앱** 섹션 → **웹 앱 추가** (`</>` 아이콘)
4. 앱 이름 입력 후 등록. 표시되는 `firebaseConfig` 객체를 복사.
5. `js/config.js` 파일 열어서 `FIREBASE` 항목에 붙여넣기:

```js
FIREBASE: {
  apiKey: 'AIzaSy...',
  authDomain: 'wedplan-honeymoon.firebaseapp.com',
  projectId: 'wedplan-honeymoon',
  storageBucket: 'wedplan-honeymoon.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
},
```

6. **Firestore 보안 규칙** (간단 버전, 트립 코드만 알면 접근 가능):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripCode}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

> 좀 더 안전하게 하려면 **Firebase Authentication 익명 로그인** 추가 후 `if request.auth != null;` 로 변경.

#### B. Google Maps API 설정 (지도/근접 알림용)

1. [Google Cloud Console](https://console.cloud.google.com/) → 새 프로젝트
2. **API 및 서비스 → 라이브러리** → **Maps JavaScript API** 활성화 (필수)
3. **API 및 서비스 → 사용자 인증 정보** → **+ 사용자 인증 정보 만들기** → **API 키**
4. (권장) 키 클릭 → **HTTP 리퍼러 제한** 추가: `localhost:*`, 배포할 도메인 등
5. `js/config.js` 의 `GOOGLE_MAPS_API_KEY` 에 붙여넣기

> Google Maps는 무료 한도가 매월 $200 어치(약 28,000회 지도 로드)로, 부부 여행에 충분합니다.

#### C. 호스팅 (배포)

가장 간단한 방법:

**Firebase Hosting** (이미 Firebase 쓰고 있으니 권장)
```bash
npm install -g firebase-tools
firebase login
cd travel-guide
firebase init hosting   # public folder는 . 으로
firebase deploy
```

**Netlify Drop** (드래그&드롭 한 번)
1. https://app.netlify.com/drop 접속
2. `travel-guide/` 폴더 통째로 드래그.
3. 받은 URL을 부부가 같이 사용.

**GitHub Pages**
1. Repository에 push (이미 했음).
2. Settings → Pages → Source: `main` branch, `/` (root) 선택.
3. `https://Haksung96.github.io/WEDPLANING/travel-guide/` 로 접속.

배포 후 받은 URL을 핸드폰 Safari/Chrome 에서 열고 → **공유 → 홈 화면에 추가** 하면 앱처럼 사용 가능.

---

## 📱 둘이서 처음 시작할 때

1. 배포 URL을 둘 다 핸드폰에서 열기
2. 첫 화면에서:
   - **이름**: 남편 / 와이프 선택
   - **트립 코드**: `honeymoon2026` (또는 둘이서 정한 같은 코드)
3. **시작하기** 클릭 → 자동으로 동기화됨
4. 한쪽이 체크리스트를 추가하면 다른 쪽에서 즉시 보임 ✓

---

## 🗂️ 파일 구조

```
travel-guide/
├── index.html              # 메인 진입점
├── manifest.json           # PWA 매니페스트
├── sw.js                   # Service Worker (오프라인)
├── css/
│   └── style.css           # 모바일 우선 반응형 스타일
├── js/
│   ├── config.js           # API 키 (★ 여기 채우기)
│   ├── data.js             # 일정 + 체크리스트 + 팁 데이터
│   ├── sync.js             # Firebase Firestore 동기화 (로컬 폴백)
│   ├── checklist.js        # 준비물 체크리스트
│   ├── map.js              # Google Maps + Geolocation + 근접 감지
│   └── app.js              # 메인 컨트롤러, 일정 뷰, 메모, 팁
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── generate-icons.py   # 아이콘 재생성용 스크립트
```

---

## 📝 일정 수정하는 법

`js/data.js` 의 `TRIP.days` 배열에서 직접 수정. 형식:

```js
{
  date: '2026-05-12',
  weekday: '화',
  title: '프랑스 마르세유',
  city: 'Marseille',
  cityCenter: { lat: 43.2965, lng: 5.3698 },
  events: [
    {
      time: '09:30',
      title: '비외 포르 (Vieux-Port)',
      desc: '매일 아침 열리는 수산시장 구경',
      location: { name: 'Vieux-Port de Marseille', lat: 43.2951, lng: 5.3743 },
      radius: 200,            // 근접 알림 반경 (미터)
      tag: 'walk',            // food/walk/shop/attraction/hotel/cruise/transport/flight/rest
    },
  ],
},
```

좌표는 [Google Maps에서 우클릭 → 좌표 클릭](https://support.google.com/maps/answer/18539?hl=ko)으로 손쉽게 얻을 수 있습니다.

---

## ⚠️ 트러블슈팅

| 증상 | 해결 |
|---|---|
| 지도가 회색만 나옴 | `config.js` 의 Maps API 키 확인. Maps JavaScript API 활성화 여부. 결제 연동 (무료 한도 안에서도 카드 등록 필요) |
| 동기화 ● 표시가 회색 (offline) | Firebase 설정 누락 → 로컬 모드. 같은 기기에서만 동작. 위 가이드 따라 Firebase 세팅 |
| 위치 알림이 안 옴 | iOS Safari: 설정 → Safari → 위치 → 허용. PWA 홈화면 추가 후 알림 권한 허용 |
| iOS 에서 알림 푸시 안 옴 | iOS는 PWA 백그라운드 알림이 제한적. 앱이 켜져 있을 때만 banner 알림 표시 |
| 체크가 둘 사이에 동기화 안 됨 | 같은 트립 코드(`honeymoon2026` 등) 사용했는지 확인 |

---

## 🔒 데이터 / 프라이버시

- **데이터 저장 위치**: 본인의 Firebase 프로젝트 (또는 로컬 모드일 때 기기 localStorage)
- **공유 범위**: 같은 트립 코드를 아는 사람만 접근 가능
- **민감정보**: 여권 번호 같은 것은 메모에 적지 말 것 권장

---

## 📜 라이선스

본인/가족용. 자유롭게 수정/배포 가능.
