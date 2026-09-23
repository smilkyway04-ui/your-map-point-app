// আপনার Cloudflare Worker লিঙ্ক
const PROXY_URL = "https://black-disk-ce55.smilkyway04.workers.dev/";

let map = null;
let currentMarker = null;
let debounceTimer = null;

// ১. Mappls ম্যাপ শুরু করা (সঠিক অর্ডারে বজবজ)
window.initMap = function () {
  if (map) return;

  map = new mappls.Map('map', {
    center: [88.1815, 22.4827], // [Longitude, Latitude]
    zoom: 12
  });

  setupMapplsSearch();
};

// ২. সার্চ ও সঠিক স্থানে মার্কার বসানো
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

            // ফলাফলে ক্লিকে বজবজ কলেজে যাওয়ার লজিক
            li.onclick = async () => {
              searchInput.value = placeName;
              suggestBox.style.display = 'none';

              let lat = parseFloat(item.latitude || item.entryLatitude);
              let lng = parseFloat(item.longitude || item.entryLongitude);
              const eloc = item.eLoc || item.eloc;

              // ক্লাউডফ্লেয়ার থেকে স্থানাঙ্ক সংগ্রহ
              if ((isNaN(lat) || isNaN(lng) || !lat) && eloc) {
                try {
                  const elocRes = await fetch(`${PROXY_URL}?eloc=${encodeURIComponent(eloc)}`);
                  const elocData = await elocRes.json();
                  if (elocData && elocData.latitude && elocData.longitude) {
                    lat = parseFloat(elocData.latitude);
                    lng = parseFloat(elocData.longitude);
                  }
                } catch (err) {
                  console.error("Worker fetch error:", err);
                }
              }

              // সঠিক স্থানাঙ্ক পেয়ে গেলে ম্যাপ সেন্টারিং ও মার্কার তৈরি
              if (!isNaN(lat) && !isNaN(lng)) {
                // পুরনো মার্কার সরানো
                if (currentMarker) {
                  try {
                    if (typeof currentMarker.remove === 'function') currentMarker.remove();
                    else if (window.mappls && mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                  } catch (e) {}
                  currentMarker = null;
                }

                // ভেক্টর ম্যাপের জন্য সঠিক অর্ডার: [lng, lat]
                if (map.flyTo) {
                  map.flyTo({
                    center: [lng, lat],
                    zoom: 16,
                    essential: true
                  });
                } else if (map.setCenter) {
                  map.setCenter([lng, lat]);
                  map.setZoom(16);
                }

                // মার্কার বসানোর জন্য { lat, lng }
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
