let map = null;
let currentMarker = null;
let debounceTimer = null;

// ১. Mappls ম্যাপ শুরু করা
window.initMap = function () {
  if (map) return;

  map = new mappls.Map('map', {
    center: [22.4827, 88.1815], // Budge Budge
    zoom: 12
  });

  setupSmartSearch();
};

// ২. নির্ভরযোগ্য স্মার্ট সার্চ ইঞ্জিন (CORS বা টোকেন ছাড়া)
function setupSmartSearch() {
  const searchInput = document.getElementById('searchInput');
  const suggestBox = document.getElementById('suggestBox');

  if (!searchInput || !suggestBox) return;

  searchInput.addEventListener('input', (e) => {
    const rawQuery = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (rawQuery.length < 2) {
      suggestBox.style.display = 'none';
      suggestBox.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        // "Budge Budge 2 BDO" লিখলে সঠিক কি-ওয়ার্ড ফিল্টার
        let q = rawQuery.replace(/\bbdo\b/gi, '').trim();
        if (/\b2\b/.test(q)) {
          q = q.replace(/\b2\b/g, 'II');
        }

        // Photon/OSM High-Speed Search (CORS ফ্রি)
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=22.4827&lon=88.1815&limit=6`;
        const res = await fetch(url);
        const data = await res.json();

        if (data && data.features && data.features.length > 0) {
          suggestBox.innerHTML = '';
          data.features.forEach(feature => {
            const props = feature.properties;
            const coords = feature.geometry.coordinates; // [lng, lat]

            const name = props.name || props.street || q;
            const details = [props.district, props.city, props.state].filter(Boolean).join(', ');

            const li = document.createElement('li');
            li.innerHTML = `<strong>${name}</strong><small>${details}</small>`;

            li.onclick = () => {
              const lng = coords[0];
              const lat = coords[1];

              searchInput.value = name;
              suggestBox.style.display = 'none';

              // Mappls ম্যাপ নির্দিষ্ট স্থানে নিয়ে যাওয়া
              if (map) {
                map.setCenter([lat, lng]);
                map.setZoom(15);

                // আগের মার্কার সরানো
                if (currentMarker) {
                  if (typeof currentMarker.remove === 'function') currentMarker.remove();
                  else if (mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                }

                // নতুন মার্কার বসানো
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
    }, 250);
  });

  // বাইরে ক্লিক করলে তালিকা বন্ধ হওয়া
  document.addEventListener('click', (e) => {
    if (!searchInput.parentElement.contains(e.target)) {
      suggestBox.style.display = 'none';
    }
  });
}
