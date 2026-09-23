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
    zoom: 13
  });

  setupMapplsSearch();
};

// ২. সার্চ ও নিখুঁত মার্কার বসানো
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

              // পুরনো মার্কার সরানো
              if (currentMarker) {
                try {
                  if (typeof currentMarker.remove === 'function') currentMarker.remove();
                  else if (window.mappls && mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                } catch (e) {}
                currentMarker = null;
              }

              const eloc = item.eLoc || item.eloc;

              // পদ্ধতি ১: Mappls প্লাগইন দিয়ে সরাসরি eLoc পিন (১০০% নিখুঁত কলেজ পয়েন্ট)
              if (window.mappls && typeof mappls.pinMarker === 'function' && eloc) {
                console.log("Mappls প্লাগইন দিয়ে আসল পয়েন্টে মার্কার বসানো হচ্ছে:", eloc);
                currentMarker = mappls.pinMarker({
                  map: map,
                  pin: eloc,
                  popupHtml: `<strong>${placeName}</strong><br><small>${placeAddress}</small>`,
                  fitbounds: true,
                  fitboundOptions: { maxZoom: 17 }
                });
                return;
              }

              // পদ্ধতি ২: ব্যাকআপ স্থানাঙ্ক পদ্ধতি
              let lat = parseFloat(item.latitude || item.entryLatitude);
              let lng = parseFloat(item.longitude || item.entryLongitude);

              if (isNaN(lat) || isNaN(lng) || !lat) {
                try {
                  const elocRes = await fetch(`${PROXY_URL}?eloc=${encodeURIComponent(eloc)}`);
                  const elocData = await elocRes.json();
                  if (elocData && elocData.latitude && elocData.longitude) {
                    lat = parseFloat(elocData.latitude);
                    lng = parseFloat(elocData.longitude);
                  }
                } catch (e) {}
              }

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
