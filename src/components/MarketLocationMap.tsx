import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  lat?: number | null;
  lng?: number | null;
  label?: string | null;
  fallbackCity?: string | null;
}

// Default to Lisbon if no coordinates
const DEFAULT_COORDS: Record<string, [number, number]> = {
  lisboa: [38.7223, -9.1393],
  porto: [41.1579, -8.6291],
  coimbra: [40.2110, -8.4291],
  braga: [41.5454, -8.4265],
  faro: [37.0194, -7.9304],
  aveiro: [40.6443, -8.6455],
  setubal: [38.5244, -8.8882],
  funchal: [32.6669, -16.9241],
  evora: [38.5667, -7.9000],
  viseu: [40.6610, -7.9097],
};

function resolveCoords(city?: string | null): [number, number] {
  if (!city) return DEFAULT_COORDS.lisboa;
  const norm = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [k, v] of Object.entries(DEFAULT_COORDS)) {
    if (norm.includes(k)) return v;
  }
  return DEFAULT_COORDS.lisboa;
}

export default function MarketLocationMap({ lat, lng, label, fallbackCity }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    let coords: [number, number];
    let isApprox = false;
    if (typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)) {
      coords = [lat, lng];
    } else {
      coords = resolveCoords(fallbackCity);
      isApprox = true;
    }

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(ref.current, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    }).setView(coords, isApprox ? 11 : 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 18,
    }).addTo(map);

    // Aproximate area as a circle if we don't have exact coords
    if (isApprox) {
      L.circle(coords, {
        radius: 4000,
        color: "#f59e0b",
        fillColor: "#f59e0b",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
    } else {
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:#f59e0b;border:3px solid white;width:18px;height:18px;border-radius:50%;box-shadow:0 0 0 2px #f59e0b80, 0 4px 12px rgba(0,0,0,.3)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker(coords, { icon }).addTo(map);
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, fallbackCity]);

  const isApprox = !(typeof lat === "number" && typeof lng === "number");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="h-4 w-4 text-amber-500" />
          {label || fallbackCity || "Localização"}
        </div>
        {isApprox && (
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Localização aproximada
          </span>
        )}
      </div>
      <div ref={ref} className="w-full h-56 rounded-lg overflow-hidden border" />
      <p className="text-[10px] text-muted-foreground">
        Localização exata partilhada após pagamento protegido.
      </p>
    </div>
  );
}
