// ==========================================
// 1. DATA STORE, 12 COLORS & ICONS
// ==========================================
const MAPPLS_KEY = "mvurtbbkrmltvdcpnblczfijpxtwmzqkhpmz"; // এখানে আপনার Mappls Web App Key বসান

let originPoint = JSON.parse(localStorage.getItem('mp_origin')) || null;
let destinations = JSON.parse(localStorage.getItem('mp_destinations')) || [];

destinations.forEach((d, idx) => {
  if (!d.id) d.id = 'loc_' + Date.now() + '_' + idx;
});

let showRoutes = true;
let showLabels = true;
let currentMode = originPoint ? 'none' : 'set_origin';
let tempSearchMarker = null;
let debounceTimer = null;
let activePaletteDestId = null;
let currentSelectedColor = null;
let currentSelectedIcon = null;

const destLayers = {}; 
const originLayers = { pinMarker: null, labelMarker: null };

function generateUniqueId() {
  return 'loc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

const PRESET_12_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#f59e0b", 
  "#9333ea", "#06b6d4", "#e11d48", "#ea580c", 
  "#4f46e5", "#059669", "#ca8a04", "#db2777"
];

const AVAILABLE_ICONS = [
  { id: 'fa-building', icon: 'fa-solid fa-building', label: 'Office' },
  { id: 'fa-hospital', icon: 'fa-solid fa-h', label: 'Hospital' },
  { id: 'fa-police', icon: 'fa-solid fa-shield-halved', label: 'Police' },
  { id: 'fa-train', icon: 'fa-solid fa-train', label: 'Station' },
  { id: 'fa-school', icon: 'fa-solid fa-graduation-cap', label: 'School' },
  { id: 'fa-cart', icon: 'fa-solid fa-cart-shopping', label: 'Shop' },
  { id: 'fa-utensils', icon: 'fa-solid fa-utensils', label: 'Food' },
  { id: 'fa-bank', icon: 'fa-solid fa-landmark', label: 'Bank' },
  { id: 'fa-house', icon: 'fa-solid fa-house', label: 'Home' },
  { id: 'fa-pin', icon: 'fa-solid fa-location-dot', label: 'Default' }
];

function detectAutoIcon(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('hospital') || lower.includes('clinic') || lower.includes('medical') || lower.includes('swasthya') || lower.includes('doctor')) {
    return 'fa-solid fa-plus';
  }
  if (lower.includes('police') || lower.includes('thana') || lower.includes('fari') || lower.includes('phari') || /\b(ps|p\.s)\b/i.test(lower)) {
    return 'fa-solid fa-shield-halved';
  }
  if (lower.includes('bdo') || lower.includes('sdo') || lower.includes('block') || lower.includes('office') || lower.includes('complex') || lower.includes('corp') || lower.includes('bhaban') || lower.includes('bhawan')) {
    return 'fa-solid fa-building';
  }
  if (lower.includes('rail') || lower.includes('station') || lower.includes('junction') || lower.includes('train') || lower.includes('metro')) {
    return 'fa-solid fa-train';
  }
  if (lower.includes('school') || lower.includes('college') || lower.includes('university') || lower.includes('vidyalaya')) {
    return 'fa-solid fa-graduation-cap';
  }
  if (lower.includes('bank') || lower.includes('atm')) {
    return 'fa-solid fa-landmark';
  }
  if (lower.includes('hotel') || lower.includes('restaurant') || lower.includes('cafe')) {
    return 'fa-solid fa-utensils';
  }
  return 'fa-solid fa-location-dot';
}

function getNextUniqueColor() {
  const usedColors = destinations.map(d => (d.color || '').toLowerCase());
  const available = PRESET_12_COLORS.find(c => !usedColors.includes(c.toLowerCase()));
  return available || PRESET_12_COLORS[destinations.length % PRESET_12_COLORS.length];
}

function persistData() {
  localStorage.setItem('mp_origin', JSON.stringify(originPoint));
  localStorage.setItem('mp_destinations', JSON.stringify(destinations));
}

// ==========================================
// 2. MAP INITIALIZATION (MAPPLS OFFICIAL TILES)
// ==========================================
const streetLayer = L.tileLayer(`https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/raster_tile/{z}/{x}/{y}.png`, {
  maxZoom: 19,
  attribution: '© Mappls | MapmyIndia'
});

const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri'
});

const map = L.map('map', {
  center: originPoint ? [originPoint.lat, originPoint.lng] : [22.5726, 88.3639],
  zoom: 13,
  layers: [streetLayer]
});

// ব্যাকআপ সুরক্ষা: ডোমেন বা নেটওয়ার্কে সমস্যা হলে ম্যাপ ব্ল্যাঙ্ক না হয়ে ব্যাকআপ লেয়ারে আসবে
streetLayer.on('tileerror', function() {
  console.warn("Mappls tile loading failed. Reverting to backup map.");
  if (!map.hasLayer(satLayer)) {
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map);
  }
});

const originLayerGroup = L.layerGroup().addTo(map);
const destMarkerGroup = L.layerGroup().addTo(map);
const routePolylineGroup = L.layerGroup().addTo(map);
const routeBadgeGroup = L.layerGroup().addTo(map);

// ==========================================
// 3. ICONS & BADGES
// ==========================================
function createPinIcon(color, iconClass) {
  return L.divIcon({
    className: 'custom-pin-head-only',
    html: `
      <div class="custom-pin-head" style="background-color: ${color};">
        <i class="${iconClass}"></i>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function createLocationLabelIcon(name, lat, lng, color, dir = 'right') {
  return L.divIcon({
    className: 'loc-label-container',
    html: `
      <div class="loc-name-bubble dir-${dir}" title="Drag with mouse to rotate">
        <div class="loc-bubble-arrow"></div>
        <strong style="display:flex; align-items:center; gap:5px;">
          <span style="width:7px; height:7px; border-radius:50%; background-color:${color}; display:inline-block; flex-shrink:0;"></span>
          ${name}
        </strong>
        <small>${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}</small>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
}

function createBadgeIcon(km, min, color, dir = 'bottom') {
  let arrowStyle = '';
  let anchor = [24, 51]; 

  if (dir === 'bottom') {
    arrowStyle = `border-top-color: ${color};`;
    anchor = [24, 51];
  } else if (dir === 'top') {
    arrowStyle = `border-bottom-color: ${color};`;
    anchor = [24, -13];
  } else if (dir === 'left') {
    arrowStyle = `border-right-color: ${color};`;
    anchor = [-13, 19];
  } else if (dir === 'right') {
    arrowStyle = `border-left-color: ${color};`;
    anchor = [77, 19];
  }

  return L.divIcon({
    className: 'route-bubble-container',
    html: `
      <div class="route-speech-bubble dir-${dir}" style="background-color: ${color};">
        <div class="route-bubble-km">${km} km</div>
        <div class="route-bubble-time"><i class="fa-solid fa-car"></i> ${min} min</div>
        <div class="route-bubble-arrow" style="${arrowStyle}"></div>
      </div>
    `,
    iconSize: [64, 38],
    iconAnchor: anchor
  });
}

function getClosestPointOnPolyline(dragLatLng, polyCoords) {
  if (!polyCoords || polyCoords.length === 0) return { latLng: dragLatLng, defaultDir: 'bottom' };
  if (polyCoords.length === 1) return { latLng: L.latLng(polyCoords[0][0], polyCoords[0][1]), defaultDir: 'bottom' };

  const p = map.latLngToLayerPoint(dragLatLng);
  let minDistanceSq = Infinity;
  let bestPoint = null;
  let bestSeg = null;

  for (let i = 0; i < polyCoords.length - 1; i++) {
    const a = map.latLngToLayerPoint(polyCoords[i]);
    const b = map.latLngToLayerPoint(polyCoords[i + 1]);

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = a.x + t * dx;
    const projY = a.y + t * dy;

    const distSq = (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      bestPoint = L.point(projX, projY);
      bestSeg = { dx, dy };
    }
  }

  let defaultDir = 'bottom';
  if (bestSeg && Math.abs(bestSeg.dy) > Math.abs(bestSeg.dx)) {
    defaultDir = 'left';
  }

  return {
    latLng: map.layerPointToLatLng(bestPoint),
    defaultDir: defaultDir
  };
}

// ==========================================
// 4. CENTRAL HUB SETUP (ORIGIN)
// ==========================================
function setupOrigin() {
  originLayerGroup.clearLayers();
  const nameContainer = document.getElementById('sidebarOriginName');

  if (!originPoint) {
    nameContainer.innerText = "Click map to set Hub";
    document.getElementById('sidebarOriginStatus').innerText = "Fixed origin (Not set)";
    document.getElementById('summaryOriginTitle').innerText = "No Origin Set";
    document.getElementById('summaryOriginCoords').innerText = "Set hub to start";
    return;
  }

  nameContainer.innerHTML = `<span>${originPoint.name}</span>`;

  originLayers.pinMarker = L.marker([originPoint.lat, originPoint.lng], {
    icon: createPinIcon('#ef4444', 'fa-solid fa-star')
  }).addTo(originLayerGroup);

  let originDir = originPoint.labelDir || 'right';
  originLayers.labelMarker = L.marker([originPoint.lat, originPoint.lng], {
    icon: createLocationLabelIcon(originPoint.name, originPoint.lat, originPoint.lng, '#ef4444', originDir),
    draggable: true,
    autoPan: false
  }).addTo(originLayerGroup);

  originLayers.labelMarker.on('drag', () => {
    const mousePt = map.latLngToLayerPoint(originLayers.labelMarker.getLatLng());
    const pinPt = map.latLngToLayerPoint([originPoint.lat, originPoint.lng]);
    const dx = mousePt.x - pinPt.x;
    const dy = mousePt.y - pinPt.y;

    let newDir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy < 0 ? 'top' : 'bottom');
    if (newDir !== originDir) {
      originDir = newDir;
      originPoint.labelDir = originDir;
      originLayers.labelMarker.setIcon(createLocationLabelIcon(originPoint.name, originPoint.lat, originPoint.lng, '#ef4444', originDir));
    }
    originLayers.labelMarker.setLatLng([originPoint.lat, originPoint.lng]);
  });

  originLayers.labelMarker.on('dragend', () => {
    originPoint.labelDir = originDir;
    persistData();
    originLayers.labelMarker.setLatLng([originPoint.lat, originPoint.lng]);
  });

  document.getElementById('sidebarOriginStatus').innerText = "Fixed origin";
  document.getElementById('summaryOriginTitle').innerText = originPoint.name;
  document.getElementById('summaryOriginCoords').innerText = `${originPoint.lat.toFixed(4)}, ${originPoint.lng.toFixed(4)}`;
}

// ==========================================
// 5. CACHED ROUTING & SINGLE DESTINATION
// ==========================================
async function getOrFetchRoute(origin, dest) {
  if (dest.route && dest.route.coords && dest.route.coords.length > 0) {
    return dest.route;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      const km = (data.routes[0].distance / 1000).toFixed(1);
      const min = Math.round(data.routes[0].duration / 60);
      const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      dest.route = { km, min, coords };
      persistData();
      return dest.route;
    }
  } catch (e) {
    console.warn("OSRM routing fallback:", e);
  }

  const km = (map.distance([origin.lat, origin.lng], [dest.lat, dest.lng]) / 1000).toFixed(1);
  const min = Math.round(km * 2.2);
  const coords = [[origin.lat, origin.lng], [dest.lat, dest.lng]];
  dest.route = { km, min, coords };
  persistData();
  return dest.route;
}

async function renderSingleDestination(dest) {
  const id = String(dest.id);
  if (!dest.icon) dest.icon = detectAutoIcon(dest.name);
  if (!dest.labelDir) dest.labelDir = 'right';

  const listContainer = document.getElementById('destinationsList');
  let card = document.getElementById(`layer-card-${id}`);

  const swatchesHtml = PRESET_12_COLORS.map(c => `
    <span class="swatch-btn ${c.toLowerCase() === dest.color.toLowerCase() ? 'active' : ''}"
          style="background-color: ${c};"
          title="${c}"
          onclick="event.stopPropagation(); setDestinationColor('${id}', '${c}')"></span>
  `).join('');

  const iconChoicesHtml = AVAILABLE_ICONS.map(item => `
    <span class="icon-btn-choice ${item.icon === dest.icon ? 'active' : ''}" 
          title="${item.label}"
          onclick="event.stopPropagation(); setDestinationIcon('${id}', '${item.icon}')">
      <i class="${item.icon}"></i>
    </span>
  `).join('');

  const cardInnerHtml = `
    <div class="layer-info" title="${dest.name}">
      <div class="color-picker-container" onclick="event.stopPropagation()">
        <span class="dest-dot" style="background-color: ${dest.color};" onclick="toggleColorPalette('${id}')" title="Customize Card, Icon & Color">
          <i class="${dest.icon}"></i>
        </span>
        
        <div id="palette-${id}" class="color-palette-popup" style="display: none;">
          <div class="palette-title">Card Position:</div>
          <div class="dir-picker-row">
            <button type="button" class="dir-btn ${dest.labelDir === 'left' ? 'active' : ''}" onclick="event.stopPropagation(); setDestinationLabelDir('${id}', 'left')">⬅️ Left</button>
            <button type="button" class="dir-btn ${dest.labelDir === 'top' ? 'active' : ''}" onclick="event.stopPropagation(); setDestinationLabelDir('${id}', 'top')">⬆️ Top</button>
            <button type="button" class="dir-btn ${dest.labelDir === 'right' ? 'active' : ''}" onclick="event.stopPropagation(); setDestinationLabelDir('${id}', 'right')">➡️ Right</button>
            <button type="button" class="dir-btn ${dest.labelDir === 'bottom' ? 'active' : ''}" onclick="event.stopPropagation(); setDestinationLabelDir('${id}', 'bottom')">⬇️ Bottom</button>
          </div>

          <div class="palette-title">Choose Icon:</div>
          <div class="icon-picker-grid">
            ${iconChoicesHtml}
          </div>
          
          <div class="palette-title" style="margin-top:6px;">Choose Color (12):</div>
          <div class="palette-grid">
            ${swatchesHtml}
          </div>
          <div class="palette-custom-divider"></div>
          <label class="custom-color-btn" title="Pick any custom color">
            <i class="fa-solid fa-palette"></i> Custom Color
            <input type="color" value="${dest.color}" onchange="setDestinationColor('${id}', this.value)" />
          </label>
        </div>
      </div>
      <div class="layer-text-wrap">
        <strong>${dest.name}</strong>
      </div>
    </div>
    <div class="layer-actions">
      <i class="fa-solid fa-pen-to-square" title="Rename inline" onclick="event.stopPropagation(); startInlineEditDest('${id}')"></i>
      <i class="fa-solid fa-xmark" title="Delete Location" onclick="event.stopPropagation(); deleteDestination('${id}')"></i>
    </div>
  `;

  if (!card) {
    card = document.createElement('div');
    card.id = `layer-card-${id}`;
    card.className = 'layer-card';
    card.innerHTML = cardInnerHtml;
    card.onclick = () => map.flyTo([dest.lat, dest.lng], 15);
    listContainer.appendChild(card);
  } else {
    card.innerHTML = cardInnerHtml;
  }

  if (destLayers[id] && destLayers[id].pinMarker) {
    destMarkerGroup.removeLayer(destLayers[id].pinMarker);
  }
  const pinMarker = L.marker([dest.lat, dest.lng], {
    icon: createPinIcon(dest.color, dest.icon)
  }).addTo(destMarkerGroup);

  if (destLayers[id] && destLayers[id].labelMarker) {
    destMarkerGroup.removeLayer(destLayers[id].labelMarker);
  }
  let currentCardDir = dest.labelDir || 'right';
  const labelMarker = L.marker([dest.lat, dest.lng], {
    icon: createLocationLabelIcon(dest.name, dest.lat, dest.lng, dest.color, currentCardDir),
    draggable: true,
    autoPan: false
  }).addTo(destMarkerGroup);

  labelMarker.on('drag', () => {
    const mousePt = map.latLngToLayerPoint(labelMarker.getLatLng());
    const pinPt = map.latLngToLayerPoint([dest.lat, dest.lng]);
    const dx = mousePt.x - pinPt.x;
    const dy = mousePt.y - pinPt.y;

    let newDir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy < 0 ? 'top' : 'bottom');
    if (newDir !== currentCardDir) {
      currentCardDir = newDir;
      dest.labelDir = currentCardDir;
      labelMarker.setIcon(createLocationLabelIcon(dest.name, dest.lat, dest.lng, dest.color, currentCardDir));
    }
    labelMarker.setLatLng([dest.lat, dest.lng]);
  });

  labelMarker.on('dragend', () => {
    dest.labelDir = currentCardDir;
    persistData();
    labelMarker.setLatLng([dest.lat, dest.lng]);
  });

  destLayers[id] = { pinMarker, labelMarker, polyline: null, badgeMarker: null };

  if (originPoint) {
    const route = await getOrFetchRoute(originPoint, dest);

    if (showRoutes) {
      const polyline = L.polyline(route.coords, { color: dest.color, weight: 4, opacity: 0.85 }).addTo(routePolylineGroup);
      destLayers[id].polyline = polyline;

      if (showLabels) {
        const midPoint = route.coords[Math.floor(route.coords.length / 2)];
        const initialSnap = getClosestPointOnPolyline(midPoint, route.coords);
        let badgeDir = dest.badgeDir || initialSnap.defaultDir;
        let badgeLatLng = dest.badgeLatLng ? L.latLng(dest.badgeLatLng.lat, dest.badgeLatLng.lng) : initialSnap.latLng;

        const badgeMarker = L.marker(badgeLatLng, {
          icon: createBadgeIcon(route.km, route.min, dest.color, badgeDir),
          draggable: true,
          autoPan: false
        }).addTo(routeBadgeGroup);

        badgeMarker.on('drag', () => {
          const currentPos = badgeMarker.getLatLng();
          const snapResult = getClosestPointOnPolyline(currentPos, route.coords);

          const mousePt = map.latLngToLayerPoint(currentPos);
          const snapPt = map.latLngToLayerPoint(snapResult.latLng);
          const diffX = mousePt.x - snapPt.x;
          const diffY = mousePt.y - snapPt.y;

          let newDir = badgeDir;
          if (Math.abs(diffY) > Math.abs(diffX)) {
            if (diffY < -8) newDir = 'bottom';
            else if (diffY > 8) newDir = 'top';
          } else {
            if (diffX > 8) newDir = 'left';
            else if (diffX < -8) newDir = 'right';
          }

          if (newDir !== badgeDir) {
            badgeDir = newDir;
            dest.badgeDir = badgeDir;
            badgeMarker.setIcon(createBadgeIcon(route.km, route.min, dest.color, badgeDir));
          }
          badgeMarker.setLatLng(snapResult.latLng);
        });

        badgeMarker.on('dragend', () => {
          const snapResult = getClosestPointOnPolyline(badgeMarker.getLatLng(), route.coords);
          badgeMarker.setLatLng(snapResult.latLng);
          dest.badgeLatLng = { lat: snapResult.latLng.lat, lng: snapResult.latLng.lng };
          dest.badgeDir = badgeDir;
          persistData();
        });

        destLayers[id].badgeMarker = badgeMarker;
      }
    }

    const tableBody = document.getElementById('routeTableBody');
    let row = document.getElementById(`table-row-${id}`);
    const rowHtml = `
      <td><i class="fa-solid fa-location-pin" style="color:#ef4444; margin-right:3px;"></i> <span class="col-origin-name">${originPoint.name}</span></td>
      <td><i class="${dest.icon} col-dest-icon" style="color:${dest.color}; margin-right:4px;"></i> <strong class="col-dest-name">${dest.name}</strong></td>
      <td><strong>${route.km} km</strong></td>
      <td><i class="fa-solid fa-car" style="color:#64748b;"></i> ${route.min} min</td>
      <td><div class="route-bar" style="background-color:${dest.color};"></div></td>
      <td><button class="btn-view" onclick="map.flyTo([${dest.lat}, ${dest.lng}], 15)">View</button></td>
    `;

    if (!row) {
      const emptyRow = tableBody.querySelector('.empty-row');
      if (emptyRow) emptyRow.remove();

      row = document.createElement('tr');
      row.id = `table-row-${id}`;
      row.innerHTML = rowHtml;
      tableBody.appendChild(row);
    } else {
      row.innerHTML = rowHtml;
    }
  }
}

async function renderAllDestinations() {
  destMarkerGroup.clearLayers();
  routePolylineGroup.clearLayers();
  routeBadgeGroup.clearLayers();
  Object.keys(destLayers).forEach(k => delete destLayers[k]);

  document.getElementById('destinationsList').innerHTML = '';
  const tableBody = document.getElementById('routeTableBody');
  tableBody.innerHTML = '';

  if (destinations.length === 0) {
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center; padding: 10px; color:#94a3b8; font-size:0.72rem;">No destinations added yet. Search or click on the map to add destinations.</td></tr>`;
    updateSummaryStats();
    return;
  }

  for (let dest of destinations) {
    await renderSingleDestination(dest);
  }
  updateSummaryStats();
}

function updateSummaryStats() {
  document.getElementById('statTotalLoc').innerText = destinations.length + (originPoint ? 1 : 0);
  document.getElementById('statTotalRoutes').innerText = destinations.length;

  const distances = destinations
    .filter(d => d.route && d.route.km)
    .map(d => parseFloat(d.route.km));

  if (distances.length > 0) {
    document.getElementById('statFarthest').innerText = `${Math.max(...distances)} km`;
    document.getElementById('statShortest').innerText = `${Math.min(...distances)} km`;
  } else {
    document.getElementById('statFarthest').innerText = `0 km`;
    document.getElementById('statShortest').innerText = `0 km`;
  }
}

// ==========================================
// 6. ISOLATED MUTATIONS
// ==========================================
window.deleteDestination = function(id) {
  id = String(id);
  if (destLayers[id]) {
    if (destLayers[id].pinMarker) destMarkerGroup.removeLayer(destLayers[id].pinMarker);
    if (destLayers[id].labelMarker) destMarkerGroup.removeLayer(destLayers[id].labelMarker);
    if (destLayers[id].polyline) routePolylineGroup.removeLayer(destLayers[id].polyline);
    if (destLayers[id].badgeMarker) routeBadgeGroup.removeLayer(destLayers[id].badgeMarker);
    delete destLayers[id];
  }

  const card = document.getElementById(`layer-card-${id}`);
  if (card) card.remove();
  const row = document.getElementById(`table-row-${id}`);
  if (row) row.remove();

  destinations = destinations.filter(d => String(d.id) !== id);
  persistData();
  updateSummaryStats();

  if (destinations.length === 0) {
    document.getElementById('routeTableBody').innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center; padding: 10px; color:#94a3b8; font-size:0.72rem;">No destinations added yet. Search or click on the map to add destinations.</td></tr>`;
  }
};

window.startInlineEditDest = function(id) {
  id = String(id);
  const card = document.getElementById(`layer-card-${id}`);
  if (!card) return;
  const target = destinations.find(d => String(d.id) === id);
  const textWrap = card.querySelector('.layer-text-wrap');
  if (!textWrap || !target) return;

  textWrap.innerHTML = `
    <input type="text" id="inlineDestInput-${id}" class="sidebar-inline-input" 
           value="${target.name}" 
           onclick="event.stopPropagation()" 
           onblur="saveInlineDestName('${id}', this.value)" 
           onkeydown="if(event.key==='Enter') this.blur();" />
  `;

  const input = document.getElementById(`inlineDestInput-${id}`);
  if (input) {
    input.focus();
    input.select();
  }
};

window.saveInlineDestName = function(id, newName) {
  id = String(id);
  const target = destinations.find(d => String(d.id) === id);
  if (target && newName && newName.trim() !== '') {
    target.name = newName.trim();
    persistData();
  }

  const card = document.getElementById(`layer-card-${id}`);
  if (card && target) {
    const textWrap = card.querySelector('.layer-text-wrap');
    if (textWrap) textWrap.innerHTML = `<strong>${target.name}</strong>`;
  }

  if (destLayers[id] && destLayers[id].labelMarker && target) {
    destLayers[id].labelMarker.setIcon(
      createLocationLabelIcon(target.name, target.lat, target.lng, target.color, target.labelDir || 'right')
    );
  }

  const row = document.getElementById(`table-row-${id}`);
  if (row && target) {
    const colName = row.querySelector('.col-dest-name');
    if (colName) colName.innerText = target.name;
  }
};

window.setDestinationColor = function(id, chosenColor) {
  id = String(id);
  const target = destinations.find(d => String(d.id) === id);
  if (!target) return;
  target.color = chosenColor;
  persistData();

  if (destLayers[id]) {
    if (destLayers[id].pinMarker) {
      destLayers[id].pinMarker.setIcon(createPinIcon(target.color, target.icon));
    }
    if (destLayers[id].labelMarker) {
      destLayers[id].labelMarker.setIcon(createLocationLabelIcon(target.name, target.lat, target.lng, target.color, target.labelDir || 'right'));
    }
    if (destLayers[id].polyline) {
      destLayers[id].polyline.setStyle({ color: target.color });
    }
    if (destLayers[id].badgeMarker && target.route) {
      destLayers[id].badgeMarker.setIcon(createBadgeIcon(target.route.km, target.route.min, target.color, target.badgeDir || 'bottom'));
    }
  }

  const card = document.getElementById(`layer-card-${id}`);
  if (card) {
    const dot = card.querySelector('.dest-dot');
    if (dot) dot.style.backgroundColor = target.color;
  }

  const row = document.getElementById(`table-row-${id}`);
  if (row) {
    const bar = row.querySelector('.route-bar');
    if (bar) bar.style.backgroundColor = target.color;
    const icon = row.querySelector('.col-dest-icon');
    if (icon) icon.style.color = target.color;
  }

  closeAllPalettes();
};

window.setDestinationIcon = function(id, chosenIcon) {
  id = String(id);
  const target = destinations.find(d => String(d.id) === id);
  if (!target) return;
  target.icon = chosenIcon;
  persistData();

  if (destLayers[id] && destLayers[id].pinMarker) {
    destLayers[id].pinMarker.setIcon(createPinIcon(target.color, target.icon));
  }
  const card = document.getElementById(`layer-card-${id}`);
  if (card) {
    const dotIcon = card.querySelector('.dest-dot i');
    if (dotIcon) dotIcon.className = target.icon;
  }
  const row = document.getElementById(`table-row-${id}`);
  if (row) {
    const iconEl = row.querySelector('.col-dest-icon');
    if (iconEl) iconEl.className = `${target.icon} col-dest-icon`;
  }
  closeAllPalettes();
};

window.setDestinationLabelDir = function(id, chosenDir) {
  id = String(id);
  const target = destinations.find(d => String(d.id) === id);
  if (!target) return;
  target.labelDir = chosenDir;
  persistData();

  if (destLayers[id] && destLayers[id].labelMarker) {
    destLayers[id].labelMarker.setIcon(createLocationLabelIcon(target.name, target.lat, target.lng, target.color, chosenDir));
  }
  closeAllPalettes();
};

window.startInlineEditOrigin = function() {
  if (!originPoint) return;
  const nameContainer = document.getElementById('sidebarOriginName');
  nameContainer.innerHTML = `
    <input type="text" id="inlineOriginInput" class="sidebar-inline-input" 
           value="${originPoint.name}" 
           onclick="event.stopPropagation()" 
           onblur="saveInlineOriginName(this.value)" 
           onkeydown="if(event.key==='Enter') this.blur();" />
  `;
  const input = document.getElementById('inlineOriginInput');
  if (input) {
    input.focus();
    input.select();
  }
};

window.saveInlineOriginName = function(newName) {
  if (originPoint && newName && newName.trim() !== '') {
    originPoint.name = newName.trim();
    persistData();
  }
  const nameContainer = document.getElementById('sidebarOriginName');
  if (nameContainer && originPoint) {
    nameContainer.innerHTML = `<span>${originPoint.name}</span>`;
  }
  if (originLayers.labelMarker && originPoint) {
    originLayers.labelMarker.setIcon(
      createLocationLabelIcon(originPoint.name, originPoint.lat, originPoint.lng, '#ef4444', originPoint.labelDir || 'right')
    );
  }
  document.querySelectorAll('.col-origin-name').forEach(el => el.innerText = originPoint.name);
  document.getElementById('summaryOriginTitle').innerText = originPoint.name;
};

window.toggleColorPalette = function(id) {
  id = String(id);
  const popup = document.getElementById(`palette-${id}`);
  if (!popup) return;
  const isShown = popup.style.display === 'block';
  closeAllPalettes();
  if (!isShown) {
    popup.style.display = 'block';
    activePaletteDestId = id;
  }
};

function closeAllPalettes() {
  document.querySelectorAll('.color-palette-popup').forEach(p => p.style.display = 'none');
  activePaletteDestId = null;
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.color-picker-container')) {
    closeAllPalettes();
  }
});

// ==========================================
// 7. MAPPLS OFFICIAL SEARCH ENGINE
// ==========================================
const searchInput = document.getElementById('searchInput');
const suggestionsBox = document.getElementById('searchSuggestions');

function initMapplsSearch() {
  if (window.mappls && window.mappls.search) {
    // Mappls-er official autosuggest plugin
    new mappls.search(searchInput, {
      location: [22.5726, 88.3639], // West Bengal bias
      region: "ind",
      hyperLocal: true
    }, function(data) {
      if (!data) return;
      const place = Array.isArray(data) ? data[0] : data;
      const lat = parseFloat(place.latitude || place.entryLatitude);
      const lng = parseFloat(place.longitude || place.entryLongitude);
      const name = place.placeName || place.poi || place.name || "Budge Budge 2 BDO";
      const details = place.placeAddress || place.formattedAddress || "";

      if (!isNaN(lat) && !isNaN(lng)) {
        selectLocation(lat, lng, name, details);
      }
    });
  } else {
    setTimeout(initMapplsSearch, 500);
  }
}

// Page load holei Mappls Search chalu hobe
if (document.readyState === 'complete') {
  initMapplsSearch();
} else {
  window.addEventListener('load', initMapplsSearch);
}

function selectLocation(lat, lng, name, details) {
  searchInput.value = name;
  if (suggestionsBox) suggestionsBox.style.display = 'none';
  map.flyTo([lat, lng], 15);

  if (tempSearchMarker) map.removeLayer(tempSearchMarker);

  currentSelectedColor = getNextUniqueColor();
  currentSelectedIcon = detectAutoIcon(name);

  renderTempMarkerWithPopup(lat, lng, name, details, currentSelectedColor, currentSelectedIcon);
}

function renderTempMarkerWithPopup(lat, lng, name, details, selectedColor, selectedIcon) {
  if (tempSearchMarker) map.removeLayer(tempSearchMarker);

  const tempIcon = L.divIcon({
    className: 'custom-pin-head-only',
    html: `
      <div class="custom-pin-head" style="background-color: ${selectedColor};">
        <i class="${selectedIcon}"></i>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  tempSearchMarker = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
  const safeDetails = encodeURIComponent(details || '');

  const popupSwatchesHtml = PRESET_12_COLORS.map(c => `
    <span class="popup-swatch ${c.toLowerCase() === selectedColor.toLowerCase() ? 'active' : ''}" 
          style="background-color: ${c};" 
          title="${c}"
          onclick="changePopupSettings('${safeDetails}', ${lat}, ${lng}, '${c}', '${selectedIcon}')"></span>
  `).join('');

  const popupIconsHtml = AVAILABLE_ICONS.map(item => `
    <span class="icon-btn-choice ${item.icon === selectedIcon ? 'active' : ''}" 
          title="${item.label}"
          onclick="changePopupSettings('${safeDetails}', ${lat}, ${lng}, '${selectedColor}', '${item.icon}')">
      <i class="${item.icon}"></i>
    </span>
  `).join('');

  let actionButtons = '';
  if (!originPoint) {
    actionButtons = `
      <div class="popup-actions">
        <button class="btn-add-to-map" onclick="confirmAddFromPopup(${lat}, ${lng}, 'hub', '${selectedColor}', '${selectedIcon}')">
          <i class="fa-solid fa-star"></i> Set as Fixed Hub
        </button>
      </div>
    `;
  } else {
    actionButtons = `
      <div class="popup-color-bar">
        <span class="popup-color-label">Icon Category:</span>
        <div class="icon-picker-grid">
          ${popupIconsHtml}
        </div>
        <span class="popup-color-label" style="margin-top:6px;">Choose Color (12):</span>
        <div class="popup-swatches">
          ${popupSwatchesHtml}
        </div>
      </div>
      <div class="popup-actions">
        <button class="btn-add-to-map" style="background-color:${selectedColor};" onclick="confirmAddFromPopup(${lat}, ${lng}, 'dest', '${selectedColor}', '${selectedIcon}')">
          <i class="fa-solid fa-plus"></i> Add to map
        </button>
        <button class="btn-add-to-map btn-set-hub" onclick="confirmAddFromPopup(${lat}, ${lng}, 'hub', '${selectedColor}', '${selectedIcon}')" title="Set as starting point">
          <i class="fa-solid fa-star"></i> Set as Hub
        </button>
      </div>
    `;
  }

  const popupContent = `
    <div class="gmap-popup">
      <input type="text" id="popupLocNameInput" class="popup-name-input" value="${name}" placeholder="Type location name..." />
      <p>${details || 'Selected location'}</p>
      <small>${lat.toFixed(4)}, ${lng.toFixed(4)}</small>
      ${actionButtons}
    </div>
  `;

  tempSearchMarker.bindPopup(popupContent, { offset: [0, -10] }).openPopup();
}

// ==========================================
// 8. PANEL & SIDEBAR RESIZERS
// ==========================================
const sidebarEl = document.querySelector('.sidebar');
const resizerSidebar = document.getElementById('resizerSidebar');
let isResizingSidebar = false;

resizerSidebar.addEventListener('mousedown', (e) => {
  e.preventDefault();
  isResizingSidebar = true;
  resizerSidebar.classList.add('resizing');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});

const bottomPanelEl = document.querySelector('.bottom-panel');
const resizerBottom = document.getElementById('resizerBottom');
let isResizingBottom = false;

resizerBottom.addEventListener('mousedown', (e) => {
  e.preventDefault();
  isResizingBottom = true;
  resizerBottom.classList.add('resizing');
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
  if (isResizingSidebar) {
    let newWidth = e.clientX;
    if (newWidth < 220) newWidth = 220;
    if (newWidth > 650) newWidth = 650;
    sidebarEl.style.width = `${newWidth}px`;
    map.invalidateSize();
  }

  if (isResizingBottom) {
    const totalViewportHeight = window.innerHeight - 54;
    let newHeight = window.innerHeight - e.clientY;
    if (newHeight < 40) newHeight = 40;
    if (newHeight > totalViewportHeight - 100) newHeight = totalViewportHeight - 100;
    bottomPanelEl.style.height = `${newHeight}px`;
    map.invalidateSize();
  }
});

document.addEventListener('mouseup', () => {
  if (isResizingSidebar) {
    isResizingSidebar = false;
    resizerSidebar.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    map.invalidateSize();
  }
  if (isResizingBottom) {
    isResizingBottom = false;
    resizerBottom.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    map.invalidateSize();
  }
});

// ==========================================
// 9. MAP CLICK & TOOLBAR CONTROLS
// ==========================================
map.on('click', (e) => {
  if (!originPoint || currentMode === 'set_origin') {
    selectLocation(e.latlng.lat, e.latlng.lng, "Main Hub", "Fixed Starting Point");
    currentMode = 'none';
    return;
  }

  if (currentMode === 'add_dest') {
    selectLocation(e.latlng.lat, e.latlng.lng, "New Destination", "Custom map pin");
    currentMode = 'none';
    document.getElementById('toolAddPin').classList.remove('active');
    document.getElementById('toolPan').classList.add('active');
  }
});

document.getElementById('originCard').onclick = () => {
  startInlineEditOrigin();
};

document.getElementById('btnAddLocation').onclick = () => {
  if (!originPoint) {
    alert("Please set your Fixed Central Hub on the map first!");
    currentMode = 'set_origin';
    return;
  }
  currentMode = 'add_dest';
  document.getElementById('toolAddPin').classList.add('active');
  document.getElementById('toolPan').classList.remove('active');
  alert("Click anywhere on the map to add your pin!");
};

document.getElementById('toolAddPin').onclick = () => {
  currentMode = (currentMode === 'add_dest') ? 'none' : 'add_dest';
  document.getElementById('toolAddPin').classList.toggle('active', currentMode === 'add_dest');
  document.getElementById('toolPan').classList.toggle('active', currentMode !== 'add_dest');
};

document.getElementById('toolPan').onclick = () => {
  currentMode = 'none';
  document.getElementById('toolPan').classList.add('active');
  document.getElementById('toolAddPin').classList.remove('active');
};

document.getElementById('btnClearAll').onclick = () => {
  if (confirm("Are you sure you want to clear all data and start completely fresh?")) {
    originPoint = null;
    destinations = [];
    localStorage.clear();
    setupOrigin();
    renderAllDestinations();
  }
};

document.getElementById('toggleRoutes').onchange = (e) => {
  showRoutes = e.target.checked;
  renderAllDestinations();
};

document.getElementById('toggleLabels').onchange = (e) => {
  showLabels = e.target.checked;
  renderAllDestinations();
};

document.getElementById('btnMap').onclick = () => {
  map.removeLayer(satLayer);
  map.addLayer(streetLayer);
  document.getElementById('btnMap').classList.add('active');
  document.getElementById('btnSatellite').classList.remove('active');
};

document.getElementById('btnSatellite').onclick = () => {
  map.removeLayer(streetLayer);
  map.addLayer(satLayer);
  document.getElementById('btnSatellite').classList.add('active');
  document.getElementById('btnMap').classList.remove('active');
};

document.getElementById('btnExport').onclick = () => {
  if (!originPoint && destinations.length === 0) {
    alert("No data to export!");
    return;
  }
  const fileData = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ origin: originPoint, destinations }, null, 2));
  const link = document.createElement('a');
  link.setAttribute("href", fileData);
  link.setAttribute("download", "map_pointing_export.json");
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// Bootstrap
setupOrigin();
renderAllDestinations();
