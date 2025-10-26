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

  // --- Custom icon factory ---
  function makeIcon(iconUrl, size = [32, 32]) {
    return L.icon({
      iconUrl,
      iconSize: size,
      iconAnchor: [size[0] / 2, size[1]], // anchor at bottom center
      popupAnchor: [0, -size[1] + 4],
      className: "map-icon"
    });
  }

  // --- Food category icons (you can replace URLs with your own assets) ---
  const icons = {
    restaurant: makeIcon("https://cdn-icons-png.flaticon.com/128/3170/3170733.png"), // fork & knife
    cafe: makeIcon("https://cdn-icons-png.flaticon.com/128/13888/13888476.png"), // coffee cup
    fast_food: makeIcon("https://cdn-icons-png.flaticon.com/128/5787/5787016.png"), // burger
    default: makeIcon("https://cdn-icons-png.flaticon.com/128/149/149059.png") // map pin
  };

  const userIcon = makeIcon("https://cdn-icons-png.flaticon.com/128/149/149060.png", [28, 28]);

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
    const radius = 1000;  // search radius
    if (!categories?.length) categories = ["restaurant", "cafe", "fast_food"];

    const query = `
      [out:json];
      (
        ${categories.map(cat => `
          node["amenity"="${cat}"](around:${radius},${lat},${lon});
          way["amenity"="${cat}"](around:${radius},${lat},${lon});
          relation["amenity"="${cat}"](around:${radius},${lat},${lon});
        `).join("\n")}
      );
      out center;
    `;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query
    });

    if (!res.ok) throw new Error("Overpass request failed");
    const data = await res.json();

    console.log("Found places:", data.elements.length);
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
  }

  // --- Helper: Show user location ---
  function showUserLocation(lat, lon) {
    userLayer.clearLayers();
    L.marker([lat, lon], { icon: userIcon })
      .bindPopup("You are here")
      .addTo(userLayer);
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

      if (zip) {
        // Use ZIP if user entered one
        coords = await geocodeZip(zip);
      } else {
        // Otherwise use geolocation
        coords = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject();
          navigator.geolocation.getCurrentPosition(
            pos => resolve([pos.coords.latitude, pos.coords.longitude]),
            () => reject()
          );
        });
      }

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
      async pos => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 14);
        showUserLocation(latitude, longitude);

        // Auto-fetch restaurants, cafes, etc.
        const defaultCategories = ["restaurant", "cafe", "fast_food"];
        try {
          const places = await fetchNearbyPlaces(latitude, longitude, defaultCategories);
          showResults(places, [latitude, longitude]);
        } catch (err) {
          console.error(err);
        }
      },
      () => {
        console.warn("User location unavailable — using default map center.");
      }
    );
  }
});
