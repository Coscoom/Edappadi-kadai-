// 200+ NLU Test Suite for Lyo AI Engine
const mockProducts = [
  { id: 'p1', englishName: 'Chicken (Broiler)', tamilName: 'சிக்கன்', category: 'Meat', pricePerKg: 220, unit: 'kg', stockKg: 50 },
  { id: 'p2', englishName: 'Mutton (Goat)', tamilName: 'ஆட்டுக்கறி (மட்டன்)', category: 'Meat', pricePerKg: 800, unit: 'kg', stockKg: 20 },
  { id: 'p3', englishName: 'Country Chicken (Nattu Kozhi)', tamilName: 'நாட்டுக்கோழி', category: 'Meat', pricePerKg: 450, unit: 'kg', stockKg: 15 },
  { id: 'p4', englishName: 'Farm Fresh Eggs', tamilName: 'முட்டை', category: 'Dairy & Eggs', pricePerKg: 6, unit: 'piece', stockKg: 200 },
  { id: 'p5', englishName: 'Country Milk', tamilName: 'பசு பால்', category: 'Dairy & Eggs', pricePerKg: 50, unit: 'liter', stockKg: 30 },
  { id: 'p6', englishName: 'Fresh Tomato', tamilName: 'தக்காளி', category: 'Vegetables', pricePerKg: 40, unit: 'kg', stockKg: 100 },
  { id: 'p7', englishName: 'Potato', tamilName: 'உருளைக்கிழங்கு', category: 'Vegetables', pricePerKg: 30, unit: 'kg', stockKg: 80 },
  { id: 'p8', englishName: 'Onion', tamilName: 'வெங்காயம்', category: 'Vegetables', pricePerKg: 35, unit: 'kg', stockKg: 120 },
  { id: 'p9', englishName: 'Garlic', tamilName: 'பூண்டு', category: 'Vegetables', pricePerKg: 180, unit: 'kg', stockKg: 25 },
  { id: 'p10', englishName: 'Sankara Fish', tamilName: 'சங்கரா மீன்', category: 'Seafood', pricePerKg: 350, unit: 'kg', stockKg: 15 },
  { id: 'p11', englishName: 'Sunflower Cooking Oil', tamilName: 'சமையல் எண்ணெய்', category: 'Grocery', pricePerKg: 140, unit: 'liter', stockKg: 40 },
  { id: 'p12', englishName: 'Paneer', tamilName: 'பன்னீர்', category: 'Dairy & Eggs', pricePerKg: 320, unit: 'kg', stockKg: 10 }
];

function isLyoPieceUnit(unit) {
  if (!unit) return false;
  const u = String(unit).toLowerCase();
  return ['piece', 'pcs', 'packet', 'packets', 'bunch', 'bunches', 'bottle', 'bottles', 'egg', 'eggs', 'muttai', 'முட்டை', 'பீஸ்'].includes(u);
}

function getMatchedProducts(query, products) {
  if (!query || !products || !Array.isArray(products) || products.length === 0) return [];
  const activeProducts = products.filter(p => p && !p.isHidden);
  if (activeProducts.length === 0) return [];
  const q = String(query).toLowerCase().trim();
  if (!q) return [];

  const FOOD_ALIASES = [
    { keywords: ['chicken', 'சிக்கன்', 'சிகன்', 'கோழி', 'broiler', 'nattu kozhi', 'koli'], terms: ['chicken', 'சிக்கன்', 'broiler', 'country chicken', 'nattu kozhi'] },
    { keywords: ['mutton', 'மட்டன்', 'ஆடு', 'ஆட்டிறைச்சி', 'கறி', 'goat', 'lamb', 'matton'], terms: ['mutton', 'மட்டன்', 'goat', 'lamb'] },
    { keywords: ['fish', 'மீன்', 'சங்கரா', 'வஞ்சரம்', 'prawn', 'நண்டு', 'crab', 'meen'], terms: ['fish', 'மீன்', 'sankara', 'vanjaram', 'prawn', 'crab'] },
    { keywords: ['egg', 'முட்டை', 'முட்ட', 'eggs', 'muttai'], terms: ['egg', 'முட்டை', 'eggs'] },
    { keywords: ['tomato', 'தக்காளி', 'தக்காலி', 'thakkali', 'thakali'], terms: ['tomato', 'தக்காளி'] },
    { keywords: ['onion', 'வெங்காயம்', 'வெங்காய', 'vengayam', 'vengaayam'], terms: ['onion', 'வெங்காயம்'] },
    { keywords: ['potato', 'உருளைக்கிழங்கு', 'உருளை', 'urulai'], terms: ['potato', 'உருளைக்கிழங்கு', 'உருளை'] },
    { keywords: ['garlic', 'பூண்டு', 'poondhu', 'poondu'], terms: ['garlic', 'பூண்டு'] },
    { keywords: ['milk', 'பால்', 'paal'], terms: ['milk', 'பால்'] },
    { keywords: ['oil', 'எண்ணெய்', 'ennai'], terms: ['oil', 'எண்ணெய்'] },
    { keywords: ['paneer', 'பன்னீர்'], terms: ['paneer', 'பன்னீர்'] }
  ];

  const stopWords = ['price', 'rate', 'cost', 'how', 'much', 'for', 'is', 'what', 'of', 'in', 'the', 'rs', 'rupees', 'விலை', 'ரேட்', 'எவ்வளவு', 'ரூபாய்', 'என்ன', 'சொல்லுங்க', 'சொல்லு'];
  const qTokens = q.split(/[\s,./?!-]+/).filter(t => t.length > 1 && !stopWords.includes(t));

  const scoredProducts = [];

  activeProducts.forEach(p => {
    const engName = String(p.englishName || '').toLowerCase();
    const tamName = String(p.tamilName || '').toLowerCase();
    const cat = String(p.category || '').toLowerCase();
    const pid = String(p.id || '').toLowerCase();

    let score = 0;

    if (engName === q || tamName === q || pid === q) score += 1000;
    if (q.includes(engName) && engName.length > 2) score += 500;
    if (q.includes(tamName) && tamName.length > 2) score += 500;
    if (engName.includes(q) && q.length > 2) score += 400;
    if (tamName.includes(q) && q.length > 2) score += 400;

    qTokens.forEach(t => {
      if (engName.includes(t)) score += 100;
      if (tamName.includes(t)) score += 100;
      if (pid.includes(t)) score += 80;
      if (cat.includes(t)) score += 50;
    });

    FOOD_ALIASES.forEach(aliasObj => {
      const queryMatchesAlias = aliasObj.keywords.some(kw => q.includes(kw));
      if (queryMatchesAlias) {
        const productMatchesAlias = aliasObj.terms.some(term => 
          engName.includes(term) || tamName.includes(term) || pid.includes(term) || cat.includes(term)
        );
        if (productMatchesAlias) score += 300;
      }
    });

    if (score > 0) {
      scoredProducts.push({ product: p, score });
    }
  });

  scoredProducts.sort((a, b) => b.score - a.score);
  return scoredProducts;
}

function parseOfflineOrderProposal(userQuery, activeProducts, isTamil, honorific = "அண்ணே") {
  if (!userQuery || !activeProducts || !Array.isArray(activeProducts) || activeProducts.length === 0) return null;

  const rawText = userQuery.trim();
  const qLower = rawText.toLowerCase();

  // Pure price / info query check
  const isPurePriceQuery = (
    qLower.includes('price') || qLower.includes('rate') || qLower.includes('cost') ||
    qLower.includes('விலை') || qLower.includes('ரேட்') || qLower.includes('எவ்வளவு') || qLower.includes('how much')
  ) && !qLower.includes('buy') && !qLower.includes('add') && !qLower.includes('order') &&
    !qLower.includes('podu') && !qLower.includes('venum') && !qLower.includes('போடு') &&
    !qLower.includes('வேணும்') && !qLower.includes('வாங்கு') && !qLower.includes('கார்ட்') &&
    !qLower.match(/\d+/);

  if (isPurePriceQuery) {
    return null;
  }

  // Split query into segments
  const segments = qLower.split(/[,;\n\+]|மற்றும்|அப்புறம்|அதோடு|and|then|also|plus|as well as/);
  const proposalList = [];
  let totalConfidence = 0;
  let parsedCount = 0;

  const purchaseKeywords = ['buy', 'add', 'podu', 'venum', 'order', 'want', 'need', 'vangunen', 'போடு', 'வேணும்', 'வேண்டும்', 'வாங்கு', 'வாங்க', 'குடுங்க', 'தாங்க', 'அனுப்புங்க', 'கார்ட்', 'சேர்', 'சேர்க்க'];
  const hasPurchaseKeyword = purchaseKeywords.some(kw => qLower.includes(kw));

  segments.forEach(seg => {
    const trimmedSeg = seg.trim();
    if (!trimmedSeg) return;

    let value = 1;
    let unitType = "WEIGHT_KG"; // DEFAULT
    let isExplicitFound = false;

    // 1. CHECK MONEY PATTERNS (CRITICAL NO-CONVERSION RULE)
    const moneyPrefixMatch = trimmedSeg.match(/(?:₹|rs\.?|inr|rupees?)\s*(\d+(?:\.\d+)?)/i);
    const moneySuffixMatch = trimmedSeg.match(/(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees?|rupee|bucks|ரூபாய்க்கு|ரூபாயிக்கு|ரூபாய்|ரூபாயி|ரூ|rupaaiku|rupaai|rskku|rsku)/i);
    const moneyWorthMatch = trimmedSeg.match(/(\d+(?:\.\d+)?)\s*(?:worth|value|மதிப்புடைய|மதிப்புள்ள)/i);

    if (moneySuffixMatch) {
      value = parseFloat(moneySuffixMatch[1]);
      unitType = "MONEY";
      isExplicitFound = true;
    } else if (moneyPrefixMatch) {
      value = parseFloat(moneyPrefixMatch[1]);
      unitType = "MONEY";
      isExplicitFound = true;
    } else if (moneyWorthMatch) {
      value = parseFloat(moneyWorthMatch[1]);
      unitType = "MONEY";
      isExplicitFound = true;
    } else {
      // 2. CHECK FRACTION PATTERNS FIRST
      const fractionMatch = trimmedSeg.match(/(?:(\d+)\s+)?(\d+)\/(\d+)\s*(?:kg|kgs|kilo|kilos|kilograms?|கிலோ|கீலோ)?/i);

      if (fractionMatch) {
        const whole = fractionMatch[1] ? parseFloat(fractionMatch[1]) : 0;
        const num = parseFloat(fractionMatch[2]);
        const den = parseFloat(fractionMatch[3]);
        if (den > 0) {
          value = whole + (num / den);
          unitType = "WEIGHT_KG";
          isExplicitFound = true;
        }
      }

      if (!isExplicitFound) {
        // 3. CHECK REGULAR WEIGHT & VOLUME & COUNT PATTERNS
        const kgMatch = trimmedSeg.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos|kilograms?|கிலோ|கீலோ)/i);
        const gramMatch = trimmedSeg.match(/(\d+(?:\.\d+)?)\s*(?:g|gms|grams?|gram|கிராம்)/i);
        const literMatch = trimmedSeg.match(/(\d+(?:\.\d+)?)\s*(?:l|liter|liters|litre|litres|லிட்டர்)/i);
        const mlMatch = trimmedSeg.match(/(\d+(?:\.\d+)?)\s*(?:ml|எம்எல்|எம்\.எல்)/i);
        const countMatch = trimmedSeg.match(/(\d+(?:\.\d+)?)\s*(?:pcs|piece|pieces|பீஸ்|பீஸ்கள்|packets?|பாக்கெட்|bunches?|கட்டு|bottles?|பாட்டில்|dozens?|டஜன்|muttai|முட்டை|egg|eggs)/i);

        if (kgMatch) {
          value = parseFloat(kgMatch[1]);
          unitType = "WEIGHT_KG";
          isExplicitFound = true;
        } else if (gramMatch) {
          value = parseFloat(gramMatch[1]);
          unitType = "WEIGHT_GRAMS";
          isExplicitFound = true;
        } else if (literMatch) {
          value = parseFloat(literMatch[1]);
          unitType = "VOLUME_LITERS";
          isExplicitFound = true;
        } else if (mlMatch) {
          value = parseFloat(mlMatch[1]);
          unitType = "VOLUME_ML";
          isExplicitFound = true;
        } else if (countMatch) {
          value = parseFloat(countMatch[1]);
          unitType = "COUNT_PIECES";
          isExplicitFound = true;
        } else if (trimmedSeg.includes("ஒன்றரை") || trimmedSeg.includes("ஒன்னரை") || trimmedSeg.includes("1.5")) {
          value = 1.5;
          unitType = "WEIGHT_KG";
          isExplicitFound = true;
        } else if (trimmedSeg.includes("இரண்டரை") || trimmedSeg.includes("2.5")) {
          value = 2.5;
          unitType = "WEIGHT_KG";
          isExplicitFound = true;
        } else if ((trimmedSeg.includes("அரை") || trimmedSeg.includes("half")) && !trimmedSeg.includes("ஒன்றரை") && !trimmedSeg.includes("ஒன்னரை") && !trimmedSeg.includes("இரண்டரை")) {
          value = 0.5;
          unitType = "WEIGHT_KG";
          isExplicitFound = true;
        } else if (trimmedSeg.includes("முக்கால்")) {
          value = 0.75;
          unitType = "WEIGHT_KG";
          isExplicitFound = true;
        } else if (trimmedSeg.includes("கால்") || trimmedSeg.includes("quarter")) {
          value = 0.25;
          unitType = "WEIGHT_KG";
          isExplicitFound = true;
        } else {
          const numMatch = trimmedSeg.match(/(\d+(?:\.\d+)?)/);
          if (numMatch) {
            value = parseFloat(numMatch[1]);
            isExplicitFound = true;
            if (value >= 50) {
              unitType = "WEIGHT_GRAMS";
            } else {
              unitType = "PLAIN_NUMBER";
            }
          }
        }
      }
    }

    // Clean segment to extract pure product name
    let cleanQuery = trimmedSeg
      .replace(/(?:\d+\s+)?\d+\/\d+/g, ' ')
      .replace(/\d+(?:\.\d+)?/g, ' ')
      .replace(/(kg|kgs|kilo|kilos|kilograms?|grams?|gram|gms?|g|rs\.?|rupees|rupee|₹|pcs|piece|pieces|packets?|packet|bunches?|bunch|dozens?|liters?|litres?|liter|litre|ml|அரை|கால்|முக்கால்|கிலோ|கீலோ|கிராம்|டஜன்|பீஸ்|பீஸ்கள்|பாக்கெட்|பாக்கெட்டுகள்|கட்டு|கட்டுகள்|லிட்டர்|ரூபாய்|ரூ|ரூபிஸ்|ரூபாய்க்கு|ரூபாயி|ரூபாயிக்கு|rupaaiku|rupaai|rskku|rsku|worth|and|மற்றும்|அப்புறம்|அதோடு)/gi, ' ')
      .replace(/(buy|add|order|podu|venum|want|need|please|for|me|vangunen|போடு|வேணும்|வேண்டும்|வாங்கு|வாங்க|குடுங்க|தாங்க|அனுப்புங்க|கார்ட்|சேர்|சேர்க்க)/gi, ' ')
      .replace(/[\-\:\.\/\(\)\?\!\,\+]/g, ' ')
      .trim();

    if (!cleanQuery) cleanQuery = trimmedSeg;

    let matchedResults = getMatchedProducts(cleanQuery, activeProducts);
    if ((!matchedResults || matchedResults.length === 0) && cleanQuery !== trimmedSeg) {
      matchedResults = getMatchedProducts(trimmedSeg, activeProducts);
    }

    if (matchedResults && matchedResults.length > 0) {
      const bestMatchObj = matchedResults[0];
      const bestMatch = bestMatchObj.product;
      const matchScore = bestMatchObj.score;
      const confidence = Math.min(1.0, matchScore / 300);

      const unit = bestMatch.sellingUnit || bestMatch.unit || 'kg';
      const isPieceUnit = isLyoPieceUnit(unit);

      if (!isExplicitFound && !hasPurchaseKeyword && confidence < 0.5) {
        return;
      }

      let weightGrams = 0;
      let totalPrice = 0;
      let requestedMoneyWorth = 0;

      const pricePerKg = bestMatch.pricePerKg || bestMatch.price || 0;

      if (unitType === "MONEY") {
        requestedMoneyWorth = value;
        totalPrice = Math.round(value);

        if (isPieceUnit) {
          const piecePrice = pricePerKg || 1;
          const count = Math.max(1, Math.floor(value / piecePrice));
          weightGrams = count;
          totalPrice = Math.round(count * piecePrice);
        } else {
          if (pricePerKg > 0) {
            weightGrams = Math.round((value / pricePerKg) * 1000);
          } else {
            weightGrams = 1000;
          }
        }
      } else if (unitType === "WEIGHT_GRAMS") {
        weightGrams = Math.round(value);
        totalPrice = Math.round((pricePerKg / 1000) * weightGrams);
      } else if (unitType === "WEIGHT_KG") {
        weightGrams = Math.round(value * 1000);
        totalPrice = Math.round((pricePerKg / 1000) * weightGrams);
      } else if (unitType === "VOLUME_LITERS") {
        weightGrams = Math.round(value * 1000);
        totalPrice = Math.round((pricePerKg / 1000) * weightGrams);
      } else if (unitType === "VOLUME_ML") {
        weightGrams = Math.round(value);
        totalPrice = Math.round((pricePerKg / 1000) * weightGrams);
      } else if (unitType === "COUNT_PIECES") {
        if (isPieceUnit) {
          const count = Math.max(1, Math.round(value));
          weightGrams = count;
          totalPrice = Math.round(pricePerKg * count);
        } else {
          weightGrams = Math.round(value * 1000);
          totalPrice = Math.round((pricePerKg / 1000) * weightGrams);
        }
      } else { // PLAIN_NUMBER
        if (isPieceUnit) {
          const count = Math.max(1, Math.round(value));
          weightGrams = count;
          totalPrice = Math.round(pricePerKg * count);
        } else {
          if (value < 10) {
            weightGrams = Math.round(value * 1000);
          } else {
            weightGrams = Math.round(value);
          }
          totalPrice = Math.round((pricePerKg / 1000) * weightGrams);
        }
      }

      totalConfidence += confidence;
      parsedCount++;

      if (!proposalList.some(item => item.productId === bestMatch.id)) {
        proposalList.push({
          productId: bestMatch.id,
          englishName: bestMatch.englishName,
          tamilName: bestMatch.tamilName,
          weightGrams: weightGrams,
          totalPrice: totalPrice,
          requestedMoneyWorth: requestedMoneyWorth,
          pricePerKg: pricePerKg,
          category: bestMatch.category || 'General',
          unit: unit,
          confidence: confidence,
          isUnavailable: false
        });
      }
    }
  });

  if (proposalList.length === 0) {
    return null;
  }

  const avgConfidence = totalConfidence / Math.max(1, parsedCount);

  if (avgConfidence < 0.45) {
    const itemNames = proposalList.map(p => isTamil ? p.tamilName : p.englishName).join(', ');
    const clarifyMsg = isTamil
      ? `அண்ணே! நீங்கள் **${itemNames}** பற்றி கேட்கிறீர்களா? எவ்வளவு அளவு (எ.கா. 1 கிலோ, 500 கிராம் அல்லது ₹100-க்கு) வேண்டும் என்று சரியாகக் கூறுங்கள் அண்ணே! 🛒`
      : `Brother, did you mean **${itemNames}**? Please specify the exact quantity (e.g. 1 Kg, 500g, or ₹100 worth)! 🛒`;
    
    return {
      text: clarifyMsg,
      proposalData: null,
      isClarification: true
    };
  }

  const itemSummaryList = proposalList.map(item => {
    const pName = isTamil ? (item.tamilName || item.englishName) : (item.englishName || item.tamilName);
    let qtyLabel = "";
    const isPiece = isLyoPieceUnit(item.unit);

    if (isPiece) {
      qtyLabel = `${item.weightGrams} ${isTamil ? 'பீஸ்' : 'pcs'}`;
    } else if (item.requestedMoneyWorth > 0) {
      const kgStr = (item.weightGrams >= 1000)
        ? `${(item.weightGrams/1000).toFixed(2).replace(/\.00$/,'')} Kg`
        : `${item.weightGrams}g`;
      qtyLabel = `${kgStr} [₹${item.requestedMoneyWorth} ${isTamil ? 'மதிப்பிற்கு' : 'worth'}]`;
    } else if (item.weightGrams >= 1000) {
      qtyLabel = `${(item.weightGrams/1000).toFixed(2).replace(/\.00$/,'')} Kg`;
    } else {
      qtyLabel = `${item.weightGrams}g`;
    }

    return `• **${pName}** (${qtyLabel}) - ₹${item.totalPrice}`;
  }).join('\n');

  const replyText = isTamil
    ? `வணக்கம் ${honorific}! நீங்கள் கேட்ட பொருளைக்கூடையில் சேர்க்க கீழே தயார் செய்து வைத்துள்ளேன் ${honorific}! 🛒🥩\n\n${itemSummaryList}\n\nகீழே உள்ள **🛒** பொத்தானைக் கிளிக் செய்து சட்டுனு கூடையில் சேர்த்து ஆர்டர் செய்துடலாம் ${honorific}!`
    : `Hello ${honorific === 'அக்கா' ? 'Sister' : 'Brother'}! I have prepared the requested item(s) below for your cart: 🛒🥩\n\n${itemSummaryList}\n\nClick the **🛒** button below to add them to your cart!`;

  return {
    text: replyText,
    proposalData: proposalList,
    phone: null,
    showTrack: false
  };
}

module.exports = { mockProducts, parseOfflineOrderProposal };
