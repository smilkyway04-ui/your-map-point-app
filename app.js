let map = null;
let currentMarker = null;
let debounceTimer = null;

// ১. Mappls ম্যাপ শুরু করা
function initMap() {
  map = new mappls.Map('map', {
    center: [22.4827, 88.1815], // বজবজ এলাকা
    zoom: 12
  });
}

// ২. সরাসরি সার্চ ইঞ্জিন (কোনো টোকেন ঝামেলা ছাড়া)
function setupSearch() {
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
        let q = query;
        if (/\b2\b/.test(q)) {
          q = q.replace(/\b2\b/g, 'II');
        }

        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ' West Bengal')}&format=json&countrycodes=in&limit=5`;
        const res = await fetch(url);
        const data = await res.json();

        if (data && data.length > 0) {
          suggestBox.innerHTML = '';
          data.forEach(item => {
            const li = document.createElement('li');
            const name = item.display_name.split(',')[0];
            const sub = item.display_name.split(',').slice(1, 4).join(', ');

            li.innerHTML = `<strong>${name}</strong><small>${sub}</small>`;

            li.onclick = () => {
              const lat = parseFloat(item.lat);
              const lng = parseFloat(item.lon);

              searchInput.value = name;
              suggestBox.style.display = 'none';

              // ম্যাপ ওই জায়গায় সরানো
              if (map) {
                map.setCenter([lat, lng]);
                map.setZoom(15);

                // আগের পিন থাকলে সরানো
                if (currentMarker) {
                  if (typeof currentMarker.remove === 'function') currentMarker.remove();
                  else if (mappls.remove) mappls.remove({ map: map, layer: currentMarker });
                }

                // নতুন পিন বসানো
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
        console.error("Search error:", err);
        suggestBox.style.display = 'none';
      }
    }, 250);
  });

  // সার্চের বাইরে ক্লিক করলে ড্রপডাউন বন্ধ করা
  document.addEventListener('click', (e) => {
    if (!searchInput.parentElement.contains(e.target)) {
      suggestBox.style.display = 'none';
    }
  });
}

// পেজ রেডি হলে ম্যাপ ও সার্চ উভয়ই রান করবে
window.onload = () => {
  initMap();
  setupSearch();
};
