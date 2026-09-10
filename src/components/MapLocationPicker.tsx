import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  MapPin,
  Navigation,
  Search,
  Loader2,
  Compass,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface MapLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  searchAddressQuery?: string;
  addressComponents?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    stateUf?: string;
    zipCode?: string;
  };
  disabled?: boolean;
}

// Centro geográfico do Brasil e zoom inicial para visão nacional
export const BRAZIL_CENTER: [number, number] = [-14.235004, -51.92528];
export const BRAZIL_ZOOM = 4;

// Custom crisp SVG Pin Icon to prevent any missing asset issues
const createPinIcon = () => {
  return L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="position: relative; width: 36px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" width="36" height="44" fill="none" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
          <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7 13 8 14 1-1 8-8.75 8-14 0-4.42-3.58-8-8-8z" fill="#F28322" />
          <path d="M12 2C8.69 2 6 4.69 6 8c0 4.2 5.3 10.7 6 11.5.7-.8 6-7.3 6-11.5 0-3.31-2.69-6-6-6z" fill="#D96E14" />
          <circle cx="12" cy="8" r="3.5" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="2" fill="#171F26" />
        </svg>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
};

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  searchAddressQuery = "",
  addressComponents,
  disabled = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const [geocoding, setGeocoding] = useState(false);
  const [geoFeedback, setGeoFeedback] = useState<{ type: "success" | "warning" | "error"; message: string } | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [customSearchText, setCustomSearchText] = useState("");

  const hasValidCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    !(latitude === 0 && longitude === 0);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialCenter: [number, number] = hasValidCoordinates
        ? [latitude, longitude]
        : BRAZIL_CENTER;
      const initialZoom = hasValidCoordinates ? 16 : BRAZIL_ZOOM;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Setup marker
      const markerPosition: [number, number] = hasValidCoordinates
        ? [latitude, longitude]
        : BRAZIL_CENTER;

      const marker = L.marker(markerPosition, {
        icon: createPinIcon(),
        draggable: !disabledRef.current,
        opacity: hasValidCoordinates ? 1 : 0.7, // Subtle if at national default
      }).addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        const lat = Number(pos.lat.toFixed(6));
        const lng = Number(pos.lng.toFixed(6));
        marker.setOpacity(1);
        onChangeRef.current(lat, lng);
        setGeoFeedback({
          type: "success",
          message: `Marcador ajustado manualmente (${lat}, ${lng}).`,
        });
      });

      map.on("click", (e: L.LeafletMouseEvent) => {
        if (disabledRef.current) return;
        const { lat, lng } = e.latlng;
        const formattedLat = Number(lat.toFixed(6));
        const formattedLng = Number(lng.toFixed(6));
        marker.setLatLng([lat, lng]);
        marker.setOpacity(1);
        onChangeRef.current(formattedLat, formattedLng);
        setGeoFeedback({
          type: "success",
          message: `Ponto selecionado no mapa (${formattedLat}, ${formattedLng}).`,
        });
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Ensure proper sizing in tab containers and dialogs
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Dynamically toggle marker dragging when disabled prop changes
  useEffect(() => {
    if (markerRef.current) {
      if (disabled) {
        markerRef.current.dragging?.disable();
      } else {
        markerRef.current.dragging?.enable();
      }
    }
  }, [disabled]);

  // Update marker position and map center when props change from external inputs
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    if (hasValidCoordinates) {
      const newLatLng = L.latLng(latitude, longitude);
      markerRef.current.setLatLng(newLatLng);
      markerRef.current.setOpacity(1);
      const currentCenter = mapInstanceRef.current.getCenter();
      if (currentCenter.distanceTo(newLatLng) > 100) {
        mapInstanceRef.current.flyTo(newLatLng, 16, { duration: 1 });
      }
    }
  }, [latitude, longitude, hasValidCoordinates]);

  // Reset view to whole Brazil
  const handleResetToBrazil = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(BRAZIL_CENTER, BRAZIL_ZOOM, { duration: 1.2 });
    setGeoFeedback({
      type: "warning",
      message: "Visão geral do Brasil. Busque um endereço ou clique no mapa para posicionar a barbearia.",
    });
  };

  /**
   * Progressive Geocoding Engine for Brazil:
   * 1. Full address (Street, Number, Neighborhood, City, State, Brasil)
   * 2. Street without number (Street, Neighborhood, City, State, Brasil)
   * 3. Street + City + State, Brasil
   * 4. CEP search in Brazil
   * 5. Neighborhood + City + State, Brasil
   * 6. City + State, Brasil
   * 7. State, Brasil
   */
  const executeProgressiveGeocode = async (
    targetQuery?: string
  ): Promise<{ lat: number; lng: number; zoom: number; matchType: string } | null> => {
    const fetchNominatim = async (queryText: string): Promise<{ lat: number; lon: string } | null> => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&limit=1&q=${encodeURIComponent(
          queryText
        )}`;
        const res = await fetch(url, {
          headers: {
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
        });
        if (!res.ok) return null;
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          return { lat: parseFloat(list[0].lat), lon: list[0].lon };
        }
      } catch (err) {
        console.warn("Nominatim fetch error for query:", queryText, err);
      }
      return null;
    };

    // If a custom search string was provided (from input box)
    if (targetQuery && targetQuery.trim()) {
      const q = targetQuery.trim();
      const withBr = q.toLowerCase().includes("brasil") ? q : `${q}, Brasil`;
      const res = await fetchNominatim(withBr);
      if (res) {
        return {
          lat: res.lat,
          lng: parseFloat(res.lon),
          zoom: 16,
          matchType: "busca personalizada",
        };
      }
    }

    // Deconstruct structured address components if available
    const street = addressComponents?.street?.trim() || "";
    const num = addressComponents?.number?.trim() || "";
    const neigh = addressComponents?.neighborhood?.trim() || "";
    const city = addressComponents?.city?.trim() || "";
    const uf = addressComponents?.stateUf?.trim() || "";
    const cep = addressComponents?.zipCode?.replace(/\D/g, "") || "";

    // Candidate 1: Full address with number
    if (street && num && city) {
      const q1 = [street, num, neigh, city, uf, "Brasil"].filter(Boolean).join(", ");
      const res1 = await fetchNominatim(q1);
      if (res1) {
        return { lat: res1.lat, lng: parseFloat(res1.lon), zoom: 17, matchType: "endereço exato com número" };
      }
    }

    // Candidate 2: Street without number + Neighborhood + City
    if (street && city) {
      const q2 = [street, neigh, city, uf, "Brasil"].filter(Boolean).join(", ");
      const res2 = await fetchNominatim(q2);
      if (res2) {
        return { lat: res2.lat, lng: parseFloat(res2.lon), zoom: 16, matchType: "rua e bairro mais próximos" };
      }
    }

    // Candidate 3: Street + City
    if (street && city) {
      const q3 = `${street}, ${city}, ${uf || ""}, Brasil`;
      const res3 = await fetchNominatim(q3);
      if (res3) {
        return { lat: res3.lat, lng: parseFloat(res3.lon), zoom: 16, matchType: "rua mais próxima" };
      }
    }

    // Candidate 4: CEP
    if (cep && cep.length === 8) {
      const qCep = `${cep}, Brasil`;
      const resCep = await fetchNominatim(qCep);
      if (resCep) {
        return { lat: resCep.lat, lng: parseFloat(resCep.lon), zoom: 16, matchType: "CEP" };
      }
    }

    // Candidate 5: Neighborhood + City
    if (neigh && city) {
      const q5 = `${neigh}, ${city}, ${uf || ""}, Brasil`;
      const res5 = await fetchNominatim(q5);
      if (res5) {
        return { lat: res5.lat, lng: parseFloat(res5.lon), zoom: 15, matchType: "bairro mais próximo" };
      }
    }

    // Candidate 6: City + UF
    if (city) {
      const q6 = `${city}, ${uf || ""}, Brasil`;
      const res6 = await fetchNominatim(q6);
      if (res6) {
        return { lat: res6.lat, lng: parseFloat(res6.lon), zoom: 13, matchType: "cidade" };
      }
    }

    // Fallback: simple text query passed via searchAddressQuery
    if (searchAddressQuery && searchAddressQuery.trim().length >= 3) {
      const qRaw = searchAddressQuery.toLowerCase().includes("brasil")
        ? searchAddressQuery
        : `${searchAddressQuery}, Brasil`;
      const resRaw = await fetchNominatim(qRaw);
      if (resRaw) {
        return { lat: resRaw.lat, lng: parseFloat(resRaw.lon), zoom: 15, matchType: "endereço aproximado" };
      }
    }

    return null;
  };

  // Perform geocode and apply to map
  const handleSearchAddress = async (overrideQuery?: string) => {
    setGeocoding(true);
    setGeoFeedback(null);

    try {
      const result = await executeProgressiveGeocode(overrideQuery || customSearchText);

      if (result) {
        const lat = Number(result.lat.toFixed(6));
        const lng = Number(result.lng.toFixed(6));

        onChange(lat, lng);

        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          markerRef.current.setOpacity(1);
          mapInstanceRef.current.flyTo([lat, lng], result.zoom, { duration: 1.2 });
        }

        if (result.matchType === "endereço exato com número") {
          setGeoFeedback({
            type: "success",
            message: "Endereço exato localizado no mapa com sucesso!",
          });
        } else {
          setGeoFeedback({
            type: "warning",
            message: `Localizamos o ponto mais próximo (${result.matchType}). Arraste o pino para ajustar a entrada exata da sua barbearia.`,
          });
        }
      } else {
        setGeoFeedback({
          type: "error",
          message:
            "Não foi possível encontrar este endereço no mapa. Digite a rua/cidade na caixa de busca ou clique diretamente no mapa para marcar o ponto.",
        });
      }
    } catch (err) {
      console.warn("Geocoding execution error:", err);
      setGeoFeedback({
        type: "error",
        message: "Falha na busca de endereço. Posicione o marcador manualmente clicando no mapa.",
      });
    } finally {
      setGeocoding(false);
    }
  };

  // Get current device GPS location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoFeedback({
        type: "error",
        message: "Geolocalização não suportada neste navegador.",
      });
      return;
    }

    setLocatingUser(true);
    setGeoFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        onChange(lat, lng);

        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          markerRef.current.setOpacity(1);
          mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
        }
        setLocatingUser(false);
        setGeoFeedback({
          type: "success",
          message: "Localização GPS do seu dispositivo detectada com sucesso!",
        });
      },
      (err) => {
        console.warn("GPS error:", err);
        setLocatingUser(false);
        setGeoFeedback({
          type: "warning",
          message: "Não foi possível obter o GPS atual. Digite o endereço ou clique diretamente no mapa.",
        });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const googleMapsUrl = hasValidCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : null;

  return (
    <div className="space-y-3">
      {/* Search and Action Bar */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Custom Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              disabled={disabled || geocoding}
              value={customSearchText}
              onChange={(e) => setCustomSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchAddress(customSearchText);
                }
              }}
              placeholder="Buscar endereço ou cidade no Brasil (ex: Av. Paulista, 1000 ou seu CEP)..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-accent font-medium shadow-inner"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleSearchAddress(customSearchText)}
              disabled={geocoding || disabled}
              className="px-3 py-2 rounded-lg bg-accent hover:bg-accent/90 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Buscar no Mapa</span>
            </button>

            {searchAddressQuery && (
              <button
                type="button"
                onClick={() => handleSearchAddress()}
                disabled={geocoding || disabled}
                className="px-2.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1 border border-slate-300 transition shadow-sm disabled:opacity-50"
                title="Buscar o endereço preenchido nos campos acima"
              >
                <MapPin className="w-3.5 h-3.5 text-accent" />
                <span className="hidden md:inline">Buscar Endereço Acima</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetToBrazil}
              disabled={disabled}
              className="px-2.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1 border border-slate-300 transition shadow-sm"
              title="Voltar para visão geral do Brasil"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Ver Brasil</span>
            </button>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locatingUser || disabled}
              className="px-2.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1 border border-slate-300 transition shadow-sm"
              title="Usar GPS atual do aparelho"
            >
              {locatingUser ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span className="hidden sm:inline">Meu GPS</span>
            </button>
          </div>
        </div>

        {/* Status Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-200">
          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
            {hasValidCoordinates ? (
              <span>
                Ponto GPS fixado: <strong>{latitude?.toFixed(5)}</strong>, <strong>{longitude?.toFixed(5)}</strong>
              </span>
            ) : (
              <span className="text-slate-500">
                Iniciando pelo Brasil. Busque seu endereço ou clique no mapa para posicionar o pino.
              </span>
            )}
          </div>

          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1"
            >
              <span>Ver no Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Dynamic Geocoding Feedback Banner */}
      {geoFeedback && (
        <div
          className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 animate-fadeIn ${
            geoFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium"
              : geoFeedback.type === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {geoFeedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : geoFeedback.type === "warning" ? (
            <Compass className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span className="leading-snug">{geoFeedback.message}</span>
        </div>
      )}

      {/* Interactive Leaflet Map */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-300 shadow-sm bg-slate-100 h-72 sm:h-80 w-full z-0">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Helpful Instructions */}
      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
        <span>
          💡 <strong>Dica:</strong> Você pode <strong>arrastar o pino</strong> ou <strong>clicar em qualquer lugar</strong> do mapa para fixar a entrada exata da barbearia.
        </span>
        <span className="hidden sm:inline font-mono text-slate-400">OSM Brasil</span>
      </div>
    </div>
  );
};
