// আপনার Cloudflare Worker URL এখানে দিন
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

// ২. সার্চ ও ক্লিকে মার্কার বসানোর লজিক
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

            // ফলাফলে ক্লিক ইভেন্ট
            li.onclick = async () => {
              searchInput.value = placeName;
              suggestBox.style.display = 'none';

              let lat = parseFloat(item.latitude || item.entryLatitude);
              let lng = parseFloat(item.longitude || item.entryLongitude);
              const eloc = item.eLoc || item.eloc;

              // পদ্ধতি ১: Worker দিয়ে Mappls eLoc থেকে স্থানাঙ্ক সংগ্রহ
              if ((isNaN(lat) || isNaN(lng) || lat === 0) && eloc) {
                try {
                  console.log("Fetching exact Lat/Lng for eLoc:", eloc);
                  const elocRes = await fetch(`${PROXY_URL}?eloc=${encodeURIComponent(eloc)}`);
                  const elocData = await elocRes.json();
                  lat = parseFloat(elocData.latitude || elocData.lat);
                  lng = parseFloat(elocData.longitude || elocData.lng);
                } catch (e) {
                  console.warn("eLoc fetch warning:", e);
                }
              }

              // পদ্ধতি ২: যদি eLoc থেকে কোনো কারণে স্থানাঙ্ক না আসে, তবে ঠিকানা দিয়ে তাৎক্ষণিক ব্যাকআপ সংগ্রহ
              if (isNaN(lat) || isNaN(lng) || lat === 0) {
                try {
                  const cleanQuery = `${placeName}, ${placeAddress}`.replace(/,/g, ' ');
                  const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&limit=1`);
                  const geoData = await geoRes.json();
                  if (geoData && geoData.length > 0) {
                    lat = parseFloat(geoData[0].lat);
                    lng = parseFloat(geoData[0].lon);
                  }
                } catch (e) {
                  console.warn("Fallback geocoding warning:", e);
                }
              }

              // স্থানাঙ্ক পাওয়া গেলে ম্যাপ সরানো ও মার্কার বসানো
              if (!isNaN(lat) && !isNaN(lng)) {
                console.log("Moving map to Coordinates:", lat, lng);

                // পুরনো মার্কার সরানো
                if (currentMarker) {
                  try {
                    if (typeof currentMarker.remove === 'function') currentMarker.remove();
                    else if (window.mappls && mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                  } catch (err) {}
                  currentMarker = null;
                }

                // ম্যাপ নির্দিষ্ট পয়েন্টে নিয়ে যাওয়া
                map.setCenter([lat, lng]);
                map.setZoom(16);

                // মার্কার বসানো
                currentMarker = new mappls.Marker({
                  map: map,
                  position: { lat: lat, lng: lng }
                });
              } else {
                console.error("Coordinates could not be found for:", placeName);
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
