
export enum ClimateLayerType {
  FLOOD_RISK = 'flood_risk',
  ELDERLY_POPULATION = 'elderly',
  GREEN_SPACE = 'parks',
  AIR_QUALITY = 'air_quality',
  WEATHER = 'weather'
}

export interface MapViewState {
  center: [number, number];
  zoom: number;
}

export interface ActiveLayer {
  id: string;
  type: ClimateLayerType;
  opacity: number;
  visible: boolean;
  filter?: string;
  // SGIS 고령인구 데이터 (ELDERLY_POPULATION 레이어에만 적용)
  elderlyData?: {
    districtName: string;
    seventyPlusCount: number; // 70대 이상 인구수
    seventyPlusRatio: number; // 70대 이상 인구비율
  };
  // 에어코리아 대기질 데이터 (AIR_QUALITY 레이어에만 적용)
  airQualityData?: {
    stationName: string;
    locationName: string;
    measureTime: string;
    // 측정소 좌표
    lat: number;
    lng: number;
    khaiValue: number;
    khaiGrade: number;
    pm10Value: number;
    pm10Grade: number;
    pm25Value: number;
    pm25Grade: number;
    so2Value: number;
    coValue: number;
    o3Value: number;
    no2Value: number;
  };
  // 경기도 AWS 기상관측 데이터 (WEATHER 레이어에만 적용)
  weatherData?: {
    sigun: string;
    station: string;
    datetime: string;
    lat: number;
    lon: number;
    temperature_c: number;
    humidity_pct: number;
    wind_speed_ms: number;
    wind_direction_deg: number;
    heat_index: number | null;
    wind_chill: number | null;
  };
  // 녹지 비오톱 데이터 (GREEN_SPACE 레이어에만 적용)
  greenSpaceData?: {
    sggName: string;           // 시군구명
    totalBiotArea: number;     // 총 비오톱 면적 (㎡)
    featureCount: number;      // 피처 개수
    classifications: Array<{
      lclsfNm: string;         // 대분류명
      mclsfNm: string;         // 중분류명
      sclsfNm: string;         // 소분류명
      dclsfNm: string;         // 세분류명
      biotArea: number;        // 비오톱 면적 (㎡)
    }>;
  };
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  // 메시지에 고령인구 데이터 포함 가능
  elderlyData?: {
    districtName: string;
    seventyPlusCount: number; // 70대 이상 인구수
    seventyPlusRatio: number; // 70대 이상 인구비율
  };
  // 메시지에 대기질 데이터 포함 가능
  airQualityData?: {
    stationName: string;
    locationName: string;
    measureTime: string;
    khaiValue: number;
    khaiGrade: number;
    pm10Value: number;
    pm10Grade: number;
    pm25Value: number;
    pm25Grade: number;
  };
}

export interface MapAction {
  type: 'ZOOM_TO' | 'ADD_LAYER' | 'REMOVE_LAYER' | 'HIGHLIGHT_AREA';
  payload: any;
}

// 경기도 AWS 기상관측 데이터 (WEATHER 레이어에 적용)
export interface WeatherData {
  sigun: string;               // 시군명
  station: string;             // 관측지점명
  stationId: string;           // 관측지점번호
  datetime: string;            // 관측 일시
  lat: number;                 // 위도
  lon: number;                 // 경도
  temperature_c: number;       // 기온 (℃)
  humidity_pct: number;        // 습도 (%)
  wind_speed_ms: number;       // 풍속 (m/s)
  wind_direction_deg: number;  // 풍향 (deg)
  heat_index: number | null;   // 열지수 (체감온도 - 여름)
  wind_chill: number | null;   // 체감온도 (겨울)
}
