// =====================================================
// CONFIG — Fill in your API keys here
// 자세한 설정 방법은 README.md 참고
// =====================================================

const CONFIG = {
  // Google Maps JavaScript API key
  // 발급: https://console.cloud.google.com/google/maps-apis
  // (Maps JavaScript API + Places API 활성화 필요)
  GOOGLE_MAPS_API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY',

  // Firebase Web SDK config
  // 발급: https://console.firebase.google.com/ → 프로젝트 만들기 → 웹 앱 추가
  // Firestore 활성화 필요
  // (값을 비워두면 로컬 모드로 동작 — 같은 기기 안에서만 동기화됨)
  FIREBASE: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },

  // 근접 알림 — 이 거리(미터) 안에 들어오면 일정 안내
  PROXIMITY_RADIUS_METERS: 250,

  // 위치 추적 주기 (밀리초)
  LOCATION_UPDATE_INTERVAL: 30000,

  // 자동 저장 (메모) 디바운스 (밀리초)
  AUTOSAVE_DEBOUNCE: 800,
};

// Helper: check whether Firebase is configured
function isFirebaseConfigured() {
  return CONFIG.FIREBASE && CONFIG.FIREBASE.apiKey && CONFIG.FIREBASE.projectId;
}

// Helper: check whether Google Maps key is configured
function isMapsConfigured() {
  return CONFIG.GOOGLE_MAPS_API_KEY && CONFIG.GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY';
}
