"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell, ContextBar } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import type { AssetListItem } from "@/lib/types";

interface BootstrapCustomer {
  id: string;
  name: string;
}

interface GeotaggedAsset {
  id: string;
  equipmentType: string;
  customerName: string;
  latitude: number;
  longitude: number;
}

export default function MapsPage() {
  const [assets, setAssets] = useState<GeotaggedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mapElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const [assetsResponse, bootstrapResponse] = await Promise.all([
          fetch("/api/assets?limit=200", { cache: "no-store" }),
          fetch("/api/bootstrap", { cache: "no-store" })
        ]);

        if (!assetsResponse.ok) {
          throw new Error("Unable to load assets for the map.");
        }

        if (!bootstrapResponse.ok) {
          throw new Error("Unable to load customer context for the map.");
        }

        const assetsPayload = (await assetsResponse.json()) as {
          assets: AssetListItem[];
        };
        const bootstrapPayload = (await bootstrapResponse.json()) as {
          customers: BootstrapCustomer[];
        };

        const customerNamesById = new Map(
          (bootstrapPayload.customers ?? []).map((customer) => [customer.id, customer.name])
        );

        setAssets(
          (assetsPayload.assets ?? [])
            .filter(
              (asset) =>
                typeof asset.latitude === "number" && typeof asset.longitude === "number"
            )
            .map((asset) => ({
              id: asset.id,
              equipmentType: asset.equipment_type,
              customerName:
                customerNamesById.get(asset.sites?.customer_id ?? "") ?? "Unknown customer",
              latitude: asset.latitude as number,
              longitude: asset.longitude as number
            }))
        );
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load map data.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const summary = useMemo(() => {
    return `${assets.length} geotagged asset${assets.length === 1 ? "" : "s"}`;
  }, [assets.length]);

  useEffect(() => {
    if (!mapElementRef.current || !assets.length) {
      return;
    }

    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    void import("leaflet").then((L) => {
      if (cancelled || !mapElementRef.current) {
        return;
      }

      map = L.map(mapElementRef.current, {
        zoomControl: true,
        attributionControl: true
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const coordinates = assets.map((asset) => [asset.latitude, asset.longitude] as [number, number]);

      for (const asset of assets) {
        L.circleMarker([asset.latitude, asset.longitude], {
          radius: 8,
          color: "#6f7d36",
          weight: 2,
          fillColor: "#9fb457",
          fillOpacity: 0.82
        })
          .bindTooltip(asset.customerName, {
            direction: "top",
            sticky: true,
            opacity: 0.96
          })
          .addTo(map);
      }

      if (coordinates.length === 1) {
        map.setView(coordinates[0], 15);
        return;
      }

      map.fitBounds(L.latLngBounds(coordinates).pad(0.2), {
        padding: [24, 24]
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [assets]);

  return (
    <AppShell
      title="Maps"
      description="Overview of all assets that currently have captured geotags."
      contextBar={
        <ContextBar items={[{ label: "More", href: "/more" }, { label: "Maps" }]} />
      }
    >
      <section className="panel p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Geotagged assets
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Asset overview map</h2>
          </div>
          {!loading && !error && assets.length ? (
            <span className="pill bg-mist text-slate">{summary}</span>
          ) : null}
        </div>

        {error ? (
          <div className="mt-5">
            <EmptyState title="Map unavailable" body={error} />
          </div>
        ) : null}

        {!error && loading ? (
          <div className="mt-5">
            <EmptyState title="Loading map" body="Pulling geotagged assets into the overview." />
          </div>
        ) : null}

        {!error && !loading && !assets.length ? (
          <div className="mt-5">
            <EmptyState
              title="No geotagged assets yet"
              body="Capture location on an asset and it will appear here automatically."
            />
          </div>
        ) : null}

        {!error && !loading && assets.length ? (
          <div className="mt-5 overflow-hidden rounded-3xl border border-ink/10 bg-white">
            <div ref={mapElementRef} className="h-[72vh] min-h-[28rem] w-full" />
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
