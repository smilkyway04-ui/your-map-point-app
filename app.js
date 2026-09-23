let map = null;
let currentMarker = null;
let debounceTimer = null;

// ১. Mappls ম্যাপ শুরু করা
function initMap() {
  if (map) return;

  map = new mappls.Map('map', {
    center: [22.4827, 88.1815], // বজবজ / দক্ষিণ ২৪ পরগণা কেন্দ্রিক ভিউ
    zoom: 12
  });

  map.on('load', () => {
    setupDirectSearch();
  });
}

// ২. সরাসরি সার্চ ইঞ্জিন (কোনো টোকেন বা প্লাগইন এরর ছাড়া)
function setupDirectSearch() {
  const searchInput = document.getElementById('searchInput');
  const suggestBox = document.getElementById('suggestBox');

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
        // '2' লিখলে যাতে রোমান 'II' দিয়েও সার্চ হয়
        let searchQueries = [query];
        if (/\b2\b/.test(query)) {
          searchQueries.push(query.replace(/\b2\b/g, 'II'));
        }

        let results = [];

        for (let q of searchQueries) {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ' West Bengal')}&format=json&countrycodes=in&limit=5`;
          const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
          const data = await res.json();
          if (data && data.length > 0) {
            results = data;
            break;
          }
        }

        // যদি রেজাল্ট পাওয়া যায়, ড্রপডাউনে সাজিয়ে দেখানো
        if (results.length > 0) {
          suggestBox.innerHTML = '';
          results.forEach(item => {
            const li = document.createElement('li');
            const name = item.display_name.split(',')[0];
            const sub = item.display_name.split(',').slice(1, 4).join(', ');

            li.innerHTML = `<strong>${name}</strong><small>${sub}</small>`;

            li.onclick = () => {
              const lat = parseFloat(item.lat);
              const lng = parseFloat(item.lon);

              searchInput.value = name;
              suggestBox.style.display = 'none';

              // Mappls ম্যাপ ওই লোকেশনে নিয়ে যাওয়া
              map.setCenter([lat, lng]);
              map.setZoom(16);

              // আগের মার্কার থাকলে তা সরিয়ে ফেলা
              if (currentMarker) {
                if (typeof currentMarker.remove === 'function') {
                  currentMarker.remove();
                } else if (mappls.remove) {
                  mappls.remove({ map: map, layer: currentMarker });
                }
              }

              // Mappls ম্যাপের ওপর নতুন মার্কার বসানো
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
        console.error("Search error:", err);
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

// ব্যাকআপ লোডার
window.initMap = initMap;
window.addEventListener('DOMContentLoaded', () => {
  if (!map && typeof mappls !== 'undefined') {
    initMap();
  }
});
