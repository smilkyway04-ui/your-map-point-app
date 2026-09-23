// আপনার Cloudflare Worker লিঙ্কটি এখানে রাখুন
const PROXY_URL = "https://black-disk-ce55.smilkyway04.workers.dev/"; // আপনার সঠিক সাবডোমেন দিন

console.log("==> নতুন APP.JS সফলভাবে চালু হয়েছে (VERSION 99) <==");

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

// ২. Mappls অফিশিয়াল সার্চ এবং মার্কার লজিক
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

            // ফলাফলে ক্লিক করলে এক্স্যাক্ট লোকেশনে যাওয়ার নিরাপদ কোড
            li.onclick = async () => {
              searchInput.value = placeName;
              suggestBox.style.display = 'none';

              console.log("ক্লিক করা হয়েছে:", placeName);

              // পুরনো মার্কার সরানো
              if (currentMarker) {
                try {
                  if (typeof currentMarker.remove === 'function') currentMarker.remove();
                  else if (window.mappls && mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                } catch (e) {}
                currentMarker = null;
              }

              let lat = parseFloat(item.latitude || item.entryLatitude);
              let lng = parseFloat(item.longitude || item.entryLongitude);

              // Mappls সরাসরি Lat/Lng না পাঠালে জায়গার নাম দিয়ে তাৎক্ষণিক স্থানাঙ্ক সংগ্রহ
              if (isNaN(lat) || isNaN(lng) || lat === 0) {
                console.log("Mappls স্থানাঙ্ক দেয়নি, সঠিক Lat/Lng বের করা হচ্ছে...");
                try {
                  // নাম ও ঠিকানা দিয়ে জিওকোডিং
                  const searchQuery = `${placeName} ${placeAddress}`.replace(/,/g, ' ');
                  let geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`);
                  let geoData = await geoRes.json();

                  // ঠিকানা না পেলে শুধু নাম দিয়ে চেষ্টা
                  if (!geoData || geoData.length === 0) {
                    geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName + ' South 24 Parganas')}&format=json&limit=1`);
                    geoData = await geoRes.json();
                  }

                  if (geoData && geoData.length > 0) {
                    lat = parseFloat(geoData[0].lat);
                    lng = parseFloat(geoData[0].lon);
                  }
                } catch (err) {
                  console.error("Geocoding error:", err);
                }
              }

              // সঠিক সংখ্যা পেয়ে গেলে ম্যাপ সেন্টারিং ও মার্কার তৈরি
              if (!isNaN(lat) && !isNaN(lng)) {
                console.log("মার্কার বসানো হচ্ছে:", lat, lng);

                map.setCenter([lat, lng]);
                map.setZoom(16);

                currentMarker = new mappls.Marker({
                  map: map,
                  position: { lat: lat, lng: lng }
                });
              } else {
                console.error("এই জায়গার স্থানাঙ্ক উদ্ধার করা যায়নি।");
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
