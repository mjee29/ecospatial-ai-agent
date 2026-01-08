
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
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface MapAction {
  type: 'ZOOM_TO' | 'ADD_LAYER' | 'REMOVE_LAYER' | 'HIGHLIGHT_AREA';
  payload: any;
}
