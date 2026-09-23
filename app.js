// আপনার Cloudflare Worker URL
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

// ২. সার্চ ও ক্লিকে ম্যাপে যাওয়া
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

            // ক্লিকে নির্দিষ্ট জায়গায় যাওয়ার নিখুঁত লজিক
            li.onclick = () => {
              console.log("Selected Item:", item);

              searchInput.value = placeName;
              suggestBox.style.display = 'none';

              // অক্ষাংশ ও দ্রাঘিমাংশ সংগ্রহ
              const lat = parseFloat(item.latitude || item.entryLatitude);
              const lng = parseFloat(item.longitude || item.entryLongitude);

              console.log("Moving to:", lat, lng);

              if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
                // ১. সঠিক অর্ডারে ম্যাপকে স্মুথভাবে সেই জায়গায় নিয়ে যাওয়া [lng, lat]
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

                // ২. আগের মার্কার থাকলে নিরাপদে সরানো
                if (currentMarker) {
                  try {
                    if (typeof currentMarker.remove === 'function') {
                      currentMarker.remove();
                    } else if (window.mappls && mappls.remove) {
                      mappls.remove({ map: map, layer: currentMarker });
                    }
                  } catch (e) {
                    console.warn("Marker removal warning:", e);
                  }
                  currentMarker = null;
                }

                // ৩. নতুন মার্কার বসানো
                try {
                  currentMarker = new mappls.Marker({
                    map: map,
                    position: { lat: lat, lng: lng }
                  });
                } catch (err) {
                  console.error("Marker error:", err);
                }
              } else {
                console.error("No valid coordinates found in this item:", item);
              }
            };

            suggestBox.appendChild(li);
          });
          suggestBox.style.display = 'block';
        } else {
          suggestBox.style.display = 'none';
        }
      } catch (err) {
        console.error("Search error:", err);
        suggestBox.style.display = 'none';
      }
    }, 300);
  });

  // সার্চ বক্সের বাইরে ক্লিক করলে ড্রপডাউন বন্ধ করা
  document.addEventListener('click', (e) => {
    if (!searchInput.parentElement.contains(e.target)) {
      suggestBox.style.display = 'none';
    }
  });
}
