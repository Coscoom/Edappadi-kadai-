// ====================================================================
// Edappadi Kadai - Unified NLU Dictionary & Unit Registry
// Sourced centrally for Lyo AI, Orders Engine, Products, Delivery & Admin
// ====================================================================

(function() {
  'use strict';

  // 1. Unified Canonical Unit Registry
  const UNIT_REGISTRY = {
    kg: { key: 'kg', isWeight: true, isLiquid: false, labelEn: 'Kilogram (Kg)', labelTa: 'கிலோகிராம் (Kg)' },
    g: { key: 'g', isWeight: true, isLiquid: false, labelEn: 'Gram (g)', labelTa: 'கிராம் (g)' },
    litre: { key: 'litre', isWeight: true, isLiquid: true, labelEn: 'Litre (Litre)', labelTa: 'லிட்டர் (Litre)' },
    ml: { key: 'ml', isWeight: true, isLiquid: true, labelEn: 'Milli Litre (ml)', labelTa: 'மி.லி (ml)' },
    piece: { key: 'piece', isWeight: false, isLiquid: false, labelEn: 'Piece (pc)', labelTa: 'பீஸ் / எண்ணிக்கை (pc)' },
    packet: { key: 'packet', isWeight: false, isLiquid: false, labelEn: 'Packet (pack)', labelTa: 'பாக்கெட் (pack)' },
    bottle: { key: 'bottle', isWeight: false, isLiquid: false, labelEn: 'Bottle (bottle)', labelTa: 'பாட்டில் (bottle)' },
    box: { key: 'box', isWeight: false, isLiquid: false, labelEn: 'Box (box)', labelTa: 'பெட்டி (box)' },
    bunch: { key: 'bunch', isWeight: false, isLiquid: false, labelEn: 'Bunch (bunch)', labelTa: 'கட்டு (bunch)' },
    bundle: { key: 'bundle', isWeight: false, isLiquid: false, labelEn: 'Bundle (bundle)', labelTa: 'கற்றை / கட்டு (bundle)' },
    dozen: { key: 'dozen', isWeight: false, isLiquid: false, labelEn: 'Dozen (dozen)', labelTa: 'டஜன் (dozen)' },
    tray: { key: 'tray', isWeight: false, isLiquid: false, labelEn: 'Tray (tray)', labelTa: 'தட்டு (tray)' },
    can: { key: 'can', isWeight: false, isLiquid: false, labelEn: 'Can (can)', labelTa: 'கேன் (can)' },
    tin: { key: 'tin', isWeight: false, isLiquid: false, labelEn: 'Tin (tin)', labelTa: 'தகரம் / டின் (tin)' },
    cup: { key: 'cup', isWeight: false, isLiquid: false, labelEn: 'Cup (cup)', labelTa: 'கோப்பை (cup)' },
    loaf: { key: 'loaf', isWeight: false, isLiquid: false, labelEn: 'Loaf (loaf)', labelTa: 'ரொட்டி துண்டு (loaf)' },
    roll: { key: 'roll', isWeight: false, isLiquid: false, labelEn: 'Roll (roll)', labelTa: 'சுருள் (roll)' },
    set: { key: 'set', isWeight: false, isLiquid: false, labelEn: 'Set (set)', labelTa: 'செட் (set)' }
  };

  const UNIT_TYPES = Object.keys(UNIT_REGISTRY);

  // 2. Base Synonym Dictionary
  const EK_BASE_SYNONYMS = {
    // Mutton & Specialties
    'mutton': ['mutton', 'lamb', 'goat', 'aattu', 'ஆட்டு', 'மட்டன்', 'muttan', 'goat mutton', 'aattu erachi', 'aattu keri', 'aattukari', 'aattukkari', 'ஆட்டுக்கறி', 'ஆட்டுக்கறி துண்டுகள்', 'aattu kari', 'ஆடு', 'aadu'],
    'mutton_liver': ['mutton liver', 'eeral', 'liver', 'ஈரல்', 'மட்டன் ஈரல்', 'suvarotti', 'சுவரொட்டி', 'சுவரொட்டி ஈரல்', 'liver fry'],
    'head_curry': ['head curry', 'goat head', 'thalaikkari', 'thalaikari', 'தலைக்கறி', 'தலைகறி', 'ஆட்டுத்தலை', 'ஆட்டு தலைக்கறி', 'ஆட்டுத் தலைக்கறி', 'ஆட்டுத்தலை கறி', 'ஆட்டுத்தலைக்கறி', 'goat head curry', 'head meat'],

    // Chicken variants (Strictly split into distinct keys)
    'country_chicken': ['country chicken', 'nattu koli', 'nattu kozhi', 'naattu kozhi', 'naattu koli', 'nattukoli', 'nattu chicken', 'நாட்டுக்கோழி', 'நாட்டு கோழி', 'நாட்டுக்கறி', 'நாட்டு கோழிக்கறி', 'நாட்டு'],
    'broiler_chicken': ['broiler chicken', 'broiler', 'farm chicken', 'பிராய்லர்', 'பிராய்லர் சிக்கன்', 'பிறாய்லர்', 'பிராய்லர் கோழி'],
    'chicken': ['chicken', 'சிக்கன்', 'கோழி', 'koli', 'chiken', 'chickn', 'chikkan', 'chickin', 'கோழிக்கறி', 'chicken curry'],

    // Eggs
    'country_egg': ['country egg', 'country chicken egg', 'nattu muttai', 'naattu muttai', 'நாட்டுக்கோழி முட்டை', 'நாட்டு முட்டை'],
    'egg': ['egg', 'eggs', 'muttai', 'muttas', 'முட்டை', 'முட்டைகள்', 'white egg', 'white eggs', 'farm egg', 'egg packet', 'muttai tray'],

    // Poultry & Meat alternatives
    'kadai': ['kadai', 'quail', 'காடை', 'காடைக்கறி'],

    // Seafood
    'fish': ['fish', 'meen', 'மீன்', 'vanjaram', 'nethili', 'katla', 'rohu', 'viral', 'வஞ்சரம்', 'நெத்திலி', 'கட்லா', 'ரோகு', 'விரால்'],
    'prawn': ['prawn', 'prawns', 'eyera', 'iral', 'இறால்', 'இறால் மீன்'],
    'crab': ['crab', 'nandu', 'நண்டு'],

    // Dairy & Grocery
    'milk': ['milk', 'பால்', 'paal', 'pal', 'milk packet', 'paal packet', 'பசும்பால்'],
    'curd': ['curd', 'தயிர்', 'thayir', 'curd packet'],
    'paneer': ['paneer', 'பன்னீர்', 'பனீர்', 'panir'],
    'ghee': ['ghee', 'நெய்', 'nei', 'neyy', 'ney', 'பசு நெய்'],
    'butter': ['butter', 'vennai', 'வெண்ணெய்'],

    // Vegetables
    'potato': ['potato', 'potatoes', 'உருளைக்கிழங்கு', 'உருளை கிழங்கு', 'உருளை', 'urulaikilangu', 'urulai', 'potatos'],
    'onion': ['onion', 'onions', 'வெங்காயம்', 'vengayam', 'vengaym', 'vengaiyam', 'பெரிய வெங்காயம்'],
    'small_onion': ['small onion', 'chinna vengayam', 'shallots', 'சின்ன வெங்காயம்', 'சாம்பார் வெங்காயம்'],
    'tomato': ['tomato', 'thakkali', 'தக்காளி', 'takali', 'tomoto', 'tamato'],
    'drumstick': ['drumstick', 'drumsticks', 'murungakkai', 'murungakai', 'murungakka', 'முருங்கைக்காய்', 'முருங்கக்காய்', 'முருங்கை', 'முருங்கக்கா', 'drum stick'],
    'brinjal': ['brinjal', 'eggplant', 'aubergine', 'kathirikai', 'kathirikkai', 'கத்திரிக்காய்', 'கத்தரிக்காய்', 'கத்தரி', 'kathari'],
    'ladyfinger': ['ladyfinger', 'ladiesfinger', 'okra', 'vendakkai', 'vendakai', 'வெண்டைக்காய்', 'வெண்டை', 'bhendi'],
    'carrot': ['carrot', 'carrots', 'கேரட்', 'காரட்'],
    'beans': ['beans', 'பீன்ஸ்'],
    'cabbage': ['cabbage', 'முட்டைக்கோஸ்', 'முட்டைகோஸ்', 'கோஸ்'],
    'cauliflower': ['cauliflower', 'காலிஃபிளவர்', 'காலிபிளவர்'],
    'beetroot': ['beetroot', 'பீட்ரூட்'],
    'coconut': ['coconut', 'தேங்காய்', 'theangai', 'thengai'],
    'banana': ['banana', 'வாழைப்பழம்', 'valapalam', 'வாழைக்காய்', 'valaikkai'],
    'apple': ['apple', 'ஆப்பிள்'],
    'orange': ['orange', 'ஆரஞ்சு'],
    'chilli': ['chilli', 'chili', 'மிளகாய்', 'milagai', 'green chilli', 'red chilli', 'பச்சை மிளகாய்'],
    'coriander': ['coriander', 'கொத்தமல்லி', 'kothamalli', 'malli', 'koththamalli', 'coriander leaves'],
    'pudina': ['mint', 'pudina', 'புதினா'],
    'garlic': ['garlic', 'பூண்டு', 'poondhu', 'poondu'],
    'ginger': ['ginger', 'இஞ்சி', 'inji'],
    'lemon': ['lemon', 'lemons', 'எலுமிச்சை', 'elumichai'],

    // Staples
    'sugar': ['sugar', 'சர்க்கரை', 'sarkarai', 'sakkarai'],
    'salt': ['salt', 'உப்பு', 'uppu'],
    'rice': ['rice', 'அரிசி', 'arisi', 'ponni rice'],
    'dal': ['dal', 'பருப்பு', 'paruppu', 'toor dal', 'urad dal'],

    // Oils
    'oil': ['oil', 'எண்ணெய்', 'ennai', 'ennay'],
    'coconut_oil': ['coconut oil', 'theangai ennai', 'theangai enney', 'தேங்காய் எண்ணெய்'],
    'gingelly_oil': ['gingelly oil', 'sesame oil', 'nallennai', 'nallenney', 'நல்லெண்ணெய்'],
    'sunflower_oil': ['sunflower oil', 'சூரியகாந்தி எண்ணெய்']
  };

  // 3. Dynamic Auto-Merge Hook for Admin-Added Products (Future-Proofing)
  function getActiveNluDictionary(customProducts = null) {
    const dict = {};
    for (const k in EK_BASE_SYNONYMS) {
      dict[k] = [...EK_BASE_SYNONYMS[k]];
    }

    const products = customProducts || (typeof getData === 'function' ? getData('ek_products', []) : []);
    if (Array.isArray(products)) {
      products.forEach(p => {
        if (!p || p.isActive === false || p.isDeleted === true) return;
        const pId = p.id || p.productId;
        const en = (p.englishName || p.name || '').toLowerCase().trim();
        const ta = (p.tamilName || '').toLowerCase().trim();
        const enNorm = en.replace(/[-_:,;!/()]/g, ' ').replace(/\s+/g, ' ').trim();

        let key = null;
        if (enNorm.includes('country') && (enNorm.includes('chicken') || enNorm.includes('koli') || enNorm.includes('kozhi'))) {
          key = 'country_chicken';
        } else if (enNorm.includes('broiler')) {
          key = 'broiler_chicken';
        } else if (enNorm.includes('head') || ta.includes('தலை')) {
          key = 'head_curry';
        } else if (enNorm.includes('liver') || enNorm.includes('eeral') || ta.includes('ஈரல்')) {
          key = 'mutton_liver';
        } else if (enNorm.includes('mutton') || ta.includes('மட்டன்') || ta.includes('ஆட்டு')) {
          key = 'mutton';
        } else if (enNorm.includes('chicken') || ta.includes('சிக்கன்') || ta.includes('கோழி')) {
          key = 'chicken';
        } else {
          key = 'prod_' + (enNorm.replace(/[^a-z0-9]/g, '_') || pId);
        }

        if (!dict[key]) dict[key] = [];
        if (en && !dict[key].includes(en)) dict[key].push(en);
        if (ta && !dict[key].includes(ta)) dict[key].push(ta);

        // Auto-merge aliases array or tags set by admin
        if (Array.isArray(p.aliases)) {
          p.aliases.forEach(a => {
            const aStr = String(a || '').toLowerCase().trim();
            if (aStr && !dict[key].includes(aStr)) dict[key].push(aStr);
          });
        } else if (typeof p.aliases === 'string' && p.aliases.trim()) {
          p.aliases.split(',').forEach(a => {
            const aStr = a.toLowerCase().trim();
            if (aStr && !dict[key].includes(aStr)) dict[key].push(aStr);
          });
        }

        if (typeof p.tags === 'string' && p.tags.trim()) {
          p.tags.split(',').forEach(tag => {
            const tStr = tag.toLowerCase().trim();
            if (tStr && !dict[key].includes(tStr)) dict[key].push(tStr);
          });
        } else if (Array.isArray(p.tags)) {
          p.tags.forEach(tag => {
            const tStr = String(tag || '').toLowerCase().trim();
            if (tStr && !dict[key].includes(tStr)) dict[key].push(tStr);
          });
        }
      });
    }
    return dict;
  }

  // Expose to window
  window.UNIT_REGISTRY = UNIT_REGISTRY;
  window.UNIT_TYPES = UNIT_TYPES;
  window.EK_BASE_SYNONYMS = EK_BASE_SYNONYMS;
  window.getActiveNluDictionary = getActiveNluDictionary;

  console.log('[NLU Dictionary] Loaded. window.EK_BASE_SYNONYMS defined:', typeof window.EK_BASE_SYNONYMS !== 'undefined', 'window.UNIT_REGISTRY defined:', typeof window.UNIT_REGISTRY !== 'undefined');

})();
