
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import EmergencyMap from "./EmergencyMap";

interface Location {
  name: string;
  latitude: number;
  longitude: number;
}

interface LocationSuggestion extends Location {
  displayName: string;
}

interface Emergency {
  _id: string;
  emergencyId: string;
  emergencyType: string;
  priority: string;
  startLocation: Location;
  destination: Location;
  status: string;
  route?: {
    distance?: number;
    eta?: number;
  };
  createdAt?: string;
}

const API = "http://localhost:5000/api/emergencies";

const priorityRank: Record<string, number> = {
  Critical: 1,
  High: 2,
  Normal: 3,
};

function App() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [page, setPage] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [emergencyType, setEmergencyType] = useState("Ambulance");
  const [priority, setPriority] = useState("Normal");
  const [startAddress, setStartAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");

  const [selectedStart, setSelectedStart] =
    useState<LocationSuggestion | null>(null);

  const [selectedDestination, setSelectedDestination] =
    useState<LocationSuggestion | null>(null);

  const fetchEmergencies = useCallback(async () => {
    try {
      const response = await fetch(API);

      if (!response.ok) {
        throw new Error("Unable to load emergency records.");
      }

      const data = await response.json();
      const records: Emergency[] = data.emergencies || [];

      records.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );

      setEmergencies(records);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Backend connection unavailable. Check your server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmergencies();

    const timer = window.setInterval(fetchEmergencies, 5000);

    return () => window.clearInterval(timer);
  }, [fetchEmergencies]);

  const activeEmergency = useMemo(
    () => emergencies.find((item) => item.status === "Active"),
    [emergencies]
  );

  const queue = useMemo(() => {
    return emergencies
      .filter((item) => item.status === "Queued")
      .sort((a, b) => {
        const difference =
          (priorityRank[a.priority] || 4) -
          (priorityRank[b.priority] || 4);

        if (difference !== 0) return difference;

        return (
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
        );
      });
  }, [emergencies]);

  const completed = emergencies.filter(
    (item) => item.status === "Completed"
  );

  const submitEmergency = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!selectedStart || !selectedDestination) {
      setError(
        "Please select both locations from the search suggestions."
      );
      return;
    }

    try {
      setSubmitting(true);
      setNotice("Adding request to priority dispatch queue...");

      const start: Location = {
        name: selectedStart.displayName,
        latitude: selectedStart.latitude,
        longitude: selectedStart.longitude,
      };

      const destination: Location = {
        name: selectedDestination.displayName,
        latitude: selectedDestination.latitude,
        longitude: selectedDestination.longitude,
      };

      const response = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emergencyType,
          priority,
          startLocation: start,
          destination,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Emergency creation failed."
        );
      }

      setNotice(
        `${data.message} ID: ${data.emergency.emergencyId}`
      );

      setStartAddress("");
      setDestinationAddress("");
      setSelectedStart(null);
      setSelectedDestination(null);

      await fetchEmergencies();
      setPage("Overview");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create request."
      );

      setNotice("");
    } finally {
      setSubmitting(false);
    }
  };

  const completeEmergency = useCallback(
    async (emergencyId: string, automatic = false) => {
      try {
        const response = await fetch(
          `${API}/${emergencyId}/complete`,
          {
            method: "PATCH",
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to complete emergency."
          );
        }

        await fetchEmergencies();

        setNotice(
          automatic
            ? `Destination reached. ${data.message}`
            : data.message
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Completion failed."
        );
      }
    },
    [fetchEmergencies]
  );

  const handleArrival = useCallback(() => {
    if (activeEmergency) {
      completeEmergency(activeEmergency.emergencyId, true);
    }
  }, [activeEmergency, completeEmergency]);

  const criticalCount = emergencies.filter(
    (item) =>
      item.priority === "Critical" &&
      item.status !== "Completed"
  ).length;

  const activeCount = emergencies.filter(
    (item) => item.status === "Active"
  ).length;

  const navItems = [
    { name: "Overview", icon: "◫" },
    { name: "New Request", icon: "+" },
    { name: "Live Tracking", icon: "⌖" },
    { name: "Priority Queue", icon: "☷" },
    { name: "History", icon: "◷" },
  ];

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>L</div>

          <div>
            <strong style={styles.brandName}>LifeLane</strong>
            <span style={styles.brandCaption}>
              SMART EMERGENCY SYSTEM
            </span>
          </div>
        </div>

        <div style={styles.sideSection}>WORKSPACE</div>

        {navItems.map((item) => (
          <button
            key={item.name}
            style={{
              ...styles.navButton,
              ...(page === item.name ? styles.navActive : {}),
            }}
            onClick={() => {
              setPage(item.name);
              setError("");
              setNotice("");
            }}
          >
            <span style={styles.navIcon}>{item.icon}</span>

            {item.name}

            {item.name === "Priority Queue" &&
              queue.length > 0 && (
                <span style={styles.navCount}>
                  {queue.length}
                </span>
              )}
          </button>
        ))}

        <div style={styles.sideBottom}>
          <div style={styles.onlineCard}>
            <span style={styles.onlineDot} />

            <div>
              <strong>System Online</strong>
              <small>Prototype environment</small>
            </div>
          </div>

          <p style={styles.sideFooter}>LifeLane © 2026</p>
        </div>
      </aside>

      <main style={styles.main}>
        <header style={styles.topbar}>
          <div>
            <div style={styles.eyebrow}>
              EMERGENCY OPERATIONS / PUNE
            </div>

            <h1 style={styles.heading}>{page}</h1>

            <p style={styles.subheading}>
              Monitor, prioritize and coordinate emergency requests.
            </p>
          </div>

          <div style={styles.topActions}>
            <span style={styles.livePill}>
              <span style={styles.onlineDot} /> LIVE
            </span>

            <button
              style={styles.refreshButton}
              onClick={fetchEmergencies}
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {error && (
          <div style={styles.errorBanner}>⚠ {error}</div>
        )}

        {notice && (
          <div style={styles.noticeBanner}>✓ {notice}</div>
        )}

        {loading ? (
          <div style={styles.panel}>
            Loading LifeLane operations...
          </div>
        ) : (
          <>
            {page === "Overview" && (
              <>
                <div style={styles.statsGrid}>
                  <StatCard
                    label="TOTAL REQUESTS"
                    value={emergencies.length}
                    icon="▤"
                    color="#2563eb"
                  />

                  <StatCard
                    label="ACTIVE DISPATCH"
                    value={activeCount}
                    icon="🚑"
                    color="#059669"
                  />

                  <StatCard
                    label="WAITING QUEUE"
                    value={queue.length}
                    icon="☷"
                    color="#d97706"
                  />

                  <StatCard
                    label="CRITICAL REQUESTS"
                    value={criticalCount}
                    icon="⚠"
                    color="#dc2626"
                  />
                </div>

                <div style={styles.dashboardGrid}>
                  <section style={styles.panel}>
                    <div style={styles.panelHeader}>
                      <div>
                        <h2 style={styles.panelTitle}>
                          Active Emergency
                        </h2>

                        <p style={styles.panelSubtitle}>
                          Currently dispatched vehicle
                        </p>
                      </div>

                      <span style={styles.activeBadge}>
                        ● ACTIVE
                      </span>
                    </div>

                    {activeEmergency ? (
                      <>
                        <div style={styles.emergencyId}>
                          {activeEmergency.emergencyId}
                        </div>

                        <div style={styles.detailsGrid}>
                          <Detail
                            label="TYPE"
                            value={activeEmergency.emergencyType}
                          />

                          <Detail
                            label="PRIORITY"
                            value={activeEmergency.priority}
                          />

                          <Detail
                            label="FROM"
                            value={activeEmergency.startLocation.name}
                          />

                          <Detail
                            label="TO"
                            value={activeEmergency.destination.name}
                          />

                          <Detail
                            label="ESTIMATED TIME"
                            value={`${activeEmergency.route?.eta ?? "--"} min`}
                          />

                          <Detail
                            label="DISTANCE"
                            value={`${activeEmergency.route?.distance ?? "--"} km`}
                          />
                        </div>

                        <button
                          style={styles.primaryButton}
                          onClick={() => setPage("Live Tracking")}
                        >
                          Open Live Tracking →
                        </button>
                      </>
                    ) : (
                      <EmptyState
                        title="No active emergency"
                        description="Create an emergency request to start dispatch."
                        action={() => setPage("New Request")}
                      />
                    )}
                  </section>

                  <section style={styles.panel}>
                    <div style={styles.panelHeader}>
                      <div>
                        <h2 style={styles.panelTitle}>
                          Priority Queue
                        </h2>

                        <p style={styles.panelSubtitle}>
                          Next emergencies in dispatch order
                        </p>
                      </div>

                      <span style={styles.queueCount}>
                        {queue.length} waiting
                      </span>
                    </div>

                    <QueueList items={queue.slice(0, 5)} />

                    <button
                      style={styles.textButton}
                      onClick={() => setPage("Priority Queue")}
                    >
                      View full queue →
                    </button>
                  </section>
                </div>

                <section style={styles.panel}>
                  <div style={styles.panelHeader}>
                    <div>
                      <h2 style={styles.panelTitle}>
                        Operations Overview
                      </h2>

                      <p style={styles.panelSubtitle}>
                        Current emergency route
                      </p>
                    </div>

                    <span style={styles.mapLabel}>
                      OPENSTREETMAP
                    </span>
                  </div>

                  {activeEmergency ? (
                    <EmergencyMap
                      startLocation={activeEmergency.startLocation}
                      destination={activeEmergency.destination}
                      emergencyId={activeEmergency.emergencyId}
                      onArrival={handleArrival}
                    />
                  ) : (
                    <EmptyState
                      title="Map waiting for dispatch"
                      description="The map will show the active emergency route here."
                      action={() => setPage("New Request")}
                    />
                  )}
                </section>
              </>
            )}

            {page === "New Request" && (
              <div style={styles.formLayout}>
                <section style={styles.panel}>
                  <div style={styles.formHeading}>
                    <div style={styles.formIcon}>+</div>

                    <div>
                      <h2 style={styles.panelTitle}>
                        Create Emergency Request
                      </h2>

                      <p style={styles.panelSubtitle}>
                        Enter incident details to add a request to dispatch.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={submitEmergency}
                    style={styles.form}
                  >
                    <label style={styles.label}>
                      Emergency Type
                    </label>

                    <select
                      style={styles.input}
                      value={emergencyType}
                      onChange={(e) =>
                        setEmergencyType(e.target.value)
                      }
                    >
                      <option value="Ambulance">Ambulance</option>
                      <option value="Fire Brigade">Fire Brigade</option>
                    </select>

                    <label style={styles.label}>
                      Emergency Priority
                    </label>

                    <div style={styles.priorityChoices}>
                      {["Critical", "High", "Normal"].map(
                        (item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setPriority(item)}
                            style={{
                              ...styles.priorityChoice,
                              ...(priority === item
                                ? item === "Critical"
                                  ? styles.criticalSelected
                                  : item === "High"
                                  ? styles.highSelected
                                  : styles.normalSelected
                                : {}),
                            }}
                          >
                            <span>
                              {item === "Critical"
                                ? "●"
                                : item === "High"
                                ? "◆"
                                : "○"}
                            </span>

                            {item}
                          </button>
                        )
                      )}
                    </div>

                    <label style={styles.label}>
                      Starting Location – Pune
                    </label>

                    <LocationAutocomplete
                      value={startAddress}
                      placeholder="Search Pune starting location..."
                      onChange={(value) => {
                        setStartAddress(value);
                        setSelectedStart(null);
                      }}
                      onSelect={(location) => {
                        setStartAddress(location.displayName);
                        setSelectedStart(location);
                      }}
                    />

                    <label style={styles.label}>
                      Destination / Hospital – Pune
                    </label>

                    <LocationAutocomplete
                      value={destinationAddress}
                      placeholder="Search Pune destination or hospital..."
                      onChange={(value) => {
                        setDestinationAddress(value);
                        setSelectedDestination(null);
                      }}
                      onSelect={(location) => {
                        setDestinationAddress(location.displayName);
                        setSelectedDestination(location);
                      }}
                    />

                    <p style={styles.locationHint}>
                      Type at least 2 characters and choose a result
                      from the suggestions. Both locations must be selected.
                    </p>

                    <button
                      type="submit"
                      style={styles.primaryButton}
                      disabled={submitting}
                    >
                      {submitting
                        ? "Submitting request..."
                        : "Submit Emergency Request →"}
                    </button>
                  </form>
                </section>

                <section style={styles.infoPanel}>
                  <div style={styles.panelIcon}>⚡</div>

                  <h3>Priority Dispatch Logic</h3>

                  <p>
                    LifeLane automatically sorts requests according to
                    their assigned priority.
                  </p>

                  <div style={styles.priorityInfo}>
                    <PriorityRow
                      name="Critical"
                      rank="01"
                      color="#dc2626"
                    />

                    <PriorityRow
                      name="High"
                      rank="02"
                      color="#d97706"
                    />

                    <PriorityRow
                      name="Normal"
                      rank="03"
                      color="#2563eb"
                    />
                  </div>

                  <p style={styles.infoFootnote}>
                    Requests with equal priority are processed in the
                    order they were received.
                  </p>
                </section>
              </div>
            )}

            {page === "Live Tracking" && (
              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <div>
                    <h2 style={styles.panelTitle}>
                      Live Vehicle Tracking
                    </h2>

                    <p style={styles.panelSubtitle}>
                      Simulated route and ambulance movement
                    </p>
                  </div>

                  {activeEmergency && (
                    <span style={styles.activeBadge}>
                      ● ACTIVE
                    </span>
                  )}
                </div>

                {activeEmergency ? (
                  <>
                    <div style={styles.detailsGrid}>
                      <Detail
                        label="EMERGENCY ID"
                        value={activeEmergency.emergencyId}
                      />

                      <Detail
                        label="PRIORITY"
                        value={activeEmergency.priority}
                      />

                      <Detail
                        label="START"
                        value={activeEmergency.startLocation.name}
                      />

                      <Detail
                        label="DESTINATION"
                        value={activeEmergency.destination.name}
                      />
                    </div>

                    <EmergencyMap
                      startLocation={activeEmergency.startLocation}
                      destination={activeEmergency.destination}
                      emergencyId={activeEmergency.emergencyId}
                      onArrival={handleArrival}
                    />
                  </>
                ) : (
                  <EmptyState
                    title="No active vehicle"
                    description="A vehicle will appear when the next request is dispatched."
                    action={() => setPage("New Request")}
                  />
                )}
              </section>
            )}

            {page === "Priority Queue" && (
              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <div>
                    <h2 style={styles.panelTitle}>
                      Emergency Dispatch Queue
                    </h2>

                    <p style={styles.panelSubtitle}>
                      Automatically ranked by priority and request time
                    </p>
                  </div>

                  <span style={styles.queueCount}>
                    {queue.length} waiting
                  </span>
                </div>

                {activeEmergency && (
                  <div style={styles.currentDispatch}>
                    <span style={styles.activeBadge}>
                      CURRENTLY DISPATCHED
                    </span>

                    <strong>{activeEmergency.emergencyId}</strong>

                    <PriorityBadge
                      priority={activeEmergency.priority}
                    />
                  </div>
                )}

                <QueueList items={queue} />

                {!activeEmergency && queue.length === 0 && (
                  <EmptyState
                    title="No pending requests"
                    description="Submit a request to start the dispatch queue."
                    action={() => setPage("New Request")}
                  />
                )}
              </section>
            )}

            {page === "History" && (
              <section style={styles.panel}>
                <h2 style={styles.panelTitle}>
                  Completed Emergency History
                </h2>

                <p style={styles.panelSubtitle}>
                  Requests that have reached their destination
                </p>

                {completed.length === 0 ? (
                  <p style={styles.panelSubtitle}>
                    No completed requests yet.
                  </p>
                ) : (
                  completed.map((item) => (
                    <div
                      key={item._id}
                      style={styles.historyRow}
                    >
                      <div>
                        <strong>{item.emergencyId}</strong>

                        <p style={styles.panelSubtitle}>
                          {item.emergencyType}
                        </p>
                      </div>

                      <PriorityBadge priority={item.priority} />

                      <span style={styles.completedBadge}>
                        ✓ Completed
                      </span>
                    </div>
                  ))
                )}
              </section>
            )}
          </>
        )}

        <footer style={styles.footer}>
          LifeLane Academic Prototype · Emergency coordination and
          traffic signal operations are simulated.
        </footer>
      </main>
    </div>
  );
}

// --------------------------------------------------
// PUNE LOCATION AUTOCOMPLETE
// Uses Photon search with OpenStreetMap data.
// --------------------------------------------------

function LocationAutocomplete({
  value,
  placeholder,
  onChange,
  onSelect,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSelect: (location: LocationSuggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [chosenValue, setChosenValue] = useState("");

  useEffect(() => {
    if (value === chosenValue) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const query = value.trim();

    if (query.length < 2) {
      setSuggestions([]);
      setSearchError("");
      setSearching(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        setSearchError("");

        // Pune coordinate bias helps rank Pune-area results higher.
        const params = new URLSearchParams({
          q: query,
          lat: "18.5204",
          lon: "73.8567",
          limit: "8",
          lang: "en",
        });

        const response = await fetch(
          `https://photon.komoot.io/api/?${params.toString()}`,
          {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Location service is temporarily unavailable."
          );
        }

        const data = await response.json();

        const features = Array.isArray(data.features)
          ? data.features
          : [];

        const formatted: LocationSuggestion[] = features
          .map((feature: any) => {
            const properties = feature.properties || {};
            const coordinates = feature.geometry?.coordinates;

            if (
              !Array.isArray(coordinates) ||
              coordinates.length < 2
            ) {
              return null;
            }

            const country = String(
              properties.country || ""
            ).toLowerCase();

            const state = String(
              properties.state || ""
            ).toLowerCase();

            // Ignore results explicitly identified outside India
            // or Maharashtra, while allowing records with missing metadata.
            if (country && !country.includes("india")) {
              return null;
            }

            if (state && !state.includes("maharashtra")) {
              return null;
            }

            const parts = [
              properties.name,
              properties.street,
              properties.district,
              properties.city,
              properties.state,
            ].filter(
              (part, index, all) =>
                part && all.indexOf(part) === index
            );

            const displayName =
              parts.join(", ") ||
              properties.name ||
              "Pune location";

            return {
              name: displayName,
              displayName,
              longitude: Number(coordinates[0]),
              latitude: Number(coordinates[1]),
            };
          })
          .filter(
            (
              item: LocationSuggestion | null
            ): item is LocationSuggestion =>
              Boolean(item) &&
              Number.isFinite(item!.latitude) &&
              Number.isFinite(item!.longitude)
          );

        setSuggestions(formatted);
        setShowSuggestions(true);

        if (formatted.length === 0) {
          setSearchError(
            "No matching location found. Try a landmark, area name or a different spelling."
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error("Location search error:", error);

        setSearchError(
          error instanceof Error
            ? error.message
            : "Unable to search locations."
        );
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 650);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, chosenValue]);

  return (
    <div style={locationStyles.wrapper}>
      <div style={locationStyles.inputWrapper}>
        <span style={locationStyles.searchIcon}>⌕</span>

        <input
          style={locationStyles.input}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          required
          onChange={(event) => {
            setChosenValue("");
            onChange(event.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() =>
            window.setTimeout(
              () => setShowSuggestions(false),
              180
            )
          }
        />

        {searching && (
          <span style={locationStyles.loading}>
            Searching...
          </span>
        )}
      </div>

      {showSuggestions && value.trim().length >= 2 && (
        <div style={locationStyles.suggestions}>
          {suggestions.map((location, index) => (
            <button
              type="button"
              key={`${location.latitude}-${location.longitude}-${index}`}
              style={locationStyles.suggestion}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setChosenValue(location.displayName);
                onSelect(location);
                setSuggestions([]);
                setShowSuggestions(false);
                setSearchError("");
              }}
            >
              <span style={locationStyles.pin}>📍</span>

              <span style={locationStyles.suggestionText}>
                {location.displayName}
              </span>
            </button>
          ))}

          {!searching && searchError && (
            <div style={locationStyles.message}>
              {searchError}
            </div>
          )}

          {suggestions.length > 0 && (
            <div style={locationStyles.footer}>
              Location data © OpenStreetMap contributors · Search by Photon
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const locationStyles: Record<string, CSSProperties> = {
  wrapper: {
    position: "relative",
    width: "100%",
  },

  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  searchIcon: {
    position: "absolute",
    left: 12,
    fontSize: 20,
    color: "#64748b",
    pointerEvents: "none",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 95px 12px 38px",
    border: "1px solid #dce3ed",
    borderRadius: 8,
    fontSize: 13,
    background: "#fff",
    color: "#18253b",
    outlineColor: "#2563eb",
  },

  loading: {
    position: "absolute",
    right: 10,
    fontSize: 10,
    color: "#2563eb",
  },

  suggestions: {
    position: "absolute",
    top: "calc(100% + 5px)",
    left: 0,
    right: 0,
    zIndex: 1000,
    background: "#fff",
    border: "1px solid #dce3ed",
    borderRadius: 9,
    boxShadow: "0 8px 25px rgba(15,23,42,.13)",
    maxHeight: 260,
    overflowY: "auto",
  },

  suggestion: {
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    border: 0,
    borderBottom: "1px solid #edf0f5",
    background: "#fff",
    textAlign: "left",
    cursor: "pointer",
    color: "#18253b",
  },

  pin: {
    fontSize: 15,
    flexShrink: 0,
  },

  suggestionText: {
    fontSize: 11,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },

  message: {
    padding: 13,
    fontSize: 11,
    color: "#64748b",
  },

  footer: {
    padding: 9,
    fontSize: 9,
    color: "#8793a5",
    background: "#f8fafc",
  },
};

// --------------------------------------------------
// DASHBOARD COMPONENTS
// --------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, color }}>
        {icon}
      </div>

      <div>
        <div style={styles.statLabel}>{label}</div>
        <div style={styles.statValue}>{value}</div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.detail}>
      <span style={styles.detailLabel}>{label}</span>
      <strong style={styles.detailValue}>{value}</strong>
    </div>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: string;
}) {
  const color =
    priority === "Critical"
      ? styles.criticalBadge
      : priority === "High"
      ? styles.highBadge
      : styles.normalBadge;

  return (
    <span style={{ ...styles.priorityBadge, ...color }}>
      {priority}
    </span>
  );
}

function QueueList({
  items,
}: {
  items: Emergency[];
}) {
  if (items.length === 0) {
    return (
      <p style={styles.panelSubtitle}>
        No waiting emergencies.
      </p>
    );
  }

  return (
    <div>
      {items.map((item, index) => (
        <div key={item._id} style={styles.queueRow}>
          <div style={styles.queueNumber}>{index + 1}</div>

          <div style={styles.queueDetails}>
            <strong>{item.emergencyId}</strong>

            <span>
              {item.emergencyType} · {item.startLocation.name}
            </span>
          </div>

          <PriorityBadge priority={item.priority} />
        </div>
      ))}
    </div>
  );
}

function PriorityRow({
  name,
  rank,
  color,
}: {
  name: string;
  rank: string;
  color: string;
}) {
  return (
    <div style={styles.priorityRow}>
      <span style={{ ...styles.priorityRank, color }}>
        {rank}
      </span>

      <strong>{name}</strong>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: () => void;
}) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>⌖</div>

      <strong>{title}</strong>

      <p>{description}</p>

      <button
        style={styles.textButton}
        onClick={action}
      >
        Create request →
      </button>
    </div>
  );
}

// --------------------------------------------------
// APPLICATION STYLES
// --------------------------------------------------

const styles: Record<string, CSSProperties> = {
  app: {
    display: "flex",
    minHeight: "100vh",
    background: "#f4f7fb",
    color: "#18253b",
    fontFamily: "Inter, Arial, sans-serif",
  },

  sidebar: {
    width: 250,
    flexShrink: 0,
    background: "#101b30",
    color: "#fff",
    padding: "25px 16px",
    display: "flex",
    flexDirection: "column",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "4px 9px 35px",
  },

  brandIcon: {
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    background: "#2563eb",
    borderRadius: 13,
    fontSize: 23,
    fontWeight: 800,
  },

  brandName: {
    display: "block",
    fontSize: 21,
    letterSpacing: "-0.5px",
  },

  brandCaption: {
    display: "block",
    color: "#93a4bd",
    fontSize: 8,
    letterSpacing: 1.2,
    marginTop: 4,
  },

  sideSection: {
    color: "#73849f",
    fontSize: 10,
    letterSpacing: 1.5,
    padding: "12px 10px",
  },

  navButton: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    border: 0,
    background: "transparent",
    color: "#b9c5d7",
    padding: "13px 12px",
    borderRadius: 9,
    marginBottom: 5,
    cursor: "pointer",
    textAlign: "left",
    fontSize: 13,
  },

  navActive: {
    background: "#233b60",
    color: "#fff",
  },

  navIcon: {
    width: 20,
    fontSize: 17,
    textAlign: "center",
  },

  navCount: {
    marginLeft: "auto",
    background: "#dc2626",
    borderRadius: 20,
    padding: "2px 7px",
    fontSize: 10,
  },

  sideBottom: {
    marginTop: "auto",
  },

  onlineCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 10,
    background: "#1b2b43",
  },

  onlineDot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#10b981",
  },

  sideFooter: {
    color: "#71829b",
    fontSize: 10,
    paddingLeft: 10,
  },

  main: {
    flex: 1,
    minWidth: 0,
    padding: "30px 34px",
  },

  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    marginBottom: 25,
  },

  eyebrow: {
    color: "#73849c",
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 8,
  },

  heading: {
    fontSize: 28,
    margin: 0,
    letterSpacing: "-0.7px",
  },

  subheading: {
    color: "#718096",
    fontSize: 13,
    marginTop: 7,
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  livePill: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 10,
    fontWeight: 700,
    color: "#047857",
    background: "#d1fae5",
    padding: "9px 12px",
    borderRadius: 20,
  },

  refreshButton: {
    border: "1px solid #dce3ed",
    background: "#fff",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 14,
    marginBottom: 18,
  },

  statCard: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    background: "#fff",
    border: "1px solid #e6ebf2",
    borderRadius: 13,
    padding: 19,
    boxShadow: "0 3px 12px rgba(25,45,80,.025)",
  },

  statIcon: {
    fontSize: 26,
  },

  statLabel: {
    color: "#8290a4",
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: 700,
  },

  statValue: {
    fontSize: 26,
    fontWeight: 750,
    marginTop: 5,
  },

  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1.1fr) minmax(280px,.9fr)",
    gap: 16,
  },

  panel: {
    background: "#fff",
    border: "1px solid #e6ebf2",
    borderRadius: 13,
    padding: 22,
    marginBottom: 17,
    minWidth: 0,
    boxShadow: "0 3px 12px rgba(25,45,80,.025)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },

  panelTitle: {
    fontSize: 17,
    margin: 0,
    fontWeight: 750,
  },

  panelSubtitle: {
    color: "#8793a5",
    fontSize: 11,
    marginTop: 6,
    overflowWrap: "anywhere",
  },

  activeBadge: {
    color: "#047857",
    background: "#d1fae5",
    padding: "7px 10px",
    borderRadius: 20,
    fontSize: 9,
    fontWeight: 800,
  },

  queueCount: {
    color: "#52647e",
    background: "#eef2f8",
    padding: "7px 10px",
    borderRadius: 20,
    fontSize: 10,
  },

  emergencyId: {
    fontSize: 21,
    fontWeight: 800,
    marginBottom: 18,
    color: "#1e3a8a",
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 16,
    marginBottom: 18,
  },

  detail: {
    minWidth: 0,
  },

  detailLabel: {
    display: "block",
    color: "#8995a7",
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  detailValue: {
    display: "block",
    fontSize: 12,
    overflowWrap: "anywhere",
  },

  primaryButton: {
    background: "#2563eb",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 12,
  },

  textButton: {
    background: "transparent",
    border: 0,
    color: "#2563eb",
    cursor: "pointer",
    fontWeight: 700,
    padding: "10px 0",
    fontSize: 12,
  },

  queueRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "13px 0",
    borderBottom: "1px solid #edf0f5",
  },

  queueNumber: {
    width: 27,
    height: 27,
    display: "grid",
    placeItems: "center",
    background: "#eef2f8",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 800,
  },

  queueDetails: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 5,
    fontSize: 11,
  },

  priorityBadge: {
    padding: "6px 9px",
    borderRadius: 20,
    fontSize: 9,
    fontWeight: 800,
    flexShrink: 0,
  },

  criticalBadge: {
    background: "#fee2e2",
    color: "#b91c1c",
  },

  highBadge: {
    background: "#ffedd5",
    color: "#c2410c",
  },

  normalBadge: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },

  mapLabel: {
    fontSize: 9,
    color: "#64748b",
    letterSpacing: 1,
  },

  formLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1.4fr) minmax(230px,.6fr)",
    gap: 17,
    alignItems: "start",
  },

  formHeading: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    marginBottom: 22,
  },

  formIcon: {
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background: "#e8efff",
    color: "#2563eb",
    fontSize: 24,
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 11,
    maxWidth: 650,
  },

  label: {
    fontSize: 11,
    fontWeight: 750,
    marginTop: 8,
  },

  locationHint: {
    color: "#8793a5",
    fontSize: 10,
    margin: "0 0 5px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    border: "1px solid #dce3ed",
    borderRadius: 8,
    fontSize: 13,
    background: "#fff",
    color: "#18253b",
  },

  priorityChoices: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 8,
  },

  priorityChoice: {
    padding: "12px 7px",
    border: "1px solid #dce3ed",
    borderRadius: 8,
    background: "#fff",
    color: "#52647e",
    cursor: "pointer",
    fontSize: 11,
    display: "flex",
    justifyContent: "center",
    gap: 7,
  },

  criticalSelected: {
    border: "1px solid #dc2626",
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 800,
  },

  highSelected: {
    border: "1px solid #d97706",
    background: "#fff7ed",
    color: "#c2410c",
    fontWeight: 800,
  },

  normalSelected: {
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 800,
  },

  infoPanel: {
    background: "#14233c",
    color: "#fff",
    borderRadius: 13,
    padding: 23,
  },

  panelIcon: {
    fontSize: 28,
    color: "#60a5fa",
  },

  priorityInfo: {
    marginTop: 20,
  },

  priorityRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    padding: "13px 0",
    borderBottom: "1px solid #2d405b",
  },

  priorityRank: {
    fontSize: 12,
    fontWeight: 800,
  },

  infoFootnote: {
    color: "#a7b6ca",
    fontSize: 10,
    lineHeight: 1.6,
    marginTop: 17,
  },

  currentDispatch: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    background: "#f0fdf4",
    padding: 13,
    borderRadius: 9,
    marginBottom: 14,
  },

  completedBadge: {
    background: "#d1fae5",
    color: "#047857",
    padding: "6px 9px",
    borderRadius: 20,
    fontSize: 10,
  },

  historyRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    padding: "15px 0",
    borderBottom: "1px solid #edf0f5",
  },

  emptyState: {
    textAlign: "center",
    padding: "30px 10px",
  },

  emptyIcon: {
    fontSize: 32,
    color: "#94a3b8",
    marginBottom: 10,
  },

  errorBanner: {
    padding: 13,
    borderRadius: 8,
    background: "#fee2e2",
    color: "#991b1b",
    marginBottom: 15,
    fontSize: 12,
  },

  noticeBanner: {
    padding: 13,
    borderRadius: 8,
    background: "#dcfce7",
    color: "#166534",
    marginBottom: 15,
    fontSize: 12,
  },

  footer: {
    color: "#8995a7",
    fontSize: 10,
    padding: "12px 3px 20px",
  },
};

export default App;
