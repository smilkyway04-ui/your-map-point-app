// আপনার Cloudflare Worker লিঙ্কটি দিন
const PROXY_URL = "https://black-disk-ce55.smilkyway04.workers.dev/";

let map = null;
let currentMarker = null;
let debounceTimer = null;

// ১. Mappls ম্যাপ শুরু করা
window.initMap = function () {
  if (map) return;

  map = new mappls.Map('map', {
    center: [22.4827, 88.1815], // বজবজ
    zoom: 12
  });

  setupMapplsOfficialSearch();
};

// ২. সার্চ ও লোকেশনে পিন ড্রপ
function setupMapplsOfficialSearch() {
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

            // ফলাফলে ক্লিক করার হ্যান্ডলার
            li.onclick = async () => {
              searchInput.value = placeName;
              suggestBox.style.display = 'none';

              // পুরনো মার্কার সরানো
              if (currentMarker) {
                try {
                  if (typeof currentMarker.remove === 'function') {
                    currentMarker.remove();
                  } else if (window.mappls && mappls.remove) {
                    mappls.remove({ map: map, layer: currentMarker });
                  }
                } catch (e) {}
                currentMarker = null;
              }

              let lat = parseFloat(item.latitude || item.entryLatitude);
              let lng = parseFloat(item.longitude || item.entryLongitude);
              const eloc = item.eLoc || item.eloc;

              // Lat/Lng না থাকলে Worker থেকে eLoc দিয়ে আসল স্থানাঙ্ক আনা
              if ((isNaN(lat) || isNaN(lng) || lat === 0) && eloc) {
                try {
                  const elocRes = await fetch(`${PROXY_URL}?eloc=${encodeURIComponent(eloc)}`);
                  const elocData = await elocRes.json();
                  lat = parseFloat(elocData.latitude || elocData.lat);
                  lng = parseFloat(elocData.longitude || elocData.lng);
                } catch (err) {
                  console.error("Error fetching coordinates via eLoc:", err);
                }
              }

              // স্থানাঙ্ক পাওয়া গেলে ম্যাপ সরানো ও মার্কার বসানো
              if (!isNaN(lat) && !isNaN(lng)) {
                map.setCenter([lat, lng]);
                map.setZoom(16);

                currentMarker = new mappls.Marker({
                  map: map,
                  position: { lat: lat, lng: lng }
                });
              } else {
                console.error("Coordinates could not be found for this location.");
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
