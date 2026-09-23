// আপনার Cloudflare Worker লিঙ্ক
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

// ২. সার্চ ও ক্লিকে মার্কার বসানো
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

            // রেজাল্টে ক্লিকে সরাসরি স্থানাঙ্ক ব্যবহার
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
                  console.error("Worker coordinate fetch error:", err);
                }
              }

              // ম্যাপ নির্দিষ্ট পয়েন্টে নিয়ে যাওয়া ও মার্কার ড্রপ
              if (!isNaN(lat) && !isNaN(lng)) {
                if (currentMarker) {
                  try {
                    if (typeof currentMarker.remove === 'function') currentMarker.remove();
                    else if (window.mappls && mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                  } catch (e) {}
                  currentMarker = null;
                }

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
