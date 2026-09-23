// আপনার Cloudflare Worker লিঙ্ক
const PROXY_URL = "https://black-disk-ce55.smilkyway04.workers.dev/";

console.log("==> FINAL VERSION 101 LOADED <==");

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

// ২. সার্চ ও স্বয়ংক্রিয় মার্কার লজিক
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

            // ফলাফলে ক্লিক হ্যান্ডলার
            li.onclick = async () => {
              searchInput.value = placeName;
              suggestBox.style.display = 'none';

              let lat = parseFloat(item.latitude || item.entryLatitude);
              let lng = parseFloat(item.longitude || item.entryLongitude);
              const eloc = item.eLoc || item.eloc;

              // ক্লাউডফ্লেয়ার থেকে স্থানাঙ্ক নেওয়া
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

              console.log("পিন বসানো হচ্ছে:", lat, lng);

              // স্থানাঙ্ক পাওয়া গেলে মার্কার তৈরি ও ক্যামেরা মুভ
              if (!isNaN(lat) && !isNaN(lng)) {
                // পুরনো মার্কার সরানো
                if (currentMarker) {
                  try {
                    if (typeof currentMarker.remove === 'function') currentMarker.remove();
                    else if (window.mappls && mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                  } catch (e) {}
                  currentMarker = null;
                }

                // fitbounds: true দিলে Mappls নিজে থেকে ম্যাপ সেন্টার ও জুম করে নেয়
                currentMarker = new mappls.Marker({
                  map: map,
                  position: { lat: lat, lng: lng },
                  fitbounds: true,
                  fitboundOptions: { maxZoom: 16 }
                });
              } else {
                alert("এই লোকেশনের স্থানাঙ্ক পাওয়া যায়নি!");
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
