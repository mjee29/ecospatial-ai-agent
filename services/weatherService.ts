/**
 * 경기도 AWS 기상관측 서비스
 * 경기데이터드림 AWS 1시간 관측정보 API
 *
 * API 문서:
 * - https://data.gg.go.kr/portal/data/service/selectServicePage.do?infId=6RKETV47756150TJ67ZG28812348
 *
 * Base URL: https://openapi.gg.go.kr/AWS1hourObser
 */

const API_KEY = import.meta.env.VITE_GG_AWS_API_KEY;
// CORS 우회를 위해 공개 프록시 사용 또는 직접 호출
// Vite 개발 환경에서는 CORS 정책이 완화되므로 직접 호출 시도
const AWS_BASE_URL = 'https://openapi.gg.go.kr/AWS1hourObser';

// 캐시 설정
let cachedWeatherData: WeatherStationData[] | null = null;
let weatherCacheTime: number = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10분

/**
 * AWS 관측 데이터 인터페이스 (API 원본)
 */
interface AWSObservationRaw {
  SIGUN_NM: string;      // 시군명
  SIGUN_CD: string;      // 시군코드
  SPOT_NO: string;       // 관측지점번호
  SPOT_NM: string;       // 관측지점명
  MESURE_DE: string;     // 관측일자 (YYYYMMDD)
  MESURE_TM: string;     // 관측시간 (HH)
  WGS84_LAT: string;     // 위도
  WGS84_LOGT: string;    // 경도
  TP_INFO: string;       // 기온(℃)
  HD_INFO: string;       // 습도(%)
  WD_INFO: string;       // 풍향(deg)
  WS_INFO: string;       // 풍속(m/s)
  RN_HR1_INFO?: string;  // 1시간 강수량(mm)
  PA_INFO?: string;      // 기압(hPa)
}

/**
 * API 응답 인터페이스
 */
interface AWSApiResponse {
  AWS1hourObser: [
    { head: [{ list_total_count: number }, { RESULT: { CODE: string; MESSAGE: string } }] },
    { row: AWSObservationRaw[] }
  ];
}

/**
 * 가공된 기상 관측 데이터 인터페이스
 */
export interface WeatherStationData {
  sigun: string;               // 시군명
  station: string;             // 관측지점명
  stationId: string;           // 관측지점번호
  datetime: string;            // 관측 일시 (ISO 형식)
  lat: number;                 // 위도
  lon: number;                 // 경도
  temperature_c: number;       // 기온 (℃)
  humidity_pct: number;        // 습도 (%)
  wind_speed_ms: number;       // 풍속 (m/s)
  wind_direction_deg: number;  // 풍향 (deg)
  heat_index: number | null;   // 열지수 (체감온도 - 여름)
  wind_chill: number | null;   // 체감온도 (겨울)
}

/**
 * 열지수(Heat Index) 계산
 * 미국 NOAA 공식 사용 - 기온 27°C 이상, 습도 40% 이상일 때 적용
 *
 * @param T 기온 (°C)
 * @param RH 상대습도 (%)
 * @returns 열지수 (°C) 또는 null (조건 미충족 시)
 */
const calculateHeatIndex = (T: number, RH: number): number | null => {
  // 열지수는 기온 27°C 이상에서만 의미있음
  if (T < 27) return null;

  // 화씨로 변환
  const Tf = (T * 9 / 5) + 32;

  // NOAA Rothfusz regression
  let HI = -42.379 +
    2.04901523 * Tf +
    10.14333127 * RH -
    0.22475541 * Tf * RH -
    0.00683783 * Tf * Tf -
    0.05481717 * RH * RH +
    0.00122874 * Tf * Tf * RH +
    0.00085282 * Tf * RH * RH -
    0.00000199 * Tf * Tf * RH * RH;

  // 조정값 적용
  if (RH < 13 && Tf >= 80 && Tf <= 112) {
    HI -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(Tf - 95)) / 17);
  } else if (RH > 85 && Tf >= 80 && Tf <= 87) {
    HI += ((RH - 85) / 10) * ((87 - Tf) / 5);
  }

  // 섭씨로 변환
  return Math.round(((HI - 32) * 5 / 9) * 10) / 10;
};

/**
 * 체감온도(Wind Chill) 계산
 * 기상청 공식 사용 - 기온 10°C 이하, 풍속 4.8km/h 이상일 때 적용
 *
 * @param T 기온 (°C)
 * @param V 풍속 (m/s)
 * @returns 체감온도 (°C) 또는 null (조건 미충족 시)
 */
const calculateWindChill = (T: number, V: number): number | null => {
  // 체감온도는 기온 10°C 이하에서만 의미있음
  if (T > 10) return null;

  // m/s를 km/h로 변환
  const Vkmh = V * 3.6;

  // 풍속이 4.8km/h 미만이면 체감온도 = 기온
  if (Vkmh < 4.8) return T;

  // 기상청 체감온도 공식
  const WC = 13.12 +
    0.6215 * T -
    11.37 * Math.pow(Vkmh, 0.16) +
    0.3965 * T * Math.pow(Vkmh, 0.16);

  return Math.round(WC * 10) / 10;
};

/**
 * 원시 데이터를 가공하여 WeatherStationData로 변환
 */
const parseWeatherData = (raw: AWSObservationRaw): WeatherStationData => {
  const temperature = parseFloat(raw.TP_INFO) || 0;
  const humidity = parseFloat(raw.HD_INFO) || 0;
  const windSpeed = parseFloat(raw.WS_INFO) || 0;
  const windDirection = parseFloat(raw.WD_INFO) || 0;

  // 관측 일시를 ISO 형식으로 변환
  const year = raw.MESURE_DE.slice(0, 4);
  const month = raw.MESURE_DE.slice(4, 6);
  const day = raw.MESURE_DE.slice(6, 8);
  const hour = raw.MESURE_TM.padStart(2, '0');
  const datetime = `${year}-${month}-${day}T${hour}:00:00+09:00`;

  return {
    sigun: raw.SIGUN_NM,
    station: raw.SPOT_NM,
    stationId: raw.SPOT_NO,
    datetime,
    lat: parseFloat(raw.WGS84_LAT) || 0,
    lon: parseFloat(raw.WGS84_LOGT) || 0,
    temperature_c: temperature,
    humidity_pct: humidity,
    wind_speed_ms: windSpeed,
    wind_direction_deg: windDirection,
    heat_index: calculateHeatIndex(temperature, humidity),
    wind_chill: calculateWindChill(temperature, windSpeed)
  };
};

/**
 * 경기도 AWS 전체 관측 데이터를 조회합니다.
 *
 * @returns 모든 AWS 관측소의 최신 기상 데이터
 */
export const getGyeonggiWeather = async (): Promise<WeatherStationData[]> => {
  // 캐시가 유효하면 반환
  if (cachedWeatherData && Date.now() - weatherCacheTime < CACHE_DURATION) {
    console.log('[Weather API] Using cached Gyeonggi weather data');
    return cachedWeatherData;
  }

  if (!API_KEY) {
    throw new Error('경기도 AWS API 키가 설정되지 않았습니다. .env.local에 VITE_GG_AWS_API_KEY를 추가하세요.');
  }

  try {
    console.log('[Weather API] Fetching Gyeonggi AWS weather data...');

    const params = new URLSearchParams({
      KEY: API_KEY,
      Type: 'json',
      pIndex: '1',
      pSize: '500'  // 경기도 전체 AWS 관측소 수용
    });

    const url = `${AWS_BASE_URL}?${params.toString()}`;
    console.log('[Weather API] Request URL:', url);
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`AWS 기상 데이터 조회 실패: ${response.status} ${response.statusText}`);
    }

    // 응답 텍스트를 먼저 가져옴
    const responseText = await response.text();
    
    // 응답이 JSON인지 확인 (Content-Type 헤더가 잘못된 경우 대비)
    if (!responseText.trim().startsWith('{')) {
      console.error('[Weather API] Response is not JSON');
      console.error('[Weather API] Response preview:', responseText.substring(0, 200));
      throw new Error(`서버가 JSON이 아닌 형식으로 응답했습니다. API 키 오류 또는 서버 문제일 수 있습니다.`);
    }

    // JSON 파싱
    let data: AWSApiResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Weather API] JSON parse failed:', parseError);
      throw new Error(`서버 응답을 JSON으로 파싱할 수 없습니다.`);
    }

    // API 오류 체크
    const head = data.AWS1hourObser?.[0]?.head;
    if (head) {
      const result = head[1]?.RESULT;
      if (result && result.CODE !== 'INFO-000') {
        throw new Error(`API 오류: ${result.MESSAGE}`);
      }
    }

    const rows = data.AWS1hourObser?.[1]?.row || [];

    if (rows.length === 0) {
      console.warn('[Weather API] No weather data returned');
      return [];
    }

    // 데이터 파싱 및 변환
    const weatherData = rows.map(parseWeatherData);

    // 캐시 저장
    cachedWeatherData = weatherData;
    weatherCacheTime = Date.now();

    console.log(`[Weather API] Fetched ${weatherData.length} AWS stations in Gyeonggi-do`);
    return weatherData;
  } catch (error) {
    console.error('[Weather API] Error fetching Gyeonggi weather:', error);
    throw error;
  }
};

/**
 * Haversine 공식으로 두 좌표 간 거리 계산 (km)
 */
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // 지구 반경 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 지역명 → 대표 좌표 매핑 (WGS84) - airkoreaService와 공유 가능
export const WEATHER_LOCATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  '수원시': { lat: 37.2636, lng: 127.0286 },
  '수원': { lat: 37.2636, lng: 127.0286 },
  '성남시': { lat: 37.4201, lng: 127.1265 },
  '성남': { lat: 37.4201, lng: 127.1265 },
  '의정부시': { lat: 37.7381, lng: 127.0337 },
  '의정부': { lat: 37.7381, lng: 127.0337 },
  '안양시': { lat: 37.3943, lng: 126.9568 },
  '안양': { lat: 37.3943, lng: 126.9568 },
  '부천시': { lat: 37.5034, lng: 126.7660 },
  '부천': { lat: 37.5034, lng: 126.7660 },
  '광명시': { lat: 37.4786, lng: 126.8644 },
  '광명': { lat: 37.4786, lng: 126.8644 },
  '평택시': { lat: 36.9921, lng: 127.0857 },
  '평택': { lat: 36.9921, lng: 127.0857 },
  '안산시': { lat: 37.3219, lng: 126.8309 },
  '안산': { lat: 37.3219, lng: 126.8309 },
  '고양시': { lat: 37.6583, lng: 126.8320 },
  '고양': { lat: 37.6583, lng: 126.8320 },
  '과천시': { lat: 37.4292, lng: 126.9876 },
  '과천': { lat: 37.4292, lng: 126.9876 },
  '구리시': { lat: 37.5943, lng: 127.1295 },
  '구리': { lat: 37.5943, lng: 127.1295 },
  '남양주시': { lat: 37.6360, lng: 127.2165 },
  '남양주': { lat: 37.6360, lng: 127.2165 },
  '오산시': { lat: 37.1498, lng: 127.0772 },
  '오산': { lat: 37.1498, lng: 127.0772 },
  '시흥시': { lat: 37.3800, lng: 126.8028 },
  '시흥': { lat: 37.3800, lng: 126.8028 },
  '군포시': { lat: 37.3616, lng: 126.9352 },
  '군포': { lat: 37.3616, lng: 126.9352 },
  '의왕시': { lat: 37.3447, lng: 126.9685 },
  '의왕': { lat: 37.3447, lng: 126.9685 },
  '하남시': { lat: 37.5392, lng: 127.2147 },
  '하남': { lat: 37.5392, lng: 127.2147 },
  '용인시': { lat: 37.2411, lng: 127.1776 },
  '용인': { lat: 37.2411, lng: 127.1776 },
  '파주시': { lat: 37.7126, lng: 126.7610 },
  '파주': { lat: 37.7126, lng: 126.7610 },
  '이천시': { lat: 37.2719, lng: 127.4348 },
  '이천': { lat: 37.2719, lng: 127.4348 },
  '안성시': { lat: 37.0078, lng: 127.2797 },
  '안성': { lat: 37.0078, lng: 127.2797 },
  '김포시': { lat: 37.6153, lng: 126.7156 },
  '김포': { lat: 37.6153, lng: 126.7156 },
  '화성시': { lat: 37.1995, lng: 126.8313 },
  '화성': { lat: 37.1995, lng: 126.8313 },
  '광주시': { lat: 37.4095, lng: 127.2550 },
  '광주': { lat: 37.4095, lng: 127.2550 },
  '양주시': { lat: 37.7854, lng: 127.0456 },
  '양주': { lat: 37.7854, lng: 127.0456 },
  '포천시': { lat: 37.8949, lng: 127.2003 },
  '포천': { lat: 37.8949, lng: 127.2003 },
  '여주시': { lat: 37.2984, lng: 127.6374 },
  '여주': { lat: 37.2984, lng: 127.6374 },
  '연천군': { lat: 38.0965, lng: 127.0748 },
  '연천': { lat: 38.0965, lng: 127.0748 },
  '가평군': { lat: 37.8315, lng: 127.5097 },
  '가평': { lat: 37.8315, lng: 127.5097 },
  '양평군': { lat: 37.4917, lng: 127.4876 },
  '양평': { lat: 37.4917, lng: 127.4876 },
};

/**
 * 특정 좌표에서 가장 가까운 AWS 관측소의 기상 데이터를 찾습니다.
 */
export const findNearestWeatherStation = async (lat: number, lng: number): Promise<WeatherStationData | null> => {
  const allData = await getGyeonggiWeather();

  if (allData.length === 0) {
    return null;
  }

  let nearestStation = allData[0];
  let minDistance = Infinity;

  for (const station of allData) {
    if (station.lat && station.lon) {
      const distance = calculateDistance(lat, lng, station.lat, station.lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = station;
      }
    }
  }

  console.log(`[Weather API] Nearest station: ${nearestStation.station} (${minDistance.toFixed(2)} km)`);
  return nearestStation;
};

/**
 * 지역명으로 기상 정보를 조회합니다.
 *
 * @param locationName 지역명 (예: '수원시', '성남')
 * @returns 해당 지역에서 가장 가까운 AWS 관측소의 기상 데이터
 */
export const getWeather = async (locationName: string): Promise<WeatherStationData | null> => {
  if (!API_KEY) {
    throw new Error('경기도 AWS API 키가 설정되지 않았습니다. .env.local에 VITE_GG_AWS_API_KEY를 추가하세요.');
  }

  // 지역명 정규화
  const normalizedName = locationName.replace(/시$|군$/g, '').trim();
  const coords = WEATHER_LOCATION_COORDINATES[normalizedName] || WEATHER_LOCATION_COORDINATES[locationName];

  if (!coords) {
    throw new Error(`'${locationName}' 지역을 찾을 수 없습니다. 경기도 내 시군구만 지원됩니다.`);
  }

  console.log(`[Weather API] Looking for station near ${locationName} (${coords.lat}, ${coords.lng})`);

  return findNearestWeatherStation(coords.lat, coords.lng);
};

/**
 * 특정 시군의 모든 AWS 관측소 데이터를 조회합니다.
 *
 * @param sigunName 시군명 (예: '수원시')
 * @returns 해당 시군의 모든 AWS 관측소 데이터
 */
export const getWeatherBySigun = async (sigunName: string): Promise<WeatherStationData[]> => {
  const allData = await getGyeonggiWeather();

  return allData.filter(station =>
    station.sigun === sigunName ||
    station.sigun.includes(sigunName.replace(/시$|군$/g, ''))
  );
};

/**
 * 경기도 전체 기상 데이터를 JSON 출력 형식으로 변환합니다.
 *
 * @returns 표준화된 기상 데이터 배열
 */
export const getFormattedWeatherData = async (): Promise<Array<{
  sigun: string;
  station: string;
  datetime: string;
  lat: string;
  lon: string;
  temperature_c: string;
  humidity_pct: string;
  wind_speed_ms: string;
  wind_direction_deg: string;
  heat_index: string;
  wind_chill: string;
}>> => {
  const weatherData = await getGyeonggiWeather();

  return weatherData.map(station => ({
    sigun: station.sigun,
    station: station.station,
    datetime: station.datetime,
    lat: station.lat.toFixed(6),
    lon: station.lon.toFixed(6),
    temperature_c: station.temperature_c.toFixed(1),
    humidity_pct: station.humidity_pct.toFixed(0),
    wind_speed_ms: station.wind_speed_ms.toFixed(1),
    wind_direction_deg: station.wind_direction_deg.toFixed(0),
    heat_index: station.heat_index !== null ? station.heat_index.toFixed(1) : 'N/A',
    wind_chill: station.wind_chill !== null ? station.wind_chill.toFixed(1) : 'N/A'
  }));
};

/**
 * 캐시를 강제로 초기화합니다.
 */
export const clearWeatherCache = (): void => {
  cachedWeatherData = null;
  weatherCacheTime = 0;
  console.log('[Weather API] Cache cleared');
};
