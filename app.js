let map = null;
let currentMarker = null;

// ১. Mappls অফিশিয়াল ম্যাপ লোড করা
function initMap() {
  if (map) return; // যাতে দুবার লোড না হয়

  map = new mappls.Map('map', {
    center: [22.4827, 88.1815], // বজবজ / দক্ষিণ ২৪ পরগণা কেন্দ্রিক ভিউ
    zoom: 12
  });

  // ম্যাপ পুরোপুরি প্রস্তুত হলে সার্চ ইঞ্জিন সক্রিয় হবে
  const onReady = () => {
    initSearch();
  };

  if (map.addListener) {
    map.addListener('load', onReady);
  } else if (map.on) {
    map.on('load', onReady);
  } else {
    onReady();
  }
}

// ২. Mappls অফিশিয়াল সার্চ ইঞ্জিন সংযুক্ত করা
function initSearch() {
  const searchInput = document.getElementById('searchInput');

  if (!window.mappls || !mappls.search) {
    setTimeout(initSearch, 300);
    return;
  }

  // সার্চ অপশন (পশ্চিমবঙ্গ ও বজবজ এলাকার প্রায়োরিটি দেওয়া)
  const placeOptions = {
    location: [22.4827, 88.1815],
    hyperLocal: true
  };

  // Mappls অফিশিয়াল অটোসাজেস্ট উইজেট
  new mappls.search(searchInput, placeOptions, function(data) {
    if (!data) return;

    const item = Array.isArray(data) ? data[0] : data;
    if (!item) return;

    // অক্ষাংশ ও দ্রাঘিমাংশ সংগ্রহ
    const lat = parseFloat(item.latitude || item.entryLatitude || item.lat);
    const lng = parseFloat(item.longitude || item.entryLongitude || item.lng);
    const placeName = item.placeName || item.poi || item.name || item.placeAddress || "Selected Location";

    if (!isNaN(lat) && !isNaN(lng)) {
      searchInput.value = placeName;

      // ম্যাপকে নির্বাচিত পয়েন্টে নিয়ে যাওয়া
      map.setCenter([lat, lng]);
      map.setZoom(16);

      // পুরনো মার্কার থাকলে সরিয়ে ফেলা
      if (currentMarker) {
        if (typeof currentMarker.remove === 'function') {
          currentMarker.remove();
        } else if (mappls.remove) {
          mappls.remove({ map: map, layer: currentMarker });
        }
      }

      // নতুন জায়গায় লাল পিন মার্কার বসানো
      currentMarker = new mappls.Marker({
        map: map,
        position: { lat: lat, lng: lng }
      });
    }
  });
}

// স্ক্রিপ্ট ব্যাকআপ লোডার
window.initMap = initMap;
window.addEventListener('DOMContentLoaded', () => {
  if (!map && typeof mappls !== 'undefined') {
    initMap();
  }
});
