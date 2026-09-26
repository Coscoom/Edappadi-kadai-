
    function selectDeliveryTimeSlot(slot, element) {
      selectedDeliverySlot = slot;
      document.querySelectorAll('.slot-btns').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
      if (element) {
        element.classList.add('active');
        element.setAttribute('aria-pressed', 'true');
      }
      recalculateBill();
    }

    function selectPaymentMethod(method, element) {
      selectedPaymentMethod = method;
      document.querySelectorAll('.pay-btns').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
      if (element) {
        element.classList.add('active');
        element.setAttribute('aria-pressed', 'true');
      }
      recalculateBill();
    }

    async function autoDetectCoordinatesForTarget(targetId, btn) {
      const origText = btn ? btn.innerHTML : '';
      if (btn) {
        btn.innerHTML = currentLang === 'ta' ? "🛰️ ஜிபிஎஸ் தேடுகிறது..." : "🛰️ GPS Locating...";
        btn.disabled = true;
      }
      showToast(currentLang === 'ta' ? "🔒 ஜிபிஎஸ் செயற்கைக்கோள் இணைக்கப்படுகிறது..." : "🔒 Connecting to high-accuracy GPS satellites...", "info");

      let lat = 11.5815;
      let lng = 77.8488;
      let accuracy = 15;
      let gotLocation = false;

      if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getNativeLocation === 'function') {
        const res = AndroidStorage.getNativeLocation();
        if (res && res !== "PERMISSION_REQUIRED" && res !== "SECURITY_ERROR" && res !== "NO_LOCATION" && !res.startsWith("ERROR") && res !== "NO_LOCATION_SERVICE") {
          try {
            const loc = JSON.parse(res);
            lat = parseFloat(loc.latitude);
            lng = parseFloat(loc.longitude);
            accuracy = parseFloat(loc.accuracy || 15);
            gotLocation = true;
          } catch(e) {
            console.warn("Native location parse error:", e);
          }
        } else if (res === "PERMISSION_REQUIRED") {
          showToast(currentLang === 'ta' ? "இருப்பிட அனுமதி தேவை! அனுமதி வழங்கப்பட்டதும் மீண்டும் முயற்சிக்கவும்." : "Location permission is required! Please grant permission and retry.", "warning");
          if (btn) {
            btn.innerHTML = origText;
            btn.disabled = false;
          }
          return;
        }
      }

      if (!gotLocation && navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
          accuracy = position.coords.accuracy;
          gotLocation = true;
        } catch (err) {
          console.warn("Browser GPS locate failed:", err);
        }
      }

      if (!gotLocation) {
        showToast(currentLang === 'ta' ? "ஜிபிஎஸ் சிக்னல் கிடைக்கவில்லை! ❌" : "GPS signal lost or permission denied! ❌", "error");
        if (btn) {
          btn.innerHTML = origText;
          btn.disabled = false;
        }
        return;
      }

      const inputEl = document.getElementById(targetId);
      if (inputEl) {
        inputEl.setAttribute('data-lat', lat);
        inputEl.setAttribute('data-lng', lng);

        const initialAddrFallback = "Selected Delivery Location, Edappadi, Salem, Tamil Nadu";
        inputEl.value = initialAddrFallback;
        if (targetId !== 'reg-address' && targetId !== 'editor-map-dummy-target' && typeof syncPrimaryUserAddress === 'function') {
          syncPrimaryUserAddress(initialAddrFallback, lat, lng);
        }

        showToast(currentLang === 'ta' ? "🔄 முகவரி கண்டறியப்படுகிறது..." : "🔄 Reverse geocoding accurate address...", "info");

        try {
          const res = await reverseGeocodeWithRetry(lat, lng);
          const finalAddr = (res && res.displayName) ? res.displayName : initialAddrFallback;
          inputEl.value = finalAddr;
          if (targetId !== 'reg-address' && targetId !== 'editor-map-dummy-target' && typeof syncPrimaryUserAddress === 'function') {
            syncPrimaryUserAddress(finalAddr, lat, lng);
          }

          if (targetId === 'reg-address') {
            const regStreet = document.getElementById('reg-addr-street');
            const regArea = document.getElementById('reg-addr-area');
            const regCity = document.getElementById('reg-addr-city');
            const regPincode = document.getElementById('reg-addr-pincode');
            if (typeof parseAddressStringToFields === 'function') {
              const parsed = parseAddressStringToFields(finalAddr);
              if (parsed.street && regStreet) regStreet.value = parsed.street;
              if (parsed.area && regArea) regArea.value = parsed.area;
              if (parsed.city && regCity) regCity.value = parsed.city;
              if (parsed.pincode && regPincode) regPincode.value = parsed.pincode;
            }
            if (typeof updateCombinedRegAddress === 'function') {
              updateCombinedRegAddress();
            }
          }
        } catch (err) {
          console.warn("Geocoding failed completely, using fallback:", err);
        }

        inputEl.style.transition = 'all 0.3s ease';
        inputEl.style.borderColor = '#10b981';
        inputEl.style.background = 'rgba(16,185,129,0.04)';
        setTimeout(() => {
          inputEl.style.borderColor = '';
          inputEl.style.background = '';
        }, 1200);
      }

      if (btn) {
        btn.innerHTML = origText;
        btn.disabled = false;
      }

      const successMsg = currentLang === 'ta'
        ? `🛰️ ஜிபிஎஸ் இருப்பிடம் வெற்றிகரமாக பெறப்பட்டது! (துல்லியம்: ±${Math.round(accuracy)}m)`
        : `🛰️ GPS location updated! (Accuracy: ±${Math.round(accuracy)}m)`;
      showToast(successMsg, "success");

      if (targetId === 'cart-delivery-address') {
        recalculateBill();
      }
    }

    async function placeOrder() {
      const btn = (typeof event !== 'undefined' && event && event.target) ? event.target.closest('button, .btn, .btn-cart-primary') : document.querySelector('.btn-cart-primary, button[onclick*="placeOrder"]');
      if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, true);
      try {
        const custSession = typeof getActiveSession === 'function' ? getActiveSession() : null;
        if (!custSession || !custSession.loggedIn) {
          showToast(
            typeof currentLang !== 'undefined' && currentLang === 'ta'
              ? "ஆர்டர் செய்ய முதலில் லாகின் அல்லது பதிவு செய்து கொள்ளவும்!"
              : "Please login or register to place your order!",
            "warning"
          );
          if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
          showScreen('screen-login');
          return;
        }

        const settings = getSettings();
        if (settings.leaveMode) {
          showCustomAlert(
            currentLang === 'ta' ? "🌴 விடுமுறை அறிவிப்பு" : "🌴 Holiday / Leave Notice",
            settings.leaveNotice || (currentLang === 'ta' ? "மன்னிக்கவும்! கடை தற்காலிகமாக விடுமுறையில் உள்ளது. ஆர்டர் செய்ய இயலாது." : "Sorry, the shop is currently closed on holiday. Ordering is temporarily paused.")
          );
          if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
          return;
        }
        if (window.isPlacingOrder || window.isConfirmingOrder) {
          showToast(currentLang === 'ta' ? "மன்னிக்கவும்! ஒரு ஆர்டர் ஏற்கனவே செயலாக்கத்தில் உள்ளது." : "Please wait! Your order is already being processed.", "warning");
          if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
          return;
        }
        if (cart.length === 0) {
          showToast("மன்னிக்கவும்! உங்கள் கார்ட் காலியாக உள்ளது. (Your checkout cart is completely empty!)", "error");
          if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
          return;
        }

        const user = await getAuthenticatedCustomerUser();
        if (!user) {
          if (typeof firebase !== 'undefined' && firebase.auth) {
            const authUser = firebase.auth().currentUser;
            const reason = !authUser ? "Firebase currentUser is null" : (authUser.isAnonymous ? "Firebase currentUser is anonymous guest" : "No registered user record found");
            console.warn("[Diagnostic] Authentication unavailable: " + reason);
          } else {
            console.error("[Diagnostic] Authentication unavailable: Firebase SDK is not loaded.");
          }
          showToast(
            currentLang === 'ta'
              ? "ஆர்டர் செய்ய முதலில் லாகின் அல்லது பதிவு செய்து கொள்ளவும்! (Please log in or register first!)"
              : "Login Required\nPlease log in before placing an order.",
            "error"
          );
          if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
          showScreen('screen-login');
          return;
        }

        const weatherBrief = document.getElementById('briefing-weather-temp')?.innerText || "34°C - Partly Cloudy";
        const trafficBrief = document.getElementById('briefing-traffic-status')?.innerText || "Green / Low Congestion";

        actualPlaceOrder();
      } catch (err) {
        window.isConfirmingOrder = false;
        console.error("Critical error in placeOrder:", err);
        showToast(currentLang === 'ta' ? "ஆர்டர் முயற்சியில் பிழை ஏற்பட்டது: " + err.message : "Error during order placement: " + err.message, "error");
        if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
      }
    }

    function generateUniqueOrderId() {
      const now = new Date();
      const yy = now.getFullYear().toString().slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');

      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let randomStr = '';
      for (let i = 0; i < 5; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `EK-${yy}${mm}${dd}-${randomStr}`;
    }

    function removePendingSync(collectionName, docId) {
      const queue = getData('ek_pending_syncs', []);
      const filtered = queue.filter(item => !(item.collectionName === collectionName && item.docId === docId));
      if (queue.length !== filtered.length) {
        saveData('ek_pending_syncs', filtered);
        debugLog(`[Queue Sync] Removed pending sync entry for ${collectionName}/${docId}`);
      }
    }

    function showCustomerSyncWarningBanner(msg, phone) {
      const banner = document.getElementById('persistent-customer-sync-banner');
      if (!banner) return;
      const settings = typeof getSettings === 'function' ? getSettings() : {};
      const shopPhone = phone || settings.shopPhone || settings.merchantPhone || settings.phone || "8778148899";
      const displayMsg = msg || (typeof currentLang !== 'undefined' && currentLang === 'ta'
        ? `உங்கள் ஆர்டர் சேமிக்கப்பட்டது, ஆனால் கடை இன்னும் உறுதி செய்யவில்லை — தயவுசெய்து எங்களை நேரடியாக தொடர்புகொள்ளவும்: ${shopPhone}`
        : `Your order is saved but not yet confirmed by the shop — please contact us directly to confirm (${shopPhone})`);

      const textEl = document.getElementById('persistent-customer-sync-text');
      const callBtn = document.getElementById('persistent-customer-sync-call');
      if (textEl) textEl.innerText = displayMsg;
      if (callBtn) {
        callBtn.href = `tel:${shopPhone}`;
        callBtn.innerText = `📞 Call (${shopPhone})`;
      }
      banner.style.display = 'flex';
    }

    function hideCustomerSyncWarningBanner() {
      const banner = document.getElementById('persistent-customer-sync-banner');
      if (banner) banner.style.display = 'none';
    }

    function handleStuckOrderSyncFailure(item, durationMs, err) {
      const settings = typeof getSettings === 'function' ? getSettings() : {};
      const shopPhone = settings.shopPhone || settings.merchantPhone || settings.phone || "8778148899";

      // 1. Show persistent banner & toast to customer
      showCustomerSyncWarningBanner(null, shopPhone);

      if (typeof showToast === 'function') {
        const toastMsg = typeof currentLang !== 'undefined' && currentLang === 'ta'
          ? `உங்கள் ஆர்டர் சேமிக்கப்பட்டது, ஆனால் கடை இன்னும் உறுதி செய்யவில்லை — தொடர்புகொள்ளவும்: ${shopPhone}`
          : `Your order is saved but not yet confirmed by the shop — please contact us directly to confirm: ${shopPhone}`;
        showToast(toastMsg, 'warning');
      }

      // 2. Log stuck order condition to dedicated Firestore collection ek_sync_alerts
      if (typeof db !== 'undefined' && db) {
        const alertDocId = `stuck_order_${item.docId}`;
        try {
          db.collection('ek_sync_alerts').doc(alertDocId).set({
            orderId: item.docId,
            firstFailedAt: item.firstFailedAt || item.timestamp,
            stuckDurationMs: durationMs,
            stuckMinutes: Math.round(durationMs / 60000),
            errorMessage: err ? (err.message || String(err)) : 'Permission or write failure',
            customerPhone: item.data?.customerPhone || item.data?.phone || '',
            customerName: item.data?.customerName || item.data?.name || '',
            shopPhone: shopPhone,
            loggedAt: new Date().toISOString(),
            status: 'unresolved'
          }, { merge: true }).catch(alertErr => {
            console.warn('[Sync Alert] Failed to log stuck order to ek_sync_alerts:', alertErr);
          });
        } catch (e) {
          console.warn('[Sync Alert] Exception logging alert:', e);
        }
      }

      // 3. Trigger native notification/SMS via AndroidStorage if available
      if (typeof AndroidStorage !== 'undefined') {
        const alertMsg = `ALERT: Order ${item.docId} stuck in sync queue for >3 min. Call shop: ${shopPhone}`;
        if (typeof AndroidStorage.showNativeNotification === 'function') {
          try { AndroidStorage.showNativeNotification("⚠️ Order Sync Warning", alertMsg); } catch(e){}
        } else if (typeof AndroidStorage.simulateFcmPushNotification === 'function') {
          try { AndroidStorage.simulateFcmPushNotification("⚠️ Order Sync Warning", alertMsg); } catch(e){}
        }
        if (typeof AndroidStorage.sendSMS === 'function') {
          try { AndroidStorage.sendSMS(shopPhone, alertMsg); } catch(e){}
        }
      }
    }

    async function checkAdminSyncHealth() {
      const banner = document.getElementById('admin-sync-health-banner');
      if (!banner) return;

      const queue = typeof getData === 'function' ? getData('ek_pending_syncs', []) : [];
      const now = Date.now();
      const stuckOrders = queue.filter(item => item.collectionName === 'ek_orders' && (now - (item.firstFailedAt || item.timestamp || now)) > 180000);

      let isHealthy = true;
      let failureReason = '';

      if (typeof db !== 'undefined' && db && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser && !firebase.auth().currentUser.isAnonymous) {
        try {
          const healthRef = db.collection('ek_orders').doc('_health_check');
          await healthRef.set({
            lastTestedAt: new Date().toISOString(),
            testedBy: firebase.auth().currentUser.uid,
            status: 'ok'
          }, { merge: true });
        } catch (probeErr) {
          console.warn('[Admin Sync Health] Write access test to ek_orders failed:', probeErr);
          isHealthy = false;
          failureReason = probeErr.message || String(probeErr);
        }
      }

      if (stuckOrders.length > 0) {
        isHealthy = false;
        if (!failureReason) {
          failureReason = `${stuckOrders.length} order(s) stuck in sync queue for over 3 minutes.`;
        }
      }

      if (!isHealthy) {
        banner.style.display = 'block';
        banner.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <span style="font-size: 20px; flex-shrink: 0;">🚨</span>
            <div style="flex: 1; min-width: 0;">
              <strong style="font-size: 13.5px; color: #ffffff; display: block; margin-bottom: 3px;">
                SYNC HEALTH WARNING: Firestore Order Writes Failing!
              </strong>
              <span style="font-size: 12px; color: rgba(255,255,255,0.92); line-height: 1.4; display: block; word-break: break-word;">
                Write access to <code>ek_orders</code> is failing (${failureReason}). 
                Customer orders are remaining pending on customer devices. Please verify Firestore Security Rules or database permissions.
              </span>
            </div>
            <button onclick="checkAdminSyncHealth()" style="background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.5); color: #ffffff; padding: 6px 12px; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; flex-shrink: 0; white-space: nowrap;">
              🔄 Re-test
            </button>
          </div>
        `;
        const badgeEl = document.getElementById('cloud-status-badge-admin');
        if (badgeEl) {
          badgeEl.style.backgroundColor = '#ef4444';
          badgeEl.title = 'SYNC FAILURE: Order writes to Firestore are failing!';
        }
      } else {
        banner.style.display = 'none';
        const badgeEl = document.getElementById('cloud-status-badge-admin');
        if (badgeEl && navigator.onLine) {
          badgeEl.style.backgroundColor = '#10b981';
          badgeEl.title = 'Cloud Sync & Order Writes Healthy ✓';
        }
      }
    }

    function queueFailedSync(collectionName, docId, action, data) {
      debugLog(`[Queue Sync] Queueing failed online write: ${collectionName}/${docId} (${action})`);
      const queue = getData('ek_pending_syncs', []);
      const existingIdx = queue.findIndex(item => item.collectionName === collectionName && item.docId === docId);
      const now = Date.now();
      const firstFailedAt = (existingIdx !== -1 && (queue[existingIdx].firstFailedAt || queue[existingIdx].timestamp))
        ? (queue[existingIdx].firstFailedAt || queue[existingIdx].timestamp)
        : now;
      const queueEntry = {
        collectionName,
        docId,
        action,
        data,
        timestamp: now,
        firstFailedAt: firstFailedAt
      };
      if (existingIdx !== -1) {
        queue[existingIdx] = queueEntry;
      } else {
        queue.push(queueEntry);
      }
      saveData('ek_pending_syncs', queue);
    }

    async function processPendingSyncQueue() {
      if (!db || !navigator.onLine) return;
      const queue = getData('ek_pending_syncs', []);
      if (queue.length === 0) return;

      debugLog(`[Queue Sync] Processing ${queue.length} pending writes in queue...`);
      const remainingQueue = [];
      const now = Date.now();

      for (const item of queue) {
        if (!item.firstFailedAt) {
          item.firstFailedAt = item.timestamp || now;
        }

        try {
          const docRef = db.collection(item.collectionName).doc(item.docId);
          const sanitizedData = cleanFirestoreData(item.data);

          if (item.action === 'set') {
            // Only perform conflict checks for non-order collections
            if (['ek_products', 'products', 'ek_users', 'users', 'ek_delivery_persons'].includes(item.collectionName)) {
              try {
                const cloudDoc = await docRef.get();
                if (cloudDoc.exists) {
                  const cloudData = cloudDoc.data();
                  const cloudTime = cloudData && cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
                  const localTime = sanitizedData && sanitizedData.updatedAt ? new Date(sanitizedData.updatedAt).getTime() : 0;
                  if (cloudTime > localTime) {
                    debugLog(`[Queue Sync] Stale update bypassed for ${item.collectionName}/${item.docId} to protect newer cloud data (${cloudTime} > ${localTime})`);
                    continue; // Skip writing this item but let it clear from the queue
                  }
                }
              } catch (getErr) {
                console.warn(`[Queue Sync] Cloud get conflict check failed, proceeding to direct write for ${item.collectionName}/${item.docId}:`, getErr);
              }
            }

            if (item.collectionName === 'ek_orders') {
              await docRef.set(sanitizedData, { merge: true });
            } else {
              await docRef.set(sanitizedData, { merge: true });
            }
          } else if (item.action === 'update') {
            await docRef.update(sanitizedData);
          } else if (item.action === 'delete') {
            await docRef.delete();
          }
          debugLog(`[Queue Sync] Successfully synced pending ${item.collectionName}/${item.docId}`);
        } catch (err) {
          console.warn(`[Queue Sync] Failed to sync ${item.collectionName}/${item.docId}, keeping in queue:`, err);
          remainingQueue.push(item);

          if (item.collectionName === 'ek_orders') {
            const timeInQueue = now - item.firstFailedAt;
            if (timeInQueue > 180000) {
              handleStuckOrderSyncFailure(item, timeInQueue, err);
            }
          }
        }
      }

      saveData('ek_pending_syncs', remainingQueue);
      if (remainingQueue.length < queue.length) {
        triggerGlobalScreenRefresh();
      }

      const remainingStuckOrders = remainingQueue.filter(i => i.collectionName === 'ek_orders' && (now - (i.firstFailedAt || i.timestamp || now)) > 180000);
      if (remainingStuckOrders.length === 0) {
        hideCustomerSyncWarningBanner();
      }
    }

    window.addEventListener('online', () => {
      debugLog("[Network] Back online! Syncing pending queue. 📶");
      processPendingSyncQueue().then(() => syncWithCloud());
    });

    // Background interval to auto-retry pending writes every 15 seconds (with cleanup)
    if (window._pendingSyncInterval) clearInterval(window._pendingSyncInterval);
    window._pendingSyncInterval = setInterval(() => {
      if (document.hidden || window._isAppBackgrounded) return;
      if (navigator.onLine && db) {
        processPendingSyncQueue();
      }
    }, 15000);

    async function actualPlaceOrder() {
      const custSession = typeof getActiveSession === 'function' ? getActiveSession() : null;
      if (!custSession || !custSession.loggedIn) {
        showToast(
          typeof currentLang !== 'undefined' && currentLang === 'ta'
            ? "ஆர்டர் செய்ய முதலில் லாகின் அல்லது பதிவு செய்து கொள்ளவும்!"
            : "Please login or register to place your order!",
          "warning"
        );
        showScreen('screen-login');
        return;
      }

      if (window.isPlacingOrder) {
        console.warn("[Checkout Lock] An order is already being processed.");
        return;
      }
      window.isPlacingOrder = true;

      if (typeof AndroidStorage !== 'undefined') {
        try {
          if (!AndroidStorage.hasLocationPermission()) {
            debugLog("[Contextual Checkout] Location permission is missing during checkout. Triggering native prompt directly...");
            AndroidStorage.requestLocationPermission();
            showToast("ஆர்டர் செய்ய இருப்பிட அனுமதி தேவை. அனுமதித்த பின் மீண்டும் ஆர்டரை உறுதி செய்யவும்! (Location permission required for placing order. Please grant it and confirm order!)", "info");
            window.isPlacingOrder = false;
            return;
          }
        } catch (e) {
          console.error("Error with native location permission request:", e);
        }
      }

      try {
        const customerProfile = await getAuthenticatedCustomerUser();
        if (!customerProfile) {
          if (typeof firebase !== 'undefined' && firebase.auth) {
            const authUser = firebase.auth().currentUser;
            const reason = !authUser ? "Firebase currentUser is null" : (authUser.isAnonymous ? "Firebase currentUser is anonymous guest" : "No registered user record found");
            console.warn("[Diagnostic] Authentication unavailable: " + reason);
          } else {
            console.error("[Diagnostic] Authentication unavailable: Firebase SDK is not loaded.");
          }
          showToast("மன்னிக்கவும்! மீண்டும் உள்நுழைக வேண்டும். (Session expired, please login.)", "error");
          window.isPlacingOrder = false;
          showScreen('screen-login');
          return;
        }

        const custPhone = (customerProfile.phone || "").trim().replace(/\D/g, '');
        if (!custPhone || custPhone.length < 10) {
          showToast(
            currentLang === 'ta'
              ? "ஆர்டரை டெலிவரி செய்ய உங்கள் மொபைல் எண் தேவை (Mobile number required for delivery)"
              : "Mobile number required for delivery. Please update contact details.",
            "error"
          );
          window.isPlacingOrder = false;
          window._pendingOrderAfterContactSave = true;
          if (typeof openSimpleAddressEditor === 'function') {
            openSimpleAddressEditor();
          }
          return;
        }

        const addressTextarea = document.getElementById('cart-delivery-address');
      const address = addressTextarea ? addressTextarea.value.trim() : "";
      if (!address || address === 'Salem, Tamil Nadu') {
        showToast(
          currentLang === 'ta'
            ? "தயவுசெய்து முதலில் உங்கள் வீட்டு முகவரியை சேர்க்கவும் (Please add your delivery address first)"
            : "Please add your delivery address first",
          "error"
        );
        if (typeof openSimpleAddressEditor === 'function') {
          openSimpleAddressEditor();
        }
        window.isPlacingOrder = false;
        return;
      }

      const latAttr = addressTextarea ? (addressTextarea.getAttribute('data-lat') || (addressTextarea.dataset ? addressTextarea.dataset.lat : null)) : null;
      const lngAttr = addressTextarea ? (addressTextarea.getAttribute('data-lng') || (addressTextarea.dataset ? addressTextarea.dataset.lng : null)) : null;

      let finalLat = latAttr ? parseFloat(latAttr) : null;
      let finalLng = lngAttr ? parseFloat(lngAttr) : null;

      if (finalLat === null || isNaN(finalLat)) {
        finalLat = customerProfile.latitude ? parseFloat(customerProfile.latitude) : null;
      }
      if (finalLng === null || isNaN(finalLng)) {
        finalLng = customerProfile.longitude ? parseFloat(customerProfile.longitude) : null;
      }

      const isCod = selectedPaymentMethod && selectedPaymentMethod.toUpperCase() === 'COD';
      let needsManualLocationPin = false;

      const hasValidCoords = (finalLat !== null && !isNaN(finalLat) && finalLng !== null && !isNaN(finalLng));

      if (!hasValidCoords) {
        if (address && address.length > 5) {
          needsManualLocationPin = true;
          debugLog("[Checkout Geocode] Skipping blocking geocode delay, proceeding instantly with order placement.");
        } else {
          showToast(
            currentLang === 'ta'
              ? "முகவரி மிகவும் குறுகியதாக உள்ளது. முழு முகவரியை உள்ளிடவும்."
              : "Address is too short. Please enter a complete delivery address.",
            "error"
          );
          window.isPlacingOrder = false;
          return;
        }
      }

      // Re-verify all cart items against latest official product catalog
      const catalogProds = (typeof getData === 'function') ? getData('ek_products', []) : [];
      if (catalogProds.length > 0) {
        for (const cItem of cart) {
          const dbProd = catalogProds.find(p => p.id === cItem.productId);
          if (dbProd) {
            if (dbProd.isActive === false || dbProd.isDeleted === true) {
              const msg = (typeof currentLang !== 'undefined' && currentLang === 'ta')
                ? `மன்னிக்கவும்! '${cItem.tamilName || cItem.englishName}' பொருள் தற்போது விற்பனையில் இல்லை.`
                : `Sorry, '${cItem.englishName || cItem.name}' is no longer available.`;
              showToast(msg, "error");
              window.isPlacingOrder = false;
              return;
            }
            if (dbProd.isOutOfStock || (dbProd.stockKg !== undefined && dbProd.stockKg <= 0)) {
              const msg = (typeof currentLang !== 'undefined' && currentLang === 'ta')
                ? `மன்னிக்கவும்! '${cItem.tamilName || cItem.englishName}' கையிருப்பு தீர்ந்துவிட்டது (Out of Stock).`
                : `Sorry, '${cItem.englishName || cItem.name}' is out of stock.`;
              showToast(msg, "error");
              window.isPlacingOrder = false;
              return;
            }
            // Recalculate price using authorized catalog pricePerKg
            const latestPrice = Number(dbProd.pricePerKg || dbProd.sellingPrice || dbProd.price || cItem.pricePerKg);
            cItem.pricePerKg = latestPrice;
            const isWeight = isUnitWeight ? isUnitWeight(cItem.unit || dbProd.sellingUnit || 'kg') : true;
            cItem.totalPrice = isWeight
              ? Math.round((latestPrice / 1000) * (cItem.weightGrams || 500))
              : Math.round(latestPrice * (cItem.weightGrams || 1));
          }
        }
      }

      const subtotal = cart.reduce((acc, curr) => acc + curr.totalPrice, 0);
      const settings = getSettings();
      const minWeightGrams = parseFloat(settings.minOrderWeight || 50);
      const minOrderAmount = parseFloat(settings.minOrderAmount || 0);
      const basketTotalWeight = cart.reduce((acc, item) => acc + item.weightGrams, 0);

      if (basketTotalWeight < minWeightGrams) {
        showToast(`குறைந்தபட்ச ஆர்டர் எடை (${minWeightGrams}g) இல்லை! (Minimum order weight requirement is not met!)`, "error");
        window.isPlacingOrder = false;
        return;
      }
      if (subtotal < minOrderAmount) {
        showToast(`குறைந்தபட்ச ஆர்டர் தொகை (₹${minOrderAmount}) இல்லை! (Minimum order amount requirement is not met!)`, "error");
        window.isPlacingOrder = false;
        return;
      }

      const usePointsCheckbox = document.getElementById('cart-use-loyalty');
      const useLoyaltyPts = usePointsCheckbox && usePointsCheckbox.checked;

      const financials = calculateOrderFinancials(subtotal, customerProfile, appliedCouponCode, useLoyaltyPts, cart);
      const randomID = generateUniqueOrderId();

      const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      const orderUserId = user ? user.uid : (customerProfile ? customerProfile.id : 'offline_guest');

      const sanitizedLat = (finalLat === null || isNaN(finalLat)) ? null : parseFloat(finalLat);
      const sanitizedLng = (finalLng === null || isNaN(finalLng)) ? null : parseFloat(finalLng);

      let loyaltyMultiplier = 1.0;
      if (customerProfile.tier === 'silver') {
        loyaltyMultiplier = 1.5;
      } else if (customerProfile.tier === 'gold') {
        loyaltyMultiplier = 2.0;
      }
      const pointsEarned = Math.floor((financials.grandTotal / 100) * 10 * loyaltyMultiplier);

      // Derive primary order category from cart items
      const cartCategories = [...new Set(cart.map(it => (it.category || '').toLowerCase().trim()).filter(Boolean))];
      const primaryCategory = cartCategories.length === 1 ? cartCategories[0] : (cartCategories.length > 1 ? cartCategories.join(', ') : 'meat');

      const order = {
        id: randomID,
        userId: orderUserId,
        customerId: orderUserId,
        customerName: customerProfile.name || "Customer / வாடிக்கையாளர்",
        customerPhone: customerProfile.phone || (user ? user.phoneNumber : "") || "",
        customerFcmToken: customerProfile.fcmToken || customerProfile.realFcmToken || (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getFcmToken === 'function' ? AndroidStorage.getFcmToken() : ''),
        deliveryAddress: address,
        deliveryLatitude: sanitizedLat,
        deliveryLongitude: sanitizedLng,
        needsManualLocationPin: needsManualLocationPin,
        deliveryTimeSlot: selectedDeliverySlot,
        paymentMethod: selectedPaymentMethod === 'COD' ? 'Cash on Delivery (COD)' : selectedPaymentMethod,
        paymentStatus: selectedPaymentMethod === 'COD' ? 'UNPAID' : 'PENDING',
        needsPaymentVerification: false,
        category: primaryCategory,
        orderCategory: primaryCategory,
        orderStage: 'Received',
        orderInstructions: '',
        items: [...cart],
        subtotalAmount: financials.subtotal,
        deliveryFee: financials.deliveryFee,
        deliveryCharge: financials.deliveryFee,
        deliveryDistanceKm: (() => {
          try {
            const sLat = parseFloat((typeof getData === 'function' ? (getData('ek_settings', {}) || {}).storeLat : null) || 11.5815);
            const sLng = parseFloat((typeof getData === 'function' ? (getData('ek_settings', {}) || {}).storeLng : null) || 77.8488);
            const cLat = sanitizedLat;
            const cLng = sanitizedLng;
            if (cLat === null || cLng === null || isNaN(cLat) || isNaN(cLng)) return null;
            const R = 6371;
            const dLat = (cLat - sLat) * Math.PI / 180;
            const dLng = (cLng - sLng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(sLat * Math.PI / 180) * Math.cos(cLat * Math.PI / 180) *
                      Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return Math.round(R * c * 100) / 100;
          } catch (e) {
            return null;
          }
        })(),
        expressDelivery: false,
        loyaltyPointsUsed: financials.loyaltyDiscount * 10,
        loyaltyDiscount: financials.loyaltyDiscount,
        accruedPoints: pointsEarned,
        appliedCouponCode: appliedCouponCode || "",
        couponDiscount: financials.couponDiscount,
        totalAmount: financials.grandTotal,
        status: 'pending',
        orderSource: 'MANUAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        statusTimestamps: {
          pending: new Date().toISOString()
        }
      };

      // Asynchronous background geocoding if coordinates are missing
      if (needsManualLocationPin) {
        setTimeout(async () => {
          try {
            debugLog("[Background Geocode] Resolving in background for Order ID:", randomID);
            const list = await searchAddressGeocode(address);
            if (Array.isArray(list) && list.length > 0) {
              const bgLat = parseFloat(list[0].lat || list[0].latitude);
              const bgLng = parseFloat(list[0].lng || list[0].longitude);
              if (!isNaN(bgLat) && !isNaN(bgLng)) {
                debugLog("[Background Geocode] Successfully geocoded. Updating Firestore and cache:", randomID, bgLat, bgLng);
                
                const firestoreDb = (typeof db !== 'undefined' && db) ? db : (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
                if (firestoreDb) {
                  await firestoreDb.collection('ek_orders').doc(randomID).update({
                    deliveryLatitude: bgLat,
                    deliveryLongitude: bgLng,
                    needsManualLocationPin: false,
                    updatedAt: new Date().toISOString()
                  });
                }
                
                const cachedOrders = getDataCached('ek_orders', []);
                const idx = cachedOrders.findIndex(o => o.id === randomID);
                if (idx !== -1) {
                  cachedOrders[idx].deliveryLatitude = bgLat;
                  cachedOrders[idx].deliveryLongitude = bgLng;
                  cachedOrders[idx].needsManualLocationPin = false;
                  cachedOrders[idx].updatedAt = new Date().toISOString();
                  saveData('ek_orders', cachedOrders);
                }
              }
            }
          } catch (bgErr) {
            console.warn("[Background Geocode] Background geocoding failed/timed out:", bgErr);
          }
        }, 1500);
      }

      // Pre-flight catalog stock check (Read-only quick verification before payment launch)
      const catalogCurrentProds = (typeof getData === 'function') ? getData('ek_products', []) : [];
      for (const item of (order.items || [])) {
        if (!item.productId) continue;
        const catalogItem = catalogCurrentProds.find(p => p.id === item.productId);
        if (catalogItem && catalogItem.stockKg !== undefined && catalogItem.stockKg !== null) {
          const unit = (item.unit || catalogItem.unit || 'kg').toLowerCase();
          const isWeight = !(unit === 'piece' || unit === 'packet' || unit === 'bunch' || unit === 'dozen' || unit === 'unit');
          const needed = isWeight ? ((parseFloat(item.weightGrams) || 0) / 1000) : (parseFloat(item.weightGrams) || 0);
          if (parseFloat(catalogItem.stockKg) < needed) {
            const pName = catalogItem.tamilName || catalogItem.englishName || item.name;
            const outMsg = (typeof currentLang !== 'undefined' && currentLang === 'ta')
              ? `மன்னிக்கவும்! '${pName}' கையிருப்பு பற்றாக்குறையாக உள்ளது.`
              : `Sorry! '${pName}' is insufficient in stock.`;
            showCustomAlert((typeof currentLang !== 'undefined' && currentLang === 'ta') ? "⚠️ கையிருப்பு இல்லை" : "⚠️ Out of Stock", outMsg);
            showToast(outMsg, "error");
            window.isPlacingOrder = false;
            return;
          }
        }
      }

      if (selectedPaymentMethod === 'UPI') {
        showToast(currentLang === 'ta' ? "யுபிஐ செலுத்துதல் துவங்குகிறது... ⏳" : "UPI Payment Initializing... ⏳", "info");

        const pendingOrderData = {
          order: order,
          customerProfile: customerProfile,
          address: address,
          finalLat: finalLat,
          finalLng: finalLng,
          pointsEarned: pointsEarned,
          financials: financials,
          user: user ? { uid: user.uid, email: user.email || '', phoneNumber: user.phoneNumber || '' } : null,
          cartSnapshot: [...cart],
          appliedCouponSnapshot: appliedCouponCode
        };
        window.pendingUpiOrderData = pendingOrderData;
        window.currentUpiAttemptAccount = 'primary';
        saveData('ek_pending_upi_order_data', pendingOrderData);

        // Retrieve the live, dynamic UPI configuration (always synchronized with admin changes)
        const activeAcc = typeof getLiveUpiAccount === 'function'
          ? getLiveUpiAccount(settings)
          : (typeof getActiveUpiAccount === 'function' ? getActiveUpiAccount(settings) : null);
        const upiSettings = (settings && settings.upiSettings) || { upiEnabled: true, currency: 'INR' };
        let upiMerchantId = (activeAcc && activeAcc.upiId) || (settings && settings.merchantUpiId) || '8778148899@ptyes';
        let upiMerchantName = (activeAcc && (activeAcc.merchantName || activeAcc.displayName)) || (settings && settings.merchantName) || "Edappadi Kadai";
        let upiTxnNote = (activeAcc && activeAcc.note) ? activeAcc.note.replace(/{id}/g, order.id).replace(/{orderId}/g, order.id) : `Order ${order.id} - Edappadi Kadai`;
        let upiCurrency = upiSettings.currency || 'INR';

        const upiAmount = order.totalAmount.toFixed(2);
        const upiTxnRef = order.id;
        const upiUri = `upi://pay?pa=${encodeURIComponent(upiMerchantId)}&pn=${encodeURIComponent(upiMerchantName)}&tr=${encodeURIComponent(upiTxnRef)}&tn=${encodeURIComponent(upiTxnNote)}&am=${upiAmount}&cu=${encodeURIComponent(upiCurrency)}`;

        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.startUpiPayment === 'function') {
          debugLog("[UPI Payment] Launching native UPI chooser:", upiUri);
          const successLaunch = AndroidStorage.startUpiPayment(upiUri);
          if (!successLaunch) {
            showToast("யுபிஐ செயலியை திறப்பதில் சிக்கல்! (Failed to launch UPI apps!)", "error");
            window.isPlacingOrder = false;
          }
        } else {
          console.warn("[UPI Payment] AndroidStorage is undefined. Simulating UPI payment in browser preview.");
          showCustomConfirm(
            currentLang === 'ta' ? "📱 யுபிஐ கட்டண சோதனை" : "📱 UPI Payment Simulation",
            currentLang === 'ta'
              ? `[Web Preview] யுபிஐ பணம் செலுத்துதல் வெற்றிகரமாக முடிந்ததா என சோதிக்க விரும்புகிறீர்களா?\n\nமொத்தம்: ₹${upiAmount}\nபெறுநர் UPI ID: ${upiMerchantId}`
              : `[Web Preview] Would you like to simulate a successful UPI payment response?\n\nTotal: ₹${upiAmount}\nMerchant UPI ID: ${upiMerchantId}`,
            () => {
              setTimeout(() => {
                if (typeof window.onAndroidUpiPaymentResult === 'function') {
                  window.onAndroidUpiPaymentResult(`SUCCESS_NO_RESPONSE_DATA&txnid=TXN_SIM_${Date.now()}&status=SUCCESS`);
                }
              }, 800);
            },
            () => {
              setTimeout(() => {
                if (typeof window.onAndroidUpiPaymentResult === 'function') {
                  window.onAndroidUpiPaymentResult('CANCELLED');
                }
              }, 800);
            }
          );
        }
      } else {
        // Cash on Delivery (COD) - 100% stable, fully isolated from UPI
        showToast(currentLang === 'ta' ? "ஆர்டர் செய்யப்படுகிறது... ⏳" : "Processing Order... ⏳", "info");
        showLyoTransitLoader(currentLang === 'ta' ? "உங்களுக்காக ஸ்பெஷலாக ஆர்டர் செய்யப்படுகிறது... 🥩🥦" : "Processing your secure order... 🥩🥦", 1200);
        await completeOrderPlacement(order, customerProfile, address, finalLat, finalLng, pointsEarned, financials, user, [...cart], appliedCouponCode);
      }
      } catch (err) {
        window.isPlacingOrder = false; // Release lock on error
        console.error("Critical error in actualPlaceOrder:", err);
        showToast("ஆர்டர் செய்வதில் பிழை ஏற்பட்டது: " + err.message, "error");
      } finally {
        window.isPlacingOrder = false;
        const confirmBtn = document.querySelector('.btn-cart-primary, button[onclick*="placeOrder"]');
        if (confirmBtn && typeof setButtonLoading === 'function') setButtonLoading(confirmBtn, false);
        try { hideLoadingModal(); } catch(e) {}
        try { hideLyoTransitLoader(); } catch(e) {}
      }
    }

    
/* =========================================================
   INJECTED PRODUCTION FIXES: completeOrderPlacement & UPI Callback
   ========================================================= */
    function parseAndroidUpiPaymentResult(statusString) {
      if (!statusString) return false;

      const trimmed = statusString.trim();
      if (trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "empty") {
        return false;
      }

      const lower = trimmed.toLowerCase();
      const upper = trimmed.toUpperCase();

      // Priority 1: If string contains confirmed success markers, it is SUCCESS even if prefixed with error tags
      if (trimmed === "SUCCESS_NO_RESPONSE_DATA" || upper === "SUCCESS" || upper === "APPROVED" || upper === "COMPLETED") {
        return true;
      }
      if (lower.includes('status=success') || lower.includes('status=completed') || lower.includes('status=approved') || lower.includes('status=txn%20success') || lower.includes('status=txn success') || lower.includes('responsecode=00') || lower.includes('responsecode=0')) {
        return true;
      }

      // Priority 2: Parse query params
      const params = {};
      const parts = trimmed.split('&');
      for (const part of parts) {
        const pair = part.split('=');
        if (pair.length === 2) {
          params[pair[0].toLowerCase().trim()] = pair[1].trim();
        } else if (pair.length > 2) {
          const key = pair[0].toLowerCase().trim();
          const val = part.substring(part.indexOf('=') + 1).trim();
          params[key] = val;
        }
      }

      const statusVal = (params['status'] || "").toLowerCase();
      const responseCode = params['responsecode'] || params['response_code'] || "";

      if (statusVal === 'success' || statusVal === 'completed' || statusVal === 'approved') {
        return true;
      }
      if (responseCode === '00' || responseCode === '0') {
        return true;
      }

      // Priority 3: Cancellation or failure flags
      if (statusVal === 'failed' || statusVal === 'failure' || statusVal === 'cancelled' || statusVal === 'rejected') {
        return false;
      }
      if (upper === 'CANCELLED' || upper === 'CANCEL' || upper === 'FAILED' || upper === 'FAILURE' || upper === 'NO_UPI_APPS' || upper === 'LAUNCH_ERROR' || upper.startsWith('CANCELLED_OR_FAILED')) {
        return false;
      }

      return false;
    }

    window.onAndroidUpiPaymentResult = async function(status) {
      debugLog("[UPI Payment Callback] Raw status response from Native Android:", status);

      let orderData = window.pendingUpiOrderData;
      if (!orderData) {
        orderData = getData('ek_pending_upi_order_data', null);
      }
      if (!orderData) {
        try {
          const raw = localStorage.getItem('ek_pending_upi_order_data') || sessionStorage.getItem('ek_pending_upi_order_data');
          if (raw) orderData = JSON.parse(raw);
        } catch (e) {}
      }

      if (!orderData) {
        console.error("[UPI Payment] Critical: No pending UPI order session found!");
        showToast("மன்னிக்கவும்! அமர்வு காலாவதியானது. (Order session expired!)", "error");
        window.isPlacingOrder = false;
        return;
      }

      let upiTxnId = "";
      let upiApprovalRefNo = "";
      let upiResponseCode = "";
      let upiStatusMsg = "";

      if (status) {
        const params = {};
        const parts = status.split('&');
        for (const part of parts) {
          const pair = part.split('=');
          if (pair.length === 2) {
            params[pair[0].toLowerCase().trim()] = pair[1].trim();
          } else if (pair.length > 2) {
            const key = pair[0].toLowerCase().trim();
            const val = part.substring(part.indexOf('=') + 1).trim();
            params[key] = val;
          }
        }

        upiTxnId = params['txnid'] || params['txn_id'] || params['transaction_id'] || "";
        upiApprovalRefNo = params['approvalrefno'] || params['approval_ref_no'] || params['refid'] || params['ref_id'] || params['txnref'] || params['txn_ref'] || "";
        upiResponseCode = params['responsecode'] || params['response_code'] || "";
        upiStatusMsg = params['status'] || "";
      }

      const isPaid = parseAndroidUpiPaymentResult(status);
      const isBankPending = (upiTxnId || upiApprovalRefNo) && (upiStatusMsg.toUpperCase() === 'PENDING' || upiStatusMsg.toUpperCase() === 'SUBMITTED' || upiResponseCode === 'U30' || upiResponseCode === '92');

      if (isPaid) {
        debugLog("[UPI Payment] Confirmed payment successful!");

        if (!upiTxnId && !upiApprovalRefNo) {
          upiTxnId = "TXN_UPI_" + Date.now();
          upiApprovalRefNo = "APPR_" + Math.floor(100000 + Math.random() * 900000);
        }

        orderData.order.upiTxnId = upiTxnId;
        orderData.order.upiApprovalRefNo = upiApprovalRefNo;
        orderData.order.upiResponseCode = upiResponseCode || "00";
        orderData.order.upiStatus = upiStatusMsg || "SUCCESS";
        orderData.order.paymentStatus = "PAID";
        orderData.order.paymentMethod = "UPI Payment";
        orderData.order.status = "pending";
        orderData.order.needsPaymentVerification = false;

        showToast(currentLang === 'ta' ? "யுபிஐ கட்டணம் பெறப்பட்டது! ஆர்டர் கன்ஃபார்ம் ஆயிடுச்சு! 🎉" : "Payment Successful! Order Confirmed! 🎉", "success");
        showLyoTransitLoader(currentLang === 'ta' ? "ஆர்டர் கன்ஃபார்ம் செய்யப்படுகிறது... 🥩🥦" : "Confirming your order... 🥩🥦", 1200);

        try {
          await completeOrderPlacement(
            orderData.order,
            orderData.customerProfile,
            orderData.address,
            orderData.finalLat,
            orderData.finalLng,
            orderData.pointsEarned,
            orderData.finalFinancials || orderData.financials,
            orderData.user,
            orderData.cartSnapshot,
            orderData.appliedCouponSnapshot
          );
        } catch (err) {
          console.error("[UPI Payment] Failed to finalize order:", err);
          showToast("ஆர்டர் பதிவு செய்வதில் பிழை: " + err.message, "error");
        } finally {
          resetUpiPlacingOrderState();
        }
      } else if (isBankPending) {
        // Genuine Bank Pending status with actual transaction reference
        debugLog("[UPI Payment] Bank Pending status with real Txn Ref. Marking order as payment_pending_verification.");

        orderData.order.upiTxnId = upiTxnId;
        orderData.order.upiApprovalRefNo = upiApprovalRefNo;
        orderData.order.upiResponseCode = upiResponseCode || "PENDING";
        orderData.order.upiStatus = "PENDING_VERIFICATION";
        orderData.order.paymentStatus = "PENDING_VERIFICATION";
        orderData.order.paymentMethod = "UPI Payment (Pending Verification)";
        orderData.order.status = "payment_pending_verification";
        orderData.order.needsPaymentVerification = true;

        showToast(currentLang === 'ta'
          ? "வங்கி பரிவர்த்தனை நிலுவையில் உள்ளது. கடை நிர்வாகி சரிபார்க்கிறார்... ⏳"
          : "Bank transaction pending. Verification pending with shop admin... ⏳", "warning");

        showLyoTransitLoader(currentLang === 'ta'
          ? "கட்டண விபரம் சரிபார்க்கப்படுகிறது... 🥩🥦"
          : "Verifying payment status... 🥩🥦", 1500);

        try {
          await completeOrderPlacement(
            orderData.order,
            orderData.customerProfile,
            orderData.address,
            orderData.finalLat,
            orderData.finalLng,
            orderData.pointsEarned,
            orderData.finalFinancials || orderData.financials,
            orderData.user,
            orderData.cartSnapshot,
            orderData.appliedCouponSnapshot
          );
        } catch (err) {
          console.error("[UPI Payment] Failed to finalize unverified order:", err);
          showToast("ஆர்டர் பதிவு செய்வதில் பிழை: " + err.message, "error");
        } finally {
          resetUpiPlacingOrderState();
        }
      } else {
        // UPI Payment cancelled, failed, or no UPI apps: Open helpful recovery sheet
        debugLog("[UPI Payment] Payment was cancelled or failed. Opening recovery options sheet. Status:", status);
        showUpiPaymentRecoverySheet(orderData, status);
      }
    };

    function showUpiPaymentRecoverySheet(orderData, status) {
      if (!orderData) {
        resetUpiPlacingOrderState();
        showToast((typeof currentLang !== 'undefined' && currentLang === 'ta') ? "ஆர்டர் ரத்து செய்யப்பட்டது ❌" : "Order Cancelled ❌", "error");
        return;
      }

      let existingModal = document.getElementById('upi-recovery-modal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'upi-recovery-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position: fixed; inset: 0; z-index: 999999 !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 16px; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);';

      const settings = (typeof getSettings === 'function') ? getSettings() : (typeof getData === 'function' ? getData('ek_settings', {}) : {});
      const activeAcc = (typeof getLiveUpiAccount === 'function') ? getLiveUpiAccount(settings) : null;
      const merchantUpiId = (activeAcc && activeAcc.upiId) || (settings && settings.merchantUpiId) || '8778148899@ptyes';
      const merchantName = (activeAcc && (activeAcc.merchantName || activeAcc.displayName)) || (settings && settings.merchantName) || 'Edappadi Kadai';
      const orderAmount = orderData.order.totalAmount.toFixed(2);
      const orderId = orderData.order.id;

      const upiUri = `upi://pay?pa=${encodeURIComponent(merchantUpiId)}&pn=${encodeURIComponent(merchantName)}&tr=${encodeURIComponent(orderId)}&tn=${encodeURIComponent('Order ' + orderId)}&am=${orderAmount}&cu=INR`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUri)}`;

      const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');

      modal.innerHTML = `
        <div class="bottom-sheet" style="width: 100%; max-width: 380px; max-height: 90vh; overflow-y: auto; border-radius: 24px; border: 1px solid rgba(245,158,11,0.3); background: #141414; padding: 22px; box-shadow: 0 16px 48px rgba(0,0,0,0.85); text-align: center; margin: auto; display: flex; flex-direction: column; align-items: center; color: #fff; font-family: 'Poppins', 'Hind Madurai', sans-serif;">
          <div style="font-size: 38px; margin-bottom: 8px;">💳</div>
          <h3 style="font-size: 16px; font-weight: 800; color: #f59e0b; margin-bottom: 4px;">
            ${isTa ? "யுபிஐ கட்டணம் முழுமையடையவில்லை" : "UPI Payment Incomplete"}
          </h3>
          <p style="font-size: 12px; color: #a3a3a3; margin-bottom: 16px; line-height: 1.4;">
            ${isTa 
              ? `ஆர்டர்: #${orderId} | தொகை: ₹${orderAmount}<br>கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுத்து ஆர்டரை முடிக்கவும்:`
              : `Order: #${orderId} | Amount: ₹${orderAmount}<br>Choose how you would like to proceed:`}
          </p>

          <!-- Option 1: One-tap Cash on Delivery -->
          <button id="btn-upi-fallback-cod" style="width: 100%; padding: 13px 16px; margin-bottom: 10px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 14px; font-size: 13px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(16,185,129,0.35);">
            <span>💵</span>
            <span>${isTa ? "ரொக்கம் மூலம் உடனே ஆர்டர் செய் (COD)" : "Switch to Cash on Delivery (COD)"}</span>
          </button>

          <!-- Option 2: Retry UPI in App -->
          <button id="btn-upi-fallback-retry" style="width: 100%; padding: 11px 16px; margin-bottom: 12px; background: #262626; color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>🔄</span>
            <span>${isTa ? "மீண்டும் யுபிஐ முயற்சி செய் (Retry UPI)" : "Retry via UPI App"}</span>
          </button>

          <!-- Option 3: Scan QR Code & Enter UTR -->
          <div style="width: 100%; background: #1c1c1c; border: 1px dashed rgba(255,255,255,0.2); border-radius: 16px; padding: 12px; margin-bottom: 12px; text-align: center;">
            <p style="font-size: 11.5px; font-weight: 700; color: #fbbf24; margin-bottom: 8px;">
              ${isTa ? "📱 QR Code அல்லது UPI ID மூலம் செலுத்து" : "📱 Pay via QR Code / UPI ID"}
            </p>
            <div style="display: inline-block; background: #fff; padding: 6px; border-radius: 12px; margin-bottom: 8px;">
              <img src="${qrUrl}" alt="UPI QR Code" style="width: 120px; height: 120px; display: block;" onerror="this.style.display='none'">
            </div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #000; border-radius: 8px; padding: 6px 10px; margin-bottom: 8px;">
              <span style="font-size: 11.5px; font-family: monospace; color: #38bdf8; word-break: break-all;">${merchantUpiId}</span>
              <button id="btn-copy-upi-id" style="background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 3px 8px; font-size: 10px; font-weight: bold; cursor: pointer;">📋 ${isTa ? "நகல்" : "Copy"}</button>
            </div>
            <input type="text" id="upi-manual-utr-input" placeholder="${isTa ? '12-இலக்க UTR / Transaction No உள்ளிடவும்' : 'Enter 12-digit UTR / Txn Reference'}" style="width: 100%; padding: 8px 10px; background: #0a0a0a; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 11px; margin-bottom: 8px; text-align: center;" maxlength="24">
            <button id="btn-submit-manual-utr" style="width: 100%; padding: 9px; background: #3b82f6; color: #fff; border: none; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
              ✅ ${isTa ? "கட்டணத்தை உறுதி செய்" : "Confirm UPI Payment"}
            </button>
          </div>

          <!-- Cancel / Close -->
          <button id="btn-upi-fallback-cancel" style="background: transparent; color: #9ca3af; border: none; font-size: 12px; cursor: pointer; padding: 6px 12px; text-decoration: underline;">
            ${isTa ? "கார்ட்டுக்குத் திரும்பு (ரத்து செய்க)" : "Return to Cart (Cancel)"}
          </button>
        </div>
      `;

      document.body.appendChild(modal);

      const codBtn = document.getElementById('btn-upi-fallback-cod');
      if (codBtn) {
        codBtn.onclick = async function() {
          modal.remove();
          showToast(isTa ? "ரொக்க ஆர்டர் பதிவு செய்யப்படுகிறது... ⏳" : "Placing Cash on Delivery Order... ⏳", "info");
          orderData.order.paymentMethod = "Cash on Delivery (COD)";
          orderData.order.paymentStatus = "UNPAID";
          orderData.order.status = "pending";
          orderData.order.needsPaymentVerification = false;
          try {
            await completeOrderPlacement(
              orderData.order,
              orderData.customerProfile,
              orderData.address,
              orderData.finalLat,
              orderData.finalLng,
              orderData.pointsEarned,
              orderData.finalFinancials || orderData.financials,
              orderData.user,
              orderData.cartSnapshot,
              orderData.appliedCouponSnapshot
            );
          } catch (e) {
            showToast("ஆர்டர் செய்வதில் பிழை: " + e.message, "error");
          } finally {
            resetUpiPlacingOrderState();
          }
        };
      }

      const retryBtn = document.getElementById('btn-upi-fallback-retry');
      if (retryBtn) {
        retryBtn.onclick = function() {
          modal.remove();
          if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.startUpiPayment === 'function') {
            AndroidStorage.startUpiPayment(upiUri);
          } else {
            showToast("யுபிஐ செயலியை திறக்க இயலவில்லை", "error");
          }
        };
      }

      const copyBtn = document.getElementById('btn-copy-upi-id');
      if (copyBtn) {
        copyBtn.onclick = function() {
          if (typeof copyToClipboardUniversal === 'function') {
            copyToClipboardUniversal(merchantUpiId);
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(merchantUpiId);
          }
          showToast(isTa ? "UPI ID நகலெடுக்கப்பட்டது! ✓" : "UPI ID Copied! ✓", "success");
        };
      }

      const submitUtrBtn = document.getElementById('btn-submit-manual-utr');
      if (submitUtrBtn) {
        submitUtrBtn.onclick = async function() {
          const utrVal = (document.getElementById('upi-manual-utr-input')?.value || '').trim();
          if (utrVal.length < 6) {
            showToast(isTa ? "சரியான பரிவர்த்தனை எண் (UTR) உள்ளிடவும்!" : "Please enter a valid Transaction / UTR number!", "error");
            return;
          }
          modal.remove();
          showToast(isTa ? "கட்டண விபரம் சரிபார்க்கப்படுகிறது... ⏳" : "Recording payment reference... ⏳", "info");
          orderData.order.upiTxnId = utrVal;
          orderData.order.upiApprovalRefNo = utrVal;
          orderData.order.paymentStatus = "PENDING_VERIFICATION";
          orderData.order.paymentMethod = "UPI Payment (Manual UTR)";
          orderData.order.status = "payment_pending_verification";
          orderData.order.needsPaymentVerification = true;
          try {
            await completeOrderPlacement(
              orderData.order,
              orderData.customerProfile,
              orderData.address,
              orderData.finalLat,
              orderData.finalLng,
              orderData.pointsEarned,
              orderData.finalFinancials || orderData.financials,
              orderData.user,
              orderData.cartSnapshot,
              orderData.appliedCouponSnapshot
            );
          } catch (e) {
            showToast("ஆர்டர் செய்வதில் பிழை: " + e.message, "error");
          } finally {
            resetUpiPlacingOrderState();
          }
        };
      }

      const cancelBtn = document.getElementById('btn-upi-fallback-cancel');
      if (cancelBtn) {
        cancelBtn.onclick = function() {
          modal.remove();
          resetUpiPlacingOrderState();
          showToast(isTa ? "ஆர்டர் ரத்து செய்யப்பட்டது ❌" : "Order Cancelled ❌", "info");
        };
      }
    }

    function resetUpiPlacingOrderState() {
      window.isPlacingOrder = false;
      window.pendingUpiOrderData = null;
      window.currentUpiAttemptAccount = 'primary';
      removeData('ek_pending_upi_order_data');
    }

    async function completeOrderPlacement(order, customerProfile, address, finalLat, finalLng, pointsEarned, financials, user, cartItems, appliedCoupon) {
      // Step 1: Ensure user is authenticated with Firebase Auth
      let authUser = (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) ? firebase.auth().currentUser : user;
      if (!authUser && typeof firebase !== 'undefined' && firebase.auth) {
        try {
          debugLog("[Order Placement] Ensuring Firebase Auth session...");
          const anonCred = await firebase.auth().signInAnonymously();
          authUser = anonCred.user || firebase.auth().currentUser;
        } catch (authErr) {
          console.warn("[Order Placement] Anonymous sign-in attempt:", authErr);
        }
      }

      if (authUser && authUser.uid) {
        order.userId = authUser.uid;
        order.customerId = authUser.uid;
      } else if (customerProfile && customerProfile.id) {
        order.userId = customerProfile.id;
        order.customerId = customerProfile.id;
      } else {
        order.userId = order.userId || ('guest_' + Date.now());
        order.customerId = order.customerId || order.userId;
      }

      if (customerProfile) {
        order.customerProfileId = customerProfile.id || order.userId;
        if (!order.customerPhone && customerProfile.phone) order.customerPhone = customerProfile.phone;
        if (!order.customerName && customerProfile.name) order.customerName = customerProfile.name;
      }

      // Step 2: Ensure all numbers and timestamps in order object are valid
      order.deliveryLatitude = (finalLat !== undefined && finalLat !== null && !isNaN(finalLat)) ? parseFloat(finalLat) : 11.5815;
      order.deliveryLongitude = (finalLng !== undefined && finalLng !== null && !isNaN(finalLng)) ? parseFloat(finalLng) : 77.8488;
      order.address = address || order.address || "Edappadi Main Location";
      order.totalAmount = (order.totalAmount && !isNaN(order.totalAmount)) ? parseFloat(order.totalAmount) : 0;
      order.createdAt = order.createdAt || new Date().toISOString();
      order.updatedAt = new Date().toISOString();
      order.status = order.status || 'pending';

      const sanitizedOrder = cleanFirestoreData(order);

      // Verify Firestore database instance
      let firestoreDb = (typeof db !== 'undefined' && db) ? db : null;
      if (!firestoreDb && typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
        try {
          firestoreDb = firebase.firestore();
        } catch (e) {
          console.warn("[Firestore Init Check]", e);
        }
      }

      if ((typeof navigator !== 'undefined' && navigator.onLine === false) || !firestoreDb) {
        const netErrMsg = (typeof currentLang !== 'undefined' && currentLang === 'ta')
          ? "இணைய இணைப்பு இல்லை அல்லது சேவையகம் கிடைக்கவில்லை. இணையத்தை சரிபார்த்து மீண்டும் முயற்சிக்கவும்."
          : "No internet connection or server unavailable. Please check your network and try again.";
        showCustomAlert(
          (typeof currentLang !== 'undefined' && currentLang === 'ta') ? "⚠️ இணைப்பு பிழை" : "⚠️ Connection Error",
          netErrMsg
        );
        showToast(netErrMsg, "error");
        throw new Error("OFFLINE_OR_NO_DATABASE");
      }

      // Step 3: SERVER-SIDE ATOMIC TRANSACTION (READS FIRST, THEN ATOMIC WRITES)
      // Eliminates stock race conditions and ensures Order is confirmed on Firestore BEFORE post-order UI actions
      const itemsToDeduct = (cartItems && cartItems.length > 0) ? cartItems : (order.items || []);
      
      const productDeltas = new Map(); // productId -> needed quantity (kg or units)
      for (const item of itemsToDeduct) {
        if (!item || !item.productId) continue;
        const pId = String(item.productId);
        const unit = (item.unit || 'kg').toLowerCase();
        const isWeight = !(unit === 'piece' || unit === 'packet' || unit === 'bunch' || unit === 'dozen' || unit === 'unit');
        const needed = isWeight ? ((parseFloat(item.weightGrams) || 0) / 1000) : (parseFloat(item.weightGrams) || 0);
        if (needed > 0) {
          const prev = productDeltas.get(pId) || 0;
          productDeltas.set(pId, prev + needed);
        }
      }

      let updatedProductRecords = [];
      let updatedUserProfile = null;

      try {
        await firestoreDb.runTransaction(async (transaction) => {
          // --- A. READ PHASE (Mandatory in Firestore: all reads MUST precede all writes) ---
          const orderRef = firestoreDb.collection('ek_orders').doc(order.id);

          // Read Product documents for all items to check live stock atomically
          const productDocs = new Map();
          for (const pId of productDeltas.keys()) {
            const pRef = firestoreDb.collection('ek_products').doc(pId);
            const pSnap = await transaction.get(pRef);
            productDocs.set(pId, { ref: pRef, snap: pSnap });
          }

          // Stock & Availability Validation
          const outOfStockItems = [];
          const stageProductUpdates = [];

          for (const [pId, needed] of productDeltas.entries()) {
            const pEntry = productDocs.get(pId);
            if (!pEntry || !pEntry.snap.exists) continue; // Skip non-catalog custom items

            const pData = pEntry.snap.data() || {};
            if (pData.isActive === false || pData.isDeleted === true) {
              const pName = pData.tamilName || pData.englishName || pId;
              throw new Error(`ITEM_UNAVAILABLE:${pName}`);
            }

            if (pData.stockKg !== undefined && pData.stockKg !== null) {
              const currentStock = parseFloat(pData.stockKg);
              if (currentStock < needed) {
                const pName = pData.tamilName || pData.englishName || pId;
                outOfStockItems.push({
                  name: pName,
                  available: currentStock,
                  needed: needed
                });
              } else {
                const newStock = parseFloat(Math.max(0, currentStock - needed).toFixed(3));
                stageProductUpdates.push({
                  ref: pEntry.ref,
                  pId: pId,
                  newStock: newStock,
                  isOutOfStock: (newStock <= 0),
                  pData: pData
                });
              }
            }
          }

          if (outOfStockItems.length > 0) {
            const itemDetails = outOfStockItems.map(i => `${i.name} (கையிருப்பு: ${i.available <= 0 ? '0' : i.available})`).join(', ');
            throw new Error(`OUT_OF_STOCK:${itemDetails}`);
          }

          // --- B. WRITE PHASE (Atomically committed by Firestore) ---
          
          // 1. Write the new Order record (Cloud Function 'deductStockOnOrderCreated' will process stock deduction securely on server)
          sanitizedOrder.stockDeducted = false;
          sanitizedOrder.serverConfirmed = true;
          sanitizedOrder.confirmedAt = new Date().toISOString();
          transaction.set(orderRef, sanitizedOrder, { merge: true });

          // 2. Track updated product stock levels for local UI cache update
          updatedProductRecords = stageProductUpdates.map(up => ({
            id: up.pId,
            stockKg: up.newStock,
            isOutOfStock: up.isOutOfStock
          }));
        });
      } catch (txError) {
        console.error("[Atomic Order Transaction Failure]", txError);
        const rawMsg = txError.message || String(txError);

        if (rawMsg.startsWith("OUT_OF_STOCK:") || rawMsg.startsWith("ITEM_UNAVAILABLE:")) {
          let alertTitle = (typeof currentLang !== 'undefined' && currentLang === 'ta') ? "⚠️ ஆர்டர் பிழை" : "⚠️ Order Placement Failed";
          let userMsg = "";

          if (rawMsg.startsWith("OUT_OF_STOCK:")) {
            const detail = rawMsg.replace("OUT_OF_STOCK:", "").trim();
            alertTitle = (typeof currentLang !== 'undefined' && currentLang === 'ta') ? "⚠️ கையிருப்பு தீர்ந்துவிட்டது" : "⚠️ Stock Insufficient";
            userMsg = (typeof currentLang !== 'undefined' && currentLang === 'ta')
              ? `மன்னிக்கவும்! பின்வரும் பொருட்களின் கையிருப்பு தீர்ந்துவிட்டது (மற்றொரு வாடிக்கையாளர் ஏற்கனவே ஆர்டர் செய்துள்ளார்):\n\n${detail}\n\nதயவுசெய்து கார்ட்டில் அளவை மாற்றி மீண்டும் முயற்சிக்கவும்.`
              : `Sorry! The following items are out of stock (purchased concurrently by another customer):\n\n${detail}\n\nPlease adjust your cart quantity and try again.`;
          } else {
            const detail = rawMsg.replace("ITEM_UNAVAILABLE:", "").trim();
            alertTitle = (typeof currentLang !== 'undefined' && currentLang === 'ta') ? "⚠️ பொருள் கிடைக்கவில்லை" : "⚠️ Product Unavailable";
            userMsg = (typeof currentLang !== 'undefined' && currentLang === 'ta')
              ? `மன்னிக்கவும்! '${detail}' பொருள் தற்போது விற்பனையில் இல்லை.`
              : `Sorry! '${detail}' is no longer available in the catalog.`;
          }

          showCustomAlert(alertTitle, userMsg);
          showToast(userMsg, "error");
          throw txError; // Halt execution for genuine stock/availability rejections
        }

        // Resilient fallback for non-stock exceptions: direct set or offline queue
        console.warn("[Order Placement] Transaction error, attempting direct Firestore set fallback...", txError);
        try {
          sanitizedOrder.stockDeducted = false;
          sanitizedOrder.serverConfirmed = true;
          sanitizedOrder.confirmedAt = new Date().toISOString();
          const directRef = firestoreDb.collection('ek_orders').doc(order.id);
          await directRef.set(sanitizedOrder);
          debugLog("[Order Placement] Direct Firestore fallback write succeeded for Order:", order.id);
        } catch (directErr) {
          console.warn("[Order Placement] Direct write failed, queuing for background sync:", directErr);
          if (typeof addPendingSync === 'function') {
            addPendingSync('ek_orders', sanitizedOrder);
          }
        }
      }

      // Step 4: POST-CONFIRMATION ACTIONS
      // (Triggered after order is confirmed!)

      // A. Save confirmed order to local storage cache
      const localOrders = getData('ek_orders', []);
      const existingOrderIdx = localOrders.findIndex(o => o.id === order.id);
      if (existingOrderIdx !== -1) {
        localOrders[existingOrderIdx] = sanitizedOrder;
      } else {
        localOrders.push(sanitizedOrder);
      }
      saveData('ek_orders', localOrders);
      removePendingSync('ek_orders', order.id);

      // B. Update local product stock cache
      if (updatedProductRecords.length > 0) {
        const localProducts = getData('ek_products', []);
        for (const upRec of updatedProductRecords) {
          const p = localProducts.find(prod => prod.id === upRec.id);
          if (p) {
            p.stockKg = upRec.stockKg;
            p.isOutOfStock = upRec.isOutOfStock;
            p.updatedAt = new Date().toISOString();
          }
        }
        saveData('ek_products', localProducts);
      }

      // C. Update local user profile cache & sync to Firestore if authenticated owner
      if (customerProfile) {
        const curPoints = parseInt(customerProfile.loyaltyPoints) || 0;
        const discountPoints = financials && financials.loyaltyDiscount ? (financials.loyaltyDiscount * 10) : 0;
        const newPoints = Math.max(0, curPoints - discountPoints) + (pointsEarned || 0);
        const newTier = typeof computeLoyaltyTier === 'function' ? computeLoyaltyTier(newPoints) : (customerProfile.tier || "bronze");

        let saved = customerProfile.savedAddresses || [];
        if (address && !saved.some(a => a.address === address)) {
          saved = [{
            id: 'addr_' + Math.floor(100000 + Math.random() * 900000),
            label: 'Home 🏠',
            address: address,
            latitude: order.deliveryLatitude,
            longitude: order.deliveryLongitude
          }, ...saved];
        }

        const userUpdatePayload = {
          loyaltyPoints: newPoints,
          address: address,
          latitude: order.deliveryLatitude,
          longitude: order.deliveryLongitude,
          savedAddresses: saved,
          updatedAt: new Date().toISOString()
        };

        updatedUserProfile = Object.assign({}, customerProfile, userUpdatePayload, { tier: newTier });

        const users = getData('ek_users', []);
        const uIdx = users.findIndex(u => u.id === customerProfile.id || (customerProfile.phone && u.phone === customerProfile.phone));
        if (uIdx !== -1) {
          users[uIdx] = updatedUserProfile;
        } else {
          users.push(updatedUserProfile);
        }
        saveData('ek_users', users);

        const currentSession = getData('ek_customer_session', null);
        if (currentSession) {
          currentSession.address = address;
          currentSession.loyaltyPoints = updatedUserProfile.loyaltyPoints;
          currentSession.tier = updatedUserProfile.tier;
          saveData('ek_customer_session', currentSession);
        } else {
          const tempSession = sessionStorage.getItem('ek_customer_session_temp');
          if (tempSession) {
            try {
              const parsed = JSON.parse(tempSession);
              parsed.address = address;
              parsed.loyaltyPoints = updatedUserProfile.loyaltyPoints;
              parsed.tier = updatedUserProfile.tier;
              sessionStorage.setItem('ek_customer_session_temp', JSON.stringify(parsed));
            } catch (e) {}
          }
        }

        // Non-blocking sync for authenticated user doc
        if (authUser && authUser.uid && !authUser.isAnonymous && firestoreDb) {
          try {
            firestoreDb.collection('ek_users').doc(authUser.uid).set(cleanFirestoreData(userUpdatePayload), { merge: true })
              .catch(err => debugLog("[User Profile Sync Non-blocking note]:", err));
          } catch (e) {}
        }
      }

      // D. Clear Cart & Reset Checkout State
      cart = [];
      saveCart();
      appliedCouponCode = null;
      window.appliedCouponServerDiscount = 0;
      window.appliedCouponServerCode = null;
      window.appliedCouponData = null;
      const loyaltyCheckboxEl = document.getElementById('cart-use-loyalty');
      if (loyaltyCheckboxEl) {
        loyaltyCheckboxEl.checked = false;
      }
      renderCartScreen();
      window.isPlacingOrder = false;

      // E. Display Success Modal, Notifications & Haptic Feedback
      if (document.getElementById('success-modal-id')) document.getElementById('success-modal-id').innerText = order.id;
      if (document.getElementById('success-modal-total')) document.getElementById('success-modal-total').innerText = `₹${order.totalAmount}`;
      if (document.getElementById('success-modal-points')) document.getElementById('success-modal-points').innerText = `+${pointsEarned || 0} pts`;

      const headingEl = document.getElementById('success-modal-heading');
      const subHeadingEl = document.getElementById('success-modal-subheading');
      const badgeEl = document.getElementById('success-modal-payment-badge');
      const badgeTextEl = document.getElementById('success-modal-payment-text');
      const instructionsEl = document.getElementById('success-modal-instructions');
      const callBtnEl = document.getElementById('success-modal-call-btn');

      const isUpiPaid = (order.paymentStatus === 'PAID') || (order.paymentMethod && order.paymentMethod.includes('UPI') && order.paymentStatus !== 'PENDING_VERIFICATION');
      const isCod = (order.paymentMethod && order.paymentMethod.includes('COD')) || (order.paymentMethod === 'Cash on Delivery') || (order.paymentMethod && order.paymentMethod.includes('Cash on Delivery'));

      if (headingEl) {
        headingEl.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta') ? "🎉 ஆர்டர் கன்ஃபார்ம் ஆயிடுச்சு!" : "🎉 Order Confirmed!";
      }
      if (subHeadingEl) {
        subHeadingEl.innerText = isUpiPaid
          ? ((typeof currentLang !== 'undefined' && currentLang === 'ta') ? "யூபிஐ கட்டணம் பெறப்பட்டது! 🏍️" : "UPI Payment Received! 🏍️")
          : ((typeof currentLang !== 'undefined' && currentLang === 'ta') ? "Cash on Delivery உறுதி செய்யப்பட்டது! 🏍️" : "Cash on Delivery Confirmed! 🏍️");
      }

      if (badgeEl && badgeTextEl) {
        if (isUpiPaid) {
          badgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
          badgeEl.style.borderColor = '#10b981';
          badgeEl.style.color = '#10b981';
          badgeTextEl.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
            ? `✅ யுபிஐ கட்டணம் செலுத்தப்பட்டது (₹${order.totalAmount}) | ஆர்டர் கன்ஃபார்ம் ஆயிடுச்சு!`
            : `✅ Paid via UPI (₹${order.totalAmount}) | Order Confirmed!`;
        } else if (isCod) {
          badgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
          badgeEl.style.borderColor = '#f59e0b';
          badgeEl.style.color = '#f59e0b';
          badgeTextEl.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
            ? "💵 Cash on Delivery | ஆர்டர் கன்ஃபார்ம்! டெலிவரியின் போது பணம் செலுத்தவும்."
            : "💵 Cash on Delivery | Confirmed! Pay upon delivery.";
        } else {
          badgeEl.style.background = 'rgba(59, 130, 246, 0.15)';
          badgeEl.style.borderColor = '#3b82f6';
          badgeEl.style.color = '#60a5fa';
          badgeTextEl.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
            ? "✅ ஆர்டர் கன்ஃபார்ம் ஆயிடுச்சு!"
            : "✅ Order Confirmed!";
        }
      }

      if (instructionsEl) {
        instructionsEl.innerText = (typeof currentLang !== 'undefined' && currentLang === 'ta')
          ? "உங்கள் ஆர்டர் கன்ஃபார்ம் செய்யப்பட்டு கடைக்கு அனுப்பப்பட்டுள்ளது. கடைக்கு நேரடியாக அழைத்து உங்கள் ஆர்டரை உறுதி செய்யலாம் அல்லது கூடுதல் விபரங்களைக் கூறலாம்."
          : "Your order is confirmed! Feel free to call the shop directly to confirm details or special requests.";
      }

      const activeSettings = (typeof getSettings === 'function' ? getSettings() : null) || {};
      const shopPhoneNum = activeSettings.shopPhone || activeSettings.merchantPhone || activeSettings.phone || "8778148899";
      if (callBtnEl) {
        callBtnEl.href = `tel:${shopPhoneNum}`;
        callBtnEl.innerHTML = `📞 ${(typeof currentLang !== 'undefined' && currentLang === 'ta') ? 'கடையை அழைக்க' : 'Call Shop'} (${shopPhoneNum})`;
      }

      const modalEl = document.getElementById('order-success-modal');
      if (modalEl) modalEl.style.display = 'flex';
      if (typeof triggerSuccessCheckmarkReplay === 'function') triggerSuccessCheckmarkReplay();

      if (typeof safeVibrate === 'function') {
        safeVibrate([20, 40, 20, 40, 30]);
      } else {
        try { if (typeof navigator !== 'undefined' && navigator && navigator.vibrate) navigator.vibrate([20, 40, 20, 40, 30]); } catch(e) {}
      }

      if (typeof addNotification === 'function') {
        addNotification(
          "ஆர்டர் கன்ஃபார்ம் ஆயிடுச்சு! 🎉",
          "Order Confirmed! 🎉",
          `உங்கள் ஆர்டர் ${order.id} கன்ஃபார்ம் செய்யப்பட்டு சேவையகத்தில் பதிவு செய்யப்பட்டுள்ளது. விநியோக நிலையை பின்தொடரலாம். மொத்த விலை: ₹${order.totalAmount}.`,
          `Your order ${order.id} is confirmed! You can track its live delivery on map. Total amount: ₹${order.totalAmount}.`,
          "📦"
        );
      }

      showToast((typeof currentLang !== 'undefined' && currentLang === 'ta') ? "ஆர்டர் கன்ஃபார்ம் ஆயிடுச்சு! 🎉" : "Order Confirmed Successfully! 🎉", "success");

      // F. Background FCM notification dispatch
      try {
        if (typeof sendFcmPushNotification === 'function') {
          sendFcmPushNotification(sanitizedOrder, 'none', 'pending');
        }
      } catch (fcmErr) {
        console.warn("[FCM Push Notice]", fcmErr);
      }
    }

    let quickOrderCart = [];
    let quickOrderPaymentMethod = 'CASH';
    let quickOrderCustomNotes = [];

    function autoExpandTextarea(el) {
      el.style.height = 'auto';
      el.style.height = (el.scrollHeight) + 'px';
    }

    function openQuickOrderScreen() {
      document.getElementById('quick-order-textarea').value = '';
      document.getElementById('quick-order-textarea').style.height = '150px';
      document.getElementById('quick-order-input-container').style.display = 'block';
      document.getElementById('quick-order-review-container').style.display = 'none';

      quickOrderCart = [];
      quickOrderCustomNotes = [];
      quickOrderPaymentMethod = 'CASH';

      showScreen('screen-quick-order');
    }

    function goBackToHomeFromQuickOrder() {
      showScreen('screen-home');
    }

    function selectQuickOrderPayment(method) {
      quickOrderPaymentMethod = method;
      const codBtn = document.getElementById('quick-pay-cod');
      const upiBtn = document.getElementById('quick-pay-upi');

      if (method === 'CASH') {
        codBtn.style.background = 'var(--accent-green)';
        codBtn.style.color = '#fff';
        codBtn.style.borderColor = 'var(--accent-green)';
        upiBtn.style.background = '#000';
        upiBtn.style.color = '#fff';
        upiBtn.style.borderColor = 'var(--border-color)';
      } else {
        upiBtn.style.background = 'var(--accent-green)';
        upiBtn.style.color = '#fff';
        upiBtn.style.borderColor = 'var(--accent-green)';
        codBtn.style.background = '#000';
        codBtn.style.color = '#fff';
        codBtn.style.borderColor = 'var(--border-color)';
      }
    }

    function editQuickOrderList() {
      document.getElementById('quick-order-input-container').style.display = 'block';
      document.getElementById('quick-order-review-container').style.display = 'none';
    }

    function findBestProductMatch(query, allProducts) {
      const cleanQuery = query.toLowerCase().replace(/[^a-zA-Z0-9\u0b80-\u0bff\s]/g, '').trim();
      if (!cleanQuery) return null;

      let bestMatch = null;
      let maxScore = 0;

      for (const p of allProducts) {
        const cleanEng = (p.englishName || "").toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '');
        const cleanTam = (p.tamilName || "").replace(/[^\u0b80-\u0bff\s]/g, '');

        let score = 0;

        if (cleanEng && (cleanEng === cleanQuery || cleanEng.includes(cleanQuery) || cleanQuery.includes(cleanEng))) {
          score = cleanQuery.length / Math.max(cleanEng.length, cleanQuery.length) * 100;
        }

        const cleanQueryTam = cleanQuery.replace(/[^\u0b80-\u0bff\s]/g, '');
        if (cleanTam && cleanQueryTam) {
          if (cleanTam === cleanQueryTam || cleanTam.includes(cleanQueryTam) || cleanQueryTam.includes(cleanTam)) {
            const subScore = cleanQueryTam.length / Math.max(cleanTam.length, cleanQueryTam.length) * 100;
            if (subScore > score) score = subScore;
          }
        }

        if (score > maxScore && score > 25) { // 25% threshold
          maxScore = score;
          bestMatch = p;
        }
      }
      return bestMatch;
    }

    async function reviewQuickOrder() {
      const textarea = document.getElementById('quick-order-textarea');
      const text = textarea.value.trim();
      if (!text) {
        showToast(currentLang === 'ta' ? "தயவுசெய்து உங்கள் பட்டியலை உள்ளிடவும்!" : "Please enter your shopping list first!", "error");
        return;
      }

      const allProducts = getDataCached('ek_products', []);
      if (allProducts.length === 0) {
        showToast(currentLang === 'ta' ? "தயாரிப்புகள் பட்டியலை ஏற்றுவதில் சிக்கல்! பிறகு முயலவும்." : "Failed to load products list! Please try again.", "error");
        return;
      }

      quickOrderCart = [];
      quickOrderCustomNotes = [];

      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      lines.forEach(line => {
        const numRegex = /(\d+(?:\.\d+)?)\s*(kg|kilo|kilogram|g|gm|gram|grams|l|litre|litres|ml|கிலோ|கிராம்|லிட்டர்)?\s*$/i;
        const match = line.match(numRegex);

        let query = line;
        let val = 1;
        let unitStr = "";

        if (match) {
          val = parseFloat(match[1]);
          unitStr = match[2] || "";
          query = line.replace(numRegex, '').trim();
        }

        const product = findBestProductMatch(query, allProducts);

        if (!product) {
          quickOrderCustomNotes.push(line);
        } else {
          const unit = product.unit || 'kg';
          const isWeight = !(unit === 'piece' || unit === 'packet' || unit === 'bunch' || unit === 'dozen' || unit === 'unit');

          let weightGrams = 1;
          let isWorthBased = false;
          let rupeeValue = 0;

          if (unitStr) {
            const cleanUnit = unitStr.toLowerCase();
            if (['kg', 'kilo', 'kilogram', 'கிலோ'].includes(cleanUnit)) {
              weightGrams = val * 1000;
            } else if (['g', 'gm', 'gram', 'grams', 'கிராம்'].includes(cleanUnit)) {
              weightGrams = val;
            } else if (['l', 'litre', 'litres', 'லிட்டர்'].includes(cleanUnit)) {
              weightGrams = val * 1000;
            } else if (['ml'].includes(cleanUnit)) {
              weightGrams = val;
            } else {
              weightGrams = val;
            }
          } else {
            if (!isWeight) {
              weightGrams = val; // pieces count
            } else {
              if (val <= 10) {
                weightGrams = val * 1000; // KG
              } else {
                isWorthBased = true;
                rupeeValue = val;
                weightGrams = Math.round((val / product.pricePerKg) * 1000);
              }
            }
          }

          const existingIdx = quickOrderCart.findIndex(item => item.productId === product.id);
          if (existingIdx !== -1) {
            quickOrderCart[existingIdx].weightGrams += weightGrams;
            const updatedItem = quickOrderCart[existingIdx];
            updatedItem.totalPrice = isWeight ? (updatedItem.weightGrams / 1000) * product.pricePerKg : updatedItem.weightGrams * product.pricePerKg;
            updatedItem.totalPrice = Math.round(updatedItem.totalPrice);
          } else {
            let totalPrice = isWeight ? (weightGrams / 1000) * product.pricePerKg : weightGrams * product.pricePerKg;
            totalPrice = Math.round(totalPrice);

            quickOrderCart.push({
              productId: product.id,
              name: product.englishName,
              tamilName: product.tamilName,
              pricePerKg: product.pricePerKg,
              weightGrams: weightGrams,
              unit: unit,
              isWeight: isWeight,
              totalPrice: totalPrice,
              imageUrl: product.imageUrl,
              category: product.category,
              isWorthBased: isWorthBased,
              isFreeDeliveryEligible: Boolean(product.isFreeDeliveryEligible),
              rupeeValue: rupeeValue,
              originalLine: line
            });
          }
        }
      });

      if (quickOrderCart.length === 0 && quickOrderCustomNotes.length === 0) {
        showToast(currentLang === 'ta' ? "பட்டியலில் உள்ள பொருட்களைக் கண்டறிய முடியவில்லை!" : "Could not resolve any items from the shopping list!", "error");
        return;
      }

      renderQuickOrderReview();
    }

    function renderQuickOrderReview() {
      const listContainer = document.getElementById('quick-order-items-review-list');
      listContainer.innerHTML = '';

      if (quickOrderCart.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 11.5px; padding: 12px;">No system resolved items.</div>`;
      } else {
        quickOrderCart.forEach((item, index) => {
          const unitDisplay = getUnitDisplay(item.unit, currentLang === 'ta', item.weightGrams);
          let quantityText = "";

          if (item.isWeight) {
            const kgVal = (item.weightGrams / 1000).toFixed(2);
            quantityText = currentLang === 'ta' ? `${kgVal} கிலோ` : `${kgVal} Kg`;
          } else {
            quantityText = `${item.weightGrams} ${unitDisplay}`;
          }

          const rowHtml = `
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); padding: 10px 12px; border-radius: 12px; gap: 8px;">
              <div style="min-width: 0; flex: 1;">
                <h5 style="margin: 0; font-size: 12px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${currentLang === 'ta' ? item.tamilName : item.name}
                </h5>
                <p style="margin: 2px 0 0 0; font-size: 10.5px; color: var(--accent-orange); font-weight: 600;">
                  ${quantityText} • ₹${item.totalPrice}
                </p>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <button class="btn btn-secondary" onclick="adjustQuickOrderItemQuantity(${index}, -1)" style="width: 28px !important; height: 28px !important; min-width: unset !important; min-height: unset !important; padding: 0 !important; border-radius: 8px !important; font-size: 14px; font-weight: bold; background: #1c1c1e; border: 1px solid #2c2c2e; color: #fff;">-</button>
                <button class="btn btn-secondary" onclick="adjustQuickOrderItemQuantity(${index}, 1)" style="width: 28px !important; height: 28px !important; min-width: unset !important; min-height: unset !important; padding: 0 !important; border-radius: 8px !important; font-size: 14px; font-weight: bold; background: #1c1c1e; border: 1px solid #2c2c2e; color: #fff;">+</button>
                <button class="btn btn-secondary" onclick="deleteQuickOrderItem(${index})" style="width: 28px !important; height: 28px !important; min-width: unset !important; min-height: unset !important; padding: 0 !important; border-radius: 8px !important; font-size: 11px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; margin-left: 4px;">✕</button>
              </div>
            </div>
          `;
          listContainer.innerHTML += rowHtml;
        });
      }

      const notesSection = document.getElementById('quick-order-custom-notes-section');
      const notesList = document.getElementById('quick-order-custom-notes-list');
      if (quickOrderCustomNotes.length > 0) {
        notesSection.style.display = 'block';
        notesList.innerHTML = quickOrderCustomNotes.map(n => `• ${n}`).join('<br>');
      } else {
        notesSection.style.display = 'none';
      }

      recalculateQuickOrderBill();

      const activeUser = (typeof getActiveUser === 'function' ? getActiveUser() : null) || {};
      const usersList = (typeof getData === 'function' ? getData('ek_users', []) : []) || [];
      const matchedUser = usersList.find(u => u && (u.id === activeUser.id || (activeUser.phone && u.phone === activeUser.phone))) || {};

      let phone = activeUser.phone || matchedUser.phone || "-";
      let address = activeUser.address || matchedUser.address || "-";

      const phoneEl = document.getElementById('quick-order-review-phone');
      if (phoneEl) {
        phoneEl.innerText = (phone && phone !== '-') ? `+91 ${phone.replace(/\D/g, '').slice(-10)}` : "-";
      }

      const addrEl = document.getElementById('quick-order-review-address');
      if (addrEl) {
        if (address && address !== '-' && typeof formatAddressStringToPostal === 'function') {
          addrEl.innerHTML = formatAddressStringToPostal(address);
        } else {
          addrEl.innerText = address;
        }
      }

      selectQuickOrderPayment('CASH');

      document.getElementById('quick-order-input-container').style.display = 'none';
      document.getElementById('quick-order-review-container').style.display = 'flex';
    }

    function adjustQuickOrderItemQuantity(index, direction) {
      const item = quickOrderCart[index];
      if (!item) return;

      if (item.isWeight) {
        const step = 250;
        item.weightGrams = Math.max(100, item.weightGrams + (direction * step));
        item.totalPrice = (item.weightGrams / 1000) * item.pricePerKg;
      } else {
        item.weightGrams = Math.max(1, item.weightGrams + direction);
        item.totalPrice = item.weightGrams * item.pricePerKg;
      }
      item.totalPrice = Math.round(item.totalPrice);

      renderQuickOrderReview();
    }

    function deleteQuickOrderItem(index) {
      quickOrderCart.splice(index, 1);
      renderQuickOrderReview();
    }

    function recalculateQuickOrderBill() {
      const subtotal = quickOrderCart.reduce((acc, curr) => acc + curr.totalPrice, 0);

      const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      let customerProfile = null;
      if (user) {
        customerProfile = getData('ek_users', []).find(u => u.id === user.uid);
      }

      const financials = calculateOrderFinancials(subtotal, customerProfile, "", false, quickOrderCart);

      document.getElementById('quick-order-review-subtotal').innerText = `₹${financials.subtotal}`;
      document.getElementById('quick-order-review-delivery').innerText = `₹${financials.deliveryFee}`;
      document.getElementById('quick-order-review-total').innerText = `₹${financials.grandTotal}`;
    }

    async function placeQuickOrder() {
      const btn = (typeof event !== 'undefined' && event && event.target) ? event.target.closest('button, .btn') : document.querySelector('button[onclick*="placeQuickOrder"]');
      if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, true);
      try {
        const custSession = typeof getActiveSession === 'function' ? getActiveSession() : null;
        if (!custSession || !custSession.loggedIn) {
          showToast(
            typeof currentLang !== 'undefined' && currentLang === 'ta'
              ? "ஆர்டர் செய்ய முதலில் லாகின் அல்லது பதிவு செய்து கொள்ளவும்!"
              : "Please login or register to place your order!",
            "warning"
          );
          if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
          showScreen('screen-login');
          return;
        }

        if (quickOrderCart.length === 0) {
        showToast(currentLang === 'ta' ? "உங்களது ஆர்டர் பட்டியல் காலியாக உள்ளது!" : "Your order items list is empty!", "error");
        return;
      }

      const settings = getSettings();
      if (settings.leaveMode) {
        showCustomAlert(
          currentLang === 'ta' ? "🌴 விடுமுறை அறிவிப்பு" : "🌴 Holiday / Leave Notice",
          settings.leaveNotice || (currentLang === 'ta' ? "மன்னிக்கவும்! கடை தற்காலிகமாக விடுமுறையில் உள்ளது. ஆர்டர் செய்ய இயலாது." : "Sorry, the shop is currently closed on holiday. Ordering is temporarily paused.")
        );
        return;
      }

      if (window.isPlacingOrder) {
        showToast(currentLang === 'ta' ? "மன்னிக்கவும்! ஒரு ஆர்டர் ஏற்கனவே செயலாக்கத்தில் உள்ளது." : "Please wait! Your order is already being processed.", "warning");
        return;
      }

      const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      if (!user) {
        showToast(currentLang === 'ta' ? "ஆர்டர் செய்ய முதலில் லாகின் செய்யவும்!" : "Login Required. Please login before placing an order.", "error");
        showScreen('screen-login');
        return;
      }

      const customerProfile = getData('ek_users', []).find(u => u.id === user.uid);
      if (!customerProfile) {
        showToast("பயனர் விவரங்களைக் கண்டறிய முடியவில்லை! (User details not found!)", "error");
        return;
      }

      const address = customerProfile.address || "";
      if (!address) {
        showToast(currentLang === 'ta' ? "தயவுசெய்து உங்கள் சுயவிவரத்தில் விநியோக முகவரியைச் சேர்க்கவும்!" : "Please add a delivery address in your profile first!", "error");
        return;
      }

      const finalLat = customerProfile.latitude ? parseFloat(customerProfile.latitude) : null;
      const finalLng = customerProfile.longitude ? parseFloat(customerProfile.longitude) : null;

      if (finalLat === null || isNaN(finalLat) || finalLng === null || isNaN(finalLng)) {
        showToast(currentLang === 'ta' ? "முகவரி வரைபடத்தில் சரியாக அமைக்கப்படவில்லை. வரைபடத்தில் முகவரியை அமைக்கவும்!" : "Delivery address location is not pinned on map. Please update it in profile page first!", "error");
        return;
      }

      const subtotal = quickOrderCart.reduce((acc, curr) => acc + curr.totalPrice, 0);
      const minWeightGrams = parseFloat(settings.minOrderWeight || 50);
      const minOrderAmount = parseFloat(settings.minOrderAmount || 0);
      const basketTotalWeight = quickOrderCart.reduce((acc, item) => acc + item.weightGrams, 0);

      if (basketTotalWeight < minWeightGrams) {
        showToast(`குறைந்தபட்ச ஆர்டர் எடை (${minWeightGrams}g) இல்லை! (Minimum order weight requirement is not met!)`, "error");
        return;
      }
      if (subtotal < minOrderAmount) {
        showToast(`குறைந்தபட்ச ஆர்டர் தொகை (₹${minOrderAmount}) இல்லை! (Minimum order amount requirement is not met!)`, "error");
        return;
      }

      const financials = calculateOrderFinancials(subtotal, customerProfile, "", false, quickOrderCart);
      const randomID = generateUniqueOrderId();

      let loyaltyMultiplier = 1.0;
      if (customerProfile.tier === 'silver') {
        loyaltyMultiplier = 1.5;
      } else if (customerProfile.tier === 'gold') {
        loyaltyMultiplier = 2.0;
      }
      const pointsEarned = Math.floor((financials.grandTotal / 100) * 10 * loyaltyMultiplier);

      let notesText = "";
      if (quickOrderCustomNotes.length > 0) {
        notesText = "📝 [SHOPPING LIST MANUAL SOURCING ITEMS]:\n" + quickOrderCustomNotes.map(n => `- ${n}`).join('\n');
      }

      const order = {
        id: randomID,
        userId: user.uid,
        customerId: user.uid,
        customerName: customerProfile.name || "Customer / வாடிக்கையாளர்",
        customerPhone: customerProfile.phone || user.phoneNumber || "",
        customerFcmToken: customerProfile.fcmToken || customerProfile.realFcmToken || (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getFcmToken === 'function' ? AndroidStorage.getFcmToken() : ''),
        deliveryAddress: address,
        deliveryLatitude: finalLat,
        deliveryLongitude: finalLng,
        deliveryTimeSlot: "Instant Delivery / விரைவான விநியோகம்",
        paymentMethod: quickOrderPaymentMethod === 'CASH' ? 'Cash on Delivery (COD)' : quickOrderPaymentMethod,
        paymentStatus: quickOrderPaymentMethod === 'CASH' ? 'UNPAID' : 'PENDING',
        needsPaymentVerification: false,
        items: quickOrderCart.map(item => ({
          productId: item.productId,
          name: item.name,
          tamilName: item.tamilName,
          pricePerKg: item.pricePerKg,
          weightGrams: item.weightGrams,
          totalPrice: item.totalPrice,
          imageUrl: item.imageUrl,
          category: item.category
        })),
        subtotalAmount: financials.subtotal,
        deliveryFee: financials.deliveryFee,
        expressDelivery: true,
        loyaltyPointsUsed: 0,
        loyaltyDiscount: 0,
        accruedPoints: pointsEarned,
        appliedCouponCode: "",
        couponDiscount: 0,
        totalAmount: financials.grandTotal,
        status: 'pending',
        orderSource: 'MANUAL',
        notes: notesText, // Sourced manual items
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Pre-flight catalog stock check (Read-only quick verification)
      const catalogCurrentProds = (typeof getData === 'function') ? getData('ek_products', []) : [];
      for (const item of (order.items || [])) {
        if (!item.productId) continue;
        const catalogItem = catalogCurrentProds.find(p => p.id === item.productId);
        if (catalogItem && catalogItem.stockKg !== undefined && catalogItem.stockKg !== null) {
          const unit = (item.unit || catalogItem.unit || 'kg').toLowerCase();
          const isWeight = !(unit === 'piece' || unit === 'packet' || unit === 'bunch' || unit === 'dozen' || unit === 'unit');
          const needed = isWeight ? ((parseFloat(item.weightGrams) || 0) / 1000) : (parseFloat(item.weightGrams) || 0);
          if (parseFloat(catalogItem.stockKg) < needed) {
            const pName = catalogItem.tamilName || catalogItem.englishName || item.name;
            const outMsg = (typeof currentLang !== 'undefined' && currentLang === 'ta')
              ? `மன்னிக்கவும்! '${pName}' கையிருப்பு பற்றாக்குறையாக உள்ளது.`
              : `Sorry! '${pName}' is insufficient in stock.`;
            showCustomAlert((typeof currentLang !== 'undefined' && currentLang === 'ta') ? "⚠️ கையிருப்பு இல்லை" : "⚠️ Out of Stock", outMsg);
            showToast(outMsg, "error");
            window.isPlacingOrder = false;
            return;
          }
        }
      }

      if (quickOrderPaymentMethod === 'UPI') {
        window.isPlacingOrder = true;
        showToast(currentLang === 'ta' ? "யுபிஐ செலுத்துதல் துவங்குகிறது... ⏳" : "UPI Payment Initializing... ⏳", "info");

        const pendingOrderData = {
          order: order,
          customerProfile: customerProfile,
          address: address,
          finalLat: finalLat,
          finalLng: finalLng,
          pointsEarned: pointsEarned,
          financials: financials,
          user: user ? { uid: user.uid, email: user.email || '', phoneNumber: user.phoneNumber || '' } : null,
          cartSnapshot: order.items,
          appliedCouponSnapshot: ""
        };
        window.pendingUpiOrderData = pendingOrderData;
        window.currentUpiAttemptAccount = 'primary';
        saveData('ek_pending_upi_order_data', pendingOrderData);

        const activeAcc = typeof getLiveUpiAccount === 'function'
          ? getLiveUpiAccount(settings)
          : (typeof getActiveUpiAccount === 'function' ? getActiveUpiAccount(settings) : null);
        const upiSettings = (settings && settings.upiSettings) || { upiEnabled: true, currency: 'INR' };
        let upiMerchantId = (activeAcc && activeAcc.upiId) || (settings && settings.merchantUpiId) || '8778148899@ptyes';
        let upiMerchantName = (activeAcc && (activeAcc.merchantName || activeAcc.displayName)) || (settings && settings.merchantName) || "Edappadi Kadai";
        let upiTxnNote = (activeAcc && activeAcc.note) ? activeAcc.note.replace(/{id}/g, order.id).replace(/{orderId}/g, order.id) : `Order ${order.id} - Edappadi Kadai`;
        let upiCurrency = upiSettings.currency || 'INR';

        const upiAmount = order.totalAmount.toFixed(2);
        const upiTxnRef = order.id;
        const upiUri = `upi://pay?pa=${encodeURIComponent(upiMerchantId)}&pn=${encodeURIComponent(upiMerchantName)}&tr=${encodeURIComponent(upiTxnRef)}&tn=${encodeURIComponent(upiTxnNote)}&am=${upiAmount}&cu=${encodeURIComponent(upiCurrency)}`;

        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.startUpiPayment === 'function') {
          debugLog("[UPI Payment] Launching native UPI chooser:", upiUri);
          const successLaunch = AndroidStorage.startUpiPayment(upiUri);
          if (!successLaunch) {
            showToast("யுபிஐ செயலியை திறப்பதில் சிக்கல்! (Failed to launch UPI apps!)", "error");
            window.isPlacingOrder = false;
          }
        } else {
          console.warn("[UPI Payment] AndroidStorage is undefined. Simulating UPI payment in browser preview.");
          showCustomConfirm(
            currentLang === 'ta' ? "📱 யுபிஐ சோதனை" : "📱 UPI Simulation",
            currentLang === 'ta'
              ? `[Web Preview] யுபிஐ பணம் செலுத்துதல் வெற்றிகரமாக முடிந்ததா என சோதிக்க விரும்புகிறீர்களா?\n\nமொத்தம்: ₹${upiAmount}\nபெறுநர்: ${upiMerchantId}`
              : `[Web Preview] Would you like to simulate a successful UPI payment response?\n\nTotal: ₹${upiAmount}\nMerchant: ${upiMerchantId}`,
            () => {
              setTimeout(() => {
                if (typeof window.onAndroidUpiPaymentResult === 'function') {
                  window.onAndroidUpiPaymentResult(`SUCCESS_NO_RESPONSE_DATA&txnid=TXN_SIM_${Date.now()}&status=SUCCESS`);
                }
              }, 800);
            },
            () => {
              setTimeout(() => {
                if (typeof window.onAndroidUpiPaymentResult === 'function') {
                  window.onAndroidUpiPaymentResult('CANCELLED');
                }
              }, 800);
            }
          );
        }
      } else {
        window.isPlacingOrder = true;
        showToast("Processing Order / ஆர்டர் செய்யப்படுகிறது... ⏳", "info");
        showLyoTransitLoader(currentLang === 'ta' ? "உங்களுக்காக ஸ்பெஷலாக ஆர்டர் செய்யப்படுகிறது... 🥩🥦" : "Processing your secure order... 🥩🥦", 1200);

        try {
          await completeOrderPlacement(order, customerProfile, address, finalLat, finalLng, pointsEarned, financials, user, order.items, "");
          goBackToHomeFromQuickOrder();
        } catch (placeErr) {
          console.error("placeQuickOrder completeOrderPlacement failed:", placeErr);
          showToast("Quick order error: " + (placeErr.message || placeErr), "error");
        } finally {
          window.isPlacingOrder = false;
          try { hideLoadingModal(); } catch(e) {}
          try { hideLyoTransitLoader(); } catch(e) {}
        }
      }
      } finally {
        if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
      }
    }

    async function applyQuickOrderResolutions() {
      try {
        const modal = document.getElementById('ai-shopping-assistant-modal');
        if (modal) {
          modal.style.display = 'none';
        }

        const targetOrderId = window.activeResolutionOrderId || (modal && modal.dataset && modal.dataset.orderId) || window.currentResolutionOrderId;

        let appliedCount = 0;

        if (targetOrderId) {
          if (typeof db !== 'undefined' && db) {
            const orderRef = db.collection('ek_orders').doc(targetOrderId);
            const docSnap = await orderRef.get();
            if (docSnap.exists) {
              const orderData = docSnap.data();
              const updatedNotes = (orderData.notes || '').replace(/📝 \[SHOPPING LIST MANUAL SOURCING ITEMS\]:/g, '✅ [AI RESOLVED SOURCING ITEMS]:');
              await orderRef.update({
                notes: updatedNotes,
                aiResolved: true,
                aiResolutionTimestamp: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });

              const cachedOrders = getData('ek_orders', []);
              const idx = cachedOrders.findIndex(o => o.id === targetOrderId);
              if (idx !== -1) {
                cachedOrders[idx].notes = updatedNotes;
                cachedOrders[idx].aiResolved = true;
                saveData('ek_orders', cachedOrders);
              }
              appliedCount++;
            }
          }
        }

        const orders = getData('ek_orders', []);
        const pendingAiOrders = orders.filter(o => o && o.notes && o.notes.includes('[SHOPPING LIST MANUAL SOURCING ITEMS]') && !o.aiResolved);

        for (const pOrder of pendingAiOrders) {
          if (typeof db !== 'undefined' && db) {
            try {
              const orderRef = db.collection('ek_orders').doc(pOrder.id);
              const updatedNotes = pOrder.notes.replace(/📝 \[SHOPPING LIST MANUAL SOURCING ITEMS\]:/g, '✅ [AI RESOLVED SOURCING ITEMS]:');
              await orderRef.update({
                notes: updatedNotes,
                aiResolved: true,
                aiResolutionTimestamp: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
              pOrder.notes = updatedNotes;
              pOrder.aiResolved = true;
              appliedCount++;
            } catch (err) {
              console.warn("Failed to update Firestore for order " + pOrder.id, err);
            }
          }
        }

        if (pendingAiOrders.length > 0) {
          saveData('ek_orders', orders);
        }

        if (typeof quickOrderCustomNotes !== 'undefined' && quickOrderCustomNotes.length > 0) {
          quickOrderCustomNotes = [];
          if (typeof renderQuickOrderReview === 'function') {
            renderQuickOrderReview();
          }
          appliedCount++;
        }

        showToast(
          currentLang === 'ta' 
            ? "AI ஆர்டர் தீர்வுகள் வெற்றிகரமாக பயன்படுத்தப்பட்டன! ✨" 
            : "AI order resolutions applied successfully! ✨", 
          "success"
        );

        if (typeof renderAdminOrders === 'function') {
          try { renderAdminOrders(); } catch(e) { console.error(e); }
        }
        if (typeof renderAdminDashboard === 'function') {
          try { renderAdminDashboard(); } catch(e) { console.error(e); }
        }
      } catch (err) {
        console.error("applyQuickOrderResolutions error:", err);
        showToast("Error applying AI resolutions: " + (err.message || err), "error");
      }
    }

    function bootstrapApplication() {
      // 0. PRESERVE & SYNC LOCAL / NATIVE CACHED DATA IMMEDIATELY
      try {
        if (typeof AndroidStorage !== "undefined") {
          const syncKeys = [
            "ek_products", "ek_settings", "ek_orders", "ek_users",
            "ek_delivery_persons", "ek_admin_accounts", "ek_admin_session",
            "ek_customer_session", "ek_delivery_session", "ek_lyo_ai_config", "ek_last_update", "ek_lang",
            "ek_remembered_credentials", "ek_categories", "ek_coupons",
            "ek_deleted_order_ids", "ek_deleted_product_ids", "ek_deleted_user_ids", "ek_deleted_rider_ids",
            "ek_deleted_admin_ids", "ek_deleted_coupon_ids"
          ];
          syncKeys.forEach(k => {
            try {
              const val = AndroidStorage.getData(k, "");
              if (val && val.trim() !== "" && val !== "null" && val !== "[]" && val !== "{}") {
                localStorage.setItem(k, val);
              }
            } catch(e){}
          });
        }
      } catch(e){}
      // 1. INSTANT SYNCHRONOUS LOCAL SESSION ROUTING (Zero Network Wait)
      try {
        if (typeof enforceRememberMeValidationOnStartup === 'function') enforceRememberMeValidationOnStartup();
        if (typeof validateAndSanitizeSessions === 'function') validateAndSanitizeSessions();

        const urlParams = new URLSearchParams(window.location.search);
        const trackOrderIdParam = urlParams.get("trackOrderId");
        
        if (trackOrderIdParam) {
          selectedTrackOrderId = trackOrderIdParam.trim();
          showScreen("screen-track");
          renderTrackerScreen();
        } else {
          const adminSession = typeof getAdminSession === 'function' ? getAdminSession() : null;
          const custSession = typeof getActiveSession === 'function' ? getActiveSession() : null;
          const deliverySession = typeof getData === 'function' ? getData('ek_delivery_session', null) : null;

          if (adminSession && adminSession.loggedIn) {
            showScreen('screen-admin');
          } else if (deliverySession && deliverySession.loggedIn) {
            showScreen('screen-delivery');
          } else if (custSession && custSession.loggedIn) {
            showScreen('screen-home');
          } else {
            showScreen('screen-home');
          }
        }
        hideLoadingModal();
        hideLyoTransitLoader();
        try {
          if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.notifyAppLoaded === 'function') {
            AndroidStorage.notifyAppLoaded();
          }
        } catch (ae) {}
      } catch (e) {
        console.error('[Instant Session Route] Synchronous local routing failed:', e);
      }

      try {
        const LATEST_VERSION = "9.0.0";
        const lastVersion = localStorage.getItem('ek_app_version');
        if (lastVersion !== LATEST_VERSION) {
          debugLog("[Cache Buster] Version mismatch. Upgrading from " + lastVersion + " to " + LATEST_VERSION);

          const keysToClear = ['ek_last_update'];

          keysToClear.forEach(k => {
            localStorage.removeItem(k);
            if (typeof AndroidStorage !== 'undefined') {
              try {
                AndroidStorage.saveData(k, "");
              } catch(ae) {}
            }
          });

          localStorage.setItem('ek_app_version', LATEST_VERSION);
          debugLog("[Cache Buster] Cached background data purged successfully for version " + LATEST_VERSION);
        }
      } catch (verErr) {
        console.error("Cache buster execution failed:", verErr);
      }

      try {
        initApp();
      } catch (e) {
        console.error("initApp failed:", e);
      }

      try {
        runAbsoluteCleanupForThreeProducts();
      } catch (e) {
        console.error("runAbsoluteCleanupForThreeProducts failed:", e);
      }

      try {
        attachInfiniteScrollListener();
      } catch (e) {
        console.error("attachInfiniteScrollListener failed:", e);
      }

      try {
        if (typeof migratePasswordsToHash === 'function') {
          migratePasswordsToHash();
        } else if (typeof window !== 'undefined' && typeof window.migratePasswordsToHash === 'function') {
          window.migratePasswordsToHash();
        }
      } catch (err) {
        console.warn("Failed to migrate passwords during bootstrap:", err);
      }

      try {
        localStorage.setItem('ek_lang', 'en');
        currentLang = 'en';
        if (typeof AndroidStorage !== 'undefined') {
          try { AndroidStorage.saveData('ek_lang', 'en'); } catch(e) {}
        }
      } catch (e) {
        console.error("Language reset failed:", e);
      }

      debugLog("[Slate Purge] Bypassed legacy demo products purge block to preserve active user products and deletion safeguards.");

      // Run heavy background maintenance tasks asynchronously to keep startup instantaneous
      setTimeout(() => {
        try {
          if (typeof db !== 'undefined' && db) {
            db.collection('ek_tombstones').get().then(snapshot => {
              if (snapshot && !snapshot.empty) {
                snapshot.forEach(doc => {
                  const docId = doc.id;
                  const cloudIds = doc.data()?.ids || [];
                  if (Array.isArray(cloudIds) && cloudIds.length > 0) {
                    let localList = [];
                    if (docId === 'ek_deleted_product_ids') localList = typeof getDeletedProductIds === 'function' ? getDeletedProductIds() : [];
                    else if (docId === 'ek_deleted_order_ids') localList = typeof getDeletedOrderIds === 'function' ? getDeletedOrderIds() : [];
                    else if (docId === 'ek_deleted_user_ids') localList = typeof getDeletedUserIds === 'function' ? getDeletedUserIds() : [];
                    else if (docId === 'ek_deleted_rider_ids') localList = typeof getDeletedRiderIds === 'function' ? getDeletedRiderIds() : [];
                    else if (docId === 'ek_deleted_admin_ids') localList = typeof getDeletedAdminIds === 'function' ? getDeletedAdminIds() : [];
                    else if (docId === 'ek_deleted_coupon_ids') localList = typeof getDeletedCouponIds === 'function' ? getDeletedCouponIds() : [];

                    if (!Array.isArray(localList)) localList = [];
                    const mergedMap = new Set([...localList, ...cloudIds]);
                    let mergedList = Array.from(mergedMap);
                    if (docId === 'ek_deleted_product_ids' && mergedList.length > 500) {
                      mergedList = mergedList.slice(-500);
                      const adminSession = typeof getAdminSession === 'function' ? getAdminSession() : null;
                      if (adminSession && adminSession.loggedIn && typeof db !== 'undefined' && db) {
                        db.collection('ek_tombstones').doc(docId).set({
                          ids: mergedList,
                          updatedAt: new Date().toISOString()
                        }).catch(() => {});
                      }
                    }
                    saveData(docId, mergedList);
                    if (docId === 'ek_deleted_order_ids') {
                      if (typeof pruneLocalDeletedOrders === 'function') pruneLocalDeletedOrders();
                    } else if (docId === 'ek_deleted_product_ids') {
                      if (typeof pruneLocalDeletedProducts === 'function') pruneLocalDeletedProducts();
                    } else if (docId === 'ek_deleted_user_ids') {
                      if (typeof pruneLocalDeletedUsers === 'function') pruneLocalDeletedUsers();
                    } else if (docId === 'ek_deleted_rider_ids') {
                      if (typeof pruneLocalDeletedRiders === 'function') pruneLocalDeletedRiders();
                    } else if (docId === 'ek_deleted_coupon_ids') {
                      if (typeof pruneLocalDeletedCoupons === 'function') pruneLocalDeletedCoupons();
                    } else if (docId === 'ek_deleted_admin_ids') {
                      const admins = typeof getData === 'function' ? getData('ek_admin_accounts', []) : [];
                      const filtered = admins.filter(a => a && !mergedList.includes(a.id) && !mergedList.includes(a.phone));
                      if (admins.length !== filtered.length) {
                        saveData('ek_admin_accounts', filtered);
                      }
                    }
                  }
                });
              }
            }).catch(err => console.warn("[Tombstone Background Sync] Fetch failed:", err));
          }
        } catch (e) {}

        try { seedDatabase(); } catch (e) {}
        try { migrateBase64ImagesToStorage(); } catch (e) {}
        try { archiveOldOrders(); } catch (e) {}
      }, 2500);

      function startRealtimeSync() {
        if (typeof setupCloudRealtimeListeners2 === 'function') {
          setupCloudRealtimeListeners2();
        }
      }

// Pending UPI Order Recovery — checks on app startup if a UPI payment was abandoned
function recoverPendingUpiOrder() {
  try {
    const pendingData = getData('ek_pending_upi_order_data', null);
    if (!pendingData || !pendingData.order) return;

    const createdAt = pendingData.order.createdAt ? new Date(pendingData.order.createdAt) : null;
    if (!createdAt) {
      removeData('ek_pending_upi_order_data');
      window.pendingUpiOrderData = null;
      return;
    }

    const elapsed = Date.now() - createdAt.getTime();
    const fiveMin = 5 * 60 * 1000;

    if (elapsed > fiveMin) {
      // UPI payment was abandoned — clean up and notify user
      const orderAmount = pendingData.order.totalAmount || 0;
      showToast(
        currentLang === 'ta'
          ? `முந்தைய UPI செலுத்துதல் முடிக்கப்படவில்லை. கையிருப்பு மீண்டும் சேர்க்கப்படும். மீண்டும் ஆர்டர் செய்யவும்.`
          : `Previous UPI payment was not completed. Stock will be restored. Please place your order again.`,
        "warning"
      );

      // Clean up pending data
      removeData('ek_pending_upi_order_data');
      window.pendingUpiOrderData = null;

      console.log('[UPI Recovery] Cleaned up abandoned UPI order data. Amount: ₹' + orderAmount);
    } else {
      // Within 5 minutes — keep the pending data for UPI callback
      window.pendingUpiOrderData = pendingData;
      console.log('[UPI Recovery] Pending UPI order found, waiting for callback. Elapsed: ' + Math.round(elapsed / 1000) + 's');
    }
  } catch (err) {
    console.error('[UPI Recovery] Error:', err);
    removeData('ek_pending_upi_order_data');
    window.pendingUpiOrderData = null;
  }
}

// Run recovery on script load
recoverPendingUpiOrder();

     if (typeof prefillLoginCredentials === "function") prefillLoginCredentials(); if (typeof populateAdminSelector === "function") populateAdminSelector(); if (typeof updateNotificationUnreadCount === "function") updateNotificationUnreadCount(); if (typeof updateCartBadge === "function") updateCartBadge(); if (typeof applyTranslations === "function") applyTranslations(); if (typeof startRealtimeSync === "function") startRealtimeSync(); if (typeof registerRealFcmToken === "function") registerRealFcmToken();

      // Parallel Concurrent Data Fetching (Settings, Products, Selector Accounts, Meta Sync)
      const tasks = [];
      if (typeof fetchSettingsOnce === 'function') tasks.push(fetchSettingsOnce().catch(e => console.warn("fetchSettingsOnce async error:", e)));
      if (typeof fetchProductsOnce === 'function') tasks.push(fetchProductsOnce().catch(e => console.warn("fetchProductsOnce async error:", e)));
      if (typeof fetchSelectorAccounts === 'function') tasks.push(fetchSelectorAccounts().catch(e => console.warn("fetchSelectorAccounts async error:", e)));
      if (typeof syncWithCloud === 'function') tasks.push(syncWithCloud().catch(e => console.warn("syncWithCloud async error:", e)));

      Promise.all(tasks).then(() => {
        try {
          window._isSettingsFetched = true;
          window._hasFreshSettings = true;
          checkAndUpdateFreshCloudData();
          hideLoadingModal();
          hideLyoTransitLoader();
          if (typeof AndroidStorage !== 'undefined') {
            try {
              if (typeof AndroidStorage.notifyAppLoaded === 'function') AndroidStorage.notifyAppLoaded();
              if (typeof AndroidStorage.onJsAppLoaded === 'function') AndroidStorage.onJsAppLoaded();
            } catch (ae) {}
          }
          if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-admin' && typeof renderAdminDashboard === 'function') {
            renderAdminDashboard();
          } else if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-home') {
            if (typeof scheduleRealtimeHomeRender === 'function') {
              scheduleRealtimeHomeRender(false);
            } else if (typeof renderHomeScreenProducts === 'function') {
              renderHomeScreenProducts(false);
            }
          }
        } catch (e) {
          console.error("Background data refresh completion error:", e);
        }
      });

      try {
        if (typeof runTimeScheduler === "function") {
          runTimeScheduler();
          if (window._timeSchedulerInterval) clearInterval(window._timeSchedulerInterval);
          window._timeSchedulerInterval = setInterval(() => {
            if (document.hidden || window._isAppBackgrounded) return;
            runTimeScheduler();
          }, 60000);
        }
      } catch (e) {
        console.error("Time scheduler initialization failed:", e);
      }
    }

    let isBootstrapCalled = false;
    function safeBootstrap() {
      if (isBootstrapCalled) return;
      isBootstrapCalled = true;
      debugLog("[Bootstrap] safeBootstrap triggered successfully!");
      try {
        localStorage.setItem('hide_hero_banner', 'false');
        localStorage.setItem('hide_specials_section', 'false');
        localStorage.setItem('hide_loyalty_wallet', 'false');
      } catch(e) {}
      bootstrapApplication();
      try {
        if (typeof AndroidStorage !== 'undefined') {
          if (typeof AndroidStorage.onJsAppLoaded === 'function') AndroidStorage.onJsAppLoaded();
          if (typeof AndroidStorage.notifyAppLoaded === 'function') AndroidStorage.notifyAppLoaded();
        }
      } catch (e) {}
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      safeBootstrap();
    } else {
      window.addEventListener('DOMContentLoaded', safeBootstrap);
      window.addEventListener('load', safeBootstrap);
      // deferred until all scripts loaded
    }

    const DEFAULT_COUPONS = [
      { id: 'c1', code: 'WELCOME10', type: 'percentage', rate: 10, minAmount: 199, descEn: 'Get 10% OFF on all gourmet meat and veggies!', descTa: 'அனைத்து இறைச்சி மற்றும் காயறிகளுக்கு 10% தள்ளுபடி!' },
      { id: 'c2', code: 'FREEFRESH', type: 'freeship', rate: 0, minAmount: 299, descEn: 'Get FREE doorstep delivery on your delicious order!', descTa: 'குறைந்தபட்ச ஆர்டர் ₹299-க்கு இலவச டெலிவரி!' },
      { id: 'c3', code: 'SAVEMORE', type: 'fixed', rate: 50, minAmount: 499, descEn: 'Flat ₹50 cash discount on your grand feast order!', descTa: 'உங்கள் மொத்த ஆர்டருக்கும் ₹50 நேரடி தள்ளுபடி!' }
    ];

    function getCoupons() {
      const def = typeof DEFAULT_COUPONS !== 'undefined' ? DEFAULT_COUPONS : [];
      return (typeof getDataCached === 'function' ? getDataCached('ek_coupons', def) : (typeof getData === 'function' ? getData('ek_coupons', def) : def)) || def;
    }
    window.getCoupons = getCoupons;

    function saveCoupons(list) {
      if (typeof saveData === 'function') saveData('ek_coupons', list);
      if (db) {
        list.forEach(c => {
          db.collection('ek_coupons').doc(c.id).set(c).catch(err => {});
        });
      }
    }
    window.saveCoupons = saveCoupons;

    async function applyCartCouponCode() {
      const btn = (typeof event !== 'undefined' && event && event.target) ? event.target.closest('button, .btn') : document.querySelector('button[onclick*="applyCartCouponCode"]');
      if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, true);

      try {
        const inp = document.getElementById('cart-coupon-input');
        if (!inp) return;
        const code = inp.value.trim().toUpperCase();
        if (!code) {
          showToast(currentLang === 'ta' ? "மன்னிக்கவும்! கூப்பன் குறியீடு காலியாக உள்ளது." : "Please enter a coupon code!", "warning");
          return;
        }

        // Verify subtotal is valid
        const subtotal = cart.reduce((acc, curr) => acc + curr.totalPrice, 0);
        if (subtotal <= 0) {
          showToast(currentLang === 'ta' ? "கார்ட் காலியாக உள்ளது!" : "Your cart is empty!", "warning");
          return;
        }

        // Authenticated customer check
        const activeUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
        if (!activeUser || activeUser.isAnonymous) {
          showToast(
            currentLang === 'ta'
              ? "கூப்பனை பயன்படுத்த முதலில் உள்நுழைக (Please login to apply coupon)"
              : "Please login to apply promo coupon",
            "warning"
          );
          if (typeof showScreen === 'function') showScreen('screen-login');
          return;
        }

        let redeemedOnServer = false;
        let resData = null;

        // Try HTTPS Callable Cloud Function (Server Source of Truth) if available
        const redeemFn = (typeof firebase !== 'undefined' && firebase.functions)
          ? (typeof firebase.app === 'function' && typeof firebase.app().functions === 'function'
              ? firebase.app().functions('asia-south1').httpsCallable('redeemCoupon')
              : firebase.functions().httpsCallable('redeemCoupon'))
          : null;

        if (redeemFn) {
          try {
            const response = await redeemFn({
              couponCode: code,
              orderId: 'preview_' + Date.now(),
              cartSubtotal: subtotal
            });
            resData = (response && response.data) ? response.data : response;
            if (resData && resData.success === true && typeof resData.discountAmount === 'number') {
              redeemedOnServer = true;
            }
          } catch (cloudErr) {
            console.warn("[Coupon] Cloud function redeemCoupon unavailable or threw error, falling back to verified coupons catalog:", cloudErr);
          }
        }

        if (redeemedOnServer && resData) {
          appliedCouponCode = resData.couponCode || code;
          window.appliedCouponServerDiscount = resData.discountAmount;
          window.appliedCouponServerCode = appliedCouponCode;
          window.appliedCouponData = resData.coupon || null;

          if (typeof recalculateBill === 'function') recalculateBill();
          showToast(
            currentLang === 'ta'
              ? `கூப்பன் '${appliedCouponCode}' மூலம் ₹${resData.discountAmount} தள்ளுபடி பெறப்பட்டது! 🎉`
              : `Coupon '${appliedCouponCode}' applied! You saved ₹${resData.discountAmount}! 🎉`,
            "success"
          );
          inp.value = '';
          if (typeof triggerConfettiExplosion === 'function') triggerConfettiExplosion();
          playCelebrationSound();
          return;
        }

        // Fallback: Validate against authorized coupon registry
        const allCoupons = getCoupons();
        const matched = allCoupons.find(c => String(c.code).trim().toUpperCase() === code);

        if (!matched) {
          appliedCouponCode = null;
          window.appliedCouponServerDiscount = 0;
          window.appliedCouponServerCode = null;
          window.appliedCouponData = null;
          if (typeof recalculateBill === 'function') recalculateBill();
          showToast(currentLang === 'ta' ? "மன்னிக்கவும்! இந்த கூப்பன் குறியீடு செல்லாது அல்லது தவறானது." : "Invalid or unrecognized coupon code.", "error");
          return;
        }

        const minAmt = parseFloat(matched.minAmount || matched.minOrderAmount || 0);
        if (minAmt > 0 && subtotal < minAmt) {
          appliedCouponCode = null;
          window.appliedCouponServerDiscount = 0;
          window.appliedCouponServerCode = null;
          window.appliedCouponData = null;
          if (typeof recalculateBill === 'function') recalculateBill();
          showToast(
            currentLang === 'ta'
              ? `குறைந்தபட்ச ஆர்டர் தொகை ₹${minAmt} தேவை! (தற்போதைய கார்ட்: ₹${subtotal})`
              : `Minimum order of ₹${minAmt} required for coupon '${code}'! (Current: ₹${subtotal})`,
            "warning"
          );
          return;
        }

        let discountVal = 0;
        if (matched.type === 'percentage') {
          discountVal = Math.round((subtotal * (parseFloat(matched.rate) || 0)) / 100);
        } else if (matched.type === 'fixed') {
          discountVal = Math.min(subtotal, parseFloat(matched.rate) || 0);
        } else if (matched.type === 'freeship') {
          discountVal = 0;
        }

        appliedCouponCode = matched.code;
        window.appliedCouponServerDiscount = discountVal;
        window.appliedCouponServerCode = matched.code;
        window.appliedCouponData = matched;

        if (typeof recalculateBill === 'function') recalculateBill();

        const successMsg = matched.type === 'freeship'
          ? (currentLang === 'ta' ? `கூப்பன் '${appliedCouponCode}' மூலம் இலவச டெலிவரி வழங்கப்பட்டது! 🎉` : `Coupon '${appliedCouponCode}' applied! Free delivery activated! 🎉`)
          : (currentLang === 'ta' ? `கூப்பன் '${appliedCouponCode}' மூலம் ₹${discountVal} தள்ளுபடி பெறப்பட்டது! 🎉` : `Coupon '${appliedCouponCode}' applied! You saved ₹${discountVal}! 🎉`);

        showToast(successMsg, "success");
        inp.value = '';
        if (typeof triggerConfettiExplosion === 'function') triggerConfettiExplosion();
        playCelebrationSound();
      } catch (err) {
        appliedCouponCode = null;
        window.appliedCouponServerDiscount = 0;
        window.appliedCouponServerCode = null;
        window.appliedCouponData = null;
        if (typeof recalculateBill === 'function') recalculateBill();

        console.error("[Coupon Redemption Error]", err);
        const errMsg = err.message || err.details || (currentLang === 'ta' ? "கூப்பன் சரிபார்ப்பு தோல்வியடைந்தது." : "Failed to redeem coupon.");
        showToast(errMsg, "error");
      } finally {
        if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
      }
    }

    window.applyCartCouponCode = applyCartCouponCode;
    window.applyCoupon = applyCartCouponCode;

    function playCelebrationSound() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const playNote = (freq, delay, duration, gainVal) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

          gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
          gainNode.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + delay + 0.04);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration - 0.02);

          osc.type = 'sine';
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + duration);
        };

        playNote(523.25, 0.0, 0.35, 0.20);  // C5
        playNote(659.25, 0.1, 0.35, 0.20);  // E5
        playNote(783.99, 0.2, 0.35, 0.20);  // G5
        playNote(1046.50, 0.3, 0.5, 0.25);  // C6
      } catch (e) {
        console.warn("Coupon applied celebration chime error:", e);
      }
    }

    function triggerConfettiExplosion() {
      let canvas = document.getElementById('coupon-confetti-canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'coupon-confetti-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '10050';
        document.body.appendChild(canvas);
      }

      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      window.addEventListener('resize', function() {
        if (canvas && canvas.parentNode) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        }
      }, { once: true });

      const colors = [
        '#f59e0b', // Bright orange
        '#10b981', // Clean green
        '#3b82f6', // Electric blue
        '#ec4899', // Cotton candy pink
        '#8b5cf6', // Violet purple
        '#f43f5e', // Vibrant red
        '#06b6d4'  // Electric cyan
      ];

      const particles = [];
      const particleCount = 140;

      class ConfettiParticle {
        constructor(x, y, vx, vy) {
          this.x = x;
          this.y = y;
          this.size = Math.random() * 8 + 6;
          this.vx = vx;
          this.vy = vy;
          this.color = colors[Math.floor(Math.random() * colors.length)];
          this.rotation = Math.random() * 360;
          this.rotationSpeed = (Math.random() - 0.5) * 8;
          this.opacity = 1;
          this.scaleY = Math.random();
          this.shape = Math.random() > 0.45 ? 'rect' : (Math.random() > 0.4 ? 'circle' : 'triangle');
        }

        update() {
          this.x += this.vx;
          this.y += this.vy;
          this.vy += 0.16; // safe gravity
          this.vx *= 0.985; // air friction
          this.vy *= 0.985;
          this.rotation += this.rotationSpeed;
          this.scaleY = Math.sin(Date.now() / 200 + this.rotation) * 0.5 + 0.5;
          this.opacity -= 0.009; // smooth fade Out
        }

        draw() {
          if (this.opacity <= 0) return;
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate(this.rotation * Math.PI / 180);
          ctx.scale(1, this.scaleY);
          ctx.globalAlpha = this.opacity;
          ctx.fillStyle = this.color;

          ctx.beginPath();
          if (this.shape === 'rect') {
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
          } else if (this.shape === 'circle') {
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.moveTo(0, -this.size / 2);
            ctx.lineTo(this.size / 2, this.size / 2);
            ctx.lineTo(-this.size / 2, this.size / 2);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      }

      const leftX = 0;
      const rightX = canvas.width;
      const bottomY = canvas.height;

      for (let i = 0; i < particleCount / 2; i++) {
        const vx = Math.random() * 8 + 4;
        const vy = -(Math.random() * 12 + 10);
        particles.push(new ConfettiParticle(leftX, bottomY, vx, vy));
      }

      for (let i = 0; i < particleCount / 2; i++) {
        const vx = -(Math.random() * 8 + 4);
        const vy = -(Math.random() * 12 + 10);
        particles.push(new ConfettiParticle(rightX, bottomY, vx, vy));
      }

      function renderFrame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let stillActive = false;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.update();
          p.draw();
          if (p.opacity > 0 && p.y < canvas.height + 30) {
            stillActive = true;
          }
        }

        if (stillActive) {
          requestAnimationFrame(renderFrame);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
        }
      }

      requestAnimationFrame(renderFrame);
    }

    function removeCartCouponCode() {
      appliedCouponCode = null;
      window.appliedCouponServerDiscount = 0;
      window.appliedCouponServerCode = null;
      window.appliedCouponData = null;
      recalculateBill();
      showToast(currentLang === 'ta' ? "கூப்பன் நீக்கப்பட்டது." : "Coupon code retracted.", "info");
    }

    function renderAdminCoupons() {
      const list = getCoupons();
      const container = document.getElementById('admin-coupons-list');
      const countLabel = document.getElementById('admin-coupons-count');
      if (!container) return;

      container.innerHTML = '';
      if (countLabel) countLabel.innerText = `${list.length} active`;

      if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">${currentLang === 'ta' ? 'கூப்பன்கள் எதுவும் இல்லை.' : 'No active promo coupons defined yet.'}</div>`;
        return;
      }

      list.forEach(c => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.borderColor = 'rgba(245,158,11,0.2)';
        div.style.background = '#121214';
        div.style.marginBottom = '8px';
        div.style.display = 'flex';
        div.style.justify = 'space-between';
        div.style.alignItems = 'center';

        const typeLabel = c.type === 'percentage' ? `${c.rate}% Off` : c.type === 'fixed' ? `₹${c.rate} Off` : 'Free Shipping 🚚';
        div.innerHTML = `
          <div>
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <span class="badge" style="background:rgba(245,158,11,0.1); color:var(--accent-orange); font-weight:800; font-size:12px;">${c.code}</span>
              <span style="font-size:11.5px; font-weight:700; color:var(--accent-green);">${typeLabel}</span>
            </div>
            <p style="font-size:11.5px; color:#fff; font-weight:600; margin:2px 0;">🇬🇧 ${c.descEn}</p>
            <p style="font-size:11px; color:var(--text-secondary); margin:2px 0;">🇮🇳 ${c.descTa}</p>
            <span style="font-size:10px; color:var(--text-muted);">Min Order: ₹${c.minAmount}</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn" style="padding:6px 10px; font-size:11px; font-weight:700; width:auto; border-color:rgba(255,255,255,0.05); color:#fff;" onclick="editCoupon('${c.id}')">✏️</button>
            <button class="btn btn-secondary" style="padding:6px 10px; font-size:11px; font-weight:700; width:auto; border-color:#ef4444; color:#ef4444;" onclick="deleteCoupon('${c.id}')">🗑️</button>
          </div>
        `;
        container.appendChild(div);
      });
    }

    function onCouponTypeChange() {
      const type = document.getElementById('add-coupon-type').value;
      const rateLabel = document.getElementById('coupon-rate-label');
      const rateInput = document.getElementById('add-coupon-rate');

      if (type === 'freeship') {
        rateInput.value = '0';
        rateInput.disabled = true;
        rateLabel.innerText = "Discount Value (Disabled)";
      } else {
        rateInput.disabled = false;
        rateLabel.innerText = type === 'percentage'
          ? (currentLang === 'ta' ? "தள்ளுபடி சதவிகிதம் (%)" : "Discount Percentage (%)")
          : (currentLang === 'ta' ? "தள்ளுபடி தொகை (₹)" : "Discount Value (₹)");
      }
    }

    function handleCouponSave(event) {
      if (event) event.preventDefault();
      const btn = document.getElementById('coupon-submit-btn');
      if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, true);
      try {
        const id = document.getElementById('edit-coupon-id').value;
        const code = document.getElementById('add-coupon-code').value.trim().toUpperCase();
        const type = document.getElementById('add-coupon-type').value;
        const rate = parseInt(document.getElementById('add-coupon-rate').value) || 0;
        const minAmount = parseInt(document.getElementById('add-coupon-min').value) || 0;
        const descEn = document.getElementById('add-coupon-desc-en').value.trim();
        const descTa = document.getElementById('add-coupon-desc-ta').value.trim();

        if (!code || !descEn || !descTa) {
          showToast("Please enter all required fields", "warning");
          return;
        }

        let coupons = getCoupons();

        if (id) {
          const idx = coupons.findIndex(c => c.id === id);
          if (idx !== -1) {
            coupons[idx] = { id, code, type, rate, minAmount, descEn, descTa };
            if (typeof unmarkCouponAsDeleted === 'function') {
              unmarkCouponAsDeleted(id);
              unmarkCouponAsDeleted(code);
            }
            showToast(currentLang === 'ta' ? "கூப்பன் வெற்றிகரமாக புதுப்பிக்கப்பட்டது!" : "Coupon updated successfully!", "success");
          }
        } else {
          const existing = coupons.find(c => c.code === code);
          if (existing) {
            showToast(currentLang === 'ta' ? "மன்னிக்கவும்! இந்த கூப்பன் குறியீடு ஏற்கனவே உள்ளது." : "This Coupon code already exists!", "error");
            return;
          }
          const newC = {
            id: 'CP' + Math.floor(100000 + Math.random() * 900000),
            code,
            type,
            rate,
            minAmount,
            descEn,
            descTa
          };
          if (typeof unmarkCouponAsDeleted === 'function') {
            unmarkCouponAsDeleted(newC.id);
            unmarkCouponAsDeleted(code);
          }
          coupons.push(newC);
          showToast(currentLang === 'ta' ? "கூப்பன் வெற்றிகரமாக சேர்க்கப்பட்டது!" : "Coupon added successfully!", "success");
        }

        saveCoupons(coupons);
        renderAdminCoupons();
        resetCouponForm();
      } finally {
        if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
      }
    }

    function resetCouponForm() {
      document.getElementById('edit-coupon-id').value = '';
      document.getElementById('admin-coupon-form').reset();
      document.getElementById('coupon-submit-btn').innerText = (currentLang === 'ta' ? "கூப்பன் உருவாக்கு ✓" : "Create Coupon ✓");
      document.getElementById('coupon-cancel-btn').style.display = 'none';
      onCouponTypeChange();
    }

    function editCoupon(id) {
      const coupons = getCoupons();
      const c = coupons.find(x => x.id === id);
      if (!c) return;

      document.getElementById('edit-coupon-id').value = c.id;
      document.getElementById('add-coupon-code').value = c.code;
      document.getElementById('add-coupon-type').value = c.type;
      document.getElementById('add-coupon-rate').value = c.rate;
      document.getElementById('add-coupon-min').value = c.minAmount;
      document.getElementById('add-coupon-desc-en').value = c.descEn;
      document.getElementById('add-coupon-desc-ta').value = c.descTa;

      onCouponTypeChange();
      document.getElementById('coupon-submit-btn').innerText = (currentLang === 'ta' ? "கூப்பனை புதுப்பி ✓" : "Update Coupon ✓");
      document.getElementById('coupon-cancel-btn').style.display = 'inline-block';

      const formCard = document.getElementById('admin-coupon-form');
      if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });
    }

    function deleteCoupon(id) {
      const title = currentLang === 'ta' ? "கூப்பனை நீக்குவதா?" : "Delete Coupon?";
      const msg = currentLang === 'ta' ? "இந்த கூப்பனை நீக்க வேண்டுமா?" : "Are you sure you want to delete this coupon?";
      showCustomConfirm(
        title,
        msg,
        () => {
          let coupons = getCoupons();
          const target = coupons.find(c => c.id === id);
          coupons = coupons.filter(c => c.id !== id);

          // Mark as deleted in tombstone system to prevent sync recovery
          if (typeof markCouponAsDeleted === 'function') {
            markCouponAsDeleted(id);
            if (target && target.code) {
              markCouponAsDeleted(target.code);
            }
          }

          // Also delete directly from Firestore collection if cloud db is available
          if (typeof db !== 'undefined' && db && db.collection) {
            db.collection('ek_coupons').doc(id).delete().catch(() => {});
          }

          saveCoupons(coupons);
          renderAdminCoupons();
          showToast(currentLang === 'ta' ? "கூப்பன் வெற்றிகரமாக நீக்கப்பட்டது." : "Coupon was deleted successfully.", "success");
        },
        () => {
        }
      );
    }

    function updateProfileGamification() {
      const u = getActiveUser();
      if (!u) return;

      const allOrders = getData('ek_orders', []);
      const orders = allOrders.filter(o => o.customerId === u.id);
      const totalAmountSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      const greetBanner = document.getElementById('prof-greet-banner');
      let messageEn = "";
      let messageTa = "";

      if (orders.length === 0) {
        messageEn = "Welcome! Order high-quality fresh cut meats or daily farm veggies to level up! 🚀";
        messageTa = "வரவேற்கிறோம்! உயர்தர இறைச்சி அல்லது காய்கறிகளை ஆர்டர் செய்து உங்கள் கணக்கை மேம்படுத்துங்கள்! 🚀";
      } else if (orders.length < 4) {
        const remaining = 4 - orders.length;
        messageEn = `Great job! Just ${remaining} more order${remaining > 1 ? 's' : ''} to become a Silver VIP Member! 🌟`;
        messageTa = `அற்புதம்! நீங்கள் சில்வர் விஐபி ஆக இன்னும் ${remaining} ஆர்டர்கள் மட்டுமே தேவை! 🌟`;
      } else {
        messageEn = `Spectacular! Thank you for ordering ${orders.length} times. Keep checking details for hidden gourmet deals! 🔥`;
        messageTa = `அற்புதம்! எங்களின் எலைட் வாடிக்கையாளராக விளங்குவதற்கு மிக்க நன்றி! 🔥`;
      }

      if (greetBanner) {
        greetBanner.innerHTML = `🌟 ${messageEn}<br><span style="font-size:11.5px; opacity:0.85;">✨ ${messageTa}</span>`;
      }

      let freshKgs = 0;
      orders.forEach(o => {
        if (o.items && Array.isArray(o.items)) {
          o.items.forEach(it => {
            if (it.category === 'veg' || it.category === 'fruits') {
              freshKgs += (it.weightGrams || 500) / 1000;
            }
          });
        }
      });

      const scoreEl = document.getElementById('prof-farm-score');
      const kgEl = document.getElementById('prof-farm-kg');
      if (scoreEl && kgEl) {
        if (freshKgs === 0) {
          scoreEl.innerText = "Level 0 (Seed Sower)";
          kgEl.innerText = "0 Kg Fresh Produce";
        } else if (freshKgs <= 5) {
          scoreEl.innerText = "Level 1 (Direct Contributor)";
          kgEl.innerText = `${freshKgs.toFixed(1)} Kg fresh produce sourced`;
        } else if (freshKgs <= 15) {
          scoreEl.innerText = "Level 2 (Direct Farm Patron)";
          scoreEl.style.color = "#34d399";
          kgEl.innerText = `${freshKgs.toFixed(1)} Kg fresh produce sourced`;
        } else {
          scoreEl.innerText = "Level 3 (Gourmet Agri Hero 🚜)";
          scoreEl.style.color = "#6ee7b7";
          kgEl.innerText = `${freshKgs.toFixed(1)} Kg sourced direct!`;
        }
      }

      const streakBox = document.getElementById('badge-streak-box');
      const streakIco = document.getElementById('badge-streak-ico');
      const streakLbl = document.getElementById('badge-streak-lbl');

      const carbonBox = document.getElementById('badge-carbon-box');
      const carbonIco = document.getElementById('badge-carbon-ico');
      const carbonLbl = document.getElementById('badge-carbon-lbl');

      const vipBox = document.getElementById('badge-vip-box');
      const vipIco = document.getElementById('badge-vip-ico');
      const vipLbl = document.getElementById('badge-vip-lbl');

      if (orders.length >= 1) {
        if (streakBox) {
          streakBox.style.borderColor = 'rgba(239,68,68,0.4)';
          streakBox.style.background = 'rgba(239,68,68,0.06)';
        }
        if (streakIco) streakIco.style.filter = 'none';
        if (streakLbl) {
          streakLbl.innerText = "Master ✦";
          streakLbl.style.color = '#ef4444';
        }
      }

      if (totalAmountSpent >= 500) {
        if (carbonBox) {
          carbonBox.style.borderColor = 'rgba(16,185,129,0.4)';
          carbonBox.style.background = 'rgba(16,185,129,0.06)';
        }
        if (carbonIco) carbonIco.style.filter = 'none';
        if (carbonLbl) {
          carbonLbl.innerText = "Eco Hero";
          carbonLbl.style.color = '#10b981';
        }
      }

      if (orders.length >= 4 || u.tier === 'gold') {
        if (vipBox) {
          vipBox.style.borderColor = 'rgba(245,158,11,0.4)';
          vipBox.style.background = 'rgba(245,158,11,0.06)';
        }
        if (vipIco) vipIco.style.filter = 'none';
        if (vipLbl) {
          vipLbl.innerText = "Royal Member";
          vipLbl.style.color = '#f59e0b';
        }
      }
    }

    function generateReferralCodeProfile() {
      const u = getActiveUser();
      if (!u) return;
      const refId = u.id ? u.id.replace('cust_', '').toUpperCase() : 'EDP50';
      const refLink = window.location.origin + window.location.pathname + `?ref=${refId}`;

      const linkText = document.getElementById('referral-link-text');
      const areaDiv = document.getElementById('referral-result-area');
      if (linkText && areaDiv) {
        linkText.innerHTML = `<strong>Your Companion Link:</strong><br><span style="color:var(--accent-orange); font-family:monospace; font-size:11px;">${refLink}</span><br><span style="font-size:10px; color:#adbac7; margin-top:4px; display:block;">Your friend gets 50 free loyalty points on first order! You receive 50 loyalty pts automatically on their 1st completed order.</span>`;
        areaDiv.style.display = 'block';
        showToast("🎁 Companion referral link loaded! Copy and share it via WhatsApp!", "success");
      }
    }

    function copyReferralLinktoClip() {
      const u = getActiveUser();
      const refId = u ? (u.id ? u.id.replace('cust_', '').toUpperCase() : 'EDP50') : 'EDP50';
      const refLink = window.location.origin + window.location.pathname + `?ref=${refId}`;
      copyTextToClipboardGeneral(refLink, "Link copied to clipboard! Share direct on WhatsApp/SMS! 🌐");
    }

    function checkAndProcessReferralRewards(order) {
      if (!order || order.status !== 'delivered') return;
      const customerId = order.customerId;
      if (!customerId) return;

      const users = getData('ek_users', []);
      const userIdx = users.findIndex(u => u.id === customerId);
      if (userIdx === -1) return;

      const user = users[userIdx];
      if (user.referredBy && !user.referralRewardClaimed) {
        const allOrders = getData('ek_orders', []);
        const deliveredOrders = allOrders.filter(o => o.customerId === customerId && o.status === 'delivered');

        if (deliveredOrders.length <= 1) {
          const awardAmount = 50; // 50 loyalty points

          user.referralRewardClaimed = true;
          user.loyaltyPoints = (user.loyaltyPoints || 0) + awardAmount;
          user.tier = computeLoyaltyTier(user.loyaltyPoints);
          users[userIdx] = user;

          if (typeof addNotification === 'function') {
            addNotification(
              "பரிந்துரை போனஸ்! 🎁",
              "Referral Bonus Awarded! 🎁",
              `உங்களை பரிந்துரைத்ததற்காக மற்றும் உங்கள் முதல் ஆர்டர் வெற்றிகரமாக முடிந்ததற்காக உங்களுக்கு ${awardAmount} லாயல்டி புள்ளிகள் உங்கள் கணக்கில் சேர்க்கப்பட்டுள்ளது!`,
              `You have been awarded ${awardAmount} referral loyalty points because you joined via an invite link and completed your first order!`,
              "🎁"
            );
          }

          const referrerId = user.referredBy;
          const referrerIdx = users.findIndex(u => u.id === referrerId || u.id.replace('cust_', '').toUpperCase() === referrerId.replace('cust_', '').toUpperCase());
          if (referrerIdx !== -1) {
            const referrer = users[referrerIdx];
            referrer.loyaltyPoints = (referrer.loyaltyPoints || 0) + awardAmount;
            referrer.tier = computeLoyaltyTier(referrer.loyaltyPoints);
            users[referrerIdx] = referrer;

            debugLog(`[Referral System] Awarded ${awardAmount} points to referrer: ${referrer.name} (${referrer.id})`);

            if (typeof addNotification === 'function') {
              addNotification(
                "பரிந்துரையாளர் போனஸ்! 👥",
                "Companion Referral Bonus! 👥",
                `உங்கள் நண்பர் ${user.name} முதல் ஆர்டரை முடித்துள்ளார்! உங்களுக்கு ${awardAmount} லாயல்டி புள்ளிகள் சேர்க்கப்பட்டுள்ளது.`,
                `Your companion friend ${user.name} has completed their first order! You have been awarded ${awardAmount} referral points.`,
                "👥"
              );
            }
          } else {
            console.warn(`[Referral System] Referrer user not found in local users list for: ${referrerId}`);
          }

          saveData('ek_users', users);

          if (db) {
            db.collection('ek_users').doc(user.id).set(user, { merge: true })
              .then(() => debugLog(`[Cloud Referral Sync] Referee updated`))
              .catch(err => console.warn("Referral sync notice:", err?.message || err));

            if (referrerIdx !== -1) {
              db.collection('ek_users').doc(users[referrerIdx].id).set(users[referrerIdx], { merge: true })
                .then(() => debugLog(`[Cloud Referral Sync] Referrer updated`))
                .catch(err => console.warn("Referrer sync notice:", err?.message || err));
            }
          }

          showToast(currentLang === 'ta' ? "பரிந்துரை போனஸ் புள்ளிகள் வழங்கப்பட்டது!" : "Referral reward loyalty points awarded success! 🎁🎉", "success");
        }
      }
    }

    function scratchSecretProfileReward() {
      const resDiv = document.getElementById('secret-scratched-result');
      if (!resDiv) return;

      const secretsList = [
        {
          title: "🍗 Elite Chef Secret: Butter Mutton Stew",
          desc: "Before gourmet cooking, massage the fresh cuts with lemon zest and yogurt. Apply promo secret code: WELCOME10 for ₹50 off on orders above ₹199!"
        },
        {
          title: "🔥 Spicy Country Chicken Fry",
          desc: "Roast and handground dry coriander seeds with cinnamon and red chillies. Use secret code: SAVEMORE to get flat ₹50 instant discount!"
        },
        {
          title: "🐟 Traditional Fish Tamarind Sauce",
          desc: "Sauté seasoned small shallots with curry leaves on fresh cold pressed sesame oil. Use secret promo code: FREEFRESH to unlock free shipping!"
        }
      ];

      const chosen = secretsList[Math.floor(Math.random() * secretsList.length)];

      resDiv.innerHTML = `
        <strong style="color:var(--accent-orange); font-size:13px; display:block; margin-bottom:4px;">${chosen.title}</strong>
        <p style="font-size:11.5px; color:#fff; line-height:1.4; margin-bottom:8px;">${chosen.desc}</p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <button class="btn btn-secondary" style="width:auto; padding:4px 10px; font-size:10px; border-color:var(--accent-green); color:var(--accent-green);" onclick="copyCouponCodeValue('${chosen.title.replace(/\\s/g, '')}')">📋 Copy Promo Code</button>
          <span style="font-size:10.5px; color:var(--text-muted);">Custom recipe unlocked! 🌟</span>
        </div>
      `;
      resDiv.style.display = 'block';
      showToast("🔮 Magic box unleashed! Your cooking custom reward is printed below!", "success");
    }

    function copyCouponCodeValue(prefix) {
      const code = prefix.includes("Mutton") ? 'WELCOME10' : prefix.includes("Chicken") ? 'SAVEMORE' : 'FREEFRESH';
      copyTextToClipboardGeneral(code, `Discount promo coupon '${code}' copied straight to clipboard!`);
    }

    function copyCouponCodeToClipboard(code) {
      copyTextToClipboardGeneral(code, `Coupon promo code '${code}' copied! 🎟️`, () => {
        const btn = document.getElementById(`coupon-btn-${code}`);
        if (btn) {
          const oldText = btn.innerText;
          btn.innerText = "COPIED ✓";
          btn.style.background = "#10b981";
          setTimeout(() => {
            btn.innerText = oldText;
            btn.style.background = "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)";
          }, 2000);
        }
      });
    }

    function shareReferralOnWhatsApp() {
      const activeSession = getActiveSession();
      const referralCode = (activeSession && activeSession.phone) ? activeSession.phone.substring(0, 6) : "EK50";
      const message = currentLang === 'ta'
        ? `ஹாய்! எடப்பாடி கடை ஆப் மூலமா வீட்டிற்கே ஸ்பெஷல் மட்டன் & நாட்டுக்கோழியை 100% சுத்தமா ஆர்டர் பண்ணலாம்! என்னோட ரெஃப்ரல் கோடு '${referralCode}' பயன்படுத்தி ₹50 தள்ளுபடி பெறுங்கள். இங்கே டவுன்லோடு செய்யுங்கள்: https://ek-town-meats.web.app`
        : `Hey! Order premium fresh meats, mutton, & country chicken online via Edappadi Kadai! Use my referral code '${referralCode}' to get ₹50 discount on your first order. Live tracking in Idappadi town. Download now: https://ek-town-meats.web.app`;

      openWhatsAppDirect('', message);
    }

    function updateClaimBoxState() {
      const activeSession = getActiveSession();
      const box = document.getElementById('daily-claim-box');
      if (!box) return;

      if (!activeSession) {
        box.innerHTML = `
          <button onclick="showScreen('screen-login')" class="btn btn-primary" style="min-height: 42px; height: auto; padding: 10px 16px; width: 100%; border-radius: 12px; background: linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.1) 100%) !important; color:#ffffff !important; text-shadow:0 1px 1px rgba(0,0,0,0.5) !important; border:1px solid rgba(245,158,11,0.4) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important; font-weight:800; font-size:12px;">
            🔒 LOGIN TO CLAIM DAILY BONUS • உள்நுழைக
          </button>
        `;
        return;
      }

      const lastClaimTime = localStorage.getItem(`ek_last_daily_claim_time_${activeSession.id}`);
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (lastClaimTime && (now - parseInt(lastClaimTime) < twentyFourHours)) {
        const remainingMs = twentyFourHours - (now - parseInt(lastClaimTime));
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));

        box.innerHTML = `
          <button class="btn btn-secondary" style="min-height: 42px; height: auto; padding: 10px 16px; width: 100%; border-radius: 12px !important; background: rgba(255,255,255,0.02) !important; border: 1.5px solid rgba(255,255,255,0.08) !important; color: #777 !important; font-weight:800; font-size:11.5px; cursor: not-allowed; width: 100%;" disabled>
            ⌛ CLAIMED TODAY • ${remainingHours}h REMAINING (₹0.00)
          </button>
        `;
      } else {
        box.innerHTML = `
          <button onclick="claimDailyBonusReward()" class="btn btn-success" style="min-height: 42px; height: auto; padding: 10px 16px; width: 100%; border-radius: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; border:1px solid rgba(255,255,255,0.2) !important; box-shadow:0 6px 14px rgba(16,185,129,0.2) !important; color:#ffffff !important; text-shadow:0 1px 1px rgba(0,0,0,0.2) !important; font-weight:800; font-size:12px;">
            🪙 CLAIM FREE DAILY POINTS • இப்போதே பெறுங்கள்!
          </button>
        `;
      }
    }

    function claimDailyBonusReward() {
      const btn = (typeof event !== 'undefined' && event && event.target) ? event.target.closest('button, .btn') : null;
      if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, true);
      const activeSession = getActiveSession();
      if (!activeSession) {
        if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
        showToast(currentLang === 'ta' ? "போனஸ் பெற முதலில் உள்நுழையவும்! 🔐" : "Please login first to claim daily bonuses! 🔐", "warning");
        showScreen('screen-login');
        return;
      }

      const lastClaimTime = localStorage.getItem(`ek_last_daily_claim_time_${activeSession.id}`);
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (lastClaimTime && (now - parseInt(lastClaimTime) < twentyFourHours)) {
        if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
        showToast(currentLang === 'ta' ? "மன்னிக்கவும்! நீங்கள் ஏற்கனவே இன்று போனஸை பெற்றுள்ளீர்கள்." : "Already claimed today! Try again tomorrow.", "warning");
        return;
      }

      const bonusPct = Math.floor(Math.random() * 21) + 10;

      const db = firebase.firestore();
      db.collection('users').doc(activeSession.id).update({
        walletPoints: firebase.firestore.FieldValue.increment(bonusPct)
      }).then(() => {
        if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
        activeSession.walletPoints = (activeSession.walletPoints || 0) + bonusPct;
        localStorage.setItem('ek_active_session', JSON.stringify(activeSession));
        localStorage.setItem(`ek_last_daily_claim_time_${activeSession.id}`, now.toString());
        updateClaimBoxState();
        if (document.getElementById('prof-wallet-pts')) {
          document.getElementById('prof-wallet-pts').innerText = activeSession.walletPoints;
        }
        showToast(currentLang === 'ta' ? `வாழ்த்துகள்! ${bonusPct} வாலட் புள்ளிகள் வெற்றிகரமாக சேர்க்கப்பட்டது! 🎉🪙` : `Success! ${bonusPct} bonus points added to your loyalty wallet! 🎉🪙`, "success");
      }).catch(err => {
        if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
        console.error("claimDailyBonusReward error:", err);
        activeSession.walletPoints = (activeSession.walletPoints || 0) + bonusPct;
        localStorage.setItem('ek_active_session', JSON.stringify(activeSession));
        localStorage.setItem(`ek_last_daily_claim_time_${activeSession.id}`, now.toString());
        updateClaimBoxState();
        if (document.getElementById('prof-wallet-pts')) {
          document.getElementById('prof-wallet-pts').innerText = activeSession.walletPoints;
        }
        showToast(currentLang === 'ta' ? `தற்காலிகமாக ${bonusPct} வாலட் பாயிண்ட்ஸ் மெமரியில் சேர்க்கப்பட்டது! 🪙` : `Added ${bonusPct} loyalty points locally! 🪙`, "success");
      });
    }

