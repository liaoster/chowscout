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
      iconAnchor: [size[0] / 2, size[1]],
      popupAnchor: [0, -size[1] + 4],
      className: "map-icon"
    });
  }

  // --- Food category icons ---
  const icons = {
    restaurant: makeIcon("https://cdn-icons-png.flaticon.com/128/3170/3170733.png"),
    cafe: makeIcon("https://cdn-icons-png.flaticon.com/128/13888/13888476.png"),
    fast_food: makeIcon("https://cdn-icons-png.flaticon.com/128/5787/5787016.png"),
    default: makeIcon("https://cdn-icons-png.flaticon.com/128/149/149059.png")
  };

  const userIcon = makeIcon("https://cdn-icons-png.flaticon.com/128/149/149060.png", [28, 28]);

  // --- Helper: Convert ZIP to coordinates (Nominatim) ---
  async function geocodeZip(zip) {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=us&format=json&limit=1`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch geocode");
      const data = await res.json();
      if (!data.length) throw new Error("Zip code not found");
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch (err) {
      console.error(err);
      throw new Error("Failed to geocode ZIP code");
    }
  }

  // --- Helper: Query Overpass API ---
  async function fetchNearbyPlaces(lat, lon, categories) {
    const radius = 1000;
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
      const lat = p.lat ?? p.center?.lat;
      const lon = p.lon ?? p.center?.lon;
      if (!lat || !lon) return;

      const name = p.tags.name || "Unnamed place";
      const type = p.tags.amenity || "place";
      const cuisine = p.tags.cuisine ? `<br><b>Cuisine:</b> ${p.tags.cuisine}` : "";

      let icon = icons.default;
      if (type === "restaurant") icon = icons.restaurant;
      else if (type === "cafe") icon = icons.cafe;
      else if (type === "fast_food") icon = icons.fast_food;

      const marker = L.marker([lat, lon], { icon }).bindPopup(`<b>${name}</b><br>${type}${cuisine}`);
      resultsLayer.addLayer(marker);
      bounds.push([lat, lon]);
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
  }

  // --- Show user location ---
  function showUserLocation(lat, lon) {
    userLayer.clearLayers();
    L.marker([lat, lon], { icon: userIcon }).bindPopup("You are here").addTo(userLayer);
  }

  // --- Handle form submission ---
  const form = document.getElementById("scoutForm");
  const zipInput = document.getElementById("zipInput");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    let categories = Array.from(form.querySelectorAll(".filters input:checked")).map(cb => cb.value);
    if (!categories.length) categories = ["restaurant", "cafe", "fast_food"];

    try {
      let coords;
      const zip = zipInput.value.trim();
      coords = zip ? await geocodeZip(zip) :
        await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject();
          navigator.geolocation.getCurrentPosition(
            pos => resolve([pos.coords.latitude, pos.coords.longitude]),
            () => reject()
          );
        });

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

  // --- Auto locate on load ---
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 14);
      showUserLocation(latitude, longitude);

      try {
        const places = await fetchNearbyPlaces(latitude, longitude, ["restaurant","cafe","fast_food"]);
        showResults(places, [latitude, longitude]);
      } catch (err) {
        console.error(err);
      }
    }, () => console.warn("User location unavailable — using default map center."));
  }

  // --- Floating "Search This Area" button ---
  const searchHereBtn = document.getElementById("searchHere");
  searchHereBtn.style.display = "none";

  // Show button immediately
  searchHereBtn.style.display = "block"; // make visible
  searchHereBtn.classList.add("show"); // apply CSS fade/opacity effect

  // Show button after map is moved
  map.on("moveend", () => {
    searchHereBtn.classList.add("show");
    searchHereBtn.style.display = "block";
  });

  searchHereBtn.addEventListener("click", async () => {
    try {
      const center = map.getCenter();
      const lat = center.lat;
      const lon = center.lng;

      let categories = Array.from(form.querySelectorAll(".filters input:checked")).map(cb => cb.value);
      if (!categories.length) categories = ["restaurant", "cafe", "fast_food"];

      searchHereBtn.textContent = "Searching...";
      searchHereBtn.disabled = true;

      const places = await fetchNearbyPlaces(lat, lon, categories);
      showResults(places, [lat, lon]);

      // Reset button after search
      searchHereBtn.textContent = "Scount Here";
      searchHereBtn.disabled = false;
      searchHereBtn.classList.remove("show");
      searchHereBtn.style.display = "none";
    } catch (err) {
      console.error(err);
      alert("Failed to find nearby places. Try moving the map or zooming out.");
      searchHereBtn.textContent = "Scount Here";
      searchHereBtn.disabled = false;
    }
  });
});
