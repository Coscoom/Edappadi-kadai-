
    function navigateHome() {
      try {
        if (typeof currentScreen !== 'undefined') {
          currentScreen = 'screen-home';
        }
        if (typeof showTab === 'function') {
          showTab('tab-home');
        } else if (typeof showScreen === 'function') {
          showScreen('screen-home');
        }

        // Direct DOM safety guarantee to ensure immediate visual transition
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'screen-transitioning'));
        const homeEl = document.getElementById('screen-home');
        if (homeEl) {
          homeEl.classList.add('active');
          homeEl.scrollTop = 0;
        }
        const bottomNav = document.getElementById('app-bottom-nav');
        if (bottomNav) bottomNav.style.display = 'flex';
        const homeTab = document.getElementById('nav-btn-home');
        if (homeTab) {
          document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
          homeTab.classList.add('active');
        }
        if (typeof renderHomeScreen === 'function') {
          try { renderHomeScreen(); } catch(e) {}
        }
      } catch (err) {
        console.error("navigateHome error:", err);
        try {
          if (typeof showScreen === 'function') {
            showScreen('screen-home');
          }
        } catch(e) {}
      }
    }
    window.navigateHome = navigateHome;

    function initAuthBackButtons() {
      try {
        const loginBackBtn = document.getElementById('btn-login-back') || document.querySelector('#screen-login .auth-3d-back-btn');
        if (loginBackBtn) {
          loginBackBtn.onclick = function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            navigateHome();
          };
          loginBackBtn.addEventListener('pointerdown', function(e) {
            if (e) { e.stopPropagation(); }
          });
          loginBackBtn.addEventListener('touchend', function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            navigateHome();
          }, { passive: false });
        }

        const regBackBtn = document.getElementById('btn-register-back') || document.querySelector('#screen-register .auth-3d-back-btn');
        if (regBackBtn) {
          regBackBtn.onclick = function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            navigateHome();
          };
          regBackBtn.addEventListener('pointerdown', function(e) {
            if (e) { e.stopPropagation(); }
          });
          regBackBtn.addEventListener('touchend', function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            navigateHome();
          }, { passive: false });
        }
      } catch (e) {
        console.warn("[initAuthBackButtons error]", e);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAuthBackButtons);
    } else {
      setTimeout(initAuthBackButtons, 10);
    }
    window.initAuthBackButtons = initAuthBackButtons;

    function showTab(tabName) {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      if (tabName === 'tab-home') {
        const homeBtn = document.getElementById('nav-btn-home') || document.querySelector('.nav-tab:nth-child(1)');
        if (homeBtn) homeBtn.classList.add('active');
        if (typeof showScreen === 'function') showScreen('screen-home');
      } else if (tabName === 'tab-cart') {
        const cartBtn = document.getElementById('nav-btn-cart') || document.querySelector('.nav-tab:nth-child(2)');
        if (cartBtn) cartBtn.classList.add('active');
        if (typeof showScreen === 'function') showScreen('screen-cart');
      } else if (tabName === 'tab-lyo-ai') {
        const lyoBtn = document.getElementById('lyo-ai-nav-btn');
        if (lyoBtn) lyoBtn.classList.add('active');
        if (typeof showScreen === 'function') showScreen('screen-lyo-ai');
        if (typeof updateLyoDeliveryBanner === 'function') updateLyoDeliveryBanner();
        if (typeof initLyoAiChat === 'function') initLyoAiChat();
        if (typeof updateLyoDraftCartBar === 'function') updateLyoDraftCartBar();

        if (typeof firebase !== 'undefined' && firebase.auth) {
          const authUser = firebase.auth().currentUser;
          if (authUser) {
            debugLog("[Diagnostic] auth UID when chatbot opens: " + authUser.uid);
          } else {
            console.warn("[Diagnostic] auth UID when chatbot opens: None (User is signed out or anonymous guest). Reason: Firebase currentUser is null or anonymous.");
          }
        } else {
          console.error("[Diagnostic] auth UID when chatbot opens: None. Reason: Firebase SDK is not loaded.");
        }

      } else if (tabName === 'tab-track') {
        const hasTrackOrder = typeof selectedTrackOrderId !== 'undefined' ? selectedTrackOrderId : (window.selectedTrackOrderId || null);
        if (typeof getActiveSession === 'function' && !getActiveSession() && !hasTrackOrder) {
          if (typeof showToast === 'function') showToast(typeof currentLang !== 'undefined' && currentLang === 'ta' ? "முன்னோட்டமிட முதலில் உள்நுழையவும்! 🔐" : "Please login or register first to track orders! 🔐", "warning");
          if (typeof showScreen === 'function') showScreen('screen-login');
          return;
        }
        const trackBtn = document.getElementById('nav-btn-track') || document.querySelector('.nav-tab:nth-child(4)');
        if (trackBtn) trackBtn.classList.add('active');
        if (typeof showScreen === 'function') showScreen('screen-track');
      } else if (tabName === 'tab-profile') {
        if (typeof getActiveSession === 'function' && !getActiveSession()) {
          if (typeof showToast === 'function') showToast(typeof currentLang !== 'undefined' && currentLang === 'ta' ? "உள்நுழையவும் அல்லது புதிய அக்கவுண்ட் உருவாக்கவும்! 🔐" : "Please login or register first to manage your profile! 🔐", "warning");
          if (typeof showScreen === 'function') showScreen('screen-login');
          return;
        }
        const profileBtn = document.getElementById('nav-btn-profile') || document.querySelector('.nav-tab:nth-child(5)');
        if (profileBtn) profileBtn.classList.add('active');
        if (typeof showScreen === 'function') showScreen('screen-profile');
      }
    }
    window.showTab = showTab;

    // Declarative Back Navigation Configuration Map
    const BACK_BEHAVIOR = {
      'screen-admin': {
        type: 'double-press-action',
        timeoutMs: 2000,
        stateKey: '_adminBackPressTime',
        toastMessage: () => (typeof currentLang !== 'undefined' && currentLang === 'ta')
          ? "மீண்டும் Back அழுத்தி Logout செய்யவும்"
          : "Press back again to logout",
        action: () => {
          if (typeof adminLogout === 'function') {
            adminLogout();
          }
        }
      },
      'screen-home': {
        type: 'double-press-action',
        timeoutMs: 2000,
        stateKey: '_homeBackPressTime',
        toastMessage: () => (typeof currentLang !== 'undefined' && currentLang === 'ta')
          ? "வெளியேற மீண்டும் பின்னால் அழுத்தவும்"
          : "Press back again to exit",
        action: () => {
          const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
          const title = isTa ? "வெளியேறு / Exit App" : "Exit App";
          const msg = isTa ? "செயலியை மூட விரும்புகிறீர்களா?" : "Are you sure you want to exit the app?";
          const okText = isTa ? "வெளியேறு" : "Exit";
          const cancelText = isTa ? "ரத்து" : "Cancel";

          if (typeof showCustomConfirm === 'function') {
            showCustomConfirm(title, msg, () => {
              if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.exitApp === 'function') {
                AndroidStorage.exitApp();
              } else if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.minimizeApp === 'function') {
                AndroidStorage.minimizeApp();
              }
            }, null, okText, cancelText);
          }
        }
      },
      'screen-splash': {
        type: 'ignore'
      },
      'default': {
        type: 'navigate-home'
      }
    };
    window.BACK_BEHAVIOR = BACK_BEHAVIOR;

    function handleAndroidBack() {
      try {
        // 1. Check if any modals, popups, bottom sheets, side menus, or custom confirm/alert dialogs are visible
        const allModals = Array.from(document.querySelectorAll('.modal-backdrop, .modal, .popup-overlay, #custom-confirm-modal, #custom-alert-modal, .side-menu, .drawer, .bottom-sheet'));
        const activeModal = allModals.find(m => {
          if (!m) return false;
          const display = window.getComputedStyle(m).getPropertyValue('display');
          const visibility = window.getComputedStyle(m).getPropertyValue('visibility');
          const opacity = window.getComputedStyle(m).getPropertyValue('opacity');
          return display !== 'none' && visibility !== 'hidden' && opacity !== '0';
        });

        if (activeModal) {
          const mid = activeModal.id;
          if (mid === 'product-detail-modal') {
            if (typeof closeProductModalDetail === 'function') closeProductModalDetail();
            else activeModal.style.display = 'none';
          } else if (mid === 'admin-add-product-modal') {
            if (typeof closeAdminAddProductModalDetail === 'function') closeAdminAddProductModalDetail();
            else if (typeof closeAdminAddProductModal === 'function') closeAdminAddProductModal();
            else activeModal.style.display = 'none';
          } else if (mid === 'admin-edit-product-modal') {
            if (typeof closeAdminEditProductModalDetail === 'function') closeAdminEditProductModalDetail();
            else if (typeof closeAdminEditProductModal === 'function') closeAdminEditProductModal();
            else activeModal.style.display = 'none';
          } else if (mid === 'developer-info-modal') {
            if (typeof closeDeveloperModalDetail === 'function') closeDeveloperModalDetail();
            else if (typeof closeDeveloperModal === 'function') closeDeveloperModal();
            else activeModal.style.display = 'none';
          } else if (mid === 'privacy-policy-modal') {
            if (typeof closePrivacyPolicyDetail === 'function') closePrivacyPolicyDetail();
            else activeModal.style.display = 'none';
          } else if (mid === 'print-preview-modal') {
            if (typeof closePrintPreviewModalDetail === 'function') closePrintPreviewModalDetail();
            else activeModal.style.display = 'none';
          } else if (mid === 'order-cancel-modal') {
            if (typeof closeOrderCancelModalDetail === 'function') closeOrderCancelModalDetail();
            else activeModal.style.display = 'none';
          } else if (mid === 'forgot-password-modal') {
            if (typeof hideForgotPasswordModal === 'function') hideForgotPasswordModal();
            else activeModal.style.display = 'none';
          } else if (mid === 'customer-order-detail-modal') {
            if (typeof closeCustomerOrderDetailModalDetail === 'function') closeCustomerOrderDetailModalDetail();
            else activeModal.style.display = 'none';
          } else if (mid === 'lightbox-modal') {
            if (typeof closeLightboxModal === 'function') closeLightboxModal();
            else activeModal.style.display = 'none';
          } else if (mid === 'notification-center-modal') {
            if (typeof closeNotificationCenter === 'function') closeNotificationCenter();
            else activeModal.style.display = 'none';
          } else if (mid === 'whatsapp-share-modal') {
            if (typeof closeWhatsAppShareModal === 'function') closeWhatsAppShareModal();
            else activeModal.style.display = 'none';
          } else if (mid === 'manual-location-pin-modal') {
            if (typeof closeManualPinModal === 'function') closeManualPinModal();
            else activeModal.style.display = 'none';
          } else if (mid === 'add-confirmation-modal') {
            if (typeof closeAddConfirmationModal === 'function') closeAddConfirmationModal();
            else activeModal.style.display = 'none';
          } else {
            activeModal.style.display = 'none';
            activeModal.classList.remove('active');
          }
          return true; // Handled modal dismissal
        }

        // 2. Lookup currentScreen behavior in declarative BACK_BEHAVIOR map
        const screenKey = (typeof currentScreen !== 'undefined' && currentScreen) ? currentScreen : 'screen-home';
        const behavior = BACK_BEHAVIOR[screenKey] || BACK_BEHAVIOR['default'];

        if (behavior.type === 'double-press-action') {
          const now = Date.now();
          const lastTime = window[behavior.stateKey] || 0;
          if (lastTime && (now - lastTime < (behavior.timeoutMs || 2000))) {
            window[behavior.stateKey] = 0;
            behavior.action();
          } else {
            window[behavior.stateKey] = now;
            const msg = typeof behavior.toastMessage === 'function' ? behavior.toastMessage() : behavior.toastMessage;
            if (typeof showToast === 'function') {
              showToast(msg, 'info');
            }
          }
          return true;
        }

        if (behavior.type === 'navigate-home') {
          screenHistory = [];
          if (typeof showTab === 'function') {
            showTab('tab-home');
          } else if (typeof showScreen === 'function') {
            showScreen('screen-home');
          }
          return true;
        }

        if (behavior.type === 'ignore') {
          return true;
        }

        return false;
      } catch (err) {
        console.error("Error in handleAndroidBack:", err);
        return false;
      }
    }
    window.handleAndroidBack = handleAndroidBack;

    function togglePasswordVisibility(id, iconEl) {
      const inp = document.getElementById(id);
      if (!inp) return;
      if (inp.type === 'password') {
        inp.type = 'text';
        if (iconEl) {
          iconEl.innerText = '🙈';
        } else {
          const parent = inp.parentElement;
          if (parent) {
            const eye = parent.querySelector('span, i');
            if (eye) eye.innerText = '🙈';
          }
        }
      } else {
        inp.type = 'password';
        if (iconEl) {
          iconEl.innerText = '👁️';
        } else {
          const parent = inp.parentElement;
          if (parent) {
            const eye = parent.querySelector('span, i');
            if (eye) eye.innerText = '👁️';
          }
        }
      }
    }

    function sha256_js(ascii) {
      function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
      }
      var mathPow = Math.pow;
      var maxWord = mathPow(2, 32);
      var lengthProperty = 'length';
      var i, j;
      var result = '';
      var words = [];
      var asciiLength = ascii[lengthProperty];
      var hash = sha256_js.h = sha256_js.h || [];
      var k = sha256_js.k = sha256_js.k || [];
      var primeCounter = k[lengthProperty];
      var isComposite = {};
      for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
          for (i = 0; i < 313; i += candidate) {
            isComposite[i] = 1;
          }
          hash[primeCounter] = (mathPow(candidate, .5)*maxWord)|0;
          k[primeCounter++] = (mathPow(candidate, 1/3)*maxWord)|0;
        }
      }
      ascii += '\x80';
      while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
      for (i = 0; i < ascii[lengthProperty]; i++) {
        j = ascii.charCodeAt(i);
        if (j >> 8) return ""; // ASCII only
        words[i >> 2] |= j << ((3 - i % 4) * 8);
      }
      words[words[lengthProperty]] = ((asciiLength * 8) / maxWord) | 0;
      words[words[lengthProperty]] = (asciiLength * 8);

      var h0 = hash[0], h1 = hash[1], h2 = hash[2], h3 = hash[3], h4 = hash[4], h5 = hash[5], h6 = hash[6], h7 = hash[7];
      for (j = 0; j < words[lengthProperty]; j += 16) {
        var w = words.slice(j, j + 16);
        var oldh0 = h0, oldh1 = h1, oldh2 = h2, oldh3 = h3, oldh4 = h4, oldh5 = h5, oldh6 = h6, oldh7 = h7;
        for (i = 0; i < 64; i++) {
          if (i >= 16) {
            var w15 = w[i - 15], w2 = w[i - 2];
            var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
            var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
          }
          var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h_val = h7;
          var s0_rot = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
          var maj = (a & b) ^ (a & c) ^ (b & c);
          var t2 = (s0_rot + maj) | 0;
          var s1_rot = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
          var ch = (e & f) ^ ((~e) & g);
          var t1 = (h_val + s1_rot + ch + k[i] + (w[i] || 0)) | 0;
          h0 = (t1 + t2) | 0;
          h1 = a;
          h2 = b;
          h3 = c;
          h4 = (d + t1) | 0;
          h5 = e;
          h6 = f;
          h7 = g;
        }
        h0 = (h0 + oldh0) | 0;
        h1 = (h1 + oldh1) | 0;
        h2 = (h2 + oldh2) | 0;
        h3 = (h3 + oldh3) | 0;
        h4 = (h4 + oldh4) | 0;
        h5 = (h5 + oldh5) | 0;
        h6 = (h6 + oldh6) | 0;
        h7 = (h7 + oldh7) | 0;
      }
      var hash_vals = [h0, h1, h2, h3, h4, h5, h6, h7];
      for (i = 0; i < 8; i++) {
        var byte_val = hash_vals[i];
        if (byte_val < 0) byte_val += 4294967296;
        var hex = byte_val.toString(16);
        while (hex.length < 8) hex = '0' + hex;
        result += hex;
      }
      return result;
    }

    async function hashPassword(p) {
      try {
        if (window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
          const enc = new TextEncoder();
          const buf = await crypto.subtle.digest('SHA-256', enc.encode(p + 'EK2024'));
          return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
        }
      } catch (e) {
        console.warn("Native crypto.subtle.digest failed, falling back to pure JS hash:", e);
      }
      return sha256_js(p + 'EK2024');
    }

    async function verifyPassword(plain, stored) {
      if (!stored || !plain) return false;
      const hash = stored.startsWith('hash:') ? stored.slice(5) : stored;
      const computedHash = await hashPassword(plain);
      return computedHash === hash;
    }

    async function migratePasswordsToHash() {
      try {
        let adminList = typeof adminAccounts !== 'undefined' ? adminAccounts : getData('ek_admin_accounts', []);
        let adminChanged = false;
        for (let acc of adminList) {
          if (acc && acc.password && typeof acc.password === 'string' && !acc.password.startsWith('hash:') && acc.password.length !== 64) {
            acc.password = 'hash:' + await hashPassword(acc.password);
            adminChanged = true;
          }
        }
        if (adminChanged) {
          saveData('ek_admin_accounts', adminList);
          debugLog('[Security] Migrated unhashed admin account passwords.');
        }

        let delivList = getData('ek_delivery_persons', []);
        let delivChanged = false;
        for (let dp of delivList) {
          if (dp && dp.password && typeof dp.password === 'string' && !dp.password.startsWith('hash:') && dp.password.length !== 64) {
            dp.password = 'hash:' + await hashPassword(dp.password);
            delivChanged = true;
            if (typeof db !== 'undefined' && db && dp.id) {
              db.collection('ek_delivery_persons').doc(dp.id).update({
                password: dp.password,
                updatedAt: new Date().toISOString()
              }).catch(e => console.warn('[Migration] Firestore rider password sync failed:', dp.id, e));
            }
          }
        }
        if (delivChanged) {
          saveData('ek_delivery_persons', delivList);
          debugLog('[Security] Migrated unhashed delivery rider passwords.');
        }

        let users = getData('ek_users', []);
        let usersChanged = false;
        for (let u of users) {
          if (u && u.password && typeof u.password === 'string' && !u.password.startsWith('hash:') && u.password.length !== 64) {
            u.password = 'hash:' + await hashPassword(u.password);
            usersChanged = true;
            if (typeof db !== 'undefined' && db && u.id) {
              db.collection('ek_users').doc(u.id).update({
                password: u.password,
                updatedAt: new Date().toISOString()
              }).catch(e => console.warn('[Migration] Firestore user password sync failed:', u.id, e));
            }
          }
        }
        if (usersChanged) {
          saveData('ek_users', users);
          debugLog('[Security] Migrated unhashed user passwords.');
        }
      } catch (err) {
        console.error('[Security] Passwords migration scan failed:', err);
      }
    }
    window.migratePasswordsToHash = migratePasswordsToHash;

    function archiveOldOrders() {
      const orders = getData('ek_orders', []);
      const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days

      const activeOrders = orders.filter(o => {
        const isFinal = ['delivered', 'cancelled'].includes(o.status);
        const orderTime = new Date(o.createdAt || 0).getTime();
        return !isFinal || orderTime > cutoff; // Keep recent + all non-final orders
      });

      if (activeOrders.length !== orders.length) {
        saveData('ek_orders', activeOrders);
        debugLog(`[Archive] Removed ${orders.length - activeOrders.length} old orders from local storage (retained in Firestore).`);
      }
    }

    async function fetchSettingsOnce() {
      if (typeof db === 'undefined' || !db) {
        window._isSettingsFetched = true;
        window._hasFreshSettings = true;
        checkAndUpdateFreshCloudData();
        return;
      }
      if (window._hasFreshSettings) {
        const cachedSettings = getData('ek_settings', null);
        if (cachedSettings) {
          window._isSettingsFetched = true;
          checkAndUpdateFreshCloudData();
          return;
        }
      }
      try {
        const doc = await db.collection('ek_settings').doc('global_config').get();
        if (doc.exists) {
          const cloudSettings = normalizeFirestoreData(doc.data());
          if (cloudSettings) {
            const localSettings = getData('ek_settings', DEFAULT_SETTINGS);
            const cloudTime = new Date(cloudSettings.updatedAt || 0).getTime();
            const localTime = new Date(localSettings.updatedAt || 0).getTime();
            const localIsDefault = !localSettings._isAdminModified || localTime === 0;

            if (cloudTime >= localTime || localIsDefault || (cloudSettings.slidingBanners && cloudSettings.slidingBanners.length > 0)) {
              saveData('ek_settings', cloudSettings);
              invalidateDataCache('ek_settings');
              window._isSettingsFetched = true;
              window._hasFreshSettings = true;
              checkAndUpdateFreshCloudData();
              window._hasFreshSettings = true;
              _lastBannersHash = '';
              if (typeof currentScreen !== 'undefined') {
                if (currentScreen === 'screen-home' && typeof renderSlidingBanners === 'function') renderSlidingBanners();
                else if (currentScreen === 'screen-admin' && typeof renderAdminBannerList === 'function') renderAdminBannerList();
              }
              debugLog('[Cloud Sync] Settings fetched once successfully!');
            } else if (localTime > cloudTime && localSettings._isAdminModified) {
              window._hasFreshSettings = true;
              window._isSettingsFetched = true;
              window._hasFreshSettings = true;
              checkAndUpdateFreshCloudData();
              _lastBannersHash = '';
              if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-home' && typeof renderSlidingBanners === 'function') renderSlidingBanners();
              debugLog('[Cloud Sync] Local settings are newer than cloud settings. Syncing local settings to cloud...');
              db.collection('ek_settings').doc('global_config').set(cleanFirestoreData(localSettings)).catch(err => console.error("Error syncing local settings to cloud:", err));
            } else {
              window._hasFreshSettings = true;
              window._isSettingsFetched = true;
              window._hasFreshSettings = true;
              checkAndUpdateFreshCloudData();
              _lastBannersHash = '';
              if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-home' && typeof renderSlidingBanners === 'function') renderSlidingBanners();
            }
          } else {
            window._hasFreshSettings = true;
            window._isSettingsFetched = true;
              window._hasFreshSettings = true;
              checkAndUpdateFreshCloudData();
            _lastBannersHash = '';
            if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-home' && typeof renderSlidingBanners === 'function') renderSlidingBanners();
          }
        } else {
          window._hasFreshSettings = true;
          window._isSettingsFetched = true;
              window._hasFreshSettings = true;
              checkAndUpdateFreshCloudData();
          _lastBannersHash = '';
          if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-home' && typeof renderSlidingBanners === 'function') renderSlidingBanners();
        }
      } catch (e) {
        console.error('[Cloud Sync] Settings fetch failed:', e);
        window._hasFreshSettings = true;
        window._isSettingsFetched = true;
              window._hasFreshSettings = true;
              checkAndUpdateFreshCloudData();
        _lastBannersHash = '';
        if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-home' && typeof renderSlidingBanners === 'function') renderSlidingBanners();
      }
    }

    async function fetchProductsOnce() {
      if (typeof db === 'undefined' || !db) {
        debugLog('[DEBUG fetchProductsOnce] db is undefined or null');
        window._isProductsFetched = true;
        checkAndUpdateFreshCloudData();
        return;
      }
      debugLog('[DEBUG fetchProductsOnce] starting fetch from Firestore...');
      const cachedProds = getData('ek_products', []);
      const cachedCats = getData('ek_categories', []);
      isProductsLoading = !cachedProds || cachedProds.length === 0;
      isCategoriesLoading = !cachedCats || cachedCats.length === 0;
      productsLoadError = null;
      categoriesLoadError = null;

      // If we already have products from cache, display them immediately without blocking UI
      if (cachedProds && cachedProds.length > 0) {
        debugLog('[DEBUG fetchProductsOnce] Cached products present, will sync fresh cloud data in background.');
        window._isProductsFetched = true;
        isProductsLoading = false;
        isCategoriesLoading = false;
        checkAndUpdateFreshCloudData();
      }
      try {
        const [productsSnap, categoriesSnap, settingsSnap] = await Promise.all([
          db.collection('ek_products').get().catch(e => { console.warn("ek_products get failed:", e); return null; }),
          db.collection('ek_categories').get().catch(e => { console.warn("ek_categories get failed:", e); return null; }),
          db.collection('ek_settings').doc('global_config').get().catch(() => null)
        ]);

        const deletedProdIds = getDeletedProductIds();
        let cloudProducts = [];
        if (productsSnap) {
          productsSnap.forEach(doc => {
            const prod = normalizeFirestoreData(doc.data());
            if (prod && prod.id && !deletedProdIds.includes(prod.id)) {
              cloudProducts.push(prod);
            }
          });
        }

        let cloudCategories = [];
        if (categoriesSnap) {
          categoriesSnap.forEach(doc => {
            const cat = normalizeFirestoreData(doc.data());
            if (cat && cat.id) {
              cloudCategories.push(cat);
            }
          });
        }

        // Fallback to categories from settings if ek_categories collection was empty
        if ((!cloudCategories || cloudCategories.length === 0) && settingsSnap && settingsSnap.exists) {
          const sData = settingsSnap.data();
          if (sData && Array.isArray(sData.categories) && sData.categories.length > 0) {
            cloudCategories = sData.categories;
          }
        }

        if (cloudProducts.length > 0) {
          window._hasFreshCloudData = true;
          saveData('ek_cloud_synced', true);
          saveData('ek_products', cloudProducts);
          invalidateDataCache('ek_products');
        }

        if (cloudCategories.length > 0) {
          cloudCategories.sort((a, b) => {
            const orderA = (a && a.order !== undefined && a.order !== null && !isNaN(Number(a.order))) ? Number(a.order) : 999;
            const orderB = (b && b.order !== undefined && b.order !== null && !isNaN(Number(b.order))) ? Number(b.order) : 999;
            if (orderA !== orderB) return orderA - orderB;
            return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
          });
          saveData('ek_categories', cloudCategories);
          invalidateDataCache('ek_categories');
          window._categoriesListCachedValue = null;
          if (typeof _categoriesListCachedValue !== 'undefined') _categoriesListCachedValue = null;
          window._lastCategoryPillsHash = '';
          if (typeof _lastCategoryPillsHash !== 'undefined') _lastCategoryPillsHash = '';
          window._lastDataSnapshotHash = '';
          if (typeof _lastDataSnapshotHash !== 'undefined') _lastDataSnapshotHash = '';
          window._lastProductsHash = '';
          if (typeof _lastProductsHash !== 'undefined') _lastProductsHash = '';
        }

        debugLog(`[Cloud Sync] Fetched once successfully: ${cloudProducts.length} products, ${cloudCategories.length} categories.`);
      } catch (err) {
        console.error(`[Cloud Sync] ek_products / ek_categories query failed:`, err);
        productsLoadError = err.message || String(err);
        categoriesLoadError = err.message || String(err);
        window._isProductsFetched = true;
        checkAndUpdateFreshCloudData();
      } finally {
        isProductsLoading = false;
        isCategoriesLoading = false;
        window._isProductsFetched = true;
        checkAndUpdateFreshCloudData();
        if (typeof renderCategoryPills === 'function') {
          renderCategoryPills();
        }
        if (typeof renderHomeScreenProducts === 'function') {
          renderHomeScreenProducts(true);
        }
      }
    }

    window.fetchProductsOnce = fetchProductsOnce;

    function toggleLang() {
      currentLang = currentLang === 'ta' ? 'en' : 'ta';
      localStorage.setItem('ek_lang', currentLang);
      if (typeof AndroidStorage !== 'undefined') {
        AndroidStorage.saveData('ek_lang', currentLang);
      }
      applyTranslations();
      showToast(currentLang === 'ta' ? "மொழி தமிழிற்கு மாற்றப்பட்டது 🌐" : "Language set to English 🇬🇧", "success");
    }

    let currentLoginMode = 'customer';

    let adminAccounts = getData('ek_admin_accounts', []) || [];

    function showSuperAdminSetupModal() {
      const modal = document.getElementById('superadmin-setup-modal');
      if (modal) {
        modal.style.display = 'flex';
      }
    }

    function closeSuperAdminSetupModal() {
      const modal = document.getElementById('superadmin-setup-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    }

    async function checkAndShowSuperAdminSetup() {
      if (typeof currentScreen === 'undefined' || currentScreen !== 'screen-admin') {
        debugLog("[Superadmin Setup Check] Blocked: Not explicitly on screen-admin");
        return false;
      }

      if (typeof firebase === 'undefined' || !firebase.auth) {
        debugLog("[Superadmin Setup Check] Blocked: Firebase Auth not available");
        return false;
      }
      const user = firebase.auth().currentUser;
      if (!user || user.isAnonymous) {
        debugLog("[Superadmin Setup Check] Blocked: No authenticated Firebase user or is anonymous");
        return false;
      }

      const session = typeof getAdminSession === 'function' ? getAdminSession() : null;
      if (!session || !session.loggedIn) {
        debugLog("[Superadmin Setup Check] Blocked: No active admin session");
        return false;
      }

      if (typeof db === 'undefined' || !db || !db.collection) {
        debugLog("[Superadmin Setup Check] Blocked: Firestore db not available");
        return false;
      }

      try {
        const qSnap = await db.collection('ek_admin_accounts').get();
        let activeCount = 0;
        qSnap.forEach(doc => {
          const data = doc.data();
          if (data && data.active !== false) {
            activeCount++;
          }
        });

        if (activeCount === 0) {
          debugLog("[Superadmin Setup Check] Succeeded: Zero active admin accounts in Firestore. Showing setup modal.");
          showSuperAdminSetupModal();
          return true;
        } else {
          debugLog(`[Superadmin Setup Check] Blocked: Firestore has ${activeCount} active admin accounts.`);
        }
      } catch (err) {
        console.warn("[Superadmin Setup Check] Failed to query Firestore:", err);
      }

      return false;
    }

    async function proceedSuperAdminSetup() {
      const name = document.getElementById('setup-admin-name').value.trim();
      const phone = document.getElementById('setup-admin-phone').value.trim();
      const email = document.getElementById('setup-admin-email').value.trim().toLowerCase();
      const password = document.getElementById('setup-admin-password').value;
      const confirm = document.getElementById('setup-admin-confirm').value;

      if (!name) {
        showToast(currentLang === 'ta' ? "பெயரை உள்ளிடவும்." : "Please enter your name.", "error");
        return;
      }
      if (!phone || phone.length < 10) {
        showToast(currentLang === 'ta' ? "சரியான 10 இலக்க கைபேசி எண்ணை உள்ளிடவும்." : "Please enter a valid 10-digit phone number.", "error");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        showToast(currentLang === 'ta' ? "சரியான மின்னஞ்சலை உள்ளிடவும்." : "Please enter a valid email address.", "error");
        return;
      }
      if (!password || password.length < 6) {
        showToast(currentLang === 'ta' ? "கடவுச்சொல் குறைந்தபட்சம் 6 எழுத்துக்களைக் கொண்டிருக்க வேண்டும்." : "Password must be at least 6 characters.", "error");
        return;
      }
      if (password !== confirm) {
        showToast(currentLang === 'ta' ? "கடவுச்சொற்கள் பொருந்தவில்லை!" : "Passwords do not match!", "error");
        return;
      }

      showToast(currentLang === 'ta' ? "Super Admin கணக்கு உருவாக்கப்படுகிறது..." : "Initializing Super Admin account...", "info");

      const newSuperAdmin = {
        id: 'a1',
        name: name,
        phone: phone,
        email: email,
        password: 'hash:' + sha256_js(password + 'EK2024'),
        role: 'superadmin',
        createdAt: new Date().toISOString()
      };

      adminAccounts = [newSuperAdmin];
      saveData('ek_admin_accounts', adminAccounts);

      if (typeof db !== 'undefined' && db && db.collection) {
        try {
          await db.collection('ek_admin_accounts').doc('a1').set(newSuperAdmin);
          debugLog("Cloud Super Admin account initialized successfully.");
        } catch (err) {
          console.error("Cloud Super Admin initialization failed:", err);
        }
      }

      populateAdminSelector();
      closeSuperAdminSetupModal();
      showToast(currentLang === 'ta' ? "Super Admin வெற்றிகரமாக உருவாக்கப்பட்டது! 🎉" : "Super Admin initialized successfully! 🎉", "success");
    }

    const DEFAULT_FALLBACK_ADMINS = [
      { id: 'a1', name: 'Anantharaj', role: 'superadmin', active: true, email: 'admin_8778148899@app.com', phone: '8778148899' },
      { id: 'a2', name: 'Easwaran', role: 'admin', active: true, email: 'admin_9876543210@app.com', phone: '9876543210' },
      { id: 'a3', name: 'Karthick', role: 'admin', active: true, email: 'admin_9999999998@app.com', phone: '9999999998' },
      { id: 'a4', name: 'Prakash', role: 'admin', active: true, email: 'admin_9999999997@app.com', phone: '9999999997' },
      { id: 'a5', name: 'Senthil', role: 'admin', active: true, email: 'admin_9999999996@app.com', phone: '9999999996' }
    ];

    function populateAdminSelector() {
      const adminSelector = document.getElementById('admin-selector');
      if (adminSelector) {
        let listToUse = adminAccounts || [];
        if (listToUse.length === 0) {
          listToUse = DEFAULT_FALLBACK_ADMINS;
        }
        adminSelector.innerHTML = listToUse.map(a => {
          const roleLabel = (a.role || 'admin').toLowerCase() === 'superadmin' ? 'Super Admin' : 'Admin';
          const emailVal = a.email || `admin_${a.phone || a.id}@app.com`;
          return `<option value="${emailVal}">👑 ${a.name} (${roleLabel})</option>`;
        }).join('');
      }
    }

    async function publishPublicStaffDirectory() {
      if (typeof db === 'undefined' || !db) return;
      try {
        debugLog("[Directory Sync] Publishing secure public staff directory...");

        const [adminSnap, deliverySnap] = await Promise.all([
          db.collection('ek_admin_accounts').get(),
          db.collection('users').where('role', '==', 'RIDER').get()
        ]);
        const admins = [];
        adminSnap.forEach(doc => {
          const data = doc.data();
          const role = (data.role || 'admin').toUpperCase();
          const active = data.active !== false;

          if (active && (role === 'ADMIN' || role === 'SUPERADMIN')) {
            admins.push({
              uid: doc.id,
              name: data.name || 'Admin',
              role: role,
              active: active,
              phone: data.phone || doc.id,
              email: data.email || `admin_${data.phone || doc.id}@app.com`
            });
          }
        });

        const riders = [];
        deliverySnap.forEach(doc => {
          const data = doc.data();
          const active = data.isActive === true;

          if (active) {
            riders.push({
              uid: doc.id,
              name: data.name || 'Rider',
              role: 'RIDER',
              active: active,
              email: data.email || `rider_${data.phone || doc.id}@lyo.delivery`,
              phone: data.phone || ""
            });
          }
        });

        const allAccounts = [...admins, ...riders];
        await db.collection('ek_meta').doc('public_staff_directory').set({
          accounts: allAccounts,
          updatedAt: new Date().toISOString()
        });
        debugLog("[Directory Sync] Published secure public staff directory with", allAccounts.length, "accounts.");
      } catch (err) {
        console.error("[Directory Sync] Failed to publish secure public staff directory:", err);
      }
    }

    async function fetchSelectorAccounts() {
      if (typeof db === 'undefined' || !db) return;
      try {
        debugLog("[Selector Setup] Fetching secure public staff directory from Firestore...");

        const docSnap = await db.collection('ek_meta').doc('public_staff_directory').get();
        if (docSnap.exists) {
          const data = docSnap.data();
          const accounts = data.accounts || [];
          debugLog(`[Selector Setup] Found ${accounts.length} accounts in public directory.`);

          const normalizedAdmins = [];
          const normalizedRiders = [];

          accounts.forEach(acc => {
            const role = (acc.role || '').toUpperCase();
            const active = acc.active !== false && acc.isActive !== false;

            if (active && ['ADMIN', 'SUPERADMIN', 'RIDER', 'DELIVERY', 'DELIVERY_BOY'].includes(role)) {
              if (role === 'ADMIN' || role === 'SUPERADMIN') {
                const existingLocal = (adminAccounts || []).find(la => (la.id && la.id === (acc.uid || acc.id)) || (la.phone && la.phone === acc.phone) || (la.email && la.email.toLowerCase() === (acc.email || '').toLowerCase()));
                normalizedAdmins.push({
                  id: acc.uid || acc.id,
                  name: acc.name,
                  role: role.toLowerCase(),
                  active: true,
                  email: acc.email,
                  phone: acc.phone || (existingLocal && existingLocal.phone) || acc.uid || acc.id,
                  password: (existingLocal && existingLocal.password) ? existingLocal.password : ''
                });
              } else {
                normalizedRiders.push({
                  id: acc.uid || acc.id,
                  uid: acc.uid || acc.id,
                  name: acc.name,
                  role: "RIDER",
                  isActive: true,
                  isActiveRider: true,
                  active: true,
                  email: acc.email,
                  authEmail: acc.email,
                  phone: acc.phone || acc.uid || acc.id
                });
              }
            }
          });

          debugLog(`[Selector Setup] Successfully normalized ${normalizedAdmins.length} admins and ${normalizedRiders.length} riders.`);

          if (normalizedAdmins.length > 0) {
            adminAccounts = normalizedAdmins;
            saveData('ek_admin_accounts', normalizedAdmins);
            populateAdminSelector();
          } else {
            adminAccounts = [];
            populateAdminSelector();
          }

          if (normalizedRiders.length > 0) {
            saveData('ek_delivery_persons', normalizedRiders);
            populateDeliveryLoginFormSelector();
          }
        } else {
          debugLog("[Selector Setup] Public directory not found. Using local/fallback options...");
          populateAdminSelector();
          populateDeliveryLoginFormSelector();
        }
      } catch (err) {
        console.error("[Selector Setup] Failed to fetch staff directory:", err);
        populateAdminSelector();
        populateDeliveryLoginFormSelector();
      }
    }

    function renderAdminAccountsSettings() {
      const targets = document.querySelectorAll('.admin-accounts-render-target');
      if (!targets || targets.length === 0) return;

      const adminSession = getAdminSession();
      if (!adminSession) return;

      const canManage = true;
      const count = adminAccounts.length;
      const MAX_ADMINS = 10;

      let html = `
        <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <span style="font-weight: 800; font-size: 13px; color: #f59e0b; display: block;">
              👥 அட்மின் கணக்குகள் / Admin Accounts List
            </span>
            <span style="font-size: 11px; color: var(--text-secondary);">
              அதிகபட்சம் 10 அட்மின் கணக்குகள் வரை சேர்க்கலாம் (Maximum 10 Admin accounts allowed)
            </span>
          </div>
          <span style="font-size: 11.5px; font-weight: 800; padding: 4px 12px; border-radius: 20px; background: ${count >= MAX_ADMINS ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${count >= MAX_ADMINS ? '#ef4444' : '#10b981'}; border: 1px solid ${count >= MAX_ADMINS ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}">
            ${count} / ${MAX_ADMINS} ${count >= MAX_ADMINS ? '⚠️ FULL' : 'SLOTS USED'}
          </span>
        </div>
      `;

      adminAccounts.forEach((acc, idx) => {
        const isSuper = acc.role === 'superadmin';
        html += `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 14px; border-radius: 12px; margin-bottom: 12px; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <strong style="${isSuper ? 'color: var(--accent-orange); font-size: 13.5px;' : 'color: #fff; font-size: 13px;'}">
                Slot ${idx + 1}: ${acc.name} ${isSuper ? '👑 (Super Admin)' : '📦 (Admin / Manager)'}
              </strong>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 10px; opacity: 0.8; background: rgba(245, 158, 11, 0.15); color: var(--accent-orange); padding: 3px 8px; border-radius: 6px; font-weight: bold;">${acc.role || 'admin'}</span>
                ${!isSuper ? `
                  <button class="btn btn-danger" style="width: auto; height: 32px; min-height: 32px; padding: 4px 12px; font-size: 11px; font-weight: 700; border-radius: 10px; margin: 0; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: 1.5px solid rgba(239,68,68,0.4); background: rgba(239,68,68,0.12); color: #f43f5e; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.15); transition: all 0.2s ease; cursor: pointer;" onclick="deleteAdminAccount('${acc.id}')">
                    🗑️ நீக்கு / Delete
                  </button>
                ` : ''}
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; gap: 8px; align-items: center;">
                <span style="font-size: 11px; color: var(--text-muted); width: 130px; flex-shrink: 0;">அட்மின் பெயர் / Name:</span>
                <input type="text" id="admin-user-name-${acc.id}" class="form-control" style="font-size: 12px; padding: 6px 10px; height: 36px;" value="${acc.name || ''}" placeholder="Admin Name" />
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <span style="font-size: 11px; color: var(--text-muted); width: 130px; flex-shrink: 0;">யூசர்நேம் / மொபைல்:</span>
                <input type="text" id="admin-user-phone-${acc.id}" class="form-control" style="font-size: 12px; padding: 6px 10px; height: 36px;" value="${acc.phone || ''}" placeholder="Mobile / Username" />
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <span style="font-size: 11px; color: var(--text-muted); width: 130px; flex-shrink: 0;">கடவுச்சொல் / Password:</span>
                <div style="position: relative; flex: 1; display: flex; align-items: center;">
                  <input type="password" id="admin-user-pass-${acc.id}" class="form-control" style="font-size: 12px; padding: 6px 36px 6px 10px; height: 36px; width: 100%;" value="${acc.password || ''}" placeholder="Password" />
                  <span style="position: absolute; right: 10px; font-size: 14px; cursor: pointer; color: var(--text-muted);" onclick="togglePasswordVisibility('admin-user-pass-${acc.id}', this)">👁️</span>
                </div>
              </div>
            </div>

            <div style="text-align: right; margin-top: 12px;">
              <button class="btn btn-primary" style="width: auto; height: 36px; min-height: 36px; padding: 6px 16px; font-size: 12px; font-weight: 800; margin: 0; border-radius: 10px; background: linear-gradient(135deg, var(--accent-orange) 0%, #ea580c 100%); border: 1px solid rgba(255,255,255,0.2); color: #000; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); display: inline-flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.2s ease; cursor: pointer;" onclick="saveAdminAccountConfig('${acc.id}')">
                சேமி / Save Changes ✓
              </button>
            </div>
          </div>
        `;
      });

      if (count >= MAX_ADMINS) {
        html += `
          <div style="margin-top: 14px; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 12px 14px; background: rgba(239, 68, 68, 0.05); text-align: center;">
            <p style="font-size: 12px; color: #ef4444; font-weight: 700; margin-bottom: 4px;">
              ⚠️ அதிகபட்ச வரம்பான 10 அட்மின் கணக்குகள் எட்டப்பட்டுவிட்டன (10/10 Slots Filled)
            </p>
            <p style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">
              புதிய அட்மினைச் சேர்க்க விரும்பினால், மேலே உள்ள பட்டியலில் இருந்து ஏதேனும் ஒரு அட்மின் கணக்கை நீக்க வேண்டும்.
            </p>
          </div>
        `;
      } else {
        html += `
          <div style="margin-top: 20px; border: 1.5px dashed var(--accent-orange); border-radius: 14px; padding: 16px; background: rgba(245,158,11,0.03);">
            <h5 style="color: var(--accent-orange); font-size: 13px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span>➕</span> <span> புதிய அட்மின் உருவாக்கு / Create New Admin</span>
              </span>
              <span style="font-size: 10px; padding: 3px 10px; border-radius: 12px; background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-weight: bold;">
                Slot ${count + 1} of ${MAX_ADMINS}
              </span>
            </h5>

            <div style="display: flex; flex-direction: column; gap: 10px;">
              <div>
                <label style="font-size:11.5px; font-weight: 700; color: #fff; display:block; margin-bottom:4px;">அட்மின் பெயர் / Admin Name *</label>
                <input type="text" id="new-admin-name" class="form-control" placeholder="எ.கா: Easwaran (ஈஸ்வரன்)" style="font-size: 12.5px; padding: 8px 12px; height: 40px; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.12); color: #fff; box-sizing: border-box; width: 100%;" />
              </div>
              <div>
                <label style="font-size:11.5px; font-weight: 700; color: #fff; display:block; margin-bottom:4px;">யூசர்நேம் / மொபைல் எண் (Username / Mobile) *</label>
                <input type="text" id="new-admin-phone" class="form-control" placeholder="எ.கா: 9876543210 அல்லது easwaran" style="font-size: 12.5px; padding: 8px 12px; height: 40px; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.12); color: #fff; box-sizing: border-box; width: 100%;" />
              </div>
              <div>
                <label style="font-size:11.5px; font-weight: 700; color: #fff; display:block; margin-bottom:4px;">கடவுச்சொல் / Password *</label>
                <input type="text" id="new-admin-pass" class="form-control" placeholder="எ.கா: easwaran123" style="font-size: 12.5px; padding: 8px 12px; height: 40px; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.12); color: #fff; box-sizing: border-box; width: 100%;" />
              </div>

              <button class="btn btn-primary" style="width: 100%; height: 44px; min-height: 44px; padding: 10px; font-size: 13px; font-weight: 800; margin-top: 8px; background: linear-gradient(135deg, var(--accent-orange) 0%, #ea580c 100%); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; color: #000; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease;" onclick="addNewAdminAccount()">
                ✨ அட்மின் கணக்கை உருவாக்கு / Create Admin Account
              </button>
            </div>
          </div>
        `;
      }

      targets.forEach(t => {
        t.innerHTML = html;
      });
    }

    function deleteAdminAccount(id) {
      if (id === 'a1') {
        showToast("Super Admin (Anantharaj) கணக்கை நீக்க முடியாது!", "error");
        return;
      }
      showCustomConfirm(
        "Delete Admin Account?",
        "இந்த அட்மின் கணக்கை நிரந்தரமாக நீக்க வேண்டுமா?",
        function() {
          let accounts = getData('ek_admin_accounts', []);
          const accountToDelete = accounts.find(a => a.id === id);
          if (accountToDelete) {
            markAdminAsDeleted(id);
            markAdminAsDeleted(accountToDelete.phone);

            accounts = accounts.filter(a => a.id !== id);
            saveData('ek_admin_accounts', accounts);
            adminAccounts = accounts;

            if (typeof db !== 'undefined' && db) {
              db.collection('ek_admin_accounts').doc(id).delete()
                .then(() => {
                  try { publishPublicStaffDirectory(); } catch(pErr) {}
                })
                .catch(err => console.error(err));
            }

            showToast(`அட்மின் (${accountToDelete.name}) நீக்கப்பட்டார்!`, "success");
            populateAdminSelector();
            renderAdminAccountsSettings();
          }
        }
      );
    }

    async function addNewAdminAccount() {
      let accounts = getData('ek_admin_accounts', []);
      if (accounts.length >= 10) {
        showToast("அதிகபட்சமாக 10 அட்மின் கணக்குகள் மட்டுமே சேர்க்க முடியும்!", "error");
        return;
      }

      const nameInput = document.getElementById('new-admin-name');
      const phoneInput = document.getElementById('new-admin-phone');
      const passInput = document.getElementById('new-admin-pass');

      if (!nameInput || !phoneInput || !passInput) return;

      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const pass = passInput.value.trim();

      if (!name) {
        showToast("தயவுசெய்து அட்மின் பெயரை உள்ளிடவும்! (Please enter Admin name)", "error");
        return;
      }
      if (!phone || phone.length < 3) {
        showToast("யூசர்நேம் / மொபைல் எண் குறைந்தது 3 எழுத்துக்கள் இருக்க வேண்டும்!", "error");
        return;
      }
      if (!pass || pass.length < 6) {
        showToast("கடவுச்சொல் (Password) குறைந்தது 6 எழுத்துக்கள் இருக்க வேண்டும்!", "error");
        return;
      }

      const duplicate = accounts.find(a => a.phone && a.phone.toLowerCase() === phone.toLowerCase());
      if (duplicate) {
        showToast(`இந்த யூசர்நேம்/எண் (${phone}) ஏற்கனவே ${duplicate.name}-க்கு ஒதுக்கப்பட்டுள்ளது!`, "error");
        return;
      }

      const adminEmail = phone.includes('@') ? phone.toLowerCase() : `admin_${phone}@app.com`;
      let newId = 'a_' + Math.floor(100000 + Math.random() * 900000);

      // Provision Firebase Auth account via secondary app to avoid logging out current admin
      if (typeof firebase !== 'undefined' && firebase.auth && typeof firebaseConfig !== 'undefined') {
        try {
          const tempAppName = "AdminCreate_" + Date.now();
          const tempApp = firebase.initializeApp(firebaseConfig, tempAppName);
          try {
            const authRes = await tempApp.auth().createUserWithEmailAndPassword(adminEmail, pass);
            if (authRes && authRes.user && authRes.user.uid) {
              newId = authRes.user.uid;
            }
          } catch (authErr) {
            if (authErr.code !== 'auth/email-already-in-use') {
              console.warn("[Admin Auth Provisioning Notice]:", authErr);
            }
          } finally {
            try { await tempApp.delete(); } catch(e) {}
          }
        } catch (initErr) {
          console.warn("[Temp App Init Notice]:", initErr);
        }
      }

      unmarkAdminAsDeleted(newId);
      unmarkAdminAsDeleted(phone);

      const hashedPass = 'hash:' + await hashPassword(pass);

      const newAdmin = {
        id: newId,
        uid: newId,
        name: name,
        phone: phone,
        email: adminEmail,
        password: hashedPass,
        role: 'admin',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      accounts.push(newAdmin);
      saveData('ek_admin_accounts', accounts);
      adminAccounts = accounts;

      if (typeof db !== 'undefined' && db) {
        db.collection('ek_admin_accounts').doc(newId).set(newAdmin)
          .then(() => {
            try { publishPublicStaffDirectory(); } catch(pErr) {}
          })
          .catch(err => console.error("Admin cloud sync error:", err));
      }

      showToast(`🎉 அட்மின் (${name}) கணக்கு வெற்றிகரமாக உருவாக்கப்பட்டது!`, "success");

      nameInput.value = '';
      phoneInput.value = '';
      passInput.value = '';

      populateAdminSelector();
      renderAdminAccountsSettings();
    }

    async function saveAdminAccountConfig(id) {
      const nameInput = document.getElementById(`admin-user-name-${id}`);
      const phoneInput = document.getElementById(`admin-user-phone-${id}`);
      const passInput = document.getElementById(`admin-user-pass-${id}`);
      if (!phoneInput || !passInput) return;

      const name = nameInput ? nameInput.value.trim() : '';
      const phone = phoneInput.value.trim();
      const pass = passInput.value.trim();

      if (!phone || phone.length < 3) {
        showToast("யூசர்நேம் / மொபைல் எண் குறைந்தது 3 எழுத்துக்கள் இருக்க வேண்டும்!", "error");
        return;
      }
      if (!pass || pass.length < 4) {
        showToast("கடவுச்சொல் குறைந்தது 4 எழுத்துக்கள் இருக்க வேண்டும்!", "error");
        return;
      }

      let accounts = getData('ek_admin_accounts');
      const idx = accounts.findIndex(a => a.id === id);
      if (idx !== -1) {
        const duplicate = accounts.find(a => a.phone.toLowerCase() === phone.toLowerCase() && a.id !== id);
        if (duplicate) {
          showToast(`இந்த யூசர்நேம் (${phone}) ஏற்கனவே ${duplicate.name}-க்கு உள்ளது!`, "error");
          return;
        }

        let hashedPass = pass;
        if (!pass.startsWith('hash:')) {
          hashedPass = 'hash:' + await hashPassword(pass);
        }

        if (name) accounts[idx].name = name;
        accounts[idx].phone = phone;
        accounts[idx].password = hashedPass;
        accounts[idx].updatedAt = new Date().toISOString();
        saveData('ek_admin_accounts', accounts);

        adminAccounts = accounts;

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_admin_accounts').doc(id).set(accounts[idx])
            .then(() => {
              try { publishPublicStaffDirectory(); } catch(pErr) {}
            })
            .catch(err => console.error("Admin cloud sync error:", err));
        }

        populateAdminSelector();

        const session = getAdminSession();
        if (session && (session.id === id || session.phone === accounts[idx].phone)) {
          if (name) session.name = name;
          session.phone = phone;
          saveData('ek_admin_session', session);
        }

        showToast(`அட்மின் (${accounts[idx].name}) விபரங்கள் சேமிக்கப்பட்டன! 👑`, "success");
        renderAdminAccountsSettings();
      }
    }

    const fpTranslations = {
      en: {
        title: "Password Recovery",
        subtitle: "Enter your registered mobile number or email to recover your account.",
        labelIdentifier: "Registered Mobile Number or Email",
        labelOtp: "6-Digit Verification Code (OTP)",
        labelNewPass: "New Password",
        labelConfirmPass: "Confirm Password",
        otpHelp: "Enter the 6-digit OTP sent to your registered email.",
        btnSend: "🚀 Send Password Reset Link",
        btnReset: "🔐 Update Password",
        loadingSending: "Verifying account & sending reset link...",
        loadingConnecting: "Connecting to secure server. Please wait...",
        successTitle: "Reset Link Sent Successfully! ✉️",
        successText: "Password reset link has been sent to your registered email.<br><br>Please check your Gmail <strong>Inbox</strong> or <strong>Spam folder</strong> and click the link to set a new password.",
        successClose: "Back to Login",
        enterValidIdentifier: "Please enter your registered 10-digit mobile number or email.",
        userNotFound: "No registered account found with these details. Please register first.",
        sendingCodeSuccess: "Success! Password reset link sent to your registered email.",
        otpMismatch: "Please enter the complete 6-digit OTP code.",
        passMismatch: "Passwords do not match. Please re-enter.",
        passShort: "Password must be at least 6 characters.",
        resetSuccess: "Password reset successfully! Please log in with your new password.",
        labelResetMethod: "Reset Method",
        methodOtpTitle: "In-App OTP Code",
        methodOtpDesc: "Receive a 6-digit code to reset password in app",
        methodLinkTitle: "Official Reset Link",
        methodLinkDesc: "Receive a direct password reset link in Gmail"
      },
      ta: {
        title: "கடவுச்சொல் மீட்பு",
        subtitle: "பதிவுசெய்த மொபைல் எண் அல்லது மின்னஞ்சலை உள்ளிட்டு கணக்கை மீட்டெடுக்கவும்.",
        labelIdentifier: "பதிவுசெய்த மொபைல் எண் அல்லது மின்னஞ்சல்",
        labelOtp: "6-இலக்க சரிபார்ப்பு குறியீடு (OTP)",
        labelNewPass: "புதிய கடவுச்சொல்",
        labelConfirmPass: "கடவுச்சொல் உறுதிப்படுத்தல்",
        otpHelp: "மின்னஞ்சலுக்கு அனுப்பப்பட்ட 6-இலக்க OTP குறியீட்டை உள்ளிடவும்.",
        btnSend: "🚀 கடவுச்சொல் மீட்டமைப்பு இணைப்பை அனுப்பு",
        btnReset: "🔐 புதிய கடவுச்சொல்லை மாற்றுக",
        loadingSending: "சரிபார்க்கப்பட்டு இணைப்பு அனுப்பப்படுகிறது...",
        loadingConnecting: "தயவுசெய்து சிறிது நேரம் காத்திருக்கவும்...",
        successTitle: "மீட்டமைப்பு இணைப்பு அனுப்பப்பட்டது! ✉️",
        successText: "கடவுச்சொல் மீட்டமைப்பு இணைப்பு உங்கள் பதிவு செய்யப்பட்ட மின்னஞ்சலுக்கு வெற்றிகரமாக அனுப்பப்பட்டுள்ளது.<br><br>தயவுசெய்து உங்கள் ஜிமெயில் <strong>இன்பாக்ஸ் (Inbox)</strong> அல்லது <strong>ஸ்பேம் (Spam)</strong> கோப்புறையைத் திறந்து, அங்கு வந்துள்ள இணைப்பைக் கிளிக் செய்து புதிய கடவுச்சொல்லை மாற்றிக் கொள்ளவும்.",
        successClose: "உள்நுழைவு திரைக்குச் செல்ல",
        enterValidIdentifier: "பதிவுசெய்த 10 இலக்க மொபைல் எண் அல்லது மின்னஞ்சலை உள்ளிடவும்.",
        userNotFound: "இந்த விவரங்களில் பதிவு செய்யப்பட்ட கணக்கு எதுவும் இல்லை. தயவுசெய்து புதிய கணக்கு தொடங்கவும்.",
        sendingCodeSuccess: "வெற்றி! கடவுச்சொல் மீட்டமைப்பு இணைப்பு உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது.",
        otpMismatch: "தயவுசெய்து முழுமையான 6-இலக்க OTP குறியீட்டை உள்ளிடவும்.",
        passMismatch: "கடவுச்சொற்கள் பொருந்தவில்லை. மீண்டும் உள்ளிடவும்.",
        passShort: "கடவுச்சொல் குறைந்தது 6 எழுத்துக்கள் இருக்க வேண்டும்.",
        resetSuccess: "கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது! புதிய கடவுச்சொல் மூலம் உள்நுழையவும்.",
        labelResetMethod: "மீட்பு முறை",
        methodOtpTitle: "OTP குறியீடு முறை",
        methodOtpDesc: "பயன்பாட்டிலேயே மாற்ற 6-இலக்க OTP பெறவும்",
        methodLinkTitle: "மின்னஞ்சல் இணைப்பு முறை",
        methodLinkDesc: "ஜிமெயிலில் நேரடி மீட்டமைப்பு இணைப்பைப் பெறவும்"
      }
    };

    let currentFPMethod = 'gmail-link';
    let fpMatchedUser = null;
    let fpIdentifier = '';

    function handleFpIdentifierInput(val) {
      const hintEl = document.getElementById('fp-account-hint');
      if (!hintEl) return;
      const clean = String(val || '').trim();
      if (!clean) {
        hintEl.style.display = 'none';
        hintEl.innerHTML = '';
        return;
      }

      const isTa = currentLang === 'ta';
      const localUsers = typeof getData === 'function' ? (getData('ek_users', []) || []) : [];
      let foundUser = null;

      if (clean.includes('@')) {
        const lowerEmail = clean.toLowerCase();
        foundUser = localUsers.find(u => u && (u.email || '').toLowerCase() === lowerEmail);
      } else {
        const digits = clean.replace(/\D/g, '');
        const phone10 = digits.length >= 10 ? digits.slice(-10) : digits;
        if (phone10.length === 10) {
          foundUser = localUsers.find(u => {
            if (!u) return false;
            const uDigits = String(u.phone || u.phoneNumber || '').replace(/\D/g, '');
            const u10 = uDigits.length >= 10 ? uDigits.slice(-10) : uDigits;
            return u10 === phone10;
          });
        }
      }

      if (foundUser) {
        fpMatchedUser = foundUser;
        const uName = foundUser.name || (isTa ? 'வாடிக்கையாளர்' : 'Customer');
        const hasExternalEmail = foundUser.email && !foundUser.email.endsWith('@app.com') && foundUser.email.includes('@');
        const displayMail = hasExternalEmail ? maskIdentifier(foundUser.email) : (isTa ? 'மொபைல் கணக்கு (மின்னஞ்சல் இல்லை)' : 'Mobile Account (No email)');
        hintEl.style.display = 'block';
        hintEl.innerHTML = `<span>👤 <strong>${escapeHtml(uName)}</strong> &bull; ${displayMail} ${isTa ? 'கண்டறியப்பட்டது ✅' : 'Found ✅'}</span>`;
      } else {
        hintEl.style.display = 'none';
      }
    }

    function openFpWhatsAppHelp() {
      const inputVal = (document.getElementById('fp-email-input')?.value || '').trim();
      const shopPhone = '918778148899';
      const isTa = currentLang === 'ta';
      const message = isTa
        ? `வணக்கம் அண்ணே, எனது எடப்பாடி கடை கணக்கின் (விவரம்: ${inputVal || 'வாடிக்கையாளர்'}) கடவுச்சொல்லை மாற்ற உதவி தேவை.`
        : `Hello Admin, I need help recovering the password for my Edappadi Kadai account (Details: ${inputVal || 'Customer'}).`;
      const waUrl = `https://wa.me/${shopPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
    }

    function switchToOtpStageManual() {
      const stageLink = document.getElementById('fp-stage-link');
      const stageOtp = document.getElementById('fp-stage-otp');
      if (stageLink) stageLink.style.display = 'none';
      if (stageOtp) stageOtp.style.display = 'flex';
      const otpInp = document.querySelector('.otp-box');
      if (otpInp) otpInp.focus();
    }

    function openForgotPasswordModal(event) {
      if (event) event.preventDefault();
      try {
        debugLog("[Forgot Password] Opening modal safely...");
        const loginIdEl = document.getElementById('login-identifier');
        const loginIdVal = loginIdEl ? loginIdEl.value.trim() : '';
        const emailInp = document.getElementById('fp-email-input');

        if (emailInp) {
          emailInp.value = loginIdVal || '';
          if (loginIdVal) handleFpIdentifierInput(loginIdVal);
        }

        currentFPMethod = 'gmail-link';
        const methodOtp = document.getElementById('fp-method-otp');
        if (methodOtp) methodOtp.checked = false;
        const methodLink = document.getElementById('fp-method-link');
        if (methodLink) methodLink.checked = true;

        const stage1 = document.getElementById('fp-stage-1'); if (stage1) stage1.style.display = 'block';
        const stageLoading = document.getElementById('fp-stage-loading'); if (stageLoading) stageLoading.style.display = 'none';
        const stageOtp = document.getElementById('fp-stage-otp'); if (stageOtp) stageOtp.style.display = 'none';
        const stageLink = document.getElementById('fp-stage-link'); if (stageLink) stageLink.style.display = 'none';

        const otpInp = document.getElementById('fp-otp-input'); if (otpInp) otpInp.value = '';
        const newpassInp = document.getElementById('fp-newpass-input'); if (newpassInp) newpassInp.value = '';
        const confirmInp = document.getElementById('fp-newpass-confirm-input'); if (confirmInp) confirmInp.value = '';

        applyForgotPasswordTranslations();

        const fpModal = document.getElementById('forgot-password-modal');
        if (fpModal) {
          fpModal.style.display = 'flex';
          debugLog("[Forgot Password] Modal displayed successfully.");
        } else {
          console.error("[Forgot Password] Error: forgot-password-modal element not found in DOM.");
        }
      } catch (err) {
        console.error("[Forgot Password] Exception inside openForgotPasswordModal:", err);
      }
    }

    function hideForgotPasswordModal() {
      const fpModal = document.getElementById('forgot-password-modal');
      if (fpModal) fpModal.style.display = 'none';
    }

    function selectFPMethod(method) {
      currentFPMethod = 'gmail-link';
      const otpRadio = document.getElementById('fp-method-otp');
      const linkRadio = document.getElementById('fp-method-link');
      if (otpRadio) otpRadio.checked = false;
      if (linkRadio) linkRadio.checked = true;
    }

    function applyForgotPasswordTranslations() {
      const isTa = currentLang === 'ta';
      const strings = isTa ? fpTranslations.ta : fpTranslations.en;

      const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el && text) el.innerText = text;
      };

      safeSetText('fp-title', strings.title);
      safeSetText('fp-subtitle', strings.subtitle);
      safeSetText('fp-label-email', strings.labelIdentifier);
      safeSetText('fp-label-identifier', strings.labelIdentifier);
      safeSetText('fp-label-otp', strings.labelOtp);
      safeSetText('fp-label-newpass', strings.labelNewPass);
      safeSetText('fp-label-newpass-confirm', strings.labelConfirmPass);
      safeSetText('fp-otp-help', strings.otpHelp);
      safeSetText('fp-label-reset-method', strings.labelResetMethod);

      safeSetText('fp-method-otp-title', strings.methodOtpTitle);
      safeSetText('fp-method-otp-desc', strings.methodOtpDesc);
      safeSetText('fp-method-link-title', strings.methodLinkTitle);
      safeSetText('fp-method-link-desc', strings.methodLinkDesc);

      const sendBtn = document.getElementById('fp-btn-send-otp') || document.querySelector('#fp-stage-1 button');
      if (sendBtn && sendBtn.querySelector('span')) sendBtn.querySelector('span').innerText = strings.btnSend;

      const resetBtn = document.getElementById('fp-btn-reset-confirm') || document.querySelector('#fp-stage-otp button');
      if (resetBtn && resetBtn.querySelector('span')) resetBtn.querySelector('span').innerText = strings.btnReset;

      safeSetText('fp-loading-title', strings.loadingSending);
      safeSetText('fp-loading-msg', strings.loadingConnecting);

      safeSetText('fp-link-title', strings.successTitle);
      safeSetText('fp-btn-close-success', strings.successClose);

      const linkFp = document.getElementById('link-forgot-password');
      if (linkFp) {
        linkFp.innerText = isTa ? "கடவுச்சொல் மறந்துவிட்டதா?" : "Forgot Password?";
      }
    }

    function maskIdentifier(val) {
      if (!val) return '';
      if (val.includes('@')) {
        const parts = val.split('@');
        const name = parts[0];
        const domain = parts[1];
        if (name.length <= 2) return name + "***@" + domain;
        return name.slice(0, 2) + "***" + name.slice(-1) + "@" + domain;
      } else {
        if (val.length >= 8) {
          return val.slice(0, 2) + "*****" + val.slice(-3);
        }
        return val.slice(0, 2) + "***";
      }
    }

    function onOtpInput(el, idx) {
      el.value = el.value.replace(/[^0-9]/g, '');
      if (el.value.length === 1 && idx < 5) {
        const boxes = document.querySelectorAll('.otp-box');
        if (boxes[idx + 1]) boxes[idx + 1].focus();
      }
      const otpInp = document.getElementById('fp-otp-input');
      if (otpInp) {
        otpInp.value = getOtpValue();
      }
    }

    function onOtpKeyDown(e, idx) {
      if (e.key === 'Backspace') {
        const boxes = document.querySelectorAll('.otp-box');
        if (boxes[idx].value === '' && idx > 0) {
          boxes[idx - 1].focus();
          boxes[idx - 1].value = '';
        }
      }
    }

    function getOtpValue() {
      const boxes = document.querySelectorAll('.otp-box');
      let otp = '';
      boxes.forEach(b => otp += b.value);
      return otp;
    }

    function clearOtpValues() {
      const boxes = document.querySelectorAll('.otp-box');
      boxes.forEach(b => b.value = '');
      const otpInp = document.getElementById('fp-otp-input');
      if (otpInp) otpInp.value = '';
    }

    async function sendForgotPasswordOtp() {
      const inputVal = (document.getElementById('fp-email-input')?.value || '').trim();
      const isTa = currentLang === 'ta';

      if (!inputVal) {
        showToast(
          isTa ? "தயவுசெய்து உங்கள் பதிவு செய்யப்பட்ட மொபைல் எண் அல்லது மின்னஞ்சலை உள்ளிடவும்." : "Please enter your registered mobile number or email address.",
          "error"
        );
        return;
      }

      let emailVal = '';
      let isPhone = false;
      let phone10 = '';
      let resolvedUser = null;

      if (inputVal.includes('@')) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inputVal)) {
          showToast(
            isTa ? "செல்லுபடியாகும் மின்னஞ்சல் முகவரியை உள்ளிடவும்." : "Please enter a valid email address.",
            "error"
          );
          return;
        }
        emailVal = inputVal.toLowerCase();
      } else {
        isPhone = true;
        let digits = inputVal.replace(/\D/g, '');
        if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
        else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
        else if (digits.length > 10) digits = digits.slice(-10);

        if (digits.length !== 10) {
          showToast(
            isTa ? "தயவுசெய்து சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்." : "Please enter a valid 10-digit mobile number.",
            "error"
          );
          return;
        }
        phone10 = digits;
      }

      const stage1 = document.getElementById('fp-stage-1');
      const stageLoading = document.getElementById('fp-stage-loading');
      const stageOtp = document.getElementById('fp-stage-otp');
      const stageLink = document.getElementById('fp-stage-link');

      if (stage1) stage1.style.display = 'none';
      if (stageOtp) stageOtp.style.display = 'none';
      if (stageLink) stageLink.style.display = 'none';
      if (stageLoading) stageLoading.style.display = 'block';

      const loadingTitle = document.getElementById('fp-loading-title');
      const loadingMsg = document.getElementById('fp-loading-msg');
      if (loadingTitle) loadingTitle.innerText = isTa ? "சரிபார்க்கப்படுகிறது..." : "Verifying account...";
      if (loadingMsg) loadingMsg.innerText = isTa ? "கணக்கு சரிபார்க்கப்பட்டு கடவுச்சொல் மீட்டமைப்பு அனுப்பப்படுகிறது..." : "Verifying account details & preparing password reset...";

      try {
        // Step 1: If phone number was entered, resolve customer account from local cache and Firestore
        if (isPhone) {
          const localUsers = typeof getData === 'function' ? (getData('ek_users', []) || []) : [];
          resolvedUser = localUsers.find(u => {
            if (!u) return false;
            const uDigits = String(u.phone || u.phoneNumber || '').replace(/\D/g, '');
            const u10 = uDigits.length >= 10 ? uDigits.slice(-10) : uDigits;
            return u10 === phone10;
          });

          // If not found in local cache, search Firestore ek_users directly
          if (!resolvedUser && typeof db !== 'undefined' && db) {
            try {
              const variants = [phone10, '+91' + phone10, '91' + phone10, '+91 ' + phone10];
              const userQuerySnap = await db.collection('ek_users').where('phone', 'in', variants).limit(1).get().catch(() => null);
              if (userQuerySnap && !userQuerySnap.empty) {
                resolvedUser = { id: userQuerySnap.docs[0].id, ...userQuerySnap.docs[0].data() };
              } else {
                const docSnap = await db.collection('ek_users').doc(phone10).get().catch(() => null);
                if (docSnap && docSnap.exists) {
                  resolvedUser = { id: docSnap.id, ...docSnap.data() };
                }
              }
            } catch (dbFindErr) {
              console.warn("[Forgot Password] Firestore lookup by phone:", dbFindErr);
            }
          }

          if (resolvedUser) {
            const userName = resolvedUser.name || (isTa ? 'வாடிக்கையாளர்' : 'Customer');
            const hasExternalEmail = resolvedUser.email && !resolvedUser.email.endsWith('@app.com') && resolvedUser.email.includes('@');

            if (hasExternalEmail) {
              emailVal = resolvedUser.email.trim().toLowerCase();
            } else {
              // Account is mobile-registered without external email inbox
              if (stageLoading) stageLoading.style.display = 'none';
              if (stage1) stage1.style.display = 'block';

              const phoneHelpText = isTa
                ? `வணக்கம் ${userName}! உங்கள் கணக்கு மொபைல் எண் (${phone10}) மூலம் உருவாக்கப்பட்டுள்ளது. கடவுச்சொல்லை உடனடியாக மாற்ற கீழே உள்ள வாட்ஸ்அப் (WhatsApp) அல்லது கடை அழைப்பு பொத்தானைப் பயன்படுத்தவும்.`
                : `Hello ${userName}! Your account is registered via mobile (${phone10}). Please use the WhatsApp or Call button below to recover your password instantly with the store admin.`;

              showCustomAlert(
                isTa ? "மொபைல் கணக்கு உதவி / Account Help" : "Mobile Account Recovery",
                `<div style="text-align:center; padding:10px;">
                  <div style="font-size:38px; margin-bottom:10px;">📱</div>
                  <p style="font-size:13px; line-height:1.6; color:#e2e8f0;">${phoneHelpText}</p>
                  <div style="display:flex; gap:10px; margin-top:16px;">
                    <a href="https://wa.me/918778148899?text=${encodeURIComponent(isTa ? `வணக்கம் அண்ணே, எனது எடப்பாடி கடை கணக்கின் (மொபைல்: ${phone10}) கடவுச்சொல்லை மாற்ற உதவி தேவை.` : `Hello Admin, I need help resetting password for mobile: ${phone10}`)}" target="_blank" style="flex:1; background:#25D366; color:#fff; text-decoration:none; padding:10px; border-radius:10px; font-weight:bold; font-size:13px;">💬 WhatsApp</a>
                    <a href="tel:8778148899" style="flex:1; background:#0284c7; color:#fff; text-decoration:none; padding:10px; border-radius:10px; font-weight:bold; font-size:13px;">📞 Call Admin</a>
                  </div>
                </div>`
              );
              return;
            }
          } else {
            // User not found anywhere
            if (stageLoading) stageLoading.style.display = 'none';
            if (stage1) stage1.style.display = 'block';
            showToast(
              isTa ? `இந்த மொபைல் எண் (${phone10}) பதிவு செய்யப்படவில்லை! தயவுசெய்து புதிய கணக்கு தொடங்குங்கள் ❌` : `Mobile number (${phone10}) is not registered. Please register first ❌`,
              "error"
            );
            return;
          }
        }

        if (!emailVal) {
          throw new Error(isTa ? "மின்னஞ்சல் முகவரி கிடைக்கவில்லை." : "Registered email address could not be resolved.");
        }

        // Step 2: Send official Firebase Auth password reset email
        // This is Google's native password reset API: 100% free, highly reliable, zero SMTP configuration required!
        let resetEmailSent = false;
        if (typeof firebase !== 'undefined' && firebase.auth) {
          try {
            await firebase.auth().sendPasswordResetEmail(emailVal);
            resetEmailSent = true;
            debugLog("[Forgot Password] Firebase sendPasswordResetEmail succeeded for:", emailVal);
          } catch (fbAuthErr) {
            console.warn("[Forgot Password] Firebase sendPasswordResetEmail error:", fbAuthErr);
            if (fbAuthErr.code === 'auth/user-not-found') {
              if (stageLoading) stageLoading.style.display = 'none';
              if (stage1) stage1.style.display = 'block';
              showToast(
                isTa ? "இந்த மின்னஞ்சலில் பதிவு செய்யப்பட்ட கணக்கு எதுவும் இல்லை ❌" : "No registered account found for this email ❌",
                "error"
              );
              return;
            } else if (fbAuthErr.code === 'auth/invalid-email') {
              if (stageLoading) stageLoading.style.display = 'none';
              if (stage1) stage1.style.display = 'block';
              showToast(
                isTa ? "செல்லுபடியாகாத மின்னஞ்சல் முகவரி." : "Invalid email address format.",
                "error"
              );
              return;
            } else if (fbAuthErr.code === 'auth/too-many-requests') {
              if (stageLoading) stageLoading.style.display = 'none';
              if (stage1) stage1.style.display = 'block';
              showToast(
                isTa ? "அதிக முறை முயற்சிக்கப்பட்டுள்ளது. சிறிது நேரம் கழித்து முயற்சிக்கவும்." : "Too many requests. Please try again later.",
                "warning"
              );
              return;
            }
          }
        }

        // Optional Step 3: Trigger Cloud Function OTP in background if available (won't fail flow if SMTP not setup)
        try {
          const sendOtpFn = typeof getCloudFunction === 'function' ? getCloudFunction('sendEmailOtp') : null;
          if (sendOtpFn) {
            sendOtpFn({ email: emailVal, phone: isPhone ? phone10 : '' }).catch(e => {
              console.log("[Forgot Password] Background sendEmailOtp note:", e.message);
            });
          }
        } catch (ignFnErr) {}

        // Step 4: Display Success View (stageLink)
        if (stageLoading) stageLoading.style.display = 'none';
        if (stageLink) {
          stageLink.style.display = 'block';
          const maskedEmail = maskIdentifier(emailVal);
          const linkTextEl = document.getElementById('fp-link-text');
          if (linkTextEl) {
            linkTextEl.innerHTML = isTa
              ? `கடவுச்சொல் மீட்டமைப்பு இணைப்பு <strong>${escapeHtml(maskedEmail)}</strong> என்ற மின்னஞ்சலுக்கு வெற்றிகரமாக அனுப்பப்பட்டுள்ளது.<br><br>தயவுசெய்து உங்கள் ஜிமெயில் <strong>இன்பாக்ஸ் (Inbox)</strong> அல்லது <strong>ஸ்பேம் (Spam)</strong> கோப்புறையைத் திறந்து, கூகுள் ஃபயர்பேஸ் அனுப்பியுள்ள இணைப்பைக் கிளிக் செய்து புதிய கடவுச்சொல்லை அமைத்துக் கொள்ளவும்.`
              : `A password reset link has been sent to <strong>${escapeHtml(maskedEmail)}</strong>.<br><br>Please check your Gmail <strong>Inbox</strong> or <strong>Spam folder</strong> and click the reset link to set your new password.`;
          }
        }

        showToast(
          isTa ? "கடவுச்சொல் மீட்டமைப்பு இணைப்பு உங்கள் மின்னஞ்சலுக்கு வெற்றிகரமாக அனுப்பப்பட்டது! ✉️" : "Password reset link sent to your email successfully! ✉️",
          "success"
        );

      } catch (err) {
        console.error("sendForgotPasswordOtp error:", err);
        if (stageLoading) stageLoading.style.display = 'none';
        if (stage1) stage1.style.display = 'block';
        showToast(
          isTa ? "பிழை: " + (err.message || "இணைப்பு அனுப்ப முடியவில்லை") : "Error: " + (err.message || "Failed to send reset link"),
          "error"
        );
      }
    }

    async function resendForgotPasswordOtp() {
      const inputVal = (document.getElementById('fp-email-input')?.value || '').trim();
      const isTa = currentLang === 'ta';
      const resendBtn = document.getElementById('fp-resend-otp-btn') || document.getElementById('fp-btn-resend-otp');

      if (!inputVal) {
        showToast(
          isTa ? "மின்னஞ்சல் அல்லது மொபைல் எண் கிடைக்கவில்லை." : "Email address or phone number not found.",
          "error"
        );
        return;
      }

      if (window._fpResendCooldownActive) {
        showToast(
          isTa ? "தயவுசெய்து சிறிது நேரம் காத்திருக்கவும்..." : "Please wait before requesting another link.",
          "warning"
        );
        return;
      }

      let originalBtnText = "";
      if (resendBtn) {
        originalBtnText = resendBtn.innerHTML;
        resendBtn.disabled = true;
        resendBtn.style.opacity = "0.6";
        resendBtn.innerHTML = `<span>⏳ ${isTa ? 'அனுப்பப்படுகிறது...' : 'Resending...'}</span>`;
      }

      try {
        let emailVal = inputVal.includes('@') ? inputVal.toLowerCase() : '';
        if (!emailVal && typeof getData === 'function') {
          const digits = inputVal.replace(/\D/g, '');
          const phone10 = digits.slice(-10);
          const localUsers = getData('ek_users', []) || [];
          const matched = localUsers.find(u => {
            const uDigits = String(u.phone || u.phoneNumber || '').replace(/\D/g, '');
            return uDigits.slice(-10) === phone10;
          });
          if (matched && matched.email) emailVal = matched.email.toLowerCase();
        }

        if (emailVal && typeof firebase !== 'undefined' && firebase.auth) {
          await firebase.auth().sendPasswordResetEmail(emailVal);
        }

        // Also attempt cloud function if available
        try {
          const sendOtpFn = typeof getCloudFunction === 'function' ? getCloudFunction('sendEmailOtp') : null;
          if (sendOtpFn) {
            await sendOtpFn({ email: emailVal || '', phone: !inputVal.includes('@') ? inputVal : '' });
          }
        } catch (cfErr) {}

        if (typeof clearOtpValues === 'function') clearOtpValues();
        showToast(
          isTa ? "மீட்டமைப்பு இணைப்பு உங்கள் மின்னஞ்சலுக்கு மீண்டும் அனுப்பப்பட்டது! ✉️" : "Reset link re-sent to your email! ✉️",
          "success"
        );

        // Start 60-second cooldown
        window._fpResendCooldownActive = true;
        let remaining = 60;
        const intervalId = setInterval(() => {
          remaining--;
          if (resendBtn) {
            resendBtn.innerHTML = `<span>⏳ ${isTa ? `மீண்டும் அனுப்ப (${remaining} வினாடிகள்)` : `Resend in ${remaining}s`}</span>`;
          }
          if (remaining <= 0) {
            clearInterval(intervalId);
            window._fpResendCooldownActive = false;
            if (resendBtn) {
              resendBtn.disabled = false;
              resendBtn.style.opacity = "1";
              resendBtn.innerHTML = originalBtnText || `<span>🔄 ${isTa ? 'மீண்டும் அனுப்ப' : 'Resend Link'}</span>`;
            }
          }
        }, 1000);
      } catch (err) {
        console.error("resendForgotPasswordOtp error:", err);
        showToast(
          isTa ? "மீண்டும் அனுப்ப முடியவில்லை: " + err.message : "Failed to resend: " + err.message,
          "error"
        );
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.style.opacity = "1";
          resendBtn.innerHTML = originalBtnText || `<span>🔄 ${isTa ? 'மீண்டும் அனுப்ப' : 'Resend Link'}</span>`;
        }
      }
    }

    async function verifyOtpAndResetPassword() {
      const emailVal = document.getElementById('fp-email-input').value.trim().toLowerCase();
      const otpVal = getOtpValue();
      const newPasswordVal = document.getElementById('fp-newpass-input').value;
      const confirmPasswordVal = document.getElementById('fp-newpass-confirm-input').value;
      const isTa = currentLang === 'ta';

      if (otpVal.length !== 6) {
        showToast(
          isTa ? "தயவுசெய்து 6-இலக்க OTP குறியீட்டை உள்ளிடவும்." : "Please enter the 6-digit OTP code.",
          "error"
        );
        return;
      }

      if (!newPasswordVal || newPasswordVal.length < 6) {
        showToast(
          isTa ? "புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்." : "New password must be at least 6 characters.",
          "error"
        );
        return;
      }

      if (newPasswordVal !== confirmPasswordVal) {
        showToast(
          isTa ? "கடவுச்சொற்கள் பொருந்தவில்லை." : "Passwords do not match.",
          "error"
        );
        return;
      }

      document.getElementById('fp-stage-otp').style.display = 'none';
      document.getElementById('fp-stage-loading').style.display = 'block';
      const loadingTitle = document.getElementById('fp-loading-title');
      const loadingMsg = document.getElementById('fp-loading-msg');
      if (loadingTitle) loadingTitle.innerText = isTa ? "கடவுச்சொல் மாற்றப்படுகிறது..." : "Resetting password...";
      if (loadingMsg) loadingMsg.innerText = isTa ? "தயவுசெய்து காத்திருக்கவும்..." : "Please wait a moment...";

      try {
        const resetPasswordFn = typeof getCloudFunction === 'function' ? getCloudFunction('verifyEmailOtpAndResetPassword') : null;
        if (!resetPasswordFn) throw new Error("Cloud Function service is not ready.");

        const res = await resetPasswordFn({
          email: emailVal,
          otp: otpVal,
          newPassword: newPasswordVal
        });

        if (res && res.data && res.data.success) {
          // Update cached customer password if present
          try {
            const localUsers = typeof getData === 'function' ? (getData('ek_users', []) || []) : [];
            const userIdx = localUsers.findIndex(u => u && (u.email || '').toLowerCase() === emailVal);
            if (userIdx !== -1) {
              localUsers[userIdx].password = newPasswordVal;
              localUsers[userIdx].updatedAt = new Date().toISOString();
              if (typeof saveData === 'function') saveData('ek_users', localUsers);
            }
          } catch (syncErr) {
            console.warn("Local user cache password sync:", syncErr);
          }

          // Pre-populate login identifier & clear old login password
          try {
            const loginIdEl = document.getElementById('login-identifier');
            if (loginIdEl && !loginIdEl.value) {
              loginIdEl.value = emailVal;
            }
            const passEl = document.getElementById('login-password');
            if (passEl) {
              passEl.value = '';
            }
          } catch (uiErr) {}

          document.getElementById('fp-stage-loading').style.display = 'none';
          hideForgotPasswordModal();
          showToast(
            isTa ? "கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது! புதிய கடவுச்சொல் மூலம் உள்நுழையவும் 🔐" : "Password reset successfully! Please log in with your new password 🔐",
            "success"
          );
        } else {
          throw new Error("Reset verification failed.");
        }
      } catch (err) {
        console.error("verifyEmailOtpAndResetPassword error:", err);
        document.getElementById('fp-stage-loading').style.display = 'none';
        document.getElementById('fp-stage-otp').style.display = 'flex';
        showToast(
          isTa ? "பிழை: " + err.message : "Error: " + err.message,
          "error"
        );
      }
    }

    async function handleLogin(event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (window.isLoginSubmitting) return;
      window.isLoginSubmitting = true;
      window.isManualLoginInProgress = true;

      const loginButton = event && event.target 
        ? (event.target.querySelector('button[type="submit"]') || event.target.closest('button') || document.querySelector('#login-form button[type="submit"]'))
        : document.querySelector('#login-form button[type="submit"]');

      let originalBtnHtml = "";
      if (loginButton) {
        originalBtnHtml = loginButton.innerHTML;
        loginButton.disabled = true;
        loginButton.innerHTML = `<span class="spinner" style="display:inline-block; width:14px; height:14px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align:middle;"></span> ${currentLang === 'ta' ? 'உள்நுழைகிறது...' : 'Logging in...'}`;
      }

      const restoreButton = () => {
        window.isLoginSubmitting = false;
        if (loginButton) {
          loginButton.disabled = false;
          loginButton.innerHTML = originalBtnHtml;
        }
      };

      // Yield thread to allow WebView/Browser to render spinner immediately
      await new Promise(resolve => setTimeout(resolve, 16));

      let loginCompleted = false;
      let loginTimedOut = false;
      let softNotifyTimer = null;
      let hardTimeoutTimer = null;

      // Soft notification timer for slow networks (BSNL, 3G, weak signal)
      softNotifyTimer = setTimeout(() => {
        if (!loginCompleted && window.isManualLoginInProgress) {
          showToast(
            currentLang === 'ta'
              ? "மெதுவான இணைய இணைப்பு... உள்நுழைவு பரிசீலிக்கப்படுகிறது."
              : "Slow network detected. Connecting to server...",
            "info"
          );
        }
      }, 10000);

      // Hard timeout timer (35 seconds)
      hardTimeoutTimer = setTimeout(() => {
        if (!loginCompleted) {
          loginTimedOut = true;
          showToast(
            currentLang === 'ta'
              ? "இணைய இணைப்பு தாமதம். தயவுசெய்து உங்கள் BSNL/Network தொடர்பை சரிபார்க்கவும்."
              : "Network connection delayed. Please check your network and try again.",
            "error"
          );
          restoreButton();
        }
      }, 35000);

      const cleanupTimers = () => {
        if (softNotifyTimer) clearTimeout(softNotifyTimer);
        if (hardTimeoutTimer) clearTimeout(hardTimeoutTimer);
      };

      try {
        const passEl = document.getElementById('login-password');
        const pass = passEl ? passEl.value : '';
        const rememberEl = document.getElementById('login-remember');
        const remember = rememberEl ? rememberEl.checked : true;

        if (currentLoginMode === 'admin') {
          const identifier = document.getElementById('admin-selector') ? document.getElementById('admin-selector').value : '';
          const adminEmail = identifier.includes('@') ? identifier : `admin_${identifier}@app.com`;
          const phoneStr = adminEmail.replace('admin_', '').split('@')[0];

          try {
            if (typeof firebase === 'undefined' || !firebase.auth) {
              loginCompleted = true;
              cleanupTimers();
              showToast(
                currentLang === 'ta'
                  ? "Firebase அங்கீகாரம் ஏற்றப்படவில்லை! தயவுசெய்து இணைய இணைப்பைச் சரிபார்க்கவும் ❌"
                  : "Firebase Auth not available. Please check internet connection ❌",
                "error"
              );
              restoreButton();
              return;
            }

            const currentAuthUser = firebase.auth().currentUser;
            if (currentAuthUser && currentAuthUser.email && currentAuthUser.email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
              await firebase.auth().signOut().catch(e => console.warn(e));
            }

            let cred = null;
            try {
              await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
              cred = await firebase.auth().signInWithEmailAndPassword(adminEmail, pass);
            } catch (signInErr) {
              console.warn("[Admin Login] Firebase signInWithEmailAndPassword failed:", signInErr);
              loginCompleted = true;
              cleanupTimers();
              showToast(
                currentLang === 'ta'
                  ? "கடவுச்சொல் அல்லது அட்மின் கணக்கு தவறானது! அட்மின் சான்றுகளை சரிபார்க்கவும் ❌"
                  : "Incorrect admin credentials or password! Please check credentials ❌",
                "error"
              );
              restoreButton();
              return;
            }

            if (!cred || !cred.user || !cred.user.uid) {
              loginCompleted = true;
              cleanupTimers();
              showToast(
                currentLang === 'ta'
                  ? "அட்மின் அங்கீகரிப்பு தோல்வியடைந்தது ❌"
                  : "Admin authentication failed ❌",
                "error"
              );
              restoreButton();
              return;
            }

            const uid = cred.user.uid;

            // Verify Admin Privileges in Firestore ek_admin_accounts
            let adminDocSnap = null;
            if (typeof db !== 'undefined' && db) {
              try {
                adminDocSnap = await db.collection('ek_admin_accounts').doc(uid).get();
                if (!adminDocSnap.exists) {
                  // Fallback query by email if doc was keyed by old ID
                  const emailQ = await db.collection('ek_admin_accounts').where('email', '==', adminEmail).limit(1).get().catch(() => null);
                  if (emailQ && !emailQ.empty) {
                    adminDocSnap = emailQ.docs[0];
                  }
                }
              } catch (fsErr) {
                console.warn("[Admin Login] Firestore check error:", fsErr);
              }
            }

            const adminFirestoreData = (adminDocSnap && adminDocSnap.exists) ? adminDocSnap.data() : null;
            const storedAdmins = getData('ek_admin_accounts', []) || [];
            const localAdminMatch = storedAdmins.find(a => a.id === uid || (a.email && a.email.toLowerCase() === adminEmail.toLowerCase()));

            const role = (adminFirestoreData && adminFirestoreData.role) || (localAdminMatch && localAdminMatch.role) || null;
            const isActive = adminFirestoreData ? (adminFirestoreData.active !== false) : (localAdminMatch ? localAdminMatch.active !== false : false);

            if (!isActive || (role !== 'admin' && role !== 'superadmin')) {
              await firebase.auth().signOut().catch(() => {});
              loginCompleted = true;
              cleanupTimers();
              showToast(
                currentLang === 'ta'
                  ? "அணுகல் மறுக்கப்பட்டது! இந்த கணக்கிற்கு அட்மின் அனுமதி இல்லை ❌"
                  : "Access denied! This account does not have administrator privileges ❌",
                "error"
              );
              restoreButton();
              return;
            }

            let adminData = adminFirestoreData || localAdminMatch || {
              id: uid,
              name: (adminFirestoreData && adminFirestoreData.name) || (localAdminMatch && localAdminMatch.name) || 'Admin',
              role: role,
              phone: phoneStr,
              email: adminEmail,
              active: true
            };

            adminData.id = uid;
            adminData.uid = uid;
            adminData.role = role;
            adminData.active = true;

            // Set verified admin UID flag immediately
            window._verifiedAdminUids = window._verifiedAdminUids || new Set();
            window._verifiedAdminUids.add(uid);

            // Save admin account into local storage
            const updatedAdmins = storedAdmins.filter(a => a.id !== uid && a.email !== adminEmail);
            updatedAdmins.push(adminData);
            saveData('ek_admin_accounts', updatedAdmins);

            // Non-blocking background Firestore sync
            if (typeof db !== 'undefined' && db) {
              db.collection('ek_admin_accounts').doc(uid).set(adminData, { merge: true }).catch(e => console.warn("[Admin Firestore Sync Warning]:", e));
            }

            loginCompleted = true;
            cleanupTimers();

            removeData('ek_customer_session');
            removeData('ek_delivery_session');
            removeData('ek_explicit_logged_out');
            sessionStorage.removeItem('ek_customer_session_temp');
            saveData('ek_admin_session', { loggedIn: true, role: adminData.role || 'admin', name: adminData.name || 'Admin', phone: adminData.phone || phoneStr || identifier, uid: uid });

            if (remember) {
              saveData('ek_admin_remember_me', true);
              saveData('ek_remembered_admin_credentials', { identifier: identifier, remember: true });
            } else {
              saveData('ek_admin_remember_me', false);
              removeData('ek_remembered_admin_credentials');
            }

            showToast(currentLang === 'ta' ? `வரவேற்கிறோம் அட்மின் (${adminData.name || 'Admin'})! லாகின் வெற்றி 👑` : `Welcome Admin (${adminData.name || 'Admin'})! Access granted. 👑`, "success");
            restoreButton();
            try { setupCloudRealtimeListeners2(); } catch (e) {}
            try { publishPublicStaffDirectory(); } catch (pErr) {}

            showScreen('screen-admin');
          } catch (authErr) {
            loginCompleted = true;
            cleanupTimers();
            console.error("[Admin Login Error]:", authErr);
            showToast(currentLang === 'ta' ? "அட்மின் லாகின் பிழை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்." : "Admin login error. Please check your input and try again.", "error");
            restoreButton();
          }
          return;
        }

        if (currentLoginMode === 'delivery') {
          let phoneInput = "";
          const deliverySelector = document.getElementById('delivery-selector');
          const loginIdentifier = document.getElementById('login-identifier');

          const isSelectorVisible = deliverySelector && deliverySelector.offsetParent !== null;
          if (isSelectorVisible) {
            phoneInput = deliverySelector.value;
          } else if (loginIdentifier) {
            phoneInput = loginIdentifier.value.trim();
          }

          if (!phoneInput) {
            loginCompleted = true;
            cleanupTimers();
            showToast(currentLang === 'ta' ? "டெலிவரி பார்ட்னரைத் தேர்ந்தெடுக்கவும்." : "Select a delivery partner.", "error");
            restoreButton();
            return;
          }

          const rawRiders = getData('ek_delivery_persons', []) || [];
          let selectedRider = rawRiders.find(r => r.uid === phoneInput || r.id === phoneInput || r.phone === phoneInput);

          // Self-healing Firestore query if not found locally
          if (!selectedRider && typeof db !== 'undefined' && db) {
            try {
              const qSnap = await db.collection('ek_delivery_persons').where('phone', '==', phoneInput).get().catch(() => null);
              if (qSnap && !qSnap.empty) {
                selectedRider = qSnap.docs[0].data();
              } else {
                const uSnap = await db.collection('users').doc(phoneInput).get().catch(() => null);
                if (uSnap && uSnap.exists) {
                  selectedRider = uSnap.data();
                }
              }
            } catch (fsErr) {
              console.warn("[Rider Lookup Warning]:", fsErr);
            }
          }

          if (!selectedRider) {
            loginCompleted = true;
            cleanupTimers();
            showToast(
              currentLang === 'ta'
                ? "டெலிவரி பார்ட்னர் கணக்கு எதுவும் இல்லை. நிர்வாகியைத் தொடர்பு கொள்ளவும் ❌"
                : "No delivery partner account found with this number. Please contact admin ❌",
              "error"
            );
            restoreButton();
            return;
          }

          const authEmail = selectedRider.email || selectedRider.authEmail || `rider_${selectedRider.phone || phoneInput}@lyo.delivery`;

          try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
              const currentAuthUser = firebase.auth().currentUser;
              if (currentAuthUser && currentAuthUser.email && currentAuthUser.email.trim().toLowerCase() !== authEmail.trim().toLowerCase()) {
                await firebase.auth().signOut().catch(e => console.warn(e));
              }

              await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
              
              let cred = null;
              try {
                cred = await firebase.auth().signInWithEmailAndPassword(authEmail, pass);
              } catch (signInErr) {
                console.warn("[Rider Auth] signInWithEmailAndPassword failed:", signInErr);
                throw signInErr;
              }

              const uid = cred.user.uid;

              let matchedDeliv = {
                uid: uid,
                id: uid,
                role: "RIDER",
                name: selectedRider.name || "Rider",
                phone: selectedRider.phone || phoneInput,
                email: authEmail,
                authEmail: authEmail,
                vehicleNo: selectedRider.vehicleNo || selectedRider.vehicle || "",
                photoUrl: selectedRider.photoUrl || selectedRider.photo || "",
                isActive: true,
                isActiveRider: true,
                payoutType: (selectedRider.payoutType || selectedRider.salaryType || "PER_ORDER").toUpperCase(),
                payoutAmount: selectedRider.payoutAmount || selectedRider.salaryRate || 35
              };

              // Non-blocking background Firestore sync
              if (typeof db !== 'undefined' && db) {
                db.collection('users').doc(uid).set(matchedDeliv).catch(e => console.warn("[Rider Firestore Sync Warning]:", e));
                db.collection('ek_delivery_persons').doc(uid).set(matchedDeliv).catch(e => console.warn("[Rider Collection Sync Warning]:", e));
              }

              loginCompleted = true;
              cleanupTimers();

              const rawList = getData('ek_delivery_persons', []);
              const updatedList = rawList.filter(r => r.id !== uid && r.phone !== matchedDeliv.phone);
              const compatObj = {
                ...matchedDeliv,
                id: uid,
                isActiveRider: true,
                active: true,
                salaryType: matchedDeliv.payoutType || 'per_order',
                salaryRate: matchedDeliv.payoutAmount || 35,
                authEmail: matchedDeliv.email
              };
              updatedList.push(compatObj);
              saveData('ek_delivery_persons', updatedList);

              removeData('ek_customer_session');
              removeData('ek_admin_session');
              removeData('ek_explicit_logged_out');
              sessionStorage.removeItem('ek_customer_session_temp');
              saveData('ek_delivery_session', { loggedIn: true, id: uid, name: matchedDeliv.name, phone: matchedDeliv.phone });

              if (remember) {
                saveData('ek_delivery_remember_me', true);
                saveData('ek_remembered_delivery_credentials', { identifier: phoneInput, remember: true });
              } else {
                saveData('ek_delivery_remember_me', false);
                removeData('ek_remembered_delivery_credentials');
              }

              showToast(currentLang === 'ta' ? `வெற்றிகரமாக உள்நுழைந்துள்ளீர்கள், ${matchedDeliv.name}! 🏍️` : `Welcome Delivery Partner ${matchedDeliv.name}! Stay safe on the road! 🏍️`, "success");
              restoreButton();
              try { setupCloudRealtimeListeners2(); } catch (e) {}
              showScreen('screen-delivery');
            } else {
              loginCompleted = true;
              cleanupTimers();
              showToast("உள்நுழைய கிளவுட் இணைப்பு தேவை / Cloud connection required to login.", "error");
              restoreButton();
            }
          } catch (authErr) {
            loginCompleted = true;
            cleanupTimers();
            console.error("[Rider Login] Firebase Auth failed:", authErr);
            let errMsg = currentLang === 'ta'
              ? "கடவுச்சொல் தவறானது! டெலிவரி கடவுச்சொல்லை சரிபார்க்கவும் ❌"
              : "Incorrect password! Please check delivery credentials ❌";

            if (authErr && (authErr.code === 'auth/user-not-found' || (authErr.message && authErr.message.includes('user-not-found')))) {
              errMsg = currentLang === 'ta'
                ? "டெலிவரி கணக்கு அமைப்பு அரைகுறை. நிர்வாகியைத் தொடர்பு கொள்ளவும் ❌"
                : "Delivery account setup is incomplete. Contact admin ❌";
            }
            showToast(errMsg, "error");
            restoreButton();
          }
          return;
        }

        // Customer Login Mode
        const identifierEl = document.getElementById('login-identifier');
        const identifier = identifierEl ? identifierEl.value.trim().toLowerCase() : '';

        if (!identifier || !pass) {
          loginCompleted = true;
          cleanupTimers();
          showToast(
            currentLang === 'ta'
              ? "மின்னஞ்சல்/கைபேசி மற்றும் கடவுச்சொல்லை உள்ளிடவும்."
              : "Please enter your email/phone and password.",
            "error"
          );
          restoreButton();
          return;
        }

        let authEmail = identifier;
        let matched = null;
        const isPhone = !identifier.includes('@');
        let phone10 = '';

        if (isPhone) {
          let rawDigits = identifier.replace(/\D/g, '');
          if (rawDigits.startsWith('91') && rawDigits.length === 12) phone10 = rawDigits.slice(2);
          else if (rawDigits.startsWith('0') && rawDigits.length === 11) phone10 = rawDigits.slice(1);
          else if (rawDigits.length > 10) phone10 = rawDigits.slice(-10);
          else phone10 = rawDigits;

          if (phone10.length !== 10) {
            loginCompleted = true;
            cleanupTimers();
            showToast(
              currentLang === 'ta'
                ? "தயவுசெய்து சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்."
                : "Please enter a valid 10-digit phone number.",
              "error"
            );
            restoreButton();
            return;
          }

          // 1. Fast local cache check
          const localUsers = getData('ek_users', []) || [];
          matched = localUsers.find(u => {
            if (!u) return false;
            const uDigits = String(u.phone || u.phoneNumber || '').replace(/\D/g, '');
            const u10 = uDigits.length >= 10 ? uDigits.slice(-10) : uDigits;
            return u10 === phone10 || uDigits === phone10;
          });

          // 2. Server-side cloud function lookup with Admin SDK (avoids unauthenticated client-side rule restrictions)
          let serverLookupAttempted = false;
          let isKnownRegistered = false;

          if (typeof getCloudFunction === 'function') {
            try {
              const lookupFn = getCloudFunction('lookupCustomerAuthEmail');
              if (lookupFn) {
                serverLookupAttempted = true;
                const lookupRes = await lookupFn({ phone: phone10 });
                if (lookupRes && lookupRes.data) {
                  if (lookupRes.data.found) {
                    isKnownRegistered = true;
                    if (lookupRes.data.active === false) {
                      loginCompleted = true;
                      cleanupTimers();
                      showToast(
                        currentLang === 'ta'
                          ? "உங்கள் கணக்கு முடக்கப்பட்டுள்ளது. நிர்வாகியைத் தொடர்பு கொள்ளவும் ❌"
                          : "Your account has been disabled. Please contact support ❌",
                        "error"
                      );
                      restoreButton();
                      return;
                    }
                    if (lookupRes.data.email) {
                      authEmail = lookupRes.data.email.trim().toLowerCase();
                    }
                    if (lookupRes.data.user) {
                      matched = { ...(matched || {}), ...lookupRes.data.user };
                    }
                  } else {
                    // Confirmed by backend Admin SDK that phone is NOT registered in Firestore or Firebase Auth
                    loginCompleted = true;
                    cleanupTimers();
                    showToast(
                      currentLang === 'ta'
                        ? `இந்த மொபைல் எண் (${phone10}) பதிவு செய்யப்படவில்லை! தயவுசெய்து முதலில் கணக்கு தொடங்குங்கள் (Register) ❌`
                        : `This mobile number (${phone10}) is not registered! Please register first ❌`,
                      "error"
                    );
                    restoreButton();
                    return;
                  }
                }
              }
            } catch (fnErr) {
              console.warn("[Customer Auth Lookup Backend Warning]:", fnErr);
            }
          }

          if (matched && matched.email && matched.email.includes('@')) {
            authEmail = matched.email.trim().toLowerCase();
          } else if (!authEmail.includes('@')) {
            authEmail = `${phone10}@app.com`;
          }
        }

        if (typeof firebase !== 'undefined' && firebase.auth) {
          try {
            const currentAuthUser = firebase.auth().currentUser;
            if (currentAuthUser && currentAuthUser.email && currentAuthUser.email.trim().toLowerCase() !== authEmail.trim().toLowerCase()) {
              await firebase.auth().signOut().catch(e => console.warn(e));
            }

            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            let cred = null;
            try {
              cred = await firebase.auth().signInWithEmailAndPassword(authEmail, pass);
            } catch (signInErr) {
              // If email failed for phone user where candidate wasn't `${phone10}@app.com`, try fallback candidate
              if (isPhone && authEmail !== `${phone10}@app.com`) {
                try {
                  cred = await firebase.auth().signInWithEmailAndPassword(`${phone10}@app.com`, pass);
                } catch (retryErr) {
                  throw signInErr;
                }
              } else {
                throw signInErr;
              }
            }

            const uid = cred.user.uid;

            // Fast local profile lookup
            const localUsers = getData('ek_users', []) || [];
            if (!matched) {
              matched = localUsers.find(u => u.id === uid || u.email === authEmail || (u.phone && isPhone && phone10 && String(u.phone).includes(phone10)));
            }

            // Fallback to fast Firestore fetch if missing locally
            if (!matched && typeof db !== 'undefined' && db) {
              try {
                const docPromise = db.collection('ek_users').doc(uid).get();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 2500));
                const docSnap = await Promise.race([docPromise, timeoutPromise]).catch(() => null);
                if (docSnap && docSnap.exists) {
                  matched = docSnap.data();
                }
              } catch (dbErr) {
                console.warn("[Firestore Profile Fetch Warning]:", dbErr);
              }
            }

            if (!matched) {
              // If account exists in Firebase Auth but no profile was found, load basic verified record
              matched = {
                id: uid,
                name: (cred.user.displayName || (isPhone ? `Customer ${phone10}` : identifier.split('@')[0])),
                phone: isPhone ? phone10 : '',
                email: authEmail,
                password: '',
                address: '',
                latitude: null,
                longitude: null,
                loyaltyPoints: 10,
                tier: 'bronze',
                joinedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                defaultCut: "Small Pieces",
                whatsappNotify: false,
                preferredLang: currentLang,
                referredBy: '',
                referralRewardClaimed: false
              };
            }

            // Account status verification (Active / Inactive)
            if (matched && (matched.active === false || matched.isActive === false || matched.isBlocked === true || matched.disabled === true)) {
              await firebase.auth().signOut().catch(() => {});
              loginCompleted = true;
              cleanupTimers();
              showToast(
                currentLang === 'ta'
                  ? "உங்கள் கணக்கு முடக்கப்பட்டுள்ளது. நிர்வாகியைத் தொடர்பு கொள்ளவும் ❌"
                  : "Your account has been disabled. Please contact support ❌",
                "error"
              );
              restoreButton();
              return;
            }

            loginCompleted = true;
            cleanupTimers();

            const uIdx = localUsers.findIndex(u => u.id === matched.id || (matched.phone && u.phone === matched.phone));
            if (uIdx !== -1) {
              localUsers[uIdx] = { ...localUsers[uIdx], ...matched };
            } else {
              localUsers.push(matched);
            }
            saveData('ek_users', localUsers);

            removeData('ek_admin_session');
            removeData('ek_delivery_session');
            removeData('ek_explicit_logged_out');
            sessionStorage.removeItem('ek_customer_session_temp');

            const uniqueSessionToken = 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
            const session = { loggedIn: true, userId: matched.id, name: matched.name, phone: matched.phone || phone10, sessionToken: uniqueSessionToken };
            saveData('ek_customer_session', session);

            if (typeof db !== 'undefined' && db) {
              db.collection('ek_users').doc(matched.id).update({
                activeSessionToken: uniqueSessionToken
              }).catch(err => console.error("Error updating session token on login:", err));
            }

            if (remember) {
              saveData('ek_customer_remember_me', true);
              saveData('ek_remembered_credentials', { identifier: identifier, remember: true });
            } else {
              saveData('ek_customer_remember_me', false);
              removeData('ek_remembered_credentials');
            }

            showToast(
              currentLang === 'ta'
                ? `மீண்டும் வருக, ${matched.name || 'Customer'}! 🎉`
                : `Welcome back, ${matched.name || 'Customer'}! 🎉`,
              "success"
            );

            restoreButton();
            try { setupCloudRealtimeListeners2(); } catch (e) {}
            try { registerRealFcmToken(); } catch (e) {}

            const targetScreen = window._postLoginTargetScreen || 'screen-home';
            window._postLoginTargetScreen = null;
            showScreen(targetScreen);

          } catch (authErr) {
            loginCompleted = true;
            cleanupTimers();
            console.error("[Firebase Auth] Sign in failed:", authErr);
            let friendlyError = currentLang === 'ta'
              ? "உள்நுழைவுக் கோரிக்கை தோல்வியடைந்தது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்."
              : "Login failed. Please check your details and try again.";

            if (authErr && authErr.code) {
              const code = authErr.code;
              if (code === 'auth/wrong-password') {
                friendlyError = currentLang === 'ta'
                  ? "கடவுச்சொல் தவறானது! தயவுசெய்து உங்கள் சரியான கடவுச்சொல்லை உள்ளிடவும் ❌"
                  : "Incorrect password! Please enter the correct password ❌";
              } else if (code === 'auth/user-not-found') {
                if (isPhone) {
                  friendlyError = currentLang === 'ta'
                    ? `இந்த மொபைல் எண் (${phone10}) பதிவு செய்யப்படவில்லை! தயவுசெய்து முதலில் கணக்கு தொடங்குங்கள் (Register) ❌`
                    : `This mobile number (${phone10}) is not registered! Please register first ❌`;
                } else {
                  friendlyError = currentLang === 'ta'
                    ? "இந்த மின்னஞ்சல் முகவரியில் கணக்கு எதுவும் இல்லை. தயவுசெய்து பதிவு செய்யவும் ❌"
                    : "No account found with this email address. Please register first ❌";
                }
              } else if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
                // Determine whether user is registered or not
                if (isPhone) {
                  // For phone, if server lookup confirmed registration, it's definitely wrong password
                  friendlyError = currentLang === 'ta'
                    ? "கடவுச்சொல் தவறானது! தயவுசெய்து உங்கள் சரியான கடவுச்சொல்லை உள்ளிடவும் ❌"
                    : "Incorrect password! Please enter the correct password ❌";
                } else {
                  // For email, perform fast lookup check if possible
                  let emailExists = false;
                  const localUsers = getData('ek_users', []) || [];
                  if (localUsers.some(u => u && u.email && u.email.toLowerCase() === identifier)) {
                    emailExists = true;
                  }
                  if (emailExists) {
                    friendlyError = currentLang === 'ta'
                      ? "கடவுச்சொல் தவறானது! தயவுசெய்து உங்கள் சரியான கடவுச்சொல்லை உள்ளிடவும் ❌"
                      : "Incorrect password! Please enter the correct password ❌";
                  } else {
                    // Check server lookup for email
                    try {
                      if (typeof getCloudFunction === 'function') {
                        const lookupFn = getCloudFunction('lookupCustomerAuthEmail');
                        if (lookupFn) {
                          const lRes = await lookupFn({ identifier: identifier }).catch(() => null);
                          if (lRes && lRes.data && lRes.data.found) {
                            emailExists = true;
                          }
                        }
                      }
                    } catch (e) {}

                    if (emailExists) {
                      friendlyError = currentLang === 'ta'
                        ? "கடவுச்சொல் தவறானது! தயவுசெய்து உங்கள் சரியான கடவுச்சொல்லை உள்ளிடவும் ❌"
                        : "Incorrect password! Please enter the correct password ❌";
                    } else {
                      friendlyError = currentLang === 'ta'
                        ? "இந்த மின்னஞ்சல் முகவரியில் கணக்கு எதுவும் இல்லை. தயவுசெய்து பதிவு செய்யவும் ❌"
                        : "No account found with this email address. Please register first ❌";
                    }
                  }
                }
              } else if (code === 'auth/user-disabled') {
                friendlyError = currentLang === 'ta'
                  ? "உங்கள் கணக்கு முடக்கப்பட்டுள்ளது. நிர்வாகியைத் தொடர்பு கொள்ளவும் ❌"
                  : "Your account has been disabled. Please contact support ❌";
              } else if (code === 'auth/too-many-requests') {
                friendlyError = currentLang === 'ta'
                  ? "மிக அதிகமான உள்நுழைவு கோரிக்கைகள். சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும் ⏳"
                  : "Too many login attempts. Please try again after some time ⏳";
              } else if (code === 'auth/network-request-failed') {
                friendlyError = currentLang === 'ta'
                  ? "இணைய இணைப்பு பிழை. தயவுசெய்து உங்கள் இணைய இணைப்பைச் சரிபார்க்கவும் 📶"
                  : "Network error. Please check your internet connection and try again 📶";
              }
            }
            showToast(friendlyError, "error");
            restoreButton();
          }
        } else {
          loginCompleted = true;
          cleanupTimers();
          showToast("Firebase Auth is not loaded.", "error");
          restoreButton();
        }
      } finally {
        window.isManualLoginInProgress = false;
        window.isLoginSubmitting = false;
      }
    }

    function updateAdminPasswordFromSelection() {
      const passInp = document.getElementById('login-password');
      if (passInp && currentLoginMode === 'admin') {
        passInp.value = '';
      }
    }

    function updateDeliveryPasswordFromSelection() {
      const passInp = document.getElementById('login-password');
      if (passInp && currentLoginMode === 'delivery') {
        passInp.value = '';
      }
    }

    function enterDeliveryLogin() {
      currentLoginMode = 'delivery';
      try {
        validateAndSanitizeSessions('delivery');
      } catch (err) {
        console.error("[Delivery Login Transition Session Cleanup Fail]:", err);
      }
      try {
        fetchSelectorAccounts();
      } catch (err) {
        console.error(err);
      }
      const loginIdWrap = document.getElementById('login-identifier-wrapper');
      const adminSelWrap = document.getElementById('admin-selector-wrapper');
      const deliverySelWrap = document.getElementById('delivery-selector-wrapper');

      const rawList = getData('ek_delivery_persons', []);
      const deletedRiderIds = getDeletedRiderIds();
      const list = rawList.filter(e => !deletedRiderIds.includes(e.id));

      const loginIdInput = document.getElementById('login-identifier');
      const adminSelector = document.getElementById('admin-selector');
      const deliverySelector = document.getElementById('delivery-selector');

      if (list.length === 0) {
        if (loginIdWrap) {
          loginIdWrap.style.display = 'block';
          const label = loginIdWrap.querySelector('label');
          if (label) label.innerText = currentLang === 'ta' ? "டெலிவரி போன் நம்பர் / Delivery Phone Number 📞" : "Delivery Phone Number 📞";
        }
        if (adminSelWrap) adminSelWrap.style.display = 'none';
        if (deliverySelWrap) deliverySelWrap.style.display = 'none';

        if (loginIdInput) {
          loginIdInput.setAttribute('required', 'true');
          loginIdInput.setAttribute('placeholder', '9xxxxxxxxx');
        }
        if (adminSelector) adminSelector.removeAttribute('required');
        if (deliverySelector) deliverySelector.removeAttribute('required');
      } else {
        if (loginIdWrap) loginIdWrap.style.display = 'none';
        if (adminSelWrap) adminSelWrap.style.display = 'none';
        if (deliverySelWrap) deliverySelWrap.style.display = 'block';

        if (loginIdInput) loginIdInput.removeAttribute('required');
        if (adminSelector) adminSelector.removeAttribute('required');
        if (deliverySelector) deliverySelector.setAttribute('required', 'true');

        populateDeliveryLoginFormSelector();
      }

      prefillLoginCredentials();

      const btnToggleAdmin = document.getElementById('btn-toggle-admin-mode');
      const btnToggleDelivery = document.getElementById('btn-toggle-delivery-mode');

      if (btnToggleAdmin) {
        btnToggleAdmin.style.display = 'inline-flex';
        btnToggleAdmin.style.color = '#64748b';
      }
      if (btnToggleDelivery) {
        btnToggleDelivery.style.display = 'inline-flex';
        btnToggleDelivery.style.color = '#10b981';
      }
    }

    function populateDeliveryLoginFormSelector() {
      const rawList = getData('ek_delivery_persons', []);
      const deletedRiderIds = getDeletedRiderIds();
      const list = rawList.filter(e => {
        if (deletedRiderIds.includes(e.id)) return false;
        const roleMatch = e.role === "RIDER";
        const activeMatch = e.isActiveRider === true;
        const uidExists = !!(e.uid || e.id);
        const emailExists = !!e.authEmail;
        return roleMatch && activeMatch && uidExists && emailExists;
      });
      const selector = document.getElementById('delivery-selector');
      if (!selector) return;
      selector.innerHTML = '';

      if (list.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.innerText = currentLang === 'ta'
          ? '— டெலிவரி பாய் இல்லை, Admin-ஐ தொடர்பு கொள்ளவும் —'
          : '— No delivery executives, contact admin —';
        opt.disabled = true;
        opt.selected = true;
        selector.appendChild(opt);
      } else {
        list.forEach(e => {
          const opt = document.createElement('option');
          opt.value = e.uid || e.id;
          opt.innerText = `🏍️ ${e.name}`;
          selector.appendChild(opt);
        });
      }
    }

    function enterAdminLogin() {
      currentLoginMode = 'admin';
      try {
        validateAndSanitizeSessions('admin');
      } catch (err) {
        console.error("[Admin Login Transition Session Cleanup Fail]:", err);
      }
      try {
        fetchSelectorAccounts();
      } catch (err) {
        console.error(err);
      }
      const loginIdWrap = document.getElementById('login-identifier-wrapper');
      const adminSelWrap = document.getElementById('admin-selector-wrapper');
      const deliverySelWrap = document.getElementById('delivery-selector-wrapper');

      if (loginIdWrap) loginIdWrap.style.display = 'none';
      if (adminSelWrap) adminSelWrap.style.display = 'block';
      if (deliverySelWrap) deliverySelWrap.style.display = 'none';

      const loginIdInput = document.getElementById('login-identifier');
      const adminSelector = document.getElementById('admin-selector');
      const deliverySelector = document.getElementById('delivery-selector');
      if (loginIdInput) loginIdInput.removeAttribute('required');
      if (adminSelector) adminSelector.setAttribute('required', 'true');
      if (deliverySelector) deliverySelector.removeAttribute('required');

      prefillLoginCredentials();

      const btnToggleAdmin = document.getElementById('btn-toggle-admin-mode');
      const btnToggleDelivery = document.getElementById('btn-toggle-delivery-mode');
      if (btnToggleAdmin) {
        btnToggleAdmin.style.display = 'inline-flex';
        btnToggleAdmin.style.color = '#f59e0b';
      }
      if (btnToggleDelivery) {
        btnToggleDelivery.style.display = 'inline-flex';
        btnToggleDelivery.style.color = '#64748b';
      }
    }

    function enterCustomerLogin() {
      currentLoginMode = 'customer';
      try {
        validateAndSanitizeSessions('customer');
      } catch (err) {
        console.error("[Customer Login Transition Session Cleanup Fail]:", err);
      }
      const loginIdWrap = document.getElementById('login-identifier-wrapper');
      const adminSelWrap = document.getElementById('admin-selector-wrapper');
      const deliverySelWrap = document.getElementById('delivery-selector-wrapper');

      if (loginIdWrap) {
        loginIdWrap.style.display = 'block';
        const label = loginIdWrap.querySelector('label');
        if (label) {
          label.innerText = "Email or Phone Number";
        }
      }
      if (adminSelWrap) adminSelWrap.style.display = 'none';
      if (deliverySelWrap) deliverySelWrap.style.display = 'none';

      const loginIdInput = document.getElementById('login-identifier');
      const adminSelector = document.getElementById('admin-selector');
      const deliverySelector = document.getElementById('delivery-selector');
      if (loginIdInput) {
        loginIdInput.setAttribute('required', 'true');
        loginIdInput.setAttribute('placeholder', 'Enter your registered phone or email');
      }
      if (adminSelector) adminSelector.removeAttribute('required');
      if (deliverySelector) deliverySelector.removeAttribute('required');

      prefillLoginCredentials();

      const btnToggleAdmin = document.getElementById('btn-toggle-admin-mode');
      const btnToggleDelivery = document.getElementById('btn-toggle-delivery-mode');
      if (btnToggleAdmin) {
        btnToggleAdmin.style.display = 'inline-flex';
        btnToggleAdmin.style.color = '#64748b';
      }
      if (btnToggleDelivery) {
        btnToggleDelivery.style.display = 'inline-flex';
        btnToggleDelivery.style.color = '#64748b';
      }
    }

    function toggleAdminLogin() {
      if (currentLoginMode === 'admin') {
        enterCustomerLogin();
      } else {
        enterAdminLogin();
      }
    }
    window.toggleAdminLogin = toggleAdminLogin;

    function toggleDeliveryLogin() {
      if (currentLoginMode === 'delivery') {
        enterCustomerLogin();
      } else {
        enterDeliveryLogin();
      }
    }
    window.toggleDeliveryLogin = toggleDeliveryLogin;

    async function handleRegister(event) {
      event.preventDefault();

      const regButton = event.target.querySelector('button[type="submit"]');
      let originalBtnHtml = "";
      if (regButton) {
        originalBtnHtml = regButton.innerHTML;
        regButton.disabled = true;
        regButton.innerHTML = `<span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align:middle;"></span> பதிவு செய்யப்படுகிறது... / Registering...`;
      }

      const restoreButton = () => {
        if (regButton) {
          regButton.disabled = false;
          regButton.innerHTML = originalBtnHtml;
        }
      };

      try {
        const name = document.getElementById('reg-name').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const emailRaw = document.getElementById('reg-email').value;
        const email = (emailRaw || '').trim().toLowerCase();
        const address = document.getElementById('reg-address').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;
        const cut = "Small Pieces";
        const whatsapp = document.getElementById('reg-whatsapp').checked;

        if (!name) {
          showToast(currentLang === 'ta' ? "தயவுசெய்து உங்கள் பெயரை உள்ளிடுங்கள்." : "Please enter your name.", "error");
          restoreButton();
          return;
        }
        if (!phone || phone.length !== 10) {
          showToast(currentLang === 'ta' ? "தயவுசெய்து 10 இலக்க போன் நம்பரை உள்ளிடவும்." : "Please enter a valid 10-digit phone number.", "error");
          restoreButton();
          return;
        }

        if (!email) {
          showToast(
            currentLang === 'ta'
              ? "தயவுசெய்து உங்கள் மின்னஞ்சல் முகவரியை உள்ளிடுங்கள். கடவுச்சொல் மீட்டமைப்பிற்கு இது அவசியம்."
              : "Please enter your email address. It is required for password recovery.",
            "error"
          );
          restoreButton();
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          showToast(
            currentLang === 'ta'
              ? "நீங்கள் அணுகக்கூடிய சரியான மின்னஞ்சல் முகவரியை உள்ளிடுங்கள்."
              : "Please enter a valid email address that you can access.",
            "error"
          );
          restoreButton();
          return;
        }

        if (password !== confirm) {
          showToast(currentLang === 'ta' ? "கடவுச்சொற்கள் பொருந்தவில்லை!" : "Passwords do not match!", "error");
          restoreButton();
          return;
        }
        if (password.length < 6) {
          showToast(currentLang === 'ta' ? "கடவுச்சொல் குறைந்தபட்சம் 6 எழுத்துக்களைக் கொண்டிருக்க வேண்டும்." : "Password must be at least 6 characters.", "error");
          restoreButton();
          return;
        }

        const cleanDigits = phone.replace(/\D/g, '');
        const phone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
        const phoneVariants = Array.from(new Set([
          phone,
          cleanDigits,
          phone10,
          `+91${phone10}`,
          `+91 ${phone10}`,
          `91${phone10}`,
          `91 ${phone10}`,
          `0${phone10}`,
          `+91-${phone10}`,
          `${phone10.slice(0, 5)} ${phone10.slice(5)}`,
          `+91 ${phone10.slice(0, 5)} ${phone10.slice(5)}`,
          `+91 ${phone10.slice(0, 5)}-${phone10.slice(5)}`,
          `+91-${phone10.slice(0, 5)}-${phone10.slice(5)}`,
          `cust_${phone10}`,
          `user_${phone10}`
        ])).filter(Boolean);

        let isDuplicatePhone = false;
        let isDuplicateEmail = false;
        let duplicateReason = "";

        // 1. Check local cache across all user stores
        try {
          const allLocalUsers = [
            ...((typeof getData === 'function' ? getData('ek_users', []) : []) || []),
            ...((typeof getData === 'function' ? getData('ek_delivery_persons', []) : []) || []),
            ...((typeof getData === 'function' ? getData('ek_admin_accounts', []) : []) || []),
            ...((typeof DEFAULT_FALLBACK_ADMINS !== 'undefined' && Array.isArray(DEFAULT_FALLBACK_ADMINS)) ? DEFAULT_FALLBACK_ADMINS : [])
          ];

          const existingLocalPhone = allLocalUsers.find(u => {
            if (!u) return false;
            const uDigits = String(u.phone || u.phoneNumber || u.mobile || u.id || '').replace(/\D/g, '');
            return (uDigits && phone10 && (uDigits === phone10 || uDigits.endsWith(phone10) || phone10.endsWith(uDigits)));
          });

          if (existingLocalPhone) {
            isDuplicatePhone = true;
            duplicateReason = "local_phone";
            debugLog("[handleRegister] Duplicate phone found in local cache:", existingLocalPhone.phone);
          }

          if (email) {
            const existingLocalEmail = allLocalUsers.find(u => {
              if (!u || !u.email) return false;
              return String(u.email).trim().toLowerCase() === email;
            });
            if (existingLocalEmail) {
              isDuplicateEmail = true;
              debugLog("[handleRegister] Duplicate email found in local cache:", existingLocalEmail.email);
            }
          }
        } catch (localErr) {
          console.warn("Could not check local duplicate records:", localErr);
        }

        // 2. Check Firestore across collections and direct doc IDs if cloud is available
        if (typeof db !== 'undefined' && db) {
          try {
            // Check direct document ID existence
            const docIdChecks = [
              db.collection('ek_users').doc(phone10).get().catch(() => null),
              db.collection('ek_users').doc(`cust_${phone10}`).get().catch(() => null),
              db.collection('ek_users').doc(`+91${phone10}`).get().catch(() => null),
              db.collection('users').doc(phone10).get().catch(() => null)
            ];
            const docResults = await Promise.all(docIdChecks);
            if (docResults.some(r => r && r.exists)) {
              isDuplicatePhone = true;
              duplicateReason = "firestore_doc_id";
            }

            // Check phone variants across ek_users, users, ek_delivery_persons, ek_admin_accounts
            if (!isDuplicatePhone) {
              const queryChunk = phoneVariants.slice(0, 10);
              const cloudChecks = [
                db.collection('ek_users').where('phone', 'in', queryChunk).limit(1).get().catch(() => null),
                db.collection('ek_users').where('phoneNumber', 'in', queryChunk).limit(1).get().catch(() => null),
                db.collection('users').where('phone', 'in', queryChunk).limit(1).get().catch(() => null),
                db.collection('ek_delivery_persons').where('phone', 'in', queryChunk).limit(1).get().catch(() => null),
                db.collection('ek_admin_accounts').where('phone', 'in', queryChunk).limit(1).get().catch(() => null)
              ];

              const results = await Promise.all(cloudChecks);
              for (const snap of results) {
                if (snap && !snap.empty) {
                  isDuplicatePhone = true;
                  duplicateReason = "firestore_query_phone";
                  debugLog("[handleRegister] Duplicate phone matched in Firestore collection!");
                  break;
                }
              }
            }

            // Also check for individual variant matches if 'in' queries were not supported
            if (!isDuplicatePhone) {
              for (const variant of phoneVariants) {
                const qSnap = await db.collection('ek_users').where('phone', '==', variant).limit(1).get().catch(() => null);
                if (qSnap && !qSnap.empty) {
                  isDuplicatePhone = true;
                  duplicateReason = "firestore_individual_variant";
                  debugLog("[handleRegister] Duplicate phone found in Firestore for variant:", variant);
                  break;
                }
              }
            }

            // Check email uniqueness on cloud
            if (!isDuplicateEmail && email) {
              const emailSnap = await db.collection('ek_users').where('email', '==', email).limit(1).get().catch(() => null);
              if (emailSnap && !emailSnap.empty) {
                isDuplicateEmail = true;
                debugLog("[handleRegister] Duplicate email matched in Firestore ek_users!");
              }
            }
          } catch (e) {
            console.warn("Could not check duplicate phone on cloud:", e);
          }
        }

        if (isDuplicatePhone) {
          showToast(
            currentLang === 'ta'
              ? `இந்த மொபைல் எண் (${phone10}) ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது! தயவுசெய்து லாகின் செய்யவும், அல்லது 'Forgot Password' பயன்படுத்தவும் ❌`
              : `This phone number (${phone10}) is already registered! Please log in instead, or use 'Forgot Password' ❌`,
            "error"
          );
          const loginIdentifierInput = document.getElementById('login-identifier');
          if (loginIdentifierInput) loginIdentifierInput.value = phone10;
          showScreen('screen-login');
          restoreButton();
          return;
        }

        if (isDuplicateEmail) {
          showToast(
            currentLang === 'ta'
              ? `இந்த மின்னஞ்சல் (${email}) ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது! தயவுசெய்து லாகின் செய்யவும் ❌`
              : `This email (${email}) is already registered! Please log in instead ❌`,
            "error"
          );
          const loginIdentifierInput = document.getElementById('login-identifier');
          if (loginIdentifierInput) loginIdentifierInput.value = email;
          showScreen('screen-login');
          restoreButton();
          return;
        }

        const regAddrElem = document.getElementById('reg-address');
        const regLat = regAddrElem ? parseFloat(regAddrElem.getAttribute('data-lat')) : null;
        const regLng = regAddrElem ? parseFloat(regAddrElem.getAttribute('data-lng')) : null;

        unmarkUserAsDeleted(phone);

        const referralCodeInput = document.getElementById('reg-referral') ? document.getElementById('reg-referral').value.trim().toUpperCase() : '';
        let referredByUserId = '';

        if (referralCodeInput) {
          const allUsers = getData('ek_users', []);
          let referrer = allUsers.find(u => u.id && u.id.toUpperCase() === referralCodeInput);
          if (!referrer) {
            referrer = allUsers.find(u => {
              if (!u.id) return false;
              const cleanId = u.id.replace('cust_', '').toUpperCase();
              return cleanId === referralCodeInput;
            });
          }
          if (!referrer) {
            referrer = allUsers.find(u => u.phone && u.phone === referralCodeInput);
          }
          if (!referrer) {
            referrer = allUsers.find(u => u.referralCode && u.referralCode.toUpperCase() === referralCodeInput);
          }

          if (referrer) {
            referredByUserId = referrer.id;
            debugLog("[Referral System] Found referrer during signup:", referrer.name, referrer.id);
          } else {
            let firestoreReferrerFound = false;
            if (typeof db !== 'undefined' && db) {
              try {
                const qSnap = await db.collection('ek_users').where('referralCode', '==', referralCodeInput).limit(1).get();
                if (!qSnap.empty) {
                  const doc = qSnap.docs[0];
                  referredByUserId = doc.id;
                  firestoreReferrerFound = true;
                  debugLog("[Referral System] Found referrer in Firestore during signup:", doc.id);
                }
              } catch (fsErr) {
                console.warn("[Referral System] Firestore query error for referralCode:", fsErr);
              }
            }

            if (!firestoreReferrerFound) {
              showToast(
                typeof currentLang !== 'undefined' && currentLang === 'ta'
                  ? "செல்லுபடியாகாத ரெஃபரல் குறியீடு — புறக்கணிக்கப்பட்டது"
                  : "Invalid referral code — ignored",
                "warning"
              );
              referredByUserId = '';
            }
          }
        }

        const uniqueSessionToken = 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
        const newUser = {
          id: '',
          name, 
          phone: phone10 || phone,
          cleanPhone: phone10,
          rawPhone: phone,
          email, 
          password: '', 
          address,
          latitude: regLat || null,
          longitude: regLng || null,
          savedAddresses: address ? [{
            id: 'addr_' + Date.now(),
            label: 'Home 🏠',
            address: address,
            latitude: regLat || 11.5815,
            longitude: regLng || 77.8488
          }] : [],
          loyaltyPoints: 10,
          tier: 'bronze',
          joinedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          defaultCut: cut,
          whatsappNotify: whatsapp,
          preferredLang: currentLang,
          referredBy: referredByUserId,
          referralRewardClaimed: false,
          activeSessionToken: uniqueSessionToken,
          fcmToken: (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getFcmToken === 'function' ? AndroidStorage.getFcmToken() : '') || localStorage.getItem('ek_fcm_token') || '',
          realFcmToken: (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getFcmToken === 'function' ? AndroidStorage.getFcmToken() : '') || localStorage.getItem('ek_fcm_token') || ''
        };

        if (typeof firebase !== 'undefined' && firebase.auth) {
          await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

          let authUserCredential;
          try {
            authUserCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            debugLog("[Firebase Auth] User account created successfully:", authUserCredential.user.uid);

            try {
              if (authUserCredential && authUserCredential.user && typeof authUserCredential.user.sendEmailVerification === 'function') {
                authUserCredential.user.sendEmailVerification().catch(verErr => {
                  console.warn("[Firebase Auth] Verification email could not be sent:", verErr);
                });
                showToast(
                  typeof currentLang !== 'undefined' && currentLang === 'ta'
                    ? "சரிபார்ப்பு மின்னஞ்சல் அனுப்பப்பட்டது — கடவுச்சொல் மீட்புக்கு சரிபார்க்கவும்."
                    : "Verification email sent — please verify for password recovery.",
                  "info"
                );
              }
            } catch (verCatch) {
              console.warn("[Firebase Auth] Non-blocking email verification catch:", verCatch);
            }
          } catch (authErr) {
            console.error("[Firebase Auth] Account creation failed:", authErr);
            let friendlyAuthError = currentLang === 'ta'
              ? "பதிவு தோல்வியடைந்தது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்."
              : "Registration failed. Please try again.";

            if (authErr && authErr.code) {
              const code = authErr.code;
              if (code === 'auth/email-already-in-use') {
                friendlyAuthError = currentLang === 'ta'
                  ? "இந்த மின்னஞ்சல் முகவரி ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது. லாகின் செய்யவும்."
                  : "This email address is already registered. Please log in instead.";
              } else if (code === 'auth/invalid-email') {
                friendlyAuthError = currentLang === 'ta'
                  ? "செல்லுபடியாகும் மின்னஞ்சல் முகவரியை உள்ளிடவும்."
                  : "Please enter a valid email address.";
              } else if (code === 'auth/weak-password') {
                friendlyAuthError = currentLang === 'ta'
                  ? "கடவுச்சொல் மிகவும் பலவீனமாக உள்ளது. குறைந்தபட்சம் 6 எழுத்துக்களைப் பயன்படுத்தவும்."
                  : "Password is too weak. Please use at least 6 characters.";
              } else if (code === 'auth/too-many-requests') {
                friendlyAuthError = currentLang === 'ta'
                  ? "மிக அதிகமான கோரிக்கைகள் அனுப்பப்பட்டுள்ளன. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்."
                  : "Too many requests. Please try again after some time.";
              } else if (code === 'auth/network-request-failed') {
                friendlyAuthError = currentLang === 'ta'
                  ? "இணைய இணைப்பு பிழை. தயவுசெய்து உங்கள் இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்."
                  : "Network error. Please check your internet connection and try again.";
              }
            }
            showToast(friendlyAuthError, "error");
            restoreButton();
            return;
          }

          const uid = authUserCredential.user.uid;
          newUser.id = uid;
          newUser.password = '';

          unmarkUserAsDeleted(uid);
          unmarkUserAsDeleted(phone);
          if (phone10) unmarkUserAsDeleted(phone10);

          if (typeof db !== 'undefined' && db) {
            try {
              await db.collection('ek_users').doc(uid).set(newUser);
              debugLog("[Firestore] User profile document created successfully under UID:", uid);

              const simpleUserDoc = {
                uid: uid,
                role: "CUSTOMER",
                isActive: true
              };
              await db.collection('users').doc(uid).set(simpleUserDoc);
              debugLog("[Firestore] Simple users/{uid} document created successfully.");
            } catch (dbErr) {
              console.error("[Firestore] Failed to save user profile:", dbErr);
              try {
                await authUserCredential.user.delete();
                debugLog("[Firebase Auth] Cleaned up orphaned auth user successfully.");
              } catch (delErr) {
                console.error("[Firebase Auth] Failed to clean up orphaned auth user:", delErr);
              }
              showToast(
                currentLang === 'ta'
                  ? "சுயவிவர தரவுத்தளத்தை உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும் அல்லது உங்கள் இணைய இணைப்பைச் சரிபார்க்கவும்."
                  : "Failed to create profile database entry. Please try again or check your internet connection.",
                "error"
              );
              restoreButton();
              return;
            }
          }
        } else {
          showToast(
            currentLang === 'ta'
              ? "இணைப்பு பிழை. Firebase அங்கீகாரம் ஏற்றப்படவில்லை."
              : "Connection error. Firebase Auth is not loaded.",
            "error"
          );
          restoreButton();
          return;
        }

        const localUsers = getData('ek_users', []);
        const uIdx = localUsers.findIndex(u => u.phone === phone || u.email === email);
        if (uIdx !== -1) {
          localUsers[uIdx] = newUser;
        } else {
          localUsers.push(newUser);
        }
        saveData('ek_users', localUsers);

        addNotification(
           "வரவேற்கிறோம்! 🎉",
           "Welcome to Edappadi Kadai! 🎉",
           `எடப்பாடி கடைக்கு உங்களை அன்போடு வரவேற்கிறோம்! புதிய கணக்கை உருவாக்கியதற்காக உங்களுக்கு 10 லாயல்டி புள்ளிகள் இலவசமாக வழங்கப்பட்டுள்ளது. 🥩`,
           "We are thrilled to welcome you to Edappadi Kadai! You have received 10 welcome loyalty points. Happy Meat Ordering! 🥩",
           "🎉"
        );

        // Targeted FCM Welcome Push Notification
        try {
          const userFcmToken = newUser.fcmToken || newUser.realFcmToken || (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getFcmToken === 'function' ? AndroidStorage.getFcmToken() : '');
          if (userFcmToken && typeof db !== 'undefined' && db) {
            const welcomeTitle = currentLang === 'ta' ? `வரவேற்கிறோம் ${newUser.name || ''}! 🎉` : `Welcome to Edappadi Kadai, ${newUser.name || ''}! 🎉`;
            const welcomeBody = currentLang === 'ta'
              ? "எடப்பாடி கடைக்கு உங்களை அன்போடு வரவேற்கிறோம்! புதிய கணக்கை உருவாக்கியதற்காக 10 லாயல்டி புள்ளிகள் வழங்கப்பட்டுள்ளது. 🥩"
              : "Your account has been successfully created! You have received 10 welcome loyalty points. Happy Meat Ordering! 🥩";

            db.collection('ek_fcm_queue').add({
              targetToken: userFcmToken,
              targetUserId: newUser.id,
              title: welcomeTitle,
              body: welcomeBody,
              type: "welcome",
              screen: "screen-home",
              createdAt: new Date().toISOString(),
              processed: false
            }).catch(qErr => console.warn("[FCM Welcome Queue] Non-blocking notice:", qErr));
          }
        } catch (fcmWelcomeEx) {
          console.warn("[FCM Welcome Push Ex Handled]", fcmWelcomeEx);
        }

        const session = { loggedIn: true, userId: newUser.id, name: newUser.name, phone: newUser.phone, sessionToken: uniqueSessionToken };
        saveData('ek_customer_session', session);
        saveData('ek_remembered_credentials', { identifier: email, remember: true });

        showToast(
          currentLang === 'ta'
            ? "பதிவு செய்யப்பட்டு வெற்றிகரமாக உள்நுழையப்பட்டுள்ளது! 🎉"
            : "Registered and logged in successfully! 🎉",
          "success"
        );

        restoreButton();
        setupCloudRealtimeListeners2();

        const regForm = document.getElementById('register-form');
        if (regForm) regForm.reset();

        showScreen('screen-home');
      } catch (err) {
        console.error("General registration error:", err);
        showToast(
          currentLang === 'ta'
            ? "பதிவு செய்வதில் பிழை ஏற்பட்டுள்ளது: " + err.message
            : "Registration failed: " + err.message,
          "error"
        );
        restoreButton();
      }
    }

    /* =========================================================================
     * GOOGLE SIGN-IN SYSTEM (NATIVE ACCOUNT CHOOSER & WEB FALLBACK)
     * ========================================================================= */

    async function handleGoogleSignIn() {
      debugLog("[GoogleAuth] handleGoogleSignIn triggered.");
      const btn = document.getElementById('btn-google-login');
      const btnText = document.getElementById('google-login-btn-text');
      const originalText = btnText ? btnText.innerText : "";
      if (btnText) {
        btnText.innerText = currentLang === 'ta' ? "இணைக்கப்படுகிறது..." : "Connecting Google...";
      }
      if (btn) btn.style.opacity = '0.7';

      const resetBtn = () => {
        if (btnText) btnText.innerText = originalText;
        if (btn) btn.style.opacity = '1';
      };

      // 1. Check if Native Android Account Picker is supported in WebAppInterface
      if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.promptGoogleSignIn === 'function') {
        try {
          const launched = AndroidStorage.promptGoogleSignIn();
          if (launched) {
            debugLog("[GoogleAuth] Native Google Sign-In launched via AndroidStorage.");
            setTimeout(resetBtn, 5000);
            return;
          }
        } catch (e) {
          console.warn("[GoogleAuth] Native Google Sign-In call failed:", e);
        }
      }

      // 2. Try Firebase Auth Google Provider popup if available
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth.GoogleAuthProvider) {
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          provider.addScope('email');
          provider.addScope('profile');
          const result = await firebase.auth().signInWithPopup(provider);
          if (result && result.user) {
            const u = result.user;
            await completeGoogleSignIn(u.email, u.displayName || u.email.split('@')[0], u.photoURL || '');
            resetBtn();
            return;
          }
        } catch (fbErr) {
          console.warn("[GoogleAuth] Firebase popup sign-in encountered error:", fbErr);
        }
      }

      // 3. Fallback: Google Account Chooser bottom-sheet modal
      resetBtn();
      showGoogleAccountChooserModal();
    }

    window.handleGoogleSignIn = handleGoogleSignIn;

    // Android Native Callbacks
    window.onAndroidGoogleAccountSelected = async function(accountName, displayName) {
      debugLog("[GoogleAuth] onAndroidGoogleAccountSelected:", accountName, displayName);
      await completeGoogleSignIn(accountName, displayName, '');
    };

    window.onAndroidGoogleAccountPickerCancelled = function() {
      debugLog("[GoogleAuth] Account picker was cancelled by user.");
      const btnText = document.getElementById('google-login-btn-text');
      if (btnText) {
        btnText.innerText = currentLang === 'ta' ? "Google மூலம் உள்நுழைக (Google Login)" : "Continue with Google";
      }
      const btn = document.getElementById('btn-google-login');
      if (btn) btn.style.opacity = '1';
    };

    window.onAndroidGoogleAccountPickerFailed = function(reason) {
      console.warn("[GoogleAuth] Account picker failed or unavailable:", reason);
      const btnText = document.getElementById('google-login-btn-text');
      if (btnText) {
        btnText.innerText = currentLang === 'ta' ? "Google மூலம் உள்நுழைக (Google Login)" : "Continue with Google";
      }
      const btn = document.getElementById('btn-google-login');
      if (btn) btn.style.opacity = '1';
      showGoogleAccountChooserModal();
    };

    function showGoogleAccountChooserModal() {
      const oldModal = document.getElementById('google-account-chooser-modal');
      if (oldModal) oldModal.remove();

      const allUsers = (typeof getData === 'function' ? getData('ek_users', []) : []) || [];
      const remembered = allUsers.filter(u => u && u.email && (u.isGoogleAuth || u.email.includes('@')));
      
      let savedAccountsHtml = '';
      if (remembered.length > 0) {
        savedAccountsHtml = `
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">
              ${currentLang === 'ta' ? 'முன்பு பயன்படுத்திய கணக்குகள்:' : 'Previously Used Accounts:'}
            </span>
        `;
        remembered.slice(0, 3).forEach(acc => {
          const initial = (acc.name || acc.email || 'G').charAt(0).toUpperCase();
          const cleanEmail = (acc.email || '').replace(/'/g, "\\'");
          const cleanName = (acc.name || '').replace(/'/g, "\\'");
          savedAccountsHtml += `
            <div onclick="selectGoogleAccountInModal('${cleanEmail}', '${cleanName}')" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1.2px solid rgba(255,255,255,0.08); border-radius: 14px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#4285F4'; this.style.background='rgba(66,133,244,0.08)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.background='rgba(255,255,255,0.03)'">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: #4285F4; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; flex-shrink: 0;">${initial}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 13px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(acc.name || 'Google User')}</div>
                <div style="font-size: 11px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(acc.email)}</div>
              </div>
              <span style="color: #4285F4; font-size: 14px; font-weight: 800;">➔</span>
            </div>
          `;
        });
        savedAccountsHtml += `</div>`;
      }

      const modal = document.createElement('div');
      modal.id = 'google-account-chooser-modal';
      modal.className = 'modal-backdrop';
      modal.style.zIndex = '999999';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      modal.style.padding = '16px';

      modal.innerHTML = `
        <div class="bottom-sheet" style="width: 100%; max-width: 420px; border-radius: 24px; border: 1.5px solid rgba(255,255,255,0.1); background: #111319; padding: 22px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; text-align: left;">

          <!-- Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <svg width="26" height="26" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <div>
                <h3 style="color: #ffffff; font-size: 15px; font-weight: 800; margin: 0; font-family: 'Poppins', 'Hind Madurai', sans-serif;">Google Account</h3>
                <p style="color: #9ca3af; font-size: 11px; margin: 2px 0 0 0;">${currentLang === 'ta' ? 'உங்கள் Google கணக்கைத் தேர்ந்தெடுக்கவும்' : 'Sign in with your Google account'}</p>
              </div>
            </div>
            <button type="button" onclick="document.getElementById('google-account-chooser-modal').remove()" style="background: rgba(255,255,255,0.06); border: none; color: #9ca3af; font-size: 16px; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
          </div>

          ${savedAccountsHtml}

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #9ca3af; margin-bottom: 4px; display: block;">
              ${currentLang === 'ta' ? 'Google மின்னஞ்சல் (Email Address) *' : 'Google Email Address *'}
            </label>
            <input type="email" id="google-input-email" placeholder="e.g. yourname@gmail.com" style="width: 100%; height: 44px; background: rgba(255,255,255,0.04); border: 1.2px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 0 12px; color: #ffffff; font-size: 13.5px; font-weight: 600; box-sizing: border-box; outline: none;" oninput="syncGoogleNameFromEmail(this.value)" />
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #9ca3af; margin-bottom: 4px; display: block;">
              ${currentLang === 'ta' ? 'உங்கள் பெயர் (Display Name)' : 'Display Name'}
            </label>
            <input type="text" id="google-input-name" placeholder="Your Name" style="width: 100%; height: 44px; background: rgba(255,255,255,0.04); border: 1.2px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 0 12px; color: #ffffff; font-size: 13.5px; font-weight: 600; box-sizing: border-box; outline: none;" />
          </div>

          <button type="button" onclick="submitGoogleChooserModal()" style="width: 100%; height: 46px; background: #ffffff; color: #1f2937; border: none; border-radius: 14px; font-size: 14px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 16px rgba(255,255,255,0.15); font-family: 'Poppins', 'Hind Madurai', sans-serif;">
            <span>${currentLang === 'ta' ? 'Google மூலம் தொடரவும்' : 'Continue with Google'} ➔</span>
          </button>

        </div>
      `;

      document.body.appendChild(modal);
    }

    window.showGoogleAccountChooserModal = showGoogleAccountChooserModal;

    window.selectGoogleAccountInModal = function(email, name) {
      completeGoogleSignIn(email, name, '');
    };

    window.syncGoogleNameFromEmail = function(val) {
      const nameInput = document.getElementById('google-input-name');
      if (nameInput && !nameInput.value.trim() && val && val.includes('@')) {
        const raw = val.split('@')[0].replace(/[._-]/g, ' ');
        nameInput.value = raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    };

    window.submitGoogleChooserModal = function() {
      const emailInput = document.getElementById('google-input-email');
      const nameInput = document.getElementById('google-input-name');
      const email = emailInput ? emailInput.value.trim() : '';
      const name = nameInput ? nameInput.value.trim() : '';

      if (!email || !email.includes('@')) {
        showToast(currentLang === 'ta' ? "சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்!" : "Please enter a valid email address!", "error");
        return;
      }
      completeGoogleSignIn(email, name || email.split('@')[0], '');
    };

    async function completeGoogleSignIn(email, name, photoUrl) {
      try {
        if (!email) {
          showToast(currentLang === 'ta' ? "மின்னஞ்சல் முகவரி தேவை!" : "Email address is required!", "error");
          return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = (name || cleanEmail.split('@')[0]).trim();

        // 1. Check if user already exists locally or in Firestore
        const users = (typeof getData === 'function' ? getData('ek_users', []) : []) || [];
        let matched = users.find(u => u && u.email && u.email.toLowerCase() === cleanEmail);

        if (!matched && typeof db !== 'undefined' && db) {
          try {
            const snap = await db.collection('ek_users').where('email', '==', cleanEmail).limit(1).get();
            if (!snap.empty) {
              matched = snap.docs[0].data();
              if (!matched.id) matched.id = snap.docs[0].id;
              users.push(matched);
              saveData('ek_users', users);
            }
          } catch (e) {
            console.warn("[GoogleAuth] Firestore query error:", e);
          }
        }

        let isNewUser = false;
        if (!matched) {
          isNewUser = true;
          const newUserId = 'usr_g_' + Date.now() + '_' + Math.floor(1000 + Math.random() * 9000);
          matched = {
            id: newUserId,
            name: cleanName,
            email: cleanEmail,
            phone: '',
            photoUrl: photoUrl || '',
            isGoogleAuth: true,
            address: '',
            latitude: null,
            longitude: null,
            loyaltyPoints: 50,
            tier: 'bronze',
            joinedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            defaultCut: "Small Pieces",
            whatsappNotify: false,
            preferredLang: currentLang
          };
          users.push(matched);
          saveData('ek_users', users);
          if (typeof db !== 'undefined' && db) {
            db.collection('ek_users').doc(newUserId).set(matched).catch(err => console.error(err));
          }
        } else {
          let changed = false;
          if (!matched.name || matched.name === 'Customer / வாடிக்கையாளர்') {
            matched.name = cleanName;
            changed = true;
          }
          if (photoUrl && !matched.photoUrl) {
            matched.photoUrl = photoUrl;
            changed = true;
          }
          matched.isGoogleAuth = true;
          if (changed) {
            saveData('ek_users', users);
            if (typeof db !== 'undefined' && db && matched.id) {
              db.collection('ek_users').doc(matched.id).update({ name: matched.name, photoUrl: matched.photoUrl || '' }).catch(() => null);
            }
          }
        }

        // 2. Set Session
        const uniqueSessionToken = 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
        const session = {
          loggedIn: true,
          userId: matched.id,
          name: matched.name,
          phone: matched.phone || '',
          email: matched.email,
          photoUrl: matched.photoUrl || '',
          sessionToken: uniqueSessionToken,
          isGoogleAuth: true
        };
        saveData('ek_customer_session', session);

        try {
          sessionStorage.setItem('ek_customer_session_temp', JSON.stringify(session));
          localStorage.removeItem('ek_user_logged_out');
        } catch (e) {}

        // 3. Connect Firebase Auth if available
        if (typeof firebase !== 'undefined' && firebase.auth) {
          if (!firebase.auth().currentUser) {
            try {
              await firebase.auth().signInAnonymously();
            } catch (e) {}
          }
        }

        // 4. Update listeners & UI
        try { setupCloudRealtimeListeners2(); } catch (e) {}
        try { registerRealFcmToken(); } catch (e) {}
        if (typeof renderProfileData === 'function') renderProfileData();

        const welcomeMsg = currentLang === 'ta'
          ? (isNewUser
              ? `Google மூலம் கணக்கு தொடங்கப்பட்டது! வரவேற்கிறோம், ${matched.name}! 🎁 50 போனஸ் புள்ளிகள் கிடைத்துள்ளது!`
              : `Google மூலம் உள்நுழைந்தீர்கள்! மீண்டும் வருக, ${matched.name}! 🎉`)
          : (isNewUser
              ? `Account created with Google! Welcome, ${matched.name}! 🎁 +50 Welcome Bonus Points!`
              : `Signed in with Google! Welcome back, ${matched.name}! 🎉`);

        showToast(welcomeMsg, "success");

        const chooserModal = document.getElementById('google-account-chooser-modal');
        if (chooserModal) chooserModal.remove();

        const targetScreen = window._postLoginTargetScreen || 'screen-home';
        window._postLoginTargetScreen = null;
        showScreen(targetScreen);

      } catch (err) {
        console.error("[GoogleAuth] Critical error completing sign in:", err);
        showToast(currentLang === 'ta' ? "Google உள்நுழைவில் பிழை: " + err.message : "Google sign-in error: " + err.message, "error");
      }
    }

    window.completeGoogleSignIn = completeGoogleSignIn;