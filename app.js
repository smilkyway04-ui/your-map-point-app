let map = null;
let currentMarker = null;
let debounceTimer = null;

// ১. Mappls অফিশিয়াল কলব্যাক ফাংশন (SDK লোড হলেই এটি নিজে থেকে চলবে)
window.initMap = function () {
  console.log("Mappls SDK loaded, creating map...");

  map = new mappls.Map('map', {
    center: [22.4827, 88.1815], // বজবজ এলাকা
    zoom: 12
  });

  setupSearch();
};

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

        // দক্ষিণ ২৪ পরগণা ও পশ্চিমবঙ্গ লোকেশন সার্চ
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ' South 24 Parganas')}&format=json&countrycodes=in&limit=5`;
        let res = await fetch(url);
        let data = await res.json();

        // রেজাল্ট না পেলে পুরো পশ্চিমবঙ্গ দিয়ে দ্বিতীয় চেষ্টা
        if (!data || data.length === 0) {
          const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ' West Bengal')}&format=json&countrycodes=in&limit=5`;
          res = await fetch(fallbackUrl);
          data = await res.json();
        }

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

              // ম্যাপকে নির্দিষ্ট জায়গায় নিয়ে যাওয়া
              if (map) {
                map.setCenter([lat, lng]);
                map.setZoom(15);

                // আগের মার্কার থাকলে সরানো
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
        console.error("Search error:", err);
        suggestBox.style.display = 'none';
      }
    }, 250);
  });

  // সার্চ বক্সের বাইরে ক্লিক করলে ড্রপডাউন বন্ধ করা
  document.addEventListener('click', (e) => {
    if (!searchInput.parentElement.contains(e.target)) {
      suggestBox.style.display = 'none';
    }
  });
}
