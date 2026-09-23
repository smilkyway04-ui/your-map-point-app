// আপনার Cloudflare Worker লিঙ্ক
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

  setupMapplsSearch();
};

// ২. সার্চ ও স্বয়ংক্রিয় মার্কার বসানো
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

              console.log("ক্লিক করা হয়েছে:", placeName);

              let lat = parseFloat(item.latitude || item.entryLatitude);
              let lng = parseFloat(item.longitude || item.entryLongitude);
              const eloc = item.eLoc || item.eloc;

              // পদ্ধতি ১: ক্লাউডফ্লেয়ার দিয়ে Mappls eLoc থেকে স্থানাঙ্ক আনার চেষ্টা
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

              // পদ্ধতি ২: দ্রুত ও নির্ভুল ওপেন সোর্স জিওকোডার (শুধুমাত্র মূল নাম দিয়ে সার্চ)
              if (isNaN(lat) || isNaN(lng) || lat === 0) {
                console.log("বিকল্প পদ্ধতিতে স্থানাঙ্ক বের করা হচ্ছে...");
                try {
                  // জটিল ঠিকানা বাদ দিয়ে শুধু নাম দিয়ে সার্চ
                  const cleanName = placeName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
                  const geoRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(cleanName)}&lat=22.4827&lon=88.1815&limit=1`);
                  const geoData = await geoRes.json();

                  if (geoData && geoData.features && geoData.features.length > 0) {
                    const coords = geoData.features[0].geometry.coordinates;
                    lng = parseFloat(coords[0]);
                    lat = parseFloat(coords[1]);
                  }
                } catch (e) {
                  console.error("Photon geocoding error:", e);
                }
              }

              // পদ্ধতি ৩: চূড়ান্ত ব্যাকআপ (বজবজ কেন্দ্রিক)
              if (isNaN(lat) || isNaN(lng) || lat === 0) {
                lat = 22.4827;
                lng = 88.1815;
              }

              console.log("সফল স্থানাঙ্ক পাওয়া গেছে:", lat, lng);

              // পুরনো মার্কার সরানো
              if (currentMarker) {
                try {
                  if (typeof currentMarker.remove === 'function') currentMarker.remove();
                  else if (window.mappls && mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                } catch (e) {}
                currentMarker = null;
              }

              // ম্যাপ নির্দিষ্ট পয়েন্টে নিয়ে যাওয়া
              map.setCenter([lat, lng]);
              map.setZoom(16);

              // মার্কার বসানো (ক্যাপিটাল 'Marker' ব্যবহার করে)
              currentMarker = new mappls.Marker({
                map: map,
                position: { lat: lat, lng: lng }
              });
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
