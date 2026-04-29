// Weather widget using Open-Meteo (no API key required).
// https://open-meteo.com/en/docs

const Weather = (() => {
  const cache = new Map();   // dayKey -> { fetchedAt, data }
  const CACHE_TTL = 60 * 60 * 1000;   // 1 hour

  const WEATHER_CODES = {
    0: { icon: '☀️', text: '맑음' },
    1: { icon: '🌤️', text: '대체로 맑음' },
    2: { icon: '⛅', text: '부분 흐림' },
    3: { icon: '☁️', text: '흐림' },
    45: { icon: '🌫️', text: '안개' },
    48: { icon: '🌫️', text: '안개' },
    51: { icon: '🌦️', text: '이슬비' },
    53: { icon: '🌦️', text: '이슬비' },
    55: { icon: '🌦️', text: '이슬비' },
    61: { icon: '🌧️', text: '약한 비' },
    63: { icon: '🌧️', text: '비' },
    65: { icon: '⛈️', text: '강한 비' },
    71: { icon: '🌨️', text: '약한 눈' },
    73: { icon: '🌨️', text: '눈' },
    75: { icon: '❄️', text: '강한 눈' },
    80: { icon: '🌦️', text: '소나기' },
    81: { icon: '🌧️', text: '소나기' },
    82: { icon: '⛈️', text: '강한 소나기' },
    95: { icon: '⛈️', text: '뇌우' },
    96: { icon: '⛈️', text: '뇌우/우박' },
    99: { icon: '⛈️', text: '강한 뇌우' },
  };

  async function getDayForecast(date, lat, lng) {
    if (!lat || !lng) return null;
    const key = `${date}-${lat.toFixed(2)}-${lng.toFixed(2)}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&start_date=${date}&end_date=${date}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('forecast HTTP ' + res.status);
      const json = await res.json();
      if (!json.daily || !json.daily.time || !json.daily.time.length) return null;
      const data = {
        date,
        weatherCode: json.daily.weathercode[0],
        tempMax: Math.round(json.daily.temperature_2m_max[0]),
        tempMin: Math.round(json.daily.temperature_2m_min[0]),
        rainChance: json.daily.precipitation_probability_max[0],
        sunrise: json.daily.sunrise[0],
        sunset: json.daily.sunset[0],
      };
      cache.set(key, { fetchedAt: Date.now(), data });
      return data;
    } catch (err) {
      console.warn('Weather fetch failed:', err);
      return null;
    }
  }

  function describe(code) {
    return WEATHER_CODES[code] || { icon: '🌡️', text: '날씨' };
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  return { getDayForecast, describe, formatTime };
})();
