// map.js
document.addEventListener("DOMContentLoaded", () => {
  // --- Initialize map ---
  const map = L.map("map").setView([40.7128, -74.006], 13); // Default: NYC

  // --- Tile layer (OpenStreetMap) ---
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // --- Layer groups ---
  const userLayer = L.layerGroup().addTo(map);
  const resultsLayer = L.layerGroup().addTo(map);

  // --- Lucide icon factory ---
  function lucideIcon(name, color = "#e63946") {
    return L.divIcon({
      className: "lucide-marker",
      html: `<i data-lucide="${name}" style="color:${color}; width:24px; height:24px;"></i>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -22]
    });
  }

  // --- Icons for different categories ---
  const icons = {
    restaurant: lucideIcon("utensils", "#e63946"),
    cafe: lucideIcon("coffee", "#ff9f1c"),
    fast_food: lucideIcon("hamburger", "#f77f00"), // custom alias we'll map later
    default: lucideIcon("map-pin", "#1d3557")
  };

  // --- Helper: Convert ZIP to coordinates (Nominatim) ---
  async function geocodeZip(zip) {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=us&format=json&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.length) throw new Error("Zip code not found");
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  }

  // --- Helper: Query Overpass API ---
  async function fetchNearbyPlaces(lat, lon, categories) {
    const radius = 1000; // meters
    const query = `
      [out:json];
      (
        ${categories.map(cat => `node["amenity"="${cat}"](around:${radius},${lat},${lon});`).join("\n")}
      );
      out center;
    `;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query
    });
    if (!res.ok) throw new Error("Overpass request failed");
    const data = await res.json();
    return data.elements;
  }

  // --- Helper: Show results ---
  function showResults(places, userCoords) {
    resultsLayer.clearLayers();

    if (!places?.length) {
      alert("No nearby places found.");
      return;
    }

    const bounds = [userCoords];
    places.forEach(p => {
      if (!p.lat || !p.lon) return;

      const name = p.tags.name || "Unnamed place";
      const type = p.tags.amenity || "place";
      const cuisine = p.tags.cuisine ? `<br><b>Cuisine:</b> ${p.tags.cuisine}` : "";

      // Map Overpass amenity to our icon set
      let icon = icons.default;
      if (type === "restaurant") icon = icons.restaurant;
      else if (type === "cafe") icon = icons.cafe;
      else if (type === "fast_food") icon = icons.fast_food;

      const marker = L.marker([p.lat, p.lon], { icon }).bindPopup(`
        <b>${name}</b><br>${type}${cuisine}
      `);

      resultsLayer.addLayer(marker);
      bounds.push([p.lat, p.lon]);
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });

    // Re-render Lucide icons after Leaflet adds them to DOM
    lucide.createIcons();
  }

  // --- Helper: Show user location ---
  function showUserLocation(lat, lon) {
    userLayer.clearLayers();

    const userMarker = L.divIcon({
      className: "lucide-marker",
      html: `<i data-lucide="map-pin" style="color:#1e90ff; width:28px; height:28px;"></i>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    L.marker([lat, lon], { icon: userMarker }).bindPopup("You are here").addTo(userLayer);

    // Re-render Lucide icons for user marker too
    lucide.createIcons();
  }

  // --- Handle form submission ---
  const form = document.getElementById("scoutForm");
  const zipInput = document.getElementById("zipInput");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const zip = zipInput.value.trim();
    const categories = Array.from(
      form.querySelectorAll(".filters input:checked")
    ).map(cb => cb.value);

    try {
      let coords;

      // Try to use geolocation
      coords = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject();
        navigator.geolocation.getCurrentPosition(
          pos => resolve([pos.coords.latitude, pos.coords.longitude]),
          () => reject()
        );
      }).catch(() => null);

      // Fallback to ZIP geocoding
      if (!coords) coords = await geocodeZip(zip);

      const [lat, lon] = coords;
      showUserLocation(lat, lon);
      map.setView([lat, lon], 14);

      const places = await fetchNearbyPlaces(lat, lon, categories);
      showResults(places, [lat, lon]);
    } catch (err) {
      console.error(err);
      alert("Failed to find nearby restaurants. Please try again.");
    }
  });

  // --- Auto locate on load (optional) ---
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 14);
        showUserLocation(latitude, longitude);
      },
      () => {
        console.warn("User location unavailable — using default map center.");
      }
    );
  }
});
