
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Location {
  name: string;
  latitude: number;
  longitude: number;
}

interface EmergencyMapProps {
  startLocation?: Location;
  destination?: Location;
  emergencyId?: string;
  onArrival?: () => void;
}

type Position = [number, number];

interface OSRMRoute {
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
  };
}

interface OSRMResponse {
  code: string;
  routes?: OSRMRoute[];
}

interface DisplayRoute {
  id: number;
  coordinates: Position[];
  distance: number;
  duration: number;
}

const TOTAL_TRACKING_DURATION = 10 * 60 * 1000;

const startIcon = L.divIcon({
  className: "",
  html: `<div style="background:#16a34a;width:18px;height:18px;border:3px solid white;border-radius:50%;box-shadow:0 1px 6px #555;"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const destinationIcon = L.divIcon({
  className: "",
  html: `<div style="background:#dc2626;width:18px;height:18px;border:3px solid white;border-radius:50%;box-shadow:0 1px 6px #555;"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const ambulanceIcon = L.divIcon({
  className: "",
  html: `<div style="background:#f97316;width:36px;height:36px;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:21px;box-shadow:0 2px 8px #555;">🚑</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function MapController({
  positions,
}: {
  positions: Position[];
}) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, {
        padding: [45, 45],
        maxZoom: 16,
      });
    }
  }, [map, positions]);

  return null;
}

function EmergencyMap({
  startLocation,
  destination,
  emergencyId,
  onArrival,
}: EmergencyMapProps) {
  const [routes, setRoutes] = useState<DisplayRoute[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");

  const [isTracking, setIsTracking] = useState(false);
  const [ambulanceIndex, setAmbulanceIndex] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [endedManually, setEndedManually] = useState(false);

  // Preserve elapsed tracking time when paused.
  const elapsedBeforePause = useRef(0);
  const trackingStartedAt = useRef<number | null>(null);

  const arrivalHandled = useRef(false);
  const arrivalCallback = useRef(onArrival);

  useEffect(() => {
    arrivalCallback.current = onArrival;
  }, [onArrival]);

  const hasCoordinates =
    typeof startLocation?.latitude === "number" &&
    Number.isFinite(startLocation.latitude) &&
    typeof startLocation?.longitude === "number" &&
    Number.isFinite(startLocation.longitude) &&
    typeof destination?.latitude === "number" &&
    Number.isFinite(destination.latitude) &&
    typeof destination?.longitude === "number" &&
    Number.isFinite(destination.longitude);

  const startPosition = useMemo<Position | null>(() => {
    if (!hasCoordinates) return null;

    return [
      startLocation!.latitude,
      startLocation!.longitude,
    ];
  }, [
    hasCoordinates,
    startLocation?.latitude,
    startLocation?.longitude,
  ]);

  const destinationPosition = useMemo<Position | null>(() => {
    if (!hasCoordinates) return null;

    return [
      destination!.latitude,
      destination!.longitude,
    ];
  }, [
    hasCoordinates,
    destination?.latitude,
    destination?.longitude,
  ]);

  // Get alternative routes from OSRM.
  useEffect(() => {
    if (!hasCoordinates || !startPosition || !destinationPosition) {
      setRoutes([]);
      setRouteError("");
      setIsTracking(false);
      return;
    }

    const controller = new AbortController();

    const getAlternativeRoutes = async () => {
      try {
        setRouteLoading(true);
        setRouteError("");
        setRoutes([]);
        setSelectedRouteIndex(0);
        setAmbulanceIndex(0);
        setIsTracking(false);
        setArrived(false);
        setEndedManually(false);

        elapsedBeforePause.current = 0;
        trackingStartedAt.current = null;
        arrivalHandled.current = false;

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${startPosition[1]},${startPosition[0]};` +
          `${destinationPosition[1]},${destinationPosition[0]}` +
          `?overview=full&geometries=geojson&alternatives=3&steps=true`;

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to retrieve alternative routes.");
        }

        const data: OSRMResponse = await response.json();

        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error("No driving routes were found.");
        }

        const calculatedRoutes: DisplayRoute[] =
          data.routes.map((route, index) => ({
            id: index + 1,
            distance: route.distance / 1000,
            duration: route.duration / 60,
            coordinates: route.geometry.coordinates.map(
              ([longitude, latitude]) => [
                latitude,
                longitude,
              ]
            ),
          }));

        // Select the route with the smallest road distance.
        calculatedRoutes.sort(
          (a, b) => a.distance - b.distance
        );

        const rankedRoutes = calculatedRoutes.map(
          (route, index) => ({
            ...route,
            id: index + 1,
          })
        );

        setRoutes(rankedRoutes);
        setSelectedRouteIndex(0);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Alternative route error:", error);

        setRouteError(
          error instanceof Error
            ? error.message
            : "Unable to calculate routes."
        );
      } finally {
        if (!controller.signal.aborted) {
          setRouteLoading(false);
        }
      }
    };

    getAlternativeRoutes();

    return () => controller.abort();
  }, [
    emergencyId,
    hasCoordinates,
    startPosition,
    destinationPosition,
  ]);

  const selectedRoute = routes[selectedRouteIndex];

  // Start or resume the 10-minute ambulance simulation.
  useEffect(() => {
    if (!isTracking || !selectedRoute) {
      return;
    }

    const lastIndex = selectedRoute.coordinates.length - 1;

    if (lastIndex <= 0) return;

    if (trackingStartedAt.current === null) {
      trackingStartedAt.current = Date.now();
    }

    const timer = window.setInterval(() => {
      if (trackingStartedAt.current === null) return;

      const elapsed =
        elapsedBeforePause.current +
        (Date.now() - trackingStartedAt.current);

      const progress = Math.min(
        elapsed / TOTAL_TRACKING_DURATION,
        1
      );

      const nextIndex = Math.min(
        Math.floor(progress * lastIndex),
        lastIndex
      );

      setAmbulanceIndex(nextIndex);

      if (progress >= 1) {
        window.clearInterval(timer);

        elapsedBeforePause.current = TOTAL_TRACKING_DURATION;
        trackingStartedAt.current = null;

        setAmbulanceIndex(lastIndex);
        setIsTracking(false);
        setArrived(true);
        setEndedManually(false);

        if (!arrivalHandled.current) {
          arrivalHandled.current = true;
          arrivalCallback.current?.();
        }
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [isTracking, selectedRoute]);

  // Start or resume tracking.
  const startOrResumeTracking = () => {
    if (!selectedRoute || arrived || routeLoading) return;

    if (
      ambulanceIndex >=
      selectedRoute.coordinates.length - 1
    ) {
      setAmbulanceIndex(0);
      elapsedBeforePause.current = 0;
      trackingStartedAt.current = null;
      arrivalHandled.current = false;
    }

    setArrived(false);
    setEndedManually(false);
    setIsTracking(true);
  };

  // Pause tracking without losing elapsed time.
  const pauseTracking = () => {
    if (trackingStartedAt.current !== null) {
      elapsedBeforePause.current +=
        Date.now() - trackingStartedAt.current;

      trackingStartedAt.current = null;
    }

    setIsTracking(false);
  };

  // Manually end tracking and complete the current emergency.
  const endTrackingManually = () => {
    if (!selectedRoute || arrived) return;

    if (trackingStartedAt.current !== null) {
      elapsedBeforePause.current +=
        Date.now() - trackingStartedAt.current;

      trackingStartedAt.current = null;
    }

    setIsTracking(false);
    setArrived(true);
    setEndedManually(true);

    if (!arrivalHandled.current) {
      arrivalHandled.current = true;
      arrivalCallback.current?.();
    }
  };

  const ambulancePosition =
    selectedRoute?.coordinates[
      Math.min(
        ambulanceIndex,
        selectedRoute.coordinates.length - 1
      )
    ] || null;

  const progress =
    selectedRoute && selectedRoute.coordinates.length > 1
      ? Math.round(
          (ambulanceIndex /
            (selectedRoute.coordinates.length - 1)) *
            100
        )
      : 0;

  const allMapPositions = useMemo(() => {
    const positions: Position[] = [];

    if (startPosition) positions.push(startPosition);
    if (destinationPosition) positions.push(destinationPosition);

    routes.forEach((route) => {
      positions.push(...route.coordinates);
    });

    return positions;
  }, [routes, startPosition, destinationPosition]);

  const selectRoute = (index: number) => {
    if (index === selectedRouteIndex) return;

    setIsTracking(false);
    setArrived(false);
    setEndedManually(false);
    setAmbulanceIndex(0);

    elapsedBeforePause.current = 0;
    trackingStartedAt.current = null;
    arrivalHandled.current = false;

    setSelectedRouteIndex(index);
  };

  if (!hasCoordinates || !startPosition || !destinationPosition) {
    return (
      <div style={styles.message}>
        Location coordinates are not available.
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.topBar}>
        <div>
          <strong style={styles.heading}>
            Intelligent Route Optimization
          </strong>

          <p style={styles.subtitle}>
            Comparing alternative driving routes
          </p>
        </div>

        <span style={styles.algorithmBadge}>
          SHORTEST DISTANCE
        </span>
      </div>

      {routeLoading && (
        <div style={styles.message}>
          Analyzing available road routes...
        </div>
      )}

      {routeError && (
        <div style={styles.error}>
          {routeError}
        </div>
      )}

      {!routeLoading && routes.length > 0 && (
        <div style={styles.routeSection}>
          <div style={styles.routeSectionHeader}>
            <strong>Available Routes</strong>
            <span>{routes.length} route(s) identified</span>
          </div>

          <div style={styles.routeCards}>
            {routes.map((route, index) => {
              const isSelected = selectedRouteIndex === index;

              return (
                <button
                  key={`${emergencyId}-${route.id}`}
                  onClick={() => selectRoute(index)}
                  style={{
                    ...styles.routeCard,
                    ...(isSelected ? styles.selectedCard : {}),
                  }}
                >
                  <div style={styles.routeCardTop}>
                    <strong>Route {route.id}</strong>

                    {index === 0 && (
                      <span style={styles.shortestBadge}>
                        SHORTEST
                      </span>
                    )}
                  </div>

                  <div style={styles.routeDistance}>
                    {route.distance.toFixed(2)} km
                  </div>

                  <div style={styles.routeDuration}>
                    Approx. {Math.round(route.duration)} min
                  </div>

                  <div style={styles.routeSelection}>
                    {isSelected ? "✓ Selected route" : "Select route"}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={styles.selectionMessage}>
            <span style={styles.selectionIcon}>✓</span>

            <div>
              <strong>Shortest route selected automatically</strong>

              <p>
                LifeLane selected Route 1 because it has the lowest
                calculated road distance.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TRACKING CONTROLS */}
      <div style={styles.trackingBar}>
        <div>
          <strong>Ambulance Navigation</strong>

          <div style={styles.status}>
            <span
              style={{
                ...styles.statusDot,
                background: arrived
                  ? "#64748b"
                  : isTracking
                  ? "#10b981"
                  : "#f59e0b",
              }}
            />

            {endedManually
              ? "TRACKING ENDED MANUALLY"
              : arrived
              ? "DESTINATION REACHED"
              : isTracking
              ? "FOLLOWING SELECTED ROUTE"
              : "READY FOR DISPATCH"}
          </div>
        </div>

        <div style={styles.trackingButtons}>
          <button
            style={styles.trackButton}
            disabled={!selectedRoute || arrived || routeLoading}
            onClick={
              isTracking
                ? pauseTracking
                : startOrResumeTracking
            }
          >
            {isTracking
              ? "Pause Tracking"
              : ambulanceIndex > 0 && !arrived
              ? "Resume Tracking"
              : "Start Tracking"}
          </button>

          <button
            style={{
              ...styles.trackButton,
              ...styles.endTrackingButton,
            }}
            disabled={!selectedRoute || arrived || routeLoading}
            onClick={endTrackingManually}
          >
            End Tracking & Dispatch Next
          </button>
        </div>
      </div>

      {/* MAP */}
      <div style={styles.mapContainer}>
        <MapContainer
          key={emergencyId}
          center={startPosition}
          zoom={14}
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController positions={allMapPositions} />

          <Marker position={startPosition} icon={startIcon}>
            <Popup>
              <strong>Starting Location</strong>
              <br />
              {startLocation?.name}
            </Popup>
          </Marker>

          <Marker position={destinationPosition} icon={destinationIcon}>
            <Popup>
              <strong>Destination</strong>
              <br />
              {destination?.name}
            </Popup>
          </Marker>

          {routes.map((route, index) => (
            <Polyline
              key={`${emergencyId}-route-${route.id}`}
              positions={route.coordinates}
              pathOptions={{
                color:
                  selectedRouteIndex === index
                    ? "#2563eb"
                    : "#94a3b8",
                weight: selectedRouteIndex === index ? 7 : 4,
                opacity: selectedRouteIndex === index ? 0.95 : 0.65,
                dashArray:
                  selectedRouteIndex === index
                    ? undefined
                    : "8 8",
              }}
              eventHandlers={{
                click: () => selectRoute(index),
              }}
            />
          ))}

          {ambulancePosition && (
            <Marker
              position={ambulancePosition}
              icon={ambulanceIcon}
              zIndexOffset={1000}
            >
              <Popup>
                <strong>Ambulance</strong>
                <br />
                Following selected route.
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* MAP LEGEND */}
      <div style={styles.legend}>
        <span>
          <i style={{ background: "#2563eb" }} /> Selected shortest route
        </span>

        <span>
          <i style={{ background: "#94a3b8" }} /> Alternative routes
        </span>

        <span>🟢 Start</span>
        <span>🟠 Ambulance</span>
        <span>🔴 Destination</span>
      </div>

      {/* JOURNEY METRICS */}
      {selectedRoute && (
        <>
          <div style={styles.metrics}>
            <div style={styles.metricCard}>
              <small>Selected Distance</small>
              <strong>{selectedRoute.distance.toFixed(2)} km</strong>
            </div>

            <div style={styles.metricCard}>
              <small>Estimated Road Duration</small>
              <strong>{Math.round(selectedRoute.duration)} min</strong>
            </div>

            <div style={styles.metricCard}>
              <small>Simulation Duration</small>
              <strong>10 minutes</strong>
            </div>

            <div style={styles.metricCard}>
              <small>Journey Progress</small>
              <strong>{progress}%</strong>
            </div>
          </div>

          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressBar,
                width: `${progress}%`,
              }}
            />
          </div>
        </>
      )}

      {/* COMPLETION MESSAGE */}
      {arrived && (
        <div style={styles.arrivalMessage}>
          ✓{" "}
          {endedManually
            ? "Tracking ended manually. Current emergency closed and next priority request dispatched."
            : "Ambulance reached the destination. Emergency completed and next priority request dispatched."}
        </div>
      )}

      <p style={styles.disclaimer}>
        Route comparison uses OSRM alternative driving routes and selects
        the route with the shortest calculated road distance. The public
        routing service may return fewer alternatives than requested.
        The road ETA is separate from the fixed 10-minute tracking simulation.
        Ambulance movement is simulated, not real GPS tracking.
      </p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    width: "100%",
    minWidth: 0,
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 20,
  },

  heading: {
    fontSize: 15,
    fontWeight: 800,
  },

  subtitle: {
    color: "#8793a5",
    fontSize: 11,
    marginTop: 5,
  },

  algorithmBadge: {
    background: "#dbeafe",
    color: "#1d4ed8",
    padding: "8px 11px",
    borderRadius: 20,
    fontSize: 9,
    fontWeight: 800,
  },

  routeSection: {
    marginBottom: 20,
  },

  routeSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    fontSize: 12,
  },

  routeCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
    gap: 10,
  },

  routeCard: {
    textAlign: "left",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 13,
    cursor: "pointer",
    color: "#172033",
  },

  selectedCard: {
    border: "2px solid #2563eb",
    background: "#eff6ff",
  },

  routeCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
  },

  shortestBadge: {
    color: "#047857",
    background: "#d1fae5",
    borderRadius: 12,
    padding: "4px 6px",
    fontSize: 8,
    fontWeight: 800,
  },

  routeDistance: {
    fontSize: 22,
    fontWeight: 800,
    marginTop: 12,
  },

  routeDuration: {
    color: "#718096",
    fontSize: 10,
    marginTop: 4,
  },

  routeSelection: {
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 700,
    marginTop: 12,
  },

  selectionMessage: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 9,
    padding: 12,
    marginTop: 12,
    fontSize: 11,
  },

  selectionIcon: {
    fontSize: 20,
    fontWeight: 800,
  },

  trackingBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 13,
  },

  trackingButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  status: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#64748b",
    fontSize: 10,
    marginTop: 7,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#10b981",
  },

  trackButton: {
    border: 0,
    borderRadius: 8,
    padding: "11px 16px",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },

  endTrackingButton: {
    background: "#dc2626",
  },

  mapContainer: {
    width: "100%",
    height: 430,
    minHeight: 350,
    borderRadius: 11,
    overflow: "hidden",
    position: "relative",
    zIndex: 1,
  },

  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 13,
    fontSize: 10,
    color: "#64748b",
  },

  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
    gap: 12,
    marginTop: 18,
  },

  metricCard: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    background: "#f8fafc",
    border: "1px solid #e5eaf2",
    borderRadius: 9,
    padding: 13,
  },

  progressTrack: {
    height: 7,
    background: "#e2e8f0",
    borderRadius: 20,
    overflow: "hidden",
    marginTop: 15,
  },

  progressBar: {
    height: "100%",
    background: "#10b981",
    transition: "width 0.1s linear",
  },

  arrivalMessage: {
    background: "#dcfce7",
    color: "#166534",
    padding: 13,
    borderRadius: 8,
    marginTop: 14,
    fontSize: 12,
  },

  message: {
    padding: 13,
    background: "#eff6ff",
    color: "#1e40af",
    borderRadius: 8,
    fontSize: 12,
  },

  error: {
    padding: 13,
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 8,
    fontSize: 12,
  },

  disclaimer: {
    color: "#8793a5",
    fontSize: 10,
    lineHeight: 1.6,
    marginTop: 14,
  },
};

export default EmergencyMap;
