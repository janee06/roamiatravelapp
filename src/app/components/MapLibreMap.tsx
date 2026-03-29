"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css"; 

export interface Tip {
  id: string;
  name: string;
  location: string;
  lat?: number | null | string;
  lng?: number | null | string;
}

interface MapProps {
  center: [number, number];
  zoom: number;
  tips: Tip[];
  userLocation?: [number, number];
}

const MapLibreMap: React.FC<MapProps> = ({ center, zoom, tips, userLocation }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // ---- INIT MAP ----
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "raster-tiles": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "raster-tiles",
          },
        ],
      },
      center: center,
      zoom: zoom,
      maxZoom: 19,
      pitchWithRotate: false,
      doubleClickZoom: false,
    });

    mapRef.current.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
      "top-right"
    );
  }, []);

 useEffect(() => {
  if (!mapRef.current || !center) return;

  const [lng, lat] = center;
  if (isNaN(lng) || isNaN(lat)) return;

  mapRef.current.flyTo({
    center: [lng, lat],
    zoom: 14,
    speed: 1.2,
    essential: true,
  });
}, [center]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Odstranit staré markery
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    tips.forEach((tip) => {
      const lat = Number(tip.lat);
      const lng = Number(tip.lng);
      if (!isFinite(lat) || !isFinite(lng)) return;

      const markerEl = document.createElement("div");
      markerEl.style.width = "20px";
      markerEl.style.height = "20px";
      markerEl.style.borderRadius = "50%";
      markerEl.style.backgroundColor = "#FF7F50";
      markerEl.style.border = "2px solid white";
      markerEl.style.boxShadow = "0 0 4px rgba(0,0,0,0.5)";

      const marker = new maplibregl.Marker({ element: markerEl, anchor: "center" })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(
          `<span style="color:black">${tip.name} • ${tip.location}</span>`
          )
        )
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [tips]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-[350px] sm:h-[500px] rounded-2xl overflow-hidden"
    ></div>
  );
};

export default MapLibreMap;