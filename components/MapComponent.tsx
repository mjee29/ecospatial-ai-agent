
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMap, Popup, Circle } from 'react-leaflet';
import { ActiveLayer } from '../types';
import { INITIAL_VIEW, LAYER_METADATA, GYEONGGI_WMS_URL } from '../constants';
import { Loader2, Layers } from 'lucide-react';

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
        className="z-10 grayscale-[0.2] contrast-[1.1]"
      >
        {/* TileLayer component used via any-cast to avoid incorrect 'attribution' property missing error */}
        <TileLayerAny
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        <MapViewUpdater center={viewState.center} zoom={viewState.zoom} />

        {activeLayers.filter(l => l.visible).map(layer => {
          const metadata = LAYER_METADATA[layer.type];
          return (
            /* WMSTileLayer component used via any-cast to avoid incorrect 'opacity' property missing error */
            <WMSTileLayerAny
              key={layer.id}
              url={GYEONGGI_WMS_URL}
              params={{
                layers: metadata.wmsLayer,
                format: 'image/png',
                transparent: true,
                version: '1.3.0',
              }}
              opacity={layer.opacity}
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
            
            <div className="space-y-3">
              {activeLayers.filter(l => l.visible).map(l => (
                <div key={l.id} className="flex items-center gap-4 p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div 
                    className="w-4 h-4 rounded-full shadow-inner ring-4 ring-white shadow-black/10 shrink-0" 
                    style={{ backgroundColor: LAYER_METADATA[l.type].color }} 
                  />
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-slate-800 leading-tight">{LAYER_METADATA[l.type].name}</span>
                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">WMS Layer Active</span>
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
