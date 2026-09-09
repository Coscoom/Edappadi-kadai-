
    function downloadTicketFile() {
      const contentHTML = document.getElementById('print-preview-content').innerHTML;
      const contentText = document.getElementById('print-preview-content').innerText;
      let filename = "Edappadi_Kadai_Slip";

      const match = contentText.match(/ORDER ID:\s*([^\n]+)/i) || contentText.match(/NEW KOT:\s*([^\n]+)/i) || contentText.match(/KOT:\s*([^\n]+)/i);
      if (match && match[1]) {
        filename = `EK_Slip_${match[1].trim()}`;
      } else {
        filename = `EK_Slip_${new Date().toISOString().replace(/[:.]/g, '_')}`;
      }

      if (typeof AndroidStorage !== 'undefined' && AndroidStorage.printHtml) {
        printTicketSafely();
        return;
      }

      const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Hind+Madurai:wght@500;700;900&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #f3f4f6;
      font-family: 'Poppins', 'Hind Madurai', sans-serif;
      padding: 20px;
      margin: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .ticket-container {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      padding: 24px;
      width: 100%;
      max-width: 380px;
      color: #000000;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
      box-sizing: border-box;
    }
    .btn-print {
      margin-top: 16px;
      background: #f59e0b;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      padding: 10px 16px;
      font-weight: 600;
      cursor: pointer;
      display: block;
      width: 100%;
      text-align: center;
      text-decoration: none;
      box-shadow: 0 4px 10px rgba(245,158,11,0.25);
    }
    @media print {
      body { background-color: #ffffff; padding: 0; }
      .ticket-container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .btn-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="ticket-container">
    ${contentHTML}
    <button class="btn-print" onclick="window.print()">${currentLang === 'ta' ? '🖨️ அச்சு செய்க (Print)' : '🖨️ Direct Print'}</button>
  </div>
</body>
</html>`;

      const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("Slip saved to Downloads ✓", "success");

      setTimeout(() => {
        printTicketSafely();
      }, 500);
    }

    function shareTicket() {
      const contentText = document.getElementById('print-preview-content').innerText;
      let title = "Edappadi Kadai Slip";

      const match = contentText.match(/ORDER ID:\s*([^\n]+)/i) || contentText.match(/NEW KOT:\s*([^\n]+)/i) || contentText.match(/KOT:\s*([^\n]+)/i);
      if (match && match[1]) {
        title = `Edappadi Kadai Slip ${match[1].trim()}`;
      }

      if (typeof AndroidStorage !== 'undefined' && AndroidStorage.shareText) {
        AndroidStorage.shareText(title, contentText);
        showToast("Opening Sharing dialog ✓", "success");
        return;
      }

      if (navigator.share) {
        navigator.share({
          title: title,
          text: contentText
        }).then(() => {
          showToast("Shared successfully ✓", "success");
        }).catch(err => {
          if (err.name !== 'AbortError') {
            fallbackShare(contentText);
          }
        });
      } else {
        fallbackShare(contentText);
      }
    }

    function fallbackShare(text) {
      copyTicketToClipboard();
      setTimeout(() => {
        openWhatsAppDirect('', text);
      }, 400);
    }

    let currentAdminTab = 'tab-orders';
    let adminStatusFilter = 'all';

    let adminOrdersPageLimit = 25;
    let expandedOrders = {};
    window.expandedOrders = expandedOrders;

    function toggleOrderDetails(orderId) {
      if (!orderId) return;
      if (!window.expandedOrders) window.expandedOrders = {};
      window.expandedOrders[orderId] = !window.expandedOrders[orderId];
      try {
        if (typeof renderAdminOrders === 'function') renderAdminOrders();
      } catch(e) {
        console.error("toggleOrderDetails error:", e);
      }
    }
    window.toggleOrderDetails = toggleOrderDetails;

    function isPendingOrderStatus(status) {
      const norm = (status || "").toLowerCase().trim();
      return ["pending", "confirmed", "preparing", "packing", "processing", "placed", "new", "accepted", "paid", "order_placed", "received", "order_received", "draft", "payment_pending_verification", "pending_verification", "unverified"].includes(norm);
    }

    function isReadyOrderStatus(status) {
      const norm = (status || "").toLowerCase().trim();
      return ["ready", "out_for_delivery", "delivering", "shipped", "dispatch", "dispatched", "picked_up", "on_the_way"].includes(norm);
    }

    function isDeliveredOrderStatus(status) {
      const norm = (status || "").toLowerCase().trim();
      return ["delivered", "completed", "done", "success", "finished"].includes(norm);
    }

    function isCancelledOrderStatus(status) {
      const norm = (status || "").toLowerCase().trim();
      return ["cancelled", "canceled", "rejected", "declined", "failed", "void"].includes(norm);
    }

    function verifyAndApproveUpiPayment(id) {
      showCustomConfirm(
        currentLang === 'ta' ? "கட்டணத்தை உறுதி செய்யவா?" : "Verify & Approve Payment?",
        currentLang === 'ta'
          ? `இந்த ஆர்டரின் யுபிஐ கட்டணம் வங்கிக் கணக்கில் வரவு வைக்கப்பட்டதை உறுதிசெய்து, ஆர்டரை தயார் செய்ய ஒப்புதல் அளிக்க விரும்புகிறீர்களா?`
          : `Confirm that this UPI payment has been credited to your bank account and approve this order for store preparation?`,
        async function() {
          if (typeof db !== 'undefined' && db) {
            showToast("சரிபார்க்கிறது... / Updating payment status...", "info");
            const orderRef = db.collection('ek_orders').doc(id);
            try {
              await db.runTransaction(async (transaction) => {
                const docSnap = await transaction.get(orderRef);
                if (!docSnap.exists) throw new Error("ORDER_NOT_FOUND");
                const cloudOrder = normalizeFirestoreData(docSnap.data());
                cloudOrder.status = "pending";
                cloudOrder.paymentStatus = "PAID";
                cloudOrder.upiStatus = "MANUALLY_VERIFIED";
                cloudOrder.needsPaymentVerification = false;
                cloudOrder.paymentMethod = "UPI Payment (Verified)";
                cloudOrder.updatedAt = new Date().toISOString();
                transaction.set(orderRef, cleanFirestoreData(cloudOrder), { merge: true });
                return cloudOrder;
              });
            } catch (e) {
              console.warn("Firestore transaction error, updating locally:", e);
            }
          }
          const orders = getData('ek_orders', []);
          const idx = orders.findIndex(o => o.id === id);
          if (idx !== -1) {
            orders[idx].status = 'pending';
            orders[idx].paymentStatus = 'PAID';
            orders[idx].upiStatus = 'MANUALLY_VERIFIED';
            orders[idx].needsPaymentVerification = false;
            orders[idx].paymentMethod = 'UPI Payment (Verified)';
            orders[idx].updatedAt = new Date().toISOString();
            saveData('ek_orders', orders);

            try {
              if (typeof sendFcmPushNotification === 'function') {
                sendFcmPushNotification(orders[idx], 'payment_pending_verification', 'pending');
              }
            } catch (fcmErr) {
              console.warn("FCM push notify error on payment approval:", fcmErr);
            }
          }
          showToast(currentLang === 'ta' ? "கட்டணம் வெற்றிகரமாக உறுதி செய்யப்பட்டது! ✓" : "Payment verified & approved successfully! ✓", "success");
          if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
        }
      );
    }

    function renderAdminDashboard() {
      if (typeof checkAdminSyncHealth === 'function') {
        checkAdminSyncHealth();
      }
      // 1. Single source of truth Firebase Auth check
      if (typeof firebase !== 'undefined' && firebase.auth) {
        const user = firebase.auth().currentUser;
        const adminSession = typeof getAdminSession === 'function' ? getAdminSession() : null;
        const hasAdminSession = !!(adminSession && adminSession.loggedIn);

        if ((!user || user.isAnonymous) && !hasAdminSession) {
          console.warn("[Admin Access Guard] No authenticated admin user found in Firebase Auth.");
          if (typeof showScreen === 'function') showScreen('screen-login');
          return;
        }

        // 2. Re-fetch and verify role from Firestore on screen render (cached with 10-min TTL for high performance)
        const targetAdminUid = (user && user.uid) || (adminSession && (adminSession.id || adminSession.uid));
        const nowVerify = Date.now();
        if (typeof db !== 'undefined' && db && !window._skipAdminFirestoreVerify && targetAdminUid && (!window._lastAdminFirestoreVerifyTime || (nowVerify - window._lastAdminFirestoreVerifyTime > 600000))) {
          window._lastAdminFirestoreVerifyTime = nowVerify;
          db.collection('ek_admin_accounts').doc(targetAdminUid).get().then(docSnap => {
            if (docSnap.exists) {
              const data = docSnap.data();
              if (data && (data.active === false || (data.role !== 'admin' && data.role !== 'superadmin' && data.role !== 'ADMIN' && data.role !== 'SUPERADMIN'))) {
                console.error("[Admin Access Guard] Admin account inactive or role revoked.");
                if (typeof showToast === 'function') showToast("உரிமம் மறுக்கப்பட்டது! / Admin access revoked.", "error");
                if (typeof adminLogout === 'function') adminLogout();
              }
            }
          }).catch(e => {
            console.warn("[Admin Access Guard] Firestore verification error:", e);
          });
        }
      }

      debugLog("✓ UI Refreshed");
      if (typeof setupCloudRealtimeListeners2 === 'function') {
        try { setupCloudRealtimeListeners2(); } catch(e) {}
      }
      if (typeof fetchAdminOrdersLive === 'function' && !window._hasFetchedAdminLiveInitial) {
        window._hasFetchedAdminLiveInitial = true;
        try { fetchAdminOrdersLive(); } catch(e) {}
      }

      let orders = getData('ek_orders', []);
      if (!orders || orders.length === 0) {
        orders = getDataCached('ek_orders', []);
      }

      const deletedOrderIds = getDeletedOrderIds();
      const validOrders = orders.filter(o => o && !deletedOrderIds.includes(o.id) && o.hiddenByAdmin !== true);

      const todayStr = new Date().toDateString();
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const todayOrders = validOrders.filter(o => {
        const dateVal = o.createdAt || o.timestamp || o.orderDate || o.date;
        const d = safeParseDate(dateVal);
        return d.toDateString() === todayStr;
      });

      const pendingCount = validOrders.filter(o => isPendingOrderStatus(o.status)).length;
      const confirmedCount = validOrders.filter(o => {
        const st = String(o.status || '').toLowerCase();
        return st === 'accepted' || st === 'confirmed' || st.includes('confirm') || st.includes('accept');
      }).length;
      const preparingCount = validOrders.filter(o => {
        const st = String(o.status || '').toLowerCase();
        return st.includes('prepar') || st.includes('kitchen') || st === 'ready_for_pickup';
      }).length;
      const outForDeliveryCount = validOrders.filter(o => {
        const st = String(o.status || '').toLowerCase();
        return st.includes('out') || st.includes('dispatch') || st === 'on_the_way';
      }).length;
      const deliveredCount = validOrders.filter(o => isDeliveredOrderStatus(o.status)).length;
      const cancelledCount = validOrders.filter(o => isCancelledOrderStatus(o.status)).length;

      const totalRevenue = validOrders
        .filter(o => !isCancelledOrderStatus(o.status))
        .reduce((sum, o) => sum + Number(o.totalAmount || o.grandTotal || o.total || o.payableAmount || o.finalPayable || 0), 0);

      const todayRevenue = todayOrders
        .filter(o => !isCancelledOrderStatus(o.status))
        .reduce((sum, o) => sum + Number(o.totalAmount || o.grandTotal || o.total || o.payableAmount || o.finalPayable || 0), 0);

      const monthRevenue = validOrders
        .filter(o => {
          if (isCancelledOrderStatus(o.status)) return false;
          const d = safeParseDate(o.createdAt);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, o) => sum + Number(o.totalAmount || o.grandTotal || o.total || o.payableAmount || o.finalPayable || 0), 0);

      const users = typeof getDataCached === 'function' ? getDataCached('ek_users', []) : [];
      const activeCustomersCount = users.filter(u => u && u.role !== 'admin' && u.role !== 'RIDER').length || Math.max(1, new Set(validOrders.map(o => o.phone || o.userId)).size);

      const deliveryPartners = typeof getDataCached === 'function' ? getDataCached('ek_delivery_persons', []) : [];
      const activeDeliveryPartnersCount = deliveryPartners.filter(d => d && d.active !== false).length;

      const restaurants = typeof getDataCached === 'function' ? getDataCached('ek_restaurants', []) : [];
      const activeRestaurantsCount = restaurants.length > 0 ? restaurants.filter(r => r.active !== false).length : 1;

      const setElText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
      };

      setElText('admin-stat-orders', validOrders.length);
      setElText('admin-stat-today-orders', todayOrders.length);
      setElText('admin-stat-pending', pendingCount);
      setElText('admin-stat-confirmed', confirmedCount);
      setElText('admin-stat-preparing', preparingCount);
      setElText('admin-stat-out-for-delivery', outForDeliveryCount);
      setElText('admin-stat-delivered', deliveredCount);
      setElText('admin-stat-cancelled', cancelledCount);

      setElText('admin-stat-revenue', `₹${Math.round(totalRevenue).toLocaleString('en-IN')}`);
      setElText('admin-stat-today-revenue', `₹${Math.round(todayRevenue).toLocaleString('en-IN')}`);
      setElText('admin-stat-month-revenue', `₹${Math.round(monthRevenue).toLocaleString('en-IN')}`);

      setElText('admin-stat-customers', activeCustomersCount);
      setElText('admin-stat-delivery-partners', activeDeliveryPartnersCount);
      setElText('admin-stat-restaurants', activeRestaurantsCount);

      const pendCard = document.getElementById('pending-card-alert');
      if (pendCard) {
        const pendingStatEl = document.getElementById('admin-stat-pending');
        if (pendingCount > 0) {
          pendCard.style.borderColor = "var(--accent-red)";
          if (pendingStatEl) pendingStatEl.style.color = "var(--accent-red)";
        } else {
          pendCard.style.borderColor = "#262626";
          if (pendingStatEl) pendingStatEl.style.color = "#fff";
        }
      }

      if (typeof populateProductCategoryOptions === 'function') {
        try { populateProductCategoryOptions(); } catch(e) {}
      }

      if (currentAdminTab === 'tab-orders') {
        try { renderAdminOrders(); } catch(e) { console.error(e); }
      } else if (currentAdminTab === 'tab-products') {
        try { renderAdminProducts(); } catch(e) { console.error(e); }
      } else if (currentAdminTab === 'tab-delivery') {
        try { renderDeliveryExecutives(); } catch(e) { console.error(e); }
      } else if (currentAdminTab === 'tab-customers') {
        try { renderAdminCustomers(); } catch(e) { console.error(e); }
      } else if (currentAdminTab === 'tab-analytics') {
        try { renderAdminAnalytics(); } catch(e) { console.error(e); }
      } else if (currentAdminTab === 'tab-coupons') {
        try { if (typeof renderAdminCoupons === 'function') renderAdminCoupons(); } catch(e) { console.error(e); }
      } else if (currentAdminTab === 'tab-settings') {
        try { renderAdminAccountsSettings(); } catch(e) { console.error(e); }
        if (typeof renderAdminCategoriesList === 'function') {
          try { renderAdminCategoriesList(); } catch(e) { console.error(e); }
        }
      } else if (currentAdminTab === 'tab-reviews') {
        try { renderAdminReviews(true); } catch(e) { console.error(e); }
      }

      // Only populate settings inputs when settings tab is active or explicitly triggered
      if (currentAdminTab === 'tab-settings' || window._forceRenderAdminSettings) {
        window._forceRenderAdminSettings = false;
        const settings = getDataCached('ek_settings', DEFAULT_SETTINGS);
        const elShopOpen = document.getElementById('setting-shop-open');
        if (elShopOpen) elShopOpen.checked = settings.shopOpen;

        const elLeaveMode = document.getElementById('setting-leave-mode');
        if (elLeaveMode) {
          elLeaveMode.checked = settings.leaveMode || false;
          const groupLeaveNotice = document.getElementById('group-leave-notice');
          if (groupLeaveNotice) {
            groupLeaveNotice.style.display = settings.leaveMode ? 'block' : 'none';
          }
        }
        const elLeaveNotice = document.getElementById('setting-leave-notice');
        if (elLeaveNotice) elLeaveNotice.value = settings.leaveNotice || '';

        const elDelCharge = document.getElementById('setting-delivery-charge');
        if (elDelCharge) elDelCharge.value = settings.deliveryCharge;
        const elDynDel = document.getElementById('setting-dynamic-delivery');
        if (elDynDel) {
          elDynDel.checked = settings.useDynamicDistancePricing !== undefined ? settings.useDynamicDistancePricing : true;
          if (typeof updateDeliveryModeUI === 'function') {
            try { updateDeliveryModeUI(); } catch(e) {}
          }
        }
        const elDelBase = document.getElementById('setting-delivery-base-price');
        if (elDelBase) elDelBase.value = settings.deliveryBasePrice !== undefined ? settings.deliveryBasePrice : 20;
        const elDelKm = document.getElementById('setting-delivery-km-multiplier');
        if (elDelKm) elDelKm.value = settings.deliveryKmMultiplier !== undefined ? settings.deliveryKmMultiplier : 12;

        const elRainMode = document.getElementById('setting-rain-mode');
        if (elRainMode) elRainMode.checked = settings.rainMode || settings.rainSurchargeEnabled || false;

        const elRainCharge = document.getElementById('setting-rain-charge');
        if (elRainCharge) elRainCharge.value = settings.rainCharge !== undefined ? settings.rainCharge : (settings.rainSurchargeFee || 20);

        const elMinWt = document.getElementById('setting-min-weight');
        if (elMinWt) elMinWt.value = settings.minOrderWeight || 50;
        const elMinAmt = document.getElementById('setting-min-amount');
        if (elMinAmt) elMinAmt.value = settings.minOrderAmount !== undefined ? settings.minOrderAmount : 0;

        const elMinAppVer = document.getElementById('setting-min-app-version');
        if (elMinAppVer) elMinAppVer.value = settings.minAppVersion || '8.0.0';
        const elRecAppVer = document.getElementById('setting-recommended-app-version');
        if (elRecAppVer) elRecAppVer.value = settings.recommendedVersion || '8.0.0';
        const elPlayUrl = document.getElementById('setting-playstore-url');
        if (elPlayUrl) elPlayUrl.value = settings.playStoreUrl || 'https://play.google.com/store/apps/details?id=com.edappadikadai.app';
        const elPrivacyUrl = document.getElementById('setting-privacy-policy-url');
        if (elPrivacyUrl) elPrivacyUrl.value = settings.privacyPolicyUrl || '';

        if (typeof renderAdminUpiSettings === 'function') {
          try { renderAdminUpiSettings(); } catch(e) {}
        }

        const elBdTxt = document.getElementById('admin-broadcast-text');
        if (elBdTxt) elBdTxt.value = settings.announcement || '';

        try { if (typeof renderAdminBannerList === "function") renderAdminBannerList(); } catch(e) {}

        if (typeof loadAdminEmailOtpConfig === 'function') {
          try { loadAdminEmailOtpConfig(); } catch(e) {}
        }

        if (typeof renderAdminDeliveryZones === 'function') {
          try { renderAdminDeliveryZones(); } catch(e) {}
        }
      }
    }

    function switchAdminTab(tab, element) {
      try {
        currentAdminTab = tab;

        // Lock parent containers strictly at scrollLeft = 0 to prevent horizontal page shift
        const screenAdmin = document.getElementById('screen-admin');
        if (screenAdmin) screenAdmin.scrollLeft = 0;
        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.scrollLeft = 0;
        document.body.scrollLeft = 0;
        document.documentElement.scrollLeft = 0;

        document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
        if (element) {
          element.classList.add('active');
          try {
            scrollToCenterHorizontal(element);
          } catch (e) {}
        } else {
          const targetTabEl = Array.from(document.querySelectorAll('.admin-tab')).find(el => {
            const onclickAttr = el.getAttribute('onclick') || '';
            return onclickAttr.includes(`'${tab}'`) || onclickAttr.includes(`"${tab}"`);
          });
          if (targetTabEl) {
            targetTabEl.classList.add('active');
            try { scrollToCenterHorizontal(targetTabEl); } catch (e) {}
          }
        }

        document.querySelectorAll('.admin-subtab-container').forEach(c => c.style.display = 'none');

        const containerId = tab.startsWith('admin-tab-') ? tab : `admin-${tab}`;
        const targetContainer = document.getElementById(containerId) || document.getElementById(`admin-tab-${tab.replace('tab-', '')}`);
        if (targetContainer) {
          targetContainer.style.display = 'block';
        }

        if (tab === 'tab-orders') {
          const el = document.getElementById('admin-tab-orders');
          if (el) el.style.display = 'block';
          try { renderAdminOrders(); } catch(err) { console.error("renderAdminOrders error:", err); }
        } else if (tab === 'tab-preorders') {
          const el = document.getElementById('admin-tab-preorders');
          if (el) el.style.display = 'block';
          try { renderAdminPreOrders(); } catch(err) { console.error("renderAdminPreOrders error:", err); }
        } else if (tab === 'tab-products') {
          const el = document.getElementById('admin-tab-products');
          if (el) el.style.display = 'block';
          try { renderAdminProducts(); } catch(err) { console.error("renderAdminProducts error:", err); }
        } else if (tab === 'tab-delivery') {
          const el = document.getElementById('admin-tab-delivery');
          if (el) el.style.display = 'block';
          try { renderDeliveryExecutives(); } catch(err) { console.error("renderDeliveryExecutives error:", err); }
        } else if (tab === 'tab-customers') {
          const el = document.getElementById('admin-tab-customers');
          if (el) el.style.display = 'block';
          try { renderAdminCustomers(); } catch(err) { console.error("renderAdminCustomers error:", err); }
        } else if (tab === 'tab-push' || tab === 'tab-push-notifications') {
          const el = document.getElementById('admin-tab-push');
          if (el) el.style.display = 'block';
          try { if (typeof renderPushNotificationManager === 'function') renderPushNotificationManager(); } catch(err) { console.error("renderPushNotificationManager error:", err); }
        } else if (tab === 'tab-admins') {
          const el = document.getElementById('admin-tab-admins');
          if (el) el.style.display = 'block';
          try { renderAdminAccountsSettings(); } catch(err) { console.error("renderAdminAccountsSettings error:", err); }
        } else if (tab === 'tab-coupons') {
          const el = document.getElementById('admin-tab-coupons');
          if (el) el.style.display = 'block';
          try { renderAdminCoupons(); } catch(err) { console.error("renderAdminCoupons error:", err); }
        } else if (tab === 'tab-analytics') {
          const el = document.getElementById('admin-tab-analytics');
          if (el) el.style.display = 'block';
          try { renderAdminAnalytics(); } catch(err) { console.error("renderAdminAnalytics error:", err); }
        } else if (tab === 'tab-settings') {
          const el = document.getElementById('admin-tab-settings');
          if (el) el.style.display = 'block';
          try { renderAdminAccountsSettings(); } catch(err) { console.error("renderAdminAccountsSettings error:", err); }
          try {
            if (typeof initSectionCollapse === 'function') {
              initSectionCollapse('categories', 'collapsed');
              initSectionCollapse('carousel', 'collapsed');
              initSectionCollapse('upi-config', 'collapsed');
            }
          } catch(e) {}
          try {
            if (typeof renderAdminCategoriesList === 'function') renderAdminCategoriesList(true);
          } catch(err) { console.error("renderAdminCategoriesList error:", err); }
          try {
            if (typeof renderAdminBannerList === 'function') renderAdminBannerList(true);
          } catch(err) { console.error("renderAdminBannerList error:", err); }
          setTimeout(() => {
            try { initAdminZonesMap(); } catch(err) { console.error("initAdminZonesMap error:", err); }
          }, 120);
        } else if (tab === 'tab-lyoai-config') {
          const el = document.getElementById('admin-tab-lyoai-config');
          if (el) el.style.display = 'block';
          try { loadAdminLyoAiConfig(); } catch(err) { console.error("loadAdminLyoAiConfig error:", err); }
        } else if (tab === 'tab-ai-key') {
          const el = document.getElementById('admin-tab-ai-key');
          if (el) el.style.display = 'block';
          try { loadAdminAiKeyConfig(); } catch(err) { console.error("loadAdminAiKeyConfig error:", err); }
        } else if (tab === 'tab-sync-dashboard') {
          const el = document.getElementById('admin-tab-sync-dashboard');
          if (el) el.style.display = 'block';
          try { renderSyncDashboard(); } catch(err) { console.error("renderSyncDashboard error:", err); }
        } else if (tab === 'tab-reviews') {
          const el = document.getElementById('admin-tab-reviews');
          if (el) el.style.display = 'block';
          try { renderAdminReviews(true); } catch(err) { console.error("renderAdminReviews error:", err); }
        }
      } catch (globalTabErr) {
        console.error("switchAdminTab error:", globalTabErr);
      }
    }

    const SYNC_GATE_COLLECTIONS = [
      {
        id: 'products',
        localKey: 'ek_products',
        firestorePath: 'ek_products',
        isDoc: false,
        name: 'Meat & Grocery Products',
        tamilName: 'இறைச்சி மற்றும் சரக்குகள்',
        icon: '🥩',
        refreshFn: function() {
          if (typeof renderHomeScreenProducts === 'function') renderHomeScreenProducts();
          if (typeof renderAdminProducts === 'function') renderAdminProducts();
        }
      },
      {
        id: 'orders',
        localKey: 'ek_orders',
        firestorePath: 'ek_orders',
        isDoc: false,
        name: 'Customer Orders',
        tamilName: 'வாடிக்கையாளர் ஆர்டர்கள்',
        icon: '📦',
        refreshFn: function() {
          if (typeof renderAdminOrders === 'function') renderAdminOrders();
          if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
        }
      },
      {
        id: 'users',
        localKey: 'ek_users',
        firestorePath: 'ek_users',
        isDoc: false,
        name: 'Customer Accounts',
        tamilName: 'வாடிக்கையாளர் கணக்குகள்',
        icon: '👥',
        refreshFn: function() {
          if (typeof renderAdminCustomers === 'function') renderAdminCustomers();
        }
      },
      {
        id: 'categories',
        localKey: 'ek_categories',
        firestorePath: 'ek_categories',
        isDoc: false,
        name: 'Store Categories',
        tamilName: 'பிரிவுகள் மற்றும் வகைகள்',
        icon: '🏷️',
        refreshFn: function() {
          if (typeof renderCategoryPills === 'function') renderCategoryPills();
          if (typeof renderAdminCategoriesList === 'function') renderAdminCategoriesList();
        }
      },
      {
        id: 'delivery_persons',
        localKey: 'ek_delivery_persons',
        firestorePath: 'ek_delivery_persons',
        isDoc: false,
        name: 'Delivery Partners',
        tamilName: 'டெலிவரி பார்ட்னர்கள்',
        icon: '🛵',
        refreshFn: function() {
          if (typeof renderDeliveryExecutives === 'function') renderDeliveryExecutives();
        }
      },
      {
        id: 'delivery_zones',
        localKey: 'ek_delivery_zones',
        firestorePath: 'ek_delivery_zones',
        isDoc: false,
        name: 'Delivery Zones & Geofences',
        tamilName: 'டெலிவரி மண்டலங்கள்',
        icon: '📍',
        refreshFn: function() {
          if (typeof renderAdminZonesTable === 'function') renderAdminZonesTable();
          if (typeof initAdminZonesMap === 'function') initAdminZonesMap();
        }
      },
      {
        id: 'coupons',
        localKey: 'ek_coupons',
        firestorePath: 'ek_coupons',
        isDoc: false,
        name: 'Promo Codes & Coupons',
        tamilName: 'கூப்பன்கள் மற்றும் சலுகைகள்',
        icon: '🎟️',
        refreshFn: function() {
          if (typeof renderAdminCoupons === 'function') renderAdminCoupons();
        }
      },
      {
        id: 'reviews',
        localKey: 'ek_reviews',
        firestorePath: 'ek_reviews',
        isDoc: false,
        name: 'Customer Reviews & Feedback',
        tamilName: 'வாடிக்கையாளர் மதிப்புரைகள்',
        icon: '⭐',
        refreshFn: function() {
          if (typeof renderAdminReviews === 'function') renderAdminReviews(true);
        }
      },
      {
        id: 'settings',
        localKey: 'ek_settings',
        firestorePath: 'ek_settings/global_config',
        isDoc: true,
        name: 'Operations & Shop Config',
        tamilName: 'கடை மற்றும் கட்டண அமைப்புகள்',
        icon: '⚙️',
        refreshFn: function() {
          if (typeof renderAdminAccountsSettings === 'function') renderAdminAccountsSettings();
          if (typeof renderAdminBannerSettings === 'function') renderAdminBannerSettings();
        }
      },
      {
        id: 'lyo_ai_config',
        localKey: 'ek_lyo_ai_config',
        firestorePath: 'ek_settings/lyo_ai_config',
        isDoc: true,
        name: 'Speech & AI Rules',
        tamilName: 'பேச்சு மற்றும் AI விதிகள்',
        icon: '✨',
        refreshFn: function() {
          if (typeof loadAdminLyoAiConfig === 'function') loadAdminLyoAiConfig();
        }
      }
    ];

    let lastSyncTimestamps = {};
    try {
      lastSyncTimestamps = JSON.parse(localStorage.getItem('ek_last_sync_timestamps') || '{}');
    } catch(e) {
      lastSyncTimestamps = {};
    }
    window.lastSyncTimestamps = lastSyncTimestamps;

    function toggleAdvancedManualSyncPanel() {
      const panel = document.getElementById('advanced-manual-sync-panel');
      const label = document.getElementById('advanced-sync-toggle-label');
      if (!panel || !label) return;
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        label.innerText = 'Hide Manual Override Controls / மேனுவல் மறைக்கவும்';
      } else {
        panel.style.display = 'none';
        label.innerText = 'Show Manual Override Controls / மேனுவல் கட்டுப்பாடுகள் காட்டவும்';
      }
    }

    async function triggerIndividualGateSync(gateId) {
      const gate = SYNC_GATE_COLLECTIONS.find(g => g.id === gateId);
      if (!gate) return;

      const btn = document.getElementById(`btn-gate-sync-${gateId}`);
      const btnManual = document.getElementById(`btn-manual-sync-${gateId}`);
      [btn, btnManual].forEach(b => {
        if (b) {
          b.disabled = true;
          b.style.background = 'rgba(255,255,255,0.05)';
          b.style.borderColor = 'rgba(255,255,255,0.1)';
          b.style.color = '#888';
          b.innerHTML = '⚡ Syncing...';
        }
      });

      try {
        if (typeof db === 'undefined' || !db) {
          throw new Error("Local databases only are ready, cloud connection missing!");
        }

        if (gate.isDoc) {
          const parts = gate.firestorePath.split('/');
          const docRef = db.collection(parts[0]).doc(parts[1]);
          const snap = await docRef.get();
          if (snap.exists) {
            const data = normalizeFirestoreData(snap.data()) || {};
            saveData(gate.localKey, data);
            if (typeof invalidateDataCache === 'function') invalidateDataCache(gate.localKey);
          }
        } else {
          const snapshot = await db.collection(gate.firestorePath).get();
          let items = [];

          if (!snapshot.empty) {
            snapshot.forEach(doc => {
              const d = normalizeFirestoreData(doc.data());
              if (d) {
                items.push({ id: doc.id, ...d });
              }
            });
          }

          if (gate.id === 'products') {
            const deletedProductIds = typeof getDeletedProductIds === 'function' ? getDeletedProductIds() : [];
            if (deletedProductIds.length > 0) {
              items = items.filter(p => p && p.id && !deletedProductIds.includes(p.id));
            }
          }

          if (items.length > 0 || snapshot.empty) {
            saveData(gate.localKey, items);
            if (typeof invalidateDataCache === 'function') invalidateDataCache(gate.localKey);
          }
        }

        const nowStr = new Date().toLocaleTimeString();
        lastSyncTimestamps[gateId] = nowStr;
        try {
          localStorage.setItem('ek_last_sync_timestamps', JSON.stringify(lastSyncTimestamps));
        } catch(e) {}

        [btn, btnManual].forEach(b => {
          if (b) {
            b.style.background = 'rgba(16,185,129,0.12)';
            b.style.borderColor = 'rgba(16,185,129,0.4)';
            b.style.color = '#10b981';
            b.innerHTML = '✓ Done';
          }
        });

        setTimeout(() => {
          try {
            if (typeof gate.refreshFn === 'function') gate.refreshFn();
          } catch(e) {
            console.warn("Refresh failed:", e);
          }
          renderSyncDashboard();
          showToast(`✓ Cloud collection synchronized: ${gate.name}`);
        }, 400);

      } catch(err) {
        console.error("Gate sync failed:", err);
        [btn, btnManual].forEach(b => {
          if (b) {
            b.style.background = 'rgba(239,68,68,0.12)';
            b.style.borderColor = 'rgba(239,68,68,0.4)';
            b.style.color = '#ef4444';
            b.innerHTML = '⚠ Failed';
          }
        });
        showToast(`⚠ Sync error: ${err.message || 'Server timeout'}`);
        setTimeout(() => { renderSyncDashboard(); }, 2000);
      }
    }

    async function forceSyncAllCollectionsDashboard() {
      const syncAllBtn = document.getElementById('btn-sync-all-sd');
      if (syncAllBtn) {
        syncAllBtn.disabled = true;
        syncAllBtn.style.opacity = '0.5';
        syncAllBtn.innerText = 'SYNCING ALL...';
      }

      showToast("Starting concurrent synchronization of all cloud collections...");

      await Promise.all(SYNC_GATE_COLLECTIONS.map(gate => triggerIndividualGateSync(gate.id).catch(e => console.warn(`Gate sync error for ${gate.id}:`, e))));

      if (syncAllBtn) {
        syncAllBtn.disabled = false;
        syncAllBtn.style.opacity = '1';
        syncAllBtn.innerText = '⚡ FORCE SYNC ALL';
      }

      showToast("✓ All collections are 100% synchronized and up-to-date with secure cloud.");
    }

    async function testConnectionLatencySyncDash(silent = false) {
      const dot = document.getElementById('sd-status-dot');
      const text = document.getElementById('sd-status-text');
      const latencyText = document.getElementById('sd-latency-text');
      const badge = document.getElementById('sd-latency-badge');

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (dot) { dot.style.backgroundColor = '#ef4444'; }
        if (text) { text.innerText = 'Offline (Device Disconnected)'; }
        if (latencyText) { latencyText.innerText = 'Offline'; }
        if (badge) {
          badge.style.display = 'inline-block';
          badge.style.background = 'rgba(239,68,68,0.15)';
          badge.style.color = '#ef4444';
          badge.innerText = 'Offline';
        }
        if (!silent) showToast('சாதனம் ஆஃப்லைனில் உள்ளது / Device is offline', 'error');
        return;
      }

      if (typeof db === 'undefined' || !db) {
        if (dot) { dot.style.backgroundColor = '#ef4444'; }
        if (text) { text.innerText = 'Database Uninitialized'; }
        if (latencyText) { latencyText.innerText = '-- ms'; }
        if (badge) { badge.style.display = 'none'; }
        return;
      }

      if (dot && !silent) { dot.style.backgroundColor = '#f59e0b'; }
      if (text && !silent) { text.innerText = 'Pinging Cloud Server...'; }

      const start = performance.now();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("CLOUD_PING_TIMEOUT")), 6000);
      });

      try {
        const fetchPromise = (async () => {
          try {
            return await db.collection('ek_settings').doc('global_config').get({ source: 'server' });
          } catch (serverErr) {
            const fallbackSnap = await db.collection('ek_settings').doc('global_config').get();
            if (fallbackSnap && fallbackSnap.metadata && fallbackSnap.metadata.fromCache) {
              throw new Error("CACHED_ONLY");
            }
            return fallbackSnap;
          }
        })();

        const docSnap = await Promise.race([fetchPromise, timeoutPromise]);
        const lat = Math.max(12, Math.round(performance.now() - start));
        const isFromCache = !!(docSnap && docSnap.metadata && docSnap.metadata.fromCache);

        if (isFromCache) {
          if (dot) { dot.style.backgroundColor = '#f59e0b'; }
          if (text) { text.innerText = 'Offline Cache (Server Pending)'; }
          if (latencyText) { latencyText.innerText = `${lat} ms (local)`; }
          if (badge) {
            badge.style.display = 'inline-block';
            badge.style.background = 'rgba(245,158,11,0.15)';
            badge.style.color = '#f59e0b';
            badge.innerText = 'Local Cache';
          }
          if (!silent) showToast("Cloud server unreachable - serving from local cache", "warning");
          return;
        }

        if (dot) { dot.style.backgroundColor = '#10b981'; }
        if (text) { text.innerText = 'Connected (Cloud Real-time)'; }
        if (latencyText) { latencyText.innerText = `${lat} ms`; }

        if (badge) {
          badge.style.display = 'inline-block';
          if (lat < 180) {
            badge.style.background = 'rgba(16,185,129,0.15)';
            badge.style.color = '#10b981';
            badge.innerText = 'Excellent';
          } else if (lat < 400) {
            badge.style.background = 'rgba(16,185,129,0.15)';
            badge.style.color = '#34d399';
            badge.innerText = 'Good';
          } else if (lat < 800) {
            badge.style.background = 'rgba(245,158,11,0.15)';
            badge.style.color = '#f59e0b';
            badge.innerText = 'Fair';
          } else {
            badge.style.background = 'rgba(239,68,68,0.15)';
            badge.style.color = '#ef4444';
            badge.innerText = 'High Latency';
          }
        }

        if (!silent) {
          showToast(`📡 Ping latency verified: ${lat}ms (${badge ? badge.innerText : 'Connected'})`, 'success');
        }
      } catch (err) {
        console.warn("Real Cloud Ping failed:", err);
        if (dot) { dot.style.backgroundColor = '#ef4444'; }
        if (text) {
          text.innerText = err.message === 'CLOUD_PING_TIMEOUT' ? 'Connection Timed Out' : (err.message === 'CACHED_ONLY' ? 'Offline Cache Only' : 'Cloud Unreachable');
        }
        if (latencyText) { latencyText.innerText = '-- ms'; }
        if (badge) {
          badge.style.display = 'inline-block';
          badge.style.background = 'rgba(239,68,68,0.15)';
          badge.style.color = '#ef4444';
          badge.innerText = 'Offline';
        }
        if (!silent) {
          showToast("கிளவுட் இணைப்பு பிழை / Cloud ping failed: " + err.message, "error");
        }
      }
    }

    function renderSyncDashboard() {
      testConnectionLatencySyncDash(true);

      const listContainer = document.getElementById('sd-collections-list');
      if (listContainer) {
        const html = SYNC_GATE_COLLECTIONS.map(gate => {
          const lastSync = lastSyncTimestamps[gate.id] || "⚡ Real-time Stream Active";
          const rawData = typeof getData === 'function' ? getData(gate.localKey, null) : null;
          let countStr = "";
          if (Array.isArray(rawData)) {
            countStr = `${rawData.length} items`;
          } else if (rawData && typeof rawData === 'object') {
            countStr = `Configured`;
          } else {
            countStr = `Ready`;
          }

          return `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                <span style="font-size: 20px; flex-shrink: 0;">${gate.icon}</span>
                <div style="min-width: 0; display: flex; flex-direction: column;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="color: #fff; font-size: 11.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${gate.name}</span>
                    <span style="font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(16,185,129,0.12); color: #10b981; font-weight: 700;">${countStr}</span>
                  </div>
                  <span style="color: #888; font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">${gate.tamilName}</span>
                  <span style="color: #666; font-size: 9.5px; margin-top: 2px;">Status: <span style="color: #10b981; font-weight: 600;">${lastSync}</span></span>
                </div>
              </div>
              <button id="btn-gate-sync-${gate.id}" onclick="triggerIndividualGateSync('${gate.id}')" class="btn" style="width: auto; height: 32px; padding: 0 12px; border-radius: 8px; font-size: 11px; font-weight: 800; border: 1px solid rgba(16,185,129,0.3); background: rgba(16,185,129,0.08); color: #10b981; cursor: pointer; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                🔄 Sync Now
              </button>
            </div>
          `;
        }).join('');

        listContainer.innerHTML = html;
      }

      const manualButtonsContainer = document.getElementById('sd-manual-buttons-container');
      if (manualButtonsContainer) {
        manualButtonsContainer.innerHTML = SYNC_GATE_COLLECTIONS.map(gate => `
          <button id="btn-manual-sync-${gate.id}" onclick="triggerIndividualGateSync('${gate.id}')" class="btn" style="width: 100%; height: 34px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; font-size: 11px; color: #ccc; cursor: pointer;">
            <span>${gate.icon} ${gate.name}</span>
            <span style="color: #10b981; font-weight: 700;">🔄 Pull Cloud</span>
          </button>
        `).join('');
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (currentAdminTab === 'tab-sync-dashboard') {
          testConnectionLatencySyncDash(true);
        }
      });
      window.addEventListener('offline', () => {
        if (currentAdminTab === 'tab-sync-dashboard') {
          testConnectionLatencySyncDash(true);
        }
      });
    }

    function filterAdminOrdersByStatus(status, element) {
      adminStatusFilter = status;
      adminOrdersPageLimit = 25;
      document.querySelectorAll('#admin-tab-orders .filter-pills .pill').forEach(b => b.classList.remove('active'));
      if (element) {
        element.classList.add('active');
      } else {
        const targetPill = Array.from(document.querySelectorAll('#admin-tab-orders .filter-pills .pill')).find(p => {
          const onclickAttr = p.getAttribute('onclick') || '';
          return onclickAttr.includes(`'${status}'`) || onclickAttr.includes(`"${status}"`);
        });
        if (targetPill) targetPill.classList.add('active');
      }
      renderAdminOrders();
    }

    let adminPreOrderStatusFilter = 'all';
    function filterAdminPreOrdersByStatus(status, element) {
      adminPreOrderStatusFilter = status || 'all';
      document.querySelectorAll('#admin-preorder-status-pills .pill').forEach(b => b.classList.remove('active'));
      if (element) {
        element.classList.add('active');
      } else {
        const targetPill = Array.from(document.querySelectorAll('#admin-preorder-status-pills .pill')).find(p => {
          const onclickAttr = p.getAttribute('onclick') || '';
          return onclickAttr.includes(`'${status}'`) || onclickAttr.includes(`"${status}"`);
        });
        if (targetPill) targetPill.classList.add('active');
      }
      renderAdminPreOrders();
    }
    window.filterAdminPreOrdersByStatus = filterAdminPreOrdersByStatus;

    function renderAdminPreOrders(forceRefresh = false) {
      const container = document.getElementById('admin-preorders-list');
      if (!container) return;

      let orders = typeof getDataCached === 'function' ? getDataCached('ek_orders', []) : getData('ek_orders', []);
      if (!orders || orders.length === 0) {
        orders = getData('ek_orders', []);
      }

      const deletedOrderIds = typeof getDeletedOrderIds === 'function' ? getDeletedOrderIds() : [];
      let preOrders = orders.filter(o => {
        if (!o || deletedOrderIds.includes(o.id) || o.hiddenByAdmin === true) return false;
        const st = String(o.status || '').toLowerCase().trim();
        const dType = String(o.deliveryType || o.orderType || '').toLowerCase();
        return o.isPreOrder === true || dType === 'preorder' || dType.includes('schedule') || st.includes('preorder') || st.includes('schedule') || Boolean(o.scheduledDate || o.scheduledSlot);
      }).sort((a, b) => safeParseTime(b.createdAt) - safeParseTime(a.createdAt));

      const searchInput = document.getElementById('admin-preorders-search');
      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

      if (adminPreOrderStatusFilter !== 'all') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (adminPreOrderStatusFilter === 'upcoming') {
          preOrders = preOrders.filter(o => !isDeliveredOrderStatus(o.status) && !isCancelledOrderStatus(o.status));
        } else if (adminPreOrderStatusFilter === 'today') {
          preOrders = preOrders.filter(o => {
            const sDate = String(o.scheduledDate || o.deliveryDate || o.createdAt || '');
            return sDate.includes(todayStr);
          });
        } else if (adminPreOrderStatusFilter === 'confirmed') {
          preOrders = preOrders.filter(o => {
            const st = String(o.status || '').toLowerCase();
            return st === 'accepted' || st === 'confirmed' || st.includes('accept') || st.includes('confirm');
          });
        } else if (adminPreOrderStatusFilter === 'cancelled') {
          preOrders = preOrders.filter(o => isCancelledOrderStatus(o.status));
        }
      }

      if (search) {
        const cleanSearch = search.replace(/\D/g, '');
        preOrders = preOrders.filter(o => {
          const oId = (o.id || '').toLowerCase();
          const oCustName = (o.customerName || '').toLowerCase();
          const oPhone = (o.customerPhone || '').replace(/\D/g, '');
          const phoneMatches = cleanSearch ? oPhone.includes(cleanSearch) : false;
          return oId.includes(search) || oCustName.includes(search) || phoneMatches || (o.customerPhone || '').includes(search);
        });
      }

      if (preOrders.length === 0) {
        container.innerHTML = `
          <div class="card" style="text-align: center; padding: 28px 16px; border-style: dashed; background: rgba(255,255,255,0.01);">
            <span style="font-size: 34px;">⏳</span>
            <h4 style="color: var(--text-primary); margin-top: 8px; font-size: 14px; font-weight: 700;">No Pre-Orders / திட்டமிடப்பட்ட ஆர்டர்கள் இல்லை</h4>
            <p style="color: var(--text-muted); font-size: 12px; max-width: 320px; margin: 4px auto 14px;">Pre-orders are scheduled reservations by customers for festival dates and specific delivery slots.</p>
            <button class="btn btn-secondary" style="width: auto; margin: 0 auto; font-size: 12px; padding: 6px 16px;" onclick="switchAdminTab('tab-orders')">
              📋 View Live Orders / நேரலை ஆர்டர்கள்
            </button>
          </div>
        `;
        return;
      }

      const rawDeliveryPersons = typeof getDataCached === 'function' ? getDataCached('ek_delivery_persons', []) : (getData('ek_delivery_persons', []) || []);
      const deletedRiderIds = typeof getDeletedRiderIds === 'function' ? getDeletedRiderIds() : [];
      const deliveryPersons = rawDeliveryPersons.filter(dp => !deletedRiderIds.includes(dp.id));

      let html = '';
      preOrders.forEach(o => {
        const scheduledText = o.scheduledDate || o.deliveryDate || (o.scheduledSlot ? `Slot: ${o.scheduledSlot}` : 'Scheduled Order');
        const itemRows = (o.items || []).map(i => {
          return `• ${i.tamilName || i.name} (${i.englishName || ''}) - <strong>${getFormattedItemQty(i, currentLang)}</strong>`;
        }).join('<br>');

        const isUnverifiedUpi = o.status === 'payment_pending_verification' || o.paymentStatus === 'PENDING_VERIFICATION' || o.needsPaymentVerification === true;
        const isUpi = !isUnverifiedUpi && o.paymentMethod && (o.paymentMethod.toUpperCase().includes('UPI') || o.paymentMethod.toUpperCase().includes('ONLINE'));
        const paymentBadge = isUnverifiedUpi 
          ? `<span class="badge" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px;">⚠️ UPI UNVERIFIED</span>`
          : isUpi 
          ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #10b981; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px;">📱 UPI PAID</span>`
          : `<span class="badge" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #f59e0b; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px;">💵 CASH ON DELIVERY</span>`;

        const waPreOrderMsg = encodeURIComponent(
`🟧 *EDAPPADI KADAI — PRE-ORDER UPDATE* 🟧
━━━━━━━━━━━━━━━━━━━━━━━━━
👋 Hi *${o.customerName || 'Customer'}*!
Your scheduled pre-order (*${o.id}*) is confirmed for delivery:
📅 *Schedule:* ${scheduledText}
💵 *Amount:* ₹${o.totalAmount || o.price || 0}
📍 *Address:* ${o.deliveryAddress || 'Registered Location'}
━━━━━━━━━━━━━━━━━━━━━━━━━
*Edappadi Kadai* — Fresh. Fast. Local. ✨`
        );

        html += `
          <div class="card" style="border-left: 4px solid #f59e0b; margin-bottom: 12px; padding: 14px; background: var(--bg-card);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div>
                <span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-weight:800; font-size:10px; padding:2px 6px; border-radius:4px; border:1px solid rgba(245,158,11,0.3);">⏳ PRE-ORDER</span>
                <strong style="color:var(--accent-orange); display:inline-block; margin-left:6px; font-size:13px; font-family:'JetBrains Mono', monospace;">${o.id}</strong>
              </div>
              <div>
                <span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; font-weight:700; font-size:10.5px; padding:2px 7px; border-radius:6px;">${String(o.status || 'Scheduled').toUpperCase()}</span>
              </div>
            </div>

            <div style="background:rgba(245,158,11,0.06); padding:8px 10px; border-radius:8px; margin:6px 0 8px; border:1px dashed rgba(245,158,11,0.25); font-size:12px; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
              <span>📅 <strong>Scheduled Delivery:</strong> ${scheduledText}</span>
            </div>

            <div style="font-size:12.5px; color:var(--text-primary); margin-bottom:6px;">
              <strong>👤 ${o.customerName || 'Customer'}</strong> • <a href="tel:${o.customerPhone}" style="color:var(--accent-orange); text-decoration:none; font-weight:700;">📞 ${o.customerPhone || 'N/A'}</a>
            </div>

            <div style="font-size:11.5px; color:var(--text-secondary); margin-bottom:8px;">
              📍 ${o.deliveryAddress || 'No address provided'}
            </div>

            <div style="background:rgba(0,0,0,0.2); padding:8px 10px; border-radius:6px; font-size:12px; margin-bottom:8px; line-height:1.5;">
              ${itemRows}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:13px;">
              <div>${paymentBadge}</div>
              <strong style="color:var(--accent-green); font-size:15px;">₹${o.totalAmount || o.price || 0}</strong>
            </div>

            <div style="display:flex; gap:6px; flex-wrap:wrap; border-top:1px solid rgba(255,255,255,0.06); padding-top:10px;">
              <a class="btn btn-secondary" style="width:auto; flex:1; min-width:80px; font-size:11px; padding:6px 8px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:4px;" href="https://wa.me/91${(o.customerPhone || '').replace(/\D/g,'')}?text=${waPreOrderMsg}" target="_blank">
                <span>💬</span> <span>WhatsApp</span>
              </a>
              <button class="btn btn-primary" style="width:auto; flex:1; min-width:80px; font-size:11px; padding:6px 8px; display:inline-flex; align-items:center; justify-content:center; gap:4px;" onclick="changeOrderStatusDirectly('${o.id}', 'accepted')">
                <span>✅</span> <span>Confirm</span>
              </button>
              <button class="btn btn-secondary" style="width:auto; font-size:11px; padding:6px 8px;" onclick="toggleOrderDetails('${o.id}')">
                <span>🔍 Details</span>
              </button>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    }
    window.renderAdminPreOrders = renderAdminPreOrders;

    let _lastAdminOrderDoc = null;
    let _isFetchingAdminOrderHistory = false;

    async function fetchAdminOrderHistory(pageSize = 50, isLoadMore = false) {
      if (typeof db === 'undefined' || !db) return;
      if (_isFetchingAdminOrderHistory) return;
      _isFetchingAdminOrderHistory = true;

      try {
        let q = db.collection('ek_orders').orderBy('createdAt', 'desc');
        if (isLoadMore && _lastAdminOrderDoc) {
          q = q.startAfter(_lastAdminOrderDoc);
        }
        q = q.limit(pageSize);

        const snap = await q.get();
        if (snap && !snap.empty) {
          _lastAdminOrderDoc = snap.docs[snap.docs.length - 1];
          const cloudOrders = [];
          snap.forEach(doc => {
            const d = doc.data();
            if (d) {
              cloudOrders.push({ ...d, id: doc.id || d.id });
            }
          });

          if (cloudOrders.length > 0) {
            const localOrders = getData('ek_orders', []) || [];
            const mergedMap = new Map();
            localOrders.forEach(o => { if (o && o.id) mergedMap.set(o.id, o); });
            cloudOrders.forEach(o => mergedMap.set(o.id, o));
            const mergedList = Array.from(mergedMap.values());
            saveData('ek_orders', mergedList);
            if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_orders');

            if (typeof renderAdminOrders === 'function') renderAdminOrders();
            if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
          }
        }
      } catch(err) {
        console.warn("[Admin Order History] Fetch failed:", err);
      } finally {
        _isFetchingAdminOrderHistory = false;
      }
    }
    window.fetchAdminOrderHistory = fetchAdminOrderHistory;

    function loadMoreAdminOrders() {
      adminOrdersPageLimit += 25;
      if (typeof fetchAdminOrderHistory === 'function') {
        fetchAdminOrderHistory(50, true);
      }
      renderAdminOrders();
    }

    let isFetchingAdminOrders = false;
    async function fetchAdminOrdersLive(force = false) {
      if (isFetchingAdminOrders && !force) return;
      isFetchingAdminOrders = true;
      debugLog("[Admin Live Sync] Direct fetching orders from Firestore...");
      try {
        if (typeof db !== "undefined" && db) {
          let snap;
          try {
            snap = await db.collection("ek_orders").orderBy("createdAt", "desc").limit(500).get();
          } catch(e) {
            snap = await db.collection("ek_orders").limit(500).get();
          }
          if (snap && !snap.empty) {
            const cloudOrders = [];
            snap.forEach(doc => {
              const d = doc.data();
              if (d) {
                cloudOrders.push({ ...d, id: doc.id || d.id });
              }
            });
            if (cloudOrders.length > 0) {
              const localOrders = getData("ek_orders", []);
              const mergedMap = new Map();
              localOrders.forEach(o => { if (o && o.id) mergedMap.set(o.id, o); });
              cloudOrders.forEach(o => { mergedMap.set(o.id, o); });
              const mergedList = Array.from(mergedMap.values());
              saveData("ek_orders", mergedList);
              debugLog(`[Admin Live Sync] Merged ${cloudOrders.length} orders from cloud into local store. Total: ${mergedList.length}`);
            }
          }
        }
      } catch(err) {
        console.warn("[Admin Live Sync] fetchAdminOrdersLive encountered error:", err);
      } finally {
        isFetchingAdminOrders = false;
        if (typeof currentScreen !== "undefined" && currentScreen === "screen-admin") {
          try { if (typeof renderAdminDashboard === "function") renderAdminDashboard(); } catch(e){}
          try { if (typeof renderAdminOrders === "function") renderAdminOrders(); } catch(e){}
          try { if (typeof renderAdminAnalytics === "function" && currentAdminTab === "tab-analytics") renderAdminAnalytics(); } catch(e){}
        }
      }
    }

    function renderAdminOrders() {
      let orders = getDataCached('ek_orders', []);
      if (!orders || orders.length === 0) {
        orders = getData('ek_orders', []);
      }
      const rawDeliveryPersons = getDataCached('ek_delivery_persons', []);
      const deletedRiderIds = getDeletedRiderIds();
      const deliveryPersons = rawDeliveryPersons.filter(dp => !deletedRiderIds.includes(dp.id));
      const searchInput = document.getElementById('admin-orders-search');
      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const list = document.getElementById('admin-orders-list');
      if (!list) return;

      const deletedOrderIds = getDeletedOrderIds();
      let filtered = orders.filter(o => o && !deletedOrderIds.includes(o.id) && o.hiddenByAdmin !== true).sort((a,b) => safeParseTime(b.createdAt) - safeParseTime(a.createdAt));

      if (adminStatusFilter !== 'all') {
        const lowerFilter = adminStatusFilter.toLowerCase().trim();
        if (lowerFilter === 'pending') {
          filtered = filtered.filter(o => isPendingOrderStatus(o.status));
        } else if (lowerFilter === 'accepted' || lowerFilter === 'confirmed') {
          filtered = filtered.filter(o => {
            const st = String(o.status || '').toLowerCase();
            return st === 'accepted' || st === 'confirmed' || st.includes('accept') || st.includes('confirm');
          });
        } else if (lowerFilter === 'preparing') {
          filtered = filtered.filter(o => {
            const st = String(o.status || '').toLowerCase();
            return st.includes('prepar') || st.includes('kitchen');
          });
        } else if (lowerFilter === 'ready') {
          filtered = filtered.filter(o => isReadyOrderStatus(o.status));
        } else if (lowerFilter === 'out_for_delivery' || lowerFilter === 'outfordelivery' || lowerFilter === 'dispatched' || lowerFilter === 'delivering') {
          filtered = filtered.filter(o => {
            const st = String(o.status || '').toLowerCase();
            return st.includes('out') || st.includes('dispatch') || st.includes('way') || st.includes('delivering');
          });
        } else if (lowerFilter === 'delivered' || lowerFilter === 'completed') {
          filtered = filtered.filter(o => isDeliveredOrderStatus(o.status));
        } else if (lowerFilter === 'cancelled' || lowerFilter === 'canceled' || lowerFilter === 'rejected') {
          filtered = filtered.filter(o => isCancelledOrderStatus(o.status));
        } else if (lowerFilter === 'refunded') {
          filtered = filtered.filter(o => String(o.status || '').toLowerCase().includes('refund'));
        } else if (lowerFilter === 'preorder' || lowerFilter === 'preorders' || lowerFilter === 'scheduled') {
          filtered = filtered.filter(o => {
            const st = String(o.status || '').toLowerCase().trim();
            return st.includes('preorder') || st.includes('pre_order') || st.includes('schedule') || o.isPreOrder === true;
          });
        } else if (lowerFilter === 'history' || lowerFilter === 'order_history' || lowerFilter === 'past_orders') {
          filtered = filtered.filter(o => {
            return isDeliveredOrderStatus(o.status) || isCancelledOrderStatus(o.status) || String(o.status || '').toLowerCase().includes('refund');
          });
        } else {
          filtered = filtered.filter(o => (o.status || '').toLowerCase().trim() === lowerFilter);
        }
      }

      if (search) {
        const cleanSearch = search.replace(/\D/g, '');
        filtered = filtered.filter(o => {
          const oId = (o.id || '').toLowerCase();
          const oCustName = (o.customerName || '').toLowerCase();
          const oPhone = (o.customerPhone || '').replace(/\D/g, '');
          const phoneMatches = cleanSearch ? oPhone.includes(cleanSearch) : false;
          const itemMatch = Array.isArray(o.items) && o.items.some(it => 
            (it.englishName || '').toLowerCase().includes(search) || 
            (it.tamilName || '').includes(search)
          );
          return oId.includes(search) || oCustName.includes(search) || phoneMatches || (o.customerPhone || '').includes(search) || itemMatch;
        });
      }

      if (filtered.length === 0) {
        list._lastRenderedHtml = '';
        list.innerHTML = `<div class="card" style="text-align:center; padding:20px; color:var(--text-muted);">No matching order records registered!</div>`;
        return;
      }

      const totalCount = filtered.length;
      const paginatedOrders = filtered.slice(0, adminOrdersPageLimit);

      let listHtml = '';
      paginatedOrders.forEach(o => {
        const itemRows = (o.items || []).map(i => {
          const prep = getLocalizedPrepareText(i.cutStyle, i.category);
          const prepStr = prep ? ` [${prep}]` : '';
          return `• ${i.tamilName} (${i.englishName}) - <strong>${getFormattedItemQty(i, currentLang)}</strong>${prepStr} ${i.specialNote ? '<i>(Note: '+i.specialNote+')</i>' : ''}`;
        }).join('<br>');

        const oCoords = getOrderCoordinates(o);
        const custLat = oCoords.customer[0];
        const custLng = oCoords.customer[1];

        const sortedExecutives = [...deliveryPersons].map(dp => {
          const dpLat = dp.latitude || 11.5815;
          const dpLng = dp.longitude || 77.8488;
          const distToCust = calculateDistanceKm(dpLat, dpLng, custLat, custLng) || 0;
          return { ...dp, distToCust };
        }).sort((a, b) => a.distToCust - b.distToCust);

        const categoriesList = typeof getUnifiedCategoryList === 'function' ? getUnifiedCategoryList() : getDataCached('ek_categories', []);
        const currentOrderCategory = String(o.orderCategory || o.category || (o.items && o.items[0] && o.items[0].category) || 'meat').toLowerCase();
        
        let categoryOptionsHtml = '';
        const allKnownCats = new Set(['meat', 'chicken', 'mutton', 'fish', 'seafood', 'veg', 'vegetables', 'fruits', 'dairy', 'eggs', 'groceries', 'bakery', 'combo', 'mixed']);
        categoriesList.forEach(c => {
          if (c && c.id) allKnownCats.add(String(c.id).toLowerCase());
        });
        if (currentOrderCategory) allKnownCats.add(currentOrderCategory);

        Array.from(allKnownCats).forEach(catId => {
          const isSel = (currentOrderCategory === catId) ? 'selected' : '';
          const catObj = categoriesList.find(c => String(c.id).toLowerCase() === catId);
          const catName = catObj ? (currentLang === 'ta' && catObj.tamilName ? catObj.tamilName : (catObj.name || catObj.englishName || catId)) : catId.toUpperCase();
          categoryOptionsHtml += `<option value="${catId}" ${isSel}>${catName}</option>`;
        });

        const assignedExec = getOrderAssignedExecutive(o);
        const assignedExecId = assignedExec ? assignedExec.id : '';

        let deliveryOptionsHtml = `<option value="">${currentLang === 'ta' ? '-- நியமிக்கப்படவில்லை --' : '-- Unassigned --'}</option>`;
        sortedExecutives.forEach(dp => {
          const isSel = assignedExecId === dp.id ? 'selected' : '';
          const distanceStatus = dp.latitude ? `⚡ ${dp.distToCust} km from customer` : `🏪 at Shop`;
          deliveryOptionsHtml += `<option value="${dp.id}" ${isSel}>🚀 ${dp.name} (${distanceStatus})</option>`;
        });

        let actions = '';
        const noRiderAssigned = !assignedExecId;

        if (o.status === 'pending') {
          actions += `
            <button class="btn" style="background:linear-gradient(135deg, #10b981, #059669); border:none; color:#fff; font-size:11.5px; font-weight:800; padding:10px; border-radius:10px; cursor:pointer; box-shadow:0 4px 10px rgba(16,185,129,0.2);" onclick="changeOrderStatus('${o.id}', 'ready')">Mark Ready ✓</button>
            <button class="btn" style="background:linear-gradient(135deg, #ef4444, #dc2626); border:none; color:#fff; font-size:11.5px; font-weight:800; padding:10px; border-radius:10px; cursor:pointer; box-shadow:0 4px 10px rgba(239,68,68,0.2);" onclick="cancelOrderPrompt('${o.id}')">Cancel Order 🔴</button>
          `;
          if (noRiderAssigned) {
            actions += `
              <button class="btn" style="background: rgba(245, 158, 11, 0.05); border: 1.5px dashed rgba(245, 158, 11, 0.4); color: #f59e0b; font-size: 11px; font-weight: 800; padding: 10px; border-radius: 10px; cursor: pointer; box-shadow: none;" onclick="markDeliveredAdminManual('${o.id}')">Mark Delivered (Admin Complete) ⚙️</button>
            `;
          }
        } else if (o.status === 'ready') {
          actions += `
            <button class="btn" style="background:linear-gradient(135deg, #10b981, #059669); border:none; color:#fff; font-size:11.5px; font-weight:800; padding:10px; border-radius:10px; cursor:pointer; box-shadow:0 4px 12px rgba(16,185,129,0.25);" onclick="changeOrderStatus('${o.id}', 'delivered')">Mark Delivered ✅</button>
            <button class="btn" style="background:linear-gradient(135deg, #ef4444, #dc2626); border:none; color:#fff; font-size:11.5px; font-weight:800; padding:10px; border-radius:10px; cursor:pointer; box-shadow:0 4px 10px rgba(239,68,68,0.2);" onclick="cancelOrderPrompt('${o.id}')">Cancel Order 🔴</button>
          `;
          if (noRiderAssigned) {
            actions += `
              <button class="btn" style="background: rgba(245, 158, 11, 0.05); border: 1.5px dashed rgba(245, 158, 11, 0.4); color: #f59e0b; font-size: 11px; font-weight: 800; padding: 10px; border-radius: 10px; cursor: pointer; box-shadow: none;" onclick="markDeliveredAdminManual('${o.id}')">Mark Delivered (Admin Complete) ⚙️</button>
            `;
          }
        } else if (o.status === 'delivering') {
          actions += `
            <button class="btn" style="background:linear-gradient(135deg, #10b981, #059669); border:none; color:#fff; font-size:11.5px; font-weight:800; padding:10px; border-radius:10px; cursor:pointer; box-shadow:0 4px 12px rgba(16,185,129,0.25);" onclick="changeOrderStatus('${o.id}', 'delivered')">Mark Delivered ✅</button>
            <button class="btn" style="background:linear-gradient(135deg, #ef4444, #dc2626); border:none; color:#fff; font-size:11.5px; font-weight:800; padding:10px; border-radius:10px; cursor:pointer; box-shadow:0 4px 10px rgba(239,68,68,0.2);" onclick="cancelOrderPrompt('${o.id}')">Cancel Order 🔴</button>
          `;
          if (noRiderAssigned) {
            actions += `
              <button class="btn" style="background: rgba(245, 158, 11, 0.05); border: 1.5px dashed rgba(245, 158, 11, 0.4); color: #f59e0b; font-size: 11px; font-weight: 800; padding: 10px; border-radius: 10px; cursor: pointer; box-shadow: none;" onclick="markDeliveredAdminManual('${o.id}')">Mark Delivered (Admin Complete) ⚙️</button>
            `;
          }
        }

        const lowerStatus = (o.status || '').toLowerCase();
        const badgeClass = lowerStatus === 'pending' ? 'badge-pending' :
                           lowerStatus === 'ready' ? 'badge-ready' :
                           lowerStatus === 'delivering' ? 'badge-ready' :
                           lowerStatus === 'delivered' ? 'badge-delivered' :
                           (lowerStatus === 'cancelled' || lowerStatus === 'canceled') ? 'badge-cancelled' :
                           'badge-rejected';

        const isExpanded = !!expandedOrders[o.id];

        let waCustomerMsg = '';
        let waReadyMsg = '';
        let kotMsg = '';

        if (isExpanded) {
          const riderNameText = o.assignedRiderName ? o.assignedRiderName : (currentLang === 'ta' ? "எங்களது விநியோகக் குழு" : "Our delivery team");
          const subtotalVal = o.subtotalAmount !== undefined ? o.subtotalAmount : (o.subtotal || (o.totalAmount - (o.deliveryFee || o.deliveryCharge || 0)));
          const deliveryFeeVal = o.deliveryFee !== undefined ? o.deliveryFee : (o.deliveryCharge !== undefined ? o.deliveryCharge : 0);

          waCustomerMsg = encodeURIComponent(
`🟥 *EDAPPADI KADAI* 🟥
━━━━━━━━━━━━━━━━━━━━━━━━━
┏━━━━━━━━━━━━━━━━━━━━━┓
┃  *DIGITAL TAX INVOICE*  ┃
┗━━━━━━━━━━━━━━━━━━━━━┛

👤 *To:* ${o.customerName}
📋 *Order ID:* ${o.id}
⏱️ *Delivery Slot:* ${o.deliveryTimeSlot}
📍 *Address:* ${o.deliveryAddress}
${o.orderSource === 'AI_ASSISTANT' ? '🤖 _Order placed via Edappadi Kadai AI Assistant_\n' : ''}
┌─────────────────────────┐
│  *ITEMS ORDERED*        │
└─────────────────────────┘
${o.items.map((it, idx) => {
  const prep = getLocalizedPrepareText(it.cutStyle, it.category);
  const prepStr = prep ? `\n   ✂️ _${prep}_` : '';
  const itemNote = it.specialNote ? `\n   📝 _${it.specialNote}_` : '';
  const itemPriceVal = it.totalPrice || it.itemTotalPrice || ((it.pricePerUnit || it.price || 0) * (it.weightGrams ? (isUnitWeight(it.sellingUnit || it.unit || 'kg') ? it.weightGrams/1000 : it.weightGrams) : 1));
  return `┌─ *${idx + 1}. ${it.tamilName}* ───────┐\n│ 📦 ${it.englishName}\n│ ⚖️ ${getFormattedItemQty(it, currentLang)}${prepStr}${itemNote}\n│ 💰 ₹${itemPriceVal}\n└─────────────────────┘`;
}).join('\n')}

╔═════════════════════════╗
║ 💰 Subtotal:     ₹${subtotalVal}
║ 🚚 Delivery:     ₹${deliveryFeeVal}
╠═════════════════════════╣
║ 💵 *TOTAL: ₹${o.totalAmount}*
╚═════════════════════════╝

🛵 *Your order is on the way!*
━━━━━━━━━━━━━━━━━━━━━━━━━
_Thank you for choosing us! 🙏_
*Edappadi Kadai — Fresh. Fast. Local.* ✨`
          );

          waReadyMsg = encodeURIComponent(
`🟧 *EDAPPADI KADAI* 🟧
━━━━━━━━━━━━━━━━━━━━━━━━━
┏━━━━━━━━━━━━━━━━━━━━━┓
┃  *ORDER READY FOR DELIVERY*  ┃
┗━━━━━━━━━━━━━━━━━━━━━┛

👋 Hi *${o.customerName}*!
Your order is now ready and out for delivery!

📋 *Order ID:* ${o.id}
🚴 *Delivery Rider:* ${riderNameText}
💵 *Amount to Pay:* ₹${o.totalAmount}
📍 *Delivery Address:* ${o.deliveryAddress}

┌─────────────────────────┐
│  📱 Please keep your phone   │
│  switched on. Our rider    │
│  will arrive shortly! 🛵💨  │
└─────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━
*Edappadi Kadai* — Fresh. Fast. Local. ✨`
          );

          kotMsg = encodeURIComponent(
`📦 *பேக்கிங் சீட்டு / PACKING SLIP* 📦
━━━━━━━━━━━━━━━━━━━━━━━
📋 *ஆர்டர் எண்:* ${o.id}
━━━━━━━━━━━━━━━━━━━━━━━

${o.items.map((it, idx) => {
  const prep = getLocalizedPrepareText(it.cutStyle, it.category);
  const prepStr = prep ? `\n   ✂️ *தயாரிப்பு:* ${prep}` : '';
  const itemNote = it.specialNote ? `\n   📝 *குறிப்பு:* ${it.specialNote}` : '';
  return `🔹 ${idx + 1}. *${it.tamilName}* (${it.englishName})
   ⚡ *அளவு:* ${getFormattedItemQty(it, currentLang)}${prepStr}${itemNote}`;
}).join('\n─────\n')}

━━━━━━━━━━━━━━━━━━━━━━━
📦 மொத்த பொருட்கள்: ${o.items.length}
━━━━━━━━━━━━━━━━━━━━━━━`
          );
        }

        const isUnverifiedUpi = o.status === 'payment_pending_verification' || 
                                o.paymentStatus === 'PENDING_VERIFICATION' || 
                                o.needsPaymentVerification === true || 
                                (o.paymentMethod && o.paymentMethod.toLowerCase().includes('unverified')) ||
                                (o.upiStatus === 'PENDING_VERIFICATION');

        const isUpi = !isUnverifiedUpi && o.paymentMethod && (o.paymentMethod.toUpperCase().includes('UPI') || o.paymentMethod.toUpperCase().includes('ONLINE') || (o.upiTxnId && o.upiTxnId !== 'NO_TXN_REF'));

        const paymentBadge = isUnverifiedUpi 
          ? `<span class="badge" style="background: rgba(239, 68, 68, 0.2); border: 1.5px solid #ef4444; color: #f87171; font-weight: 800; font-size: 10px; padding: 2.5px 6.5px; border-radius: 6px; text-transform: uppercase;">⚠️ UPI UNVERIFIED</span>`
          : isUpi 
          ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); border: 1.5px solid rgba(16, 185, 129, 0.4); color: #10b981; font-weight: 800; font-size: 10px; padding: 2.5px 6.5px; border-radius: 6px; text-transform: uppercase;">📱 UPI PAY (PAID)</span>`
          : `<span class="badge" style="background: rgba(245, 158, 11, 0.15); border: 1.5px solid rgba(245, 158, 11, 0.4); color: #f59e0b; font-weight: 800; font-size: 10px; padding: 2.5px 6.5px; border-radius: 6px; text-transform: uppercase;">💵 COD (CASH)</span>`;

        const card = `
          <div class="card" style="border-left: 4px solid var(--accent-orange); margin-bottom: 12px; padding: 14px; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; background: var(--bg-card); contain: layout style paint;" onclick="toggleOrderDetails('${o.id}')">
            <!-- Header Section (Always Visible) -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div>
                <span style="font-size:10px; color:var(--text-secondary); text-transform:uppercase; font-weight:500;">TICKET</span>
                <strong style="color:var(--accent-orange); display:block; font-size:14px; font-family:'JetBrains Mono', monospace;">${o.id}</strong>
              </div>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;" onclick="event.stopPropagation()">
                <span class="badge" style="background: rgba(245, 158, 11, 0.15); border: 1.5px solid rgba(245, 158, 11, 0.4); color: #f59e0b; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 6px; text-transform: uppercase;">🏷️ ${escapeHtml(o.orderCategory || o.category || (o.items && o.items[0] && o.items[0].category) || 'General')}</span>
                <span class="badge" style="background: rgba(59, 130, 246, 0.15); border: 1.5px solid rgba(59, 130, 246, 0.4); color: #60a5fa; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 6px;">⚙️ ${escapeHtml(o.orderStage || o.stage || 'Received')}</span>
                <span class="badge ${badgeClass}">${o.status.toUpperCase()}</span>
                <span style="font-size:16px; color:var(--text-muted); cursor:pointer; font-weight:700; width:24px; text-align:center;" onclick="toggleOrderDetails('${o.id}')">${isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            <!-- Primary Customer Info (Always Visible) -->
            <div style="font-size:13px; margin-bottom:2px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <p style="margin: 0; font-weight:700; color:#ffffff; font-size:13.5px;">👤 ${escapeHtml(o.customerName)}</p>
                <p style="margin: 0; font-size:12px; color:var(--text-secondary);">📞 <a href="tel:${o.customerPhone}" style="color:var(--accent-orange); text-decoration:none; font-weight:600;" onclick="event.stopPropagation()">${o.customerPhone}</a></p>
              </div>
              <div style="text-align:right;">
                ${paymentBadge}
              </div>
            </div>

            ${isUnverifiedUpi ? `
              <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.2)); border: 1.5px solid #ef4444; border-radius: 10px; padding: 10px 12px; margin-top: 8px; margin-bottom: 8px;" onclick="event.stopPropagation()">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                  <div style="flex:1; min-width:180px;">
                    <span style="color:#f87171; font-weight:900; font-size:11.5px; display:block; text-transform:uppercase;">⚠️ UNVERIFIED UPI PAYMENT</span>
                    <span style="color:#ffffff; font-size:11px; line-height:1.35; display:block; margin-top:2px;">
                      No verified transaction ID/reference received from bank/UPI app. Verify bank credit before preparing or dispatching order!
                    </span>
                  </div>
                  <button class="btn" style="background: #10b981; color: #000; font-weight: 900; font-size: 11px; padding: 7px 12px; border-radius: 8px; border: none; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 8px rgba(16,185,129,0.3);" onclick="event.stopPropagation(); verifyAndApproveUpiPayment('${o.id}')">
                    ✓ Verify & Approve Payment
                  </button>
                </div>
              </div>
            ` : ''}

            ${o.needsManualLocationPin ? `
              <div style="margin-top: 8px; margin-bottom: 4px;" onclick="event.stopPropagation()">
                <button class="btn" style="background: rgba(239, 68, 68, 0.15); border: 1.5px solid rgba(239, 68, 68, 0.5); color: #f87171; font-weight: 800; font-size: 11px; padding: 6px 12px; border-radius: 8px; display: flex; align-items: center; gap: 4px; cursor: pointer; width: 100%; justify-content: center; font-family: 'Poppins', sans-serif;" onclick="openManualPinModal('${o.id}')">
                  📍 Location Missing — Tap to Pin Manually
                </button>
              </div>
            ` : ''}

            <!-- Quick Expand/Collapse and price Summary Badge (Visible in Collapsed State) -->
            ${!isExpanded ? `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; border-top:1px dashed #262626; padding-top:8px; font-size:11.5px; color:var(--text-muted);">
                <span>💰 Total : <strong style="color:var(--accent-green);">₹${o.totalAmount}</strong> <span style="font-size:9.5px; color:#999; margin-left:4px; font-weight:bold;">(${isUpi ? 'Paid Online' : 'Pay COD'})</span></span>
                <span style="color: var(--accent-orange); font-weight:600; font-size:10.5px; display:flex; align-items:center; gap:2px;">${currentLang === 'ta' ? 'விவரம் காண்க ⬇️' : 'View Details ⬇️'}</span>
              </div>
            ` : ''}

            <!-- Expanded Info Section (Toggleable Details) -->
            <div id="order-details-${o.id}" style="display: ${isExpanded ? 'block' : 'none'}; margin-top: 12px; border-top: 1px solid #262626; padding-top: 12px;" onclick="event.stopPropagation()">
              <div style="font-size:12px; margin-bottom:8px; line-height:1.45;">
                <p style="color:var(--text-secondary);">📍 <strong>Delivery Address:</strong> ${escapeHtml(o.deliveryAddress)}</p>
                <p style="color:var(--text-secondary); margin-top:4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span>⏱️ Slot: <strong>${o.deliveryTimeSlot}</strong></span> | 
                  <span>💳 Payment:</span> 
                  ${isUpi 
                    ? `<span style="background: rgba(16, 185, 129, 0.15); border: 1.5px solid rgba(16, 185, 129, 0.35); color: #10b981; font-size: 11px; padding: 2px 8px; border-radius: 8px; font-weight: 800; display: inline-flex; align-items: center; gap: 3px;">📱 UPI PAYMENT (PAID / செலுத்தப்பட்டது)</span>` 
                    : `<span style="background: rgba(245, 158, 11, 0.15); border: 1.5px solid rgba(245, 158, 11, 0.35); color: #f59e0b; font-size: 11px; padding: 2px 8px; border-radius: 8px; font-weight: 800; display: inline-flex; align-items: center; gap: 3px;">💵 CASH ON DELIVERY (COD / ரொக்கம்)</span>`
                  }
                </p>
              </div>

              <div class="card" style="background:#0a0a0a; font-size:12px; padding:10px; border-color:#222; margin-bottom:10px; border-radius:8px;">
                <span style="font-size:10px; color:var(--text-muted); font-weight:600; text-transform:uppercase;">BASKET ITEMS</span>
                <p style="margin-top:4px; line-height:1.5; margin-bottom: 0;">${itemRows}</p>
              </div>

              <div style="margin-bottom:10px; border-top: 1px dashed #262626; padding-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <label style="font-size:10px; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block; margin-bottom:4px;">🏷️ ${currentLang === 'ta' ? 'ஆர்டர் வகை (Category)' : 'Order Category'}</label>
                  <select class="form-control" style="background:#111; color:#fff; border:1px solid #333; font-size:12px; padding:6px; border-radius:6px; width:100%; font-weight:bold;" onchange="changeOrderCategory('${o.id}', this.value)" onclick="event.stopPropagation()">
                    ${categoryOptionsHtml}
                  </select>
                </div>
                <div>
                  <label style="font-size:10px; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block; margin-bottom:4px;">⚙️ ${currentLang === 'ta' ? 'ஆர்டர் நிலை (Stage)' : 'Order Stage'}</label>
                  <select class="form-control" style="background:#111; color:#fff; border:1px solid #333; font-size:12px; padding:6px; border-radius:6px; width:100%; font-weight:bold;" onchange="changeOrderStage('${o.id}', this.value)" onclick="event.stopPropagation()">
                    <option value="Received" ${(o.orderStage === 'Received' || o.stage === 'Received' || !o.orderStage) ? 'selected' : ''}>📥 Received / பெறப்பட்டது</option>
                    <option value="Processing & Cut" ${(o.orderStage === 'Processing & Cut' || o.stage === 'Processing & Cut') ? 'selected' : ''}>✂️ Processing / வெட்டப்படுகிறது</option>
                    <option value="Quality Checked" ${(o.orderStage === 'Quality Checked' || o.stage === 'Quality Checked') ? 'selected' : ''}>🔍 Quality Checked / சரிபார்க்கப்பட்டது</option>
                    <option value="Packed & Ready" ${(o.orderStage === 'Packed & Ready' || o.stage === 'Packed & Ready') ? 'selected' : ''}>📦 Packed & Ready / பேக் செய்யப்பட்டது</option>
                    <option value="Out for Delivery" ${(o.orderStage === 'Out for Delivery' || o.stage === 'Out for Delivery') ? 'selected' : ''}>🏍️ Out for Delivery / புறப்பட்டது</option>
                    <option value="Delivered" ${(o.orderStage === 'Delivered' || o.stage === 'Delivered') ? 'selected' : ''}>✅ Delivered / வழங்கப்பட்டது</option>
                  </select>
                </div>
              </div>

              <!-- Order Instructions & Notes from Admin -->
              <div style="background: rgba(255,255,255,0.03); border: 1px dashed #333; padding: 8px 10px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;" onclick="event.stopPropagation()">
                <div style="font-size: 11.5px; line-height: 1.4; flex: 1; padding-right: 8px;">
                  <span style="color: var(--text-muted); font-weight: 700; font-size: 10px; text-transform: uppercase;">📝 ${currentLang === 'ta' ? 'ஆர்டர் குறிப்புகள் (Instructions):' : 'Order Instructions / Notes:'}</span>
                  <p style="margin: 2px 0 0 0; color: #fff; font-style: ${(o.orderInstructions || o.specialInstructions || o.adminNotes) ? 'normal' : 'italic'};">
                    ${escapeHtml(o.orderInstructions || o.specialInstructions || o.adminNotes || (currentLang === 'ta' ? 'குறிப்புகள் எதுவும் இல்லை' : 'No custom instructions'))}
                  </p>
                </div>
                <button class="btn" style="background: rgba(245,158,11,0.12); color: var(--accent-orange); border: 1px solid rgba(245,158,11,0.3); font-size: 10.5px; padding: 4px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); promptEditOrderInstructions('${o.id}')">✏️ Edit</button>
              </div>

              <div style="margin-bottom:12px; border-top: 1px dashed #262626; padding-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <label style="font-size:10px; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block; margin-bottom:4px;">${currentLang === 'ta' ? 'விநியோக நபர் (Rider)' : 'Delivery Partner'}</label>
                  <select class="form-control" style="background:#111; color:#fff; border:1px solid #333; font-size:12px; padding:6px; border-radius:6px; width:100%; font-weight:bold;" onchange="assignDeliveryPartner('${o.id}', this.value)" onclick="event.stopPropagation()">
                    ${deliveryOptionsHtml}
                  </select>
                </div>
                <div>
                  <label style="font-size:10px; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block; margin-bottom:4px;">${currentLang === 'ta' ? 'ஆர்டர் நிலை (Status)' : 'Order Status'}</label>
                  <select class="form-control" style="background:#111; color:#fff; border:1px solid #333; font-size:12px; padding:6px; border-radius:6px; width:100%; font-weight:bold;" onchange="changeOrderStatusDirectly('${o.id}', this.value)" onclick="event.stopPropagation()">
                    <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending ⏳</option>
                    <option value="ready" ${o.status === 'ready' ? 'selected' : ''}>Ready 🥩</option>
                    <option value="delivering" ${o.status === 'delivering' ? 'selected' : ''}>Delivering 🏍️</option>
                    <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered ✅</option>
                    <option value="rejected" ${o.status === 'rejected' ? 'selected' : ''}>Rejected ❌</option>
                    <option value="cancelled" ${(o.status === 'cancelled' || o.status === 'CANCELLED' || o.status === 'canceled') ? 'selected' : ''}>Cancelled 🛑</option>
                  </select>
                </div>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:13px;">
                <span style="color:var(--text-muted);">Grand Total Paid:</span>
                <strong style="font-size:17px; color:var(--accent-green);">₹${o.totalAmount}</strong>
              </div>

              ${(o.status === 'delivered') ? `
                <div style="background:#050505; border: 1px solid #1c1c1e; border-radius:10px; padding:8px 12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <span style="font-size:9.5px; color:var(--text-muted); text-transform:uppercase; font-weight:700; display:block;">✍️ Customer Hand-Off Signature</span>
                    <span style="font-size:11px; color:var(--accent-green); font-weight:600;">✓ Signed on Delivery</span>
                  </div>
                  ${(o.customerSignature && o.customerSignature.startsWith('data:image')) ? `
                    <img src="${o.customerSignature}" style="max-height:36px; background:#000; border:1px solid #222; border-radius:6px; padding:1.5px;" />
                  ` : `
                    <span style="font-size:11px; color:var(--accent-green); font-weight:700;">✓ OTP Hand-off verified</span>
                  `}
                </div>

                ${o.rating ? `
                  <div style="background:rgba(245,158,11,0.03); border: 1px solid rgba(245,158,11,0.15); border-radius:10.5px; padding:10px 12px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <span style="font-size:9.5px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">⭐ Customer Review & Rating</span>
                      <span style="font-size:12px; color:var(--accent-orange); font-weight:700;">${'★'.repeat(o.rating)}${'☆'.repeat(5 - o.rating)}</span>
                    </div>
                    ${o.feedbackComment ? `
                      <p style="margin:4px 0 0 0; font-size:11.5px; color:rgba(255,255,255,0.85); font-style:italic;">"${typeof escapeHtml === 'function' ? escapeHtml(o.feedbackComment) : o.feedbackComment}"</p>
                    ` : `
                      <p style="margin:4px 0 0 0; font-size:11px; color:var(--text-muted);">No written comments provided.</p>
                    `}
                  </div>
                ` : ''}
              ` : ''}

              <!-- Operational Buttons Grid -->
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-bottom:8px;">
                <a href="tel:${o.customerPhone}" class="btn" style="padding:8px; font-size:11px; text-decoration:none; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:#fff; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:3px;">📞 Call Customer</a>
                <a href="javascript:void(0)" onclick="openWhatsAppDirect('${o.customerPhone}', decodeURIComponent('${waCustomerMsg}'))" class="btn" style="padding:8px; font-size:11px; text-decoration:none; text-align:center; background:rgba(16, 185, 129, 0.08); border:1px solid rgba(16, 185, 129, 0.3); color:#10b981; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:3px; font-weight:700;">📱 Confirm WA</a>

                <button class="btn" style="padding:8px; font-size:11px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:#fff; border-radius:8px; cursor:pointer;" onclick="printKOTTicket('${o.id}')">🖨️ ${currentLang === 'ta' ? 'பேக்கிங் சீட்டு' : 'Packing Slip'}</button>
                <a href="javascript:void(0)" onclick="openWhatsAppShareModal('${o.id}', '${o.customerPhone}', '${(o.customerName || '').replace(/'/g, "\\'")}', '${assignedExecId || ''}', '${kotMsg}')" class="btn" style="padding:8px; font-size:11px; text-decoration:none; text-align:center; background:rgba(34, 197, 94, 0.08); border:1px solid rgba(34, 197, 94, 0.3); color:#22c55e; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:3px; font-weight:700;">💚 ${currentLang === 'ta' ? 'சீட்டைப் பகிர்' : 'Share Slip'}</a>

                <button class="btn" style="padding:8px; font-size:11px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:#fff; border-radius:8px; cursor:pointer;" onclick="printCustomerInvoice('${o.id}')">📄 Print Bill</button>
                <button class="btn" style="padding:8px; font-size:11px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); color:#f59e0b; border-radius:8px; cursor:pointer; font-weight:700;" onclick="promptEditOrderDeliveryOrEta('${o.id}')">🚚 Fee / ETA</button>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; border-top: 1px solid var(--border-color); padding-top:8px;">
                ${actions}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; border-top: 1px dashed #262626; padding-top: 8px;">
                <button class="btn" style="background: rgba(244, 63, 94, 0.08); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.25); padding: 5px 10px; font-size: 11px; font-weight: 700; border-radius: 8px; width: auto; font-family: 'Poppins', sans-serif;" onclick="deleteOrderFromDb('${o.id}', false)">🗑️ Delete Record</button>
                <button onclick="toggleOrderDetails('${o.id}')" style="background:transparent; border:none; color:var(--text-secondary); font-size:11px; cursor:pointer; font-weight:500;">
                  ${currentLang === 'ta' ? '▲ சுருக்குக' : '▲ Collapse'}
                </button>
              </div>
            </div>
          </div>
        `;
        listHtml += card;
      });
      if (totalCount > paginatedOrders.length) {
        listHtml += `
          <div style="text-align: center; margin: 16px 0;">
            <button class="btn btn-secondary" style="width: auto; padding: 10px 24px; font-weight: 700; border-radius: 12px; cursor: pointer;" onclick="loadMoreAdminOrders()">
              📥 Load More Orders (${paginatedOrders.length} of ${totalCount} shown)
            </button>
          </div>
        `;
      }

      list._lastRenderedHtml = listHtml;
      list.innerHTML = listHtml;
    }

    function changeOrderStatus(id, nextStatus) {
      if (typeof db !== 'undefined' && db) {
        showToast("சரிபார்க்கிறது... / Verifying status...", "info");
        const orderRef = db.collection('ek_orders').doc(id);

        db.runTransaction((transaction) => {
          return transaction.get(orderRef).then((docSnap) => {
            if (!docSnap.exists) {
              throw "ORDER_NOT_FOUND";
            }
            const cloudOrder = normalizeFirestoreData(docSnap.data());
            const upperStatus = String(cloudOrder.status || '').toUpperCase();

            if (upperStatus === 'CANCELLED' || upperStatus === 'REJECTED' || upperStatus === 'CANCELED') {
              throw "ORDER_ALREADY_CANCELLED";
            }
            if (upperStatus === 'DELIVERED') {
              throw "ORDER_ALREADY_DELIVERED";
            }

            const oldStatus = cloudOrder.status;
            cloudOrder.status = nextStatus;
            if (!cloudOrder.statusTimestamps) cloudOrder.statusTimestamps = {};
            cloudOrder.statusTimestamps[nextStatus] = new Date().toISOString();
            if (nextStatus === 'delivered' && !cloudOrder.customerSignature) {
              cloudOrder.customerSignature = "Delivered manually by Admin 👑";
            }
            cloudOrder.updatedAt = new Date().toISOString();

            transaction.set(orderRef, cleanFirestoreData(cloudOrder), { merge: true });
            return { cloudOrder, oldStatus };
          });
        }).then(({ cloudOrder, oldStatus }) => {
          window.locallyModifiedOrders = window.locallyModifiedOrders || {};
          window.locallyModifiedOrders[id] = Date.now() + 8000;

          const orders = getData('ek_orders');
          const idx = orders.findIndex(o => o.id === id);
          if (idx !== -1) {
            orders[idx] = cloudOrder;
            saveData('ek_orders', orders);
          }

          try {
            sendFcmPushNotification(cloudOrder, oldStatus, nextStatus);
          } catch (fcmErr) {
            console.warn("FCM push notify skipped or exception:", fcmErr);
          }

          if (nextStatus === 'delivered') {
            try {
              checkAndProcessReferralRewards(cloudOrder);
            } catch (refErr) {
              console.error("Referral rewards processing error in changeOrderStatus:", refErr);
            }
          }

          showToast(`Order status updated to ${nextStatus.toUpperCase()}!`, "success");
          showAdminSuccessModal(
            currentLang === 'ta' ? "📦 ஆர்டர் நிலை மாற்றப்பட்டது!" : "📦 Order Status Updated!",
            currentLang === 'ta' ? `ஆர்டர் நிலை <strong>${nextStatus.toUpperCase()}</strong> என வெற்றிகரமாக மாற்றப்பட்டது.` : `The order status has been successfully updated to <strong>${nextStatus.toUpperCase()}</strong>.`
          );
          renderAdminDashboard();
        }).catch((err) => {
          console.error("Admin status update transaction failed:", err);
          if (err === 'ORDER_ALREADY_CANCELLED') {
            showToast(currentLang === 'ta' ? "இந்த ஆர்டர் ஏற்கனவே ரத்து செய்யப்பட்டுவிட்டது, எனவே மாற்ற முடியாது." : "This order has already been cancelled and cannot be modified.", "warning");
            db.collection('ek_orders').doc(id).get().then((docSnap) => {
              if (docSnap.exists) {
                const cloudOrder = normalizeFirestoreData(docSnap.data());
                const orders = getData('ek_orders', []);
                const idx = orders.findIndex(o => o.id === id);
                if (idx !== -1) {
                  orders[idx] = cloudOrder;
                  saveData('ek_orders', orders);
                  renderAdminDashboard();
                }
              }
            });
          } else if (err === 'ORDER_ALREADY_DELIVERED') {
            showToast(currentLang === 'ta' ? "இந்த ஆர்டர் ஏற்கனவே வழங்கப்பட்டுவிட்டது, எனவே மாற்ற முடியாது." : "This order has already been delivered and cannot be modified.", "warning");
          } else if (err === 'ORDER_NOT_FOUND') {
            showToast("Error: Order not found.", "error");
          } else {
            showToast("Update failed: " + err, "error");
          }
        });
      } else {
        showToast("Internet connection required to modify order status.", "warning");
      }
    }

    function changeOrderStatusDirectly(id, nextStatus) {
      if (nextStatus === 'rejected') {
        cancelOrderPrompt(id);
      } else {
        showCustomConfirm(
          currentLang === 'ta' ? "ஆர்டர் நிலையை மாற்றவா?" : "Change Order Status?",
          currentLang === 'ta'
            ? `இந்த ஆர்டரின் நிலையை <strong>${nextStatus.toUpperCase()}</strong> ஆக மாற்ற விரும்புகிறீர்களா?`
            : `Are you sure you want to change the status of this order to <strong>${nextStatus.toUpperCase()}</strong>?`,
          function() {
            changeOrderStatus(id, nextStatus);
          },
          function() {
            renderAdminDashboard();
          }
        );
      }
    }

    function changeOrderCategory(orderId, newCategory) {
      if (!orderId || !newCategory) return;
      const cleanCat = String(newCategory).trim();
      const orders = getData('ek_orders', []);
      const idx = orders.findIndex(o => o && o.id === orderId);
      if (idx === -1) {
        showToast("Order not found", "error");
        return;
      }
      const o = orders[idx];
      o.category = cleanCat;
      o.orderCategory = cleanCat;
      o.categoryName = cleanCat;
      o.updatedAt = new Date().toISOString();

      saveData('ek_orders', orders);
      if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_orders');

      if (typeof db !== 'undefined' && db) {
        db.collection('ek_orders').doc(orderId).set({
          category: cleanCat,
          orderCategory: cleanCat,
          categoryName: cleanCat,
          updatedAt: new Date().toISOString()
        }, { merge: true }).then(() => {
          showToast(currentLang === 'ta' ? `வகை (${cleanCat.toUpperCase()}) வெற்றிகரமாக மாற்றப்பட்டது! 🏷️` : `Order category updated to ${cleanCat.toUpperCase()}! 🏷️`, "success");
        }).catch(err => {
          console.warn("Firestore category update error:", err);
          showToast("Cloud update notice: " + err.message, "warning");
        });
      } else {
        showToast(currentLang === 'ta' ? `வகை (${cleanCat.toUpperCase()}) மாற்றப்பட்டது!` : `Order category updated!`, "success");
      }

      if (typeof renderAdminOrders === 'function') renderAdminOrders();
    }

    function changeOrderStage(orderId, newStage) {
      if (!orderId || !newStage) return;
      const cleanStage = String(newStage).trim();
      const orders = getData('ek_orders', []);
      const idx = orders.findIndex(o => o && o.id === orderId);
      if (idx === -1) {
        showToast("Order not found", "error");
        return;
      }
      const o = orders[idx];
      o.stage = cleanStage;
      o.orderStage = cleanStage;
      o.updatedAt = new Date().toISOString();

      saveData('ek_orders', orders);
      if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_orders');

      if (typeof db !== 'undefined' && db) {
        db.collection('ek_orders').doc(orderId).set({
          stage: cleanStage,
          orderStage: cleanStage,
          updatedAt: new Date().toISOString()
        }, { merge: true }).then(() => {
          showToast(currentLang === 'ta' ? `நிலை (${cleanStage}) மாற்றப்பட்டது! ⚙️` : `Order stage updated to ${cleanStage}! ⚙️`, "success");
        }).catch(err => {
          console.warn("Firestore stage update error:", err);
          showToast("Cloud update notice: " + err.message, "warning");
        });
      } else {
        showToast(currentLang === 'ta' ? `நிலை (${cleanStage}) மாற்றப்பட்டது!` : `Order stage updated!`, "success");
      }

      if (typeof renderAdminOrders === 'function') renderAdminOrders();
    }

    function promptEditOrderInstructions(orderId) {
      const orders = getData('ek_orders', []);
      const o = orders.find(x => x && x.id === orderId);
      if (!o) return;
      const currentInst = o.orderInstructions || o.specialInstructions || o.adminNotes || '';
      const promptText = currentLang === 'ta' ? 'ஆர்டர் தயாரிப்பு / விநியோக குறிப்புகள்:' : 'Enter Order Preparation / Delivery Instructions:';
      const result = prompt(promptText, currentInst);
      if (result !== null) {
        updateOrderInstructions(orderId, result.trim());
      }
    }

    function updateOrderInstructions(orderId, newInstructions) {
      const cleanInst = String(newInstructions || '').trim();
      const orders = getData('ek_orders', []);
      const idx = orders.findIndex(o => o && o.id === orderId);
      if (idx === -1) return;
      const o = orders[idx];
      o.orderInstructions = cleanInst;
      o.specialInstructions = cleanInst;
      o.adminNotes = cleanInst;
      o.updatedAt = new Date().toISOString();

      saveData('ek_orders', orders);
      if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_orders');

      if (typeof db !== 'undefined' && db) {
        db.collection('ek_orders').doc(orderId).set({
          orderInstructions: cleanInst,
          specialInstructions: cleanInst,
          adminNotes: cleanInst,
          updatedAt: new Date().toISOString()
        }, { merge: true }).then(() => {
          showToast(currentLang === 'ta' ? "குறிப்புகள் சேமிக்கப்பட்டது! 📝" : "Instructions updated successfully! 📝", "success");
        }).catch(err => {
          console.warn("Firestore instructions update error:", err);
        });
      } else {
        showToast("Instructions updated!", "success");
      }

      if (typeof renderAdminOrders === 'function') renderAdminOrders();
    }

    function markDeliveredAdminManual(id) {
      showCustomConfirm(
        "⚙️ Mark Delivered (Admin Complete)?",
        "Mark this order as DELIVERED manually as Admin? (Use only if no delivery partner is assigned/available). This action is irreversible.",
        function() {
          if (typeof db !== 'undefined' && db) {
            showToast("செயலாக்கப்படுகிறது... / Processing...", "info");
            const orderRef = db.collection('ek_orders').doc(id);

            db.runTransaction((transaction) => {
              return transaction.get(orderRef).then((docSnap) => {
                if (!docSnap.exists) {
                  throw "ORDER_NOT_FOUND";
                }
                const cloudOrder = normalizeFirestoreData(docSnap.data());
                const upperStatus = String(cloudOrder.status || '').toUpperCase();

                if (upperStatus === 'CANCELLED' || upperStatus === 'REJECTED' || upperStatus === 'CANCELED') {
                  throw "ORDER_ALREADY_CANCELLED";
                }
                if (upperStatus === 'DELIVERED') {
                  throw "ORDER_ALREADY_DELIVERED";
                }

                const oldStatus = cloudOrder.status;
                cloudOrder.status = 'delivered';
                cloudOrder.customerSignature = "Delivered manually by Admin 👑";

                const adminSession = getAdminSession();
                const current_admin_uid = adminSession ? adminSession.id : (firebase.auth().currentUser ? firebase.auth().currentUser.uid : 'ADMIN_CONSOLE');

                cloudOrder.deliveredByType = 'ADMIN_MANUAL';
                cloudOrder.deliveredByAdminUid = current_admin_uid;
                cloudOrder.deliveredAt = new Date().toISOString();
                cloudOrder.updatedAt = new Date().toISOString();

                transaction.set(orderRef, cleanFirestoreData(cloudOrder), { merge: true });
                return { cloudOrder, oldStatus };
              });
            }).then(({ cloudOrder, oldStatus }) => {
              window.locallyModifiedOrders = window.locallyModifiedOrders || {};
              window.locallyModifiedOrders[id] = Date.now() + 8000;

              const orders = getData('ek_orders');
              const idx = orders.findIndex(o => o.id === id);
              if (idx !== -1) {
                orders[idx] = cloudOrder;
                saveData('ek_orders', orders);
              }

              try {
                sendFcmPushNotification(cloudOrder, oldStatus, 'delivered');
              } catch (fcmErr) {
                console.warn("FCM push notify skipped or exception:", fcmErr);
              }

              try {
                checkAndProcessReferralRewards(cloudOrder);
              } catch (refErr) {
                console.error("Referral rewards processing error in markDeliveredAdminManual:", refErr);
              }

              showToast("Order completed by Admin successfully! ✓", "success");
              showAdminSuccessModal(
                currentLang === 'ta' ? "⚙️ DN வழங்கியதாகக் குறிக்கப்பட்டது!" : "⚙️ Marked Delivered by Admin!",
                `The order has been successfully completed manually by the Admin. No rider info was altered.`
              );
              renderAdminDashboard();
            }).catch((err) => {
              console.error("Admin status update transaction failed:", err);
              if (err === 'ORDER_ALREADY_CANCELLED') {
                showToast(currentLang === 'ta' ? "இந்த ஆர்டர் ஏற்கனவே ரத்து செய்யப்பட்டுவிட்டது." : "This order has already been cancelled.", "warning");
              } else if (err === 'ORDER_ALREADY_DELIVERED') {
                showToast(currentLang === 'ta' ? "இந்த ஆர்டர் ஏற்கனவே வழங்கப்பட்டுவிட்டது." : "This order has already been delivered.", "warning");
              } else if (err === 'ORDER_NOT_FOUND') {
                showToast("Error: Order not found.", "error");
              } else {
                showToast("Update failed: " + err, "error");
              }
            });
          } else {
            showToast("Database offline / unavailable.", "error");
          }
        }
      );
    }

    function assignDeliveryPartner(orderId, executiveId) {
      showToast("சரிபார்க்கிறது... / Verifying status...", "info");

      if (typeof db !== 'undefined' && db) {
        db.collection('ek_orders').doc(orderId).get().then((docSnap) => {
          if (!docSnap.exists) {
            showToast("Error: Order not found.", "error");
            return;
          }
          const cloudOrder = normalizeFirestoreData(docSnap.data());
          if (cloudOrder.status === 'rejected') {
            showToast("மன்னிக்கவும்! இந்த ஆர்டர் ஏற்கனவே வாடிக்கையாளரால் ரத்து செய்யப்பட்டுவிட்டது. / This order has already been cancelled by the customer.", "error");
            const orders = getData('ek_orders', []);
            const idx = orders.findIndex(o => o.id === orderId);
            if (idx !== -1) {
              orders[idx].status = 'rejected';
              orders[idx].rejectionReason = cloudOrder.rejectionReason;
              orders[idx].updatedAt = cloudOrder.updatedAt;
              saveData('ek_orders', orders);
              renderAdminDashboard();
            }
            return;
          }

          proceedWithAssignDeliveryPartner(orderId, executiveId);
        }).catch(err => {
          console.warn("Error verifying order status in cloud before assign, proceeding locally:", err);
          showToast("டெலிவரி நபர் நியமிக்கப்படுகிறார்... / Assigning delivery partner locally...", "info");
          proceedWithAssignDeliveryPartner(orderId, executiveId);
        });
      } else {
        proceedWithAssignDeliveryPartner(orderId, executiveId);
      }
    }

    function proceedWithAssignDeliveryPartner(orderId, executiveId) {
      window.locallyModifiedOrders = window.locallyModifiedOrders || {};
      window.locallyModifiedOrders[orderId] = Date.now() + 8000;

      const orders = getData('ek_orders', []);
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx === -1) return;

      const oldStatus = orders[idx].status;

      const executives = getData('ek_delivery_persons', []);
      const exec = executives.find(e => e.id === executiveId);

      if (exec) {
        // Canonical unified assignment object
        orders[idx].assignedTo = {
          id: exec.id,
          name: exec.name,
          phone: exec.phone || '',
          role: 'rider'
        };

        if (orders[idx].status === 'pending') {
          orders[idx].status = 'ready';
          showToast(`Assigned ${exec.name} & Order Confirmed and Preparing! 🥩`, "success");
        } else {
          showToast(`Assigned ${exec.name} to order ${orderId}! 🏍️`, "success");
        }
      } else {
        orders[idx].assignedTo = null;
        showToast("Order unassigned.", "info");
      }

      orders[idx].updatedAt = new Date().toISOString();
      const expectedStatus = orders[idx].status;

      saveData('ek_orders', orders);

      try {
        if (oldStatus !== orders[idx].status) {
          sendFcmPushNotification(orders[idx], oldStatus, orders[idx].status);
        }
        if (exec) {
          sendFcmNotificationToRider(orders[idx], exec);
          if (typeof sendFcmNotificationForRiderAssignment === 'function') {
            sendFcmNotificationForRiderAssignment(orders[idx], exec);
          }
        }
      } catch (fcmErr) {
        console.warn("FCM push notify skipped or exception:", fcmErr);
      }

      if (db) {
        db.collection('ek_orders').doc(orderId).set(orders[idx], { merge: true })
          .then(() => {
            debugLog(`[Cloud Sync] Assignment updated for ${orderId}`);
            removePendingSync('ek_orders', orderId);

            const currentOrders = getData('ek_orders', []);
            const currentIdx = currentOrders.findIndex(o => o.id === orderId);
            if (currentIdx !== -1 && currentOrders[currentIdx].status !== expectedStatus) {
              console.warn(`[Correction] Local status reverted to ${currentOrders[currentIdx].status}. Resetting back to ${expectedStatus}.`);
              currentOrders[currentIdx].status = expectedStatus;
              saveData('ek_orders', currentOrders);
              renderAdminDashboard();
            }
          })
          .catch(err => {
            console.error("Cloud assignment update failed, queuing for retry:", err);
            window.locallyModifiedOrders[orderId] = Date.now() + 8000;
            queueFailedSync('ek_orders', orderId, 'set', orders[idx]);
          });
      } else {
        queueFailedSync('ek_orders', orderId, 'set', orders[idx]);
      }

      if (exec) {
        showAdminSuccessModal(
          currentLang === 'ta' ? "🏍️ டெலிவரி நபர் நியமிக்கப்பட்டார்!" : "🏍️ Delivery Partner Assigned!",
          currentLang === 'ta' ? `ஆர்டர் <strong>${orderId}</strong> வெற்றிகரமாக <strong>${exec.name}</strong>-க்கு ஒதுக்கப்பட்டு சேமிக்கப்பட்டது.` : `Order <strong>${orderId}</strong> has been successfully assigned to <strong>${exec.name}</strong>.`
        );
      } else {
        showAdminSuccessModal(
          currentLang === 'ta' ? "🏍️ ஒதுக்கீடு நீக்கப்பட்டது!" : "🏍️ Assignment Removed!",
          currentLang === 'ta' ? `ஆர்டர் <strong>${orderId}</strong>-இன் டெலிவரி ஒதுக்கீடு நீக்கப்பட்டது.` : `The delivery assignment for order <strong>${orderId}</strong> has been removed.`
        );
      }

      renderAdminDashboard();
    }

    function closeOrderCancelModal(event) {
      if (event.target === document.getElementById('order-cancel-modal')) {
        closeOrderCancelModalDetail();
      }
    }

    function closeOrderCancelModalDetail() {
      document.getElementById('order-cancel-modal').style.display = 'none';
      document.getElementById('order-cancel-modal').classList.remove('active');
    }

    function openManualPinModal(orderId) {
      const orders = getDataCached('ek_orders', []);
      const ord = orders.find(o => o.id === orderId);
      if (!ord) {
        showToast("Order not found", "error");
        return;
      }
      document.getElementById('manual-pin-order-id').value = orderId;
      document.getElementById('manual-pin-lat').value = ord.deliveryLatitude || '';
      document.getElementById('manual-pin-lng').value = ord.deliveryLongitude || '';
      document.getElementById('manual-location-pin-modal').style.display = 'flex';
    }

    function closeManualPinModal() {
      document.getElementById('manual-location-pin-modal').style.display = 'none';
    }

    async function saveManualPinLocation() {
      const orderId = document.getElementById('manual-pin-order-id').value;
      const latVal = parseFloat(document.getElementById('manual-pin-lat').value);
      const lngVal = parseFloat(document.getElementById('manual-pin-lng').value);

      if (isNaN(latVal) || isNaN(lngVal)) {
        showToast("Please enter valid Latitude and Longitude values", "error");
        return;
      }

      showToast("Updating location... ⏳", "info");

      try {
        const orderRef = db.collection('ek_orders').doc(orderId);
        await orderRef.update({
          deliveryLatitude: latVal,
          deliveryLongitude: lngVal,
          needsManualLocationPin: false,
          updatedAt: new Date().toISOString()
        });

        // Update local cache
        const orders = getDataCached('ek_orders', []);
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
          orders[idx].deliveryLatitude = latVal;
          orders[idx].deliveryLongitude = lngVal;
          orders[idx].needsManualLocationPin = false;
          orders[idx].updatedAt = new Date().toISOString();
          saveData('ek_orders', orders);
        }

        showToast("Location updated successfully! 📍", "success");
        closeManualPinModal();
        if (typeof renderAdminOrders === 'function') {
          renderAdminOrders();
        }
      } catch (err) {
        console.error("Failed to update manual pin location:", err);
        showToast("Failed to update location: " + err.message, "error");
      }
    }

    function openWhatsAppShareModal(orderId, customerPhone, customerName, riderId, encodedMsg) {
      const modal = document.getElementById('whatsapp-share-modal');
      if (!modal) return;

      document.getElementById('wa-share-order-id').value = orderId;
      document.getElementById('wa-share-cust-phone').value = customerPhone || '';
      document.getElementById('wa-share-msg-text').value = decodeURIComponent(encodedMsg);
      document.getElementById('wa-share-custom-phone').value = '';

      const custBtn = document.getElementById('wa-share-opt-customer');
      const custLbl = document.getElementById('wa-share-lbl-customer');
      const custSub = document.getElementById('wa-share-sub-customer');
      if (customerPhone) {
        custBtn.style.display = 'flex';
        custLbl.innerHTML = `வாடிக்கையாளருக்கு / To Customer: ${customerName || 'Customer'}`;
        custSub.innerHTML = `எண்: ${customerPhone}`;
      } else {
        custBtn.style.display = 'none';
      }

      const riderBtn = document.getElementById('wa-share-opt-rider');
      const riderLbl = document.getElementById('wa-share-lbl-rider');
      const riderSub = document.getElementById('wa-share-sub-rider');
      let foundRiderPhone = '';
      let foundRiderName = '';

      if (riderId) {
        const riders = getData('ek_delivery_persons', []);
        const r = riders.find(x => x.id === riderId);
        if (r) {
          foundRiderPhone = r.phone || '';
          foundRiderName = r.name || '';
        }
      }

      document.getElementById('wa-share-rider-phone').value = foundRiderPhone;

      if (foundRiderPhone) {
        riderBtn.style.display = 'flex';
        riderLbl.innerHTML = `டெலிவரி நபருக்கு / To Rider: ${foundRiderName}`;
        riderSub.innerHTML = `எண்: ${foundRiderPhone}`;
      } else {
        riderBtn.style.display = 'none';
      }

      modal.style.display = 'flex';
    }

    function closeWhatsAppShareModal(event) {
      if (event.target === document.getElementById('whatsapp-share-modal')) {
        closeWhatsAppShareModalDetail();
      }
    }

    function closeWhatsAppShareModalDetail() {
      const modal = document.getElementById('whatsapp-share-modal');
      if (modal) modal.style.display = 'none';
    }

    function executeWhatsAppShareOption(type) {
      const msg = document.getElementById('wa-share-msg-text').value;
      let targetPhone = '';

      if (type === 'contact_selector') {
        openWhatsAppDirect('', msg);
        closeWhatsAppShareModalDetail();
        return;
      } else if (type === 'customer') {
        targetPhone = document.getElementById('wa-share-cust-phone').value;
      } else if (type === 'rider') {
        targetPhone = document.getElementById('wa-share-rider-phone').value;
      } else if (type === 'store_vendor') {
        targetPhone = '918778148899';
      } else if (type === 'custom_phone') {
        const rawPhone = document.getElementById('wa-share-custom-phone').value.trim();
        if (rawPhone.length !== 10 || isNaN(rawPhone)) {
          showToast("தயவுசெய்து சரியான 10-இலக்க எண்ணை உள்ளிடவும்! / Please enter a valid 10-digit number!", "warning");
          return;
        }
        targetPhone = rawPhone;
      }

      if (!targetPhone) {
        showToast("தொலைபேசி எண் கிடைக்கவில்லை! / Phone number not found!", "error");
        return;
      }

      openWhatsAppDirect(targetPhone, msg);
      closeWhatsAppShareModalDetail();
    }

    function selectCancelReason(reasonText, element) {
      document.querySelectorAll('.rc-reason-btn').forEach(btn => btn.classList.remove('active'));

      if (element) {
        element.classList.add('active');
      }

      document.getElementById('order-cancel-reason-input').value = reasonText;
    }

    function cancelOrderPrompt(id) {
      document.getElementById('order-cancel-id').value = id;
      document.getElementById('order-cancel-reason-input').value = '';
      document.querySelectorAll('.rc-reason-btn').forEach(btn => btn.classList.remove('active'));

      const modal = document.getElementById('order-cancel-modal');
      modal.style.display = 'flex';
      modal.classList.add('active');
    }

    function confirmOrderCancellation() {
      const id = document.getElementById('order-cancel-id').value;
      const reasonText = document.getElementById('order-cancel-reason-input').value.trim() || (currentLang === 'ta' ? 'காரணம் குறிப்பிடப்படவில்லை' : 'No reason provided');

      if (!id) return;

      if (typeof db === 'undefined' || !db) {
        showToast(currentLang === 'ta' ? "ஆர்டரை ரத்து செய்ய இணைய இணைப்பு தேவை!" : "Internet connection required to cancel this order", "warning");
        return;
      }

      showToast(currentLang === 'ta' ? "ஆர்டர் ரத்து செய்யப்படுகிறது... ⏳" : "Processing order cancellation... ⏳", "info");

      const orderRef = db.collection('ek_orders').doc(id);

      db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(orderRef);
        if (!docSnap.exists) {
          throw "ORDER_NOT_FOUND";
        }
        const cloudOrder = normalizeFirestoreData(docSnap.data());
        const status = String(cloudOrder.status || '').toUpperCase();

        if (status === 'CANCELLED' || status === 'REJECTED' || status === 'CANCELED') {
          throw "ORDER_ALREADY_CANCELLED";
        }
        if (status === 'DELIVERED') {
          throw "ORDER_ALREADY_DELIVERED";
        }

        if (cloudOrder.items && Array.isArray(cloudOrder.items)) {
          const productSnaps = await Promise.all(
            cloudOrder.items.map(item => transaction.get(db.collection('ek_products').doc(item.productId)))
          );

          cloudOrder.items.forEach((item, i) => {
            const prodSnap = productSnaps[i];
            if (prodSnap.exists) {
              const prodData = prodSnap.data();
              const serverStock = parseFloat(prodData.stockKg || 0);
              const unit = prodData.unit || 'kg';
              const isWeight = !(unit === 'piece' || unit === 'packet' || unit === 'bunch' || unit === 'dozen' || unit === 'unit');
              const returnedQty = isWeight ? (item.weightGrams / 1000) : item.weightGrams;
              const newStock = parseFloat((serverStock + returnedQty).toFixed(3));

              transaction.update(prodSnap.ref, {
                stockKg: newStock,
                isOutOfStock: false,
                updatedAt: new Date().toISOString()
              });
            }
          });
        }

        const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
        transaction.update(orderRef, {
          status: 'rejected',
          rejectionReason: reasonText,
          updatedAt: serverTimestamp
        });

        return cloudOrder;
      }).then((cloudOrder) => {

        const products = getData('ek_products', []);
        if (cloudOrder.items && Array.isArray(cloudOrder.items)) {
          cloudOrder.items.forEach(item => {
            const prod = products.find(p => p.id === item.productId);
            if (prod) {
              const unit = prod.unit || 'kg';
              const isWeight = !(unit === 'piece' || unit === 'packet' || unit === 'bunch' || unit === 'dozen' || unit === 'unit');
              const returnedQty = isWeight ? (item.weightGrams / 1000) : item.weightGrams;
              prod.stockKg = parseFloat((prod.stockKg + returnedQty).toFixed(3));
              prod.isOutOfStock = false;
              prod.updatedAt = new Date().toISOString();
            }
          });
        }
        saveData('ek_products', products);

        const users = getData('ek_users', []);
        const userIdx = users.findIndex(u => u.id === cloudOrder.customerId);
        if (userIdx !== -1) {
          const user = users[userIdx];
          const accruedPoints = cloudOrder.accruedPoints || (Math.floor(cloudOrder.totalAmount / 100) * 10);
          const pointsRefunded = (cloudOrder.loyaltyDiscount || 0) * 10;
          user.loyaltyPoints = Math.max(0, user.loyaltyPoints - accruedPoints + pointsRefunded);
          user.tier = computeLoyaltyTier(user.loyaltyPoints);

          users[userIdx] = user;
          saveData('ek_users', users);

          db.collection('ek_users').doc(user.id).set(user)
            .catch(err => console.error("Cloud user points restore error on admin cancel:", err));
        }

        window.locallyModifiedOrders = window.locallyModifiedOrders || {};
        window.locallyModifiedOrders[id] = Date.now() + 8000; // Shield from sync overwrites!

        const orders = getData('ek_orders', []);
        const idx = orders.findIndex(o => o.id === id);
        let updatedOrderObject = null;
        if (idx !== -1) {
          orders[idx].status = 'rejected';
          orders[idx].rejectionReason = reasonText;
          orders[idx].updatedAt = new Date().toISOString();
          updatedOrderObject = orders[idx];
          saveData('ek_orders', orders);
        } else {
          updatedOrderObject = {
            ...cloudOrder,
            status: 'rejected',
            rejectionReason: reasonText,
            updatedAt: new Date().toISOString()
          };
          orders.push(updatedOrderObject);
          saveData('ek_orders', orders);
        }

        try {
          if (typeof sendFcmPushNotification === 'function') {
            sendFcmPushNotification(updatedOrderObject, cloudOrder.status || 'pending', 'rejected', reasonText);
          }
        } catch (fcmErr) {
          console.warn("FCM push notify failed on cancel:", fcmErr);
        }

        showToast(currentLang === 'ta' ? "நிர்வாகியால் ஆர்டர் வெற்றிகரமாக ரத்து செய்யப்பட்டது! 🛑" : "Order cancelled by Admin successfully! 🛑", "error");

        closeOrderCancelModalDetail();
        renderAdminDashboard();
      }).catch((err) => {
        console.error("Admin cancellation transaction failed:", err);
        if (err === 'ORDER_ALREADY_CANCELLED') {
          showToast(currentLang === 'ta' ? "ஆர்டர் ஏற்கனவே ரத்து செய்யப்பட்டுவிட்டது." : "This order has already been cancelled.", "warning");
        } else if (err === 'ORDER_ALREADY_DELIVERED') {
          showToast(currentLang === 'ta' ? "இந்த ஆர்டர் ஏற்கனவே வழங்கப்பட்டுவிட்டது, எனவே ரத்து செய்ய முடியாது." : "This order has already been delivered and cannot be cancelled.", "warning");
        } else if (err === 'ORDER_NOT_FOUND') {
          showToast("Order not found.", "error");
        } else {
          showToast("Cancellation failed: " + err, "error");
        }
        closeOrderCancelModalDetail();

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_orders').doc(id).get().then((docSnap) => {
            if (docSnap.exists) {
              const cloudOrder = normalizeFirestoreData(docSnap.data());
              const orders = getData('ek_orders', []);
              const idx = orders.findIndex(o => o.id === id);
              if (idx !== -1) {
                orders[idx] = cloudOrder;
                saveData('ek_orders', orders);
                renderAdminDashboard();
              }
            }
          });
        }
      });
    }

    let editingProductId = null;
    let editProductPhotoDeleted = false;

    function generateUniqueProductId() {
      return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }

    async function resizeImageBeforeUpload(base64Str, maxWidth = 500, quality = 0.75) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
          resolve(base64Str);
        };
        img.src = base64Str;
      });
    }

    function isProductOutOfStock(p) {
      if (!p) return false;

      // 1. Emergency Force Out of Stock override
      if (p.forceOutOfStock) return true;

      // 2. Physical Stock <= 0
      if (p.stockKg !== undefined && p.stockKg <= 0) return true;

      // 3. Time Window check
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
            return true; // Outside timing window -> Out of Stock
          }
        } else {
          // Overnight window (e.g. 22:00 to 04:00)
          if (currentTimeStr < normStart && currentTimeStr > normEnd) {
            return true; // Outside timing window -> Out of Stock
          }
        }
      }

      // If no timing set or current time is within window, and forceOutOfStock is false, and stockKg > 0:
      return false;
    }

    function updateProductAvailability(p) {
      if (!p) return;

      // Firestore Data Migration rule:
      // Legacy products marked manually isOutOfStock without forceOutOfStock or timing window
      // default to "Always Available" (isOutOfStock = false) unless timing or force-override is active.
      if (p.isOutOfStock && !p.forceOutOfStock && !(p.isScheduled && (p.availabilityStart || p.scheduleStart))) {
        p.isOutOfStock = false;
      }

      const outOfStock = isProductOutOfStock(p);
      p.isOutOfStock = outOfStock;
      p.isAvailable = !outOfStock;
    }

    function formatTime12h(timeStr) {
      if (!timeStr) return '';
      const parts = String(timeStr).trim().split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      if (isNaN(h)) return timeStr;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return `${h}:${m.padStart(2, '0')} ${ampm}`;
    }

    function getProductAvailabilityLabel(p) {
      if (!p) return '🟢 Always Available';
      if (p.forceOutOfStock) {
        return '🚨 Forced Out of Stock';
      }
      const start = p.availabilityStart || p.scheduleStart || '';
      const end = p.availabilityEnd || p.scheduleEnd || '';
      if (p.isScheduled && start && end) {
        return `⏰ Available ${formatTime12h(start)} - ${formatTime12h(end)}`;
      }
      return '🟢 Always Available';
    }

    function toggleForceOutOfStock(id) {
      const products = getData('ek_products', []);
      const idx = products.findIndex(p => p.id === id);
      if (idx === -1) return;

      const currentForce = Boolean(products[idx].forceOutOfStock);
      const newForce = !currentForce;
      products[idx].forceOutOfStock = newForce;

      products[idx].revision = (products[idx].revision || 0) + 1;
      products[idx].updatedAt = new Date().toISOString();

      updateProductAvailability(products[idx]);
      ensureRequiredFields(products[idx]);

      saveData('ek_products', products);
      invalidateDataCache('ek_products');

      if (typeof db !== 'undefined' && db && getAdminSession()) {
        logProductWriteAudit('update', id, 'toggleForceOutOfStock');
        db.collection('ek_products').doc(id).set(cleanFirestoreData(products[idx]))
          .then(() => debugLog(`[Cloud Sync] Forced Out of Stock override set to ${newForce} for product ${id}`))
          .catch(e => console.error("Error setting forceOutOfStock in cloud:", e));
      }

      const statusLabel = newForce ? "🚨 Forced Out of Stock (Emergency Active)" : "🟢 Emergency Override Cleared (Timing / Normal Stock Active)";
      showToast(`${products[idx].tamilName}: ${statusLabel}`, newForce ? "warning" : "success");

      if (typeof renderAdminProducts === 'function') renderAdminProducts();
      if (typeof renderHomeScreenProducts === 'function') {
        _lastProductsHash = '';
        renderHomeScreenProducts(true);
      }
    }

    function ensureRequiredFields(p) {
      if (!p) return;
      p.price = p.pricePerKg || 0;
      p.stock = p.stockKg || 0;
      p.isActive = true;
      p.status = "active";
      p.isHidden = false;
      if (p.isFreeDeliveryEligible === undefined) p.isFreeDeliveryEligible = false;
      updateProductAvailability(p);
    }

    async function handleProductSave(event) {
      event.preventDefault();
      try {
        const tamilName = (document.getElementById('add-prod-tamil')?.value || '').trim();
        const englishName = (document.getElementById('add-prod-english')?.value || '').trim();
        const priceVal = document.getElementById('add-prod-price')?.value || '';
        const stockVal = document.getElementById('add-prod-stock')?.value || '';
        const pricePerKg = parseInt(priceVal);
        const stockKg = parseFloat(stockVal);
        const category = document.getElementById('add-prod-category')?.value || 'meat';
        const imageUrlInput = (document.getElementById('add-prod-url')?.value || '').trim();
        const unit = document.getElementById('add-prod-unit')?.value || 'kg';

        const shortDescription = (document.getElementById('add-prod-short-desc')?.value || '').trim();
        const aliasesRaw = (document.getElementById('add-prod-aliases')?.value || '').trim();
        const aliasesList = aliasesRaw ? aliasesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        const foodType = document.querySelector('input[name="add-prod-foodtype"]:checked')?.value || 'veg';

        const isSpecial = document.getElementById('add-prod-special')?.checked || false;
        const isFreeDeliveryEligible = document.getElementById('add-prod-free-delivery')?.checked || false;

        const isScheduled = document.getElementById('add-prod-scheduled') ? document.getElementById('add-prod-scheduled').checked : false;
        const scheduleStart = isScheduled ? (document.getElementById('add-prod-schedule-start')?.value || '06:00') : '';
        const scheduleEnd = isScheduled ? (document.getElementById('add-prod-schedule-end')?.value || '11:00') : '';
        const forceOutOfStock = document.getElementById('add-prod-force-out') ? document.getElementById('add-prod-force-out').checked : false;

        if (!tamilName) {
          showToast("தயவுசெய்து தமிழ் பெயரை உள்ளிடவும் / Please enter Tamil Name", "error");
          return;
        }
        if (!englishName) {
          showToast("தயவுசெய்து ஆங்கில பெயரை உள்ளிடவும் / Please enter English Name", "error");
          return;
        }
        if (isNaN(pricePerKg) || pricePerKg < 0) {
          showToast("தயவுசெய்து சரியான விலையை உள்ளிடவும் / Please enter a valid price", "error");
          return;
        }
        if (isNaN(stockKg) || stockKg < 0) {
          showToast("தயவுசெய்து சரியான ஸ்டாக் அளவை உள்ளிடவும் / Please enter a valid stock quantity", "error");
          return;
        }

        const products = getData('ek_products');

        let finalImg = 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400';
        let oldImageUrl = null;

        if (editingProductId) {
          const existingProd = products.find(p => p.id === editingProductId);
          if (existingProd && existingProd.imageUrl) {
            finalImg = existingProd.imageUrl;
            oldImageUrl = existingProd.imageUrl;
          }
        }

        const useUrlCheck = document.getElementById('add-prod-use-url')?.checked;
        if (imageUrlInput && (useUrlCheck || !tempProductFile)) {
          finalImg = imageUrlInput;
        }

        const productId = editingProductId || generateUniqueProductId();

        const submitBtn = document.getElementById('prod-submit-btn');
        const originalBtnText = submitBtn ? submitBtn.innerText : "Save Product ✓";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = "Processing... ⏳";
        }

        if (tempProductFile && tempBase64Image && !useUrlCheck) {
          try {
            if (submitBtn) submitBtn.innerText = "Uploading Image (0%)... ⏳";
            showToast('மாற்றிய படம் பதிவேற்றப்படுகிறது... ⏳', 'info');

            const resizedBase64 = await resizeImageBeforeUpload(tempBase64Image, 500, 0.75);
            finalImg = await uploadProductImageToStorage(productId, tempProductFile, resizedBase64);
          } catch (uploadErr) {
            console.error('[Image Upload Failed]', uploadErr);
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerText = originalBtnText;
            }
            showToast(uploadErr.message || "Selected image format is not supported.", "error");
            return;
          }
        }

        let targetProduct = null;
        let isEdit = false;
        if (editingProductId) {
          isEdit = true;
          const idx = products.findIndex(p => p.id === editingProductId);
          if (idx !== -1) {
            const currentRevision = products[idx].revision || 0;
            targetProduct = {
              ...products[idx],
              tamilName, englishName, pricePerKg, stockKg, category, unit,
              sellingUnit: unit,
              price: pricePerKg,
              stock: stockKg,
              isActive: true,
              status: "active",
              shortDescription, foodType, aliases: aliasesList,
              imageUrl: finalImg,
              isSpecial,
              isFreeDeliveryEligible,
              isScheduled, scheduleStart, scheduleEnd,
              availabilityStart: scheduleStart, availabilityEnd: scheduleEnd,
              forceOutOfStock,
              isHidden: false, // Ensure it is visible on customer devices
              updatedAt: new Date().toISOString(),
              revision: currentRevision + 1
            };
            ensureRequiredFields(targetProduct);
          }
        } else {
          targetProduct = {
            id: productId,
            tamilName, englishName, pricePerKg, stockKg, category, unit,
            sellingUnit: unit,
            price: pricePerKg,
            stock: stockKg,
            isActive: true,
            status: "active",
            shortDescription, foodType, aliases: aliasesList,
            imageUrl: finalImg,
            isSpecial,
            isFreeDeliveryEligible,
            isScheduled, scheduleStart, scheduleEnd,
            availabilityStart: scheduleStart, availabilityEnd: scheduleEnd,
            forceOutOfStock,
            isHidden: false, // Ensure it is visible on customer devices
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            revision: 1
          };
          ensureRequiredFields(targetProduct);
        }

        // OPTIMISTIC UI UPDATE: Save to local state and show success popup INSTANTLY!
        if (isEdit) {
          const idx = products.findIndex(p => p.id === editingProductId);
          if (idx !== -1) {
            products[idx] = targetProduct;
          }
          showToast("Product revised successfully", "success");
          showAdminSuccessModal(
            "✏️ வெற்றிகரமாக மாற்றி அமைக்கப்பட்டது!",
            `தயாரிப்பு <strong>${tamilName} (${englishName})</strong> விவரங்கள் வெற்றிகரமாக மாற்றி அமைக்கப்பட்டு உங்கள் கடையில் சேமிக்கப்பட்டது.<br><br><span style="font-size:11.5px;color:var(--text-muted);">Successfully Updated! The product details have been modified.</span>`
          );
        } else {
          products.push(targetProduct);
          showToast("New Item appended securely!", "success");
          showAdminSuccessModal(
            "🎉 வெற்றிகரமாக உருவாக்கப்பட்டது!",
            `புதிய தயாரிப்பு <strong>${tamilName} (${englishName})</strong> வெற்றிகரமாக உருவாக்கப்பட்டு உங்கள் கடையில் இணைக்கப்பட்டது.<br><br><span style="font-size:11.5px;color:var(--text-muted);">Successfully Created! The new product has been added.</span>`
          );

          // Realtime notification to Customer Notification Center (Bell 🔔)
          try {
            if (typeof window.addNotification === 'function') {
              window.addNotification(
                `🥩 புதிய தயாரிப்பு: ${tamilName}`,
                `🥩 New Arrival: ${englishName}`,
                `${tamilName} (${englishName}) இப்போது உங்கள் எடப்பாடி கடையில் கிடைக்கிறது. இன்றே ஆர்டர் செய்யுங்கள்! விலை: ₹${targetProduct.price}`,
                `${englishName} is now available at Edappadi Kadai. Order today at ₹${targetProduct.price}!`,
                '🥩'
              );
            } else if (typeof addNotification === 'function') {
              addNotification(
                `🥩 புதிய தயாரிப்பு: ${tamilName}`,
                `🥩 New Arrival: ${englishName}`,
                `${tamilName} (${englishName}) இப்போது உங்கள் எடப்பாடி கடையில் கிடைக்கிறது. இன்றே ஆர்டர் செய்யுங்கள்! விலை: ₹${targetProduct.price}`,
                `${englishName} is now available at Edappadi Kadai. Order today at ₹${targetProduct.price}!`,
                '🥩'
              );
            }
          } catch(notifErr) {
            console.warn("Failed to dispatch local product notification:", notifErr);
          }

          // Broadcast announcement to all customer devices in Firestore
          if (typeof db !== 'undefined' && db) {
            db.collection('ek_topic_broadcast_requests').add({
              type: 'new_product',
              productId: targetProduct.id,
              title: `🥩 புதிய தயாரிப்பு: ${tamilName}`,
              titleTa: `🥩 புதிய தயாரிப்பு: ${tamilName}`,
              titleEn: `🥩 New Arrival: ${englishName}`,
              body: `${tamilName} (${englishName}) இப்போது கிடைக்கிறது! விலை: ₹${targetProduct.price}`,
              bodyTa: `${tamilName} இப்போது உங்கள் எடப்பாடி கடையில் கிடைக்கிறது! இன்றே ஆர்டர் செய்யுங்கள்! விலை: ₹${targetProduct.price}`,
              bodyEn: `${englishName} is now available at Edappadi Kadai! Order today at ₹${targetProduct.price}!`,
              createdAt: new Date().toISOString()
            }).then(() => {
              debugLog("✓ Broadcast notification dispatched for new product:", targetProduct.id);
            }).catch(err => console.warn("Broadcast request failed:", err));
          }

          // Android Native Status Bar Push
          if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.showNativeNotification === 'function') {
            try {
              AndroidStorage.showNativeNotification(
                `🥩 புதிய தயாரிப்பு: ${tamilName}`,
                `${tamilName} இப்போது உங்கள் எடப்பாடி கடையில் கிடைக்கிறது! இன்றே ஆர்டர் செய்யுங்கள்!`
              );
            } catch(nativeErr) {}
          }
        }

        if (typeof unmarkProductAsDeleted === 'function') {
          unmarkProductAsDeleted(targetProduct.id);
        }

        saveData('ek_products', products);
        invalidateDataCache('ek_products');
        window._lastProductsHash = '';
        if (typeof _lastProductsHash !== 'undefined') _lastProductsHash = '';
        if (typeof renderHomeScreenProducts === 'function') {
          renderHomeScreenProducts(true);
        }

        try {
          window.dispatchEvent(new CustomEvent('ek-products-updated', { detail: { action: isEdit ? 'update' : 'create', product: targetProduct } }));
          window.dispatchEvent(new CustomEvent('refresh-customer-catalog'));
        } catch(e) {}

        if (oldImageUrl && oldImageUrl !== finalImg) {
          deleteStorageImageByUrl(oldImageUrl);
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = originalBtnText;
        }

        tempProductFile = null;
        tempBase64Image = null;

        resetProductForm();
        if (typeof closeAdminAddProductModalDetail === 'function') {
          closeAdminAddProductModalDetail();
        }
        renderAdminDashboard();

        // Background Cloud Sync (Non-blocking)
        if (typeof db !== 'undefined' && db && targetProduct) {
          (async () => {
            try {
              const isPermitted = await verifyAdminWritePermission(`syncProductToCloudWithRetry for ID: ${targetProduct.id}`);
              if (!isPermitted) throw new Error("ADMIN_WRITE_DENIED");
              logProductWriteAudit(isEdit ? 'update' : 'create', targetProduct.id, 'syncProductToCloudWithRetry');
              await db.collection('ek_products').doc(targetProduct.id).set(cleanFirestoreData(targetProduct));
              debugLog("✓ Background Firestore Update successful for product:", targetProduct.id);
              removePendingSyncEntry('product', targetProduct.id);
            } catch (syncErr) {
              console.error("Background Firestore sync failed for product:", syncErr);
              showToast("Cloud sync pending. Will retry automatically.", "info");
            }
          })();
        }
      } catch (saveError) {
        console.error("Critical error saving product:", saveError);
        const submitBtn = document.getElementById('prod-submit-btn');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Save Product ✓";
        }
        showToast("பொருளை சேமிப்பதில் பிழை / Error saving product: " + saveError.message, "error");
      }
    }

    async function syncProductToCloudWithRetry(product, attempt = 1) {
      const MAX_ATTEMPTS = 5;
      try {
        const isPermitted = await verifyAdminWritePermission(`syncProductToCloudWithRetry for ID: ${product.id}`);
        if (!isPermitted) {
          throw new Error("ADMIN_WRITE_DENIED: Firebase user has no active admin role or is anonymous.");
        }

        logProductWriteAudit(product.createdAt === product.updatedAt ? 'create' : 'update', product.id, 'syncProductToCloudWithRetry');
        await db.collection('ek_products').doc(product.id).set(cleanFirestoreData(product));
        debugLog(`[Cloud Sync] Product ${product.id} synced successfully (attempt ${attempt}).`);

        removePendingSyncEntry('product', product.id);
      } catch (err) {
        console.error(`[Cloud Sync] Product ${product.id} sync failed (attempt ${attempt}):`, err);

        if (attempt < MAX_ATTEMPTS) {
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
          setTimeout(() => syncProductToCloudWithRetry(product, attempt + 1), delay);
        } else {
          queueFailedProductSync('product', product);
          showToast('படம்/பொருள் cloud-ல் sync ஆகவில்லை — network சரிபார்க்கவும்', 'error');
        }
      }
    }

    function removePendingSyncEntry(type, id) {
      const queue = getData('ek_pending_sync_queue', []);
      const filtered = queue.filter(item => !(item.type === type && item.data.id === id));
      if (filtered.length !== queue.length) {
        saveData('ek_pending_sync_queue', filtered);
      }
    }

    function queueFailedProductSync(type, data) {
      const queue = getData('ek_pending_sync_queue', []);
      const existingIdx = queue.findIndex(item => item.type === type && item.data.id === data.id);
      const now = Date.now();
      const firstFailedAt = (existingIdx !== -1 && (queue[existingIdx].firstFailedAt || queue[existingIdx].queuedAt))
        ? (queue[existingIdx].firstFailedAt || queue[existingIdx].queuedAt)
        : now;
      if (existingIdx !== -1) {
        queue[existingIdx] = { type, data, queuedAt: now, firstFailedAt: firstFailedAt, retryCount: (queue[existingIdx].retryCount || 0) + 1 };
      } else {
        queue.push({ type, data, queuedAt: now, firstFailedAt: now, retryCount: 0 });
      }
      saveData('ek_pending_sync_queue', queue);
    }

    async function processPendingProductSyncQueue() {
      if (typeof db === 'undefined' || !db) return;
      const queue = getData('ek_pending_sync_queue', []);
      if (queue.length === 0) return;

      const stillFailed = [];
      for (const item of queue) {
        if (item.retryCount >= 8) continue; // Max retries exceeded, drop

        try {
          const collectionName = item.type === 'product' ? 'ek_products' :
                                  item.type === 'order' ? 'ek_orders' :
                                  item.type === 'user' ? 'ek_users' : null;
          if (!collectionName) continue;

          try {
            const docRef = db.collection(collectionName).doc(item.data.id);
            const cloudDoc = await docRef.get();
            if (cloudDoc.exists) {
              const cloudData = cloudDoc.data();
              const cloudTime = cloudData && cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
              const localTime = item.data && item.data.updatedAt ? new Date(item.data.updatedAt).getTime() : 0;
              if (cloudTime > localTime) {
                debugLog(`[Product Sync Queue] Stale update bypassed for ${collectionName}/${item.data.id} to protect newer cloud data (${cloudTime} > ${localTime})`);
                continue; // Skip writing this item but let it clear from the queue
              }
            }
          } catch (getErr) {
            console.warn(`[Product Sync Queue] Cloud get failed for conflict check:`, getErr);
            item.retryCount++;
            stillFailed.push(item);
            continue;
          }

          await db.collection(collectionName).doc(item.data.id).set(cleanFirestoreData(item.data));
          debugLog(`[Sync Queue] Retried ${item.type} ${item.data.id} successfully.`);
        } catch (err) {
          item.retryCount++;
          stillFailed.push(item);
        }
      }
      saveData('ek_pending_sync_queue', stillFailed);
    }

    setInterval(() => {
      if (document.hidden || window._isAppBackgrounded) return;
      try { processPendingProductSyncQueue(); } catch(e){console.error(e);}
    }, 30000);
    window.addEventListener('online', () => { try { processPendingProductSyncQueue(); } catch(e){console.error(e);} });

    function editProductForm(id) {
      tempBase64Image = null; // Clear any leftover base64 cache
      editProductPhotoDeleted = false;
      const products = getData('ek_products');
      const p = products.find(prod => prod.id === id);
      if (!p) return;

      editingProductId = p.id;
      const fileInput = document.getElementById('edit-prod-file');
      if (fileInput) fileInput.value = ''; // Reset file input selection

      document.getElementById('edit-prod-id').value = p.id;
      document.getElementById('edit-prod-tamil').value = p.tamilName;
      document.getElementById('edit-prod-english').value = p.englishName;
      document.getElementById('edit-prod-price').value = p.pricePerKg;
      document.getElementById('edit-prod-stock').value = p.stockKg;

      const unitVal = p.sellingUnit || p.unit || 'kg';
      document.getElementById('edit-prod-unit').value = unitVal;
      onProductUnitChanged(unitVal, 'edit-prod');

      if (typeof populateProductCategoryOptions === 'function') {
        populateProductCategoryOptions();
      }

      document.getElementById('edit-prod-category').value = p.category;
      document.getElementById('edit-prod-url').value = (p.imageUrl && p.imageUrl.startsWith('data:')) ? '' : (p.imageUrl || '');

      document.getElementById('edit-prod-special').checked = p.isSpecial || false;
      const editFreeDel = document.getElementById('edit-prod-free-delivery');
      if (editFreeDel) editFreeDel.checked = Boolean(p.isFreeDeliveryEligible);

      const editShortDesc = document.getElementById('edit-prod-short-desc');
      if (editShortDesc) {
        editShortDesc.value = p.shortDescription || '';
      }
      const editAliases = document.getElementById('edit-prod-aliases');
      if (editAliases) {
        editAliases.value = Array.isArray(p.aliases) ? p.aliases.join(', ') : (p.aliases || '');
      }
      const fType = p.foodType || 'veg';
      const rButton = document.querySelector(`input[name="edit-prod-foodtype"][value="${fType}"]`);
      if (rButton) {
        rButton.checked = true;
      }

      const isSched = Boolean(p.isScheduled && (p.availabilityStart || p.scheduleStart));
      const editProdSched = document.getElementById('edit-prod-scheduled');
      if (editProdSched) editProdSched.checked = isSched;
      const editProdStart = document.getElementById('edit-prod-schedule-start');
      if (editProdStart) editProdStart.value = p.availabilityStart || p.scheduleStart || '06:00';
      const editProdEnd = document.getElementById('edit-prod-schedule-end');
      if (editProdEnd) editProdEnd.value = p.availabilityEnd || p.scheduleEnd || '11:00';
      toggleProductScheduleFields(isSched, 'edit-prod');

      const editForceOut = document.getElementById('edit-prod-force-out');
      if (editForceOut) editForceOut.checked = Boolean(p.forceOutOfStock);

      const previewImg = document.getElementById('edit-prod-preview-img');
      const previewContainer = document.getElementById('edit-prod-preview-container');
      if (previewImg && previewContainer) {
        if (p.imageUrl) {
          previewImg.src = getImageUrlWithCacheBuster(p.imageUrl, p.updatedAt);
          previewContainer.style.display = 'block';
        } else {
          previewContainer.style.display = 'none';
        }
      }

      const modal = document.getElementById('admin-edit-product-modal');
      if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.pointerEvents = 'auto';
      }
      document.body.style.overflow = 'hidden';
      showToast("Configuring Edit Frame for " + p.englishName, "info");
    }

    function toggleProductScheduleFields(checked, prefix = 'add-prod') {
      const el = document.getElementById(`${prefix}-schedule-inputs`);
      if (el) el.style.display = checked ? 'flex' : 'none';
    }

    function resetProductForm() {
      editingProductId = null;
      tempBase64Image = null;
      tempProductFile = null;
      document.getElementById('admin-product-form').reset();

      const fileInput = document.getElementById('add-prod-file');
      if (fileInput) fileInput.value = '';

      const addAliases = document.getElementById('add-prod-aliases');
      if (addAliases) addAliases.value = '';

      document.getElementById('add-prod-unit').value = 'kg';
      onProductUnitChanged('kg', 'add-prod');

      const previewContainer = document.getElementById('add-prod-preview-container');
      if (previewContainer) {
        previewContainer.style.display = 'none';
      }

      const addFreeDel = document.getElementById('add-prod-free-delivery');
      if (addFreeDel) addFreeDel.checked = false;

      toggleProductScheduleFields(false, 'add-prod');

      document.getElementById('prod-submit-btn').innerText = "Save Product ✓";
      const cancelBtn = document.getElementById('prod-cancel-btn');
      if (cancelBtn) cancelBtn.style.display = "none";
    }

    async function handleAdminProductSave(event) {
      event.preventDefault();
      try {
        const id = document.getElementById('edit-prod-id').value;
        if (!id) return;

        const tamilName = (document.getElementById('edit-prod-tamil')?.value || '').trim();
        const englishName = (document.getElementById('edit-prod-english')?.value || '').trim();
        const priceVal = document.getElementById('edit-prod-price')?.value || '';
        const stockVal = document.getElementById('edit-prod-stock')?.value || '';
        const pricePerKg = parseInt(priceVal);
        const stockKg = parseFloat(stockVal);
        const category = document.getElementById('edit-prod-category')?.value || 'meat';
        const imageUrlInput = (document.getElementById('edit-prod-url')?.value || '').trim();
        const unit = document.getElementById('edit-prod-unit')?.value || 'kg';

        const shortDescription = (document.getElementById('edit-prod-short-desc')?.value || '').trim();
        const aliasesRaw = (document.getElementById('edit-prod-aliases')?.value || '').trim();
        const aliasesList = aliasesRaw ? aliasesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        const foodType = document.querySelector('input[name="edit-prod-foodtype"]:checked')?.value || 'veg';

        const isSpecial = document.getElementById('edit-prod-special')?.checked || false;
        const isFreeDeliveryEligible = document.getElementById('edit-prod-free-delivery')?.checked || false;

        const isScheduled = document.getElementById('edit-prod-scheduled') ? document.getElementById('edit-prod-scheduled').checked : false;
        const scheduleStart = isScheduled ? (document.getElementById('edit-prod-schedule-start')?.value || '06:00') : '';
        const scheduleEnd = isScheduled ? (document.getElementById('edit-prod-schedule-end')?.value || '11:00') : '';
        const forceOutOfStock = document.getElementById('edit-prod-force-out') ? document.getElementById('edit-prod-force-out').checked : false;

        if (!tamilName) {
          showToast("தயவுசெய்து தமிழ் பெயரை உள்ளிடவும் / Please enter Tamil Name", "error");
          return;
        }
        if (!englishName) {
          showToast("தயவுசெய்து ஆங்கில பெயரை உள்ளிடவும் / Please enter English Name", "error");
          return;
        }
        if (isNaN(pricePerKg) || pricePerKg < 0) {
          showToast("தயவுசெய்து சரியான விலையை உள்ளிடவும் / Please enter a valid price", "error");
          return;
        }
        if (isNaN(stockKg) || stockKg < 0) {
          showToast("தயவுசெய்து சரியான ஸ்டாக் அளவை உள்ளிடவும் / Please enter a valid stock quantity", "error");
          return;
        }

        const products = getData('ek_products');
        const idx = products.findIndex(p => p.id === id);
        if (idx === -1) {
          showToast("தயாரிப்பு கண்டறியப்படவில்லை / Product not found", "error");
          return;
        }

        let finalImg = products[idx].imageUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400';
        const oldImageUrl = products[idx].imageUrl || null;

        const useUrlCheck = document.getElementById('edit-prod-use-url')?.checked;
        if (imageUrlInput && (useUrlCheck || !tempProductFile)) {
          finalImg = imageUrlInput;
        }

        if (editProductPhotoDeleted) {
          finalImg = '';
          if (oldImageUrl) {
            deleteStorageImageByUrl(oldImageUrl);
          }
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : "Save Changes / திருத்தங்களை சேமி ✓";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = "Processing... ⏳";
        }

        if (tempProductFile && tempBase64Image && !useUrlCheck) {
          try {
            if (submitBtn) submitBtn.innerHTML = "Uploading Image (0%)... ⏳";
            showToast('மாற்றிய படம் பதிவேற்றப்படுகிறது... ⏳', 'info');

            const resizedBase64 = await resizeImageBeforeUpload(tempBase64Image, 500, 0.75);
            finalImg = await uploadProductImageToStorage(id, tempProductFile, resizedBase64);
          } catch (uploadErr) {
            console.error('[Image Upload Failed]', uploadErr);
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = originalBtnText;
            }
            showToast(uploadErr.message || "Selected image format is not supported.", "error");
            return;
          }
        }

        const currentRevision = products[idx].revision || 0;
        const targetProduct = {
          ...products[idx],
          tamilName, englishName, pricePerKg, stockKg, category, unit,
          sellingUnit: unit,
          price: pricePerKg,
          stock: stockKg,
          isActive: true,
          status: "active",
          shortDescription, foodType, aliases: aliasesList,
          imageUrl: finalImg,
          isSpecial,
          isFreeDeliveryEligible,
          isScheduled, scheduleStart, scheduleEnd,
          availabilityStart: scheduleStart, availabilityEnd: scheduleEnd,
          forceOutOfStock,
          isHidden: false, // Ensure it is visible on customer devices
          updatedAt: new Date().toISOString(),
          revision: currentRevision + 1
        };
        ensureRequiredFields(targetProduct);

        // OPTIMISTIC UI UPDATE: Update local state and show success popup INSTANTLY!
        products[idx] = targetProduct;
        saveData('ek_products', products);
        invalidateDataCache('ek_products');
        window._lastProductsHash = '';
        if (typeof _lastProductsHash !== 'undefined') _lastProductsHash = '';
        if (typeof renderHomeScreenProducts === 'function') {
          renderHomeScreenProducts(true);
        }

        try {
          window.dispatchEvent(new CustomEvent('ek-products-updated', { detail: { action: 'update', product: targetProduct } }));
          window.dispatchEvent(new CustomEvent('refresh-customer-catalog'));
          if (typeof window.refreshActiveProductModalIfOpen === 'function') {
            window.refreshActiveProductModalIfOpen();
          }
        } catch(e) {}

        if (oldImageUrl && oldImageUrl !== finalImg) {
          deleteStorageImageByUrl(oldImageUrl);
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }

        tempProductFile = null;
        tempBase64Image = null;

        closeAdminEditProductModalDetail();
        renderAdminDashboard();
        showToast("Product revised successfully / திருத்தம் சேமிக்கப்பட்டது! ✓", "success");
        showAdminSuccessModal(
          "✏️ வெற்றிகரமாக மாற்றி அமைக்கப்பட்டது!",
          `தயாரிப்பு <strong>${tamilName} (${englishName})</strong> விவரங்கள் வெற்றிகரமாக மாற்றி அமைக்கப்பட்டு உங்கள் கடையில் சேமிக்கப்பட்டது.<br><br><span style="font-size:11.5px;color:var(--text-muted);">Successfully Updated! The product details have been modified.</span>`
        );

        // Background Cloud Sync (Non-blocking)
        if (typeof db !== 'undefined' && db && targetProduct) {
          (async () => {
            try {
              const isPermitted = await verifyAdminWritePermission(`syncProductToCloudWithRetry for ID: ${targetProduct.id}`);
              if (!isPermitted) throw new Error("ADMIN_WRITE_DENIED");
              logProductWriteAudit('update', targetProduct.id, 'syncProductToCloudWithRetry');
              await db.collection('ek_products').doc(targetProduct.id).set(cleanFirestoreData(targetProduct));
              debugLog("✓ Background Firestore Edit Update successful for product:", targetProduct.id);
              removePendingSyncEntry('product', targetProduct.id);
            } catch (syncErr) {
              console.error("Background Firestore sync failed during product edit:", syncErr);
              showToast("Cloud sync pending. Will retry automatically.", "info");
            }
          })();
        }
      } catch (saveError) {
        console.error("Critical error saving edited product:", saveError);
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = "Save Changes / திருத்தங்களை சேமி ✓";
        }
        showToast("பொருளை சேமிப்பதில் பிழை / Error saving product: " + saveError.message, "error");
      }
    }

    function adjustAdminProductStock(id, diff) {
      const products = getData('ek_products');
      const idx = products.findIndex(p => p.id === id);
      if (idx === -1) return;

      products[idx].stockKg = Math.max(0, parseFloat((products[idx].stockKg + diff).toFixed(3)));
      if (products[idx].stockKg > 0) products[idx].isOutOfStock = false;
      products[idx].revision = (products[idx].revision || 0) + 1;
      products[idx].updatedAt = new Date().toISOString();
      ensureRequiredFields(products[idx]);

      saveData('ek_products', products);

      if (typeof db !== 'undefined' && db) {
        logProductWriteAudit('update', id, 'adjustAdminProductStock');
        db.collection('ek_products').doc(id).set(cleanFirestoreData(products[idx]))
          .then(() => debugLog(`[Cloud Sync] Adjusted stock for product ${id} synced with Firestore!`))
          .catch(e => console.error("Cloud stock adjustment sync failed:", e));
      }

      renderAdminProducts();
      showToast(`${products[idx].englishName} stock adjusted by ${diff} ${getUnitDisplay(products[idx].sellingUnit || products[idx].unit, false, diff)}`, "info");
    }

    function toggleAdminProductStockStatus(id) {
      toggleForceOutOfStock(id);
    }

    function deleteProductFromDb(id) {
      const prod = getData('ek_products').find(p => p.id === id);
      const prodName = prod ? prod.englishName : 'product';
      showCustomConfirm(
        "Delete Product?",
        `Are you sure you want to permanently delete the product (<strong>${prodName}</strong>)? This cannot be undone.`,
        function() {
          markProductAsDeleted(id);

          const products = getData('ek_products');
          const filtered = products.filter(p => p.id !== id);

          saveData('ek_products', filtered);
          invalidateDataCache('ek_products');
          if (typeof _lastProductsHash !== 'undefined') _lastProductsHash = '';
          window._lastProductsHash = '';
          if (typeof renderHomeScreenProducts === 'function') {
            renderHomeScreenProducts(true);
          }

          if (typeof db !== 'undefined' && db) {
            showToast("Deleting product from cloud database...", "info");
            logProductWriteAudit('delete', id, 'deleteProductFromDb');
            db.collection('ek_products').doc(id).delete()
              .then(() => {
                debugLog(`[Cloud Sync] Product doc ${id} deleted from Firestore.`);
                showToast("Product deleted from cloud database! ✓", "success");
                let currentDeleted = typeof getDeletedProductIds === 'function' ? getDeletedProductIds() : [];
                if (currentDeleted.length > 500) {
                  currentDeleted = currentDeleted.slice(-500);
                  db.collection('ek_tombstones').doc('ek_deleted_product_ids').set({
                    ids: currentDeleted,
                    updatedAt: new Date().toISOString()
                  })
                  .then(() => debugLog(`[Cloud Sync] Tombstone pruned and synced for deleted product ${id}.`))
                  .catch(err => console.error("Tombstone sync failed:", err));
                } else {
                  db.collection('ek_tombstones').doc('ek_deleted_product_ids').set({
                    ids: firebase.firestore.FieldValue.arrayUnion(id),
                    updatedAt: new Date().toISOString()
                  }, { merge: true })
                  .then(() => debugLog(`[Cloud Sync] Tombstone synced successfully for deleted product ${id}.`))
                  .catch(err => console.error("Tombstone sync failed:", err));
                }
              })
              .catch(e => {
                console.error("Firestore cloud product delete error:", e);
                showToast("Cloud delete failed: " + e.message, "error");
              });
          } else {
            showToast("Product deleted locally (Offline mode) ✓", "success");
          }

          renderAdminProducts();
          showAdminSuccessModal(
            currentLang === 'ta' ? "🗑️ வெற்றிகரமாக நீக்கப்பட்டது!" : "🗑️ Deleted Successfully!",
            currentLang === 'ta' ? `தயாரிப்பு வெற்றிகரமாக உங்களது கடையிலிருந்து நீக்கப்பட்டது.` : `The product has been successfully removed from your store.`
          );
        }
      );
    }

    window.adminActiveCategory = window.adminActiveCategory || 'all';

    window.setAdminProductCategory = function(catId) {
      window.adminActiveCategory = catId;
      renderAdminProducts();
    };

    function renderAdminProducts() {
      const products = getDataCached('ek_products', []);
      const searchInp = document.getElementById('product-search-input');
      const search = searchInp ? searchInp.value.toLowerCase().trim() : '';
      const list = document.getElementById('admin-product-list');
      if (!list) return;

      const filtersDiv = document.getElementById('admin-category-filters');
      if (filtersDiv) {
        const isTa = currentLang === 'ta';
        const catList = getCategoriesList();
        const CATEGORIES = [
          { id: 'all', name: isTa ? 'அனைத்தும்' : 'All Items', icon: '🍽️' },
          ...catList.map(c => {
            const nameEn = c.nameEn || c.en || c.id || 'Category';
            const nameTa = c.nameTa || c.ta || nameEn;
            const icon = c.icon || '🍖';
            return {
              id: c.id,
              name: isTa ? nameTa : nameEn,
              icon: icon
            };
          })
        ];

        filtersDiv.innerHTML = CATEGORIES.map(cat => {
          const isActive = window.adminActiveCategory === cat.id;
          return `
            <button type="button" class="pill ${isActive ? 'active' : ''}" style="flex:0 0 auto; font-size:12px; padding:6px 14px; height:32px; min-height:32px;" onclick="setAdminProductCategory('${cat.id}')">
              <span>${cat.icon}</span> <span>${cat.name}</span>
            </button>
          `;
        }).join('');
      }

      let filtered = products;
      if (window.adminActiveCategory && window.adminActiveCategory !== 'all') {
        const adminActiveCatLower = window.adminActiveCategory.toLowerCase().trim();
        filtered = filtered.filter(p => (p.category || '').toLowerCase().trim() === adminActiveCatLower);
      }
      if (search) {
        filtered = filtered.filter(p => {
          const enName = (p.englishName || '').toLowerCase();
          const taName = (p.tamilName || '').toLowerCase();
          const cat = (p.category || '').toLowerCase();
          let customMatch = false;
          if (search === 'mutton' || search === 'மட்டன்' || search === 'ஆடு' || search === 'goat') {
            customMatch = cat.includes('mutton') || enName.includes('mutton') || taName.includes('ஆடு') || taName.includes('மட்டன்');
          } else if (search === 'chicken' || search === 'சிக்கன்' || search === 'கோழி') {
            customMatch = cat.includes('chicken') || enName.includes('chicken') || taName.includes('கோழி') || taName.includes('சிக்கன்');
          } else if (search === 'fish' || search === 'மீன்') {
            customMatch = cat.includes('fish') || enName.includes('fish') || taName.includes('மீன்');
          } else if (search === 'beef' || search === 'மாடு' || search === 'மாட்டிறைச்சி') {
            customMatch = cat.includes('beef') || enName.includes('beef') || taName.includes('மாடு') || taName.includes('மாட்டிறைச்சி');
          }
          return enName.includes(search) || taName.includes(search) || cat.includes(search) || customMatch;
        });
      }

      let listHtml = '';
      filtered.forEach(p => {
        updateProductAvailability(p);

        let scColor = "var(--accent-green)";
        if (p.stockKg < 2) scColor = "var(--accent-red)";
        else if (p.stockKg <= 5) scColor = "var(--accent-orange)";

        const specialBadgeHtml = p.isSpecial ? `<span class="badge" style="background:rgba(245,158,11,0.2); color:var(--accent-orange); font-size:9px;">Today's Special ⭐</span>` : '';
        const availLabel = getProductAvailabilityLabel(p);
        const outStatusHtml = p.isOutOfStock ? `<div style="background:var(--accent-red); font-size:10px; font-weight:800; color:#000; text-align:center; padding:3px;">OUT OF STOCK (${p.forceOutOfStock ? 'EMERGENCY OVERRIDE' : (p.stockKg <= 0 ? 'NO STOCK' : 'OUTSIDE TIMING WINDOW')})</div>` : '';

        const item = `
          <div class="card" style="padding:0; overflow:hidden; border-color:#2c2c2c; margin-bottom:12px; position:relative;">
            <div style="display:flex; align-items:stretch; padding:8px 10px; gap:10px;">
              <img src="${getImageUrlWithCacheBuster(getProductThumbnailUrl(p), p.updatedAt)}" width="72" height="72" style="width:72px; height:72px; object-fit:cover; border-radius:10px; border:1px solid #222;" alt="" loading="lazy" decoding="async">
              <div style="flex-grow:1; display:flex; flex-direction:column; justify-content:space-between; min-width:0;">
                <div>
                  <h4 style="font-size:13.5px; font-weight:700; color:#fff; display:flex; flex-wrap:wrap; align-items:center; gap:4px; margin:0; line-height:1.2;">
                    ${p.tamilName} ${specialBadgeHtml}
                  </h4>
                  <p style="font-size:10.5px; color:var(--text-secondary); margin:1px 0 0 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.englishName} | Category: <strong style="color:var(--accent-orange);">${p.category}</strong></p>
                  <div style="font-size:10.5px; font-weight:700; color:${p.forceOutOfStock ? '#ff4a4a' : (p.isScheduled && (p.availabilityStart || p.scheduleStart) ? '#eab308' : '#2dd4bf')}; margin-top:3px; display:flex; align-items:center; gap:4px;">
                    ${availLabel}
                  </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; gap:8px; min-width:0;">
                  <div style="display:flex; align-items:center; gap:8px; white-space:nowrap; overflow-x:auto;">
                    <strong style="font-size:13px; color:var(--accent-green); white-space:nowrap;">${getProductPriceText(p, 'en')}</strong>
                    <span style="font-size:11px; color:var(--text-secondary);">•</span>
                    <div style="font-size:10.5px; color:${scColor}; font-weight:700; white-space:nowrap;">Stock: ${getProductStockText(p, 'en')}</div>
                  </div>

                  <!-- Emergency Out-of-Stock Override Button -->
                  <button class="btn" style="padding:4px 8px; font-size:10px; font-weight:800; border-radius:10px; transition:all 0.18s cubic-bezier(0.16, 1, 0.3, 1); background:${p.forceOutOfStock ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}; color:${p.forceOutOfStock ? '#ff4a4a' : '#9ca3af'}; border:1.5px solid ${p.forceOutOfStock ? '#ff4a4a' : 'rgba(255,255,255,0.15)'}; display:inline-flex; align-items:center; justify-content:center; gap:3px; height:26px; flex-shrink:0;" onclick="toggleForceOutOfStock('${p.id}')">
                    ${p.forceOutOfStock ? '🚨 Emergency Out: ON' : '🚨 Emergency Out'}
                  </button>
                </div>
              </div>
            </div>

            ${outStatusHtml}

            <!-- Cleaned quick adjusters footer layout -->
            <div style="background:#111; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #1f1f1f; padding:5px 10px; gap:6px;">
              <div style="display:flex; gap:4px;">
                <button class="btn btn-secondary" style="min-width:36px; min-height:36px; height:36px; padding:0 6px; font-size:11.5px; font-weight:800; border-radius:8px;" onclick="adjustAdminProductStock('${p.id}', -5)">-5</button>
                <button class="btn btn-secondary" style="min-width:36px; min-height:36px; height:36px; padding:0 6px; font-size:11.5px; font-weight:800; border-radius:8px;" onclick="adjustAdminProductStock('${p.id}', -1)">-1</button>
                <button class="btn btn-secondary" style="min-width:36px; min-height:36px; height:36px; padding:0 6px; font-size:11.5px; font-weight:800; border-radius:8px;" onclick="adjustAdminProductStock('${p.id}', 1)">+1</button>
                <button class="btn btn-secondary" style="min-width:36px; min-height:36px; height:36px; padding:0 6px; font-size:11.5px; font-weight:800; border-radius:8px;" onclick="adjustAdminProductStock('${p.id}', 5)">+5</button>
              </div>

              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn btn-secondary" style="padding:8px 14px; font-size:12px; font-weight:700; min-height:40px; height:40px; display:inline-flex; align-items:center; gap:6px; border-radius:10px;" onclick="editProductForm('${p.id}')">✏️ Edit</button>
                <button class="btn btn-secondary" style="padding:8px 12px; font-size:13px; font-weight:700; border-color:rgba(239,68,68,0.4); background:rgba(239,68,68,0.08); color:#ef4444; min-height:40px; height:40px; min-width:40px; display:inline-flex; align-items:center; justify-content:center; border-radius:10px;" onclick="deleteProductFromDb('${p.id}')">❌</button>
              </div>
            </div>
          </div>
        `;
        listHtml += item;
      });
      list.innerHTML = listHtml;
    }

    function onSalaryTypeChange() {
      const type = document.getElementById('add-exec-salary-type').value;
      const rateLabel = document.getElementById('exec-rate-label');
      const helpText = document.getElementById('salary-help-text');
      const rateInput = document.getElementById('add-exec-salary-rate');

      if (type === 'per_order') {
        rateLabel.innerHTML = currentLang === 'ta' ? 'ஒரு ஆர்டருக்கான தொகை (₹)' : 'Amount per Order (₹)';
        rateInput.placeholder = 'e.g. 35';
        helpText.innerHTML = 'Rider is paid directly for <strong>every completed delivery order</strong>.';
      } else if (type === 'fixed') {
        rateLabel.innerHTML = currentLang === 'ta' ? 'மாதச் சம்பளம் (₹)' : 'Fixed Monthly Salary (₹)';
        rateInput.placeholder = 'e.g. 15000';
        helpText.innerHTML = 'Rider is configured on a <strong>fixed monthly salary</strong> model.';
      } else if (type === 'commission') {
        rateLabel.innerHTML = currentLang === 'ta' ? 'கமிஷன் சதவீதம் (%)' : 'Commission Percentage (%)';
        rateInput.placeholder = 'e.g. 10';
        helpText.innerHTML = 'Rider earns <strong>a percentage of each order value</strong> delivered.';
      } else if (type === 'per_km') {
        rateLabel.innerHTML = currentLang === 'ta' ? 'ஒரு கிலோமீட்டருக்கான தொகை (₹)' : 'Rate per KM (₹)';
        rateInput.placeholder = 'e.g. 8';
        helpText.innerHTML = 'Rider is paid <strong>based on delivery distance in kilometers</strong>.';
      }
    }

    async function triggerRiderPasswordReset() {
      const execId = document.getElementById('edit-exec-id').value;
      if (!execId) {
        showToast("Please select a delivery partner first / முதலில் ஒரு டெலிவரி நபரைத் தேர்ந்தெடுக்கவும்.", "error");
        return;
      }
      const list = getData('ek_delivery_persons', []);
      const exec = list.find(e => e.id === execId);
      if (!exec) {
        showToast("Rider not found.", "error");
        return;
      }
      const email = exec.authEmail || exec.email || `delivery_${exec.phone}@edappadikadai.app`;
      try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
          await firebase.auth().sendPasswordResetEmail(email);
          showToast(currentLang === 'ta' ? "கடவுச்சொல் மீட்டமைப்பு மின்னஞ்சல் அனுப்பப்பட்டது! ✓" : "Password reset email sent successfully! ✓", "success");
        } else {
          showToast("Firebase Auth not loaded.", "error");
        }
      } catch (err) {
        console.error("Error sending password reset email:", err);
        showToast(err.message, "error");
      }
    }

    async function repairRiderLoginAccount() {
      const execId = document.getElementById('edit-exec-id').value;
      if (!execId) {
        showToast("Please select a delivery partner first / முதலில் ஒரு டெலிவரி நபரைத் தேர்ந்தெடுக்கவும்.", "error");
        return;
      }
      const list = getData('ek_delivery_persons', []);
      const exec = list.find(e => e.id === execId);
      if (!exec) {
        showToast("Rider not found.", "error");
        return;
      }

      const confirmMessage = currentLang === 'ta'
        ? `இது இந்த டெலிவரி பார்ட்னரின் கணக்கை பழுதுபார்க்கும். பழைய தகவல்கள் மற்றும் ஆர்டர்கள் எதுவும் அழியாது. தொடரவா?`
        : `This will check and repair the Firebase Authentication account for this delivery partner, ensuring it is correctly linked to their Firestore profile. It will not delete their profile data or orders. Proceed?`;

      if (!confirm(confirmMessage)) return;

      showToast(currentLang === 'ta' ? "பழுதுபார்க்கப்படுகிறது... தயவுசெய்து காத்திருக்கவும்." : "Repairing account... Please wait.", "info");

      try {
        const repairFn = getCloudFunction('repairDeliveryPartner');
        const res = await repairFn({ targetId: execId });
        debugLog("[Rider Repair] Cloud Function result:", res);

        if (res && res.data && res.data.success) {
          const resultData = res.data;

          showToast(currentLang === 'ta' ? "பழுதுநீக்கம் வெற்றிகரமாக முடிந்தது! ✓" : "Account repaired successfully! ✓", "success");

          showAdminSuccessModal(
            "🛠️ Account Repaired / கணக்கு சரிசெய்யப்பட்டது!",
            `Delivery Partner: <strong>${exec.name}</strong><br>` +
            `Final Firebase Auth UID: <strong>${resultData.uid}</strong><br>` +
            `Firebase Email: <strong>${resultData.email}</strong><br>` +
            `Action taken: <strong>${resultData.action}</strong><br>` +
            `<strong>Repair Status: PASS</strong><br><br>` +
            `Please use 'Send Password Reset Link' to set a new password for the rider.`
          );

          try {
            const deliverySnap = await db.collection('ek_delivery_persons').get();
            const normalizedRiders = [];
            deliverySnap.forEach(d => {
              normalizedRiders.push(normalizeFirestoreData({ id: d.id, ...d.data() }));
            });
            saveData('ek_delivery_persons', normalizedRiders);
            if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.saveData === 'function') {
              AndroidStorage.saveData('ek_delivery_persons', JSON.stringify(normalizedRiders));
            }
            renderDeliveryExecutives();
          } catch (syncErr) {
            console.error("Local riders sync error:", syncErr);
          }

          resetDeliveryForm();
        } else {
          showToast("Repair failed: Invalid response", "error");
        }
      } catch (err) {
        console.error("Error repairing rider login account:", err);
        showToast("Repair error: " + err.message, "error");
      }
    }

    let selectedRiderFile = null;
    let selectedRiderFileBase64 = null;

    function handleRiderFileSelected(event) {
      const file = event.target.files[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showToast("Supported formats: JPG, JPEG, PNG, WEBP.", "error");
        return;
      }

      selectedRiderFile = file;

      const reader = new FileReader();
      reader.onload = function(e) {
        selectedRiderFileBase64 = e.target.result;
        document.getElementById('rider-photo-preview').src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    function toggleRiderPhotoUrlInput() {
      const urlInput = document.getElementById('add-exec-photo');
      const link = document.getElementById('toggle-photo-url-link');
      if (urlInput.style.display === 'none') {
        urlInput.style.display = 'block';
        link.innerText = "Use Device Upload instead";
      } else {
        urlInput.style.display = 'none';
        link.innerText = "Use Image URL instead";
      }
    }

    function updateRiderPreviewFromUrl() {
      const urlVal = document.getElementById('add-exec-photo').value.trim();
      if (urlVal) {
        document.getElementById('rider-photo-preview').src = urlVal;
      } else {
        document.getElementById('rider-photo-preview').src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2310b981'/><circle cx='50' cy='38' r='18' fill='%23ffffff'/><path d='M20 82 c0 -18 13 -30 30 -30 s30 12 30 30 z' fill='%23ffffff'/></svg>";
      }
    }

    function handleFormDeleteRider() {
      const execId = document.getElementById('edit-exec-id').value;
      if (execId) {
        deleteExecutive(execId);
      }
    }

    async function handleDeliverySave(event) {
      event.preventDefault();
      const execId = document.getElementById('edit-exec-id').value;
      const name = document.getElementById('add-exec-name').value.trim();
      const rawPhone = document.getElementById('add-exec-phone').value.trim();
      const phone = rawPhone.replace(/\D/g, '').slice(-10);

      if (phone.length !== 10) {
        showToast("Phone number must be exactly 10 digits / தொலைபேசி எண் 10 இலக்கங்களாக இருக்க வேண்டும்.", "error");
        return;
      }

      const authEmail = `rider_${phone}@lyo.delivery`;
      const salaryType = document.getElementById('add-exec-salary-type').value;
      const salaryRate = parseFloat(document.getElementById('add-exec-salary-rate').value || 35);
      const vehicleNo = document.getElementById('add-exec-vehicle') ? document.getElementById('add-exec-vehicle').value.trim() : '';
      const isActive = document.getElementById('add-exec-active') ? document.getElementById('add-exec-active').checked : true;

      let photoUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2310b981'/><circle cx='50' cy='38' r='18' fill='%23ffffff'/><path d='M20 82 c0 -18 13 -30 30 -30 s30 12 30 30 z' fill='%23ffffff'/></svg>";

      const list = getData('ek_delivery_persons', []) || [];

      const duplicate = list.find(e => {
        const existingClean = (e.phone || "").replace(/\D/g, '').slice(-10);
        return existingClean === phone && e.id !== execId;
      });
      if (duplicate) {
        showToast("This delivery partner already exists. Use Edit.", "error");
        return;
      }

      let password = "";
      if (!execId) {
        password = document.getElementById('add-exec-pass').value;
        if (!password) {
          showToast("Password is required.", "error");
          return;
        }
        if (password.length < 6) {
          showToast("Password must be at least 6 characters.", "error");
          return;
        }
      }

      let uid = execId;
      let tempAppCreated = false;
      let tempApp = null;

      const submitBtn = document.getElementById('exec-submit-btn');
      const originalBtnText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = "Processing... ⏳";

      if (!execId) {
        if (typeof firebase !== 'undefined' && firebase.auth) {
          showToast("Creating Firebase Auth account... / கணக்கு உருவாக்கப்படுகிறது...", "info");
          const tempAppName = "TempApp_" + Date.now();
          tempApp = firebase.initializeApp(firebaseConfig, tempAppName);
          tempAppCreated = true;
          try {
            const authUserCredential = await tempApp.auth().createUserWithEmailAndPassword(authEmail, password);
            uid = authUserCredential.user.uid;
            debugLog("[Firebase Auth] Delivery partner created. UID:", uid);
          } catch (authErr) {
            console.error("[Firebase Auth] Account creation failed:", authErr);
            if (authErr.code === 'auth/email-already-in-use') {
              showToast("This delivery partner already exists in Auth. Use Edit.", "error");
            } else {
              showToast("Auth Error: " + authErr.message, "error");
            }
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
            try { await tempApp.delete(); } catch(e) {}
            return;
          }
        } else {
          showToast("Firebase Auth not loaded.", "error");
          submitBtn.disabled = false;
          submitBtn.innerText = originalBtnText;
          return;
        }
      }

      if (selectedRiderFile && selectedRiderFileBase64) {
        const progressEl = document.getElementById('rider-photo-upload-progress');
        if (progressEl) {
          progressEl.style.display = 'block';
          progressEl.innerText = "Uploading: 0% ⏳";
        }
        try {
          const resizedBase64 = await resizeImageBeforeUpload(selectedRiderFileBase64, 500, 0.75);
          const timestamp = Date.now();
          const safeName = selectedRiderFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const uploadPath = `rider_profiles/${uid}/${timestamp}_${safeName}`;

          const storage = firebase.storage();
          const imageRef = storage.ref().child(uploadPath);
          const metadata = {
            contentType: selectedRiderFile.type || 'image/jpeg'
          };
          const blob = dataURLtoBlob(resizedBase64);
          if (!blob) throw new Error("BLOB_CONVERSION_FAILED");

          let progressStarted = false;
          let progressTimer = null;

          const uploadPromise = new Promise((resolve, reject) => {
            const uploadTask = imageRef.put(blob, metadata);

            progressTimer = setTimeout(() => {
              if (!progressStarted) {
                console.warn("[Profile Photo Storage] Upload did not start (stuck at 0%). Canceling and falling back...");
                try { uploadTask.cancel(); } catch (e) {}
                reject(new Error("UPLOAD_STUCK_AT_0"));
              }
            }, 3000); // 3s quick failover if stuck

            uploadTask.on('state_changed',
              (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (progress > 0) {
                  progressStarted = true;
                  if (progressTimer) {
                    clearTimeout(progressTimer);
                    progressTimer = null;
                  }
                }
                if (progressEl) {
                  progressEl.innerText = `Uploading: ${progress}% ⏳`;
                }
              },
              (error) => {
                if (progressTimer) clearTimeout(progressTimer);
                reject(error);
              },
              () => {
                if (progressTimer) clearTimeout(progressTimer);
                imageRef.getDownloadURL().then(url => resolve(ensureCacheBustingUrl(url))).catch(reject);
              }
            );
          });

          const maxTimeout = setTimeout(() => {
            console.warn("[Profile Photo Storage] Maximum timeout reached. Falling back to local Base64.");
            if (progressTimer) clearTimeout(progressTimer);
          }, 8000);

          let downloadUrl;
          try {
            downloadUrl = await uploadPromise;
            clearTimeout(maxTimeout);
          } catch (uploadErr) {
            clearTimeout(maxTimeout);
            console.warn("[Profile Photo Storage] Failed or timed out, falling back to base64:", uploadErr);
            showToast("சுயவிவரப் படம் ஆஃப்லைன் முறையில் வெற்றிகரமாக சேமிக்கப்பட்டது! / Profile photo processed & saved offline!", "info");
            downloadUrl = resizedBase64;
          }

          if (progressEl) {
            progressEl.innerText = "Upload Completed! ✓";
            setTimeout(() => { progressEl.style.display = 'none'; }, 2000);
          }

          const oldUrl = document.getElementById('add-exec-photo').value.trim();
          if (execId && oldUrl && oldUrl.includes("firebasestorage.googleapis.com")) {
            try {
              const oldRef = firebase.storage().refFromURL(oldUrl);
              await oldRef.delete();
              debugLog("[Storage] Old photo deleted successfully.");
            } catch (delErr) {
              console.warn("[Storage] Failed to delete old photo (might not exist):", delErr);
            }
          }

          photoUrl = downloadUrl;
        } catch (uploadErr) {
          console.error("Profile photo processing failed:", uploadErr);
          showToast("Profile photo processing error. Using fallback.", "warning");
          if (progressEl) progressEl.style.display = 'none';
          photoUrl = selectedRiderFileBase64; // robust final fallback
        }
      } else {
        const existingUrl = document.getElementById('add-exec-photo').value.trim();
        photoUrl = existingUrl || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2310b981'/><circle cx='50' cy='38' r='18' fill='%23ffffff'/><path d='M20 82 c0 -18 13 -30 30 -30 s30 12 30 30 z' fill='%23ffffff'/></svg>";
      }

      if (tempAppCreated && tempApp) {
        try { await tempApp.delete(); } catch(e) {}
      }

      let firestoreCreatedAt = firebase.firestore.FieldValue.serverTimestamp();
      const existingRider = list.find(e => e.id === execId);
      if (execId && existingRider && existingRider.createdAt) {
        firestoreCreatedAt = existingRider.createdAt;
      }

      const riderDoc = {
        uid: uid,
        role: "RIDER",
        name: name,
        phone: phone,
        email: authEmail,
        vehicleNo: vehicleNo,
        vehicle: vehicleNo,
        photoUrl: photoUrl,
        photo: photoUrl,
        isActive: isActive,
        payoutType: salaryType.toUpperCase(),
        salaryType: salaryType.toLowerCase(),
        payoutAmount: salaryRate,
        salaryRate: salaryRate,
        createdAt: firestoreCreatedAt,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (typeof db !== 'undefined' && db) {
        try {
          await db.collection('users').doc(uid).set(riderDoc);

          const localCreatedAt = (existingRider && existingRider.createdAt)
            ? (typeof existingRider.createdAt.toISOString === 'function' ? existingRider.createdAt.toISOString() : existingRider.createdAt)
            : new Date().toISOString();

          const compatRider = {
            ...riderDoc,
            id: uid,
            isActiveRider: isActive,
            active: isActive,
            salaryType: salaryType.toLowerCase(),
            salaryRate: salaryRate,
            authEmail: authEmail,
            createdAt: localCreatedAt,
            updatedAt: new Date().toISOString()
          };
          await db.collection('ek_delivery_persons').doc(uid).set(compatRider);

          try { publishPublicStaffDirectory(); } catch(pErr) {}
        } catch (err) {
          console.error("Rider cloud sync error:", err);
          showToast("Firestore save failed: " + err.message, "error");
          submitBtn.disabled = false;
          submitBtn.innerText = originalBtnText;
          return;
        }
      }

      const filteredList = list.filter(e => e.id !== uid);
      const localCreatedAt = (existingRider && existingRider.createdAt)
        ? (typeof existingRider.createdAt.toISOString === 'function' ? existingRider.createdAt.toISOString() : existingRider.createdAt)
        : new Date().toISOString();

      const compatObj = {
        ...riderDoc,
        id: uid,
        isActiveRider: isActive,
        active: isActive,
        salaryType: salaryType.toLowerCase(),
        salaryRate: salaryRate,
        authEmail: authEmail,
        createdAt: localCreatedAt,
        updatedAt: new Date().toISOString()
      };
      filteredList.push(compatObj);
      saveData('ek_delivery_persons', filteredList);

      try {
        unmarkRiderAsDeleted(uid);
      } catch (unmarkErr) {
        console.warn("[Rider System] Failed to unmark rider from deleted list:", unmarkErr);
      }

      submitBtn.disabled = false;
      submitBtn.innerText = originalBtnText;

      resetDeliveryForm();
      renderDeliveryExecutives();
      showToast(execId ? "Rider details successfully updated! ✓" : "Delivery partner created successfully.", "success");
    }

    function editExecutiveForm(id) {
      const list = getData('ek_delivery_persons', []);
      const exec = list.find(e => e.id === id);
      if (!exec) return;

      document.getElementById('edit-exec-id').value = exec.id;
      document.getElementById('add-exec-name').value = exec.name;
      document.getElementById('add-exec-phone').value = exec.phone;
      document.getElementById('add-exec-salary-type').value = exec.payoutType || exec.salaryType || 'per_order';
      document.getElementById('add-exec-salary-rate').value = exec.payoutAmount || exec.salaryRate || 35;
      document.getElementById('add-exec-vehicle').value = exec.vehicleNo || exec.vehicle || '';
      document.getElementById('add-exec-photo').value = exec.photoUrl || exec.photo || '';

      const isActiveVal = exec.isActive !== false && exec.active !== false && exec.isActiveRider !== false;
      document.getElementById('add-exec-active').checked = isActiveVal;
      document.getElementById('active-status-text').innerText = isActiveVal ? "Active (உள்நுழையலாம்)" : "Inactive (உள்நுழைய முடியாது)";

      document.getElementById('rider-photo-preview').src = exec.photoUrl || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2310b981'/><circle cx='50' cy='38' r='18' fill='%23ffffff'/><path d='M20 82 c0 -18 13 -30 30 -30 s30 12 30 30 z' fill='%23ffffff'/></svg>";

      document.getElementById('admin-delivery-form-title').innerText = "✏️ Edit Delivery Partner Details";
      document.getElementById('exec-submit-btn').innerText = currentLang === 'ta' ? "சேமி ✓" : "Save Changes ✓";
      document.getElementById('exec-cancel-btn').style.display = 'block';
      document.getElementById('exec-delete-btn').style.display = 'block';

      const passGroup = document.getElementById('exec-password-group');
      if (passGroup) passGroup.style.display = 'none';
      const passInput = document.getElementById('add-exec-pass');
      if (passInput) {
        passInput.removeAttribute('required');
        passInput.value = '';
      }

      onSalaryTypeChange();

      document.getElementById('admin-delivery-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function resetDeliveryForm() {
      document.getElementById('edit-exec-id').value = '';
      document.getElementById('admin-delivery-form').reset();
      document.getElementById('admin-delivery-form-title').innerText = "Register New Delivery Partner";
      document.getElementById('exec-submit-btn').innerText = "Register Rider ✓";
      document.getElementById('exec-cancel-btn').style.display = 'none';
      document.getElementById('exec-delete-btn').style.display = 'none';

      const passGroup = document.getElementById('exec-password-group');
      if (passGroup) passGroup.style.display = 'block';
      const passInput = document.getElementById('add-exec-pass');
      if (passInput) passInput.setAttribute('required', 'required');

      selectedRiderFile = null;
      selectedRiderFileBase64 = null;
      document.getElementById('add-exec-file').value = '';
      document.getElementById('rider-photo-preview').src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2310b981'/><circle cx='50' cy='38' r='18' fill='%23ffffff'/><path d='M20 82 c0 -18 13 -30 30 -30 s30 12 30 30 z' fill='%23ffffff'/></svg>";

      onSalaryTypeChange();
    }

    function toggleExecutiveStatus(id) {
      const list = getData('ek_delivery_persons', []);
      const idx = list.findIndex(e => e.id === id);
      if (idx === -1) return;

      const newActive = !list[idx].isActive;
      list[idx].isActive = newActive;
      list[idx].isActiveRider = newActive; // compatibility
      list[idx].active = newActive;        // compatibility
      list[idx].updatedAt = new Date().toISOString();
      saveData('ek_delivery_persons', list);

      if (typeof db !== 'undefined' && db) {
        db.collection('users').doc(id).update({
          isActive: newActive,
          updatedAt: new Date().toISOString()
        })
        .then(() => {
          try { publishPublicStaffDirectory(); } catch(pErr) {}
        })
        .catch(err => {
          console.error("Failed to update status in users:", err);
          db.collection('users').doc(id).set({
            isActive: newActive,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        });
      }

      renderDeliveryExecutives();
      showToast(`Status toggled for delivery partner.`, "info");
    }

    function loadAdminSettings() {
      try {
        if (typeof renderAdminUpiSettings === 'function') renderAdminUpiSettings();
        if (typeof renderAdminAccountsSettings === 'function') renderAdminAccountsSettings();
        if (typeof loadAdminLyoAiConfig === 'function') loadAdminLyoAiConfig();
        if (typeof loadAdminAiKeyConfig === 'function') loadAdminAiKeyConfig();
      } catch(e) {
        console.warn("loadAdminSettings error:", e);
      }
    }

    function renderAdminUpiSettings(force = false) {
      if (typeof initializeOrFixUpiSettings === 'function') {
        try { initializeOrFixUpiSettings(); } catch(e) {}
      }

      const settings = typeof getDataCached === 'function' ? getDataCached('ek_settings', DEFAULT_SETTINGS) : {};
      const upiSettings = settings.upiSettings || { upiEnabled: true, currency: 'INR', accounts: [] };

      const elGlobalEnabled = document.getElementById('upi-global-enabled');
      if (elGlobalEnabled) {
        elGlobalEnabled.value = String(upiSettings.upiEnabled !== false);
      }

      const badgeEl = document.getElementById('admin-upi-status-badge');
      if (badgeEl) {
        if (upiSettings.upiEnabled !== false) {
          badgeEl.innerText = 'Enabled';
          badgeEl.style.background = 'rgba(16,185,129,0.1)';
          badgeEl.style.borderColor = 'rgba(16,185,129,0.2)';
          badgeEl.style.color = '#10b981';
        } else {
          badgeEl.innerText = 'Disabled';
          badgeEl.style.background = 'rgba(239,68,68,0.1)';
          badgeEl.style.borderColor = 'rgba(239,68,68,0.2)';
          badgeEl.style.color = '#ef4444';
        }
      }

      const container = document.getElementById('upi-accounts-container');
      if (container) {
        const accounts = upiSettings.accounts || [
          { id: 'primary', label: 'Primary UPI', upiId: '8778148899@ptyes', merchantName: 'Edappadi Kadai', displayName: 'Anantharaj Primary', note: 'Order {id} - Edappadi Kadai', isActive: true },
          { id: 'backup1', label: 'Backup UPI 1', upiId: 'einsteinananth24-4@okicici', merchantName: 'Edappadi Kadai', displayName: 'Backup UPI 1', note: 'Order {id} - Edappadi Kadai', isActive: true },
          { id: 'backup2', label: 'Backup UPI 2', upiId: '', merchantName: 'Edappadi Kadai', displayName: 'Backup UPI 2', note: 'Order {id} - Edappadi Kadai', isActive: false }
        ];

        container.innerHTML = accounts.map(acc => {
          const isPrimary = acc.id === 'primary';
          const isBackup1 = acc.id === 'backup1';
          const badgeText = isPrimary ? '🥇 Primary UPI Account / முதன்மை கணக்கு' : (isBackup1 ? '🥈 Failover Backup 1 / மாற்று கணக்கு 1' : '🥉 Failover Backup 2 / மாற்று கணக்கு 2');
          const accentColor = isPrimary ? '#c084fc' : (isBackup1 ? '#38bdf8' : '#f59e0b');

          return `
            <div style="background: rgba(15,23,42,0.6); border: 1.5px solid ${accentColor}40; border-radius: 12px; padding: 14px; position: relative;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                <span style="font-size: 12.5px; font-weight: 800; color: ${accentColor}; display: flex; align-items: center; gap: 6px;">
                  ${badgeText}
                </span>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px; font-weight: 700; color: #e2e8f0;">
                  <span>Active:</span>
                  <input type="checkbox" id="upi-acc-${acc.id}-active" ${acc.isActive !== false ? 'checked' : ''} onchange="saveAdminUpiSettings()" style="width: 18px; height: 18px; accent-color: ${accentColor}; cursor: pointer;">
                </label>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 11px; font-weight: 700; color: #94a3b8;">UPI VPA / ID (e.g. username@bank)</label>
                  <input type="text" id="upi-acc-${acc.id}-upi-id" value="${(acc.upiId || '').replace(/"/g, '&quot;')}" placeholder="e.g. 8778148899@ptyes" class="form-control" style="font-size: 12.5px; height: 38px; font-weight: 700; background: #000; color: ${accentColor}; border: 1px solid ${accentColor}50;" onchange="saveAdminUpiSettings(); updateAdminUpiQrPreview();">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 11px; font-weight: 700; color: #94a3b8;">Merchant Name / வணிகர் பெயர்</label>
                  <input type="text" id="upi-acc-${acc.id}-merchant-name" value="${(acc.merchantName || 'Edappadi Kadai').replace(/"/g, '&quot;')}" placeholder="e.g. Edappadi Kadai" class="form-control" style="font-size: 12px; height: 38px; background: #000;" onchange="saveAdminUpiSettings(); updateAdminUpiQrPreview();">
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 10.5px; color: #64748b;">Display Label / லேபிள்</label>
                  <input type="text" id="upi-acc-${acc.id}-display-name" value="${(acc.displayName || '').replace(/"/g, '&quot;')}" placeholder="Display Name" class="form-control" style="font-size: 11.5px; height: 36px; background: #0f172a;" onchange="saveAdminUpiSettings()">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 10.5px; color: #64748b;">Txn Note Template ({id})</label>
                  <input type="text" id="upi-acc-${acc.id}-note" value="${(acc.note || 'Order {id} - Edappadi Kadai').replace(/"/g, '&quot;')}" placeholder="Order {id} - Edappadi Kadai" class="form-control" style="font-size: 11.5px; height: 36px; background: #0f172a;" onchange="saveAdminUpiSettings()">
                </div>
              </div>
            </div>
          `;
        }).join('');
      }

      const elUpiQrUrl = document.getElementById('setting-upi-qr-url');
      if (elUpiQrUrl) elUpiQrUrl.value = settings.upiQrUrl || '';

      if (typeof updateAdminUpiQrPreview === 'function') {
        try { updateAdminUpiQrPreview(); } catch(e) {}
      }
    }
    window.renderAdminUpiSettings = renderAdminUpiSettings;

    async function saveAdminSettings() {
      try {
        const settings = typeof getSettings === 'function' ? getSettings() : (getData('ek_settings', typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS : {}) || {});

        const elShopOpen = document.getElementById('setting-shop-open');
        if (elShopOpen) settings.shopOpen = elShopOpen.checked;

        const elLeaveMode = document.getElementById('setting-leave-mode');
        if (elLeaveMode) settings.leaveMode = elLeaveMode.checked;

        const elLeaveNotice = document.getElementById('setting-leave-notice');
        if (elLeaveNotice) settings.leaveNotice = elLeaveNotice.value.trim();

        const elDelCharge = document.getElementById('setting-delivery-charge');
        if (elDelCharge && elDelCharge.value !== '') settings.deliveryCharge = parseFloat(elDelCharge.value) || 0;

        const elDynDel = document.getElementById('setting-dynamic-delivery');
        if (elDynDel) settings.useDynamicDistancePricing = elDynDel.checked;

        const elDelBase = document.getElementById('setting-delivery-base-price');
        if (elDelBase && elDelBase.value !== '') settings.deliveryBasePrice = parseFloat(elDelBase.value) || 0;

        const elDelKm = document.getElementById('setting-delivery-km-multiplier');
        if (elDelKm && elDelKm.value !== '') settings.deliveryKmMultiplier = parseFloat(elDelKm.value) || 0;

        const elRainMode = document.getElementById('setting-rain-mode');
        if (elRainMode) {
          settings.rainMode = elRainMode.checked;
          settings.rainSurchargeEnabled = elRainMode.checked;
        }

        const elRainCharge = document.getElementById('setting-rain-charge');
        if (elRainCharge && elRainCharge.value !== '') {
          const rc = parseFloat(elRainCharge.value) || 0;
          settings.rainCharge = rc;
          settings.rainSurchargeFee = rc;
        }

        const elMinWt = document.getElementById('setting-min-weight');
        if (elMinWt && elMinWt.value !== '') settings.minOrderWeight = parseFloat(elMinWt.value) || 0;

        const elMinAmt = document.getElementById('setting-min-amount');
        if (elMinAmt && elMinAmt.value !== '') settings.minOrderAmount = parseFloat(elMinAmt.value) || 0;

        const elMinAppVer = document.getElementById('setting-min-app-version');
        if (elMinAppVer && elMinAppVer.value) settings.minAppVersion = elMinAppVer.value.trim();

        const elRecAppVer = document.getElementById('setting-recommended-app-version');
        if (elRecAppVer && elRecAppVer.value) settings.recommendedVersion = elRecAppVer.value.trim();

        const elPlayUrl = document.getElementById('setting-playstore-url');
        if (elPlayUrl && elPlayUrl.value) settings.playStoreUrl = elPlayUrl.value.trim();

        const elPrivacyUrl = document.getElementById('setting-privacy-policy-url');
        if (elPrivacyUrl && elPrivacyUrl.value) settings.privacyPolicyUrl = elPrivacyUrl.value.trim();

        settings.updatedAt = new Date().toISOString();
        settings._isAdminModified = true;

        saveData('ek_settings', settings);

        if (typeof db !== 'undefined' && db) {
          const cleanObj = typeof cleanFirestoreData === 'function' ? cleanFirestoreData(settings) : settings;
          await db.collection('ek_settings').doc('global_config').set(cleanObj, { merge: true }).catch(err => console.warn("Firestore settings global_config notice:", err));
          await db.collection('ek_settings').doc('global').set(cleanObj, { merge: true }).catch(err => console.warn("Firestore settings global notice:", err));
        }

        if (typeof saveAdminEmailOtpConfig === 'function') saveAdminEmailOtpConfig();

        if (typeof showToast === 'function') {
          showToast(currentLang === 'ta' ? "அமைப்புகள் வெற்றிகரமாகச் சேமிக்கப்பட்டன! ✨" : "Settings saved successfully! ✨", "success");
        }
      } catch(e) {
        console.warn("saveAdminSettings error:", e);
      }
    }
    window.saveAdminSettings = saveAdminSettings;

    window.presetDeliveryFee = function(val) {
      const el = document.getElementById('setting-delivery-charge');
      if (el) {
        el.value = val;
        saveAdminSettings();
        if (typeof showToast === 'function') {
          showToast(currentLang === 'ta' ? `டெலிவரி கட்டணம் ₹${val} ஆக நிர்ணயிக்கப்பட்டது! ✓` : `Delivery fee set to ₹${val}! ✓`, 'success');
        }
      }
    };

    function promptEditOrderDeliveryOrEta(orderId) {
      const orders = getDataCached('ek_orders', []);
      const o = orders.find(item => item && item.id === orderId);
      if (!o) {
        showToast("Order not found", "error");
        return;
      }
      const currentFee = o.deliveryFee !== undefined ? o.deliveryFee : (o.deliveryCharge !== undefined ? o.deliveryCharge : 0);
      const currentEta = o.estimatedTime || o.eta || o.prepTime || 30;

      const newFeeInput = prompt(currentLang === 'ta' ? `புதிய டெலிவரி கட்டணத்தை உள்ளிடவும் (தற்போது: ₹${currentFee}):` : `Enter new delivery charge in ₹ (current: ₹${currentFee}):`, currentFee);
      if (newFeeInput === null) return;
      const newFee = parseFloat(newFeeInput);
      if (isNaN(newFee) || newFee < 0) {
        showToast("Invalid delivery fee entered", "error");
        return;
      }

      const newEtaInput = prompt(currentLang === 'ta' ? `எதிர்பார்க்கப்படும் நேரத்தை நிமிடங்களில் உள்ளிடவும் (தற்போது: ${currentEta} நிமிடம்):` : `Enter new ETA in minutes (current: ${currentEta} mins):`, currentEta);
      if (newEtaInput === null) return;
      const newEta = parseInt(newEtaInput);
      if (isNaN(newEta) || newEta < 0) {
        showToast("Invalid ETA entered", "error");
        return;
      }

      updateOrderDeliveryFeeOrEta(orderId, newFee, newEta);
    }

    async function updateOrderDeliveryFeeOrEta(orderId, newDeliveryCharge, newEtaMinutes) {
      try {
        const orders = getData('ek_orders', []);
        const idx = orders.findIndex(o => o && o.id === orderId);
        if (idx === -1) {
          showToast("Order not found", "error");
          return;
        }

        const o = orders[idx];
        const oldFee = o.deliveryFee !== undefined ? parseFloat(o.deliveryFee) : (parseFloat(o.deliveryCharge) || 0);
        const oldEta = o.estimatedTime || o.eta || 30;

        const subtotal = o.subtotalAmount !== undefined ? parseFloat(o.subtotalAmount) : (parseFloat(o.subtotal) || (parseFloat(o.totalAmount || 0) - oldFee));
        const loyaltyDisc = parseFloat(o.loyaltyDiscount || 0);
        const couponDisc = parseFloat(o.couponDiscount || 0);
        const newTotal = Math.max(0, Math.round(subtotal - loyaltyDisc - couponDisc + newDeliveryCharge));

        o.subtotalAmount = subtotal;
        o.deliveryFee = newDeliveryCharge;
        o.deliveryCharge = newDeliveryCharge;
        o.totalAmount = newTotal;
        o.grandTotal = newTotal;
        o.estimatedTime = newEtaMinutes;
        o.eta = newEtaMinutes;
        o.updatedAt = new Date().toISOString();

        saveData('ek_orders', orders);

        if (typeof db !== 'undefined' && db) {
          await db.collection('ek_orders').doc(orderId).set({
            subtotalAmount: subtotal,
            deliveryFee: newDeliveryCharge,
            deliveryCharge: newDeliveryCharge,
            totalAmount: newTotal,
            grandTotal: newTotal,
            estimatedTime: newEtaMinutes,
            eta: newEtaMinutes,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(err => console.warn("Firestore order fee/eta update error:", err));
        }

        showToast(currentLang === 'ta' ? "டெலிவரி கட்டணம் & நேரம் புதுப்பிக்கப்பட்டது! 🚚" : "Delivery fee & ETA updated successfully! 🚚", "success");

        try {
          if (typeof sendFcmNotificationForDeliveryOrEtaChange === 'function') {
            sendFcmNotificationForDeliveryOrEtaChange(o, oldFee, newDeliveryCharge, oldEta, newEtaMinutes);
          }
        } catch (fcmErr) {
          console.warn("FCM delivery/eta notification error:", fcmErr);
        }

        if (typeof renderAdminDashboard === 'function') {
          renderAdminDashboard();
        }
      } catch (err) {
        console.error("Failed to update order delivery fee / ETA:", err);
        showToast("Failed to update: " + err.message, "error");
      }
    }

    window.promptEditOrderDeliveryOrEta = promptEditOrderDeliveryOrEta;
    window.updateOrderDeliveryFeeOrEta = updateOrderDeliveryFeeOrEta;

    // --- ZONE-BASED DELIVERY PRICING MANAGEMENT ---
    function updateDeliveryModeUI() {
      const settings = typeof getSettings === 'function' ? getSettings() : (getData('ek_settings') || {});
      const dynDelEl = document.getElementById("setting-dynamic-delivery");
      const isDynamic = dynDelEl ? dynDelEl.checked : (settings.useDynamicDistancePricing !== undefined ? settings.useDynamicDistancePricing : true);

      const flatGroup = document.getElementById("group-delivery-flat-config");
      const dynGroup = document.getElementById("group-delivery-dynamic-config");
      const btnFlat = document.getElementById("btn-delivery-mode-flat");
      const btnDyn = document.getElementById("btn-delivery-mode-dynamic");

      if (flatGroup) flatGroup.style.display = isDynamic ? 'none' : 'block';
      if (dynGroup) dynGroup.style.display = isDynamic ? 'block' : 'none';

      if (btnFlat && btnDyn) {
        if (isDynamic) {
          btnFlat.style.background = 'transparent';
          btnFlat.style.color = 'var(--text-secondary)';
          btnDyn.style.background = 'var(--accent-orange)';
          btnDyn.style.color = '#000';
        } else {
          btnFlat.style.background = 'var(--accent-orange)';
          btnFlat.style.color = '#000';
          btnDyn.style.background = 'transparent';
          btnDyn.style.color = 'var(--text-secondary)';
        }
      }
    }

    function toggleDeliveryMode(mode) {
      const dynDelEl = document.getElementById("setting-dynamic-delivery");
      if (dynDelEl) {
        if (mode === 'flat') {
          dynDelEl.checked = false;
        } else if (mode === 'dynamic') {
          dynDelEl.checked = true;
        } else {
          dynDelEl.checked = !dynDelEl.checked;
        }
      }

      updateDeliveryModeUI();
      if (typeof saveAdminSettings === 'function') {
        saveAdminSettings();
      }

      const isDyn = dynDelEl ? dynDelEl.checked : false;
      if (isDyn) {
        renderAdminZonesTable();
        // FIXED: மேப் தொடங்குவதற்கு முன் container-க்கு சரியான dimensions கிடைக்க காத்திருக்கவும்
        setTimeout(() => {
          try { initAdminZonesMap(true); } catch(e) { console.error("initAdminZonesMap error:", e); }
        }, 200);
      }
    }

    function renderAdminZonesTable() {
      const container = document.getElementById('admin-zones-table');
      if (!container) return;

      const getZonesFn = typeof getDeliveryZones === 'function' ? getDeliveryZones : function() {
        return getData('ek_delivery_zones', getData('ek_settings')?.deliveryZones || []);
      };
      const zones = getZonesFn();

      if (!zones || !Array.isArray(zones) || zones.length === 0) {
        container.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 11px; background: rgba(0,0,0,0.2); border-radius: 8px;">எந்த மண்டலமும் அமைக்கப்படவில்லை. கீழே உள்ள படிவத்தைப் பயன்படுத்தி புதிய மண்டலத்தைச் சேர்க்கவும்.</div>`;
        return;
      }

      const sortedZones = [...zones].sort((a, b) => parseFloat(a.maxKm) - parseFloat(b.maxKm));

      container.innerHTML = sortedZones.map((z, idx) => {
        const prevMaxKm = idx > 0 ? sortedZones[idx - 1].maxKm : 0;
        const nameTa = z.nameTa || z.nameEn || z.name || 'Zone ' + (idx + 1);
        const nameEn = z.nameEn || z.name || '';
        const maxKm = parseFloat(z.maxKm) || 0;
        const charge = parseFloat(z.charge) || 0;
        const rawPincodes = Array.isArray(z.pincodes) ? z.pincodes.join(', ') : (typeof z.pincodes === 'string' ? z.pincodes : '');

        return `
          <div class="zone-item-card" style="background: rgba(15,23,42,0.6); border: 1.2px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 850; font-size: 13px; color: #ffffff; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span>📍 ${nameTa}</span>
                  ${nameEn && nameEn !== nameTa ? `<span style="font-weight: 500; font-size: 11px; color: var(--text-secondary);">(${nameEn})</span>` : ''}
                </div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                  தூரம்: ${prevMaxKm} - ${maxKm} கி.மீ
                </div>
                ${rawPincodes ? `<div style="font-size: 9.5px; color: #93c5fd; margin-top: 2px; display: flex; align-items: center; gap: 4px;"><span>📮 Pincodes:</span> <strong style="color: #bfdbfe;">${rawPincodes}</strong></div>` : ''}
              </div>
              <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
                <span style="background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 11px;">
                  ${maxKm} Km Limit
                </span>
                <span style="background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); padding: 3px 8px; border-radius: 6px; font-weight: 850; font-size: 12px;">
                  ₹${charge}
                </span>
              </div>
            </div>

            <div style="display: flex; gap: 6px; justify-content: flex-end; width: 100%;">
              <button type="button" class="btn" style="padding: 4px 10px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.06); color: #fff; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px;" onclick="toggleZoneEditForm('${z.id}')">
                <span>⚙️ Edit / திருத்து</span>
              </button>
              <button type="button" class="btn" style="padding: 4px 10px; font-size: 11px; font-weight: 700; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px;" onclick="deleteDeliveryZone('${z.id}')">
                <span>🗑️ Delete</span>
              </button>
            </div>

            <div id="edit-zone-form-${z.id}" style="display: none; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px; margin-top: 2px; flex-direction: column; gap: 6px; width: 100%;">
              <div style="display: flex; gap: 4px;">
                <input type="text" id="edit-zone-en-${z.id}" value="${nameEn.replace(/"/g, '&quot;')}" placeholder="Name (English)" class="form-control" style="flex: 1; font-size: 11px; height: 32px; background: #000;">
                <input type="text" id="edit-zone-ta-${z.id}" value="${nameTa.replace(/"/g, '&quot;')}" placeholder="Name (Tamil)" class="form-control" style="flex: 1; font-size: 11px; height: 32px; background: #000;">
              </div>
              <div style="display: flex; gap: 4px;">
                <input type="number" id="edit-zone-max-${z.id}" value="${maxKm}" placeholder="Max Km Limit" class="form-control" style="flex: 1; font-size: 11px; height: 32px; background: #000;" step="0.1">
                <input type="number" id="edit-zone-charge-${z.id}" value="${charge}" placeholder="Charge (₹)" class="form-control" style="flex: 1; font-size: 11px; height: 32px; background: #000;">
              </div>
              <div style="display: flex; gap: 4px;">
                <input type="text" id="edit-zone-pincodes-${z.id}" value="${rawPincodes.replace(/"/g, '&quot;')}" placeholder="Pincodes (e.g. 637101, 637105)" class="form-control" style="flex: 1; font-size: 11px; height: 32px; background: #000;">
              </div>
              <div style="display: flex; gap: 6px; margin-top: 2px;">
                <button type="button" class="btn btn-primary" style="flex: 1; height: 32px; font-size: 11px; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); border: none; color: #fff;" onclick="saveEditedDeliveryZone('${z.id}')">
                  💾 Save / சேமி
                </button>
                <button type="button" class="btn" style="flex: 1; height: 32px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.06); color: #ccc; border: 1px solid rgba(255,255,255,0.12);" onclick="toggleZoneEditForm('${z.id}')">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function toggleZoneEditForm(zoneId) {
      const formEl = document.getElementById(`edit-zone-form-${zoneId}`);
      if (formEl) {
        const isHidden = formEl.style.display === 'none' || !formEl.style.display;
        formEl.style.display = isHidden ? 'flex' : 'none';
      }
    }

    async function handleAddDeliveryZone(e) {
      if (e) e.preventDefault();

      const nameEl = document.getElementById('new-zone-name');
      const maxEl = document.getElementById('new-zone-max');
      const chargeEl = document.getElementById('new-zone-charge');
      const pinEl = document.getElementById('new-zone-pincodes');

      if (!nameEl || !maxEl || !chargeEl) return;

      const name = nameEl.value.trim();
      const maxKm = parseFloat(maxEl.value);
      const charge = parseFloat(chargeEl.value);
      const pinRaw = pinEl ? pinEl.value.trim() : '';
      const pincodes = pinRaw ? pinRaw.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

      if (!name) {
        if (typeof showToast === 'function') showToast("மண்டல பெயர் குறிப்பிடவும்! / Enter zone name", "warning");
        return;
      }
      if (isNaN(maxKm) || maxKm <= 0) {
        if (typeof showToast === 'function') showToast("சரியான தூர எல்லையைக் குறிப்பிடவும் (Km limit)! / Invalid Km limit", "warning");
        return;
      }
      if (isNaN(charge) || charge < 0) {
        if (typeof showToast === 'function') showToast("சரியான கட்டணத்தைக் குறிப்பிடவும்! / Invalid charge", "warning");
        return;
      }

      const newZone = {
        id: 'zone_' + Date.now(),
        nameEn: name,
        nameTa: name,
        maxKm: maxKm,
        charge: charge,
        pincodes: pincodes,
        updatedAt: new Date().toISOString()
      };

      const getZonesFn = typeof getDeliveryZones === 'function' ? getDeliveryZones : function() { return getData('ek_delivery_zones', []); };
      const currentZones = getZonesFn();
      const updatedZones = [...currentZones, newZone].sort((a, b) => parseFloat(a.maxKm) - parseFloat(b.maxKm));

      saveData('ek_delivery_zones', updatedZones);

      const settings = typeof getSettings === 'function' ? getSettings() : (getData('ek_settings') || {});
      settings.deliveryZones = updatedZones;
      saveData('ek_settings', settings);

      if (typeof db !== 'undefined' && db) {
        try {
          await db.collection('ek_delivery_zones').doc(newZone.id).set(cleanFirestoreData(newZone));
          await db.collection('ek_settings').doc('global_config').set(cleanFirestoreData(settings), { merge: true });
          await db.collection('ek_settings').doc('global').set(cleanFirestoreData(settings), { merge: true });
        } catch (err) {
          console.warn("Firestore delivery zone write notice:", err);
        }
      }

      nameEl.value = '';
      maxEl.value = '';
      chargeEl.value = '';
      if (pinEl) pinEl.value = '';

      renderAdminZonesTable();
      initAdminZonesMap();

      if (typeof showToast === 'function') showToast("புதிய விநியோக மண்டலம் சேர்க்கப்பட்டது! ✨", "success");
    }

    async function saveEditedDeliveryZone(zoneId) {
      const enEl = document.getElementById(`edit-zone-en-${zoneId}`);
      const taEl = document.getElementById(`edit-zone-ta-${zoneId}`);
      const maxEl = document.getElementById(`edit-zone-max-${zoneId}`);
      const chargeEl = document.getElementById(`edit-zone-charge-${zoneId}`);
      const pinEl = document.getElementById(`edit-zone-pincodes-${zoneId}`);

      if (!enEl || !maxEl || !chargeEl) return;

      const nameEn = enEl.value.trim();
      const nameTa = taEl ? taEl.value.trim() : nameEn;
      const maxKm = parseFloat(maxEl.value);
      const charge = parseFloat(chargeEl.value);
      const pinRaw = pinEl ? pinEl.value.trim() : '';
      const pincodes = pinRaw ? pinRaw.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

      if (!nameEn && !nameTa) {
        if (typeof showToast === 'function') showToast("மண்டல பெயர் குறிப்பிடவும்!", "warning");
        return;
      }
      if (isNaN(maxKm) || maxKm <= 0) {
        if (typeof showToast === 'function') showToast("சரியான தூர எல்லையைக் குறிப்பிடவும்!", "warning");
        return;
      }
      if (isNaN(charge) || charge < 0) {
        if (typeof showToast === 'function') showToast("சரியான கட்டணத்தைக் குறிப்பிடவும்!", "warning");
        return;
      }

      const getZonesFn = typeof getDeliveryZones === 'function' ? getDeliveryZones : function() { return getData('ek_delivery_zones', []); };
      const zones = getZonesFn();
      const idx = zones.findIndex(z => z.id === zoneId);
      if (idx !== -1) {
        zones[idx] = {
          ...zones[idx],
          nameEn: nameEn || nameTa,
          nameTa: nameTa || nameEn,
          maxKm: maxKm,
          charge: charge,
          pincodes: pincodes,
          updatedAt: new Date().toISOString()
        };

        zones.sort((a, b) => parseFloat(a.maxKm) - parseFloat(b.maxKm));

        saveData('ek_delivery_zones', zones);

        const settings = typeof getSettings === 'function' ? getSettings() : (getData('ek_settings') || {});
        settings.deliveryZones = zones;
        saveData('ek_settings', settings);

        if (typeof db !== 'undefined' && db) {
          try {
            await db.collection('ek_delivery_zones').doc(zoneId).set(cleanFirestoreData(zones[idx]));
            await db.collection('ek_settings').doc('global_config').set(cleanFirestoreData(settings), { merge: true });
            await db.collection('ek_settings').doc('global').set(cleanFirestoreData(settings), { merge: true });
          } catch (err) {
            console.warn("Firestore zone edit write notice:", err);
          }
        }

        renderAdminZonesTable();
        initAdminZonesMap();

        if (typeof showToast === 'function') showToast("மண்டல தகவல்கள் புதுப்பிக்கப்பட்டன! 💾", "success");
      }
    }

    async function deleteDeliveryZone(zoneId) {
      if (!confirm("இந்த மண்டலத்தை நிச்சயமாக நீக்க விரும்புகிறீர்களா?")) return;

      const getZonesFn = typeof getDeliveryZones === 'function' ? getDeliveryZones : function() { return getData('ek_delivery_zones', []); };
      const zones = getZonesFn().filter(z => z.id !== zoneId);

      saveData('ek_delivery_zones', zones);

      const settings = typeof getSettings === 'function' ? getSettings() : (getData('ek_settings') || {});
      settings.deliveryZones = zones;
      saveData('ek_settings', settings);

      if (typeof db !== 'undefined' && db) {
        try {
          await db.collection('ek_delivery_zones').doc(zoneId).delete();
          await db.collection('ek_settings').doc('global_config').set(cleanFirestoreData(settings), { merge: true });
          await db.collection('ek_settings').doc('global').set(cleanFirestoreData(settings), { merge: true });
        } catch (err) {
          console.warn("Firestore zone delete notice:", err);
        }
      }

      renderAdminZonesTable();
      initAdminZonesMap();

      if (typeof showToast === 'function') showToast("மண்டலம் நீக்கப்பட்டது 🗑️", "info");
    }

    async function applyDeliveryZoneTemplate(templateName) {
      const selectEl = document.getElementById('select-delivery-templates');
      const chosen = templateName || (selectEl ? selectEl.value : '');

      if (!chosen) {
        if (typeof showToast === 'function') showToast("தயவுசெய்து ஒரு டெம்ப்ளேட்டைத் தேர்ந்தெடுக்கவும்! / Select a template", "warning");
        return;
      }

      let templateZones = [];
      if (chosen === 'compact') {
        templateZones = [
          { id: 'zone_compact_1', nameEn: 'Edappadi Core & Bus Stand', nameTa: 'எடப்பாடி மையம் & பஸ் ஸ்டாண்ட்', maxKm: 2.5, charge: 20, pincodes: ['637101'] },
          { id: 'zone_compact_2', nameEn: 'Bypass & Poolampatti Road', nameTa: 'பைபாஸ் & பூலாம்பட்டி ரோடு', maxKm: 5.0, charge: 40, pincodes: ['637105'] },
          { id: 'zone_compact_3', nameEn: 'Sankari Road & Outskirts', nameTa: 'சங்ககிரி ரோடு & வெளிப்புறம்', maxKm: 12.0, charge: 80, pincodes: ['637102', '637107'] }
        ];
      } else if (chosen === 'standard') {
        templateZones = [
          { id: 'zone_std_1', nameEn: 'Inner Wards Circle', nameTa: 'உள் வார்டு வட்டம்', maxKm: 3.0, charge: 25, pincodes: ['637101'] },
          { id: 'zone_std_2', nameEn: 'Outer Ring & Suburbs', nameTa: 'வெளி வளையம் & புறநகர்', maxKm: 7.0, charge: 50, pincodes: ['637105', '637102'] },
          { id: 'zone_std_3', nameEn: 'Extended Rural Wards', nameTa: 'விரிவாக்கப்பட்ட கிராமப்புற வார்டுகள்', maxKm: 15.0, charge: 90, pincodes: ['637107', '636306'] }
        ];
      } else if (chosen === 'metro') {
        templateZones = [
          { id: 'zone_metro_1', nameEn: 'City Limits', nameTa: 'நகர எல்லை', maxKm: 4.0, charge: 30, pincodes: ['637101'] },
          { id: 'zone_metro_2', nameEn: 'Suburban Hubs', nameTa: 'புறநகர் மையங்கள்', maxKm: 8.0, charge: 60, pincodes: ['637105', '637102'] },
          { id: 'zone_metro_3', nameEn: 'Regional Highway Belt', nameTa: 'பிராந்திய நெடுஞ்சாலை பகுதி', maxKm: 20.0, charge: 120, pincodes: ['637107', '636306', '636453'] }
        ];
      }

      if (templateZones.length === 0) return;

      saveData('ek_delivery_zones', templateZones);

      const settings = typeof getSettings === 'function' ? getSettings() : (getData('ek_settings') || {});
      settings.deliveryZones = templateZones;
      saveData('ek_settings', settings);

      if (typeof db !== 'undefined' && db) {
        try {
          for (const z of templateZones) {
            await db.collection('ek_delivery_zones').doc(z.id).set(cleanFirestoreData(z));
          }
          await db.collection('ek_settings').doc('global_config').set(cleanFirestoreData(settings), { merge: true });
          await db.collection('ek_settings').doc('global').set(cleanFirestoreData(settings), { merge: true });
        } catch (err) {
          console.warn("Firestore template application notice:", err);
        }
      }

      renderAdminZonesTable();
      initAdminZonesMap();

      if (typeof showToast === 'function') showToast(`டெம்ப்ளேட் (${chosen.toUpperCase()}) வெற்றிகரமாகப் பயன்படுத்தப்பட்டது! ⚡`, "success");
    }

    function refreshAdminZonesMapSize() {
      if (window._adminZonesMapInstance && typeof window._adminZonesMapInstance.invalidateSize === 'function') {
        try { window._adminZonesMapInstance.invalidateSize(); } catch(e) {}
        setTimeout(() => {
          try {
            if (window._adminZonesMapInstance && typeof window._adminZonesMapInstance.invalidateSize === 'function') {
              window._adminZonesMapInstance.invalidateSize();
            }
          } catch(e) {}
        }, 250);
      }
    }
    window.refreshAdminZonesMapSize = refreshAdminZonesMapSize;

    function createAdminZonesTileLayer(type) {
      let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      let layerOptions = {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        updateWhenIdle: true,
        keepBuffer: 2,
        attribution: '© OpenStreetMap © Google © CARTO'
      };

      if (type === 'carto') {
        tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        layerOptions.subdomains = ['a', 'b', 'c', 'd'];
      } else if (type === 'satellite') {
        tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        layerOptions.subdomains = ['1', '2', '3', '4'];
      } else if (type === 'google') {
        tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
        layerOptions.subdomains = ['1', '2', '3', '4'];
      } else if (type === 'dark') {
        tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        layerOptions.subdomains = ['a', 'b', 'c', 'd'];
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
            if (type === 'satellite') {
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

    function changeAdminZonesMapLayer(type) {
      window._adminZonesMapType = type;
      if (window._adminZonesMapInstance) {
        try {
          if (window._adminZonesActiveTileLayer) {
            window._adminZonesMapInstance.removeLayer(window._adminZonesActiveTileLayer);
          }
          const newTiles = createAdminZonesTileLayer(type);
          newTiles.addTo(window._adminZonesMapInstance);
          window._adminZonesActiveTileLayer = newTiles;
          refreshAdminZonesMapSize();
          return;
        } catch(e) {
          console.warn("[Leaflet Layer Switch Fail]:", e);
        }
      }
      initAdminZonesMap(false);
    }
    window.changeAdminZonesMapLayer = changeAdminZonesMapLayer;

    function renderAdminZonesMapLayers(mapInstance) {
      const map = mapInstance || window._adminZonesMapInstance;
      if (!map || typeof L === 'undefined') return;

      const storeLat = 11.5815;
      const storeLng = 77.8488;

      if (!window._adminZonesCirclesGroup) {
        window._adminZonesCirclesGroup = L.featureGroup().addTo(map);
      } else {
        try { window._adminZonesCirclesGroup.clearLayers(); } catch(e) {}
      }

      const getZonesFn = typeof getDeliveryZones === 'function' ? getDeliveryZones : function() { return getData('ek_delivery_zones', []); };
      const zones = getZonesFn();
      const sortedZones = Array.isArray(zones) ? [...zones].filter(z => z && !isNaN(parseFloat(z.maxKm)) && parseFloat(z.maxKm) > 0).sort((a, b) => parseFloat(b.maxKm) - parseFloat(a.maxKm)) : [];
      const colors = ['#ec4899', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

      sortedZones.forEach((z, i) => {
        const radiusMeters = parseFloat(z.maxKm) * 1000;
        const color = colors[i % colors.length];
        const circle = L.circle([storeLat, storeLng], {
          radius: radiusMeters,
          color: color,
          fillColor: color,
          fillOpacity: 0.18,
          weight: 2.5
        }).bindPopup(`<b style="color:${color}; font-size:13px;">📍 ${escapeHtml(z.nameTa || z.nameEn || 'Zone')}</b><br><span style="color:#fff; font-size:11px;">வரம்பு: <b>${z.maxKm} Km</b> | கட்டணம்: <b>₹${z.charge}</b>${z.pincodes && z.pincodes.length ? `<br>அஞ்சல் குறியீடு: <b>${Array.isArray(z.pincodes) ? z.pincodes.join(', ') : z.pincodes}</b>` : ''}</span>`);
        window._adminZonesCirclesGroup.addLayer(circle);
      });

      if (sortedZones.length > 0 && window._adminZonesCirclesGroup.getLayers().length > 0) {
        try {
          const bounds = window._adminZonesCirclesGroup.getBounds();
          if (bounds && bounds.isValid()) {
            map.fitBounds(bounds.pad(0.15));
          }
        } catch(e) {}
      }
    }
    window.renderAdminZonesMapLayers = renderAdminZonesMapLayers;

    function initAdminZonesMap(resetCenter = false) {
      const mapContainer = document.getElementById('admin-zones-leaflet-map');
      if (!mapContainer) return;

      if (typeof L === 'undefined') {
        mapContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#f59e0b; font-size: 11px;">⚠️ Leaflet வரைபட நூலகம் ஏற்றப்படவில்லை / Map library not loaded</div>';
        return;
      }

      try {
        const storeLat = 11.5815;
        const storeLng = 77.8488;

        const containerVisible = mapContainer.offsetWidth > 0 && mapContainer.offsetHeight > 0;

        if (window._adminZonesMapInstance && !resetCenter) {
          try {
            renderAdminZonesMapLayers(window._adminZonesMapInstance);
            refreshAdminZonesMapSize();
            if (containerVisible) {
              window._adminZonesMapInstance.setView([storeLat, storeLng], window._adminZonesMapInstance.getZoom() || 12);
            }
            return;
          } catch(e) {
            console.warn("Map invalidateSize fallback:", e);
          }
        }

        if (window._adminZonesMapInstance) {
          try { window._adminZonesMapInstance.remove(); } catch(e) {}
          window._adminZonesMapInstance = null;
        }
        if (mapContainer._leaflet_id) {
          try { mapContainer._leaflet_id = null; } catch(e) {}
        }

        const map = L.map('admin-zones-leaflet-map', {
          zoomControl: true,
          attributionControl: false,
          preferCanvas: true
        }).setView([storeLat, storeLng], 12);
        window._adminZonesMapInstance = map;

        const layerType = window._adminZonesMapType || 'street';
        const primaryTiles = createAdminZonesTileLayer(layerType);
        primaryTiles.addTo(map);
        window._adminZonesActiveTileLayer = primaryTiles;

        const storeIcon = L.divIcon({
          className: 'custom-map-icon',
          html: `<div style="background: #f59e0b; color: #000; padding: 4px 8px; border-radius: 12px; font-weight: 800; font-size: 10px; border: 2px solid #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 4px; white-space: nowrap;">🏪 எடப்பாடி கடை</div>`,
          iconSize: [110, 30],
          iconAnchor: [55, 15]
        });

        L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map)
          .bindPopup('<b style="color:#f59e0b; font-size:13px;">🏪 எடப்பாடி கடை மையக் கிளை</b><br><span style="color:#fff; font-size:11px;">Central Store Hub | Lat: 11.5815, Lng: 77.8488</span>');

        window._adminZonesCirclesGroup = L.featureGroup().addTo(map);
        renderAdminZonesMapLayers(map);

        const triggerInvalidate = () => {
          try {
            if (window._adminZonesMapInstance && typeof window._adminZonesMapInstance.invalidateSize === 'function') {
              window._adminZonesMapInstance.invalidateSize();
            }
          } catch(e) {}
        };

        [0, 50, 150, 300, 600, 1200, 2500].forEach(delay => setTimeout(triggerInvalidate, delay));

        if (window.ResizeObserver && !mapContainer._hasResizeObserver) {
          mapContainer._hasResizeObserver = true;
          const ro = new ResizeObserver(() => triggerInvalidate());
          ro.observe(mapContainer);
        }

        if (window.IntersectionObserver && !mapContainer._hasIntersectionObserver) {
          mapContainer._hasIntersectionObserver = true;
          const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                triggerInvalidate();
              }
            });
          }, { threshold: 0.05 });
          io.observe(mapContainer);
        }

      } catch(mapErr) {
        console.error("initAdminZonesMap error:", mapErr);
      }
    }

    function renderAdminDeliveryZones() {
      updateDeliveryModeUI();
      renderAdminZonesTable();
      setTimeout(() => {
        initAdminZonesMap();
      }, 100);
      setTimeout(() => {
        refreshAdminZonesMapSize();
      }, 450);
    }

    let _adminOrdersSearchTimer = null;
    function debouncedSearchAdminOrders() {
      if (_adminOrdersSearchTimer) clearTimeout(_adminOrdersSearchTimer);
      _adminOrdersSearchTimer = setTimeout(() => {
        if (typeof renderAdminOrders === 'function') renderAdminOrders();
      }, 200);
    }

    let _adminProductsSearchTimer = null;
    function debouncedSearchProducts() {
      if (_adminProductsSearchTimer) clearTimeout(_adminProductsSearchTimer);
      _adminProductsSearchTimer = setTimeout(() => {
        if (typeof renderAdminProducts === 'function') renderAdminProducts();
      }, 200);
    }

    function renderAdminAnalytics() {
      let allOrders = [];
      try {
        const localCached = typeof getDataCached === 'function' ? getDataCached('ek_orders', []) : [];
        const localDirect = typeof getData === 'function' ? getData('ek_orders', []) : [];
        const memoryAdmin = window.adminOrders || [];
        const memoryHistory = window.ordersHistory || [];

        const orderMap = new Map();
        [...localCached, ...localDirect, ...memoryAdmin, ...memoryHistory].forEach(o => {
          if (o && (o.id || o.orderId)) {
            const idKey = o.id || o.orderId;
            orderMap.set(idKey, o);
          }
        });
        allOrders = Array.from(orderMap.values());
      } catch (err) {
        console.error("[Analytics Engine] Error fetching orders:", err);
        allOrders = window.adminOrders || [];
      }

      function isCompletedOrder(o) {
        if (!o) return false;
        const st = String(o.status || '').toLowerCase().trim();
        if (["delivered", "completed", "done", "success", "finished"].includes(st)) return true;
        if (typeof isDeliveredOrderStatus === 'function' && isDeliveredOrderStatus(st)) return true;
        return false;
      }

      const preset = window.currentAnalyticsPreset || 'all';
      const now = new Date();

      const startDateInput = document.getElementById('analytics-start-date');
      const endDateInput = document.getElementById('analytics-end-date');
      let customStart = startDateInput && startDateInput.value ? new Date(startDateInput.value + 'T00:00:00') : null;
      let customEnd = endDateInput && endDateInput.value ? new Date(endDateInput.value + 'T23:59:59.999') : null;

      let filterStart = null;
      let filterEnd = null;

      if (customStart || customEnd) {
        filterStart = customStart;
        filterEnd = customEnd;
      } else if (preset === 'today') {
        filterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        filterEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (preset === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        filterStart = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0);
        filterEnd = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
      } else if (preset === 'this_week') {
        const day = now.getDay();
        const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
        filterStart = new Date(now.getFullYear(), now.getMonth(), diffToMon, 0, 0, 0);
        filterEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (preset === 'this_month') {
        filterStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        filterEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      const dateFilteredOrders = allOrders.filter(o => {
        if (!o) return false;
        const st = String(o.status || '').toLowerCase().trim();
        if (["cancelled", "canceled", "rejected", "declined", "failed", "void"].includes(st)) return false;

        if (!filterStart && !filterEnd) return true;

        const oDateRaw = o.createdAt || o.date || o.timestamp || o.orderDate;
        if (!oDateRaw) return true;

        const oDate = new Date(oDateRaw);
        if (isNaN(oDate.getTime())) return true;

        if (filterStart && oDate < filterStart) return false;
        if (filterEnd && oDate > filterEnd) return false;
        return true;
      });

      const completedOrders = dateFilteredOrders.filter(o => isCompletedOrder(o));
      const closedSalesCount = completedOrders.length;
      
      let netEarnings = 0;
      completedOrders.forEach(o => {
        const totalVal = parseFloat(o.total || o.finalTotal || o.grandTotal || (parseFloat(o.subtotal || 0) + parseFloat(o.deliveryFee || o.deliveryCharge || 0)));
        netEarnings += isNaN(totalVal) ? 0 : totalVal;
      });

      const concludedEl = document.getElementById('anal-concluded-orders');
      if (concludedEl) concludedEl.innerText = closedSalesCount.toLocaleString();

      const revenueEl = document.getElementById('anal-total-revenue');
      if (revenueEl) revenueEl.innerText = `₹${Math.round(netEarnings).toLocaleString()}`;

      const dateLabelEl = document.getElementById('analytics-active-date-label');
      if (dateLabelEl) {
        if (preset === 'all' && !customStart && !customEnd) {
          dateLabelEl.innerText = 'All Time / அனைத்து காலமும்';
        } else if (preset === 'today') {
          dateLabelEl.innerText = 'Today / இன்று';
        } else if (preset === 'yesterday') {
          dateLabelEl.innerText = 'Yesterday / நேற்று';
        } else if (preset === 'this_week') {
          dateLabelEl.innerText = 'This Week / இந்த வாரம்';
        } else if (preset === 'this_month') {
          dateLabelEl.innerText = 'This Month / இந்த மாதம்';
        } else if (customStart || customEnd) {
          const sStr = customStart ? customStart.toLocaleDateString('en-IN') : 'Start';
          const eStr = customEnd ? customEnd.toLocaleDateString('en-IN') : 'Now';
          dateLabelEl.innerText = `${sStr} - ${eStr}`;
        }
      }

      const categories = {
        meat: { revenue: 0, labelId: 'bar-meat-text', barId: 'bar-meat' },
        fish: { revenue: 0, labelId: 'bar-fish-text', barId: 'bar-fish' },
        veg: { revenue: 0, labelId: 'bar-veg-text', barId: 'bar-veg' },
        fruits: { revenue: 0, labelId: 'bar-fruits-text', barId: 'bar-fruits' },
        dairy: { revenue: 0, labelId: 'bar-dairy-text', barId: 'bar-dairy' },
        groceries: { revenue: 0, labelId: 'bar-groceries-text', barId: 'bar-groceries' }
      };

      const productAggregator = new Map();

      completedOrders.forEach(o => {
        const items = Array.isArray(o.items) ? o.items : [];
        items.forEach(item => {
          if (!item) return;
          const itemName = (item.englishName || item.tamilName || item.name || item.title || 'Unknown Product').trim();
          const itemCat = String(item.category || item.categoryId || '').toLowerCase();
          const itemPrice = parseFloat(item.totalPrice || item.price || 0) * (parseFloat(item.quantity || item.qty || 1));
          const itemQty = parseFloat(item.quantity || item.qty || 1);

          const lowerName = itemName.toLowerCase();
          if (itemCat.includes('meat') || itemCat.includes('chicken') || itemCat.includes('mutton') || lowerName.includes('chicken') || lowerName.includes('mutton') || lowerName.includes('சிக்கன்') || lowerName.includes('மட்டன்') || lowerName.includes('இறைச்சி')) {
            categories.meat.revenue += itemPrice;
          } else if (itemCat.includes('fish') || itemCat.includes('seafood') || lowerName.includes('fish') || lowerName.includes('prawn') || lowerName.includes('மீன்') || lowerName.includes('நண்டு')) {
            categories.fish.revenue += itemPrice;
          } else if (itemCat.includes('veg') || lowerName.includes('tomato') || lowerName.includes('onion') || lowerName.includes('தக்காளி') || lowerName.includes('வெங்காயம்') || lowerName.includes('காய்கறி')) {
            categories.veg.revenue += itemPrice;
          } else if (itemCat.includes('fruit') || lowerName.includes('apple') || lowerName.includes('banana') || lowerName.includes('பழம்') || lowerName.includes('ஆப்பிள்')) {
            categories.fruits.revenue += itemPrice;
          } else if (itemCat.includes('dairy') || itemCat.includes('egg') || lowerName.includes('milk') || lowerName.includes('egg') || lowerName.includes('பால்') || lowerName.includes('முட்டை')) {
            categories.dairy.revenue += itemPrice;
          } else {
            categories.groceries.revenue += itemPrice;
          }

          const pKey = itemName;
          if (!productAggregator.has(pKey)) {
            productAggregator.set(pKey, {
              name: item.tamilName ? `${item.tamilName} (${item.englishName || ''})` : itemName,
              orderIds: new Set(),
              totalQty: 0,
              totalRevenue: 0
            });
          }
          const pData = productAggregator.get(pKey);
          pData.orderIds.add(o.id || o.orderId);
          pData.totalQty += itemQty;
          pData.totalRevenue += itemPrice;
        });
      });

      let totalCatRev = 0;
      Object.values(categories).forEach(c => totalCatRev += c.revenue);

      Object.keys(categories).forEach(catKey => {
        const c = categories[catKey];
        const pct = totalCatRev > 0 ? Math.round((c.revenue / totalCatRev) * 100) : 0;
        const txtEl = document.getElementById(c.labelId);
        if (txtEl) txtEl.innerText = `₹${Math.round(c.revenue).toLocaleString()} (${pct}%)`;

        const barEl = document.getElementById(c.barId);
        if (barEl) barEl.style.width = `${pct}%`;
      });

      const bestSellersContainer = document.getElementById('admin-best-sellers');
      if (bestSellersContainer) {
        const sortedProducts = Array.from(productAggregator.values())
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .slice(0, 8);

        if (sortedProducts.length === 0) {
          bestSellersContainer.innerHTML = `
            <div style="color:var(--text-muted); text-align:center; padding:16px; font-size:12px;">
              முடிக்கப்பட்ட விற்பனை விவரங்கள் எதுவும் கிடைக்கவில்லை / No completed sales recorded for this period.
            </div>`;
        } else {
          let html = `<div style="display:flex; flex-direction:column; gap:8px;">`;
          sortedProducts.forEach((p, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            html += `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-weight:700; font-size:13px; min-width:24px;">${medal}</span>
                  <div>
                    <strong style="font-size:12.5px; color:#fff; display:block;">${p.name}</strong>
                    <span style="font-size:10.5px; color:var(--text-muted);">${p.orderIds.size} Orders | Qty: ${p.totalQty}</span>
                  </div>
                </div>
                <strong style="font-size:13px; color:var(--accent-green);">₹${Math.round(p.totalRevenue).toLocaleString()}</strong>
              </div>`;
          });
          html += `</div>`;
          bestSellersContainer.innerHTML = html;
        }
      }

      window._currentFilteredAnalyticsOrders = completedOrders.length > 0 ? completedOrders : dateFilteredOrders;
    }

    window.renderAdminAnalytics = renderAdminAnalytics;
    window.renderAnalyticsReport = renderAdminAnalytics;
    window.debouncedSearchAdminOrders = debouncedSearchAdminOrders;
    window.debouncedSearchProducts = debouncedSearchProducts;
    window.updateDeliveryModeUI = updateDeliveryModeUI;
    window.toggleDeliveryMode = toggleDeliveryMode;
    window.renderAdminZonesTable = renderAdminZonesTable;
    window.toggleZoneEditForm = toggleZoneEditForm;
    window.handleAddDeliveryZone = handleAddDeliveryZone;
    window.saveEditedDeliveryZone = saveEditedDeliveryZone;
    window.deleteDeliveryZone = deleteDeliveryZone;
    window.applyDeliveryZoneTemplate = applyDeliveryZoneTemplate;
    window.initAdminZonesMap = initAdminZonesMap;
    window.renderAdminDeliveryZones = renderAdminDeliveryZones;
    window.fetchAdminOrdersLive = fetchAdminOrdersLive;
    window.renderAdminBannerSettings = function() { if (typeof renderAdminBannerList === 'function') renderAdminBannerList(); };