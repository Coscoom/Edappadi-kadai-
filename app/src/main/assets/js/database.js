
    function validateAndSanitizeSessions(targetRole = null) {
      debugLog("[Session Validate] Auditing active sessions. Target role:", targetRole);

      const adminSession = getData('ek_admin_session', null);
      const custSession = getData('ek_customer_session', null);
      const deliverySession = getData('ek_delivery_session', null);

      const hasAdmin = !!(adminSession && adminSession.loggedIn);
      const hasCust = !!(custSession && custSession.loggedIn);
      const hasDelivery = !!(deliverySession && deliverySession.loggedIn);

      let activeRole = null;
      if (hasAdmin) activeRole = 'admin';
      else if (hasDelivery) activeRole = 'delivery';
      else if (hasCust) activeRole = 'customer';

      if (targetRole && activeRole && targetRole !== activeRole) {
        debugLog(`[Session Validate] Switching role from ${activeRole} to ${targetRole}. Terminating previous session...`);
        if (activeRole === 'admin') {
          removeData('ek_admin_session');
          removeData('ek_admin_remember_me');
        } else if (activeRole === 'delivery') {
          removeData('ek_delivery_session');
          removeData('ek_delivery_remember_me');
        } else if (activeRole === 'customer') {
          removeData('ek_customer_session');
          sessionStorage.removeItem('ek_customer_session_temp');
          removeData('ek_customer_remember_me');
        }

        if (typeof firebase !== 'undefined' && firebase.auth) {
          firebase.auth().signOut().catch(e => console.error("[Session Validate] Error signing out on role switch:", e));
        }
        activeRole = null;
      }

      if (activeRole) {
        if (activeRole !== 'admin') removeData('ek_admin_session');
        if (activeRole !== 'delivery') removeData('ek_delivery_session');
        if (activeRole !== 'customer') {
          removeData('ek_customer_session');
          sessionStorage.removeItem('ek_customer_session_temp');
        }
      } else {
        removeData('ek_admin_session');
        removeData('ek_delivery_session');
        removeData('ek_customer_session');
        sessionStorage.removeItem('ek_customer_session_temp');
      }
    }

    function enforceRememberMeValidationOnStartup() {
      debugLog("[Remember Me Startup Check] Session persistence active. Local sessions will remain logged in across app restarts until explicit Logout.");
    }

    const prefillLoginCredentials = () => {
      try {
        const idInput = document.getElementById('login-identifier');
        const remCheckbox = document.getElementById('login-remember');
        const passInput = document.getElementById('login-password');

        if (currentLoginMode === 'admin') {
          const selector = document.getElementById('admin-selector');
          const remembered = getData('ek_remembered_admin_credentials', null);
          const isRemembered = getData('ek_admin_remember_me') === true;
          if (remembered && remembered.remember) {
            if (selector) selector.value = remembered.identifier || "";
            if (remCheckbox) remCheckbox.checked = true;
          } else {
            if (remCheckbox) remCheckbox.checked = false;
          }
          if (passInput) passInput.value = "";
        } else if (currentLoginMode === 'delivery') {
          const selector = document.getElementById('delivery-selector');
          const remembered = getData('ek_remembered_delivery_credentials', null);
          const isRemembered = getData('ek_delivery_remember_me') === true;
          if (remembered && remembered.remember) {
            if (selector) selector.value = remembered.identifier || "";
            if (remCheckbox) remCheckbox.checked = true;
          } else {
            if (remCheckbox) remCheckbox.checked = false;
          }
          if (passInput) passInput.value = "";
        } else {
          const remembered = getData('ek_remembered_credentials', null);
          const isRemembered = getData('ek_customer_remember_me') === true;
          if (remembered && remembered.remember) {
            if (idInput && !idInput.value) idInput.value = remembered.identifier || "";
            if (remCheckbox) remCheckbox.checked = true;
          } else {
            if (idInput) idInput.value = "";
            if (remCheckbox) remCheckbox.checked = false;
          }
          if (passInput) passInput.value = "";
        }

        renderQuickTestLogins();
      } catch (e) {
        console.error("Error prefilling credentials: ", e);
      }
    };

    // MUST stay false - showing demo/placeholder products to real customers risks them ordering something that doesn't exist. Only true for local dev testing.
    const ENABLE_DEMO_SEED_DATA = false;
    const DEMO_PRODUCTS = [];

    const DEMO_CUSTOMER = {
      id: 'cust_seed',
      name: 'Rajenthiran',
      phone: '0000000000',
      email: 'raj@domain.com',
      password: 'DISABLED_DEMO',
      address: 'Kavandampatti, Idappadi, Salem, Tamil Nadu',
      loyaltyPoints: 120,
      tier: 'bronze',
      joinedAt: new Date().toISOString(),
      defaultCut: 'Small Pieces',
      whatsappNotify: true,
      preferredLang: 'en'
    };

    const DEFAULT_SETTINGS = {
      updatedAt: "1970-01-01T00:00:00.000Z",
      _isAdminModified: false,
      shopOpen: true,
      leaveMode: false,
      leaveNotice: "",
      deliveryCharge: 40,
      minOrderWeight: 50,
      minOrderAmount: 0,
      merchantUpiId: "8778148899@ptyes",
      merchantName: "Edappadi Kadai",
      backupUpi1: "einsteinananth24-4@okicici",
      backupUpi2: "",
      upiQrUrl: "",
      rainMode: false,
      rainCharge: 20,
      minAppVersion: "9.0.0",
      recommendedVersion: "9.0.0",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.edappadikadai.app",
      privacyPolicyUrl: "privacy_policy.html",
      slidingBanners: [
        { id: 'b_1', image: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800', titleTa: "நாட்டு ஆட்டுக்கறி பிரஷ்ஷாக!", titleEn: "Premium Fresh Mutton Cuts", subTa: "இடப்பாடி நகரத்தில் உங்களின் இல்லத்திற்கே நேரடியாக!", subEn: "Direct organic local meat delivered to your home." },
        { id: 'b_2', image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800', titleTa: "தரமான நாட்டுக்கோழி!", titleEn: "Farm Fresh Chicken Varieties", subTa: "சுத்தமான முறையில் கட் செய்து வழங்கப்படும்!", subEn: "Cleanly cut & prepared perfectly for your tasty health." },
        { id: 'b_3', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800', titleTa: "இயற்கை காய்கறிகள் & கீரைகள்!", titleEn: "100% Organic Village Greens", subTa: "பிரஷ்ஷான கிராமத்து இயற்கை விவசாய விளைச்சல்!", subEn: "Freshly harvested organic local farm yields." }
      ],
      upiSettings: {
        upiEnabled: true,
        currency: 'INR',
        accounts: [
          {
            id: 'primary',
            label: 'Primary UPI',
            upiId: '8778148899@ptyes',
            merchantName: 'Edappadi Kadai',
            displayName: 'Anantharaj Primary',
            note: 'Order {id} - Edappadi Kadai',
            isActive: true
          },
          {
            id: 'backup1',
            label: 'Backup UPI 1',
            upiId: 'einsteinananth24-4@okicici',
            merchantName: 'Edappadi Kadai',
            displayName: 'Anantharaj Backup 1',
            note: 'Order {id} - Edappadi Kadai',
            isActive: true
          },
          {
            id: 'backup2',
            label: 'Backup UPI 2',
            upiId: '',
            merchantName: 'Edappadi Kadai',
            displayName: 'Anantharaj Backup 2',
            note: 'Order {id} - Edappadi Kadai',
            isActive: false
          }
        ]
      },
      announcement: "Festival Special Weekend discount active! Express door delivery within 30 minutes in Edappadi town.",
      bannerImage: "",
      useDynamicDistancePricing: true,
      deliveryKmMultiplier: 12,
      deliveryBasePrice: 20,
      deliveryZones: [
        { id: 'zone_1', nameEn: 'Local Town', nameTa: 'உள்ளூர் நகரம்', maxKm: 3, charge: 20 },
        { id: 'zone_2', nameEn: 'Suburbs Near', nameTa: 'அருகிலுள்ள புறநகர்', maxKm: 6, charge: 45 },
        { id: 'zone_3', nameEn: 'Suburbs Far', nameTa: 'தொலைதூர புறநகர்', maxKm: 10, charge: 75 },
        { id: 'zone_4', nameEn: 'Outer Boundary', nameTa: 'வெளிப்புற எல்லை', maxKm: 15, charge: 110 }
      ]
    };

    const DEFAULT_CATEGORIES = [
      { id: 'meat', nameEn: 'Meat', nameTa: 'கறிவகை', en: 'Meat', ta: 'கறிவகை', icon: '🥩', accentColor: '#C62828', order: 0 },
      { id: 'veg', nameEn: 'Veg', nameTa: 'காய்கறி', en: 'Veg', ta: 'காய்கறி', icon: '🥦', accentColor: '#4CAF50', order: 1 },
      { id: 'fish', nameEn: 'Fish', nameTa: 'மீன்வகை', en: 'Fish', ta: 'மீன்வகை', icon: '🐟', accentColor: '#0288D1', order: 2 },
      { id: 'fruits', nameEn: 'Fruits', nameTa: 'பழங்கள்', en: 'Fruits', ta: 'பழங்கள்', icon: '🍎', accentColor: '#2E7D32', order: 3 },
      { id: 'dairy', nameEn: 'Dairy & Eggs', nameTa: 'பால் & முட்டை', en: 'Dairy & Eggs', ta: 'பால் & முட்டை', icon: '🥛', accentColor: '#FFB300', order: 4 },
      { id: 'bakery', nameEn: 'Bakery', nameTa: 'பேக்கரி', en: 'Bakery', ta: 'பேக்கரி', icon: '🍞', accentColor: '#8D6E63', order: 5 },
      { id: 'groceries', nameEn: 'Grocery', nameTa: 'மளிகை', en: 'Grocery', ta: 'மளிகை', icon: '🥫', accentColor: '#008080', order: 6 }
    ];

    window.ENABLE_DEMO_SEED_DATA = ENABLE_DEMO_SEED_DATA;
    window.DEMO_PRODUCTS = DEMO_PRODUCTS;
    window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
    window.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;

    function getActiveUpiAccount(settings, accountId) {
      if (!settings) return null;
      const upiSettings = settings.upiSettings;
      if (upiSettings && Array.isArray(upiSettings.accounts)) {
        if (accountId) {
          const acc = upiSettings.accounts.find(a => a.id === accountId && a.isActive && a.upiId && a.upiId.trim() !== '');
          if (acc) return acc;
        }
        const primary = upiSettings.accounts.find(a => a.id === 'primary' && a.isActive && a.upiId && a.upiId.trim() !== '');
        if (primary) return primary;
        const firstActive = upiSettings.accounts.find(a => a.isActive && a.upiId && a.upiId.trim() !== '');
        if (firstActive) return firstActive;
      }
      if (settings.merchantUpiId && settings.merchantUpiId.trim() !== '') {
        return {
          id: 'primary',
          upiId: settings.merchantUpiId.trim(),
          merchantName: settings.merchantName || 'Edappadi Kadai',
          displayName: 'Primary Merchant UPI',
          note: 'Order {id} - Edappadi Kadai',
          isActive: settings.upiEnabled !== false
        };
      }
      return null;
    }
    window.getActiveUpiAccount = getActiveUpiAccount;

    function getLiveUpiAccount(overrideSettings) {
      const settings = overrideSettings || (typeof getData === 'function' ? getData('ek_settings', null) : null) || (typeof getSettings === 'function' ? getSettings() : null) || DEFAULT_SETTINGS;
      let acc = getActiveUpiAccount(settings);
      const topLevelUpiId = (settings.merchantUpiId || '').trim();

      if (topLevelUpiId && (!acc || !acc.upiId)) {
        acc = {
          id: 'primary',
          upiId: topLevelUpiId,
          merchantName: settings.merchantName || 'Edappadi Kadai',
          displayName: 'Primary Merchant UPI',
          note: 'Order {id} - Edappadi Kadai',
          isActive: settings.upiEnabled !== false
        };
      } else if (acc && topLevelUpiId && acc.id === 'primary' && acc.upiId !== topLevelUpiId) {
        // Keep primary in sync with top-level if edited directly
        acc.upiId = topLevelUpiId;
      }

      return acc || {
        id: 'primary',
        upiId: topLevelUpiId || '8778148899@ptyes',
        merchantName: (settings && settings.merchantName) || 'Edappadi Kadai',
        displayName: 'Edappadi Kadai',
        note: 'Order {id} - Edappadi Kadai',
        isActive: true
      };
    }
    window.getLiveUpiAccount = getLiveUpiAccount;

    function initializeOrFixUpiSettings() {
      const settings = getData('ek_settings', null) || { ...DEFAULT_SETTINGS };
      let updated = false;

      const legacyPrimary = (settings.merchantUpiId && settings.merchantUpiId.trim()) || '8778148899@ptyes';
      const legacyBackup1 = (settings.backupUpi1 && settings.backupUpi1.trim()) || 'einsteinananth24-4@okicici';
      const legacyBackup2 = (settings.backupUpi2 && settings.backupUpi2.trim()) || '';
      const legacyMerchantName = (settings.merchantName && settings.merchantName.trim()) || 'Edappadi Kadai';
      const legacyEnabled = settings.upiEnabled !== false;

      if (!settings.upiSettings) {
        settings.upiSettings = {
          upiEnabled: legacyEnabled,
          currency: 'INR',
          accounts: [
            {
              id: 'primary',
              label: 'Primary UPI',
              upiId: legacyPrimary,
              merchantName: legacyMerchantName,
              displayName: 'Anantharaj Primary',
              note: 'Order {id} - Edappadi Kadai',
              isActive: true
            },
            {
              id: 'backup1',
              label: 'Backup UPI 1',
              upiId: legacyBackup1,
              merchantName: legacyMerchantName,
              displayName: 'Backup UPI 1',
              note: 'Order {id} - Edappadi Kadai',
              isActive: !!legacyBackup1
            },
            {
              id: 'backup2',
              label: 'Backup UPI 2',
              upiId: legacyBackup2,
              merchantName: legacyMerchantName,
              displayName: 'Backup UPI 2',
              note: 'Order {id} - Edappadi Kadai',
              isActive: !!legacyBackup2
            }
          ]
        };
        updated = true;
      } else {
        if (settings.upiSettings.upiEnabled === undefined) {
          settings.upiSettings.upiEnabled = legacyEnabled;
          updated = true;
        }
        if (!settings.upiSettings.currency) {
          settings.upiSettings.currency = 'INR';
          updated = true;
        }
        if (!Array.isArray(settings.upiSettings.accounts)) {
          settings.upiSettings.accounts = [];
          updated = true;
        }

        // Ensure primary account slot
        let primary = settings.upiSettings.accounts.find(a => a.id === 'primary');
        if (!primary) {
          primary = {
            id: 'primary',
            label: 'Primary UPI',
            upiId: legacyPrimary,
            merchantName: legacyMerchantName,
            displayName: 'Anantharaj Primary',
            note: 'Order {id} - Edappadi Kadai',
            isActive: true
          };
          settings.upiSettings.accounts.push(primary);
          updated = true;
        } else if (!primary.upiId && legacyPrimary) {
          primary.upiId = legacyPrimary;
          updated = true;
        }

        // Ensure backup1 account slot
        let backup1 = settings.upiSettings.accounts.find(a => a.id === 'backup1');
        if (!backup1) {
          backup1 = {
            id: 'backup1',
            label: 'Backup UPI 1',
            upiId: legacyBackup1,
            merchantName: legacyMerchantName,
            displayName: 'Backup UPI 1',
            note: 'Order {id} - Edappadi Kadai',
            isActive: !!legacyBackup1
          };
          settings.upiSettings.accounts.push(backup1);
          updated = true;
        } else if (!backup1.upiId && legacyBackup1) {
          backup1.upiId = legacyBackup1;
          updated = true;
        }

        // Ensure backup2 account slot
        let backup2 = settings.upiSettings.accounts.find(a => a.id === 'backup2');
        if (!backup2) {
          backup2 = {
            id: 'backup2',
            label: 'Backup UPI 2',
            upiId: legacyBackup2,
            merchantName: legacyMerchantName,
            displayName: 'Backup UPI 2',
            note: 'Order {id} - Edappadi Kadai',
            isActive: !!legacyBackup2
          };
          settings.upiSettings.accounts.push(backup2);
          updated = true;
        }
      }

      // Sync top-level backward compatibility fields
      const pAcc = settings.upiSettings.accounts.find(a => a.id === 'primary');
      const b1Acc = settings.upiSettings.accounts.find(a => a.id === 'backup1');
      const b2Acc = settings.upiSettings.accounts.find(a => a.id === 'backup2');

      if (pAcc && pAcc.upiId) {
        if (settings.merchantUpiId !== pAcc.upiId) {
          settings.merchantUpiId = pAcc.upiId;
          updated = true;
        }
        if (pAcc.merchantName && settings.merchantName !== pAcc.merchantName) {
          settings.merchantName = pAcc.merchantName;
          updated = true;
        }
      }
      if (b1Acc && settings.backupUpi1 !== (b1Acc.upiId || '')) {
        settings.backupUpi1 = b1Acc.upiId || '';
        updated = true;
      }
      if (b2Acc && settings.backupUpi2 !== (b2Acc.upiId || '')) {
        settings.backupUpi2 = b2Acc.upiId || '';
        updated = true;
      }
      if (settings.upiEnabled !== settings.upiSettings.upiEnabled) {
        settings.upiEnabled = settings.upiSettings.upiEnabled;
        updated = true;
      }

      if (updated) {
        saveData('ek_settings', settings);
        const isAdmin = (typeof getAdminSession === 'function' && !!getAdminSession()) || !!getData('ek_admin_session');
        const hasAuthUser = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
        if (isAdmin && hasAuthUser && typeof db !== 'undefined' && db) {
          db.collection('ek_settings').doc('global_config').set(cleanFirestoreData(settings), { merge: true })
            .then(() => debugLog("[UPI Self-Heal] Successfully synced updated UPI settings to Firestore (global_config)"))
            .catch(err => {
              if (err && err.code !== 'permission-denied') {
                console.warn("[UPI Self-Heal] Cloud sync notice:", err.message || err);
              }
            });
          db.collection('ek_settings').doc('global').set(cleanFirestoreData(settings), { merge: true }).catch(() => {});
        }
      }
    }

    function purgeAllDemoData() {
      debugLog("[Slate Purge] purgeAllDemoData bypassed for safety. No collections are wiped.");
    }

    function purgeLegacyDemoProductsFromFirestore() {
      debugLog("[Slate Purge] purgeLegacyDemoProductsFromFirestore bypassed for safety.");
    }

    function seedDatabase() {
      try {
        purgeAllDemoData();
      } catch(ex) {
        console.error("purgeAllDemoData failed: ", ex);
      }
      const hasFirestoreConnection = (typeof db !== 'undefined' && db);
      const isAdmin = (typeof getAdminSession === 'function' && !!getAdminSession()) || !!getData('ek_admin_session');
      let existingProds = getData('ek_products');
      let existingCats = getData('ek_categories');
      const isDbInitialized = getData('ek_db_initialized') === true;
      const isCloudSynced = window._hasFreshCloudData || getData('ek_cloud_synced') === true;
      debugLog(`[DEBUG seedDatabase] existingProds count: ${Array.isArray(existingProds) ? existingProds.length : 'non-array'}, existingCats count: ${Array.isArray(existingCats) ? existingCats.length : 'non-array'}, isDbInitialized: ${isDbInitialized}, isCloudSynced: ${isCloudSynced}`);
      if (!Array.isArray(existingProds)) {
        saveData('ek_products', []);
      }

      if (!Array.isArray(existingCats) || existingCats === null || existingCats.length === 0) {
        if (typeof DEFAULT_CATEGORIES !== 'undefined' && Array.isArray(DEFAULT_CATEGORIES) && DEFAULT_CATEGORIES.length > 0) {
          saveData('ek_categories', DEFAULT_CATEGORIES.map(c => ({ ...c, isAvailable: true })));
        }
      }
      saveData('ek_db_initialized', true);
      debugLog(`[DEBUG seedDatabase] finished. final ek_products count: ${getData('ek_products')?.length}, final ek_categories count: ${getData('ek_categories')?.length}`);
      let existingUsers = getData('ek_users');
      if (!Array.isArray(existingUsers) || existingUsers.length === 0) {
        saveData('ek_users', []);
      }
      if (getData('ek_settings', null) === null) {
        saveData('ek_settings', DEFAULT_SETTINGS);
      }
      try {
        initializeOrFixUpiSettings();
      } catch (e) {
        console.error("initializeOrFixUpiSettings failed: ", e);
      }
      let existingDeliv = getData('ek_delivery_persons');
      if (!Array.isArray(existingDeliv)) {
        saveData('ek_delivery_persons', []);
      }
      let existingOrders = getData('ek_orders');
      if (!Array.isArray(existingOrders) || existingOrders.length === 0) {
        saveData('ek_orders', []);
      }
    }

    let currentLang = 'en';
    try {
      localStorage.setItem('ek_lang', 'en');
      if (typeof AndroidStorage !== 'undefined') {
        try {
          AndroidStorage.saveData('ek_lang', 'en');
        } catch (e) {}
      }
      currentLang = 'en';
    } catch (e) {}
    let currentScreen = 'screen-splash';
    let secureGeneratedOTP = null;
    let screenHistory = [];
    let isNavigatingBack = false;
    let isFirebaseAuthRestoring = true;
    let activeCategory = 'all';
    let activeProduct = null;
    let selectedWeight = 500; // default 500g
    let selectedCutStyle = 'Small Pieces';
    let cart = (typeof getData === 'function') ? getData('ek_cart', []) : (typeof window !== 'undefined' && typeof window.getData === 'function' ? window.getData('ek_cart', []) : []);
    let appliedCouponCode = null;
    let selectedDeliverySlot = 'Now';
    let selectedPaymentMethod = 'Cash on Delivery';
    let currentDeliveryFilter = 'assigned';
    let currentLoginMode = 'customer';

    // Synchronize onto window for global cross-module accessibility
    window.currentLang = currentLang;
    window.currentScreen = currentScreen;
    window.cart = cart;
    window.activeCategory = activeCategory;
    window.activeProduct = activeProduct;
    window.selectedWeight = selectedWeight;
    window.selectedCutStyle = selectedCutStyle;
    window.appliedCouponCode = appliedCouponCode;
    window.selectedDeliverySlot = selectedDeliverySlot;
    window.selectedPaymentMethod = selectedPaymentMethod;
    window.currentDeliveryFilter = currentDeliveryFilter;
    window.currentLoginMode = currentLoginMode;

    const STRINGS = {
      en: {
        appName: "EDAPPADI KADAI",
        tagline: "Fresh Meat & Vegetables, Delivered Fast",
        login: "Login",
        register: "Register Now →",
        createAccountBtn: "Create Account ✓",
        home: "Home",
        cart: "Cart",
        track: "Track",
        profile: "Profile",
        lyo_ai: "Lyo AI",
        phone: "Email or Phone Number",
        password: "Password",
        rememberMe: "Remember Me",
        adminLoginHere: "Admin Login",
        aboutDev: "Developer Info",
        createAccount: "Create Account",
        phonePlaceholder: "Enter your registered phone or email",
        passPlaceholder: "••••••",
        name: "Full Name *",
        namePlaceholder: "For example: Rajenthiran",
        phoneLabel: "Phone Number (10 digits) *",
        phoneInputPlaceholder: "8778148899",
        email: "Email ID (Optional)",
        emailPlaceholder: "email@example.com",
        address: "Delivery Address *",
        addrPlaceholder: "Kavandampatti, Idappadi, Salem, pincode...",
        confirmPassword: "Confirm Password *",
        subscribeWA: "Subscribe to WhatsApp updates",
        existingAccount: "Already have an account? Login Here",
        favoriteProducts: "Favorite Products",
        orderStatistics: "Order Statistics",
        orders: "Orders",
        forgotPassword: "Forgot Password?",
        offers: "Offers",
        categories: "Categories",
        shareLink: "🔗 Share Link"
      },
      ta: {
        appName: "எடப்பாடி கடை",
        tagline: "தரமான இறைச்சி & காய்கறி — இல்லத்திற்கே விரைவான விநியோகம்",
        login: "உள்நுழைவு",
        register: "இப்போதே பதிவு செய்க →",
        createAccountBtn: "கணக்கை உருவாக்கு ✓",
        home: "முகப்பு",
        cart: "கூடை",
        track: "கண்காணி",
        profile: "சுயவிவரம்",
        lyo_ai: "Lyo AI",
        phone: "கைபேசி அல்லது மின்னஞ்சல்",
        password: "கடவுச்சொல்",
        rememberMe: "என்னை நினைவில் வை",
        adminLoginHere: "நிர்வாகி உள்நுழைவு",
        aboutDev: "டெவலப்பர் விவரம்",
        createAccount: "கணக்கை உருவாக்கு",
        forgotPassword: "கடவுச்சொல்லை மறந்துவிட்டீர்களா?",
        phonePlaceholder: "பதிவுசெய்யப்பட்ட கைபேசி அல்லது மின்னஞ்சல்",
        passPlaceholder: "••••••",
        name: "முழு பெயர் *",
        namePlaceholder: "விளக்கம்: இராஜேந்திரன்",
        phoneLabel: "கைபேசி எண் (10 இலக்கங்கள்) *",
        phoneInputPlaceholder: "8778148899",
        email: "மின்னஞ்சல் முகவரி (விரும்பினால்)",
        emailPlaceholder: "மின்னஞ்சல் முகவரி",
        address: "விநியோக முகவரி *",
        addrPlaceholder: "கவுண்டம்பட்டி, எடப்பாடி, சேலம், பின்கோடு...",
        confirmPassword: "கடவுச்சொல் உறுதி *",
        subscribeWA: "வாட்ஸ்அப் அறிவிப்புகளைப் பெறுக",
        existingAccount: "ஏற்கனவே கணக்கு உள்ளதா? உள்நுழைக",
        favoriteProducts: "விருப்பமான இறைச்சி வகைகள்",
        orderStatistics: "ஆர்டர் பகுப்பாய்வு",
        orders: "ஆர்டர்கள்",
        offers: "சலுகைகள்",
        categories: "வகைகள்",
        shareLink: "🔗 லிங்கை பகிர்க"
      }
    };

    function t(key) {
      return (STRINGS[currentLang] && STRINGS[currentLang][key]) || key;
    }

    function applyTranslations() {
      const isTa = currentLang === 'ta';
      document.body.classList.toggle('tamil-mode', isTa);

      document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.getAttribute('data-translate');
        if (STRINGS[currentLang] && STRINGS[currentLang][key]) {
          el.innerText = STRINGS[currentLang][key];
        }
      });

      document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
        const key = el.getAttribute('data-translate-placeholder');
        if (STRINGS[currentLang] && STRINGS[currentLang][key]) {
          el.setAttribute('placeholder', STRINGS[currentLang][key]);
        }
      });

      const appHeading = document.querySelector('#screen-splash h1');
      if (appHeading) appHeading.innerText = isTa ? "எடப்பாடி கடை" : "EDAPPADI KADAI";

      const splashTag = document.querySelector('#screen-splash p');
      if (splashTag) splashTag.innerText = isTa ? "தரமான இறைச்சி & காய்கறி — இல்லத்திற்கே விரைவான விநியோகம்" : "Fresh Meat & Vegetables, Delivered Fast";

      const loginH2 = document.querySelector('#screen-login h2');
      if (loginH2) loginH2.innerText = "Edappadi Kadai";

      const loginP = document.querySelector('#screen-login p.auth-3d-subtitle');
      if (loginP) loginP.innerText = "Premium Quality Meat & Veg Delivery";

      const tabSpans = document.querySelectorAll('#app-bottom-nav span[data-translate]');
      tabSpans.forEach(span => {
        const key = span.getAttribute('data-translate');
        span.innerText = t(key);
      });

      const pLang = document.getElementById('langLabelProfile');
      if (pLang) pLang.innerText = isTa ? "English" : "தமிழ்";

      if (currentScreen === 'screen-home') {
        try { renderHomeScreen(); } catch(e) { console.error('renderHomeScreen in applyTranslations failed:', e); }
      } else if (currentScreen === 'screen-cart') {
        try { renderCartScreen(); } catch(e) { console.error('renderCartScreen failed:', e); }
      } else if (currentScreen === 'screen-track') {
        try { renderTrackerScreen(); } catch(e) { console.error('renderTrackerScreen failed:', e); }
      } else if (currentScreen === 'screen-profile') {
        try { renderProfileScreen(); } catch(e) { console.error('renderProfileScreen failed:', e); }
      }
      try {
        if (typeof syncCollapsePreferences === 'function') {
          syncCollapsePreferences();
        }
      } catch (e) {
        console.error("syncCollapsePreferences error", e);
      }
    }

    function getCloudFunction(name) {
      if (typeof firebase === 'undefined' || !firebase.functions) {
        return null;
      }
      try {
        return firebase.app().functions('asia-south1').httpsCallable(name);
      } catch (e) {
        try {
          return firebase.functions('asia-south1').httpsCallable(name);
        } catch (e2) {
          try {
            return firebase.functions().httpsCallable(name);
          } catch (e3) {
            return null;
          }
        }
      }
    }

    async function reverseGeocodeWithRetry(lat, lng, retries = 1, delay = 1000) {
      const numLat = parseFloat(lat);
      const numLng = parseFloat(lng);
      if (isNaN(numLat) || isNaN(numLng)) {
        return { displayName: "Selected Delivery Location, Edappadi, Salem, Tamil Nadu" };
      }

      // 1. First priority: High-speed native Android Geocoder (zero network latency, zero CORS)
      if (window.AndroidStorage && typeof window.AndroidStorage.nativeReverseGeocode === 'function') {
        try {
          const nativeJson = window.AndroidStorage.nativeReverseGeocode(numLat, numLng);
          if (nativeJson && nativeJson.length > 5) {
            const parsed = JSON.parse(nativeJson);
            if (parsed && parsed.displayName) {
              return parsed;
            }
          }
        } catch (nativeErr) {
          console.warn("[Geocoder] Native reverse geocode attempt error:", nativeErr);
        }
      }

      // 2. Second priority: Cloud Function geocodeDeliveryAddress if authenticated
      try {
        const geocodeFn = getCloudFunction('geocodeDeliveryAddress');
        if (geocodeFn) {
          const res = await geocodeFn({ lat: numLat, lng: numLng });
          if (res && res.data && res.data.displayName) {
            return res.data;
          }
        }
      } catch (cfErr) {
        console.warn("[Geocoder] Cloud function geocode fallback triggered:", cfErr.message || cfErr);
      }

      // 3. Third priority: BigDataCloud free client reverse geocode (CORS-free, instant, highly reliable in webviews)
      try {
        const bdcRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${numLat}&longitude=${numLng}&localityLanguage=en`);
        if (bdcRes && bdcRes.ok) {
          const bdcData = await bdcRes.json();
          if (bdcData) {
            const locality = bdcData.locality || bdcData.city || '';
            const city = bdcData.city || 'Edappadi';
            const state = bdcData.principalSubdivision || 'Tamil Nadu';
            const postcode = bdcData.postcode || '637101';
            const parts = [locality, city, 'Salem', state, postcode].filter((v, i, a) => v && a.indexOf(v) === i);
            const fullAddr = parts.join(', ');
            if (fullAddr.length > 5) {
              return {
                displayName: fullAddr,
                street: locality,
                area: locality || city,
                city: city,
                postalCode: postcode,
                lat: numLat,
                lng: numLng
              };
            }
          }
        }
      } catch (bdcErr) {
        console.warn("[Geocoder] BigDataCloud reverse geocode attempt error:", bdcErr);
      }

      // 4. Fourth priority: Direct OpenStreetMap Nominatim reverse geocode (has CORS headers)
      try {
        const osmRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${numLat}&lon=${numLng}&zoom=18&addressdetails=1`, {
          headers: { 'Accept': 'application/json' }
        });
        if (osmRes && osmRes.ok) {
          const data = await osmRes.json();
          if (data && data.display_name) {
            const addr = data.address || {};
            return {
              displayName: data.display_name,
              street: addr.road || addr.suburb || '',
              area: addr.suburb || addr.neighbourhood || addr.village || addr.town || '',
              city: addr.city || addr.town || addr.county || 'Edappadi',
              postalCode: addr.postcode || '637101',
              lat: numLat,
              lng: numLng
            };
          }
        }
      } catch (osmErr) {
        console.warn("[Geocoder] OSM reverse geocode attempt error:", osmErr);
      }

      return {
        displayName: `Location near Edappadi (${numLat.toFixed(4)}, ${numLng.toFixed(4)}), Salem, Tamil Nadu - 637101`,
        street: 'Edappadi Main Area',
        area: 'Edappadi',
        city: 'Edappadi',
        postalCode: '637101',
        lat: numLat,
        lng: numLng
      };
    }

    async function searchAddressGeocode(query) {
      const q = String(query || '').trim();
      if (!q) return [];

      const fullQuery = q.toLowerCase().includes('salem') || q.toLowerCase().includes('edappadi') ? q : `${q}, Edappadi, Salem, Tamil Nadu`;

      // 1. Native Android Forward Geocoding
      if (window.AndroidStorage && typeof window.AndroidStorage.nativeForwardGeocode === 'function') {
        try {
          const nativeJson = window.AndroidStorage.nativeForwardGeocode(fullQuery);
          if (nativeJson && nativeJson.length > 5) {
            const parsed = JSON.parse(nativeJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          }
        } catch (nativeErr) {
          console.warn("[Geocoder] Native forward geocode error:", nativeErr);
        }
      }

      // 2. Cloud Function
      try {
        const geocodeFn = getCloudFunction('geocodeDeliveryAddress');
        if (geocodeFn) {
          const res = await geocodeFn({ address: fullQuery });
          if (res && res.data && res.data.latitude) {
            return [{
              displayName: res.data.displayName || fullQuery,
              latitude: parseFloat(res.data.latitude),
              longitude: parseFloat(res.data.longitude),
              lat: parseFloat(res.data.latitude),
              lng: parseFloat(res.data.longitude)
            }];
          }
        }
      } catch (cfErr) {
        console.warn("[Geocoder] Cloud function search fallback triggered:", cfErr.message || cfErr);
      }

      // 3. Direct Nominatim OpenStreetMap Search
      try {
        const osmRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=5&addressdetails=1`, {
          headers: { 'Accept': 'application/json' }
        });
        if (osmRes && osmRes.ok) {
          const list = await osmRes.json();
          if (Array.isArray(list) && list.length > 0) {
            return list.map(item => ({
              displayName: item.display_name,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon)
            }));
          }
        }
      } catch (osmErr) {
        console.warn("[Geocoder] OSM search geocode error:", osmErr);
      }

      return [];
    }

    function mapErrorMessage(message) {
      if (!message) return "Something went wrong. Please try again.";
      if (typeof debugLog === 'function') {
        debugLog("[Toast Error System] Original error message before mapping:", message);
      }
      let lower = String(message).toLowerCase();

      if (lower.includes("insufficient permission") ||
          lower.includes("insufficient permissions") ||
          lower.includes("permission-denied") ||
          lower.includes("permission denied")) {
        return "Access denied. Please try again or contact admin.";
      }

      if (lower.includes("wrong password") ||
          lower.includes("wrong-password") ||
          lower.includes("invalid credential") ||
          lower.includes("invalid-credential") ||
          lower.includes("invalid password") ||
          lower.includes("auth/wrong-password")) {
        return "Incorrect password. Please try again.";
      }

      if (lower.includes("network error") ||
          lower.includes("network-error") ||
          lower.includes("offline") ||
          lower.includes("failed to fetch") ||
          lower.includes("network connection") ||
          lower.includes("network issue") ||
          lower.includes("unavailable") ||
          lower.includes("timeout") ||
          lower.includes("timed out") ||
          lower.includes("retry limit exceeded")) {
        return "Network issue. Check your internet connection.";
      }

      if (
        lower.includes("firebase") ||
        lower.includes("firestore") ||
        lower.includes("database") ||
        lower.includes("storage") ||
        lower.includes("auth/") ||
        lower.includes("api_key") ||
        lower.includes("api key") ||
        lower.includes("document") ||
        lower.includes("collection") ||
        lower.includes("path/") ||
        lower.includes("stack trace") ||
        lower.includes("stacktrace") ||
        lower.includes("exception") ||
        lower.includes("unhandled") ||
        lower.includes("@") ||
        lower.includes("http") ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(lower) ||
        /auth\/[a-z0-9-]+/.test(lower)
      ) {
        return "Something went wrong. Please try again.";
      }

      return message;
    }

    function toggleSectionCollapse(sectionId) {
      const container = document.getElementById(sectionId + '-collapse-container');
      const arrow = document.getElementById(sectionId + '-collapse-arrow') || document.getElementById('admin-' + sectionId + '-collapse-arrow');
      if (!container) return;

      const currentMaxHeight = (container.style.maxHeight || '').trim();
      const isCollapsed = currentMaxHeight === '0px' || currentMaxHeight === '0' || currentMaxHeight === '' || container.classList.contains('collapsed');

      if (isCollapsed) {
        if (sectionId === 'categories' && typeof renderAdminCategoriesList === 'function') {
          renderAdminCategoriesList(true);
        } else if (sectionId === 'carousel' && typeof renderAdminBannerList === 'function') {
          renderAdminBannerList(true);
        } else if (sectionId === 'upi-config' && typeof renderAdminUpiSettings === 'function') {
          if (typeof renderAdminUpiSettings === 'function') renderAdminUpiSettings(true);
        } else if ((sectionId === 'delivery' || sectionId === 'zones') && typeof initAdminZonesMap === 'function') {
          setTimeout(() => {
            if (typeof initAdminZonesMap === 'function') initAdminZonesMap();
          }, 350);
          setTimeout(() => {
            if (typeof refreshAdminZonesMapSize === 'function') refreshAdminZonesMapSize();
          }, 700);
        }

        container.classList.remove('collapsed');
        container.classList.add('expanded');
        container.style.maxHeight = Math.max(container.scrollHeight, 600) + 'px';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        try { sessionStorage.setItem('collapse_' + sectionId, 'expanded'); } catch(e) {}

        setTimeout(() => {
          if (container.classList.contains('expanded') || container.style.maxHeight !== '0px') {
            container.style.maxHeight = 'none';
          }
        }, 350);
      } else {
        container.style.maxHeight = container.scrollHeight + 'px';
        container.offsetHeight; // force reflow

        container.classList.remove('expanded');
        container.classList.add('collapsed');
        container.style.maxHeight = '0px';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        try { sessionStorage.setItem('collapse_' + sectionId, 'collapsed'); } catch(e) {}
      }
    }

    function initSectionCollapse(sectionId, defaultState = 'collapsed') {
      const container = document.getElementById(sectionId + '-collapse-container');
      const arrow = document.getElementById(sectionId + '-collapse-arrow') || document.getElementById('admin-' + sectionId + '-collapse-arrow');
      if (!container) return;

      const savedState = sessionStorage.getItem('collapse_' + sectionId) || defaultState;

      if (savedState === 'expanded' || savedState === 'open') {
        if (sectionId === 'categories' && typeof renderAdminCategoriesList === 'function') {
          renderAdminCategoriesList(true);
        } else if (sectionId === 'carousel' && typeof renderAdminBannerList === 'function') {
          renderAdminBannerList(true);
        } else if (sectionId === 'upi-config' && typeof renderAdminUpiSettings === 'function') {
          if (typeof renderAdminUpiSettings === 'function') renderAdminUpiSettings(true);
        }
        container.classList.remove('collapsed');
        container.classList.add('expanded');
        container.style.maxHeight = 'none';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
      } else {
        container.classList.remove('expanded');
        container.classList.add('collapsed');
        container.style.maxHeight = '0px';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        // Pre-render content into the DOM so it expands instantly without layout jumps
        if (sectionId === 'categories' && typeof renderAdminCategoriesList === 'function') {
          renderAdminCategoriesList(true);
        } else if (sectionId === 'carousel' && typeof renderAdminBannerList === 'function') {
          renderAdminBannerList(true);
        } else if (sectionId === 'upi-config' && typeof renderAdminUpiSettings === 'function') {
          if (typeof renderAdminUpiSettings === 'function') renderAdminUpiSettings(true);
        }
      }
    }

    window.toggleSectionCollapse = toggleSectionCollapse;
    window.initSectionCollapse = initSectionCollapse;

    let toastQueue = [];
    let isToastShowing = false;
    let toastShowTime = 0;
    let lastToastMessage = "";
    let lastToastTime = 0;
    let toastTimeout = null;

    function showToast(message, type = 'success') {
      if (type === 'error') {
        if (typeof safeVibrate === 'function') {
          safeVibrate([12, 35, 18]);
        } else {
          try { if (typeof navigator !== 'undefined' && navigator && navigator.vibrate) navigator.vibrate([12, 35, 18]); } catch(e) {}
        }
      }

      if (type === 'error') {
        message = mapErrorMessage(message);
      }

      if (message === lastToastMessage && Date.now() - lastToastTime < 3000) {
        debugLog("[Toast System] Suppressed duplicate toast:", message);
        return;
      }

      toastQueue.push({ message, type });
      processToastQueue();
    }

    function processToastQueue() {
      if (isToastShowing || toastQueue.length === 0) return;

      isToastShowing = true;
      const currentToast = toastQueue.shift();

      const container = document.getElementById('toast-container');
      const body = document.getElementById('toast-body');
      if (!container || !body) {
        isToastShowing = false;
        return;
      }

      let badge = 'ℹ️';
      let cssClass = 't-info';

      if (currentToast.type === 'success') { badge = '✓'; cssClass = 't-success'; }
      else if (currentToast.type === 'error') { badge = '❌'; cssClass = 't-error'; }
      else if (currentToast.type === 'warning') { badge = '⚠️'; cssClass = 't-warning'; }

      body.className = `toast-body ${cssClass}`;
      body.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; pointer-events: none;">
          <span style="font-size:15px; font-weight:700; line-height: 1; flex-shrink: 0; pointer-events: none;">${badge}</span>
          <span class="toast-text" style="font-size: 12.5px; font-weight: 600; line-height: 1.4; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; pointer-events: none;">${currentToast.message}</span>
        </div>
        <button class="toast-close" style="background: none; border: none; color: rgba(255,255,255,0.75); font-size: 16px; font-weight: bold; cursor: pointer; padding: 4px 8px; margin-left: 8px; flex-shrink: 0; pointer-events: auto; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; transition: background 0.2s, color 0.2s; box-sizing: border-box;" onclick="event.stopPropagation(); event.preventDefault(); dismissToast();" ontouchstart="event.stopPropagation(); dismissToast();" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='none'; this.style.color='rgba(255,255,255,0.75)';">✕</button>
      `;

      lastToastMessage = currentToast.message;
      lastToastTime = Date.now();
      toastShowTime = Date.now();

      container.classList.add('show');

      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        dismissToast();
      }, currentToast.type === 'error' ? 3000 : 2200);
    }

    function dismissToast() {
      const container = document.getElementById('toast-container');
      if (!container) return;

      container.classList.remove('show');
      if (toastTimeout) clearTimeout(toastTimeout);

      setTimeout(() => {
        isToastShowing = false;
        processToastQueue();
      }, 200);
    }

    function showCustomConfirm(title, message, onConfirm, onCancel, okText, cancelText) {
      let modal = document.getElementById('custom-confirm-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'position: fixed; inset: 0; z-index: 999999 !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 20px; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);';
        modal.innerHTML = `
          <div class="bottom-sheet" style="width: 100%; max-width:340px; border-radius:24px; border:1px solid var(--border-color, #262626); background:var(--bg-card, #121212); padding:24px; box-shadow:0 12px 40px rgba(0,0,0,0.6); text-align:center; transform:scale(0.85); transition:transform 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28); margin:auto; display:flex; flex-direction:column; align-items:center;">
            <div style="font-size:42px; margin-bottom:14px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.05));" id="confirm-modal-icon">⚠️</div>
            <h3 style="color:var(--text-primary, #ffffff); font-size:16px; margin-bottom:8px; font-weight:800; font-family:'Poppins', 'Hind Madurai', sans-serif;" id="confirm-modal-title">Confirm Action</h3>
            <p style="color:var(--text-secondary, #9e9e9e); font-size:12.5px; margin-bottom:24px; line-height:1.6; word-break:break-word; max-width:100%; font-family:'Poppins', 'Hind Madurai', sans-serif;" id="confirm-modal-message"></p>
            <div style="display:flex; gap:12px; justify-content:center; width:100%;">
              <button class="btn btn-secondary" style="flex:1; padding:10px 14px; font-size:12px; font-weight:bold; border-radius:14px; height:42px; background:#262626; color:#e0e0e0; border:1px solid rgba(255,255,255,0.1); cursor:pointer;" id="confirm-modal-cancel-btn">CLOSE</button>
              <button class="btn" style="flex:1; padding:10px 14px; font-size:12px; font-weight:800; border-radius:14px; height:42px; background:#ef4444; color:#ffffff; border:none; box-shadow:0 4px 12px rgba(239,68,68,0.3); cursor:pointer;" id="confirm-modal-ok-btn">DELETE</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      const sheet = modal.querySelector('.bottom-sheet');
      if (sheet) {
        if (message.includes('WILL BE DELETED')) {
          sheet.style.maxWidth = '420px';
        } else {
          sheet.style.maxWidth = '340px';
        }
      }

      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const iconEl = document.getElementById('confirm-modal-icon');
      const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
      const okBtn = document.getElementById('confirm-modal-ok-btn');

      if (titleEl) titleEl.innerHTML = title;
      if (msgEl) msgEl.innerHTML = message;

      const titleLower = (title || "").toLowerCase();
      const isLogout = titleLower.includes("logout") || title.includes("வெளியேறு");
      const isDangerous = isLogout || titleLower.includes("delete") || titleLower.includes("remove") || title.includes("நீக்க") || title.includes("ஒழி") || titleLower.includes("cancel") || title.includes("ரத்து");

      if (isLogout) {
        if (iconEl) iconEl.innerText = '🚪';
        if (okBtn) {
          okBtn.style.background = '#ef4444';
          okBtn.style.color = '#ffffff';
          okBtn.style.borderColor = '#ef4444';
          okBtn.innerText = okText || ((typeof currentLang !== 'undefined' && currentLang === 'ta') ? 'வெளியேறு' : 'Logout');
        }
      } else if (isDangerous) {
        if (iconEl) iconEl.innerText = '🗑️';
        if (okBtn) {
          okBtn.style.background = '#ef4444';
          okBtn.style.color = '#ffffff';
          okBtn.style.borderColor = '#ef4444';
          okBtn.innerText = okText || ((typeof currentLang !== 'undefined' && currentLang === 'ta') ? 'நீக்கு' : 'DELETE');
        }
      } else {
        if (iconEl) iconEl.innerText = '⚠️';
        if (okBtn) {
          okBtn.style.background = 'var(--accent-orange, #f59e0b)';
          okBtn.style.color = '#ffffff';
          okBtn.style.borderColor = 'var(--accent-orange, #f59e0b)';
          okBtn.innerText = okText || ((typeof currentLang !== 'undefined' && currentLang === 'ta') ? 'உறுதிசெய்' : 'CONFIRM');
        }
      }
      if (cancelBtn) cancelBtn.innerText = cancelText || ((typeof currentLang !== 'undefined' && currentLang === 'ta') ? 'ரத்துசெய்' : 'CANCEL');

      const closeModal = () => {
        modal.classList.remove('active');
        if (sheet) sheet.style.transform = 'scale(0.85)';
        setTimeout(() => {
          modal.style.setProperty('display', 'none', 'important');
        }, 150);
      };

      cancelBtn.onclick = function(e) {
        if (e) e.stopPropagation();
        closeModal();
        if (onCancel) onCancel();
      };

      modal.onclick = function(e) {
        if (e.target === modal) {
          closeModal();
          if (onCancel) onCancel();
        }
      };

      okBtn.onclick = function(e) {
        if (e) e.stopPropagation();
        okBtn.onclick = null;
        closeModal();
        if (onConfirm) onConfirm();
      };

      modal.style.setProperty('display', 'flex', 'important');
      modal.classList.add('active');
      if (sheet) sheet.style.transform = 'scale(1)';
    }

    function showCustomAlert(title, message, onOk) {
      let modal = document.getElementById('custom-alert-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-alert-modal';
        modal.className = 'modal-backdrop';
        modal.style.zIndex = '99999';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.padding = '20px';
        modal.innerHTML = `
          <div class="bottom-sheet" style="width: 100%; max-width:340px; border-radius:24px; border:1px solid var(--border-color); background:var(--bg-card); padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.06); text-align:center; transform:scale(0.85); transition:all 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28); margin:auto; display:flex; flex-direction:column; align-items:center;">
            <div style="font-size:42px; margin-bottom:14px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.05));" id="alert-modal-icon">ℹ️</div>
            <h3 style="color:var(--text-primary); font-size:16px; margin-bottom:8px; font-weight:800; font-family:'Poppins', 'Hind Madurai', sans-serif;" id="alert-modal-title">Info</h3>
            <p style="color:var(--text-secondary); font-size:12.5px; margin-bottom:24px; line-height:1.6; word-break:break-word; max-width:100%; font-family:'Poppins', 'Hind Madurai', sans-serif;" id="alert-modal-message"></p>
            <div style="display:flex; justify-content:center; width:100%;">
              <button class="btn" style="width:100%; padding:10px 14px; font-size:12px; font-weight:800; border-radius:14px; height:42px; background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color:#ffffff; border:none; box-shadow:0 4px 12px rgba(245,158,11,0.18);" id="alert-modal-ok-btn">சரி / OK</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      const titleEl = document.getElementById('alert-modal-title');
      const msgEl = document.getElementById('alert-modal-message');
      const iconEl = document.getElementById('alert-modal-icon');
      const okBtn = document.getElementById('alert-modal-ok-btn');

      titleEl.innerHTML = title;
      msgEl.innerHTML = message;

      const lowerTitle = String(title).toLowerCase();
      const lowerMessage = String(message).toLowerCase();

      if (lowerTitle.includes("error") || lowerTitle.includes("fail") || lowerTitle.includes("பிரச்சினை") || lowerTitle.includes("தவறு") || lowerMessage.includes("failed") || lowerMessage.includes("insufficient") || lowerMessage.includes("permission")) {
        iconEl.innerText = '❌';
        okBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        okBtn.style.color = '#ffffff';
      } else if (lowerTitle.includes("success") || lowerTitle.includes("வெற்றி") || lowerTitle.includes("வாழ்த்துக்கள்") || lowerMessage.includes("success") || lowerMessage.includes("வெற்றிகரமாக")) {
        iconEl.innerText = '🎉';
        okBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        okBtn.style.color = '#ffffff';
      } else {
        iconEl.innerText = 'ℹ️';
        okBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        okBtn.style.color = '#ffffff';
      }

      const closeModal = () => {
        modal.classList.remove('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(0.85)';
        setTimeout(() => { modal.style.display = 'none'; }, 200);
      };

      okBtn.onclick = function() {
        closeModal();
        if (onOk) onOk();
      };

      modal.style.display = 'flex';
      setTimeout(() => {
        modal.classList.add('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(1)';
      }, 15);
    }

    window.alert = function(msg) {
      showCustomAlert("அறிவிப்பு / Notification", msg);
    };

    function showAdminSuccessModal(title, message) {
      let modal = document.getElementById('admin-success-action-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'admin-success-action-modal';
        modal.className = 'modal-backdrop';
        modal.style.zIndex = '999999';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.padding = '20px';
        modal.style.background = 'rgba(0,0,0,0.35)';
        modal.style.backdropFilter = 'blur(8px)';
        modal.innerHTML = `
          <div class="bottom-sheet" style="width: 100%; max-width:340px; border-radius:24px; border:1px solid var(--border-color); background:var(--bg-card); padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.06); text-align:center; transform:scale(0.85); transition:all 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28); margin:auto; display:flex; flex-direction:column; align-items:center; gap:12px;">
            <div style="width: 56px; height: 56px; background: rgba(16, 185, 129, 0.08); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 2.2px solid #10b981; filter: drop-shadow(0 4px 10px rgba(16,185,129,0.15));">
              <svg viewBox="0 0 52 52" style="width: 30px; height: 30px; stroke-linecap: round; stroke-linejoin: round; display: block;">
                <circle cx="26" cy="26" r="23" fill="none" stroke="#10b981" stroke-width="4" />
                <path fill="none" stroke="#10b981" stroke-width="5" d="M14 27 l8 8 l16 -16" />
              </svg>
            </div>
            <h3 style="color:var(--text-primary); font-size:16px; margin:2px 0; font-weight:800; font-family:'Poppins', 'Hind Madurai', sans-serif;" id="admin-success-title">வெற்றிகரமாகச் செய்யப்பட்டது!</h3>
            <p style="color:var(--text-secondary); font-size:13px; margin:0 0 12px 0; line-height:1.6; word-break:break-word; max-width:100%; font-family:'Poppins', 'Hind Madurai', sans-serif;" id="admin-success-message"></p>
            <div style="width:100%;">
              <button class="btn btn-primary" style="width:100%; padding:10px 14px; font-size:13px; font-weight:800; border-radius:14px; height:42px; background:linear-gradient(135deg, var(--accent-green) 0%, #059669 100%); color:#ffffff; border:none; box-shadow:0 4px 12px rgba(16,185,129,0.18);" id="admin-success-ok-btn">சரி / OK 👍</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      const titleEl = document.getElementById('admin-success-title');
      const msgEl = document.getElementById('admin-success-message');
      const okBtn = document.getElementById('admin-success-ok-btn');

      titleEl.innerHTML = title;
      msgEl.innerHTML = message;

      const closeModal = () => {
        modal.classList.remove('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(0.85)';
        setTimeout(() => { modal.style.display = 'none'; }, 200);
      };

      okBtn.onclick = function() {
        closeModal();
      };

      modal.style.display = 'flex';
      setTimeout(() => {
        modal.classList.add('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(1)';
      }, 15);
    }

    function compressAndScaleImage(file, maxWidth, maxHeight, quality, callback) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          callback(dataUrl);
        };
        img.onerror = function() {
          console.error("Failed to load image for compression");
          callback(e.target.result);
        };
        img.src = e.target.result;
      };
      reader.onerror = function() {
        showToast("Error reading file", "error");
      };
      reader.readAsDataURL(file);
    }

    let tempBase64Image = null;
    let tempBase64Thumb = null;
    let tempProductFile = null;
    let activeUploadTask = null;

    function dataURLtoBlob(dataurl) {
      try {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
      } catch (err) {
        console.error("[Storage Debug] Error converting data URL to Blob:", err);
        return null;
      }
    }

    async function deleteStorageImageByUrl(url) {
      if (!url || typeof url !== 'string') return;
      const isFirebaseStorage = url.includes('firebasestorage.googleapis.com') || url.includes('edappadi-kadai.appspot.com') || url.includes('edappadi-kadai.firebasestorage.app');
      if (!isFirebaseStorage) return;

      try {
        debugLog("[Storage Debug] Attempting to delete old Storage image:", url);
        const storage = firebase.storage();
        const ref = storage.refFromURL(url);
        await ref.delete();
        debugLog("[Storage Debug] Old Storage image deleted successfully:", url);
      } catch (err) {
        console.warn("[Storage Debug] Failed to delete old image (might not exist or permission denied):", err);
      }
    }

    function cancelActiveUpload() {
      if (activeUploadTask) {
        try {
          activeUploadTask.cancel();
          debugLog("[Storage Debug] Active upload task canceled by user.");
          showToast("Image upload was canceled. / படம் பதிவேற்றுவது ரத்து செய்யப்பட்டது.", "info");
        } catch (e) {
          console.error("[Storage Debug] Error canceling upload task:", e);
        }
        activeUploadTask = null;
      }
    }

    function validateSelectedFile(file) {
      if (!file) return { valid: false, error: "தயவுசெய்து ஒரு படத்தை தேர்ந்தெடுக்கவும் / Please select a file." };

      const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'jfif', 'bmp', 'gif'];
      const fileName = (file.name || '').toLowerCase();
      const dotIndex = fileName.lastIndexOf('.');
      const fileExt = dotIndex !== -1 ? fileName.substring(dotIndex + 1) : '';

      const isSupportedExt = allowedExts.includes(fileExt);
      const isSupportedMime = file.type && file.type.toLowerCase().startsWith('image/');

      // If MIME is an image or extension is a recognized image type, accept it.
      if (!isSupportedExt && !isSupportedMime && file.name && dotIndex !== -1) {
        return { valid: false, error: "தேர்வு செய்யப்படாத வடிவம்! JPG, JPEG, PNG அல்லது WEBP படங்களை மட்டுமே பயன்படுத்த முடியும். / Selected image format is not supported. Please use JPG, JPEG, PNG, or WEBP." };
      }

      return { valid: true };
    }

    function getSafeFileName(fileName) {
      if (!fileName) return "product_image.jpg";
      const dotIndex = fileName.lastIndexOf('.');
      const namePart = dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;
      const extPart = dotIndex !== -1 ? fileName.substring(dotIndex) : ".jpg";

      let safeName = namePart.replace(/[^a-zA-Z0-9-_]/g, "_");
      if (!safeName.replace(/_/g, '')) {
        safeName = "product_" + Date.now();
      }
      const cleanExt = (['.jpg', '.jpeg', '.png', '.webp'].includes(extPart.toLowerCase())) ? extPart.toLowerCase() : '.jpg';
      return safeName + cleanExt;
    }

    function getStoragePath(vendorId, productId, originalFileName) {
      const timestamp = Date.now();
      const safeName = getSafeFileName(originalFileName);
      return `products/${vendorId}/${productId}/${timestamp}_${safeName}`;
    }

    async function uploadProductImageToStorage(productId, file, compressedBase64) {
      if (typeof firebase === 'undefined' || !firebase.storage) {
        console.warn("[Storage Fallback] Firebase Storage not available. Using compressed base64 directly.");
        return compressedBase64;
      }

      const activeAdmin = getAdminSession();
      const vendorId = (activeAdmin && (activeAdmin.uid || activeAdmin.id || activeAdmin.phone)) || "edappadi_kadai";

      debugLog("[Storage Debug] Image upload started for vendor:", vendorId, "productId:", productId);

      const storage = firebase.storage();

      try {
        if (typeof storage.setMaxUploadRetryTime === 'function') {
          storage.setMaxUploadRetryTime(15000); // 15s max upload retry for fast failover
        } else {
          storage.maxUploadRetryTime = 15000;
        }
        if (typeof storage.setMaxOperationRetryTime === 'function') {
          storage.setMaxOperationRetryTime(15000); // 15s max operation retry
        } else {
          storage.maxOperationRetryTime = 15000;
        }
      } catch (timeoutConfErr) {
        console.warn("[Storage Debug] Failed to set native retry limits, using default:", timeoutConfErr);
      }

      const uploadPath = getStoragePath(vendorId, productId, file.name);
      debugLog("✓ Upload Started for productId:", productId, "fileName:", file.name);
      debugLog("[Storage Debug] Storage upload path:", uploadPath);

      const imageRef = storage.ref().child(uploadPath);

      const metadata = {
        contentType: file.type || 'image/jpeg',
        customMetadata: {
          'originalName': file.name,
          'productId': productId,
          'vendorId': vendorId,
          'uploadedAt': new Date().toISOString()
        }
      };

      const blob = dataURLtoBlob(compressedBase64);
      if (!blob) {
        console.warn("[Storage Fallback] Blob conversion failed. Falling back to compressed base64.");
        return compressedBase64;
      }

      let progressTimer = null;
      let progressStarted = false;
      let uploadTimeout = null;

      const uploadPromise = new Promise((resolve, reject) => {
        try {
          const uploadTask = imageRef.put(blob, metadata);
          activeUploadTask = uploadTask;

          progressTimer = setTimeout(() => {
            if (!progressStarted) {
              console.warn("[Storage Debug] Upload progress did not start (stuck at 0% for 5 seconds). Canceling and falling back to offline base64...");
              if (activeUploadTask) {
                try { activeUploadTask.cancel(); } catch (e) {}
                activeUploadTask = null;
              }
              reject(new Error("UPLOAD_STUCK_AT_0"));
            }
          }, 5000); // 5-second resilient failover if initial byte upload is stuck

          uploadTimeout = setTimeout(() => {
            console.warn("[Storage Debug] Upload timed out after 15s. Canceling and falling back to offline base64...");
            if (activeUploadTask) {
              try { activeUploadTask.cancel(); } catch (e) {}
              activeUploadTask = null;
            }
            if (progressTimer) clearTimeout(progressTimer);
            reject(new Error("UPLOAD_TIMEOUT"));
          }, 15000); // 15-second overall failover

          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              debugLog('[Storage Debug] Upload progress:', progress + '%');

              if (progress > 0) {
                progressStarted = true;
                if (progressTimer) {
                  clearTimeout(progressTimer);
                  progressTimer = null;
                }
              }

              const addBtn = document.getElementById('prod-submit-btn');
              if (addBtn && addBtn.disabled) {
                addBtn.innerText = `படம் பதிவேற்றம்: ${progress}% / Uploading ${progress}%... ⏳`;
              }
              const editBtn = document.querySelector('#admin-edit-product-form button[type="submit"]');
              if (editBtn && editBtn.disabled) {
                editBtn.innerHTML = `படம் பதிவேற்றம்: ${progress}% / Uploading ${progress}%... ⏳`;
              }
            },
            (error) => {
              console.error('[Storage Debug] Upload callback error:', error);
              if (progressTimer) clearTimeout(progressTimer);
              if (uploadTimeout) clearTimeout(uploadTimeout);
              activeUploadTask = null;
              reject(error);
            },
            () => {
              debugLog('✓ Upload Completed');
              if (progressTimer) clearTimeout(progressTimer);
              if (uploadTimeout) clearTimeout(uploadTimeout);
              activeUploadTask = null;
              imageRef.getDownloadURL()
                .then((downloadUrl) => {
                  const freshUrl = ensureCacheBustingUrl(downloadUrl);
                  debugLog("✓ Download URL Received:", freshUrl);
                  resolve(freshUrl);
                })
                .catch((urlErr) => {
                  reject(urlErr);
                });
            }
          );
        } catch (initErr) {
          if (progressTimer) clearTimeout(progressTimer);
          if (uploadTimeout) clearTimeout(uploadTimeout);
          activeUploadTask = null;
          reject(initErr);
        }
      });

      try {
        const downloadUrl = await uploadPromise;

        if (!downloadUrl || typeof downloadUrl !== 'string' || !downloadUrl.startsWith('https://')) {
          throw new Error("INVALID_DOWNLOAD_URL");
        }

        return downloadUrl;
      } catch (error) {
        console.error('[Storage Debug] Error/Timeout in uploadProductImageToStorage, activating graceful fallback:', error);

        let errCode = error.code || "storage/unknown";
        let errMsg = error.message || error.toString();

        const lowerMsg = errMsg.toLowerCase();
        const lowerCode = errCode.toLowerCase();

        if (lowerCode.includes("unauthorized") || lowerMsg.includes("unauthorized") || lowerMsg.includes("permission denied")) {
          errCode = "storage/unauthorized";
        } else if (lowerCode.includes("canceled") || lowerMsg.includes("canceled") || lowerMsg.includes("cancel")) {
          errCode = "storage/canceled";
        } else if (lowerCode.includes("bucket-not-found") || lowerMsg.includes("bucket")) {
          errCode = "storage/bucket-not-found";
        } else if (lowerCode.includes("quota") || lowerMsg.includes("quota") || lowerMsg.includes("billing")) {
          errCode = "storage/quota-exceeded";
        } else if (lowerCode.includes("retry") || lowerMsg.includes("timeout") || lowerMsg.includes("timed out")) {
          errCode = "storage/retry-limit-exceeded";
        }

        console.warn(`[Storage Fallback] Failover active. Code: ${errCode}. Using base64 optimization fallback.`);
        showToast("படம் வெற்றிகரமாக தயார் செய்யப்பட்டு ஆஃப்லைன் முறையில் சேமிக்கப்பட்டது! / Image prepared & saved offline successfully!", "info");
        return compressedBase64;
      }
    }

    function convertBase64Image(event) {
      const file = event.target.files[0];

      if (!file) {
        tempProductFile = null;
        tempBase64Image = null;
        return;
      }

      const validation = validateSelectedFile(file);
      if (!validation.valid) {
        showToast(validation.error, "error");
        event.target.value = '';
        tempProductFile = null;
        tempBase64Image = null;
        return;
      }

      tempProductFile = file;

      const preferUrlCheck = document.getElementById('add-prod-use-url');
      if (preferUrlCheck) preferUrlCheck.checked = false;

      showToast("Optimizing product image for high dynamic quality...", "info");
      compressAndScaleImage(file, 850, 850, 0.88, function(compressedUrl) {
        tempBase64Image = compressedUrl;
        compressAndScaleImage(file, 300, 300, 0.75, function(compressedThumb) {
          tempBase64Thumb = compressedThumb;
        });
        debugLog("✓ Image Selected:", file.name, "MIME:", file.type, "Size:", file.size);

        const previewImg = document.getElementById('add-prod-preview-img');
        const previewContainer = document.getElementById('add-prod-preview-container');
        if (previewImg && previewContainer) {
          previewImg.src = compressedUrl;
          previewContainer.style.display = 'block';
        }

        showToast("படம் வெற்றிகரமாகத் தேர்ந்தெடுக்கப்பட்டது! ✓ / Image selected and optimized! ✓", "success");
      });
    }

    function updateUrlPreview() {
      const url = document.getElementById('add-prod-url').value.trim();
      const previewImg = document.getElementById('add-prod-preview-img');
      const previewContainer = document.getElementById('add-prod-preview-container');
      const useUrlCheck = document.getElementById('add-prod-use-url');

      if (previewImg && previewContainer) {
        if (url && (!tempBase64Image || (useUrlCheck && useUrlCheck.checked))) {
          previewImg.src = url;
          previewContainer.style.display = 'block';
        } else if (tempBase64Image) {
          previewImg.src = tempBase64Image;
          previewContainer.style.display = 'block';
        } else {
          previewContainer.style.display = 'none';
        }
      }
    }

    function convertEditBase64Image(event) {
      const file = event.target.files[0];

      if (!file) {
        tempProductFile = null;
        tempBase64Image = null;
        return;
      }

      const validation = validateSelectedFile(file);
      if (!validation.valid) {
        showToast(validation.error, "error");
        event.target.value = '';
        tempProductFile = null;
        tempBase64Image = null;
        return;
      }

      tempProductFile = file;
      editProductPhotoDeleted = false;

      const preferUrlCheck = document.getElementById('edit-prod-use-url');
      if (preferUrlCheck) preferUrlCheck.checked = false;

      showToast("Optimizing product image for high dynamic quality...", "info");
      compressAndScaleImage(file, 850, 850, 0.88, function(compressedUrl) {
        tempBase64Image = compressedUrl;
        compressAndScaleImage(file, 300, 300, 0.75, function(compressedThumb) {
          tempBase64Thumb = compressedThumb;
        });
        debugLog("✓ Image Selected:", file.name, "MIME:", file.type, "Size:", file.size);

        const previewImg = document.getElementById('edit-prod-preview-img');
        const previewContainer = document.getElementById('edit-prod-preview-container');
        if (previewImg && previewContainer) {
          previewImg.src = compressedUrl;
          previewContainer.style.display = 'block';
        }

        showToast("படம் வெற்றிகரமாகத் தேர்ந்தெடுக்கப்பட்டது! ✓ / Image selected and optimized! ✓", "success");
      });
    }

    function updateEditUrlPreview() {
      const url = document.getElementById('edit-prod-url').value.trim();
      const previewImg = document.getElementById('edit-prod-preview-img');
      const previewContainer = document.getElementById('edit-prod-preview-container');
      const useUrlCheck = document.getElementById('edit-prod-use-url');

      if (previewImg && previewContainer) {
        if (url && (!tempBase64Image || (useUrlCheck && useUrlCheck.checked))) {
          editProductPhotoDeleted = false;
          previewImg.src = url;
          previewContainer.style.display = 'block';
        } else if (tempBase64Image) {
          editProductPhotoDeleted = false;
          previewImg.src = tempBase64Image;
          previewContainer.style.display = 'block';
        } else {
          if (editProductPhotoDeleted) {
            previewContainer.style.display = 'none';
          } else {
            const productId = editingProductId || document.getElementById('edit-prod-id')?.value;
            const products = getData('ek_products');
            const p = products.find(prod => prod.id === productId);
            if (p && p.imageUrl) {
              previewImg.src = p.imageUrl;
              previewContainer.style.display = 'block';
            } else {
              previewContainer.style.display = 'none';
            }
          }
        }
      }
    }

    function deleteAddProductPhoto() {
      tempBase64Image = null;
      tempProductFile = null;

      const fileInput = document.getElementById('add-prod-file');
      if (fileInput) fileInput.value = '';

      const urlInput = document.getElementById('add-prod-url');
      if (urlInput) urlInput.value = '';

      const useUrlCheck = document.getElementById('add-prod-use-url');
      if (useUrlCheck) useUrlCheck.checked = false;

      const previewContainer = document.getElementById('add-prod-preview-container');
      if (previewContainer) previewContainer.style.display = 'none';

      showToast("போட்டோ நீக்கப்பட்டது / Photo removed.", "success");
    }

    function deleteEditProductPhoto() {
      editProductPhotoDeleted = true;
      tempBase64Image = null;
      tempProductFile = null;

      const fileInput = document.getElementById('edit-prod-file');
      if (fileInput) fileInput.value = '';

      const urlInput = document.getElementById('edit-prod-url');
      if (urlInput) urlInput.value = '';

      const useUrlCheck = document.getElementById('edit-prod-use-url');
      if (useUrlCheck) useUrlCheck.checked = false;

      const previewContainer = document.getElementById('edit-prod-preview-container');
      if (previewContainer) previewContainer.style.display = 'none';

      showToast("போட்டோ நீக்கப்பட்டது. சேமிக்கும்போது இது மாற்றப்படும். / Photo removed. Save to apply.", "success");
    }

    function closeAdminEditProductModalDetail() {
      cancelActiveUpload();
      const modal = document.getElementById('admin-edit-product-modal');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.pointerEvents = 'none';
      }
      document.body.style.overflow = '';
      editingProductId = null;
      tempBase64Image = null;
      tempProductFile = null;
      editProductPhotoDeleted = false;
    }

    function closeAdminEditProductModal(event) {
      if (event.target.id === 'admin-edit-product-modal') {
        closeAdminEditProductModalDetail();
      }
    }

    function openAdminAddProductModal() {
      resetProductForm();
      if (typeof populateProductCategoryOptions === 'function') {
        populateProductCategoryOptions();
      }
      if (window.adminActiveCategory && window.adminActiveCategory !== 'all') {
        const selectAdd = document.getElementById('add-prod-category');
        if (selectAdd) {
          selectAdd.value = window.adminActiveCategory;
        }
      }
      const modal = document.getElementById('admin-add-product-modal');
      if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.pointerEvents = 'auto';
      }
      document.body.style.overflow = 'hidden';
    }

    function closeAdminAddProductModalDetail() {
      cancelActiveUpload();
      const modal = document.getElementById('admin-add-product-modal');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.pointerEvents = 'none';
      }
      document.body.style.overflow = '';
      tempBase64Image = null;
      tempProductFile = null;
    }

    function closeAdminAddProductModal(event) {
      if (event.target.id === 'admin-add-product-modal') {
        closeAdminAddProductModalDetail();
      }
    }

    const LYO_TRANSIT_PHRASES_TA = [
      "உணவுப் பட்டியலை லோட் செய்கிறது...",
      "உங்கள் பாதுகாப்பான இணைப்பை உறுதி செய்கிறது...",
      "புதிய எடப்பாடி கறி விலைகளைச் சரிபார்க்கிறது...",
      "ஆர்டரைத் தயார் செய்யத் திட்டமிடுகிறது...",
      "எடப்பாடி கடை உதவியாளர் தகவல்களைப் புதுப்பிக்கிறது...",
      "லாயல்டி பாயிண்டுகளைப் புதுப்பிக்கிறது...",
      "கடையின் இன்றைய சிறப்புத் தயாரிப்புகளைப் பார்க்கிறது...",
      "டெலிவரி வழித்தடங்களை உகந்ததாக்குகிறது...",
      "ஆஃப்லைன் தரவுத்தளத்தை ஒத்திசைக்கிறது..."
    ];

    const LYO_TRANSIT_PHRASES_EN = [
      "Updating store listings...",
      "Securing your fast connection...",
      "Fetching freshest Edappadi prices...",
      "Optimizing delivery routes...",
      "Syncing secure offline cloud database...",
      "Recalculating loyalty rewards...",
      "Loading exclusive Edappadi store specials...",
      "Assistant is processing data...",
      "Syncing with Salem local server..."
    ];

    function showLyoTransitLoader(customText = null, durationMs = 450, onFinished = null) {
      const overlay = document.getElementById('lyo-transit-overlay');
      const subtitle = document.getElementById('lyo-transit-subtitle');
      if (!overlay) return;

      if (!customText) {
        const isTamil = (typeof currentLang !== 'undefined' && currentLang === 'ta');
        const list = isTamil ? LYO_TRANSIT_PHRASES_TA : LYO_TRANSIT_PHRASES_EN;
        customText = list[Math.floor(Math.random() * list.length)];
      }

      subtitle.innerText = customText;
      overlay.classList.add('active');

      const progBar = overlay.querySelector('.lyo-transit-progress-bar');
      if (progBar) {
        progBar.style.animation = 'none';
        void progBar.offsetWidth; // trigger reflow
        progBar.style.animation = `lyoProgressBarRun ${durationMs}ms ease-out forwards`;
      }

      if (durationMs) {
        setTimeout(() => {
          hideLyoTransitLoader();
          if (onFinished) onFinished();
        }, durationMs);
      }
    }

    function hideLyoTransitLoader() {
      const overlay = document.getElementById('lyo-transit-overlay');
      if (overlay) {
        overlay.classList.remove('active');
      }
      try {
        const activeBackdrops = document.querySelectorAll('.modal-backdrop.active, .popup-overlay.active');
        activeBackdrops.forEach(m => {
          if (m && m.id !== 'success-order-modal' && m.id !== 'admin-order-success-modal' && m.id !== 'custom-confirm-modal' && m.id !== 'custom-alert-modal') {
            m.classList.remove('active');
            if (m.style && m.style.display !== 'none') m.style.display = 'none';
          }
        });
      } catch(e) {}
    }

    function showLoadingModal(msg) {
      showLyoTransitLoader(msg, 0);
    }

    function hideLoadingModal() {
      hideLyoTransitLoader();
    }

    function showScreen(screenId) {
      try {
        if (typeof currentScreen !== 'undefined' && currentScreen === screenId) {
          const activeEl = document.getElementById(screenId);
          const otherActive = document.querySelector('.screen.active:not(#' + screenId + ')');
          if (activeEl && activeEl.classList.contains('active') && !otherActive) {
            if (screenId === 'screen-home') {
              activeEl.scrollTo({ top: 0, behavior: 'smooth' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
              if (typeof filterCategory === 'function') {
                try { filterCategory('all'); } catch(e) {}
              }
            }
            return;
          }
        }

        if (screenId !== 'screen-lyo-ai' && window.visualViewport && window.lyoAiViewportResizeListener) {
          try {
            window.visualViewport.removeEventListener('resize', window.lyoAiViewportResizeListener);
          } catch(e) {}
          window.lyoAiViewportResizeListener = null;
          const composeBox = document.querySelector('#lyo-ai-compose-box');
          if (composeBox) {
            composeBox.style.transform = 'translateY(0)';
          }
        }

        if (screenId !== 'screen-track' && typeof cleanupCustomerTrackerListeners === 'function') {
          cleanupCustomerTrackerListeners();
        }

        if (typeof dismissToast === 'function' && typeof toastShowTime !== 'undefined' && Date.now() - toastShowTime > 300) {
          const container = document.getElementById('toast-container');
          if (container && container.classList.contains('show')) {
            dismissToast();
          }
        }

        if (screenId === 'screen-admin') {
          debugLog("[Route Guard] Intercepted navigation to screen-admin. Verifying authorized admin session...");
          const adminSession = typeof getAdminSession === 'function' ? getAdminSession() : (typeof getData === 'function' ? getData('ek_admin_session', null) : null);
          const hasAdminSession = !!(adminSession && adminSession.loggedIn);
          const currentAdminEmail = (adminSession && adminSession.email) ? adminSession.email.trim().toLowerCase() : '';

          const storedAdmins = (typeof getData === 'function' ? getData('ek_admin_accounts', []) : []) || [];
          const isKnownAdmin = storedAdmins.some(a => a && a.active !== false && (
            (a.email && a.email.toLowerCase() === currentAdminEmail) ||
            (adminSession && adminSession.uid && (a.id === adminSession.uid || a.uid === adminSession.uid)) ||
            (adminSession && adminSession.phone && a.phone === adminSession.phone)
          ));

          const isAuthorizedAdmin = hasAdminSession && (
            currentAdminEmail === 'anantharajeinstein@gmail.com' ||
            (adminSession && (adminSession.role === 'admin' || adminSession.role === 'superadmin')) ||
            isKnownAdmin
          );

          if (!isAuthorizedAdmin) {
            console.error("[Route Guard] Access DENIED: Authorized admin session required. Found:", currentAdminEmail);
            showToast("❌ Admin access denied! Please sign in with an authorized admin account.", "error");
            setTimeout(() => {
              if (typeof switchAuthRole === 'function') switchAuthRole('admin');
              showScreen('screen-login');
            }, 50);
            return;
          }

          if (typeof firebase !== 'undefined' && firebase.auth) {
            const user = firebase.auth().currentUser;
            if (!user || user.isAnonymous) {
              debugLog("[Route Guard] Operating under active local admin session.");
            } else {
              (async () => {
                const finalUser = firebase.auth().currentUser;
                if (!finalUser || finalUser.isAnonymous) {
                  return;
                }

                window._verifiedAdminUids = window._verifiedAdminUids || new Set();
                if (window._verifiedAdminUids.has(finalUser.uid)) {
                  return;
                }

              try {
                let docSnap = await db.collection('ek_admin_accounts').doc(finalUser.uid).get();
                let adminData = null;
                if (docSnap.exists) {
                  adminData = docSnap.data();
                } else {
                  const adminEmail = finalUser.email;
                  const phoneStr = adminEmail ? adminEmail.replace('admin_', '').split('@')[0] : '';
                  const qSnap = await db.collection('ek_admin_accounts').where('email', '==', adminEmail).get();
                  let foundDoc = null;
                  if (!qSnap.empty) {
                    foundDoc = qSnap.docs[0];
                  } else if (phoneStr) {
                    const qSnapPhone = await db.collection('ek_admin_accounts').where('phone', '==', phoneStr).get();
                    if (!qSnapPhone.empty) {
                      foundDoc = qSnapPhone.docs[0];
                    }
                  }

                  if (foundDoc) {
                    adminData = foundDoc.data();
                    adminData.id = finalUser.uid;
                    adminData.uid = finalUser.uid;
                    await db.collection('ek_admin_accounts').doc(finalUser.uid).set(adminData);
                    debugLog("[Route Guard Background] Self-healed UID mapping for admin:", finalUser.uid);
                  }
                }

                if (adminData) {
                  if ((adminData.role !== 'admin' && adminData.role !== 'superadmin' && adminData.role !== 'ADMIN' && adminData.role !== 'SUPERADMIN') || adminData.active === false) {
                    console.error("[Route Guard Background] Access DENIED: Admin account inactive or not admin/superadmin.");
                    showToast(currentLang === 'ta' ? "உரிமம் மறுக்கப்பட்டது! / Admin account inactive." : "Access denied! Admin account inactive.", "error");
                    showScreen('screen-login');
                  } else {
                    window._verifiedAdminUids = window._verifiedAdminUids || new Set();
                    window._verifiedAdminUids.add(finalUser.uid);
                    debugLog("[Route Guard Background] Admin credentials verified successfully ✓ UID:", finalUser.uid);
                  }
                } else {
                  let activeCount = 0;
                  try {
                    const qSnap = await db.collection('ek_admin_accounts').get();
                    qSnap.forEach(doc => {
                      const data = doc.data();
                      if (data && data.active !== false) {
                        activeCount++;
                      }
                    });
                  } catch (e) {
                    console.warn("Could not query admin count in route guard:", e);
                  }

                  if (activeCount === 0) {
                    debugLog("[Route Guard Background] Succeeded: Zero active admin accounts in Firestore. Checking and showing superadmin setup.");
                    await checkAndShowSuperAdminSetup();
                  } else {
                    console.error(`[Route Guard Background] Access DENIED: Admin account not found in 'ek_admin_accounts' for UID: ${finalUser.uid}`);
                    try {
                      sessionStorage.removeItem('ek_admin_session');
                      sessionStorage.removeItem('adminLoggedIn');
                    } catch (e) {}
                    showToast(
                      currentLang === 'ta'
                        ? "நிர்வாக கணக்கு காணவில்லை. தயவுசெய்து சூப்பர் அட்மின-ஐ தொடர்பு கொள்ளவும்."
                        : "Admin account not found in database. Please contact the superadmin to create your admin account.",
                      "error"
                    );
                    showScreen('screen-login');
                  }
                }
              } catch (err) {
                console.warn("[Route Guard Background] Firestore check bypassed due to network/offline status:", err);
              }
            })();
          }
        }
      }

        if (typeof currentScreen !== 'undefined' && currentScreen !== screenId && currentScreen !== 'screen-splash' && screenId !== 'screen-splash') {
          // showLyoTransitLoader(null, 450); // Bypassed for instant tab navigation
        }

        if (!isNavigatingBack && typeof currentScreen !== 'undefined' && currentScreen !== screenId && currentScreen !== 'screen-splash') {
          if (screenHistory.length === 0 || screenHistory[screenHistory.length - 1] !== currentScreen) {
            screenHistory.push(currentScreen);
          }
        }

        if (screenId !== 'screen-track') {
          try {
            if (typeof clearRiderAnimation === 'function') {
              clearRiderAnimation();
            }
          } catch(e) { console.warn('clearRiderAnimation failed', e); }
        }

        if (screenId !== 'screen-track' && typeof trackerLeafletMap !== 'undefined' && trackerLeafletMap) {
          try {
            trackerLeafletMap.remove();
          } catch(e) { console.warn(e); }
          trackerLeafletMap = null;
          if (typeof riderMarker !== 'undefined') riderMarker = null;
          if (typeof storeMarker !== 'undefined') storeMarker = null;
          if (typeof customerMarker !== 'undefined') customerMarker = null;
        }
        if (screenId !== 'screen-delivery') {
          if (window.riderLiveCoordInterval) {
            clearInterval(window.riderLiveCoordInterval);
            window.riderLiveCoordInterval = null;
          }
          if (window.activeGpsSimulationInterval) {
            clearInterval(window.activeGpsSimulationInterval);
            window.activeGpsSimulationInterval = null;
          }
        }
        if (screenId !== 'screen-delivery' && typeof deliveryLeafletMap !== 'undefined' && deliveryLeafletMap) {
          try {
            deliveryLeafletMap.remove();
          } catch(e) { console.warn(e); }
          deliveryLeafletMap = null;
          if (typeof deliveryRiderMarker !== 'undefined') deliveryRiderMarker = null;
          if (typeof deliveryStoreMarker !== 'undefined') deliveryStoreMarker = null;
          if (typeof deliveryCustomerMarker !== 'undefined') deliveryCustomerMarker = null;
        }

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'screen-transitioning'));
        const target = document.getElementById(screenId);
        if (target) {
          target.scrollTop = 0; // RESET scroll to top of screen on view transition to ensure native behavior
          target.scrollLeft = 0; // RESET horizontal scroll offset
          const appContainer = document.querySelector('.app-container');
          if (appContainer) appContainer.scrollLeft = 0;
          if (document.body) document.body.scrollLeft = 0;
          if (document.documentElement) document.documentElement.scrollLeft = 0;
          target.classList.add('active', 'screen-entering');
          setTimeout(() => {
            try {
              if (target && target.classList.contains('screen-entering')) {
                target.classList.remove('screen-entering');
              }
            } catch(e) {}
          }, 240);
          currentScreen = screenId;
          window.currentScreen = screenId;

          // Instant zero-lag transition: trigger map resize on next frame without blocking UI
          requestAnimationFrame(() => {
            try {
              if (screenId === 'screen-track' && typeof trackerLeafletMap !== 'undefined' && trackerLeafletMap) {
                trackerLeafletMap.invalidateSize();
              } else if (screenId === 'screen-delivery' && typeof deliveryLeafletMap !== 'undefined' && deliveryLeafletMap) {
                deliveryLeafletMap.invalidateSize();
              } else if (screenId === 'screen-admin' && typeof refreshAdminZonesMapSize === 'function') {
                refreshAdminZonesMapSize();
              }
            } catch(e) {}
          });
        } else {
          console.error(`[showScreen] Target screen "${screenId}" not found in DOM!`);
        }

        const bottomNav = document.getElementById('app-bottom-nav');
        if (bottomNav) {
          if (['screen-splash', 'screen-onboarding', 'screen-login', 'screen-register', 'screen-admin', 'screen-delivery'].includes(screenId)) {
            bottomNav.style.display = 'none';
          } else {
            bottomNav.style.display = 'flex';
          }
        }

        try {
          if (screenId === 'screen-home') {
            if (typeof renderHomeScreen === 'function') renderHomeScreen();
            if (typeof renderCustomerHomeReviews === 'function') renderCustomerHomeReviews();
            const settings = (typeof getSettings === 'function') ? getSettings() : {};
            if (settings.leaveMode && !sessionStorage.getItem('leave_popup_shown')) {
              sessionStorage.setItem('leave_popup_shown', 'true');
              if (typeof showCustomAlert === 'function') {
                showCustomAlert(
                  currentLang === 'ta' ? "🌴 விடுமுறை அறிவிப்பு" : "🌴 Holiday / Leave Notice",
                  settings.leaveNotice || (currentLang === 'ta' ? "மன்னிக்கவும்! கடை தற்காலிகமாக விடுமுறையில் உள்ளது. ஆர்டர் செய்ய இயலாது." : "Sorry, the shop is currently closed on holiday. Ordering is temporarily paused.")
                );
              }
            }
          } else if (screenId === 'screen-login') {
            try {
              if (typeof switchAuthRole === 'function') {
                switchAuthRole(window._currentAuthRole || 'customer');
              } else if (typeof enterCustomerLogin === 'function') {
                enterCustomerLogin();
              }
            } catch(e) {}
            if (typeof prefillLoginCredentials === 'function') prefillLoginCredentials();
          } else if (screenId === 'screen-register') {
            const storedRef = sessionStorage.getItem('ek_referred_by_code');
            if (storedRef && document.getElementById('reg-referral')) {
              document.getElementById('reg-referral').value = storedRef;
            }
          } else if (screenId === 'screen-cart') {
            if (typeof renderCartScreen === 'function') renderCartScreen();
          } else if (screenId === 'screen-track') {
            if (typeof renderTrackerScreen === 'function') renderTrackerScreen();
          } else if (screenId === 'screen-profile') {
            const custSession = typeof getActiveSession === 'function' ? getActiveSession() : null;
            if (!custSession || !custSession.loggedIn) {
              if (typeof showToast === 'function') {
                showToast(typeof currentLang !== 'undefined' && currentLang === 'ta' ? "சுயவிவரத்தை அணுக முதலில் உள்நுழையவும்!" : "Please login to view profile!", "info");
              }
              showScreen('screen-login');
              return;
            }
            if (typeof renderProfileScreen === 'function') renderProfileScreen();
          } else if (screenId === 'screen-admin') {
            if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
            if (typeof initSectionCollapse === 'function') {
              initSectionCollapse('categories', 'collapsed');
              initSectionCollapse('carousel', 'collapsed');
              initSectionCollapse('upi-config', 'collapsed');
            }
          } else if (screenId === 'screen-delivery') {
            if (typeof renderDeliveryScreen === 'function') renderDeliveryScreen();
          } else if (screenId === 'screen-lyo-ai') {
            try {
              if (typeof initLyoAiChat === 'function') initLyoAiChat();
              const msgStream = document.getElementById('lyo-ai-messages');
              if (msgStream) {
                msgStream.style.scrollBehavior = 'auto';
                msgStream.scrollTop = msgStream.scrollHeight;
                requestAnimationFrame(() => {
                  msgStream.scrollTop = msgStream.scrollHeight;
                  msgStream.style.scrollBehavior = 'smooth';
                });
              }

              if (window.visualViewport && !window.lyoAiViewportResizeListener) {
                window.lyoAiViewportResizeListener = function() {
                  const composeBox = document.querySelector('#lyo-ai-compose-box');
                  const inputEl = document.getElementById('lyo-ai-input');
                  if (composeBox) {
                    if (!inputEl || document.activeElement !== inputEl) {
                      composeBox.style.transform = 'translateY(0)';
                      return;
                    }
                    const keyboardHeight = Math.max(0, window.innerHeight - (window.visualViewport ? window.visualViewport.height : window.innerHeight));
                    composeBox.style.transform = keyboardHeight > 100 ? `translateY(-${keyboardHeight}px)` : 'translateY(0)';
                  }
                };
                window.visualViewport.addEventListener('resize', window.lyoAiViewportResizeListener);
              }
            } catch (lyoErr) {
              console.warn('[showScreen] Lyo AI init error:', lyoErr);
            }
          } else if (screenId === 'screen-offers') {
            updateClaimBoxState();
          } else if (screenId === 'screen-register') {
            try {
              if (typeof initRegAddressSync === 'function') initRegAddressSync();
              if (typeof updateCombinedRegAddress === 'function') updateCombinedRegAddress();
            } catch (e) {}
          } else if (screenId === 'screen-login') {
            try {
              const phoneInput = document.getElementById('login-phone-input');
              const identifierInput = document.getElementById('login-identifier');
              if (phoneInput && identifierInput && identifierInput.value && !identifierInput.value.includes('@')) {
                phoneInput.value = identifierInput.value;
              }
            } catch (e) {}
          }
        } catch (renderErr) {
          console.error(`[showScreen] Render failed for "${screenId}":`, renderErr);
          if (typeof showToast === 'function') {
            showToast('⚠️ Display issue — pull to refresh', 'error');
          }
        }
      } catch (criticalErr) {
        console.error('[showScreen] CRITICAL failure:', criticalErr);
      }
    }
    window.showScreen = showScreen;