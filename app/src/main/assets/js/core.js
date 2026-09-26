
const CURRENT_APP_VERSION = (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getAppVersionName === 'function')
  ? (AndroidStorage.getAppVersionName() || '9.0.0')
  : '9.0.0';
window.CURRENT_APP_VERSION = CURRENT_APP_VERSION;

// Safe Haptic Vibration Helper that silently handles browser frame gesture policies
function safeVibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch (e) {}
}
window.safeVibrate = safeVibrate;

// Semantic Version Comparison: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
function compareSemver(v1, v2) {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const clean1 = String(v1).trim().replace(/^v/i, '');
  const clean2 = String(v2).trim().replace(/^v/i, '');

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] !== undefined ? parts1[i] : 0;
    const p2 = parts2[i] !== undefined ? parts2[i] : 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}
window.compareSemver = compareSemver;

window.openPlayStoreUpdate = function() {
  try {
    const defSettings = typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS : (window.DEFAULT_SETTINGS || {});
    const settings = (typeof getDataCached === 'function' ? getDataCached('ek_settings', defSettings) : null) || (typeof getData === 'function' ? getData('ek_settings', defSettings) : defSettings) || {};
    const url = (settings && settings.playStoreUrl && settings.playStoreUrl.trim()) ? settings.playStoreUrl.trim() : 'https://play.google.com/store/apps/details?id=com.edappadikadai.app';
    if (typeof Android !== 'undefined' && Android && typeof Android.openUrl === 'function') {
      Android.openUrl(url);
    } else {
      window.open(url, '_system') || (window.location.href = url);
    }
  } catch (e) {
    window.open('https://play.google.com/store/apps/details?id=com.edappadikadai.app', '_system');
  }
};

window.dismissRecommendedBanner = function() {
  const banner = document.getElementById('app-version-recommended-banner');
  if (banner) {
    banner.style.display = 'none';
  }
  const defSettings = typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS : (window.DEFAULT_SETTINGS || {});
  const settings = (typeof getDataCached === 'function' ? getDataCached('ek_settings', defSettings) : null) || (typeof getData === 'function' ? getData('ek_settings', defSettings) : defSettings) || {};
  const recVer = settings && settings.recommendedVersion ? settings.recommendedVersion : '';
  try {
    sessionStorage.setItem('dismissed_recommended_update_' + recVer, 'true');
  } catch(e) {}
};

window.checkAppVersion = function(passedSettings) {
  try {
    const defSettings = typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS : (window.DEFAULT_SETTINGS || {});
    const settings = passedSettings || (typeof getDataCached === 'function' ? getDataCached('ek_settings', defSettings) : null) || (typeof getData === 'function' ? getData('ek_settings', defSettings) : defSettings) || {};
    const minVer = settings.minAppVersion || '9.0.0';
    const recVer = settings.recommendedVersion || '9.0.0';
    const isTa = typeof currentLang !== 'undefined' && currentLang === 'ta';

    const isBelowMin = compareSemver(minVer, CURRENT_APP_VERSION) > 0;
    const isBelowRec = compareSemver(recVer, CURRENT_APP_VERSION) > 0;

    let forceModal = document.getElementById('app-version-force-update-modal');
    if (!forceModal) {
      forceModal = document.createElement('div');
      forceModal.id = 'app-version-force-update-modal';
      forceModal.style.cssText = 'display: none; position: fixed; inset: 0; z-index: 9999999; background: rgba(5, 7, 15, 0.96); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; text-align: center;';
      forceModal.innerHTML = `
        <div style="background: linear-gradient(165deg, #181c28, #0e111a); border: 1.5px solid rgba(245, 158, 11, 0.5); border-radius: 24px; padding: 32px 24px; max-width: 380px; width: 100%; box-shadow: 0 25px 60px rgba(0,0,0,0.9), 0 0 35px rgba(245, 158, 11, 0.25); box-sizing: border-box;">
          <div style="width: 76px; height: 76px; margin: 0 auto 20px; border-radius: 22px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(239, 68, 68, 0.25)); display: flex; align-items: center; justify-content: center; font-size: 38px; border: 1.5px solid rgba(245, 158, 11, 0.4); box-shadow: 0 8px 25px rgba(245, 158, 11, 0.3);">
            🔄
          </div>
          <h3 id="version-modal-title" style="font-size: 18px; font-weight: 800; color: #ffffff; margin: 0 0 10px 0; line-height: 1.4;">
            புதிய பதிப்பு கிடைத்துள்ளது! தயவுசெய்து அப்டேட் செய்யவும் 🔄
          </h3>
          <p id="version-modal-desc" style="font-size: 13px; color: #94a3b8; margin: 0 0 18px 0; line-height: 1.5;">
            A new version is available! Please update 🔄
          </p>
          <div id="version-modal-badge" style="display: inline-block; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 6px 14px; font-size: 11.5px; color: #cbd5e1; font-weight: 700; margin-bottom: 24px;">
            Current: v${CURRENT_APP_VERSION} • Required: v${minVer}
          </div>
          <div>
            <button id="btn-force-update-now" type="button" onclick="openPlayStoreUpdate()" style="width: 100%; height: 50px; border: none; border-radius: 14px; background: linear-gradient(135deg, #f59e0b, #ea580c); color: #ffffff; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.15s ease;">
              <span>🔄</span> <span id="btn-force-update-label">Update Now</span>
            </button>
          </div>
        </div>
      `;
      // Prevent dismissing through backdrop clicks
      forceModal.addEventListener('click', function(e) {
        e.stopPropagation();
      });
      document.body.appendChild(forceModal);
    }

    let recBanner = document.getElementById('app-version-recommended-banner');
    if (!recBanner) {
      recBanner = document.createElement('div');
      recBanner.id = 'app-version-recommended-banner';
      recBanner.style.cssText = 'display: none; position: sticky; top: 0; z-index: 99990; background: linear-gradient(90deg, #1e293b, #0f172a); border-bottom: 1.5px solid rgba(59, 130, 246, 0.4); padding: 10px 14px; box-shadow: 0 4px 14px rgba(0,0,0,0.4); box-sizing: border-box;';
      recBanner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; max-width: 600px; margin: 0 auto;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
            <span style="font-size: 18px; flex-shrink: 0;">🚀</span>
            <div style="min-width: 0; flex: 1;">
              <p id="rec-banner-text" style="font-size: 12px; font-weight: 700; color: #ffffff; margin: 0; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                புதிய மேம்படுத்தல் உள்ளது! (Update Recommended)
              </p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <button type="button" onclick="openPlayStoreUpdate()" style="border: none; background: #3b82f6; color: #ffffff; font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 8px; cursor: pointer; white-space: nowrap;">
              Update
            </button>
            <button type="button" onclick="dismissRecommendedBanner()" style="border: none; background: rgba(255,255,255,0.1); color: #94a3b8; font-size: 13px; font-weight: bold; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              ✕
            </button>
          </div>
        </div>
      `;
      document.body.insertBefore(recBanner, document.body.firstChild);
    }

    if (isBelowMin) {
      // Blocking mandatory modal
      const titleEl = document.getElementById('version-modal-title');
      const descEl = document.getElementById('version-modal-desc');
      const badgeEl = document.getElementById('version-modal-badge');
      const labelEl = document.getElementById('btn-force-update-label');

      if (titleEl) titleEl.innerText = "புதிய பதிப்பு கிடைத்துள்ளது! தயவுசெய்து அப்டேட் செய்யவும் 🔄";
      if (descEl) descEl.innerText = "A new version is available! Please update 🔄";
      if (badgeEl) badgeEl.innerText = isTa ? `தற்போதைய பதிப்பு: v${CURRENT_APP_VERSION} • தேவைப்படும் பதிப்பு: v${minVer}` : `Current: v${CURRENT_APP_VERSION} • Required: v${minVer}`;
      if (labelEl) labelEl.innerText = isTa ? "இப்போதே அப்டேட் செய்க" : "Update Now";

      forceModal.style.display = 'flex';
      if (recBanner) recBanner.style.display = 'none';
    } else {
      forceModal.style.display = 'none';

      // Check non-blocking recommended version
      let isDismissed = false;
      try {
        isDismissed = sessionStorage.getItem('dismissed_recommended_update_' + recVer) === 'true';
      } catch (e) {}

      if (isBelowRec && !isDismissed) {
        const textEl = document.getElementById('rec-banner-text');
        if (textEl) {
          textEl.innerText = isTa ? `புதிய மேம்படுத்தல் உள்ளது (v${recVer})! சிறந்த அனுபவத்திற்கு அப்டேட் செய்யவும் 🚀` : `Update recommended (v${recVer})! Update now for the best experience 🚀`;
        }
        recBanner.style.display = 'block';
      } else {
        recBanner.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('[Version Check] Error evaluating app version:', err);
  }
};

// Safe window fallbacks for cross-module or async functions
window.selectedTrackOrderId = window.selectedTrackOrderId || null;
window.showTab = function(tabName) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  if (tabName === 'tab-home') {
    const homeBtn = document.getElementById('nav-btn-home') || document.querySelector('.nav-tab:nth-child(1)');
    if (homeBtn) homeBtn.classList.add('active');
    if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-home') {
      const homeScreen = document.getElementById('screen-home');
      if (homeScreen) homeScreen.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (typeof filterCategory === 'function') {
        try { filterCategory('all'); } catch(e) {}
      }
    } else {
      if (typeof showScreen === 'function') showScreen('screen-home');
    }
  } else if (tabName === 'tab-cart') {
    const cartBtn = document.getElementById('nav-btn-cart') || document.querySelector('.nav-tab:nth-child(2)');
    if (cartBtn) cartBtn.classList.add('active');
    if (typeof showScreen === 'function') showScreen('screen-cart');
  } else if (tabName === 'tab-lyo-ai') {
    const lyoBtn = document.getElementById('lyo-ai-nav-btn');
    if (lyoBtn) lyoBtn.classList.add('active');
    if (typeof showScreen === 'function') showScreen('screen-lyo-ai');
    try {
      if (typeof updateLyoDeliveryBanner === 'function') updateLyoDeliveryBanner();
      if (typeof initLyoAiChat === 'function') initLyoAiChat();
      if (typeof updateLyoDraftCartBar === 'function') updateLyoDraftCartBar();
    } catch(lyoErr) {
      console.warn("[showTab] Lyo AI activation error:", lyoErr);
    }
  } else if (tabName === 'tab-track') {
    const trackBtn = document.getElementById('nav-btn-track') || document.querySelector('.nav-tab:nth-child(4)');
    if (trackBtn) trackBtn.classList.add('active');
    if (typeof showScreen === 'function') showScreen('screen-track');
  } else if (tabName === 'tab-profile') {
    const profileBtn = document.getElementById('nav-btn-profile') || document.querySelector('.nav-tab:nth-child(5)');
    if (profileBtn) profileBtn.classList.add('active');
    if (typeof showScreen === 'function') showScreen('screen-profile');
  }
};
window.checkAndUpdateFreshCloudData = function() {
  window._hasFreshCloudData = true;
  window._hasFreshSettings = true;
  try { saveData('ek_cloud_synced', true); saveData('ek_settings_synced', true); } catch(e) {}
  if (typeof invalidateDataCache === 'function') {
    invalidateDataCache('ek_products');
    invalidateDataCache('ek_categories');
    invalidateDataCache('ek_settings');
  }
};
window.syncWithCloud = window.syncWithCloud || async function() {};
window.triggerGlobalScreenRefresh = function() {
  if (typeof window.executeUniversalPullRefresh === 'function') {
    window.executeUniversalPullRefresh();
  }
};
window.triggerGlobalScreenRefreshActual = function() {
  if (typeof window.executeUniversalPullRefresh === 'function') {
    window.executeUniversalPullRefresh();
  }
};

window.getOrderAssignedExecutive = function(order) {
  if (!order) return null;
  if (order.assignedTo && typeof order.assignedTo === 'object' && (order.assignedTo.id || order.assignedTo.uid)) {
    const rId = order.assignedTo.id || order.assignedTo.uid;
    return {
      id: rId,
      uid: rId,
      name: order.assignedTo.name || 'Delivery Partner',
      phone: order.assignedTo.phone || '',
      role: order.assignedTo.role || 'rider',
      assignedAt: order.assignedTo.assignedAt || order.updatedAt || order.createdAt || null,
      status: order.assignedTo.status || 'assigned'
    };
  }
  const uid = (typeof order.assignedTo === 'string' && order.assignedTo) || order.assignedDeliveryPartnerUid || order.riderUid || order.riderId || order.deliveryPartnerUid || order.assignedExecutiveId || order.deliveryExecutiveId || null;
  if (!uid) return null;
  const name = order.assignedDeliveryPartnerName || order.assignedRiderName || order.assignedExecutiveName || order.deliveryExecutiveName || 'Delivery Partner';
  const phone = order.assignedExecutivePhone || order.deliveryExecutivePhone || '';
  return { id: uid, uid: uid, name, phone, role: 'rider', assignedAt: order.updatedAt || order.createdAt || null, status: 'assigned' };
};

window.setButtonLoading = function(btn, isLoading, loadingText = '') {
  if (typeof btn === 'string') btn = document.getElementById(btn);
  if (!btn && typeof event !== 'undefined' && event && event.target) {
    try { btn = event.target.closest('button, .btn'); } catch(e) {}
  }
  if (!btn) return;
  if (isLoading) {
    if (btn.dataset.isBtnLoading === 'true') return;
    btn.dataset.isBtnLoading = 'true';
    btn.dataset.originalHtml = btn.innerHTML;
    btn.dataset.originalDisabled = btn.disabled ? 'true' : 'false';
    try {
      const rect = btn.getBoundingClientRect();
      if (rect && rect.width > 0) {
        btn.style.minWidth = `${Math.ceil(rect.width)}px`;
      }
    } catch(e) {}
    btn.disabled = true;
    btn.style.opacity = '0.75';
    btn.style.cursor = 'wait';
    btn.style.pointerEvents = 'none';
    const spinner = `<span class="btn-spinner"></span>`;
    if (loadingText) {
      btn.innerHTML = `${spinner}<span>${loadingText}</span>`;
    } else {
      btn.innerHTML = `${spinner}${btn.dataset.originalHtml}`;
    }
  } else {
    if (btn.dataset.isBtnLoading !== 'true') return;
    if (btn.dataset.originalHtml !== undefined) {
      btn.innerHTML = btn.dataset.originalHtml;
    }
    btn.disabled = btn.dataset.originalDisabled === 'true';
    btn.style.opacity = '';
    btn.style.cursor = '';
    btn.style.pointerEvents = '';
    btn.style.minWidth = '';
    delete btn.dataset.isBtnLoading;
    delete btn.dataset.originalHtml;
    delete btn.dataset.originalDisabled;
  }
};

window.withButtonLoading = async function(btn, asyncFn, options = {}) {
  if (typeof btn === 'string') btn = document.getElementById(btn);
  if (!btn && typeof event !== 'undefined' && event && event.target) {
    try { btn = event.target.closest('button, .btn'); } catch(e) {}
  }
  if (btn) {
    window.setButtonLoading(btn, true, options.loadingText);
  }
  try {
    return await asyncFn();
  } finally {
    if (btn) {
      window.setButtonLoading(btn, false);
    }
  }
};
let _realtimeUnsubscribers = {
  settings: null,
  categories: null,
  products: null,
  orders: null,
  broadcasts: null,
  deliveryZones: null,
  customerProfile: null,
  customerNotifications: null
};

let _realtimeHomeRenderTimer = null;
function scheduleRealtimeHomeRender(force = false) {
  if (_realtimeHomeRenderTimer) {
    clearTimeout(_realtimeHomeRenderTimer);
  }
  _realtimeHomeRenderTimer = setTimeout(() => {
    _realtimeHomeRenderTimer = null;
    const curScreen = (typeof currentScreen !== 'undefined' && currentScreen) ? currentScreen : '';
    if (!curScreen || curScreen === 'screen-home' || curScreen === 'screen-splash' || curScreen === 'screen-products' || curScreen === 'screen-catalog') {
      try {
        if (typeof renderHomeScreen === 'function') {
          renderHomeScreen(force);
        } else if (typeof renderHomeScreenProducts === 'function') {
          renderHomeScreenProducts(force);
        }
      } catch(e) {
        console.warn("[Realtime Sync] Debounced render error:", e);
      }
    }
  }, 120);
}
window.scheduleRealtimeHomeRender = scheduleRealtimeHomeRender;

window.recordCollectionSyncTime = function(colKey) {
  try {
    const tsMap = JSON.parse(localStorage.getItem('ek_last_sync_timestamps') || '{}');
    tsMap[colKey] = new Date().toLocaleTimeString();
    localStorage.setItem('ek_last_sync_timestamps', JSON.stringify(tsMap));
    if (typeof lastSyncTimestamps !== 'undefined' && lastSyncTimestamps) {
      lastSyncTimestamps[colKey] = tsMap[colKey];
    }
  } catch(e) {}
};

window.setupCloudRealtimeListeners2 = function() {
  if (typeof db === 'undefined' || !db) return;

  // 1. SETTINGS & HERO BANNERS REALTIME LISTENER
  if (!_realtimeUnsubscribers.settings) {
    try {
      _realtimeUnsubscribers.settings = db.collection('ek_settings').doc('global_config').onSnapshot(doc => {
        if (doc && doc.exists) {
          const cloudData = doc.data();
          if (cloudData) {
            window._hasFreshSettings = true;
            window._hasFreshCloudData = true;
            if (typeof window.recordCollectionSyncTime === 'function') window.recordCollectionSyncTime('settings');
            saveData('ek_settings_synced', true);
            saveData('ek_cloud_synced', true);

            const oldSettingsJson = localStorage.getItem('ek_settings') || '';
            const newSettingsJson = JSON.stringify(cloudData);
            const hasSettingsChanged = oldSettingsJson !== newSettingsJson;

            saveData('ek_settings', cloudData);
            if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_settings');

            if (Array.isArray(cloudData.categories) && cloudData.categories.length > 0) {
              const cloudCatList = [...cloudData.categories];
              cloudCatList.sort((a, b) => {
                const orderA = (a && a.order !== undefined && a.order !== null && !isNaN(Number(a.order))) ? Number(a.order) : 999;
                const orderB = (b && b.order !== undefined && b.order !== null && !isNaN(Number(b.order))) ? Number(b.order) : 999;
                if (orderA !== orderB) return orderA - orderB;
                return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
              });
              saveData('ek_categories', cloudCatList);
              if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_categories');
              window._categoriesListCachedValue = null;
              if (typeof _categoriesListCachedValue !== 'undefined') _categoriesListCachedValue = null;
              window._lastCategoryPillsHash = '';
              if (typeof _lastCategoryPillsHash !== 'undefined') _lastCategoryPillsHash = '';
            }

            if (hasSettingsChanged) {
              window._lastBannersHash = '';
              window._lastDataSnapshotHash = '';
              _lastDataSnapshotHash = null;

              try { if (typeof renderAdminBannerList === 'function') renderAdminBannerList(false); } catch(e) {}
              try { if (typeof updateHeaderUI === 'function') updateHeaderUI(); } catch(e) {}
              try { if (typeof checkAppVersion === 'function') checkAppVersion(cloudData); } catch(e) {}
              scheduleRealtimeHomeRender(false);
            }
          }
        }
      }, err => {
        if (err && (err.code === 'resource-exhausted' || (err.message && err.message.includes('Quota exceeded')))) {
          console.warn("[Realtime Sync] Settings listener offline quota fallback active.");
          return;
        }
        console.warn("[Realtime Sync] Settings listener notice:", err);
      });
    } catch(e) {
      console.warn("[Realtime Sync] Settings subscription skipped:", e);
    }
  }

  // 2. CATEGORIES REALTIME LISTENER
  if (!_realtimeUnsubscribers.categories) {
    try {
      _realtimeUnsubscribers.categories = db.collection('ek_categories').onSnapshot(snapshot => {
        if (snapshot) {
          const list = [];
          snapshot.forEach(d => {
            const data = d.data();
            if (data) {
              list.push({ id: d.id, ...data });
            }
          });

          list.sort((a, b) => {
            const orderA = (a && a.order !== undefined && a.order !== null && !isNaN(Number(a.order))) ? Number(a.order) : 999;
            const orderB = (b && b.order !== undefined && b.order !== null && !isNaN(Number(b.order))) ? Number(b.order) : 999;
            if (orderA !== orderB) return orderA - orderB;
            return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
          });

          window._hasFreshCloudData = true;
          if (typeof window.recordCollectionSyncTime === 'function') window.recordCollectionSyncTime('categories');
          saveData('ek_cloud_synced', true);

          const oldCatJson = localStorage.getItem('ek_categories') || '';
          const newCatJson = JSON.stringify(list);
          const hasCategoriesChanged = oldCatJson !== newCatJson;

          saveData('ek_categories', list);
          if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_categories');

          if (hasCategoriesChanged) {
            window._lastCategoryPillsHash = '';
            _lastCategoryPillsHash = '';
            window._categoriesListCachedValue = null;
            _categoriesListCachedValue = null;
            window._lastDataSnapshotHash = '';
            _lastDataSnapshotHash = '';
            window._lastProductsHash = '';
            _lastProductsHash = '';

            const curScreen = (typeof currentScreen !== 'undefined' && currentScreen) ? currentScreen : '';
            if (!curScreen || curScreen === 'screen-home' || curScreen === 'screen-splash' || curScreen === 'screen-products' || curScreen === 'screen-catalog') {
              scheduleRealtimeHomeRender(false);
            } else if (curScreen === 'screen-admin') {
              try { if (typeof renderAdminCategoriesList === 'function') renderAdminCategoriesList(true); } catch(e) {}
            }
            try { if (typeof populateProductCategoryOptions === 'function') populateProductCategoryOptions(); } catch(e) {}
          }
        }
      }, err => {
        if (err && (err.code === 'resource-exhausted' || (err.message && err.message.includes('Quota exceeded')))) {
          console.warn("[Realtime Sync] Categories listener offline quota fallback active.");
          return;
        }
        console.warn("[Realtime Sync] Categories listener notice:", err);
      });
    } catch(e) {
      console.warn("[Realtime Sync] Categories subscription skipped:", e);
    }
  }

  // 3. PRODUCTS REALTIME LISTENER
  if (!_realtimeUnsubscribers.products) {
    try {
      _realtimeUnsubscribers.products = db.collection('ek_products').limit(1000).onSnapshot(snapshot => {
        if (snapshot) {
          if (snapshot.size >= 900) {
            console.warn(`[Realtime Sync] Product catalog count (${snapshot.size}) is approaching or at the limit cap (1000). Consider archiving inactive items or expanding cursor-based pagination.`);
          }
          const isFromCache = !!(snapshot.metadata && snapshot.metadata.fromCache);
          let list = [];
          snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));

          let deletedProductIds = typeof getDeletedProductIds === 'function' ? getDeletedProductIds() : [];
          if (deletedProductIds.length > 500) {
            deletedProductIds = deletedProductIds.slice(-500);
            saveData('ek_deleted_product_ids', deletedProductIds);
            if (typeof db !== 'undefined' && db) {
              const adminSession = typeof getAdminSession === 'function' ? getAdminSession() : null;
              if (adminSession && adminSession.loggedIn) {
                db.collection('ek_tombstones').doc('ek_deleted_product_ids').set({
                  ids: deletedProductIds,
                  updatedAt: new Date().toISOString()
                }).then(() => {
                  if (typeof debugLog === 'function') debugLog("[Tombstone Prune] Pruned ek_deleted_product_ids to last 500 entries.");
                }).catch(err => console.warn("[Tombstone Prune] Rewrite failed:", err));
              }
            }
          }
          if (deletedProductIds.length > 0) {
            list.forEach(p => {
              if (p && p.id && deletedProductIds.includes(p.id)) {
                if (typeof db !== 'undefined' && db) {
                  db.collection('ek_products').doc(p.id).delete()
                    .then(() => { if (typeof debugLog === 'function') debugLog("[Self-Heal] Re-deleted product doc from Firestore:", p.id); })
                    .catch(err => console.warn("[Self-Heal] Re-delete product failed:", p.id, err));
                }
              }
            });
            list = list.filter(p => p && p.id && !deletedProductIds.includes(p.id));
          }

          const existingLocal = typeof getData === 'function' ? getData('ek_products', []) : [];
          const existingLocalValid = Array.isArray(existingLocal) ? existingLocal.filter(p => p && p.id && !deletedProductIds.includes(p.id)) : [];

          // If snapshot is from local IndexedDB cache and local storage already has a fuller product list,
          // preserve the fuller local list so we don't temporarily downgrade or drop items during cold start
          if (isFromCache && existingLocalValid.length > list.length) {
            if (typeof debugLog === 'function') {
              debugLog(`[Realtime Sync] Retaining full local product list (${existingLocalValid.length}) over incomplete cached snapshot (${list.length}).`);
            }
            list = existingLocalValid;
          }

          window._hasFreshCloudData = !isFromCache;
          window._isProductsFromCache = isFromCache;
          if (!isFromCache && typeof window.recordCollectionSyncTime === 'function') {
            window.recordCollectionSyncTime('products');
          }
          saveData('ek_cloud_synced', true);

          const oldProdJson = localStorage.getItem('ek_products') || '';
          const newProdJson = JSON.stringify(list);
          const hasProductsChanged = oldProdJson !== newProdJson;

          if (list && list.length > 0) {
            saveData('ek_products', list);
          }
          if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_products');
          if (typeof syncAiKnowledgeBase === 'function') {
            syncAiKnowledgeBase(list);
          }

          if (hasProductsChanged) {
            window._lastDataSnapshotHash = '';
            window._lastProductsHash = '';
            _lastDataSnapshotHash = null;
            if (typeof _lastProductsHash !== 'undefined') _lastProductsHash = '';
          }

          if (typeof updateCatalogSyncIndicator === 'function') {
            updateCatalogSyncIndicator(isFromCache);
          }

          const curScreen = (typeof currentScreen !== 'undefined' && currentScreen) ? currentScreen : '';
          if (hasProductsChanged) {
            if (!curScreen || curScreen === 'screen-home' || curScreen === 'screen-splash' || curScreen === 'screen-products' || curScreen === 'screen-catalog') {
              scheduleRealtimeHomeRender(false);
            }
            if (curScreen === 'screen-admin') {
              try { if (typeof renderAdminProducts === 'function') renderAdminProducts(); } catch(e) {}
              try { if (typeof renderAdminProductList === 'function') renderAdminProductList(true); } catch(e) {}
            }
            try {
              if (typeof window.refreshActiveProductModalIfOpen === 'function') {
                window.refreshActiveProductModalIfOpen();
              }
            } catch(e) {}
          }
          try { if (typeof updateCartBadge === 'function') updateCartBadge(); } catch(e) {}
        }
      }, err => {
        if (err && (err.code === 'resource-exhausted' || (err.message && err.message.includes('Quota exceeded')))) {
          console.warn("[Realtime Sync] Products listener offline quota fallback active.");
          return;
        }
        console.warn("[Realtime Sync] Products listener notice:", err);
      });
    } catch(e) {
      console.warn("[Realtime Sync] Products subscription skipped:", e);
    }
  }

  // STAGGER LESS CRITICAL LISTENERS (Delivery Zones, Orders, Topic Broadcasts)
  // Attach with a short delay so cold start CPU & network pipe remain 100% focused on Products, Categories, and Settings
  if (window._staggeredListenersTimeout) {
    clearTimeout(window._staggeredListenersTimeout);
  }
  window._staggeredListenersTimeout = setTimeout(() => {
    if (typeof db === 'undefined' || !db) return;

    // 3.5 DELIVERY ZONES REALTIME LISTENER
    if (!_realtimeUnsubscribers.deliveryZones) {
      try {
        _realtimeUnsubscribers.deliveryZones = db.collection('ek_delivery_zones').onSnapshot(snapshot => {
          if (snapshot) {
            const list = [];
            snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
            if (list.length > 0) {
              if (typeof window.recordCollectionSyncTime === 'function') window.recordCollectionSyncTime('delivery_zones');
              saveData('ek_delivery_zones', list);
              if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_delivery_zones');
              const settings = typeof getSettings === 'function' ? getSettings() : (getData('ek_settings') || {});
              if (settings) {
                settings.deliveryZones = list;
                saveData('ek_settings', settings);
              }
              try { if (typeof renderAdminZonesTable === 'function') renderAdminZonesTable(); } catch(e) {}
              try { if (typeof initAdminZonesMap === 'function') initAdminZonesMap(); } catch(e) {}
            }
          }
        }, err => {
          if (err && (err.code === 'resource-exhausted' || (err.message && err.message.includes('Quota exceeded')))) {
            console.warn("[Realtime Sync] Delivery zones listener offline quota fallback active.");
            return;
          }
          console.warn("[Realtime Sync] Delivery zones listener notice:", err);
        });
      } catch(e) {
        console.warn("[Realtime Sync] Delivery zones subscription skipped:", e);
      }
    }

    // 4. ORDERS REALTIME LISTENER (SCOPED BY ROLE: CUSTOMER, RIDER, ADMIN)
    const adminSess = typeof getAdminSession === 'function' ? getAdminSession() : null;
    const deliverySess = typeof getData === 'function' ? getData('ek_delivery_session', null) : null;
    const custSess = typeof getActiveSession === 'function' ? getActiveSession() : (typeof getData === 'function' ? getData('ek_customer_session', null) : null);

    let targetRole = 'guest';
    let sessionKey = 'guest';

    if (adminSess && adminSess.loggedIn) {
      targetRole = 'admin';
      sessionKey = adminSess.id || adminSess.email || 'admin';
    } else if (deliverySess && deliverySess.loggedIn) {
      targetRole = 'rider';
      sessionKey = deliverySess.id || deliverySess.phone || 'rider';
    } else if (custSess && (custSess.loggedIn || custSess.userId || custSess.id || custSess.phone)) {
      targetRole = 'customer';
      sessionKey = custSess.userId || custSess.id || custSess.phone || 'customer';
    }

    const subKey = `${targetRole}_${sessionKey}`;

    if (window._currentOrdersSubKey !== subKey) {
      if (_realtimeUnsubscribers.orders) {
        try { _realtimeUnsubscribers.orders(); } catch(e) {}
        _realtimeUnsubscribers.orders = null;
      }
      window._currentOrdersSubKey = subKey;
    }

    if (!_realtimeUnsubscribers.orders) {
      try {
        let ordersQuery = null;

        if (targetRole === 'customer') {
          const custId = custSess ? (custSess.userId || custSess.id || custSess.uid) : null;
          const custPhone = custSess ? custSess.phone : null;
          if (custId) {
            ordersQuery = db.collection('ek_orders').where('customerId', '==', String(custId)).limit(30);
          } else if (custPhone) {
            ordersQuery = db.collection('ek_orders').where('customerPhone', '==', String(custPhone)).limit(30);
          } else {
            ordersQuery = db.collection('ek_orders').orderBy('createdAt', 'desc').limit(20);
          }
        } else if (targetRole === 'rider') {
          try {
            ordersQuery = db.collection('ek_orders').orderBy('createdAt', 'desc').limit(100);
          } catch(qe) {
            ordersQuery = db.collection('ek_orders').limit(100);
          }
        } else if (targetRole === 'admin') {
          try {
            ordersQuery = db.collection('ek_orders').orderBy('createdAt', 'desc').limit(200);
          } catch(qe) {
            ordersQuery = db.collection('ek_orders').limit(200);
          }
        } else {
          ordersQuery = db.collection('ek_orders').orderBy('createdAt', 'desc').limit(100);
        }

        const handleOrdersSnapshot = (snapshot) => {
          if (snapshot) {
            const snapshotList = [];
            snapshot.forEach(d => {
              const data = d.data();
              if (data) {
                snapshotList.push({ ...data, id: d.id || (data && data.id) });
              }
            });

            const prevOrders = typeof getData === 'function' ? getData('ek_orders', []) : [];
            
            // Merge with local storage orders so loaded history isn't overwritten
            const orderMap = new Map();
            if (Array.isArray(prevOrders)) {
              prevOrders.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });
            }
            snapshotList.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });
            const mergedList = Array.from(orderMap.values());

            const oldOrdersJson = localStorage.getItem('ek_orders') || '';
            const newOrdersJson = JSON.stringify(mergedList);
            const hasOrdersChanged = oldOrdersJson !== newOrdersJson;

            saveData('ek_orders', mergedList);
            if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_orders');
            if (typeof window.recordCollectionSyncTime === 'function') window.recordCollectionSyncTime('orders');

            if (!hasOrdersChanged) return;

            const curScreen = window.currentScreen || (typeof currentScreen !== 'undefined' ? currentScreen : '');

            // Admin real-time updates
            if (targetRole === 'admin' || curScreen === 'screen-admin') {
              if (snapshotList.length > prevOrders.length) {
                try { if (typeof showToast === 'function') showToast("🔔 புதிய ஆர்டர் வந்துள்ளது! New Order Received!", "info"); } catch(e) {}
                try { if (typeof playNotificationSound === 'function') playNotificationSound(); } catch(e) {}
              }
              if (curScreen === 'screen-admin') {
                try { if (typeof renderAdminOrdersList === 'function') renderAdminOrdersList(true); } catch(e) {}
                try { if (typeof renderAdminOrders === 'function') renderAdminOrders(); } catch(e) {}
                try { if (typeof renderAdminDashboard === 'function') renderAdminDashboard(); } catch(e) {}
              }
            }

            // Rider real-time updates
            if (targetRole === 'rider' || curScreen === 'screen-delivery') {
              if (curScreen === 'screen-delivery') {
                try { if (typeof renderRiderOrders === 'function') renderRiderOrders(); } catch(e) {}
                try { if (typeof renderRiderDashboard === 'function') renderRiderDashboard(); } catch(e) {}
                try { if (typeof renderDeliveryScreen === 'function') renderDeliveryScreen(); } catch(e) {}
              }
            }

            // Customer real-time updates
            if (targetRole === 'customer' || targetRole === 'guest' || curScreen === 'screen-track' || curScreen === 'screen-tracker' || curScreen === 'screen-profile' || curScreen === 'screen-home') {
              if (curScreen === 'screen-track' || curScreen === 'screen-tracker' || curScreen === 'screen-my-orders' || curScreen === 'screen-orders') {
                try { if (typeof updateActiveOrderTrackingUI === 'function') updateActiveOrderTrackingUI(); } catch(e) {}
                try { if (typeof renderTrackerScreen === 'function') renderTrackerScreen(); } catch(e) {}
                try { if (typeof renderMyOrdersList === 'function') renderMyOrdersList(); } catch(e) {}
              }
              if (curScreen === 'screen-profile') {
                try { if (typeof renderProfileScreen === 'function') renderProfileScreen(); } catch(e) {}
              }

              // If customer order detail modal is open, re-render it in real-time with authoritative cloud data
              try {
                const codModal = document.getElementById('customer-order-detail-modal');
                if (codModal && (codModal.style.display === 'flex' || codModal.classList.contains('active'))) {
                  const openId = document.getElementById('cod-order-id')?.innerText?.trim();
                  if (openId && typeof openCustomerOrderDetail === 'function') {
                    openCustomerOrderDetail(openId);
                  }
                }
              } catch(e) {}
            }
          }
        };

        _realtimeUnsubscribers.orders = ordersQuery.onSnapshot(handleOrdersSnapshot, err => {
          if (err && (err.code === 'resource-exhausted' || (err.message && err.message.includes('Quota exceeded')))) {
            console.warn("[Realtime Sync] Scoped orders listener offline quota fallback active.");
            return;
          }
          console.warn("[Realtime Sync] Scoped orders listener notice:", err);
          // Fallback query without orderBy or filter
          try {
            if (_realtimeUnsubscribers.orders) _realtimeUnsubscribers.orders();
            _realtimeUnsubscribers.orders = db.collection('ek_orders').limit(200).onSnapshot(handleOrdersSnapshot, fallbackErr => {
              if (fallbackErr && (fallbackErr.code === 'resource-exhausted' || (fallbackErr.message && fallbackErr.message.includes('Quota exceeded')))) {
                console.warn("[Realtime Sync] Fallback orders listener offline quota fallback active.");
                return;
              }
              console.warn("[Realtime Sync] Fallback orders listener failed:", fallbackErr);
            });
          } catch(fallbackErr) {
            console.warn("[Realtime Sync] Fallback orders listener setup failed:", fallbackErr);
          }
        });
      } catch(e) {
        console.warn("[Realtime Sync] Orders subscription skipped:", e);
      }
    }

    // 5. TOPIC BROADCASTS REALTIME LISTENER
    if (!_realtimeUnsubscribers.broadcasts) {
      try {
        const processIncomingBroadcast = function(doc) {
          if (!doc) return;
          const data = doc.data();
          if (!data) return;
          const lastSeenBroadcastId = localStorage.getItem('last_seen_broadcast_id');

          if (doc.id !== lastSeenBroadcastId) {
            const createdTime = new Date(data.createdAt || Date.now()).getTime();
            // Process announcements created within the last 24 hours
            if (!isNaN(createdTime) && (Date.now() - createdTime < 86400000)) {
              localStorage.setItem('last_seen_broadcast_id', doc.id);

              const titleTa = data.titleTa || data.title || '📢 எடப்பாடி கடை';
              const titleEn = data.titleEn || data.title || '📢 Edappadi Kadai';
              const bodyTa = data.bodyTa || data.body || '';
              const bodyEn = data.bodyEn || data.body || '';
              const displayTitle = (typeof currentLang !== 'undefined' && currentLang === 'ta') ? titleTa : titleEn;
              const displayBody = (typeof currentLang !== 'undefined' && currentLang === 'ta') ? bodyTa : bodyEn;

              // 1. Add to Customer Notification Center (Bell icon 🔔)
              if (typeof window.addNotification === 'function') {
                window.addNotification(titleTa, titleEn, bodyTa, bodyEn, '📢');
              } else if (typeof addNotification === 'function') {
                addNotification(titleTa, titleEn, bodyTa, bodyEn, '📢');
              }

              // 2. Update Bell Badge
              if (typeof window.updateNotificationUnreadCount === 'function') {
                window.updateNotificationUnreadCount();
              }

              // 3. Re-render notification list if modal is open
              if (typeof renderNotificationsList === 'function') {
                try { renderNotificationsList(); } catch(e) {}
              }

              // 4. Play chime sound
              if (typeof playLyoChimeSound === 'function') {
                try { playLyoChimeSound(); } catch(e) {}
              }

              // 5. In-App Toast
              if (typeof showToast === 'function') {
                showToast(`📢 ${displayTitle}: ${displayBody}`, 'info', 8000);
              }

              // 6. Native Android Status Bar Push Notification
              if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.showNativeNotification === 'function') {
                try {
                  AndroidStorage.showNativeNotification(displayTitle, displayBody);
                } catch(notifErr) {
                  console.warn('[Native Notification Notice]:', notifErr);
                }
              }
            }
          }
        };

        const setupBroadcastListener = function() {
          try {
            _realtimeUnsubscribers.broadcasts = db.collection('ek_topic_broadcast_requests')
              .orderBy('createdAt', 'desc')
              .limit(5)
              .onSnapshot(snapshot => {
                if (snapshot && !snapshot.empty) {
                  snapshot.docs.forEach(doc => processIncomingBroadcast(doc));
                }
              }, err => {
                if (err && (err.code === 'resource-exhausted' || (err.message && err.message.includes('Quota exceeded')))) {
                  console.warn("[Realtime Sync] Broadcast listener offline quota fallback active.");
                  return;
                }
                console.warn("[Realtime Sync] Indexed broadcast listener failed, falling back to unordered listener:", err);
                try {
                  if (_realtimeUnsubscribers.broadcasts) _realtimeUnsubscribers.broadcasts();
                  _realtimeUnsubscribers.broadcasts = db.collection('ek_topic_broadcast_requests')
                    .limit(10)
                    .onSnapshot(snap => {
                      if (snap && !snap.empty) {
                        snap.docs.forEach(doc => processIncomingBroadcast(doc));
                      }
                    }, fallbackErr => {
                      if (fallbackErr && (fallbackErr.code === 'resource-exhausted' || (fallbackErr.message && fallbackErr.message.includes('Quota exceeded')))) {
                        console.warn("[Realtime Sync] Fallback broadcast listener offline quota fallback active.");
                        return;
                      }
                      console.warn("[Realtime Sync] Fallback broadcast listener error:", fallbackErr);
                    });
                } catch(fErr) {
                  console.warn("[Realtime Sync] Fallback broadcast setup error:", fErr);
                }
              });
          } catch(err) {
            console.warn("[Realtime Sync] Primary broadcast setup error:", err);
          }
        };

        setupBroadcastListener();
      } catch(e) {
        console.warn("[Realtime Sync] Broadcast subscription skipped:", e);
      }
    }

    // 6. CUSTOMER PROFILE REAL-TIME LISTENER (Wallet points, profile changes, tier updates)
    if (targetRole === 'customer' && !_realtimeUnsubscribers.customerProfile) {
      try {
        const custSess = getData('ek_customer_session') || (typeof getActiveUser === 'function' ? getActiveUser() : null);
        const custId = custSess ? (custSess.userId || custSess.id || custSess.uid) : null;
        if (custId) {
          _realtimeUnsubscribers.customerProfile = db.collection('ek_users').doc(String(custId)).onSnapshot(doc => {
            if (doc && doc.exists) {
              const cloudUser = doc.data();
              if (cloudUser) {
                const localUsers = getData('ek_users', []) || [];
                const idx = localUsers.findIndex(u => u && (u.id === custId || (cloudUser.phone && u.phone === cloudUser.phone)));
                const prevPoints = idx !== -1 ? (localUsers[idx].loyaltyPoints || 0) : (cloudUser.loyaltyPoints || 0);

                if (idx !== -1) {
                  localUsers[idx] = { ...localUsers[idx], ...cloudUser };
                } else {
                  localUsers.push({ id: doc.id, ...cloudUser });
                }
                saveData('ek_users', localUsers);

                const currentActive = typeof getActiveUser === 'function' ? getActiveUser() : null;
                if (currentActive && (currentActive.id === custId || (cloudUser.phone && currentActive.phone === cloudUser.phone))) {
                  const newPoints = cloudUser.loyaltyPoints !== undefined ? cloudUser.loyaltyPoints : currentActive.loyaltyPoints;
                  const pointsDiff = newPoints - prevPoints;

                  currentActive.loyaltyPoints = newPoints;
                  if (cloudUser.tier) currentActive.tier = cloudUser.tier;
                  if (cloudUser.name) currentActive.name = cloudUser.name;
                  if (cloudUser.address) currentActive.address = cloudUser.address;
                  if (cloudUser.phone) currentActive.phone = cloudUser.phone;
                  saveData('ek_active_user', currentActive);

                  const sess = getData('ek_customer_session');
                  if (sess) {
                    sess.loyaltyPoints = newPoints;
                    if (cloudUser.name) sess.name = cloudUser.name;
                    if (cloudUser.phone) sess.phone = cloudUser.phone;
                    saveData('ek_customer_session', sess);
                  }

                  if (window._initialProfileLoadDone && Math.abs(pointsDiff) >= 1) {
                    const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
                    const msg = pointsDiff > 0
                      ? (isTa ? `🎁 உங்கள் வாலட்டில் +${Math.round(pointsDiff)} புள்ளிகள் சேர்க்கப்பட்டுள்ளன! இருப்பு: ${Math.round(newPoints)} pts` : `🎁 +${Math.round(pointsDiff)} points credited to your wallet! Balance: ${Math.round(newPoints)} pts`)
                      : (isTa ? `🔔 உங்கள் வாலட் புள்ளிகள் புதுப்பிக்கப்பட்டன. இருப்பு: ${Math.round(newPoints)} pts` : `🔔 Wallet points updated. Balance: ${Math.round(newPoints)} pts`);
                    if (typeof showToast === 'function') showToast(msg, 'success', 6000);
                    if (typeof playLyoChimeSound === 'function') { try { playLyoChimeSound(); } catch(e) {} }
                  }
                  window._initialProfileLoadDone = true;

                  try { if (typeof renderProfileData === 'function') renderProfileData(); } catch(e) {}
                  try { if (typeof updateHeaderUI === 'function') updateHeaderUI(); } catch(e) {}
                  try { if (typeof renderCartCustomerContactCard === 'function') renderCartCustomerContactCard(); } catch(e) {}
                }
              }
            }
          }, err => {
            console.warn("[Realtime Sync] Customer profile listener notice:", err);
          });
        }
      } catch (e) {
        console.warn("[Realtime Sync] Customer profile listener setup error:", e);
      }
    }

    // 7. PERSONAL CUSTOMER NOTIFICATIONS REAL-TIME LISTENER (Direct admin messages, order status push, wallet alerts)
    if (targetRole === 'customer' && !_realtimeUnsubscribers.customerNotifications) {
      try {
        const custSess = getData('ek_customer_session') || (typeof getActiveUser === 'function' ? getActiveUser() : null);
        const custId = custSess ? (custSess.userId || custSess.id || custSess.uid) : null;
        if (custId) {
          const handleNotificationDoc = function(doc) {
            if (!doc) return;
            const data = doc.data();
            if (!data) return;
            const notifKey = 'processed_cnotif_' + doc.id;
            if (localStorage.getItem(notifKey)) return;
            localStorage.setItem(notifKey, 'true');

            const createdTime = new Date(data.createdAt || Date.now()).getTime();
            if (!isNaN(createdTime) && (Date.now() - createdTime < 172800000)) {
              const titleTa = data.titleTa || '📢 அறிவிப்பு';
              const titleEn = data.titleEn || '📢 Notification';
              const bodyTa = data.bodyTa || '';
              const bodyEn = data.bodyEn || '';
              const icon = data.type === 'points_update' ? '🎁' : (data.type === 'support_chat_reply' ? '💬' : '📦');

              if (typeof window.addNotification === 'function') {
                window.addNotification(titleTa, titleEn, bodyTa, bodyEn, icon);
              }
              if (typeof window.updateNotificationUnreadCount === 'function') {
                window.updateNotificationUnreadCount();
              }
              if (typeof renderNotificationsList === 'function') {
                try { renderNotificationsList(); } catch(e) {}
              }

              const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
              const dispTitle = isTa ? titleTa : titleEn;
              const dispBody = isTa ? bodyTa : bodyEn;

              if (typeof showToast === 'function') {
                showToast(`${icon} ${dispTitle}: ${dispBody}`, 'info', 7000);
              }
              if (typeof playLyoChimeSound === 'function') {
                try { playLyoChimeSound(); } catch(e) {}
              }
              if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.showNativeNotification === 'function') {
                try { AndroidStorage.showNativeNotification(dispTitle, dispBody); } catch(ne) {}
              }
            }
          };

          _realtimeUnsubscribers.customerNotifications = db.collection('ek_customer_notifications')
            .where('targetUserId', '==', String(custId))
            .limit(20)
            .onSnapshot(snapshot => {
              if (snapshot && !snapshot.empty) {
                snapshot.docChanges().forEach(change => {
                  if (change.type === 'added') {
                    handleNotificationDoc(change.doc);
                  }
                });
              }
            }, err => {
              console.warn("[Realtime Sync] Customer notification listener error:", err);
            });
        }
      } catch (e) {
        console.warn("[Realtime Sync] Customer notification listener setup error:", e);
      }
    }
  }, 750);
};

window.teardownLiveListeners = function() {
  try {
    if (window._staggeredListenersTimeout) {
      clearTimeout(window._staggeredListenersTimeout);
      window._staggeredListenersTimeout = null;
    }
    if (_realtimeUnsubscribers) {
      Object.keys(_realtimeUnsubscribers).forEach(key => {
        if (typeof _realtimeUnsubscribers[key] === 'function') {
          try { _realtimeUnsubscribers[key](); } catch(e) {}
        }
        _realtimeUnsubscribers[key] = null;
      });
    }
    window._currentOrdersSubKey = null;
    window._initialProfileLoadDone = false;
    window._adminCustomersListenerAttached = false;
    debugLog("[Realtime Sync] All live Firestore listeners torn down cleanly.");
  } catch(e) {
    console.warn("[Realtime Sync] Error during teardownLiveListeners:", e);
  }
};

window.onAndroidAppPause = function() {
  debugLog("[Lifecycle] onAndroidAppPause received. Pausing background activity...");
  try {
    // 1. Pause all setInterval polling loops by setting a global flag
    window._isAppBackgrounded = true;
    
    // 2. Disable Firestore network to stop all real-time listener traffic
    if (typeof db !== 'undefined' && db && db.disableNetwork) {
      db.disableNetwork().catch(e => console.warn("[Lifecycle] disableNetwork notice:", e));
    }
    
    // 3. Pause CSS animations by adding a body class
    if (document.body) {
      document.body.classList.add('app-backgrounded');
    }
  } catch(e) {
    console.warn("[Lifecycle] onAndroidAppPause error:", e);
  }
};

window._lastAndroidResumeTime = 0;
window.onAndroidAppResume = function() {
  const now = Date.now();

  // CRITICAL: Always re-enable network and resume animations, even if debounced
  if (window._isAppBackgrounded) {
    window._isAppBackgrounded = false;
    if (typeof db !== 'undefined' && db && db.enableNetwork) {
      db.enableNetwork().catch(e => console.warn("[Lifecycle] enableNetwork notice:", e));
    }
    if (document.body) {
      document.body.classList.remove('app-backgrounded');
    }
  }

  // Debounce non-critical operations (session validation, UI refresh, sync)
  if (now - window._lastAndroidResumeTime < 800) return;
  window._lastAndroidResumeTime = now;

  debugLog("[Lifecycle] onAndroidAppResume received.");

  try {
    // 1. Re-validate sessions
    if (typeof validateAndSanitizeSessions === 'function') {
      validateAndSanitizeSessions();
    }

    // 2. Ensure Firestore realtime listeners are active
    if (typeof setupCloudRealtimeListeners2 === 'function') {
      setupCloudRealtimeListeners2();
    }

    // 3. Process any pending sync queue items
    if (typeof processPendingSyncQueue === 'function') {
      processPendingSyncQueue().catch(e => console.warn("[Resume Sync] Queue process notice:", e));
    }
    if (typeof processPendingProductSyncQueue === 'function') {
      try { processPendingProductSyncQueue(); } catch(e) {}
    }

    // 4. Smooth non-blocking UI update for active screen
    const curScreen = window.currentScreen || (typeof currentScreen !== 'undefined' ? currentScreen : '');
    if (curScreen === 'screen-home' || curScreen === 'screen-products' || curScreen === 'screen-catalog') {
      if (typeof updateCartBadge === 'function') try { updateCartBadge(); } catch(e) {}
      if (typeof updateNotificationUnreadCount === 'function') try { updateNotificationUnreadCount(); } catch(e) {}
      if (typeof renderHomeScreenProducts === 'function') try { renderHomeScreenProducts(false); } catch(e) {}
    } else if (curScreen === 'screen-admin') {
      if (typeof renderAdminDashboard === 'function') try { renderAdminDashboard(); } catch(e) {}
    } else if (curScreen === 'screen-delivery') {
      if (typeof renderDeliveryScreen === 'function') try { renderDeliveryScreen(); } catch(e) {}
    } else if (curScreen === 'screen-track' || curScreen === 'screen-tracker' || curScreen === 'screen-my-orders') {
      if (typeof renderTrackerScreen === 'function') try { renderTrackerScreen(); } catch(e) {}
      if (typeof renderMyOrdersList === 'function') try { renderMyOrdersList(); } catch(e) {}
    }
  } catch(err) {
    console.warn("[Lifecycle] onAndroidAppResume execution error:", err);
  }
};

// Auto-trigger resume handler when tab/app becomes visible
try {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (typeof window.onAndroidAppResume === 'function') {
        window.onAndroidAppResume();
      }
    }
  });
} catch(e) {}

// Global online reconnection handler
try {
  window.addEventListener('online', () => {
    debugLog("[Network] Connection restored. Re-synchronizing cloud listeners and pending queues...");
    try {
      if (typeof db !== 'undefined' && db && db.enableNetwork) {
        db.enableNetwork().catch(e => console.warn("[Network] enableNetwork notice:", e));
      }
    } catch(e) {}
    if (typeof setupCloudRealtimeListeners2 === 'function') {
      setupCloudRealtimeListeners2();
    }
    if (typeof processPendingSyncQueue === 'function') {
      processPendingSyncQueue().catch(e => console.warn("[Network] Pending sync process notice:", e));
    }
    if (typeof processPendingProductSyncQueue === 'function') {
      try { processPendingProductSyncQueue(); } catch(e) {}
    }
  });
} catch(e) {}

window.renderAdminUpiSettings = window.renderAdminUpiSettings || function() {};
window.initApp = window.initApp || function() {};
window.runAbsoluteCleanupForThreeProducts = window.runAbsoluteCleanupForThreeProducts || function() {};
window.attachInfiniteScrollListener = window.attachInfiniteScrollListener || function() {};
window.migrateBase64ImagesToStorage = window.migrateBase64ImagesToStorage || function() {};
window.runTimeScheduler = window.runTimeScheduler || function() {};

    /* jshint esversion: 8 */
    const DEBUG_MODE = false;
    function debugLog(...args) {
      if (typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE) console.log(...args);
    }
    window.debugLog = debugLog;
    function scrollToCenterHorizontal(element, container) {
      if (!element) return;
      const targetContainer = container || element.parentElement;
      if (!targetContainer) return;
      try {
        const elementOffsetLeft = element.offsetLeft;
        const elementWidth = element.offsetWidth;
        const containerWidth = targetContainer.clientWidth;
        const targetScrollLeft = elementOffsetLeft - (containerWidth / 2) + (elementWidth / 2);
        targetContainer.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: 'smooth'
        });
      } catch (e) {
        console.error("scrollToCenterHorizontal error:", e);
      }
    }
     window.onerror = function(msg, url, line, col, error) {
      console.error("Global Error Intercepted:", msg, "at line:", line, "col:", col);
      // Suppress showing visual red error toast for generic cross-origin "Script error." or line 0 errors
      const isGenericScriptError = String(msg).toLowerCase().includes("script error") || line === 0 || !line;

      if (!isGenericScriptError) {
        try {
          const diagContainer = document.getElementById('splash-diagnostics');
          const diagText = document.getElementById('splash-diagnostics-text');
          if (diagContainer && diagText) {
            diagContainer.style.display = 'block';
            diagText.innerText = "Error: " + msg + "\nLine: " + line + ":" + col + "\nFile: " + (url || "").split('/').pop();
          }
        } catch (ex) {}
        try {
          let globalErrDiv = document.getElementById('global-runtime-error-toast');
          if (!globalErrDiv) {
            globalErrDiv = document.createElement('div');
            globalErrDiv.id = 'global-runtime-error-toast';
            globalErrDiv.style.cssText = "position:fixed; bottom:80px; left:20px; right:20px; background:rgba(220,38,38,0.95); border:1.5px solid #ef4444; color:#ffffff; padding:16px; border-radius:12px; font-family:'JetBrains Mono',monospace; font-size:12px; z-index:999999; box-shadow:0 10px 25px rgba(0,0,0,0.5); display:flex; flex-direction:column; gap:6px;";
            document.body.appendChild(globalErrDiv);
          }
          globalErrDiv.innerHTML = `
            <div style="font-weight:bold; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
              <span>⚠️ Runtime Exception:</span>
              <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:#ffffff; font-size:16px; cursor:pointer; font-weight:bold; line-height:1;">&times;</button>
            </div>
            <div style="white-space:pre-wrap; word-break:break-all;">Error: ${msg}\nLine: ${line}:${col}\nFile: ${(url || "").split('/').pop()}</div>
          `;
        } catch (errVisual) {}
      }

      try {
        const splash = document.getElementById('screen-splash');
        if (splash && splash.classList.contains('active')) {
          console.warn("Recovering from exception by forcing home navigation...");
          splash.classList.remove('active');
          const home = document.getElementById('screen-home');
          if (home) {
            home.classList.add('active');
            currentScreen = 'screen-home';
            try { renderHomeScreen(); } catch(e) {}
          }
          const bottomNav = document.getElementById('app-bottom-nav');
          if (bottomNav) bottomNav.style.display = 'flex';
        }
      } catch (inner) {}
      return false;
    };

    window.onunhandledrejection = function(event) {
      console.error("Unhandled promise rejection:", event.reason);
      const reasonMsg = event.reason ? event.reason.message || String(event.reason) : "Empty rejection error";
      try {
        const diagContainer = document.getElementById('splash-diagnostics');
        const diagText = document.getElementById('splash-diagnostics-text');
        if (diagContainer && diagText) {
          diagText.innerText = "Unhandled Rejection: " + reasonMsg;
        }
      } catch (ex) {}

      try {
        const splash = document.getElementById('screen-splash');
        if (splash && splash.classList.contains('active')) {
          splash.classList.remove('active');
          const home = document.getElementById('screen-home');
          if (home) {
            home.classList.add('active');
            currentScreen = 'screen-home';
            try { renderHomeScreen(); } catch(e) {}
          }
          const bottomNav = document.getElementById('app-bottom-nav');
          if (bottomNav) bottomNav.style.display = 'flex';
        }
      } catch (inner) {}
    };

    window.addEventListener('focusout', function(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
        setTimeout(function() {
          const composeBox = document.querySelector('#lyo-ai-compose-box');
          if (composeBox && document.activeElement !== document.getElementById('lyo-ai-input')) {
            composeBox.style.transform = 'translateY(0)';
          }
          window.scrollTo({ top: window.scrollY, behavior: 'instant' });
          if (document.body) document.body.style.height = '100%';
          if (document.documentElement) document.documentElement.style.height = '100%';
        }, 50);
      }
    });

    window.escapeHtml = function(str) {
      if (str === null || str === undefined) return '';
      return String(str).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      });
    };

    const firebaseConfig = {
      apiKey: "AIzaSyDtlKng15Cyixb6HJx-mToBXHVVy28SXSA",
      authDomain: "edappadi-kadai.firebaseapp.com",
      projectId: "edappadi-kadai",
      storageBucket: "edappadi-kadai.firebasestorage.app",
      messagingSenderId: "397565375990",
      appId: "1:397565375990:web:aa687e98bdfdf5dece83d7",
      measurementId: "G-Q0CL1WC8E8"
    };

    function sanitizeDataSecure(data, seen = new WeakSet()) {
      if (typeof data === 'object' && data !== null) {
        if (seen.has(data)) {
          return null;
        }
        seen.add(data);
        if (Array.isArray(data)) {
          return data.map(item => sanitizeDataSecure(item, seen));
        }
        const copy = {};
        for (const k in data) {
          if (k === 'password') continue;
          if (Object.prototype.hasOwnProperty.call(data, k)) {
            const val = data[k];
            if (typeof val === 'object' && val !== null) {
              copy[k] = sanitizeDataSecure(val, seen);
            } else {
              copy[k] = val;
            }
          }
        }
        return copy;
      }
      return data;
    }

    try {
      let isInterceptingLocal = false;
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        if (isInterceptingLocal) return originalSetItem.call(this, key, value);
        if (typeof value === 'string' && value.includes('"password"')) {
          try {
            isInterceptingLocal = true;
            const parsed = JSON.parse(value);
            value = JSON.stringify(sanitizeDataSecure(parsed));
          } catch (e) {
          } finally {
            isInterceptingLocal = false;
          }
        }
        return originalSetItem.call(this, key, value);
      };

      let isInterceptingSession = false;
      const originalSessionSetItem = sessionStorage.setItem;
      sessionStorage.setItem = function(key, value) {
        if (isInterceptingSession) return originalSessionSetItem.call(this, key, value);
        if (typeof value === 'string' && value.includes('"password"')) {
          try {
            isInterceptingSession = true;
            const parsed = JSON.parse(value);
            value = JSON.stringify(sanitizeDataSecure(parsed));
          } catch (e) {
          } finally {
            isInterceptingSession = false;
          }
        }
        return originalSessionSetItem.call(this, key, value);
      };
    } catch (e) {
      console.error("[Security] Interceptor initialization failed:", e);
    }

    var fbApp = window.fbApp = null;
    var fbAnalytics = window.fbAnalytics = null;
    var db = window.db = null;

    try {
      window.locallyModifiedOrders = new Proxy({}, {
        get: function(target, prop) {
          const now = Date.now();
          try {
            const raw = localStorage.getItem('ek_locally_modified_orders');
            if (raw) {
              const parsed = JSON.parse(raw);
              const entry = parsed[prop];
              if (entry !== undefined && entry !== null) {
                // If stored as { value, ts } object
                if (typeof entry === 'object' && entry.ts !== undefined) {
                  if (now - entry.ts > 60000) {
                    delete parsed[prop];
                    delete target[prop];
                    localStorage.setItem('ek_locally_modified_orders', JSON.stringify(parsed));
                    return null;
                  }
                  return entry.value;
                }
                // Legacy number timestamp (shield expiry timestamp format)
                if (typeof entry === 'number') {
                  if (now > entry) {
                    delete parsed[prop];
                    delete target[prop];
                    localStorage.setItem('ek_locally_modified_orders', JSON.stringify(parsed));
                    return null;
                  }
                  return entry;
                }
                return entry;
              }
            }
          } catch (e) {}

          const targetEntry = target[prop];
          if (targetEntry !== undefined && targetEntry !== null) {
            if (typeof targetEntry === 'object' && targetEntry.ts !== undefined) {
              if (now - targetEntry.ts > 60000) {
                delete target[prop];
                return null;
              }
              return targetEntry.value;
            }
            if (typeof targetEntry === 'number') {
              if (now > targetEntry) {
                delete target[prop];
                return null;
              }
              return targetEntry;
            }
            return targetEntry;
          }
          return null;
        },
        set: function(target, prop, value) {
          const entry = { value: value, ts: Date.now() };
          target[prop] = entry;
          try {
            let modified = {};
            const raw = localStorage.getItem('ek_locally_modified_orders');
            if (raw) modified = JSON.parse(raw);
            modified[prop] = entry;
            localStorage.setItem('ek_locally_modified_orders', JSON.stringify(modified));
          } catch (e) {}
          return true;
        }
      });
    } catch (e) {
      console.warn("Proxy not supported, falling back to in-memory locallyModifiedOrders:", e);
      window.locallyModifiedOrders = {};
    }

    let _lastAdminPermissionCheck = 0;
    let _lastAdminDocUpsert = 0;

    async function verifyAdminWritePermission(operation) {
      debugLog(`[Admin Permission Audit] Pre-write verification started for: ${operation}`);
      if (typeof firebase === 'undefined' || !firebase.auth) {
        return true;
      }

      const adminSess = typeof getAdminSession === 'function' ? getAdminSession() : null;
      const user = firebase.auth().currentUser;

      if (adminSess && adminSess.loggedIn) {
        const now = Date.now();
        if (user && typeof db !== 'undefined' && db && (now - _lastAdminDocUpsert > 600000)) {
          _lastAdminDocUpsert = now;
          db.collection('ek_admin_accounts').doc(user.uid).set({
            id: user.uid,
            uid: user.uid,
            email: user.email || `admin_${adminSess.phone || 'store'}@app.com`,
            phone: adminSess.phone || '',
            name: adminSess.name || 'Admin',
            role: 'admin',
            active: true,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(e => console.warn("[Admin Permission Audit] Auto-upsert admin doc notice:", e));
        }
        return true;
      }

      if (!user) {
        console.error(`[Admin Permission Audit] DENIED: No authenticated user present.`);
        return false;
      }

      if (user.isAnonymous) {
        console.error(`[Admin Permission Audit] DENIED: User is signed in anonymously. Admin operations are strictly forbidden for guest accounts.`);
        return false;
      }

      const now = Date.now();
      if (now - _lastAdminPermissionCheck < 120000) {
        return true;
      }

      if (typeof db !== 'undefined' && db) {
        try {
          const docSnap = await db.collection('ek_admin_accounts').doc(user.uid).get();
          _lastAdminPermissionCheck = now;
          if (docSnap.exists) {
            const adminData = docSnap.data();
            if (adminData && (adminData.role === 'admin' || adminData.role === 'superadmin') && adminData.active !== false) {
              return true;
            }
          }
          await db.collection('ek_admin_accounts').doc(user.uid).set({
            id: user.uid,
            uid: user.uid,
            email: user.email || '',
            role: 'admin',
            active: true,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(e => console.warn(e));
          return true;
        } catch (e) {
          console.warn(`[Admin Permission Audit] Lookup failed but proceeding if offline fallback enabled:`, e);
          return true;
        }
      }
      return true;
    }

    function logProductWriteAudit(actionType, productId, sourceFunc) {
      const timestamp = new Date().toISOString();
      let uid = "Unauthenticated";
      let isAnonymous = "Unknown";
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        const user = firebase.auth().currentUser;
        uid = user.uid;
        isAnonymous = user.isAnonymous;
      }
      debugLog(`[Product Write Audit] [${timestamp}]`);
      debugLog(` - Action Type: ${actionType}`);
      debugLog(` - Product ID: ${productId}`);
      debugLog(` - Auth UID: ${uid}`);
      debugLog(` - Is Anonymous: ${isAnonymous}`);
      debugLog(` - Source File/Function: ${sourceFunc}`);
    }

    function isDemoOrMockProductId(id) {
      if (!id) return false;
      const demoPrefixes = ['p_chicken_biryani', 'p_fish_', 'p_dairy_', 'p_veg_', 'p_fruit_', 'p_groceries_'];
      const exactDemoIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
      if (exactDemoIds.includes(id)) return true;
      return demoPrefixes.some(prefix => id.startsWith(prefix));
    }

    function updateCloudStatus(status, tooltip = '') {
      const colors = {
        'connected': '#22c55e', // var(--accent-green) style green
        'syncing': '#3b82f6',    // var(--accent-blue) style blue
        'error': '#ef4444',      // var(--accent-red) style red
        'offline': '#737373'    // grey
      };
      const color = colors[status] || '#eab308'; // var(--accent-yellow) style yellow

      const badgeHome = document.getElementById('cloud-status-badge-home');
      const badgeAdmin = document.getElementById('cloud-status-badge-admin');

      if (badgeHome) {
        badgeHome.style.backgroundColor = color;
        badgeHome.title = tooltip;
      }
      if (badgeAdmin) {
        badgeAdmin.style.backgroundColor = color;
        badgeAdmin.title = tooltip;
      }
      debugLog(`[Cloud Status] Status updated to: ${status} (${tooltip})`);
    }

    function syncSessionKeysFromAndroidStorage() {
      if (typeof AndroidStorage !== 'undefined' && AndroidStorage.getData) {
        try {
          const keys = [
            'ek_admin_session', 'ek_customer_session', 'ek_delivery_session',
            'ek_customer_remember_me', 'ek_admin_remember_me', 'ek_delivery_remember_me',
            'ek_remembered_credentials', 'ek_remembered_admin_credentials', 'ek_remembered_delivery_credentials',
            'ek_admin_accounts', 'ek_users', 'ek_lang'
          ];
          for (const k of keys) {
            const val = AndroidStorage.getData(k, "");
            if (val && val !== 'null' && val !== 'undefined') {
              localStorage.setItem(k, val);
            }
          }
          debugLog("[AndroidStorage Sync] Synchronous session keys sync completed before Firebase init.");
        } catch (err) {
          console.error("[AndroidStorage Sync] Error in synchronous session keys sync:", err);
        }
      }
    }
    try {
      syncSessionKeysFromAndroidStorage();
    } catch (e) {}

    let isExplicitLogoutInProgress = false;
    let explicitLogoutStartTime = 0;

    function setExplicitLogoutInProgress(val) {
      if (val) {
        isExplicitLogoutInProgress = true;
        window.isExplicitLogoutInProgress = true;
        explicitLogoutStartTime = Date.now();
      } else {
        isExplicitLogoutInProgress = false;
        window.isExplicitLogoutInProgress = false;
        explicitLogoutStartTime = 0;
      }
    }
    window.setExplicitLogoutInProgress = setExplicitLogoutInProgress;

    function checkIsExplicitLogoutInProgress() {
      if (isExplicitLogoutInProgress || window.isExplicitLogoutInProgress) {
        if (explicitLogoutStartTime > 0 && (Date.now() - explicitLogoutStartTime) > 10000) {
          console.warn("isExplicitLogoutInProgress force-reset after timeout — possible stuck logout flow");
          isExplicitLogoutInProgress = false;
          window.isExplicitLogoutInProgress = false;
          explicitLogoutStartTime = 0;
          return false;
        }
        return true;
      }
      return false;
    }
    window.checkIsExplicitLogoutInProgress = checkIsExplicitLogoutInProgress;

    if (typeof firebase !== 'undefined') {
      try {
        updateCloudStatus('syncing', 'Initializing Cloud Connection...');
        fbApp = firebase.initializeApp(firebaseConfig);
        debugLog('[Diagnostic Step 1] firebase.initializeApp SUCCEEDED! ProjectId:', firebaseConfig ? firebaseConfig.projectId : 'N/A');
        db = firebase.firestore();
        window.db = db;
        try {
          db.settings({
            experimentalAutoDetectLongPolling: true,
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
          });
        } catch (settingsErr) {
          debugLog("Firestore settings configuration notice: " + (settingsErr && settingsErr.message));
        }

        if (db && typeof db.enablePersistence === 'function') {
          db.enablePersistence({ synchronizeTabs: true })
            .then(() => {
              debugLog("Firestore offline persistence loaded successfully! ✓");
            })
            .catch(err => {
              if (err.code === 'failed-precondition') {
                console.warn("Firestore offline persistence: multiple tabs open or already running.");
              } else if (err.code === 'unimplemented') {
                console.warn("Firestore offline persistence: current browser does not support it.");
              } else {
                console.warn("Firestore offline persistence execution error:", err);
              }
            });
        }

        if (typeof setupCloudRealtimeListeners2 === 'function') {
          try { setupCloudRealtimeListeners2(); } catch (e) {}
        }
        if (firebase.firestore && firebase.firestore.DocumentReference && firebase.firestore.DocumentReference.prototype) {
          try {
            const originalSet = firebase.firestore.DocumentReference.prototype.set;
            firebase.firestore.DocumentReference.prototype.set = function(data, options) {
              const cleanData = sanitizeDataSecure(data);
              return originalSet.call(this, cleanData, options);
            };

            const originalUpdate = firebase.firestore.DocumentReference.prototype.update;
            firebase.firestore.DocumentReference.prototype.update = function(data, ...args) {
              if (typeof data === 'object' && data !== null) {
                const cleanData = sanitizeDataSecure(data);
                return originalUpdate.call(this, cleanData, ...args);
              } else if (typeof data === 'string') {
                if (data === 'password') {
                  console.warn('[Security] Blocked password field update to Firestore.');
                  return Promise.resolve();
                }
                return originalUpdate.apply(this, [data, ...args]);
              }
              return originalUpdate.call(this, data, ...args);
            };

            const originalAdd = firebase.firestore.CollectionReference.prototype.add;
            firebase.firestore.CollectionReference.prototype.add = function(data) {
              const cleanData = sanitizeDataSecure(data);
              return originalAdd.call(this, cleanData);
            };
            debugLog("[Security] Firestore secure data filters initialized successfully.");
          } catch (secErr) {
            console.error("[Security] Failed to override Firestore methods:", secErr);
          }
        }
        debugLog("Firebase Firestore initialized successfully inside index.html PWA!");
        debugLog('[Firebase Init Diagnostic] firebase.initializeApp succeeded. ProjectId:', firebaseConfig.projectId);

        if (db) {
          debugLog('[Firebase Init] Firestore database reference ready.');
        }

        if (firebase.storage) {
          try {
            if (typeof firebase.storage.setMaxUploadRetryTime === 'function') {
              firebase.storage.setMaxUploadRetryTime(10000);
            }
          } catch (e) {}
          try {
            if (typeof firebase.storage === 'function' && typeof firebase.storage().setMaxUploadRetryTime === 'function') {
              firebase.storage().setMaxUploadRetryTime(10000);
            }
          } catch (e) {}
        }

        if (typeof firebase !== 'undefined' && firebase.auth) {
          window.clearSessionAndRedirectToLogin = function() {
            debugLog("[Auth] Clearing all local sessions because FirebaseAuth.currentUser is null/anonymous.");

            removeData('ek_customer_session');
            removeData('ek_admin_session');
            removeData('ek_delivery_session');
            sessionStorage.removeItem('ek_customer_session_temp');
            localStorage.removeItem('ek_customer_session');
            localStorage.removeItem('ek_admin_session');
            localStorage.removeItem('ek_delivery_session');

            removeData('ek_active_session');
            localStorage.removeItem('ek_active_session');

            if (typeof showScreen === 'function') {
              showScreen('screen-login');
            }
          };

          if (firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence) {
            firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
              .then(() => debugLog("[Auth] Persistence configured to LOCAL successfully"))
              .catch(pe => console.warn("[Auth] Persistence configuration failed:", pe));
          }

          firebase.auth().onAuthStateChanged(async user => {
            if (checkIsExplicitLogoutInProgress() || window.isManualLoginInProgress || (typeof getData === 'function' && getData('ek_explicit_logged_out') === true)) {
              debugLog("[Auth State Changed] Explicit logout or manual login in progress. Suppressing auth state listener processing.");
              return;
            }

            const hasCustSession = !!getData('ek_customer_session');
            const adminSession = typeof getAdminSession === 'function' ? getAdminSession() : null;
            const deliverySession = typeof getData === 'function' ? getData('ek_delivery_session', null) : null;
            const hasAdminSession = !!(adminSession && adminSession.loggedIn);
            const hasDeliverySession = !!(deliverySession && deliverySession.loggedIn);

            debugLog("[Auth State Changed] Listener triggered:");
            try {
              if (user && !user.isAnonymous) {
                debugLog(` - UID: ${user.uid}`);
                debugLog(` - Email: ${user.email}`);
                debugLog(` - Anonymous: ${user.isAnonymous}`);
                debugLog(` - Provider ID: ${user.providerId || 'None'}`);
                debugLog(` - Local Sessions: Cust=${hasCustSession}, Admin=${hasAdminSession}, Delivery=${hasDeliverySession}`);

                updateCloudStatus('connected', 'Cloud Database Connected ✓');
                setupCloudRealtimeListeners2();
                if (typeof updateEmailVerificationBanner === 'function') {
                  try { updateEmailVerificationBanner(); } catch(e) {}
                }
                if (typeof migratePasswordsToHash === 'function') {
                  try { migratePasswordsToHash(); } catch(e) {}
                }

                if (hasAdminSession) {
                  debugLog("[Auth State Changed] Active Admin session detected. Performing authorization check...");
                  try {
                    let docSnap = await db.collection('ek_admin_accounts').doc(user.uid).get();
                    if (!docSnap.exists && user.email) {
                      const emailQ = await db.collection('ek_admin_accounts').where('email', '==', user.email).limit(1).get().catch(() => null);
                      if (emailQ && !emailQ.empty) {
                        docSnap = emailQ.docs[0];
                      }
                    }
                    if (docSnap && docSnap.exists) {
                      const adminData = docSnap.data();
                      debugLog("[Auth State Changed] Admin document data:", JSON.stringify(adminData));
                      if (adminData && (adminData.role === 'admin' || adminData.role === 'superadmin') && adminData.active !== false) {
                        debugLog("[Auth State Changed] Admin authorization GRANTED ✓");
                        window._verifiedAdminUids = window._verifiedAdminUids || new Set();
                        window._verifiedAdminUids.add(user.uid);
                      } else {
                        console.error("[Auth State Changed] Admin document found but role is not admin/superadmin or active is false! Access DENIED ❌");
                        removeData('ek_admin_session');
                        await firebase.auth().signOut().catch(() => {});
                        showToast(currentLang === 'ta' ? "நிர்வாகி கணக்கு முடக்கப்பட்டுள்ளது அல்லது அனுமதி இல்லை ❌" : "Admin account is deactivated or unauthorized ❌", "error");
                        if (typeof showScreen === 'function') showScreen('screen-login');
                      }
                    } else {
                      console.warn(`[Auth State Changed] Admin document not found at ek_admin_accounts/${user.uid}!`);
                      removeData('ek_admin_session');
                      await firebase.auth().signOut().catch(() => {});
                      showToast(currentLang === 'ta' ? "நிர்வாக கணக்கு காணவில்லை. தயவுசெய்து சூப்பர் அட்மின-ஐ தொடர்பு கொள்ளவும்." : "Admin account not found in database. Please contact the superadmin to create your admin account.", "error");
                      if (typeof showScreen === 'function') showScreen('screen-login');
                    }
                  } catch (e) {
                    console.error("[Auth State Changed] Error retrieving admin document:", e);
                  }
                } else if (hasCustSession) {
                  debugLog("[Auth State Changed] Active Customer session detected. Loading user data...");
                  await loadUserData(user.uid);
                  debugLog("[Auth State Changed] Active Customer session loaded. Splash sequence will handle routing.");
                } else if (hasDeliverySession) {
                  debugLog("[Auth State Changed] Active Delivery session detected.");
                  debugLog("[Auth State Changed] Active Delivery session loaded. Splash sequence will handle routing.");
                } else {
                  let isAdminAccount = false;
                  let verifiedAdminData = null;
                  try {
                    const adminDoc = await db.collection('ek_admin_accounts').doc(user.uid).get();
                    if (adminDoc.exists) {
                      const adData = adminDoc.data();
                      if (adData && (adData.role === 'admin' || adData.role === 'superadmin') && adData.active !== false) {
                        isAdminAccount = true;
                        verifiedAdminData = adData;
                      }
                    } else if (user.email) {
                      const emailQ = await db.collection('ek_admin_accounts').where('email', '==', user.email).limit(1).get().catch(() => null);
                      if (emailQ && !emailQ.empty) {
                        const adData = emailQ.docs[0].data();
                        if (adData && (adData.role === 'admin' || adData.role === 'superadmin') && adData.active !== false) {
                          isAdminAccount = true;
                          verifiedAdminData = adData;
                        }
                      }
                    }
                  } catch (e) {
                    console.warn("[Auth State Changed] Error checking ek_admin_accounts for orphaned auth:", e);
                  }

                  let isDeliveryAccount = false;
                  let verifiedDeliveryData = null;
                  try {
                    const delivDoc = await db.collection('ek_delivery_persons').doc(user.uid).get();
                    if (delivDoc.exists) {
                      const dData = delivDoc.data();
                      if (dData && dData.active !== false && dData.isActive !== false && dData.isActiveRider !== false) {
                        isDeliveryAccount = true;
                        verifiedDeliveryData = dData;
                      }
                    } else {
                      const userDoc = await db.collection('users').doc(user.uid).get();
                      if (userDoc.exists) {
                        const uData = userDoc.data();
                        if (uData && (uData.role === 'RIDER' || uData.role === 'rider' || uData.role === 'delivery') && uData.active !== false && uData.isActive !== false) {
                          isDeliveryAccount = true;
                          verifiedDeliveryData = uData;
                        }
                      }
                    }
                  } catch (e) {
                    console.warn("[Auth State Changed] Error checking delivery account collections for orphaned auth:", e);
                  }

                  if (isAdminAccount && verifiedAdminData) {
                    debugLog("[Auth State Changed] Restoring verified Admin session from Firebase Auth...");
                    window._verifiedAdminUids = window._verifiedAdminUids || new Set();
                    window._verifiedAdminUids.add(user.uid);
                    removeData('ek_customer_session');
                    removeData('ek_delivery_session');
                    saveData('ek_admin_session', {
                      loggedIn: true,
                      role: verifiedAdminData.role || 'admin',
                      name: verifiedAdminData.name || 'Admin',
                      phone: verifiedAdminData.phone || (user.email ? user.email.replace('admin_', '').split('@')[0] : 'Admin'),
                      uid: user.uid
                    });
                    if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-login') {
                      showScreen('screen-admin');
                    }
                  } else if (isDeliveryAccount && verifiedDeliveryData) {
                    debugLog("[Auth State Changed] Restoring verified Delivery session from Firebase Auth...");
                    removeData('ek_customer_session');
                    removeData('ek_admin_session');
                    saveData('ek_delivery_session', {
                      loggedIn: true,
                      id: user.uid,
                      name: verifiedDeliveryData.name || 'Delivery Partner',
                      phone: verifiedDeliveryData.phone || user.phoneNumber || ''
                    });
                    if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-login') {
                      showScreen('screen-delivery');
                    }
                  } else {
                    debugLog("[Auth State Changed] Real user logged in but no local customer session found. Restoring customer session...");
                    await loadUserData(user.uid);
                    debugLog("[Auth State Changed] Real user session restored.");
                    if (typeof currentScreen !== 'undefined' && currentScreen === 'screen-login') {
                      showScreen('screen-home');
                    }
                  }
                }
              } else {
                debugLog(" - User is signed out or anonymous (Null).");
                debugLog(` - Local Sessions: Cust=${hasCustSession}, Admin=${hasAdminSession}, Delivery=${hasDeliverySession}`);

                if (checkIsExplicitLogoutInProgress()) {
                  debugLog("[Auth State Changed] Explicit logout in progress. Suppressing automatic clearSessionAndRedirectToLogin.");
                } else if (hasCustSession || hasAdminSession || hasDeliverySession) {
                  debugLog("[Auth State Changed] Active local session detected. Preserving local user session across app restarts.");
                } else {
                  if (!user) {
                    debugLog("[Auth State Changed] Guest detected with no local session. Signing in anonymously to authorize cloud read permissions...");
                    try {
                      const anonRes = await firebase.auth().signInAnonymously();
                      debugLog("[Diagnostic Step 2] firebase.auth().signInAnonymously() SUCCEEDED! Resulting UID:", anonRes?.user?.uid);
                      debugLog("[Auth] Successfully signed in anonymously as guest");
                    } catch (err) {
                      console.error("[Diagnostic Step 2 ERROR] firebase.auth().signInAnonymously() FAILED! Full error:", err, "Code:", err ? err.code : 'N/A', "Message:", err ? err.message : String(err));
                      updateCloudStatus('connected', 'Cloud Database Connected (Guest Mode) ✓');
                      setupCloudRealtimeListeners2();
                      debugLog("[Auth] Anonymous sign-in completed. Splash sequence will handle routing.");
                    }
                  } else {
                    updateCloudStatus('connected', 'Cloud Database Connected (Guest Mode) ✓');
                    setupCloudRealtimeListeners2();
                    debugLog("[Auth] Guest mode verified. Splash sequence will handle routing.");
                  }
                }
              }
            } finally {
              isFirebaseAuthRestoring = false;
            }
          });

          // Handle Firebase Auth token refresh — prevents silent auth failures after 1 hour
          if (typeof firebase.auth().onIdTokenChanged === 'function') {
            firebase.auth().onIdTokenChanged(async user => {
              if (user) {
                try {
                  // Force token refresh to ensure Firestore operations work
                  await user.getIdToken(true);
                  debugLog('[Auth] ID token refreshed successfully.');
                } catch (tokenErr) {
                  console.warn('[Auth] Token refresh failed:', tokenErr);
                }
              }
            });
          }
        } else {
          updateCloudStatus('connected', 'Cloud Database Connected ✓');
          setupCloudRealtimeListeners2();
        }
      } catch (e) {
        console.error("Firebase Firestore init failed: ", e);
        updateCloudStatus('error', 'Init Failed: ' + e.message);
      }

      try {
        fbAnalytics = firebase.analytics();
      } catch (ea) {
        console.warn("Firebase Analytics disabled or skipped in local asset environment: ", ea);
      }
    }

    async function loadUserData(uid) {
      if (!uid) return;
      debugLog("[Auth Autologin] Loading user data for UID:", uid);
      try {
        if (typeof db !== 'undefined' && db) {
          const docSnap = await db.collection('ek_users').doc(uid).get();
          if (docSnap.exists) {
            const userData = docSnap.data();
            debugLog("[Auth Autologin] Loaded user data:", userData);
            const users = getData('ek_users', []);
            const uIdx = users.findIndex(u => u.id === uid || u.phone === userData.phone);
            if (uIdx !== -1) {
              users[uIdx] = userData;
            } else {
              users.push(userData);
            }
            saveData('ek_users', users);

            const existingSession = getActiveSession();
            const uniqueSessionToken = (existingSession && existingSession.userId === userData.id && existingSession.sessionToken)
              ? existingSession.sessionToken
              : 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
            const session = { loggedIn: true, userId: userData.id, name: userData.name, phone: userData.phone, sessionToken: uniqueSessionToken };
            saveData('ek_customer_session', session);
            if (typeof db !== 'undefined' && db && userData.activeSessionToken !== uniqueSessionToken) {
              db.collection('ek_users').doc(userData.id).update({
                activeSessionToken: uniqueSessionToken
              }).catch(err => console.error("Error setting initial activeSessionToken on autologin:", err));
            }
            if (typeof setupCloudRealtimeListeners2 === 'function') setupCloudRealtimeListeners2();
            if (typeof registerRealFcmToken === 'function') registerRealFcmToken();
          } else {
            console.warn("[Auth Autologin] No Firestore doc under UID:", uid, "— trying phone fallback.");
            try {
              const authUser = firebase.auth().currentUser;
              if (authUser && authUser.email && authUser.email.endsWith('@app.com')) {
                const phoneFromEmail = authUser.email.replace('@app.com', '');
                const phoneSnap = await db.collection('ek_users')
                  .where('phone', '==', phoneFromEmail).get();
                if (!phoneSnap.empty) {
                  const userData = normalizeFirestoreData(phoneSnap.docs[0].data());
                  const users = getData('ek_users', []);
                  const uIdx = users.findIndex(u => u.phone === userData.phone);
                  if (uIdx !== -1) { users[uIdx] = userData; } else { users.push(userData); }
                  saveData('ek_users', users);
                  const existingSession = getActiveSession();
                  const uniqueSessionToken = (existingSession && existingSession.userId === userData.id && existingSession.sessionToken)
                    ? existingSession.sessionToken
                    : 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
                  const session = {
                    loggedIn: true,
                    userId: userData.id,
                    name: userData.name,
                    phone: userData.phone,
                    sessionToken: uniqueSessionToken
                  };
                  saveData('ek_customer_session', session);
                  if (typeof db !== 'undefined' && db && userData.activeSessionToken !== uniqueSessionToken) {
                    db.collection('ek_users').doc(userData.id).update({
                      activeSessionToken: uniqueSessionToken
                    }).catch(err => console.error("Error setting initial activeSessionToken on autologin fallback:", err));
                  }
                  if (typeof setupCloudRealtimeListeners2 === 'function') setupCloudRealtimeListeners2();
                  debugLog('[Auth Autologin] Old user found via phone fallback:', userData.name);
                }
              }
            } catch (fbErr) {
              console.warn('[Auth Autologin] Phone fallback failed:', fbErr);
            }
          }
        }
      } catch (err) {
        console.error("[Auth Autologin] Error loading user data:", err);
      }
    }

    async function resolveFirebaseUserSafely() {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        const user = firebase.auth().currentUser;
        if (user && !user.isAnonymous) {
          return user;
        }
      }
      let attempts = 0;
      while (isFirebaseAuthRestoring && attempts < 5) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
        if (typeof firebase !== 'undefined' && firebase.auth) {
          const u = firebase.auth().currentUser;
          if (u && !u.isAnonymous) return u;
        }
      }
      return null;
    }

    async function getAuthenticatedCustomerUser() {
      const localActiveUser = typeof getActiveUser === 'function' ? getActiveUser() : null;
      const authUser = await resolveFirebaseUserSafely();
      
      if (!authUser) {
        if (localActiveUser) {
          return localActiveUser;
        }
        return null;
      }

      const users = getData('ek_users', []);
      let user = users.find(u => u.id === authUser.uid);
      if (!user) {
        try {
          debugLog("[Diagnostic] Cache miss for uid:", authUser.uid, "- fetching from Firestore.");
          const docSnap = await db.collection('ek_users').doc(authUser.uid).get();
          if (docSnap.exists) {
            user = docSnap.data();
            users.push(user);
            saveData('ek_users', users);
          }
        } catch (err) {
          console.error("[Diagnostic] Error fetching user from Firestore:", err);
        }
      }

      if (!user) {
        const session = getActiveSession();
        if (session && session.userId === authUser.uid) {
          user = {
            id: authUser.uid,
            name: session.name || "Customer / வாடிக்கையாளர்",
            phone: session.phone || authUser.phoneNumber || "",
            email: authUser.email || "",
            loyaltyPoints: 10,
            tier: "bronze"
          };
        } else {
          user = {
            id: authUser.uid,
            name: authUser.displayName || "Customer / வாடிக்கையாளர்",
            phone: authUser.phoneNumber || "",
            email: authUser.email || "",
            loyaltyPoints: 10,
            tier: "bronze"
          };
        }
      }

      // Preserve local address & saved addresses if missing in Cloud user record
      if (localActiveUser) {
        if (!user.address && localActiveUser.address) {
          user.address = localActiveUser.address;
          user.latitude = localActiveUser.latitude;
          user.longitude = localActiveUser.longitude;
        }
        if ((!user.savedAddresses || user.savedAddresses.length === 0) && localActiveUser.savedAddresses && localActiveUser.savedAddresses.length > 0) {
          user.savedAddresses = localActiveUser.savedAddresses;
        }
      }

      const currentSession = getData('ek_customer_session', null);
      if (!currentSession || currentSession.userId !== authUser.uid) {
        const newSession = { loggedIn: true, userId: user.id, name: user.name, phone: user.phone };
        saveData('ek_customer_session', newSession);
      }

      return user;
    }

    function navigateToHome() {
      if (typeof showScreen === 'function') {
        showScreen('screen-home');
      }
    }

    function showLoginScreen() {
      const adminSession = typeof getAdminSession === 'function' ? getAdminSession() : null;
      const deliverySession = typeof getData === 'function' ? getData('ek_delivery_session', null) : null;
      const custSession = typeof getActiveSession === 'function' ? getActiveSession() : null;
      if (adminSession && adminSession.loggedIn) {
        if (typeof showScreen === 'function') showScreen('screen-admin');
      } else if (deliverySession && deliverySession.loggedIn) {
        if (typeof showScreen === 'function') showScreen('screen-delivery');
      } else if (custSession && custSession.loggedIn) {
        if (typeof showScreen === 'function') showScreen('screen-home');
      } else {
        if (typeof showScreen === 'function') showScreen('screen-home');
      }
    }

    function normalizeFirestoreData(obj) {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj !== 'object') return obj;

      if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') {
        const ms = obj.seconds * 1000 + Math.round((obj.nanoseconds || 0) / 1000000);
        return new Date(ms).toISOString();
      }

      if (Array.isArray(obj)) {
        return obj.map(normalizeFirestoreData);
      }

      const res = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          res[key] = normalizeFirestoreData(obj[key]);
        }
      }
      return res;
    }

    function cleanFirestoreData(obj, seen = new WeakSet(), depth = 0) {
      if (obj === null || obj === undefined) return null;
      if (depth > 12) return null;
      if (typeof obj === 'number') {
        if (isNaN(obj) || !isFinite(obj)) return null;
        return obj;
      }
      if (typeof obj === 'function' || typeof obj === 'symbol') return null;
      if (typeof obj !== 'object') return obj;
      if (typeof Node !== 'undefined' && obj instanceof Node) return null;
      if (typeof Window !== 'undefined' && obj instanceof Window) return null;
      if (obj.nodeType || obj.window === obj) return null;
      if (seen.has(obj)) return null;
      seen.add(obj);
      if (Array.isArray(obj)) {
        return obj.map(item => cleanFirestoreData(item, seen, depth + 1));
      }
      const res = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const val = obj[key];
          if (val === undefined || typeof val === 'function' || typeof val === 'symbol') {
            res[key] = null;
          } else {
            res[key] = cleanFirestoreData(val, seen, depth + 1);
          }
        }
      }
      return res;
    }

    const _dataCache = new Map();
    const _cacheTimestamps = new Map();
    const CACHE_TTL_MS = 3000; // 3 seconds - fresh-enough while skipping repeated calls
    let _categoriesListCachedValue = null;

    function getDataCached(key, defaultVal = []) {
      const now = Date.now();
      const cachedTime = _cacheTimestamps.get(key);

      if (_dataCache.has(key) && cachedTime && (now - cachedTime) < CACHE_TTL_MS) {
        const cachedVal = _dataCache.get(key);
        if (cachedVal !== null && cachedVal !== undefined) {
          return cachedVal; // Cache hit
        }
      }

      const fresh = getData(key, defaultVal);
      const safeVal = (fresh !== null && fresh !== undefined) ? fresh : defaultVal;
      if (safeVal !== null && safeVal !== undefined) {
        _dataCache.set(key, safeVal);
        _cacheTimestamps.set(key, now);
      }
      return safeVal != null ? safeVal : defaultVal;
    }

    function invalidateDataCache(key) {
      _dataCache.delete(key);
      _cacheTimestamps.delete(key);
      if (!key || key === 'ek_categories') {
        _categoriesListCachedValue = null;
        window._categoriesListCachedValue = null;
      }
      _lastDataSnapshotHash = '';
      window._lastDataSnapshotHash = '';
      _lastProductsHash = '';
      window._lastProductsHash = '';
      _lastSpecialsHash = '';
      window._lastSpecialsHash = '';
      _lastCategoryPillsHash = '';
      window._lastCategoryPillsHash = '';
      _lastBannersHash = '';
      window._lastBannersHash = '';
    }

    function safeParseDate(val) {
      if (!val) return new Date();
      if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
      if (typeof val === 'object') {
        if (typeof val.toDate === 'function') {
          try {
            const d = val.toDate();
            if (d && !isNaN(d.getTime())) return d;
          } catch(e) {}
        }
        if (typeof val.seconds === 'number') {
          return new Date(val.seconds * 1000);
        }
        if (typeof val._seconds === 'number') {
          return new Date(val._seconds * 1000);
        }
      }
      if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date() : d;
      }
      if (typeof val === 'string') {
        let d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        const num = Number(val);
        if (!isNaN(num)) {
          d = new Date(num);
          if (!isNaN(d.getTime())) return d;
        }
      }
      return new Date();
    }

    function safeParseTime(val) {
      return safeParseDate(val).getTime();
    }

    function safeFormatDate(val, options = {}) {
      try {
        return safeParseDate(val).toLocaleDateString([], options);
      } catch (e) {
        return new Date().toLocaleDateString();
      }
    }

    function safeFormatTime(val, options = { hour: '2-digit', minute: '2-digit' }) {
      try {
        return safeParseDate(val).toLocaleTimeString([], options);
      } catch (e) {
        return new Date().toLocaleTimeString();
      }
    }

    function safeFormatDateTime(val, options = {}) {
      try {
        return safeParseDate(val).toLocaleString([], options);
      } catch (e) {
        return new Date().toLocaleString();
      }
    }

    function normalizeTimeStr(ts, defaultVal = "11:00") {
      if (!ts) return defaultVal;
      const parts = String(ts).trim().split(':');
      if (parts.length === 2) {
        return String(parts[0]).padStart(2, '0') + ':' + String(parts[1]).padStart(2, '0');
      }
      return defaultVal;
    }

    function isProductOutOfStock(p) {
      if (!p) return false;
      if (p.forceOutOfStock) return true;
      if (p.stockKg !== undefined && p.stockKg <= 0) return true;

      const start = p.availabilityStart || p.scheduleStart || '';
      const end = p.availabilityEnd || p.scheduleEnd || '';
      const isScheduled = p.isScheduled !== false && Boolean(start && end);

      if (isScheduled) {
        const now = new Date();
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;

        const normStart = normalizeTimeStr(start, "00:00");
        const normEnd = normalizeTimeStr(end, "23:59");

        if (normStart <= normEnd) {
          if (currentTimeStr < normStart || currentTimeStr > normEnd) {
            return true;
          }
        } else {
          if (currentTimeStr < normStart && currentTimeStr > normEnd) {
            return true;
          }
        }
      }
      return false;
    }
    window.isProductOutOfStock = isProductOutOfStock;

    function updateProductAvailability(p) {
      if (!p) return;
      if (p.isOutOfStock && !p.forceOutOfStock && !(p.isScheduled && (p.availabilityStart || p.scheduleStart))) {
        p.isOutOfStock = false;
      }
      const outOfStock = isProductOutOfStock(p);
      p.isOutOfStock = outOfStock;
      p.isAvailable = !outOfStock;
    }
    window.updateProductAvailability = updateProductAvailability;

    function areProductFieldsEqual(p1, p2) {
      if (!p1 || !p2) return false;
      return p1.id === p2.id &&
             Number(p1.pricePerKg || 0) === Number(p2.pricePerKg || 0) &&
             Number(p1.stockKg || 0) === Number(p2.stockKg || 0) &&
             Boolean(p1.isOutOfStock) === Boolean(p2.isOutOfStock) &&
             String(p1.englishName || "").trim() === String(p2.englishName || "").trim() &&
             String(p1.tamilName || "").trim() === String(p2.tamilName || "").trim() &&
             String(p1.category || "").trim().toLowerCase() === String(p2.category || "").trim().toLowerCase() &&
             String(p1.imageUrl || "").trim() === String(p2.imageUrl || "").trim() &&
             String(p1.unit || "").trim().toLowerCase() === String(p2.unit || "").trim().toLowerCase() &&
             String(p1.sellingUnit || "").trim().toLowerCase() === String(p2.sellingUnit || "").trim().toLowerCase() &&
             Boolean(p1.isSpecial) === Boolean(p2.isSpecial) &&
             Boolean(p1.isHidden) === Boolean(p2.isHidden) &&
             Number(p1.revision || 0) === Number(p2.revision || 0) &&
             Number(p1.order !== undefined ? p1.order : (p1.displayOrder !== undefined ? p1.displayOrder : 999)) ===
             Number(p2.order !== undefined ? p2.order : (p2.displayOrder !== undefined ? p2.displayOrder : 999));
    }

        function getProductThumbnailUrl(p) {
      if (!p) return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300';
      let url = (typeof p === 'string' ? p : (p.imageUrl || p.thumbnailUrl || p.thumbUrl)) || '';
      if (!url || url === 'null' || url === 'undefined') return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300';
      if (url.includes('images.unsplash.com')) {
        return url.replace(/w=\d+/, 'w=300');
      }
      return url;
    }
    function getProductFullImageUrl(p) {
      if (!p) return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=850';
      let url = (typeof p === 'string' ? p : (p.imageUrl || p.fullImageUrl || p.largeImageUrl)) || '';
      if (!url || url === 'null' || url === 'undefined') return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=850';
      if (url.includes('images.unsplash.com')) {
        return url.replace(/w=\d+/, 'w=850');
      }
      return url;
    }
function getImageUrlWithCacheBuster(url, updatedAt) {
      if (!url) return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=200';
      if (url.startsWith('data:')) return url;

      let buster = null;
      if (updatedAt) {
        const parsed = new Date(updatedAt).getTime();
        if (!isNaN(parsed)) {
          buster = Math.floor(parsed / 1000);
        }
      }

      if (!buster) {
        // Use a stable fallback — app install timestamp, not Date.now() which changes constantly
        if (typeof clientLastSyncTime !== 'undefined' && clientLastSyncTime) {
          buster = Math.floor(clientLastSyncTime / 10000);
        } else {
          // Use a stable value based on the current day, so it only changes once per day
          const dayKey = new Date().toISOString().slice(0, 10);
          buster = dayKey.split('-').join('');
        }
      }

      if (url.match(/([?&])(t|v)=\d+/)) {
        return url.replace(/([?&])(t|v)=\d+/, '$1$2=' + buster);
      }

      if (url.includes('?')) {
        return url + '&v=' + buster;
      } else {
        return url + '?v=' + buster;
      }
    }

    const _originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      _dataCache.delete(key);
      _cacheTimestamps.delete(key);
      try {
        _originalSetItem.call(localStorage, key, value);
      } catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || (e.message && e.message.toLowerCase().includes('quota')))) {
          console.warn("[Storage Safeguard] LocalStorage quota limit reached. Pruning non-essential cache and large arrays...");
          
          // 1. Evict temporary/non-essential cache keys first
          ['ek_pending_syncs', 'ek_temp_logs', 'ek_search_history', 'ek_notifications'].forEach(k => {
            try { _originalRemoveItem.call(localStorage, k); } catch(_) {}
          });

          // 2. Prune oversized list items (keep only latest 50 orders/events in localStorage)
          ['ek_orders', 'ek_users', 'ek_deleted_order_ids'].forEach(largeKey => {
            try {
              const raw = localStorage.getItem(largeKey);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 50) {
                  _originalSetItem.call(localStorage, largeKey, JSON.stringify(parsed.slice(0, 50)));
                }
              }
            } catch (_) {}
          });

          try {
            _originalSetItem.call(localStorage, key, value);
          } catch(retryErr) {
            console.warn("[Storage Safeguard] Secondary setItem fallback: relying on in-memory and native bridge storage.", retryErr);
          }
        } else {
          try {
            _originalSetItem.call(localStorage, key, value);
          } catch (_) {}
        }
      }
    };

    const _originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function(key) {
      _dataCache.delete(key);
      _cacheTimestamps.delete(key);
      _originalRemoveItem.call(localStorage, key);
    };

    function canOverwriteOrderStatus(existingStatus, incomingStatus) {
      if (!existingStatus) return true;
      const cur = String(existingStatus).toUpperCase();
      const inc = String(incomingStatus).toUpperCase();

      const curTerminal = (cur === 'CANCELLED' || cur === 'DELIVERED' || cur === 'REJECTED' || cur === 'CANCELED');
      const incTerminal = (inc === 'CANCELLED' || inc === 'DELIVERED' || inc === 'REJECTED' || inc === 'CANCELED');

      if (curTerminal && !incTerminal) {
        return false;
      }
      return true;
    }

    function isUserTombstoned(u, deletedUserIds) {
      if (!u || !deletedUserIds || !deletedUserIds.length) return false;
      const uId = String(u.id || '').trim();
      const uPhone = String(u.phone || '').trim();
      const uEmail = String(u.email || '').trim().toLowerCase();
      const cleanPhone = uPhone.replace(/\D/g, '');
      const phone10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : '';
      return deletedUserIds.some(delId => {
        if (!delId) return false;
        const d = String(delId).trim();
        const dLower = d.toLowerCase();
        if (uId && uId === d) return true;
        if (uPhone && uPhone === d) return true;
        if (uEmail && uEmail === dLower) return true;
        if (phone10) {
          const cleanD = d.replace(/\D/g, '');
          const d10 = cleanD.length >= 10 ? cleanD.slice(-10) : '';
          if (d10 && phone10 === d10) return true;
          if (d === `cust_${phone10}` || d === `+91${phone10}` || d === `91${phone10}`) return true;
        }
        return false;
      });
    }
    window.isUserTombstoned = isUserTombstoned;

    function filterDeletedEntities(key, parsed) {
      if (!parsed || !Array.isArray(parsed)) return parsed;

      if (key === 'ek_orders') {
        const deletedIds = typeof getDeletedOrderIds === 'function' ? getDeletedOrderIds() : [];
        parsed = parsed.filter(o => {
          if (!o || !o.id) return false;
          if (o.hiddenByAdmin === true) return false;
          if (deletedIds && deletedIds.length > 0 && deletedIds.includes(o.id)) return false;
          return true;
        });
      } else if (key === 'ek_products') {
        const deletedProductIds = typeof getDeletedProductIds === 'function' ? getDeletedProductIds() : [];
        if (deletedProductIds && deletedProductIds.length > 0) {
          parsed = parsed.filter(p => p && p.id && !deletedProductIds.includes(p.id));
        }
      } else if (key === 'ek_users') {
        const deletedUserIds = typeof getDeletedUserIds === 'function' ? getDeletedUserIds() : [];
        if (deletedUserIds && deletedUserIds.length > 0) {
          parsed = parsed.filter(u => !isUserTombstoned(u, deletedUserIds));
        }
        const uniqueMap = new Map();
        parsed.forEach(u => {
          if (!u) return;
          const uKey = u.phone || u.id;
          if (!uKey) return;
          const existing = uniqueMap.get(uKey);
          if (!existing) {
            uniqueMap.set(uKey, u);
          } else {
            const timeExisting = existing.updatedAt ? new Date(existing.updatedAt).getTime() : (existing.joinedAt ? new Date(existing.joinedAt).getTime() : 0);
            const timeU = u.updatedAt ? new Date(u.updatedAt).getTime() : (u.joinedAt ? new Date(u.joinedAt).getTime() : 0);
            if (timeU > timeExisting) {
              uniqueMap.set(uKey, u);
            }
          }
        });
        parsed = Array.from(uniqueMap.values());
      } else if (key === 'ek_delivery_persons') {
        const deletedRiderIds = typeof getDeletedRiderIds === 'function' ? getDeletedRiderIds() : [];
        if (deletedRiderIds && deletedRiderIds.length > 0) {
          parsed = parsed.filter(r => r && r.id && !deletedRiderIds.includes(r.id));
        }
      } else if (key === 'ek_admin_accounts') {
        const deletedAdminIds = typeof getDeletedAdminIds === 'function' ? getDeletedAdminIds() : [];
        if (deletedAdminIds && deletedAdminIds.length > 0) {
          parsed = parsed.filter(a => a && !deletedAdminIds.includes(a.id) && !deletedAdminIds.includes(a.phone));
        }
      } else if (key === 'ek_coupons') {
        const deletedCouponIds = typeof getDeletedCouponIds === 'function' ? getDeletedCouponIds() : [];
        if (deletedCouponIds && deletedCouponIds.length > 0) {
          parsed = parsed.filter(c => c && c.id && !deletedCouponIds.includes(c.id) && !deletedCouponIds.includes(c.code));
        }
      }

      return parsed;
    }
    window.filterDeletedEntities = filterDeletedEntities;

    function getData(key, defaultVal = []) {
      try {
        const now = Date.now();
        const cachedTime = (typeof _cacheTimestamps !== 'undefined' && _cacheTimestamps) ? _cacheTimestamps.get(key) : null;
        if (typeof _dataCache !== 'undefined' && _dataCache && _dataCache.has(key) && cachedTime && (now - cachedTime) < CACHE_TTL_MS) {
          return _dataCache.get(key);
        }

        let val = null;
        if (typeof AndroidStorage !== 'undefined') {
          val = AndroidStorage.getData(key, "");
        }
        if (!val) {
          val = localStorage.getItem(key);
        }
        let parsed = val ? JSON.parse(val) : defaultVal;
        if (parsed === null || parsed === undefined) {
          parsed = defaultVal;
        }
        parsed = filterDeletedEntities(key, parsed);
        if (typeof _dataCache !== 'undefined' && _dataCache && typeof _cacheTimestamps !== 'undefined' && _cacheTimestamps) {
          _dataCache.set(key, parsed);
          _cacheTimestamps.set(key, now);
        }
        return parsed;
      } catch (e) {
        try {
          const val = localStorage.getItem(key);
          let parsed = val ? JSON.parse(val) : defaultVal;
          if (parsed === null || parsed === undefined) {
            parsed = defaultVal;
          }
          parsed = filterDeletedEntities(key, parsed);
          if (typeof _dataCache !== 'undefined' && _dataCache && typeof _cacheTimestamps !== 'undefined' && _cacheTimestamps) {
            _dataCache.set(key, parsed);
            _cacheTimestamps.set(key, Date.now());
          }
          return parsed;
        } catch (err) {
          return defaultVal;
        }
      }
    }
    window.getData = getData;

    function isUnitWeight(unit) {
      if (!unit) return true;
      const u = String(unit).toLowerCase().trim();
      if (u === 'piece' || u === 'pieces' || u === 'pc' || u === 'pcs' ||
          u === 'packet' || u === 'packets' || u === 'pack' || u === 'pkt' ||
          u === 'bunch' || u === 'bunches' || u === 'dozen' || u === 'dozens' || u === 'doz' ||
          u === 'unit' || u === 'units' || u === 'bottle' || u === 'bottles' || u === 'bot' ||
          u === 'box' || u === 'boxes' || u === 'bundle' || u === 'bundles' ||
          u === 'tray' || u === 'trays' || u === 'can' || u === 'cans' ||
          u === 'tin' || u === 'tins' || u === 'cup' || u === 'cups' ||
          u === 'loaf' || u === 'loaves' || u === 'roll' || u === 'rolls' ||
          u === 'set' || u === 'sets' || u === 'nos' || u === 'no' || u === 'pouch' || u === 'pouches' ||
          u === 'பீஸ்' || u === 'பாக்கெட்' || u === 'பாக்கெட்டுகள்' || u === 'முட்டை' ||
          u === 'டஜன்' || u === 'கட்டு' || u === 'பெட்டி' || u === 'செட்' || u === 'அலகு') {
        return false;
      }
      return true;
    }

    function getUnitDisplay(unit, isTa = false, qty = 1) {
      if (!unit) return isTa ? 'கிலோ' : 'Kg';
      const u = String(unit).toLowerCase().trim();
      if (typeof isTa !== 'boolean') {
        isTa = (isTa === 'ta');
      }

      const mapping = {
        'kg': { sEn: 'Kg', pEn: 'Kg', sTa: 'கிலோ', pTa: 'கிலோ' },
        'kilogram': { sEn: 'Kg', pEn: 'Kg', sTa: 'கிலோ', pTa: 'கிலோ' },
        'g': { sEn: 'g', pEn: 'g', sTa: 'கிராம்', pTa: 'கிராம்' },
        'gram': { sEn: 'g', pEn: 'g', sTa: 'கிராம்', pTa: 'கிராம்' },
        'litre': { sEn: 'Litre', pEn: 'Litres', sTa: 'லிட்டர்', pTa: 'லிட்டர்' },
        'litres': { sEn: 'Litre', pEn: 'Litres', sTa: 'லிட்டர்', pTa: 'லிட்டர்' },
        'ml': { sEn: 'ml', pEn: 'ml', sTa: 'மி.லி', pTa: 'மி.லி' },
        'milli litre': { sEn: 'ml', pEn: 'ml', sTa: 'மி.லி', pTa: 'மி.லி' },
        'milli litres': { sEn: 'ml', pEn: 'ml', sTa: 'மி.லி', pTa: 'மி.லி' },
        'piece': { sEn: 'Piece', pEn: 'Pieces', sTa: 'பீஸ்', pTa: 'பீஸ்' },
        'pieces': { sEn: 'Piece', pEn: 'Pieces', sTa: 'பீஸ்', pTa: 'பீஸ்' },
        'pc': { sEn: 'Piece', pEn: 'Pieces', sTa: 'பீஸ்', pTa: 'பீஸ்' },
        'pcs': { sEn: 'Piece', pEn: 'Pieces', sTa: 'பீஸ்', pTa: 'பீஸ்' },
        'nos': { sEn: 'Piece', pEn: 'Pieces', sTa: 'பீஸ்', pTa: 'பீஸ்' },
        'no': { sEn: 'Piece', pEn: 'Pieces', sTa: 'பீஸ்', pTa: 'பீஸ்' },
        'packet': { sEn: 'Packet', pEn: 'Packets', sTa: 'பாக்கெட்', pTa: 'பாக்கெட்டுகள்' },
        'packets': { sEn: 'Packet', pEn: 'Packets', sTa: 'பாக்கெட்', pTa: 'பாக்கெட்டுகள்' },
        'pack': { sEn: 'Packet', pEn: 'Packets', sTa: 'பாக்கெட்', pTa: 'பாக்கெட்டுகள்' },
        'pkt': { sEn: 'Packet', pEn: 'Packets', sTa: 'பாக்கெட்', pTa: 'பாக்கெட்டுகள்' },
        'bottle': { sEn: 'Bottle', pEn: 'Bottles', sTa: 'பாட்டில்', pTa: 'பாட்டில்கள்' },
        'bot': { sEn: 'Bottle', pEn: 'Bottles', sTa: 'பாட்டில்', pTa: 'பாட்டில்கள்' },
        'box': { sEn: 'Box', pEn: 'Boxes', sTa: 'பெட்டி', pTa: 'பெட்டிகள்' },
        'boxes': { sEn: 'Box', pEn: 'Boxes', sTa: 'பெட்டி', pTa: 'பெட்டிகள்' },
        'bunch': { sEn: 'Bunch', pEn: 'Bunches', sTa: 'கட்டு', pTa: 'கட்டுகள்' },
        'bundle': { sEn: 'Bundle', pEn: 'Bundles', sTa: 'கட்டு', pTa: 'கட்டுகள்' },
        'dozen': { sEn: 'Dozen', pEn: 'Dozens', sTa: 'டஜன்', pTa: 'டஜன்' },
        'doz': { sEn: 'Dozen', pEn: 'Dozens', sTa: 'டஜன்', pTa: 'டஜன்' },
        'tray': { sEn: 'Tray', pEn: 'Trays', sTa: 'தட்டு', pTa: 'தட்டுகள்' },
        'can': { sEn: 'Can', pEn: 'Cans', sTa: 'கேன்', pTa: 'கேன்கள்' },
        'tin': { sEn: 'Tin', pEn: 'Tins', sTa: 'டின்', pTa: 'டின்கள்' },
        'cup': { sEn: 'Cup', pEn: 'Cups', sTa: 'கோப்பை', pTa: 'கோப்பைகள்' },
        'loaf': { sEn: 'Loaf', pEn: 'Loaves', sTa: 'ரொட்டி துண்டு', pTa: 'ரொட்டி துண்டுகள்' },
        'roll': { sEn: 'Roll', pEn: 'Rolls', sTa: 'சுருள்', pTa: 'சுருள்கள்' },
        'set': { sEn: 'Set', pEn: 'Sets', sTa: 'செட்', pTa: 'செட்கள்' },
        'unit': { sEn: 'Unit', pEn: 'Units', sTa: 'அலகு', pTa: 'அலகுகள்' }
      };

      const matched = mapping[u];
      if (matched) {
        if (isTa) {
          return qty === 1 ? matched.sTa : matched.pTa;
        } else {
          return qty === 1 ? matched.sEn : matched.pEn;
        }
      }
      return unit;
    }

    function cleanProductName(name) {
      if (!name) return "";
      return name.replace(/\s*\((packet|bunch|piece|kg|pkt|bundle|pcs|dozen|dozens|litre|liter|l|bottle|box|cup|units)\)/gi, "").trim();
    }

    function getProductPriceText(p, isTa = false) {
      if (!p) return "";
      const price = p.pricePerKg || 0;
      const unit = p.sellingUnit || p.unit || 'kg';
      if (typeof isTa !== 'boolean') {
        isTa = (isTa === 'ta');
      }
      const uDisplay = getUnitDisplay(unit, isTa, 1);
      return `₹${price} / ${uDisplay}`;
    }

    function getProductStockText(p, isTa = false) {
      if (!p) return "0";
      const stock = p.stockKg || 0;
      const unit = p.sellingUnit || p.unit || 'kg';
      if (typeof isTa !== 'boolean') {
        isTa = (isTa === 'ta');
      }
      const uDisplay = getUnitDisplay(unit, isTa, stock);
      return `${stock} ${uDisplay}`;
    }

    function getFormattedItemQty(it, isTa = false) {
      if (!it) return "0";
      const unit = it.sellingUnit || it.unit || 'kg';
      const isWeight = isUnitWeight(unit);
      const qty = it.weightGrams || 0;
      if (typeof isTa !== 'boolean') {
        isTa = (isTa === 'ta');
      }

      if (isWeight) {
        const uLower = unit.toLowerCase();
        if (uLower === 'g' || uLower === 'gram') {
          return qty + (isTa ? ' கிராம்' : ' g');
        } else if (uLower === 'ml' || uLower === 'milli litre' || uLower === 'milli litres') {
          return qty + (isTa ? ' மி.லி' : ' ml');
        } else {
          const isLitre = (uLower === 'litre' || uLower === 'litres');
          const unitSingle = isLitre ? (isTa ? ' லிட்டர்' : ' Litre') : (isTa ? ' கிலோ' : ' Kg');
          const unitSmall = isLitre ? (isTa ? ' மி.லி' : ' ml') : (isTa ? ' கி' : ' g');
          if (qty >= 1000) {
            return (qty / 1000).toFixed(2).replace(/\.00$/, '') + unitSingle;
          } else {
            return qty + unitSmall + ` (${(qty / 1000).toFixed(2)}` + unitSingle + `)`;
          }
        }
      } else {
        const uText = getUnitDisplay(unit, isTa, qty);
        return `${qty} ${uText}`;
      }
    }

    function onProductUnitChanged(val, prefix = 'add-prod') {
      const priceLabel = document.getElementById(`${prefix}-price-label`);
      const stockLabel = document.getElementById(`${prefix}-stock-label`);
      if (!priceLabel || !stockLabel) return;

      const isTa = currentLang === 'ta';
      const unitSingularEn = getUnitDisplay(val, false, 1);
      const unitSingularTa = getUnitDisplay(val, true, 1);
      const unitPluralEn = getUnitDisplay(val, false, 2);
      const unitPluralTa = getUnitDisplay(val, true, 2);

      priceLabel.innerText = isTa
        ? `விலை (1 ${unitSingularTa}) (₹) *`
        : `Price per ${unitSingularEn} (₹) *`;
      stockLabel.innerText = isTa
        ? `இருப்பு அளவு (${unitPluralTa}) *`
        : `Current Stock (${unitPluralEn}) *`;
    }

    window.isUnitWeight = isUnitWeight;
    window.getUnitDisplay = getUnitDisplay;
    window.getFormattedItemQty = getFormattedItemQty;
    window.onProductUnitChanged = onProductUnitChanged;

    function getSettings() {
      const def = typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS : (window.DEFAULT_SETTINGS || {});
      return getDataCached('ek_settings', def);
    }
    window.getSettings = getSettings;

    function getDeletedOrderIds() {
      let list = getData('ek_deleted_order_ids', []);
      if (!list || !Array.isArray(list)) list = [];
      return list;
    }
    function pruneLocalDeletedOrders() {
      const deletedOrderIds = getDeletedOrderIds();
      if (deletedOrderIds.length === 0) return;
      const orders = getData('ek_orders', []);
      const filtered = orders.filter(o => o && !deletedOrderIds.includes(o.id) && o.hiddenByAdmin !== true);
      if (orders.length !== filtered.length) {
        saveData('ek_orders', filtered);
        debugLog(`[Safeguard] Pruned ${orders.length - filtered.length} deleted orders from local cache.`);
      }
    }
    function markOrderAsDeleted(orderId) {
      if (!orderId) return;
      const list = getDeletedOrderIds();
      if (!list.includes(orderId)) {
        list.push(orderId);
        saveData('ek_deleted_order_ids', list);
      }
      pruneLocalDeletedOrders();
      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_order_ids').set({
          ids: firebase.firestore.FieldValue.arrayUnion(orderId),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => null);
      }
    }
    function getCustomerHiddenOrderIds() {
      let val = null;
      if (typeof AndroidStorage !== 'undefined') {
        val = AndroidStorage.getData('ek_customer_hidden_order_ids', "");
      }
      if (!val) {
        val = localStorage.getItem('ek_customer_hidden_order_ids');
      }
      let list = [];
      try {
        list = val ? JSON.parse(val) : [];
      } catch (e) {
        list = [];
      }
      if (!list || !Array.isArray(list)) list = [];
      return list;
    }
    function markOrderAsHiddenByCustomer(orderId) {
      if (typeof selectedTrackOrderId !== "undefined" && selectedTrackOrderId === orderId) {
        selectedTrackOrderId = null;
      }
      const list = getCustomerHiddenOrderIds();
      if (!list.includes(orderId)) {
        list.push(orderId);
        if (typeof AndroidStorage !== 'undefined') {
          AndroidStorage.saveData('ek_customer_hidden_order_ids', JSON.stringify(list));
        } else {
          localStorage.setItem('ek_customer_hidden_order_ids', JSON.stringify(list));
        }
      }
    }
    function getDeletedProductIds() {
      let list = getData('ek_deleted_product_ids', []);
      if (!list || !Array.isArray(list)) list = [];
      if (list.length > 500) {
        list = list.slice(-500);
        saveData('ek_deleted_product_ids', list);
      }
      return list;
    }
    function pruneLocalDeletedProducts() {
      const deletedProdIds = getDeletedProductIds();
      if (deletedProdIds.length === 0) return;
      const products = getData('ek_products', []);
      const filtered = products.filter(p => !deletedProdIds.includes(p.id));
      if (products.length !== filtered.length) {
        saveData('ek_products', filtered);
        debugLog(`[Safeguard] Pruned ${products.length - filtered.length} deleted products from local cache.`);
      }
    }
    function markProductAsDeleted(productId) {
      if (!productId) return;
      let list = getDeletedProductIds();
      if (!list.includes(productId)) {
        list.push(productId);
        if (list.length > 500) {
          list = list.slice(-500);
        }
        saveData('ek_deleted_product_ids', list);
      }
      pruneLocalDeletedProducts();
      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_product_ids').set({
          ids: firebase.firestore.FieldValue.arrayUnion(productId),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => null);
      }
    }
    function unmarkProductAsDeleted(productId) {
      if (!productId) return;
      let list = getDeletedProductIds();
      if (list.includes(productId)) {
        list = list.filter(id => id !== productId);
        saveData('ek_deleted_product_ids', list);
      }
      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_product_ids').set({
          ids: firebase.firestore.FieldValue.arrayRemove(productId),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }
    }
    window.unmarkProductAsDeleted = unmarkProductAsDeleted;
    function getDeletedUserIds() {
      let list = getData('ek_deleted_user_ids', []);
      if (!list || !Array.isArray(list)) list = [];
      return list;
    }
    function pruneLocalDeletedUsers() {
      const deletedUserIds = getDeletedUserIds();
      if (!deletedUserIds || deletedUserIds.length === 0) return;
      const users = getData('ek_users', []);
      const filtered = users.filter(u => !isUserTombstoned(u, deletedUserIds));
      if (users.length !== filtered.length) {
        saveData('ek_users', filtered);
        debugLog(`[Safeguard] Pruned ${users.length - filtered.length} deleted users from local cache.`);
      }
    }
    function markUserAsDeleted(userId) {
      if (!userId) return;
      const list = getDeletedUserIds();
      if (!list.includes(userId)) {
        list.push(userId);
        saveData('ek_deleted_user_ids', list);
      }
      pruneLocalDeletedUsers();
      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_user_ids').set({
          ids: firebase.firestore.FieldValue.arrayUnion(userId),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => null);
      }
    }
    function unmarkUserAsDeleted(userIdOrPhone) {
      if (!userIdOrPhone) return;
      const targetStr = String(userIdOrPhone).trim();
      const targetLower = targetStr.toLowerCase();
      const isEmail = targetStr.includes('@');
      const cleanDigits = !isEmail ? targetStr.replace(/\D/g, '') : '';
      const phone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : '';

      let list = getDeletedUserIds();
      list = list.filter(id => {
        if (!id) return false;
        const sId = String(id).trim();
        const sIdLower = sId.toLowerCase();
        if (sId === targetStr || sIdLower === targetLower) return false;
        if (phone10) {
          const idDigits = sId.replace(/\D/g, '');
          const id10 = idDigits.length >= 10 ? idDigits.slice(-10) : '';
          if (id10 && id10 === phone10) return false;
          if (sId === `cust_${phone10}` || sId === `+91${phone10}` || sId === `91${phone10}`) return false;
        }
        return true;
      });
      saveData('ek_deleted_user_ids', list);

      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_user_ids').set({
          ids: list,
          updatedAt: new Date().toISOString()
        }).catch(() => null);
      }
    }

    function getDeletedRiderIds() {
      let list = getData('ek_deleted_rider_ids', []);
      if (!list || !Array.isArray(list)) list = [];
      if (!list.includes('d1')) list.push('d1');
      if (!list.includes('d2')) list.push('d2');
      return list;
    }
    function pruneLocalDeletedRiders() {
      const deletedRiderIds = getDeletedRiderIds();
      if (deletedRiderIds.length === 0) return;
      const riders = getData('ek_delivery_persons', []);
      const filtered = riders.filter(r => !deletedRiderIds.includes(r.id));
      if (riders.length !== filtered.length) {
        saveData('ek_delivery_persons', filtered);
        debugLog(`[Safeguard] Pruned ${riders.length - filtered.length} deleted riders from local cache.`);
      }
    }
    function markRiderAsDeleted(riderId) {
      if (!riderId) return;
      const list = getDeletedRiderIds();
      if (!list.includes(riderId)) {
        list.push(riderId);
        saveData('ek_deleted_rider_ids', list);
      }
      pruneLocalDeletedRiders();
      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_rider_ids').set({
          ids: firebase.firestore.FieldValue.arrayUnion(riderId),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => null);
      }
    }
    function unmarkRiderAsDeleted(riderId) {
      if (!riderId) return;
      let list = getDeletedRiderIds();
      list = list.filter(id => id !== riderId);
      saveData('ek_deleted_rider_ids', list);
      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_rider_ids').set({
          ids: firebase.firestore.FieldValue.arrayRemove(riderId),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => null);
      }
    }

    function getDeletedAdminIds() {
      return getData('ek_deleted_admin_ids', []);
    }
    function markAdminAsDeleted(adminIdOrPhone) {
      if (!adminIdOrPhone) return;
      const list = getDeletedAdminIds();
      if (!list.includes(adminIdOrPhone)) {
        list.push(adminIdOrPhone);
        saveData('ek_deleted_admin_ids', list);
      }
      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_admin_ids').set({
          ids: firebase.firestore.FieldValue.arrayUnion(adminIdOrPhone),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => null);
      }
    }
    function unmarkAdminAsDeleted(adminIdOrPhone) {
      if (!adminIdOrPhone) return;
      let list = getDeletedAdminIds();
      list = list.filter(id => id !== adminIdOrPhone);
      saveData('ek_deleted_admin_ids', list);
      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_admin_ids').set({
          ids: firebase.firestore.FieldValue.arrayRemove(adminIdOrPhone),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => null);
      }
    }

    function getDeletedCouponIds() {
      let list = [];
      try {
        if (typeof AndroidStorage !== 'undefined') {
          const val = AndroidStorage.getData('ek_deleted_coupon_ids', "");
          if (val) list = JSON.parse(val);
        }
        if (!list || list.length === 0) {
          const val = localStorage.getItem('ek_deleted_coupon_ids');
          if (val) list = JSON.parse(val);
        }
      } catch (e) {}
      return Array.isArray(list) ? list : [];
    }

    function pruneLocalDeletedCoupons() {
      const deletedCouponIds = getDeletedCouponIds();
      if (deletedCouponIds.length === 0) return;
      let rawList = [];
      try {
        if (typeof AndroidStorage !== 'undefined') {
          const val = AndroidStorage.getData('ek_coupons', "");
          if (val) rawList = JSON.parse(val);
        }
        if (!rawList || rawList.length === 0) {
          const val = localStorage.getItem('ek_coupons');
          if (val) rawList = JSON.parse(val);
        }
      } catch (e) {}
      if (!Array.isArray(rawList)) rawList = [];
      const filtered = rawList.filter(c => c && c.id && !deletedCouponIds.includes(c.id) && !deletedCouponIds.includes(c.code));
      if (rawList.length !== filtered.length) {
        saveData('ek_coupons', filtered);
        debugLog(`[Safeguard] Pruned ${rawList.length - filtered.length} deleted coupons from local cache.`);
      }
    }

    function markCouponAsDeleted(couponIdOrCode) {
      if (!couponIdOrCode) return;
      const list = getDeletedCouponIds();
      if (!list.includes(couponIdOrCode)) {
        list.push(couponIdOrCode);
        saveData('ek_deleted_coupon_ids', list);
      }
      pruneLocalDeletedCoupons();
      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_coupon_ids').set({
          ids: firebase.firestore.FieldValue.arrayUnion(couponIdOrCode),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => null);
      }
    }

    function unmarkCouponAsDeleted(couponIdOrCode) {
      if (!couponIdOrCode) return;
      let list = getDeletedCouponIds();
      list = list.filter(id => id !== couponIdOrCode);
      saveData('ek_deleted_coupon_ids', list);
      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_tombstones').doc('ek_deleted_coupon_ids').set({
          ids: firebase.firestore.FieldValue.arrayRemove(couponIdOrCode),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => null);
      }
    }

    window.getDeletedOrderIds = getDeletedOrderIds;
    window.markOrderAsDeleted = markOrderAsDeleted;
    window.getCustomerHiddenOrderIds = getCustomerHiddenOrderIds;
    window.markOrderAsHiddenByCustomer = markOrderAsHiddenByCustomer;
    window.getDeletedProductIds = getDeletedProductIds;
    window.markProductAsDeleted = markProductAsDeleted;
    window.getDeletedUserIds = getDeletedUserIds;
    window.markUserAsDeleted = markUserAsDeleted;
    window.unmarkUserAsDeleted = unmarkUserAsDeleted;
    window.getDeletedRiderIds = getDeletedRiderIds;
    window.markRiderAsDeleted = markRiderAsDeleted;
    window.unmarkRiderAsDeleted = unmarkRiderAsDeleted;
    window.getDeletedAdminIds = getDeletedAdminIds;
    window.markAdminAsDeleted = markAdminAsDeleted;
    window.unmarkAdminAsDeleted = unmarkAdminAsDeleted;
    window.getDeletedCouponIds = getDeletedCouponIds;
    window.pruneLocalDeletedCoupons = pruneLocalDeletedCoupons;
    window.markCouponAsDeleted = markCouponAsDeleted;
    window.unmarkCouponAsDeleted = unmarkCouponAsDeleted;

    function saveData(key, data) {
      try {
        invalidateDataCache(key); // Invalidate cache first so subsequent reads fetch fresh data

        if (Array.isArray(data)) {
          data = filterDeletedEntities(key, data);
        }

        if (key === 'ek_settings' && typeof data === 'object' && data !== null) {
          if (!data.updatedAt) {
            data.updatedAt = "1970-01-01T00:00:00.000Z";
          }
        }

        if (typeof sanitizeDataSecure === 'function') {
          data = sanitizeDataSecure(data);
        }

        let jsonStr;
        try {
          jsonStr = JSON.stringify(data);
        } catch (stringifyErr) {
          console.warn("[Storage] JSON.stringify circular fallback for key:", key, stringifyErr);
          const seen = new WeakSet();
          jsonStr = JSON.stringify(data, (k, val) => {
            if (typeof val === 'object' && val !== null) {
              if (seen.has(val)) return undefined;
              seen.add(val);
            }
            return val;
          });
        }
        if (typeof _dataCache !== 'undefined' && _dataCache && typeof _cacheTimestamps !== 'undefined' && _cacheTimestamps) {
          _dataCache.set(key, data);
          _cacheTimestamps.set(key, Date.now());
        }
        if (typeof AndroidStorage !== 'undefined') {
          AndroidStorage.saveData(key, jsonStr);
        }
        localStorage.setItem(key, jsonStr);

        if (key === 'ek_settings' && typeof db !== 'undefined' && db && data && data._isAdminModified === true) {
          const adminSession = typeof getAdminSession === 'function' ? getAdminSession() : null;
          const isAdmin = !!(adminSession && adminSession.loggedIn);
          if (isAdmin) {
            db.collection('ek_settings').doc('global_config').set(cleanFirestoreData(data))
              .then(() => debugLog("[Cloud Sync] Settings auto-synced with Firestore!"))
              .catch(e => console.error("[Cloud Sync] Settings auto-sync failed:", e));
          }
        }

        if (key === 'ek_orders') {
          window.dispatchEvent(new CustomEvent('ek-orders-updated', { detail: data }));
        }

        if (key === 'ek_categories') {
          _categoriesListCachedValue = null;
          _lastCategoryPillsHash = '';
          _lastDataSnapshotHash = '';
        }

        if (['ek_products', 'ek_settings', 'ek_orders', 'ek_users', 'ek_delivery_persons', 'ek_admin_accounts', 'ek_remembered_credentials', 'ek_categories', 'ek_reviews'].includes(key)) {
          const timeStr = Date.now().toString();
          localStorage.setItem('ek_last_update', timeStr);
          if (typeof clientLastSyncTime !== 'undefined') {
            clientLastSyncTime = parseInt(timeStr);
          }
          if (typeof AndroidStorage !== 'undefined') {
            AndroidStorage.saveData('ek_last_update', timeStr);
          }
        }

        if (db) {
          setTimeout(() => {
            try {
              const adminSession = typeof getAdminSession === 'function' ? getAdminSession() : null;
              const isAdmin = !!(adminSession && adminSession.loggedIn);
              const customerSession = typeof getData === 'function' ? getData('ek_customer_session') : null;
              const deliverySession = typeof getData === 'function' ? getData('ek_delivery_session') : null;

              if (['ek_deleted_product_ids', 'ek_deleted_order_ids', 'ek_deleted_user_ids', 'ek_deleted_rider_ids'].includes(key)) {
                if (isAdmin && Array.isArray(data) && data.length > 0) {
                  db.collection('ek_tombstones').doc(key).set({
                    ids: firebase.firestore.FieldValue.arrayUnion(...data),
                    updatedAt: new Date().toISOString()
                  }, { merge: true })
                  .then(() => debugLog(`[Tombstone Sync] Sync successful for ${key}`))
                  .catch(err => debugLog(`[Tombstone Sync] Sync fail for ${key}:`, err));
                }
              } else if (['ek_users', 'ek_orders', 'ek_products', 'ek_delivery_persons', 'ek_admin_accounts', 'ek_categories', 'ek_reviews'].includes(key) && Array.isArray(data)) {
                // Restricted collections: only Admin is allowed to write ek_categories, ek_products, ek_admin_accounts
                if (['ek_categories', 'ek_products', 'ek_admin_accounts'].includes(key) && !isAdmin) {
                  return;
                }
                if (key === 'ek_delivery_persons' && !isAdmin && !(deliverySession && deliverySession.loggedIn)) {
                  return;
                }

                const now = Date.now();
                const deletedOrderIds = getDeletedOrderIds();
                const deletedProductIds = typeof getDeletedProductIds === 'function' ? getDeletedProductIds() : [];
                const deletedUserIds = typeof getDeletedUserIds === 'function' ? getDeletedUserIds() : [];
                const deletedRiderIds = typeof getDeletedRiderIds === 'function' ? getDeletedRiderIds() : [];

                data.forEach(item => {
                  const itemId = item.id || item.phone;
                  if (!itemId) return;

                  if (key === 'ek_orders' && deletedOrderIds.includes(itemId)) {
                    const matchedOrd = data.find(o => (o.id || o.phone) === itemId);
                    const status = matchedOrd ? (matchedOrd.status || '').toLowerCase().trim() : '';
                    if (!['completed', 'delivered', 'cancelled', 'archived'].includes(status)) {
                      return;
                    }
                  }
                  if (key === 'ek_products' && deletedProductIds.includes(itemId)) return;
                  if (key === 'ek_users' && deletedUserIds.includes(itemId)) return;
                  if (key === 'ek_delivery_persons' && deletedRiderIds.includes(itemId)) return;

                  // Customer self-update permission check
                  const docId = (key === 'ek_users' || key === 'ek_admin_accounts') ? (item.id || item.phone) : item.id;
                  if (!docId) return;

                  if (key === 'ek_users' && !isAdmin) {
                    const isOwnProfile = customerSession && (customerSession.id === docId || customerSession.phone === docId || (customerSession.id && item.id && customerSession.id === item.id));
                    if (!isOwnProfile) return;
                  }

                  const lastUpdated = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
                  const isRecent = Math.abs(now - lastUpdated) < 15000;

                  if (!item.updatedAt || isRecent) {
                    db.collection(key).doc(docId).set(cleanFirestoreData(item))
                      .catch(err => {
                        debugLog(`Firestore Cloud auto-upload note for ${key} [Doc: ${docId}]:`, err);
                      });
                  }
                });
              } else if (key === 'ek_settings') {
                if (isAdmin && data && data._isAdminModified === true) {
                  const settingsPayload = cleanFirestoreData(data);
                  db.collection('ek_settings').doc('global_config').set(settingsPayload)
                    .catch(err => debugLog("Firestore settings auto-upload fail (global_config):", err));
                  db.collection('ek_settings').doc('global').set(settingsPayload, { merge: true })
                    .catch(err => debugLog("Firestore settings auto-upload fail (global):", err));
                }
              }
            } catch (err) {
              debugLog("Non-blocking background sync fail:", err);
            }
          }, 50);
        }
      } catch (e) {
        console.error("Storage write error", e);
      }
    }
    window.saveData = saveData;

    function removeData(key) {
      try {
        invalidateDataCache(key);
        if (typeof AndroidStorage !== 'undefined') {
          AndroidStorage.removeData(key);
        }
        localStorage.removeItem(key);
      } catch (e) {
        console.error("Storage remove error", e);
      }
    }
    window.removeData = removeData;

    function syncAndroidStorageToLocalStorageWithRetry(attempt = 1) {
      if (typeof AndroidStorage !== 'undefined') {
        debugLog(`[AndroidStorage Sync] Bridge available (attempt ${attempt}). Syncing session keys...`);
        try {
          const keys = [
            'ek_customer_session', 'ek_admin_session', 'ek_delivery_session',
            'ek_customer_remember_me', 'ek_admin_remember_me', 'ek_delivery_remember_me',
            'ek_remembered_credentials', 'ek_remembered_admin_credentials', 'ek_remembered_delivery_credentials',
            'ek_lang'
          ];
          for (const k of keys) {
            let val = null;
            if (typeof AndroidStorage.getData === 'function') {
              try { val = AndroidStorage.getData(k, ""); } catch(e1) {
                try { val = AndroidStorage.getData(k); } catch(e2) {}
              }
            }
            if (val) {
              localStorage.setItem(k, val);
            }
          }
          debugLog("[AndroidStorage Sync] Session keys sync from AndroidStorage succeeded.");
          return true;
        } catch (err) {
          console.error("[AndroidStorage Sync] Error syncing keys from AndroidStorage:", err);
        }
      } else {
        if (attempt <= 5) {
          debugLog(`[AndroidStorage Sync] Bridge not immediately available (attempt ${attempt}/5). Retrying in 100ms...`);
          setTimeout(() => syncAndroidStorageToLocalStorageWithRetry(attempt + 1), 100);
        } else {
          console.warn("[AndroidStorage Sync] Bridge not available after 5 attempts. Proceeding with standard localStorage.");
        }
      }
      return false;
    }

    // Run AndroidStorage bridge sync with retry immediately on script load
    try {
      syncAndroidStorageToLocalStorageWithRetry(1);
    } catch (e) {}

    async function safelyClearUserCacheOnLogout() {
      debugLog("[Logout Cache Clear] Running data-loss guarded cache cleanup...");
      try {
        if (typeof flushPendingSyncs === 'function') {
          await flushPendingSyncs();
        }
      } catch (fe) {
        console.warn("[Logout Cache Clear] Error flushing pending syncs before logout:", fe);
      }

      const pendingSyncs = getData('ek_pending_syncs', []) || [];
      const pendingOrderIds = new Set(
        pendingSyncs
          .filter(item => item && item.collectionName === 'ek_orders' && item.docId)
          .map(item => item.docId)
      );

      const currentOrders = getData('ek_orders', []) || [];
      if (Array.isArray(currentOrders)) {
        const ordersToKeep = currentOrders.filter(order => order && order.id && pendingOrderIds.has(order.id));
        if (ordersToKeep.length === 0) {
          removeData('ek_orders');
        } else {
          saveData('ek_orders', ordersToKeep);
        }
        if (ordersToKeep.length < currentOrders.length) {
          debugLog(`[Logout Cache Clear] Cleared ${currentOrders.length - ordersToKeep.length} synced orders. Kept ${ordersToKeep.length} pending unsynced orders.`);
        }
      } else {
        removeData('ek_orders');
      }

      const pendingCartSyncs = pendingSyncs.filter(item => item && item.collectionName === 'ek_cart');
      if (pendingCartSyncs.length === 0) {
        cart = [];
        removeData('ek_cart');
      } else {
        console.warn("[Logout Cache Clear] Pending cart syncs exist, retaining local cart until sync completes.");
      }

      removeData('ek_users');
      removeData('ek_active_user');
      removeData('ek_customer_favorites');
      removeData('ek_lyo_chat_messages');
      removeData('ek_assigned_deliveries');
      removeData('ek_delivery_orders');
      removeData('ek_admin_orders');
      removeData('ek_admin_stats');
      removeData('ek_pending_upi_order_data');
      removeData('ek_notifications');
      removeData('ek_active_session');
    }

    const renderQuickTestLogins = async () => {
      try {
        const container = document.getElementById('quick-login-container');
        const list = document.getElementById('quick-login-list');
        if (container) container.style.display = 'none';
        return;

        let users = getData('ek_users', []);

        if (users.length === 0 && typeof db !== 'undefined' && db) {
          try {
            const snap = await db.collection('ek_users').limit(15).get();
            if (!snap.empty) {
              snap.forEach(doc => {
                const data = doc.data();
                if (data && data.phone) users.push(data);
              });
              saveData('ek_users', users);
            }
          } catch (err) {
            console.warn("Could not fetch remote users for quick-login preview:", err);
          }
        }

        if (users.length === 0) {
          container.style.display = 'none';
          return;
        }

        container.style.display = 'block';
        list.innerHTML = '';

        const testUsers = users.slice(0, 12);
        testUsers.forEach(u => {
          if (!u.phone || !u.name) return;
          const cleanPh = u.phone.trim();
          const pBadge = document.createElement('div');
          pBadge.style.cssText = `
            background: rgba(245, 158, 11, 0.08);
            border: 1px solid rgba(245, 158, 11, 0.25);
            border-radius: 8px;
            padding: 6px 10px;
            font-size: 11px;
            color: #ffffff;
            cursor: pointer;
            font-weight: 600;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            transition: all 0.2s;
            text-align: center;
            min-width: 85px;
          `;
          pBadge.onmouseover = () => { pBadge.style.background = 'rgba(245, 158, 11, 0.22)'; pBadge.style.borderColor = 'rgba(245, 158, 11, 0.5)'; };
          pBadge.onmouseout = () => { pBadge.style.background = 'rgba(245, 158, 11, 0.08)'; pBadge.style.borderColor = 'rgba(245, 158, 11, 0.25)'; };
          pBadge.onclick = () => {
            const idInput = document.getElementById('login-identifier');
            const passInput = document.getElementById('login-password');
            if (idInput) idInput.value = cleanPh;
            if (passInput) passInput.value = cleanPh; // prefill phone number as password directly for convenience!
            showToast(`Auto-filled: ${u.name} (Phone: ${cleanPh}) ✓`, "success");
            passInput.classList.add('pulse');
            setTimeout(() => { passInput.classList.remove('pulse'); }, 1000);
          };
          pBadge.innerHTML = `
            <span style="color: var(--accent-orange); font-size: 10.5px; font-weight: 700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80px;">${u.name}</span>
            <span style="font-size: 9.5px; color: var(--text-muted); margin-top: 1px;">${cleanPh}</span>
          `;
          list.appendChild(pBadge);
        });
      } catch (e) {
        console.error("renderQuickTestLogins error:", e);
      }
    };

    window.renderSharedCartItemCard = function(opts) {
      opts = opts || {};
      const imgUrl = opts.image || 'images/placeholder.jpg';
      const titleText = (typeof escapeHtml === 'function') ? escapeHtml(opts.title || '') : (opts.title || '');
      const subtitleText = opts.subtitle || '';
      const priceVal = opts.totalPrice !== undefined ? opts.totalPrice : 0;
      const qtyText = (typeof escapeHtml === 'function') ? escapeHtml(opts.qtyDisplay || '1') : (opts.qtyDisplay || '1');
      const animDelayStyle = opts.animationDelay ? `animation-delay: ${opts.animationDelay};` : '';
      const extraClass = opts.extraClass ? ` ${opts.extraClass}` : '';

      return `
        <div class="card cart-item-entrance shared-cart-product-card${extraClass}" style="background: #182028; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.25); ${animDelayStyle}">
          <!-- Row 1: Left Image, Middle Info, Right Price -->
          <div style="display: flex; align-items: flex-start; gap: 10px; width: 100%;">
            <!-- Image (Left) -->
            <img src="${imgUrl}" alt="${titleText}" style="width: 46px; height: 46px; border-radius: 10px; object-fit: cover; background: #222d3a; flex-shrink: 0;" loading="lazy" decoding="async" />

            <!-- Product Info Column (Middle) -->
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start;">
              <!-- Product Name -->
              <div style="color: #ffffff; font-size: 13.5px; font-weight: 700; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;">
                ${titleText}
              </div>

              <!-- Qty/Unit Subtitle -->
              ${subtitleText ? `
                <div style="color: #94a3b8; font-size: 11px; font-weight: 600; line-height: 1.2; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${subtitleText}
                </div>
              ` : ''}

              <!-- Extra Info (e.g. Cut Style, Prep Text, Notes) -->
              ${opts.extraInfoHtml || ''}
            </div>

            <!-- Total Price (Top Right) -->
            <div style="margin-left: auto; text-align: right; flex-shrink: 0; white-space: nowrap; padding-left: 6px;">
              <div style="color: #10b981; font-size: 15px; font-weight: 800; line-height: 1.2;">₹${priceVal}</div>
            </div>
          </div>

          <!-- Row 2: Quantity Controller & Action Buttons -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 8px; margin-top: 2px;">
            <!-- Quantity Controller (- qty +) -->
            <div style="background: #0e1319; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; height: 32px; padding: 0 3px; display: flex; align-items: center; justify-content: space-between; gap: 4px; flex: 1; max-width: 140px; box-sizing: border-box;">
              <button type="button" onclick="${opts.onMinusClick}" style="width: 26px; height: 26px; border-radius: 6px; background: #252e39; border: none; color: #ffffff; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;" title="Decrease Quantity">-</button>
              <span style="color: #ffffff; font-weight: 700; font-size: 11px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px;">${qtyText}</span>
              <button type="button" onclick="${opts.onPlusClick}" style="width: 26px; height: 26px; border-radius: 6px; background: #10b981; border: none; color: #ffffff; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;" title="Increase Quantity">+</button>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              ${opts.extraActionHtml || ''}
              <button type="button" onclick="${opts.onDeleteClick}" style="height: 36px; min-width: 36px; padding: 0 8px; border-radius: 8px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35); color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; touch-action: manipulation; user-select: none; transition: transform 0.1s ease;" onmousedown="this.style.transform='scale(0.92)'" onmouseup="this.style.transform='none'" onmouseleave="this.style.transform='none'" title="Delete">
                <span style="display: inline-flex; align-items: center; justify-content: center; pointer-events: none;">🗑️</span>
              </button>
            </div>
          </div>
        </div>
      `;
    };

    // Trigger initial app version check
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try { if (typeof checkAppVersion === 'function') checkAppVersion(); } catch(e) {}
      });
    } else {
      try { if (typeof checkAppVersion === 'function') checkAppVersion(); } catch(e) {}
    }