import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { MapPin, Navigation, ExternalLink } from "lucide-react";

interface MapLocationViewerProps {
  latitude: number;
  longitude: number;
  title?: string;
  addressText?: string;
}

const createPinIcon = () => {
  return L.divIcon({
    className: "custom-map-marker-view",
    html: `
      <div style="position: relative; width: 34px; height: 42px; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" width="34" height="42" fill="none" style="filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5));">
          <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7 13 8 14 1-1 8-8.75 8-14 0-4.42-3.58-8-8-8z" fill="#F28322" />
          <circle cx="12" cy="8" r="3.5" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="2" fill="#171F26" />
        </svg>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -42],
  });
};

export const MapLocationViewer: React.FC<MapLocationViewerProps> = ({
  latitude,
  longitude,
  title,
  addressText,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const wazeUrl = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 16,
        zoomControl: true,
        dragging: !L.Browser.mobile,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([latitude, longitude], {
        icon: createPinIcon(),
      }).addTo(map);

      if (title) {
        marker.bindPopup(`<strong>${title}</strong><br/>${addressText || ""}`).openPopup();
      }

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, title, addressText]);

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-800/80 shadow-md">
      <div className="h-44 w-full relative z-0">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="text-xs text-slate-300 flex items-start gap-1.5">
          <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <span className="leading-snug">{addressText || "Localização da Barbearia"}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition"
          >
            <Navigation className="w-3.5 h-3.5 text-accent" />
            <span>Google Maps</span>
            <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
          </a>
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 text-xs font-semibold flex items-center gap-1 transition"
          >
            <span>Waze</span>
            <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
