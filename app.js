// Apnar Cloudflare Worker URL
const PROXY_URL = "https://black-disk-ce55.smilkyway04.workers.dev/";

console.log("==> FINAL PIN-MARKER VERSION 102 LOADED <==");

let map = null;
let currentMarker = null;
let debounceTimer = null;

// 1. Mappls map load
window.initMap = function () {
  if (map) return;

  map = new mappls.Map('map', {
    center: [22.4827, 88.1815], // Budge Budge
    zoom: 13
  });

  setupMapplsSearch();
};

// 2. Search & Exact Pin Drop
function setupMapplsSearch() {
  const searchInput = document.getElementById('searchInput');
  const suggestBox = document.getElementById('suggestBox');

  if (!searchInput || !suggestBox) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 2) {
      suggestBox.style.display = 'none';
      suggestBox.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`${PROXY_URL}?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        const results = data.suggestedLocations || [];

        if (results.length > 0) {
          suggestBox.innerHTML = '';
          results.forEach(item => {
            const li = document.createElement('li');
            const placeName = item.placeName || item.poi || "Unnamed Place";
            const placeAddress = item.placeAddress || "";

            li.innerHTML = `<strong>${placeName}</strong><small>${placeAddress}</small>`;

            // Result-e click event
            li.onclick = async () => {
              searchInput.value = placeName;
              suggestBox.style.display = 'none';

              console.log("Clicked Item:", placeName, item);

              // Purono marker remove
              if (currentMarker) {
                try {
                  if (typeof currentMarker.remove === 'function') currentMarker.remove();
                  else if (window.mappls && mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                } catch (e) {}
                currentMarker = null;
              }

              const eloc = item.eLoc || item.eloc;

              // UPAY 1: Mappls Official pinMarker (100% Exact Building Location)
              if (typeof mappls.pinMarker === 'function' && eloc) {
                console.log("Using official mappls.pinMarker for eLoc:", eloc);
                try {
                  currentMarker = mappls.pinMarker({
                    map: map,
                    pin: eloc,
                    popupHtml: `<strong>${placeName}</strong><br><small>${placeAddress}</small>`
                  });
                  return; // Mappls nijei map-ke oi college-e niye giye marker fele debe!
                } catch (err) {
                  console.warn("pinMarker error, trying coordinates fallback:", err);
                }
              }

              // UPAY 2: Street-level smart fallback (Gram-er moddhe na fele rasta/college point-e felbe)
              let lat = parseFloat(item.latitude || item.entryLatitude);
              let lng = parseFloat(item.longitude || item.entryLongitude);

              if (isNaN(lat) || isNaN(lng) || !lat) {
                try {
                  const streetQuery = `${placeName}, Budge Budge`;
                  const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(streetQuery)}&format=json&limit=1`);
                  const geoData = await geoRes.json();

                  if (geoData && geoData.length > 0 && geoData[0].type !== 'administrative') {
                    lat = parseFloat(geoData[0].lat);
                    lng = parseFloat(geoData[0].lon);
                  } else {
                    // Street fallback: Deshbandhu Chittaranjan Das Road, Budge Budge
                    const roadRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent('Deshbandhu Chittaranjan Das Road Budge Budge')}&format=json&limit=1`);
                    const roadData = await roadRes.json();
                    if (roadData && roadData.length > 0) {
                      lat = parseFloat(roadData[0].lat);
                      lng = parseFloat(roadData[0].lon);
                    }
                  }
                } catch (err) {
                  console.error("Fallback error:", err);
                }
              }

              // Direct Coordinate Marker Drop
              if (!isNaN(lat) && !isNaN(lng)) {
                map.setCenter([lat, lng]);
                map.setZoom(16);

                currentMarker = new mappls.Marker({
                  map: map,
                  position: { lat: lat, lng: lng }
                });
              }
            };

            suggestBox.appendChild(li);
          });
          suggestBox.style.display = 'block';
        } else {
          suggestBox.style.display = 'none';
        }
      } catch (err) {
        console.error("Search fetch error:", err);
        suggestBox.style.display = 'none';
      }
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.parentElement.contains(e.target)) {
      suggestBox.style.display = 'none';
    }
  });
}
