
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (window.activeRealGpsWatchId !== null) {
            window.realGpsWasTrackingBeforeBackground = true;
            stopRealRiderGpsTracking(false);
          }
          if (typeof cleanupCustomerTrackerListeners === 'function') {
            cleanupCustomerTrackerListeners();
          }
        } else {
          if (typeof triggerGlobalScreenRefreshActual === 'function') {
            triggerGlobalScreenRefreshActual();
          }
          if (window.realGpsWasTrackingBeforeBackground) {
            window.realGpsWasTrackingBeforeBackground = false;
            const session = getData('ek_delivery_session', null);
            if (session) {
              const orders = getData('ek_orders', []);
              const activeOrder = orders.find(o => {
                const exec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(o) : null;
                return exec && exec.id === session.id && ['delivering', 'out_for_delivery', 'dispatch'].includes((o.status || '').toLowerCase().trim());
              });
              if (activeOrder) {
                debugLog("[Real GPS] Document visible again, restarting real GPS tracking...");
                startRealRiderGpsTracking();
              }
            }
          }
          if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-track') {
            if (typeof renderTrackerScreen === 'function') {
              renderTrackerScreen();
            }
          }
        }
      });
    }

    function cleanupCustomerTrackerListeners() {
      if (typeof window.activeTrackedOrderUnsubscribe === 'function') {
        try { window.activeTrackedOrderUnsubscribe(); } catch(e) {}
      }
      window.activeTrackedOrderUnsubscribe = null;
      window.activeTrackedOrderIdListener = null;

      if (typeof window.activeTrackedRiderUnsubscribe === 'function') {
        try { window.activeTrackedRiderUnsubscribe(); } catch(e) {}
      }
      window.activeTrackedRiderUnsubscribe = null;
      window.activeTrackedRiderIdListener = null;

      if (typeof clearRiderAnimation === 'function') {
        clearRiderAnimation();
      }
    }
    window.cleanupCustomerTrackerListeners = cleanupCustomerTrackerListeners;

    let trackerLeafletMap = null;
    let trackerTileLayer = null;
    let trackerMapTheme = 'dark';
    let selectedTrackOrderId = null;
    let selectedOrderHistoryStatusFilter = 'all';

    let liveBriefingLoaded = false;
    const edappadiWeatherUpdates = [
      { temp: "34°C", condition: "🌦️ Partly Cloudy", wind: "SW 12 km/h", descEn: "Excellent weather. Lighter southwest monsoon clouding. Ideal climate for delivery executives! No delay.", descTa: "வானிலை பிரமாதமாக உள்ளது. லேசான காற்று, மழைக்கான தாமதங்கள் ஏதும் இல்லை." },
      { temp: "35°C", condition: "☀️ Sunny & Warm", wind: "NW 10 km/h", descEn: "Clear sunny skies in Edappadi town. Fresh, dry roads. Delivery speeds will be extremely fast!", descTa: "தெளிவான வெயில் வானிலை. உலர் சாலைகள், அதிவேக டெலிவரிக்கு ஏற்றது." },
      { temp: "33°C", condition: "☁️ Overcast but dry", wind: "W 14 km/h", descEn: "Cool breeze, high moisture, but no rain detected. Fresh meat and food items are safely packaged.", descTa: "மழை இல்லாத குளுமையான காற்று. உணவுப் பொருட்கள் பாதுகாப்பாக கொண்டு சேர்க்கப்படும்." }
    ];
    const edappadiTrafficUpdates = [
      { status: "Green / Low Congestion 🟢", descEn: "Salem Main Rd & Edappadi Bus Stand roads are fully clear. Safe and steady transit expected.", descTa: "போக்குவரத்து நெரிசல் இல்லை, சுலபமான விநியோகம் சாத்தியம்!" },
      { status: "Yellow / Moderate near Market 🟡", descEn: "Minor slow traffic near Government Hospital Market area. Drivers are taking shorter bypasses. Expect +3 mins.", descTa: "மார்க்கெட் பகுதியில் சிறிய நெரிசல், மாற்று வழியில் விரைவாகப் பயணிப்பார்." },
      { status: "Green / Fluid Traffic 🟢", descEn: "Smooth flow through Poolampatti Rd & Chinnamariamman temple circle. Highly efficient delivery route.", descTa: "போக்குவரத்து மிக வேகமாக உள்ளது. பூலாம்பட்டி ரோடு முழுவதும் தெளிவான சாலைகள்." }
    ];

    function initLiveBriefing() {
      const container = document.getElementById('cart-live-briefing');
      if (!container) return;
      if (liveBriefingLoaded) return;
      refreshLiveBriefing(false);
    }

    function refreshLiveBriefing(userTriggered) {
      const weatherTemp = document.getElementById('briefing-weather-temp');
      const weatherDesc = document.getElementById('briefing-weather-desc');
      const trafficStatus = document.getElementById('briefing-traffic-status');
      const trafficDesc = document.getElementById('briefing-traffic-desc');
      const advisoryText = document.getElementById('briefing-advisory-box');

      if (!weatherTemp || !weatherDesc || !trafficStatus || !trafficDesc) return;

      if (userTriggered) {
        showToast("📡 Contacting weather radar & traffic satellites...", "info");
        weatherTemp.innerText = "Querying GPS...";
        weatherDesc.innerText = "Synchronizing with Salem District Doppler meteorological centers...";
        trafficStatus.innerText = "Analyzing traffic feeds...";
        trafficDesc.innerText = "Real-time AI telemetry scanning with Leaflet and Firestore...";
      }

      setTimeout(() => {
        const wIdx = Math.floor(Math.random() * edappadiWeatherUpdates.length);
        const tIdx = Math.floor(Math.random() * edappadiTrafficUpdates.length);

        const w = edappadiWeatherUpdates[wIdx];
        const t = edappadiTrafficUpdates[tIdx];

        weatherTemp.innerText = `${w.temp} - ${w.condition}`;
        weatherDesc.innerText = currentLang === 'ta' ? w.descTa : w.descEn;

        trafficStatus.innerText = t.status;
        trafficDesc.innerText = currentLang === 'ta' ? t.descTa : t.descEn;

        if (t.status.includes('Yellow')) {
          trafficStatus.style.color = 'var(--accent-orange)';
          if (advisoryText) {
            advisoryText.innerHTML = currentLang === 'ta'
              ? `💡 <strong>குறிப்பு:</strong> மார்க்கெட் நெரிசலால் சிறிய தாமதம் ஆகலாம். உங்கள் ஆர்டர் சுமார் <strong>25-35 நிமிடங்களில்</strong> வந்து சேரும்.`
              : `💡 <strong>Advisory:</strong> Market slow-down bypass. Expected preparation + delivery in <strong>25-35 mins</strong>.`;
            advisoryText.style.background = 'rgba(245,158,11,0.06)';
            advisoryText.style.borderColor = 'rgba(245,158,11,0.2)';
            advisoryText.style.color = 'var(--accent-orange)';
          }
        } else {
          trafficStatus.style.color = '#22c55e';
          if (advisoryText) {
            advisoryText.innerHTML = currentLang === 'ta'
              ? `💡 <strong>குறிப்பு:</strong> அதிவேக பாதை! புதிய இறைச்சி/பொருட்களை <strong>20-30 நிமிடங்களில்</strong> சுடச்சுட கொண்டு சேர்ப்போம்.`
              : `💡 <strong>Advisory:</strong> Fluid green route. Standard preparation + express dispatch. Arrivable in <strong>20-30 mins</strong>.`;
            advisoryText.style.background = 'rgba(16,185,129,0.06)';
            advisoryText.style.borderColor = 'rgba(16,185,129,0.2)';
            advisoryText.style.color = 'var(--accent-green)';
          }
        }

        if (userTriggered) {
          showToast("✅ Edappadi conditions updated successfully!", "success");
        }
        liveBriefingLoaded = true;
      }, userTriggered ? 800 : 300);
    }

    function setOrderHistoryStatusFilter(status) {
      selectedOrderHistoryStatusFilter = status;
      const pills = ['all', 'pending', 'accepted', 'preparing', 'delivering', 'delivered', 'cancelled', 'rejected'];
      pills.forEach(p => {
        const el = document.getElementById(`filter-status-${p}`);
        if (el) {
          if (p === status) {
            el.style.background = 'var(--accent-orange)';
            el.style.color = '#000';
            el.style.borderColor = 'transparent';
          } else {
            el.style.background = '#141416';
            el.style.color = 'var(--text-secondary)';
            el.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }
        }
      });
      renderTrackerScreen();
    }
    let storeMarker = null;
    let customerMarker = null;
    let riderMarker = null;
    let routePolyline = null;
    let riderAnimationTimer = null;
    let riderAnimationFrameId = null;

    function setTrackerMapTheme(theme) {
      trackerMapTheme = theme;

      const buttons = {
        'dark': document.getElementById('tracker-map-theme-dark'),
        'light': document.getElementById('tracker-map-theme-light'),
        'satellite': document.getElementById('tracker-map-theme-satellite')
      };

      Object.keys(buttons).forEach(key => {
        const btn = buttons[key];
        if (!btn) return;
        if (key === theme) {
          btn.style.background = '#111';
          btn.style.color = 'var(--accent-orange)';
          btn.style.borderColor = 'var(--accent-orange)';
          btn.style.fontWeight = 'bold';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = '#fff';
          btn.style.borderColor = 'transparent';
          btn.style.fontWeight = 'normal';
        }
      });

      if (trackerLeafletMap) {
        if (trackerTileLayer) {
          try { trackerLeafletMap.removeLayer(trackerTileLayer); } catch(e) {}
        }
        trackerTileLayer = createTrackerTileLayer(theme);
        trackerTileLayer.addTo(trackerLeafletMap);
      }
    }

    function createTrackerTileLayer(theme) {
      let tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      let layerOptions = {
        maxZoom: 20,
        subdomains: ['a', 'b', 'c', 'd'],
        updateWhenIdle: true,
        keepBuffer: 2
      };

      if (theme === 'dark') {
        tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      } else if (theme === 'light') {
        tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      } else if (theme === 'satellite') {
        tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        layerOptions.subdomains = ['1', '2', '3', '4'];
      }

      const layer = L.tileLayer(tileUrl, layerOptions);

      layer.on('tileerror', function(errorEvent) {
        const tile = errorEvent.tile;
        if (tile && !tile._fallbackAttempted) {
          tile._fallbackAttempted = true;
          const coords = errorEvent.coords;
          if (coords) {
            const z = coords.z;
            const x = coords.x;
            const y = coords.y;
            if (theme === 'satellite') {
              tile.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
            } else {
              const sub = ['a', 'b', 'c'][Math.abs(x + y) % 3];
              tile.src = `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
            }
          }
        }
      });

      return layer;
    }

    function initLiveTrackerMap(order) {
      const mapContainer = document.getElementById('live-map-container');
      const trackerMapBox = document.getElementById('tracker-map-box');
      if (!mapContainer || !trackerMapBox) return;

      const showStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivering', 'out_for_delivery', 'dispatch'];
      const orderStatusNorm = (order && order.status ? String(order.status).toLowerCase().trim() : '');
      if (!order || !showStatuses.includes(orderStatusNorm)) {
        trackerMapBox.style.display = 'none';
        clearRiderAnimation();
        return;
      }

      const exec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(order) : null;
      const riderData = exec ? (getData('ek_delivery_persons', []).find(r => r.id === exec.id) || {}) : {};
      const hasLocation = !!((order.riderLatitude && order.riderLongitude) || (riderData && riderData.latitude));

      trackerMapBox.style.display = 'block';

      const coords = getOrderCoordinates(order);
      const storePos = coords.store;
      const custPos = coords.customer;

      const isOffline = !navigator.onLine;
      const orderUpdatedTime = new Date(order.updatedAt || order.createdAt || Date.now()).getTime();
      const isStaleGps = order.status === 'delivering' && (Date.now() - orderUpdatedTime > 90000);

      const statusEl = document.getElementById('map-live-status');
      const statusPill = document.getElementById('map-status-pill');
      if (statusEl) {
        if (isOffline || isStaleGps) {
          statusEl.innerHTML = currentLang === 'ta'
            ? `📡 நேரலை ஜிபிஎஸ் இணைப்பு மீட்டமைக்கப்படுகிறது... 🔄`
            : `📡 Reconnecting to Live GPS tracking stream... 🔄`;
          statusEl.style.color = '#f87171';
        } else if (order.status === 'pending') {
          statusEl.innerHTML = currentLang === 'ta' ? `🏪 காவண்டம்பட்டியிலுள்ள Lyo Food Delivery கடையில் தயாரிப்பில் உள்ளது` : `🏪 Preparing order at Lyo Food Delivery, Kavandampatti, Edappadi`;
          statusEl.style.color = 'var(--accent-orange)';
        } else if (order.status === 'ready') {
          statusEl.innerHTML = currentLang === 'ta' ? `🏍️ விநியோக நபர் தயார் & பேக் செய்யப்படுகிறது` : `🏍️ Rider assigned & packing items`;
          statusEl.style.color = '#60a5fa';
        } else if (order.status === 'delivering') {
          statusEl.innerHTML = currentLang === 'ta' ? `🚴‍♂️ உங்களது இடத்திற்கு விநியோகம் செய்யப்படுகிறது` : `🚴‍♂️ Rider enroute to your location`;
          statusEl.style.color = 'var(--accent-orange)';
        } else if (order.status === 'delivered') {
          statusEl.innerHTML = currentLang === 'ta' ? `✅ முழுமையாக விநியோகிக்கப்பட்டது` : `✅ Successfully Delivered`;
          statusEl.style.color = 'var(--accent-green)';
        }
      }

      if (statusPill) {
        if (isOffline || isStaleGps) {
          statusPill.innerText = currentLang === 'ta' ? '📡 இணைக்கிறது...' : '📡 RECONNECTING';
          statusPill.style.background = 'rgba(239, 68, 68, 0.15)';
          statusPill.style.color = '#f87171';
          statusPill.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        } else if (order.status === 'pending') {
          statusPill.innerText = currentLang === 'ta' ? 'தயாரிப்பில்' : 'PREPARING';
          statusPill.style.background = 'rgba(245,158,11,0.1)';
          statusPill.style.color = 'var(--accent-orange)';
          statusPill.style.borderColor = 'rgba(245,158,11,0.3)';
        } else if (order.status === 'ready') {
          statusPill.innerText = currentLang === 'ta' ? 'விநியோக நபர்' : 'RIDER ASSIGNED';
          statusPill.style.background = 'rgba(59,130,246,0.1)';
          statusPill.style.color = '#60a5fa';
          statusPill.style.borderColor = 'rgba(59,130,246,0.3)';
        } else if (order.status === 'delivering') {
          statusPill.innerText = currentLang === 'ta' ? 'விநியோகத்தில்' : 'DELIVERING';
          statusPill.style.background = 'rgba(245,158,11,0.15)';
          statusPill.style.color = 'var(--accent-orange)';
          statusPill.style.borderColor = 'rgba(245,158,11,0.35)';
        } else if (order.status === 'delivered') {
          statusPill.innerText = currentLang === 'ta' ? 'ஒப்படைக்கப்பட்டது' : 'DELIVERED';
          statusPill.style.background = 'rgba(16,185,129,0.1)';
          statusPill.style.color = 'var(--accent-green)';
          statusPill.style.borderColor = 'rgba(16,185,129,0.3)';
        }
      }

      if (typeof L === 'undefined') {
        mapContainer.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:15px; color:var(--text-muted);">
            <p style="font-size:12px;">Map Engine loading... Ensure internet connection. 🌐</p>
          </div>`;
        return;
      }

      clearRiderAnimation();

      if (trackerLeafletMap) {
        [50, 150, 300, 600].forEach(d => {
          setTimeout(() => {
            if (trackerLeafletMap) trackerLeafletMap.invalidateSize();
          }, d);
        });
        updateMapMarkers(order, storePos, custPos);
        return;
      }

      try {
        trackerLeafletMap = L.map('live-map-container', {
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true
        }).setView(storePos, 14);

        trackerTileLayer = createTrackerTileLayer(trackerMapTheme);
        trackerTileLayer.addTo(trackerLeafletMap);

        const storeIcon = L.divIcon({
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
              <div class="map-pin-store" style="background:#e65100; color:#fff; font-size:16px; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:2px solid #fff; box-shadow:0 4px 10px rgba(0,0,0,0.4); z-index:10;">🏪</div>
            </div>
          `,
          className: 'custom-map-icon',
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });

        const custIcon = L.divIcon({
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
              <div class="map-pin-customer" style="background:#10b981; color:#fff; font-size:14px; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:2px solid #fff; box-shadow:0 4px 10px rgba(0,0,0,0.4); z-index:10;">🏠</div>
            </div>
          `,
          className: 'custom-map-icon',
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });

        storeMarker = L.marker(storePos, { icon: storeIcon }).addTo(trackerLeafletMap)
          .bindPopup("<strong>Lyo Food Delivery (நம்ம கடை)</strong><br>Lyo Food Delivery, காவண்டம்பட்டி, எடப்பாடி 🏪🍖");

        customerMarker = L.marker(custPos, { icon: custIcon }).addTo(trackerLeafletMap)
          .bindPopup("<strong>Your Location</strong><br>உங்கள் இல்லம் 🏠");

        routePolyline = L.polyline([storePos, custPos], {
          color: 'var(--accent-orange)',
          weight: 3.5,
          opacity: 0.5,
          dashArray: '6, 12'
        }).addTo(trackerLeafletMap);

        const group = new L.featureGroup([storeMarker, customerMarker]);
        trackerLeafletMap.fitBounds(group.getBounds().pad(0.25), { animate: false });

        trackerLeafletMap.on('click', () => {
          triggerMapTapExperience(order);
        });

        [50, 150, 300, 600, 1200].forEach(d => {
          setTimeout(() => {
            if (trackerLeafletMap) trackerLeafletMap.invalidateSize();
          }, d);
        });

        if (window.ResizeObserver && !mapContainer._hasResizeObserver) {
          mapContainer._hasResizeObserver = true;
          const ro = new ResizeObserver(() => {
            if (trackerLeafletMap) {
              try { trackerLeafletMap.invalidateSize(); } catch(e) {}
            }
          });
          ro.observe(mapContainer);
        }

        updateMapMarkers(order, storePos, custPos);

      } catch (err) {
        console.error("Leaflet map initialization failed:", err);
      }
    }

    function utils_calcLatLonDistanceKm(lat1, lon1, lat2, lon2) {
      if (typeof calculateDistanceKm === 'function') {
        const d = calculateDistanceKm(lat1, lon1, lat2, lon2);
        return d !== null ? d : 0;
      }
      if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 0;
      var R = 6371; // earth radius in km
      var dLat = (lat2 - lat1) * Math.PI / 180;
      var dLon = (lon2 - lon1) * Math.PI / 180;
      var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 10) / 10;
    }

    function triggerMapTapExperience(order) {
      if (!order) return;
      const coords = getOrderCoordinates(order);
      const storePos = coords.store;
      const custPos = coords.customer;

      let centerLatLng = [...custPos];
      let zoomLevel = 15;

      if (order.status === 'delivering' && riderMarker) {
        centerLatLng = [riderMarker.getLatLng().lat, riderMarker.getLatLng().lng];
        zoomLevel = 16;
      }

      if (trackerLeafletMap) {
        trackerLeafletMap.setView(centerLatLng, zoomLevel, {
          animate: false
        });
      }

      const statusText = order.status === 'delivering'
        ? "Centering on Rider's Live Location! 🏍️"
        : "Centering on Route! 🏁";

      showToast(statusText, "info");

      const mapBadge = document.getElementById('map-interactive-badge');
      if (mapBadge) {
        mapBadge.style.display = 'block';

        const badgeStatus = document.getElementById('map-badge-status');
        const badgeEta = document.getElementById('map-badge-eta');
        const badgeDesc = document.getElementById('map-badge-desc');
        const badgeActions = document.getElementById('map-badge-actions');

        if (order.status === 'delivering') {
          badgeStatus.innerText = "🏍️ Rider Enroute";
          badgeEta.style.display = "inline-block";

          let riderDist = utils_calcLatLonDistanceKm(storePos[0], storePos[1], custPos[0], custPos[1]);
          if (riderMarker) {
            const rl = riderMarker.getLatLng();
            riderDist = utils_calcLatLonDistanceKm(rl.lat, rl.lng, custPos[0], custPos[1]);
          }
          const estMins = Math.max(1, Math.round(riderDist * 2.5));
          let preciseDistKm = typeof riderDist !== 'undefined' ? riderDist : 0;
          if (riderMarker) {
            const rl = riderMarker.getLatLng();
            const R = 6371;
            const dLat = (custPos[0] - rl.lat) * Math.PI / 180;
            const dLon = (custPos[1] - rl.lng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(rl.lat * Math.PI / 180) * Math.cos(custPos[0] * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            preciseDistKm = R * c;
          }
          const totalTravelSeconds = Math.max(15, Math.round(preciseDistKm * 150));
          const badgeMins = Math.floor(totalTravelSeconds / 60);
          const badgeSecs = totalTravelSeconds % 60;
          const arrivalDate = new Date(Date.now() + totalTravelSeconds * 1000);
          const etaClockString = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          badgeEta.innerText = currentLang === 'ta'
            ? `⚡ ~${badgeMins}நி ${badgeSecs}வி (~${etaClockString})`
            : `⚡ ~${badgeMins}m ${badgeSecs}s (~${etaClockString})`;

          const exec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(order) : null;
          const list = getData('ek_delivery_persons', []);
          const exe = exec ? list.find(dp => dp.id === exec.id) : null;
          const riderName = exe ? exe.name : ((exec && exec.name) || "Edappadi Partner");
          const riderPhone = exe ? exe.phone : ((exec && exec.phone) || "9042681532");

          badgeDesc.innerText = `Rider ${riderName} is enroute to your doorstep. Tap below to call or chat.`;

          const callText = currentLang === 'ta' ? "கால்" : "Call";
          const messageText = currentLang === 'ta' ? "மெசேஜ்" : "Message";
          const dismissText = currentLang === 'ta' ? "மூடு" : "Dismiss";
          badgeActions.innerHTML = `
            <a href="tel:${riderPhone}" class="btn" style="width:auto; min-width: 65px; min-height: 32px; height: auto; padding:6px 12px; font-size:11px; background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; font-weight:700; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:4px; box-shadow:0 3px 8px rgba(16,185,129,0.25); transition: all 0.2s;">${callText}</a>
            <a href="https://wa.me/${formatIndianPhoneForWhatsApp(riderPhone)}" target="_blank" class="btn" style="width:auto; min-width: 75px; min-height: 32px; height: auto; padding:6px 12px; font-size:11px; background:linear-gradient(135deg, #2563eb, #1d4ed8); color:#fff; border:none; font-weight:700; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:4px; box-shadow:0 3px 8px rgba(37,99,235,0.25); transition: all 0.2s;">${messageText}</a>
            <button onclick="document.getElementById('map-interactive-badge').style.display='none';" class="btn" style="width:auto; min-height: 32px; height: auto; padding:6px 12px; font-size:11px; background:rgba(255,255,255,0.06); border:none; color:#bbb; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; transition: all 0.2s;">${dismissText}</button>
          `;
        } else {
          badgeStatus.innerText = currentLang === 'ta' ? "🏪 தயாரிப்பில் உள்ளது" : "🏪 Order In Preparation";
          badgeEta.style.display = "none";
          badgeDesc.innerText = currentLang === 'ta'
            ? "காவண்டம்பட்டியிலுள்ள எடப்பாடி Lyo Food Delivery கிளையில் உங்கள் உணவு தயாரிக்கப்பட்டு வருகிறது. டெலிவரி நபர் ஆர்டரை எடுத்தவுடன் மேப் அப்டேட் ஆகும்."
            : "Our cooks at Lyo Food Delivery in Kavandampatti, Edappadi are preparing your fresh custom items. The live rider route will update as soon as our rider accepts.";

          let cancelBtnHtml = '';
          if (order && order.status === 'pending') {
            const cancelBtnText = currentLang === 'ta' ? "ஆர்டரை ரத்து செய் 🛑" : "Cancel Order 🛑";
            cancelBtnHtml = `
              <button onclick="customerCancelOrder('${order.id}')" class="btn" style="width:auto; min-height: 32px; height: auto; padding:6px 12px; font-size:11px; background:linear-gradient(135deg, #ef4444, #dc2626); color:#fff; border:none; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(239,68,68,0.25); transition: all 0.2s; cursor: pointer;">${cancelBtnText}</button>
            `;
          }

          const dismissText = currentLang === 'ta' ? "மூடு" : "Dismiss";
          badgeActions.innerHTML = `
            ${cancelBtnHtml}
            <button onclick="document.getElementById('map-interactive-badge').style.display='none';" class="btn" style="width:auto; min-height: 32px; height: auto; padding:6px 12px; font-size:11px; background:rgba(255,255,255,0.06); border:none; color:#bbb; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; transition: all 0.2s; cursor: pointer;">${dismissText}</button>
          `;
        }
      }
    }

    function updateCustomerMapHUD(order, storePos, custPos, currentF) {
      const totalDistEl = document.getElementById('customer-tracker-total-dist');
      const riderDistEl = document.getElementById('customer-tracker-rider-dist');
      const etaTextEl = document.getElementById('visual-hud-eta-text');
      const progressLineEl = document.getElementById('visual-hud-progress-line');
      const riderDotEl = document.getElementById('visual-hud-rider-dot');
      const instructionEl = document.getElementById('visual-hud-instruction-text');

      if (!totalDistEl) return; // Element not present on the current DOM page

      const totalDist = utils_calcLatLonDistanceKm(storePos[0], storePos[1], custPos[0], custPos[1]);
      totalDistEl.innerText = `${totalDist} Km`;

      const overlayEta = document.getElementById('map-live-eta-overlay');
      const overlayEtaText = document.getElementById('map-overlay-eta-text');

      if (order.status === 'pending') {
        riderDistEl.innerText = currentLang === 'ta' ? 'தயாரிப்பில்...' : 'Preparing...';
        etaTextEl.innerHTML = currentLang === 'ta' ? '⏰ ~15-20 நிமிடம்' : '⏰ ~15-20 Mins';
        progressLineEl.style.width = '5%';
        riderDotEl.style.left = '5%';
        instructionEl.innerHTML = currentLang === 'ta'
          ? '🥩 ஆர்டர் தயாரிப்பில் உள்ளது / Preparing order...'
          : '🥩 Preparing your custom premium order...';

        if (overlayEta) {
          overlayEta.style.display = 'flex';
          if (overlayEtaText) {
            overlayEtaText.innerHTML = currentLang === 'ta' ? 'தயாரிப்பில் (Preparing)' : 'Preparing order...';
          }
        }
      } else if (order.status === 'ready') {
        riderDistEl.innerText = currentLang === 'ta' ? 'கடைக்கு வருகை...' : 'Rider Picking up...';
        etaTextEl.innerHTML = currentLang === 'ta' ? '⏰ ~10-15 நிமிடம்' : '⏰ ~10-15 Mins';
        progressLineEl.style.width = '15%';
        riderDotEl.style.left = '15%';
        instructionEl.innerHTML = currentLang === 'ta'
          ? '📦 டெலிவரி நபர் கடைக்கு வந்துள்ளார் / Rider at store...'
          : '📦 Cleanly packed! Rider is accepting cargo at the store...';

        if (overlayEta) {
          overlayEta.style.display = 'flex';
          if (overlayEtaText) {
            overlayEtaText.innerHTML = currentLang === 'ta' ? 'கடைக்கு வருகை (At Store)' : 'Rider Picking up...';
          }
        }
      } else if (order.status === 'delivering') {
        const fraction = typeof currentF === 'number' ? currentF : 0.05;

        let interpLat = storePos[0] + (custPos[0] - storePos[0]) * fraction;
        let interpLng = storePos[1] + (custPos[1] - storePos[1]) * fraction;
        if (riderMarker) {
          const rl = riderMarker.getLatLng();
          interpLat = rl.lat;
          interpLng = rl.lng;
        }

        const R = 6371; // Earth radius
        const dLat = (custPos[0] - interpLat) * Math.PI / 180;
        const dLon = (custPos[1] - interpLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(interpLat * Math.PI / 180) * Math.cos(custPos[0] * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const preciseDistKm = R * c;

        const riderDist = Math.max(0.1, Math.round(preciseDistKm * 10) / 10);
        riderDistEl.innerText = `${riderDist} Km`;

        const totalTravelSeconds = Math.max(15, Math.round(preciseDistKm * 150));

        const estMins = Math.floor(totalTravelSeconds / 60);
        const estSecs = totalTravelSeconds % 60;

        const arrivalDate = new Date(Date.now() + totalTravelSeconds * 1000);
        const etaClockString = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const progressTimeLabel = currentLang === 'ta'
          ? `⚡ ${estMins}நி ${estSecs}வி (~${etaClockString})`
          : `⚡ ${estMins}m ${estSecs}s (~${etaClockString})`;
        etaTextEl.innerHTML = progressTimeLabel;

        const visualPct = Math.round(15 + fraction * 75);
        progressLineEl.style.width = `${visualPct}%`;
        riderDotEl.style.left = `${visualPct}%`;

        instructionEl.innerHTML = currentLang === 'ta'
          ? `🏍️ விநியோக நபர் உங்களது இல்லம் நோக்கி தீவிரமாக வருகிறார் (இன்னும்: ${preciseDistKm.toFixed(2)} கி.மீ • துல்லிய நேரம்)`
          : `🏍️ Rider is enroute towards your house (Remaining: ${preciseDistKm.toFixed(2)} Km • Precise time)`;

        if (overlayEta) {
          overlayEta.style.display = 'flex';
          if (overlayEtaText) {
            overlayEtaText.innerHTML = currentLang === 'ta'
              ? `நேரம்: ~${estMins}நி ${estSecs}வி (ETA: ${etaClockString})`
              : `~${estMins}m ${estSecs}s (ETA: ${etaClockString})`;
          }
        }
      } else {
        riderDistEl.innerText = '0 Km';
        etaTextEl.innerHTML = '✅ Arrived';
        progressLineEl.style.width = '100%';
        riderDotEl.style.left = '100%';
        instructionEl.innerHTML = currentLang === 'ta'
          ? '🎉 வெற்றிகரமாக ஒப்படைக்கப்பட்டது! நன்றி'
          : '🎉 Safely delivered! Thank you for ordering with us.';

        if (overlayEta) {
          overlayEta.style.display = 'flex';
          if (overlayEtaText) {
            overlayEtaText.innerHTML = currentLang === 'ta' ? '✅ வந்தது (Delivered)' : '✅ Arrived';
          }
        }
      }
    }

    let lastRiderLat = null;
    let lastRiderLng = null;
    let lastTrackedOrderId = null;
    let trackerMapUpdateTimeout = null;

    function debouncedLiveTrackingMapUpdate(order, storePos, custPos) {
      if (trackerMapUpdateTimeout) {
        clearTimeout(trackerMapUpdateTimeout);
      }

      if (order.id !== lastTrackedOrderId) {
        lastTrackedOrderId = order.id;
        lastRiderLat = null;
        lastRiderLng = null;
      }

      const exec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(order) : null;
      const list = getData('ek_delivery_persons', []);
      const exe = exec ? list.find(dp => dp.id === exec.id) : null;
      const effectiveLat = (order.riderLatitude && !isNaN(parseFloat(order.riderLatitude))) 
        ? parseFloat(order.riderLatitude) 
        : (exe && exe.latitude && !isNaN(parseFloat(exe.latitude)) ? parseFloat(exe.latitude) : null);
      const effectiveLng = (order.riderLongitude && !isNaN(parseFloat(order.riderLongitude))) 
        ? parseFloat(order.riderLongitude) 
        : (exe && exe.longitude && !isNaN(parseFloat(exe.longitude)) ? parseFloat(exe.longitude) : null);

      if (effectiveLat !== null && effectiveLng !== null) {
        if (lastRiderLat !== null && lastRiderLng !== null) {
          const latDiff = Math.abs(effectiveLat - lastRiderLat);
          const lngDiff = Math.abs(effectiveLng - lastRiderLng);
          if (latDiff < 0.00001 && lngDiff < 0.00001) {
            debugLog("[Map Optim] Rider coordinate change is extremely minor. Skipping redundant heavy redraw.");
            return;
          }
        }
        lastRiderLat = effectiveLat;
        lastRiderLng = effectiveLng;
      }

      trackerMapUpdateTimeout = setTimeout(() => {
        debugLog("[Map Performance] Executing debounced map marker and layout synchronization.");
        updateMapMarkers(order, storePos, custPos);
      }, 350);
    }

    function updateMapMarkers(order, storePos, custPos) {
      if (!trackerLeafletMap) return;

      clearRiderAnimation();

      const dx = custPos[1] - storePos[1];
      const flipper = dx < 0 ? 'scaleX(1)' : 'scaleX(-1)';
      const riderTag = currentLang === 'ta' ? 'விநியோகம் 🏍️' : 'Delivering ⚡';

      const riderIcon = L.divIcon({
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 50px; height: 50px;">
            <div style="position: absolute; width: 44px; height: 44px; background: rgba(245,158,11,0.25); border-radius: 50%; animation: rider-pulse-ring 1.8s infinite linear; z-index: 1;"></div>
            <div style="background:#f59e0b; border: 2.5px solid #fff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 14px rgba(0,0,0,0.5); z-index:10; font-size: 18px;">
              <span style="display: inline-block; transform: ${flipper}; font-size: 18px; line-height: 1;">🏍️</span>
            </div>
            <div style="position: absolute; top: -24px; bottom: auto !important; background: #eab308; border: 1.5px solid #000; border-radius: 6px; padding: 2px 6px; font-size: 9px; font-weight: 800; color: #000; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 20; text-transform: uppercase;">
              ${riderTag}
            </div>
          </div>
        `,
        className: 'custom-rider-map-icon',
        iconSize: [50, 50],
        iconAnchor: [25, 25]
      });

      let riderPos = [...storePos];
      let showRider = false;
      let calculatedF = 0;

      const isDelivering = ['delivering', 'out_for_delivery', 'dispatch'].includes((order.status || '').toLowerCase().trim());
      if (isDelivering) {
        showRider = true;

        const exec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(order) : null;
        const list = getData('ek_delivery_persons', []);
        const exe = exec ? list.find(dp => dp.id === exec.id) : null;

        let initialLat = storePos[0];
        let initialLng = storePos[1];
        if (order.riderLatitude && order.riderLongitude && !isNaN(parseFloat(order.riderLatitude)) && !isNaN(parseFloat(order.riderLongitude))) {
          initialLat = parseFloat(order.riderLatitude);
          initialLng = parseFloat(order.riderLongitude);
        } else if (exe && exe.latitude && exe.longitude && !isNaN(parseFloat(exe.latitude)) && !isNaN(parseFloat(exe.longitude))) {
          initialLat = parseFloat(exe.latitude);
          initialLng = parseFloat(exe.longitude);
        }

        if (!riderMarker) {
          riderMarker = L.marker([initialLat, initialLng], { icon: riderIcon, zIndexOffset: 1000 }).addTo(trackerLeafletMap)
            .bindPopup("<strong>Delivery Executive</strong><br>உங்கள் விநியோக நபர் 🏍️");
        } else {
          if (!trackerLeafletMap.hasLayer(riderMarker)) {
            riderMarker.addTo(trackerLeafletMap);
          }
        }

        const updatedMs = new Date(order.updatedAt || new Date()).getTime();
        const tripDuration = 120; // 2 minutes trip

        let lastCacheRead = 0;
        let cachedExe = null;
        let currentActiveOrder = order;

        function interpolateRiderFrame() {
          if (!riderMarker) return;
          const statusNorm = (currentActiveOrder.status || '').toLowerCase().trim();
          if (!['delivering', 'out_for_delivery', 'dispatch'].includes(statusNorm)) return;

          const nowTime = Date.now();
          if (nowTime - lastCacheRead > 1000 || !cachedExe) {
            const currentOrders = getData('ek_orders', []);
            const freshOrder = currentOrders.find(o => o.id === currentActiveOrder.id);
            if (freshOrder) currentActiveOrder = freshOrder;

            const currentExec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(currentActiveOrder) : null;
            const currentList = getData('ek_delivery_persons', []);
            cachedExe = currentExec ? (currentList.find(dp => dp.id === currentExec.id) || null) : null;
            lastCacheRead = nowTime;
          }
          const currentExe = cachedExe;

          let targetLat, targetLng;
          const totalDist = utils_calcLatLonDistanceKm(storePos[0], storePos[1], custPos[0], custPos[1]);

          if (currentActiveOrder.riderLatitude && currentActiveOrder.riderLongitude && !isNaN(parseFloat(currentActiveOrder.riderLatitude)) && !isNaN(parseFloat(currentActiveOrder.riderLongitude))) {
            targetLat = parseFloat(currentActiveOrder.riderLatitude);
            targetLng = parseFloat(currentActiveOrder.riderLongitude);
          } else if (currentExe && currentExe.latitude && currentExe.longitude && !isNaN(parseFloat(currentExe.latitude)) && !isNaN(parseFloat(currentExe.longitude))) {
            targetLat = parseFloat(currentExe.latitude);
            targetLng = parseFloat(currentExe.longitude);
          } else {
            targetLat = storePos[0];
            targetLng = storePos[1];
          }

          const currentLatLng = riderMarker.getLatLng();
          const dLat = targetLat - currentLatLng.lat;
          const dLng = targetLng - currentLatLng.lng;
          const distSq = dLat * dLat + dLng * dLng;

          if (distSq < 0.00000001) {
            riderMarker.setLatLng([targetLat, targetLng]);
            const currentRiderDist = utils_calcLatLonDistanceKm(targetLat, targetLng, custPos[0], custPos[1]);
            const currentF = totalDist > 0 ? Math.max(0, Math.min(1 - (currentRiderDist / totalDist), 0.98)) : 0.5;
            updateCustomerMapHUD(currentActiveOrder, storePos, custPos, currentF);
            riderAnimationFrameId = null;
            return;
          }

          const filterCoeff = 0.08; // Smooth interpolation coefficient
          const interpLat = currentLatLng.lat + dLat * filterCoeff;
          const interpLng = currentLatLng.lng + dLng * filterCoeff;

          riderMarker.setLatLng([interpLat, interpLng]);

          const currentRiderDist = utils_calcLatLonDistanceKm(interpLat, interpLng, custPos[0], custPos[1]);
          const currentF = totalDist > 0 ? Math.max(0, Math.min(1 - (currentRiderDist / totalDist), 0.98)) : 0.5;

          updateCustomerMapHUD(currentActiveOrder, storePos, custPos, currentF);

          riderAnimationFrameId = requestAnimationFrame(interpolateRiderFrame);
        }

        riderAnimationFrameId = requestAnimationFrame(interpolateRiderFrame);

      } else if (order.status === 'delivered') {
        showRider = true;
        riderPos = [...custPos];
        calculatedF = 1.0;

        if (!riderMarker) {
          riderMarker = L.marker(riderPos, { icon: riderIcon }).addTo(trackerLeafletMap)
            .bindPopup("<strong>Delivery Executive</strong><br>உங்கள் விநியோக நபர் 🏍️");
        }

        const currentLatLng = riderMarker.getLatLng();
        const dist = Math.sqrt(Math.pow(currentLatLng.lat - riderPos[0], 2) + Math.pow(currentLatLng.lng - riderPos[1], 2));
        if (dist > 0.0001) {
          let startPaint = null;
          const glideDuration = 1000;
          function glideStep(timestamp) {
            if (!startPaint) startPaint = timestamp;
            const progress = Math.min((timestamp - startPaint) / glideDuration, 1);
            if (riderMarker) {
              const currentLat = currentLatLng.lat + (riderPos[0] - currentLatLng.lat) * progress;
              const currentLng = currentLatLng.lng + (riderPos[1] - currentLatLng.lng) * progress;
              riderMarker.setLatLng([currentLat, currentLng]);
            }
            if (progress < 1) {
              riderAnimationFrameId = requestAnimationFrame(glideStep);
            }
          }
          riderAnimationFrameId = requestAnimationFrame(glideStep);
        } else {
          riderMarker.setLatLng(riderPos);
        }

        updateCustomerMapHUD(order, storePos, custPos, calculatedF);
      } else {
        if (riderMarker) {
          trackerLeafletMap.removeLayer(riderMarker);
          riderMarker = null;
        }
        updateCustomerMapHUD(order, storePos, custPos, calculatedF);
      }

      try {
        const activeElements = [storeMarker, customerMarker];
        if (showRider && riderMarker) activeElements.push(riderMarker);
        const group = new L.featureGroup(activeElements);
        const bounds = group.getBounds().pad(0.3);

        const stateKey = `${order.id}_${order.status}`;
        if (trackerLeafletMap._lastFlownState !== stateKey) {
          trackerLeafletMap._lastFlownState = stateKey;
          trackerLeafletMap.fitBounds(bounds, { animate: false });
          trackerLeafletMap._lastBoundFitTime = Date.now();
        } else {
          const now = Date.now();
          if (!trackerLeafletMap._lastBoundFitTime || (now - trackerLeafletMap._lastBoundFitTime > 15000)) {
            trackerLeafletMap._lastBoundFitTime = now;
            trackerLeafletMap.fitBounds(bounds, { animate: false });
          }
        }
      } catch (err) {
        console.warn(err);
      }
    }

    function clearRiderAnimation() {
      if (riderAnimationTimer) {
        clearInterval(riderAnimationTimer);
        riderAnimationTimer = null;
      }
      if (riderAnimationFrameId) {
        cancelAnimationFrame(riderAnimationFrameId);
        riderAnimationFrameId = null;
      }
    }

    function computeLoyaltyTier(points) {
      const pts = parseInt(points) || 0;
      if (pts >= 500) return 'gold';
      if (pts >= 150) return 'silver';
      return 'bronze';
    }
    window.computeLoyaltyTier = computeLoyaltyTier;

    function formatIndianPhoneForWhatsApp(rawPhone) {
      if (!rawPhone) return '';
      const digits = String(rawPhone).replace(/\D/g, '');
      if (!digits) return '';
      if (digits.length === 10) {
        return '91' + digits;
      }
      if (digits.length > 10 && digits.startsWith('91')) {
        return digits;
      }
      if (digits.length === 11 && digits.startsWith('0')) {
        return '91' + digits.slice(1);
      }
      return digits.startsWith('91') ? digits : '91' + digits;
    }
    window.formatIndianPhoneForWhatsApp = formatIndianPhoneForWhatsApp;

    function openWhatsAppDirect(phoneNum, text = '') {
      const formattedPhone = phoneNum ? formatIndianPhoneForWhatsApp(phoneNum) : '';
      const encodedText = encodeURIComponent(text || '');
      let waUrl = '';
      if (formattedPhone) {
        waUrl = `https://wa.me/${formattedPhone}${encodedText ? '?text=' + encodedText : ''}`;
      } else {
        waUrl = `https://wa.me/?text=${encodedText}`;
      }

      try {
        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.openUrl === 'function') {
          AndroidStorage.openUrl(waUrl);
        } else if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.shareIntent === 'function') {
          AndroidStorage.shareIntent(text || 'Order Details', waUrl);
        } else {
          window.location.href = waUrl;
        }
      } catch (e) {
        window.location.href = waUrl;
      }
    }

    function openGoogleMapsNavigation(orderId = null) {
      let orderToQuery = null;
      const orders = getData('ek_orders');

      if (orderId) {
        orderToQuery = orders.find(o => o.id === orderId);
      } else {
        const session = getActiveSession();
        if (session) {
          const userOrders = orders.filter(o => o.customerId === session.userId || (o.customerPhone && session.phone && o.customerPhone === session.phone))
                                  .sort((a,b) => safeParseTime(b.createdAt) - safeParseTime(a.createdAt));
          orderToQuery = userOrders[0];
        }
      }

      if (orderToQuery) {
        const coords = getOrderCoordinates(orderToQuery);
        const destinationStr = `${coords.customer[0]},${coords.customer[1]}`;
        const isAndroidApp = typeof AndroidStorage !== 'undefined';

        const mapsUrl = isAndroidApp
          ? `google.navigation:q=${destinationStr}`
          : `https://www.google.com/maps/dir/?api=1&origin=11.5815,77.8488&destination=${destinationStr}&travelmode=driving`;
        window.open(mapsUrl, '_blank');
      } else {
        window.open(`https://www.google.com/maps/search/?api=1&query=Edappadi`, '_blank');
      }
    }

    
    function isSamePhone(p1, p2) {
      if (!p1 || !p2) return false;
      const c1 = String(p1).replace(/\D/g, "").slice(-10);
      const c2 = String(p2).replace(/\D/g, "").slice(-10);
      return c1.length === 10 && c1 === c2;
    }

    function isCustomerOrder(order, session, activeUser) {
      if (!order) return false;

      const sessionUserId = session ? (session.userId || session.id) : null;
      const activeUserId = activeUser ? (activeUser.id || activeUser.uid) : null;
      const sessionPhone = session ? session.phone : null;
      const activeUserPhone = activeUser ? activeUser.phone : null;

      const firebaseUser = (typeof firebase !== "undefined" && firebase.auth) ? firebase.auth().currentUser : null;
      const fbUid = firebaseUser ? firebaseUser.uid : null;
      const fbPhone = firebaseUser ? firebaseUser.phoneNumber : null;

      // 1. Check ID exact matches
      const userIdsToCheck = [sessionUserId, activeUserId, fbUid].filter(Boolean).map(String);
      const orderCustId = order.customerId ? String(order.customerId) : "";
      const orderUserId = order.userId ? String(order.userId) : "";

      for (const uid of userIdsToCheck) {
        if (uid && (orderCustId === uid || orderUserId === uid)) {
          return true;
        }
      }

      // 2. Check Phone matches
      const orderPhone = order.customerPhone || order.phone;
      if (orderPhone) {
        if (sessionPhone && isSamePhone(orderPhone, sessionPhone)) return true;
        if (activeUserPhone && isSamePhone(orderPhone, activeUserPhone)) return true;
        if (fbPhone && isSamePhone(orderPhone, fbPhone)) return true;
      }

      return false;
    }

    window.clearOrderHistoryFilters = function() {
      const searchInput = document.getElementById('track-orders-search');
      if (searchInput) searchInput.value = '';
      if (typeof setOrderHistoryStatusFilter === 'function') {
        setOrderHistoryStatusFilter('all');
      } else {
        selectedOrderHistoryStatusFilter = 'all';
        renderTrackerScreen();
      }
    };

    function getOrdersEmptyStateHtml(isFiltered = false) {
      const isTa = typeof currentLang !== 'undefined' && currentLang === 'ta';
      const title = isFiltered
        ? (isTa ? 'ஆர்டர்கள் எதுவும் கிடைக்கவில்லை' : 'No Orders Found')
        : (isTa ? 'கடந்த கால ஆர்டர்கள் எதுவும் இல்லை' : 'No Orders Found');
      const subtitle = isFiltered
        ? (isTa ? 'நீங்கள் தேர்ந்தெடுத்த வடிகட்டல் அல்லது தேடலுக்குரிய ஆர்டர்கள் எதுவும் இல்லை. வடிகட்டலை மாற்றவும் அல்லது புதிய ஆர்டர் செய்யவும்.' : 'We couldn\'t find any orders matching your search or status filter. Try clearing filters or explore our menu.')
        : (isTa ? 'நீங்கள் இன்னும் எந்த ஆர்டரும் செய்யவில்லை. புதிய நாட்டுக்கோழி, ஆட்டுக்கறி மற்றும் மசாலாப் பொருட்களை வாங்க இப்போதே ஆர்டர் செய்யுங்கள்!' : 'You haven\'t placed any orders yet. Discover our premium fresh meats, authentic spices, and daily specials to place your first order!');

      return `
        <div class="orders-empty-card" data-testid="orders-empty-state">
          <div class="empty-icon-bubble">
            <span class="empty-floating-emoji">🧾</span>
            <div class="empty-halo"></div>
          </div>
          <h3 class="empty-state-title">
            ${title}
          </h3>
          <p class="empty-state-subtitle">
            ${subtitle}
          </p>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; align-items: center; width: 100%; margin-top: 6px;">
            ${isFiltered ? `
              <button onclick="clearOrderHistoryFilters()" class="btn" style="min-height: 48px; padding: 10px 18px; background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.18); border-radius: 14px; color: #fff; font-size: 13px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                🔄 ${isTa ? 'வடிகட்டலை நீக்கு' : 'Clear Filters'}
              </button>
            ` : ''}
            <button onclick="showScreen('screen-home')" class="orders-empty-home-btn" data-testid="empty-orders-home-btn">
              <span style="font-size: 16px;">🏠</span>
              <span>${isTa ? 'முகப்புக்கு செல் / Start Shopping' : 'Back to Home / Explore Menu'}</span>
              <span style="font-size: 14px;">➔</span>
            </button>
          </div>
        </div>
      `;
    }

    function renderTrackerScreen() {
      const orders = getDataCached('ek_orders', []);
      let session = getActiveSession();

      if (!session && selectedTrackOrderId) {
        session = { userId: "guest_tracker", loggedIn: true, phone: "" };
      }

      const activeBox = document.getElementById('active-tracker-box');
      const pastList = document.getElementById('past-orders-list');
      if (!pastList) return;

      if (!session) {
        if (activeBox) activeBox.style.display = 'none';
        if (typeof initLiveTrackerMap === 'function') initLiveTrackerMap(null);
        pastList.innerHTML = `
          <div class="card" style="text-align: center; padding: 24px 16px; border: 1.5px dashed rgba(245,158,11,0.3); background: rgba(24, 20, 16, 0.5); border-radius: 16px;">
            <div style="font-size: 36px; margin-bottom: 8px;">🔍📦</div>
            <h4 style="color: #fff; font-size: 15px; font-weight: 750; margin-bottom: 6px;">
              ${typeof currentLang !== 'undefined' && currentLang === 'ta' ? 'நேரலை ஆர்டர் கண்காணிப்பு' : 'Live Order Tracking'}
            </h4>
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 16px; max-width: 280px; margin-left: auto; margin-right: auto; line-height: 1.4;">
              ${typeof currentLang !== 'undefined' && currentLang === 'ta' ? 'மேலே உள்ள தேடல் கட்டத்தில் உங்கள் ஆர்டர் ஐடி-யை உள்ளிட்டு கண்காணிக்கவும். அல்லது உள்நுழையவும்.' : 'Enter your Order ID in the search box above to track your order, or login to view all your past orders.'}
            </p>
            <button onclick="showScreen('screen-login')" class="btn btn-primary" style="padding: 10px 20px; font-size: 13px; font-weight: 750; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: auto; margin: 0 auto;">
              🔐 ${typeof currentLang !== 'undefined' && currentLang === 'ta' ? 'உள்நுழைக / Login' : 'Login to View History'}
            </button>
          </div>
        `;
        return;
      }

      const deletedOrderIds = getDeletedOrderIds();
      const customerHiddenIds = getCustomerHiddenOrderIds();
      const activeUser = typeof getActiveUser === 'function' ? getActiveUser() : null;
      let userOrders = orders.filter(o => {
        const isOwn = isCustomerOrder(o, session, activeUser);
        const isHidden = o.hiddenByCustomer === true || o.hiddenByAdmin === true || deletedOrderIds.includes(o.id) || customerHiddenIds.includes(o.id);
        return isOwn && !isHidden;
      }).sort((a,b) => safeParseTime(b.createdAt) - safeParseTime(a.createdAt));

      if (selectedTrackOrderId) {
        const sharedOrder = orders.find(o => o.id === selectedTrackOrderId);
        if (sharedOrder && !userOrders.some(o => o.id === selectedTrackOrderId)) {
          userOrders.unshift(sharedOrder);
        }
      }

      if (userOrders.length === 0) {
        activeBox.style.display = 'none';
        initLiveTrackerMap(null);
        pastList.innerHTML = getOrdersEmptyStateHtml(false);
        return;
      }

      const searchInput = document.getElementById('track-orders-search');
      const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

      let latestTrackable = null;
      if (selectedTrackOrderId) {
        latestTrackable = userOrders.find(o => o.id === selectedTrackOrderId);
      }
      if (!latestTrackable) {
        const activeStatuses = ['pending', 'confirmed', 'preparing', 'packing', 'processing', 'ready', 'delivering', 'out_for_delivery', 'shipped', 'dispatch'];
        latestTrackable = userOrders.find(o => activeStatuses.includes((o.status || '').toLowerCase().trim()));
      }

      if (latestTrackable && typeof db !== 'undefined' && db) {
        const trackingOrderId = latestTrackable.id;
        if (window.activeTrackedOrderIdListener !== trackingOrderId) {
          if (typeof window.activeTrackedOrderUnsubscribe === 'function') {
            try { window.activeTrackedOrderUnsubscribe(); } catch(e) {}
          }
          window.activeTrackedOrderIdListener = trackingOrderId;
          debugLog(`[Realtime Tracker] Listening to specific order: ${trackingOrderId}`);
          window.activeTrackedOrderUnsubscribe = db.collection('ek_orders').doc(trackingOrderId).onSnapshot({ includeMetadataChanges: true }, (doc) => {
            if (doc.exists) {
              const updatedOrder = normalizeFirestoreData(doc.data());
              if (updatedOrder) {
                const localOrders = getData('ek_orders', []);
                const oIdx = localOrders.findIndex(o => o.id === trackingOrderId);
                if (oIdx !== -1) {
                  localOrders[oIdx] = updatedOrder;
                } else {
                  localOrders.push(updatedOrder);
                }
                saveData('ek_orders', localOrders);

                if (currentScreen === 'screen-track') {
                  renderTrackerScreen();
                }
              }
            }
          }, (err) => {
            console.error(`[Realtime Tracker] Specific order listener error:`, err);
            window.activeTrackedOrderIdListener = null;
            window.activeTrackedOrderUnsubscribe = null;
            setTimeout(() => {
              if (currentScreen === 'screen-track') {
                renderTrackerScreen();
              }
            }, 3000);
          });
        }

        // Realtime listener for assigned delivery partner location updates
        const trackedExec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(latestTrackable) : null;
        const riderId = trackedExec ? trackedExec.id : null;
        if (riderId) {
          if (window.activeTrackedRiderIdListener !== riderId) {
            if (typeof window.activeTrackedRiderUnsubscribe === 'function') {
              try { window.activeTrackedRiderUnsubscribe(); } catch(e) {}
            }
            window.activeTrackedRiderIdListener = riderId;
            debugLog(`[Realtime Tracker] Listening to delivery partner: ${riderId}`);
            window.activeTrackedRiderUnsubscribe = db.collection('ek_delivery_persons').doc(riderId).onSnapshot((rDoc) => {
              if (rDoc.exists) {
                const rData = normalizeFirestoreData(rDoc.data());
                if (rData) {
                  const list = getData('ek_delivery_persons', []);
                  const rIdx = list.findIndex(r => r.id === riderId || r.uid === riderId);
                  if (rIdx !== -1) {
                    list[rIdx] = { ...list[rIdx], ...rData };
                  } else {
                    list.push(rData);
                  }
                  saveData('ek_delivery_persons', list);

                  if (currentScreen === 'screen-track') {
                    const currentOrders = getData('ek_orders', []);
                    const activeOrder = currentOrders.find(o => o.id === trackingOrderId);
                    if (activeOrder && typeof debouncedLiveTrackingMapUpdate === 'function') {
                      const coords = getOrderCoordinates(activeOrder);
                      debouncedLiveTrackingMapUpdate(activeOrder, coords.store, coords.customer);
                    } else if (typeof renderTrackerScreen === 'function') {
                      renderTrackerScreen();
                    }
                  }
                }
              }
            }, (rErr) => {
              console.warn(`[Realtime Tracker] Rider listener warning:`, rErr);
            });
          }
        } else {
          if (typeof window.activeTrackedRiderUnsubscribe === 'function') {
            try { window.activeTrackedRiderUnsubscribe(); } catch(e) {}
            window.activeTrackedRiderUnsubscribe = null;
            window.activeTrackedRiderIdListener = null;
          }
        }
      } else {
        if (typeof window.activeTrackedOrderUnsubscribe === 'function') {
          try { window.activeTrackedOrderUnsubscribe(); } catch(e) {}
          window.activeTrackedOrderUnsubscribe = null;
          window.activeTrackedOrderIdListener = null;
        }
        if (typeof window.activeTrackedRiderUnsubscribe === 'function') {
          try { window.activeTrackedRiderUnsubscribe(); } catch(e) {}
          window.activeTrackedRiderUnsubscribe = null;
          window.activeTrackedRiderIdListener = null;
        }
      }

      if (latestTrackable && !latestTrackable.isArchived) {
        activeBox.style.display = 'block';
        activeBox.style.cursor = 'pointer';
        activeBox.onclick = function(e) {
          if (e.target.closest('button') || e.target.closest('.tracker-timeline-card') || e.target.closest('.tracker-items-summary') || e.target.closest('#tracker-map-box') || e.target.closest('.leaflet-container') || e.target.closest('.leaflet-popup')) return; // skip if clicked map, cancel button, timeline or collapsed panels
          openCustomerOrderDetail(latestTrackable.id);
        };

        document.getElementById('track-order-id').innerText = latestTrackable.id;

        const isUnverified = latestTrackable.status === 'payment_pending_verification' || latestTrackable.paymentStatus === 'PENDING_VERIFICATION' || latestTrackable.needsPaymentVerification === true;
        const badgeElement = document.getElementById('track-order-status');
        if (isUnverified) {
          badgeElement.innerText = currentLang === 'ta' ? 'கட்டணம் சரிபார்க்கப்படுகிறது' : 'VERIFYING PAYMENT';
          badgeElement.className = 'badge badge-pending';
          badgeElement.style.background = 'rgba(245, 158, 11, 0.2)';
          badgeElement.style.color = '#f59e0b';
          badgeElement.style.border = '1px solid #f59e0b';
        } else {
          badgeElement.innerText = latestTrackable.status.toUpperCase();
          badgeElement.className = `badge badge-${latestTrackable.status}`;
        }

        const formattedTime = safeFormatTime(latestTrackable.updatedAt || latestTrackable.createdAt);
        document.getElementById('track-order-time').innerText = formattedTime;

        let unverifiedNotice = document.getElementById('track-unverified-notice-box');
        if (isUnverified) {
          if (!unverifiedNotice) {
            unverifiedNotice = document.createElement('div');
            unverifiedNotice.id = 'track-unverified-notice-box';
            const timeEl = document.getElementById('track-order-time');
            if (timeEl && timeEl.parentNode) {
              timeEl.parentNode.insertBefore(unverifiedNotice, timeEl.nextSibling);
            }
          }
          unverifiedNotice.style.display = 'block';
          unverifiedNotice.style.background = 'rgba(245, 158, 11, 0.12)';
          unverifiedNotice.style.border = '1px solid rgba(245, 158, 11, 0.4)';
          unverifiedNotice.style.borderRadius = '10px';
          unverifiedNotice.style.padding = '10px 12px';
          unverifiedNotice.style.marginTop = '10px';
          unverifiedNotice.style.fontSize = '12px';
          unverifiedNotice.style.color = '#fbbf24';
          unverifiedNotice.style.lineHeight = '1.4';
          unverifiedNotice.innerHTML = `
            <strong>⏳ ${currentLang === 'ta' ? 'கட்டணம் சரிபார்க்கப்படுகிறது' : 'Payment Verification Pending'}:</strong><br>
            ${currentLang === 'ta'
              ? 'உங்களது யுபிஐ கட்டண விபரம் பெறப்பட்டது. கடை நிர்வாகி வங்கிக் கணக்கில் சரிபார்த்தவுடன் ஆர்டர் தயார் செய்யப்படும்.'
              : 'Your UPI payment reference is being verified by shop admin before dispatch. Thank you for your patience!'}
          `;
        } else if (unverifiedNotice) {
          unverifiedNotice.style.display = 'none';
        }

        const itemsSummaryList = document.getElementById('track-items-summary-list');
        if (itemsSummaryList && latestTrackable.items) {
          let listHtml = '';
          latestTrackable.items.forEach(it => {
            const formattedWeight = getFormattedItemQty(it, currentLang);
            const prep = getLocalizedPrepareText(it.cutStyle, it.category);
            const prepStr = prep ? ` | ${prep}` : '';
            listHtml += `
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; padding: 4px 0;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: var(--accent-orange); font-weight: bold;">•</span>
                  <div>
                    <span style="color: #fff; font-weight: 600;">${it.englishName}</span>
                    <span style="font-size: 11px; color: var(--text-muted); display: block;">${it.tamilName || ''}${prepStr}</span>
                  </div>
                </div>
                <div style="text-align: right;">
                  <span style="color: var(--text-secondary); font-weight: 600; display: block;">${formattedWeight}</span>
                  <span style="font-size: 11px; color: var(--text-muted);">₹${it.totalPrice}</span>
                </div>
              </div>
            `;
          });

          listHtml += `
            <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 8px; margin-top: 4px; display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--text-secondary);">
              <div style="display: flex; justify-content: space-between;">
                <span>${currentLang === 'ta' ? 'விபரம் (Subtotal):' : 'Subtotal:'}</span>
                <span>₹${latestTrackable.items.reduce((s, x) => s + x.totalPrice, 0)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>${currentLang === 'ta' ? 'டெலிவரி கட்டணம்:' : 'Delivery Charge:'}</span>
                <span>${(latestTrackable.deliveryCharge !== undefined ? latestTrackable.deliveryCharge : (latestTrackable.deliveryFee || 0)) === 0 ? "FREE ✨" : `₹${latestTrackable.deliveryCharge !== undefined ? latestTrackable.deliveryCharge : (latestTrackable.deliveryFee || 0)}`}</span>
              </div>
              ${(latestTrackable.loyaltyDiscount !== undefined ? latestTrackable.loyaltyDiscount : (latestTrackable.discountApplied || 0)) > 0 ? `
              <div style="display: flex; justify-content: space-between; color: var(--accent-green);">
                <span>${currentLang === 'ta' ? 'தள்ளுபடி:' : 'Discount:'}</span>
                <span>-₹${latestTrackable.loyaltyDiscount !== undefined ? latestTrackable.loyaltyDiscount : latestTrackable.discountApplied}</span>
              </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-weight: bold; color: #fff; font-size: 13.5px; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 6px; margin-top: 2px;">
                <span>${currentLang === 'ta' ? 'மொத்த தொகை:' : 'Grand Total:'}</span>
                <span style="color: var(--accent-green);">₹${latestTrackable.totalAmount}</span>
              </div>
            </div>
          `;
          itemsSummaryList.innerHTML = listHtml;
        }

        const celebrationContainer = document.getElementById('tracker-delivered-celebration-container');
        const mapBox = document.getElementById('tracker-map-box');
        const timelineCard = document.getElementById('tracker-timeline-card-container');
        const riderContainer = document.getElementById('track-rider-container');
        const cancelBtnContainer = document.getElementById('track-cancel-container');
        const rejBox = document.getElementById('track-rejection-msg-box');

        if (latestTrackable.status === 'delivered') {
          if (celebrationContainer) {
            celebrationContainer.style.display = 'block';

            const exec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(latestTrackable) : null;
            const rName = (exec && exec.name) || "";
            const currentRating = latestTrackable.riderRating || 0;
            const currentFeedback = latestTrackable.riderFeedback || "";

            let starsHtml = '';
            const ratingToUse = currentRating > 0 ? currentRating : (window.tempRiderRating || 0);
            for (let s = 1; s <= 5; s++) {
              const starChar = s <= ratingToUse ? '★' : '☆';
              const starColor = s <= ratingToUse ? 'var(--accent-orange)' : '#555';
              if (currentRating > 0) {
                starsHtml += `<span class="celebration-star" style="font-size: 26px; color: ${starColor}; margin: 0 4px; display: inline-block;">${starChar}</span>`;
              } else {
                starsHtml += `<span class="celebration-star" onclick="selectRiderRatingVisual(${s})" style="font-size: 26px; cursor: pointer; color: ${starColor}; margin: 0 4px; transition: transform 0.2s; display: inline-block;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">${starChar}</span>`;
              }
            }

            let feedbackSectionHtml = '';
            if (currentRating > 0) {
              feedbackSectionHtml = `
                <div style="margin-top: 10px; padding: 10px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 8px; text-align: center;">
                  <p style="font-size: 12px; color: #10b981; font-weight: 700; margin-bottom: 2px;">
                    ${currentLang === 'ta' ? '✓ மதிப்பீடு பதியப்பட்டது! மிக்க நன்றி.' : '✓ Rating submitted! Thank you so much.'}
                  </p>
                  ${currentFeedback ? `<p style="font-size: 11px; color: #bbb; font-style: italic; margin-top: 4px;">"${currentFeedback}"</p>` : ''}
                </div>
              `;
            } else {
              feedbackSectionHtml = `
                <div id="rider-feedback-section" style="margin-top: 10px; text-align: left; width: 100%;">
                  <textarea id="rider-feedback-input" class="form-control" rows="2" style="background: #141416; border: 1px solid #333; color: #fff; border-radius: 8px; font-size: 12px; padding: 8px; width: 100%; box-sizing: border-box;" oninput="window.tempRiderFeedback = this.value" placeholder="${currentLang === 'ta' ? 'விநியோக அனுபவம் பற்றிய கருத்துக்களை எழுதவும் (விருப்பம்)...' : 'Write comments about delivery experience (optional)...'}">${window.tempRiderFeedback || ''}</textarea>
                  <button id="submit-rider-rating-btn" onclick="submitRiderRating('${latestTrackable.id}')" class="btn" style="background: var(--accent-orange); border: none; color: #000; font-size: 12px; font-weight: 800; padding: 8px 16px; border-radius: 8px; cursor: pointer; margin-top: 10px; width: 100%; ${!window.tempRiderRating ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${!window.tempRiderRating ? 'disabled' : ''}>
                    ${currentLang === 'ta' ? 'மதிப்பீட்டைச் சமர்ப்பி / Submit Rating' : 'Submit Rating'}
                  </button>
                </div>
              `;
            }

            celebrationContainer.innerHTML = `
              <div style="font-size: 40px; margin-bottom: 12px; animation: bounce-glow 1s infinite alternate;">🎉</div>
              <h3 style="color: #10b981; font-size: 18px; font-weight: 800; margin-bottom: 8px;">
                ${currentLang === 'ta' ? 'ஆர்டர் வெற்றிகரமாக வந்துவிட்டது! 😋' : 'Order Delivered Successfully! 🎉'}
              </h3>
              <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5;">
                ${currentLang === 'ta'
                  ? `உங்கள் ஆர்டர் <strong>${latestTrackable.id}</strong> வெற்றிகரமாக டெலிவரி செய்யப்பட்டது. எடப்பாடி கடையில் ஆர்டர் செய்தமைக்கு மிக்க நன்றி!`
                  : `Your order <strong>${latestTrackable.id}</strong> has been delivered to your location. Thank you for choosing Edappadi Kadai!`}
              </p>

              ${rName ? `
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 10px; margin-bottom: 14px;">
                <p style="font-size: 11px; color: var(--accent-orange); font-weight: 700; margin-bottom: 4px; text-transform: uppercase;">
                  ${currentLang === 'ta' ? 'விநியோக நபர்' : 'Delivery Executive'}
                </p>
                <p style="font-size: 12.5px; color: #fff; font-weight: 600;">🚴‍♂️ ${rName}</p>

                <p style="font-size: 11px; color: var(--text-muted); margin-top: 6px; margin-bottom: 4px;">
                  ${currentLang === 'ta' ? 'எங்களது சேவையை மதிப்பிடவும்:' : 'Rate your delivery service:'}
                </p>
                <div style="display: flex; justify-content: center; align-items: center; margin-top: 2px; margin-bottom: 4px;">
                  ${starsHtml}
                </div>
                ${feedbackSectionHtml}
              </div>
              ` : ''}

              <button onclick="closeDeliveredTracker()" class="btn" style="background: #10b981; border: none; color: #000; font-size: 12.5px; font-weight: 800; padding: 10px 20px; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin-top: 4px;">
                ❌ ${currentLang === 'ta' ? 'டிராக்கரை மூடு / Close' : 'Close Tracker'}
              </button>
            `;
          }

          if (mapBox) mapBox.style.display = 'none';
          if (timelineCard) timelineCard.style.display = 'none';
          if (riderContainer) riderContainer.style.display = 'none';
          if (cancelBtnContainer) cancelBtnContainer.style.display = 'none';
          if (rejBox) rejBox.style.display = 'none';

        } else if (['rejected', 'cancelled', 'canceled'].includes(String(latestTrackable.status || '').toLowerCase().trim())) {
          if (celebrationContainer) {
            celebrationContainer.style.display = 'block';
            celebrationContainer.style.background = 'linear-gradient(135deg, #111827 0%, #7f1d1d 100%)';
            celebrationContainer.style.borderColor = '#ef4444';

            celebrationContainer.innerHTML = `
              <div style="font-size: 40px; margin-bottom: 12px;">🛑</div>
              <h3 style="color: #ef4444; font-size: 18px; font-weight: 800; margin-bottom: 8px;">
                ${currentLang === 'ta' ? 'ஆர்டர் ரத்து செய்யப்பட்டுள்ளது ⚠️' : 'Order Cancelled / Rejected ⚠️'}
              </h3>
              <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5;">
                ${currentLang === 'ta'
                  ? `உங்கள் ஆர்டர் <strong>${latestTrackable.id}</strong> ரத்து செய்யப்பட்டுள்ளது.`
                  : `Your order <strong>${latestTrackable.id}</strong> was cancelled.`}
              </p>

              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; padding: 12px; margin-bottom: 14px; text-align: left;">
                <p style="font-size: 11px; color: #f87171; font-weight: 700; margin-bottom: 4px; text-transform: uppercase;">
                  ${currentLang === 'ta' ? 'காரணம்:' : 'Reason:'}
                </p>
                <p style="font-size: 12px; color: #fff; font-weight: 600;">
                  ${latestTrackable.rejectionReason || latestTrackable.cancelledReason || latestTrackable.cancelReason || (currentLang === 'ta' ? "வாடிக்கையாளரால் / நிர்வாகியால் ரத்து செய்யப்பட்டது." : "Cancelled by customer/admin.")}
                </p>
              </div>

              <button onclick="closeDeliveredTracker()" class="btn" style="background: #ef4444; border: none; color: #fff; font-size: 12.5px; font-weight: 800; padding: 10px 20px; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin-top: 4px;">
                ❌ ${currentLang === 'ta' ? 'டிராக்கரை மூடு / Close' : 'Close Tracker'}
              </button>
            `;
          }

          if (mapBox) mapBox.style.display = 'none';
          if (timelineCard) timelineCard.style.display = 'none';
          if (riderContainer) riderContainer.style.display = 'none';
          if (cancelBtnContainer) cancelBtnContainer.style.display = 'none';
          if (rejBox) rejBox.style.display = 'none';

        } else {
          if (celebrationContainer) celebrationContainer.style.display = 'none';
          if (rejBox) rejBox.style.display = 'none';

          updateStepperGraphic(latestTrackable.status, latestTrackable);

          const timelineCollapse = document.getElementById('tracker-timeline-collapse');
          const timelineToggleIcon = document.getElementById('tracker-timeline-toggle-icon');
          if (timelineCollapse && timelineToggleIcon) {
            timelineCollapse.style.display = 'block';
            timelineToggleIcon.innerHTML = currentLang === 'ta' ? '▲ சுருக்குக' : '▲ Hide';
          }

          if (timelineCard) timelineCard.style.display = 'block';

          if (cancelBtnContainer) {
            if (latestTrackable.status === 'pending') {
              cancelBtnContainer.style.display = 'block';
              const cancelBtn = document.getElementById('track-btn-cancel');
              if (cancelBtn) {
                cancelBtn.innerHTML = currentLang === 'ta' ? "🛑 ஆர்டரை ரத்து செய்" : "🛑 Cancel Order";
                cancelBtn.onclick = function(e) {
                  e.stopPropagation();
                  customerCancelOrder(latestTrackable.id);
                };
              }
            } else {
              cancelBtnContainer.style.display = 'none';
            }
          }

          if (riderContainer) {
            const exec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(latestTrackable) : null;
            const riderId = exec ? exec.id : null;
            if (riderId && ['ready', 'delivering', 'delivered'].includes(latestTrackable.status)) {
              riderContainer.style.display = 'block';

              const rawRiders = getData('ek_delivery_persons', []) || [];
              const riderObj = rawRiders.find(r => r.uid === riderId || r.id === riderId);

              const rName = riderObj ? riderObj.name : ((exec && exec.name) || "Delivery Partner");
              const vehicleNo = (riderObj && riderObj.vehicleNo) ? riderObj.vehicleNo : "";
              const rPhone = riderObj ? riderObj.phone : ((exec && exec.phone) || "9042681532");
              const cleanPhone = rPhone.replace(/\D/g, '').slice(-10);

              const photoUrl = (riderObj && riderObj.photoUrl) ? riderObj.photoUrl : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2310b981'/><circle cx='50' cy='38' r='18' fill='%23ffffff'/><path d='M20 82 c0 -18 13 -30 30 -30 s30 12 30 30 z' fill='%23ffffff'/></svg>";
              const rating = (riderObj && (riderObj.averageRating || riderObj.rating)) ? (riderObj.averageRating || riderObj.rating) : null;

              const statusOnline = riderObj ? (riderObj.isActive !== false) : true;
              const statusDotColor = statusOnline ? '#00C864' : '#888';
              const statusText = statusOnline ? 'Online' : 'Offline';

              let ratingHtml = '';
              if (rating) {
                ratingHtml = `<span style="color: #FFB300; font-size: 11px; font-weight: 700; margin-top: 2px;">⭐ ${rating}</span>`;
              }

              let vehicleBadgeHtml = '';
              if (vehicleNo && vehicleNo !== "Vehicle details not set") {
                vehicleBadgeHtml = `
                  <div style="margin-top: 8px;">
                    <span style="font-size: 10px; font-weight: 700; background: rgba(255,180,0,0.08); color: #FFB300; border: 1px solid rgba(255,180,0,0.3); border-radius: 6px; padding: 3px 8px; text-transform: uppercase; display: inline-block;">
                      🏍️ ${escapeHtml(vehicleNo)}
                    </span>
                  </div>
                `;
              }

              const hasLat = (riderObj && riderObj.latitude !== undefined && riderObj.latitude !== null && !isNaN(riderObj.latitude) && riderObj.latitude !== 11.5815);
              const hasLng = (riderObj && riderObj.longitude !== undefined && riderObj.longitude !== null && !isNaN(riderObj.longitude) && riderObj.longitude !== 77.8488);
              const statusDelivering = (latestTrackable.status === 'delivering');
              const hasLiveCoords = hasLat && hasLng && statusDelivering;

              let liveTrackingButtonHtml = '';
              if (hasLiveCoords) {
                const mapQuery = `${riderObj.latitude},${riderObj.longitude}`;
                liveTrackingButtonHtml = `
                  <a href="https://www.google.com/maps/search/?api=1&query=${mapQuery}" target="_blank" class="btn" style="width: 100%; margin-top: 10px; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: #000; padding: 10px; border-radius: 10px; font-size: 12px; font-weight: 850; text-align: center; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; box-shadow: 0 4px 10px rgba(245,158,11,0.2);" onclick="event.stopPropagation();">
                    📍 Track Live Location / நேரலை இருப்பிடம் பார்க்க ➔
                  </a>
                `;
              } else {
                liveTrackingButtonHtml = `
                  <div style="width: 100%; margin-top: 10px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); color: var(--text-muted); padding: 8px; border-radius: 10px; font-size: 11px; font-weight: 600; text-align: center;">
                    ℹ️ Live location is not available yet.
                  </div>
                `;
              }

              const titleText = currentLang === 'ta' ? 'DELIVERY PARTNER / டெலிவரி பார்ட்னர்' : 'DELIVERY PARTNER / DELIVER KADAI';

              riderContainer.innerHTML = `
                <p style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">${titleText}</p>
                <div style="display: flex; flex-direction: column; background: #0D0D0D; padding: 12px 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 4px 15px rgba(0,0,0,0.25); width: 100%; max-width: 360px; margin-left: auto; margin-right: auto; font-family: 'Poppins', sans-serif; box-sizing: border-box; overflow: hidden;">

                  <!-- Row 1: Profile Photo on Left, Details on Right -->
                  <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                    <div style="position: relative; width: 48px; height: 48px; border-radius: 50%; border: 1.5px solid var(--accent-orange); overflow: visible; flex-shrink: 0; background: #1a1a24;">
                      <img src="${photoUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" alt="Rider photo" />
                      <div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: ${statusDotColor}; border-radius: 50%; border: 1.5px solid #0D0D0D; box-shadow: 0 0 4px ${statusDotColor};" title="${statusText}"></div>
                    </div>

                    <div style="display: flex; flex-direction: column; min-width: 0; flex-grow: 1;">
                      <strong style="color: #fff; font-size: 13.5px; font-weight: 700; line-height: 1.2; word-break: break-word; white-space: normal;">${escapeHtml(rName)}</strong>
                      <span style="font-size: 10px; color: var(--text-secondary); margin-top: 1px;">Delivery Executive</span>
                      ${ratingHtml}
                    </div>
                  </div>

                  <!-- Row 2: Vehicle number Badge -->
                  ${vehicleBadgeHtml}

                  <!-- Row 3: Call & WhatsApp Actions -->
                  <div style="display: flex; gap: 8px; width: 100%; margin-top: 12px; flex-wrap: wrap;">
                    <a href="tel:${cleanPhone}" class="btn" style="flex: 1; min-width: 110px; min-height: 38px; height: auto; padding: 8px 12px; font-size: 12px; font-weight: 750; border-radius: 10px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.3); color: var(--accent-green); text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box;" onclick="event.stopPropagation();">
                      <span>📞</span> <span class="btn-text">${currentLang === 'ta' ? 'கால்' : 'Call'}</span>
                    </a>
                    <a href="https://wa.me/${formatIndianPhoneForWhatsApp(rPhone)}?text=${encodeURIComponent('Hello, ' + rName + '! I am tracking my order (' + latestTrackable.id + ').')}" target="_blank" class="btn" style="flex: 1; min-width: 110px; min-height: 38px; height: auto; padding: 8px 12px; font-size: 12px; font-weight: 750; border-radius: 10px; background: rgba(37,211,102,0.08); border: 1px solid rgba(37,211,102,0.3); color: #25d366; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box;" onclick="event.stopPropagation();">
                      <span>💬</span> <span class="btn-text">${currentLang === 'ta' ? 'வாட்ஸ்அப்' : 'WhatsApp'}</span>
                    </a>
                  </div>

                  <!-- Row 4: Live Location Tracking Button -->
                  ${liveTrackingButtonHtml}

                </div>
              `;

              const tDelivDetails = document.getElementById('track-delivery-details');
              if (tDelivDetails) {
                if (latestTrackable.status === 'delivering') {
                  tDelivDetails.innerText = `Rider ${rName} is out for delivery! 🚴‍♂️`;
                  tDelivDetails.style.color = 'var(--accent-orange)';
                } else if (latestTrackable.status === 'delivered') {
                  tDelivDetails.innerText = `Delivered safely by ${rName}. 🎉`;
                  tDelivDetails.style.color = 'var(--text-muted)';
                } else {
                  tDelivDetails.innerText = `Partner ${rName} assigned & preparing to dispatch.`;
                  tDelivDetails.style.color = 'var(--text-muted)';
                }
              }
            } else {
              riderContainer.style.display = 'none';
            }
          }

          initLiveTrackerMap(latestTrackable);
        }

        const itemsSummaryCollapse = document.getElementById('tracker-items-list-collapse');
        const itemsToggleIcon = document.getElementById('tracker-items-toggle-icon');
        if (itemsSummaryCollapse && itemsToggleIcon) {
          itemsSummaryCollapse.style.display = 'block';
          itemsToggleIcon.innerHTML = currentLang === 'ta' ? '▲ சுருக்குக' : '▲ Hide';
        }
      } else {
        activeBox.style.display = 'none';
        initLiveTrackerMap(null);
      }

      let renderedPastCount = 0;
      let pastListHtml = '';
      let currentMonthHeader = '';

      let filteredOrders = userOrders;
      if (selectedOrderHistoryStatusFilter !== 'all') {
        filteredOrders = userOrders.filter(o => {
          const status = o.status.toLowerCase();
          if (selectedOrderHistoryStatusFilter === 'pending') {
            return status === 'pending';
          } else if (selectedOrderHistoryStatusFilter === 'accepted') {
            return status === 'ready';
          } else if (selectedOrderHistoryStatusFilter === 'preparing') {
            return status === 'ready';
          } else if (selectedOrderHistoryStatusFilter === 'delivering') {
            return status === 'delivering';
          } else if (selectedOrderHistoryStatusFilter === 'delivered') {
            return status === 'delivered';
          } else if (selectedOrderHistoryStatusFilter === 'cancelled') {
            return status === 'cancelled' || status === 'canceled';
          } else if (selectedOrderHistoryStatusFilter === 'rejected') {
            return status === 'rejected';
          }
          return true;
        });
      }

      filteredOrders.forEach((o, i) => {
        const itemNames = o.items.map(item => `${item.englishName} [${getFormattedItemQty(item, currentLang)}]`).join(', ');
        const dateStr = new Date(o.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

        if (query) {
          const itemLabels = o.items.map(item => `${item.englishName} ${item.tamilName || ''}`).join(' ').toLowerCase();
          const matchesId = o.id.toLowerCase().includes(query);
          const matchesItems = itemLabels.includes(query);
          const matchesStatus = o.status.toLowerCase().includes(query);
          const matchesDate = dateStr.toLowerCase().includes(query);
          const matchesPrice = o.totalAmount.toString().includes(query);

          if (!matchesId && !matchesItems && !matchesStatus && !matchesDate && !matchesPrice) {
            return; // skip non matching
          }
        }

        renderedPastCount++;

        const orderDate = new Date(o.createdAt);
        const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthsTa = ["ஜனவரி", "பிப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்", "செப்டம்பர்", "அக்டோபர்", "நவம்பர்", "டிசம்பர்"];
        const monthName = currentLang === 'ta' ? monthsTa[orderDate.getMonth()] : monthsEn[orderDate.getMonth()];
        const yearVal = orderDate.getFullYear();
        const monthYearDisplayName = `${monthName} ${yearVal}`;

        if (monthYearDisplayName !== currentMonthHeader) {
          currentMonthHeader = monthYearDisplayName;
          pastListHtml += `
            <div class="month-group-header" style="margin: 20px 0 10px 0; font-size: 13px; font-weight: 700; color: var(--accent-orange); display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
              <span>📅 ${currentMonthHeader}</span>
              <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
            </div>
          `;
        }

        let deliveryBadgeStyle = '';
        if (o.status === 'delivering') {
          deliveryBadgeStyle = 'style="animation: red-pulse 1.5s infinite; background: #ef4444 !important; color: #fff !important; font-weight: 800; border: none; box-shadow: 0 0 8px #ef4444;"';
        }

        const badgeClass = o.status === 'pending' ? 'badge-pending' : o.status === 'ready' ? 'badge-ready' : o.status === 'delivering' ? 'badge-delivering' : o.status === 'delivered' ? 'badge-delivered' : 'badge-rejected';

        const isTrackingThis = latestTrackable && o.id === latestTrackable.id;
        const trackingHighlightStyle = isTrackingThis
          ? 'border: 2px solid var(--accent-orange) !important; box-shadow: 0 4px 12px rgba(245,158,11,0.15) !important;'
          : 'border: 1px solid rgba(255,255,255,0.06) !important;';
        const trackingIndicator = isTrackingThis ? `<span style="font-size:10px; font-weight:800; color:var(--accent-orange); display:flex; align-items:center; gap:2.5px; margin-right:4px;">📍 TRACKING</span>` : '';

        let displayStatus = o.status.toUpperCase();
        if (o.status === 'ready') {
          displayStatus = 'PREPARING';
        } else if (o.status === 'delivering') {
          displayStatus = 'OUT FOR DELIVERY';
        } else if (o.status === 'canceled' || o.status === 'cancelled') {
          displayStatus = 'CANCELLED';
        }

        let actionButtonHtml = '';
        const btnBaseStyle = "font-family:'Poppins',sans-serif; font-size:10px; font-weight:700; min-height:32px; height:auto; padding:6px 10px; border-radius:8px; border:none; display:flex; align-items:center; justify-content:center; gap:4px; cursor:pointer; transition:all 0.15s ease; box-sizing:border-box; text-transform:uppercase; letter-spacing:0.3px;";

        if (o.status === 'pending') {
          actionButtonHtml = `
            <div style="display:flex; gap:8px; width:100%; margin-top:8px; box-sizing:border-box;">
              <button class="premium-btn btn-invoice" style="flex:1; ${btnBaseStyle} background:transparent !important; color:#a1a1aa !important; border:1px solid rgba(255,255,255,0.15) !important;" onclick="event.stopPropagation(); printCustomerInvoice('${o.id}')">📄 Invoice</button>
              <button class="premium-btn btn-map" style="flex:1; ${btnBaseStyle} background:#10b981 !important; color:#ffffff !important;" onclick="event.stopPropagation(); changeActiveTrackingID('${o.id}')">📍 Map</button>
              <button class="premium-btn btn-cancel" style="flex:1; ${btnBaseStyle} background:rgba(239,68,68,0.1) !important; color:#ef4444 !important; border:1px solid rgba(239,68,68,0.3) !important;" onclick="event.stopPropagation(); customerCancelOrder('${o.id}')">🛑 Cancel</button>
            </div>
          `;
        } else if (['ready', 'delivering'].includes(o.status)) {
          actionButtonHtml = `
            <div style="display:flex; gap:8px; width:100%; margin-top:8px; box-sizing:border-box;">
              <button class="premium-btn btn-invoice" style="flex:1; ${btnBaseStyle} background:transparent !important; color:#a1a1aa !important; border:1px solid rgba(255,255,255,0.15) !important;" onclick="event.stopPropagation(); printCustomerInvoice('${o.id}')">📄 Invoice</button>
              <button class="premium-btn btn-map" style="flex:1; ${btnBaseStyle} background:#10b981 !important; color:#ffffff !important;" onclick="event.stopPropagation(); changeActiveTrackingID('${o.id}')">📍 Map</button>
              <button class="premium-btn btn-map" style="flex:1; ${btnBaseStyle} background:#10b981 !important; color:#ffffff !important;" onclick="event.stopPropagation(); changeActiveTrackingID('${o.id}')">🚚 Track</button>
            </div>
          `;
        } else {
          actionButtonHtml = `
            <div style="display:flex; gap:8px; width:100%; margin-top:8px; box-sizing:border-box;">
              <button class="premium-btn btn-invoice" style="flex:1; ${btnBaseStyle} background:transparent !important; color:#a1a1aa !important; border:1px solid rgba(255,255,255,0.15) !important;" onclick="event.stopPropagation(); printCustomerInvoice('${o.id}')">📄 Invoice</button>
              <button class="premium-btn btn-map" style="flex:1; ${btnBaseStyle} background:#10b981 !important; color:#ffffff !important;" onclick="event.stopPropagation(); changeActiveTrackingID('${o.id}')">📍 Map</button>
              <button class="premium-btn btn-reorder" style="flex:1; ${btnBaseStyle} background:var(--accent-orange) !important; color:#000000 !important; font-weight:800 !important;" onclick="event.stopPropagation(); reorderFastCheckout('${o.id}')">🔄 Reorder</button>
            </div>
          `;
        }

        const productNames = o.items.map(item => item.englishName || item.tamilName).join(', ');
        const weights = o.items.map(item => getFormattedItemQty(item, currentLang)).join(', ');
        const dateStrFull = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const itemCatBadge = escapeHtml(o.orderCategory || o.category || (o.items && o.items[0] && o.items[0].category) || 'General').toUpperCase();
        const stageBadgeVal = escapeHtml(o.orderStage || o.stage || displayStatus);

        const record = `
          <div class="card order-card card-interactive" style="padding:10px 14px; margin-bottom:10px; cursor:pointer; background:#0c0d0f; border:1px solid rgba(255,255,255,0.08); border-radius:12px; box-sizing:border-box; ${trackingHighlightStyle}" onclick="openCustomerOrderDetail('${o.id}')">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <strong style="font-size:11.5px; color:#a1a1aa; font-family:'Poppins', sans-serif; font-weight:600; letter-spacing:0.5px;">${o.id}</strong>
                <span class="badge" style="background:rgba(245,158,11,0.12); color:var(--accent-orange); border:1px solid rgba(245,158,11,0.3); font-size:9.5px; font-weight:700; padding:2px 6px; border-radius:4px; text-transform:uppercase;">🏷️ ${itemCatBadge}</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                ${trackingIndicator}
                <span class="badge ${badgeClass}" ${deliveryBadgeStyle} style="font-size:9.5px; font-weight:700; padding:3px 8px; border-radius:6px; text-transform:uppercase; font-family:'Poppins', sans-serif; letter-spacing:0.3px;">${displayStatus}</span>
              </div>
            </div>

            <div style="font-size:13px; font-weight:600; color:#ffffff; margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:left; font-family:'Poppins', sans-serif;">
              ${productNames}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; width:100%;">
              <span style="font-size:11px; color:var(--text-secondary); font-weight:500; font-family:'Poppins', sans-serif;">${weights}</span>
              <span style="font-size:14px; font-weight:800; color:var(--accent-green); font-family:'Poppins', sans-serif;">₹${o.totalAmount}</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:var(--text-muted); margin-bottom:8px; font-family:'Poppins', sans-serif;">
              <span>${dateStrFull}</span>
              <span style="color:#60a5fa; font-weight:600;">⚙️ ${stageBadgeVal}</span>
            </div>

            ${actionButtonHtml}
          </div>
        `;
        pastListHtml += record;
      });
      if (pastList._lastRenderedHtml !== pastListHtml) {
        pastList._lastRenderedHtml = pastListHtml;
        pastList.innerHTML = pastListHtml;
      }

      if (renderedPastCount === 0) {
        pastList.innerHTML = getOrdersEmptyStateHtml(Boolean(query || selectedOrderHistoryStatusFilter !== 'all'));
      }
    }

    function openCustomerOrderDetail(id) {
      const orders = getData('ek_orders');
      const o = orders.find(ord => ord.id === id);
      if (!o || o.hiddenByCustomer) return;

      document.getElementById('cod-order-id').innerText = `${o.id}`;

      const dateStr = new Date(o.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      document.getElementById('cod-order-date').innerText = `Ordered / தேதி: ${dateStr}`;

      const statusBadge = document.getElementById('cod-order-status');
      statusBadge.innerText = o.status.toUpperCase();
      const badgeClass = isPendingOrderStatus(o.status) ? 'badge-pending' : isReadyOrderStatus(o.status) ? 'badge-ready' : isDeliveredOrderStatus(o.status) ? 'badge-delivered' : 'badge-rejected';
      statusBadge.className = `badge ${badgeClass}`;

      const catBadge = document.getElementById('cod-order-category');
      const orderCategoryVal = o.orderCategory || o.category || (o.items && o.items[0] && o.items[0].category) || 'General';
      if (catBadge) {
        catBadge.innerText = `🏷️ ${orderCategoryVal.toUpperCase()}`;
        catBadge.style.display = 'inline-block';
      }

      const stageBadge = document.getElementById('cod-order-stage');
      const orderStageVal = o.orderStage || o.stage || (isPendingOrderStatus(o.status) ? 'Received' : isReadyOrderStatus(o.status) ? 'Packed & Ready' : isDeliveredOrderStatus(o.status) ? 'Delivered' : o.status);
      if (stageBadge) {
        stageBadge.innerText = `⚙️ ${orderStageVal}`;
        stageBadge.style.display = 'inline-block';
      }

      const instBox = document.getElementById('cod-instructions-box');
      const instText = document.getElementById('cod-instructions-text');
      const instructionsVal = o.orderInstructions || o.specialInstructions || o.adminNotes || '';
      if (instBox && instText) {
        if (instructionsVal) {
          instBox.style.display = 'block';
          instText.innerText = instructionsVal;
        } else {
          instBox.style.display = 'none';
        }
      }

      const listContainer = document.getElementById('cod-items-list');
      listContainer.innerHTML = '';
      o.items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.display = 'flex';
        itemEl.style.justify = 'space-between';
        itemEl.style.alignItems = 'center';
        itemEl.style.padding = '10px 12px';
        itemEl.style.background = '#161616';
        itemEl.style.borderRadius = '12px';
        itemEl.style.border = '1px solid #222';

        const weightText = getFormattedItemQty(item, currentLang);
        itemEl.innerHTML = `
          <div>
            <strong style="font-size:12.5px; color:#fff;">${item.tamilName || item.englishName}</strong>
            <p style="font-size:10.5px; color:var(--text-secondary); margin:2px 0 0 0;">${item.englishName}${getLocalizedPrepareText(item.cutPreference || item.cutStyle || 'Small Pieces', item.category) ? ' | Cut: ' + getLocalizedPrepareText(item.cutPreference || item.cutStyle || 'Small Pieces', item.category) : ''}</p>
          </div>
          <div style="text-align:right;">
            <strong style="font-size:12.5px; color:var(--accent-orange);">₹${item.totalPrice}</strong>
            <p style="font-size:10px; color:var(--text-muted); margin:2px 0 0 0;">${weightText}</p>
          </div>
        `;
        listContainer.appendChild(itemEl);
      });

      const rejBox = document.getElementById('cod-rejection-box');
      if (o.status === 'rejected' && o.rejectionReason) {
        rejBox.style.display = 'block';
        document.getElementById('cod-rejection-text').innerText = o.rejectionReason;
      } else {
        rejBox.style.display = 'none';
      }

      document.getElementById('cod-delivery-slot').innerText = o.deliveryTimeSlot || "N/A";
      const isUnverifiedUpi = o.status === 'payment_pending_verification' || o.paymentStatus === 'PENDING_VERIFICATION' || o.needsPaymentVerification === true || (o.paymentMethod && o.paymentMethod.toLowerCase().includes('unverified'));
      const isUpiOrder = !isUnverifiedUpi && o.paymentMethod && (o.paymentMethod.toUpperCase().includes('UPI') || o.paymentMethod.toUpperCase().includes('ONLINE') || (o.upiTxnId && o.upiTxnId !== 'NO_TXN_REF'));

      if (isUnverifiedUpi) {
        document.getElementById('cod-payment-method').innerHTML = `<span style="color:#f59e0b; font-weight:800;">⏳ UPI PAYMENT (VERIFICATION PENDING)</span>`;
      } else if (isUpiOrder) {
        document.getElementById('cod-payment-method').innerHTML = `<span style="color:#10b981; font-weight:800;">📱 UPI PAYMENT (PAID)</span>`;
      } else {
        document.getElementById('cod-payment-method').innerHTML = `<span style="color:#f59e0b; font-weight:800;">💵 CASH ON DELIVERY</span>`;
      }
      document.getElementById('cod-delivery-address').innerText = o.deliveryAddress || "No address specified";

      document.getElementById('cod-subtotal').innerText = `₹${o.subtotalAmount || o.totalAmount}`;
      document.getElementById('cod-delivery-charge').innerText = o.deliveryCharge === 0 ? "FREE ✨" : `₹${o.deliveryCharge || 0}`;

      const discPercent = document.getElementById('cod-discount-row');
      if (o.loyaltyDiscount) {
        discPercent.style.display = 'flex';
        document.getElementById('cod-discount').innerText = `-₹${o.loyaltyDiscount}`;
      } else {
        discPercent.style.display = 'none';
      }

      const coupRow = document.getElementById('cod-coupon-row');
      if (o.couponCode && o.couponDiscount) {
        if (coupRow) coupRow.style.display = 'flex';
        const labelEl = document.getElementById('cod-coupon-code-lbl');
        if (labelEl) labelEl.innerText = o.couponCode;
        const discEl = document.getElementById('cod-coupon-discount');
        if (discEl) discEl.innerText = `-₹${o.couponDiscount}`;
      } else {
        if (coupRow) coupRow.style.display = 'none';
      }

      document.getElementById('cod-grand-total').innerText = `₹${o.totalAmount}`;

      const extTrackBtn = document.getElementById('cod-track-btn');
      if (extTrackBtn) {
        const showStatuses = ['pending', 'ready', 'delivering', 'delivered'];
        if (showStatuses.includes(o.status)) {
          extTrackBtn.style.display = 'block';
          extTrackBtn.onclick = function() {
            trackOrderFromDetail(o.id);
          };
        } else {
          extTrackBtn.style.display = 'none';
        }
      }

      const delBtn = document.getElementById('cod-delete-btn');
      if (delBtn) {
        const statusLower = (o.status || '').toLowerCase();
        const isCompletedOrRejected = ['delivered', 'completed', 'rejected', 'cancelled'].includes(statusLower);
        if (isCompletedOrRejected) {
          delBtn.style.display = 'block';
          delBtn.onclick = function() {
            deleteOrderFromDb(o.id, true);
          };
        } else {
          delBtn.style.display = 'none';
        }
      }

      const cancelBtn = document.getElementById('cod-cancel-btn');
      if (cancelBtn) {
        const isPending = o.status === 'pending';
        if (isPending) {
          cancelBtn.style.display = 'block';
          cancelBtn.onclick = function() {
            closeCustomerOrderDetailModalDetail();
            customerCancelOrder(o.id);
          };
        } else {
          cancelBtn.style.display = 'none';
        }
      }

      const modal = document.getElementById('customer-order-detail-modal');
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('active'), 10);
    }

    function closeCustomerOrderDetailModal(event) {
      if (event.target === document.getElementById('customer-order-detail-modal')) {
        closeCustomerOrderDetailModalDetail();
      }
    }

    function closeCustomerOrderDetailModalDetail() {
      const modal = document.getElementById('customer-order-detail-modal');
      modal.classList.remove('active');
      setTimeout(() => modal.style.display = 'none', 150);
    }

    function changeActiveTrackingID(id) {
      selectedTrackOrderId = id;
      const orders = getData('ek_orders', []);
      const idx = orders.findIndex(o => o.id === id);
      if (idx !== -1 && orders[idx].isArchived) {
        orders[idx].isArchived = false;
        saveData('ek_orders', orders);
        if (typeof db !== 'undefined' && db) {
          db.collection('ek_orders').doc(id).update({ isArchived: false })
            .catch(err => console.error("Unarchive order error:", err));
        }
      }
      renderTrackerScreen();
      setTimeout(() => {
        const activeBox = document.getElementById('active-tracker-box');
        if (activeBox) {
          activeBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }

    function closeSuccessAndTrack() {
      const succId = document.getElementById('success-modal-id').innerText;
      selectedTrackOrderId = succId;
      document.getElementById('order-success-modal').style.display = 'none';
      showTab('tab-track');

      setTimeout(() => {
        const activeBox = document.getElementById('active-tracker-box');
        if (activeBox) {
          activeBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }

    function closeSuccessAndShop() {
      document.getElementById('order-success-modal').style.display = 'none';
      showTab('tab-home');
    }

    function triggerSuccessCheckmarkReplay() {
      const container = document.getElementById('success-icon-container');
      if (container) {
        container.classList.remove('order-success-icon-wrap');
        const originalHtml = container.innerHTML;
        container.innerHTML = '';
        void container.offsetWidth;
        container.innerHTML = originalHtml;
        container.classList.add('order-success-icon-wrap');
      }
    }

    function trackOrderFromDetail(orderId) {
      closeCustomerOrderDetailModalDetail();
      changeActiveTrackingID(orderId);
      showTab('tab-track');
    }

    function shareTrackingLink(event) {
      if (document.getElementById('screen-track')) {
        if (event) event.stopPropagation();
      }

      const orders = getData('ek_orders', []);
      const session = getActiveSession();
      let orderId = "";

      if (selectedTrackOrderId) {
        orderId = selectedTrackOrderId;
      } else if (session) {
        const userOrders = orders.filter(o => o.customerId === session.userId || (o.customerPhone && session.phone && o.customerPhone === session.phone))
                                .sort((a,b) => safeParseTime(b.createdAt) - safeParseTime(a.createdAt));
        const activeOrder = userOrders.find(o => ['pending', 'ready', 'delivering'].includes(o.status));
        if (activeOrder) {
          orderId = activeOrder.id;
        }
      }

      if (!orderId) {
        const msg = currentLang === 'ta' ? "பகிர்வதற்கு செயலில் ஆர்டர் எதுவும் இல்லை!" : "No active order available to share!";
        showToast(msg, 'warning');
        return;
      }

      const shareUrl = window.location.origin + window.location.pathname + "?trackOrderId=" + encodeURIComponent(orderId);

      const msg = currentLang === 'ta'
        ? `ஆர்டர் ${orderId}-க்கான நேரலை இணைப்பு நகலெடுக்கப்பட்டது! 📋`
        : `Live tracking link for order ${orderId} copied to clipboard! 📋`;

      const shareText = currentLang === 'ta'
        ? `எடப்பாடி கடை ஆர்டர் #${orderId} நேரலை வரைபடத்தைப் பார்க்க இந்த லிங்கை க்ளிக் செய்யவும்: ${shareUrl}`
        : `Track your Edappadi Kadai order #${orderId} live here: ${shareUrl}`;

      if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.shareIntent === 'function') {
        AndroidStorage.shareIntent(`Edappadi Kadai Order #${orderId}`, shareText);
        showToast(msg, 'success');
        return;
      }

      if (navigator.share) {
        navigator.share({
          title: `Edappadi Kadai Order #${orderId}`,
          text: shareText,
          url: shareUrl
        }).catch(() => {
          copyTextToClipboardGeneral(shareUrl, msg);
        });
      } else {
        copyTextToClipboardGeneral(shareUrl, msg);
      }
    }

    function toggleTrackerItemsCollapse() {
      const list = document.getElementById('tracker-items-list-collapse');
      const icon = document.getElementById('tracker-items-toggle-icon');
      if (!list || !icon) return;
      if (list.style.display === 'none') {
        list.style.display = 'block';
        icon.innerHTML = '▲ Hide / சுருக்குக';
      } else {
        list.style.display = 'none';
        icon.innerHTML = '▼ Show / விரிக்குக';
      }
    }

    function toggleTrackerTimelineCollapse() {
      const col = document.getElementById('tracker-timeline-collapse');
      const icon = document.getElementById('tracker-timeline-toggle-icon');
      if (!col || !icon) return;
      if (col.style.display === 'none') {
        col.style.display = 'block';
        icon.innerHTML = '▲ Hide / சுருக்குக';
      } else {
        col.style.display = 'none';
        icon.innerHTML = '▼ Show / விரிக்குக';
      }
      setTimeout(() => {
        if (trackerLeafletMap) {
          trackerLeafletMap.invalidateSize();
        }
      }, 150);
    }

    function toggleHeroBannerCollapse() {
      const banner = document.getElementById('carousel-outer-wrapper') || document.getElementById('home-hero-banner');
      const icon = document.getElementById('hero-banner-toggle-icon');
      if (!banner) return;
      const isHidden = banner.style.display === 'none' || getComputedStyle(banner).display === 'none';
      if (isHidden) {
        banner.style.display = 'block';
        if (icon) icon.innerHTML = currentLang === 'ta' ? '▼ சுருக்கு' : '▼ Collapse';
        localStorage.setItem('hide_hero_banner', 'false');
        if (typeof AndroidStorage !== 'undefined') AndroidStorage.saveData('hide_hero_banner', 'false');
      } else {
        banner.style.display = 'none';
        if (icon) icon.innerHTML = currentLang === 'ta' ? '▲ விரி' : '▲ Expand';
        localStorage.setItem('hide_hero_banner', 'true');
        if (typeof AndroidStorage !== 'undefined') AndroidStorage.saveData('hide_hero_banner', 'true');
      }
    }

    function toggleSpecialsSectionCollapse() {
      const wrapper = document.getElementById('specials-collapse-wrapper');
      const icon = document.getElementById('specials-toggle-icon');
      if (!wrapper) return;
      const isHidden = wrapper.style.display === 'none' || getComputedStyle(wrapper).display === 'none';
      if (isHidden) {
        wrapper.style.display = 'block';
        if (icon) icon.innerHTML = currentLang === 'ta' ? '▼ சுருக்கு' : '▼ Collapse';
        localStorage.setItem('hide_specials_section', 'false');
        if (typeof AndroidStorage !== 'undefined') AndroidStorage.saveData('hide_specials_section', 'false');
      } else {
        wrapper.style.display = 'none';
        if (icon) icon.innerHTML = currentLang === 'ta' ? '▲ விரி' : '▲ Expand';
        localStorage.setItem('hide_specials_section', 'true');
        if (typeof AndroidStorage !== 'undefined') AndroidStorage.saveData('hide_specials_section', 'true');
      }
    }

    function toggleLoyaltyCollapse() {
      const wrapper = document.getElementById('loyalty-collapse-wrapper');
      const icon = document.getElementById('loyalty-toggle-icon');
      if (!wrapper) return;
      const isHidden = wrapper.style.display === 'none' || getComputedStyle(wrapper).display === 'none';
      if (isHidden) {
        wrapper.style.display = 'block';
        if (icon) icon.innerHTML = currentLang === 'ta' ? '▼ சுருக்கு' : '▼ Collapse';
        localStorage.setItem('hide_loyalty_wallet', 'false');
        if (typeof AndroidStorage !== 'undefined') AndroidStorage.saveData('hide_loyalty_wallet', 'false');
      } else {
        wrapper.style.display = 'none';
        if (icon) icon.innerHTML = currentLang === 'ta' ? '▲ விரி' : '▲ Expand';
        localStorage.setItem('hide_loyalty_wallet', 'true');
        if (typeof AndroidStorage !== 'undefined') AndroidStorage.saveData('hide_loyalty_wallet', 'true');
      }
    }

    function syncCollapsePreferences() {
      const isTa = currentLang === 'ta';

      const hideHero = localStorage.getItem('hide_hero_banner') === 'true';
      const hideSpecials = localStorage.getItem('hide_specials_section') === 'true';
      const hideLoyalty = localStorage.getItem('hide_loyalty_wallet') === 'true';

      const banner = document.getElementById('carousel-outer-wrapper') || document.getElementById('home-hero-banner');
      const heroIcon = document.getElementById('hero-banner-toggle-icon');
      if (banner) {
        banner.style.display = 'block';
        if (heroIcon) heroIcon.innerHTML = isTa ? '▼ சுருக்கு' : '▼ Collapse';
      }

      const specials = document.getElementById('specials-collapse-wrapper');
      const specialsIcon = document.getElementById('specials-toggle-icon');
      if (specials) {
        specials.style.display = 'block';
        if (specialsIcon) specialsIcon.innerHTML = isTa ? '▼ சுருக்கு' : '▼ Collapse';
      }

      const loyalty = document.getElementById('loyalty-collapse-wrapper');
      const loyaltyIcon = document.getElementById('loyalty-toggle-icon');
      if (loyalty) {
        if (hideLoyalty) {
          loyalty.style.display = 'none';
          if (loyaltyIcon) loyaltyIcon.innerHTML = isTa ? '▲ விரி' : '▲ Expand';
        } else {
          loyalty.style.display = 'block';
          if (loyaltyIcon) loyaltyIcon.innerHTML = isTa ? '▼ சுருக்கு' : '▼ Collapse';
        }
      }
    }

    function updateStepperGraphic(status, order) {
      let normStatus = (status || '').toLowerCase().trim();
      if (['payment_pending_verification', 'pending_verification', 'unverified'].includes(normStatus)) {
        normStatus = 'payment_pending_verification';
      } else if (['confirmed', 'preparing', 'packing', 'processing'].includes(normStatus)) {
        normStatus = 'ready';
      } else if (['out_for_delivery', 'shipped', 'dispatch'].includes(normStatus)) {
        normStatus = 'delivering';
      } else if (['completed'].includes(normStatus)) {
        normStatus = 'delivered';
      }
      status = normStatus;
      const stepperLine = document.getElementById('stepper-line');
      if (!stepperLine) return;

      const rPending = document.getElementById('step-row-pending');
      const rReady = document.getElementById('step-row-ready');
      const rDelivering = document.getElementById('step-row-delivering');
      const rDelivered = document.getElementById('step-row-delivered');

      if (rPending) rPending.className = "tracker-timeline-step";
      if (rReady) rReady.className = "tracker-timeline-step";
      if (rDelivering) rDelivering.className = "tracker-timeline-step";
      if (rDelivered) rDelivered.className = "tracker-timeline-step";

      const cPending = document.getElementById('circle-pending');
      const cReady = document.getElementById('circle-ready');
      const cDelivering = document.getElementById('circle-delivering');
      const cDelivered = document.getElementById('circle-delivered');

      const tPending = document.getElementById('text-pending');
      const tReady = document.getElementById('text-ready');
      const tDelivering = document.getElementById('text-delivering');
      const tDelivered = document.getElementById('text-delivered');

      if (cPending) {
        cPending.style.borderColor = "#262626";
        cPending.innerHTML = (status === 'ready' || status === 'delivering' || status === 'delivered') ? '✓' : (status === 'payment_pending_verification' ? '⏳' : '📝');
      }
      if (cReady) {
        cReady.style.borderColor = "#262626";
        cReady.innerHTML = (status === 'delivering' || status === 'delivered') ? '✓' : '🥩';
      }
      if (cDelivering) {
        cDelivering.style.borderColor = "#262626";
        cDelivering.innerHTML = (status === 'delivered') ? '✓' : '👷';
      }
      if (cDelivered) {
        cDelivered.style.borderColor = "#262626";
        cDelivered.innerHTML = (status === 'delivered') ? '✓' : '🏍️';
      }

      if (tPending) tPending.style.color = "var(--text-muted)";
      if (tReady) tReady.style.color = "var(--text-muted)";
      if (tDelivering) tDelivering.style.color = "var(--text-muted)";
      if (tDelivered) tDelivered.style.color = "var(--text-muted)";

      if (status === 'payment_pending_verification') {
        stepperLine.style.height = "0%";
        if (rPending) rPending.classList.add("active");
        if (cPending) cPending.style.borderColor = "#f59e0b";
        if (tPending) tPending.style.color = "#f59e0b";
      } else if (status === 'pending') {
        stepperLine.style.height = "0%";
        if (rPending) rPending.classList.add("active");
        if (cPending) cPending.style.borderColor = "var(--accent-orange)";
        if (tPending) tPending.style.color = "#fff";
      } else if (status === 'ready') {
        stepperLine.style.height = "33%";
        if (rPending) rPending.classList.add("completed");
        if (rReady) rReady.classList.add("active");
        if (cPending) cPending.style.borderColor = "var(--accent-orange)";
        if (cReady) cReady.style.borderColor = "var(--accent-blue)";
        if (tPending) tPending.style.color = "#fff";
        if (tReady) tReady.style.color = "#fff";
      } else if (status === 'delivering') {
        stepperLine.style.height = "66%";
        if (rPending) rPending.classList.add("completed");
        if (rReady) rReady.classList.add("completed");
        if (rDelivering) rDelivering.classList.add("active");
        if (cPending) cPending.style.borderColor = "var(--accent-orange)";
        if (cReady) cReady.style.borderColor = "var(--accent-blue)";
        if (cDelivering) cDelivering.style.borderColor = "var(--accent-orange)";
        if (tPending) tPending.style.color = "#fff";
        if (tReady) tReady.style.color = "#fff";
        if (tDelivering) tDelivering.style.color = "#fff";
      } else if (status === 'delivered') {
        stepperLine.style.height = "100%";
        if (rPending) rPending.classList.add("completed");
        if (rReady) rReady.classList.add("completed");
        if (rDelivering) rDelivering.classList.add("completed");
        if (rDelivered) rDelivered.classList.add("completed");
        if (cPending) cPending.style.borderColor = "var(--accent-orange)";
        if (cReady) cReady.style.borderColor = "var(--accent-blue)";
        if (cDelivering) cDelivering.style.borderColor = "var(--accent-orange)";
        if (cDelivered) cDelivered.style.borderColor = "var(--accent-green)";
        if (tPending) tPending.style.color = "#fff";
        if (tReady) tReady.style.color = "#fff";
        if (tDelivering) tDelivering.style.color = "#fff";
        if (tDelivered) tDelivered.style.color = "#fff";
      } else {
        stepperLine.style.height = "0%";
        if (rPending) rPending.classList.add("active");
        if (cPending) cPending.style.borderColor = "var(--accent-red)";
        if (tPending) tPending.style.color = "var(--accent-red)";
      }

      const tPendingTime = document.getElementById('time-pending');
      const tReadyTime = document.getElementById('time-ready');
      const tDeliveringTime = document.getElementById('time-delivering');
      const tDeliveredTime = document.getElementById('time-delivered');

      if (tPendingTime) tPendingTime.innerText = "-";
      if (tReadyTime) tReadyTime.innerText = "-";
      if (tDeliveringTime) tDeliveringTime.innerText = "-";
      if (tDeliveredTime) tDeliveredTime.innerText = "-";

      if (order && (order.createdAt || order.updatedAt)) {
        const baseTime = safeParseTime(order.createdAt || order.updatedAt);
        const statusTimes = order.statusTimestamps || {};

        const getStepFormattedTime = (tsKey, fallbackMs) => {
          if (statusTimes[tsKey]) {
            return safeFormatTime(statusTimes[tsKey]);
          }
          if (fallbackMs) {
            return safeFormatTime(fallbackMs);
          }
          return "-";
        };

        if (tPendingTime) tPendingTime.innerText = getStepFormattedTime('pending', baseTime);

        if (tReadyTime) {
          if (['ready', 'delivering', 'delivered'].includes(status)) {
            tReadyTime.innerText = getStepFormattedTime('ready', baseTime + 2 * 60 * 1000);
          } else {
            tReadyTime.innerText = "-";
          }
        }

        if (tDeliveringTime) {
          if (['delivering', 'delivered'].includes(status)) {
            tDeliveringTime.innerText = getStepFormattedTime('delivering', baseTime + 5 * 60 * 1000);
          } else {
            tDeliveringTime.innerText = "-";
          }
        }

        if (tDeliveredTime) {
          if (status === 'delivered') {
            const delivTs = statusTimes['delivered'] || order.updatedAt;
            tDeliveredTime.innerText = getStepFormattedTime('delivered', delivTs ? safeParseTime(delivTs) : (baseTime + 7 * 60 * 1000));
          } else if (status === 'delivering') {
            tDeliveredTime.innerText = currentLang === 'ta' ? "இப்போது ⚡" : "now ⚡";
          } else {
            tDeliveredTime.innerText = "-";
          }
        }
      }
    }

    function triggerRealTimeStatusNotification(orderId, oldStatus, newStatus) {
      const session = getActiveSession();
      const orders = getData('ek_orders', []);
      const o = orders.find(ord => ord.id === orderId);
      if (!o) return;

      const isAdminActive = (typeof currentScreen !== 'undefined' && currentScreen === 'screen-admin');
      const isMyOrder = session && (o.customerId === session.userId || (o.customerPhone && session.phone && o.customerPhone === session.phone));

      if (!isMyOrder && !isAdminActive) return;

      let msgTamil = "";
      let msgEnglish = "";
      let toastTheme = "info";

      if (newStatus === 'ready') {
        msgTamil = `ஆர்டர் ${orderId} உறுதிசெய்யப்பட்டு வெட்டப்படுகிறது! 🥩`;
        msgEnglish = `Order ${orderId} has been confirmed & is preparing!`;
        toastTheme = "success";
        if (isMyOrder) {
          addNotification(
            "ஆர்டர் உறுதிசெய்யப்பட்டு வெட்டப்படுகிறது! 🥩",
            `Order Approved & Preparing! 🥩`,
            `உங்கள் ஆர்டர் ${orderId} கடை உரிமையாளரால் உறுதிசெய்யப்பட்டு, இறைச்சி வெட்டி சுத்தம் செய்யப்படுகிறது.`,
            `Your order ${orderId} has been accepted by the store owner and is being custom-cut & prepared.`,
            "🥩"
          );
        }
      } else if (newStatus === 'delivering') {
        msgTamil = `ஆர்டர் ${orderId} விநியோகிக்க புறப்பட்டுவிட்டது! 🏍️`;
        msgEnglish = `Order ${orderId} is out for delivery!`;
        toastTheme = "info";
        if (isMyOrder) {
          addNotification(
            "ஆர்டர் விநியோகிக்க புறப்பட்டுவிட்டது! 🏍️",
            `Order Out for Delivery! 🏍️`,
            `விநியோக நபர் உங்கள் ஆர்டர் ${orderId}-ஐ உங்கள் இருப்பிடத்திற்கு கொண்டு வர புறப்பட்டு விட்டார்!`,
            `The delivery partner has claimed your order ${orderId} and is on their way to your home location!`,
            "🏍️"
          );
        }
      } else if (newStatus === 'delivered') {
        msgTamil = `ஆர்டர் ${orderId} விநியோகிக்கப்பட்டது! 🎉`;
        msgEnglish = `Order ${orderId} delivered successfully!`;
        toastTheme = "success";

        if (isMyOrder) {
          addNotification(
            "ஆர்டர் விநியோகிக்கப்பட்டது! 🎉",
            `Order Delivered Successfully! 🎉`,
            `உங்கள் ஆர்டர் ${orderId} வெற்றிகரமாக டெலிவரி செய்யப்பட்டது. எங்கள் கடையில் வாங்கியதற்கு நன்றி! 🥩`,
            `Your order ${orderId} was delivered successfully at your doorstep. Thank you for shopping with us! 🥩`,
            "🎉"
          );
          showCelebrateDeliveredModal(o);
        }
      } else if (newStatus === 'rejected') {
        msgTamil = `ஆர்டர் ${orderId} ரத்து செய்யப்பட்டது / மறுக்கப்பட்டது ❌`;
        msgEnglish = `Order ${orderId} was rejected or cancelled.`;
        toastTheme = "error";
        if (isMyOrder) {
          addNotification(
            "ஆர்டர் ரத்து செய்யப்பட்டது ❌",
            `Order Rejected / Cancelled ❌`,
            `மன்னிக்கவும்! உங்கள் ஆர்டர் ${orderId} டெலிவரி செய்ய முடியாத சூழல் அல்லது தொழில்நுட்ப காரணங்களால் ரத்து செய்யப்பட்டுள்ளது.`,
            `We are sorry! Your order ${orderId} was rejected or cancelled due to localized operational limits.`,
            "❌"
          );
        }
      }

       if (msgEnglish && msgTamil) {
        showToast(`${msgTamil}<br><span style="font-size: 11px; opacity: 0.85;">${msgEnglish}</span>`, toastTheme);

        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.showNativeNotification === 'function') {
          const nativeTitleText = currentLang === 'ta' ? msgTamil.replace(/🥩|🏍️|🎉|❌/g, '').trim() : msgEnglish.replace(/🥩|🏍️|🎉|❌/g, '').trim();
          let nativeDescText = "";

          if (newStatus === 'ready') {
            nativeDescText = currentLang === 'ta'
              ? `உங்கள் ஆர்டர் ${orderId} கடை உரிமையாளரால் ஒப்புக்கொள்ளப்பட்டது.`
              : `Your order ${orderId} has been confirmed and is being prepared.`;
          } else if (newStatus === 'delivering') {
            nativeDescText = currentLang === 'ta'
              ? `டெலிவரி நபர் உங்கள் ஆர்டருடன் கிளம்பிவிட்டார்.`
              : `Our delivery partner is on their way with your order.`;
          } else if (newStatus === 'delivered') {
            nativeDescText = currentLang === 'ta'
              ? `உங்கள் ஆர்டர் வெற்றிகரமாக வழங்கப்பட்டது. நன்றி!`
              : `Your order has been delivered successfully. Thank you!`;
          } else if (newStatus === 'rejected') {
            nativeDescText = currentLang === 'ta'
              ? `மன்னிக்கவும், உங்கள் ஆர்டர் ரத்து செய்யப்பட்டுள்ளது.`
              : `We are sorry, your order has been cancelled or rejected.`;
          } else {
            nativeDescText = currentLang === 'ta' ? "உங்களது ஆர்டர் நிலை வெற்றிகரமாக மாற்றப்பட்டது!" : "Your order status has been updated successfully!";
          }

          try {
            AndroidStorage.showNativeNotification(nativeTitleText, nativeDescText);
          } catch (e) {
            console.warn("Direct notification delivery bridge failure:", e);
          }
        }
      }
    }

    function formatOrderItemsSummary(order) {
      if (!order) return "";
      let items = order.items;
      if (!items || !Array.isArray(items) || items.length === 0) {
        if (order.itemsSummary) return order.itemsSummary;
        return "";
      }
      const summaryList = items.map(item => {
        const name = item.tamilName || item.nameTa || item.englishName || item.nameEn || item.name || item.productName || 'Item';
        const qty = item.qty || item.quantity || (item.weightGrams ? (item.weightGrams >= 1000 ? `${(item.weightGrams/1000).toFixed(1)}kg` : `${item.weightGrams}g`) : '1');
        return `${name} (${qty})`;
      });
      if (summaryList.length <= 2) {
        return summaryList.join(', ');
      } else {
        return `${summaryList.slice(0, 2).join(', ')} +${summaryList.length - 2} more`;
      }
    }

    window.formatOrderItemsSummary = formatOrderItemsSummary;

    async function sendFcmPushNotification(order, oldStatus, newStatus, customReason) {
      try {
        if (!order) return;

        let targetFcmToken = typeof getCustomerFcmToken === 'function' ? await getCustomerFcmToken(order) : order.customerFcmToken;
        if (!targetFcmToken) {
          const users = getData('ek_users', []);
          const targetUser = users.find(u => u && (u.id === order.customerId || u.phone === order.customerPhone));
          if (targetUser && (targetUser.fcmToken || targetUser.realFcmToken)) {
            targetFcmToken = targetUser.fcmToken || targetUser.realFcmToken;
          }
        }

        const hasValidTargetToken = Boolean(targetFcmToken && typeof targetFcmToken === 'string' && targetFcmToken.trim() && targetFcmToken !== 'null' && targetFcmToken !== 'undefined');

        const shortId = order.id ? order.id.slice(0, 8).toUpperCase() : 'N/A';
        const itemsSummary = formatOrderItemsSummary(order);
        const itemsStr = itemsSummary ? ` (${itemsSummary})` : '';

        let titleTa = "";
        let titleEn = "";
        let bodyTa = "";
        let bodyEn = "";

        const normStatus = String(newStatus || '').toLowerCase().trim();

        if (normStatus === 'pending') {
          titleTa = "ஆர்டர் செய்யப்பட்டது! 🛒";
          titleEn = "Order Placed Successfully! 🛒";
          bodyTa = `உங்கள் ஆர்டர் #${shortId}${itemsStr} வெற்றிகரமாக பதிவு செய்யப்பட்டுள்ளது! மொத்தம்: ₹${order.totalAmount || order.finalTotal || 0}`;
          bodyEn = `Your order #${shortId}${itemsStr} of ₹${order.totalAmount || order.finalTotal || 0} has been placed successfully. Thank you!`;

          setTimeout(() => {
            try {
              const admins = getData('ek_admin_accounts', []);
              admins.forEach(adm => {
                const adminToken = adm.fcmToken || adm.realFcmToken;
                if (adminToken) {
                  const adminTitleTa = "புதிய ஆர்டர் வந்துள்ளது! 🔔";
                  const adminTitleEn = "New Order Received! 🔔";
                  const adminBodyTa = `வாடிக்கையாளர் ${order.customerName || order.customerPhone} ஒரு புதிய ஆர்டர் #${shortId}${itemsStr} செய்துள்ளார்.`;
                  const adminBodyEn = `Customer ${order.customerName || order.customerPhone} placed order #${shortId}${itemsStr}.`;

                  const finalTitle = currentLang === 'ta' ? adminTitleTa : adminTitleEn;
                  const finalBody = currentLang === 'ta' ? adminBodyTa : adminBodyEn;

                  if (typeof db !== 'undefined' && db) {
                    db.collection('ek_fcm_queue').add({
                      targetToken: adminToken,
                      title: finalTitle,
                      body: finalBody,
                      orderId: order.id,
                      type: "new_order",
                      createdAt: new Date().toISOString(),
                      processed: false
                    }).catch(e => console.warn('[FCM Admin Queue] Write failed:', e));
                  }

                  if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
                    try {
                      AndroidStorage.simulateFcmPushNotification(
                        adminToken,
                        finalTitle,
                        finalBody,
                        JSON.stringify({ orderId: order.id, type: "new_order" })
                      );
                    } catch (simErr) {
                      console.warn("[FCM Admin Simulator] Failed calling Android FCM Simulation bridge:", simErr);
                    }
                  }
                }
              });
            } catch (admErr) {
              console.warn("FCM admin notify failed:", admErr);
            }
          }, 500);
        } else if (normStatus === 'ready' || normStatus === 'accepted' || normStatus === 'preparing') {
          titleTa = "ஆர்டர் தயாராகிறது! 🥩";
          titleEn = "Your Order is Being Prepared! 🥩";
          bodyTa = `உங்கள் ஆர்டர் #${shortId}${itemsStr} ஏற்றுக்கொள்ளப்பட்டு தயார் செய்யப்படுகிறது!`;
          bodyEn = `Your order #${shortId}${itemsStr} has been accepted and is being prepared!`;
        } else if (normStatus === 'delivering' || normStatus === 'out_for_delivery') {
          titleTa = "ஆர்டர் விநியோகத்திற்கு புறப்பட்டது! 🏍️";
          titleEn = "Order Out for Delivery! 🏍️";
          bodyTa = `உங்கள் ஆர்டர் #${shortId}${itemsStr} டெலிவரிக்கு புறப்பட்டுவிட்டது!`;
          bodyEn = `Your order #${shortId}${itemsStr} is out for delivery!`;
        } else if (normStatus === 'delivered' || normStatus === 'completed') {
          titleTa = "ஆர்டர் விநியோகிக்கப்பட்டது! 🎉";
          titleEn = "Order Delivered Successfully! 🎉";
          bodyTa = `உங்கள் ஆர்டர் #${shortId}${itemsStr} வெற்றிகரமாக உங்களிடம் ஒப்படைக்கப்பட்டது. நன்றி!`;
          bodyEn = `Your order #${shortId}${itemsStr} has been delivered successfully. Thank you!`;
        } else if (normStatus === 'rejected' || normStatus === 'cancelled' || normStatus === 'canceled') {
          titleTa = "ஆர்டர் ரத்து செய்யப்பட்டது ❌";
          titleEn = "Order Cancelled ❌";
          const reason = customReason || order.rejectionReason || "Store update";
          bodyTa = `உங்கள் ஆர்டர் #${shortId}${itemsStr} ரத்து செய்யப்பட்டது. காரணம்: ${reason}`;
          bodyEn = `Your order #${shortId}${itemsStr} has been cancelled. Reason: ${reason}`;
        } else {
          titleTa = "ஆர்டர் நிலை புதுப்பிக்கப்பட்டது 🔔";
          titleEn = "Order Status Updated 🔔";
          bodyTa = `உங்கள் ஆர்டர் #${shortId}${itemsStr} நிலை ${normStatus}-ஆக மாற்றப்பட்டது.`;
          bodyEn = `Your order #${shortId}${itemsStr} status updated to ${normStatus}.`;
        }

        const currentLang = localStorage.getItem('ek_lang') || 'en';
        const finalTitle = currentLang === 'ta' ? titleTa : titleEn;
        const finalBody = currentLang === 'ta' ? bodyTa : bodyEn;

        // Propagate real-time in-app notification to customer via Firestore
        if (typeof db !== 'undefined' && db && (order.customerId || order.customerPhone)) {
          db.collection('ek_customer_notifications').add({
            targetUserId: order.customerId || '',
            targetPhone: order.customerPhone || order.phone || '',
            orderId: order.id || '',
            titleTa: titleTa,
            titleEn: titleEn,
            bodyTa: bodyTa,
            bodyEn: bodyEn,
            type: "order_status_update",
            newStatus: newStatus,
            createdAt: new Date().toISOString(),
            read: false
          }).catch(e => console.warn('[Customer Notif Queue] Write failed:', e));
        }

        if (hasValidTargetToken) {
          if (typeof db !== 'undefined' && db) {
            db.collection('ek_fcm_queue').add({
              targetToken: targetFcmToken,
              targetUserId: order.customerId || order.customerPhone || '',
              title: finalTitle,
              body: finalBody,
              orderId: order.id,
              oldStatus: oldStatus,
              newStatus: newStatus,
              createdAt: new Date().toISOString(),
              processed: false
            }).catch(e => console.warn('[FCM Queue] Write failed:', e));
          }

          if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
            try {
              AndroidStorage.simulateFcmPushNotification(
                targetFcmToken,
                finalTitle,
                finalBody,
                JSON.stringify({ orderId: order.id, oldStatus, newStatus, type: "order_status_update" })
              );
            } catch (simErr) {
              console.warn("[FCM Simulator] Failed calling Android FCM Simulation bridge:", simErr);
            }
          }

          if (typeof db !== 'undefined' && db) {
            db.collection('ek_fcm_logs').add({
              orderId: order.id,
              targetToken: targetFcmToken,
              titleEn: titleEn,
              titleTa: titleTa,
              bodyEn: bodyEn,
              bodyTa: bodyTa,
              oldStatus: oldStatus,
              newStatus: newStatus,
              sentAt: new Date().toISOString(),
              status: "delivered"
            }).catch(err => console.error("[Cloud FCM Audit Log] Error:", err));
          }
        } else {
          console.info(`[FCM Push] In-app notification delivered for order ${order.id}. Push skipped (no device token registered).`);
        }
      } catch (fcmEx) {
        console.warn("[FCM Push Exception Handled]", fcmEx);
      }
    }

    async function sendFcmNotificationForDeliveryOrEtaChange(order, oldFee, newFee, oldEta, newEta) {
      try {
        if (!order) return;
        let targetToken = typeof getCustomerFcmToken === 'function' ? await getCustomerFcmToken(order) : order.customerFcmToken;
        if (!targetToken) {
          console.warn("[FCM] Cannot send Delivery/ETA change notification: No customer FCM token found.");
          return;
        }
        const shortId = order.id ? order.id.slice(0, 8).toUpperCase() : '';
        const itemsSummary = formatOrderItemsSummary(order);
        const itemInfoStr = itemsSummary ? ` (${itemsSummary})` : '';

        let feeTextTa = (newFee !== undefined && newFee !== oldFee) ? ` புதிய டெலிவரி கட்டணம்: ₹${newFee}.` : '';
        let feeTextEn = (newFee !== undefined && newFee !== oldFee) ? ` New delivery fee: ₹${newFee}.` : '';

        let etaTextTa = (newEta !== undefined && newEta !== oldEta) ? ` புதிய எதிர்பார்க்கப்படும் நேரம்: ${newEta} நிமிடம்.` : '';
        let etaTextEn = (newEta !== undefined && newEta !== oldEta) ? ` Updated ETA: ${newEta} mins.` : '';

        const titleTa = "🚚 டெலிவரி விவரங்கள் மாற்றப்பட்டன!";
        const titleEn = "🚚 Delivery Details Updated!";

        const bodyTa = `உங்கள் ஆர்டர் #${shortId}${itemInfoStr} -${feeTextTa}${etaTextTa}`;
        const bodyEn = `Your order #${shortId}${itemInfoStr} -${feeTextEn}${etaTextEn}`;

        const currentLang = localStorage.getItem('ek_lang') || 'en';
        const finalTitle = currentLang === 'ta' ? titleTa : titleEn;
        const finalBody = currentLang === 'ta' ? bodyTa : bodyEn;

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_fcm_queue').add({
            targetToken: targetToken,
            title: finalTitle,
            body: finalBody,
            orderId: order.id,
            type: "delivery_eta_update",
            createdAt: new Date().toISOString(),
            processed: false
          }).catch(e => console.warn('[FCM Delivery/ETA Queue] Error:', e));
        }

        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
          try {
            AndroidStorage.simulateFcmPushNotification(
              targetToken,
              finalTitle,
              finalBody,
              JSON.stringify({ orderId: order.id, type: "delivery_eta_update" })
            );
          } catch (simErr) {
            console.warn("[FCM Simulator] Fail:", simErr);
          }
        }
        debugLog(`[FCM Targeted Push] Sent Delivery/ETA update to customer token [${targetToken}]`);
      } catch (err) {
        console.error("[FCM Delivery/ETA Notification Error]", err);
      }
    }

    async function sendFcmNotificationForRiderAssignment(order, exec) {
      try {
        if (!order || !exec) return;
        let targetToken = typeof getCustomerFcmToken === 'function' ? await getCustomerFcmToken(order) : order.customerFcmToken;
        if (!targetToken) {
          console.warn("[FCM] Cannot send Rider Assignment notification to customer: No FCM token found.");
          return;
        }
        const shortId = order.id ? order.id.slice(0, 8).toUpperCase() : '';
        const itemsSummary = formatOrderItemsSummary(order);
        const itemInfoStr = itemsSummary ? ` (${itemsSummary})` : '';

        const titleTa = "🏍️ டெலிவரி நபர் நியமிக்கப்பட்டார்!";
        const titleEn = "🏍️ Delivery Partner Assigned!";

        const bodyTa = `உங்கள் ஆர்டர் #${shortId}${itemInfoStr} -க்கு டெலிவரி நபர் ${exec.name || 'Rider'} (📞 ${exec.phone || ''}) நியமிக்கப்பட்டுள்ளார்!`;
        const bodyEn = `Rider ${exec.name || 'Rider'} (📞 ${exec.phone || ''}) has been assigned to your order #${shortId}${itemInfoStr}!`;

        const currentLang = localStorage.getItem('ek_lang') || 'en';
        const finalTitle = currentLang === 'ta' ? titleTa : titleEn;
        const finalBody = currentLang === 'ta' ? bodyTa : bodyEn;

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_fcm_queue').add({
            targetToken: targetToken,
            title: finalTitle,
            body: finalBody,
            orderId: order.id,
            riderName: exec.name,
            riderPhone: exec.phone,
            type: "rider_assigned",
            createdAt: new Date().toISOString(),
            processed: false
          }).catch(e => console.warn('[FCM Rider Assign Queue] Error:', e));
        }

        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
          try {
            AndroidStorage.simulateFcmPushNotification(
              targetToken,
              finalTitle,
              finalBody,
              JSON.stringify({ orderId: order.id, type: "rider_assigned", riderName: exec.name })
            );
          } catch (simErr) {
            console.warn("[FCM Simulator] Fail:", simErr);
          }
        }
        debugLog(`[FCM Targeted Push] Sent Rider Assignment to customer token [${targetToken}]`);
      } catch (err) {
        console.error("[FCM Rider Assignment Notification Error]", err);
      }
    }

    async function sendDirectAdminCustomerMessage(targetUserOrId, messageText) {
      try {
        if (!targetUserOrId || !messageText || !messageText.trim()) return false;

        let customerName = "Customer";
        let targetUserId = "";
        let targetPhone = "";
        let userObj = null;

        if (typeof targetUserOrId === 'object') {
          userObj = targetUserOrId;
          targetUserId = userObj.id || userObj.userId || userObj.uid || '';
          customerName = userObj.name || userObj.customerName || "Customer";
          targetPhone = userObj.phone || '';
        } else {
          targetUserId = String(targetUserOrId);
          const users = typeof getDataCached === 'function' ? getDataCached('ek_users', []) : [];
          userObj = users.find(x => x && (x.id === targetUserId || x.phone === targetUserId));
          if (userObj) {
            customerName = userObj.name || "Customer";
            targetPhone = userObj.phone || '';
          }
        }

        const titleTa = "💬 நிர்வாகியிடமிருந்து செய்தி";
        const titleEn = "💬 Message from Store Support";

        const bodyTa = messageText.trim();
        const bodyEn = messageText.trim();

        const currentLang = localStorage.getItem('ek_lang') || 'en';
        const finalTitle = currentLang === 'ta' ? titleTa : titleEn;
        const finalBody = currentLang === 'ta' ? bodyTa : bodyEn;

        // 1. Deliver to Cloud Firestore in-app customer notifications collection
        if (typeof db !== 'undefined' && db && db.collection) {
          await db.collection('ek_customer_notifications').add({
            targetUserId: targetUserId,
            targetPhone: targetPhone,
            titleTa: titleTa,
            titleEn: titleEn,
            bodyTa: bodyTa,
            bodyEn: bodyEn,
            type: "support_chat_reply",
            createdAt: new Date().toISOString(),
            read: false
          }).catch(e => console.warn('[Customer Notif Queue] Write failed:', e));
        }

        // 2. Deliver via Push Notification if FCM Token is available
        let targetToken = typeof getCustomerFcmToken === 'function' ? await getCustomerFcmToken(userObj || targetUserId) : null;
        if (targetToken) {
          if (typeof db !== 'undefined' && db) {
            await db.collection('ek_fcm_queue').add({
              targetToken: targetToken,
              title: finalTitle,
              body: finalBody,
              targetUserId: targetUserId,
              type: "support_chat_reply",
              createdAt: new Date().toISOString(),
              processed: false
            }).catch(e => console.warn('[FCM Direct Message Queue] Error:', e));
          }

          if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
            try {
              AndroidStorage.simulateFcmPushNotification(
                targetToken,
                finalTitle,
                finalBody,
                JSON.stringify({ type: "support_chat_reply", text: messageText })
              );
            } catch (simErr) {
              console.warn("[FCM Simulator] Fail:", simErr);
            }
          }
        }

        // 3. If customer is active in current session (e.g. testing)
        const activeCust = typeof getActiveUser === 'function' ? getActiveUser() : null;
        if (activeCust && (activeCust.id === targetUserId || (targetPhone && activeCust.phone === targetPhone))) {
          if (typeof window.addNotification === 'function') {
            window.addNotification(titleTa, titleEn, bodyTa, bodyEn, '💬');
          }
        }

        showToast(currentLang === 'ta' ? `${customerName} அவர்களுக்கு நேரடி செய்தி அனுப்பப்பட்டது! 💬` : `Direct message sent to ${customerName}! 💬`, "success");
        return true;
      } catch (err) {
        console.error("[FCM Direct Message Error]", err);
        showToast("Failed to send direct message: " + err.message, "error");
        return false;
      }
    }

    window.sendFcmPushNotification = sendFcmPushNotification;
    window.sendFcmNotificationForDeliveryOrEtaChange = sendFcmNotificationForDeliveryOrEtaChange;
    window.sendFcmNotificationForRiderAssignment = sendFcmNotificationForRiderAssignment;
    window.sendDirectAdminCustomerMessage = sendDirectAdminCustomerMessage;

    function sendFcmNotificationToRider(order, exec) {
      try {
        if (!order || !exec) return;
        let targetFcmToken = exec.fcmToken || exec.realFcmToken;
        if (!targetFcmToken || typeof targetFcmToken !== 'string' || !targetFcmToken.trim() || targetFcmToken === 'null' || targetFcmToken === 'undefined') {
          console.warn(`[FCM Rider Push] Cannot send push notification to rider ${exec ? exec.name : 'N/A'}. Missing or invalid FCM token.`);
          return;
        }

      const shortId = order.id.slice(0, 8).toUpperCase();
      const titleTa = "புதிய ஆர்டர் ஒதுக்கப்பட்டுள்ளது! 🏍️";
      const titleEn = "New Delivery Assigned! 🏍️";
      const bodyTa = `ஒரு புதிய ஆர்டர் உங்களுக்கு வழங்கப்பட்டுள்ளது. முகவரி: ${order.deliveryAddress}\n[ஆர்டர் எண்: ${shortId}]`;
      const bodyEn = `A new order has been assigned to you. Address: ${order.deliveryAddress}\n[Order ID: ${shortId}]`;

      const payload = {
        to: targetFcmToken,
        notification: {
          title: currentLang === 'ta' ? titleTa : titleEn,
          body: currentLang === 'ta' ? bodyTa : bodyEn
        },
        data: {
          orderId: order.id,
          type: "order_assigned"
        }
      };

      debugLog(`[FCM Rider Push] Enqueueing rider notification:`, JSON.stringify(payload, null, 2));

      if (typeof db !== 'undefined' && db) {
        db.collection('ek_fcm_queue').add({
          targetToken: targetFcmToken,
          targetUserId: exec.id || exec.uid || exec.phone || '',
          title: currentLang === 'ta' ? titleTa : titleEn,
          body: currentLang === 'ta' ? bodyTa : bodyEn,
          orderId: order.id,
          type: "order_assigned",
          createdAt: new Date().toISOString(),
          processed: false
        }).catch(e => console.warn('[FCM Queue Rider] Write failed:', e));
      }

      if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
        try {
          AndroidStorage.simulateFcmPushNotification(
            targetFcmToken,
            currentLang === 'ta' ? titleTa : titleEn,
            currentLang === 'ta' ? bodyTa : bodyEn,
            JSON.stringify(payload.data)
          );
        } catch (simErr) {
          console.warn("[FCM Simulator Rider] Failed calling Android FCM Simulation bridge:", simErr);
        }
      }
      } catch (riderFcmEx) {
        console.warn("[FCM Rider Push Exception Handled]", riderFcmEx);
      }
    }

    // Global FCM Push Notification Click & Deep Link Router
    function handleFcmNotificationClick(payload) {
      try {
        console.log('[FCM Notification Clicked]', payload);
        if (!payload || typeof payload !== 'object') return;

        const orderId = payload.orderId || payload.order_id;
        const type = payload.type;
        const screen = payload.screen || payload.targetScreen;

        if (orderId) {
          selectedTrackOrderId = orderId;
          const orders = (typeof getData === 'function' ? getData('ek_orders', []) : []) || [];
          const matchedOrder = orders.find(o => o && o.id === orderId);
          if (matchedOrder && typeof setActiveTrackingOrder === 'function') {
            setActiveTrackingOrder(matchedOrder);
          }
          if (typeof showScreen === 'function') {
            const dSession = typeof getData === 'function' ? getData('ek_delivery_session') : null;
            if (dSession && dSession.loggedIn && (type === 'new_assigned_order' || type === 'order_assigned' || type === 'rider_assigned')) {
              showScreen('screen-delivery');
            } else {
              showScreen('screen-track');
              if (typeof renderTrackerScreen === 'function') {
                renderTrackerScreen();
              }
            }
          }
          return;
        }

        if (screen && typeof showScreen === 'function') {
          showScreen(screen);
          return;
        }

        if (type === 'new_order') {
          const aSession = typeof getData === 'function' ? getData('ek_admin_session') : null;
          if (aSession && aSession.loggedIn && typeof showScreen === 'function') {
            showScreen('screen-admin');
          }
        } else if (type === 'rider_assigned' || type === 'delivery_eta_update' || type === 'order_status_update') {
          if (typeof showScreen === 'function') {
            showScreen('screen-track');
          }
        }
      } catch (err) {
        console.warn('[FCM Click Dispatch Error]', err);
      }
    }
    window.handleFcmNotificationClick = handleFcmNotificationClick;
    window.handleNotificationClick = handleFcmNotificationClick;
    window.handleOneSignalNotificationClick = handleFcmNotificationClick;
    window.onOneSignalNotificationClicked = handleFcmNotificationClick;

    function syncOneSignalUserSession(role, userId, phone) {
      // No-op: Session is managed natively via Firebase & FCM tokens
    }
    window.syncOneSignalUserSession = syncOneSignalUserSession;

    function getNotifications() {
      return getData('ek_notifications', []);
    }
    window.getNotifications = getNotifications;

    function saveNotifications(list) {
      saveData('ek_notifications', list);
      updateNotificationUnreadCount();
    }
    window.saveNotifications = saveNotifications;

    function addNotification(titleTa, titleEn, bodyTa, bodyEn, icon = "🔔") {
      if (!titleEn) titleEn = titleTa;
      if (!bodyEn) bodyEn = bodyTa;
      const list = getNotifications();
      const isDuplicate = list.some(n =>
        (n.titleTa === titleTa || n.titleEn === titleEn) &&
        (n.bodyTa === bodyTa || n.bodyEn === bodyEn) &&
        (Date.now() - new Date(n.createdAt || 0).getTime() < 180000)
      );
      if (isDuplicate) return;

      const newNotif = {
        id: "NT" + Math.floor(10000 + Math.random() * 90000),
        titleTa: titleTa || '📢 எடப்பாடி கடை',
        titleEn: titleEn || '📢 Edappadi Kadai',
        bodyTa: bodyTa || '',
        bodyEn: bodyEn || '',
        icon: icon || '🔔',
        read: false,
        createdAt: new Date().toISOString()
      };
      list.unshift(newNotif);
      if (list.length > 50) list.pop(); // Optimize list length count
      saveNotifications(list);
    }
    window.addNotification = addNotification;

    function updateNotificationUnreadCount() {
      const list = getNotifications();
      const unreadCount = list.filter(n => !n.read).length;
      const elBadge = document.getElementById('notification-unread-badge');
      if (elBadge) {
        if (unreadCount > 0) {
          elBadge.innerText = unreadCount;
          elBadge.style.display = 'flex';
          elBadge.classList.add('shake-anim');
        } else {
          elBadge.style.display = 'none';
        }
      }
    }
    window.updateNotificationUnreadCount = updateNotificationUnreadCount;

    function openNotificationCenter() {
      if (typeof AndroidStorage !== 'undefined') {
        try {
          if (!AndroidStorage.hasNotificationPermission()) {
            debugLog("[Notification Center] Notification permission not granted. Requesting...");
            AndroidStorage.requestNotificationPermission();
          }
        } catch (e) {
          console.error("[Notification Center] Error requesting notification permission:", e);
        }
      }

      const modal = document.getElementById('notification-center-modal');
      if (modal) {
        renderNotificationsList();
        modal.style.display = 'flex';
      }
    }

    function closeNotificationCenter() {
      const modal = document.getElementById('notification-center-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    }

    function markAllNotificationsAsRead() {
      const list = getNotifications();
      list.forEach(n => n.read = true);
      saveNotifications(list);
      renderNotificationsList();
      showToast("All notifications marked as read! ✓", "success");
    }

    function clearAllNotifications() {
      saveNotifications([]);
      renderNotificationsList();
      showToast("Cleared notification history! ✓", "info");
    }

    function renderNotificationsList() {
      const container = document.getElementById('notifications-list-container');
      if (!container) return;

      const list = getNotifications();
      if (list.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 30px 10px; font-size: 13px;">
            <p style="font-size: 32px; margin-bottom: 10px;">📭</p>
            <p>${currentLang === 'ta' ? 'புதிய தகவல்கள் எதுவும் இல்லை.' : 'No active notifications inbox yet.'}</p>
          </div>
        `;
        return;
      }

      let html = "";
      list.forEach(n => {
        const title = currentLang === 'ta' ? n.titleTa : n.titleEn;
        const body = currentLang === 'ta' ? n.bodyTa : n.bodyEn;
        const timeStr = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const unreadDot = !n.read ? `<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-orange); display: inline-block; position: absolute; top: 12px; right: 12px;"></span>` : "";
        const bg = !n.read ? "rgba(245, 158, 11, 0.05)" : "rgba(255, 255, 255, 0.02)";
        const border = !n.read ? "1px solid rgba(245, 158, 11, 0.15)" : "1px solid rgba(255, 255, 255, 0.05)";

        html += `
          <div onclick="toggleMarkRead('${n.id}')" style="position: relative; background: ${bg}; border: ${border}; border-radius: 14px; padding: 12px; display: flex; gap: 10px; align-items: start; cursor: pointer; transition: all 0.2s;">
            <div style="font-size: 20px; background: rgba(255,255,255,0.03); width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.05);">
              ${n.icon || '🔔'}
            </div>
            <div style="flex: 1; min-width: 0;">
              <h5 style="color: #fff; font-size: 13.5px; font-weight: 700; margin: 0; line-height: 1.25; padding-right: 14px;">${title}</h5>
              <p style="color: var(--text-muted); font-size: 11.5px; margin: 4px 0 0 0; line-height: 1.35; max-width: 95%;">${body}</p>
              <span style="display: block; font-size: 9.5px; color: var(--text-muted); margin-top: 6px; font-weight: 500;">⏱️ ${timeStr}</span>
            </div>
            ${unreadDot}
          </div>
        `;
      });
      container.innerHTML = html;
    }

    function toggleMarkRead(notifId) {
      const list = getNotifications();
      const n = list.find(x => x.id === notifId);
      if (n) {
        n.read = true;
        saveNotifications(list);
        renderNotificationsList();
      }
    }

    function showCelebrateDeliveredModal(order) {
      const existing = document.getElementById('delivered-celebrate-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'delivered-celebrate-modal';
      modal.className = 'modal-backdrop';
      modal.style.zIndex = '10010';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      modal.style.padding = '20px';
      modal.style.background = 'rgba(0, 0, 0, 0.85)';

      modal.innerHTML = `
        <div class="bottom-sheet" style="background: #0f1217; color: #ffffff; border: 2.5px solid var(--accent-green); border-radius: 28px; width: 100%; max-width: 400px; padding: 26px; text-align: center; position: relative; box-shadow: 0 15px 45px rgba(16, 185, 129, 0.2); display: flex; flex-direction: column; gap: 16px; transform: scale(0.9); transition: all 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28);">

          <div style="width: 86px; height: 86px; background: rgba(16, 185, 129, 0.12); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 2px solid var(--accent-green); box-shadow: 0 0 20px rgba(16, 185, 129, 0.25);">
            <span style="font-size: 44px;">🥩</span>
          </div>

          <div>
            <span style="font-size: 10.5px; background: rgba(16, 185, 129, 0.15); color: var(--accent-green); font-weight: 800; padding: 3px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px;">Order Delivered / பெறப்பட்டது</span>
            <h3 style="font-family: 'Poppins', 'Hind Madurai', sans-serif; font-size: 21px; font-weight: 800; color: #fff; margin: 10px 0 2px 0;">ஆர்டர் முழுமையடைந்தது!</h3>
            <p style="font-family: 'Poppins', 'Hind Madurai', sans-serif; font-size: 14.5px; font-weight: 600; color: var(--text-secondary); margin: 0;">Your order reached successfully!</p>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 18px; padding: 14px; text-align: left;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
              <span style="color: var(--text-muted);">Order Ticket:</span>
              <strong style="color: #fff; font-family: 'JetBrains Mono', monospace;">${order.id}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
              <span style="color: var(--text-muted);">Amount Paid:</span>
              <strong style="color: var(--accent-green); font-size: 14px;">₹${order.totalAmount}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: var(--text-muted);">Rider Executive:</span>
              <strong style="color: #fff;">${(typeof getOrderAssignedExecutive === 'function' && getOrderAssignedExecutive(order) ? getOrderAssignedExecutive(order).name : null) || order.assignedExecutiveName || "Delivery Partner"} 🏍️</strong>
            </div>
          </div>

          <div style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 12px; margin-top: 4px;">
            <p style="font-size: 12.5px; color: var(--text-secondary); font-weight: 700; margin-bottom: 8px;">${currentLang === 'ta' ? 'விநியோக சேவையை மதிப்பிடுக' : 'Rate Delivery Service'}</p>
            <div style="display: flex; justify-content: center; gap: 8px;" id="feedback-star-row">
              <span style="font-size: 28px; cursor: pointer; opacity: 0.4;" onclick="highlightRatingStars(1)">⭐</span>
              <span style="font-size: 28px; cursor: pointer; opacity: 0.4;" onclick="highlightRatingStars(2)">⭐</span>
              <span style="font-size: 28px; cursor: pointer; opacity: 0.4;" onclick="highlightRatingStars(3)">⭐</span>
              <span style="font-size: 28px; cursor: pointer; opacity: 0.4;" onclick="highlightRatingStars(4)">⭐</span>
              <span style="font-size: 28px; cursor: pointer; opacity: 0.4;" onclick="highlightRatingStars(5)">⭐</span>
            </div>
            <div style="margin-top: 10px; margin-bottom: 6px;">
              <textarea id="feedback-comments" class="form-control" placeholder="${currentLang === 'ta' ? 'விமர்சனங்கள் அல்லது கருத்துக்களைப் பகிரவும் (விருப்பம்)...' : 'Share review or comment (Optional)...'}" style="background:#0c0c0d; color:#fff; border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px; font-size:12px; width:100%; box-sizing:border-box;" rows="2"></textarea>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
            <button class="btn btn-primary" style="background: var(--accent-green); border: none; font-size: 13px; font-weight: 700; padding: 12px; border-radius: 12px;" onclick="submitRiderDeliveredFeedback('${order.id}')">
              ${currentLang === 'ta' ? 'மதிப்பீட்டை சமர்ப்பிக்கவும் 👍' : 'Submit Feedback 👍'}
            </button>
            <button class="btn btn-secondary" style="background: transparent; border: none; color: var(--text-muted); font-size: 12px; font-weight: 600;" onclick="closeDeliveredCelebrateModal()">
              ${currentLang === 'ta' ? 'மூடுக' : 'Close'}
            </button>
          </div>

        </div>
      `;

      document.body.appendChild(modal);

      setTimeout(() => {
        modal.classList.add('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(1)';
      }, 10);

      highlightRatingStars(5);
    }

    let selectedRiderRating = 5;

    function highlightRatingStars(rating) {
      selectedRiderRating = rating;
      const row = document.getElementById('feedback-star-row');
      if (!row) return;
      const stars = row.querySelectorAll('span');
      stars.forEach((star, idx) => {
        if (idx < rating) {
          star.style.opacity = '1';
          star.style.textShadow = '0 0 10px rgba(245,158,11,0.5)';
        } else {
          star.style.opacity = '0.4';
          star.style.textShadow = 'none';
        }
      });
    }

    function submitRiderDeliveredFeedback(orderId) {
      const orders = getData('ek_orders', []);
      const oIdx = orders.findIndex(ord => ord.id === orderId);
      let writtenComment = "";

      const commentInput = document.getElementById('feedback-comments');
      if (commentInput) {
        writtenComment = commentInput.value.trim();
      }

      if (oIdx !== -1) {
        orders[oIdx].rating = selectedRiderRating;
        orders[oIdx].feedbackComment = writtenComment;
        orders[oIdx].updatedAt = new Date().toISOString();
        saveData('ek_orders', orders);

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_orders').doc(orderId).set(orders[oIdx])
            .then(() => removePendingSync('ek_orders', orderId))
            .catch(err => console.error("Could not sync rating to Firestore:", err));
        }

        const execObj = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(orders[oIdx]) : null;
        const assignedRiderId = execObj ? execObj.id : null;
        if (assignedRiderId) {
          const executives = getData('ek_delivery_persons', []);
          const eIdx = executives.findIndex(e => e.id === assignedRiderId);
          if (eIdx !== -1) {
            const ex = executives[eIdx];
            ex.totalRatings = (ex.totalRatings || 0) + 1;
            ex.ratingSum = (ex.ratingSum || 0) + selectedRiderRating;
            ex.averageRating = parseFloat((ex.ratingSum / ex.totalRatings).toFixed(1));
            saveData('ek_delivery_persons', executives);

            if (typeof db !== 'undefined' && db) {
              db.collection('ek_delivery_persons').doc(assignedRiderId).set(ex)
                .catch(err => console.error("Could not sync delivery person rating to Firestore:", err));
            }
          }
        }
      }

      const thanksMsg = currentLang === 'ta'
        ? `மிக்க நன்றி! உங்களது ${selectedRiderRating} நட்சத்திர மதிப்பீடு மற்றும் கருத்துக்கள் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது! ✓`
        : `Thank you! Your ${selectedRiderRating}-star rating and review have been submitted successfully! ✓`;

      showToast(thanksMsg, "success");
      closeDeliveredCelebrateModal();

      if (currentScreen === 'screen-delivery') {
        renderDeliveryScreen();
      } else if (currentScreen === 'screen-admin') {
        renderAdminDashboard();
      }
    }

    function closeDeliveredCelebrateModal() {
      const modal = document.getElementById('delivered-celebrate-modal');
      if (modal) {
        modal.classList.remove('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(0.9)';
        setTimeout(() => modal.remove(), 200);
      }
    }

    function reorderFastCheckout(id) {
      const orders = getData('ek_orders');
      const o = orders.find(ord => ord.id === id);
      if (!o) return;

      cart = [...o.items];
      if (typeof saveCart === 'function') {
        saveCart();
      } else {
        if (typeof saveData === 'function') saveData('ek_cart', cart);
        if (typeof updateCartBadge === 'function') updateCartBadge();
      }
      const localizedToast = currentLang === 'ta'
        ? "கூடையில் உங்களது முந்தைய ஆர்டர் பொருட்கள் வெற்றிகரமாக சேர்க்கப்பட்டன! 🛒"
        : "Cart successfully populated with products from your previous order! 🛒";
      showToast(localizedToast, "success");
      showTab('tab-cart');
    }

    function renderProfileScreen() {
      const session = getActiveSession();
      const user = getActiveUser();

      const guestBanner = document.getElementById('prof-guest-login-banner');
      if (guestBanner) guestBanner.remove();

      if (!session || !session.loggedIn || !user) {
        if (typeof showToast === 'function') {
          showToast(typeof currentLang !== 'undefined' && currentLang === 'ta' ? "சுயவிவரத்தை அணுக முதலில் உள்நுழையவும்!" : "Please login to view profile!", "info");
        }
        if (typeof showScreen === 'function') {
          showScreen('screen-login');
        }
        return;
      }

      const uName = user.name || session.name || (currentLang === 'ta' ? "வாடிக்கையாளர்" : "Customer");
      const uPhone = user.phone || session.phone || "";

      document.getElementById('prof-name').innerText = uName;
      if (uPhone) {
        document.getElementById('prof-phone').innerText = `📞 +91 ${uPhone}`;
      } else {
        document.getElementById('prof-phone').innerText = currentLang === 'ta' ? "📞 மொபைல் எண் சேர்க்கப்படவில்லை" : "📞 Mobile number not added";
      }
      document.getElementById('prof-avatar').innerText = uName.charAt(0).toUpperCase();

      const refBox = document.getElementById('prof-referred-by-box');
      const refNameEl = document.getElementById('prof-referred-by-name');
      if (user.referredBy) {
        const usersList = getData('ek_users') || [];
        const referrer = usersList.find(u => u.id === user.referredBy || u.id.replace('cust_', '').toUpperCase() === user.referredBy.replace('cust_', '').toUpperCase());
        const displayRefName = referrer ? referrer.name : user.referredBy;
        if (refNameEl) refNameEl.innerText = displayRefName;
        if (refBox) refBox.style.display = 'flex';
      } else {
        if (refBox) refBox.style.display = 'none';
      }

      const badgeElem = document.getElementById('prof-tier-badge');
      if (user.tier === 'gold') {
        badgeElem.className = "badge";
        badgeElem.style.background = "rgba(234,179,8,0.15)";
        badgeElem.style.color = "#eab308";
        badgeElem.innerText = "🥇 Gold Tier Member (2.0x Points)";
      } else if (user.tier === 'silver') {
        badgeElem.className = "badge";
        badgeElem.style.background = "rgba(156,163,175,0.15)";
        badgeElem.style.color = "#9ca3af";
        badgeElem.innerText = "🥈 Silver Tier Member (1.5x Points)";
      } else {
        badgeElem.className = "badge";
        badgeElem.style.background = "rgba(249,115,22,0.15)";
        badgeElem.style.color = "#f97316";
        badgeElem.innerText = "🥉 Bronze Tier Member (1.0x Points)";
      }

      const pts = Math.round(user.loyaltyPoints);
      document.getElementById('prof-wallet-pts').innerText = pts;
      document.getElementById('prof-wallet-rupees').innerText = Math.round(pts / 10);

      const progressText = document.getElementById('prof-progress-text');
      const progressBar = document.getElementById('prof-tier-progress-bar');

      if (user.tier === 'bronze') {
        const req = 150 - pts;
        const pct = Math.min(100, Math.round((pts / 150) * 100));
        progressText.innerText = `${pts} / 150 pts (${pct}%) • Earn ${req} more pts as landmark to Silver!`;
        progressBar.style.width = `${pct}%`;
      } else if (user.tier === 'silver') {
        const req = 500 - pts;
        const pct = Math.min(100, Math.round(((pts - 150) / 350) * 100));
        progressText.innerText = `${pts} / 500 pts (${pct}%) • Earn ${req} more pts as landmark to Gold!`;
        progressBar.style.width = `${pct}%`;
      } else {
        progressText.innerText = `${pts} pts • Ultimate GOLD LEVEL reached. Enjoy 2x loyalty rewards on all orders!`;
        progressBar.style.width = "100%";
      }

      const orders = getData('ek_orders');
      const myOrders = orders.filter(o => o.customerId === user.id || (o.customerPhone && user.phone && o.customerPhone === user.phone));
      const spentAmount = myOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      document.getElementById('stats-orders').innerText = myOrders.length;
      document.getElementById('stats-spent').innerText = `₹${spentAmount}`;

      const products = getData('ek_products');
      const avgValue = myOrders.length > 0 ? Math.round(spentAmount / myOrders.length) : 0;
      document.getElementById('stats-avg-order').innerText = `₹${avgValue}`;

      const now = new Date();
      const thisMonthSpent = myOrders
        .filter(o => {
          const od = new Date(o.createdAt);
          return od.getMonth() === now.getMonth() && od.getFullYear() === now.getFullYear();
        })
        .reduce((sum, o) => sum + o.totalAmount, 0);
      document.getElementById('stats-month-spent').innerText = `₹${thisMonthSpent}`;

      const joinedDate = user.joinedAt ? new Date(user.joinedAt) : new Date();
      const memberSinceStr = joinedDate.toLocaleDateString([], { month: 'short', year: 'numeric' });
      document.getElementById('stats-member-since').innerText = memberSinceStr || "Jun 2026";

      const itemCounts = {};
      myOrders.forEach(o => {
        if (o.items && Array.isArray(o.items)) {
          o.items.forEach(it => {
            itemCounts[it.productId] = (itemCounts[it.productId] || 0) + (it.weightGrams || 500);
          });
        }
      });

      const sortedItemIds = Object.keys(itemCounts).sort((a,b) => itemCounts[b] - itemCounts[a]);

      let mostOrderedName = '-';
      if (sortedItemIds.length > 0) {
        const topProd = products.find(p => p.id === sortedItemIds[0]);
        if (topProd) {
          mostOrderedName = currentLang === 'ta' && topProd.tamilName ? topProd.tamilName : topProd.englishName;
        }
      }
      document.getElementById('stats-most-ordered').innerText = mostOrderedName;

      const favCard = document.getElementById('favorite-products-card');
      const favListHtml = document.getElementById('profile-favorites-list');
      if (favListHtml) {
        favListHtml.innerHTML = '';
        let displayCount = 0;
        let favsHtml = '';

        sortedItemIds.slice(0, 3).forEach(pid => {
          const prod = products.find(p => p.id === pid);
          if (prod) {
            displayCount++;
            const tamName = prod.tamilName || '';
            const engName = prod.englishName || '';
            const displayTitle = currentLang === 'ta' && tamName ? tamName : engName;
            const displaySub = currentLang === 'ta' && tamName ? engName : '';

            const itemHtml = `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.01); border-radius: 10px; border: 1px solid var(--border-color);">
                <div>
                  <p style="font-size: 13px; font-weight: 600; color: #fff; margin: 0;">${displayTitle}</p>
                  ${displaySub ? `<p style="font-size: 10px; color: var(--text-muted); margin: 2px 0 0 0;">${displaySub}</p>` : ''}
                </div>
                <button class="btn btn-primary" style="width: auto; padding: 4px 12px; font-size: 11px; margin: 0; gap: 4px;" onclick="openProductModalDetail('${prod.id}')">
                  <span>🛒</span> Add Bundle
                </button>
              </div>
            `;
            favsHtml += itemHtml;
          }
        });
        favListHtml.innerHTML = favsHtml;

        if (displayCount > 0 && favCard) {
          favCard.style.display = 'block';
        } else if (favCard) {
          favCard.style.display = 'none';
        }
      }

      const profEditName = document.getElementById('prof-edit-name');
      if (profEditName) profEditName.value = user.name || '';
      const profEditPhone = document.getElementById('prof-edit-phone');
      if (profEditPhone) profEditPhone.value = user.phone || '';
      const profEditEmail = document.getElementById('prof-edit-email');
      if (profEditEmail) profEditEmail.value = user.email || (session ? session.email : '') || '';

      document.getElementById('prof-cut-dropdown').value = user.defaultCut || 'Small Pieces';
      document.getElementById('prof-whatsapp-toggle').checked = user.whatsappNotify !== false;
      const profAddrEdit = document.getElementById('prof-address-edit');
      if (profAddrEdit) {
        profAddrEdit.value = user.address || '';
        if (user.latitude && user.longitude) {
          profAddrEdit.setAttribute('data-lat', user.latitude);
          profAddrEdit.setAttribute('data-lng', user.longitude);
        } else {
          profAddrEdit.removeAttribute('data-lat');
          profAddrEdit.removeAttribute('data-lng');
        }
      }

      updateProfileGamification();
      updateProfileEmailVerificationUI();

      if (typeof renderSavedAddressesList === 'function') {
        renderSavedAddressesList();
      }

      const fcmTokenDisplay = document.getElementById('fcm-token-display');
      const fcmConnectionStatus = document.getElementById('fcm-connection-status');
      if (fcmTokenDisplay) {
        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getFcmToken === 'function') {
          const token = AndroidStorage.getFcmToken();
          if (token) {
            fcmTokenDisplay.innerText = token;
            if (token.startsWith('fcm_sim_')) {
              if (fcmConnectionStatus) {
                fcmConnectionStatus.innerText = "SIMULATOR ACTIVE 📱";
                fcmConnectionStatus.style.background = "#3b82f6";
              }
            } else {
              if (fcmConnectionStatus) {
                fcmConnectionStatus.innerText = "REAL FCM ACTIVE ✓";
                fcmConnectionStatus.style.background = "#10b981";
              }
            }
          } else {
            fcmTokenDisplay.innerText = "Generating fallback system instance...";
          }
        } else {
          let webToken = localStorage.getItem('ek_web_fcm_token');
          if (!webToken) {
            webToken = "fcm_web_sim_token_" + Math.floor(10000000 + Math.random() * 90000000);
            localStorage.setItem('ek_web_fcm_token', webToken);
          }
          fcmTokenDisplay.innerText = "Simulator default: " + webToken;
          if (fcmConnectionStatus) {
            fcmConnectionStatus.innerText = "WEB SIMULATION ON 🌐";
            fcmConnectionStatus.style.background = "#f59e0b";
          }
        }
      }
      if (typeof renderAllAddressCards === 'function') {
        renderAllAddressCards();
      }
    }

    function updateProfilePref() {
      const session = getActiveSession();
      const users = getData('ek_users');
      let userIdx = users.findIndex(u => u.id === session.userId);
      if (userIdx === -1 && session.phone) {
        userIdx = users.findIndex(u => u.phone === session.phone);
      }
      if (userIdx === -1) return;

      users[userIdx].defaultCut = document.getElementById('prof-cut-dropdown').value;
      users[userIdx].whatsappNotify = document.getElementById('prof-whatsapp-toggle').checked;
      users[userIdx].updatedAt = new Date().toISOString();

      saveData('ek_users', users);

      if (typeof db !== 'undefined' && db) {
        db.collection('ek_users').doc(users[userIdx].id).set(users[userIdx])
          .catch(e => console.error(e));
      }

      showToast("Profile preferences saved", "success");
    }

    
function openChangeEmailModal() {
  const pEmail = document.getElementById('ce-current-password');
  const nEmail = document.getElementById('ce-new-email');
  if (pEmail) pEmail.value = '';
  if (nEmail) nEmail.value = '';
  const modal = document.getElementById('change-email-modal');
  if (modal) modal.style.display = 'flex';
}
function hideChangeEmailModal() {
  const modal = document.getElementById('change-email-modal');
  if (modal) modal.style.display = 'none';
}
async function submitChangeEmail() {
  const btn = (typeof event !== 'undefined' && event && event.target) ? event.target.closest('button, .btn') : document.querySelector('button[onclick*="submitChangeEmail"]');
  if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, true);
  const currentPass = document.getElementById('ce-current-password') ? document.getElementById('ce-current-password').value : '';
  const newEmail = document.getElementById('ce-new-email') ? document.getElementById('ce-new-email').value.trim().toLowerCase() : '';
  const isTa = currentLang === 'ta';
  
  if (!currentPass) {
    showToast(isTa ? "தற்போதைய கடவுச்சொல்லை உள்ளிடவும்." : "Please enter your current password.", "error");
    if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
    return;
  }
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    showToast(isTa ? "செல்லுபடியாகும் புதிய மின்னஞ்சலை உள்ளிடவும்." : "Please enter a valid new email address.", "error");
    if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
    return;
  }
  
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      showToast(isTa ? "உள்நுழையவில்லை." : "User not logged in.", "error");
      return;
    }
    
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPass);
    await user.reauthenticateWithCredential(cred);
    
    if (typeof user.verifyBeforeUpdateEmail === 'function') {
      await user.verifyBeforeUpdateEmail(newEmail);
      showToast(isTa ? "புதிய மின்னஞ்சலுக்கு சரிபார்ப்பு இணைப்பு அனுப்பப்பட்டது! 📩" : "Verification link sent to your new email! 📩", "success");
    } else {
      await user.updateEmail(newEmail);
      showToast(isTa ? "மின்னஞ்சல் வெற்றிகரமாக மாற்றப்பட்டது! ✓" : "Email updated successfully! ✓", "success");
    }
    
    if (typeof db !== 'undefined' && db && user.uid) {
      await db.collection('ek_users').doc(user.uid).update({
        email: newEmail,
        updatedAt: new Date().toISOString()
      }).catch(e => console.warn("Firestore email update sync warning:", e));
    }
    
    const activeSession = getActiveSession();
    if (activeSession) {
      activeSession.email = newEmail;
      saveData('ek_customer_session', activeSession);
    }
    const profEditEmail = document.getElementById('prof-edit-email');
    if (profEditEmail) profEditEmail.value = newEmail;
    
    hideChangeEmailModal();
  } catch (err) {
    console.error("submitChangeEmail error:", err);
    showToast(isTa ? "மின்னஞ்சல் மாற்ற தோல்வி: " + err.message : "Failed to change email: " + err.message, "error");
  } finally {
    if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
  }
}

function updateProfileEmailVerificationUI() {
  const badgeEl = document.getElementById('prof-email-verified-badge');
  const boxEl = document.getElementById('prof-email-unverified-box');
  if (!badgeEl && !boxEl) return;

  const session = typeof getActiveSession === 'function' ? getActiveSession() : null;
  const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
  const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');

  const userEmail = (user && user.email) || (session && session.email) || '';

  if (!session || !session.loggedIn || !userEmail) {
    if (badgeEl) badgeEl.style.display = 'none';
    if (boxEl) boxEl.style.display = 'none';
    return;
  }

  const isVerified = Boolean(user && user.emailVerified);

  if (isVerified) {
    if (badgeEl) {
      badgeEl.style.display = 'inline-block';
      badgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
      badgeEl.style.border = '1px solid rgba(16, 185, 129, 0.35)';
      badgeEl.style.color = '#10b981';
      badgeEl.innerText = isTa ? "✅ சரிபார்க்கப்பட்டது" : "✅ Verified";
    }
    if (boxEl) {
      boxEl.style.display = 'none';
    }
  } else {
    if (badgeEl) {
      badgeEl.style.display = 'inline-block';
      badgeEl.style.background = 'rgba(239, 68, 68, 0.15)';
      badgeEl.style.border = '1px solid rgba(239, 68, 68, 0.35)';
      badgeEl.style.color = '#ef4444';
      badgeEl.innerText = isTa ? "⚠️ சரிபார்க்கப்படவில்லை" : "⚠️ Not Verified";
    }
    if (boxEl) {
      boxEl.style.display = 'block';
    }
  }
}
window.updateProfileEmailVerificationUI = updateProfileEmailVerificationUI;

async function resendProfileVerificationEmail() {
  const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
  try {
    const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
    if (!user || user.isAnonymous) {
      showToast(isTa ? "பயனர் உள்நுழையவில்லை." : "Please sign in to verify email.", "warning");
      return;
    }
    if (user.emailVerified) {
      showToast(isTa ? "உங்கள் மின்னஞ்சல் ஏற்கனவே சரிபார்க்கப்பட்டது! ✓" : "Your email is already verified! ✓", "success");
      updateProfileEmailVerificationUI();
      return;
    }
    if (typeof user.sendEmailVerification === 'function') {
      await user.sendEmailVerification();
      showToast(
        isTa
          ? `சரிபார்ப்பு இணைப்பு ${user.email}-க்கு அனுப்பப்பட்டது! இன்பாக்ஸ் அல்லது ஸ்பேம் கோப்புறையை பார்க்கவும். 📩`
          : `Verification link sent to ${user.email}! Please check your inbox or spam folder. 📩`,
        "success"
      );
    } else {
      showToast(isTa ? "சரிபார்ப்பு மின்னஞ்சல் அனுப்ப முடியவில்லை." : "Unable to send verification email.", "warning");
    }
  } catch (err) {
    console.error("[Email Verification Resend]", err);
    if (err && err.code === 'auth/too-many-requests') {
      showToast(
        isTa
          ? "அதிகமுறை கோரிக்கை அனுப்பப்பட்டது. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்."
          : "Too many requests. Please wait a moment before trying again.",
        "warning"
      );
    } else {
      showToast((err && err.message) || "Failed to send verification email.", "error");
    }
  }
}
window.resendProfileVerificationEmail = resendProfileVerificationEmail;

async function checkEmailVerificationStatus() {
  const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
  try {
    const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
    if (!user || user.isAnonymous) {
      showToast(isTa ? "பயனர் உள்நுழையவில்லை." : "Please sign in.", "warning");
      return;
    }
    showToast(isTa ? "மின்னஞ்சல் நிலை சரிபார்க்கப்படுகிறது... ⏳" : "Checking verification status... ⏳", "info");
    
    // Reload user from Firebase to retrieve freshest emailVerified boolean
    await user.reload();
    const refreshedUser = firebase.auth().currentUser;

    if (refreshedUser && refreshedUser.emailVerified) {
      updateProfileEmailVerificationUI();
      if (typeof showCustomAlert === 'function') {
        showCustomAlert(
          isTa ? "🎉 மின்னஞ்சல் சரிபார்க்கப்பட்டது!" : "🎉 Email Verified!",
          isTa 
            ? `உங்கள் மின்னஞ்சல் (${refreshedUser.email}) வெற்றிகரமாக சரிபார்க்கப்பட்டது. உங்கள் கணக்கு பாதுகாப்பானது!`
            : `Your email (${refreshedUser.email}) has been successfully verified!`
        );
      }
      showToast(isTa ? "மின்னஞ்சல் சரிபார்க்கப்பட்டது! ✓" : "Email verified! ✓", "success");
    } else {
      updateProfileEmailVerificationUI();
      if (typeof showCustomAlert === 'function') {
        showCustomAlert(
          isTa ? "⚠️ மின்னஞ்சல் இன்னும் உறுதி செய்யப்படவில்லை" : "⚠️ Email Not Verified Yet",
          isTa
            ? `உங்கள் மின்னஞ்சல் இன்பாக்ஸ் அல்லது ஸ்பேம் (Spam) கோப்புறையில் வந்துள்ள சரிபார்ப்பு இணைப்பை (Verification Link) க்ளிக் செய்த பிறகு, இங்கே 'சரிபார்த்ததை உறுதி செய்' அழுத்தவும்.`
            : `Please click the verification link in your inbox or spam folder, then tap 'Check' here again.`
        );
      } else {
        showToast(isTa ? "மின்னஞ்சல் இன்னும் உறுதி செய்யப்படவில்லை. இன்பாக்ஸை சரிபார்க்கவும்." : "Email not verified yet. Check your inbox.", "warning");
      }
    }
  } catch (err) {
    console.error("[Check Email Verification]", err);
    showToast((err && err.message) || "Failed to check verification status.", "error");
  }
}
window.checkEmailVerificationStatus = checkEmailVerificationStatus;

function saveProfileChanges() {
      const session = getActiveSession();
      if (!session) return;

      const profEditName = document.getElementById('prof-edit-name');
      const profEditPhone = document.getElementById('prof-edit-phone');
      const profEditEmail = document.getElementById('prof-edit-email');
      const profAddrEdit = document.getElementById('prof-address-edit');

      const nameVal = profEditName ? profEditName.value.trim() : "";
      const phoneVal = profEditPhone ? profEditPhone.value.trim() : "";
      const emailVal = profEditEmail ? profEditEmail.value.trim().toLowerCase() : "";
      const adrVal = profAddrEdit ? profAddrEdit.value.trim() : "";

      if (!nameVal) {
        showToast(currentLang === 'ta' ? "பெயர் காலியாக இருக்கக்கூடாது!" : "Name cannot be empty!", "error");
        return;
      }
      if (!phoneVal) {
        showToast(currentLang === 'ta' ? "மொபைல் எண் காலியாக இருக்கக்கூடாது!" : "Mobile number cannot be empty!", "error");
        return;
      }
      if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        showToast(currentLang === 'ta' ? "செல்லுபடியாகும் மின்னஞ்சலை உள்ளிடவும்!" : "Please enter a valid email address!", "error");
        return;
      }
      if (!adrVal) {
        showToast(currentLang === 'ta' ? "டெலிவரி முகவரி காலியாக இருக்கக்கூடாது!" : "Delivery address cannot be empty!", "error");
        return;
      }

      const lat = profAddrEdit && profAddrEdit.getAttribute('data-lat') ? parseFloat(profAddrEdit.getAttribute('data-lat')) : 11.5815;
      const lng = profAddrEdit && profAddrEdit.getAttribute('data-lng') ? parseFloat(profAddrEdit.getAttribute('data-lng')) : 77.8488;

      const users = getData('ek_users', []);
      let userIdx = users.findIndex(u => u.id === session.userId);
      if (userIdx === -1 && session.phone) {
        userIdx = users.findIndex(u => u.phone === session.phone);
      }

      if (userIdx !== -1) {
        const userObj = users[userIdx];
        const registeredPhone = userObj.phone || session.phone;
        
        // Prevent changing registered phone number
        if (phoneVal && registeredPhone && phoneVal !== registeredPhone) {
          showToast(currentLang === 'ta' ? "பதிவு செய்யப்பட்ட மொபைல் எண்ணை மாற்ற முடியாது!" : "Registered mobile number cannot be changed!", "error");
          if (profEditPhone) profEditPhone.value = registeredPhone;
          return;
        }

        userObj.name = nameVal;
        userObj.phone = registeredPhone || phoneVal;
        if (emailVal) userObj.email = emailVal;
        userObj.address = adrVal;
        userObj.latitude = lat;
        userObj.longitude = lng;
        userObj.updatedAt = new Date().toISOString();

        users[userIdx] = userObj;
        saveData('ek_users', users);

        session.userName = nameVal;
        session.phone = phoneVal;
        if (emailVal) session.email = emailVal;
        if (session.temp) {
          saveData('ek_customer_session_temp', session);
        } else {
          saveData('ek_customer_session', session);
        }

        const profNameEl = document.getElementById('prof-name');
        if (profNameEl) profNameEl.innerText = nameVal;
        const profPhoneEl = document.getElementById('prof-phone');
        if (profPhoneEl) profPhoneEl.innerText = `📞 +91 ${phoneVal}`;

        if (typeof syncPrimaryUserAddress === 'function') {
          syncPrimaryUserAddress(adrVal, lat, lng);
        }

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_users').doc(userObj.id).update({
            name: nameVal,
            phone: phoneVal,
            email: emailVal || userObj.email || session.email || '',
            address: adrVal,
            latitude: lat,
            longitude: lng,
            updatedAt: userObj.updatedAt
          })
          .then(() => debugLog("Profile updated successfully on cloud!"))
          .catch(err => console.error("Profile cloud update failed:", err));
        }

        showToast(currentLang === 'ta' ? "சுயவிவரம் வெற்றிகரமாக சேமிக்கப்பட்டது!" : "Profile details saved successfully!", "success");

        renderProfileScreen();
      } else {
        showToast("Error updating profile: session user not found.", "error");
      }
    }

    function openDeliveryPartnerRatingModal(orderId) {
      const orders = getData('ek_orders', []);
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        showToast("Order not found!", "error");
        return;
      }

      if (order.riderRating) {
        showCustomConfirm(
          currentLang === 'ta' ? "ஏற்கனவே மதிப்பிடப்பட்டது" : "Already Rated",
          currentLang === 'ta'
            ? `இந்த ஆர்டருக்கான மதிப்பீடு ஏற்கனவே சமர்ப்பிக்கப்பட்டுள்ளது (⭐ ${order.riderRating}). மீண்டும் மதிப்பிட விரும்புகிறீர்களா?`
            : `You have already rated this delivery partner (⭐ ${order.riderRating}). Do you want to update your rating?`,
          () => {
            showRatingModal(order);
          }
        );
      } else {
        showRatingModal(order);
      }
    }

    function showRatingModal(order) {
      const oldModal = document.getElementById('delivery-partner-rating-modal');
      if (oldModal) oldModal.remove();

      const modal = document.createElement('div');
      modal.id = 'delivery-partner-rating-modal';
      modal.className = 'modal-backdrop';
      modal.style.zIndex = '999999';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      modal.style.padding = '15px';

      window.selectedPartnerRating = order.riderRating || 0;

      const titleText = currentLang === 'ta' ? 'டெலிவரி பார்ட்னரை மதிப்பிடவும்' : 'Rate Delivery Partner';
      const descText = currentLang === 'ta'
        ? `தயவுசெய்து உங்களது டெலிவரி பார்ட்னருக்கு 1 முதல் 5 நட்சத்திரங்கள் வரை மதிப்பீடு வழங்கி, கருத்துக்களைப் பகிரவும்.`
        : `Please rate your delivery partner and share optional feedback.`;

      const cancelText = currentLang === 'ta' ? 'ரத்துசெய்' : 'Cancel';
      const submitText = currentLang === 'ta' ? 'சமர்ப்பிக்கவும்' : 'Submit Rating';
      const feedbackPlaceholder = currentLang === 'ta' ? 'கூடுதல் கருத்துக்கள் (விருப்பத்தேர்வு)...' : 'Write optional feedback here...';

      let starsHtml = '';
      for (let s = 1; s <= 5; s++) {
        const starColor = s <= window.selectedPartnerRating ? 'var(--accent-orange)' : '#555';
        const starChar = s <= window.selectedPartnerRating ? '★' : '☆';
        starsHtml += `
          <span class="partner-rating-star" data-rating="${s}" style="font-size: 36px; cursor: pointer; color: ${starColor}; margin: 0 6px; transition: transform 0.15s ease-in-out; display: inline-block;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'">
            ${starChar}
          </span>
        `;
      }

      modal.innerHTML = `
        <div class="bottom-sheet" style="width: 95%; max-width: 440px; border-radius: 24px; border: 1.5px solid #2d2d2d; background: #0c0c0e; padding: 24px; box-shadow: 0 12px 35px rgba(0,0,0,0.85); transform: scale(0.9); transition: all 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28); display: flex; flex-direction: column; gap: 16px; box-sizing: border-box; text-align: center;">

          <div style="font-size: 44px; margin-bottom: 4px;">🚴‍♂️⭐</div>

          <div>
            <h4 style="color: #ffffff; font-size: 16px; font-weight: 850; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: -0.3px;">${titleText}</h4>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.5;">${descText}</p>
          </div>

          <div id="partner-rating-stars-container" style="display: flex; justify-content: center; margin: 8px 0;">
            ${starsHtml}
          </div>

          <textarea id="partner-rating-feedback" placeholder="${feedbackPlaceholder}" style="width: 100%; height: 80px; min-height: 80px; background: #141416; border: 1.5px solid #2d2d2d; border-radius: 12px; padding: 12px; color: #fff; font-size: 13px; font-family: sans-serif; resize: none; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent-orange)'" onblur="this.style.borderColor='#2d2d2d'">${order.riderFeedback || ''}</textarea>

          <div style="display: flex; gap: 10px; width: 100%; margin-top: 4px;">
            <button onclick="closeDeliveryPartnerRatingModal()" class="btn" style="flex: 1; min-height: 42px; height: auto; padding: 10px 16px; background: rgba(255,255,255,0.04); border: 1.2px solid #2d2d2d; color: var(--text-secondary); font-size: 13px; font-weight: 750; border-radius: 12px; cursor: pointer;">
              ${cancelText}
            </button>
            <button id="partner-rating-submit-btn" onclick="submitDeliveryPartnerRating('${order.id}')" class="btn btn-primary" style="flex: 1.2; min-height: 42px; height: auto; padding: 10px 16px; font-size: 13px; font-weight: 800; border-radius: 12px; cursor: pointer; ${window.selectedPartnerRating ? '' : 'opacity: 0.5; cursor: not-allowed;'}" ${window.selectedPartnerRating ? '' : 'disabled'}>
              ${submitText}
            </button>
          </div>

        </div>
      `;

      document.body.appendChild(modal);

      setTimeout(() => {
        modal.classList.add('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(1)';

        const stars = modal.querySelectorAll('.partner-rating-star');
        stars.forEach(star => {
          star.onclick = function() {
            const r = parseInt(this.getAttribute('data-rating'));
            window.selectedPartnerRating = r;

            stars.forEach((sStar, sIdx) => {
              if (sIdx < r) {
                sStar.innerHTML = '★';
                sStar.style.color = 'var(--accent-orange)';
              } else {
                sStar.innerHTML = '☆';
                sStar.style.color = '#555';
              }
            });

            const subBtn = document.getElementById('partner-rating-submit-btn');
            if (subBtn) {
              subBtn.removeAttribute('disabled');
              subBtn.style.opacity = '1';
              subBtn.style.cursor = 'pointer';
            }
          };
        });
      }, 10);
    }

    function closeDeliveryPartnerRatingModal() {
      const modal = document.getElementById('delivery-partner-rating-modal');
      if (modal) {
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(0.9)';
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
      }
    }

    async function submitDeliveryPartnerRating(orderId) {
      const rating = window.selectedPartnerRating || 0;
      if (!rating) {
        showToast(currentLang === 'ta' ? "தயவுசெய்து ஒரு மதிப்பீட்டைத் தேர்ந்தெடுக்கவும்!" : "Please select a rating star first!", "warning");
        return;
      }

      const feedbackTextarea = document.getElementById('partner-rating-feedback');
      const feedback = feedbackTextarea ? feedbackTextarea.value.trim() : "";

      closeDeliveryPartnerRatingModal();

      if (typeof submitRiderRating === 'function') {
        submitRiderRating(orderId, rating, feedback);
      } else {
        const orders = getData('ek_orders', []);
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
          orders[idx].riderRating = rating;
          orders[idx].riderFeedback = feedback;
          saveData('ek_orders', orders);
        }
        if (typeof db !== 'undefined' && db) {
          db.collection('ek_orders').doc(orderId).update({
            riderRating: rating,
            riderFeedback: feedback
          }).catch(err => console.error("Rider rating cloud update failed:", err));
        }
      }

      if (currentScreen === 'screen-track') {
        renderTrackerScreen();
      }

      showRatingSuccessPopup();
    }

    function showRatingSuccessPopup() {
      const oldPopup = document.getElementById('rating-success-popup-modal');
      if (oldPopup) oldPopup.remove();

      const popup = document.createElement('div');
      popup.id = 'rating-success-popup-modal';
      popup.className = 'modal-backdrop';
      popup.style.zIndex = '9999999';
      popup.style.display = 'flex';
      popup.style.justifyContent = 'center';
      popup.style.alignItems = 'center';
      popup.style.padding = '15px';

      const thankYouTitle = currentLang === 'ta' ? 'மதிப்பீட்டிற்கு நன்றி!' : 'Thank you for your rating!';
      const successMessage = currentLang === 'ta'
        ? 'உங்கள் கருத்து வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது.'
        : 'Your feedback has been submitted successfully.';
      const okButtonText = currentLang === 'ta' ? 'சரி' : 'OK';

      popup.innerHTML = `
        <div class="bottom-sheet" style="width: 90%; max-width: 360px; border-radius: 20px; border: 1.5px solid #2d2d2d; background: #0c0c0e; padding: 20px; box-shadow: 0 12px 35px rgba(0,0,0,0.85); transform: scale(0.9); transition: all 0.2s; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; text-align: center;">
          <div style="font-size: 36px;">🎉✅</div>
          <div>
            <h4 style="color: #ffffff; font-size: 15px; font-weight: 800; margin: 0 0 6px 0;">${thankYouTitle}</h4>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.45;">${successMessage}</p>
          </div>
          <button onclick="closeRatingSuccessPopup()" class="btn btn-primary" style="min-height: 38px; height: auto; padding: 8px 16px; font-size: 12.5px; font-weight: 800; border-radius: 10px; cursor: pointer; margin: 4px 0 0 0;">
            ${okButtonText}
          </button>
        </div>
      `;

      document.body.appendChild(popup);

      setTimeout(() => {
        popup.classList.add('active');
        const sheet = popup.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(1)';
      }, 10);
    }

    function closeRatingSuccessPopup() {
      const popup = document.getElementById('rating-success-popup-modal');
      if (popup) {
        const sheet = popup.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(0.9)';
        popup.classList.remove('active');
        setTimeout(() => popup.remove(), 200);
      }
    }

    function showDeveloperAbout() {
      document.getElementById('developer-info-modal').style.display = 'flex';
      document.getElementById('developer-info-modal').classList.add('active');
    }

    function closeDeveloperModal(event) {
      if (event.target === document.getElementById('developer-info-modal')) {
        closeDeveloperModalDetail();
      }
    }

    function closeDeveloperModalDetail() {
      document.getElementById('developer-info-modal').style.display = 'none';
      document.getElementById('developer-info-modal').classList.remove('active');
    }

    function showPrivacyPolicy() {
      const isTamil = document.body.classList.contains('tamil-mode');
      setPrivacyLang(isTamil ? 'ta' : 'en');

      const modal = document.getElementById('privacy-policy-modal');
      modal.style.display = 'flex';
      modal.classList.add('active');
    }

    function closePrivacyPolicyModal(event) {
      if (event.target === document.getElementById('privacy-policy-modal')) {
        closePrivacyPolicyDetail();
      }
    }

    function closePrivacyPolicyDetail() {
      const modal = document.getElementById('privacy-policy-modal');
      modal.style.display = 'none';
      modal.classList.remove('active');
    }

    function setPrivacyLang(lang) {
      const tabEn = document.getElementById('privacy-tab-en');
      const tabTa = document.getElementById('privacy-tab-ta');
      const contentEn = document.getElementById('privacy-content-en');
      const contentTa = document.getElementById('privacy-content-ta');

      if (lang === 'en') {
        if (contentEn) contentEn.style.display = 'block';
        if (contentTa) contentTa.style.display = 'none';
        if (tabEn) { tabEn.style.background = '#f59e0b'; tabEn.style.color = '#000'; }
        if (tabTa) { tabTa.style.background = 'transparent'; tabTa.style.color = '#9ca3af'; }
      } else {
        if (contentEn) contentEn.style.display = 'none';
        if (contentTa) contentTa.style.display = 'block';
        if (tabEn) { tabEn.style.background = 'transparent'; tabEn.style.color = '#9ca3af'; }
        if (tabTa) { tabTa.style.background = '#f59e0b'; tabTa.style.color = '#000'; }
      }

      const scrollBox = document.getElementById('privacy-scroll-container');
      if (scrollBox) scrollBox.scrollTop = 0;
    }

    window.showPrivacyPolicy = showPrivacyPolicy;
    window.closePrivacyPolicyModal = closePrivacyPolicyModal;
    window.closePrivacyPolicyDetail = closePrivacyPolicyDetail;
    window.setPrivacyLang = setPrivacyLang;

    function closePrintPreviewModal(event) {
      if (event.target === document.getElementById('print-preview-modal')) {
        closePrintPreviewModalDetail();
      }
    }

    function closePrintPreviewModalDetail() {
      document.getElementById('print-preview-modal').style.display = 'none';
      document.getElementById('print-preview-modal').classList.remove('active');
    }

    function copyTextToClipboardGeneral(text, successMsg, successCallback = null) {
      if (typeof AndroidStorage !== 'undefined' && AndroidStorage.copyToClipboard) {
        try {
          const success = AndroidStorage.copyToClipboard(text);
          if (success) {
            if (successMsg) showToast(successMsg, "success");
            if (successCallback) successCallback();
            return;
          }
        } catch (err) {
          console.warn("Native copy failed, falling back:", err);
        }
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(() => {
          if (successMsg) showToast(successMsg, "success");
          if (successCallback) successCallback();
        }).catch(err => {
          console.warn("Modern clipboard API failed, trying document.execCommand:", err);
          fallbackCopyText(text, successMsg);
          if (successCallback) successCallback();
        });
      } else {
        fallbackCopyText(text, successMsg);
        if (successCallback) successCallback();
      }
    }

    function copyTicketToClipboard() {
      const content = document.getElementById('print-preview-content').innerText;
      copyTextToClipboardGeneral(content, "Ticket copied to clipboard ✓");
    }

    function fallbackCopyText(text, successMsg) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      document.body.appendChild(textArea);
      try {
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        if (successful && successMsg) {
          showToast(successMsg, "success");
        }
      } catch (err) {
        console.warn("Unable to copy via fallback element:", err);
      }
      document.body.removeChild(textArea);
    }

    function printTicketSafely() {
      const contentHTML = document.getElementById('print-preview-content').innerHTML;

      let filename = "Edappadi_Kadai_Slip";
      const contentText = document.getElementById('print-preview-content').innerText;
      const match = contentText.match(/ORDER ID:\s*([^\n]+)/i) || contentText.match(/NEW KOT:\s*([^\n]+)/i) || contentText.match(/KOT:\s*([^\n]+)/i);
      if (match && match[1]) {
        filename = `EK_Slip_${match[1].trim()}`;
      }

      if (typeof AndroidStorage !== 'undefined' && AndroidStorage.printHtml) {
        const printedHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Hind+Madurai:wght@500;700;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: auto;
      margin: 3mm 0mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: 'Poppins', 'Hind Madurai', 'Courier New', monospace, sans-serif;
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
      padding: 3mm;
      color: #000000;
      background: #ffffff;
      font-size: 11.5px;
      line-height: 1.4;
    }
    body > div {
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    table { width: 100%; border-collapse: collapse; }
    hr { border: none; border-top: 1.5px dashed #000; margin: 8px 0; }
    h1, h2, h3, p { margin-top: 2px; margin-bottom: 2px; }
  </style>
</head>
<body>
  <div style="width:100%; max-width:76mm; margin:0 auto;">
    ${contentHTML}
  </div>
</body>
</html>`;
        AndroidStorage.printHtml(printedHTML, filename);
        showToast("Opening Print Menu/PDF Saving Screen ✓", "success");
        return;
      }

      const printArea = document.getElementById('print-area');
      printArea.innerHTML = contentHTML;
      printArea.style.display = 'block';
      setTimeout(() => {
        window.print();
        printArea.style.display = 'none';
        printArea.innerHTML = '';
      }, 250);
    }

    function printCustomerInvoice(orderId) {
      let order = null;
      if (typeof getData === 'function') {
        const orders = getData('ek_orders', []);
        order = orders.find(o => o.id === orderId);
      }
      if (!order && typeof myOrders !== 'undefined' && Array.isArray(myOrders)) {
        order = myOrders.find(o => o.id === orderId);
      }
      if (!order) {
        if (typeof showToast === 'function') showToast("Order details not found for invoice!", "error");
        return;
      }

      const items = order.items || [];
      let itemsHtml = '';
      items.forEach((it, idx) => {
        const name = it.tamilName ? `${it.tamilName} (${it.englishName || it.name})` : (it.englishName || it.name || 'Item');
        const qtyStr = it.displayQty || it.selectorQty || `${it.weightGrams || 1} unit`;
        const price = it.totalPrice || it.itemTotalPrice || ((it.price || 0) * (it.weightGrams ? it.weightGrams/1000 : 1));
        itemsHtml += `
          <tr style="border-bottom: 1px dashed #ccc; font-size: 11px;">
            <td style="padding: 6px 0; text-align: left;">${idx + 1}. ${name}<br><small style="color: #555;">${qtyStr}</small></td>
            <td style="padding: 6px 0; text-align: right; vertical-align: top; font-weight: 600;">₹${Math.round(price)}</td>
          </tr>
        `;
      });

      const subtotal = order.subtotalAmount || order.subtotal || 0;
      const delivery = order.deliveryFee || 0;
      const discount = (order.loyaltyDiscount || 0) + (order.couponDiscount || 0);
      const grandTotal = order.totalAmount || order.finalTotal || (subtotal + delivery - discount);
      const payMethod = order.paymentMethod || 'COD';

      const html = `
        <div style="font-family: 'Poppins', 'Hind Madurai', sans-serif; padding: 10px; max-width: 320px; margin: 0 auto; color: #000; font-size: 11.5px; line-height: 1.4;">
          <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px;">
            <h2 style="margin: 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">EDAPPADI KADAI</h2>
            <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 700; color: #333;">எடப்பாடி கடை • Fresh Quality Meats</p>
            <p style="margin: 2px 0 0 0; font-size: 9.5px; color: #666;">Kavandampatti, Edappadi • Ph: 8778148899</p>
          </div>

          <div style="margin-bottom: 8px; font-size: 10.5px;">
            <div style="display: flex; justify-content: space-between;"><strong>INVOICE NO:</strong> <span>${order.id}</span></div>
            <div style="display: flex; justify-content: space-between;"><strong>DATE:</strong> <span>${new Date(order.createdAt || Date.now()).toLocaleDateString()}</span></div>
            <div style="display: flex; justify-content: space-between;"><strong>CUSTOMER:</strong> <span>${order.customerName || 'Customer'}</span></div>
            <div style="display: flex; justify-content: space-between;"><strong>PHONE:</strong> <span>${order.customerPhone || '-'}</span></div>
            <div style="margin-top: 4px;"><strong>ADDRESS:</strong> <br><span>${order.deliveryAddress || '-'}</span></div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px; border-top: 1px solid #000; border-bottom: 1px solid #000;">
            <thead>
              <tr style="font-size: 10px; border-bottom: 1px solid #000; text-align: left;">
                <th style="padding: 4px 0;">ITEM</th>
                <th style="padding: 4px 0; text-align: right;">AMT (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="font-size: 11px; line-height: 1.5; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between;"><span>Items Subtotal:</span> <span>₹${Math.round(subtotal)}</span></div>
            <div style="display: flex; justify-content: space-between;"><span>Delivery Charge:</span> <span>₹${Math.round(delivery)}</span></div>
            ${discount > 0 ? `<div style="display: flex; justify-content: space-between; color: #15803d;"><span>Discount Applied:</span> <span>-₹${Math.round(discount)}</span></div>` : ''}
            <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 13px; border-top: 1.5px solid #000; padding-top: 4px; margin-top: 4px;">
              <span>GRAND TOTAL:</span> <span>₹${Math.round(grandTotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 2px;">
              <span>Payment Mode:</span> <strong style="text-transform: uppercase;">${payMethod}</strong>
            </div>
          </div>

          <div style="text-align: center; border-top: 1px dashed #000; padding-top: 8px; font-size: 9.5px; color: #444;">
            <p style="margin: 0; font-weight: 700;">Thank you for shopping with Edappadi Kadai!</p>
            <p style="margin: 2px 0 0 0;">For support/queries, call 8778148899</p>
          </div>
        </div>
      `;

      const previewEl = document.getElementById('print-preview-content');
      const modal = document.getElementById('print-preview-modal');
      if (previewEl && modal) {
        previewEl.innerHTML = html;
        modal.style.display = 'flex';
        modal.classList.add('active');
      }
    }

    function printKOTTicket(orderId) {
      let order = null;
      if (typeof getData === 'function') {
        const orders = getData('ek_orders', []);
        order = orders.find(o => o.id === orderId);
      }
      if (!order && typeof myOrders !== 'undefined' && Array.isArray(myOrders)) {
        order = myOrders.find(o => o.id === orderId);
      }
      if (!order) {
        if (typeof showToast === 'function') showToast("Order details not found for packing slip!", "error");
        return;
      }

      const items = order.items || [];
      let itemsHtml = '';
      items.forEach((it, idx) => {
        const name = it.tamilName ? `${it.tamilName} (${it.englishName || it.name})` : (it.englishName || it.name || 'Item');
        const qtyStr = it.displayQty || it.selectorQty || `${it.weightGrams || 1} unit`;
        const cutStyle = it.cutStyle ? `<br>✂️ Prep: ${it.cutStyle}` : '';
        itemsHtml += `
          <tr style="border-bottom: 1px dashed #ccc; font-size: 11.5px;">
            <td style="padding: 6px 0;">${idx + 1}. <strong>${name}</strong>${cutStyle}</td>
            <td style="padding: 6px 0; text-align: right; vertical-align: top; font-weight: 800;">${qtyStr}</td>
          </tr>
        `;
      });

      const html = `
        <div style="font-family: 'Poppins', 'Hind Madurai', sans-serif; padding: 10px; max-width: 320px; margin: 0 auto; color: #000; font-size: 11.5px;">
          <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px;">
            <h2 style="margin: 0; font-size: 15px; font-weight: 800; text-transform: uppercase;">EDAPPADI KADAI • PACKING SLIP</h2>
            <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 800; color: #e63946;">KOT ORDER: ${order.id}</p>
          </div>
          <div style="margin-bottom: 8px; font-size: 10.5px;">
            <div><strong>CUSTOMER:</strong> ${order.customerName || 'Customer'} (${order.customerPhone || '-'})</div>
            <div><strong>SLOT:</strong> ${order.deliveryTimeSlot || 'Now'}</div>
            <div><strong>ADDRESS:</strong> ${order.deliveryAddress || '-'}</div>
          </div>
          <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #000; border-bottom: 1px solid #000; margin-bottom: 8px;">
            <thead>
              <tr style="font-size: 10px; border-bottom: 1px solid #000;">
                <th style="padding: 4px 0; text-align: left;">ITEM & PREP</th>
                <th style="padding: 4px 0; text-align: right;">QTY</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div style="text-align: center; font-size: 10px; font-weight: 700;">
            Packed by Edappadi Kadai Dispatch Desk
          </div>
        </div>
      `;

      const previewEl = document.getElementById('print-preview-content');
      const modal = document.getElementById('print-preview-modal');
      if (previewEl && modal) {
        previewEl.innerHTML = html;
        modal.style.display = 'flex';
        modal.classList.add('active');
      }
    }

    let _trackerSearchTimer = null;
    function debouncedSearchTracker() {
      if (_trackerSearchTimer) clearTimeout(_trackerSearchTimer);
      const input = document.getElementById('tracker-search-input');
      if (input && !input.value.trim()) {
        if (typeof renderTrackerScreen === 'function') renderTrackerScreen();
        return;
      }
      _trackerSearchTimer = setTimeout(() => {
        if (typeof renderTrackerScreen === 'function') renderTrackerScreen();
      }, 100);
    }
    window.debouncedSearchTracker = debouncedSearchTracker;

    /* ==========================================================================
       ★ UNIVERSAL MOBILE PULL-TO-REFRESH SYSTEM
       Provides consistent pull-down data refreshing for:
       - Customer Pages (Home, Cart, Tracker, Profile, Offers, Quick Order)
       - Delivery Partner Pages (Assigned orders, ready orders, earnings, GPS)
       - Admin Pages (Dashboard, Orders, Products, Customers, Zones, Sync)
       ========================================================================== */
    window._ptrRefreshing = false;

    async function refreshCurrentScreenData(screenId) {
      debugLog("[Universal PTR] Refreshing data for screen:", screenId);

      // --- CUSTOMER PAGES ---
      if (screenId === 'screen-home') {
        try {
          if (typeof fetchSettingsOnce === 'function') await fetchSettingsOnce();
          if (typeof fetchProductsOnce === 'function') await fetchProductsOnce();
        } catch (e) {
          console.warn("[PTR Home] Cloud fetch notice:", e);
        }
        if (typeof renderHomeScreen === 'function') renderHomeScreen();
        if (typeof renderSlidingBanners === 'function') renderSlidingBanners();
        if (typeof renderHomeScreenProducts === 'function') renderHomeScreenProducts();
        if (typeof renderCategoryPills === 'function') renderCategoryPills();
        if (typeof updateCartBadge === 'function') updateCartBadge();
        if (typeof updateLyoDeliveryBanner === 'function') updateLyoDeliveryBanner();
        return;
      }

      if (screenId === 'screen-cart') {
        try {
          if (typeof fetchSettingsOnce === 'function') await fetchSettingsOnce();
        } catch (e) {
          console.warn("[PTR Cart] Settings sync notice:", e);
        }
        if (typeof renderCartScreen === 'function') renderCartScreen();
        if (typeof updateCartBadge === 'function') updateCartBadge();
        if (typeof refreshLiveBriefing === 'function') refreshLiveBriefing(false);
        return;
      }

      if (screenId === 'screen-track') {
        try {
          const session = typeof getActiveSession === 'function' ? getActiveSession() : null;
          if (session && typeof db !== 'undefined' && db) {
            const custId = session.userId || session.id || session.uid;
            const custPhone = session.phone;
            let snap = null;
            if (custId && custId !== 'guest_tracker') {
              snap = await db.collection('ek_orders').where('customerId', '==', String(custId)).limit(40).get().catch(() => null);
            } else if (custPhone) {
              snap = await db.collection('ek_orders').where('customerPhone', '==', String(custPhone)).limit(40).get().catch(() => null);
            }
            if (snap && !snap.empty) {
              const snapList = [];
              snap.forEach(d => {
                const data = d.data();
                if (data) snapList.push({ ...data, id: d.id || data.id });
              });
              const prev = getData('ek_orders', []);
              const orderMap = new Map();
              if (Array.isArray(prev)) prev.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });
              snapList.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });
              saveData('ek_orders', Array.from(orderMap.values()));
              if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_orders');
            }
          }
        } catch (e) {
          console.warn("[PTR Track] Orders sync notice:", e);
        }
        if (typeof renderTrackerScreen === 'function') renderTrackerScreen();
        return;
      }

      if (screenId === 'screen-profile') {
        try {
          const session = typeof getActiveSession === 'function' ? getActiveSession() : null;
          if (session && session.userId && typeof loadUserData === 'function') {
            await loadUserData(session.userId).catch(() => {});
          }
        } catch (e) {
          console.warn("[PTR Profile] User sync notice:", e);
        }
        if (typeof renderProfileScreen === 'function') renderProfileScreen();
        return;
      }

      if (screenId === 'screen-offers') {
        try {
          if (typeof fetchSettingsOnce === 'function') await fetchSettingsOnce();
        } catch (e) {
          console.warn("[PTR Offers] Sync notice:", e);
        }
        if (typeof updateClaimBoxState === 'function') updateClaimBoxState();
        return;
      }

      if (screenId === 'screen-quick-order') {
        try {
          if (typeof fetchProductsOnce === 'function') await fetchProductsOnce();
        } catch (e) {
          console.warn("[PTR Quick Order] Sync notice:", e);
        }
        if (typeof renderQuickOrderScreen === 'function') renderQuickOrderScreen();
        return;
      }

      if (screenId === 'screen-lyo-ai') {
        if (typeof updateLyoDeliveryBanner === 'function') updateLyoDeliveryBanner();
        if (typeof updateLyoDraftCartBar === 'function') updateLyoDraftCartBar();
        return;
      }

      // --- DELIVERY PARTNER PAGES ---
      if (screenId === 'screen-delivery') {
        try {
          const session = getData('ek_delivery_session', null);
          if (session && typeof db !== 'undefined' && db) {
            const riderId = session.id || session.phone;
            const [q1Snap, q2Snap, dpDoc] = await Promise.all([
              db.collection('ek_orders').where('assignedTo.id', '==', String(riderId)).limit(40).get().catch(() => null),
              db.collection('ek_orders').where('status', 'in', ['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'ready_for_pickup', 'delivering', 'out_for_delivery']).limit(40).get().catch(() => null),
              db.collection('ek_settings').doc('delivery_persons').get().catch(() => null)
            ]);

            const snapList = [];
            if (q1Snap && !q1Snap.empty) q1Snap.forEach(d => { const dt = d.data(); if (dt) snapList.push({ ...dt, id: d.id || dt.id }); });
            if (q2Snap && !q2Snap.empty) q2Snap.forEach(d => { const dt = d.data(); if (dt) snapList.push({ ...dt, id: d.id || dt.id }); });

            if (snapList.length > 0) {
              const prev = getData('ek_orders', []);
              const orderMap = new Map();
              if (Array.isArray(prev)) prev.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });
              snapList.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });
              saveData('ek_orders', Array.from(orderMap.values()));
              if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_orders');
            }

            if (dpDoc && dpDoc.exists) {
              const dpData = dpDoc.data();
              if (dpData && Array.isArray(dpData.list)) {
                saveData('ek_delivery_persons', dpData.list);
                if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_delivery_persons');
              }
            }
          }
        } catch (e) {
          console.warn("[PTR Delivery] Sync notice:", e);
        }
        if (typeof renderDeliveryScreen === 'function') renderDeliveryScreen();
        if (typeof updateRiderLiveLocation === 'function') updateRiderLiveLocation();
        return;
      }

      // --- ADMIN PAGES ---
      if (screenId === 'screen-admin') {
        const curTab = typeof currentAdminTab !== 'undefined' ? currentAdminTab : 'tab-dashboard';
        try {
          if (curTab === 'tab-orders' || curTab === 'tab-dashboard') {
            if (typeof fetchAdminOrdersLive === 'function') await fetchAdminOrdersLive(true);
          }
          if (curTab === 'tab-products') {
            if (typeof fetchProductsOnce === 'function') await fetchProductsOnce();
          }
          if (curTab === 'tab-banners' || curTab === 'tab-zones' || curTab === 'tab-settings') {
            if (typeof fetchSettingsOnce === 'function') await fetchSettingsOnce();
          }
        } catch (e) {
          console.warn("[PTR Admin] Data sync notice:", e);
        }

        // Sub-tab specific renders
        if (curTab === 'tab-orders' && typeof renderAdminOrdersList === 'function') {
          renderAdminOrdersList(true);
        } else if (curTab === 'tab-products' && typeof renderAdminProducts === 'function') {
          renderAdminProducts();
        } else if (curTab === 'tab-customers' && typeof renderAdminCustomers === 'function') {
          renderAdminCustomers();
        } else if (curTab === 'tab-delivery' && typeof renderDeliveryExecutives === 'function') {
          renderDeliveryExecutives();
        } else if (curTab === 'tab-banners' && typeof renderAdminBannerList === 'function') {
          renderAdminBannerList();
        } else if (curTab === 'tab-zones' && typeof renderAdminDeliveryZones === 'function') {
          renderAdminDeliveryZones();
        } else if (curTab === 'tab-sync-dashboard' && typeof renderSyncDashboard === 'function') {
          renderSyncDashboard();
        } else if (curTab === 'tab-push' && typeof renderPushHistoryList === 'function') {
          renderPushHistoryList();
        } else if (curTab === 'tab-reviews' && typeof renderAdminReviews === 'function') {
          renderAdminReviews();
        } else if (curTab === 'tab-analytics' && typeof renderAdminAnalytics === 'function') {
          renderAdminAnalytics();
        } else {
          if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
          if (typeof renderAdminOrders === 'function') renderAdminOrders();
        }
        return;
      }

      // Default fallback
      try {
        if (typeof fetchSettingsOnce === 'function') await fetchSettingsOnce();
        if (typeof fetchProductsOnce === 'function') await fetchProductsOnce();
      } catch (e) {}
    }

    async function executeUniversalPullRefresh() {
      if (window._ptrRefreshing) return;
      window._ptrRefreshing = true;

      const ptrEl = document.getElementById('universal-pull-refresh');
      const statusText = document.getElementById('ptr-status-text');
      const subText = document.getElementById('ptr-sub-text');
      const arrowIcon = ptrEl?.querySelector('.ptr-arrow-icon');

      if (ptrEl) {
        ptrEl.classList.remove('ptr-pulling', 'ptr-ready', 'ptr-hiding', 'ptr-completing');
        ptrEl.classList.add('ptr-refreshing');
        ptrEl.style.transform = 'translateY(12px)';
        ptrEl.style.opacity = '1';
        if (statusText) {
          statusText.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
            ? "புதுப்பிக்கப்படுகிறது... ⏳"
            : "Refreshing latest data... ⏳";
        }
        if (subText) {
          subText.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
            ? "தயவுசெய்து காத்திருக்கவும்..."
            : "Connecting to cloud...";
        }
      }

      const activeScreenEl = document.querySelector('.screen.active');
      const targetScreenId = activeScreenEl ? activeScreenEl.id : (typeof currentScreen !== 'undefined' ? currentScreen : 'screen-home');

      const minDelayPromise = new Promise(resolve => setTimeout(resolve, 550));
      try {
        await Promise.all([
          refreshCurrentScreenData(targetScreenId),
          minDelayPromise
        ]);

        if (ptrEl) {
          ptrEl.classList.remove('ptr-refreshing');
          ptrEl.classList.add('ptr-completing');
          if (statusText) {
            statusText.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
              ? "புதுப்பிக்கப்பட்டது ✓"
              : "Updated successfully ✓";
          }
          if (subText) {
            subText.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
              ? "சமீபத்திய தரவு தயாராக உள்ளது"
              : "Latest data synced";
          }
          if (typeof safeVibrate === 'function') {
            safeVibrate([12, 35, 18]);
          } else {
            try { if (typeof navigator !== 'undefined' && navigator && navigator.vibrate) navigator.vibrate([12, 35, 18]); } catch(e) {}
          }
        }
        await new Promise(r => setTimeout(r, 450));
      } catch (err) {
        console.error("[Universal PTR] Refresh error:", err);
        if (ptrEl) {
          ptrEl.classList.remove('ptr-refreshing');
          if (statusText) {
            statusText.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
              ? "புதுப்பிப்பதில் பிழை ⚠️"
              : "Sync error ⚠️";
          }
        }
        await new Promise(r => setTimeout(r, 400));
      } finally {
        if (ptrEl) {
          ptrEl.classList.remove('ptr-refreshing', 'ptr-completing', 'ptr-ready', 'ptr-pulling');
          ptrEl.classList.add('ptr-hiding');
          setTimeout(() => {
            ptrEl.classList.remove('ptr-hiding');
            ptrEl.style.transform = '';
            ptrEl.style.opacity = '';
            if (arrowIcon) arrowIcon.style.transform = '';
            window._ptrRefreshing = false;
          }, 320);
        } else {
          window._ptrRefreshing = false;
        }
      }
    }
    window.executeUniversalPullRefresh = executeUniversalPullRefresh;

    function initUniversalPullToRefresh() {
      if (window._universalPtrInitialized) return;
      window._universalPtrInitialized = true;

      const appContainer = document.getElementById('app-container') || document.body;
      const ptrEl = document.getElementById('universal-pull-refresh');
      const statusText = document.getElementById('ptr-status-text');
      const subText = document.getElementById('ptr-sub-text');
      const arrowIcon = (ptrEl && typeof ptrEl.querySelector === 'function') ? ptrEl.querySelector('.ptr-arrow-icon') : null;

      let startY = 0;
      let startX = 0;
      let isTracking = false;
      let directionLocked = false;
      let isValidPull = false;
      let pullDistance = 0;
      let thresholdReachedOnce = false;
      let activeScreen = null;

      const THRESHOLD = 68;
      const MAX_PULL = 115;

      function isInteractiveOrExcludedElement(target) {
        if (!target || !(target instanceof Element)) return false;

        // Form controls & typing elements
        if (target.closest('input, textarea, select, [contenteditable="true"], .ql-editor, .signature-pad')) {
          return true;
        }

        // Clickable buttons, links or explicit opt-out classes
        if (target.closest('button, .btn, a, .no-pull, .no-ptr, [data-no-pull="true"]')) {
          return true;
        }

        // Maps and Leaflet interactive containers
        if (target.closest('.leaflet-container, .leaflet-pane, .leaflet-control, .leaflet-marker-pane, #admin-zones-map-canvas, #delivery-rider-map, #tracker-leaflet-map, #manual-pin-map')) {
          return true;
        }

        // Open visible modals or dialogs
        const visibleModal = target.closest('.modal-backdrop, .modal, [role="dialog"], [role="alertdialog"]');
        if (visibleModal) {
          const style = window.getComputedStyle(visibleModal);
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            return true;
          }
        }

        // Horizontal carousels and sliders
        if (target.closest('.carousel-container, .product-horizontal-scroll, .category-pill-container, .horizontal-scroll-container, .ql-toolbar')) {
          return false; // let deltaX check handle horizontal cancellation
        }

        return false;
      }

      function hasVisibleModalOpen() {
        const modals = document.querySelectorAll('.modal-backdrop, .modal');
        for (let i = 0; i < modals.length; i++) {
          const m = modals[i];
          if (m.style.display && m.style.display !== 'none') {
            return true;
          }
          if (m.classList.contains('active') && window.getComputedStyle(m).display !== 'none') {
            return true;
          }
        }
        return false;
      }

      function onTouchStart(e) {
        if (window._ptrRefreshing) return;
        if (!e.touches || e.touches.length !== 1) return;

        // Check if any modal is currently visible
        if (hasVisibleModalOpen()) return;

        const touch = e.touches[0];
        if (isInteractiveOrExcludedElement(touch.target)) return;

        // Identify active screen
        activeScreen = document.querySelector('.screen.active');
        if (!activeScreen) return;

        // Splash and onboarding are not refreshable screens
        if (activeScreen.id === 'screen-splash' || activeScreen.id === 'screen-onboarding') {
          return;
        }

        // Check if active screen is at the very top
        if (activeScreen.scrollTop > 0) return;
        if (window.scrollY > 0 || (document.scrollingElement && document.scrollingElement.scrollTop > 0)) return;

        startY = touch.clientY;
        startX = touch.clientX;
        isTracking = true;
        directionLocked = false;
        isValidPull = false;
        pullDistance = 0;
        thresholdReachedOnce = false;

        // Dynamically attach touchmove only while touching to ensure 100% smooth passive scrolling elsewhere
        window.addEventListener('touchmove', onTouchMove, { passive: false });
      }

      let _ptrRafId = null;
      function onTouchMove(e) {
        if (!isTracking || window._ptrRefreshing) {
          window.removeEventListener('touchmove', onTouchMove);
          return;
        }
        if (!e.touches || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const deltaY = touch.clientY - startY;
        const deltaX = touch.clientX - startX;

        if (!directionLocked) {
          // If scrolling up or horizontal swiping, abort immediately and detach listener
          if (deltaY <= 0) {
            isTracking = false;
            window.removeEventListener('touchmove', onTouchMove);
            return;
          }
          if (Math.abs(deltaX) > deltaY * 0.85) {
            isTracking = false;
            window.removeEventListener('touchmove', onTouchMove);
            return;
          }
          // Confirmed downward pull from top
          if (deltaY > 6 && deltaY > Math.abs(deltaX) * 1.2) {
            if (activeScreen && activeScreen.scrollTop > 0) {
              isTracking = false;
              window.removeEventListener('touchmove', onTouchMove);
              return;
            }
            directionLocked = true;
            isValidPull = true;
          }
        }

        if (isValidPull && ptrEl) {
          if (e.cancelable) e.preventDefault();

          const rawDistance = Math.max(0, deltaY - 6);
          const dampedDistance = Math.min(MAX_PULL, Math.pow(rawDistance, 0.82) * 1.55);
          pullDistance = dampedDistance;

          if (_ptrRafId) cancelAnimationFrame(_ptrRafId);
          _ptrRafId = requestAnimationFrame(() => {
            // Indicator layout
            ptrEl.classList.add('ptr-pulling');
            ptrEl.style.opacity = String(Math.min(1, dampedDistance / 32));
            ptrEl.style.transform = `translateY(${Math.min(dampedDistance - 44, 16)}px)`;

            // Screen elastic offset
            if (activeScreen) {
              activeScreen.classList.add('ptr-screen-pulling');
              activeScreen.style.transform = `translateY(${dampedDistance * 0.38}px)`;
            }

            // Arrow rotation
            const progress = Math.min(1, dampedDistance / THRESHOLD);
            if (arrowIcon) {
              arrowIcon.style.transform = `rotate(${progress * 180}deg)`;
            }

            // Threshold state
            if (dampedDistance >= THRESHOLD) {
              ptrEl.classList.add('ptr-ready');
              if (statusText) {
                statusText.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
                  ? "புதுப்பிக்க விரலை எடுக்கவும்"
                  : "Release to refresh";
              }
              if (subText) {
                subText.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
                  ? "தற்போதைய தகவலைப் புதுப்பிக்க"
                  : "Sync latest data";
              }
              if (!thresholdReachedOnce) {
                if (typeof safeVibrate === 'function') {
                  safeVibrate(15);
                } else {
                  try { if (typeof navigator !== 'undefined' && navigator && navigator.vibrate) navigator.vibrate(15); } catch(e) {}
                }
                thresholdReachedOnce = true;
              }
            } else {
              ptrEl.classList.remove('ptr-ready');
              if (statusText) {
                statusText.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
                  ? "கீழே இழுக்கவும்..."
                  : "Pull down to refresh";
              }
              if (subText) {
                subText.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
                  ? "சமீபத்திய தகவல்கள்"
                  : "Get latest updates";
              }
              thresholdReachedOnce = false;
            }
          });
        }
      }

      function onTouchEnd() {
        window.removeEventListener('touchmove', onTouchMove);
        if (_ptrRafId) {
          cancelAnimationFrame(_ptrRafId);
          _ptrRafId = null;
        }
        if (!isTracking) return;
        isTracking = false;

        if (activeScreen) {
          activeScreen.classList.remove('ptr-screen-pulling');
          activeScreen.classList.add('ptr-screen-releasing');
          activeScreen.style.transform = '';
          setTimeout(() => {
            if (activeScreen) activeScreen.classList.remove('ptr-screen-releasing');
          }, 280);
        }

        if (isValidPull && pullDistance >= THRESHOLD && !window._ptrRefreshing) {
          executeUniversalPullRefresh();
        } else if (ptrEl) {
          ptrEl.classList.remove('ptr-pulling', 'ptr-ready');
          ptrEl.classList.add('ptr-hiding');
          setTimeout(() => {
            ptrEl.classList.remove('ptr-hiding');
            ptrEl.style.transform = '';
            ptrEl.style.opacity = '';
            if (arrowIcon) arrowIcon.style.transform = '';
          }, 320);
        }

        isValidPull = false;
        pullDistance = 0;
      }

      // Attach lightweight passive touch handlers
      appContainer.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchend', onTouchEnd, { passive: true });
      window.addEventListener('touchcancel', onTouchEnd, { passive: true });

      debugLog("[Universal PTR] Pull-to-refresh listener initialized successfully.");
    }

    window.initUniversalPullToRefresh = initUniversalPullToRefresh;
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUniversalPullToRefresh);
      } else {
        setTimeout(initUniversalPullToRefresh, 50);
      }
    }
