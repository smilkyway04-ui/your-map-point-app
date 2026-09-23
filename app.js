// Cloudflare Worker থেকে পাওয়া URL এখানে পেস্ট করুন
const PROXY_URL = "https://black-disk-ce55.smilkyway04.workers.dev/";

let map = null;
let currentMarker = null;
let debounceTimer = null;

// ১. Mappls ম্যাপ শুরু করা
window.initMap = function () {
  if (map) return;

  map = new mappls.Map('map', {
    center: [22.4827, 88.1815], // বজবজ এলাকা
    zoom: 12
  });

  setupMapplsOfficialSearch();
};

// ২. ক্লাউডফ্লেয়ার প্রক্সির মাধ্যমে অফিশিয়াল Mappls সার্চ চালানো
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
        // ক্লাউডফ্লেয়ার ওয়ার্কার কল
        const res = await fetch(`${PROXY_URL}?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        // Mappls এর আসল রেসপন্স থেকে সাজেশনের তালিকা নেওয়া
        const results = data.suggestedLocations || [];

        if (results.length > 0) {
          suggestBox.innerHTML = '';
          results.forEach(item => {
            const li = document.createElement('li');
            const placeName = item.placeName || item.poi || "Unnamed Place";
            const placeAddress = item.placeAddress || "";

            li.innerHTML = `<strong>${placeName}</strong><small>${placeAddress}</small>`;

            li.onclick = () => {
              const lat = parseFloat(item.latitude || item.entryLatitude);
              const lng = parseFloat(item.longitude || item.entryLongitude);

              searchInput.value = placeName;
              suggestBox.style.display = 'none';

              if (!isNaN(lat) && !isNaN(lng)) {
                map.setCenter([lat, lng]);
                map.setZoom(16);

                if (currentMarker) {
                  if (typeof currentMarker.remove === 'function') currentMarker.remove();
                  else if (mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                }

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
        console.error("Worker fetch error:", err);
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
