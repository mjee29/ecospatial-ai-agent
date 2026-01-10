/**
 * 에어코리아 API Service
 * 환경부 한국환경공단의 대기오염정보 조회 서비스
 *
 * API 문서:
 * - 대기오염정보: https://www.data.go.kr/data/15073861/openapi.do
 * - 측정소정보: https://www.data.go.kr/data/15073877/openapi.do
 */

const SERVICE_KEY = import.meta.env.VITE_AIRKOREA_SERVICE_KEY;
// 프록시를 통해 HTTPS에서도 HTTP API 호출 가능
const AIR_QUALITY_BASE_URL = '/airkorea/B552584/ArpltnInforInqireSvc';
const STATION_INFO_BASE_URL = '/airkorea/B552584/MsrstnInfoInqireSvc';

// 지역명 → 대표 좌표 매핑 (WGS84)
export const LOCATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  '수원시': { lat: 37.2636, lng: 127.0286 },
  '수원': { lat: 37.2636, lng: 127.0286 },
  '장안구': { lat: 37.3035, lng: 127.0106 },
  '팔달구': { lat: 37.2795, lng: 127.0392 },
  '권선구': { lat: 37.2504, lng: 127.0030 },
  '영통구': { lat: 37.2479, lng: 127.0735 },
  '성남시': { lat: 37.4201, lng: 127.1265 },
  '성남': { lat: 37.4201, lng: 127.1265 },
  '판교': { lat: 37.3947, lng: 127.1112 },
  '분당': { lat: 37.3838, lng: 127.1192 },
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
  '일산': { lat: 37.6755, lng: 126.7706 },
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
  '동탄': { lat: 37.2007, lng: 127.0714 },
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

// 대기질 등급 정의
export enum AirQualityGrade {
  GOOD = 1,        // 좋음
  MODERATE = 2,    // 보통
  UNHEALTHY = 3,   // 나쁨
  VERY_UNHEALTHY = 4 // 매우 나쁨
}

export const AIR_QUALITY_LABELS: Record<AirQualityGrade, string> = {
  [AirQualityGrade.GOOD]: '좋음',
  [AirQualityGrade.MODERATE]: '보통',
  [AirQualityGrade.UNHEALTHY]: '나쁨',
  [AirQualityGrade.VERY_UNHEALTHY]: '매우 나쁨'
};

export const AIR_QUALITY_COLORS: Record<AirQualityGrade, string> = {
  [AirQualityGrade.GOOD]: '#3b82f6',        // 파랑
  [AirQualityGrade.MODERATE]: '#22c55e',    // 초록
  [AirQualityGrade.UNHEALTHY]: '#f59e0b',   // 주황
  [AirQualityGrade.VERY_UNHEALTHY]: '#ef4444' // 빨강
};

// 측정소 정보 인터페이스
export interface StationInfo {
  stationName: string;
  addr: string;
  dmX: number; // 위도
  dmY: number; // 경도
  distance?: number; // 거리 (km)
}

// 대기질 데이터 인터페이스
export interface AirQualityData {
  stationName: string;
  locationName: string;
  measureTime: string;
  lat: number;
  lng: number;
  khaiValue: number;
  khaiGrade: AirQualityGrade;
  pm10Value: number;
  pm10Grade: AirQualityGrade;
  pm10Grade1h: AirQualityGrade;
  pm25Value: number;
  pm25Grade: AirQualityGrade;
  pm25Grade1h: AirQualityGrade;
  so2Value: number;
  coValue: number;
  o3Value: number;
  no2Value: number;
  pm10Flag: string | null;
  pm25Flag: string | null;
}

// API 응답 타입들
interface StationListResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      totalCount: number;
      items: Array<{
        stationName: string;
        addr: string;
        dmX: string;
        dmY: string;
      }>;
    };
  };
}

interface NearbyStationResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items: Array<{
        stationName: string;
        addr: string;
        tm: string; // 거리 (km)
      }>;
    };
  };
}

interface AirQualityResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items: Array<{
        stationName: string;
        dataTime: string;
        khaiValue: string;
        khaiGrade: string;
        pm10Value: string;
        pm10Grade: string;
        pm10Grade1h: string;
        pm25Value: string;
        pm25Grade: string;
        pm25Grade1h: string;
        so2Value: string;
        coValue: string;
        o3Value: string;
        no2Value: string;
        pm10Flag: string | null;
        pm25Flag: string | null;
      }>;
    };
  };
}

// 경기도 전체 대기질 캐시 (측정소 정보 포함)
interface CachedAirQualityItem {
  stationName: string;
  dataTime: string;
  khaiValue: string;
  khaiGrade: string;
  pm10Value: string;
  pm10Grade: string;
  pm10Grade1h: string;
  pm25Value: string;
  pm25Grade: string;
  pm25Grade1h: string;
  so2Value: string;
  coValue: string;
  o3Value: string;
  no2Value: string;
  pm10Flag: string | null;
  pm25Flag: string | null;
}

let cachedGyeonggiAirQuality: CachedAirQualityItem[] | null = null;
let airQualityCacheTime: number = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10분

// 측정소명 → 대략적인 좌표 매핑 (대기질 API에서는 좌표가 제공되지 않음)
// 측정소명에 지역명이 포함되어 있으므로 이를 활용
const STATION_LOCATION_KEYWORDS: Record<string, { lat: number; lng: number }> = {
  '수원': { lat: 37.2636, lng: 127.0286 },
  '성남': { lat: 37.4201, lng: 127.1265 },
  '분당': { lat: 37.3838, lng: 127.1192 },
  '용인': { lat: 37.2411, lng: 127.1776 },
  '안양': { lat: 37.3943, lng: 126.9568 },
  '부천': { lat: 37.5034, lng: 126.7660 },
  '광명': { lat: 37.4786, lng: 126.8644 },
  '평택': { lat: 36.9921, lng: 127.0857 },
  '안산': { lat: 37.3219, lng: 126.8309 },
  '고양': { lat: 37.6583, lng: 126.8320 },
  '일산': { lat: 37.6755, lng: 126.7706 },
  '과천': { lat: 37.4292, lng: 126.9876 },
  '구리': { lat: 37.5943, lng: 127.1295 },
  '남양주': { lat: 37.6360, lng: 127.2165 },
  '오산': { lat: 37.1498, lng: 127.0772 },
  '시흥': { lat: 37.3800, lng: 126.8028 },
  '군포': { lat: 37.3616, lng: 126.9352 },
  '의왕': { lat: 37.3447, lng: 126.9685 },
  '하남': { lat: 37.5392, lng: 127.2147 },
  '파주': { lat: 37.7126, lng: 126.7610 },
  '이천': { lat: 37.2719, lng: 127.4348 },
  '안성': { lat: 37.0078, lng: 127.2797 },
  '김포': { lat: 37.6153, lng: 126.7156 },
  '화성': { lat: 37.1995, lng: 126.8313 },
  '동탄': { lat: 37.2007, lng: 127.0714 },
  '광주': { lat: 37.4095, lng: 127.2550 },
  '양주': { lat: 37.7854, lng: 127.0456 },
  '포천': { lat: 37.8949, lng: 127.2003 },
  '여주': { lat: 37.2984, lng: 127.6374 },
  '의정부': { lat: 37.7381, lng: 127.0337 },
  '영통': { lat: 37.2479, lng: 127.0735 },
  '권선': { lat: 37.2504, lng: 127.0030 },
  '장안': { lat: 37.3035, lng: 127.0106 },
  '팔달': { lat: 37.2795, lng: 127.0392 },
  '중원': { lat: 37.4344, lng: 127.1365 },
  '수정': { lat: 37.4530, lng: 127.1455 },
  '판교': { lat: 37.3947, lng: 127.1112 },
};

/**
 * 경기도 전체 대기질 데이터를 조회합니다 (시도별 API 사용)
 */
export const getGyeonggiAirQuality = async (): Promise<CachedAirQualityItem[]> => {
  // 캐시가 유효하면 반환
  if (cachedGyeonggiAirQuality && Date.now() - airQualityCacheTime < CACHE_DURATION) {
    console.log('[AirKorea API] Using cached Gyeonggi air quality data');
    return cachedGyeonggiAirQuality;
  }

  if (!SERVICE_KEY) {
    throw new Error('에어코리아 API 키가 설정되지 않았습니다.');
  }

  try {
    console.log('[AirKorea API] Fetching Gyeonggi air quality data...');

    const params = new URLSearchParams({
      serviceKey: SERVICE_KEY,
      returnType: 'json',
      numOfRows: '200',
      pageNo: '1',
      sidoName: '경기',
      ver: '1.0'
    });

    const url = `${AIR_QUALITY_BASE_URL}/getCtprvnRltmMesureDnsty?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`경기도 대기질 조회 실패: ${response.status}`);
    }

    const data = await response.json();

    if (data.response.header.resultCode !== '00') {
      throw new Error(`API 오류: ${data.response.header.resultMsg}`);
    }

    const items = data.response.body.items || [];

    // 캐시 저장
    cachedGyeonggiAirQuality = items;
    airQualityCacheTime = Date.now();

    console.log(`[AirKorea API] Fetched ${items.length} stations' air quality in Gyeonggi-do`);
    return items;
  } catch (error) {
    console.error('[AirKorea API] Error fetching Gyeonggi air quality:', error);
    throw error;
  }
};

/**
 * 측정소명에서 좌표를 추정합니다
 */
const getStationCoordinates = (stationName: string): { lat: number; lng: number } | null => {
  for (const [keyword, coords] of Object.entries(STATION_LOCATION_KEYWORDS)) {
    if (stationName.includes(keyword)) {
      return coords;
    }
  }
  return null;
};

// Haversine 공식으로 거리 계산
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

/**
 * 주어진 좌표에서 가장 가까운 측정소의 대기질 데이터를 찾습니다.
 */
export const findNearestStationAirQuality = async (lat: number, lng: number): Promise<{ item: CachedAirQualityItem; coords: { lat: number; lng: number } }> => {
  const allData = await getGyeonggiAirQuality();

  if (allData.length === 0) {
    throw new Error('경기도 대기질 데이터를 가져올 수 없습니다.');
  }

  let nearestItem = allData[0];
  let nearestCoords = getStationCoordinates(nearestItem.stationName) || { lat, lng };
  let minDistance = Infinity;

  for (const item of allData) {
    const stationCoords = getStationCoordinates(item.stationName);
    if (stationCoords) {
      const distance = calculateDistance(lat, lng, stationCoords.lat, stationCoords.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestItem = item;
        nearestCoords = stationCoords;
      }
    }
  }

  console.log(`[AirKorea API] Nearest station: ${nearestItem.stationName} (approx. ${minDistance.toFixed(2)} km)`);
  return { item: nearestItem, coords: nearestCoords };
};

/**
 * 특정 측정소의 실시간 대기질 데이터를 조회합니다.
 */
export const getStationAirQuality = async (stationName: string): Promise<AirQualityResponse['response']['body']['items'][0] | null> => {
  if (!SERVICE_KEY) {
    throw new Error('에어코리아 API 키가 설정되지 않았습니다.');
  }

  try {
    console.log(`[AirKorea API] Fetching air quality for station: ${stationName}`);

    const params = new URLSearchParams({
      serviceKey: SERVICE_KEY,
      returnType: 'json',
      numOfRows: '1',
      pageNo: '1',
      stationName: stationName,
      dataTerm: 'DAILY',
      ver: '1.0'
    });

    const url = `${AIR_QUALITY_BASE_URL}/getMsrstnAcctoRltmMesureDnsty?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`대기질 조회 실패: ${response.status}`);
    }

    const data: AirQualityResponse = await response.json();

    if (data.response.header.resultCode !== '00') {
      console.error(`API 오류: ${data.response.header.resultMsg}`);
      return null;
    }

    if (!data.response.body.items || data.response.body.items.length === 0) {
      return null;
    }

    return data.response.body.items[0];
  } catch (error) {
    console.error('[AirKorea API] Error fetching station air quality:', error);
    return null;
  }
};

/**
 * 지역명으로 대기질 정보를 조회합니다.
 * 시도별 대기질 API를 사용하여 경기도 전체 데이터를 가져온 후
 * 요청 지역에서 가장 가까운 측정소 데이터를 반환합니다.
 */
export const getAirQuality = async (locationName: string): Promise<AirQualityData> => {
  if (!SERVICE_KEY) {
    throw new Error('에어코리아 API 키가 설정되지 않았습니다. .env.local에 VITE_AIRKOREA_SERVICE_KEY를 추가하세요.');
  }

  // 지역명 정규화
  const normalizedName = locationName.replace(/시$|군$/g, '').trim();
  const coords = LOCATION_COORDINATES[normalizedName] || LOCATION_COORDINATES[locationName];

  if (!coords) {
    throw new Error(`'${locationName}' 지역을 찾을 수 없습니다. 경기도 내 시군구만 지원됩니다.`);
  }

  console.log(`[AirKorea API] Looking for station near ${locationName} (${coords.lat}, ${coords.lng})`);

  // 가장 가까운 측정소의 대기질 데이터 찾기
  const { item: airQualityRaw, coords: stationCoords } = await findNearestStationAirQuality(coords.lat, coords.lng);

  // 파싱 헬퍼
  const parseValue = (value: string | null | undefined): number => {
    if (!value || value === '-') return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const parseGrade = (grade: string | null | undefined): AirQualityGrade => {
    const gradeNum = parseInt(grade || '1');
    if (gradeNum >= 1 && gradeNum <= 4) return gradeNum as AirQualityGrade;
    return AirQualityGrade.GOOD;
  };

  const result: AirQualityData = {
    stationName: airQualityRaw.stationName,
    locationName,
    measureTime: airQualityRaw.dataTime,
    lat: stationCoords.lat,
    lng: stationCoords.lng,
    khaiValue: parseValue(airQualityRaw.khaiValue),
    khaiGrade: parseGrade(airQualityRaw.khaiGrade),
    pm10Value: parseValue(airQualityRaw.pm10Value),
    pm10Grade: parseGrade(airQualityRaw.pm10Grade),
    pm10Grade1h: parseGrade(airQualityRaw.pm10Grade1h),
    pm25Value: parseValue(airQualityRaw.pm25Value),
    pm25Grade: parseGrade(airQualityRaw.pm25Grade),
    pm25Grade1h: parseGrade(airQualityRaw.pm25Grade1h),
    so2Value: parseValue(airQualityRaw.so2Value),
    coValue: parseValue(airQualityRaw.coValue),
    o3Value: parseValue(airQualityRaw.o3Value),
    no2Value: parseValue(airQualityRaw.no2Value),
    pm10Flag: airQualityRaw.pm10Flag,
    pm25Flag: airQualityRaw.pm25Flag
  };

  console.log('[AirKorea API] Air quality data:', result);
  return result;
};
