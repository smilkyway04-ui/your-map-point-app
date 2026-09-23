// আপনার Cloudflare Worker URL
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

  setupMapplsSearch();
};

// ২. সার্চ ও মার্কার ড্রপ লজিক
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

            // রেজাল্টে ক্লিক করলে মার্কার বসানো
            li.onclick = async () => {
              searchInput.value = placeName;
              suggestBox.style.display = 'none';

              let lat = parseFloat(item.latitude || item.entryLatitude);
              let lng = parseFloat(item.longitude || item.entryLongitude);
              const eloc = item.eLoc || item.eloc;

              // ধাপ ক: eLoc দিয়ে Mappls থেকে স্থানাঙ্ক আনার চেষ্টা
              if ((isNaN(lat) || isNaN(lng) || lat === 0) && eloc) {
                try {
                  const elocRes = await fetch(`${PROXY_URL}?eloc=${encodeURIComponent(eloc)}`);
                  const elocData = await elocRes.json();
                  const loc = Array.isArray(elocData) ? elocData[0] : (elocData.data && Array.isArray(elocData.data) ? elocData.data[0] : elocData);
                  if (loc) {
                    lat = parseFloat(loc.latitude || loc.lat || loc.entryLatitude);
                    lng = parseFloat(loc.longitude || loc.lng || loc.entryLongitude);
                  }
                } catch (e) {}
              }

              // ধাপ খ: Mappls ব্যর্থ হলে স্মার্ট ব্যাকআপ জিওকোডিং (নাম + জেলা দিয়ে দ্রুত স্থানাঙ্ক উদ্ধার)
              if (isNaN(lat) || isNaN(lng) || lat === 0) {
                try {
                  const cleanName = placeName.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
                  const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanName + ' West Bengal')}&format=json&limit=1`);
                  const geoData = await geoRes.json();
                  if (geoData && geoData.length > 0) {
                    lat = parseFloat(geoData[0].lat);
                    lng = parseFloat(geoData[0].lon);
                  }
                } catch (e) {}
              }

              // ধাপ গ: স্থানাঙ্ক পেলে ম্যাপ সেন্টার ও মার্কার তৈরি
              if (!isNaN(lat) && !isNaN(lng)) {
                // পুরনো মার্কার সরানো
                if (currentMarker) {
                  try {
                    if (typeof currentMarker.remove === 'function') currentMarker.remove();
                    else if (window.mappls && mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                  } catch (e) {}
                  currentMarker = null;
                }

                // ম্যাপে জাম্প করা
                map.setCenter([lat, lng]);
                map.setZoom(16);

                // নতুন মার্কার বসানো (Capital 'Marker')
                currentMarker = new mappls.Marker({
                  map: map,
                  position: { lat: lat, lng: lng }
                });
              } else {
                console.error("No coordinates found for:", placeName);
              }
            };

            suggestBox.appendChild(li);
          });
          suggestBox.style.display = 'block';
        } else {
          suggestBox.style.display = 'none';
        }
      } catch (err) {
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
