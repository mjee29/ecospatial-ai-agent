
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ActiveLayer } from '../types';
import { INITIAL_VIEW, LAYER_METADATA, GYEONGGI_WMS_BASE_URL } from '../constants';
import { Loader2, Layers, Wind } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// 대기질 등급별 마커 아이콘 생성
const createAirQualityIcon = (grade: number) => {
  const colors: Record<number, string> = {
    1: '#3b82f6', // 좋음 - 파랑
    2: '#22c55e', // 보통 - 초록
    3: '#f59e0b', // 나쁨 - 주황
    4: '#ef4444', // 매우나쁨 - 빨강
  };
  const color = colors[grade] || '#9ca3af';

  return L.divIcon({
    className: 'custom-air-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
          <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
          <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

// 경기도 기후플랫폼 API 키
const GG_CLIMATE_API_KEY = import.meta.env.VITE_GG_CLIMATE_API_KEY;

const MapViewUpdater = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.5 });
  }, [center, zoom, map]);
  return null;
};

interface MapComponentProps {
  activeLayers: ActiveLayer[];
  viewState: { center: [number, number], zoom: number };
}

const MapComponent: React.FC<MapComponentProps> = ({ activeLayers, viewState }) => {
  const [mapLoading, setMapLoading] = useState(false);

  useEffect(() => {
    if (activeLayers.length > 0) {
      setMapLoading(true);
      const timer = setTimeout(() => setMapLoading(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [activeLayers]);

  // 대기질 등급별 색상 및 레이블
  const getAirQualityGradeInfo = (grade: number) => {
    switch (grade) {
      case 1: return { label: '좋음', color: '#3b82f6', bgColor: 'bg-blue-500' };
      case 2: return { label: '보통', color: '#22c55e', bgColor: 'bg-green-500' };
      case 3: return { label: '나쁨', color: '#f59e0b', bgColor: 'bg-orange-500' };
      case 4: return { label: '매우나쁨', color: '#ef4444', bgColor: 'bg-red-500' };
      default: return { label: '알 수 없음', color: '#9ca3af', bgColor: 'bg-gray-400' };
    }
  };

  // Dev-time console trace to verify the GG climate key is available at runtime
  useEffect(() => {
    console.log('[Map] VITE_GG_CLIMATE_API_KEY present:', GG_CLIMATE_API_KEY ? 'yes' : 'no');
  }, [GG_CLIMATE_API_KEY]);

  // Cast components to any to resolve property-not-found type errors which often occur with react-leaflet types in certain build environments
  const MapContainerAny = MapContainer as any;
  const TileLayerAny = TileLayer as any;
  const WMSTileLayerAny = WMSTileLayer as any;

  return (
    <div className="w-full h-full relative group">
      {mapLoading && (
        <div className="absolute inset-0 z-[2000] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center transition-all duration-500">
          <div className="bg-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="relative">
              <Loader2 className="animate-spin text-indigo-600" size={24} />
              <div className="absolute inset-0 bg-indigo-600/20 blur-lg animate-pulse" />
            </div>
            <span className="font-bold text-slate-800 tracking-tight">GeoSpatial Data Loading...</span>
          </div>
        </div>
      )}

      {/* MapContainer component used via any-cast to avoid incorrect 'center' property missing error */}
      <MapContainerAny
        center={INITIAL_VIEW}
        zoom={12}
        zoomControl={false}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="z-10"
      >
        {/* TileLayer component used via any-cast to avoid incorrect 'attribution' property missing error */}
        <TileLayerAny
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        <MapViewUpdater center={viewState.center} zoom={viewState.zoom} />

        {activeLayers.filter(l => l.visible).map(layer => {
          const metadata = LAYER_METADATA[layer.type];

          // AIR_QUALITY 레이어는 WMS를 사용하지 않고 마커로 표시
          if (layer.type === 'air_quality') {
            if (layer.airQualityData) {
              const data = layer.airQualityData;
              const MarkerAny = Marker as any;
              const PopupAny = Popup as any;
              const gradeInfo = getAirQualityGradeInfo(data.khaiGrade);

              return (
                <MarkerAny
                  key={layer.id}
                  position={[data.lat, data.lng]}
                  icon={createAirQualityIcon(data.khaiGrade)}
                >
                  <PopupAny>
                    <div className="p-2 min-w-[180px]">
                      <h4 className="font-bold text-sm mb-2">{data.stationName} 측정소</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>통합지수:</span>
                          <span className="font-bold" style={{ color: gradeInfo.color }}>
                            {data.khaiValue} ({gradeInfo.label})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>PM10:</span>
                          <span className="font-bold">{data.pm10Value} μg/m³</span>
                        </div>
                        <div className="flex justify-between">
                          <span>PM2.5:</span>
                          <span className="font-bold">{data.pm25Value} μg/m³</span>
                        </div>
                        <div className="text-[10px] text-gray-500 pt-1 border-t">
                          {data.measureTime}
                        </div>
                      </div>
                    </div>
                  </PopupAny>
                </MarkerAny>
              );
            }
            return null;
          }

          // API 키를 요청 파라미터에 포함
          const wmsUrl = GYEONGGI_WMS_BASE_URL;
          console.log('[WMS] Loading layer:', metadata.wmsLayer, 'URL:', wmsUrl);
          return (
            /* WMSTileLayer component - 경기도 기후플랫폼 GeoServer WMS */
            <WMSTileLayerAny
              key={layer.id}
              url={wmsUrl}
              params={{
                SERVICE: 'WMS',
                REQUEST: 'GetMap',
                VERSION: '1.3.0',
                FORMAT: 'image/png',
                STYLES: '',
                TRANSPARENT: 'TRUE',
                LAYERS: metadata.wmsLayer,
                TILED: true,
                CRS: 'EPSG:3857',
                FORMAT_OPTIONS: 'dpi:68',
                apiKey: GG_CLIMATE_API_KEY
              }}
              opacity={layer.opacity}
              eventHandlers={{
                loading: () => console.log('[WMS] Loading started:', metadata.wmsLayer),
                load: () => console.log('[WMS] Load complete:', metadata.wmsLayer),
                tileerror: (e: any) => console.error('[WMS] Tile error:', metadata.wmsLayer, e)
              }}
            />
          );
        })}

        {/* Air Quality Data Card - Top Right */}
        {activeLayers.filter(l => l.visible && l.type === 'air_quality' && l.airQualityData).map(layer => {
          const data = layer.airQualityData!;
          const khaiInfo = getAirQualityGradeInfo(data.khaiGrade);
          const pm10Info = getAirQualityGradeInfo(data.pm10Grade);
          const pm25Info = getAirQualityGradeInfo(data.pm25Grade);

          return (
            <div key={layer.id} className="absolute top-8 right-8 z-[1000] w-[320px] animate-in slide-in-from-top-4 duration-500">
              <div className="bg-white/95 backdrop-blur-md rounded-[28px] shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className={`${khaiInfo.bgColor} px-6 py-4 text-white`}>
                  <div className="flex items-center gap-3">
                    <Wind size={24} strokeWidth={2.5} />
                    <div>
                      <h3 className="font-black text-lg leading-tight">실시간 대기질</h3>
                      <p className="text-xs opacity-90 font-medium">{data.stationName} 측정소</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  {/* 통합대기환경지수 */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">통합지수 (KHAI)</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">{data.khaiValue}</p>
                    </div>
                    <div className={`px-4 py-2 ${khaiInfo.bgColor} text-white rounded-xl font-bold text-sm shadow-lg`}>
                      {khaiInfo.label}
                    </div>
                  </div>

                  {/* PM10 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${pm10Info.bgColor}`} />
                      <div>
                        <p className="text-xs font-bold text-slate-500">PM10 (미세먼지)</p>
                        <p className="text-lg font-black text-slate-900">{data.pm10Value} μg/m³</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 px-3 py-1 bg-slate-100 rounded-lg">
                      {pm10Info.label}
                    </span>
                  </div>

                  {/* PM2.5 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${pm25Info.bgColor}`} />
                      <div>
                        <p className="text-xs font-bold text-slate-500">PM2.5 (초미세먼지)</p>
                        <p className="text-lg font-black text-slate-900">{data.pm25Value} μg/m³</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 px-3 py-1 bg-slate-100 rounded-lg">
                      {pm25Info.label}
                    </span>
                  </div>

                  {/* 기타 오염물질 */}
                  <div className="pt-3 border-t border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">기타 오염물질</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">오존 (O₃)</span>
                        <span className="font-bold text-slate-900">{data.o3Value.toFixed(3)} ppm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">NO₂</span>
                        <span className="font-bold text-slate-900">{data.no2Value.toFixed(3)} ppm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">SO₂</span>
                        <span className="font-bold text-slate-900">{data.so2Value.toFixed(3)} ppm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">CO</span>
                        <span className="font-bold text-slate-900">{data.coValue.toFixed(1)} ppm</span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-center pt-2">
                    <p className="text-[10px] text-slate-400 font-medium">
                      측정시간: {data.measureTime}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Legend Overlay */}
        <div className="absolute bottom-8 left-8 z-[1000] transition-transform duration-300 group-hover:scale-105">
          <div className="bg-white/95 backdrop-blur-md p-6 rounded-[32px] shadow-2xl border border-slate-200 min-w-[240px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400">
                <Layers size={16} />
              </div>
              <h4 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-400">Data Legend</h4>
            </div>

            <div className="space-y-3">
              {activeLayers.filter(l => l.visible).map(l => {
                const isApiLayer = l.type === 'air_quality' || l.type === 'elderly';
                const layerTypeLabel = isApiLayer ? 'API Layer Active' : 'WMS Layer Active';

                return (
                  <div key={l.id} className="flex items-center gap-4 p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                    <div
                      className="w-4 h-4 rounded-full shadow-inner ring-4 ring-white shadow-black/10 shrink-0"
                      style={{ backgroundColor: LAYER_METADATA[l.type].color }}
                    />
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-slate-800 leading-tight">{LAYER_METADATA[l.type].name}</span>
                      <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">{layerTypeLabel}</span>
                    </div>
                  </div>
                );
              })}
              {activeLayers.filter(l => l.visible).length === 0 && (
                <div className="py-4 text-center">
                  <p className="text-[11px] font-bold text-slate-300 uppercase leading-relaxed tracking-wide">
                    No layers active.<br/>Ask AI to visualize risks.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </MapContainerAny>
    </div>
  );
};

export default MapComponent;
