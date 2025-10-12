// Wait until the page is fully loaded
document.addEventListener("DOMContentLoaded", () => {

  // Try to get user's current location
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;

      // Initialize the Leaflet map centered on user's location
      const map = L.map("map").setView([latitude, longitude], 14);

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      // Add a marker at the user's location
      L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup("You are here!")
        .openPopup();
    },

    // Handle location errors (e.g. permission denied)
    (error) => {
      console.error("Geolocation error:", error);
      alert("Unable to retrieve your location. Please allow location access and refresh the page.");
    }
  );
});
