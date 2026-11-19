
import { useState } from "react";
import {
  Ambulance,
  MapPin,
  Send,
  Siren,
  Loader2,
  CheckCircle,
  AlertCircle,
  Navigation,
} from "lucide-react";
import "./App.css";

interface EmergencyRequestProps {
  onCreated: () => void;
}

interface LocationResult {
  name: string;
  latitude: number;
  longitude: number;
}

async function findPuneLocation(address: string): Promise<LocationResult> {
  const params = new URLSearchParams({
    q: `${address}, Pune, Maharashtra, India`,
    format: "jsonv2",
    limit: "1",
    countrycodes: "in",
    viewbox: "73.6,18.8,74.1,18.2",
    bounded: "1",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Location search failed. Check your internet connection.");
  }

  const results = await response.json();

  if (!results.length) {
    throw new Error(
      `Could not find "${address}" in Pune. Try a more specific address or landmark.`
    );
  }

  const latitude = Number(results[0].lat);
  const longitude = Number(results[0].lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Invalid location coordinates received.");
  }

  return {
    name: results[0].display_name,
    latitude,
    longitude,
  };
}

function EmergencyRequest({ onCreated }: EmergencyRequestProps) {
  const [emergencyType, setEmergencyType] = useState("Ambulance");
  const [priority, setPriority] = useState("Critical");
  const [startLocation, setStartLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [emergencyId, setEmergencyId] = useState("");
  const [foundLocations, setFoundLocations] = useState<{
    start?: LocationResult;
    destination?: LocationResult;
  }>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");
    setEmergencyId("");
    setFoundLocations({});

    try {
      // Find actual starting coordinates
      const start = await findPuneLocation(startLocation);

      // Find actual destination coordinates
      const end = await findPuneLocation(destination);

      setFoundLocations({
        start,
        destination: end,
      });

      // Save emergency and coordinates in MongoDB
      const response = await fetch(
        "http://localhost:5000/api/emergencies",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            emergencyType,
            priority,

            startLocation: {
              name: start.name,
              latitude: start.latitude,
              longitude: start.longitude,
            },

            destination: {
              name: end.name,
              latitude: end.latitude,
              longitude: end.longitude,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to create emergency request"
        );
      }

      setMessage("Emergency request created successfully!");
      setEmergencyId(data.emergency.emergencyId);

      onCreated();

      setStartLocation("");
      setDestination("");
      setEmergencyType("Ambulance");
      setPriority("Critical");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="request-page">

      <div className="request-header">
        <div>
          <span className="eyebrow">EMERGENCY RESPONSE</span>
          <h2>Create Emergency Request</h2>
          <p>
            Enter emergency details to initiate corridor coordination.
          </p>
        </div>

        <div className="request-header-icon">
          <Siren size={32} />
        </div>
      </div>

      <form className="request-form" onSubmit={handleSubmit}>

        <h3>Emergency Information</h3>

        <p className="form-description">
          Provide the details of the emergency vehicle and its journey.
        </p>

        <label>Emergency Vehicle Type</label>

        <div className="vehicle-options">

          <button
            type="button"
            className={`vehicle-option ${
              emergencyType === "Ambulance" ? "selected" : ""
            }`}
            onClick={() => setEmergencyType("Ambulance")}
          >
            <Ambulance size={23} />
            <span>Ambulance</span>
          </button>

          <button
            type="button"
            className={`vehicle-option ${
              emergencyType === "Fire Brigade" ? "selected" : ""
            }`}
            onClick={() => setEmergencyType("Fire Brigade")}
          >
            <Siren size={23} />
            <span>Fire Brigade</span>
          </button>

        </div>

        <label htmlFor="priority">Emergency Priority</label>

        <select
          id="priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          required
        >
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Normal">Normal</option>
        </select>

        <label htmlFor="startLocation">
          Starting Location
        </label>

        <div className="request-input">
          <MapPin size={18} />

          <input
            id="startLocation"
            type="text"
            placeholder="Example: MIT ADT University, Loni Kalbhor"
            value={startLocation}
            onChange={(e) => setStartLocation(e.target.value)}
            required
          />
        </div>

        <label htmlFor="destination">
          Destination
        </label>

        <div className="request-input">
          <Navigation size={18} />

          <input
            id="destination"
            type="text"
            placeholder="Example: Ruby Hall Clinic, Pune"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
          />
        </div>

        <div className="form-note">
          <MapPin size={17} />

          <span>
            Enter locations in Pune. LifeLane will search OpenStreetMap
            and save their geographic coordinates.
          </span>
        </div>

        {foundLocations.start && foundLocations.destination && (
          <div className="request-success">
            <CheckCircle size={18} />

            <div>
              <strong>Locations successfully identified</strong>
              <p>
                Starting point: {foundLocations.start.latitude.toFixed(5)},
                {" "}{foundLocations.start.longitude.toFixed(5)}
              </p>
              <p>
                Destination: {foundLocations.destination.latitude.toFixed(5)},
                {" "}{foundLocations.destination.longitude.toFixed(5)}
              </p>
            </div>
          </div>
        )}

        <div className="form-note">
          <Siren size={17} />

          <span>
            This is an academic prototype. Emergency-service communication
            and traffic signal control are simulated.
          </span>
        </div>

        <button
          className="submit-emergency"
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={17} />
              Finding Locations and Saving...
            </>
          ) : (
            <>
              <Send size={17} />
              Prepare Emergency Request
            </>
          )}
        </button>

        {message && (
          <div className="request-success">
            <CheckCircle size={18} />

            <div>
              <strong>{message}</strong>
              <p>Emergency ID: {emergencyId}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="request-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

      </form>
    </div>
  );
}

export default EmergencyRequest;
