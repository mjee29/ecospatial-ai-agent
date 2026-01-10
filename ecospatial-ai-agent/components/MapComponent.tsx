
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMap } from 'react-leaflet';
import { ActiveLayer } from '../types';
import { INITIAL_VIEW, LAYER_METADATA, GYEONGGI_WMS_BASE_URL } from '../constants';
import { Loader2, Layers } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// 경기도 기후플랫폼 API 키
const GG_CLIMATE_API_KEY = import.meta.env.VITE_GG_CLIMATE_API_KEY;

const MapViewUpdater = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();

  // 지도 크기 문제 해결: 컨테이너 크기 변경 시 타일 다시 로드
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    // 초기 로드 시 invalidateSize 호출
    setTimeout(() => {
      map.invalidateSize();
    }, 300);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [map]);

  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.5 });
    // 뷰 변경 후에도 invalidateSize 호출
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
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
          // API 키를 요청 파라미터에 포함
          const wmsUrl = GYEONGGI_WMS_BASE_URL;

          // CQL_FILTER 생성 (지역 필터링)
          // 주의: 경기도 기후플랫폼 WMS가 CQL_FILTER를 지원하지 않을 수 있음
          // 지원 여부 확인 후 활성화 필요 (현재는 비활성화)
          // let cqlFilter: string | undefined;
          // if (layer.districtCode) {
          //   cqlFilter = `sigun_cd='${layer.districtCode}'`;
          // } else if (layer.locationName) {
          //   cqlFilter = `sigun_nm LIKE '%${layer.locationName.replace(/시$|군$/g, '')}%'`;
          // }
          const cqlFilter: string | undefined = undefined; // 임시 비활성화

          console.log('[WMS] Loading layer:', metadata.wmsLayer, 'URL:', wmsUrl, 'location:', layer.locationName || 'none');

          // WMS 요청 파라미터 구성
          const wmsParams: any = {
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
          };

          // CQL_FILTER가 있으면 추가 (GeoServer 지역 필터링)
          if (cqlFilter) {
            wmsParams.CQL_FILTER = cqlFilter;
          }

          return (
            /* WMSTileLayer component - 경기도 기후플랫폼 GeoServer WMS */
            <WMSTileLayerAny
              key={layer.id}
              url={wmsUrl}
              params={wmsParams}
              opacity={layer.opacity}
              eventHandlers={{
                loading: () => console.log('[WMS] Loading started:', metadata.wmsLayer),
                load: () => console.log('[WMS] Load complete:', metadata.wmsLayer),
                tileerror: (e: any) => console.error('[WMS] Tile error:', metadata.wmsLayer, e)
              }}
            />
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

            {/* 현재 선택된 지역 표시 */}
            {activeLayers.some(l => l.locationName) && (
              <div className="mb-3 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Region Focus</span>
                <p className="text-sm font-bold text-indigo-700 mt-0.5">
                  {activeLayers.find(l => l.locationName)?.locationName}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {activeLayers.filter(l => l.visible).map(l => (
                <div key={l.id} className="flex items-center gap-4 p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div
                    className="w-4 h-4 rounded-full shadow-inner ring-4 ring-white shadow-black/10 shrink-0"
                    style={{ backgroundColor: LAYER_METADATA[l.type].color }}
                  />
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-slate-800 leading-tight">{LAYER_METADATA[l.type].name}</span>
                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                      {l.locationName ? `${l.locationName} 지역` : 'WMS Layer Active'}
                    </span>
                  </div>
                </div>
              ))}
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
