
    function toggleGmailPassVisibility() {
      const elPass = document.getElementById('setting-gmail-pass');
      const btn = document.getElementById('btn-toggle-gmail-pass-vis');
      if (!elPass) return;
      if (elPass.type === 'password') {
        elPass.type = 'text';
        if (btn) btn.innerText = '🙈';
      } else {
        elPass.type = 'password';
        if (btn) btn.innerText = '👁️';
      }
    }

    async function loadAdminEmailOtpConfig() {
      const elUser = document.getElementById('setting-gmail-user');
      const elPass = document.getElementById('setting-gmail-pass');
      const elBadge = document.getElementById('email-otp-status-badge');

      let gmailUser = '';
      let gmailPass = '';

      if (typeof db !== 'undefined' && db) {
        try {
          const doc = await db.collection('ek_settings').doc('emailConfig').get();
          if (doc.exists) {
            const data = doc.data();
            if (data) {
              gmailUser = data.gmailUser || '';
              gmailPass = data.gmailPass || '';
            }
          }
        } catch (e) {
          console.warn('[Email OTP Settings] Could not fetch emailConfig from Firestore:', e);
        }
      }

      if (elUser) elUser.value = gmailUser;
      if (elPass) elPass.value = gmailPass;

      if (elBadge) {
        if (gmailUser && gmailPass) {
          elBadge.innerText = 'Active (Configured)';
          elBadge.style.background = 'rgba(16, 185, 129, 0.2)';
          elBadge.style.color = '#10b981';
          elBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else {
          elBadge.innerText = 'Not Configured';
          elBadge.style.background = 'rgba(148, 163, 184, 0.2)';
          elBadge.style.color = '#94a3b8';
          elBadge.style.borderColor = 'rgba(148, 163, 184, 0.4)';
        }
      }
    }

    async function saveAdminEmailOtpConfig() {
      const elUser = document.getElementById('setting-gmail-user');
      const elPass = document.getElementById('setting-gmail-pass');

      const gmailUser = elUser ? elUser.value.trim() : '';
      const gmailPass = elPass ? elPass.value.trim() : '';

      if (!gmailUser || !gmailPass) {
        showToast("Please enter both Gmail Address and Gmail App Password.", "warning");
        return;
      }

      if (typeof db !== 'undefined' && db) {
        try {
          await db.collection('ek_settings').doc('emailConfig').set({
            gmailUser: gmailUser,
            gmailPass: gmailPass,
            updatedAt: new Date().toISOString()
          });
          showToast("✅ Email OTP credentials saved successfully to ek_settings/emailConfig!", "success");
          loadAdminEmailOtpConfig();
        } catch (err) {
          console.error("Firestore emailConfig write failed:", err);
          showToast("Error saving Email OTP settings: " + err.message, "error");
        }
      } else {
        showToast("Database connection not ready.", "error");
      }
    }

    async function testAdminAiKey() {
      const elKey = document.getElementById('setting-ai-api-key');
      const elModel = document.getElementById('setting-ai-model');

      const apiKey = elKey ? elKey.value.trim() : '';
      const model = elModel ? elModel.value.trim() : '';

      let provider = 'gemini';
      if (apiKey) {
        provider = detectAiProvider(apiKey);
        if (!provider) {
          showToast("Key format not recognized. Please check you copied the correct key.", "error");
          return;
        }
      }

      showToast(`Testing ${provider.toUpperCase()} key connection... ⏳`, "info");

      try {
        const tempConfig = { provider: apiKey ? provider : 'gemini', apiKey, model };
        const res = await testAIProviderConfig(tempConfig);
        if (res && res.text) {
          showToast(`✅ ${provider.toUpperCase()} Key Test Succeeded! Response: "${res.text.substring(0, 30)}..."`, "success");
        } else {
          showToast(`❌ Test failed: Empty response from ${provider}`, "error");
        }
      } catch (err) {
        console.error("AI Key Test Error:", err);
        showToast(`❌ Test Failed: ${err.message || err}`, "error");
      }
    }

    async function testAIProviderConfig(tempConfig) {
      return await callAIProvider(
        "You are a test assistant. Respond in 1 short word.",
        [{ role: 'user', parts: [{ text: 'Hello' }] }],
        'Hello',
        tempConfig
      );
    }

    async function callAIProvider(systemInstructions, conversationContents, queryText, customConfig = null) {
      let config = customConfig || getAiProviderConfig();
      let provider = config.provider || 'gemini';
      let apiKey = (config.apiKey || '').trim();
      let model = (config.model || '').trim();

      // Auto-discover built-in Gemini API key if no custom key configured
      if (!apiKey && typeof getBuiltinGeminiApiKey === 'function') {
        const builtinKey = getBuiltinGeminiApiKey();
        if (builtinKey && builtinKey.trim()) {
          apiKey = builtinKey.trim();
          provider = 'gemini';
        }
      }

      let primaryErr = null;

      // 1. Direct Execution with Key (Gemini free tier or Custom Provider)
      if (apiKey) {
        try {
          return await executeSingleAiCall(provider, apiKey, model, systemInstructions, conversationContents);
        } catch (err) {
          primaryErr = err;
          console.warn(`[AI Orchestrator] Direct provider (${provider}) failed: HTTP ${err.status || 'N/A'} - ${err.message}.`);
        }
      }

      // 2. Server-side Cloud Function proxy (if available)
      const aiCloudFn = typeof getCloudFunction === 'function' ? getCloudFunction('generateAiResponse') : null;
      if (aiCloudFn) {
        try {
          const userPrompt = queryText || (conversationContents && conversationContents[0] && conversationContents[0].parts && conversationContents[0].parts[0] ? conversationContents[0].parts[0].text : '');
          const res = await aiCloudFn({
            prompt: userPrompt,
            systemInstruction: systemInstructions || '',
            contents: conversationContents || [],
            model: model || '',
            provider: provider || 'gemini'
          });
          if (res && res.data && res.data.text) {
            return { text: res.data.text, provider: res.data.provider || provider };
          }
        } catch (serverErr) {
          if (!primaryErr) primaryErr = serverErr;
          console.warn("[AI Orchestrator] Server Cloud Function proxy call failed:", serverErr.message || serverErr);
        }
      }

      // 3. Resilient Free Open-Source Models (Qwen 2.5 & Mistral via open-source endpoints)
      // Free inference, zero API key required, high multilingual Tamil & English accuracy
      try {
        const osRes = await callFreeOpenSourceAI(systemInstructions, conversationContents, queryText);
        if (osRes && osRes.text) {
          return osRes;
        }
      } catch (osErr) {
        console.warn("[AI Orchestrator] Free open-source fallback failed:", osErr.message);
      }

      const finalErr = primaryErr || new Error("AI_ORCHESTRATOR_ALL_PROVIDERS_FAILED");
      if (!finalErr.provider) finalErr.provider = provider;
      throw finalErr;
    }

    async function callFreeOpenSourceAI(systemInstructions, conversationContents, queryText) {
      const openSourceModels = ['qwen', 'mistral'];
      const messages = [
        { role: 'system', content: systemInstructions || 'You are Lyo AI, an intelligent, helpful assistant for Edappadi Kadai store.' },
        ...((conversationContents || []).map(c => ({
          role: c.role === 'model' ? 'assistant' : 'user',
          content: (c.parts && c.parts[0] ? (c.parts[0].text || c.parts[0]) : (typeof c.parts === 'string' ? c.parts : ''))
        })))
      ];
      if (messages.length <= 1 && queryText) {
        messages.push({ role: 'user', content: queryText });
      }

      for (const m of openSourceModels) {
        try {
          const res = await fetchWithTimeoutAndRetry('https://text.pollinations.ai/openai/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: m,
              messages: messages,
              temperature: 0.1
            })
          }, 1, 6000);
          if (res && res.ok) {
            const data = await res.json();
            const txt = data?.choices?.[0]?.message?.content;
            if (txt && txt.trim()) {
              return { text: txt.trim(), provider: 'open-source-' + m };
            }
          }
        } catch (err) {
          console.warn(`[Lyo OpenSource AI] Model ${m} error:`, err.message);
        }
      }
      throw new Error("OPEN_SOURCE_AI_UNAVAILABLE");
    }

    async function executeSingleAiCall(provider, cleanKey, cleanModel, systemInstructions, conversationContents) {
      if (provider === 'groq') {
        const targetModel = cleanModel || 'llama-3.3-70b-versatile';
        const messages = [
          { role: 'system', content: systemInstructions },
          ...conversationContents.map(c => ({
            role: c.role === 'model' ? 'assistant' : 'user',
            content: (c.parts && c.parts[0] ? c.parts[0].text : '')
          }))
        ];
        const res = await fetchWithTimeoutAndRetry('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanKey}`
          },
          body: JSON.stringify({ model: targetModel, messages: messages })
        }, 1, 7000);
        if (!res.ok) {
          let errDetails = '';
          try { errDetails = await res.text(); } catch(e) {}
          const err = new Error(`Groq HTTP ${res.status}: ${errDetails || res.statusText}`);
          err.status = res.status;
          err.provider = 'groq';
          err.details = errDetails;
          throw err;
        }
        const data = await res.json();
        const replyText = data?.choices?.[0]?.message?.content;
        if (!replyText) throw new Error("Empty Groq response");
        return { text: replyText };

      } else if (provider === 'openrouter') {
        const targetModel = cleanModel || 'google/gemini-2.5-flash';
        const messages = [
          { role: 'system', content: systemInstructions },
          ...conversationContents.map(c => ({
            role: c.role === 'model' ? 'assistant' : 'user',
            content: (c.parts && c.parts[0] ? c.parts[0].text : '')
          }))
        ];
        const res = await fetchWithTimeoutAndRetry('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanKey}`,
            'HTTP-Referer': 'https://edappadikadai.com'
          },
          body: JSON.stringify({ model: targetModel, messages: messages })
        }, 1, 7000);
        if (!res.ok) {
          let errDetails = '';
          try { errDetails = await res.text(); } catch(e) {}
          const err = new Error(`OpenRouter HTTP ${res.status}: ${errDetails || res.statusText}`);
          err.status = res.status;
          err.provider = 'openrouter';
          err.details = errDetails;
          throw err;
        }
        const data = await res.json();
        const replyText = data?.choices?.[0]?.message?.content;
        if (!replyText) throw new Error("Empty OpenRouter response");
        return { text: replyText };

      } else if (provider === 'openai' || provider === 'deepseek') {
        const targetModel = cleanModel || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
        const endpoint = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
        const messages = [
          { role: 'system', content: systemInstructions },
          ...conversationContents.map(c => ({
            role: c.role === 'model' ? 'assistant' : 'user',
            content: (c.parts && c.parts[0] ? c.parts[0].text : '')
          }))
        ];
        const res = await fetchWithTimeoutAndRetry(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanKey}`
          },
          body: JSON.stringify({ model: targetModel, messages: messages })
        }, 1, 7000);
        if (!res.ok) {
          let errDetails = '';
          try { errDetails = await res.text(); } catch(e) {}
          const err = new Error(`${provider.toUpperCase()} HTTP ${res.status}: ${errDetails || res.statusText}`);
          err.status = res.status;
          err.provider = provider;
          err.details = errDetails;
          throw err;
        }
        const data = await res.json();
        const replyText = data?.choices?.[0]?.message?.content;
        if (!replyText) throw new Error(`Empty ${provider} response`);
        return { text: replyText };

      } else if (provider === 'anthropic') {
        const targetModel = cleanModel || 'claude-3-5-haiku-latest';
        const messages = conversationContents.map(c => ({
          role: c.role === 'model' ? 'assistant' : 'user',
          content: (c.parts && c.parts[0] ? c.parts[0].text : '')
        }));
        const res = await fetchWithTimeoutAndRetry('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': cleanKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: targetModel,
            max_tokens: 1024,
            system: systemInstructions,
            messages: messages
          })
        }, 1, 7000);
        if (!res.ok) {
          let errDetails = '';
          try { errDetails = await res.text(); } catch(e) {}
          const err = new Error(`Anthropic HTTP ${res.status}: ${errDetails || res.statusText}`);
          err.status = res.status;
          err.provider = 'anthropic';
          err.details = errDetails;
          throw err;
        }
        const data = await res.json();
        const replyText = data?.content?.[0]?.text;
        if (!replyText) throw new Error("Empty Anthropic response");
        return { text: replyText };

      } else {
        // Free & fast Google Gemini models (zero quota drain, high speed & accuracy)
        const geminiModels = [
          cleanModel || 'gemini-2.5-flash',
          'gemini-flash-latest',
          'gemini-3.1-flash-lite-preview',
          'gemini-3.5-flash'
        ];
        let lastError = "";
        let lastStatus = 0;
        let lastDetails = "";

        for (const m of geminiModels) {
          try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${cleanKey}`;
            const res = await fetchWithTimeoutAndRetry(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstructions }] },
                contents: conversationContents
              })
            }, 1, 7000);

            if (res.ok) {
              const data = await res.json();
              const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (replyText) return { text: replyText };
            } else {
              lastStatus = res.status;
              let errText = '';
              try {
                const errJson = await res.json();
                errText = errJson?.error?.message || errJson?.message || JSON.stringify(errJson);
              } catch(e) {
                try { errText = await res.text(); } catch(e2) {}
              }
              lastDetails = errText;
              lastError = `Gemini HTTP ${res.status}: ${errText || res.statusText}`;
            }
          } catch (mErr) {
            lastError = mErr.message;
            if (mErr.status) lastStatus = mErr.status;
          }
        }
        const err = new Error(`Gemini call failed: ${lastError}`);
        err.status = lastStatus || 400;
        err.provider = 'gemini';
        err.details = lastDetails || lastError;
        throw err;
      }
    }

    const _aiOrderParseCache = new Map();

    async function fetchWithTimeoutAndRetry(url, options = {}, retries = 2, timeoutMs = 8000) {
      let lastErr = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
          const fetchOptions = controller ? { ...options, signal: controller.signal } : options;
          const res = await fetch(url, fetchOptions);
          if (timer) clearTimeout(timer);
          if (res.ok) return res;
          if ((res.status >= 500 || res.status === 429) && attempt < retries) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }
          return res;
        } catch (err) {
          if (timer) clearTimeout(timer);
          lastErr = err;
          if (attempt >= retries) throw err;
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
      throw lastErr || new Error("FETCH_FAILED_AFTER_RETRIES");
    }

    
    // ==========================================
    // LYO AI SHOPPING UI MODULE (PRODUCTION GRADE AI COMMERCE ENGINE)
    // ====================================================================

    let _lyoChatMessages = [];
    let _lyoDraftCart = [];
    if (typeof _aiOrderParseCache === 'undefined') {
      window._aiOrderParseCache = new Map();
    }

    // 1. Synonym Dictionary & Language Mappings (Unified NLU Dictionary)
    const LYO_SYNONYMS = (typeof window.EK_BASE_SYNONYMS !== 'undefined') ? window.EK_BASE_SYNONYMS : {
      'head_curry': ['head curry', 'goat head', 'thalaikkari', 'ஆட்டுத்தலை', 'தலைக்கறி', 'ஆட்டு தலைக்கறி', 'goat head curry', 'head meat'],
      'mutton_liver': ['mutton liver', 'eeral', 'liver', 'ஈரல்', 'மட்டன் ஈரல்', 'suvarotti', 'சுவரொட்டி'],
      'mutton': ['mutton', 'ஆட்டுக்கறி', 'மட்டன்', 'muttan', 'goat', 'goat mutton', 'lamb', 'ஆட்டு', 'aattu', 'ஆடு'],
      'country_chicken': ['country chicken', 'nattu koli', 'nattu kozhi', 'naattu kozhi', 'naattu koli', 'nattukoli', 'nattu chicken', 'நாட்டுக்கோழி', 'நாட்டு கோழி', 'நாட்டுக்கறி', 'நாட்டு கோழிக்கறி'],
      'broiler_chicken': ['broiler chicken', 'broiler', 'farm chicken', 'பிராய்லர்', 'பிராய்லர் சிக்கன்', 'பிறாய்லர்', 'பிராய்லர் கோழி'],
      'chicken': ['chicken', 'சிக்கன்', 'கோழி', 'koli', 'chiken', 'chickn', 'கோழிக்கறி'],
      'country_egg': ['country egg', 'country chicken egg', 'nattu muttai', 'naattu muttai', 'நாட்டுக்கோழி முட்டை', 'நாட்டு முட்டை'],
      'egg': ['egg', 'eggs', 'முட்டை', 'muttai', 'egg packet', 'muttai tray'],
      'milk': ['milk', 'பால்', 'paal', 'milk packet', 'pal', 'paal packet'],
      'onion': ['onion', 'onions', 'வெங்காயம்', 'vengayam', 'chinnavengayam', 'periyavengayam', 'vengaiyam', 'சின்ன வெங்காயம்', 'பெரிய வெங்காயம்'],
      'small_onion': ['small onion', 'chinna vengayam', 'shallots', 'சின்ன வெங்காயம்', 'சாம்பார் வெங்காயம்'],
      'potato': ['potato', 'potatoes', 'உருளைக்கிழங்கு', 'உருளை கிழங்கு', 'உருளை', 'urulaikilangu', 'urulai', 'potatos'],
      'chilli': ['chilli', 'chili', 'மிளகாய்', 'milagai', 'green chilli', 'red chilli', 'பச்சை மிளகாய்'],
      'coriander': ['coriander', 'கொத்தமல்லி', 'kothamalli', 'malli', 'koththamalli', 'coriander leaves'],
      'oil': ['oil', 'எண்ணெய்', 'ennai', 'sunflower oil', 'gingelly oil', 'groundnut oil', 'coconut oil', 'தேங்காய் எண்ணெய்'],
      'curd': ['curd', 'தயிர்', 'thayir', 'curd packet'],
      'fish': ['fish', 'மீன்', 'meen', 'vanjaram', 'nethili', 'katla', 'rohu'],
      'lemon': ['lemon', 'lemons', 'எலுமிச்சை', 'elumichai'],
      'garlic': ['garlic', 'பூண்டு', 'poondhu', 'poondu'],
      'ginger': ['ginger', 'இஞ்சி', 'inji'],
      'sugar': ['sugar', 'சர்க்கரை', 'sarkarai', 'sakkarai'],
      'salt': ['salt', 'உப்பு', 'uppu'],
      'rice': ['rice', 'அரிசி', 'arisi', 'ponni rice'],
      'dal': ['dal', 'பருப்பு', 'paruppu', 'toor dal', 'urad dal']
    };

    function syncAiKnowledgeBase(customProducts = null) {
      try {
        const products = customProducts || (typeof getProductsList === 'function' ? getProductsList() : (typeof getData === 'function' ? getData('ek_products', []) : []));
        const categories = typeof getCategoriesList === 'function' ? getCategoriesList() : (typeof getData === 'function' ? getData('ek_categories', []) : []);

        const productDict = {};
        const categoryDict = {};
        let unitDict;
        if (typeof window !== 'undefined' && window.UNIT_REGISTRY) {
          const reg = window.UNIT_REGISTRY;
          const regKeys = Object.keys(reg);
          unitDict = {
            weight: regKeys.filter(k => reg[k] && reg[k].isWeight && !reg[k].isLiquid),
            volume: regKeys.filter(k => reg[k] && reg[k].isLiquid),
            count: regKeys.filter(k => reg[k] && !reg[k].isWeight)
          };
        } else {
          unitDict = {
            weight: ['kg', 'kilo', 'kilos', 'கிலோ', 'g', 'gm', 'gram', 'grams', 'கிராம்', '250g', '500g', '750g', '1.5kg'],
            volume: ['l', 'litre', 'litres', 'liter', 'liters', 'லிட்டர்', 'ltr', 'ml', 'milli', 'millilitre', 'மில்லி'],
            count: ['pcs', 'piece', 'pieces', 'பீஸ்', 'பீசு', 'பீஸ்கள்', 'nos', 'no', 'packet', 'packets', 'pkt', 'doz', 'dozen', 'டஜன்', 'bundle', 'box', 'bottle']
          };
        }

        (products || []).forEach(p => {
          if (!p) return;
          const pId = p.id || p.productId;
          if (!pId) return;
          const en = (p.englishName || '').trim();
          const ta = (p.tamilName || '').trim();
          productDict[pId] = {
            id: pId,
            englishName: en,
            tamilName: ta,
            category: p.category || 'General',
            sellingPrice: Number(p.sellingPrice || p.price || 0),
            unit: p.sellingUnit || p.unit || 'kg',
            isAvailable: p.isAvailable !== false,
            discount: p.discount || 0,
            offerText: p.offerText || ''
          };

          const catName = p.category || 'General';
          if (!categoryDict[catName]) categoryDict[catName] = [];
          categoryDict[catName].push(pId);
        });

        const knowledgeBase = {
          PRODUCT_DICTIONARY: productDict,
          CATEGORY_DICTIONARY: categoryDict,
          UNIT_DICTIONARY: unitDict,
          SYNONYMS: LYO_SYNONYMS,
          TOTAL_PRODUCTS: Object.keys(productDict).length,
          TOTAL_CATEGORIES: Object.keys(categoryDict).length,
          LAST_SYNC_TIME: new Date().toISOString()
        };

        window.LYO_OFFLINE_KNOWLEDGE = knowledgeBase;
        if (typeof saveData === 'function') {
          saveData('ek_ai_offline_knowledge', knowledgeBase);
        }

        // 1. Clear AI order parse cache on catalog sync so new products/prices take effect immediately
        if (typeof _aiOrderParseCache !== 'undefined' && _aiOrderParseCache && typeof _aiOrderParseCache.clear === 'function') {
          _aiOrderParseCache.clear();
        }

        // 2. Refresh dynamic NLU synonym dictionary with active products
        if (typeof window !== 'undefined' && typeof window.getActiveNluDictionary === 'function') {
          try {
            window.getActiveNluDictionary(products);
          } catch(e) {}
        }

        return knowledgeBase;
      } catch (err) {
        console.warn('[AI Knowledge Base Sync] Error:', err);
        return null;
      }
    }
    window.syncAiKnowledgeBase = syncAiKnowledgeBase;

    // Automatic Realtime Sync Listeners for Lyo AI
    if (typeof window !== 'undefined') {
      window.addEventListener('ek-products-updated', function(e) {
        const pList = (typeof getData === 'function' ? getData('ek_products', []) : []) || [];
        syncAiKnowledgeBase(pList);
      });
      window.addEventListener('refresh-customer-catalog', function() {
        const pList = (typeof getData === 'function' ? getData('ek_products', []) : []) || [];
        syncAiKnowledgeBase(pList);
      });
    }

    // 2. Levenshtein Distance for Misspellings
    function getLevenshteinDistance(a, b) {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
            );
          }
        }
      }
      return matrix[b.length][a.length];
    }

    // 3. String Similarity Calculator (0.0 to 1.0)
    function calculateSimilarityScore(str1, str2) {
      if (!str1 || !str2) return 0;
      const s1 = str1.toLowerCase().trim();
      const s2 = str2.toLowerCase().trim();
      if (s1 === s2) return 1.0;
      if (s1.includes(s2) || s2.includes(s1)) return 0.90;
      const maxLen = Math.max(s1.length, s2.length);
      if (maxLen === 0) return 1.0;
      const dist = getLevenshteinDistance(s1, s2);
      return Math.max(0, 1.0 - (dist / maxLen));
    }

    function normalizeLyoText(s) {
      if (!s) return '';
      return s.toLowerCase().replace(/[\u0BCD\u0BD7]/g, '').replace(/[^\w\u0B80-\u0BFF]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function getAutoGeneratedProductAliases(p) {
      if (!p) return [];
      const aliases = new Set();

      // 1. Explicit admin defined aliases
      if (Array.isArray(p.aliases)) {
        p.aliases.forEach(a => { if (a && typeof a === 'string' && a.trim()) aliases.add(a.toLowerCase().trim()); });
      } else if (typeof p.aliases === 'string' && p.aliases.trim()) {
        p.aliases.split(',').forEach(a => { if (a.trim()) aliases.add(a.toLowerCase().trim()); });
      }

      // 2. Search keywords / alternate names
      if (Array.isArray(p.keywords)) {
        p.keywords.forEach(k => { if (k && typeof k === 'string' && k.trim()) aliases.add(k.toLowerCase().trim()); });
      }
      if (typeof p.searchKeywords === 'string') {
        p.searchKeywords.split(',').forEach(k => { if (k.trim()) aliases.add(k.toLowerCase().trim()); });
      }

      // 3. English Name & word variations
      const eng = (p.englishName || p.name || '').toLowerCase().replace(/[-_:,;!/()]/g, ' ').replace(/\s+/g, ' ').trim();
      if (eng) {
        aliases.add(eng);
        const tokens = eng.split(' ').filter(w => w.length > 0);
        tokens.forEach(t => {
          if (t.length > 2) {
            aliases.add(t);
            if (t.endsWith('s')) aliases.add(t.slice(0, -1));
            if (t.endsWith('es')) aliases.add(t.slice(0, -2));
            if (!t.endsWith('s')) aliases.add(t + 's');
            if (t === 'potato') aliases.add('potatoes');
            if (t === 'tomato') aliases.add('tomatoes');
            if (t === 'egg') aliases.add('eggs');
          }
        });

        const coreWords = tokens.filter(w => !['fresh', 'organic', 'pure', 'premium', 'big', 'slice', 'cut', 'tender', 'sujatha', 'cold', 'pressed', 'white', 'country', 'broiler'].includes(w));
        if (coreWords.length > 0) {
          aliases.add(coreWords.join(' '));
          coreWords.forEach(cw => {
            if (cw.length > 2) {
              aliases.add(cw);
              if (cw.endsWith('s')) aliases.add(cw.slice(0, -1));
              if (!cw.endsWith('s')) aliases.add(cw + 's');
            }
          });
        }
      }

      // 4. Tamil Name & word variations
      const tam = (p.tamilName || '').toLowerCase().replace(/[-_:,;!/()]/g, ' ').replace(/\s+/g, ' ').trim();
      if (tam) {
        aliases.add(tam);
        const tamTokens = tam.split(' ').filter(w => w.length > 0);
        tamTokens.forEach(tt => {
          if (tt.length > 2) aliases.add(tt);
        });
      }

      // 5. Common Tamil/Tanglish Transliteration aliases (Strict variant scoping)
      const engNorm = eng.toLowerCase();
      if (engNorm.includes('head curry') || engNorm.includes('goat head') || tam.includes('தலைகறி') || tam.includes('தலைக்கறி')) {
        ['thalaikkari', 'thalaikari', 'thala karii', 'head curry', 'goat head', 'head', 'தலைகறி', 'தலைக்கறி', 'ஆட்டுத்தலை'].forEach(a => aliases.add(a));
      }
      if (engNorm.includes('egg') || tam.includes('முட்டை')) {
        if (engNorm.includes('country') || tam.includes('நாட்டு') || engNorm.includes('nattu')) {
          ['country egg', 'country chicken egg', 'nattu muttai', 'naattu muttai', 'நாட்டுக்கோழி முட்டை', 'நாட்டு முட்டை'].forEach(a => aliases.add(a));
        } else {
          ['egg', 'eggs', 'muttai', 'muttas', 'முட்டை', 'முட்டைகள்', 'white egg', 'white eggs', 'farm egg'].forEach(a => aliases.add(a));
        }
      }
      if (engNorm.includes('potato') || tam.includes('உருளை')) {
        ['potato', 'potatoes', 'urulai', 'urulaikilangu', 'உருளை', 'உருளைக்கிழங்கு'].forEach(a => aliases.add(a));
      }
      if (engNorm.includes('tomato') || tam.includes('தக்காளி')) {
        ['tomato', 'tomatoes', 'thakkali', 'thakali', 'தக்காளி'].forEach(a => aliases.add(a));
      }
      if (engNorm.includes('onion') || tam.includes('வெங்காயம்')) {
        ['onion', 'onions', 'vengayam', 'vengaym', 'வெங்காயம்', 'சின்ன வெங்காயம்', 'பெரிய வெங்காயம்'].forEach(a => aliases.add(a));
      }
      if (engNorm.includes('chicken') || tam.includes('சிக்கன்') || tam.includes('கோழி')) {
        if (engNorm.includes('country') || tam.includes('நாட்டு') || engNorm.includes('nattu')) {
          ['country chicken', 'nattu koli', 'naattu kozhi', 'nattukoli', 'nattu chicken', 'நாட்டுக்கோழி', 'நாட்டு கோழி', 'நாட்டுக்கறி', 'நாட்டு கோழிக்கறி'].forEach(a => aliases.add(a));
        } else if (engNorm.includes('broiler') || tam.includes('பிராய்லர்') || tam.includes('பிறாய்லர்')) {
          ['broiler chicken', 'broiler', 'farm chicken', 'பிராய்லர்', 'பிராய்லர் சிக்கன்', 'பிறாய்லர்', 'பிராய்லர் கோழி'].forEach(a => aliases.add(a));
        } else {
          ['chicken', 'chickens', 'koli', 'kozhi', 'சிக்கன்', 'கோழி', 'கோழிக்கறி'].forEach(a => aliases.add(a));
        }
      }
      if (engNorm.includes('mutton') || tam.includes('மட்டன்') || tam.includes('ஆட்டு') || engNorm.includes('goat') || engNorm.includes('lamb')) {
        ['mutton', 'kari', 'karii', 'aattu kari', 'மட்டன்', 'ஆட்டுக்கறி', 'goat', 'lamb', 'ஆடு', 'aattu', 'aattukari', 'aattukkari'].forEach(a => aliases.add(a));
      }
      if (engNorm.includes('milk') || tam.includes('பால்')) {
        ['milk', 'paal', 'pal', 'பால்', 'பசும்பால்'].forEach(a => aliases.add(a));
      }
      if (engNorm.includes('ghee') || tam.includes('நெய்')) {
        ['ghee', 'nei', 'neyy', 'நெய்', 'பசு நெய்'].forEach(a => aliases.add(a));
      }
      if (engNorm.includes('oil') || tam.includes('எண்ணெய்')) {
        if (engNorm.includes('coconut') || tam.includes('தேங்காய்')) {
          ['coconut oil', 'theangai ennai', 'theangai enney', 'தேங்காய் எண்ணெய்'].forEach(a => aliases.add(a));
        } else if (engNorm.includes('gingelly') || engNorm.includes('sesame') || tam.includes('நல்லெண்ணெய்')) {
          ['gingelly oil', 'sesame oil', 'nallennai', 'nallenney', 'நல்லெண்ணெய்'].forEach(a => aliases.add(a));
        } else if (engNorm.includes('sunflower') || tam.includes('சூரியகாந்தி')) {
          ['sunflower oil', 'சூரியகாந்தி எண்ணெய்'].forEach(a => aliases.add(a));
        } else {
          ['oil', 'ennai', 'ennay', 'எண்ணெய்'].forEach(a => aliases.add(a));
        }
      }
      if (engNorm.includes('fish') || tam.includes('மீன்')) {
        ['fish', 'meen', 'மீன்', 'வஞ்சரம்'].forEach(a => aliases.add(a));
      }
      if (engNorm.includes('paneer') || tam.includes('பன்னீர்')) {
        ['paneer', 'panir', 'பன்னீர்'].forEach(a => aliases.add(a));
      }

      return Array.from(aliases);
    }

    // 4. Product Matching Engine with Confidence Scoring (>95%, 70-95%, <70%)
    function matchProductWithConfidence(rawQuery, activeProducts) {
      if (!activeProducts || activeProducts.length === 0) {
        return { product: null, score: 0, candidates: [] };
      }
      const q = (rawQuery || '').toLowerCase().trim();
      const qNorm = normalizeLyoText(q);

      let bestProd = null;
      let maxScore = 0;
      const scoredCandidates = [];

      activeProducts.forEach(p => {
        const nameEn = (p.englishName || '').toLowerCase();
        const nameTa = (p.tamilName || '').toLowerCase();
        const nameEnNorm = normalizeLyoText(nameEn);
        const nameTaNorm = normalizeLyoText(nameTa);

        let currentScore = 0;

        // Check local product dictionary aliases
        const aliases = getAutoGeneratedProductAliases(p);
        const hasExactAlias = aliases.some(al => {
          const alNorm = normalizeLyoText(al);
          return alNorm && (qNorm === alNorm || qNorm === al.toLowerCase());
        });

        if (hasExactAlias) {
          currentScore = 1.0;
        } else {
          const hasWordAlias = aliases.some(al => {
            const alNorm = normalizeLyoText(al);
            return alNorm && alNorm.length >= 3 && new RegExp('\\b' + alNorm + '\\b', 'i').test(qNorm);
          });
          if (hasWordAlias) {
            currentScore = 0.98;
          }
        }

        // Exact or normalized match
        if (currentScore < 0.95) {
          if (q === nameEn || q === nameTa || qNorm === nameEnNorm || qNorm === nameTaNorm) {
            currentScore = 1.0;
          } else {
            const qTokens = qNorm.split(' ').filter(w => w.length > 0);
            const pTokens = (nameEnNorm + ' ' + nameTaNorm).split(' ').filter(w => w.length > 0);

            // Check if any query token is an exact match to a product token
            const exactTokenMatch = qTokens.some(qt => pTokens.includes(qt));
            const wholeWordInQuery = pTokens.some(pt => pt.length > 2 && new RegExp('\\b' + pt + '\\b', 'i').test(q));
            const wholeWordInProduct = qTokens.some(qt => qt.length > 2 && new RegExp('\\b' + qt + '\\b', 'i').test(nameEn + ' ' + nameTa));

            if (exactTokenMatch || wholeWordInQuery || wholeWordInProduct) {
              currentScore = 0.95;
            } else {
              // Token overlap (exact token equality or prefix match for words >= 3 chars or singular/plural)
              const matchedTokens = qTokens.filter(t => pTokens.some(pt => {
                const cleanT = t.replace(/s$/i, '');
                const cleanPt = pt.replace(/s$/i, '');
                return pt === t || cleanPt === cleanT || (t.length >= 3 && (pt.startsWith(t) || t.startsWith(pt)));
              }));
              if (qTokens.length > 0 && matchedTokens.length > 0) {
                currentScore = Math.max(currentScore, 0.70 + (matchedTokens.length / qTokens.length) * 0.25);
              }
            }
          }
        }

          // Synonym match with strict word boundary safety & variant isolation
          let synonymMatched = false;
          const activeSynonyms = (typeof window.getActiveNluDictionary === 'function') ? window.getActiveNluDictionary(activeProducts) : LYO_SYNONYMS;
          for (const key in activeSynonyms) {
            const list = activeSynonyms[key];
            const qHasSyn = list.some(syn => {
              const sn = normalizeLyoText(syn);
              return sn && (qNorm === sn || new RegExp('\\b' + sn + '\\b', 'i').test(qNorm) || (sn.length >= 4 && qNorm.includes(sn)));
            });
            if (qHasSyn) {
              const pHasSyn = list.some(syn => {
                const sn = normalizeLyoText(syn);
                return sn && (nameEnNorm.includes(sn) || nameTaNorm.includes(sn) || new RegExp('\\b' + sn + '\\b', 'i').test(nameEnNorm + ' ' + nameTaNorm));
              }) || aliases.some(al => {
                const alNorm = normalizeLyoText(al);
                return alNorm && (list.includes(al.toLowerCase()) || list.some(syn => syn === al.toLowerCase() || normalizeLyoText(syn) === alNorm));
              });

              if (pHasSyn) {
                currentScore = Math.max(currentScore, 0.98);
                synonymMatched = true;
                break;
              }
            }
          }

          if (!synonymMatched) {
            const simEn = calculateSimilarityScore(q, nameEn);
            const simTa = calculateSimilarityScore(q, nameTa);
            currentScore = Math.max(currentScore, Math.max(simEn, simTa));
          }

        scoredCandidates.push({ product: p, score: currentScore });
        if (currentScore > maxScore) {
          maxScore = currentScore;
          bestProd = p;
        }
      });

      scoredCandidates.sort((a, b) => b.score - a.score);
      const topCandidates = scoredCandidates.slice(0, 3).filter(c => c.score > 0.25);

      return {
        product: maxScore >= 0.25 ? bestProd : null,
        score: maxScore,
        candidates: topCandidates
      };
    }

    // 5. Smart Multi-lingual Query Parser
    function parseSingleItemText(itemText) {
      let t = (itemText || '').toLowerCase().replace(/[-_:,;!?]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!t) return null;

      let hasExplicitUserUnit = false;

      // Tamil number words to digits
      const numMap = [
        [/இருபது|இருவது|irupathu|iruvathu/gi, '20'],
        [/முப்பது|muppathu/gi, '30'],
        [/நாற்பது|நாப்பது|narpathu|naappathu/gi, '40'],
        [/ஐம்பது|aimpathu/gi, '50'],
        [/அறுபது|arubathu/gi, '60'],
        [/எழுபது|ezhubathu/gi, '70'],
        [/எண்பது|enbathu/gi, '80'],
        [/தொண்ணூறு|thonnooru/gi, '90'],
        [/நூறு|nooru/gi, '100'],
        [/இருநூறு/gi, '200'],
        [/ஐந்நூறு/gi, '500'],
        [/ஆயிரம்/gi, '1000'],
        [/பத்து|pathu/gi, '10'],
        [/இரண்டு|ரெண்டு|ரண்டு|rendu|randu/gi, '2'],
        [/ஒன்று|ஒன்னு|ஒரு|onru|onnu|oru/gi, '1'],
        [/மூன்று|மூனு|moonru|moonu/gi, '3'],
        [/நான்கு|நாலு|naangu|naalu/gi, '4'],
        [/ஐந்து|அஞ்சு|ainthu|anju/gi, '5'],
        [/ஆறு|aaru/gi, '6'],
        [/ஏழு|aelu/gi, '7'],
        [/எட்டு|ettu/gi, '8'],
        [/ஒன்பது|onbathu/gi, '9']
      ];
      numMap.forEach(([rgx, val]) => {
        t = t.replace(rgx, ' ' + val + ' ');
      });
      t = t.replace(/\s+/g, ' ').trim();

      let amountType = 'WEIGHT_KG';
      let rawQtyVal = 1;
      let unit = 'kg';

      // Rupee Pattern: 20 ரூபாய்க்கு, 20 ரூபாய், ₹20, 20 rs, 20 rupees
      const rupeeRegex = /(?:₹|rs\.?|rupees?|ரூபாய்க்கு|ரூபாய்|ரூபா|ரூ\.?)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?|ரூபாய்க்கு|ரூபாய்|ரூபா|ரூ\.?)/i;
      const rupeeMatch = t.match(rupeeRegex);

      if (rupeeMatch) {
        amountType = 'RUPEES';
        rawQtyVal = parseFloat(rupeeMatch[1] || rupeeMatch[2] || '0');
        hasExplicitUserUnit = true;
        t = t.replace(rupeeMatch[0], '').trim();
        t = t.replace(/^க்கு\s*/i, '').trim();
      } else {
        // Fractions
        if (/(அரை|arai|half|1\/2)/i.test(t)) {
          amountType = 'WEIGHT_GRAMS';
          rawQtyVal = 500;
          unit = 'g';
          hasExplicitUserUnit = true;
          t = t.replace(/(அரை|arai|half|1\/2)\s*(kilo|kg|கிலோ)?/gi, '').trim();
        } else if (/(கால்|kal|quarter|1\/4)/i.test(t)) {
          amountType = 'WEIGHT_GRAMS';
          rawQtyVal = 250;
          unit = 'g';
          hasExplicitUserUnit = true;
          t = t.replace(/(கால்|kal|quarter|1\/4)\s*(kilo|kg|கிலோ)?/gi, '').trim();
        } else if (/(முக்கால்|mukkai|mukkhal|3\/4)/i.test(t)) {
          amountType = 'WEIGHT_GRAMS';
          rawQtyVal = 750;
          unit = 'g';
          hasExplicitUserUnit = true;
          t = t.replace(/(முக்கால்|mukkai|mukkhal|3\/4)\s*(kilo|kg|கிலோ)?/gi, '').trim();
        } else if (/(ஒன்றரை|1\.5|1\s*and\s*half|1\s*1\/2)/i.test(t)) {
          amountType = 'WEIGHT_KG';
          rawQtyVal = 1.5;
          unit = 'kg';
          hasExplicitUserUnit = true;
          t = t.replace(/(ஒன்றரை|1\.5|1\s*and\s*half|1\s*1\/2)\s*(kilo|kg|கிலோ)?/gi, '').trim();
        } else {
          // Piece / Count / Unit pattern
          const pcsMatch = t.match(/(\d+(?:\.\d+)?)\s*(pcs|piece|pieces|பீஸ்|பீசு|பீஸ்கள்|nos|no|பாக்கெட்|pkt|packet|packets)/i) ||
                           t.match(/(pcs|piece|pieces|பீஸ்|பீசு|பீஸ்கள்|nos|no|பாக்கெட்|pkt|packet|packets)\s*(\d+(?:\.\d+)?)/i);
          if (pcsMatch) {
            rawQtyVal = parseFloat(pcsMatch[1] || pcsMatch[2] || '1');
            amountType = 'COUNT_PIECES';
            unit = 'pcs';
            hasExplicitUserUnit = true;
            t = t.replace(pcsMatch[0], '').trim();
          } else {
            // Standard Numbers & Units
            const qtyMatch = t.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z஀-௿]+)?/i) || t.match(/([a-zA-Z஀-௿]+)?\s*(\d+(?:\.\d+)?)/i);
            if (qtyMatch) {
              const num = parseFloat(qtyMatch[1] && !isNaN(qtyMatch[1]) ? qtyMatch[1] : (qtyMatch[2] || '1'));
              const uStr = (qtyMatch[2] && isNaN(qtyMatch[2]) ? qtyMatch[2] : (qtyMatch[1] && isNaN(qtyMatch[1]) ? qtyMatch[1] : '')).toLowerCase().trim();

              const isG = ['g', 'gm', 'gram', 'grams', 'கிராம்'].includes(uStr);
              const isKg = ['kg', 'kilo', 'kilos', 'கிலோ', 'k'].includes(uStr);
              const isL = ['l', 'litre', 'litres', 'liter', 'liters', 'லிட்டர்', 'ltr', 'ltrs'].includes(uStr);
              const isMl = ['ml', 'milli', 'millilitre', 'millilitres', 'மில்லி'].includes(uStr);
              const isDoz = ['doz', 'dozen', 'dozens', 'டஜன்'].includes(uStr);
              const isPkt = ['pkt', 'pkts', 'packet', 'packets', 'பாக்கெட்'].includes(uStr);
              const isPcs = ['pcs', 'piece', 'pieces', 'பீஸ்', 'பீசு', 'பீஸ்கள்', 'nos', 'no'].includes(uStr);

              if (isG) {
                amountType = 'WEIGHT_GRAMS'; rawQtyVal = num; unit = 'g'; hasExplicitUserUnit = true;
                t = t.replace(qtyMatch[0], '').trim();
              } else if (isKg) {
                amountType = 'WEIGHT_KG'; rawQtyVal = num; unit = 'kg'; hasExplicitUserUnit = true;
                t = t.replace(qtyMatch[0], '').trim();
              } else if (isL) {
                amountType = 'LIQUID_LITRE'; rawQtyVal = num; unit = 'l'; hasExplicitUserUnit = true;
                t = t.replace(qtyMatch[0], '').trim();
              } else if (isMl) {
                amountType = 'LIQUID_ML'; rawQtyVal = num; unit = 'ml'; hasExplicitUserUnit = true;
                t = t.replace(qtyMatch[0], '').trim();
              } else if (isDoz) {
                amountType = 'COUNT_DOZEN'; rawQtyVal = num; unit = 'doz'; hasExplicitUserUnit = true;
                t = t.replace(qtyMatch[0], '').trim();
              } else if (isPkt) {
                amountType = 'COUNT_PACKETS'; rawQtyVal = num; unit = 'pkt'; hasExplicitUserUnit = true;
                t = t.replace(qtyMatch[0], '').trim();
              } else if (isPcs) {
                amountType = 'COUNT_PIECES'; rawQtyVal = num; unit = 'pcs'; hasExplicitUserUnit = true;
                t = t.replace(qtyMatch[0], '').trim();
              } else {
                // uStr is part of the product search term (e.g. 20 Eggs, 50 முட்டை)
                rawQtyVal = num;
                const remainingText = (t + ' ' + itemText).toLowerCase();
                const isPieceTerm = /(முட்டை|egg|eggs|பாக்கெட்|packet|packets|pkt|piece|pieces|pcs|பீஸ்|பீசு|பீஸ்கள்|box|bunch|dozen|டஜன்|unit|nos|no)/i.test(remainingText);
                if (isPieceTerm || num < 50) {
                  amountType = 'COUNT_PIECES'; unit = 'pcs';
                  if (isPieceTerm) hasExplicitUserUnit = true;
                } else {
                  amountType = 'WEIGHT_GRAMS'; unit = 'g';
                }
                const numberOnlyRegex = new RegExp('\\b' + num + '\\b', 'i');
                t = t.replace(numberOnlyRegex, '').trim();
              }
            }
          }
        }
      }

      t = t.replace(/[,.:;!?]/g, '').replace(/^க்கு\s*/i, '').replace(/பீஸ்|பீசு|pieces|piece|pcs/gi, '').trim();

      // Deduplicate consecutive repeated words (e.g. "முட்டை முட்டை" -> "முட்டை")
      const words = t.split(/\s+/).filter(Boolean);
      const dedupedWords = [];
      for (let i = 0; i < words.length; i++) {
        if (i === 0 || words[i] !== words[i - 1]) {
          dedupedWords.push(words[i]);
        }
      }
      t = dedupedWords.join(' ');

      return {
        productSearchTerm: t || itemText,
        rawQtyVal: rawQtyVal,
        amountType: amountType,
        unit: unit,
        hasExplicitUserUnit: hasExplicitUserUnit
      };
    }

    // Helper: Normalize spoken Tamil number words to digits
    function normalizeSpokenTamilNumbers(str) {
      if (!str) return '';
      let s = str;
      const numMap = [
        [/இருபது|இருவது|irupathu|iruvathu/gi, '20'],
        [/முப்பது|muppathu/gi, '30'],
        [/நாற்பது|நாப்பது|narpathu|naappathu/gi, '40'],
        [/ஐம்பது|aimpathu/gi, '50'],
        [/அறுபது|arubathu/gi, '60'],
        [/எழுபது|ezhubathu/gi, '70'],
        [/எண்பது|enbathu/gi, '80'],
        [/தொண்ணூறு|thonnooru/gi, '90'],
        [/நூறு|nooru/gi, '100'],
        [/இருநூறு/gi, '200'],
        [/ஐந்நூறு/gi, '500'],
        [/ஆயிரம்/gi, '1000'],
        [/பத்து|pathu/gi, '10'],
        [/இரண்டு|ரெண்டு|ரண்டு|rendu|randu/gi, '2'],
        [/ஒன்று|ஒன்னு|ஒரு|onru|onnu|oru/gi, '1'],
        [/மூன்று|மூனு|moonru|moonu/gi, '3'],
        [/நான்கு|நாலு|naangu|naalu/gi, '4'],
        [/ஐந்து|அஞ்சு|ainthu|anju/gi, '5'],
        [/ஆறு|aaru/gi, '6'],
        [/ஏழு|aelu/gi, '7'],
        [/எட்டு|ettu/gi, '8'],
        [/ஒன்பது|onbathu/gi, '9']
      ];
      numMap.forEach(([rgx, val]) => {
        s = s.replace(rgx, ' ' + val + ' ');
      });
      return s.replace(/\s+/g, ' ').trim();
    }

    // 6. Split Multi-line / WhatsApp / Spoken Continuous Shopping Lists
    function parseLyoCommerceQuery(queryText) {
      if (!queryText || !queryText.trim()) return [];

      let cleanQuery = normalizeSpokenTamilNumbers(queryText.trim());
      // Clean conversational joiners and conjunctions
      cleanQuery = cleanQuery.replace(/\s+(?:மற்றும்|அப்புறம்|கூட|மேலும்|அடுத்து|பின்பு|சேர்த்து|உடன்|and|&|\+)\s+/gi, ', ');
      // Clean numbered or bulleted list prefixes (e.g. "1.", "2)", "3 -", "*", "•")
      cleanQuery = cleanQuery.replace(/(?:^|\n|\r)\s*(?:\d+[\.\)\-]|[\*\•\-])\s*/g, '\n');
      // Clean Tamil conjunction suffixes (e.g. "தக்காளியும் வெங்காயமும்" -> "தக்காளி , வெங்காயம்")
      cleanQuery = cleanQuery.replace(/([^\s,;!?]+)(?:யும்|வும்|உம்)\b/gi, '$1, ');

      // If text contains newlines or commas, do initial line/comma split
      const rawChunks = cleanQuery.replace(/\r/g, '').split(/[\n,;]+/);
      const segmentedChunks = [];

      // Gather product keywords dynamically from dictionary + full active catalog
      const activeDict = (typeof getActiveNluDictionary === 'function')
        ? getActiveNluDictionary()
        : ((typeof EK_BASE_SYNONYMS !== 'undefined') ? EK_BASE_SYNONYMS : {});

      const productKeywords = new Set();
      for (const key in activeDict) {
        if (Array.isArray(activeDict[key])) {
          activeDict[key].forEach(w => {
            const cleanW = String(w || '').trim().toLowerCase();
            if (cleanW.length >= 2) productKeywords.add(cleanW);
          });
        }
      }

      // Dynamically add all active store products from database/cache
      const allCatalogProds = (typeof getData === 'function' ? getData('ek_products', []) : []) || [];
      allCatalogProds.forEach(p => {
        if (!p || p.isActive === false || p.isDeleted === true) return;
        const en = (p.englishName || p.name || '').toLowerCase().trim();
        const ta = (p.tamilName || '').toLowerCase().trim();
        if (en && en.length >= 2) productKeywords.add(en);
        if (ta && ta.length >= 2) productKeywords.add(ta);
        if (Array.isArray(p.aliases)) {
          p.aliases.forEach(a => {
            const aClean = String(a || '').toLowerCase().trim();
            if (aClean && aClean.length >= 2) productKeywords.add(aClean);
          });
        }
      });

      // Add common staples/vegetables to set as guaranteed fallbacks
      ['தக்காளி', 'முட்டை', 'பால்', 'முருங்கைக்காய்', 'முருங்கக்கா', 'வெங்காயம்', 'ஆட்டுக்கறி', 'சிக்கன்', 'மட்டன்'].forEach(k => productKeywords.add(k));

      // Sort longer phrases first to match compound phrases first
      const sortedKeywords = Array.from(productKeywords).sort((a, b) => b.length - a.length);
      const kwRegex = new RegExp('(?:^|[\\s,;!?])(' + sortedKeywords.map(k => k.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|') + ')(?=[\\s,;!?]|$)', 'gi');

      const qtyPattern = /(?:(?:₹|rs\.?|ரூபாய்|ரூபா)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:கிலோ|kg|கிராம்|g|gm|லிட்டர்|litre|l|மி\.லி|ml|ரூபாய்|ரூபாய்க்கு|ரூபா|rs|₹|பீஸ்|பீசு|பீஸ்கள்|pcs|piece|pieces|பாக்கெட்|டஜன்|முட்டை)?|\b(?:அரை|கால்|முக்கால்|ஒன்றரை|half|quarter)\b\s*(?:கிலோ|kg|கிராம்|g|gm|லிட்டர்|litre|l|மி\.லி|ml|ரூபாய்|பீஸ்|பீசு|pieces)?)/gi;

      rawChunks.forEach(chunk => {
        let text = chunk.trim();
        if (!text) return;

        // Locate product token occurrences
        const prodSpans = [];
        let m;
        const scanKwRegex = new RegExp(kwRegex.source, 'gi');
        while ((m = scanKwRegex.exec(text)) !== null) {
          const kw = m[1];
          const idx = m.index + m[0].indexOf(kw);
          prodSpans.push({ name: kw, start: idx, end: idx + kw.length });
        }

        // Deduplicate consecutive product words like "முட்டை 20 முட்டை"
        const uniqueProds = [];
        for (let i = 0; i < prodSpans.length; i++) {
          const cur = prodSpans[i];
          if (uniqueProds.length > 0) {
            const prev = uniqueProds[uniqueProds.length - 1];
            if (prev.name.toLowerCase() === cur.name.toLowerCase() && (cur.start - prev.end) < 25) {
              continue;
            }
          }
          uniqueProds.push(cur);
        }

        if (uniqueProds.length <= 1) {
          segmentedChunks.push(text);
          return;
        }

        // Multi-product segmenting with quantity detachment
        // Initialize pendingPrefix with any quantity preceding the first product
        let pendingPrefix = text.substring(0, uniqueProds[0].start).trim();
        for (let i = 0; i < uniqueProds.length; i++) {
          const cur = uniqueProds[i];
          const next = uniqueProds[i + 1];

          let rawSlice = next ? text.substring(cur.start, next.start) : text.substring(cur.start);
          rawSlice = (pendingPrefix + ' ' + rawSlice).trim();
          pendingPrefix = '';

          if (next) {
            const qtys = [];
            let qm;
            const qScanner = new RegExp(qtyPattern.source, 'gi');
            while ((qm = qScanner.exec(rawSlice)) !== null) {
              qtys.push({ text: qm[0].trim(), start: qm.index, end: qm.index + qm[0].length });
            }

            if (qtys.length >= 2) {
              const lastQty = qtys[qtys.length - 1];
              if (rawSlice.length - lastQty.end <= 15) {
                pendingPrefix = lastQty.text;
                rawSlice = rawSlice.substring(0, lastQty.start).trim();
              }
            }
          }

          if (rawSlice) {
            segmentedChunks.push(rawSlice);
          }
        }

        if (pendingPrefix && segmentedChunks.length > 0) {
          segmentedChunks[segmentedChunks.length - 1] = (pendingPrefix + ' ' + segmentedChunks[segmentedChunks.length - 1]).trim();
        }
      });

      const items = [];
      segmentedChunks.forEach(seg => {
        const parsed = parseSingleItemText(seg);
        if (parsed && parsed.productSearchTerm) {
          items.push(parsed);
        }
      });
      return items;
    }

    // 7. Amount-to-Quantity & Quantity-to-Amount Calculation Engine
    function calculateLyoItemDetails(product, parsedItem) {
      const p = product;
      const unitPrice = Number(p ? (p.pricePerKg || p.sellingPrice || p.price || 40) : 40);
      const dbSellingUnit = p ? (p.sellingUnit || p.unit) : null;
      const baseUnit = String(dbSellingUnit || parsedItem?.unit || 'kg').toLowerCase().trim();
      const isPieceProduct = !isUnitWeight(baseUnit);

      let effectiveAmountType = parsedItem?.amountType || 'WEIGHT_KG';
      let effectiveUnit = parsedItem?.unit || baseUnit;

      const userTextHasExplicitUnit = Boolean(parsedItem?.hasExplicitUserUnit) || ['g', 'gm', 'gram', 'grams', 'kg', 'kilo', 'kilos', 'l', 'litre', 'liter', 'litres', 'ml', 'rs', 'rupees', 'rupee', '₹'].includes(String(parsedItem?.unit || '').toLowerCase().trim());

      // RUPEES amount type takes highest precedence
      if (parsedItem?.amountType === 'RUPEES' || parsedItem?.amountType === 'AMOUNT_RS') {
        effectiveAmountType = 'RUPEES';
      } else if (p) {
        if (isPieceProduct) {
          effectiveAmountType = 'COUNT_PIECES';
          effectiveUnit = dbSellingUnit || 'piece';
        } else if (['litre', 'l', 'liter', 'litres', 'லிட்டர்'].includes(baseUnit)) {
          const userU = String(parsedItem?.unit || '').toLowerCase().trim();
          if (parsedItem?.amountType === 'LIQUID_ML' || userU === 'ml' || userU === 'மி.லி') {
            effectiveAmountType = 'LIQUID_ML';
            effectiveUnit = 'ml';
          } else {
            effectiveAmountType = 'LIQUID_LITRE';
            effectiveUnit = dbSellingUnit || 'Litre';
          }
        } else if (['ml', 'மி.லி'].includes(baseUnit)) {
          effectiveAmountType = 'LIQUID_ML';
          effectiveUnit = dbSellingUnit || 'ml';
        } else if (['g', 'gm', 'gram', 'grams', 'கிராம்'].includes(baseUnit)) {
          effectiveAmountType = 'WEIGHT_GRAMS';
          effectiveUnit = dbSellingUnit || 'g';
        } else {
          const userU = String(parsedItem?.unit || '').toLowerCase().trim();
          if (parsedItem?.amountType === 'WEIGHT_GRAMS' || ['g', 'gm', 'gram', 'grams', 'கிராம்'].includes(userU)) {
            effectiveAmountType = 'WEIGHT_GRAMS';
            effectiveUnit = 'g';
          } else {
            effectiveAmountType = 'WEIGHT_KG';
            effectiveUnit = dbSellingUnit || 'kg';
          }
        }
      }

      let displayQty = '';
      let selectorQty = '';
      let rawQty = parsedItem?.rawQtyVal || 1;
      let itemTotal = unitPrice;

      const isTaLang = (typeof currentLang !== 'undefined' && currentLang === 'ta');
      const safeUnitDisplay = (u, isTa, qty) => {
        if (typeof getUnitDisplay === 'function') return getUnitDisplay(u, isTa, qty);
        if (typeof window !== 'undefined' && typeof window.getUnitDisplay === 'function') return window.getUnitDisplay(u, isTa, qty);
        return u;
      };

      if (isPieceProduct || effectiveAmountType === 'COUNT_PIECES') {
        rawQty = Math.max(1, Math.round(parsedItem?.rawQtyVal || 1));
        const uLabel = safeUnitDisplay(dbSellingUnit || baseUnit, isTaLang, rawQty);
        displayQty = `${rawQty} ${uLabel}`;
        selectorQty = `${rawQty} ${dbSellingUnit || baseUnit}`;
        itemTotal = Math.round(rawQty * unitPrice);
      } else if (effectiveAmountType === 'RUPEES') {
        const rupeeAmount = Math.max(1, parsedItem.rawQtyVal);
        if (baseUnit === 'kg' || baseUnit === 'g') {
          const qtyInKg = rupeeAmount / unitPrice;
          if (qtyInKg < 1) {
            rawQty = Math.round(qtyInKg * 1000);
            displayQty = `${rawQty}g (${qtyInKg.toFixed(2)} Kg)`;
            selectorQty = `${rawQty} g`;
          } else {
            rawQty = Number(qtyInKg.toFixed(2));
            displayQty = `${rawQty} Kg`;
            selectorQty = `${rawQty} kg`;
          }
        } else if (baseUnit === 'litre' || baseUnit === 'l' || baseUnit === 'ml') {
          const qtyInL = rupeeAmount / unitPrice;
          if (qtyInL < 1) {
            rawQty = Math.round(qtyInL * 1000);
            displayQty = `${rawQty} ml (${qtyInL.toFixed(2)} L)`;
            selectorQty = `${rawQty} ml`;
          } else {
            rawQty = Number(qtyInL.toFixed(2));
            displayQty = `${rawQty} L`;
            selectorQty = `${rawQty} L`;
          }
        } else {
          const count = Math.max(1, Math.round(rupeeAmount / unitPrice));
          rawQty = count;
          const uLabel = safeUnitDisplay(dbSellingUnit || baseUnit, isTaLang, count);
          displayQty = `${count} ${uLabel}`;
          selectorQty = `${count} ${dbSellingUnit || baseUnit}`;
        }
        itemTotal = rupeeAmount;
      } else if (effectiveAmountType === 'WEIGHT_GRAMS' || effectiveUnit === 'g' || effectiveUnit === 'gm') {
        rawQty = parsedItem.rawQtyVal || 500;
        const qtyInKg = rawQty / 1000;
        displayQty = `${rawQty}g (${qtyInKg.toFixed(2)} Kg)`;
        selectorQty = `${rawQty} g`;
        itemTotal = Math.round(qtyInKg * unitPrice);
      } else if (effectiveAmountType === 'WEIGHT_KG' || effectiveUnit === 'kg') {
        rawQty = parsedItem.rawQtyVal || 1;
        displayQty = `${rawQty} kg (${Number(rawQty).toFixed(2)} Kg)`;
        selectorQty = `${rawQty} kg`;
        itemTotal = Math.round(rawQty * unitPrice);
      } else if (effectiveAmountType === 'LIQUID_ML' || effectiveUnit === 'ml') {
        rawQty = parsedItem.rawQtyVal || 500;
        const qtyInL = rawQty / 1000;
        displayQty = `${rawQty} ml (${qtyInL.toFixed(2)} L)`;
        selectorQty = `${rawQty} ml`;
        itemTotal = Math.round(qtyInL * unitPrice);
      } else if (effectiveAmountType === 'LIQUID_LITRE' || effectiveUnit === 'l' || effectiveUnit === 'litre') {
        rawQty = parsedItem.rawQtyVal || 1;
        displayQty = `${rawQty} Litre`;
        selectorQty = `${rawQty} L`;
        itemTotal = Math.round(rawQty * unitPrice);
      } else if (effectiveAmountType === 'COUNT_DOZEN' || effectiveUnit === 'doz' || effectiveUnit === 'dozen') {
        const dozens = parsedItem.rawQtyVal || 1;
        rawQty = dozens;
        const uLabel = getUnitDisplay('dozen', isTaLang, dozens);
        displayQty = `${dozens} ${uLabel}`;
        selectorQty = `${dozens} doz`;
        itemTotal = Math.round(dozens * unitPrice);
      } else if (['box', 'bunch', 'bundle', 'tray', 'can', 'tin', 'cup', 'loaf', 'roll', 'set', 'packet', 'piece', 'bottle'].includes(effectiveUnit)) {
        rawQty = Math.max(1, Math.round(parsedItem.rawQtyVal || 1));
        const uLabel = getUnitDisplay(effectiveUnit, isTaLang, rawQty);
        displayQty = `${rawQty} ${uLabel}`;
        selectorQty = `${rawQty} ${effectiveUnit}`;
        itemTotal = Math.round(rawQty * unitPrice);
      } else {
        rawQty = Math.max(1, Math.round(parsedItem.rawQtyVal || 1));
        const uLabel = getUnitDisplay(dbSellingUnit || baseUnit, isTaLang, rawQty);
        displayQty = `${rawQty} ${uLabel}`;
        selectorQty = `${rawQty} ${dbSellingUnit || baseUnit}`;
        itemTotal = Math.round(rawQty * unitPrice);
      }

      return {
        displayQty,
        selectorQty,
        rawQty,
        itemTotal: Math.max(1, itemTotal)
      };
    }

    async function parseOrderWithAI(queryText, activeProducts) {
      if (!queryText || !queryText.trim()) return [];
      const cacheKey = (queryText || '').toLowerCase().trim();
      if (_aiOrderParseCache.has(cacheKey)) {
        const cached = _aiOrderParseCache.get(cacheKey);
        try {
          return JSON.parse(JSON.stringify(cached));
        } catch(e) {
          return cached;
        }
      }

      // 1. Local synonym/alias product dictionary lookup BEFORE calling AI parser
      const localParsed = parseLyoCommerceQuery(queryText);
      if (localParsed && localParsed.length > 0) {
        let allMatchedHighConfidence = true;
        const resolvedLocalItems = [];

        for (const item of localParsed) {
          const match = matchProductWithConfidence(item.productSearchTerm, activeProducts);
          if (match && match.product && (match.score >= 0.70 || (match.score >= 0.60 && item.hasExplicitUserUnit))) {
            resolvedLocalItems.push({
              product_name: match.product.englishName,
              raw_quantity_val: item.rawQtyVal,
              amount_type: item.amountType,
              unit: item.unit,
              hasExplicitUserUnit: item.hasExplicitUserUnit
            });
          } else {
            allMatchedHighConfidence = false;
            break;
          }
        }

        if (allMatchedHighConfidence && resolvedLocalItems.length > 0) {
          _aiOrderParseCache.set(cacheKey, resolvedLocalItems);
          return resolvedLocalItems;
        }
      }
      let { provider, apiKey, model } = getAiProviderConfig();
      if (!apiKey || !apiKey.trim()) {
        apiKey = getBuiltinGeminiApiKey();
        provider = 'gemini';
      }
      const cleanKey = (apiKey || '').trim();
      const cleanModel = (model || '').trim();

      // Pre-filter catalog for AI parser call (scalability for multi-item grocery lists):
      // Include all products with token/substring overlap with user query + top popular products baseline
      const queryTokens = (queryText || '')
        .toLowerCase()
        .replace(/[^\w\s\u0B80-\u0BFF]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 2);

      const filteredAiProducts = (() => {
        if (!activeProducts || activeProducts.length <= 60) return activeProducts || [];
        const matchedSet = new Set();
        const selected = [];

        // 1. Products matching user query terms in English or Tamil or keywords
        activeProducts.forEach(p => {
          const en = (p.englishName || '').toLowerCase();
          const ta = (p.tamilName || '').toLowerCase();
          const pTerms = (p.searchKeywords || []).map(k => String(k).toLowerCase());
          const isMatch = queryTokens.some(token => en.includes(token) || ta.includes(token) || pTerms.some(t => t.includes(token)) || token.includes(en) || token.includes(ta));
          if (isMatch) {
            matchedSet.add(p.id || p.englishName);
            selected.push(p);
          }
        });

        // 2. Baseline popular/frequently ordered products (up to 40) for fallback/vague queries
        const baselinePopular = [...activeProducts]
          .sort((a, b) => (b.orderCount || b.salesCount || b.rating || 0) - (a.orderCount || a.salesCount || a.rating || 0))
          .slice(0, 40);

        baselinePopular.forEach(p => {
          const key = p.id || p.englishName;
          if (!matchedSet.has(key)) {
            matchedSet.add(key);
            selected.push(p);
          }
        });

        return selected.length > 0 ? selected : activeProducts.slice(0, 60);
      })();

      const productCatalogList = filteredAiProducts.map(p => {
        const u = p.sellingUnit || p.unit || 'kg';
        return `- ${p.englishName} (${p.tamilName || ''}): price ${p.pricePerKg || p.price || 0}/${u} [sellingUnit: ${u}]`;
      }).join('\n');
      const systemPrompt = `You are an ultra-fast, production-grade AI Commerce Order Parser for Edappadi Kadai store. Your sole job is to audit and parse customer shopping lists written in Tamil, English, or Tanglish into structured items matching our product catalog.

STRICT CATALOG LIST:
${productCatalogList}

CRITICAL MULTI-ITEM AUDITING MANDATE:
- The customer may request single or multiple items (e.g. 2, 5, 10, or 20+ items in a single message).
- You MUST audit and extract EVERY SINGLE requested product from the user query. Do NOT drop, omit, summarize, or truncate any item.
- Distinctively parse each product with its exact requested quantity, unit, or rupee amount.

EXTRACTION RULES:
1. Product Name: Match closest product from catalog (English or Tamil).
2. Quantities & Units:
   - "அரை" / "arai" / "half" / "1/2" -> raw_quantity_val: 0.5, amount_type: "WEIGHT_KG"
   - "கால்" / "kal" / "quarter" / "1/4" -> raw_quantity_val: 0.25, amount_type: "WEIGHT_KG"
   - "முக்கால்" / "mukkai" / "3/4" -> raw_quantity_val: 0.75, amount_type: "WEIGHT_KG"
   - Grams (e.g. "500g", "500gm", "250g") -> raw_quantity_val: 500, amount_type: "WEIGHT_GRAMS"
   - Kilograms / Litres (e.g. "1kg", "2 Litre") -> raw_quantity_val: 1, amount_type: "WEIGHT_KG"
   - Count (e.g. "30 eggs", "50 முட்டை", "2 packets", "5 pcs") -> raw_quantity_val: 30, amount_type: "COUNT_PIECES"
3. DETERMINISTIC SELLING UNIT RULE FOR PIECE/PACKET/BOX/BUNCH/UNIT/DOZEN ITEMS:
   - Check each matched product's sellingUnit in the catalog list above.
   - If the matched product's sellingUnit is piece, pcs, packet, pkt, box, bunch, dozen, or unit (e.g. Eggs/முட்டை, Packets/பாக்கெட்):
     ALWAYS use amount_type "COUNT_PIECES" for any bare number referring to that product (e.g. "50 முட்டை", "30 eggs", "21 egg", "1.5 Litre பால் 50 முட்டை" -> for egg/முட்டை, 50 means 50 pieces -> raw_quantity_val: 50, amount_type: "COUNT_PIECES"), REGARDLESS of Tamil or English phrasing or whether there are weight items in the same list, UNLESS the customer explicitly specified a weight unit like kg/g/litre for it.
4. Price / Amount-based requests ("₹20 tomato", "20 rs tomato", "100 rupees mutton", "50 ரூபாய் தக்காளி"):
   - raw_quantity_val: <rupee_amount_number>
   - amount_type: "RUPEES"
5. Multiline or WhatsApp lists: Extract EVERY item individually.

OUTPUT FORMAT:
Return ONLY a JSON array of objects. Do NOT include markdown blocks or commentary.
[
  {
    "product_name": "<matched catalog product name>",
    "raw_quantity_val": <number>,
    "amount_type": "WEIGHT_KG" | "WEIGHT_GRAMS" | "COUNT_PIECES" | "RUPEES"
  }
]`;

      let rawText = "";
      try {
        if (cleanKey) {
          const geminiModels = [
            cleanModel || 'gemini-2.5-flash',
            'gemini-flash-latest',
            'gemini-3.1-flash-lite-preview',
            'gemini-3.5-flash'
          ];
          for (const m of geminiModels) {
            try {
              const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${cleanKey}`;
              const response = await fetchWithTimeoutAndRetry(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: systemPrompt }] },
                  contents: [{ role: 'user', parts: [{ text: queryText }] }],
                  generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
                })
              }, 1, 5000);
              if (response.ok) {
                const data = await response.json();
                rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (rawText) {
                  break;
                }
              }
            } catch (mErr) {
              console.warn(`Gemini model ${m} failed, trying next...`, mErr);
            }
          }
        } else {
          // Use server-side Cloud Function proxy if no client-side custom key is provided
          const aiCloudFn = typeof getCloudFunction === 'function' ? getCloudFunction('generateAiResponse') : null;
          if (aiCloudFn) {
            try {
              const res = await aiCloudFn({
                prompt: queryText,
                systemInstruction: systemPrompt,
                contents: [{ role: 'user', parts: [{ text: queryText }] }],
                responseMimeType: "application/json",
                provider: 'gemini'
              });
              if (res && res.data && res.data.text) {
                rawText = res.data.text;
              }
            } catch (cfErr) {
              console.warn("parseOrderWithAI Cloud Function proxy call failed:", cfErr.message || cfErr);
            }
          }
        }
        if (!rawText) {
          try {
            const aiRes = await callAIProvider(systemPrompt, [{ role: 'user', parts: [{ text: queryText }] }], queryText);
            if (aiRes && aiRes.text) {
              rawText = aiRes.text;
            }
          } catch (callErr) {
            console.warn("parseOrderWithAI fallback call skipped/failed:", callErr.message);
          }
        }
        if (rawText) {
          const cleanJsonStr = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          let parsed = JSON.parse(cleanJsonStr);
          if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.items)) {
            parsed = parsed.items;
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            _aiOrderParseCache.set(cacheKey, parsed);
            return parsed;
          }
        }
      } catch (err) {
        console.warn("AI parseOrderWithAI graceful fallback to local NLP engine:", err);
      }

      return parseLyoCommerceQuery(queryText);
    }

    function getLyoAiAvatarHtml(isTyping = false) {
      const pulseCss = isTyping
        ? 'animation: lyoAvatarPulseGlow 2.2s infinite ease-in-out;'
        : 'box-shadow: 0 2px 6px rgba(16,185,129,0.3);';
      return `<div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #10b981 0%, #f59e0b 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; border: 1px solid rgba(255,255,255,0.25); ${pulseCss}"><span style="font-size: 13px; user-select: none;">✨</span></div>`;
    }

    
// ====================================================================
// INTENT CLASSIFICATION ENGINE (PRODUCTION-GRADE MULTI-LAYER INTENT FILTER)
// ====================================================================

const LYO_INTENTS = {
  SHOPPING_REQUEST: "SHOPPING_REQUEST",
  PRODUCT_SEARCH: "PRODUCT_SEARCH",
  PRODUCT_RECOMMENDATION: "PRODUCT_RECOMMENDATION",
  ORDER_TRACKING: "ORDER_TRACKING",
  ORDER_STATUS: "ORDER_STATUS",
  WALLET_POINTS: "WALLET_POINTS",
  CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
  APPLICATION_FEATURES: "APPLICATION_FEATURES",
  AI_QUESTIONS: "AI_QUESTIONS",
  GENERAL_QUESTIONS: "GENERAL_QUESTIONS",
  HELP: "HELP",
  GREETINGS: "GREETINGS",
  SETTINGS: "SETTINGS",
  ACCOUNT: "ACCOUNT",
  COUPONS: "COUPONS",
  DELIVERY: "DELIVERY",
  RESTAURANT_INFO: "RESTAURANT_INFO",
  NAVIGATION: "NAVIGATION",
  FEEDBACK: "FEEDBACK"
};

function buildIntentSystemPrompt(productCatalogList = "") {
  return `You are the Intent Classification Engine for Lyo AI Commerce at Edappadi Kadai store.
Your sole job is to analyze user messages written in Tamil, English, or Tanglish and classify them into EXACT INTENTS BEFORE any shopping operations execute.

STRICT INTENT CATEGORIES:
- SHOPPING_REQUEST: User is explicitly ordering items, adding products to cart, or providing a shopping list with quantities/weights/amounts to buy (e.g., "500g Chicken", "2kg Tomatoes", "Add 2 Mutton", "buy eggs", "100 rupees chicken", "1kg arisi", "30 muttai", "தக்காளி 2 கிலோ போடு").
- WALLET_POINTS: User is asking about their wallet, loyalty points, wallet balance, cash balance, loyalty rewards (e.g., "என் வாலட்", "வாலட் பேலன்ஸ்", "பாயிண்ட்ஸ் எவ்வளவு", "my wallet balance", "how many points", "wallet status", "wallet points", "என் வாலெட்").
- ORDER_TRACKING: Asking where their order is, tracking active order, order status, order delivery time (e.g., "Where is my order?", "Order status", "When will my delivery arrive?", "ஆர்டர் எங்கே?", "ஆர்டர் நிலை", "என்னுடைய ஆர்டர்", "my order status").
- ORDER_STATUS: Asking status of order (same as ORDER_TRACKING).
- PRODUCT_SEARCH: Asking if a product is available, inquiring about prices or stock without explicitly adding to cart (e.g., "Do you have fresh fish?", "Is mutton available?", "Do you sell milk?").
- PRODUCT_RECOMMENDATION: Asking for recommendations, top items, suggestions (e.g., "What is good today?", "Suggest meat for biryani", "What are best sellers?").
- CUSTOMER_SUPPORT: Asking for support, phone number, help, reporting an issue (e.g., "Customer care number", "I need help", "How to contact support?").
- APPLICATION_FEATURES: Asking about features of this application, how app works (e.g., "What are the features of this application?", "What can this app do?", "How to use this app?").
- AI_QUESTIONS: Asking about Lyo AI, who built it, what AI does (e.g., "What is Lyo AI?", "Tell me about your AI", "Who are you?", "Are you AI?").
- GREETINGS: Hello, hi, good morning, வணக்கம், greetings (e.g., "Good morning", "Hi Lyo", "வணக்கம்").
- SETTINGS: Profile, address, password, account settings (e.g., "How to change address?", "My profile", "Account settings").
- ACCOUNT: Account profile questions (same as SETTINGS).
- COUPONS: Offer codes, discounts, promo codes (e.g., "Any discount coupons?", "Promo codes", "Offer details").
- DELIVERY: Delivery charges, zones, timings, free delivery threshold (e.g., "What is delivery fee?", "Do you deliver to Salem?", "Delivery charges").
- RESTAURANT_INFO: Store location, shop timing, open status, address (e.g., "Is shop open?", "Where is Edappadi Kadai located?", "Store hours").
- NAVIGATION: Asking to go to a screen (e.g., "Open cart", "Take me to tracking", "Show home screen").
- FEEDBACK: App feedback, ratings, complaints.
- GENERAL_QUESTIONS: Any other general question or conversation.

CRITICAL DIRECTIVES:
1. NEVER classify a question or status inquiry ("where is my order", "ஆர்டர் எங்கே", "ஆர்டர் நிலை", "என் வாலட்", "வாலட் பேலன்ஸ்", "wallet balance", "what is Lyo AI", "do you have...") as SHOPPING_REQUEST.
2. If the user asks about wallet, points, or balance, classify ONLY as WALLET_POINTS.
3. If the user asks about order status or tracking, classify ONLY as ORDER_TRACKING.
4. ONLY classify as SHOPPING_REQUEST if the user is explicitly placing an order, adding items to cart, or providing item quantities/units to purchase.

JSON OUTPUT FORMAT (JSON ONLY, NO MARKDOWN):
{
  "intent": "<ONE_OF_THE_ABOVE_INTENTS>",
  "confidence": 0.98,
  "responseText": "<Friendly conversational answer in Tamil and English answering the query>",
  "action": null | "OPEN_ORDER_TRACKER" | "NAVIGATE_PROFILE" | "SHOW_COUPONS" | "SHOW_CATALOG"
}`;
}

async function classifyLyoUserIntent(queryText, activeProducts) {
  if (!queryText || !queryText.trim()) {
    return { intent: "GREETINGS", confidence: 1.0, responseText: "வணக்கம்! Good day! 🌸 How can I help you today?" };
  }

  const lowerQ = queryText.toLowerCase().trim();

  // Instant Check: Wallet / Loyalty Points Inquiry
  const isExplicitWalletQuery = (
    lowerQ.includes("wallet") || lowerQ.includes("வாலட்") || lowerQ.includes("வாலெட்") ||
    lowerQ.includes("points") || lowerQ.includes("புள்ளிகள்") || lowerQ.includes("பாயிண்ட்") ||
    lowerQ.includes("loyalty") || lowerQ.includes("என் பேலன்ஸ்") || lowerQ.includes("balance") ||
    lowerQ.includes("என் வாலட்") || lowerQ.includes("என் வாலெட்") || lowerQ.includes("வாலட் பணம்") ||
    lowerQ.includes("வாலட் இருப்பு") || lowerQ.includes("my wallet") || lowerQ.includes("wallet balance")
  );

  // Instant Check: Order Status / Tracking Inquiry
  const isExplicitOrderTrackingQuery = (
    lowerQ.includes("where is my order") || lowerQ.includes("track order") || lowerQ.includes("order status") ||
    lowerQ.includes("my order") || lowerQ.includes("where is order") || lowerQ.includes("track my order") ||
    lowerQ.includes("order tracking") || lowerQ.includes("order details") ||
    lowerQ.includes("ஆர்டர் எங்கே") || lowerQ.includes("ஆர்டர் எங்க") || lowerQ.includes("ஆர்டர் எங்கு") ||
    lowerQ.includes("ஆர்டர் நிலை") || lowerQ.includes("ஆர்டர் நிலவரம்") || lowerQ.includes("ஆர்டர் ஸ்டேட்டஸ்") ||
    lowerQ.includes("ஆர்டர் விவரம்") || lowerQ.includes("ஆர்டர் என்ன ஆச்சு") || lowerQ.includes("ஆர்டர் எப்போ வரும்") ||
    lowerQ.includes("என் ஆர்டர்") || lowerQ.includes("என்னுடைய ஆர்டர்") || lowerQ.includes("ஆடர் நிலை") ||
    lowerQ.includes("ஆடர் எங்கே") || lowerQ.includes("ஆடர் எங்க") ||
    lowerQ.includes("டெலிவரி எப்போது") || lowerQ.includes("டிராக்") || lowerQ.includes("டிராக்கிங்") ||
    lowerQ.includes("ஆர்டரை டிராக்") || lowerQ.includes("when will my order")
  );

  // Instant Check: Coupons / Offers Inquiry
  const isExplicitCouponQuery = (
    lowerQ.includes("coupon") || lowerQ.includes("coupons") || lowerQ.includes("கூப்பன்") ||
    lowerQ.includes("கூப்பட") || lowerQ.includes("கூப்பன்கள்") || lowerQ.includes("கூப்பன்கள்னு") ||
    lowerQ.includes("சலுகை") || lowerQ.includes("ஆஃபர்") || lowerQ.includes("offer") ||
    lowerQ.includes("offers") || lowerQ.includes("discount") || lowerQ.includes("தள்ளுபடி") ||
    lowerQ.includes("promo") || lowerQ.includes("இன்றைய கூப்பன்") || lowerQ.includes("இன்றைய ஆஃபர்")
  );

  if (isExplicitWalletQuery) {
    return { intent: "WALLET_POINTS", confidence: 1.0 };
  }

  if (isExplicitOrderTrackingQuery) {
    return { intent: "ORDER_TRACKING", confidence: 1.0 };
  }

  if (isExplicitCouponQuery) {
    return { intent: "COUPONS", confidence: 1.0 };
  }

  const isExplicitNonShopping = (
    lowerQ.includes("store location") || lowerQ.includes("shop open") || lowerQ.includes("shop timing") ||
    lowerQ.includes("what is lyo") || lowerQ.includes("who are you") || lowerQ.includes("app feature") ||
    lowerQ.includes("customer care") || lowerQ.includes("coupon") || lowerQ.includes("coupons") ||
    lowerQ.includes("கூப்பன்") || lowerQ.includes("கூப்பட") || lowerQ.includes("சலுகை") ||
    lowerQ.includes("offer") || lowerQ.includes("delivery fee") || lowerQ.includes("டெலிவரி கட்டணம்") ||
    lowerQ.includes("help") || lowerQ.includes("உதவி") || lowerQ.includes("whatsapp") || lowerQ.includes("வாட்ஸ்அப்")
  );

  const hasNumbersOrUnits = /(\d+|இருபது|பத்து|ஐம்பது|நூறு|இரண்டு|ரெண்டு|ரண்டு|ஒன்று|ஒன்னு|மூன்று|மூனு|நான்கு|நாலு|ஐந்து|அஞ்சு|ஆறு|ஏழு|எட்டு|ஒன்பது|kg|kilo|கிலோ|g|gm|gram|கிராம்|l|litre|லிட்டர்|ml|pcs|piece|pieces|பீஸ்|பாக்கெட்|pkt|rupees|rs|ரூபாய்|₹)/i.test(lowerQ);
  const foodKeywords = ['head curry', 'thalaikkari', 'தலைக்கறி', 'ஆட்டுத்தலை', 'ஆட்டு', 'கறி', 'curry', 'meat', 'potato', 'urulai', 'உருளைக்கிழங்கு', 'தக்காளி', 'வெங்காயம்', 'சிக்கன்', 'மட்டன்', 'முட்டை', 'பால்', 'நெய்', 'மீன்', 'ஈரல்', 'chicken', 'mutton', 'fish', 'egg', 'eggs', 'milk', 'tomato', 'onion', 'ghee', 'oil', 'paneer'];
  const hasFoodKeyword = foodKeywords.some(k => lowerQ.includes(k));
  const activeProposalExists = !!(typeof getActiveLyoProposalMsg === 'function' && getActiveLyoProposalMsg());

  if (!isExplicitNonShopping && (hasNumbersOrUnits || hasFoodKeyword || activeProposalExists)) {
    return { intent: "SHOPPING_REQUEST", confidence: 0.98 };
  }

  try {
    const catalogSummary = (activeProducts || []).slice(0, 15).map(p => `- ${p.englishName} (${p.tamilName || ''})`).join('\n');
    const systemPrompt = buildIntentSystemPrompt(catalogSummary);
    const aiRes = await callAIProvider(
      systemPrompt,
      [{ role: 'user', parts: [{ text: queryText }] }],
      queryText
    );

    if (aiRes && aiRes.text) {
      const cleanJsonStr = aiRes.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);
      if (parsed && parsed.intent) {
        const uppercaseIntent = String(parsed.intent).toUpperCase().trim();
        if (LYO_INTENTS[uppercaseIntent]) {
          return {
            intent: uppercaseIntent,
            confidence: parsed.confidence || 0.95,
            responseText: parsed.responseText || '',
            action: parsed.action || null
          };
        }
      }
    }
  } catch (err) {
    console.warn("[Lyo AI Intent] AI classification call failed, falling back to local semantic classifier:", err);
  }

  return classifyUserIntentFallback(queryText, activeProducts);
}

function classifyUserIntentFallback(queryText, activeProducts = []) {
  if (!queryText) return { intent: "GREETINGS", confidence: 0.9 };
  const q = queryText.toLowerCase().trim();

  // 1. Wallet / Loyalty Points / Balance (Priority Check)
  if (
    q.includes("wallet") || q.includes("points") || q.includes("வாலட்") || q.includes("வாலெட்") ||
    q.includes("புள்ளிகள்") || q.includes("loyalty") || q.includes("பாயிண்ட்") || q.includes("என் பேலன்ஸ்") ||
    q.includes("balance") || q.includes("என் வாலட்") || q.includes("என் வாலெட்") || q.includes("வாலட் பணம்") ||
    q.includes("வாலட் இருப்பு") || q.includes("my wallet") || q.includes("wallet balance")
  ) {
    return { intent: "WALLET_POINTS", confidence: 0.99 };
  }

  // 2. Order Tracking / Order Status (Priority Check)
  if (
    q.includes("where is my order") || q.includes("track order") || q.includes("order status") ||
    q.includes("my order") || q.includes("where is order") || q.includes("order tracking") ||
    q.includes("order details") ||
    q.includes("ஆர்டர் எங்கே") || q.includes("ஆர்டர் எங்க") || q.includes("ஆர்டர் எங்கு") ||
    q.includes("ஆர்டர் நிலை") || q.includes("ஆர்டர் நிலவரம்") || q.includes("ஆர்டர் ஸ்டேட்டஸ்") ||
    q.includes("ஆர்டர் விவரம்") || q.includes("ஆர்டர் என்ன ஆச்சு") || q.includes("ஆர்டர் எப்போ வரும்") ||
    q.includes("என் ஆர்டர்") || q.includes("என்னுடைய ஆர்டர்") || q.includes("ஆடர் நிலை") ||
    q.includes("ஆடர் எங்கே") || q.includes("ஆடர் எங்க") ||
    q.includes("டெலிவரி எப்போது") || q.includes("டிராக்") || q.includes("டிராக்கிங்") ||
    q.includes("ஆர்டரை டிராக்") || q.includes("track my order") || q.includes("when will my order")
  ) {
    return { intent: "ORDER_TRACKING", confidence: 0.99 };
  }

  // 3. Application Features
  if (
    q.includes("feature") || q.includes("features") || q.includes("app feature") ||
    q.includes("application feature") || q.includes("what can this app") || q.includes("how app works") ||
    q.includes("how does this app") || q.includes("about app") || q.includes("பயன்கள்") ||
    q.includes("வசதிகள்") || q.includes("செயலியின் வசதிகள்")
  ) {
    return { intent: "APPLICATION_FEATURES", confidence: 0.98 };
  }

  // 4. AI Questions
  if (
    q.includes("lyo ai") || q.includes("what is lyo") || q.includes("about lyo") ||
    q.includes("who are you") || q.includes("your ai") || q.includes("tell me about your ai") ||
    q.includes("tell me about ai") || q.includes("what is your ai") || q.includes("are you ai") ||
    q.includes("lyo பற்றி") || q.includes("ஏஐ பற்றி")
  ) {
    return { intent: "AI_QUESTIONS", confidence: 0.98 };
  }

  // 5. Greetings
  if (
    q === "hi" || q === "hello" || q === "hey" || q.includes("good morning") ||
    q.includes("good afternoon") || q.includes("good evening") || q.includes("vanakkam") ||
    q.includes("வணக்கம்") || q === "hi lyo" || q === "hello lyo"
  ) {
    return { intent: "GREETINGS", confidence: 0.95 };
  }

  // 6. Customer Support / Help
  if (
    q.includes("customer care") || q.includes("customer support") || q.includes("help") ||
    q.includes("contact") || q.includes("phone number") || q.includes("call support") ||
    q.includes("உதவி") || q.includes("தொடர்பு")
  ) {
    return { intent: "CUSTOMER_SUPPORT", confidence: 0.95 };
  }

  // 7. Recipe / Cooking Ingredients
  if (
    q.includes("recipe") || q.includes("biryani") || q.includes("briyani") || q.includes("பிரியாணி") ||
    q.includes("குழம்பு") || q.includes("curry") || q.includes("sukka") || q.includes("சுக்கா") ||
    q.includes("வறுவல்") || q.includes("fry") || q.includes("gravy") || q.includes("ingredients") ||
    q.includes("தேவையான பொருட்கள்") || q.includes("சமையல்") || q.includes("செய்ய பொருட்கள்")
  ) {
    return { intent: "RECIPE_QUERY", confidence: 0.96 };
  }

  // 8. Live Price Check
  if (
    q.includes("விலை என்ன") || q.includes("எவ்வளவு விலை") || q.includes("என்ன ரேட்") ||
    q.includes("விலை விவரம்") || q.includes("price of") || q.includes("rate of") || q.includes("cost of")
  ) {
    return { intent: "PRICE_CHECK", confidence: 0.95 };
  }

  // 5d. WhatsApp Store Support
  if (
    q.includes("whatsapp") || q.includes("வாட்ஸ்அப்") || q.includes("வாட்ஸ்அப் உதவி")
  ) {
    return { intent: "WHATSAPP_SUPPORT", confidence: 0.96 };
  }

  // 6. Coupons / Offers
  if (
    q.includes("coupon") || q.includes("coupons") || q.includes("offer") ||
    q.includes("offers") || q.includes("discount") || q.includes("promo") || q.includes("promo code") ||
    q.includes("கூப்பன்") || q.includes("கூப்பட") || q.includes("கூப்பன்கள்") ||
    q.includes("கூப்பன்கள்னு") || q.includes("சலுகை") || q.includes("ஆஃபர்") || q.includes("தள்ளுபடி")
  ) {
    return { intent: "COUPONS", confidence: 0.99 };
  }

  // 7. Delivery Info
  if (
    q.includes("delivery fee") || q.includes("delivery charge") || q.includes("delivery time") ||
    q.includes("shipping fee") || q.includes("டெலிவரி கட்டணம்") || q.includes("டெலிவரி நேரம்")
  ) {
    return { intent: "DELIVERY", confidence: 0.95 };
  }

  // 8. Restaurant / Store Info
  if (
    q.includes("shop open") || q.includes("store timing") || q.includes("opening hours") ||
    q.includes("where is shop") || q.includes("where is store") || q.includes("store location") ||
    q.includes("shop address") || q.includes("store address") || q.includes("location of store") ||
    q.includes("கடை நேரம்") || q.includes("கடை எங்கிருக்கு") || q.includes("முகவரி") ||
    q.includes("where is the store") || q.includes("where is store located")
  ) {
    return { intent: "RESTAURANT_INFO", confidence: 0.95 };
  }

  // 9. Product Search / Inquiries
  if (
    q.includes("do you have") || q.includes("is available") || q.includes("do you sell") ||
    q.includes("price of") || q.includes("cost of") || q.includes("இருக்கா") ||
    q.includes("கிடைக்குமா") || q.includes("விலை என்ன")
  ) {
    return { intent: "PRODUCT_SEARCH", confidence: 0.90 };
  }

  // 10. Product Recommendation
  if (
    q.includes("recommend") || q.includes("suggestion") || q.includes("best item") ||
    q.includes("what should i buy") || q.includes("top selling") || q.includes("சிறந்த")
  ) {
    return { intent: "PRODUCT_RECOMMENDATION", confidence: 0.90 };
  }

  // 11. Settings / Account
  if (
    q.includes("my profile") || q.includes("account settings") || q.includes("change address") ||
    q.includes("my address") || q.includes("சுயவிவரம்") || q.includes("அமைப்புகள்")
  ) {
    return { intent: "SETTINGS", confidence: 0.95 };
  }

  // 12. Explicit Shopping Request Detection
  const hasNumbersOrUnits = /(\d+|இருபது|பத்து|ஐம்பது|நூறு|இரண்டு|ரெண்டு|ரண்டு|ஒன்று|ஒன்னு|மூன்று|மூனு|நான்கு|நாலு|ஐந்து|அஞ்சு|ஆறு|ஏழு|எட்டு|ஒன்பது|kg|kilo|கிலோ|g|gm|gram|கிராம்|l|litre|லிட்டர்|ml|pcs|piece|pieces|பீஸ்|பீசு|பாக்கெட்|pkt|rupees|rs|ரூபாய்|ரூபாய்க்கு|ரூபா|₹)/i.test(q);
  const shoppingVerbs = /(add|buy|order|want|need|send|put|போடு|வாங்கு|வேணும்|வேண்டும்|சேர்)/i.test(q);

  const matchesCatalog = (activeProducts || []).some(p => {
    const en = (p.englishName || '').toLowerCase();
    const ta = (p.tamilName || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const cleanQ = q.replace(/[0-9,\.:;!?]/g, '').trim();
    if (!cleanQ) return false;
    const tokens = cleanQ.split(/\s+/).filter(w => w.length > 1);
    return tokens.some(tok => en.includes(tok) || ta.includes(tok) || cat.includes(tok) || q.includes(en) || q.includes(ta));
  });

  const foodKeywords = ['head curry', 'thalaikkari', 'தலைக்கறி', 'ஆட்டுத்தலை', 'ஆட்டு', 'கறி', 'curry', 'meat', 'potato', 'urulai', 'உருளைக்கிழங்கு', 'தக்காளி', 'வெங்காயம்', 'சிக்கன்', 'மட்டன்', 'முட்டை', 'பால்', 'நெய்', 'மீன்', 'ஈரல்', 'chicken', 'mutton', 'fish', 'egg', 'milk', 'tomato', 'onion', 'ghee', 'oil', 'paneer'];
  const hasFoodKeyword = foodKeywords.some(k => q.includes(k));

  if (hasNumbersOrUnits || shoppingVerbs || matchesCatalog || hasFoodKeyword) {
    return { intent: "SHOPPING_REQUEST", confidence: 0.98 };
  }

  return { intent: "GENERAL_QUESTIONS", confidence: 0.80 };
}

const LYO_RECIPE_BUNDLES = {
  chicken_biryani: {
    nameTa: "சிக்கன் பிரியாணி செய்முறை தொகுப்பு",
    nameEn: "Chicken Biryani Recipe Bundle",
    items: [
      { query: "சிக்கன்", qty: 1, unit: "kg" },
      { query: "வெங்காயம்", qty: 0.5, unit: "kg" },
      { query: "தக்காளி", qty: 0.5, unit: "kg" },
      { query: "முட்டை", qty: 4, unit: "piece" }
    ]
  },
  mutton_sukka: {
    nameTa: "மட்டன் சுக்கா செய்முறை தொகுப்பு",
    nameEn: "Mutton Sukka Recipe Bundle",
    items: [
      { query: "மட்டன்", qty: 0.5, unit: "kg" },
      { query: "வெங்காயம்", qty: 0.5, unit: "kg" }
    ]
  },
  chicken_curry: {
    nameTa: "சிக்கன் குழம்பு செய்முறை தொகுப்பு",
    nameEn: "Chicken Curry Recipe Bundle",
    items: [
      { query: "சிக்கன்", qty: 1, unit: "kg" },
      { query: "வெங்காயம்", qty: 0.5, unit: "kg" },
      { query: "தக்காளி", qty: 0.5, unit: "kg" }
    ]
  },
  fish_curry: {
    nameTa: "மீன் குழம்பு செய்முறை தொகுப்பு",
    nameEn: "Fish Curry Recipe Bundle",
    items: [
      { query: "மீன்", qty: 0.5, unit: "kg" },
      { query: "தக்காளி", qty: 0.5, unit: "kg" },
      { query: "வெங்காயம்", qty: 0.25, unit: "kg" }
    ]
  },
  egg_curry: {
    nameTa: "முட்டை மசாலா / குழம்பு தொகுப்பு",
    nameEn: "Egg Curry Recipe Bundle",
    items: [
      { query: "முட்டை", qty: 6, unit: "piece" },
      { query: "வெங்காயம்", qty: 0.5, unit: "kg" },
      { query: "தக்காளி", qty: 0.5, unit: "kg" }
    ]
  }
};

window.addRecipeBundleToLyoCart = function(recipeKey) {
  const bundle = LYO_RECIPE_BUNDLES[recipeKey];
  if (!bundle) return;
  const activeProducts = (typeof getData === 'function') ? getData('ek_products', []) : [];
  let activeProposalMsg = (typeof getActiveLyoProposalMsg === 'function') ? getActiveLyoProposalMsg() : null;
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!activeProposalMsg) {
    const proposalId = 'prop_' + Date.now();
    activeProposalMsg = {
      id: 'msg_a_' + Date.now(),
      role: 'assistant',
      isProposal: true,
      text: '',
      time: nowStr,
      proposalId: proposalId,
      items: [],
      deliveryCharge: (typeof computeLyoDeliveryCharge === 'function') ? computeLyoDeliveryCharge(0, []) : 15,
      deliveryZone: 'Edappadi Mini Ward (Town Core)',
      isTyping: false
    };
    if (typeof _lyoChatMessages !== 'undefined') {
      _lyoChatMessages.push(activeProposalMsg);
    }
  }

  let addedNames = [];

  bundle.items.forEach(bItem => {
    const matchResult = (typeof matchProductWithConfidence === 'function') ? matchProductWithConfidence(bItem.query, activeProducts) : null;
    if (matchResult && matchResult.product) {
      const prod = matchResult.product;
      const realSellingUnit = String(prod.sellingUnit || prod.unit || bItem.unit || 'kg').toLowerCase().trim();
      const isPieceProduct = !(typeof isUnitWeight === 'function' ? isUnitWeight(realSellingUnit) : realSellingUnit.includes('kg') || realSellingUnit.includes('g'));

      const calcInput = {
        rawQtyVal: bItem.qty,
        amountType: isPieceProduct ? 'COUNT_PIECES' : (bItem.unit === 'g' ? 'WEIGHT_GRAMS' : 'WEIGHT_KG'),
        unit: realSellingUnit
      };
      const details = (typeof calculateLyoItemDetails === 'function') ? calculateLyoItemDetails(prod, calcInput) : {
        displayQty: `${bItem.qty} ${realSellingUnit}`,
        selectorQty: `${bItem.qty} ${realSellingUnit}`,
        rawQty: bItem.qty,
        itemTotal: Math.round(Number(prod.pricePerKg || prod.price || 50) * bItem.qty)
      };

      const existingItem = activeProposalMsg.items.find(it => it.productId === prod.id);
      if (existingItem) {
        existingItem.rawQty = (existingItem.rawQty || 0) + details.rawQty;
        existingItem.itemTotal = (existingItem.itemTotal || 0) + details.itemTotal;
        existingItem.displayQty = `${existingItem.rawQty} ${realSellingUnit}`;
        existingItem.selectorQty = existingItem.displayQty;
      } else {
        activeProposalMsg.items.push({
          id: 'it_' + prod.id + '_' + Date.now(),
          productId: prod.id,
          name: prod.englishName || prod.name,
          tamilName: prod.tamilName || '',
          displayQty: details.displayQty,
          selectorQty: details.selectorQty,
          rawQty: details.rawQty,
          unit: realSellingUnit,
          itemTotal: details.itemTotal,
          unitPrice: Number(prod.pricePerKg || prod.sellingPrice || prod.price || 40),
          price: Number(prod.pricePerKg || prod.sellingPrice || prod.price || 40),
          imageUrl: prod.imageUrl || prod.image || '',
          isFreeDeliveryEligible: prod.isFreeDeliveryEligible === true
        });
      }
      addedNames.push(`• **${prod.tamilName || prod.englishName}** (${details.displayQty} - ₹${details.itemTotal})`);
    }
  });

  const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
  const bTitle = isTa ? bundle.nameTa : bundle.nameEn;
  activeProposalMsg.text = `🎉 **${bTitle}** கார்ட்டில் சேர்க்கப்பட்டது! 🥩🥦\n\n${addedNames.join('\n')}\n\nசெக்-அவுட் செய்ய கீழேயுள்ள **Place Order** பொத்தானை அழுத்தவும்!`;

  if (typeof syncLyoToManualCart === 'function') syncLyoToManualCart();
  if (typeof persistLyoChatMessages === 'function') persistLyoChatMessages();
  if (typeof renderLyoAiChat === 'function') renderLyoAiChat();
  if (typeof updateLyoDraftCartBar === 'function') updateLyoDraftCartBar();
  if (typeof updateCartBadge === 'function') updateCartBadge();
  if (typeof updateCartUI === 'function') updateCartUI();

  const chatContainer = document.getElementById('lyo-ai-messages');
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  if (typeof showToast === 'function') {
    showToast(`🎉 ${bTitle} சேர்க்கப்பட்டது!`, 'success');
  }
};

function getNonShoppingResponse(intent, queryText, aiResponseText, activeProducts = []) {
  let text = aiResponseText || "";
  let actionHtml = "";

  switch (intent) {
    case "RECIPE_QUERY": {
      const q = (queryText || '').toLowerCase();
      let selectedBundleKey = "chicken_biryani";
      let recipeTitle = "சிக்கன் பிரியாணி (Chicken Biryani)";
      if (q.includes("மட்டன்") || q.includes("mutton") || q.includes("sukka") || q.includes("சுக்கா")) {
        selectedBundleKey = "mutton_sukka";
        recipeTitle = "மட்டன் சுக்கா (Mutton Sukka)";
      } else if (q.includes("மீன்") || q.includes("fish")) {
        selectedBundleKey = "fish_curry";
        recipeTitle = "மீன் குழம்பு (Fish Curry)";
      } else if (q.includes("முட்டை") || q.includes("egg")) {
        selectedBundleKey = "egg_curry";
        recipeTitle = "முட்டை மசாலா / குழம்பு (Egg Curry)";
      } else if (q.includes("சிக்கன் குழம்பு") || q.includes("chicken curry") || q.includes("gravy")) {
        selectedBundleKey = "chicken_curry";
        recipeTitle = "சிக்கன் குழம்பு (Chicken Curry)";
      }

      const bundle = LYO_RECIPE_BUNDLES[selectedBundleKey];
      const itemsList = bundle.items.map(bi => {
        const matched = (activeProducts || []).find(p => (p.englishName + ' ' + (p.tamilName||'')).toLowerCase().includes(bi.query.toLowerCase()));
        const pPrice = matched ? `₹${matched.pricePerKg || matched.price}/${matched.unit || 'kg'}` : '';
        return `• **${bi.query}** (${bi.qty} ${bi.unit}) ${pPrice ? `- ${pPrice}` : ''}`;
      }).join('\n');

      text = text || `🍲 **${recipeTitle} செய்ய தேவையான பொருட்கள் (Fresh Recipe Bundle):**\n\n` +
        itemsList +
        `\n\nஇந்த அனைத்துப் பொருட்களையும் உடனடியாக கார்ட்டில் சேர்க்க கீழேயுள்ள பொத்தானை அழுத்தவும்! 🛒✨`;

      actionHtml = `
        <button type="button" onclick="addRecipeBundleToLyoCart('${selectedBundleKey}')" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border: none; color: #fff; font-weight: 800; font-size: 12px; padding: 9px 15px; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 10px rgba(245,158,11,0.35);">
          🍲 இந்த பொருட்களை கார்ட்டில் சேர் (+ Add Bundle to Cart)
        </button>
      `;
      break;
    }

    case "WALLET_POINTS": {
      const activeUser = (typeof getActiveUser === 'function') ? getActiveUser() : null;
      if (activeUser) {
        const pts = activeUser.walletPoints || activeUser.loyaltyPoints || 0;
        const ptsValue = Math.round(pts / 10);
        text = text || `💰 **உங்கள் லாயல்டி வாலட் (Loyalty Wallet):**\n` +
          `• பயனர்: **${activeUser.name || activeUser.phone}**\n` +
          `• இருப்பு புள்ளிகள்: **${pts} Points**\n` +
          `• பண மதிப்பு: **₹${ptsValue}**\n\n` +
          `நீங்கள் ஆர்டர் செய்யும்போது இந்த புள்ளிகளைப் பயன்படுத்தி தள்ளுபடி பெறலாம்!`;
        actionHtml = `<button type="button" onclick="if(typeof showScreen==='function') showScreen('screen-cart');" style="background: rgba(168,85,247,0.18); border: 1.5px solid #a855f7; color: #d8b4fe; font-weight: 700; font-size: 11.5px; padding: 8px 14px; border-radius: 10px; cursor: pointer;">🛍️ கார்ட்டில் பயன்படுத்த செல் (Go to Cart)</button>`;
      } else {
        text = text || `💰 **உங்கள் லாயல்டி வாலட் (Loyalty Wallet):**\n` +
          `வாலட் புள்ளிகளைப் பார்க்கவும் பயன்படுத்தவும் தயவுசெய்து உள்நுழையவும்!`;
        actionHtml = `<button type="button" onclick="if(typeof showScreen==='function') showScreen('screen-login');" style="background: #10b981; border: none; color: #fff; font-weight: 700; font-size: 11.5px; padding: 8px 14px; border-radius: 10px; cursor: pointer;">🔐 உள்நுழைக / Login</button>`;
      }
      break;
    }

    case "PRICE_CHECK": {
      const q = (queryText || '').toLowerCase();
      const matched = (activeProducts || []).filter(p => {
        const nameEn = (p.englishName || '').toLowerCase();
        const nameTa = (p.tamilName || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        return q.split(' ').some(w => w.length > 2 && (nameEn.includes(w) || nameTa.includes(w) || cat.includes(w)));
      });

      if (matched.length > 0) {
        text = text || `🏷️ **நேரலை விலை விவரம் (Current Store Prices):**\n\n` +
          matched.slice(0, 4).map(p => {
            const dName = p.tamilName ? `${p.tamilName} (${p.englishName})` : p.englishName;
            const unit = p.sellingUnit || p.unit || 'kg';
            return `• **${dName}**: ₹${p.pricePerKg || p.price || 0} / ${unit}`;
          }).join('\n') +
          `\n\nகார்ட்டில் சேர்க்க பொத்தானைத் தொடவும்:`;

        actionHtml = `<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">` +
          matched.slice(0, 3).map(p => {
            const dName = p.tamilName || p.englishName;
            const unit = p.sellingUnit || p.unit || 'kg';
            return `<button type="button" onclick="sendQuickLyoQuery('1 ${unit} ${p.englishName}')" style="background: rgba(16,185,129,0.15); border: 1px solid #10b981; color: #6ee7b7; font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 8px; cursor: pointer;">➕ 1 ${unit} ${dName}</button>`;
          }).join('') +
          `</div>`;
      } else {
        text = text || `🏷️ கடையில் உள்ள முன்னணி பொருட்களின் விலைகள்:\n` +
          (activeProducts || []).slice(0, 4).map(p => `• **${p.tamilName || p.englishName}**: ₹${p.pricePerKg || p.price}/${p.sellingUnit || p.unit || 'kg'}`).join('\n');
      }
      break;
    }

    case "WHATSAPP_SUPPORT": {
      const fallbackSettings = (typeof getSettings === 'function') ? getSettings() : ((typeof getData === 'function') ? getData('ek_settings', {}) : {});
      const storePhone = (fallbackSettings && fallbackSettings.supportPhone) ? fallbackSettings.supportPhone.replace(/\D/g, '') : '9876543210';
      text = text || `📱 **எடப்பாடி கடை வாட்ஸ்அப் உதவி (WhatsApp Support):**\n` +
        `உங்களுக்கு ஏதேனும் சிறப்பு கட் ஸ்டைல் தேவைப்பட்டாலோ அல்லது உதவி தேவைப்பட்டாலோ கடைக்கு நேரடியாக வாட்ஸ்அப் செய்தி அனுப்பலாம்!`;
      actionHtml = `<a href="https://wa.me/91${storePhone}?text=வணக்கம்,%20எடப்பாடி%20கடை%20செயலி%20மூலம்%20தொடர்புகொள்கிறேன்" target="_blank" style="text-decoration: none; background: #25D366; color: #fff; font-weight: 800; font-size: 12px; padding: 9px 15px; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 10px rgba(37,211,102,0.35);">
        <span style="font-size: 15px;">💬</span> வாட்ஸ்அப் செய்தி அனுப்பு / Chat on WhatsApp
      </a>`;
      break;
    }

    case "ORDER_TRACKING":
    case "ORDER_STATUS": {
      const orders = (typeof getData === 'function') ? getData('ek_orders', []) : [];
      const activeUser = (typeof getActiveUser === 'function') ? getActiveUser() : null;
      const userOrders = activeUser
        ? orders.filter(o => o.userId === activeUser.uid || o.userPhone === activeUser.phone || o.customerPhone === activeUser.phone)
        : orders;
      const latestOrder = userOrders.length > 0 ? userOrders[userOrders.length - 1] : (orders.length > 0 ? orders[orders.length - 1] : null);

      if (latestOrder) {
        const orderNum = latestOrder.orderId || latestOrder.id || 'N/A';
        const rawStatus = (latestOrder.status || latestOrder.orderStage || 'Placed').toLowerCase();
        let statusDisplay = 'ஆர்டர் பெறப்பட்டது (Placed)';
        if (rawStatus.includes('accept') || rawStatus.includes('confirm')) statusDisplay = 'உறுதி செய்யப்பட்டது (Confirmed) ⏳';
        else if (rawStatus.includes('prep') || rawStatus.includes('pack')) statusDisplay = 'தயாரிக்கப்படுகிறது (Preparing) 🔪';
        else if (rawStatus.includes('dispatch') || rawStatus.includes('out') || rawStatus.includes('transit')) statusDisplay = 'டெலிவரிக்கு புறப்பட்டது (Out for Delivery) 🛵';
        else if (rawStatus.includes('deliver')) statusDisplay = 'டெலிவரி செய்யப்பட்டது (Delivered) ✅';
        else if (rawStatus.includes('cancel')) statusDisplay = 'ரத்து செய்யப்பட்டது (Cancelled) ❌';

        const itemsList = Array.isArray(latestOrder.items) && latestOrder.items.length > 0
          ? latestOrder.items.slice(0, 3).map(it => `  • ${it.tamilName || it.name || it.englishName || 'பொருள்'} (${it.quantity || it.displayQty || it.qty || 1})`).join('\n')
          : '';

        text = `📦 **உங்கள் ஆர்டர் நிலவரம் (Order Status):**\n\n` +
          `• **ஆர்டர் எண்**: #${orderNum}\n` +
          `• **தற்போதைய நிலை**: **${statusDisplay}**\n` +
          `• **மொத்த தொகை**: ₹${latestOrder.totalAmount || latestOrder.grandTotal || 0}\n` +
          (itemsList ? `• **ஆர்டர் செய்யப்பட்ட பொருட்கள்**:\n${itemsList}\n` : '') +
          `• **டெலிவரி முகவரி**: ${latestOrder.deliveryAddress || latestOrder.deliveryZone || 'எடப்பாடி பகுதி'}\n\n` +
          `நேரலை வரைபடம் மற்றும் டெலிவரி பாய் நகர்வை உடனுக்குடன் காண கீழேயுள்ள பொத்தானைத் தொடவும்!`;

        const targetId = latestOrder.id || latestOrder.orderId || '';
        actionHtml = `<button type="button" onclick="if(typeof selectedTrackOrderId !== 'undefined') selectedTrackOrderId='${targetId}'; if(typeof showScreen==='function') showScreen('screen-track'); if(typeof renderTrackerScreen==='function') renderTrackerScreen();" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; color: #fff; font-weight: 700; font-size: 12px; padding: 10px 16px; border-radius: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 3px 10px rgba(16,185,129,0.35);">🚚 நேரலை ஆர்டர் கண்காணிப்பு (Live Tracker)</button>`;
      } else {
        text = `📦 **ஆர்டர் நிலவரம் (Order Status):**\n\n` +
          `தற்போது உங்களிடம் செயலில் உள்ள ஆர்டர்கள் எதுவும் இல்லை.\n\n` +
          `நீங்கள் ஆர்டர் செய்தவுடன், அதன் நிலவரத்தை இங்கேயே நேரலையாகக் கண்காணிக்கலாம்! ஏதேனும் புதிய பொருட்களை ஆர்டர் செய்ய விரும்பினால் '1kg Chicken' அல்லது '2kg Tomato' என இங்கு பதிவிடலாம்.`;
        actionHtml = `<button type="button" onclick="if(typeof showScreen==='function') showScreen('screen-track');" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; color: #fff; font-weight: 700; font-size: 11.5px; padding: 8px 14px; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(16,185,129,0.3);">🚚 ஆர்டர் டிராக்கர் பக்கம் செல்</button>`;
      }
      break;
    }

    case "APPLICATION_FEATURES": {
      text = text || `✨ **எடப்பாடி கடை செயலியின் வசதிகள் (App Features):**\n` +
        `• 🥩 **புதிய கறி & காய்கறிகள்**: ஆட்டுக்கறி, கோழிக்கறி, மீன் மற்றும் புதிய காய்கறிகள் தினமும் நேரடி வரத்து.\n` +
        `• 🤖 **Lyo AI வர்த்தக உதவியாளர்**: தமிழ் மற்றும் ஆங்கிலத்தில் குரல் அல்லது அரட்டை மூலம் எளிதாக ஆர்டர் செய்யலாம்.\n` +
        `• ⚡ **30 நிமிட எக்ஸ்பிரஸ் டெலிவரி**: எடப்பாடி நகரம் மற்றும் சுற்றுவட்டாரப் பகுதிகளுக்கு விரைவான விநியோகம்.\n` +
        `• 💰 **பல்வேறு செலுத்து முறைகள்**: UPI (GPay/PhonePe), Cash on Delivery, Wallet & Loyalty Rewards.\n` +
        `• 🎟️ **சிறப்பு தள்ளுபடி கூப்பன்கள்**: தினமும் புதிய சலுகைகள் மற்றும் கூப்பன்கள்.\n` +
        `• 📦 **நேரலை ஆர்டர் கண்காணிப்பு**: ஆர்டர் தயாரிப்பு முதல் வீட்டை அடையும் வரை லைவ் டிராக்கிங்.`;
      break;
    }

    case "AI_QUESTIONS": {
      text = text || `🤖 **நான் Lyo AI - உங்கள் எடப்பாடி கடை வர்த்தக உதவியாளர்!**\n` +
        `நான் உங்களுக்கு எவ்வாறு உதவ முடியும்:\n` +
        `• தமிழ் அல்லது ஆங்கிலத்தில் பொருட்கள் பெயர் மற்றும் அளவைக் கூறி உடனடியாக கார்ட்டில் சேர்க்கலாம் (எ.கா: '500g சிக்கன்', '2 கிலோ தக்காளி')\n` +
        `• உங்கள் ஆர்டர் நிலவரத்தைக் கண்காணிக்கலாம்\n` +
        `• சலுகை கூப்பன்கள் மற்றும் டெலிவரி தகவல்களைத் தெரிந்துகொள்ளலாம்\n` +
        `• கடையில் உள்ள தயாரிப்புகளைத் தேடலாம்`;
      break;
    }

    case "GREETINGS": {
      text = text || `வணக்கம்! Good day! 🌸 எடப்பாடி கடை Lyo AI உங்களை வரவேற்கிறது! இன்று உங்களுக்கு என்ன காய்கறி அல்லது கறி வகைகள் வேண்டும்?`;
      break;
    }

    case "CUSTOMER_SUPPORT":
    case "HELP": {
      text = text || `📞 **வாடிக்கையாளர் சேவை (Customer Support):**\n` +
        `• உதவி எண்: +91 98765 43210\n` +
        `• மின்னஞ்சல்: support@edappadikadai.com\n` +
        `• கடை முகவரி: Main Road, Edappadi Town Core, Salem\n` +
        `உங்களுக்கு ஏதேனும் உதவி தேவைப்பட்டால் எங்களை எப்போது வேண்டுமானாலும் தொடர்புகொள்ளலாம்!`;
      break;
    }

    case "COUPONS": {
      text = text || `🎟️ **இன்றைய தள்ளுபடி கூப்பன்கள் (Active Offer Coupons):**\n` +
        `• **WELCOME10**: 10% தள்ளுபடி (குறைந்தபட்ச ஆர்டர் ₹199)\n` +
        `• **FREEFRESH**: இலவச டெலிவரி (குறைந்தபட்ச ஆர்டர் ₹299)\n` +
        `• **SAVEMORE**: ₹50 உடனடி தள்ளுபடி (குறைந்தபட்ச ஆர்டர் ₹499)\n` +
        `கார்ட்டில் செக்-அவுட் செய்யும்போது இந்த கூப்பன்களைப் பயன்படுத்தி மகிழுங்கள்!`;
      actionHtml = `<button type="button" onclick="if(typeof showScreen==='function') showScreen('screen-cart');" style="background: rgba(245,158,11,0.15); border: 1px solid #f59e0b; color: #fbbf24; font-weight: 700; font-size: 11.5px; padding: 7px 12px; border-radius: 10px; cursor: pointer;">🛒 கார்ட்டில் கூப்பன் பயன்படுத்து (Apply in Cart)</button>`;
      break;
    }

    case "DELIVERY": {
      text = text || `🚚 **டெலிவரி தகவல்கள் (Delivery Info):**\n` +
        `• எடப்பாடி டவுன் கோர்: ₹15 டெலிவரி கட்டணம்\n` +
        `• இலவச டெலிவரி ஆஃபர்: **FREEFRESH** கூப்பனைப் பயன்படுத்தி ₹299-க்கு மேல் ஆர்டர் செய்தால் இலவச டெலிவரி பெறலாம்!\n` +
        `• சராசரி டெலிவரி நேரம்: 20 முதல் 30 நிமிடங்கள்.`;
      break;
    }

    case "RESTAURANT_INFO": {
      text = text || `🏪 **எடப்பாடி கடை விவரங்கள் (Store Info):**\n` +
        `• வேலை நேரம்: காலை 7:00 AM - இரவு 10:00 PM (தினமும்)\n` +
        `• முகவரி: Main Road, Edappadi Town, Salem, Tamil Nadu\n` +
        `• சிறப்பு: தினமும் காலை பண்ணையிலிருந்து நேரடியாக வரும் புதிய கறி மற்றும் காய்கறிகள்!`;
      break;
    }

    case "PRODUCT_SEARCH": {
      const q = (queryText || '').toLowerCase();
      const matched = (activeProducts || []).filter(p => {
        const nameEn = (p.englishName || '').toLowerCase();
        const nameTa = (p.tamilName || '').toLowerCase();
        return q.split(' ').some(w => w.length > 2 && (nameEn.includes(w) || nameTa.includes(w)));
      });

      if (matched.length > 0) {
        text = text || `🔍 **தேடப்பட்ட தயாரிப்புகள் (Available Products):**\n` +
          matched.slice(0, 5).map(p => `• **${p.englishName}** (${p.tamilName || ''}) - ₹${p.pricePerKg || p.price}/${p.unit || 'kg'}`).join('\n') +
          `\n\nபொருட்களை ஆர்டர் செய்ய, அளவைக் குறிப்பிடவும் (எ.கா: '500g Chicken', '2kg Tomato').`;
      } else {
        text = text || `🔍 கடையில் உள்ள அனைத்து புதிய இறைச்சி மற்றும் காய்கறி வகைகளையும் ஹோம் பக்கத்தில் பார்க்கலாம்! அளவைக் கூறி ஆர்டர் செய்யலாம் (எ.கா: '1kg Mutton').`;
      }
      actionHtml = `<button type="button" onclick="if(typeof showScreen==='function') showScreen('screen-home');" style="background: rgba(16,185,129,0.15); border: 1px solid #10b981; color: #34d399; font-weight: 700; font-size: 11.5px; padding: 7px 12px; border-radius: 10px; cursor: pointer;">🏪 அனைத்து பொருட்களையும் பார் (View Store Catalog)</button>`;
      break;
    }

    case "PRODUCT_RECOMMENDATION": {
      const topProds = (activeProducts || []).slice(0, 4);
      text = text || `🌟 **இன்றைய சிறப்பு பரிந்துரைகள் (Today's Recommendations):**\n` +
        topProds.map(p => `• **${p.englishName}** (${p.tamilName || ''}) - ₹${p.pricePerKg || p.price}/${p.unit || 'kg'}`).join('\n') +
        `\n\nதேவையான பொருட்களை ஆர்டர் செய்ய அளவைக் குறிப்பிடவும்!`;
      break;
    }

    case "SETTINGS":
    case "ACCOUNT": {
      text = text || `👤 **கணக்கு மற்றும் அமைப்புகள் (Account & Settings):**\n` +
        `உங்கள் விநியோக முகவரி, சுயவிவர விவரங்கள் மற்றும் கடவுச்சொல்லை மாற்ற சுயவிவரப் பக்கத்திற்குச் செல்லவும்.`;
      actionHtml = `<button type="button" onclick="if(typeof showScreen==='function') showScreen('screen-profile');" style="background: rgba(59,130,246,0.15); border: 1px solid #3b82f6; color: #60a5fa; font-weight: 700; font-size: 11.5px; padding: 7px 12px; border-radius: 10px; cursor: pointer;">👤 சுயவிவரப் பக்கம் செல் (Open Profile)</button>`;
      break;
    }

    case "NAVIGATION": {
      text = text || `உங்களுக்குத் தேவையான பக்கத்திற்குச் செல்ல கீழேயுள்ள பொத்தானைப் பயன்படுத்தவும்:`;
      actionHtml = `<button type="button" onclick="if(typeof showScreen==='function') showScreen('screen-home');" style="background: #10b981; border: none; color: #fff; font-weight: 700; font-size: 11.5px; padding: 7px 12px; border-radius: 10px; cursor: pointer;">🏠 ஹோம் பக்கம் செல்</button>`;
      break;
    }

    default: {
      text = text || `நன்றி! உங்கள் கேள்விக்கு உதவ Lyo AI எப்போதும் தயார். கறி அல்லது காய்கறிகளை ஆர்டர் செய்ய '500g Chicken' அல்லது '2kg Tomato' என டைப் செய்யவும்!`;
      break;
    }
  }

  return { text, actionHtml };
}

function playLyoSpeech(rawText) {
  if (!rawText || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const cleanText = rawText.replace(/<[^>]*>?/gm, '').replace(/[*_#•]/g, '').trim();
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en-IN' : 'ta-IN';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("Lyo speech error:", e);
  }
}
window.playLyoSpeech = playLyoSpeech;

function speakLyoTextMessage(btnEl) {
  const text = btnEl ? btnEl.getAttribute('data-text') : '';
  if (text) playLyoSpeech(text);
}


function getActiveLyoProposalMsg() {
  return _lyoChatMessages.find(m => m.role === 'assistant' && m.isProposal === true && m.items && Array.isArray(m.items));
}

        function convertAiItemToManualCartItem(it) {
      const products = (typeof getData === 'function') ? getData('ek_products', []) : [];
      const prod = products.find(p => p.id === (it.productId || it.id));
      if (!prod) {
        console.warn("[Lyo AI Sync] Product document not found in ek_products for ID:", it.productId || it.id);
      }
      const unitPrice = Number(prod ? (prod.pricePerKg || prod.price || prod.sellingPrice || 0) : (it.price || 0));
      const unitStr = prod ? (prod.sellingUnit || prod.unit || 'kg') : (it.unit || 'kg');
      const isWeight = isUnitWeight ? isUnitWeight(unitStr) : !(unitStr === 'piece' || unitStr === 'packet' || unitStr === 'unit' || unitStr === 'box' || unitStr === 'bunch');
      
      let weightGrams = it.rawQty || it.weightGrams || 1;
      if (isWeight) {
        weightGrams = (weightGrams <= 50) ? Math.round(weightGrams * 1000) : Math.round(weightGrams);
      } else {
        weightGrams = Math.round(weightGrams);
      }
      
      const calculatedPrice = isWeight
        ? Math.round((unitPrice / 1000) * weightGrams)
        : Math.round(unitPrice * weightGrams);
      const totalPrice = (it.itemTotal && !isNaN(it.itemTotal) && Number(it.itemTotal) > 0)
        ? Number(it.itemTotal)
        : calculatedPrice;

      const resolvedImg = prod ? (prod.imageUrl || '') : (it.img || it.imageUrl || '');
      
      return {
        productId: prod ? prod.id : (it.productId || it.id),
        tamilName: prod ? (prod.tamilName || prod.englishName) : (it.tamilName || it.name || 'பொருள்'),
        englishName: prod ? (prod.englishName || prod.tamilName) : (it.name || 'Item'),
        weightGrams: weightGrams,
        unit: unitStr,
        sellingUnit: unitStr,
        cutStyle: it.cutStyle || 'Standard Fresh Cut',
        category: prod ? (prod.category || 'meat') : (it.category || 'meat'),
        specialNote: '',
        pricePerKg: unitPrice,
        imageUrl: resolvedImg,
        totalPrice: Number(totalPrice) || 0
      };
    }

    function convertManualCartItemToAiItem(cItem, idx) {
      const products = (typeof getData === 'function') ? getData('ek_products', []) : [];
      const prod = products.find(p => p.id === cItem.productId) || {
        id: cItem.productId,
        englishName: cItem.englishName,
        tamilName: cItem.tamilName,
        pricePerKg: cItem.pricePerKg,
        unit: cItem.unit || 'kg',
        sellingUnit: cItem.sellingUnit || cItem.unit || 'kg',
        imageUrl: cItem.imageUrl
      };
      
      const unitStr = prod.sellingUnit || prod.unit || cItem.sellingUnit || cItem.unit || 'kg';
      const isWeight = isUnitWeight ? isUnitWeight(unitStr) : true;
      let rawQty = cItem.weightGrams;
      if (isWeight) {
        rawQty = cItem.weightGrams / 1000;
      }
      const calcInput = {
        rawQtyVal: rawQty,
        amountType: isWeight ? 'WEIGHT_KG' : 'COUNT_PCS',
        unit: unitStr
      };
      const details = calculateLyoItemDetails(prod, calcInput);
      return {
        id: 'it_sync_' + (prod.id || idx) + '_' + idx,
        productId: prod.id,
        name: prod.englishName || cItem.englishName || 'Item',
        tamilName: prod.tamilName || cItem.tamilName || 'பொருள்',
        displayQty: details.displayQty,
        selectorQty: details.selectorQty,
        rawQty: details.rawQty,
        unit: unitStr,
        price: Number(prod.pricePerKg || cItem.pricePerKg || 0),
        itemTotal: Number(cItem.totalPrice || details.itemTotal || 0),
        img: prod.imageUrl || cItem.imageUrl,
        isFreeDeliveryEligible: prod.isFreeDeliveryEligible === true || cItem.isFreeDeliveryEligible === true
      };
    }

    function computeLyoDeliveryCharge(subtotal = 0, cartItems = []) {
      const settings = (typeof getSettings === 'function') ? getSettings() : ((typeof getData === 'function') ? getData('ek_settings', {}) : {});
      let deliveryCharge = (settings.deliveryCharge !== undefined && settings.deliveryCharge !== '' && !isNaN(Number(settings.deliveryCharge))) ? Number(settings.deliveryCharge) : 40;

      if (typeof getDynamicDeliveryCharge === 'function') {
        const u = (typeof getActiveUser === 'function') ? getActiveUser() : null;
        const dyn = getDynamicDeliveryCharge(subtotal, u);
        if (dyn && typeof dyn.charge === 'number') {
          deliveryCharge = dyn.charge;
        }
      } else if (typeof DeliveryChargeCalculator !== 'undefined' && DeliveryChargeCalculator && typeof DeliveryChargeCalculator.calculateDelivery === 'function') {
        const res = DeliveryChargeCalculator.calculateDelivery(subtotal, cartItems, settings);
        if (typeof res.deliveryCharge === 'number') deliveryCharge = res.deliveryCharge;
      }
      return Math.round(deliveryCharge);
    }

    function syncLyoToManualCart() {
      if (window._isSyncingCart) return;
      window._isSyncingCart = true;
      try {
        const activeMsg = getActiveLyoProposalMsg();
        if (!activeMsg || !activeMsg.items || activeMsg.items.length === 0) {
          cart = [];
        } else {
          cart = activeMsg.items.map(it => convertAiItemToManualCartItem(it));
        }
        if (typeof saveData === 'function') saveData('ek_cart', cart);
        if (typeof updateCartBadge === 'function') updateCartBadge();
        if (typeof renderCartScreen === 'function') renderCartScreen();
      } finally {
        window._isSyncingCart = false;
      }
    }

    function persistLyoChatMessages() {
      try {
        if (typeof saveData === 'function' && Array.isArray(_lyoChatMessages)) {
          saveData('ek_lyo_chat_messages', _lyoChatMessages);
        }
      } catch (e) {}
    }

    function syncManualToLyoCart() {
      if (window._isSyncingCart) return;
      window._isSyncingCart = true;
      try {
        let activeMsg = getActiveLyoProposalMsg();
        if (cart && cart.length > 0) {
          const aiItems = cart.map((cItem, idx) => convertManualCartItemToAiItem(cItem, idx));
          let subtotal = 0;
          aiItems.forEach(it => subtotal += (it.itemTotal || 0));
          const calculatedDeliveryCharge = computeLyoDeliveryCharge(subtotal, aiItems);
          if (!activeMsg) {
            const proposalId = 'prop_' + Date.now();
            activeMsg = {
              id: 'msg_a_' + Date.now(),
              role: 'assistant',
              isProposal: true,
              text: '',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              proposalId: proposalId,
              items: aiItems,
              deliveryCharge: calculatedDeliveryCharge,
              deliveryZone: 'Edappadi Mini Ward (Town Core)'
            };
            _lyoChatMessages.push(activeMsg);
          } else {
            activeMsg.isProposal = true;
            activeMsg.items = aiItems;
            activeMsg.deliveryCharge = calculatedDeliveryCharge;
          }
          const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
          activeMsg.text = isTa
            ? `கார்ட்டில் உள்ள பொருட்கள் புதுப்பிக்கப்பட்டன: 🎉 மொத்தம்: ₹${subtotal}`
            : `Sure! Updated items in your active AI shopping cart: 🎉 Total: ₹${subtotal}`;
        }
        persistLyoChatMessages();
        renderLyoAiChat();
        updateLyoDraftCartBar();
      } finally {
        window._isSyncingCart = false;
      }
    }

    function getLyoAiWelcomeMessage() {
      const activeUser = (typeof getActiveUser === 'function') ? getActiveUser() : null;
      const userName = activeUser ? (activeUser.name || activeUser.fullName || '') : '';
      const hour = new Date().getHours();
      let timeGreetingTa = "வணக்கம்";
      let timeGreetingEn = "Hello";
      if (hour < 12) {
        timeGreetingTa = "இனிய காலை வணக்கம்";
        timeGreetingEn = "Good Morning";
      } else if (hour < 17) {
        timeGreetingTa = "இனிய மதிய வணக்கம்";
        timeGreetingEn = "Good Afternoon";
      } else {
        timeGreetingTa = "இனிய மாலை வணக்கம்";
        timeGreetingEn = "Good Evening";
      }

      const userGreetingTa = userName ? `${timeGreetingTa}, ${userName} அவர்களே! 🌸` : `${timeGreetingTa}! 🌸`;
      const userGreetingEn = userName ? `${timeGreetingEn}, ${userName}! 🌸` : `${timeGreetingEn}! 🌸`;

      const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
      const welcomeText = isTa
        ? `${userGreetingTa}\n**எடப்பாடி கடை AI வர்த்தக உதவியாளருக்கு நல்வரவு!** 🛒✨\n\n🏪 கடை திறந்துள்ளது • ⚡ 30 நிமிட எக்ஸ்பிரஸ் டெலிவரி!\n\nபொருட்களின் பெயர் மற்றும் அளவை டைப் செய்யவும் அல்லது மைக் 🎤 மூலம் பேசவும் (எ.கா: *"1kg சிக்கன், 500g தக்காளி"*).\n\nகீழேயுள்ள விரைவுத் தேர்வுகளையும் பயன்படுத்தலாம்:`
        : `${userGreetingEn}\n**Welcome to Edappadi Kadai AI Commerce Assistant!** 🛒✨\n\n🏪 Store Open • ⚡ 30-Min Express Delivery!\n\nType your list or tap the mic 🎤 to speak (e.g. *"1kg Chicken, 500g Tomato"*).\n\nYou can also tap the quick options below:`;

      const welcomeActionHtml = `
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
          <button type="button" onclick="sendQuickLyoQuery('சிக்கன் பிரியாணி செய்ய பொருட்கள்')" style="background: rgba(245,158,11,0.18); border: 1px solid rgba(245,158,11,0.45); color: #fde047; padding: 6px 11px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            🍲 பிரியாணி பொருட்கள்
          </button>
          <button type="button" onclick="sendQuickLyoQuery('இறைச்சி வகைகள் என்னென்ன இருக்கு?')" style="background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.45); color: #6ee7b7; padding: 6px 11px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            🥩 புதிய இறைச்சி
          </button>
          <button type="button" onclick="sendQuickLyoQuery('Order status')" style="background: rgba(59,130,246,0.18); border: 1px solid rgba(59,130,246,0.45); color: #93c5fd; padding: 6px 11px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            📦 ஆர்டர் நிலவரம்
          </button>
          <button type="button" onclick="sendQuickLyoQuery('இன்றைய கூப்பன்கள்')" style="background: rgba(168,85,247,0.18); border: 1px solid rgba(168,85,247,0.45); color: #e9d5ff; padding: 6px 11px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            🎟️ சலுகை கூப்பன்கள்
          </button>
          <button type="button" onclick="sendQuickLyoQuery('கடை வாட்ஸ்அப் உதவி')" style="background: rgba(34,197,94,0.18); border: 1px solid rgba(34,197,94,0.45); color: #86efac; padding: 6px 11px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            📱 வாட்ஸ்அப் உதவி
          </button>
        </div>
      `;

      return {
        id: 'msg_welcome_' + Date.now(),
        role: 'assistant',
        text: welcomeText,
        actionHtml: welcomeActionHtml,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    }
    window.getLyoAiWelcomeMessage = getLyoAiWelcomeMessage;

    function clearLyoChatHistory() {
      _lyoChatMessages = [getLyoAiWelcomeMessage()];
      persistLyoChatMessages();
      renderLyoAiChat();
      if (typeof showToast === 'function') {
        const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
        showToast(isTa ? "புதிய உரையாடல் துவங்கியது! ✨" : "New chat started! ✨", "info");
      }
    }
    window.clearLyoChatHistory = clearLyoChatHistory;

    let _lyoSpeechRec = null;
    let _isLyoListening = false;

    function toggleLyoVoiceInput() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
        if (typeof showToast === 'function') {
          showToast(isTa ? "உங்கள் உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை." : "Voice recognition not supported on this browser.", "warning");
        } else {
          alert(isTa ? "உங்கள் உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை." : "Voice recognition not supported on this browser.");
        }
        return;
      }

      const micBtn = document.getElementById('lyo-ai-mic-btn');
      const waveBar = document.getElementById('lyo-ai-speech-waves');
      const waveTxt = document.getElementById('voice-rec-status-txt');

      if (_isLyoListening && _lyoSpeechRec) {
        try { _lyoSpeechRec.stop(); } catch (e) {}
        _isLyoListening = false;
        if (micBtn) {
          micBtn.style.background = 'rgba(16, 185, 129, 0.15)';
          micBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          micBtn.innerHTML = '<span style="font-size: 16px;">🎤</span>';
        }
        if (waveBar) waveBar.style.display = 'none';
        return;
      }

      try {
        _lyoSpeechRec = new SpeechRecognition();
        _lyoSpeechRec.continuous = false;
        _lyoSpeechRec.interimResults = false;
        _lyoSpeechRec.lang = (typeof currentLang !== 'undefined' && currentLang === 'ta') ? 'ta-IN' : 'en-IN';

        _lyoSpeechRec.onstart = function() {
          _isLyoListening = true;
          if (micBtn) {
            micBtn.style.background = 'rgba(239, 68, 68, 0.25)';
            micBtn.style.borderColor = '#ef4444';
            micBtn.innerHTML = '<span style="font-size: 16px;">🔴</span>';
          }
          if (waveBar) {
            waveBar.style.display = 'flex';
            if (waveTxt) {
              waveTxt.textContent = (typeof currentLang !== 'undefined' && currentLang === 'ta')
                ? "கேட்கிறது... தமிழில் பேசலாம் 🎙️"
                : "Listening... speak now 🎙️";
            }
          }
        };

        _lyoSpeechRec.onresult = function(event) {
          _isLyoListening = false;
          if (micBtn) {
            micBtn.style.background = 'rgba(16, 185, 129, 0.15)';
            micBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            micBtn.innerHTML = '<span style="font-size: 16px;">🎤</span>';
          }
          if (waveBar) waveBar.style.display = 'none';

          if (event.results && event.results.length > 0) {
            const transcript = event.results[0][0].transcript;
            if (transcript && transcript.trim()) {
              const inputEl = document.getElementById('lyo-ai-input');
              if (inputEl) {
                inputEl.value = transcript.trim();
                if (typeof autoGrowLyoInput === 'function') autoGrowLyoInput(inputEl);
              }
              if (typeof onLyoSendBtnClick === 'function') {
                onLyoSendBtnClick();
              }
            }
          }
        };

        _lyoSpeechRec.onerror = function(event) {
          console.warn("[Lyo Speech Recognition Error]", event.error);
          _isLyoListening = false;
          if (micBtn) {
            micBtn.style.background = 'rgba(16, 185, 129, 0.15)';
            micBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            micBtn.innerHTML = '<span style="font-size: 16px;">🎤</span>';
          }
          if (waveBar) waveBar.style.display = 'none';
          if (event.error !== 'no-speech' && typeof showToast === 'function') {
            const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
            showToast(isTa ? "குரல் கேட்கவில்லை, மீண்டும் முயற்சிக்கவும்." : "Could not recognize voice, please try again.", "info");
          }
        };

        _lyoSpeechRec.onend = function() {
          _isLyoListening = false;
          if (micBtn) {
            micBtn.style.background = 'rgba(16, 185, 129, 0.15)';
            micBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            micBtn.innerHTML = '<span style="font-size: 16px;">🎤</span>';
          }
          if (waveBar) waveBar.style.display = 'none';
        };

        _lyoSpeechRec.start();
      } catch (err) {
        console.error("[Lyo Speech Recognition Exception]", err);
        _isLyoListening = false;
        if (micBtn) {
          micBtn.style.background = 'rgba(16, 185, 129, 0.15)';
          micBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          micBtn.innerHTML = '<span style="font-size: 16px;">🎤</span>';
        }
        if (waveBar) waveBar.style.display = 'none';
      }
    }
    window.toggleLyoVoiceInput = toggleLyoVoiceInput;

    function initLyoAiChat() {
      const msgContainer = document.getElementById('lyo-ai-messages');
      if (!msgContainer) return;
      
      const savedMsgs = (typeof getData === 'function') ? getData('ek_lyo_chat_messages', null) : null;
      if (Array.isArray(savedMsgs) && savedMsgs.length > 0) {
        _lyoChatMessages = savedMsgs;
      } else if (_lyoChatMessages.length === 0) {
        let existingCart = (typeof getData === 'function') ? getData('ek_cart', []) : (typeof cart !== 'undefined' ? cart : []);
        if (existingCart && existingCart.length > 0) {
          cart = existingCart;
          syncManualToLyoCart();
        } else {
          _lyoChatMessages = [getLyoAiWelcomeMessage()];
          persistLyoChatMessages();
        }
      }
      renderLyoAiChat();
      updateLyoDraftCartBar();

      const inputEl = document.getElementById('lyo-ai-input');
      if (inputEl && !inputEl.dataset.boundLyoEvents) {
        inputEl.dataset.boundLyoEvents = 'true';
        inputEl.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (typeof onLyoSendBtnClick === 'function') {
              onLyoSendBtnClick();
            }
          }
        });
        inputEl.addEventListener('blur', function() {
          const composeBox = document.querySelector('#lyo-ai-compose-box');
          if (composeBox) {
            composeBox.style.transform = 'translateY(0)';
          }
          window.scrollTo({ top: window.scrollY, behavior: 'instant' });
        });
      }
    }

    function renderLyoAiChat() {
      const msgContainer = document.getElementById('lyo-ai-messages');
      if (!msgContainer) return;
      let html = '';

      function isCartUpdateConfirmation(m) {
        if (!m || m.role !== 'assistant' || typeof m.text !== 'string') return false;
        const txt = m.text;
        return txt.includes("Updated items in your active AI shopping cart") ||
               txt.includes("கார்ட்டில் உள்ள பொருட்கள் புதுப்பிக்கப்பட்டன") ||
               txt.includes("கார்ட்டில் சேர்க்கப்பட்டன") ||
               txt.includes("உங்கள் கட்டளைப்படி பொருட்கள் கார்ட்டில் சேர்க்கப்பட்டன");
      }

      // Filter empty assistant messages and collapse consecutive "cart updated" confirmations (render only the last one)
      const displayMessages = [];
      for (let i = 0; i < _lyoChatMessages.length; i++) {
        const msg = _lyoChatMessages[i];
        if (!msg) continue;

        // Skip assistant messages with empty text, no items, and no actionHtml
        if (msg.role === 'assistant' && (!msg.text || !msg.text.trim()) && (!msg.items || msg.items.length === 0) && !msg.actionHtml) {
          continue;
        }

        // Collapse consecutive "cart updated" confirmations down to the LAST one in the run
        if (isCartUpdateConfirmation(msg)) {
          let hasLaterConsecutiveConfirmation = false;
          for (let j = i + 1; j < _lyoChatMessages.length; j++) {
            const nextMsg = _lyoChatMessages[j];
            if (!nextMsg) continue;
            if (nextMsg.role === 'assistant' && (!nextMsg.text || !nextMsg.text.trim()) && (!nextMsg.items || nextMsg.items.length === 0) && !nextMsg.actionHtml) {
              continue;
            }
            if (isCartUpdateConfirmation(nextMsg)) {
              hasLaterConsecutiveConfirmation = true;
              break;
            }
            break;
          }
          if (hasLaterConsecutiveConfirmation) {
            continue; // Skip earlier message in consecutive run; only render the last one
          }
        }

        displayMessages.push(msg);
      }

      displayMessages.forEach(msg => {
        if (msg.role === 'user') {
          html += `
            <div style="align-self: flex-end; max-width: 80%; background: #059669; border-radius: 16px 16px 2px 16px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.25); font-family: 'Poppins', 'Hind Madurai', sans-serif;">
              <div style="color: #ffffff; font-size: 13.5px; font-weight: 700; line-height: 1.35;">${escapeHtml(msg.text)}</div>
              <div style="color: rgba(255,255,255,0.75); font-size: 9.5px; font-weight: 600; text-align: right; margin-top: 3px;">${msg.time || ''}</div>
            </div>
          `;
        } else if (!msg.isProposal || !msg.items || msg.items.length === 0) {
          html += `
            <div style="align-self: flex-start; width: 100%; display: flex; gap: 8px; font-family: 'Poppins', 'Hind Madurai', sans-serif;">
              ${getLyoAiAvatarHtml(!!msg.isTyping)}
              <div style="flex: 1; min-width: 0; background: #121820; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 12px; box-shadow: 0 4px 18px rgba(0,0,0,0.45);">
                <div style="color: #ffffff; font-size: 13.5px; font-weight: 500; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(msg.text)}</div>
                ${msg.actionHtml ? `<div style="margin-top: 10px;">${msg.actionHtml}</div>` : ''}
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.05);">
                  <span style="color: #64748b; font-size: 10px;">${msg.time || ''}</span>
                  <button type="button" onclick="speakLyoTextMessage(this)" data-text="${escapeHtml(msg.text)}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; padding: 3px 8px; font-size: 10px; font-weight: 700; color: #cbd5e1; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                    🔊 LISTEN
                  </button>
                </div>
              </div>
            </div>
          `;
        } else {
          const items = msg.items || [];
          let itemsSubtotal = 0;
          items.forEach(it => itemsSubtotal += (it.itemTotal || 0));
          const activeUser = (typeof getActiveUser === 'function') ? getActiveUser() : null;
          const fallbackSettings = (typeof getSettings === 'function') ? getSettings() : ((typeof getData === 'function') ? getData('ek_settings', {}) : {});
          const baseDelCharge = (fallbackSettings && fallbackSettings.deliveryCharge !== undefined && fallbackSettings.deliveryCharge !== '' && !isNaN(Number(fallbackSettings.deliveryCharge))) ? Number(fallbackSettings.deliveryCharge) : 40;
          const financials = (typeof calculateOrderFinancials === 'function')
            ? calculateOrderFinancials(itemsSubtotal, activeUser, '', false, items)
            : { subtotal: itemsSubtotal, deliveryFee: baseDelCharge, grandTotal: itemsSubtotal + baseDelCharge };
          const delFee = financials.deliveryFee;
          const grandTotal = financials.grandTotal;
          const minReq = (typeof getSettings === 'function' && getSettings().minOrderAmount) ? parseFloat(getSettings().minOrderAmount) : 0;
          const minReqMet = itemsSubtotal >= minReq;

          let itemsHtml = '';
          items.forEach(it => {
            const allProds = (typeof getData === 'function') ? getData('ek_products', []) : [];
            const liveP = allProds.find(p => p.id === (it.productId || it.id));
            const displayName = liveP
              ? (liveP.tamilName ? `${liveP.tamilName} (${liveP.englishName})` : liveP.englishName)
              : (it.tamilName ? `${it.tamilName} (${it.name})` : (it.name || 'Product'));
            const displayQtyStr = it.displayQty || it.selectorQty || '1 Unit';
            const displayImg = getImageUrlWithCacheBuster(getProductThumbnailUrl(liveP || it.img || it), liveP ? liveP.updatedAt : null);
            const displayPrice = Number(it.itemTotal || it.price || 0);
            const unitPriceVal = Number(it.price || it.unitPrice || liveP?.pricePerKg || liveP?.sellingPrice || liveP?.price || 40);
            const unitLabel = String(it.unit || liveP?.sellingUnit || liveP?.unit || 'kg');
            const itemIdVal = it.id || ('it_' + (it.productId || matchedProd?.id || Math.random().toString(36).substr(2,6)));
            it.id = itemIdVal;
            it.price = unitPriceVal;
            it.unit = unitLabel;

            const extraActionHtml = `
              <button type="button" onclick="addLyoCardItemToCart('${it.productId || it.id}', ${it.rawQty || 1}, '${unitLabel}')" style="min-height: 32px; height: auto; padding: 6px 10px; border-radius: 8px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.35); color: #10b981; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 11.5px; font-weight: 700; cursor: pointer;" title="Add to Cart">
                <span style="font-size: 13px; display: inline-flex; align-items: center; justify-content: center;">🛒</span>
                <span style="line-height: 1.2;">Add</span>
              </button>
            `;

            itemsHtml += window.renderSharedCartItemCard({
              image: displayImg,
              title: displayName,
              subtitle: `${displayQtyStr} • <span style="color: #64748b;">₹${unitPriceVal}/${unitLabel}</span>`,
              totalPrice: displayPrice,
              qtyDisplay: it.selectorQty || displayQtyStr,
              onMinusClick: `changeLyoCardItemQty('${msg.proposalId}', '${itemIdVal}', -1)`,
              onPlusClick: `changeLyoCardItemQty('${msg.proposalId}', '${itemIdVal}', 1)`,
              onDeleteClick: `removeLyoCardItem('${msg.proposalId}', '${itemIdVal}')`,
              extraActionHtml: extraActionHtml
            });
          });
          let choiceChipsHtml = '';
          if (msg.lowConfidenceChoices && msg.lowConfidenceChoices.length > 0) {
            choiceChipsHtml = `
              <div style="margin-top: 10px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 10px;">
                <div style="color: #f59e0b; font-size: 11.5px; font-weight: 800; margin-bottom: 6px;">
                  ❓ எந்த பொருளை சேர்க்க வேண்டும்? / Please select:
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            `;
            msg.lowConfidenceChoices.forEach(cand => {
              choiceChipsHtml += `
                <button type="button" onclick="selectLyoProductCandidate('${msg.proposalId}', '${cand.product.id}', ${cand.rawQtyVal}, '${cand.amountType}')" style="background: rgba(16,185,129,0.15); border: 1px solid #10b981; color: #fff; border-radius: 10px; padding: 6px 10px; font-size: 11px; font-weight: 700; cursor: pointer;">
                  👉 ${escapeHtml(cand.product.tamilName || cand.product.englishName)} (₹${cand.product.pricePerKg || 40})
                </button>
              `;
            });
            choiceChipsHtml += `
                </div>
              </div>
            `;
          }

          html += `
            <div style="align-self: flex-start; width: 100%; display: flex; gap: 8px; font-family: 'Poppins', 'Hind Madurai', sans-serif;">
              <!-- Bot Avatar -->
              ${getLyoAiAvatarHtml(!!msg.isTyping)}
              <!-- Main Card -->
              <div style="flex: 1; min-width: 0; background: #121820; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 12px; box-shadow: 0 4px 18px rgba(0,0,0,0.45);">
                <div style="color: #ffffff; font-size: 13px; font-weight: 600; line-height: 1.4; margin-bottom: 4px;">
                  ${msg.text}
                </div>
                <div style="color: #10b981; font-size: 10.5px; margin-bottom: 8px; font-weight: 700;">
                  ✨ Production Lyo AI Commerce Engine (100% Accurate Sync)
                </div>
                <!-- Product List -->
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  ${itemsHtml}
                </div>
                ${choiceChipsHtml}
                <!-- Delivery Charge Section -->
                <div style="margin-top: 10px; font-size: 11.5px; font-weight: 700; color: #10b981; display: flex; align-items: center; gap: 4px;">
                  <span>📍</span>
                  <span>${(typeof currentLang !== 'undefined' && currentLang === 'ta') ? 'டெலிவரி கட்டணம்' : 'Delivery fee'}: ₹${delFee} (${financials.zoneName || 'Edappadi Core'})</span>
                </div>
                <!-- Minimum Order Requirement Card -->
                <div style="margin-top: 8px; background: ${minReqMet ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}; border: 1px dashed ${minReqMet ? '#10b981' : '#ef4444'}; border-radius: 10px; padding: 8px 10px;">
                  <div style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: #ffffff;">
                    <span>${minReqMet ? '✅' : '⚠️'}</span>
                    <span>${minReqMet ? ((typeof currentLang !== 'undefined' && currentLang === 'ta') ? `குறைந்தபட்ச ஆர்டர் அளவு எட்டப்பட்டது! (₹${itemsSubtotal} / ₹${minReq})` : `Minimum order requirement met! (₹${itemsSubtotal} / ₹${minReq})`) : ((typeof currentLang !== 'undefined' && currentLang === 'ta') ? `குறைந்தபட்ச ஆர்டருக்கு மேலும் ₹${minReq - itemsSubtotal} சேர்க்கவும் (₹${minReq})` : `Add ₹${minReq - itemsSubtotal} more for minimum order (₹${minReq})`)}</span>
                  </div>
                  <div style="margin-top: 5px; height: 3px; background: ${minReqMet ? '#10b981' : '#ef4444'}; border-radius: 2px; width: 100%;"></div>
                </div>
                <!-- Order Now / View Cart Button -->
                <button type="button" onclick="placeLyoProposalOrder('${msg.proposalId}')" style="width: 100%; min-height: 46px; height: auto; padding: 10px 14px; margin-top: 10px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b 0%, #10b981 100%); border: none; color: #ffffff; font-weight: 800; font-size: 13px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); box-shadow: 0 4px 14px rgba(16,185,129,0.25); display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; line-height: 1.3;">
                  🛍️ ${(typeof currentLang !== 'undefined' && currentLang === 'ta') ? `கார்ட்டை பார்க்க & ஆர்டர் செய்ய (பொருட்கள்: ₹${itemsSubtotal} + டெலிவரி: ₹${delFee} = ₹${grandTotal})` : `View Cart & Order Now (₹${itemsSubtotal} items + ₹${delFee} del = ₹${grandTotal})`}
                </button>
                <!-- Add All and Discard Buttons Row -->
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                  <button type="button" onclick="addAllLyoProposalToCart('${msg.proposalId}')" style="flex: 1; min-height: 42px; height: auto; padding: 8px 12px; border-radius: 12px; background: #10b981; border: none; color: #ffffff; font-weight: 800; font-size: 12.5px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; box-shadow: 0 3px 10px rgba(16,185,129,0.25); line-height: 1.3;">
                    🛒 ${(typeof currentLang !== 'undefined' && currentLang === 'ta') ? 'கார்ட்டில் சேர்க்க' : 'Add All To Cart'}
                  </button>
                  <button type="button" onclick="discardLyoProposal('${msg.proposalId}')" style="flex: 1; min-height: 42px; height: auto; padding: 8px 12px; border-radius: 12px; background: #ef4444; border: none; color: #ffffff; font-weight: 800; font-size: 12.5px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; box-shadow: 0 3px 10px rgba(239,68,68,0.25); line-height: 1.3;">
                    🗑️ ${(typeof currentLang !== 'undefined' && currentLang === 'ta') ? 'ரத்து செய்க' : 'Discard'}
                  </button>
                </div>
                <!-- Footer Timestamp & Audio Button -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 4px;">
                  <span style="color: #64748b; font-size: 10px;">${msg.time || '01:31 AM'}</span>
                  <button type="button" onclick="speakLyoMessage('${msg.proposalId}')" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; padding: 4px 10px; font-size: 10px; font-weight: 700; color: #cbd5e1; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                    🔊 கேள் / LISTEN
                  </button>
                </div>
              </div>
            </div>
          `;
        }
      });
      if (msgContainer._lastRenderedHtml !== html) {
        msgContainer._lastRenderedHtml = html;
        msgContainer.innerHTML = html;
        msgContainer.scrollTop = msgContainer.scrollHeight;
      }
    }

    
    // ==========================================
    // LYO AI CARD & SYSTEM ACTION HANDLERS
    // ==========================================

    function autoGrowLyoInput(el) {
      if (!el) return;
      if (!el.value || !el.value.trim()) {
        if (el.style.height !== '24px') {
          el.style.height = '24px';
          el.rows = 1;
          el.style.overflowY = 'hidden';
        }
        return;
      }
      el.style.height = 'auto';
      const scrollH = el.scrollHeight;
      const newH = Math.min(Math.max(24, scrollH), 120);
      el.style.height = newH + 'px';
      el.style.overflowY = scrollH > 120 ? 'auto' : 'hidden';
    }

    function sendQuickLyoQuery(queryText) {
      if (!queryText) return;
      if (queryText === "Clear cart" || queryText === "கூடையை காலி செய்") {
        clearLyoAiCart();
        return;
      }
      const inputEl = document.getElementById("lyo-ai-input");
      if (inputEl) {
        inputEl.value = queryText;
        autoGrowLyoInput(inputEl);
      }
      if (typeof sendLyoAiMessage === "function") {
        sendLyoAiMessage();
      } else if (typeof onLyoSendBtnClick === "function") {
        onLyoSendBtnClick();
      }
    }

    function toggleLyoAiLang() {
      if (typeof currentLang === "undefined") {
        window.currentLang = "ta";
      }
      currentLang = (currentLang === "ta") ? "en" : "ta";
      const label = document.getElementById("lyo-ai-lang-label");
      if (label) {
        label.textContent = currentLang === "ta" ? "தமிழ்" : "English";
      }
      if (typeof renderLyoAiChat === "function") renderLyoAiChat();
      if (typeof showToast === "function") {
        showToast(
          currentLang === "ta" ? "மொழி தமிழ் ஆக மாற்றப்பட்டது" : "Language switched to English",
          "info"
        );
      }
    }

    function updateLyoDraftCartBar() {
      const bar = document.getElementById("lyo-ai-draft-cart-bar");
      const titleEl = document.getElementById("lyo-ai-draft-cart-title");
      const subEl = document.getElementById("lyo-ai-draft-cart-sub");
      if (!bar) return;
      const items = (typeof cart !== "undefined" && Array.isArray(cart)) ? cart : [];
      if (items.length === 0) {
        bar.style.display = "none";
        return;
      }
      let itemsSubtotal = 0;
      items.forEach(i => {
        itemsSubtotal += (parseFloat(i.totalPrice || i.price || i.itemTotal) || 0);
      });
      
      const activeUser = (typeof getActiveUser === "function") ? getActiveUser() : null;
      const appliedCode = (typeof appliedCouponCode !== "undefined") ? appliedCouponCode : null;
      const useLoyalty = document.getElementById('cart-use-loyalty')?.checked || false;

      const fallbackSettings = (typeof getSettings === 'function') ? getSettings() : ((typeof getData === 'function') ? getData('ek_settings', {}) : {});
      const baseDelCharge = (fallbackSettings && fallbackSettings.deliveryCharge !== undefined && fallbackSettings.deliveryCharge !== '' && !isNaN(Number(fallbackSettings.deliveryCharge))) ? Number(fallbackSettings.deliveryCharge) : 40;
      const financials = (typeof calculateOrderFinancials === "function")
        ? calculateOrderFinancials(itemsSubtotal, activeUser, appliedCode, useLoyalty, items)
        : { subtotal: itemsSubtotal, deliveryFee: baseDelCharge, grandTotal: itemsSubtotal + baseDelCharge };

      const isTa = (typeof currentLang !== "undefined" && currentLang === "ta");
      if (titleEl) {
        titleEl.textContent = isTa
          ? `🛒 ${items.length} பொருட்கள் • மொத்தம்: ₹${financials.grandTotal}`
          : `🛒 ${items.length} Item(s) in Cart • Total: ₹${financials.grandTotal}`;
      }
      if (subEl) {
        const delStr = `₹${financials.deliveryFee} ${isTa ? 'டெலிவரி' : 'delivery'}`;
        subEl.textContent = isTa
          ? `பொருட்கள்: ₹${financials.subtotal} | ${delStr} (1-Click Checkout)`
          : `Items: ₹${financials.subtotal} | ${delStr} (1-Click Checkout)`;
      }
      bar.style.display = "flex";
    }
    window.updateLyoDraftCartBar = updateLyoDraftCartBar;

    function clearLyoAiCart() {
      if (typeof cart !== "undefined") {
        cart = [];
        if (typeof saveData === "function") saveData("ek_cart", cart);
      }
      const activeMsg = (typeof getActiveLyoProposalMsg === "function") ? getActiveLyoProposalMsg() : null;
      if (activeMsg) {
        activeMsg.items = [];
      }
      persistLyoChatMessages();
      if (typeof updateLyoDraftCartBar === "function") updateLyoDraftCartBar();
      if (typeof updateCartBadge === "function") updateCartBadge();
      if (typeof updateCartUI === "function") updateCartUI();
      if (typeof renderLyoAiChat === "function") renderLyoAiChat();
      const isTa = (typeof currentLang !== "undefined" && currentLang === "ta");
      if (typeof showToast === "function") {
        showToast(
          isTa ? "கூடை காலியாக்கப்பட்டது! 🛒" : "Cart cleared! 🛒",
          "info"
        );
      }
    }

    function checkoutLyoAiOrder() {
      window.isLyoAiCheckout = true;
      selectedPaymentMethod = 'Cash on Delivery';

      const currentCart = (typeof cart !== "undefined" && Array.isArray(cart)) ? cart : [];
      if (currentCart.length === 0) {
        const activeMsg = (typeof getActiveLyoProposalMsg === 'function') ? getActiveLyoProposalMsg() : null;
        if (activeMsg && Array.isArray(activeMsg.items) && activeMsg.items.length > 0) {
          window.cart = activeMsg.items.map(it => convertAiItemToManualCartItem(it));
          if (typeof saveCart === "function") {
            saveCart();
          } else {
            if (typeof sanitizeCart === "function") window.cart = sanitizeCart(window.cart);
            if (typeof saveData === "function") saveData("ek_cart", window.cart);
            if (typeof updateCartBadge === "function") updateCartBadge();
          }
        }
      }

      const items = (typeof cart !== "undefined" && Array.isArray(cart)) ? cart : [];
      const isTa = (typeof currentLang !== "undefined" && currentLang === "ta");
      if (items.length === 0) {
        if (typeof showToast === "function") {
          showToast(
            isTa ? "கூடை காலியாக உள்ளது!" : "Your cart is empty!",
            "warning"
          );
        }
        return;
      }

      if (typeof showTab === "function") {
        showTab("tab-cart");
      } else if (typeof showScreen === "function") {
        showScreen("screen-cart");
      }

      if (typeof renderCartScreen === "function") {
        renderCartScreen();
      }

      if (typeof showToast === "function") {
        showToast(
          isTa ? "கார்ட் திறக்கப்படுகிறது... 🛍️" : "Opening checkout... 🛍️",
          "success"
        );
      }
    }
    window.checkoutLyoAiOrder = checkoutLyoAiOrder;

    function playLyoChimeSound() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } catch (e) {
        // Ignored audio ctx restriction
      }
    }

    function changeLyoCardItemQty(proposalId, itemId, delta) {
      let msg = (typeof _lyoChatMessages !== "undefined") ? _lyoChatMessages.find(m => m.proposalId === proposalId || m.id === proposalId) : null;
      if (!msg) msg = (typeof getActiveLyoProposalMsg === "function") ? getActiveLyoProposalMsg() : null;
      if (!msg || !msg.items) return;
      const it = msg.items.find(i => i.id === itemId || i.productId === itemId);
      if (!it) return;

      const allProds = (typeof getData === 'function') ? getData('ek_products', []) : [];
      const liveP = allProds.find(p => p.id === (it.productId || it.id));
      const unitPrice = Number(it.price || it.unitPrice || liveP?.pricePerKg || liveP?.sellingPrice || liveP?.price || 40);
      const unit = String(liveP?.sellingUnit || liveP?.unit || it.unit || "kg").toLowerCase().trim();
      const isPieceSold = !isUnitWeight(unit);
      const isWeight = !isPieceSold && (unit === "kg" || unit === "g" || unit === "gram" || unit === "kilo" || unit === "கிலோ");
      const isLiquid = !isPieceSold && (unit === "litre" || unit === "l" || unit === "ml" || unit === "liter" || unit === "லிட்டர்");

      if (isWeight) {
        let currentGram = (it.rawQty <= 50) ? Math.round(it.rawQty * 1000) : Math.round(it.rawQty);
        let newGram = currentGram + delta * 250;
        if (newGram < 250) newGram = 250;
        const qtyInKg = newGram / 1000;
        it.rawQty = newGram;
        it.displayQty = `${newGram}g (${qtyInKg.toFixed(2)} Kg)`;
        it.selectorQty = `${newGram} g`;
        it.itemTotal = Math.round(qtyInKg * unitPrice);
      } else if (isLiquid) {
        let currentMl = (it.rawQty <= 50) ? Math.round(it.rawQty * 1000) : Math.round(it.rawQty);
        let newMl = currentMl + delta * 250;
        if (newMl < 250) newMl = 250;
        const qtyInL = newMl / 1000;
        it.rawQty = newMl;
        it.displayQty = `${newMl} ml (${qtyInL.toFixed(2)} L)`;
        it.selectorQty = `${newMl} ml`;
        it.itemTotal = Math.round(qtyInL * unitPrice);
      } else {
        let newCount = Math.max(1, Math.round((it.rawQty || 1) + delta));
        it.rawQty = newCount;
        it.unit = liveP?.sellingUnit || liveP?.unit || it.unit || "piece";
        const isTaLang = (typeof currentLang !== 'undefined' && currentLang === 'ta');
        const uLabel = getUnitDisplay(it.unit, isTaLang, newCount);
        it.displayQty = `${newCount} ${uLabel}`;
        it.selectorQty = `${newCount} ${it.unit}`;
        it.itemTotal = Math.round(newCount * unitPrice);
      }

      saveData('ek_lyo_chat_messages', _lyoChatMessages);
      if (typeof syncLyoToManualCart === "function") syncLyoToManualCart();
      if (typeof renderLyoAiChat === "function") renderLyoAiChat();
      if (typeof updateLyoDraftCartBar === "function") updateLyoDraftCartBar();
      if (typeof updateCartBadge === "function") updateCartBadge();
      if (typeof updateCartUI === "function") updateCartUI();
    }
    window.changeLyoCardItemQty = changeLyoCardItemQty;

    function addLyoCardItemToCart(productId, rawQty, unit) {
      if (!productId) return;
      const products = (typeof getDataCached === "function") 
        ? getDataCached("ek_products", []) 
        : ((typeof getData === "function") ? getData("ek_products", []) : []);
      let prod = products.find(p => String(p.id) === String(productId));
      if (!prod) {
        if (typeof showToast === "function") showToast("Product not found!", "error");
        return;
      }

      const unitPrice = Number(prod.pricePerKg || prod.sellingPrice || prod.price || 40);
      const unitStr = prod.sellingUnit || prod.unit || unit || "kg";
      const isWeight = isUnitWeight ? isUnitWeight(unitStr) : !(unitStr === "piece" || unitStr === "packet" || unitStr === "bunch" || unitStr === "dozen" || unitStr === "unit" || unitStr === "box");

      let weightGrams = rawQty || 1;
      if (isWeight) {
        weightGrams = (rawQty <= 50) ? Math.round(rawQty * 1000) : Math.round(rawQty);
      } else {
        weightGrams = Math.round(rawQty);
      }

      if (typeof cart === "undefined") window.cart = [];

      const existingIdx = cart.findIndex(c => String(c.productId) === String(productId));
      if (existingIdx !== -1) {
        cart[existingIdx].weightGrams += weightGrams;
        cart[existingIdx].pricePerKg = unitPrice;
        const itemTotal = isWeight ? Math.round((unitPrice / 1000) * cart[existingIdx].weightGrams) : Math.round(unitPrice * cart[existingIdx].weightGrams);
        cart[existingIdx].totalPrice = itemTotal;
        cart[existingIdx].price = itemTotal;
      } else {
        const itemTotal = isWeight ? Math.round((unitPrice / 1000) * weightGrams) : Math.round(unitPrice * weightGrams);
        cart.push({
          productId: prod.id,
          tamilName: prod.tamilName || prod.englishName,
          englishName: prod.englishName || prod.tamilName,
          weightGrams: weightGrams,
          pricePerKg: unitPrice,
          unit: unitStr,
          sellingUnit: unitStr,
          cutStyle: 'Small Pieces',
          category: prod.category || 'meat',
          specialNote: '',
          imageUrl: prod.imageUrl || "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=100&auto=format&fit=crop",
          totalPrice: itemTotal,
          price: itemTotal,
          isFreeDeliveryEligible: Boolean(prod.isFreeDeliveryEligible)
        });
      }

      if (typeof saveCart === "function") {
        saveCart();
      } else {
        if (typeof sanitizeCart === "function") window.cart = sanitizeCart(cart);
        if (typeof saveData === "function") saveData("ek_cart", cart);
        if (typeof updateCartBadge === "function") updateCartBadge();
        if (typeof updateCartUI === "function") updateCartUI();
        if (typeof updateLyoDraftCartBar === "function") updateLyoDraftCartBar();
      }

      const isTa = (typeof currentLang !== "undefined" && currentLang === "ta");
      if (typeof showToast === "function") {
        showToast(
          isTa ? `கார்ட்டில் சேர்க்கப்பட்டது: ${prod.tamilName || prod.englishName}` : `Added to cart: ${prod.englishName || prod.tamilName}`,
          "success"
        );
      }
    }
    window.addLyoCardItemToCart = addLyoCardItemToCart;

    function removeLyoCardItem(proposalId, itemId) {
      let msg = (typeof _lyoChatMessages !== "undefined") ? _lyoChatMessages.find(m => m.proposalId === proposalId || m.id === proposalId) : null;
      if (!msg) msg = (typeof getActiveLyoProposalMsg === "function") ? getActiveLyoProposalMsg() : null;
      if (!msg || !msg.items) return;
      msg.items = msg.items.filter(i => i.id !== itemId);
      if (typeof syncLyoToManualCart === "function") syncLyoToManualCart();
      if (typeof renderLyoAiChat === "function") renderLyoAiChat();
      if (typeof updateLyoDraftCartBar === "function") updateLyoDraftCartBar();
      if (typeof updateCartBadge === "function") updateCartBadge();
      if (typeof updateCartUI === "function") updateCartUI();
      const isTa = (typeof currentLang !== "undefined" && currentLang === "ta");
      if (typeof showToast === "function") {
        showToast(
          isTa ? "பொருள் நீக்கப்பட்டது 🗑️" : "Item removed 🗑️",
          "info"
        );
      }
    }
    window.removeLyoCardItem = removeLyoCardItem;

    function placeLyoProposalOrder(proposalId) {
      window.isLyoAiCheckout = true;
      selectedPaymentMethod = 'Cash on Delivery';

      let proposalMsg = null;
      if (typeof _lyoChatMessages !== 'undefined' && Array.isArray(_lyoChatMessages)) {
        if (proposalId) {
          proposalMsg = _lyoChatMessages.find(m => m.proposalId === proposalId || m.id === proposalId);
        }
        if (!proposalMsg) {
          proposalMsg = getActiveLyoProposalMsg();
        }
      }

      if (proposalMsg && Array.isArray(proposalMsg.items) && proposalMsg.items.length > 0) {
        window.cart = proposalMsg.items.map(it => convertAiItemToManualCartItem(it));
        if (typeof saveCart === "function") {
          saveCart();
        } else {
          if (typeof sanitizeCart === "function") window.cart = sanitizeCart(window.cart);
          if (typeof saveData === "function") saveData("ek_cart", window.cart);
          if (typeof updateCartBadge === "function") updateCartBadge();
        }
      } else if (typeof syncLyoToManualCart === "function") {
        syncLyoToManualCart();
      }

      const items = (typeof cart !== "undefined" && Array.isArray(cart)) ? cart : [];
      const isTa = (typeof currentLang !== "undefined" && currentLang === "ta");
      if (items.length === 0) {
        if (typeof showToast === "function") {
          showToast(isTa ? "கூடை காலியாக உள்ளது!" : "Your cart is empty!", "warning");
        }
        return;
      }

      if (typeof showTab === "function") {
        showTab("tab-cart");
      } else if (typeof showScreen === "function") {
        showScreen("screen-cart");
      }

      if (typeof renderCartScreen === "function") {
        renderCartScreen();
      }

      if (typeof showToast === "function") {
        showToast(isTa ? "கார்ட் திறக்கப்படுகிறது... 🛍️" : "Opening checkout... 🛍️", "success");
      }
    }
    window.placeLyoProposalOrder = placeLyoProposalOrder;

    function addAllLyoProposalToCart(proposalId) {
      let msg = (typeof _lyoChatMessages !== "undefined") ? _lyoChatMessages.find(m => m.proposalId === proposalId || m.id === proposalId) : null;
      if (!msg) msg = (typeof getActiveLyoProposalMsg === "function") ? getActiveLyoProposalMsg() : null;
      if (!msg || !msg.items || msg.items.length === 0) return;

      if (typeof cart === "undefined") window.cart = [];

      msg.items.forEach(it => {
        const pId = it.productId || it.id;
        if (!pId) return;
        const existing = cart.find(c => String(c.productId) === String(pId));
        if (!existing) {
          addLyoCardItemToCart(pId, it.rawQty || 1, it.unit || 'kg');
        }
      });

      if (typeof saveCart === "function") saveCart();

      const isTa = (typeof currentLang !== "undefined" && currentLang === "ta");
      if (typeof showToast === "function") {
        showToast(
          isTa ? "அனைத்து பொருட்களும் கார்ட்டில் உள்ளன! 🛒" : "All items ready in cart! 🛒",
          "success"
        );
      }
    }
    window.addAllLyoProposalToCart = addAllLyoProposalToCart;

    function discardLyoProposal(proposalId) {
      let msg = (typeof _lyoChatMessages !== "undefined") ? _lyoChatMessages.find(m => m.proposalId === proposalId || m.id === proposalId) : null;
      if (!msg) msg = (typeof getActiveLyoProposalMsg === "function") ? getActiveLyoProposalMsg() : null;
      if (msg) {
        msg.items = [];
      }
      persistLyoChatMessages();
      if (typeof syncLyoToManualCart === "function") syncLyoToManualCart();
      if (typeof renderLyoAiChat === "function") renderLyoAiChat();
      if (typeof updateLyoDraftCartBar === "function") updateLyoDraftCartBar();
      if (typeof updateCartBadge === "function") updateCartBadge();
      if (typeof updateCartUI === "function") updateCartUI();
      const isTa = (typeof currentLang !== "undefined" && currentLang === "ta");
      if (typeof showToast === "function") {
        showToast(
          isTa ? "ஆர்டர் ரத்து செய்யப்பட்டது 🗑️" : "Proposal discarded 🗑️",
          "info"
        );
      }
    }
    window.discardLyoProposal = discardLyoProposal;

    function speakLyoMessage(proposalId) {
      let msg = (typeof _lyoChatMessages !== "undefined") ? _lyoChatMessages.find(m => m.proposalId === proposalId || m.id === proposalId) : null;
      if (!msg) msg = (typeof getActiveLyoProposalMsg === "function") ? getActiveLyoProposalMsg() : null;
      const textToSpeak = msg ? msg.text : "வணக்கம்! எக்ஸ்பிரஸ் கிச்சன் Lyo AI உங்களுக்கு சேவை செய்ய தயார்.";
      playLyoSpeech(textToSpeak);
    }
    window.speakLyoMessage = speakLyoMessage;

    function selectLyoProductCandidate(proposalId, productId, rawQtyVal, unitOrAmountType) {
      let msg = (typeof _lyoChatMessages !== "undefined") ? _lyoChatMessages.find(m => m.proposalId === proposalId || m.id === proposalId) : null;
      if (!msg) msg = (typeof getActiveLyoProposalMsg === "function") ? getActiveLyoProposalMsg() : null;
      if (!msg) return;

      const products = (typeof getData === "function") ? getData("ek_products", []) : [];
      const prod = products.find(p => p.id === productId);
      if (!prod) return;

      const isWeight = isUnitWeight(prod.sellingUnit || prod.unit || 'kg');
      const effUnit = (unitOrAmountType === 'g' || unitOrAmountType === 'gm' || unitOrAmountType === 'kg' || unitOrAmountType === 'piece' || unitOrAmountType === 'ml' || unitOrAmountType === 'l')
        ? unitOrAmountType
        : (prod.sellingUnit || prod.unit || 'kg');
      const effAmountType = (unitOrAmountType === 'WEIGHT_GRAMS' || unitOrAmountType === 'WEIGHT_KG' || unitOrAmountType === 'COUNT_PIECES' || unitOrAmountType === 'LIQUID_ML' || unitOrAmountType === 'LIQUID_LITRE')
        ? unitOrAmountType
        : (effUnit === 'g' || effUnit === 'gm' || (isWeight && rawQtyVal > 50) ? 'WEIGHT_GRAMS' : (isWeight ? 'WEIGHT_KG' : 'COUNT_PIECES'));

      const details = (typeof calculateLyoItemDetails === "function")
        ? calculateLyoItemDetails(prod, { rawQtyVal: rawQtyVal || 1, unit: effUnit, amountType: effAmountType, hasExplicitUserUnit: true })
        : { displayQty: `${rawQtyVal}g`, selectorQty: `${rawQtyVal} g`, rawQty: rawQtyVal, itemTotal: 40 };

      const newItem = {
        id: "item_" + Date.now() + "_" + Math.floor(Math.random()*1000),
        productId: prod.id,
        name: prod.englishName || prod.tamilName,
        tamilName: prod.tamilName || prod.englishName,
        displayQty: details.displayQty,
        selectorQty: details.selectorQty,
        rawQty: details.rawQty,
        unit: prod.unit || prod.sellingUnit || effUnit || "kg",
        price: prod.pricePerKg || prod.price || 40,
        itemTotal: details.itemTotal,
        img: prod.imageUrl || "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=100&auto=format&fit=crop"
      };

      if (!msg.items) msg.items = [];
      msg.items.push(newItem);
      msg.lowConfidenceChoices = [];

      if (typeof syncLyoToManualCart === "function") syncLyoToManualCart();
      if (typeof renderLyoAiChat === "function") renderLyoAiChat();
      if (typeof updateLyoDraftCartBar === "function") updateLyoDraftCartBar();
      if (typeof updateCartBadge === "function") updateCartBadge();
      if (typeof updateCartUI === "function") updateCartUI();
    }
    window.selectLyoProductCandidate = selectLyoProductCandidate;


    function promiseWithTimeout(promise, ms = 5000, fallbackValue = null) {
      let timer;
      const timeoutPromise = new Promise((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[Lyo AI Pipeline] Stage exceeded ${ms}ms timeout. Switching to fallback.`);
          resolve(fallbackValue);
        }, ms);
      });
      return Promise.race([
        Promise.resolve(promise).then((res) => { clearTimeout(timer); return res; }).catch((err) => { clearTimeout(timer); throw err; }),
        timeoutPromise
      ]);
    }

    function updateLyoProgressStage(typingId, stepText) {
      const typingMsg = _lyoChatMessages.find(m => m && m.id === typingId);
      if (typingMsg) {
        typingMsg.text = stepText;
        if (typeof renderLyoAiChat === 'function') renderLyoAiChat();
      }
    }

    // Global Pending Clarification State (Generic for all products/variants)
    window._lyoPendingClarification = null;

    // Helper: Find ambiguous candidates generically for ANY product in catalog
    function findGenericAmbiguousCandidates(searchTerm, activeProducts) {
      if (!activeProducts || activeProducts.length < 2) return null;
      const qClean = (searchTerm || '').toLowerCase().trim();
      const qNorm = (typeof normalizeLyoText === 'function') ? normalizeLyoText(qClean) : qClean;
      if (!qNorm || qNorm.length < 2) return null;

      // Filter to available in-stock products
      const availableProds = activeProducts.filter(p => {
        if (!p || p.isActive === false || p.isDeleted === true || p.isOutOfStock === true) return false;
        if (p.stockKg !== undefined && p.stockKg <= 0) return false;
        return true;
      });
      if (availableProds.length < 2) return null;

      // 1. If there's an exact full match to one product name/alias, it's NOT ambiguous
      for (const p of availableProds) {
        const en = (p.englishName || '').toLowerCase().trim();
        const ta = (p.tamilName || '').toLowerCase().trim();
        const enNorm = (typeof normalizeLyoText === 'function') ? normalizeLyoText(en) : en;
        const taNorm = (typeof normalizeLyoText === 'function') ? normalizeLyoText(ta) : ta;
        if (qClean === en || qClean === ta || qNorm === enNorm || qNorm === taNorm) {
          return null; // Exact full match
        }
      }

      // 2. Find all products that match this search term
      const matched = availableProds.filter(p => {
        const en = (p.englishName || '').toLowerCase();
        const ta = (p.tamilName || '').toLowerCase();
        const enNorm = (typeof normalizeLyoText === 'function') ? normalizeLyoText(en) : en;
        const taNorm = (typeof normalizeLyoText === 'function') ? normalizeLyoText(ta) : ta;
        const aliases = getAutoGeneratedProductAliases(p);

        if (enNorm.includes(qNorm) || taNorm.includes(qNorm)) return true;
        return aliases.some(al => {
          const alNorm = (typeof normalizeLyoText === 'function') ? normalizeLyoText(al) : al.toLowerCase();
          return alNorm === qNorm || (qNorm.length >= 3 && alNorm.includes(qNorm));
        });
      });

      if (matched.length >= 2) {
        // Check if query contains unique distinguishing qualifier for one candidate
        let uniquelyQualified = null;
        matched.forEach(cand => {
          const candEn = (cand.englishName || '').toLowerCase();
          const candTa = (cand.tamilName || '').toLowerCase();
          const allCandWords = `${candEn} ${candTa}`.split(/\s+/).filter(w => w.length > 2);
          const uniqueWords = allCandWords.filter(w => {
            return !matched.some(other => {
              if (other.id === cand.id) return false;
              const otherStr = `${other.englishName || ''} ${other.tamilName || ''}`.toLowerCase();
              return otherStr.includes(w);
            });
          });
          if (uniqueWords.some(uw => qNorm.includes(uw))) {
            uniquelyQualified = cand;
          }
        });

        if (uniquelyQualified) {
          return null; // Distinct winner identified by qualifier
        }
        return matched;
      }
      return null;
    }

    // Direct Product Clarification Selector (Instantly updates cart, eliminates loops)
    window.selectLyoResolvedProduct = function(productId, rawQtyVal, unit, amountType) {
      try {
        console.log(`[Lyo AI Direct Resolution] Selecting Product ID: ${productId}, Qty: ${rawQtyVal} ${unit}`);
        const products = (typeof getData === 'function') ? getData('ek_products', []) : [];
        const matchedProd = products.find(p => p.id === productId);
        if (!matchedProd) {
          console.warn("[Lyo AI Direct Resolution] Product not found in catalog for ID:", productId);
          return;
        }

        if (matchedProd.isActive === false || matchedProd.isDeleted === true || matchedProd.isOutOfStock === true || (matchedProd.stockKg !== undefined && matchedProd.stockKg <= 0)) {
          const outMsg = (typeof currentLang !== 'undefined' && currentLang === 'ta')
            ? `மன்னிக்கவும்! ${matchedProd.tamilName || matchedProd.englishName} தற்போது கடையில் கையிருப்பில் இல்லை.`
            : `Sorry, ${matchedProd.englishName || matchedProd.tamilName} is currently out of stock.`;
          if (typeof showToast === 'function') showToast(outMsg, 'warning');
          return;
        }

        const realSellingUnit = String(matchedProd.sellingUnit || matchedProd.unit || 'kg').toLowerCase().trim();
        const isPieceProduct = !isUnitWeight(realSellingUnit);

        let parsedQty = parseFloat(rawQtyVal);
        if (isNaN(parsedQty) || parsedQty <= 0) {
          parsedQty = isPieceProduct ? 1 : 0.5;
        }

        let effAmountType = amountType || (isPieceProduct ? 'COUNT_PIECES' : (unit === 'g' || unit === 'gm' || parsedQty > 50 ? 'WEIGHT_GRAMS' : 'WEIGHT_KG'));
        let effUnit = isPieceProduct ? (matchedProd.sellingUnit || matchedProd.unit || 'piece') : (unit || realSellingUnit || 'kg');

        const calcInput = {
          rawQtyVal: parsedQty,
          amountType: effAmountType,
          unit: effUnit,
          hasExplicitUserUnit: true
        };
        const details = calculateLyoItemDetails(matchedProd, calcInput);

        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let activeProposalMsg = getActiveLyoProposalMsg();
        if (!activeProposalMsg) {
          const proposalId = 'prop_' + Date.now();
          activeProposalMsg = {
            id: 'msg_a_' + Date.now(),
            role: 'assistant',
            isProposal: true,
            text: '',
            time: nowStr,
            proposalId: proposalId,
            items: [],
            deliveryCharge: computeLyoDeliveryCharge(0, []),
            deliveryZone: 'Edappadi Mini Ward (Town Core)',
            isTyping: false
          };
          _lyoChatMessages.push(activeProposalMsg);
        } else {
          _lyoChatMessages = _lyoChatMessages.filter(m => m.id !== activeProposalMsg.id);
          activeProposalMsg.time = nowStr;
          activeProposalMsg.isProposal = true;
          activeProposalMsg.isTyping = false;
          _lyoChatMessages.push(activeProposalMsg);
        }

        const existingItem = activeProposalMsg.items.find(it => it.productId === matchedProd.id);
        if (existingItem) {
          if (isUnitWeight(realSellingUnit)) {
            let currentGrams = (existingItem.unit === 'g' || existingItem.unit === 'gm' || existingItem.unit === 'gram')
              ? (existingItem.rawQty || 0)
              : ((existingItem.rawQty && existingItem.rawQty <= 50) ? existingItem.rawQty * 1000 : (existingItem.rawQty || 0));
            
            let addedGrams = (calcInput.unit === 'g' || calcInput.unit === 'gm' || calcInput.unit === 'gram')
              ? (calcInput.rawQtyVal || 0)
              : ((calcInput.rawQtyVal && calcInput.rawQtyVal <= 50) ? calcInput.rawQtyVal * 1000 : (calcInput.rawQtyVal || 0));

            const combinedGrams = currentGrams + addedGrams;
            let updatedDetails;
            if (combinedGrams >= 1000) {
              updatedDetails = calculateLyoItemDetails(matchedProd, { rawQtyVal: combinedGrams / 1000, amountType: 'WEIGHT_KG', unit: 'kg' });
              existingItem.unit = 'kg';
            } else {
              updatedDetails = calculateLyoItemDetails(matchedProd, { rawQtyVal: combinedGrams, amountType: 'WEIGHT_GRAMS', unit: 'g' });
              existingItem.unit = 'g';
            }
            existingItem.displayQty = updatedDetails.displayQty;
            existingItem.selectorQty = updatedDetails.selectorQty;
            existingItem.rawQty = updatedDetails.rawQty;
            existingItem.itemTotal = updatedDetails.itemTotal;
          } else {
            const newCount = (existingItem.rawQty || 1) + (calcInput.rawQtyVal || 1);
            const updatedDetails = calculateLyoItemDetails(matchedProd, { rawQtyVal: newCount, amountType: 'COUNT_PIECES', unit: matchedProd.sellingUnit || matchedProd.unit || 'pcs' });
            existingItem.displayQty = updatedDetails.displayQty;
            existingItem.selectorQty = updatedDetails.selectorQty;
            existingItem.rawQty = updatedDetails.rawQty;
            existingItem.itemTotal = updatedDetails.itemTotal;
          }
        } else {
          const prodPriceVal = Number(matchedProd.pricePerKg || matchedProd.sellingPrice || matchedProd.price || 40);
          const prodUnitVal = String(matchedProd.sellingUnit || matchedProd.unit || calcInput.unit || 'kg');
          const newCardItemId = 'it_' + matchedProd.id + '_' + Date.now();
          activeProposalMsg.items.push({
            id: newCardItemId,
            productId: matchedProd.id,
            name: matchedProd.englishName || matchedProd.name,
            tamilName: matchedProd.tamilName || '',
            displayQty: details.displayQty,
            selectorQty: details.selectorQty,
            rawQty: details.rawQty,
            unit: prodUnitVal,
            itemTotal: details.itemTotal,
            unitPrice: prodPriceVal,
            price: prodPriceVal,
            imageUrl: matchedProd.imageUrl || matchedProd.image || '',
            isFreeDeliveryEligible: matchedProd.isFreeDeliveryEligible === true
          });
        }

        // Clear pending clarification completely to prevent any loop
        window._lyoPendingClarification = null;

        let proposalSubtotal = 0;
        activeProposalMsg.items.forEach(it => proposalSubtotal += (it.itemTotal || 0));
        activeProposalMsg.deliveryCharge = computeLyoDeliveryCharge(proposalSubtotal, activeProposalMsg.items);

        const prodDisplayName = matchedProd.tamilName || matchedProd.englishName;
        const itemSummaryList = activeProposalMsg.items.map(it => `• **${it.tamilName || it.name}** (${it.displayQty} - ₹${it.itemTotal})`).join('\n');
        activeProposalMsg.text = `நன்றி! உங்கள் விருப்பப்படி **${prodDisplayName}** (${details.displayQty} - ₹${details.itemTotal}) கார்ட்டில் சேர்க்கப்பட்டது! 🥩🛒\n\n**கார்ட்டில் உள்ள பொருட்கள்:**\n${itemSummaryList}`;

        syncLyoToManualCart();
        persistLyoChatMessages();
        renderLyoAiChat();
        updateLyoDraftCartBar();

        const chatContainer = document.getElementById('lyo-ai-messages');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      } catch (e) {
        console.error("[Lyo AI Direct Resolution Error]", e);
      }
    };

    window.resolveLyoAmbiguity = function(productId, rawQtyVal, unit) {
      const activeMsg = getActiveLyoProposalMsg();
      if (activeMsg) {
        selectLyoProductCandidate(activeMsg.proposalId || activeMsg.id, productId, rawQtyVal, unit);
        renderLyoAiChat();
        updateLyoDraftCartBar();
        updateCartBadge();
        if (typeof updateCartUI === "function") updateCartUI();
      }

      // Invalidate the AI parse cache for the original ambiguous query
      const originalQueryKey = (window._lyoPendingClarification ? (window._lyoPendingClarification.originalQuery || window._lyoPendingClarification.searchTerm) : null);
      if (window._aiOrderParseCache) {
        if (originalQueryKey) {
          _aiOrderParseCache.delete(originalQueryKey);
          _aiOrderParseCache.delete(String(originalQueryKey).toLowerCase().trim());
        }
      }
      if (window._lyoPendingClarification) {
        window._lyoPendingClarification = null;
      }
    };

    window.resolveChickenVariant = function(productId, rawQtyVal, unit, amountType) {
      window.resolveLyoAmbiguity(productId, rawQtyVal, unit);
    };

    window.sendLyoAiDirectChoice = function(text) {
      const inputEl = document.getElementById('lyo-ai-input');
      if (inputEl) {
        inputEl.value = text;
        if (typeof onLyoSendBtnClick === 'function') {
          onLyoSendBtnClick();
        }
      }
    };

    function sendLyoAiMessage() {
      return onLyoSendBtnClick();
    }

async function onLyoSendBtnClick() {
  const tStart = performance.now();
  let tempTypingId = 'msg_typing_' + Date.now();

  try {
    const inputEl = document.getElementById('lyo-ai-input');
    if (!inputEl) return;
    const queryText = inputEl.value.trim();
    if (!queryText) return;

    console.log(`[Lyo AI Pipeline] User Message Received: "${queryText}"`);

    inputEl.value = '';
    inputEl.style.height = '24px';
    inputEl.rows = 1;
    inputEl.blur();
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    const composeBox = document.querySelector('#lyo-ai-compose-box');
    if (composeBox) {
      composeBox.style.transform = 'translateY(0)';
    }
    if (typeof autoGrowLyoInput === 'function') autoGrowLyoInput(inputEl);

    // CHECK FOR PENDING CLARIFICATION RESOLUTION FIRST (Bypasses AI loop completely)
    if (window._lyoPendingClarification && window._lyoPendingClarification.candidates && window._lyoPendingClarification.candidates.length > 0) {
      const pending = window._lyoPendingClarification;
      const qNorm = (typeof normalizeLyoText === 'function') ? normalizeLyoText(queryText.toLowerCase()) : queryText.toLowerCase();

      let matchedCand = null;
      for (const cand of pending.candidates) {
        const en = (cand.englishName || '').toLowerCase();
        const ta = (cand.tamilName || '').toLowerCase();
        const enNorm = (typeof normalizeLyoText === 'function') ? normalizeLyoText(en) : en;
        const taNorm = (typeof normalizeLyoText === 'function') ? normalizeLyoText(ta) : ta;
        const aliases = getAutoGeneratedProductAliases(cand);

        if (qNorm === enNorm || qNorm === taNorm || enNorm.includes(qNorm) || taNorm.includes(qNorm) ||
            aliases.some(al => {
              const alNorm = (typeof normalizeLyoText === 'function') ? normalizeLyoText(al) : al.toLowerCase();
              return alNorm === qNorm || (qNorm.length >= 3 && alNorm.includes(qNorm));
            })) {
          matchedCand = cand;
          break;
        }
      }

      // Check for numeric index choice ("1", "2")
      if (!matchedCand) {
        const numChoice = parseInt(queryText.trim(), 10);
        if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= pending.candidates.length) {
          matchedCand = pending.candidates[numChoice - 1];
        }
      }

      if (matchedCand) {
        console.log(`[Lyo AI Pipeline] Pending Clarification Resolved Directly: "${matchedCand.englishName}"`);
        const parsedNew = parseSingleItemText(queryText);
        const resolvedQty = (parsedNew && parsedNew.hasExplicitUserUnit) ? parsedNew.rawQtyVal : pending.rawQtyVal;
        const resolvedUnit = (parsedNew && parsedNew.hasExplicitUserUnit) ? parsedNew.unit : pending.unit;
        const resolvedAmountType = (parsedNew && parsedNew.hasExplicitUserUnit) ? parsedNew.amountType : pending.amountType;

        window._lyoPendingClarification = null;
        selectLyoResolvedProduct(matchedCand.id, resolvedQty, resolvedUnit, resolvedAmountType);
        return;
      } else {
        // User changed topic or asked a new product; reset pending clarification
        window._lyoPendingClarification = null;
      }
    }

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    _lyoChatMessages.push({
      id: 'msg_u_' + Date.now(),
      role: 'user',
      text: queryText,
      time: nowStr
    });

    _lyoChatMessages.push({
      id: tempTypingId,
      role: 'assistant',
      isProposal: false,
      text: '🤖 Lyo AI சிந்திக்கிறது...\n✔ Intent Understood (நோக்கம் உணரப்பட்டது)...',
      time: nowStr,
      isTyping: true,
      items: []
    });

    renderLyoAiChat();
    if (typeof showLyoTransitLoader === 'function') showLyoTransitLoader("Lyo AI பகுப்பாய்வு செய்கிறது... 🥩🥦", 200);

    const activeProducts = (typeof getData === 'function') ? getData('ek_products', []) : [];

    // Stage 1: INTENT CLASSIFICATION
    const stage1Start = performance.now();
    let intentResult = await promiseWithTimeout(
      classifyLyoUserIntent(queryText, activeProducts),
      5000,
      null
    );
    if (!intentResult) {
      console.warn(`[Lyo AI Pipeline] Intent classification timed out (>5s). Falling back to semantic classifier.`);
      intentResult = classifyUserIntentFallback(queryText, activeProducts) || { intent: "GENERAL_QUESTIONS", confidence: 0.9 };
    }
    const stage1Duration = (performance.now() - stage1Start).toFixed(1);
    console.log(`[Lyo AI Pipeline] Intent Detected: ${intentResult.intent} (took ${stage1Duration}ms)`);

    const intent = (intentResult.intent || 'GENERAL_QUESTIONS').toUpperCase();

    if (intent === LYO_INTENTS.SHOPPING_REQUEST) {
      // Step 2: Searching Products
      updateLyoProgressStage(tempTypingId, '🤖 Lyo AI சிந்திக்கிறது...\n✔ Intent Understood (நோக்கம் உணரப்பட்டது)\n✔ Searching Products (பொருட்கள் தேடப்படுகிறது)...');

      // Stage 2: AI ORDER PARSER (with 5s Timeout Protection -> Fallback Catalog Parser)
      const stage2Start = performance.now();
      console.log(`[Lyo AI Pipeline] AI Parser Started`);
      let parsedItems = [];
      try {
        if (typeof parseOrderWithAI === 'function') {
          parsedItems = await promiseWithTimeout(
            parseOrderWithAI(queryText, activeProducts),
            5000,
            null
          );
        }
      } catch (e) {
        console.warn("[Lyo AI Pipeline] AI Parser Exception:", e);
      }

      const stage2Duration = (performance.now() - stage2Start).toFixed(1);
      if (parsedItems && parsedItems.length > 0) {
        console.log(`[Lyo AI Pipeline] AI Parser Finished (took ${stage2Duration}ms)`);
      } else {
        console.log(`[Lyo AI Pipeline] Fallback Started: AI Parser empty/timed out after ${stage2Duration}ms. Running Catalog Fallback Parser.`);
        parsedItems = parseLyoCommerceQuery(queryText);
      }

      // Step 3: Matching Inventory
      updateLyoProgressStage(tempTypingId, '🤖 Lyo AI சிந்திக்கிறது...\n✔ Intent Understood (நோக்கம் உணரப்பட்டது)\n✔ Searching Products (பொருட்கள் தேடப்படுகிறது)\n✔ Matching Inventory (சரக்கு ஒப்பிடுதல்)...');

      // Stage 3: CATALOG & INVENTORY MATCHING ENGINE
      const stage3Start = performance.now();

      let activeProposalMsg = getActiveLyoProposalMsg();
      if (!activeProposalMsg) {
        const proposalId = 'prop_' + Date.now();
        activeProposalMsg = {
          id: 'msg_a_' + Date.now(),
          role: 'assistant',
          isProposal: true,
          text: '',
          time: nowStr,
          proposalId: proposalId,
          items: [],
          deliveryCharge: computeLyoDeliveryCharge(0, []),
          deliveryZone: 'Edappadi Mini Ward (Town Core)',
          isTyping: false
        };
        _lyoChatMessages.push(activeProposalMsg);
      } else {
        _lyoChatMessages = _lyoChatMessages.filter(m => m.id !== activeProposalMsg.id);
        activeProposalMsg.time = nowStr;
        activeProposalMsg.isProposal = true;
        activeProposalMsg.isTyping = false;
        _lyoChatMessages.push(activeProposalMsg);
      }

      const unmatchedTerms = [];
      const ambiguousItems = [];
      let newlyAddedCount = 0;
      let quantityUpdatedCount = 0;

      parsedItems.forEach((parsed) => {
        const searchTerm = parsed.product_name || parsed.productSearchTerm || queryText;
        const cleanSearch = (searchTerm || '').toLowerCase().trim();

        // 1. Generic Ambiguity Check across entire catalog
        const ambiguousCandidates = findGenericAmbiguousCandidates(cleanSearch, activeProducts);

        if (ambiguousCandidates && ambiguousCandidates.length >= 2) {
          const rawQ = parsed.raw_quantity_val || parsed.rawQtyVal || (isUnitWeight(parsed.unit || 'kg') ? 0.5 : 1);
          const uLabel = parsed.unit || (isUnitWeight(parsed.unit || 'kg') ? (rawQ <= 50 ? 'kg' : 'g') : 'piece');
          let qtyDisplay = `${rawQ} ${uLabel}`;
          if (rawQ === 0.5 || (rawQ === 500 && (uLabel === 'g' || uLabel === 'gm'))) qtyDisplay = "500g (அரை கிலோ)";
          else if (rawQ === 0.25 || (rawQ === 250 && (uLabel === 'g' || uLabel === 'gm'))) qtyDisplay = "250g (கால் கிலோ)";
          else if (rawQ === 0.75 || (rawQ === 750 && (uLabel === 'g' || uLabel === 'gm'))) qtyDisplay = "750g (முக்கால் கிலோ)";
          else if (rawQ === 1 && (uLabel === 'kg' || uLabel === 'kilo')) qtyDisplay = "1 Kg (ஒரு கிலோ)";

          ambiguousItems.push({
            searchTerm: searchTerm,
            qtyDisplay: qtyDisplay,
            candidates: ambiguousCandidates,
            rawQtyVal: rawQ,
            unit: uLabel,
            amountType: parsed.amount_type || parsed.amountType,
            hasExplicitUserUnit: parsed.hasExplicitUserUnit
          });
          return;
        }

        const matchResult = matchProductWithConfidence(searchTerm, activeProducts);

        if (matchResult && matchResult.product && (matchResult.score >= 0.3 || activeProducts.length === 1)) {
          const matchedProd = matchResult.product;
          const realSellingUnit = String(matchedProd.sellingUnit || matchedProd.unit || 'kg').toLowerCase().trim();
          const isPieceProduct = !isUnitWeight(realSellingUnit);

          let effectiveAmountType = parsed.amount_type || parsed.amountType || 'WEIGHT_KG';
          let effectiveUnit = matchedProd.sellingUnit || matchedProd.unit || parsed.unit || 'kg';

          if (isPieceProduct && effectiveAmountType !== 'RUPEES' && effectiveAmountType !== 'AMOUNT_RS') {
            parsed.amount_type = 'COUNT_PIECES';
            parsed.amountType = 'COUNT_PIECES';
            parsed.unit = matchedProd.sellingUnit || matchedProd.unit || 'piece';
            effectiveAmountType = 'COUNT_PIECES';
            effectiveUnit = matchedProd.sellingUnit || matchedProd.unit || 'piece';
          }

          const calcInput = {
            rawQtyVal: parsed.raw_quantity_val || parsed.rawQtyVal || 1,
            amountType: effectiveAmountType,
            unit: effectiveUnit,
            hasExplicitUserUnit: parsed.hasExplicitUserUnit
          };
          const details = calculateLyoItemDetails(matchedProd, calcInput);

          const existingItem = activeProposalMsg.items.find(it => it.productId === matchedProd.id);
          if (existingItem) {
            quantityUpdatedCount++;
            if (isUnitWeight(realSellingUnit)) {
              let currentGrams = (existingItem.unit === 'g' || existingItem.unit === 'gm' || existingItem.unit === 'gram')
                ? (existingItem.rawQty || 0)
                : ((existingItem.rawQty && existingItem.rawQty <= 50) ? existingItem.rawQty * 1000 : (existingItem.rawQty || 0));
              
              let addedGrams = (calcInput.unit === 'g' || calcInput.unit === 'gm' || calcInput.unit === 'gram')
                ? (calcInput.rawQtyVal || 0)
                : ((calcInput.rawQtyVal && calcInput.rawQtyVal <= 50) ? calcInput.rawQtyVal * 1000 : (calcInput.rawQtyVal || 0));

              if (calcInput.amountType === 'RUPEES' || calcInput.amountType === 'AMOUNT_RS') {
                addedGrams = details.rawQty <= 50 ? details.rawQty * 1000 : details.rawQty;
              }
              const combinedGrams = currentGrams + addedGrams;
              let updatedDetails;
              if (combinedGrams >= 1000) {
                updatedDetails = calculateLyoItemDetails(matchedProd, { rawQtyVal: combinedGrams / 1000, amountType: 'WEIGHT_KG', unit: 'kg' });
                existingItem.unit = 'kg';
              } else {
                updatedDetails = calculateLyoItemDetails(matchedProd, { rawQtyVal: combinedGrams, amountType: 'WEIGHT_GRAMS', unit: 'g' });
                existingItem.unit = 'g';
              }
              existingItem.displayQty = updatedDetails.displayQty;
              existingItem.selectorQty = updatedDetails.selectorQty;
              existingItem.rawQty = updatedDetails.rawQty;
              existingItem.itemTotal = updatedDetails.itemTotal;
            } else {
              const newCount = (existingItem.rawQty || 1) + (calcInput.rawQtyVal || 1);
              const updatedDetails = calculateLyoItemDetails(matchedProd, { rawQtyVal: newCount, amountType: 'COUNT_PIECES', unit: matchedProd.sellingUnit || matchedProd.unit || 'pcs' });
              existingItem.displayQty = updatedDetails.displayQty;
              existingItem.selectorQty = updatedDetails.selectorQty;
              existingItem.rawQty = updatedDetails.rawQty;
              existingItem.itemTotal = updatedDetails.itemTotal;
            }
          } else {
            newlyAddedCount++;
            const prodPriceVal = Number(matchedProd.pricePerKg || matchedProd.sellingPrice || matchedProd.price || 40);
            const prodUnitVal = String(matchedProd.sellingUnit || matchedProd.unit || calcInput.unit || 'kg');
            const newCardItemId = 'it_' + matchedProd.id + '_' + Date.now();
            activeProposalMsg.items.push({
              id: newCardItemId,
              productId: matchedProd.id,
              name: matchedProd.englishName || matchedProd.name,
              tamilName: matchedProd.tamilName || '',
              displayQty: details.displayQty,
              selectorQty: details.selectorQty,
              rawQty: details.rawQty,
              unit: prodUnitVal,
              itemTotal: details.itemTotal,
              unitPrice: prodPriceVal,
              price: prodPriceVal,
              imageUrl: matchedProd.imageUrl || matchedProd.image || '',
              isFreeDeliveryEligible: matchedProd.isFreeDeliveryEligible === true
            });
          }
        } else {
          unmatchedTerms.push(searchTerm);
        }
      });

      if (parsedItems.length === 0 && ambiguousItems.length === 0) {
        unmatchedTerms.push(queryText);
      }

      // Step 4: Building Cart
      updateLyoProgressStage(tempTypingId, '🤖 Lyo AI சிந்திக்கிறது...\n✔ Intent Understood\n✔ Searching Products\n✔ Matching Inventory\n✔ Building Cart (கார்ட் உருவாக்கப்படுகிறது)...');

      const stage3Duration = (performance.now() - stage3Start).toFixed(1);
      console.log(`[Lyo AI Pipeline] Catalog Match & Inventory Processing (took ${stage3Duration}ms)`);

      // Remove typing indicator BEFORE pushing assistant response
      _lyoChatMessages = _lyoChatMessages.filter(m => m.id !== tempTypingId);

      let proposalSubtotal = 0;
      activeProposalMsg.items.forEach(it => proposalSubtotal += (it.itemTotal || 0));
      activeProposalMsg.deliveryCharge = computeLyoDeliveryCharge(proposalSubtotal, activeProposalMsg.items);

      const itemsChangedThisTurn = (newlyAddedCount > 0 || quantityUpdatedCount > 0);

      // Handle Ambiguous Product Clarification Prompt
      if (ambiguousItems.length > 0 && !itemsChangedThisTurn) {
        _lyoChatMessages = _lyoChatMessages.filter(m => m.id !== activeProposalMsg.id);
        const amb = ambiguousItems[0];

        // Store pending clarification state so user button click or text choice directly resolves
        window._lyoPendingClarification = {
          rawQtyVal: amb.rawQtyVal,
          unit: amb.unit,
          amountType: amb.amountType,
          hasExplicitUserUnit: amb.hasExplicitUserUnit,
          candidates: amb.candidates,
          searchTerm: amb.searchTerm
        };

        const candidateButtons = amb.candidates.map(p => {
          const pNameEng = p.englishName || p.name || '';
          const pNameTa = p.tamilName || p.englishName || '';
          const pNameDisplay = pNameTa ? `${pNameTa} (${pNameEng})` : pNameEng;
          
          let icon = '🛒';
          const cat = (p.category || '').toLowerCase();
          const pNorm = (pNameEng + ' ' + pNameTa).toLowerCase();
          if (pNorm.includes('country') || pNorm.includes('nattu') || pNorm.includes('நாட்டு')) icon = '🐓';
          else if (pNorm.includes('chicken') || pNorm.includes('broiler') || pNorm.includes('கோழி') || pNorm.includes('சிக்கன்')) icon = '🐔';
          else if (pNorm.includes('mutton') || pNorm.includes('ஆட்டு') || pNorm.includes('தலை')) icon = '🥩';
          else if (pNorm.includes('egg') || pNorm.includes('முட்டை')) icon = '🥚';
          else if (pNorm.includes('fish') || pNorm.includes('மீன்')) icon = '🐟';
          else if (pNorm.includes('oil') || pNorm.includes('எண்ணெய்')) icon = '🧴';
          else if (pNorm.includes('rice') || pNorm.includes('அரிசி')) icon = '🌾';

          const pPrice = Number(p.pricePerKg || p.sellingPrice || p.price || 0);
          const pUnit = p.sellingUnit || p.unit || 'kg';
          const isWeight = isUnitWeight(pUnit);
          const calcQty = amb.rawQtyVal || (isWeight ? 0.5 : 1);
          const calcUnit = amb.unit || (isWeight ? (calcQty <= 50 ? 'kg' : 'g') : pUnit);
          const itemTotal = isWeight
            ? Math.round((pPrice / (calcUnit === 'g' || calcUnit === 'gm' ? 1000 : 1)) * calcQty)
            : Math.round(pPrice * calcQty);

          const safeUnit = (calcUnit || 'kg').replace(/'/g, "\\'");
          const safeAmountType = (amb.amountType || (isWeight ? 'WEIGHT_GRAMS' : 'COUNT_PIECES')).replace(/'/g, "\\'");

          return `<button type="button" class="btn-ripple" onclick="resolveLyoAmbiguity('${p.id}', ${amb.rawQtyVal}, '${amb.unit}')" style="background: rgba(16,185,129,0.18); border: 1.5px solid #10b981; color: #ffffff; padding: 10px 14px; border-radius: 12px; font-weight: 700; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.35); transition: transform 0.15s, background 0.2s;">
            <span style="font-size: 16px;">${icon}</span>
            <span>${pNameDisplay} <strong style="color: #6ee7b7;">(${amb.qtyDisplay} - ₹${itemTotal})</strong></span>
          </button>`;
        }).join('');

        _lyoChatMessages.push({
          id: 'msg_a_' + Date.now(),
          role: 'assistant',
          isProposal: false,
          text: `நீங்கள் **${amb.qtyDisplay} ${amb.searchTerm}** கேட்டுள்ளீர்கள்.\n\nதயவுசெய்து நீங்கள் விரும்பும் வகையைத் தேர்ந்தெடுக்கவும்:`,
          actionHtml: `<div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">${candidateButtons}</div>`,
          time: nowStr,
          items: []
        });
        console.log(`[Lyo AI Pipeline] Proposal Generated: Intelligent Ambiguous Clarification Prompt with Direct Resolution Buttons`);
      } else if (activeProposalMsg.items.length > 0 && itemsChangedThisTurn) {
        if (ambiguousItems.length > 0) {
          const amb = ambiguousItems[0];
          activeProposalMsg.lowConfidenceChoices = (amb.candidates || []).map(c => ({
            product: c,
            rawQtyVal: amb.rawQtyVal,
            amountType: amb.amountType
          }));
        }
        const itemSummaryList = activeProposalMsg.items.map(it => `• **${it.tamilName || it.name}** (${it.displayQty} - ₹${it.itemTotal})`).join('\n');
        let headerText = "நன்றி! உங்கள் கட்டளைப்படி பொருட்கள் கார்ட்டில் சேர்க்கப்பட்டன! 🥩🛒\n\n";
        let mainText = `${headerText}${itemSummaryList}`;
        if (unmatchedTerms.length > 0) {
          const uniqueUnmatched = [...new Set(unmatchedTerms)].map(u => `'${u}'`).join(', ');
          mainText += `\n\n⚠️ **கவனிக்கவும் (Note):**\nதங்கள் செய்தியில் உள்ள **${uniqueUnmatched}** என்ற பொருளை எங்களால் சேர்க்க முடியவில்லை / அடையாளம் காண முடியவில்லை. தயவுசெய்து சரியான பெயர் அல்லது அளவைக் குறிப்பிடவும்.`;
        }
        activeProposalMsg.text = mainText;
        console.log(`[Lyo AI Pipeline] Proposal Generated: Cart Updated (${activeProposalMsg.items.length} items)`);
      } else if (activeProposalMsg.items.length > 0 && !itemsChangedThisTurn) {
        const itemSummaryList = activeProposalMsg.items.map(it => `• **${it.tamilName || it.name}** (${it.displayQty} - ₹${it.itemTotal})`).join('\n');
        const uniqueUnmatched = [...new Set(unmatchedTerms)].map(u => `'${u}'`).join(', ');
        activeProposalMsg.text = `மன்னிக்கவும், நீங்கள் குறிப்பிட்ட **${uniqueUnmatched || `'${queryText}'`}** என்ற பொருளை அடையாளம் காணவோ கார்ட்டில் சேர்க்கவோ முடியவில்லை. 🛒\n\nதயவுசெய்து சரியான பொருள் பெயர் அல்லது அளவைக் குறிப்பிடவும் (எ.கா: '1 கிலோ தக்காளி').\n\n**தங்கள் கார்ட்டில் உள்ள பொருட்கள்:**\n${itemSummaryList}`;
        console.log(`[Lyo AI Pipeline] Proposal Generated: Existing Cart Retained`);
      } else {
        _lyoChatMessages = _lyoChatMessages.filter(m => m.id !== activeProposalMsg.id);
        const uniqueUnmatched = [...new Set(unmatchedTerms)].map(u => `'${u}'`).join(', ');
        _lyoChatMessages.push({
          id: 'msg_a_' + Date.now(),
          role: 'assistant',
          isProposal: false,
          text: `மன்னிக்கவும், ${uniqueUnmatched || `'${queryText}'`} குறித்த பொருட்கள் நமது கடையில் தற்போது இருப்பில் இல்லை அல்லது அடையாளம் காண முடியவில்லை. 🛒\n\nதயவுசெய்து சரியான பொருள் பெயர் அல்லது அளவைக் குறிப்பிடவும் (எ.கா: '1 கிலோ தக்காளி').\n\nஎங்களிடம் ஆட்டுக்கறி, ஆட்டுத் தலைக்கறி, பிராய்லர் சிக்கன், நாட்டுக்கோழி, தக்காளி, உருளைக்கிழங்கு, முட்டை போன்ற பொருட்கள் உள்ளன.`,
          time: nowStr,
          items: []
        });
        console.log(`[Lyo AI Pipeline] Proposal Generated: Catalog Fallback Clarification`);
      }

      syncLyoToManualCart();
      console.log(`[Lyo AI Pipeline] Cart Updated`);
    } else {
      // NON-SHOPPING REQUEST
      _lyoChatMessages = _lyoChatMessages.filter(m => m.id !== tempTypingId);
      const responseObj = getNonShoppingResponse(intent, queryText, intentResult.responseText, activeProducts);
      _lyoChatMessages.push({
        id: 'msg_a_' + Date.now(),
        role: 'assistant',
        isProposal: false,
        text: responseObj.text,
        actionHtml: responseObj.actionHtml || '',
        time: nowStr,
        items: []
      });
    }

  } catch (err) {
    const errStatus = err.status || err.statusCode || (err.message && err.message.match(/HTTP (\d+)/) ? parseInt(err.message.match(/HTTP (\d+)/)[1]) : null);
    const errProvider = (err.provider || 'AI Provider').toUpperCase();
    const errDetails = err.details || err.message || String(err);
    
    console.error(`[Lyo AI Pipeline Error Diagnostic] Execution Error: Provider=${errProvider}, Status=${errStatus || 'N/A'}, Details=${errDetails}`, err);
    
    _lyoChatMessages = _lyoChatMessages.filter(m => m && m.id !== tempTypingId);

    const isApiKeyError = errStatus === 401 || errStatus === 403 || (errStatus === 400 && (errDetails.includes('API key') || errDetails.includes('API_KEY_INVALID') || errDetails.includes('invalid')));
    const isQuotaError = errStatus === 429 || errDetails.includes('quota') || errDetails.includes('rate limit');

    let userFacingText = "";
    if (isApiKeyError) {
      userFacingText = `⚠️ **AI Service Configuration Issue**\n\nAI சாவி உள்ளமைப்பில் தவறு உள்ளது (${errProvider} Error ${errStatus || '400/401'}: Invalid API Key).\n\n**கடை உரிமையாளர் கவனத்திற்கு:** தயவுசெய்து **Admin > AI Key** பக்கத்திற்கு சென்று சரியான API சாவி அல்லது மாதிரியைப் புதுப்பிக்கவும்.`;
    } else if (isQuotaError) {
      userFacingText = `⚡ **AI Service Temporarily Unavailable**\n\nAI சேவை தற்காலிகமாக பிஸியாக உள்ளது (${errProvider} Error 429: Rate Limit / Quota Exceeded).\n\nஉங்கள் எளிய தேவைகள் உள்ளூர் தயாரிப்புப் பட்டியல் மூலம் தொடர்ந்து செயலாக்கப்படும்.`;
    } else {
      userFacingText = `மன்னிக்கவும்! தொடர்புகொள்வதில் சிறு தடங்கல் ஏற்பட்டது (${errProvider} ${errStatus ? 'Status ' + errStatus : ''}). 🛒✨\n\nதயவுசெய்து மீண்டும் முயற்சிக்கவும் (எ.கா: "500g சிக்கன்", "1kg தக்காளி").`;
    }
    
    _lyoChatMessages.push({
      id: 'msg_err_' + Date.now(),
      role: 'assistant',
      isProposal: false,
      text: userFacingText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: []
    });
  } finally {
    // ALWAYS clean up typing indicator in case any edge case missed it
    _lyoChatMessages = _lyoChatMessages.filter(m => m && m.id !== tempTypingId && !m.isTyping);
    if (typeof hideLyoTransitLoader === 'function') hideLyoTransitLoader();
    if (typeof persistLyoChatMessages === 'function') persistLyoChatMessages();
    if (typeof renderLyoAiChat === 'function') renderLyoAiChat();
    
    const totalDuration = (performance.now() - tStart).toFixed(1);
    console.log(`[Lyo AI Pipeline] Render Finished (total execution took ${totalDuration}ms)`);

    const chatContainer = document.getElementById('lyo-ai-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
}

// Explicit Window Bindings for Lyo AI UI Actions
if (typeof window !== 'undefined') {
  if (typeof toggleGmailPassVisibility === 'function') window.toggleGmailPassVisibility = toggleGmailPassVisibility;
  if (typeof saveAdminEmailOtpConfig === 'function') window.saveAdminEmailOtpConfig = saveAdminEmailOtpConfig;
  if (typeof testAdminAiKey === 'function') window.testAdminAiKey = testAdminAiKey;
  if (typeof sendQuickLyoQuery === 'function') window.sendQuickLyoQuery = sendQuickLyoQuery;
  if (typeof toggleLyoAiLang === 'function') window.toggleLyoAiLang = toggleLyoAiLang;
  if (typeof clearLyoAiCart === 'function') window.clearLyoAiCart = clearLyoAiCart;
  if (typeof checkoutLyoAiOrder === 'function') window.checkoutLyoAiOrder = checkoutLyoAiOrder;
  if (typeof onLyoSendBtnClick === 'function') window.onLyoSendBtnClick = onLyoSendBtnClick;
}