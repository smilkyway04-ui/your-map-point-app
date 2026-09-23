// কনসোলের Credentials ট্যাব থেকে পাওয়া Key Pair বসান
const CLIENT_ID = "96dHZVzsAutmNa1VQslCwT2nCpjRwVk7tHHpITJupj4bNvumXIlkl7qFmFmimS0w9TB9Au8mHXUAj680O4eYYD11x-zAIvuM";
const CLIENT_SECRET = "lrFxI-iSEg98O3UXe86ZUUB6jdVx9O8jNtG_5M7wvsXFgwAIWLVxceijzud5qBGO5LSdseZgEKe_mbba-lh-pYxLCPSK5yK25UvCGKwaGO0=";

let map = null;
let currentMarker = null;
let accessToken = null;
let debounceTimer = null;

// ১. Mappls থেকে সিকিউরিটি টোকেন সংগ্রহ করা
async function getMapplsToken() {
  try {
    const res = await fetch("https://outpost.mappls.com/api/security/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`
    });
    const data = await res.json();
    if (data.access_token) {
      accessToken = data.access_token;
      console.log("Mappls Token Generated Successfully!");
    }
  } catch (err) {
    console.error("Token error:", err);
  }
}

// ২. Mappls ম্যাপ শুরু করা
window.initMap = async function () {
  map = new mappls.Map('map', {
    center: [22.4827, 88.1815], // বজবজ এলাকা
    zoom: 12
  });

  await getMapplsToken();
  setupMapplsSearch();
};

// ৩. Mappls অফিশিয়াল Atlas Search ইঞ্জিন
function setupMapplsSearch() {
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
      if (!accessToken) {
        await getMapplsToken();
      }

      try {
        // Mappls-এর অফিশিয়াল Atlas AutoSuggest API
        const url = `https://atlas.mappls.com/api/places/search/json?query=${encodeURIComponent(query)}&location=22.4827,88.1815`;
        const res = await fetch(url, {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        });
        const data = await res.json();

        const results = data.suggestedLocations || [];

        if (results.length > 0) {
          suggestBox.innerHTML = '';
          results.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${item.placeName || item.poi}</strong><small>${item.placeAddress || ''}</small>`;

            li.onclick = () => {
              const lat = parseFloat(item.latitude || item.entryLatitude);
              const lng = parseFloat(item.longitude || item.entryLongitude);

              searchInput.value = item.placeName;
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
        console.error("Mappls Search Error:", err);
      }
    }, 250);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.parentElement.contains(e.target)) {
      suggestBox.style.display = 'none';
    }
  });
}
