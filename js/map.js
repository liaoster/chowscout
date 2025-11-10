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
    default: makeIcon("icons/restaurant.png", [30, 30]),
    restaurant: makeIcon("icons/restaurant.png", [30, 30]),
    cafe: makeIcon("icons/cafe.png", [30, 30]),
    fast_food: makeIcon("icons/fast_food.png", [30, 30])
  };

  // const userIcon = makeIcon("https://cdn-icons-png.flaticon.com/128/149/149060.png", [28, 28]);
  const userIcon = makeIcon("icons/user_location.png", [30, 30]);

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

  // --- Query Overpass API for nearby places ---
  async function fetchNearbyPlaces(lat, lon, categories) {
    // Get current map bounds dynamically
    const bounds = map.getBounds();
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    if (!categories?.length) categories = ["restaurant", "cafe", "fast_food"];

    // Overpass bounding box query format: (south,west,north,east)
    const query = `
      [out:json][timeout:25];
      (
        ${categories.map(cat => `
          node["amenity"="${cat}"](${south},${west},${north},${east});
          way["amenity"="${cat}"](${south},${west},${north},${east});
          relation["amenity"="${cat}"](${south},${west},${north},${east});
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

  // --- Show results on map ---
  function showResults(places, userCoords) {
    resultsLayer.clearLayers();

    if (!places?.length) {
      alert("No nearby places found.");
      return;
    }

    // Limit number of displayed places
    const MAX_RESULTS = 50;
    const limitedPlaces = places.slice(0, MAX_RESULTS);

    const bounds = [userCoords];
    limitedPlaces.forEach(p => {
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
    L.marker([lat, lon], { icon: userIcon, zIndexOffset: 100 }).bindPopup("You are here").addTo(userLayer);
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

      setSearching(true);
      const places = await fetchNearbyPlaces(lat, lon, categories);
      showResults(places, [lat, lon]);
      setSearching(false);
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
        setSearching(true);
        const places = await fetchNearbyPlaces(latitude, longitude, ["restaurant","cafe","fast_food"]);
        showResults(places, [latitude, longitude]);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, () => console.warn("User location unavailable — using default map center"));
  }

  // --- Floating "Search This Area" button ---
  const searchHereBtn = document.getElementById("searchHere");
  searchHereBtn.style.display = "none";

  function setSearching(isSearching) {
    const btn = document.getElementById("searchHere");
    if (!btn) return;

    btn.textContent = isSearching ? "Searching..." : "Scout Here";
    btn.disabled = isSearching;
  }

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

      setSearching(true);
      const places = await fetchNearbyPlaces(lat, lon, categories);
      showResults(places, [lat, lon]);
      setSearching(false);

      // Reset button after search
      searchHereBtn.textContent = "Scout Here";
      searchHereBtn.disabled = false;
      searchHereBtn.classList.remove("show");
      searchHereBtn.style.display = "none";
    } catch (err) {
      console.error(err);
      alert("Failed to find nearby places. Try moving the map or zooming out.");
      searchHereBtn.textContent = "Scout Here";
      searchHereBtn.disabled = false;
    }
  });

  // --- Find My Location button ---
  const locateBtn = document.getElementById("locateBtn");

  locateBtn.addEventListener("click", async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    locateBtn.innerHTML = '<i data-lucide="hourglass"></i>'
    lucide.createIcons();

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 14);
        showUserLocation(latitude, longitude);

        try {
          setSearching(true);
          const places = await fetchNearbyPlaces(latitude, longitude, ["restaurant", "cafe", "fast_food"]);
          showResults(places, [latitude, longitude]);
        } catch (err) {
          console.error(err);
          alert("Could not fetch nearby places.");
        } finally {
          setSearching(false);
          locateBtn.innerHTML = '<i data-lucide="locate-fixed"></i>'; // reset to icon
          lucide.createIcons(); // re-render Lucide icon
        }
      },
      () => {
        alert("User location unavailable — using default map center");
        locateBtn.innerHTML = '<i data-lucide="locate-fixed"></i>'; // reset to icon
        lucide.createIcons(); // re-render Lucide icon
      }
    );
  });

});
