
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
  // 지역 필터링을 위한 지역명 및 시군구 코드
  locationName?: string;
  districtCode?: string;
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
  // 레이어의 실제 위치 데이터 (GeoJSON FeatureCollection)
  geoJson?: any;
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
}

export interface MapAction {
  type: 'ZOOM_TO' | 'ADD_LAYER' | 'REMOVE_LAYER' | 'HIGHLIGHT_AREA';
  payload: any;
}
