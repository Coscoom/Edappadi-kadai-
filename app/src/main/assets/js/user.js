
    function getActiveSession() {
      const perm = getData('ek_customer_session', null);
      if (perm) return perm;
      const temp = sessionStorage.getItem('ek_customer_session_temp');
      return temp ? JSON.parse(temp) : null;
    }

    function enforceSingleSessionCheck(cloudUser) {
      const currentSession = getActiveSession();
      if (!currentSession || !currentSession.loggedIn || currentSession.userId !== cloudUser.id) {
        return;
      }

      const lang = localStorage.getItem('ek_lang') || 'ta';

      if (!currentSession.sessionToken) {
        const uniqueSessionToken = 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
        currentSession.sessionToken = uniqueSessionToken;
        saveData('ek_customer_session', currentSession);

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_users').doc(cloudUser.id).update({
            activeSessionToken: uniqueSessionToken
          }).catch(err => console.error("Error setting initial session token in Firestore:", err));
        }
        return;
      }

      if (cloudUser.activeSessionToken && cloudUser.activeSessionToken !== currentSession.sessionToken) {
        console.warn("[Session Enforce] Terminating session. Logged in on another device.");

        removeData('ek_customer_session');
        sessionStorage.removeItem('ek_customer_session_temp');

        if (typeof firebase !== 'undefined' && firebase.auth) {
          firebase.auth().signOut().catch(e => console.error(e));
        }

        showScreen('screen-login');

        showCustomAlert(
          lang === 'ta' ? "⚠️ மற்ற சாதனத்தில் லாகின்" : "⚠️ Logged in on another device",
          lang === 'ta'
            ? "உங்கள் கணக்கு மற்றொரு மொபைலில் உள்நுழையப்பட்டுள்ளது. எனவே இந்த மொபைலில் இருந்து தானாக லாக் அவுட் செய்யப்பட்டுள்ளது."
            : "Your account was logged in on another device. You have been automatically logged out from this device."
        );
      }
    }

    function getActiveUser() {
      const session = getActiveSession();
      if (!session) return null;

      const users = getData('ek_users', []);
      let user = users.find(u => u.id === session.userId);
      if (!user && session.phone) {
        user = users.find(u => u.phone === session.phone);
        if (user) {
          session.userId = user.id;
          if (getData('ek_customer_session', null)) {
            saveData('ek_customer_session', session);
          } else if (sessionStorage.getItem('ek_customer_session_temp')) {
            sessionStorage.setItem('ek_customer_session_temp', JSON.stringify(session));
          }
        }
      }
      if (!user && session.email) {
        user = users.find(u => u.email && u.email.toLowerCase() === session.email.toLowerCase());
        if (user) {
          session.userId = user.id;
          if (getData('ek_customer_session', null)) {
            saveData('ek_customer_session', session);
          } else if (sessionStorage.getItem('ek_customer_session_temp')) {
            sessionStorage.setItem('ek_customer_session_temp', JSON.stringify(session));
          }
        }
      }

      if (!user) {
        if (session.userId && (session.userId.startsWith('admin_') || session.userId.includes('admin') || session.userId.startsWith('rider_') || session.userId.includes('rider') || session.userId.includes('deliv'))) {
          console.warn("[getActiveUser] Blocked fallback customer creation for staff/admin user ID:", session.userId);
          return null;
        }
        user = {
          id: session.userId || 'cust_' + Math.floor(100000 + Math.random() * 900000),
          name: session.name || "Customer / வாடிக்கையாளர்",
          phone: session.phone || "",
          email: "",
          loyaltyPoints: 10,
          tier: 'bronze',
          joinedAt: new Date().toISOString(),
          defaultCut: 'Small Pieces',
          whatsappNotify: true,
          address: ''
        };
        users.push(user);
        saveData('ek_users', users);
        if (typeof db !== 'undefined' && db) {
          db.collection('ek_users').doc(user.id).set(user).catch(err => console.error(err));
        }
      }

      if (user) {
        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getFcmToken === 'function') {
          const currentFcmToken = AndroidStorage.getFcmToken();
          if (currentFcmToken && user.fcmToken !== currentFcmToken) {
            user.fcmToken = currentFcmToken;
            user.updatedAt = new Date().toISOString();

            const userIdx = users.findIndex(u => u.id === user.id);
            if (userIdx !== -1) {
              users[userIdx] = user;
              saveData('ek_users', users);
            }

            if (typeof db !== 'undefined' && db) {
              db.collection('ek_users').doc(user.id).update({
                fcmToken: currentFcmToken,
                updatedAt: user.updatedAt
              }).then(() => {
                debugLog(`[FCM Sync] User's Firebase registration token registered in Cloud: ${currentFcmToken}`);
              }).catch(err => {
                db.collection('ek_users').doc(user.id).set(user, { merge: true })
                  .then(() => debugLog("[FCM Sync] User token merged in Cloud collections successfully"))
                  .catch(e => console.warn("[FCM Sync] Firestore merge failed:", e));
              });
            }
          }
        }
      }

      return user;
    }

    function showInteractiveLocationSection() {
      const interactiveEl = document.getElementById('cart-location-interactive-section');
      const summaryEl = document.getElementById('cart-location-summary-section');
      if (interactiveEl) interactiveEl.style.display = 'none';
      if (summaryEl) summaryEl.style.display = 'none';
    }

    function hideInteractiveLocationSection() {
      const interactiveEl = document.getElementById('cart-location-interactive-section');
      const summaryEl = document.getElementById('cart-location-summary-section');
      if (interactiveEl) interactiveEl.style.display = 'none';
      if (summaryEl) summaryEl.style.display = 'none';
    }

    function formatAddressMultiLine(customerName, addressStr, distanceVal) {
      if (!addressStr) return '-';

      let cleanAddress = addressStr.replace(/Lat:\s*[-+]?[0-9]*\.?[0-9]+/gi, '')
                                    .replace(/Lng:\s*[-+]?[0-9]*\.?[0-9]+/gi, '')
                                    .replace(/Latitude:\s*[-+]?[0-9]*\.?[0-9]+/gi, '')
                                    .replace(/Longitude:\s*[-+]?[0-9]*\.?[0-9]+/gi, '')
                                    .replace(/@\s*[-+]?[0-9]*\.?[0-9]+,\s*[-+]?[0-9]*\.?[0-9]+/gi, '')
                                    .replace(/\(\s*[-+]?[0-9]*\.?[0-9]+,\s*[-+]?[0-9]*\.?[0-9]+\)/gi, '')
                                    .trim();

      cleanAddress = cleanAddress.replace(/,(\s*,)+/g, ',').replace(/^,|,$/g, '').trim();

      let parts = cleanAddress.split(',').map(p => p.trim()).filter(p => p.length > 0);

      let html = `<div class="address-container" style="display: flex; flex-direction: column; gap: 4px; font-family: inherit; line-height: 1.5; color: #fff; width: 100%;">`;

      if (customerName) {
        html += `<div class="address-row customer-name" style="font-size: 13px; font-weight: 800; color: var(--accent-orange); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">👤 ${customerName}</div>`;
      }

      parts.forEach((part, index) => {
        const isPincode = /pincode|pin\s*code|postal|^\d{6}$/i.test(part);
        const icon = isPincode ? '📮' : (index === 0 ? '🏠' : '📍');

        html += `<div class="address-row" style="font-size: 12px; font-weight: 600; color: #e5e7eb; display: flex; align-items: flex-start; gap: 8px; word-break: break-word;">
                  <span style="opacity: 0.8; font-size: 12px; min-width: 16px; text-align: center;">${icon}</span>
                  <span style="flex: 1;">${part}</span>
                </div>`;
      });

      if (distanceVal !== null && distanceVal !== undefined) {
        const formattedDistance = typeof distanceVal === 'number' ? distanceVal.toFixed(2) : distanceVal;
        html += `<div class="address-row distance-info" style="font-size: 12px; font-weight: 800; color: #10b981; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 6px; margin-top: 6px; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 12px; min-width: 16px; text-align: center;">⚡</span>
                  <span>Distance: ${formattedDistance} km</span>
                </div>`;
      }

      html += `</div>`;
      return html;
    }

    function updateCartAddressSummary(address, distance = null) {
      const summaryTextEl = document.getElementById('cart-summary-address-text');
      if (!summaryTextEl) return;

      const user = getActiveUser() || {};
      const name = user.name || "Customer";

      let distVal = distance;
      if (distVal === null) {
        const distBadge = document.getElementById('distance-indicator-badge');
        if (distBadge && distBadge.style.display !== 'none') {
          const m = distBadge.innerText.match(/([0-9.]+)\s*km/i);
          if (m) distVal = parseFloat(m[1]);
        }
      }

      summaryTextEl.innerHTML = formatAddressMultiLine(name, address, distVal);
    }

    function parseAddressStringToFields(addressStr) {
      const fields = {
        houseNo: '',
        street: '',
        area: '',
        landmark: '',
        city: 'Edappadi',
        district: 'Salem',
        pincode: '637101'
      };

      if (!addressStr) {
        return fields;
      }

      try {
        if (addressStr.startsWith('{') && addressStr.endsWith('}')) {
          const parsed = JSON.parse(addressStr);
          if (parsed.houseNo || parsed.street) {
            return {
              houseNo: parsed.houseNo || '',
              street: parsed.street || '',
              area: parsed.area || '',
              landmark: parsed.landmark || '',
              city: parsed.city || 'Edappadi',
              district: parsed.district || 'Salem',
              pincode: parsed.pincode || '637101'
            };
          }
        }
      } catch (e) {}

      let cleanStr = addressStr
        .replace(/Selected Delivery Location:?\s*/gi, '')
        .replace(/Latitude:?\s*[-+]?[0-9]*\.?[0-9]+/gi, '')
        .replace(/Longitude:?\s*[-+]?[0-9]*\.?[0-9]+/gi, '')
        .replace(/\b[0-9]+\.[0-9]{4,},\s*[0-9]+\.[0-9]{4,}\b/gi, '') // raw coordinates
        .replace(/\((.*?)\)/g, '') // remove text in parenthesis
        .trim();

      const parts = cleanStr.split(',').map(s => s.trim()).filter(Boolean);

      if (parts.length > 0) {
        let pincodeFound = '';
        for (let i = 0; i < parts.length; i++) {
          const pinMatch = parts[i].match(/\b\d{6}\b/);
          if (pinMatch) {
            pincodeFound = pinMatch[0];
            parts[i] = parts[i].replace(/\b\d{6}\b/, '').replace(/-\s*$/, '').replace(/–\s*$/, '').trim();
            break;
          }
        }
        if (pincodeFound) {
          fields.pincode = pincodeFound;
        }

        const cleanParts = parts.map(p => p.trim()).filter(Boolean);

        if (cleanParts.length === 1) {
          fields.street = cleanParts[0];
        } else if (cleanParts.length === 2) {
          fields.street = cleanParts[0];
          fields.area = cleanParts[1];
        } else if (cleanParts.length === 3) {
          fields.street = cleanParts[0];
          fields.area = cleanParts[1];
          fields.city = cleanParts[2];
        } else if (cleanParts.length >= 4) {
          if (cleanParts[0].match(/^\d+[\/\d-A-Za-z]*$/)) {
            fields.houseNo = cleanParts[0];
            fields.street = cleanParts[1];
            fields.area = cleanParts[2];
            fields.city = cleanParts[3];
            if (cleanParts[4]) fields.landmark = cleanParts[4];
          } else {
            fields.street = cleanParts[0];
            fields.area = cleanParts[1];

            const lowerThird = cleanParts[2].toLowerCase();
            if (lowerThird.includes('near') || lowerThird.includes('opposite') || lowerThird.includes('behind') || lowerThird.includes('beside')) {
              fields.landmark = cleanParts[2];
              fields.city = cleanParts[3] || 'Edappadi';
              if (cleanParts[4]) fields.district = cleanParts[4];
            } else {
              fields.area = cleanParts[1];
              fields.city = cleanParts[2];
              fields.district = cleanParts[3] || 'Salem';
              if (cleanParts[4]) fields.landmark = cleanParts[4];
            }
          }
        }
      }

      if (!fields.street && cleanStr) {
        fields.street = cleanStr;
      }
      if (!fields.city) fields.city = 'Edappadi';
      if (!fields.district) fields.district = 'Salem';
      if (!fields.pincode) fields.pincode = '637101';

      ['houseNo', 'street', 'area', 'landmark', 'city', 'district', 'pincode'].forEach(k => {
        if (fields[k]) {
          fields[k] = fields[k].replace(/,$/, '').trim();
        }
      });

      return fields;
    }

    function formatAddressStringToPostal(addressStr) {
      const fields = parseAddressStringToFields(addressStr);

      let lines = [];

      let streetLine = '';
      if (fields.houseNo) {
        streetLine += fields.houseNo + ' ';
      }
      streetLine += fields.street;
      if (streetLine) {
        streetLine = streetLine.replace(/,$/, '') + ',';
        lines.push(streetLine);
      }

      let areaLine = fields.area || 'Kavandampatti';
      if (areaLine) {
        areaLine = areaLine.replace(/,$/, '') + ',';
        lines.push(areaLine);
      }

      let cityDistPinLine = '';
      if (fields.city) {
        cityDistPinLine += fields.city;
      }
      let districtVal = fields.district || 'Salem';
      if (districtVal) {
        if (cityDistPinLine) cityDistPinLine += ', ';
        cityDistPinLine += districtVal;
      }
      if (fields.pincode) {
        cityDistPinLine += ' – ' + fields.pincode;
      }
      if (cityDistPinLine) {
        lines.push(cityDistPinLine);
      }

      let html = `<div style="font-size: 13.5px; font-weight: 600; color: #f3f4f6; line-height: 1.5; word-break: break-word; font-family: 'Poppins', sans-serif;">${lines.join('<br>')}</div>`;

      if (fields.landmark) {
        let landmarkText = fields.landmark;
        if (!landmarkText.toLowerCase().startsWith('near')) {
          landmarkText = 'Near: ' + landmarkText;
        }
        html += `<div style="font-size: 12.5px; font-weight: 500; color: #9ca3af; line-height: 1.4; margin-top: 6px; word-break: break-word; font-family: 'Poppins', sans-serif;">${landmarkText}</div>`;
      }

      return html;
    }

    function buildAddressString(fields) {
      const parts = [];
      if (fields.houseNo) parts.push(fields.houseNo);
      if (fields.street) parts.push(fields.street);
      if (fields.landmark) parts.push(fields.landmark);

      let areaPart = fields.area || 'Edappadi';
      if (fields.pincode) {
        areaPart += ` - ${fields.pincode}`;
      }
      parts.push(areaPart);
      if (fields.city) parts.push(fields.city);

      return parts.join(', ');
    }

    window.selectAddressInEditor = function(addrId) {
      if (!addrId) return;
      const user = getActiveUser();
      if (!user) return;
      const saved = user.savedAddresses || [];
      const found = saved.find(item => item.id === addrId);
      if (!found) return;

      syncPrimaryUserAddress(found.address, found.latitude, found.longitude);
      renderAllAddressCards();

      const modal = document.getElementById('simple-address-editor-modal');
      if (modal) {
        openSimpleAddressEditor(addrId);
      }

      showToast(currentLang === 'ta' ? "முகவரி மாற்றப்பட்டது! 🎯" : "Address switched! 🎯", "success");
    };

    function openSimpleAddressEditor(addressIdToEdit = null, mode = 'edit') {
      const user = getActiveUser() || {};
      const saved = user.savedAddresses || [];

      let targetItem = null;
      if (mode === 'new') {
        window._activeEditingAddressId = null;
      } else if (addressIdToEdit) {
        targetItem = saved.find(a => a.id === addressIdToEdit);
        window._activeEditingAddressId = addressIdToEdit;
      } else {
        targetItem = saved.find(a => a.address === user.address) || (saved.length > 0 ? saved[0] : null);
        window._activeEditingAddressId = targetItem ? targetItem.id : null;
      }

      const currentAddress = (targetItem && mode !== 'new') ? targetItem.address : (mode === 'new' ? '' : (user.address || ''));
      const fields = parseAddressStringToFields(currentAddress);
      const targetLabel = (targetItem && mode !== 'new') ? (targetItem.label || 'Home 🏠') : 'Home 🏠';

      const oldModal = document.getElementById('simple-address-editor-modal');
      if (oldModal) oldModal.remove();

      const modal = document.createElement('div');
      modal.id = 'simple-address-editor-modal';
      modal.className = 'modal-backdrop';
      modal.style.zIndex = '99999';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      modal.style.padding = '14px 10px';

      // Saved Addresses list
      let savedAddressesListHtml = '';
      if (saved.length > 0) {
        savedAddressesListHtml = `
          <div style="display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px; width: 100%; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span style="font-size: 11px; font-weight: 800; color: var(--accent-orange); text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Poppins', sans-serif;">
                ${currentLang === 'ta' ? 'சேமித்த முகவரிகள்' : 'Saved Addresses'} (${saved.length})
              </span>
              <button type="button" onclick="openSimpleAddressEditor(null, 'new')" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 8px; color: #10b981; font-size: 11px; font-weight: 800; padding: 4px 10px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <span>➕</span> <span>${currentLang === 'ta' ? 'புதிய முகவரி' : 'Add New'}</span>
              </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 140px; overflow-y: auto; padding-right: 2px; width: 100%; box-sizing: border-box;">
        `;
        saved.forEach(item => {
          const isSelected = (window._activeEditingAddressId === item.id);
          const isPrimary = (user.address === item.address);
          const borderStyle = isSelected ? 'border: 1.5px solid var(--accent-orange); background: rgba(249, 115, 22, 0.08);' : 'border: 1.2px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);';
          const indicatorHtml = isPrimary ? '<span style="font-size: 11px; background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 6px; border-radius: 6px; font-weight: 800; white-space: nowrap;">Primary 🏠</span>' : '';

          const postalFields = parseAddressStringToFields(item.address);
          let postalStr = `${postalFields.houseNo ? postalFields.houseNo + ', ' : ''}${postalFields.street}, ${postalFields.area}, ${postalFields.city} – ${postalFields.pincode}`;

          savedAddressesListHtml += `
            <div onclick="openSimpleAddressEditor('${item.id}')" style="padding: 10px 12px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; transition: all 0.2s; cursor: pointer; box-sizing: border-box; width: 100%; text-align: left; ${borderStyle}">
              <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 12px; font-weight: 800; color: #ffffff; font-family: 'Poppins', sans-serif;">${item.label}</span>
                  ${indicatorHtml}
                </div>
                <span style="font-size: 11px; color: #9ca3af; font-weight: 500; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${postalStr}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;" onclick="event.stopPropagation();">
                <button type="button" onclick="selectAddressInEditor('${item.id}')" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #ffffff; font-size: 10.5px; font-weight: 700; padding: 4px 8px; cursor: pointer;" title="Make Primary">
                  ${isPrimary ? 'Active ✓' : 'Use'}
                </button>
                ${saved.length > 1 ? `
                  <button type="button" onclick="deleteSavedAddress('${item.id}'); openSimpleAddressEditor();" style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; color: #ef4444; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer;" title="Delete">🗑️</button>
                ` : ''}
              </div>
            </div>
          `;
        });
        savedAddressesListHtml += `
            </div>
          </div>
        `;
      }

      const isEditingExisting = !!(window._activeEditingAddressId && mode !== 'new');
      const modeHeader = isEditingExisting ? `✏️ ${currentLang === 'ta' ? 'முகவரியை மாற்றுதல்' : 'Editing'}: ${targetLabel}` : `➕ ${currentLang === 'ta' ? 'புதிய முகவரி சேர்த்தல்' : 'Add New Address'}`;

      modal.innerHTML = `
        <div class="bottom-sheet" style="width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; border-radius: 24px; border: 1.5px solid rgba(255,255,255,0.08); background: #0c0d12; padding: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); transform: translateY(100px); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; text-align: left;">

          <!-- Top Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">📍</span>
              <h3 style="color: #ffffff; font-size: 14.5px; font-weight: 800; margin: 0; font-family: 'Poppins', 'Hind Madurai', sans-serif; letter-spacing: 0.3px;">
                ${currentLang === 'ta' ? 'தொடர்பு & விநியோக முகவரி' : 'CONTACT & DELIVERY DETAILS'}
              </h3>
            </div>
            <button onclick="closeSimpleAddressEditor()" style="background: transparent; border: none; color: #9ca3af; font-size: 18px; cursor: pointer; padding: 4px;">✕</button>
          </div>

          <!-- Customer Contact Details (clean, dedicated full-width rows) -->
          <div style="display: flex; flex-direction: column; gap: 10px; padding: 14px; background: rgba(255,255,255,0.02); border: 1.2px solid rgba(255,255,255,0.08); border-radius: 16px; width: 100%; box-sizing: border-box;">
            <div style="font-size: 11px; font-weight: 800; color: var(--accent-orange); text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <span>👤</span> <span>${currentLang === 'ta' ? 'வாடிக்கையாளர் தொடர்பு விவரங்கள்' : 'Customer Contact Details'}</span>
            </div>

            <!-- Full Name (Full Width) -->
            <div style="display: flex; flex-direction: column; gap: 4px; width: 100%; box-sizing: border-box;">
              <label style="font-size: 11.5px; font-weight: 700; color: #9ca3af;">
                ${currentLang === 'ta' ? 'பெயர் (Full Name) *' : 'Full Name *'}
              </label>
              <input type="text" id="addr-field-name" value="${escapeHtml(user.name || '')}" placeholder="${currentLang === 'ta' ? 'உங்கள் பெயரை உள்ளிடவும்' : 'e.g. Rajenthiran'}" style="width: 100%; height: 44px; background: rgba(255,255,255,0.04); border: 1.2px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 0 14px; color: #ffffff; font-size: 13.5px; font-weight: 600; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent-orange)'" onblur="this.style.borderColor='rgba(255,255,255,0.12)'" />
            </div>

            <!-- Mobile Number (Full Width with +91) -->
            <div style="display: flex; flex-direction: column; gap: 4px; width: 100%; box-sizing: border-box;">
              <label style="font-size: 11.5px; font-weight: 700; color: #10b981;">
                ${currentLang === 'ta' ? 'மொபைல் எண் (Mobile Number) *' : 'Mobile Number *'}
              </label>
              <div style="display: flex; align-items: center; width: 100%; height: 44px; background: rgba(255,255,255,0.04); border: 1.2px solid ${!user.phone || user.phone.length < 10 ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.12)'}; border-radius: 12px; padding: 0 12px; box-sizing: border-box;">
                <span style="font-size: 13px; font-weight: 700; color: #9ca3af; margin-right: 8px; user-select: none;">+91</span>
                <input type="tel" id="addr-field-phone" value="${(user.phone || '').replace(/\D/g, '').slice(-10)}" placeholder="8778148899" maxlength="10" style="flex: 1; min-width: 0; height: 100%; background: transparent; border: none; color: #ffffff; font-size: 14px; font-weight: 700; outline: none; padding: 0;" onfocus="this.parentElement.style.borderColor='var(--accent-orange)'" onblur="this.parentElement.style.borderColor='rgba(255,255,255,0.12)'" />
              </div>
            </div>
          </div>

          ${savedAddressesListHtml}

          <!-- Address Form Header & Tag Selector -->
          <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box;">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <span style="font-size: 11.5px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Poppins', sans-serif;">
                ${modeHeader}
              </span>
              <input type="hidden" id="addr-field-label" value="${targetLabel}" />
            </div>

            <!-- Address Label Pills: Home, Work, Other -->
            <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box;">
              ${['Home 🏠', 'Work 🏢', 'Other 📍'].map(lbl => {
                const isSelected = (targetLabel.startsWith(lbl.split(' ')[0]));
                const bg = isSelected ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255,255,255,0.03)';
                const bColor = isSelected ? 'var(--accent-orange)' : 'rgba(255,255,255,0.1)';
                const tColor = isSelected ? 'var(--accent-orange)' : '#9ca3af';
                return `
                  <button type="button" onclick="document.getElementById('addr-field-label').value='${lbl}'; document.querySelectorAll('.addr-tag-pill').forEach(b => { b.style.background='rgba(255,255,255,0.03)'; b.style.borderColor='rgba(255,255,255,0.1)'; b.style.color='#9ca3af'; }); this.style.background='rgba(249, 115, 22, 0.2)'; this.style.borderColor='var(--accent-orange)'; this.style.color='var(--accent-orange)';" class="addr-tag-pill" style="flex: 1; height: 34px; border-radius: 10px; background: ${bg}; border: 1.2px solid ${bColor}; color: ${tColor}; font-size: 11.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-sizing: border-box;">
                    ${lbl}
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Structured Address Fields (proper flex box-sizing) -->
          <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box;">
            <!-- Row: House No & PIN Code -->
            <div style="display: flex; gap: 10px; width: 100%; box-sizing: border-box;">
              <div style="flex: 1; min-width: 0; box-sizing: border-box;">
                <label style="font-size: 11px; font-weight: 700; color: #9ca3af; margin-bottom: 4px; display: block;">House / Door No *</label>
                <input type="text" id="addr-field-house" value="${fields.houseNo}" placeholder="e.g. 12/4B" style="width: 100%; height: 42px; background: rgba(255,255,255,0.03); border: 1.2px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 0 12px; color: #ffffff; font-size: 13px; font-weight: 600; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
              </div>
              <div style="flex: 1; min-width: 0; box-sizing: border-box;">
                <label style="font-size: 11px; font-weight: 700; color: #9ca3af; margin-bottom: 4px; display: block;">PIN Code *</label>
                <input type="tel" id="addr-field-pincode" value="${fields.pincode}" placeholder="e.g. 637101" maxlength="6" style="width: 100%; height: 42px; background: rgba(255,255,255,0.03); border: 1.2px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 0 12px; color: #ffffff; font-size: 13px; font-weight: 600; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
              </div>
            </div>

            <!-- Row: Street / Road Name -->
            <div style="width: 100%; box-sizing: border-box;">
              <label style="font-size: 11px; font-weight: 700; color: #9ca3af; margin-bottom: 4px; display: block;">Street / Road Name *</label>
              <input type="text" id="addr-field-street" value="${fields.street}" placeholder="e.g. Gandhi Road / Main Road" style="width: 100%; height: 42px; background: rgba(255,255,255,0.03); border: 1.2px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 0 12px; color: #ffffff; font-size: 13px; font-weight: 600; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
            </div>

            <!-- Row: Landmark (Optional) -->
            <div style="width: 100%; box-sizing: border-box;">
              <label style="font-size: 11px; font-weight: 700; color: #9ca3af; margin-bottom: 4px; display: block;">Landmark (optional)</label>
              <input type="text" id="addr-field-landmark" value="${fields.landmark}" placeholder="e.g. Near Bus Stand / Water Tank" style="width: 100%; height: 42px; background: rgba(255,255,255,0.03); border: 1.2px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 0 12px; color: #ffffff; font-size: 13px; font-weight: 600; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
            </div>

            <!-- Row: Area / Locality & City -->
            <div style="display: flex; gap: 10px; width: 100%; box-sizing: border-box;">
              <div style="flex: 1; min-width: 0; box-sizing: border-box;">
                <label style="font-size: 11px; font-weight: 700; color: #9ca3af; margin-bottom: 4px; display: block;">Area / Locality *</label>
                <input type="text" id="addr-field-area" value="${fields.area || 'Edappadi'}" placeholder="e.g. Kavandampatti" style="width: 100%; height: 42px; background: rgba(255,255,255,0.03); border: 1.2px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 0 12px; color: #ffffff; font-size: 13px; font-weight: 600; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
              </div>
              <div style="flex: 1; min-width: 0; box-sizing: border-box;">
                <label style="font-size: 11px; font-weight: 700; color: #9ca3af; margin-bottom: 4px; display: block;">City / Town *</label>
                <input type="text" id="addr-field-city" value="${fields.city || 'Edappadi'}" placeholder="e.g. Edappadi / Salem" style="width: 100%; height: 42px; background: rgba(255,255,255,0.03); border: 1.2px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 0 12px; color: #ffffff; font-size: 13px; font-weight: 600; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
              </div>
            </div>
          </div>

          <!-- GPS and Map Action Buttons -->
          <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box; margin-top: 4px;">
            <button type="button" class="btn" onclick="triggerEditorGPS()" style="flex: 1; min-width: 0; min-height: 42px; padding: 8px 10px; font-size: 11.5px; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.3) !important; color: #10b981 !important; background: rgba(16, 185, 129, 0.08) !important; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 12px; box-sizing: border-box; cursor: pointer; transition: all 0.2s;">
              <span>🛰️</span> <span>${currentLang === 'ta' ? 'ஜிபிஎஸ் மூலம் எடு' : 'Auto GPS'}</span>
            </button>

            <button type="button" class="btn" onclick="triggerEditorMap()" style="flex: 1; min-width: 0; min-height: 42px; padding: 8px 10px; font-size: 11.5px; font-weight: 700; border: 1px solid rgba(249, 115, 22, 0.3) !important; color: var(--accent-orange) !important; background: rgba(249, 115, 22, 0.08) !important; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 12px; box-sizing: border-box; cursor: pointer; transition: all 0.2s;">
              <span>🗺️</span> <span>${currentLang === 'ta' ? 'வரைபடம் / Map' : 'Pick Map'}</span>
            </button>
          </div>

          <!-- Action Save Buttons -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px; width: 100%; box-sizing: border-box;">
            <button type="button" class="btn" onclick="saveSimpleAddressFields(false)" style="width: 100%; min-height: 48px; height: auto; padding: 12px 18px; font-size: 14px; font-weight: 800; border: none !important; background: linear-gradient(135deg, #10b981 0%, #047857 100%) !important; color: #ffffff !important; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 14px; box-sizing: border-box; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
              <span>💾</span> <span>${currentLang === 'ta' ? 'முகவரியைச் சேமி / SAVE ADDRESS' : 'SAVE ADDRESS'}</span>
            </button>

            ${isEditingExisting ? `
              <button type="button" class="btn" onclick="saveSimpleAddressFields(true)" style="width: 100%; min-height: 40px; padding: 8px 14px; font-size: 12px; font-weight: 700; border: 1.2px dashed rgba(249, 115, 22, 0.5) !important; color: var(--accent-orange) !important; background: rgba(249, 115, 22, 0.06) !important; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 12px; box-sizing: border-box; cursor: pointer; transition: all 0.2s;">
                <span>➕</span> <span>${currentLang === 'ta' ? 'புதிய முகவரியாகச் சேமி (+ Save as New)' : '+ Save as New Address'}</span>
              </button>
            ` : ''}
          </div>

        </div>
      `;

      document.body.appendChild(modal);

      const itemLat = (targetItem && targetItem.latitude) ? targetItem.latitude : (user.latitude || 11.5815);
      const itemLng = (targetItem && targetItem.longitude) ? targetItem.longitude : (user.longitude || 77.8488);
      modal.setAttribute('data-lat', itemLat);
      modal.setAttribute('data-lng', itemLng);

      setTimeout(() => {
        modal.classList.add('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'translateY(0)';
      }, 10);
    }

    function closeSimpleAddressEditor() {
      const modal = document.getElementById('simple-address-editor-modal');
      if (modal) {
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'translateY(100px)';
        modal.classList.remove('active');
        setTimeout(() => {
          modal.remove();
        }, 200);
      }
    }

    async function triggerEditorGPS() {
      const btn = event.currentTarget;
      const origText = btn.innerHTML;

      if (typeof AndroidStorage !== 'undefined') {
        try {
          if (!AndroidStorage.hasLocationPermission()) {
            debugLog("[Contextual GPS] No location permission. Requesting contextually...");
            AndroidStorage.requestLocationPermission();
            showToast("இருப்பிட அனுமதி தேவை. அனுமதித்த பின் மீண்டும் முயற்சிக்கவும்! (Location permission requested. Please grant it and retry!)", "info");
            return;
          }
        } catch (e) {
          console.error("Error with native location permission request:", e);
        }
      }

      btn.innerHTML = "🛰️ Locating...";
      btn.disabled = true;

      try {
        let lat = 11.5815;
        let lng = 77.8488;
        let gotLocation = false;

        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getNativeLocation === 'function') {
          const res = AndroidStorage.getNativeLocation();
          if (res && res !== "PERMISSION_REQUIRED" && res !== "SECURITY_ERROR" && res !== "NO_LOCATION" && !res.startsWith("ERROR") && res !== "NO_LOCATION_SERVICE") {
            try {
              const loc = JSON.parse(res);
              lat = parseFloat(loc.latitude);
              lng = parseFloat(loc.longitude);
              gotLocation = true;
            } catch(e) {}
          }
        }

        if (!gotLocation && navigator.geolocation) {
          try {
            const position = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 8000
              });
            });
            lat = position.coords.latitude;
            lng = position.coords.longitude;
            gotLocation = true;
          } catch (err) {}
        }

        if (!gotLocation) {
          showToast("GPS signal lost or permission denied! ❌", "error");
          return;
        }

        const modal = document.getElementById('simple-address-editor-modal');
        if (modal) {
          modal.setAttribute('data-lat', lat);
          modal.setAttribute('data-lng', lng);
        }

        showToast("🔄 Reverse geocoding location...", "info");
        const res = await reverseGeocodeWithRetry(lat, lng);
        if (res && res.displayName) {
          const parsed = parseAddressStringToFields(res.displayName);

          const streetInput = document.getElementById('addr-field-street');
          const areaInput = document.getElementById('addr-field-area');
          const landmarkInput = document.getElementById('addr-field-landmark');
          const cityInput = document.getElementById('addr-field-city');
          const pincodeInput = document.getElementById('addr-field-pincode');

          if (parsed.pincode && pincodeInput) pincodeInput.value = parsed.pincode;
          if (parsed.city && cityInput) cityInput.value = parsed.city;
          if (parsed.area && areaInput) areaInput.value = parsed.area;
          if (parsed.landmark && landmarkInput && !landmarkInput.value) landmarkInput.value = parsed.landmark;
          if (parsed.street && streetInput && !streetInput.value) streetInput.value = parsed.street;

          showToast("Current location detected! Please fill House No.", "success");
        } else {
          showToast("Current location detected!", "success");
        }
      } catch(e) {
        console.warn(e);
      } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
      }
    }

    function triggerEditorMap() {
      let dummy = document.getElementById('editor-map-dummy-target');
      if (!dummy) {
        dummy = document.createElement('input');
        dummy.id = 'editor-map-dummy-target';
        dummy.type = 'hidden';
        document.body.appendChild(dummy);
      }

      const modal = document.getElementById('simple-address-editor-modal');
      if (modal && modal.getAttribute('data-lat')) {
        dummy.setAttribute('data-lat', modal.getAttribute('data-lat'));
        dummy.setAttribute('data-lng', modal.getAttribute('data-lng'));
      } else {
        const user = getActiveUser() || {};
        if (user.latitude && user.longitude) {
          dummy.setAttribute('data-lat', user.latitude);
          dummy.setAttribute('data-lng', user.longitude);
        }
      }

      openMapAddressPicker('editor-map-dummy-target');

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && (mutation.attributeName === 'data-lat' || mutation.attributeName === 'value')) {
            const lat = dummy.getAttribute('data-lat');
            const lng = dummy.getAttribute('data-lng');
            const addrVal = dummy.value;

            if (modal) {
              modal.setAttribute('data-lat', lat);
              modal.setAttribute('data-lng', lng);
            }

            const parsed = parseAddressStringToFields(addrVal);
            const streetInput = document.getElementById('addr-field-street');
            const areaInput = document.getElementById('addr-field-area');
            const landmarkInput = document.getElementById('addr-field-landmark');
            const cityInput = document.getElementById('addr-field-city');
            const pincodeInput = document.getElementById('addr-field-pincode');

            if (parsed.pincode && pincodeInput) pincodeInput.value = parsed.pincode;
            if (parsed.city && cityInput) cityInput.value = parsed.city;
            if (parsed.area && areaInput) areaInput.value = parsed.area;
            if (parsed.landmark && landmarkInput && !landmarkInput.value) landmarkInput.value = parsed.landmark;
            if (parsed.street && streetInput && !streetInput.value) streetInput.value = parsed.street;

            showToast("Location picked from map! Confirm fields.", "success");
            observer.disconnect();
          }
        });
      });

      observer.observe(dummy, { attributes: true });
    }

    function saveSimpleAddressFields(forceSaveAsNew = false) {
      const nameInput = document.getElementById('addr-field-name');
      const phoneInput = document.getElementById('addr-field-phone');
      const name = nameInput ? nameInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.replace(/\D/g, '').slice(-10) : '';

      if (nameInput && !name) {
        showToast(currentLang === 'ta' ? "தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்!" : "Please enter your name!", "error");
        if (nameInput) nameInput.focus();
        return;
      }
      if (phoneInput && (!phone || phone.length !== 10)) {
        showToast(currentLang === 'ta' ? "தயவுசெய்து 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்!" : "Please enter a valid 10-digit mobile number!", "error");
        if (phoneInput) phoneInput.focus();
        return;
      }

      const houseNo = (document.getElementById('addr-field-house') ? document.getElementById('addr-field-house').value : '').trim();
      const street = (document.getElementById('addr-field-street') ? document.getElementById('addr-field-street').value : '').trim();
      const area = (document.getElementById('addr-field-area') ? document.getElementById('addr-field-area').value : '').trim();
      const landmark = (document.getElementById('addr-field-landmark') ? document.getElementById('addr-field-landmark').value : '').trim();
      const city = (document.getElementById('addr-field-city') ? document.getElementById('addr-field-city').value : '').trim();
      const pincode = (document.getElementById('addr-field-pincode') ? document.getElementById('addr-field-pincode').value : '').trim();
      const labelInput = document.getElementById('addr-field-label');
      const label = labelInput ? labelInput.value.trim() : 'Home 🏠';

      if (!houseNo) {
        showToast(currentLang === 'ta' ? "வீட்டு எண் உள்ளிடவும்! (House No required)" : "House No is required!", "error");
        return;
      }
      if (!street) {
        showToast(currentLang === 'ta' ? "தெரு பெயர் உள்ளிடவும்! (Street name required)" : "Street name is required!", "error");
        return;
      }
      if (!area) {
        showToast(currentLang === 'ta' ? "பகுதி உள்ளிடவும்! (Area required)" : "Area is required!", "error");
        return;
      }
      if (!city) {
        showToast(currentLang === 'ta' ? "ஊர் உள்ளிடவும்! (City required)" : "City is required!", "error");
        return;
      }
      if (!pincode || pincode.length !== 6 || isNaN(pincode)) {
        showToast(currentLang === 'ta' ? "சரியான 6 இலக்க பின்கோடு உள்ளிடவும்!" : "Please enter a valid 6-digit PIN Code!", "error");
        return;
      }

      const fields = { houseNo, street, area, landmark, city, pincode };
      const fullAddress = buildAddressString(fields);

      const modal = document.getElementById('simple-address-editor-modal');
      const lat = modal && modal.getAttribute('data-lat') ? parseFloat(modal.getAttribute('data-lat')) : 11.5815;
      const lng = modal && modal.getAttribute('data-lng') ? parseFloat(modal.getAttribute('data-lng')) : 77.8488;

      // Update active user state
      const user = getActiveUser() || {};
      if (name) user.name = name;
      if (phone) user.phone = phone;

      let saved = user.savedAddresses || [];
      const editingId = (!forceSaveAsNew && window._activeEditingAddressId) ? window._activeEditingAddressId : null;

      if (editingId && saved.some(a => a.id === editingId)) {
        saved = saved.map(a => {
          if (a.id === editingId) {
            return {
              ...a,
              label: label || a.label || 'Home 🏠',
              address: fullAddress,
              latitude: lat,
              longitude: lng
            };
          }
          return a;
        });
      } else {
        const newAddrObj = {
          id: 'addr_' + Date.now(),
          label: label || 'Home 🏠',
          address: fullAddress,
          latitude: lat,
          longitude: lng
        };
        saved.push(newAddrObj);
      }
      user.savedAddresses = saved;

      // Update in ek_users local storage
      const users = getData('ek_users', []) || [];
      const uIdx = users.findIndex(u => u && (u.id === user.id || (user.phone && u.phone === user.phone)));
      if (uIdx !== -1) {
        if (name) users[uIdx].name = name;
        if (phone) users[uIdx].phone = phone;
        users[uIdx].savedAddresses = saved;
        users[uIdx].address = fullAddress;
        users[uIdx].latitude = lat;
        users[uIdx].longitude = lng;
        users[uIdx].updatedAt = new Date().toISOString();
        saveData('ek_users', users);
      }

      // Update active session
      const session = getActiveSession() || {};
      if (name) session.name = name;
      if (phone) session.phone = phone;
      saveData('ek_customer_session', session);

      // Cloud Firestore sync
      if (typeof db !== 'undefined' && db && user.id) {
        db.collection('ek_users').doc(user.id).set({
          name: user.name,
          phone: user.phone,
          address: fullAddress,
          latitude: lat,
          longitude: lng,
          savedAddresses: saved,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(err => console.warn("Firestore user sync error:", err));
      }

      // Set as primary address and sync all views
      syncPrimaryUserAddress(fullAddress, lat, lng);
      renderAllAddressCards();
      renderSavedAddressesList();
      populateCartSavedAddresses();
      renderCartCustomerContactCard();

      // Update quick order review if visible
      const quickPhone = document.getElementById('quick-order-review-phone');
      if (quickPhone && phone) quickPhone.innerText = `+91 ${phone.slice(-10)}`;
      const quickAddr = document.getElementById('quick-order-review-address');
      if (quickAddr) {
        if (typeof formatAddressStringToPostal === 'function') {
          quickAddr.innerHTML = formatAddressStringToPostal(fullAddress);
        } else {
          quickAddr.innerText = fullAddress;
        }
      }

      closeSimpleAddressEditor();
      showToast(currentLang === 'ta' ? "முகவரி விவரங்கள் வெற்றிகரமாக சேமிக்கப்பட்டன! ✅" : "Address details saved successfully! ✅", "success");

      if (window._pendingOrderAfterContactSave) {
        window._pendingOrderAfterContactSave = false;
        if (typeof actualPlaceOrder === 'function') {
          setTimeout(actualPlaceOrder, 300);
        }
      }
    }

    window.openOrderDetailsEditor = openSimpleAddressEditor;

    function renderCartCustomerContactCard() {
      const container = document.getElementById('cart-customer-contact-card');
      if (!container) return;
      const user = getActiveUser();
      if (!user) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
      }
      container.style.display = 'block';

      const name = user.name || "Customer";
      const phone = (user.phone || "").trim().replace(/\D/g, '');
      const hasPhone = phone.length >= 10;
      const photo = user.photoUrl;

      const phoneBadge = hasPhone
        ? `<span style="color: #10b981; font-weight: 700; font-size: 12.5px; display: inline-flex; align-items: center; gap: 4px;">📞 +91 ${phone.slice(-10)}</span>`
        : `<span style="color: #f59e0b; font-weight: 700; font-size: 11px; background: rgba(245, 158, 11, 0.12); padding: 3px 8px; border-radius: 8px; border: 1px dashed rgba(245, 158, 11, 0.4); display: inline-flex; align-items: center; gap: 4px;">⚠️ ${currentLang === 'ta' ? 'மொபைல் எண் சேர்க்கவும்' : 'Add Mobile Number'}</span>`;

      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.05) 100%); border: 1.5px solid var(--accent-orange); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; overflow: hidden;">
              ${photo ? `<img src="${photo}" style="width: 100%; height: 100%; object-fit: cover;" alt="User">` : '👤'}
            </div>
            <div style="min-width: 0;">
              <div style="font-size: 13px; font-weight: 800; color: #ffffff; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Poppins', 'Hind Madurai', sans-serif;">
                ${escapeHtml(name)}
              </div>
              <div style="margin-top: 2px;">
                ${phoneBadge}
              </div>
            </div>
          </div>
          <button type="button" onclick="openSimpleAddressEditor()" style="background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.35); color: var(--accent-orange); border-radius: 10px; padding: 6px 12px; font-size: 11.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Poppins', 'Hind Madurai', sans-serif; transition: all 0.2s;" onmouseover="this.style.background='rgba(249,115,22,0.2)'" onmouseout="this.style.background='rgba(249,115,22,0.1)'">
            <span>✏️</span> <span>${currentLang === 'ta' ? 'விவரங்களை திருத்து' : 'Edit Details'}</span>
          </button>
        </div>
      `;
    }

    window.renderCartCustomerContactCard = renderCartCustomerContactCard;

    function renderAllAddressCards() {
      renderCartCustomerContactCard();
      const user = getActiveUser() || {};
      const currentAddress = user.address || '';

      let cardHtml = '';
      if (!currentAddress || currentAddress === 'Salem, Tamil Nadu' || (currentAddress.includes("Selected Delivery Location") && currentAddress.split(',').length <= 2)) {
        const noAddressText = currentLang === 'ta' ? "முகவரி இன்னும் சேர்க்கப்படவில்லை. + Add Address" : "No delivery address added yet. + Add Address";
        cardHtml = `
          <div style="background: rgba(255, 255, 255, 0.02); border: 1.5px dashed rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; box-sizing: border-box; width: 100%;">
            <span style="font-size: 24px;">📍</span>
            <button type="button" onclick="openSimpleAddressEditor()" class="btn" style="background: var(--accent-orange); color: #000; border: none; font-size: 12px; font-weight: 800; padding: 12px 20px; border-radius: 12px; cursor: pointer; transition: transform 0.1s; width: 100%; max-width: 320px; font-family: 'Poppins', 'Hind Madurai', sans-serif; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(249,115,22,0.25);" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='none'">
              ${noAddressText}
            </button>
          </div>
        `;
      } else {
        let labelText = 'Home';
        if (user.savedAddresses) {
          const matched = user.savedAddresses.find(a => a.address === currentAddress);
          if (matched && matched.label) {
            labelText = matched.label.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').replace(/^[^a-zA-Z0-9\s]+/g, '').trim();
          }
        }

        const postalHtml = formatAddressStringToPostal(currentAddress);

        cardHtml = `
          <div style="background: linear-gradient(135deg, #18181b 0%, #0c0c0e 100%); border: 1.5px solid rgba(249, 115, 22, 0.2); border-radius: 18px; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); text-align: left; box-sizing: border-box; width: 100%;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid rgba(249, 115, 22, 0.1); padding-bottom: 10px;">
              <span style="font-size: 13.5px; font-weight: 800; color: var(--accent-orange); display: flex; align-items: center; gap: 8px; font-family: 'Poppins', sans-serif; letter-spacing: 0.5px; text-transform: uppercase;">
                📍 ${labelText}
              </span>
              <span style="font-size: 11px; background: rgba(249, 115, 22, 0.12); color: var(--accent-orange); padding: 3px 10px; border-radius: 20px; font-weight: 800; text-transform: uppercase; border: 1px solid rgba(249, 115, 22, 0.25); letter-spacing: 0.3px;">Selected</span>
            </div>
            <div style="font-family: 'Poppins', sans-serif; font-size: 13px; color: #e4e4e7; line-height: 1.55; font-weight: 500;">
              ${postalHtml}
            </div>
          </div>
        `;
      }

      const profContainer = document.getElementById('profile-address-card-container');
      if (profContainer) {
        if (!currentAddress || currentAddress === 'Salem, Tamil Nadu' || (currentAddress.includes("Selected Delivery Location") && currentAddress.split(',').length <= 2)) {
          profContainer.innerHTML = cardHtml;
        } else {
          const saved = user.savedAddresses || [];
          let savedListHtml = '';
          if (saved.length > 0) {
            savedListHtml = `
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; text-align: left; width: 100%; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span style="font-size: 11px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Poppins', sans-serif;">
                    ${currentLang === 'ta' ? 'சேமித்த முகவரிகள்' : 'Saved Addresses'} (${saved.length})
                  </span>
                  <button type="button" onclick="openSimpleAddressEditor(null, 'new')" style="background: transparent; border: none; color: var(--accent-orange); font-size: 11.5px; font-weight: 800; cursor: pointer; padding: 2px 4px; display: flex; align-items: center; gap: 4px;">
                    <span>➕</span> <span>${currentLang === 'ta' ? 'புதிய முகவரி' : 'Add New'}</span>
                  </button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;">
            `;
            saved.forEach(item => {
              const isSelected = (currentAddress === item.address);
              const borderStyle = isSelected ? 'border: 1.5px solid var(--accent-orange); background: rgba(249, 115, 22, 0.06);' : 'border: 1.2px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);';
              const indicatorHtml = isSelected
                ? '<span style="font-size: 11px; color: var(--accent-orange); font-weight: 800;">✓ Active</span>'
                : `<button type="button" onclick="selectAddressInEditor('${item.id}')" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #ffffff; font-size: 10.5px; font-weight: 700; padding: 4px 10px; cursor: pointer;">${currentLang === 'ta' ? 'பயன்படுத்து' : 'Use'}</button>`;
              const postalFields = parseAddressStringToFields(item.address);
              let postalStr = `${postalFields.houseNo ? postalFields.houseNo + ', ' : ''}${postalFields.street}, ${postalFields.area}, ${postalFields.city} – ${postalFields.pincode}`;

              savedListHtml += `
                <div style="padding: 10px 12px; border-radius: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; box-sizing: border-box; width: 100%; text-align: left; ${borderStyle}">
                  <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 12px; font-weight: 800; color: #ffffff; font-family: 'Poppins', sans-serif;">${item.label}</span>
                    <span style="font-size: 11px; color: #9ca3af; font-weight: 500; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${postalStr}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    ${indicatorHtml}
                    <button type="button" onclick="openSimpleAddressEditor('${item.id}')" style="background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 8px; color: var(--accent-orange); width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 11.5px; cursor: pointer;" title="Edit">✏️</button>
                    ${saved.length > 1 ? `
                      <button type="button" onclick="deleteSavedAddress('${item.id}')" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #ef4444; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 11.5px; cursor: pointer;" title="Delete">🗑️</button>
                    ` : ''}
                  </div>
                </div>
              `;
            });
            savedListHtml += `
                </div>
              </div>
            `;
          }

          profContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box;">
              ${cardHtml}
              <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box;">
                <button type="button" onclick="openSimpleAddressEditor()" style="flex: 1; min-height: 38px; padding: 8px 12px; border-radius: 12px; background: rgba(249, 115, 22, 0.08); border: 1.2px solid rgba(249, 115, 22, 0.4); color: var(--accent-orange); font-size: 11.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: 'Poppins', sans-serif;">
                  <span>✏️</span> <span>${currentLang === 'ta' ? 'முகவரியை மாற்று' : 'Edit Address'}</span>
                </button>
                <button type="button" onclick="openSimpleAddressEditor(null, 'new')" style="flex: 1; min-height: 38px; padding: 8px 12px; border-radius: 12px; background: rgba(16, 185, 129, 0.08); border: 1.2px solid rgba(16, 185, 129, 0.4); color: #10b981; font-size: 11.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: 'Poppins', sans-serif;">
                  <span>➕</span> <span>${currentLang === 'ta' ? 'புதிய முகவரி சேர்' : 'Add New'}</span>
                </button>
              </div>
              ${savedListHtml}
            </div>
          `;
        }
      }

      const cartContainer = document.getElementById('cart-address-card-container');
      if (cartContainer) {
        if (!currentAddress || (currentAddress.includes("Selected Delivery Location") && currentAddress.split(',').length <= 2)) {
          cartContainer.innerHTML = cardHtml;
        } else {
          const saved = user.savedAddresses || [];

          const actionRowHtml = `
            <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box; margin-top: 4px;">
              <button type="button" onclick="openSimpleAddressEditor()" style="flex: 1; min-height: 38px; padding: 8px 12px; border-radius: 14px; background: rgba(249, 115, 22, 0.08); border: 1.2px solid rgba(249, 115, 22, 0.4); color: var(--accent-orange); font-size: 11.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: 'Poppins', sans-serif;">
                <span>✏️</span> <span>${currentLang === 'ta' ? 'முகவரியை மாற்று' : 'Edit Address'}</span>
              </button>
              <button type="button" onclick="openSimpleAddressEditor(null, 'new')" style="flex: 1; min-height: 38px; padding: 8px 12px; border-radius: 14px; background: rgba(16, 185, 129, 0.08); border: 1.2px solid rgba(16, 185, 129, 0.4); color: #10b981; font-size: 11.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: 'Poppins', sans-serif;">
                <span>➕</span> <span>${currentLang === 'ta' ? 'புதிய முகவரி' : 'Add New'}</span>
              </button>
            </div>
          `;

          let savedSelectorHtml = '';
          if (saved.length >= 2) {
            savedSelectorHtml = `
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px; text-align: left; width: 100%;">
                <span style="font-size: 10.5px; font-weight: 800; color: #71717a; text-transform: uppercase; letter-spacing: 0.8px; font-family: 'Poppins', sans-serif; padding-left: 2px;">
                  ${currentLang === 'ta' ? 'சேமித்த முகவரிகள் (விரைவுத் தேர்வு):' : 'Saved Addresses (Quick Switch):'}
                </span>
                <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; width: 100%; box-sizing: border-box; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none;">
            `;
            saved.forEach(item => {
              const isSelected = (currentAddress === item.address);
              const chipBg = isSelected ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.16) 0%, rgba(249, 115, 22, 0.06) 100%)' : 'rgba(255, 255, 255, 0.03)';
              const chipBorder = isSelected ? '1.5px solid var(--accent-orange)' : '1px solid rgba(255, 255, 255, 0.1)';
              const chipColor = isSelected ? 'var(--accent-orange)' : '#a1a1aa';
              const chipFontWeight = isSelected ? '800' : '600';

              savedSelectorHtml += `
                <div onclick="selectCartSavedAddress('${item.id}'); renderAllAddressCards();" style="flex-shrink: 0; display: flex; align-items: center; gap: 6px; padding: 6px 14px; background: ${chipBg}; border: ${chipBorder}; border-radius: 20px; color: ${chipColor}; font-size: 11px; font-weight: ${chipFontWeight}; cursor: pointer; transition: all 0.2s ease; box-sizing: border-box; font-family: 'Poppins', sans-serif;">
                  <span>📍</span>
                  <span>${item.label}</span>
                </div>
              `;
            });
            savedSelectorHtml += `
                </div>
              </div>
            `;
          }

          cartContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box;">
              ${cardHtml}
              ${actionRowHtml}
              ${savedSelectorHtml}
            </div>
          `;
        }
      }
    }

    function syncPrimaryUserAddress(address, lat, lng) {
      debugLog(`[Address Sync] Syncing primary address: "${address}" at (${lat}, ${lng})`);

      updateCartAddressSummary(address);
      if (address && address.trim() !== '') {
        hideInteractiveLocationSection();
      }

      window.isProgrammaticAddressSync = true;
      try {
        const targetIds = ['reg-address', 'cart-delivery-address', 'prof-address-edit', 'new-address-text'];
        targetIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.value = address || "";
            if (lat !== undefined && lat !== null && !isNaN(lat)) {
              el.setAttribute('data-lat', lat);
            }
            if (lng !== undefined && lng !== null && !isNaN(lng)) {
              el.setAttribute('data-lng', lng);
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      } finally {
        window.isProgrammaticAddressSync = false;
      }

      renderAllAddressCards();

      const session = getActiveSession();
      const users = getData('ek_users', []);
      let userIdx = -1;
      if (session && session.userId) {
        userIdx = users.findIndex(u => u.id === session.userId);
        if (userIdx === -1 && session.phone) {
          userIdx = users.findIndex(u => u.phone === session.phone);
        }
      }
      if (userIdx !== -1) {
        users[userIdx].address = address;
        if (lat !== undefined && lat !== null && !isNaN(lat)) users[userIdx].latitude = lat;
        if (lng !== undefined && lng !== null && !isNaN(lng)) users[userIdx].longitude = lng;
        users[userIdx].updatedAt = new Date().toISOString();

        // Also ensure savedAddresses has this primary address
        let saved = users[userIdx].savedAddresses || [];
        if (!saved.some(a => a.address === address)) {
          saved.unshift({
            id: 'addr_' + Math.floor(100000 + Math.random() * 900000),
            label: 'Home 🏠',
            address: address,
            latitude: lat || 11.5815,
            longitude: lng || 77.8488
          });
          users[userIdx].savedAddresses = saved;
        }

        saveData('ek_users', users);

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_users').doc(users[userIdx].id).set(users[userIdx], { merge: true })
            .then(() => debugLog("[Address Sync] Cloud profile updated successfully."))
            .catch(e => console.warn("[Address Sync] Cloud profile update failed:", e));
        }
      }

      const selectEl = document.getElementById('cart-saved-addresses-select');
      if (selectEl) {
        const user = getActiveUser();
        if (user && user.savedAddresses) {
          const matched = user.savedAddresses.find(a => a.address === address);
          if (matched) {
            selectEl.value = matched.id;
          } else {
            selectEl.value = "";
          }
        }
      }

      if (typeof recalculateBill === 'function') {
        recalculateBill();
      }
    }

    function renderSavedAddressesList() {
      const listDiv = document.getElementById('saved-addresses-list');
      if (!listDiv) return;

      const user = getActiveUser();
      if (!user) {
        listDiv.innerHTML = `<p style="font-size:11.5px; color:#9ca3af; margin:0;">உள்நுழைக முகவரிகளை மேனேஜ் செய்ய / Please log in to manage saved addresses.</p>`;
        return;
      }

      const saved = user.savedAddresses || [];
      if (saved.length === 0) {
        listDiv.innerHTML = `
          <div style="text-align:center; padding:12px; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.12); border-radius:12px;">
            <p style="font-size:11px; color:#6b7280; margin:0;">இன்னும் முகவரிகள் சேமிக்கப்படவில்லை / No saved addresses yet.</p>
          </div>
        `;
        return;
      }

      let html = '';
      saved.forEach((item) => {
        const isPrimary = (user.address === item.address);
        const borderStyle = isPrimary ? 'border:1.5px solid #10b981; background:rgba(16,185,129,0.12);' : 'border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02);';
        const badgeStyle = isPrimary ? 'background:#10b981; color:#ffffff; cursor:default; border:none;' : 'background:rgba(255,255,255,0.08); color:#ffffff; border:1.2px solid rgba(255,255,255,0.12); cursor:pointer;';
        const badgeText = isPrimary ? (currentLang === 'ta' ? 'முதன்மை 🏠' : 'PRIMARY 🏠') : (currentLang === 'ta' ? 'பயன்படுத்து ➔' : 'Use ➔');

        html += `
          <div class="saved-address-item" style="padding:12px; border-radius:12px; display:flex; flex-direction:column; gap:8px; transition:all 0.2s; box-sizing:border-box; width:100%; ${borderStyle}">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; box-sizing:border-box;">
              <span style="font-size:12px; font-weight:800; color:#ffffff; display:flex; align-items:center; gap:4px; margin:0; line-height:1.2;">
                ${item.label}
              </span>
              <div style="display:flex; gap:6px; margin-left:auto; align-items:center; flex-shrink:0;">
                <button onclick="setSavedAddressAsPrimary('${item.id}')" style="font-size:10px; font-weight:800; padding:4px 10px; border-radius:8px; transition:all 0.15s; min-height:28px; height:auto; display:flex; align-items:center; justify-content:center; box-sizing:border-box; ${badgeStyle}">
                  ${badgeText}
                </button>
                <button onclick="deleteSavedAddress('${item.id}')" style="background:rgba(239,68,68,0.08); color:#ef4444; font-size:12px; border:1.2px solid rgba(239,68,68,0.25); width:28px; height:28px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-sizing:border-box;" title="Delete">
                  🗑️
                </button>
              </div>
            </div>
            <p style="font-size:11.5px; color:rgba(255,255,255,0.85); margin:0; line-height:1.45; text-align:left; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; word-break:break-word; max-width:100%;">
              ${item.address}
            </p>
            <span style="font-size:9.5px; color:#10b981; font-weight:700; text-align:left; display:flex; align-items:center; gap:4px; margin-top:3px;">
              🟢 <span>GPS Location Configured</span>
            </span>
          </div>
        `;
      });

      listDiv.innerHTML = html;
    }

    function setSavedAddressAsPrimary(id) {
      const user = getActiveUser();
      if (!user) return;

      const saved = user.savedAddresses || [];
      const found = saved.find(item => item.id === id);
      if (!found) return;

      syncPrimaryUserAddress(found.address, found.latitude, found.longitude);
      showToast(currentLang === 'ta' ? "முதன்மை முகவரி மாற்றப்பட்டது! 🏠" : "Primary address updated successfully! 🏠", "success");

      renderSavedAddressesList();
      populateCartSavedAddresses();
    }

    function addNewSavedAddress() {
      const user = getActiveUser();
      if (!user) {
        showToast("Please log in to save addresses!", "error");
        return;
      }

      const labelSelect = document.getElementById('new-address-label');
      const textInput = document.getElementById('new-address-text');
      if (!labelSelect || !textInput) return;

      const label = labelSelect.value;
      const address = textInput.value.trim();
      if (!address) {
        showToast(currentLang === 'ta' ? "முகவரி காலியாக இருக்கக்கூடாது!" : "Please enter or select an address first!", "error");
        return;
      }

      let lat = parseFloat(textInput.getAttribute('data-lat'));
      let lng = parseFloat(textInput.getAttribute('data-lng'));

      if (isNaN(lat) || isNaN(lng)) {
        lat = 11.5815;
        lng = 77.8488;
      }

      const saved = user.savedAddresses || [];
      if (saved.length >= 10) {
        showToast(currentLang === 'ta' ? "அதிகபட்சமாக 10 முகவரிகளை மட்டுமே சேமிக்க முடியும்!" : "You can save up to 10 addresses only!", "warning");
        return;
      }

      const newAddress = {
        id: 'addr_' + Math.floor(100000 + Math.random() * 900000),
        label: label,
        address: address,
        latitude: lat,
        longitude: lng
      };

      saved.push(newAddress);
      user.savedAddresses = saved;

      const users = getData('ek_users', []);
      const userIdx = users.findIndex(u => u.id === user.id);
      if (userIdx !== -1) {
        users[userIdx].savedAddresses = saved;
        if (!users[userIdx].address) {
          users[userIdx].address = address;
          users[userIdx].latitude = lat;
          users[userIdx].longitude = lng;
        }
        saveData('ek_users', users);

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_users').doc(user.id).set(users[userIdx], { merge: true })
            .catch(e => console.warn("Saved addresses sync error:", e));
        }
      }

      // Automatically sync as primary address if user has no primary address set
      if (!user.address || saved.length === 1) {
        syncPrimaryUserAddress(address, lat, lng);
      }

      textInput.value = '';
      textInput.removeAttribute('data-lat');
      textInput.removeAttribute('data-lng');

      showToast(currentLang === 'ta' ? "முகவரி வெற்றிகரமாக சேமிக்கப்பட்டது! 🎉" : "Address saved to list successfully! 🎉", "success");

      renderSavedAddressesList();
      populateCartSavedAddresses();
    }

    function deleteSavedAddress(id) {
      const user = getActiveUser();
      if (!user) return;

      let saved = user.savedAddresses || [];
      const itemToDelete = saved.find(item => item.id === id);
      saved = saved.filter(item => item.id !== id);
      user.savedAddresses = saved;

      if (itemToDelete && user.address === itemToDelete.address && saved.length > 0) {
        syncPrimaryUserAddress(saved[0].address, saved[0].latitude, saved[0].longitude);
      }

      const users = getData('ek_users', []);
      const userIdx = users.findIndex(u => u.id === user.id);
      if (userIdx !== -1) {
        users[userIdx].savedAddresses = saved;
        saveData('ek_users', users);

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_users').doc(user.id).set({
            savedAddresses: saved,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(e => console.warn("Saved addresses sync error:", e));
        }
      }

      showToast(currentLang === 'ta' ? "முகவரி நீக்கப்பட்டது." : "Saved address removed.", "success");
      renderAllAddressCards();
      renderSavedAddressesList();
      populateCartSavedAddresses();
    }
    window.deleteSavedAddress = deleteSavedAddress;

    function populateCartSavedAddresses() {
      const groupEl = document.getElementById('cart-saved-addresses-group');
      const selectEl = document.getElementById('cart-saved-addresses-select');
      if (!groupEl || !selectEl) return;

      const user = getActiveUser();
      if (!user) {
        groupEl.style.setProperty('display', 'none', 'important');
        return;
      }

      const saved = user.savedAddresses || [];
      if (saved.length < 1) {
        groupEl.style.setProperty('display', 'none', 'important');
        return;
      }

      groupEl.style.setProperty('display', 'block', 'important');

      let optionsHtml = `<option value="">-- தேர்ந்தெடுக்கவும் / Choose Saved Address --</option>`;
      saved.forEach(item => {
        const isSelected = (user.address === item.address) ? 'selected' : '';
        const cleanLabel = item.label.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').replace(/^[^a-zA-Z0-9\s]+/g, '').trim();
        optionsHtml += `<option value="${item.id}" ${isSelected}>${cleanLabel}: ${item.address.substring(0, 45)}${item.address.length > 45 ? '...' : ''}</option>`;
      });

      selectEl.innerHTML = optionsHtml;
    }

    function selectCartSavedAddress(addrId) {
      if (!addrId) return;
      const user = getActiveUser();
      if (!user) return;

      const saved = user.savedAddresses || [];
      const found = saved.find(item => item.id === addrId);
      if (!found) return;

      syncPrimaryUserAddress(found.address, found.latitude, found.longitude);
      renderAllAddressCards();
      showToast(currentLang === 'ta' ? "விநியோக முகவரி புதுப்பிக்கப்பட்டது! 🎯" : "Delivery address updated successfully! 🎯", "success");
    }

    async function registerRealFcmToken() {
      if (typeof AndroidStorage === 'undefined' || typeof AndroidStorage.getFcmToken !== 'function') return;

      try {
        const token = AndroidStorage.getFcmToken();
        if (!token) return;

        const user = getActiveUser();
        if (user) {
          user.fcmToken = token;
          user.realFcmToken = token;
          saveData('ek_active_user', user);

          const users = getData('ek_users', []);
          const idx = users.findIndex(u => u && (u.id === user.id || u.phone === user.phone));
          if (idx !== -1) {
            users[idx].fcmToken = token;
            users[idx].realFcmToken = token;
            saveData('ek_users', users);
          }
        }

        if (!user || !db) return;

        await db.collection('ek_users').doc(user.id).set({
          fcmToken: token,
          realFcmToken: token,
          fcmTokenUpdatedAt: new Date().toISOString()
        }, { merge: true }).catch(err => console.warn('[FCM] ek_users set error:', err));

        await db.collection('ek_customers').doc(user.id).set({
          fcmToken: token,
          realFcmToken: token,
          fcmTokenUpdatedAt: new Date().toISOString()
        }, { merge: true }).catch(err => console.warn('[FCM] ek_customers set error:', err));

        debugLog('[FCM] Real token registered for user:', user.id);
      } catch (err) {
        console.error('[FCM] Token registration failed:', err);
      }

      // Listen for FCM token refresh
      if (typeof firebase !== 'undefined' && firebase.messaging && typeof firebase.messaging === 'function') {
        try {
          const messaging = firebase.messaging();
          if (messaging && typeof messaging.onTokenRefresh === 'function') {
            messaging.onTokenRefresh(async () => {
              console.log('[FCM] Token refreshed, re-registering...');
              try {
                const newToken = await messaging.getToken();
                if (newToken) {
                  const currentUser = getActiveUser();
                  if (currentUser) {
                    currentUser.fcmToken = newToken;
                    currentUser.realFcmToken = newToken;
                    saveData('ek_active_user', currentUser);

                    const users = getData('ek_users', []);
                    const idx = users.findIndex(u => u && (u.id === currentUser.id || u.phone === currentUser.phone));
                    if (idx !== -1) {
                      users[idx].fcmToken = newToken;
                      users[idx].realFcmToken = newToken;
                      saveData('ek_users', users);
                    }

                    if (db) {
                      await db.collection('ek_users').doc(currentUser.id).set({
                        fcmToken: newToken,
                        realFcmToken: newToken,
                        fcmTokenUpdatedAt: new Date().toISOString()
                      }, { merge: true }).catch(e => console.warn('[FCM Refresh] Firestore sync error:', e));

                      await db.collection('ek_customers').doc(currentUser.id).set({
                        fcmToken: newToken,
                        realFcmToken: newToken,
                        fcmTokenUpdatedAt: new Date().toISOString()
                      }, { merge: true }).catch(e => console.warn('[FCM Refresh] ek_customers sync error:', e));
                    }

                    console.log('[FCM] Token refreshed and saved successfully.');
                  }
                }
              } catch (refreshErr) {
                console.error('[FCM] Token refresh failed:', refreshErr);
              }
            });
          }
        } catch (msgErr) {
          console.warn('[FCM] messaging() not available:', msgErr);
        }
      }
    }

    async function getCustomerFcmToken(target) {
      if (!target) return null;

      const isValidToken = (t) => t && typeof t === 'string' && t.trim() !== '' && t !== 'null' && t !== 'undefined';

      if (typeof target === 'object') {
        if (isValidToken(target.customerFcmToken)) return target.customerFcmToken.trim();
        if (isValidToken(target.fcmToken)) return target.fcmToken.trim();
        if (isValidToken(target.realFcmToken)) return target.realFcmToken.trim();

        const targetId = target.customerId || target.userId || target.id;
        const targetPhone = target.customerPhone || target.phone;

        const users = getDataCached('ek_users', []);
        const foundUser = users.find(u => u && ((targetId && u.id === targetId) || (targetPhone && u.phone === targetPhone)));
        if (foundUser) {
          if (isValidToken(foundUser.fcmToken)) return foundUser.fcmToken.trim();
          if (isValidToken(foundUser.realFcmToken)) return foundUser.realFcmToken.trim();
        }

        if (typeof db !== 'undefined' && db && targetId) {
          try {
            const userDoc = await db.collection('ek_users').doc(targetId).get();
            if (userDoc.exists) {
              const data = userDoc.data();
              if (data) {
                if (isValidToken(data.fcmToken)) return data.fcmToken.trim();
                if (isValidToken(data.realFcmToken)) return data.realFcmToken.trim();
              }
            }
          } catch (e) {
            console.warn("[getCustomerFcmToken] Firestore ek_users lookup error:", e);
          }
        }
        return null;
      }

      if (typeof target === 'string') {
        if (isValidToken(target)) return target.trim();

        const users = getDataCached('ek_users', []);
        const foundUser = users.find(u => u && (u.id === target || u.phone === target));
        if (foundUser) {
          if (isValidToken(foundUser.fcmToken)) return foundUser.fcmToken.trim();
          if (isValidToken(foundUser.realFcmToken)) return foundUser.realFcmToken.trim();
        }
        if (typeof db !== 'undefined' && db) {
          try {
            const userDoc = await db.collection('ek_users').doc(target).get();
            if (userDoc.exists) {
              const data = userDoc.data();
              if (data) {
                if (isValidToken(data.fcmToken)) return data.fcmToken.trim();
                if (isValidToken(data.realFcmToken)) return data.realFcmToken.trim();
              }
            }
          } catch (e) {
            console.warn("[getCustomerFcmToken] Firestore lookup error:", e);
          }
        }
      }
      return null;
    }

    window.getCustomerFcmToken = getCustomerFcmToken;

    window.onAndroidFcmTokenReceived = function(token) {
      debugLog("[FCM] Received token from native Android wrapper:", token);
      if (token) {
        const user = getActiveUser();
        if (user) {
          user.fcmToken = token;
          user.realFcmToken = token;
          saveData('ek_active_user', user);

          const users = getData('ek_users', []);
          const idx = users.findIndex(u => u && (u.id === user.id || u.phone === user.phone));
          if (idx !== -1) {
            users[idx].fcmToken = token;
            users[idx].realFcmToken = token;
            saveData('ek_users', users);
          }
        }
        registerRealFcmToken();
      }
    };

    function getAdminSession() {
      return getData('ek_admin_session', null);
    }

    function showGlobalLogoutLoading() {
      let loader = document.getElementById('global-logout-loader');
      if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-logout-loader';
        loader.style.position = 'fixed';
        loader.style.top = '0';
        loader.style.left = '0';
        loader.style.width = '100vw';
        loader.style.height = '100vh';
        loader.style.background = 'rgba(0,0,0,0.85)';
        loader.style.zIndex = '100000';
        loader.style.display = 'flex';
        loader.style.flexDirection = 'column';
        loader.style.alignItems = 'center';
        loader.style.justifyContent = 'center';
        loader.style.color = '#fff';
        loader.style.backdropFilter = 'blur(4px)';
        loader.innerHTML = `
          <span class="spinner" style="display:inline-block; width:32px; height:32px; border:3px solid var(--accent-orange); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:12px;"></span>
          <p style="font-size:13px; font-weight:700; font-family:'Poppins', sans-serif;">
            ${currentLang === 'ta' ? 'வெளியேறுகிறது... / Logging out...' : 'Logging out...'}
          </p>
        `;
        document.body.appendChild(loader);
      }
      loader.style.display = 'flex';
    }

    function hideGlobalLogoutLoading() {
      const loader = document.getElementById('global-logout-loader');
      if (loader) {
        loader.style.display = 'none';
      }
    }

    async function processPendingSignOut() {
      if (typeof firebase !== 'undefined' && firebase.auth && getData('ek_pending_signout') === true) {
        debugLog("[Auth] Found pending background signout. Retrying...");
        try {
          await firebase.auth().signOut();
          debugLog("[Auth] Background signOut retry successful!");
          removeData('ek_pending_signout');
        } catch (e) {
          console.error("[Auth] Background signOut retry failed:", e);
        }
      }
    }

    // Process pending signout on back-online, startup, and interval
    window.addEventListener('online', () => {
      try {
        processPendingSignOut();
      } catch (e) {
        console.error("[Auth] Error during processPendingSignOut on online event:", e);
      }
    });

    setInterval(() => {
      if (document.hidden || window._isAppBackgrounded) return;
      try {
        processPendingSignOut();
      } catch (e) {
        console.error("[Auth] Error during processPendingSignOut interval:", e);
      }
    }, 30000);

    // Initial load check
    try {
      processPendingSignOut();
    } catch (e) {}

    const masterAuthKeysToClear = [
      'ek_admin_session',
      'ek_customer_session',
      'ek_delivery_session',
      'ek_customer_session_temp',
      'ek_admin_remember_me',
      'ek_customer_remember_me',
      'ek_delivery_remember_me',
      'ek_remembered_credentials',
      'ek_remembered_admin_credentials',
      'ek_remembered_delivery_credentials',
      'ek_role',
      'ek_user_role',
      'ek_active_role',
      'role',
      'user_id',
      'remember_me',
      'rememberMe',
      'ek_pending_signout',
      'ek_active_session',
      'ek_active_user',
      'ek_customer_favorites',
      'ek_lyo_chat_messages',
      'ek_assigned_deliveries',
      'ek_delivery_orders',
      'ek_admin_orders',
      'ek_admin_stats',
      'ek_pending_upi_order_data',
      'ek_referred_by_code',
      'ek_notifications'
    ];

    function purgeAllMasterSessionsAndTokens() {
      masterAuthKeysToClear.forEach(key => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
          if (typeof removeData === 'function') removeData(key);
          if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.saveData === 'function') {
            AndroidStorage.saveData(key, "");
          }
        } catch (ce) {}
      });
      try { sessionStorage.clear(); } catch(se) {}
    }

    let _adminLogoutPending = false;

    window.adminLogout = async function(evt) {
      if (evt && evt.preventDefault) evt.preventDefault();
      if (evt && evt.stopPropagation) evt.stopPropagation();

      if (_adminLogoutPending) return;
      _adminLogoutPending = true;

      const btn = (evt && evt.currentTarget) ? evt.currentTarget : (document.querySelector('#admin-header-logout-btn') || document.querySelector('button[onclick*="adminLogout"]') || document.querySelector('button[onclick*="handleAdminLogoutClick"]'));
      if (btn) btn.disabled = true;

      const resetBtn = () => {
        _adminLogoutPending = false;
        if (btn) btn.disabled = false;
      };

      const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
      const title = isTa ? "வெளியேறு / Logout" : "Admin Logout";
      const msg = isTa ? "நிர்வாகி பேனலில் இருந்து வெளியேற விரும்புகிறீர்களா?" : "Are you sure you want to logout from admin panel?";
      const okText = isTa ? "வெளியேறு" : "Logout";
      const cancelText = isTa ? "ரத்து" : "Cancel";

      let handled = false;

      const performLogoutAction = async () => {
        if (handled) return;
        handled = true;
        try {
          if (typeof setExplicitLogoutInProgress === 'function') {
            setExplicitLogoutInProgress(true);
          } else {
            window.isExplicitLogoutInProgress = true;
          }

          if (typeof showGlobalLogoutLoading === 'function') {
            showGlobalLogoutLoading();
          }

          if (typeof saveData === 'function') {
            saveData('ek_explicit_logged_out', true);
          }

          try {
            if (typeof teardownLiveListeners === 'function') teardownLiveListeners();
          } catch (te) {
            console.warn("teardownLiveListeners error:", te);
          }

          if (typeof firebase !== 'undefined' && firebase.auth) {
            try {
              await Promise.race([
                firebase.auth().signOut().then(() => {
                  debugLog("[Auth] Firebase Admin Auth signOut completed.");
                  if (typeof removeData === 'function') removeData('ek_pending_signout');
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
              ]);
            } catch (e) {
              console.error("[Auth] Firebase Admin signOut error or timeout:", e);
              if (typeof saveData === 'function') saveData('ek_pending_signout', true);
            }
          }

          try {
            if (typeof setupCloudRealtimeListeners2 === 'function') setupCloudRealtimeListeners2();
          } catch (se) {}

          purgeAllMasterSessionsAndTokens();

          if (typeof safelyClearUserCacheOnLogout === 'function') {
            try { await safelyClearUserCacheOnLogout(); } catch(e) {}
          }

          cart = [];
          screenHistory = [];
          if (typeof updateCartBadge === 'function') { try { updateCartBadge(); } catch(e) {} }

          const loginForm = document.getElementById('login-form');
          if (loginForm) loginForm.reset();
          const regForm = document.getElementById('register-form');
          if (regForm) regForm.reset();
          const passInput = document.getElementById('login-password');
          if (passInput) passInput.value = '';

          if (typeof currentLoginMode !== 'undefined') currentLoginMode = 'admin';
          if (typeof enterAdminLogin === 'function') {
            try { enterAdminLogin(); } catch (e) {}
          }

          showToast(isTa ? "அட்மின் கணக்கிலிருந்து வெளியேறப்பட்டது 🚪" : "Admin logged out successfully 🚪", "info");

          if (typeof showScreen === 'function') {
            showScreen('screen-login');
          }
        } catch (err) {
          console.error("[Admin Logout Error]", err);
          if (typeof showScreen === 'function') showScreen('screen-login');
        } finally {
          if (typeof setExplicitLogoutInProgress === 'function') {
            setExplicitLogoutInProgress(false);
          } else {
            window.isExplicitLogoutInProgress = false;
          }
          if (typeof hideGlobalLogoutLoading === 'function') {
            hideGlobalLogoutLoading();
          }
          resetBtn();
        }
      };

      const failsafeTimer = setTimeout(() => {
        if (!handled) {
          const m = document.getElementById('custom-confirm-modal');
          const isVisible = m && window.getComputedStyle(m).display !== 'none' && m.classList.contains('active');
          if (!isVisible) {
            console.warn("[Admin Logout Failsafe] Confirm modal not visible, executing logout directly.");
            performLogoutAction();
          }
        }
      }, 1200);

      try {
        if (typeof showCustomConfirm === 'function') {
          showCustomConfirm(title, msg, () => {
            clearTimeout(failsafeTimer);
            performLogoutAction();
          }, () => {
            clearTimeout(failsafeTimer);
            resetBtn();
          }, okText, cancelText);
        } else {
          clearTimeout(failsafeTimer);
          if (confirm(msg)) {
            await performLogoutAction();
          } else {
            resetBtn();
          }
        }
      } catch (e) {
        clearTimeout(failsafeTimer);
        console.error("showCustomConfirm error in adminLogout, running performLogoutAction:", e);
        await performLogoutAction();
      }
    };

    window.lockAdmin = window.adminLogout;
    window.lockAdminPanel = window.adminLogout;
    window.handleAdminLock = window.adminLogout;
    window.handleAdminLogoutClick = window.adminLogout;
    async function performAdminSignOut() {
      return window.adminLogout();
    }

    function scrollToEditProfile() {
      const card = document.getElementById('edit-profile-card');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const originalBorder = card.style.borderColor;
        card.style.borderColor = 'var(--accent-orange)';
        setTimeout(() => {
          card.style.borderColor = originalBorder;
        }, 1500);
      }
    }

    let _customerLogoutPending = false;

    function handleLogout(evt) {
      if (evt && evt.preventDefault) evt.preventDefault();
      if (evt && evt.stopPropagation) evt.stopPropagation();
      if (_customerLogoutPending) return;
      _customerLogoutPending = true;

      const btn = (evt && evt.currentTarget) ? evt.currentTarget : (document.querySelector('.btn-logout-profile') || document.querySelector('button[onclick*="handleLogout"]'));
      if (btn) btn.disabled = true;

      const resetBtn = () => {
        _customerLogoutPending = false;
        if (btn) btn.disabled = false;
      };

      const title = (typeof currentLang !== 'undefined' && currentLang === 'ta') ? "வெளியேறு" : "Logout";
      const msg = (typeof currentLang !== 'undefined' && currentLang === 'ta')
        ? "நீங்கள் வெளியேற விரும்புகிறீர்களா?"
        : "Are you sure you want to logout?";

      const okText = (typeof currentLang !== 'undefined' && currentLang === 'ta') ? "வெளியேறு" : "Logout";
      const cancelText = (typeof currentLang !== 'undefined' && currentLang === 'ta') ? "ரத்துசெய்" : "Cancel";

      let handled = false;
      const runLogout = () => {
        if (handled) return;
        handled = true;
        executeLogout().finally(resetBtn);
      };

      const failsafeTimer = setTimeout(() => {
        if (!handled) {
          const m = document.getElementById('custom-confirm-modal');
          const isVisible = m && window.getComputedStyle(m).display !== 'none' && m.classList.contains('active');
          if (!isVisible) {
            console.warn("[Customer Logout Failsafe] Confirm modal not visible, executing logout directly.");
            runLogout();
          }
        }
      }, 1000);

      try {
        showCustomConfirm(title, msg, () => {
          clearTimeout(failsafeTimer);
          runLogout();
        }, () => {
          clearTimeout(failsafeTimer);
          resetBtn();
        }, okText, cancelText);
      } catch (e) {
        clearTimeout(failsafeTimer);
        console.error("showCustomConfirm error in handleLogout, executing runLogout:", e);
        runLogout();
      }
    }

    async function executeLogout() {
      setExplicitLogoutInProgress(true);
      try {
        showGlobalLogoutLoading();

        try {
          teardownLiveListeners();
        } catch (te) {
          console.warn("Error during teardownLiveListeners on customer logout:", te);
        }

        if (typeof firebase !== 'undefined' && firebase.auth) {
          try {
            await Promise.race([
              firebase.auth().signOut().then(() => {
                debugLog("[Auth] Firebase Auth sign out successful.");
                removeData('ek_pending_signout');
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
            ]);
          } catch (e) {
            console.error("[Auth] Firebase signout error or timeout:", e);
            saveData('ek_pending_signout', true);
          }
        }

        if (typeof saveData === 'function') {
          saveData('ek_explicit_logged_out', true);
        }

        try {
          setupCloudRealtimeListeners2();
        } catch (se) {}

        purgeAllMasterSessionsAndTokens();

        if (typeof safelyClearUserCacheOnLogout === 'function') {
          try { await safelyClearUserCacheOnLogout(); } catch(e) {}
        }

        cart = [];
        try {
          updateCartBadge();
        } catch (ce) {}

        screenHistory = [];

        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.reset();
        const regForm = document.getElementById('register-form');
        if (regForm) regForm.reset();
        const passInput = document.getElementById('login-password');
        if (passInput) passInput.value = '';

        const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
        showToast(isTa ? "வெற்றிகரமாக வெளியேறப்பட்டது 🚪" : "Logged out successfully 🚪", "info");

        if (typeof enterCustomerLogin === 'function') enterCustomerLogin();
        showScreen('screen-login');
      } catch (err) {
        console.error("[Logout Error]", err);
        showScreen('screen-login');
      } finally {
        setExplicitLogoutInProgress(false);
        hideGlobalLogoutLoading();
      }
    }

    function handleDeleteAccountClick() {
      const session = getData('ek_customer_session');
      if (!session) {
        showToast(currentLang === 'ta' ? "இந்த செயல் வாடிக்கையாளர்களுக்கு மட்டுமே கிடைக்கும்." : "This action is only available to registered customers.", "error");
        return;
      }

      const title = currentLang === 'ta' ? "கணக்கை நீக்கவா?" : "Delete account?";
      const msg = currentLang === 'ta'
        ? "உங்கள் வாடிக்கையாளர் கணக்கு, சேமிக்கப்பட்ட முகவரிகள் மற்றும் ஆர்டர் தகவல்கள் அனைத்தும் நிரந்தரமாக நீக்கப்படும். இந்தச் செயல்முறையை மாற்ற முடியாது."
        : "Are you sure you want to permanently delete your account? All your personal profile, addresses, and statistics will be wiped out.";

      const okText = currentLang === 'ta' ? "நீக்கு" : "Delete";
      const cancelText = currentLang === 'ta' ? "ரத்துசெய்" : "Cancel";

      showCustomConfirm(title, msg, () => {
        executeAccountDeletion();
      }, null, okText, cancelText);
    }

    function showPasswordPromptModal(onSuccess, onCancel) {
      let modal = document.getElementById('password-prompt-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'password-prompt-modal';
        modal.className = 'modal-backdrop';
        modal.style.zIndex = '99999';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.padding = '20px';
        modal.innerHTML = `
          <div class="bottom-sheet" style="width: 100%; max-width:340px; border-radius:24px; border:1.5px solid #2d2d2d; background:#121212; padding:24px; box-shadow:0 12px 35px rgba(0,0,0,0.85); transform:scale(0.85); transition:all 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28); margin:auto; display:flex; flex-direction:column;">
            <div style="font-size:36px; margin-bottom:14px; text-align:center;">🔑</div>
            <h3 style="color:#ffffff; font-size:16px; margin-bottom:8px; font-weight:800; text-align:center; font-family:'Poppins', 'Hind Madurai', sans-serif;">
              \${currentLang === 'ta' ? "உறுதிப்படுத்த கடவுச்சொல்" : "Confirm Password"}
            </h3>
            <p style="color:var(--text-secondary); font-size:12px; margin-bottom:16px; line-height:1.5; text-align:center; font-family:'Poppins', 'Hind Madurai', sans-serif;">
              \${currentLang === 'ta'
                ? "கணக்கை நீக்க உங்கள் கடவுச்சொல்லை உள்ளிட்டு உறுதிப்படுத்தவும்."
                : "Please enter your password to confirm and delete your account."}
            </p>
            <div style="position: relative; width: 100%; margin-bottom: 20px;">
              <input type="password" id="reauth-password-input" placeholder="\${currentLang === 'ta' ? "கடவுச்சொல்" : "Password"}" style="width:100%; background:#1c1c1e; border:1px solid #2c2c2e; border-radius:12px; padding:12px 40px 12px 12px; color:#fff; font-size:14px; box-sizing:border-box; outline:none; text-align:center;" />
              <span style="position: absolute; right: 14px; top: 12px; font-size: 16px; cursor: pointer; color: var(--text-muted);" onclick="togglePasswordVisibility('reauth-password-input', this)">👁️</span>
            </div>
            <div style="display:flex; gap:12px; justify-content:center; width:100%;">
              <button class="btn btn-secondary" style="flex:1; padding:10px 14px; font-size:12px; font-weight:bold; border-radius:14px; min-height:42px; height:auto; background:#1c1c1e; color:#aeaea2; border:1px solid #2c2c2e;" id="reauth-cancel-btn">
                \${currentLang === 'ta' ? "ரத்துசெய்" : "CANCEL"}
              </button>
              <button class="btn" style="flex:1; padding:10px 14px; font-size:12px; font-weight:800; border-radius:14px; min-height:42px; height:auto; background:#ef4444; color:#ffffff; border:1.5px solid #ef4444;" id="reauth-confirm-btn">
                \${currentLang === 'ta' ? "உறுதிசெய்" : "CONFIRM"}
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      const pwdInput = document.getElementById('reauth-password-input');
      pwdInput.value = '';

      const cancelBtn = document.getElementById('reauth-cancel-btn');
      const confirmBtn = document.getElementById('reauth-confirm-btn');

      const closeModal = () => {
        modal.classList.remove('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(0.85)';
        setTimeout(() => { modal.style.display = 'none'; }, 200);
      };

      cancelBtn.onclick = function() {
        closeModal();
        if (onCancel) onCancel();
      };

      confirmBtn.onclick = function() {
        const password = pwdInput.value.trim();
        if (!password) {
          showToast(currentLang === 'ta' ? "தயவுசெய்து கடவுச்சொல்லை உள்ளிடவும்." : "Please enter your password.", "warning");
          return;
        }
        closeModal();
        if (onSuccess) onSuccess(password);
      };

      modal.style.display = 'flex';
      setTimeout(() => {
        modal.classList.add('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(1)';
        pwdInput.focus();
      }, 15);
    }

    async function executeAccountDeletion(password = null) {
      const user = getActiveUser();
      if (!user) {
        showToast(currentLang === 'ta' ? "வாடிக்கையாளர் கணக்கு எதுவும் கண்டறியப்படவில்லை." : "No customer account found.", "error");
        return;
      }

      if (typeof firebase === 'undefined' || !firebase.auth) {
        showToast(currentLang === 'ta' ? "இணைய இணைப்பு அல்லது சேவையில் சிக்கல் உள்ளது." : "Firebase authentication is not available.", "error");
        return;
      }

      const authUser = firebase.auth().currentUser;
      if (!authUser) {
        showToast(currentLang === 'ta' ? "அக்கவுண்ட் அணுகல் தற்காலிகமாக செயலிழந்தது. மீண்டும் உள்நுழையவும்." : "Authentication session expired. Please log in again.", "error");
        return;
      }

      showToast(currentLang === 'ta' ? "கணக்கு நீக்கப்பட்டு வருகிறது..." : "Processing account deletion...", "info");

      try {
        if (password) {
          const credential = firebase.auth.EmailAuthProvider.credential(authUser.email, password);
          await authUser.reauthenticateWithCredential(credential);
          debugLog("[Auth] Re-authentication successful");
        }

        // Anonymize/Clean up Firestore profile first while auth user credentials are valid
        if (typeof db !== 'undefined' && db && user && user.id) {
          try {
            await db.collection('ek_users').doc(user.id).set({
              id: user.id,
              name: "Deleted User / நீக்கப்பட்ட நபர்",
              phone: "0000000000",
              email: "deleted@app.com",
              address: "Anonymized / அநாமதேயப்படுத்தப்பட்டது",
              landmark: "Anonymized",
              pincode: "",
              loyaltyPoints: 0,
              tier: "bronze",
              status: "deleted",
              deletedAt: new Date().toISOString()
            });
            debugLog("[Firestore] Customer profile anonymized successfully");
          } catch (dbErr) {
            console.warn("[Firestore] Failed to update Firestore profile doc:", dbErr);
          }
        }

        await authUser.delete();
        debugLog("[Auth] Firebase Auth account deleted successfully");

        removeData('ek_customer_session');
        sessionStorage.removeItem('ek_customer_session_temp');
        cart = [];
        updateCartBadge();
        screenHistory = [];

        let localUsers = getData('ek_users', []) || [];
        localUsers = localUsers.filter(u => u.id !== user.id);
        saveData('ek_users', localUsers);

        showToast(
          currentLang === 'ta'
            ? "உங்கள் கணக்கு வெற்றிகரமாக நீக்கப்பட்டது."
            : "Your account has been deleted successfully.",
          "success"
        );

        showScreen('screen-login');
        setupCloudRealtimeListeners2();

      } catch (err) {
        console.error("[Account Deletion Error]", err);

        if (err.code === 'auth/requires-recent-login') {
          showPasswordPromptModal(
            async (pwd) => {
              await executeAccountDeletion(pwd);
            },
            () => {
              showToast(
                currentLang === 'ta'
                  ? "கணக்கு நீக்கம் ரத்து செய்யப்பட்டது."
                  : "Account deletion cancelled.",
                "info"
              );
            }
          );
        } else {
          let friendlyError = err.message || err.toString();
          if (err.code === 'auth/wrong-password') {
            friendlyError = currentLang === 'ta' ? "தவறான கடவுச்சொல். தயவுசெய்து மீண்டும் முயற்சிக்கவும்." : "Incorrect password. Please try again.";
          } else if (err.code === 'auth/network-request-failed') {
            friendlyError = currentLang === 'ta' ? "இணைய இணைப்பு தோல்வியடைந்தது." : "Network connection failed. Please check your internet.";
          } else if (err.code === 'auth/user-mismatch') {
            friendlyError = currentLang === 'ta' ? "பயனர் பொருந்தவில்லை." : "User credentials mismatch.";
          }
          showToast(friendlyError, "error");
        }
      }
    }

    let _deliveryLogoutPending = false;

    async function performDeliverySignOut() {
      setExplicitLogoutInProgress(true);
      try {
        showGlobalLogoutLoading();

        try {
          teardownLiveListeners();
        } catch (te) {
          console.warn("Error during teardownLiveListeners on delivery logout:", te);
        }

        if (typeof firebase !== 'undefined' && firebase.auth) {
          try {
            await Promise.race([
              firebase.auth().signOut().then(() => {
                debugLog("[Auth] Firebase Auth delivery partner sign out successful.");
                removeData('ek_pending_signout');
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
            ]);
          } catch (e) {
            console.error("[Auth] Firebase signout error (delivery) or timeout:", e);
            saveData('ek_pending_signout', true);
          }
        }

        try {
          setupCloudRealtimeListeners2();
        } catch (se) {}

        if (typeof saveData === 'function') {
          saveData('ek_explicit_logged_out', true);
        }

        purgeAllMasterSessionsAndTokens();

        if (typeof safelyClearUserCacheOnLogout === 'function') {
          try { await safelyClearUserCacheOnLogout(); } catch(e) {}
        }

        try {
          initDeliveryRiderMap(null);
        } catch (me) {}
        if (window.riderLiveCoordInterval) {
          clearInterval(window.riderLiveCoordInterval);
          window.riderLiveCoordInterval = null;
        }
        if (typeof deliveryLeafletMap !== 'undefined' && deliveryLeafletMap) {
          try {
            deliveryLeafletMap.remove();
          } catch (e) {}
          deliveryLeafletMap = null;
        }

        cart = [];
        try {
          updateCartBadge();
        } catch (ce) {}

        screenHistory = [];

        const passInput = document.getElementById('login-password');
        if (passInput) passInput.value = '';

        const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');
        showToast(isTa ? "டெலிவரி கணக்கிலிருந்து வெளியேறப்பட்டது 🚪" : "Delivery Partner logged out successfully 🚪", "info");

        if (typeof enterDeliveryLogin === 'function') {
          enterDeliveryLogin();
        } else if (typeof enterCustomerLogin === 'function') {
          enterCustomerLogin();
        }
        showScreen('screen-login');
      } catch (err) {
        console.error("[Delivery Logout Error]", err);
        showScreen('screen-login');
      } finally {
        setExplicitLogoutInProgress(false);
        hideGlobalLogoutLoading();
      }
    }

    function handleDeliveryLogout(evt) {
      if (_deliveryLogoutPending) return;
      _deliveryLogoutPending = true;

      const btn = (evt && evt.currentTarget) ? evt.currentTarget : document.querySelector('button[onclick*="handleDeliveryLogout"]');
      if (btn) btn.disabled = true;

      const resetBtn = () => {
        _deliveryLogoutPending = false;
        if (btn) btn.disabled = false;
      };

      const title = currentLang === 'ta' ? "வெளியேறு" : "Logout";
      const msg = currentLang === 'ta'
        ? "டெலிவரி கணக்கிலிருந்து வெளியேற விரும்புகிறீர்களா?"
        : "Log out from Delivery Partner account?";

      const okText = currentLang === 'ta' ? "வெளியேறு" : "Logout";
      const cancelText = currentLang === 'ta' ? "ரத்துசெய்" : "Cancel";

      let handled = false;

      const failsafeTimer = setTimeout(() => {
        if (!handled) {
          const modal = document.getElementById('custom-confirm-modal');
          const isVisible = modal && window.getComputedStyle(modal).display !== 'none';
          if (!isVisible) {
            console.error("[Logout Failsafe] Confirm modal failed to appear, forcing direct sign-out");
            handled = true;
            if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
            performDeliverySignOut().finally(resetBtn);
          }
        }
      }, 1000);

      showCustomConfirm(title, msg, () => {
        handled = true;
        clearTimeout(failsafeTimer);
        performDeliverySignOut().finally(resetBtn);
      }, () => {
        handled = true;
        clearTimeout(failsafeTimer);
        resetBtn();
      }, okText, cancelText);
    }

    function openRiderPasswordChangeModal() {
      const session = getData('ek_delivery_session', null);
      if (!session) {
        showToast("Error: No active delivery session.", "error");
        return;
      }

      const modal = document.createElement('div');
      modal.id = 'rider-password-modal';
      modal.className = 'modal-backdrop';
      modal.style.zIndex = '999999';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      modal.style.padding = '15px';

      modal.innerHTML = `
        <div class="bottom-sheet" style="width: 95%; max-width: 450px; border-radius: 20px; border: 1.5px solid #2d2d2d; background: #0c0c0e; padding: 20px; box-shadow: 0 12px 35px rgba(0,0,0,0.85); transform: scale(0.9); transition: all 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28); display: flex; flex-direction: column; gap: 14px; box-sizing: border-box;">

          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🔐</span>
              <div>
                <h4 style="color: #ffffff; font-size: 13px; font-weight: 800; margin: 0; text-transform: uppercase;">CHANGE PASSWORD / கடவுச்சொல் மாற்று</h4>
                <p style="font-size: 10px; color: var(--text-muted); margin: 0;">Set a secure credentials code</p>
              </div>
            </div>
            <button onclick="closeRiderPasswordChangeModal()" style="background: transparent; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; padding: 4px;">✕</button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px; text-align: left;">
            <label style="color: var(--text-secondary); font-size: 11.5px; font-weight: 700;">NEW SECURE PASSWORD / புதிய கடவுச்சொல்:</label>
            <div style="position: relative;">
              <input type="password" id="rider-new-pass" class="form-control" placeholder="••••••" style="height: 42px; background: #141416; border: 1.5px solid #2d2d2d; border-radius: 12px; padding: 0 40px 0 12px; color: #fff; font-size: 14px; font-family: monospace; box-sizing: border-box; width: 100%;" minlength="4" />
              <span style="position: absolute; right: 14px; top: 11px; font-size: 16px; cursor: pointer; color: var(--text-muted);" onclick="togglePasswordVisibility('rider-new-pass', this)">👁️</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px; text-align: left;">
            <label style="color: var(--text-secondary); font-size: 11.5px; font-weight: 700;">CONFIRM PASSWORD / கடவுச்சொல்லை உறுதிசெய்:</label>
            <div style="position: relative;">
              <input type="password" id="rider-new-pass-confirm" class="form-control" placeholder="••••••" style="height: 42px; background: #141416; border: 1.5px solid #2d2d2d; border-radius: 12px; padding: 0 40px 0 12px; color: #fff; font-size: 14px; font-family: monospace; box-sizing: border-box; width: 100%;" />
              <span style="position: absolute; right: 14px; top: 11px; font-size: 16px; cursor: pointer; color: var(--text-muted);" onclick="togglePasswordVisibility('rider-new-pass-confirm', this)">👁️</span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <button onclick="closeRiderPasswordChangeModal()" class="btn btn-secondary" style="flex: 1; min-height: 42px; height: auto; padding: 10px 14px; margin:0;">CANCEL</button>
            <button onclick="submitRiderPasswordChange()" class="btn" style="flex: 1.5; min-height: 42px; height: auto; padding: 10px 14px; margin:0; background: var(--accent-orange); color: #000; font-weight: 800; border: none; border-radius: 10px;">SAVE / சேமி 💾</button>
          </div>

        </div>
      `;

      document.body.appendChild(modal);

      setTimeout(() => {
        modal.classList.add('active');
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(1)';
      }, 10);
    }

    function closeRiderPasswordChangeModal() {
      const modal = document.getElementById('rider-password-modal');
      if (modal) {
        const sheet = modal.querySelector('.bottom-sheet');
        if (sheet) sheet.style.transform = 'scale(0.9)';
        modal.classList.remove('active');
        setTimeout(() => {
          modal.remove();
        }, 200);
      }
    }

    async function submitRiderPasswordChange() {
      const session = getData('ek_delivery_session', null);
      if (!session) return;

      const p1 = document.getElementById('rider-new-pass').value.trim();
      const p2 = document.getElementById('rider-new-pass-confirm').value.trim();

      if (!p1) {
        showToast("Password cannot be blank / கடவுச்சொல் காலியாக இருக்கக்கூடாது.", "error");
        return;
      }
      if (p1.length < 4) {
        showToast("Password must be at least 4 chars long / குறைந்தது 4 எழுத்துக்கள் இருக்க வேண்டும்.", "error");
        return;
      }
      if (p1 !== p2) {
        showToast("Passwords do not match / கடவுச்சொற்கள் பொருந்தவில்லை.", "error");
        return;
      }

      const list = getData('ek_delivery_persons', []);
      const idx = list.findIndex(e => e.id === session.id);
      if (idx !== -1) {
        let hashedP1 = p1;
        if (typeof hashPassword === 'function') {
          hashedP1 = 'hash:' + await hashPassword(p1);
        }
        list[idx].password = hashedP1;
        saveData('ek_delivery_persons', list);

        session.password = hashedP1;
        saveData('ek_delivery_session', session);

        if (typeof db !== 'undefined' && db) {
          db.collection('ek_delivery_persons').doc(session.id).update({ password: hashedP1 })
            .then(() => {
              showToast("Password updated live on cloud and device! ✓", "success");
            })
            .catch(err => {
              showToast("Password updated on device successfully! ✓", "success");
              console.warn("Cloud sync deferred:", err);
            });
        } else {
          showToast("Password updated on device successfully! ✓", "success");
        }

        closeRiderPasswordChangeModal();
      } else {
        showToast("Error locating your delivery partner record.", "error");
      }
    }

    if (typeof DEFAULT_CATEGORIES === 'undefined') {
      window.DEFAULT_CATEGORIES = [
        { id: 'meat', nameEn: 'Meat', nameTa: 'கறிவகை', en: 'Meat', ta: 'கறிவகை', icon: '🥩', accentColor: '#C62828', order: 0 },
        { id: 'veg', nameEn: 'Veg', nameTa: 'காய்கறி', en: 'Veg', ta: 'காய்கறி', icon: '🥦', accentColor: '#4CAF50', order: 1 },
        { id: 'fish', nameEn: 'Fish', nameTa: 'மீன்வகை', en: 'Fish', ta: 'மீன்வகை', icon: '🐟', accentColor: '#0288D1', order: 2 },
        { id: 'fruits', nameEn: 'Fruits', nameTa: 'பழங்கள்', en: 'Fruits', ta: 'பழங்கள்', icon: '🍎', accentColor: '#2E7D32', order: 3 },
        { id: 'dairy', nameEn: 'Dairy & Eggs', nameTa: 'பால் & முட்டை', en: 'Dairy & Eggs', ta: 'பால் & முட்டை', icon: '🥛', accentColor: '#FFB300', order: 4 },
        { id: 'bakery', nameEn: 'Bakery', nameTa: 'பேக்கரி', en: 'Bakery', ta: 'பேக்கரி', icon: '🍞', accentColor: '#8D6E63', order: 5 },
        { id: 'groceries', nameEn: 'Grocery', nameTa: 'மளிகை', en: 'Grocery', ta: 'மளிகை', icon: '🥫', accentColor: '#008080', order: 6 }
      ];
    }

    function getCategoryConfig(catId) {
      const cid = String(catId || '').toLowerCase().trim();
      if (cid === 'all') return { color: '#2E7D32', icon: '🍽️' };
      if (cid === 'favorites') return { color: '#E91E63', icon: '❤️' };

      const catList = getCategoriesList();
      const matched = catList.find(c => String(c.id).toLowerCase().trim() === cid);
      if (matched && (matched.accentColor || matched.color)) {
        return { color: matched.accentColor || matched.color, icon: matched.icon || '📦' };
      }

      if (cid.includes('fruit')) return { color: '#2E7D32', icon: '🍎' }; // green
      if (cid.includes('veg')) return { color: '#4CAF50', icon: '🥦' }; // leafy green
      if (cid.includes('fish') || cid.includes('sea')) return { color: '#0288D1', icon: '🐟' }; // blue
      if (cid.includes('meat') || cid.includes('mutton') || cid.includes('chicken')) return { color: '#C62828', icon: '🥩' }; // maroon/red
      if (cid.includes('dairy') || cid.includes('egg')) return { color: '#FFB300', icon: '🥛' }; // amber
      if (cid.includes('bake') || cid.includes('bread')) return { color: '#8D6E63', icon: '🍞' }; // brown
      if (cid.includes('groc') || cid.includes('oil') || cid.includes('rice') || cid.includes('provi')) return { color: '#008080', icon: '🥫' }; // teal
      return { color: '#2E7D32', icon: '📦' }; // Leafy green as fallback
    }

    function getCategoriesList() {
      if (window._categoriesListCachedValue && Array.isArray(window._categoriesListCachedValue) && window._categoriesListCachedValue.length > 0) {
        return window._categoriesListCachedValue;
      }
      let catList = getData('ek_categories');
      if (!Array.isArray(catList) || catList.length === 0) {
        if (typeof DEFAULT_CATEGORIES !== 'undefined' && Array.isArray(DEFAULT_CATEGORIES)) {
          catList = DEFAULT_CATEGORIES.map((c, idx) => ({ ...c, isAvailable: true, order: (c.order !== undefined && c.order !== null ? Number(c.order) : idx) }));
          try { saveData('ek_categories', catList); } catch (e) {}
        } else {
          catList = [];
        }
      }

      catList = (catList || []).filter(c => c && c.id);
      let needsStorageSave = false;
      catList.forEach((c, idx) => {
        if (c.order === undefined || c.order === null || isNaN(Number(c.order))) {
          if (typeof DEFAULT_CATEGORIES !== 'undefined' && Array.isArray(DEFAULT_CATEGORIES)) {
            const defIndex = DEFAULT_CATEGORIES.findIndex(d => String(d.id).toLowerCase() === String(c.id).toLowerCase());
            c.order = defIndex >= 0 ? defIndex : idx;
          } else {
            c.order = idx;
          }
          needsStorageSave = true;
        } else {
          c.order = Number(c.order);
        }

        if (c.isScheduled) {
          if (typeof updateCategoryAvailability === 'function') {
            try { updateCategoryAvailability(c); } catch(e) {}
          }
        } else {
          c.isAvailable = true;
        }
      });

      catList.sort((a, b) => {
        const orderA = (a && a.order !== undefined && a.order !== null && !isNaN(Number(a.order))) ? Number(a.order) : 999;
        const orderB = (b && b.order !== undefined && b.order !== null && !isNaN(Number(b.order))) ? Number(b.order) : 999;
        if (orderA !== orderB) return orderA - orderB;
        return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
      });

      if (needsStorageSave) {
        saveData('ek_categories', catList);
      }

      window._categoriesListCachedValue = catList;
      return window._categoriesListCachedValue;
    }

    function getCategoryName(cat) {
      const isTa = currentLang === 'ta';
      const catList = getCategoriesList();
      const matched = catList.find(c => c.id === cat);
      if (matched) {
        return isTa ? (matched.nameTa || matched.ta) : (matched.nameEn || matched.en);
      }
      const map = {
        meat: isTa ? 'கறிவகை' : 'Meat',
        fish: isTa ? 'மீன்வகை' : 'Fish',
        veg: isTa ? 'காய்கறி' : 'Veg',
        fruits: isTa ? 'பழங்கள்' : 'Fruits',
        dairy: isTa ? 'பால் & முட்டை' : 'Dairy & Eggs',
        groceries: isTa ? 'மளிகை' : 'Groceries'
      };
      return map[cat] || cat;
    }

    function populateProductCategoryOptions() {
      const selectAdd = document.getElementById('add-prod-category');
      const selectEdit = document.getElementById('edit-prod-category');
      const catList = getCategoriesList();

      const optionsHtml = catList.map(c => {
        const nameEn = c.nameEn || c.en || c.id || 'Category';
        const nameTa = c.nameTa || c.ta || nameEn;
        const icon = c.icon || '📦';
        return `<option value="${c.id}">${nameEn} (${icon} ${nameTa})</option>`;
      }).join('');

      if (selectAdd) {
        const currentSelection = selectAdd.value;
        selectAdd.innerHTML = optionsHtml;
        if (currentSelection && catList.some(c => c.id === currentSelection)) {
          selectAdd.value = currentSelection;
        }
      }
      if (selectEdit) {
        const currentSelection = selectEdit.value;
        selectEdit.innerHTML = optionsHtml;
        if (currentSelection && catList.some(c => c.id === currentSelection)) {
          selectEdit.value = currentSelection;
        }
      }
    }

    function toggleFavoriteProduct(productId, event) {
      if (event) {
        event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
      }
      if (!productId) return;
      const pidStr = String(productId).trim();
      const rawFavs = getData('ek_customer_favorites', []);
      let favorites = (Array.isArray(rawFavs) ? rawFavs : []).map(id => String(id).trim());
      const isTa = (typeof currentLang !== 'undefined' && currentLang === 'ta');

      const index = favorites.indexOf(pidStr);
      let isNowFav = false;
      if (index === -1) {
        favorites.push(pidStr);
        isNowFav = true;
        showToast(isTa ? "❤️ விருப்பப்பட்டியலில் சேர்க்கப்பட்டது!" : "❤️ Added to Favourites!", "success");
      } else {
        favorites.splice(index, 1);
        isNowFav = false;
        showToast(isTa ? "🤍 விருப்பப்பட்டியலில் இருந்து நீக்கப்பட்டது!" : "🤍 Removed from Favourites!", "info");
      }
      saveData('ek_customer_favorites', favorites);

      const heartBtns = document.querySelectorAll(`.fav-heart-btn[data-id="${pidStr}"]`);
      heartBtns.forEach(heartBtn => {
        heartBtn.innerHTML = isNowFav ? '❤️' : '🤍';
        heartBtn.setAttribute('title', isNowFav 
          ? (isTa ? 'விருப்பப்பட்டியலில் இருந்து நீக்கு' : 'Remove from favorites')
          : (isTa ? 'விருப்பப்பட்டியலில் சேர்' : 'Add to favorites'));
      });

      _lastCategoryPillsHash = '';
      if (typeof renderCategoryPills === 'function') renderCategoryPills();

      if (typeof activeCategory !== 'undefined' && String(activeCategory).toLowerCase().trim() === 'favorites') {
        if (typeof renderHomeScreenProducts === 'function') renderHomeScreenProducts(true);
      }
    }
    window.toggleFavoriteProduct = toggleFavoriteProduct;

    function isProductFavorite(productId) {
      if (!productId) return false;
      const pidStr = String(productId).trim();
      const rawFavs = getData('ek_customer_favorites', []);
      const favorites = (Array.isArray(rawFavs) ? rawFavs : []).map(id => String(id).trim());
      return favorites.includes(pidStr);
    }
    window.isProductFavorite = isProductFavorite;

    function isProductInCategory(p, targetCatId, catList) {
      if (!p || !targetCatId) return false;
      const targetIdLower = String(targetCatId).toLowerCase().trim();
      if (targetIdLower === 'all') return true;
      if (targetIdLower === 'favorites') return typeof isProductFavorite === 'function' ? isProductFavorite(p.id) : false;

      const prodCatRaw = String(p.category || '').toLowerCase().trim();
      if (!prodCatRaw) return false;

      // 1. Direct exact or normalized match
      if (prodCatRaw === targetIdLower) return true;

      // 2. Look up target category from catList / DEFAULT_CATEGORIES
      const allCats = (Array.isArray(catList) && catList.length > 0)
        ? catList
        : (typeof getCategoriesList === 'function' ? getCategoriesList() : (window.DEFAULT_CATEGORIES || []));
      
      const targetCatObj = allCats.find(c => c && String(c.id).toLowerCase().trim() === targetIdLower);
      if (targetCatObj) {
        const enName = String(targetCatObj.nameEn || targetCatObj.en || '').toLowerCase().trim();
        const taName = String(targetCatObj.nameTa || targetCatObj.ta || '').toLowerCase().trim();
        if (enName && (prodCatRaw === enName || prodCatRaw.includes(enName))) return true;
        if (taName && (prodCatRaw === taName || prodCatRaw.includes(taName))) return true;
      }

      // Also check if prodCatRaw is a category ID whose name matches targetIdLower
      const prodCatObj = allCats.find(c => c && String(c.id).toLowerCase().trim() === prodCatRaw);
      if (prodCatObj) {
        const prodEn = String(prodCatObj.nameEn || prodCatObj.en || '').toLowerCase().trim();
        const prodTa = String(prodCatObj.nameTa || prodCatObj.ta || '').toLowerCase().trim();
        if (prodEn === targetIdLower || prodTa === targetIdLower) return true;
      }

      // 3. Category Aliases mapping for common variations
      const categoryAliases = {
        'veg': ['veg', 'vegetable', 'vegetables', 'காய்கறி', 'காய்கறிகள்', 'greens', 'keerai', 'spinach'],
        'meat': ['meat', 'chicken', 'mutton', 'beef', 'pork', 'poultry', 'கறி', 'கறிவகை', 'சிக்கன்', 'மட்டன்', 'ஆடு', 'கோழி'],
        'fish': ['fish', 'seafood', 'prawn', 'crab', 'மீன்', 'மீன்வகை', 'கடல் உணவு', 'nethili', 'vanjaram'],
        'fruits': ['fruits', 'fruit', 'பழங்கள்', 'பழம்'],
        'dairy': ['dairy', 'milk', 'egg', 'eggs', 'பால்', 'முட்டை', 'பால் & முட்டை', 'dairy & eggs'],
        'bakery': ['bakery', 'bread', 'cake', 'பேக்கரி', 'bakes', 'bun', 'cookies', 'pastry'],
        'groceries': ['groceries', 'grocery', 'provision', 'provisions', 'மளிகை', 'oil', 'rice', 'dal', 'spices', 'masala']
      };

      for (const [key, aliasArr] of Object.entries(categoryAliases)) {
        const isTargetMatch = (targetIdLower === key) || aliasArr.includes(targetIdLower);
        if (isTargetMatch) {
          if (prodCatRaw === key || aliasArr.includes(prodCatRaw)) {
            return true;
          }
        }
      }

      return false;
    }
    window.isProductInCategory = isProductInCategory;

    let _lastCategoryPillsHash = '';
    function renderCategoryPills() {
      const pillsContainer = document.querySelector('#screen-home .filter-pills') || document.querySelector('.filter-pills');
      debugLog(`[DEBUG renderCategoryPills] pillsContainer found: ${!!pillsContainer}`);
      if (!pillsContainer) {
        return;
      }

      try {
        const isTa = currentLang === 'ta';
        const catList = getCategoriesList() || [];
        const visibleCategories = catList.filter(c => c && !c.isHidden && (c.isScheduled ? c.isAvailable === true : true));
        debugLog(`[DEBUG renderCategoryPills] catList.length: ${catList.length}, visibleCategories.length: ${visibleCategories.length}`);

        const isCloudSynced = window._hasFreshCloudData || getData('ek_cloud_synced') === true;
        let allProducts = typeof getDataCached === 'function' ? getDataCached('ek_products', []) : getData('ek_products', []);
        const deletedProdIds = typeof getDeletedProductIds === 'function' ? getDeletedProductIds() : [];
        if (Array.isArray(allProducts) && deletedProdIds.length > 0) {
          allProducts = allProducts.filter(p => p && p.id && !deletedProdIds.includes(p.id));
        }

        const visibleProducts = (allProducts || []).filter(p => p && !p.isHidden);
        const totalCount = visibleProducts.length;
        const favCount = visibleProducts.filter(p => p && isProductFavorite(p.id)).length;

        const CATEGORIES = [
          { id: 'all', name: isTa ? 'அனைத்தும்' : 'All Items', icon: '🍽️' }
        ];

        if (favCount > 0) {
          CATEGORIES.push({ id: 'favorites', name: isTa ? 'என் விருப்பங்கள்' : 'Favourites', icon: '❤️' });
        }

        let catsToRender = visibleCategories;
        const defaultCats = (typeof DEFAULT_CATEGORIES !== 'undefined' && Array.isArray(DEFAULT_CATEGORIES)) ? DEFAULT_CATEGORIES : [];
        if (!catsToRender || catsToRender.length === 0) {
          catsToRender = defaultCats;
        } else if (defaultCats.length > 0) {
          // Merge default categories if any are missing from custom list
          defaultCats.forEach(dc => {
            if (dc && dc.id && !catsToRender.some(c => c && String(c.id).toLowerCase().trim() === String(dc.id).toLowerCase().trim())) {
              catsToRender.push({ ...dc, isAvailable: true });
            }
          });
        }

        const counts = {};
        catsToRender.forEach(c => {
          if (!c) return;
          const cid = String(c.id || '');
          if (!cid) return;
          const cidLower = cid.toLowerCase().trim();
          counts[cidLower] = visibleProducts.filter(p => isProductInCategory(p, cid, catList)).length;
        });

        catsToRender.forEach(c => {
          if (!c) return;
          const cid = String(c.id || '');
          if (!cid) return;
          const nameEn = String(c.nameEn || c.en || cid || 'Category');
          const nameTa = String(c.nameTa || c.ta || nameEn);
          const icon = String(c.icon || '📦');
          CATEGORIES.push({
            id: cid,
            name: isTa ? nameTa : nameEn,
            icon: icon
          });
        });

        const isCurrentActiveValid = String(activeCategory).toLowerCase().trim() === 'all' ||
          String(activeCategory).toLowerCase().trim() === 'favorites' ||
          CATEGORIES.some(cat => String(cat.id).toLowerCase().trim() === String(activeCategory).toLowerCase().trim()) ||
          defaultCats.some(cat => String(cat.id).toLowerCase().trim() === String(activeCategory).toLowerCase().trim());

        if (!isCurrentActiveValid) {
          activeCategory = 'all';
        }
        if (typeof window !== 'undefined') {
          window.activeCategory = activeCategory;
        }

        window._currentHomeCategories = CATEGORIES;

        const pillsHash = isTa + '::' + activeCategory + '::' + CATEGORIES.map(c => {
          const cidStr = String(c.id).toLowerCase().trim();
          const cCount = cidStr === 'all' ? totalCount : (cidStr === 'favorites' ? favCount : (counts[cidStr] || 0));
          return `${c.id}:${c.name}:${cCount}`;
        }).join('|');

        const currentCachedHash = (typeof window._lastCategoryPillsHash !== 'undefined' && window._lastCategoryPillsHash !== '') ? window._lastCategoryPillsHash : _lastCategoryPillsHash;
        if (pillsHash === currentCachedHash && pillsContainer.querySelectorAll('.pill').length > 0) {
          return; // Skip recreation if pills criteria are identical and already rendered
        }
        _lastCategoryPillsHash = pillsHash;
        window._lastCategoryPillsHash = pillsHash;

        pillsContainer.innerHTML = CATEGORIES.map(cat => {
          const catIdStr = String(cat.id);
          const cidLower = catIdStr.toLowerCase().trim();
          const isActive = String(activeCategory).toLowerCase().trim() === cidLower ? 'active' : '';
          let count = 0;
          if (cidLower === 'all') {
            count = totalCount;
          } else if (cidLower === 'favorites') {
            count = favCount;
          } else {
            count = counts[cidLower] || 0;
          }
          const countBadge = `<span class="pill-count">${count}</span>`;
          const accent = getCategoryConfig(catIdStr).color;

          const styleAttr = isActive
            ? `style="background: ${accent}; border-color: ${accent}; color: #ffffff;"`
            : `style="background: var(--bg-card); border-color: var(--border-color); color: var(--text-primary);"`;

          return `
            <button class="pill ${isActive}" ${styleAttr} onclick="filterHomeProducts('${catIdStr}', this)">
              <span style="font-size: 12px; flex-shrink: 0;">${cat.icon}</span>
              <span class="pill-text">${cat.name}</span>
              ${countBadge}
            </button>
          `;
        }).join('') + `
          <button class="pill filter-row-icon-btn" onclick="document.getElementById('home-product-search').focus();" style="min-width: 28px; width: 28px; padding: 0 !important; justify-content: center; align-items: center; background: var(--bg-card) !important; border: 1px solid var(--border-color) !important; color: var(--text-primary) !important; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.02); flex-shrink: 0; margin-left: 4px;">
            <span style="font-size: 12px;">🔍</span>
          </button>
        `;
      } catch (err) {
        console.error("renderCategoryPills exception caught safely:", err);
      }
    }