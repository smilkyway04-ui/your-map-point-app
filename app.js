// আপনার ক্লাউডফ্লেয়ার ওয়ার্কারের লিঙ্কটি এখানে রাখুন
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

// ২. অফিশিয়াল Mappls সার্চ ও লোকেশনে জাম্প করার লজিক
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

            // ক্লিকের নিখুঁত ইভেন্ট
            li.onclick = () => {
              console.log("Selected Item Data:", item);

              searchInput.value = placeName;
              suggestBox.style.display = 'none';

              // ১. পুরনো মার্কার থাকলে সরানো
              if (currentMarker) {
                try {
                  if (typeof currentMarker.remove === 'function') {
                    currentMarker.remove();
                  } else if (window.mappls && mappls.remove) {
                    mappls.remove({ map: map, layer: currentMarker });
                  }
                } catch (err) {
                  console.warn("Marker removal warning:", err);
                }
                currentMarker = null;
              }

              // ২. ডেটা থেকে মানগুলো সংগ্রহ করা
              const lat = parseFloat(item.latitude || item.entryLatitude);
              const lng = parseFloat(item.longitude || item.entryLongitude);
              const eloc = item.eLoc || item.eloc;

              // পদ্ধতি ক: যদি রেজাল্টে সরাসরি Lat/Lng থাকে
              if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
                console.log("Moving via Coordinates:", lat, lng);
                map.setCenter([lat, lng]);
                map.setZoom(16);

                currentMarker = new mappls.Marker({
                  map: map,
                  position: { lat: lat, lng: lng },
                  fitbounds: true
                });
              } 
              // পদ্ধতি খ: যদি Mappls-এর অফিশিয়াল eLoc পিন থাকে (সবচেয়ে কার্যকর)
              else if (eloc) {
                console.log("Moving via Mappls eLoc Pin:", eloc);
                currentMarker = new mappls.Marker({
                  map: map,
                  position: { pin: eloc },
                  fitbounds: true // এটি দিলে Mappls নিজে থেকেই ম্যাপ ওই জায়গায় জুম করে নেয়
                });
              } else {
                console.error("Neither Lat/Lng nor eLoc found in item:", item);
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

  // সার্চ বক্সের বাইরে ক্লিক করলে ড্রপডাউন বন্ধ হওয়া
  document.addEventListener('click', (e) => {
    if (!searchInput.parentElement.contains(e.target)) {
      suggestBox.style.display = 'none';
    }
  });
}
