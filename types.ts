
export enum ClimateLayerType {
  FLOOD_RISK = 'flood_risk',
  HEATWAVE_VULNERABILITY = 'heatwave',
  ELDERLY_POPULATION = 'elderly',
  GREEN_SPACE = 'parks',
  AIR_QUALITY = 'air_quality'
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
    totalPopulation: number;
    elderlyPopulation: number;
    elderlyRatio: number;
    sixtyCount: number;
    seventyPlusCount: number;
    avgAge: number;
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
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  // 메시지에 고령인구 데이터 포함 가능
  elderlyData?: {
    districtName: string;
    totalPopulation: number;
    elderlyPopulation: number;
    elderlyRatio: number;
    sixtyCount: number;
    seventyPlusCount: number;
    avgAge: number;
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
