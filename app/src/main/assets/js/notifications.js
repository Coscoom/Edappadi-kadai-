
    var escapeHtml = window.escapeHtml || function(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = String(text);
      return div.innerHTML;
    };

    async function deleteExecutive(id) {
      const orders = getData('ek_orders', []) || [];
      const activeAssignedOrder = orders.find(o => {
        const exec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(o) : null;
        const isAssigned = (exec && exec.id === id);
        return isAssigned && !['delivered', 'cancelled', 'completed', 'archived'].includes(String(o.status).toLowerCase().trim());
      });
      if (activeAssignedOrder) {
        showToast(
          currentLang === 'ta'
            ? "இந்த பார்ட்னருக்கு செயலில் உள்ள ஆர்டர்கள் ஒதுக்கப்பட்டுள்ளதால் இவரை நீக்க முடியாது!"
            : "Cannot delete partner: Active assigned orders exist for this partner!",
          "error"
        );
        return;
      }

      showCustomConfirm(
        "Remove Delivery partner completely?",
        "Are you sure you want to permanently delete this delivery executive partner, their Firebase Auth account, and their Firestore profile? This action is irreversible.",
        async function() {
          showToast("Deleting delivery partner... Please wait.", "info");

          let cloudSuccess = false;
          if (typeof firebase !== 'undefined' && firebase.functions) {
            try {
              const deleteFn = getCloudFunction('deleteDeliveryPartner');
              const res = await deleteFn({ targetUid: id });
              if (res && res.data && res.data.success) {
                cloudSuccess = true;
                debugLog("[deleteExecutive] Cloud Function deleted partner successfully.");
              }
            } catch (err) {
              console.warn("[deleteExecutive] Cloud Auth deletion failed. Proceeding with database and cache cleanups.", err);
            }
          }

          if (typeof db !== 'undefined' && db) {
            try {
              await db.collection('users').doc(id).delete();
              await db.collection('ek_delivery_persons').doc(id).delete().catch(() => {});
              try { publishPublicStaffDirectory(); } catch(pErr) {}
            } catch (err) {
              console.error("[deleteExecutive] Firestore deletion error:", err);
            }
          }

          const list = getData('ek_delivery_persons', []) || [];
          const riderToDelete = list.find(e => e.id === id || e.uid === id);
          if (riderToDelete && riderToDelete.photoUrl) {
            const photoUrl = riderToDelete.photoUrl;
            if (photoUrl && photoUrl.includes("firebasestorage.googleapis.com")) {
              try {
                await deleteStorageImageByUrl(photoUrl);
                debugLog("[deleteExecutive] Successfully cleaned up profile photo from Storage.");
              } catch (photoDelErr) {
                console.warn("[deleteExecutive] Profile photo deletion from Storage failed or skipped:", photoDelErr);
              }
            }
          }

          const updated = list.filter(e => e.id !== id);
          saveData('ek_delivery_persons', updated);
          markRiderAsDeleted(id);

          const dSession = getData('ek_delivery_session');
          if (dSession && dSession.id === id) {
            removeData('ek_delivery_session');
            if (typeof firebase !== 'undefined' && firebase.auth) {
              try { await firebase.auth().signOut(); } catch(e) {}
            }
          }

          resetDeliveryForm();
          renderDeliveryExecutives();
          try { populateDeliveryLoginFormSelector(); } catch(e) {}

          showToast("Partner removed", "error");
          showAdminSuccessModal(
            currentLang === 'ta' ? "🗑️ வெற்றிகரமாக நீக்கப்பட்டது!" : "🗑️ Removed Permanently!",
            `The delivery executive and their Firebase Auth account have been successfully removed from records. Phone and Email are now fully reusable.`
          );
        }
      );
    }

    function renderDeliveryExecutives() {
      const list = getData('ek_delivery_persons', []);
      const container = document.getElementById('admin-delivery-list');
      if (!container) return;
      container.innerHTML = '';

      if (list.length === 0) {
        container.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center;">No delivery executives registered currently.</p>`;
        return;
      }

      let execsHtml = '';
      list.forEach(e => {
        const sType = String(e.salaryType || e.payoutType || 'per_order').toLowerCase();
        const sRate = e.salaryRate !== undefined ? e.salaryRate : (e.payoutAmount !== undefined ? e.payoutAmount : 35);
        const sText = sType === 'per_order' ? `₹${sRate} / order` : (sType === 'fixed' ? `₹${sRate} / month` : (sType === 'commission' ? `${sRate}% / order` : (sType === 'per_km' ? `₹${sRate} / km` : `₹${sRate} / order`)));

        const ratingHtml = e.averageRating
          ? `<div style="font-size:11px; margin-top:4px; display:flex; align-items:center; gap:4px; color:#f59e0b;">
               <span>⭐ rating:</span>
               <strong>★ ${e.averageRating} (${e.totalRatings || 0} reviews)</strong>
             </div>`
          : `<div style="font-size:11px; margin-top:4px; display:flex; align-items:center; gap:4px; color:var(--text-muted);">
               <span>⭐ Rating:</span>
               <span>No reviews submitted yet</span>
             </div>`;

        const card = `
          <div class="card" style="display:flex; flex-direction:column; padding:12px; margin-bottom:10px; gap:8px; border-color: rgba(255,255,255,0.06); background: rgba(255,255,255,0.01);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <strong style="color:#fff; font-size:14px; display:block;">${e.name}</strong>
                <span style="font-size:11.5px; color:var(--text-secondary);">📞 ${e.phone}</span>
                <div style="font-size:11px; margin-top:4px; display:flex; align-items:center; gap:4px; color:var(--accent-orange);">
                  <span>💰 Salary Setup:</span>
                  <strong style="background:rgba(245,158,11,0.08); padding:1px 6px; border-radius:4px; border:1px solid rgba(245,158,11,0.15);">${sText}</strong>
                </div>
                ${ratingHtml}
              </div>
              <span class="badge" style="background:${e.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; color:${e.isActive ? 'var(--accent-green)' : 'var(--accent-red)'}">
                ${e.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:6px; border-top:1px dashed rgba(255,255,255,0.04); padding-top:8px; margin-top:4px;">
              <button class="btn btn-secondary" style="width:auto; padding:4px 10px; font-size:11px; display:flex; align-items:center; gap:2.5px; border-radius:6px;" onclick="editExecutiveForm('${e.id}')">✏️ Edit</button>
              <button class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:11px; display:flex; align-items:center; gap:2px; border-radius:6px;" onclick="toggleExecutiveStatus('${e.id}')">🔄 Status</button>
              <button class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:11px; border-color:rgba(239,68,68,0.4); background:rgba(239,68,68,0.05); color:#ef4444; border-radius:6px;" onclick="deleteExecutive('${e.id}')">❌</button>
            </div>
          </div>
        `;
        execsHtml += card;
      });
      container.innerHTML = execsHtml;
    }

    async function broadcastToAll() {
      const msg = document.getElementById('admin-broadcast-text').value.trim();
      if (!msg) {
        showToast('அறிவிப்பு உரையை உள்ளீடு செய்யவும்!', 'error');
        return;
      }

      if (typeof db === 'undefined' || !db) {
        showToast('Internet இணைப்பு இல்லை — broadcast அனுப்ப முடியவில்லை.', 'error');
        return;
      }

      const btn = document.getElementById('admin-broadcast-btn');
      if (btn) { btn.disabled = true; btn.innerText = 'அனுப்பப்படுகிறது... ⏳'; }

      try {
        const settings = getData('ek_settings', DEFAULT_SETTINGS);
        settings.announcement = msg;
        saveData('ek_settings', settings);

        await Promise.all([
          db.collection('ek_settings').doc('store_settings').set(settings, { merge: true }).catch(() => {}),
          db.collection('ek_settings').doc('global_config').set({ announcement: msg }, { merge: true }).catch(() => {})
        ]);

        await db.collection('ek_broadcast_requests').add({
          titleEn: '📢 Edappadi Kadai',
          titleTa: '📢 எடப்பாடி கடை',
          bodyEn: msg,
          bodyTa: msg,
          lang: currentLang,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
          status: 'completed'
        }).catch(e => console.warn('[Broadcast Save] Error:', e));

        let usersSnap = null;
        try {
          if (getAdminSession()) {
            usersSnap = await db.collection('ek_users').get();
          }
        } catch (e) {
          console.warn("[Broadcast] Could not query ek_users from firestore, using local cache instead:", e);
        }

        let enqueuedCount = 0;
        const promises = [];

        // Write to ek_topic_broadcast_requests to reach ALL installed customer devices (including non-logged-in / guest installs)
        promises.push(
          db.collection('ek_topic_broadcast_requests').add({
            topic: "all_customers",
            title: currentLang === 'ta' ? '📢 எடப்பாடி கடை' : '📢 Edappadi Kadai',
            titleTa: '📢 எடப்பாடி கடை',
            titleEn: '📢 Edappadi Kadai',
            body: msg,
            bodyTa: msg,
            bodyEn: msg,
            createdAt: new Date().toISOString(),
            processed: false
          }).catch(e => console.warn('[Topic Broadcast Request] Error:', e))
        );

        if (usersSnap) {
          usersSnap.forEach(doc => {
            const u = doc.data();
            const targetToken = u.fcmToken || u.realFcmToken;
            if (targetToken) {
              enqueuedCount++;
              promises.push(
                db.collection('ek_fcm_queue').add({
                  targetToken: targetToken,
                  title: currentLang === 'ta' ? '📢 எடப்பாடி கடை' : '📢 Edappadi Kadai',
                  body: msg,
                  createdAt: new Date().toISOString(),
                  processed: false,
                  type: "broadcast"
                }).catch(e => console.warn('[Broadcast Client Queue] Error:', e))
              );

              if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
                try {
                  AndroidStorage.simulateFcmPushNotification(
                    targetToken,
                    currentLang === 'ta' ? '📢 எடப்பாடி கடை' : '📢 Edappadi Kadai',
                    msg,
                    JSON.stringify({ type: "broadcast" })
                  );
                } catch (simErr) {
                  console.warn("[FCM Simulator] Fail:", simErr);
                }
              }
            }
          });
        } else {
          const localUsers = getData('ek_users', []);
          localUsers.forEach(u => {
            const targetToken = u.fcmToken || u.realFcmToken;
            if (targetToken) {
              enqueuedCount++;
              promises.push(
                db.collection('ek_fcm_queue').add({
                  targetToken: targetToken,
                  title: currentLang === 'ta' ? '📢 எடப்பாடி கடை' : '📢 Edappadi Kadai',
                  body: msg,
                  createdAt: new Date().toISOString(),
                  processed: false,
                  type: "broadcast"
                }).catch(e => console.warn('[Broadcast Client Queue] Error:', e))
              );

              if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
                try {
                  AndroidStorage.simulateFcmPushNotification(
                    targetToken,
                    currentLang === 'ta' ? '📢 எடப்பாடி கடை' : '📢 Edappadi Kadai',
                    msg,
                    JSON.stringify({ type: "broadcast" })
                  );
                } catch (simErr) {
                  console.warn("[FCM Simulator] Fail:", simErr);
                }
              }
            }
          });
        }

        if (promises.length > 0) {
          await Promise.all(promises);
        }

        debugLog(`[Broadcast Sent] Enqueued push notification to ${enqueuedCount} active users.`);

        showToast('அறிவிப்பு அனைத்து வாடிக்கையாளர்களுக்கும் அனுப்பப்பட்டது! 📢', 'success');
        showAdminSuccessModal(
          currentLang === 'ta' ? "📢 அறிவிப்பு அனுப்பப்பட்டது!" : "📢 Broadcast Sent!",
          currentLang === 'ta' ? `அறிவிப்பு அனைத்து வாடிக்கையாளர்களுக்கும் வெற்றிகரமாக அனுப்பப்பட்டது (மொத்தம்: ${enqueuedCount} பயனர்கள்).` : `The broadcast announcement has been successfully sent to all customers (Total: ${enqueuedCount} users).`
        );
        const textInput = document.getElementById('admin-broadcast-text');
        if (textInput) textInput.value = '';
      } catch (err) {
        console.error('Broadcast failed:', err);
        showToast('Broadcast அனுப்புவதில் பிழை. மீண்டும் முயற்சிக்கவும்.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.innerText = 'அனைவருக்கும் அனுப்பு 📢'; }
      }
    }

    // ==========================================
    // DEDICATED PUSH NOTIFICATIONS MODULE ENGINE
    // ==========================================

    let currentPushFilter = 'all';

    function getPushNotificationsList() {
      const items = getData('ek_push_notifications', []);
      if (!Array.isArray(items)) return [];
      return items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 20);
    }

    function savePushNotificationsList(list) {
      if (!Array.isArray(list)) list = [];
      const trimmed = list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 20);
      saveData('ek_push_notifications', trimmed);

      if (typeof db !== 'undefined' && db && getAdminSession()) {
        trimmed.forEach(item => {
          if (item && item.id) {
            db.collection('ek_push_notifications').doc(item.id).set(cleanFirestoreData(item), { merge: true })
              .catch(e => console.warn('[Cloud Sync] Push notification save error:', e));
          }
        });
      }
    }

    async function syncPushNotificationsFromCloud() {
      if (typeof db === 'undefined' || !db) return;
      try {
        const snap = await db.collection('ek_push_notifications').orderBy('createdAt', 'desc').limit(20).get();
        if (!snap || snap.empty) return;
        const cloudItems = [];
        snap.forEach(doc => {
          const data = doc.data();
          if (data && data.id) cloudItems.push(data);
        });

        if (cloudItems.length > 0) {
          const localItems = getData('ek_push_notifications', []);
          const map = new Map();
          localItems.forEach(i => { if (i && i.id) map.set(i.id, i); });
          cloudItems.forEach(c => {
            const existing = map.get(c.id);
            if (!existing || new Date(c.updatedAt || c.createdAt) >= new Date(existing.updatedAt || existing.createdAt)) {
              map.set(c.id, c);
            }
          });
          const merged = Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 20);
          saveData('ek_push_notifications', merged);
        }
      } catch (e) {
        console.warn('[Cloud Sync] Push notifications fetch warning:', e);
      }
    }

    function togglePushScheduleDatetime(isScheduled) {
      const datetimeBox = document.getElementById('push-schedule-datetime-box');
      const sendBtn = document.getElementById('push-submit-send-btn');
      const scheduleBtn = document.getElementById('push-submit-schedule-btn');

      if (datetimeBox) datetimeBox.style.display = isScheduled ? 'block' : 'none';
      if (sendBtn) sendBtn.style.display = isScheduled ? 'none' : 'block';
      if (scheduleBtn) scheduleBtn.style.display = isScheduled ? 'block' : 'none';

      if (isScheduled) {
        const dtInput = document.getElementById('push-form-schedule-datetime');
        if (dtInput && !dtInput.value) {
          const now = new Date();
          now.setHours(now.getHours() + 1);
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          dtInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
      }
    }

    function togglePushTargetAudienceOptions(audienceVal) {
      const selectedBox = document.getElementById('push-selected-customer-box');
      if (selectedBox) {
        selectedBox.style.display = (audienceVal === 'selected') ? 'block' : 'none';
      }
      if (audienceVal === 'selected') {
        populatePushCustomerSelector();
      }
    }

    function populatePushCustomerSelector() {
      const selectEl = document.getElementById('push-form-selected-customer');
      if (!selectEl) return;
      const users = getData('ek_users', []);
      let optionsHtml = '<option value="">-- Choose Customer --</option>';
      users.forEach(u => {
        if (!u) return;
        const uName = u.name || 'Anonymous';
        const uPhone = u.phone || 'N/A';
        const hasToken = u.fcmToken || u.realFcmToken ? ' 📱' : '';
        optionsHtml += `<option value="${escapeHtml(u.id || u.phone)}">👤 ${escapeHtml(uName)} (+91 ${escapeHtml(uPhone)})${hasToken}</option>`;
      });
      selectEl.innerHTML = optionsHtml;
    }

    function resetPushForm() {
      const idInput = document.getElementById('push-editing-id');
      const titleInput = document.getElementById('push-form-title');
      const bodyInput = document.getElementById('push-form-body');
      const toggle = document.getElementById('push-form-schedule-toggle');
      const header = document.getElementById('push-form-header');
      const resetBtn = document.getElementById('push-form-reset-btn');
      const audienceSelect = document.getElementById('push-form-audience');

      if (idInput) idInput.value = '';
      if (titleInput) titleInput.value = '';
      if (bodyInput) bodyInput.value = '';
      if (audienceSelect) {
        audienceSelect.value = 'all';
        togglePushTargetAudienceOptions('all');
      }
      if (toggle) {
        toggle.checked = false;
        togglePushScheduleDatetime(false);
      }
      if (header) header.innerHTML = '<span>✨ Compose Push Notification</span>';
      if (resetBtn) resetBtn.style.display = 'none';
    }

    async function dispatchPushNotification(item) {
      if (!item || !item.title || !item.body) return 0;

      let enqueuedCount = 0;
      const promises = [];

      // 1. Topic Notification
      if (item.targetAudience === 'topic') {
        const topicName = item.topicName || 'all_customers';
        if (typeof db !== 'undefined' && db) {
          promises.push(
            db.collection('ek_topic_broadcast_requests').add({
              topic: topicName,
              title: item.title,
              body: item.body,
              createdAt: new Date().toISOString(),
              notificationId: item.id || ''
            }).catch(e => console.warn('[Topic Broadcast Queue Error]:', e))
          );
        }
        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
          try {
            AndroidStorage.simulateFcmPushNotification(
              `/topics/${topicName}`,
              item.title,
              item.body,
              JSON.stringify({ type: "topic_broadcast", topic: topicName, notificationId: item.id })
            );
          } catch (simErr) {
            console.warn("[FCM Simulator Topic Fail]:", simErr);
          }
        }
        enqueuedCount = 1;
      } else if (item.targetAudience === 'selected' && item.targetUserId) {
        // 2. Selected Customer
        let targetToken = typeof getCustomerFcmToken === 'function' ? await getCustomerFcmToken(item.targetUserId) : null;
        if (!targetToken) {
          let usersList = getData('ek_users', []);
          const targetUser = usersList.find(u => u && (u.id === item.targetUserId || u.phone === item.targetUserId));
          targetToken = targetUser ? (targetUser.fcmToken || targetUser.realFcmToken) : item.targetUserId;
        }
        if (targetToken && typeof targetToken === 'string' && targetToken.trim()) {
          enqueuedCount = 1;
          if (typeof db !== 'undefined' && db) {
            promises.push(
              db.collection('ek_fcm_queue').add({
                targetToken: targetToken,
                title: item.title,
                body: item.body,
                createdAt: new Date().toISOString(),
                processed: false,
                type: "push_module",
                notificationId: item.id || ''
              }).catch(e => console.warn('[Push Queue Error]:', e))
            );
          }

          if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
            try {
              AndroidStorage.simulateFcmPushNotification(
                targetToken,
                item.title,
                item.body,
                JSON.stringify({ type: "push_module", notificationId: item.id })
              );
            } catch (simErr) {
              console.warn("[FCM Simulator Push Fail]:", simErr);
            }
          }
        }
      } else {
        // 3. All Customers (Broadcast to topic + individual queues)
        const topicName = 'all_customers';
        if (typeof db !== 'undefined' && db) {
          promises.push(
            db.collection('ek_topic_broadcast_requests').add({
              topic: topicName,
              title: item.title,
              titleTa: item.title,
              titleEn: item.title,
              body: item.body,
              bodyTa: item.body,
              bodyEn: item.body,
              createdAt: new Date().toISOString(),
              notificationId: item.id || ''
            }).catch(e => console.warn('[Topic Broadcast Queue Error]:', e))
          );
        }
        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
          try {
            AndroidStorage.simulateFcmPushNotification(
              `/topics/${topicName}`,
              item.title,
              item.body,
              JSON.stringify({ type: "topic_broadcast", topic: topicName, notificationId: item.id })
            );
          } catch (simErr) {
            console.warn("[FCM Simulator Topic Fail]:", simErr);
          }
        }
        enqueuedCount = 1;

        let usersList = getData('ek_users', []);
        try {
          if (typeof db !== 'undefined' && db && getAdminSession()) {
            const usersSnap = await db.collection('ek_users').get();
            if (usersSnap && !usersSnap.empty) {
              const fetched = [];
              usersSnap.forEach(doc => {
                if (doc.data()) fetched.push(doc.data());
              });
              if (fetched.length > 0) usersList = fetched;
            }
          }
        } catch (e) {
          console.warn('[Push Dispatch] Firestore user query fallback to local cache:', e);
        }

        usersList.forEach(u => {
          const targetToken = u.fcmToken || u.realFcmToken;
          if (targetToken && typeof targetToken === 'string' && targetToken.trim()) {
            enqueuedCount++;
            if (typeof db !== 'undefined' && db) {
              promises.push(
                db.collection('ek_fcm_queue').add({
                  targetToken: targetToken,
                  title: item.title,
                  body: item.body,
                  createdAt: new Date().toISOString(),
                  processed: false,
                  type: "push_module",
                  notificationId: item.id || ''
                }).catch(e => console.warn('[Push Queue Error]:', e))
              );
            }

            if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
              try {
                AndroidStorage.simulateFcmPushNotification(
                  targetToken,
                  item.title,
                  item.body,
                  JSON.stringify({ type: "push_module", notificationId: item.id })
                );
              } catch (simErr) {
                console.warn("[FCM Simulator Push Fail]:", simErr);
              }
            }
          }
        });
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      // Sync sent notification record to Firestore
      if (typeof db !== 'undefined' && db && item.id) {
        try {
          await db.collection('ek_push_notifications').doc(item.id).set(cleanFirestoreData({
            ...item,
            status: 'Sent',
            sentAt: new Date().toISOString(),
            reachedCount: enqueuedCount
          }), { merge: true });
        } catch(e) {
          console.warn("[Push Record Sync Error]:", e);
        }
      }

      return enqueuedCount;
    }

    async function submitPushNotificationAction(actionType) {
      const editingId = (document.getElementById('push-editing-id')?.value || '').trim();
      const title = (document.getElementById('push-form-title')?.value || '').trim();
      const body = (document.getElementById('push-form-body')?.value || '').trim();
      const audienceVal = (document.getElementById('push-form-audience')?.value || 'all');
      const selectedCustomerVal = (document.getElementById('push-form-selected-customer')?.value || '');
      const isScheduledToggle = document.getElementById('push-form-schedule-toggle')?.checked;
      const scheduleDatetimeStr = (document.getElementById('push-form-schedule-datetime')?.value || '').trim();

      if (!title) {
        showToast('தயவுசெய்து அறிவிப்பு தலைப்பை உள்ளிடவும்!', 'error');
        return;
      }
      if (!body) {
        showToast('தயவுசெய்து அறிவிப்பு செய்தியை உள்ளிடவும்!', 'error');
        return;
      }
      if (audienceVal === 'selected' && !selectedCustomerVal) {
        showToast('தயவுசெய்து குறிப்பிட்ட வாடிக்கையாளரை தேர்ந்தெடுக்கவும்!', 'error');
        return;
      }

      let scheduledAt = null;
      if (actionType === 'schedule' || (actionType === 'draft' && isScheduledToggle)) {
        if (!scheduleDatetimeStr) {
          showToast('தயவுசெய்து திட்டமிடும் தேதி மற்றும் நேரத்தை தேர்ந்தெடுக்கவும்!', 'error');
          return;
        }
        const selectedDate = new Date(scheduleDatetimeStr);
        if (isNaN(selectedDate.getTime())) {
          showToast('செல்லுபடியாகாத தேதி / நேரம்!', 'error');
          return;
        }
        scheduledAt = selectedDate.toISOString();
      }

      const list = getPushNotificationsList();
      let notifItem = editingId ? list.find(x => x.id === editingId) : null;
      const isNew = !notifItem;

      if (isNew) {
        notifItem = {
          id: 'pnotif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          createdAt: new Date().toISOString()
        };
      }

      notifItem.title = title;
      notifItem.body = body;
      notifItem.targetAudience = audienceVal;
      if (audienceVal === 'selected') {
        notifItem.targetUserId = selectedCustomerVal;
      } else {
        delete notifItem.targetUserId;
      }
      notifItem.updatedAt = new Date().toISOString();

      const btn = actionType === 'send' 
        ? document.getElementById('push-submit-send-btn') 
        : (actionType === 'schedule' ? document.getElementById('push-submit-schedule-btn') : null);

      if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, true);

      try {
        if (actionType === 'send') {
          notifItem.status = 'Sending';
          notifItem.scheduledAt = null;

          if (isNew) list.unshift(notifItem);
          savePushNotificationsList(list);

          const count = await dispatchPushNotification(notifItem);
          notifItem.status = 'Sent';
          notifItem.sentAt = new Date().toISOString();
          notifItem.reachedCount = count;

          savePushNotificationsList(list);
          resetPushForm();
          renderPushNotificationManager();

          showToast(`அறிவிப்பு அனுப்பப்பட்டது! (அடைந்தது: ${count} பயனர்கள்) 🚀`, 'success');
          showAdminSuccessModal(
            "📢 புஷ் அறிவிப்பு அனுப்பப்பட்டது!",
            `உங்கள் அறிவிப்பு "${title}" குறிப்பிட்ட இலக்கு பயனர்களுக்கு (${count} சாதனங்கள்) வெற்றிகரமாக அனுப்பப்பட்டது.`
          );
        } else if (actionType === 'schedule') {
          notifItem.status = 'Scheduled';
          notifItem.scheduledAt = scheduledAt;
          notifItem.sentAt = null;

          if (isNew) list.unshift(notifItem);
          savePushNotificationsList(list);

          if (typeof db !== 'undefined' && db && notifItem.id) {
            try {
              await db.collection('ek_push_notifications').doc(notifItem.id).set(cleanFirestoreData(notifItem), { merge: true });
            } catch(e) {}
          }

          resetPushForm();
          renderPushNotificationManager();

          const formattedTime = new Date(scheduledAt).toLocaleString();
          showToast(`அறிவிப்பு திட்டமிடப்பட்டது! (${formattedTime}) ⏰`, 'success');
        } else if (actionType === 'draft') {
          notifItem.status = 'Draft';
          notifItem.scheduledAt = isScheduledToggle ? scheduledAt : null;

          if (isNew) list.unshift(notifItem);
          savePushNotificationsList(list);

          if (typeof db !== 'undefined' && db && notifItem.id) {
            try {
              await db.collection('ek_push_notifications').doc(notifItem.id).set(cleanFirestoreData(notifItem), { merge: true });
            } catch(e) {}
          }

          resetPushForm();
          renderPushNotificationManager();

          showToast('அறிவிப்பு வரைவாக (Draft) சேமிக்கப்பட்டது! 💾', 'success');
        }
      } catch(err) {
        console.error("Push action error:", err);
        showToast(`பிழை: ${err.message || 'அனுப்ப முடியவில்லை'}`, 'error');
      } finally {
        if (btn && typeof setButtonLoading === 'function') setButtonLoading(btn, false);
      }
    }

    async function resendPushNotification(id) {
      const list = getPushNotificationsList();
      const item = list.find(x => x.id === id);
      if (!item) return;

      if (!confirm(`"${item.title}" அறிவிப்பை மீண்டும் அனைவருக்கும் அனுப்ப விரும்புகிறீர்களா?`)) {
        return;
      }

      const newSentItem = {
        id: 'pnotif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: item.title,
        body: item.body,
        status: 'Sending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      list.unshift(newSentItem);
      savePushNotificationsList(list);

      showToast('மறுபடியும் அனுப்பப்படுகிறது... ⏳', 'info');
      const count = await dispatchPushNotification(newSentItem);

      newSentItem.status = 'Sent';
      newSentItem.sentAt = new Date().toISOString();
      newSentItem.reachedCount = count;

      savePushNotificationsList(list);
      renderPushNotificationManager();

      showToast(`அறிவிப்பு மீண்டும் அனுப்பப்பட்டது! (${count} பயனர்கள்) ⚡`, 'success');
    }

    function editPushNotification(id) {
      const list = getPushNotificationsList();
      const item = list.find(x => x.id === id);
      if (!item) return;

      document.getElementById('push-editing-id').value = item.id;
      document.getElementById('push-form-title').value = item.title || '';
      document.getElementById('push-form-body').value = item.body || '';

      const toggle = document.getElementById('push-form-schedule-toggle');
      if (item.status === 'Scheduled' && item.scheduledAt) {
        toggle.checked = true;
        togglePushScheduleDatetime(true);
        const dt = new Date(item.scheduledAt);
        if (!isNaN(dt.getTime())) {
          const year = dt.getFullYear();
          const month = String(dt.getMonth() + 1).padStart(2, '0');
          const day = String(dt.getDate()).padStart(2, '0');
          const hours = String(dt.getHours()).padStart(2, '0');
          const minutes = String(dt.getMinutes()).padStart(2, '0');
          document.getElementById('push-form-schedule-datetime').value = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
      } else {
        toggle.checked = false;
        togglePushScheduleDatetime(false);
      }

      document.getElementById('push-form-header').innerHTML = '<span>📝 Edit Notification</span>';
      document.getElementById('push-form-reset-btn').style.display = 'inline-block';

      const container = document.getElementById('admin-push-notifications-container');
      if (container) container.scrollIntoView({ behavior: 'smooth' });
    }

    function duplicatePushNotification(id) {
      const list = getPushNotificationsList();
      const item = list.find(x => x.id === id);
      if (!item) return;

      resetPushForm();
      document.getElementById('push-form-title').value = item.title || '';
      document.getElementById('push-form-body').value = item.body || '';
      showToast('அறிவிப்பு விவரங்கள் படிவத்தில் நகலெடுக்கப்பட்டன! 📋', 'info');

      const container = document.getElementById('admin-push-notifications-container');
      if (container) container.scrollIntoView({ behavior: 'smooth' });
    }

    function reschedulePushNotification(id) {
      const list = getPushNotificationsList();
      const item = list.find(x => x.id === id);
      if (!item) return;

      const input = prompt(`"${item.title}" அறிவிப்பிற்கான புதிய தேதி & நேரத்தை உள்ளிடவும் (YYYY-MM-DD HH:MM format):`, item.scheduledAt ? item.scheduledAt.substring(0, 16).replace('T', ' ') : '');

      if (input && input.trim()) {
        const parsed = new Date(input.trim().replace(' ', 'T'));
        if (isNaN(parsed.getTime())) {
          showToast('செல்லுபடியாகாத தேதி வடிவம்! (எ.கா: 2026-07-28 15:30)', 'error');
          return;
        }
        item.scheduledAt = parsed.toISOString();
        item.status = 'Scheduled';
        item.updatedAt = new Date().toISOString();

        savePushNotificationsList(list);
        renderPushNotificationManager();
        showToast(`அறிவிப்பு நேரம் மாற்றப்பட்டது! (${parsed.toLocaleString()}) ⏰`, 'success');
      }
    }

    function deletePushNotification(id) {
      const list = getPushNotificationsList();
      const item = list.find(x => x.id === id);
      if (!item) return;

      if (confirm(`"${item.title}" அறிவிப்பை நீக்க வேண்டுமா?`)) {
        const updated = list.filter(x => x.id !== id);
        savePushNotificationsList(updated);

        if (typeof db !== 'undefined' && db && getAdminSession()) {
          db.collection('ek_push_notifications').doc(id).delete().catch(e => console.warn(e));
        }

        renderPushNotificationManager();
        showToast('அறிவிப்பு நீக்கப்பட்டது. 🗑️', 'info');
      }
    }

    function filterPushHistory(filterType, btnEl) {
      currentPushFilter = filterType;
      document.querySelectorAll('.push-filter-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#9ca3af';
        b.classList.remove('active');
      });
      if (btnEl) {
        btnEl.style.background = '#3b82f6';
        btnEl.style.color = '#fff';
        btnEl.classList.add('active');
      }
      renderPushHistoryList();
    }

    function renderPushHistoryList() {
      const container = document.getElementById('push-notifications-history-list');
      if (!container) return;

      const list = getPushNotificationsList();
      let filtered = list;

      if (currentPushFilter === 'sent') filtered = list.filter(x => x.status === 'Sent');
      else if (currentPushFilter === 'scheduled') filtered = list.filter(x => x.status === 'Scheduled');
      else if (currentPushFilter === 'draft') filtered = list.filter(x => x.status === 'Draft');

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.08);">
            <p style="font-size: 12px; color: var(--text-muted); margin: 0;">தற்போது எந்த அறிவிப்பும் இல்லை. / No notifications found.</p>
          </div>
        `;
        return;
      }

      let html = '';
      filtered.forEach(item => {
        let badgeHtml = '';
        if (item.status === 'Sent') {
          const timeStr = item.sentAt ? new Date(item.sentAt).toLocaleString() : '';
          badgeHtml = `<span style="font-size: 10px; background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">🟢 Sent: ${timeStr}</span>`;
        } else if (item.status === 'Scheduled') {
          const timeStr = item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : '';
          badgeHtml = `<span style="font-size: 10px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700;">⏰ Scheduled: ${timeStr}</span>`;
        } else if (item.status === 'Sending') {
          badgeHtml = `<span style="font-size: 10px; background: rgba(59, 130, 246, 0.15); color: #3b82f6; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 700;">⏳ Sending...</span>`;
        } else {
          badgeHtml = `<span style="font-size: 10px; background: rgba(107, 114, 128, 0.15); color: #9ca3af; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(107, 114, 128, 0.3); font-weight: 700;">📝 Draft</span>`;
        }

        const createdStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';

        html += `
          <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 100%; box-sizing: border-box; overflow-wrap: break-word; word-break: break-word;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; width: 100%; box-sizing: border-box;">
              <h5 style="font-size: 13px; font-weight: 800; color: #f3f4f6; margin: 0; flex: 1; min-width: 140px; word-break: break-word; overflow-wrap: break-word; max-width: 100%;">${escapeHtml(item.title || '')}</h5>
              ${badgeHtml}
            </div>

            <p style="font-size: 12px; color: #cbd5e1; margin: 0; line-height: 1.4; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; max-width: 100%;">${escapeHtml(item.body || '')}</p>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 8px; margin-top: 2px; flex-wrap: wrap; gap: 6px;">
              <span style="font-size: 10px; color: var(--text-muted);">
                Created: ${createdStr} ${item.reachedCount !== undefined ? `| Reach: <strong>${item.reachedCount} users</strong>` : ''}
              </span>

              <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button class="btn" onclick="resendPushNotification('${item.id}')" style="font-size: 10px; padding: 3px 8px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; font-weight: 700;" title="One-Click Resend">
                  ⚡ Resend
                </button>
                <button class="btn" onclick="editPushNotification('${item.id}')" style="font-size: 10px; padding: 3px 8px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 6px; font-weight: 700;" title="Edit">
                  📝 Edit
                </button>
                ${item.status === 'Scheduled' ? `
                  <button class="btn" onclick="reschedulePushNotification('${item.id}')" style="font-size: 10px; padding: 3px 8px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; font-weight: 700;" title="Reschedule">
                    ⏰ Reschedule
                  </button>
                ` : ''}
                <button class="btn" onclick="duplicatePushNotification('${item.id}')" style="font-size: 10px; padding: 3px 8px; background: rgba(255,255,255,0.06); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; font-weight: 700;" title="Duplicate">
                  📋 Duplicate
                </button>
                <button class="btn" onclick="deletePushNotification('${item.id}')" style="font-size: 10px; padding: 3px 8px; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; font-weight: 700;" title="Delete">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    }

    async function renderPushNotificationManager() {
      await syncPushNotificationsFromCloud();

      const list = getPushNotificationsList();

      const totalSent = list.filter(x => x.status === 'Sent').length;
      const totalScheduled = list.filter(x => x.status === 'Scheduled').length;

      const sentItems = list.filter(x => x.status === 'Sent' && x.sentAt).sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt));
      const lastSentTimeStr = sentItems.length > 0 ? new Date(sentItems[0].sentAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'None';

      const usersList = getData('ek_users', []);
      const fcmUsersCount = usersList.filter(u => u && (u.fcmToken || u.realFcmToken)).length;

      const sentStatEl = document.getElementById('push-stat-sent');
      const schedStatEl = document.getElementById('push-stat-scheduled');
      const audienceStatEl = document.getElementById('push-stat-audience');
      const lastTimeStatEl = document.getElementById('push-stat-last-time');

      if (sentStatEl) sentStatEl.innerText = totalSent;
      if (schedStatEl) schedStatEl.innerText = totalScheduled;
      if (audienceStatEl) audienceStatEl.innerText = `${fcmUsersCount || usersList.length} Users`;
      if (lastTimeStatEl) lastTimeStatEl.innerText = lastSentTimeStr;

      renderPushHistoryList();
    }

    async function checkScheduledPushNotifications() {
      const list = getPushNotificationsList();
      const now = new Date();
      let hasChanges = false;

      for (const item of list) {
        if (item && item.status === 'Scheduled' && item.scheduledAt) {
          const scheduledDate = new Date(item.scheduledAt);
          if (!isNaN(scheduledDate.getTime()) && now >= scheduledDate) {
            item.status = 'Sending';
            item.updatedAt = new Date().toISOString();
            hasChanges = true;
            savePushNotificationsList(list);

            try {
              debugLog(`[Scheduled Push Executing] Dispatching notification ID: ${item.id}`);
              const count = await dispatchPushNotification(item);
              item.status = 'Sent';
              item.sentAt = new Date().toISOString();
              item.reachedCount = count;
              savePushNotificationsList(list);

              if (getAdminSession()) {
                showToast(`⏰ திட்டமிடப்பட்ட புஷ் அறிவிப்பு அனுப்பப்பட்டது! (${count} பயனர்கள்)`, 'success');
              }
            } catch (err) {
              console.error("[Scheduled Push Failed]:", err);
              item.status = 'Failed';
              savePushNotificationsList(list);
            }
          }
        }
      }

      if (hasChanges) {
        const adminCustomersTab = document.getElementById('admin-tab-customers');
        if (adminCustomersTab && adminCustomersTab.style.display !== 'none') {
          renderPushNotificationManager();
        }
      }
    }

    setInterval(() => {
      if (document.hidden || window._isAppBackgrounded) return;
      checkScheduledPushNotifications();
    }, 15000);


    async function sendCustomerShoutToAll() {
      const msgInput = document.getElementById('customer-shout-text');
      const msg = msgInput ? msgInput.value.trim() : '';
      const currentLang = localStorage.getItem('ek_lang') || 'en';

      if (!msg) {
        showToast(currentLang === 'ta' ? 'அறிவிப்பு செய்தியை உள்ளீடு செய்யவும்!' : 'Please enter a shoutout message!', 'error');
        return;
      }

      if (typeof db === 'undefined' || !db) {
        showToast(currentLang === 'ta' ? 'Internet இணைப்பு இல்லை — அறிவிப்பு அனுப்ப முடியவில்லை.' : 'No internet connection - cannot send shoutout.', 'error');
        return;
      }

      const activeUser = getActiveUser();
      const userName = activeUser ? (activeUser.name || activeUser.phone) : (currentLang === 'ta' ? "வாடிக்கையாளர்" : "Customer");

      const btn = document.getElementById('customer-shout-btn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>அனுப்பப்படுகிறது... ⏳</span>';
      }

      try {
        await db.collection('ek_customer_broadcasts').add({
          senderName: userName,
          senderPhone: activeUser ? activeUser.phone : '',
          message: msg,
          createdAt: new Date().toISOString(),
        });

        const localUsers = getData('ek_users', []);
        let enqueuedCount = 0;
        const promises = [];

        localUsers.forEach(u => {
          const targetToken = u.fcmToken || u.realFcmToken;
          if (targetToken) {
            enqueuedCount++;
            promises.push(
              db.collection('ek_fcm_queue').add({
                targetToken: targetToken,
                title: currentLang === 'ta' ? `📢 கஸ்டமர் குரல்: ${userName}` : `📢 Customer Voice: ${userName}`,
                body: msg,
                createdAt: new Date().toISOString(),
                processed: false,
                type: "customer_broadcast"
              }).catch(e => console.warn('[Customer Broadcast Queue] Error:', e))
            );

            if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.simulateFcmPushNotification === 'function') {
              try {
                AndroidStorage.simulateFcmPushNotification(
                  targetToken,
                  currentLang === 'ta' ? `📢 கஸ்டமர் குரல்: ${userName}` : `📢 Customer Voice: ${userName}`,
                  msg,
                  JSON.stringify({ type: "customer_broadcast", senderName: userName })
                );
              } catch (simErr) {
                console.warn("[FCM Simulator] Fail:", simErr);
              }
            }
          }
        });

        if (promises.length > 0) {
          await Promise.all(promises);
        }

        debugLog(`[Customer Broadcast Sent] Enqueued push notification to ${enqueuedCount} active users.`);

        showToast(currentLang === 'ta' ? 'வாடிக்கையாளர் அறிவிப்பு அனுப்பப்பட்டது! 📢' : 'Customer broadcast sent successfully! 📢', 'success');

        showCustomAlert(
          currentLang === 'ta' ? "📢 அறிவிப்பு அனுப்பப்பட்டது!" : "📢 Broadcast Sent!",
          currentLang === 'ta'
            ? `உங்கள் செய்தி அனைத்து வாடிக்கையாளர்களுக்கும் வெற்றிகரமாக புஷ் நோட்டிபிகேஷனாக அனுப்பப்பட்டது (மொத்தம்: ${enqueuedCount} பயனர்கள்).`
            : `Your message has been successfully broadcast to all customers as a push notification (Total: ${enqueuedCount} users).`
        );

        if (msgInput) msgInput.value = '';
        if (typeof playLyoChimeSound === 'function') playLyoChimeSound();
      } catch (err) {
        console.error('Customer Broadcast failed:', err);
        showToast(currentLang === 'ta' ? 'அறிவிப்பு அனுப்புவதில் பிழை. மீண்டும் முயற்சிக்கவும்.' : 'Error sending broadcast. Please try again.', 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>அனைவருக்கும் அறிவிப்பு அனுப்பு 📢</span>';
        }
      }
    }

    function adjustUserPoints(userId, diff) {
      const users = getData('ek_users') || [];
      const idx = users.findIndex(u => u.id === userId);
      if (idx === -1) return;

      const oldPoints = users[idx].loyaltyPoints || 0;
      users[idx].loyaltyPoints = Math.max(0, oldPoints + diff);
      users[idx].tier = computeLoyaltyTier(users[idx].loyaltyPoints);
      users[idx].updatedAt = new Date().toISOString();

      saveData('ek_users', users);
      if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_users');

      const targetUser = users[idx];
      const targetPhone = targetUser.phone || '';
      const newPoints = Math.round(targetUser.loyaltyPoints);
      const pointsDiff = Math.round(diff);

      const titleTa = pointsDiff > 0 ? "🎁 வாலட் புள்ளிகள் வரவு வைக்கப்பட்டது!" : "🔔 வாலட் புள்ளிகள் மாற்றப்பட்டது";
      const titleEn = pointsDiff > 0 ? "🎁 Wallet Points Credited!" : "🔔 Wallet Points Adjusted";
      const bodyTa = pointsDiff > 0
        ? `நிர்வாகியால் உங்கள் வாலட்டில் +${pointsDiff} புள்ளிகள் சேர்க்கப்பட்டுள்ளது! தற்போதைய இருப்பு: ${newPoints} pts.`
        : `நிர்வாகியால் உங்கள் வாலட்டில் ${pointsDiff} புள்ளிகள் சரிசெய்யப்பட்டுள்ளது. தற்போதைய இருப்பு: ${newPoints} pts.`;
      const bodyEn = pointsDiff > 0
        ? `Admin credited +${pointsDiff} points to your wallet! Current balance: ${newPoints} pts.`
        : `Admin adjusted ${pointsDiff} points in your wallet. Current balance: ${newPoints} pts.`;

      if (typeof db !== 'undefined' && db && db.collection) {
        db.collection('ek_users').doc(userId).set(users[idx], { merge: true })
          .then(() => debugLog(`[Points Sync] Instantly synced adjusted points to Cloud for user: ${userId}`))
          .catch(err => console.error("[Points Sync] Cloud points sync failed:", err));

        // Real-time notification dispatched directly to customer in Firestore
        db.collection('ek_customer_notifications').add({
          targetUserId: userId,
          targetPhone: targetPhone,
          titleTa: titleTa,
          titleEn: titleEn,
          bodyTa: bodyTa,
          bodyEn: bodyEn,
          type: "points_update",
          pointsDiff: pointsDiff,
          currentPoints: newPoints,
          createdAt: new Date().toISOString(),
          read: false
        }).catch(err => console.warn("[Customer Notif Queue] Points notification write failed:", err));
      }

      // If customer is active in current session (e.g. testing in same app)
      const currentActive = typeof getActiveUser === 'function' ? getActiveUser() : null;
      if (currentActive && (currentActive.id === userId || (targetPhone && currentActive.phone === targetPhone))) {
        currentActive.loyaltyPoints = users[idx].loyaltyPoints;
        currentActive.tier = users[idx].tier;
        saveData('ek_active_user', currentActive);
        const sess = getData('ek_customer_session');
        if (sess) {
          sess.loyaltyPoints = currentActive.loyaltyPoints;
          saveData('ek_customer_session', sess);
        }
        if (typeof window.addNotification === 'function') {
          window.addNotification(titleTa, titleEn, bodyTa, bodyEn, '🎁');
        }
      }

      renderAdminCustomers();

      const actionText = pointsDiff > 0 ? `+${pointsDiff}` : `${pointsDiff}`;
      showToast(`Adjusted points (${actionText}) for ${targetUser.name || 'customer'}! Current: ${newPoints} pts`, "success");
    }

    let _customerSearchDebounceTimer = null;
    function debouncedSearchCustomers() {
      if (_customerSearchDebounceTimer) clearTimeout(_customerSearchDebounceTimer);
      _customerSearchDebounceTimer = setTimeout(() => {
        renderAdminCustomers();
      }, 250);
    }
    window.debouncedSearchCustomers = debouncedSearchCustomers;

    function openCustomerDetail(userId) {
      const users = typeof getDataCached === 'function' ? getDataCached('ek_users', []) : (getData('ek_users') || []);
      const u = users.find(user => user && (user.id === userId || user.phone === userId));
      if (!u) {
        showToast("Customer profile not found!", "error");
        return;
      }

      const orders = typeof getDataCached === 'function' ? getDataCached('ek_orders', []) : (getData('ek_orders') || []);
      const uPhoneDigits = (u.phone || '').replace(/\D/g, '');
      const myOrders = orders.filter(o => {
        if (!o) return false;
        if (o.customerId === u.id || o.userId === u.id) return true;
        if (uPhoneDigits && uPhoneDigits.length >= 10) {
          const oPhone = String(o.customerPhone || o.phone || '').replace(/\D/g, '');
          if (oPhone && oPhone.includes(uPhoneDigits.slice(-10))) return true;
        }
        return false;
      });
      const spent = myOrders.reduce((sum, o) => sum + (o.totalAmount || o.price || 0), 0);

      const uName = u.name || 'Anonymous Customer';
      const uPhone = u.phone || 'N/A';
      const uEmail = u.email || 'N/A';
      const uAddress = u.address || 'N/A';
      const uTier = u.tier || 'bronze';
      const uPoints = u.loyaltyPoints || 0;
      const isGoogle = !!u.isGoogleAuth;
      const regDate = u.createdAt || u.joinedAt || u.registeredAt;
      const joinedStr = regDate ? new Date(regDate).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

      let historyHtml = '';
      if (myOrders.length === 0) {
        historyHtml = `<p style="font-size:11.5px; color:#94a3b8; font-style:italic; margin:8px 0 0 0;">No order history found for this customer.</p>`;
      } else {
        historyHtml = myOrders.map(o => {
          const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
          const itemsSummary = Array.isArray(o.items) ? o.items.map(it => `${it.tamilName || it.englishName || 'Item'} x${it.quantity}`).join(', ') : 'Order items';
          const st = String(o.status || 'pending').toUpperCase();
          return `
            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 10px; margin-top: 6px;">
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px;">
                <strong style="color:var(--accent-orange); font-family:monospace;">${o.id || ''}</strong>
                <span style="font-size:10px; font-weight:700; background:rgba(59,130,246,0.15); color:#60a5fa; padding:1px 6px; border-radius:4px;">${st}</span>
              </div>
              <div style="font-size:11px; color:#e2e8f0; margin-top:3px; word-break:break-word;">${escapeHtml(itemsSummary)}</div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:#94a3b8; margin-top:4px;">
                <span>📅 ${dateStr}</span>
                <strong style="color:#10b981; font-size:11px;">₹${o.totalAmount || o.price || 0}</strong>
              </div>
            </div>
          `;
        }).join('');
      }

      showCustomAlert("வாடிக்கையாளர் விவரங்கள் & ஆர்டர் வரலாறு / Customer Details & History", `
        <div style="text-align:left; font-size:12.5px; line-height:1.6; font-family:'Poppins', sans-serif; max-height:70vh; overflow-y:auto; padding-right:4px;">
          <div style="font-size:15px; font-weight:800; border-bottom:1px dashed rgba(255,255,255,0.15); padding-bottom:8px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; color:var(--accent-orange);">
            <div style="display:flex; align-items:center; gap:8px;">
              <span>👤 ${escapeHtml(uName)}</span>
            </div>
            ${isGoogle ? '<span style="font-size:10px; font-weight:700; background:rgba(66,133,244,0.15); color:#60a5fa; padding:2px 8px; border-radius:6px; border:1px solid rgba(66,133,244,0.3);">🌐 Google User</span>' : '<span style="font-size:10px; font-weight:700; background:rgba(16,185,129,0.15); color:#34d399; padding:2px 8px; border-radius:6px; border:1px solid rgba(16,185,129,0.3);">📱 Mobile User</span>'}
          </div>
          <p style="margin:4px 0;"><strong>Firebase UID:</strong> <span style="font-family:monospace; color:#94a3b8; font-size:11px; word-break:break-all;">${u.id || ''}</span></p>
          <p style="margin:4px 0;"><strong>Phone:</strong> ${uPhone ? '+91 ' + escapeHtml(uPhone) : '<span style="color:#94a3b8;">Not provided yet</span>'}</p>
          <p style="margin:4px 0;"><strong>Email:</strong> ${escapeHtml(uEmail)}</p>
          <p style="margin:4px 0;"><strong>Address:</strong> ${escapeHtml(uAddress)}</p>
          ${(u.latitude && u.longitude) ? `<p style="margin:4px 0;"><strong>GPS Coordinates:</strong> <span style="color:#60a5fa; font-family:monospace;">${u.latitude.toFixed(5)}, ${u.longitude.toFixed(5)}</span></p>` : ''}
          <p style="margin:4px 0;"><strong>Registered At:</strong> <span style="color:#e2e8f0;">${joinedStr}</span></p>
          <p style="margin:4px 0;"><strong>Loyalty Tier:</strong> <span style="text-transform:uppercase; font-size:9.5px; padding:2px 6px; font-weight:800; background:#f59e0b; color:#000; border-radius:4px; margin-left:4px;">${uTier.toUpperCase()}</span></p>
          <p style="margin:4px 0;"><strong>Wallet Points:</strong> <span style="color:#10b981; font-weight:bold;">${Math.round(uPoints)} pts</span></p>
          <p style="margin:4px 0;"><strong>Total Orders:</strong> ${myOrders.length}</p>
          <p style="margin:4px 0;"><strong>Gross Turnout:</strong> <span style="color:var(--accent-orange); font-weight:bold;">₹${spent}</span></p>

          <!-- Admin Quick Customer Support Actions -->
          <div style="margin-top:10px; border-top:1px dashed rgba(255,255,255,0.15); padding-top:10px; display:flex; flex-direction:column; gap:8px;">
            <h5 style="font-size:11px; font-weight:800; color:var(--accent-orange); margin:0; text-transform:uppercase; letter-spacing:0.5px;">🛠️ வாடிக்கையாளர் உதவி / Quick Actions:</h5>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${(uEmail && !uEmail.endsWith('@app.com')) ? `
              <button type="button" onclick="adminSendCustomerPasswordReset('${escapeHtml(uEmail)}', '${escapeHtml(uName)}')" style="flex:1; min-width:140px; background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.35); padding:8px 10px; border-radius:8px; font-size:11.5px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                <span>🔑</span> Reset Password Email
              </button>` : ''}
              ${uPhone ? `
              <a href="https://wa.me/91${uPhone.replace(/\\D/g, '').slice(-10)}?text=${encodeURIComponent('வணக்கம் ' + uName + ', எடப்பாடி கடை சார்பாக தொடர்பு கொள்கிறோம்.')}" target="_blank" style="flex:1; min-width:90px; background:#25D366; color:#fff; text-decoration:none; padding:8px 10px; border-radius:8px; font-size:11.5px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;">
                <span>💬</span> WhatsApp
              </a>
              <a href="tel:${uPhone.replace(/\\D/g, '').slice(-10)}" style="flex:1; min-width:80px; background:#0284c7; color:#fff; text-decoration:none; padding:8px 10px; border-radius:8px; font-size:11.5px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;">
                <span>📞</span> Call
              </a>` : ''}
            </div>
          </div>

          <div style="margin-top:14px; border-top:1px dashed rgba(255,255,255,0.15); padding-top:10px;">
            <h5 style="font-size:12px; font-weight:800; color:#fff; margin:0 0 6px 0; text-transform:uppercase; letter-spacing:0.5px;">📦 ஆர்டர் வரலாறு / Order History (${myOrders.length})</h5>
            ${historyHtml}
          </div>
        </div>
      `);
    }

    async function deleteCustomerFromDb(userId) {
      const users = getData('ek_users') || [];
      const u = users.find(user => user.id === userId);
      if (!u) return;

      const orders = getData('ek_orders', []) || [];
      const activeOrder = orders.find(o => (o.customerId === userId || o.userId === userId) &&
        !['delivered', 'cancelled', 'completed', 'archived'].includes(String(o.status).toLowerCase().trim()));
      if (activeOrder) {
        showToast(
          currentLang === 'ta'
            ? "செயலில் உள்ள ஆர்டர்கள் உள்ளதால் வாடிக்கையாளரை நீக்க முடியாது!"
            : "Cannot delete customer: Active, incomplete orders exist!",
          "error"
        );
        return;
      }

      showCustomConfirm(
        "Permanently Delete Customer?",
        `Are you sure you want to permanently delete customer <strong>${u.name}</strong> (${u.email || u.phone})?<br><br>This will fully remove their account from database and Authentication, allowing immediate re-registration with the same email.`,
        async function() {
          showToast("Deleting customer account... / நீக்கப்படுகிறது...", "info");

          let cloudAuthDeleted = false;
          let anonymizedCount = 0;

          try {
            const deleteFn = getCloudFunction('deleteCustomerAccount');
            if (deleteFn) {
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Cloud Function timeout after 15s')), 15000)
              );
              const res = await Promise.race([
                deleteFn({ targetCustomerUid: userId }),
                timeoutPromise
              ]);
              debugLog("[Customer Deletion Result]", res);
              if (res && res.data && res.data.success) {
                cloudAuthDeleted = true;
                anonymizedCount = res.data.ordersAnonymizedCount || 0;
              }
            }
          } catch (fnErr) {
            console.warn("Cloud Auth deletion failed or timed out, proceeding with direct DB deletion fallback:", fnErr);
          }

          try {
            const cleanDigits = String(u.phone || '').replace(/\D/g, '');
            const phone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

            if (typeof db !== 'undefined' && db && db.collection) {
              const deletePromises = [
                db.collection('ek_users').doc(userId).delete().catch(() => null),
                db.collection('users').doc(userId).delete().catch(() => null)
              ];

              if (phone10) {
                deletePromises.push(
                  db.collection('ek_users').doc(phone10).delete().catch(() => null),
                  db.collection('ek_users').doc(`cust_${phone10}`).delete().catch(() => null),
                  db.collection('ek_users').doc(`+91${phone10}`).delete().catch(() => null),
                  db.collection('users').doc(phone10).delete().catch(() => null),
                  db.collection('users').doc(`cust_${phone10}`).delete().catch(() => null)
                );
              }

              await Promise.all(deletePromises).catch(err => {
                console.error("Direct Firestore doc deletion failed:", err);
              });
            }

            markUserAsDeleted(userId);
            if (u.phone) markUserAsDeleted(u.phone);
            if (phone10) {
              markUserAsDeleted(phone10);
              markUserAsDeleted(`cust_${phone10}`);
            }

            const filtered = users.filter(user => {
              if (!user) return false;
              if (user.id === userId) return false;
              if (u.phone && user.phone === u.phone) return false;
              if (phone10) {
                const uDigs = String(user.phone || '').replace(/\D/g, '');
                if (uDigs && (uDigs === phone10 || uDigs.endsWith(phone10))) return false;
              }
              return true;
            });
            saveData('ek_users', filtered);

            const customerSession = getData('ek_customer_session');
            if (customerSession && (customerSession.id === userId || customerSession.phone === u.phone || (phone10 && String(customerSession.phone || '').replace(/\D/g, '').endsWith(phone10)))) {
              removeData('ek_customer_session');
              sessionStorage.removeItem('ek_customer_session_temp');
              if (typeof auth !== 'undefined' && auth && typeof auth.signOut === 'function') {
                auth.signOut().catch(() => null);
              }
            }

            invalidateDataCache('ek_users');
            renderAdminCustomers();
            if (typeof renderAdminDashboard === 'function') renderAdminDashboard();

            showToast("Customer successfully deleted! ✓", "success");

            const authStatusText = cloudAuthDeleted
              ? `✓ Auth Status: Deleted from Firebase Auth (Email: ${u.email || 'N/A'}).`
              : `⚠️ Auth Status: Deletion from Firebase Auth skipped/failed (direct DB deletion applied successfully).`;

            showAdminSuccessModal(
              "🗑️ Customer Account Deleted!",
              `Customer <strong>${u.name}</strong> was fully removed.<br><br>` +
              `<strong>${authStatusText}</strong> Same email can now immediately register again.<br>` +
              `<strong>✓ Profile Status:</strong> Customer record deleted from databases.<br>` +
              `<strong>✓ Historical Orders:</strong> ${anonymizedCount} older order records retained for accounting but fully anonymized.`
            );
          } catch (err) {
            console.error("Failed to delete customer:", err);
            showToast(`Deletion failed: ${err.message}`, "error");
          }
        }
      );
    }

    async function adminSendCustomerPasswordReset(email, name) {
      if (!email) {
        showToast("Customer email address is not available.", "error");
        return;
      }
      try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
          await firebase.auth().sendPasswordResetEmail(email);
          showToast(`✅ கடவுச்சொல் மீட்டமைப்பு மின்னஞ்சல் (${email}) வாடிக்கையாளருக்கு அனுப்பப்பட்டது!`, "success");
        } else {
          showToast("Firebase Auth is not available.", "error");
        }
      } catch (err) {
        console.error("Admin sendPasswordResetEmail error:", err);
        showToast("Error sending reset email: " + err.message, "error");
      }
    }

    function renderAdminCustomers() {
      const searchInput = document.getElementById('customer-search-input');
      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const container = document.getElementById('admin-customer-list');
      if (!container) return;

      if (typeof db !== 'undefined' && db && !window._adminCustomersListenerAttached) {
        window._adminCustomersListenerAttached = true;
        try {
          db.collection('ek_users').onSnapshot(snap => {
            if (snap && !snap.empty) {
              const cloudUsers = [];
              snap.forEach(doc => {
                cloudUsers.push({ id: doc.id, ...doc.data() });
              });
              if (cloudUsers.length > 0) {
                saveData('ek_users', cloudUsers);
                if (typeof invalidateDataCache === 'function') invalidateDataCache('ek_users');
                const searchInp = document.getElementById('customer-search-input');
                const currentSearch = searchInp ? searchInp.value.trim() : '';
                if (!currentSearch) {
                  renderAdminCustomers();
                }
              }
            }
          }, err => {
            console.warn("[renderAdminCustomers] Live Firestore listener notice:", err);
          });
        } catch (lErr) {
          console.warn("[renderAdminCustomers] Live listener attach skipped:", lErr);
        }
      }

      container.innerHTML = '';

      const allUsers = typeof getDataCached === 'function' ? getDataCached('ek_users', []) : (getData('ek_users') || []);
      // Strictly filter out Admins and Riders so only real customers are displayed in Admin Customer management
      const customersOnly = allUsers.filter(u => {
        if (!u) return false;
        const role = String(u.role || '').toLowerCase();
        const id = String(u.id || '').toLowerCase();
        if (role === 'admin' || role === 'superadmin' || role === 'rider' || role === 'delivery') return false;
        if (id.startsWith('admin_') || id.startsWith('rider_')) return false;
        return true;
      });

      let filtered = customersOnly;
      if (search) {
        const cleanSearch = search.replace(/\D/g, '');
        filtered = customersOnly.filter(u => {
          if (!u) return false;
          const uName = (u.name || '').toLowerCase();
          const uPhone = (u.phone || '').replace(/\D/g, '');
          const phoneMatches = cleanSearch ? uPhone.includes(cleanSearch) : false;
          return uName.includes(search) || phoneMatches || (u.phone || '').includes(search) || (u.email || '').toLowerCase().includes(search);
        });
      }

      const orders = typeof getDataCached === 'function' ? getDataCached('ek_orders', []) : (getData('ek_orders') || []);

      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 13px;">No customer records found.</div>`;
        return;
      }

      let customersHtml = '';
      filtered.forEach(u => {
        if (!u) return;
        const uId = u.id || '';
        const uName = u.name || 'Anonymous Customer';
        const uPhone = u.phone || '';
        const uTier = u.tier || 'bronze';
        const uPoints = u.loyaltyPoints || 0;
        const isGoogle = !!u.isGoogleAuth;
        const regDate = u.createdAt || u.joinedAt || u.registeredAt;
        const joinedStr = regDate ? new Date(regDate).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : 'Registered User';
        const isVerified = Boolean(u.isPhoneVerified || u.fcmToken || u.realFcmToken || u.phone);
        const statusBadge = isVerified
          ? `<span style="font-size:10px; font-weight:700; background:rgba(16,185,129,0.15); color:#34d399; padding:2px 6px; border-radius:4px; border:1px solid rgba(16,185,129,0.3);">🟢 ACTIVE</span>`
          : `<span style="font-size:10px; font-weight:700; background:rgba(245,158,11,0.15); color:#fbbf24; padding:2px 6px; border-radius:4px; border:1px solid rgba(245,158,11,0.3);">🟡 UNVERIFIED</span>`;

        const googleBadge = isGoogle
          ? `<span style="font-size:10px; font-weight:700; background:rgba(66,133,244,0.15); color:#60a5fa; padding:1px 6px; border-radius:4px; border:1px solid rgba(66,133,244,0.3);">🌐 GOOGLE</span>`
          : `<span style="font-size:10px; font-weight:700; background:rgba(16,185,129,0.1); color:#34d399; padding:1px 6px; border-radius:4px; border:1px solid rgba(16,185,129,0.2);">📱 MOBILE</span>`;

        const uPhoneDigits = uPhone.replace(/\D/g, '');
        const myOrders = orders.filter(o => {
          if (!o) return false;
          if (o.customerId === uId || o.userId === uId) return true;
          if (uPhoneDigits && uPhoneDigits.length >= 10) {
            const oPhone = String(o.customerPhone || o.phone || '').replace(/\D/g, '');
            if (oPhone && oPhone.includes(uPhoneDigits.slice(-10))) return true;
          }
          return false;
        });
        const spent = myOrders.reduce((sum, o) => sum + (o.totalAmount || o.price || 0), 0);

        const card = `
          <div class="card" style="border-color:#2a2a2a; margin-bottom:12px; background: #182028; padding: 12px 14px; border-radius: 12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 8px;">
              <div onclick="openCustomerDetail('${uId}')" style="cursor:pointer; flex: 1; min-width: 0;">
                <div style="display:flex; align-items:center; gap: 6px; flex-wrap: wrap;">
                  <h4 style="color:#fff; font-size:14px; font-weight: 700; margin:0;">👤 ${escapeHtml(uName)}</h4>
                  <span class="badge" style="background:#222d3a; color:var(--accent-orange); font-size:10px; border: 1px solid rgba(245,158,11,0.3); padding: 1px 6px;">${uTier.toUpperCase()}</span>
                  ${statusBadge}
                  ${googleBadge}
                </div>
                <p style="font-size:11.5px; color:var(--accent-orange); margin-top:3px; font-weight:600;">📞 ${uPhone ? '+91 ' + escapeHtml(uPhone) : '<span style="color:#94a3b8; font-weight:normal;">No phone added</span>'}</p>
                <div style="font-size:11px; color:#94a3b8; margin-top:4px; display:flex; gap:10px; flex-wrap:wrap;">
                  <span>📅 Joined: <strong style="color:#e2e8f0;">${joinedStr}</strong></span>
                  <span>📦 Orders: <strong style="color:#e2e8f0;">${myOrders.length}</strong></span>
                  <span>💰 Turnout: <strong style="color:#10b981;">₹${spent}</strong></span>
                </div>
              </div>

              <div style="text-align:right; flex-shrink: 0;">
                <span style="font-size:9.5px; color:var(--text-muted); display:block; margin-bottom:4px; font-weight:700;">WALLET POINTS</span>
                <div style="display:flex; align-items:center; gap:5px; background:#0e1319; padding:2px 6px; border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
                  <button class="btn btn-secondary" style="width:24px; height:24px; padding:0; font-size:12px; line-height:1;" onclick="adjustUserPoints('${uId}', -20)">-</button>
                  <strong style="color:var(--accent-orange); font-size:12.5px; min-width:28px; text-align:center;">${Math.round(uPoints)}</strong>
                  <button class="btn btn-secondary" style="width:24px; height:24px; padding:0; font-size:12px; line-height:1;" onclick="adjustUserPoints('${uId}', 20)">+</button>
                </div>
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; align-items:center; gap:8px; margin-top:10px; border-top:1px dashed rgba(255,255,255,0.08); padding-top:8px;">
              <button class="btn" style="background:rgba(16,185,129,0.12); color:#34d399; border:1px solid rgba(16,185,129,0.3); padding:4px 10px; font-size:11px; font-weight:700; border-radius:6px; cursor:pointer;" onclick="promptSendDirectAdminMessage('${uId}')">
                💬 Direct Message
              </button>
              <button class="btn" style="background:rgba(59,130,246,0.12); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); padding:4px 10px; font-size:11px; font-weight:700; border-radius:6px; cursor:pointer;" onclick="openCustomerDetail('${uId}')">
                🔍 Details
              </button>
              <button class="btn" style="background:rgba(244,63,94,0.12); color:#f43f5e; border:1px solid rgba(244,63,94,0.3); padding:4px 10px; font-size:11px; font-weight:700; border-radius:6px; cursor:pointer;" onclick="deleteCustomerFromDb('${uId}')">
                🗑️ Delete
              </button>
            </div>
          </div>
        `;
        customersHtml += card;
      });
      container.innerHTML = customersHtml;
    }

    function promptSendDirectAdminMessage(userId) {
      const users = typeof getDataCached === 'function' ? getDataCached('ek_users', []) : [];
      const u = users.find(x => x && x.id === userId);
      const uName = u ? (u.name || u.phone || 'Customer') : 'Customer';
      const uPhone = u && u.phone ? u.phone : '';
      const safeName = typeof escapeHtml === 'function' ? escapeHtml(uName) : uName;
      const safePhone = typeof escapeHtml === 'function' ? escapeHtml(uPhone) : uPhone;

      let existingModal = document.getElementById('admin-direct-msg-modal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'admin-direct-msg-modal';
      modal.className = 'modal-backdrop active';
      modal.style.zIndex = '99999';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      modal.style.padding = '16px';
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.right = '0';
      modal.style.bottom = '0';
      modal.style.background = 'rgba(0,0,0,0.75)';
      modal.style.backdropFilter = 'blur(6px)';

      const isTa = typeof currentLang !== 'undefined' && currentLang === 'ta';

      modal.innerHTML = `
        <div style="width: 100%; max-width: 420px; border-radius: 16px; border: 1.5px solid rgba(255,255,255,0.12); background: #111827; padding: 20px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; gap: 14px;" onclick="event.stopPropagation()">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">💬</span>
              <div>
                <h4 style="color: #ffffff; font-size: 14px; font-weight: 800; margin: 0;">${isTa ? 'நேரடி வாடிக்கையாளர் செய்தி' : 'Direct Support Message'}</h4>
                <p style="font-size: 11px; color: #10b981; margin: 2px 0 0 0; font-weight: 600;">👤 ${safeName} ${safePhone ? '(' + safePhone + ')' : ''}</p>
              </div>
            </div>
            <button id="direct-msg-close-btn" style="background: transparent; border: none; color: #9ca3af; font-size: 18px; cursor: pointer; padding: 4px;">✕</button>
          </div>

          <div>
            <label style="font-size: 11px; color: #9ca3af; font-weight: 700; display: block; margin-bottom: 6px;">
              ${isTa ? 'செய்தியை உள்ளிடவும் / Message Content' : 'Support Message'}
            </label>
            <textarea id="direct-msg-textarea" class="form-control" rows="4" placeholder="${isTa ? 'வாடிக்கையாளருக்கு அனுப்ப வேண்டிய செய்தியை உள்ளிடவும்...' : 'Type direct support message for customer...'}" style="width: 100%; height: 90px !important; background: #1e293b !important; color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; border: 1.5px solid rgba(255,255,255,0.2) !important; border-radius: 10px; padding: 10px; font-size: 13px; resize: none; box-sizing: border-box;"></textarea>
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px;">
            <button id="direct-msg-cancel-btn" class="btn" style="padding: 8px 16px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.08); color: #e5e7eb; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; cursor: pointer;">
              ${isTa ? 'ரத்து' : 'Cancel'}
            </button>
            <button id="direct-msg-send-btn" class="btn" style="padding: 8px 18px; font-size: 12px; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <span>🚀</span> ${isTa ? 'அனுப்பு' : 'Send Message'}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const closeModal = () => { modal.remove(); };
      modal.onclick = closeModal;

      const closeBtn = modal.querySelector('#direct-msg-close-btn');
      if (closeBtn) closeBtn.onclick = closeModal;

      const cancelBtn = modal.querySelector('#direct-msg-cancel-btn');
      if (cancelBtn) cancelBtn.onclick = closeModal;

      const sendBtn = modal.querySelector('#direct-msg-send-btn');
      const textarea = modal.querySelector('#direct-msg-textarea');

      if (textarea) setTimeout(() => textarea.focus(), 50);

      if (sendBtn && textarea) {
        sendBtn.onclick = () => {
          const msg = textarea.value.trim();
          if (!msg) {
            if (typeof showToast === 'function') {
              showToast(isTa ? "செய்தியை உள்ளிடவும்!" : "Please enter a message!", "warning");
            }
            textarea.focus();
            return;
          }
          closeModal();
          if (typeof sendDirectAdminCustomerMessage === 'function') {
            sendDirectAdminCustomerMessage(u || userId, msg);
          }
        };
      }
    }
    window.promptSendDirectAdminMessage = promptSendDirectAdminMessage;

    let _lastReviewsData = null; // Keep a local cache in memory to avoid redundant re-fetching

    async function renderAdminReviews(forceRefresh = false) {
      const container = document.getElementById('admin-reviews-list');
      const chartContainer = document.getElementById('admin-reviews-chart-container');
      if (!container) return;

      const starFilter = document.getElementById('review-star-filter') ? document.getElementById('review-star-filter').value : 'all';
      const search = document.getElementById('review-search-input') ? document.getElementById('review-search-input').value.toLowerCase().trim() : '';

      if (!_lastReviewsData || forceRefresh) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
            <span class="spinner" style="display:inline-block; width:24px; height:24px; border:3px solid var(--accent-orange); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:12px;"></span>
            <p style="font-size:12.5px; margin:0;">மதிப்புரைகள் ஏற்றப்படுகின்றன... / Loading reviews...</p>
          </div>
        `;
        if (chartContainer) {
          chartContainer.innerHTML = '';
        }

        try {
          if (typeof db !== 'undefined' && db) {
            debugLog("[Reviews] Querying Firestore for orders with ratings...");
            const qSnap = await db.collection('ek_orders').orderBy('createdAt', 'desc').limit(200).get().catch(async () => await db.collection('ek_orders').limit(200).get());
            const loaded = [];
            qSnap.forEach(doc => {
              const o = doc.data();
              if (o && o.rating !== undefined && o.rating > 0) {
                loaded.push(o);
              }
            });
            loaded.sort((a, b) => {
              const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
              const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
              return tB - tA;
            });
            _lastReviewsData = loaded;
          } else {
            const orders = getData('ek_orders', []);
            _lastReviewsData = orders.filter(o => o && o.rating !== undefined && o.rating > 0);
          }
        } catch (err) {
          console.error("[Reviews] Error loading reviews:", err);
          container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--accent-red); border: 1.5px dashed rgba(239, 68, 68, 0.15); border-radius: 14px; background: rgba(239, 68, 68, 0.02);">
              <span style="font-size: 28px; display: block; margin-bottom: 8px;">⚠️</span>
              <p style="font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">பிழை / Load Error</p>
              <p style="font-size: 11.5px; color: var(--text-muted); margin: 0 0 16px 0;">மதிப்புரைகளை ஏற்றுவதில் தோல்வி அடைந்தது. (Failed to load reviews from database.)</p>
              <button class="btn btn-secondary" style="width: auto; height: auto; padding: 8px 16px; font-size: 11px; font-weight: 600;" onclick="renderAdminReviews(true)">Retry / மீண்டும் முயலவும்</button>
            </div>
          `;
          return;
        }
      }

      const reviewedOrders = _lastReviewsData;

      if (chartContainer) {
        if (reviewedOrders.length === 0) {
          chartContainer.innerHTML = `
            <div class="card" style="background: rgba(255,255,255,0.01); border: 1.2px dashed rgba(255,255,255,0.08); text-align: center; padding: 24px; border-radius: 14px;">
              <span style="font-size: 24px; display: block; margin-bottom: 6px;">📊</span>
              <p style="color: var(--text-muted); font-size: 11.5px; margin: 0;">விமர்சனங்கள் எதுவும் இன்னும் இல்லை. / No reviews yet.</p>
            </div>
          `;
        } else {
          const totalCount = reviewedOrders.length;
          const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
          let sum = 0;
          reviewedOrders.forEach(o => {
            const r = Math.round(o.rating);
            if (counts[r] !== undefined) {
              counts[r]++;
            }
            sum += o.rating;
          });
          const average = (sum / totalCount).toFixed(1);

          let barsHtml = '';
          const fillGradients = {
            5: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', // Emerald Green
            4: 'linear-gradient(90deg, #84cc16 0%, #a3e635 100%)', // Light Green
            3: 'linear-gradient(90deg, #eab308 0%, #fde047 100%)', // Yellow
            2: 'linear-gradient(90deg, #f97316 0%, #ffedd5 100%)', // Orange
            1: 'linear-gradient(90deg, #ef4444 0%, #fca5a5 100%)'  // Red
          };

          [5, 4, 3, 2, 1].forEach(star => {
            const count = counts[star];
            const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(0) : 0;
            barsHtml += `
              <div style="display: flex; align-items: center; gap: 8px; font-family: 'Poppins', sans-serif;">
                <span style="font-size: 11px; font-weight: 700; color: #fff; width: 22px; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 1px;">
                  ${star} <span style="font-size: 9px; color: var(--accent-orange);">★</span>
                </span>
                <div style="flex: 1; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; position: relative;">
                  <div style="width: ${pct}%; height: 100%; background: ${fillGradients[star]}; border-radius: 4px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 8px rgba(245,158,11,0.12);"></div>
                </div>
                <span style="font-size: 10px; font-weight: 600; color: var(--text-muted); width: 62px; text-align: left; white-space: nowrap;">
                  <span style="color: #fff; font-weight:700;">${count}</span> review${count !== 1 ? 's' : ''}
                </span>
              </div>
            `;
          });

          const avgStarsFilled = Math.round(average);
          const starsVisual = '★'.repeat(avgStarsFilled) + '☆'.repeat(5 - avgStarsFilled);

          chartContainer.innerHTML = `
            <div class="card" style="background: linear-gradient(135deg, rgba(20,20,22,0.6) 0%, rgba(12,12,14,0.85) 100%); border-color: rgba(245,158,11,0.22); padding: 14px; border-radius: 14px; box-shadow: 0 6px 16px rgba(0,0,0,0.4); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);">
              <div style="display: flex; flex-direction: row; gap: 14px; align-items: center;">

                <!-- Left half: Score Summary -->
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border-right: 1px dashed rgba(255,255,255,0.1); padding-right: 14px;">
                  <span style="font-size: 34px; font-weight: 900; color: #fff; line-height: 1.1; font-family: 'Poppins', sans-serif;">${average}</span>
                  <div style="font-size: 13.5px; color: var(--accent-orange); font-weight: 800; margin: 2px 0 3px 0; letter-spacing: 0.5px; text-shadow: 0 1px 4px rgba(249,115,22,0.2);">${starsVisual}</div>
                  <span style="font-size: 9.5px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">based on ${totalCount} review${totalCount > 1 ? 's' : ''}</span>
                </div>

                <!-- Right half: Star Breakdown Bars -->
                <div style="flex: 1.7; display: flex; flex-direction: column; gap: 4px;">
                  ${barsHtml}
                </div>

              </div>
            </div>
          `;
        }
      }

      let filtered = reviewedOrders;

      if (starFilter === '5') {
        filtered = filtered.filter(o => o.rating === 5);
      } else if (starFilter === '4') {
        filtered = filtered.filter(o => o.rating >= 4);
      } else if (starFilter === '3') {
        filtered = filtered.filter(o => o.rating >= 3);
      } else if (starFilter === '1_2') {
        filtered = filtered.filter(o => o.rating === 1 || o.rating === 2);
      }

      if (search) {
        filtered = filtered.filter(o =>
          (o.customerName || '').toLowerCase().includes(search) ||
          (o.customerPhone || '').includes(search) ||
          (o.feedbackComment || '').toLowerCase().includes(search) ||
          (o.id || '').toLowerCase().includes(search)
        );
      }

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
            <p style="font-size: 24px; margin-bottom: 6px;">✨</p>
            <p style="font-size: 13px; font-weight: 600; margin: 0 0 4px 0;">No reviews yet / இன்னும் மதிப்புரைகள் இல்லை</p>
            <p style="font-size: 11.5px; margin: 0;">மதிப்புரைகள் எதுவும் கிடைக்கவில்லை. (No rating reviews match your filter parameters.)</p>
          </div>
        `;
        return;
      }

      let reviewsHtml = '';
      filtered.forEach(o => {
        const comment = o.feedbackComment || (currentLang === 'ta' ? 'கருத்துக்கள் எதுவும் எழுதப்படவில்லை' : 'No written feedback comment provided.');
        const dateStr = o.updatedAt ? new Date(o.updatedAt).toLocaleDateString() : (o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A');
        const starsStr = '★'.repeat(o.rating) + '☆'.repeat(5 - o.rating);
        const exec = typeof getOrderAssignedExecutive === 'function' ? getOrderAssignedExecutive(o) : null;
        const riderText = (exec && exec.name) || (currentLang === 'ta' ? 'கொடுக்கப்படவில்லை' : 'Unassigned Rider');

        const card = `
          <div class="card" style="border-color: rgba(245,158,11,0.18); background: rgba(245,158,11,0.015); margin-bottom:12px; padding: 14px; border-radius:14px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <span style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Order Match: #${escapeHtml(o.id || '')}</span>
                <h4 style="color:#fff; font-size:13.5px; margin: 2px 0 0 0;">👤 ${escapeHtml(o.customerName || 'Customer')} <span style="font-size: 11px; color: var(--text-muted); font-weight:normal;">(${escapeHtml(dateStr)})</span></h4>
                <p style="font-size:11px; color:var(--accent-orange); margin: 2px 0 0 0;">📞 +91 ${escapeHtml(o.customerPhone || '')}</p>
              </div>
              <span style="font-size:14px; color:var(--accent-orange); font-weight:700;">${starsStr}</span>
            </div>

            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.04); border-radius:8px; padding: 10px; font-size: 11.5px; line-height: 1.45; color: rgba(255,255,255,0.9); font-style: italic;">
              "${escapeHtml(comment)}"
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:var(--text-muted); border-top:1px dashed rgba(255,255,255,0.04); padding-top:6px; margin-top:2px;">
              <span>Rider Assigned: <strong style="color:#fff;">${escapeHtml(riderText)}</strong></span>
              <button class="btn btn-secondary" style="width:auto; height:24px; font-size:10px; padding:3px 8px; border-color: rgba(255,255,255,0.08); border-radius:5px;" onclick="switchAdminTab('tab-orders'); document.getElementById('admin-orders-search').value='${escapeHtml(o.id || '')}'; renderAdminOrders();">
                🔍 View Order
              </button>
            </div>
          </div>
        `;
        reviewsHtml += card;
      });
      container.innerHTML = reviewsHtml;
    }

    const DEFAULT_LYO_AI_CONFIG = {
      phone: "8778148899",
      directives: "இன்று எங்களது கடையில் பிரஸ் நாட்டுக்கோழி மற்றும் ஆட்டுக்கறி விசேஷமாக கிடைக்கிறது. எடப்பாடி முழுவதும் 30 நிமிடத்தில் ஹோம் டெலிவரி!",
      systemPrompt: `You are "Premium Edappadi Kadai Assistant", the ultra-vibrant, energetic Salem-accent bilingual shopkeeper of "Edappadi Kadai" in Kavandampatti, Edappadi, Salem, Tamil Nadu.

STRICT PROTOCOLS:
1. GREETING & PERSONALIZATION: Greet user by name and tier if available. For GOLD tier, greet as VIP Royal Member with extreme praise ("நம்ம கடையோட தங்கம் போன்ற கோல்டு மெம்பர் அண்ணே/அக்கா!") and remind them of free delivery.
2. LIVE STOCK LEVELS: Prioritize live product database. If items are out of stock, offer fresh available alternatives.
3. DELIVERY STATUS: For tracking, provide exact status and rider details from real-time database.
4. CATEGORY INTELLIGENCE: Match praise opening to detected category:
   - Non-Veg: "கறி சும்மா வெட்டி வச்ச தங்கம் மாதிரி பளபளக்குதுண்ணே! 🥩🔪🐟"
   - Veg: "காய்கறி தோட்டத்துல இருந்து பறிச்ச தங்கம் மாதிரி பசுமையா இருக்குண்ணே! 🥦🥕🌿"
   - Fruits: "பழங்கள் மரத்துல இருந்து பறிச்ச தங்கம் மாதிரி தித்திப்பா இருக்குண்ணே! 🍎🍌🍇"
   - Dairy/Egg: "பால் பொருட்கள் தூய்மையா ஊட்டச்சத்து நிறைஞ்சு இருக்குண்ணே! 🥛🥚🧀"
   - Grocery: "மளிகை பொருட்கள் தூய்மையா பேக் செஞ்சு தயாரா வச்சிருக்கேன் அண்ணே! 🧂🛒🌾"
   * NEVER mix non-veg phrases with vegetables, fruits, or groceries.
5. ESCALATION: For custom/unresolved queries, direct to call owner at **{SUPPORT_PHONE}** and append "[ACTION_SUPPORT]". Append "[ACTION_TRACK]" to show tracking maps.`
    };

    function ensureCacheBustingUrl(url) {
      if (!url || typeof url !== "string") return url;
      if (url.startsWith("data:image")) return url;
      if (url.includes("firebasestorage.googleapis.com")) {
        if (!url.includes("v=") && !url.includes("_cb=")) {
          const sep = url.includes("?") ? "&" : "?";
          return url + sep + "v=" + Date.now();
        }
      }
      return url;
    }

    function getLyoAiConfig() {
      return getData('ek_lyo_ai_config', DEFAULT_LYO_AI_CONFIG);
    }

    function loadAdminLyoAiConfig() {
      const config = getLyoAiConfig();
      const elPhone = document.getElementById('setting-lyoai-phone');
      if (elPhone) elPhone.value = config.phone || '8778148899';
      const elDirectives = document.getElementById('setting-lyoai-directives');
      if (elDirectives) elDirectives.value = config.directives || '';
    }

    async function saveAdminLyoAiConfig() {
      const elPhone = document.getElementById('setting-lyoai-phone');
      const elDirectives = document.getElementById('setting-lyoai-directives');

      const config = getLyoAiConfig();
      if (elPhone) config.phone = elPhone.value.trim();
      if (elDirectives) config.directives = elDirectives.value.trim();
      config.updatedAt = new Date().toISOString();

      saveData('ek_lyo_ai_config', config);

      if (typeof db !== 'undefined' && db) {
        try {
          await db.collection('ek_settings').doc('lyo_ai_config').set(config);
          await db.collection('settings').doc('lyo_ai_config').set(config);
          debugLog("[Lyo AI Settings] Synchronized settings to Firestore!");
        } catch (err) {
          console.error("Firestore Lyo AI Settings write failed:", err);
        }
      }
      showToast("Assistant Configurations saved & synced successfully! ✨", "success");
      showAdminSuccessModal(
        currentLang === 'ta' ? "🤖 உதவிப்பக்க அமைப்புகள் சேமிக்கப்பட்டது!" : "🤖 Assistant Config Saved!",
        currentLang === 'ta' ? "உதவி அமைப்புகள் வெற்றிகரமாக சேமிக்கப்பட்டு புதுப்பிக்கப்பட்டது." : "Assistant helper configurations have been successfully saved."
      );
    }

    /* ==========================================================================
       PROVIDER-AGNOSTIC AI KEY SYSTEM & ABSTRACTION LAYER
       ========================================================================== */
    function detectAiProvider(apiKey) {
      if (!apiKey || typeof apiKey !== 'string') return null;
      const trimmed = apiKey.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('AIza')) return 'gemini';
      if (trimmed.startsWith('sk-ant-')) return 'anthropic';
      if (trimmed.startsWith('gsk_')) return 'groq';
      if (trimmed.startsWith('sk-or-')) return 'openrouter';
      if (trimmed.startsWith('ds-') || trimmed.includes('deepseek')) return 'deepseek';
      if (trimmed.startsWith('hf_')) return 'huggingface';
      if (trimmed.startsWith('sk-')) return 'openai';
      return 'openai'; // Fallback to OpenAI-compatible interface for custom keys
    }

    function getAiProviderConfig() {
      const defaultConfig = { provider: 'gemini', apiKey: '', model: '' };
      try {
        let raw = '';
        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.getData === 'function') {
          raw = AndroidStorage.getData('ek_ai_provider_config', '{}');
        } else {
          raw = localStorage.getItem('ek_ai_provider_config') || '{}';
        }
        let parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') parsed = {};

        return {
          provider: parsed.provider || 'gemini',
          apiKey: parsed.apiKey || '',
          model: parsed.model || '',
          hasKey: !!parsed.apiKey || !!parsed.hasKey
        };
      } catch (e) {
        return defaultConfig;
      }
    }

    function getBuiltinGeminiApiKey() {
      // AI generation is executed via server-side Cloud Function proxy to secure credentials
      return '';
    }

    function loadAdminAiKeyConfig() {
      const config = getAiProviderConfig();
      const elKey = document.getElementById('setting-ai-api-key');
      const elModel = document.getElementById('setting-ai-model');
      const elBadge = document.getElementById('ai-key-provider-badge');

      if (elKey && !elKey.value) {
        elKey.value = config.apiKey || '';
      }
      if (elModel) elModel.value = config.model || '';

      if (elBadge) {
        if (config.hasKey || config.apiKey) {
          const p = config.provider ? config.provider.toUpperCase() : 'CUSTOM';
          elBadge.innerText = `Active: ${p}`;
          elBadge.style.background = 'rgba(16, 185, 129, 0.2)';
          elBadge.style.color = '#10b981';
          elBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else {
          elBadge.innerText = 'Default (Server Gemini)';
          elBadge.style.background = 'rgba(245, 158, 11, 0.2)';
          elBadge.style.color = '#f59e0b';
          elBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        }
      }
      handleAiKeyInputChange();
    }

    function handleAiKeyInputChange() {
      const elKey = document.getElementById('setting-ai-api-key');
      const infoEl = document.getElementById('ai-key-detected-info');
      if (!elKey || !infoEl) return;

      const keyVal = elKey.value.trim();
      if (!keyVal) {
        infoEl.style.display = 'none';
        return;
      }

      const detected = detectAiProvider(keyVal);
      if (detected === 'gemini') {
        infoEl.style.display = 'block';
        infoEl.style.color = '#10b981';
        infoEl.innerHTML = '✨ Detected Provider: <strong>Google Gemini</strong>';
      } else if (detected === 'openai') {
        infoEl.style.display = 'block';
        infoEl.style.color = '#3b82f6';
        infoEl.innerHTML = '🤖 Detected Provider: <strong>OpenAI (ChatGPT)</strong>';
      } else if (detected === 'anthropic') {
        infoEl.style.display = 'block';
        infoEl.style.color = '#a855f7';
        infoEl.innerHTML = '🧠 Detected Provider: <strong>Anthropic (Claude)</strong>';
      } else if (detected === 'groq') {
        infoEl.style.display = 'block';
        infoEl.style.color = '#f97316';
        infoEl.innerHTML = '⚡ Detected Provider: <strong>Groq (Llama 3.3 / Fast AI)</strong>';
      } else if (detected === 'openrouter') {
        infoEl.style.display = 'block';
        infoEl.style.color = '#6366f1';
        infoEl.innerHTML = '🌐 Detected Provider: <strong>OpenRouter Multi-Model</strong>';
      } else if (detected === 'deepseek') {
        infoEl.style.display = 'block';
        infoEl.style.color = '#06b6d4';
        infoEl.innerHTML = '🔮 Detected Provider: <strong>DeepSeek AI</strong>';
      } else if (detected === 'huggingface') {
        infoEl.style.display = 'block';
        infoEl.style.color = '#eab308';
        infoEl.innerHTML = '🤗 Detected Provider: <strong>HuggingFace Inference</strong>';
      } else {
        infoEl.style.display = 'block';
        infoEl.style.color = '#10b981';
        infoEl.innerHTML = '⚙️ Detected Provider: <strong>Custom AI API (OpenAI Compatible)</strong>';
      }
    }

    function toggleAiKeyVisibility() {
      const elKey = document.getElementById('setting-ai-api-key');
      const btn = document.getElementById('btn-toggle-ai-key-vis');
      if (!elKey) return;

      if (elKey.type === 'password') {
        elKey.type = 'text';
        if (btn) btn.innerText = '🙈';
      } else {
        elKey.type = 'password';
        if (btn) btn.innerText = '👁️';
      }
    }

    async function saveAdminAiKeyConfig() {
      const elKey = document.getElementById('setting-ai-api-key');
      const elModel = document.getElementById('setting-ai-model');

      const apiKey = elKey ? elKey.value.trim() : '';
      const model = elModel ? elModel.value.trim() : '';

      if (apiKey) {
        const detectedProvider = detectAiProvider(apiKey);
        if (!detectedProvider) {
          showToast("Key format not recognized. Please check you copied the correct key.", "error");
          return;
        }

        const serverConfig = {
          provider: detectedProvider,
          apiKey: apiKey,
          model: model,
          updatedAt: new Date().toISOString()
        };

        const clientSafeConfig = {
          provider: detectedProvider,
          hasKey: true,
          model: model,
          updatedAt: new Date().toISOString()
        };

        saveData('ek_ai_provider_config', clientSafeConfig);

        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.saveData === 'function') {
          AndroidStorage.saveData('ek_ai_provider_config', JSON.stringify(clientSafeConfig));
        }

        if (typeof db !== 'undefined' && db) {
          try {
            await db.collection('ek_settings').doc('ai_provider_config').set(serverConfig);
            debugLog("[AI Key Settings] Synchronized AI provider config securely to server Firestore!");
          } catch (err) {
            console.error("Firestore AI Provider Config write failed:", err);
          }
        }

        let providerName = "Gemini";
        if (detectedProvider === 'openai') providerName = "OpenAI (ChatGPT)";
        if (detectedProvider === 'anthropic') providerName = "Claude (Anthropic)";

        showToast(`✅ ${providerName} key saved & active on server!`, "success");
        loadAdminAiKeyConfig();
      } else {
        const clientSafeConfig = {
          provider: 'gemini',
          hasKey: false,
          model: '',
          updatedAt: new Date().toISOString()
        };

        saveData('ek_ai_provider_config', clientSafeConfig);
        if (typeof AndroidStorage !== 'undefined' && typeof AndroidStorage.saveData === 'function') {
          AndroidStorage.saveData('ek_ai_provider_config', JSON.stringify(clientSafeConfig));
        }

        if (typeof db !== 'undefined' && db) {
          try {
            await db.collection('ek_settings').doc('ai_provider_config').set({
              provider: 'gemini',
              apiKey: '',
              model: '',
              updatedAt: new Date().toISOString()
            });
          } catch (err) {}
        }

        showToast("Reset to server Gemini default!", "info");
        loadAdminAiKeyConfig();
      }
    }