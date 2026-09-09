package com.edappadikadai.app

import android.app.Activity
import android.app.PendingIntent
import android.app.NotificationManager
import android.app.NotificationChannel
import android.graphics.BitmapFactory
import androidx.core.app.NotificationCompat
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.annotation.SuppressLint
import android.print.PrintAttributes
import android.print.PrintManager
import android.print.PrintJob
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.key
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.edappadikadai.app.ui.theme.MyApplicationTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@SuppressLint("InvalidFragmentVersionForActivityResult")
class MainActivity : ComponentActivity() {

    companion object {
        var isActivityInForeground = false
        var currentInstance: MainActivity? = null

        fun purgeStaleFcmRegistrations(context: Context, onComplete: (() -> Unit)? = null) {
            android.util.Log.w("FCM_INIT", "Purging stale FCM registrations and installations to resolve TOO_MANY_REGISTRATIONS...")
            try {
                val sharedPrefs = context.getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)
                sharedPrefs.edit()
                    .remove("fcm_topics_subscribed_v2")
                    .remove("fcm_token")
                    .remove("real_fcm_token")
                    .apply()

                com.google.firebase.messaging.FirebaseMessaging.getInstance().deleteToken()
                    .addOnCompleteListener {
                        try {
                            com.google.firebase.installations.FirebaseInstallations.getInstance().delete()
                                .addOnCompleteListener {
                                    android.util.Log.i("FCM_INIT", "Stale FCM registration & installations purged successfully.")
                                    onComplete?.invoke()
                                }
                        } catch (delInstEx: Exception) {
                            android.util.Log.w("FCM_INIT", "Firebase installations delete exception: ${delInstEx.message}")
                            onComplete?.invoke()
                        }
                    }
            } catch (e: Exception) {
                android.util.Log.w("FCM_INIT", "Error deleting stale FCM token: ${e.message}")
                onComplete?.invoke()
            }
        }
    }

    val isAppLoadedState = androidx.compose.runtime.mutableStateOf(false)
    val hasLoadFailedState = androidx.compose.runtime.mutableStateOf(false)
    val webViewRecreateKey = androidx.compose.runtime.mutableStateOf(0)
    val isSoftwareRenderingFallback = androidx.compose.runtime.mutableStateOf(false)
    private var renderCrashCount = 0
    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var integrityCheckRunnable: Runnable? = null

    fun checkPendingNotificationPayload() {
        val payload = EdappadiApplication.pendingNotificationPayload
        if (!payload.isNullOrBlank() && isAppLoadedState.value && webView != null) {
            EdappadiApplication.pendingNotificationPayload = null
            handleNotificationPayload(payload)
        }
    }

    fun handleNotificationPayload(payloadJsonStr: String) {
        runOnUiThread {
            if (isAppLoadedState.value && webView != null) {
                val escapedJson = payloadJsonStr.replace("\\", "\\\\").replace("'", "\\'")
                webView?.evaluateJavascript(
                    "javascript:(function() { " +
                    "  try { " +
                    "    var payload = JSON.parse('$escapedJson'); " +
                    "    if (typeof window.handleFcmNotificationClick === 'function') { " +
                    "      window.handleFcmNotificationClick(payload); " +
                    "    } else if (typeof window.handleOneSignalNotificationClick === 'function') { " +
                    "      window.handleOneSignalNotificationClick(payload); " +
                    "    } else if (typeof window.onOneSignalNotificationClicked === 'function') { " +
                    "      window.onOneSignalNotificationClicked(payload); " +
                    "    } " +
                    "  } catch(e) { console.error('FCM JS click handler error:', e); } " +
                    "})()", null
                )
            } else {
                EdappadiApplication.pendingNotificationPayload = payloadJsonStr
            }
        }
    }

    fun onJsAppLoaded() {
        runOnUiThread {
            isAppLoadedState.value = true
            hasLoadFailedState.value = false
            integrityCheckRunnable?.let { mainHandler.removeCallbacks(it) }
            android.util.Log.d("INTEGRITY_CHECK", "App integrity check passed: WebView rendered successfully.")
            checkPendingNotificationPayload()
        }
    }

    fun scheduleIntegrityCheck() {
        integrityCheckRunnable?.let { mainHandler.removeCallbacks(it) }
        val checkRunnable = Runnable {
            if (!isAppLoadedState.value) {
                webView?.evaluateJavascript(
                    "javascript:(function() { return !!(document && document.body && document.body.innerHTML && document.body.innerHTML.length > 50); })()"
                ) { result ->
                    if (result == "true") {
                        onJsAppLoaded()
                    } else {
                        android.util.Log.e("INTEGRITY_CHECK", "Startup integrity check failed or timed out after 15s. Showing fallback screen.")
                        hasLoadFailedState.value = true
                    }
                }
            }
        }
        integrityCheckRunnable = checkRunnable
        mainHandler.postDelayed(checkRunnable, 15000)
    }

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var webView: WebView? = null
    private var pendingGeolocationCallback: GeolocationPermissions.Callback? = null
    private var pendingGeolocationOrigin: String? = null
    private var activeLocationListener: android.location.LocationListener? = null
    private var isActiveLocationListenerRegistered = false
    var latestFiredLocation: android.location.Location? = null

    private fun getLocationManager(): android.location.LocationManager? {
        return getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
    }

    fun startActiveLocationUpdates() {
        val locationManager = getLocationManager() ?: return
        val hasFine = androidx.core.content.ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val hasCoarse = androidx.core.content.ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) return

        try {
            // Unregister first if any existing listener is active to avoid duplicate registrations or leaks
            activeLocationListener?.let { oldListener ->
                try {
                    if (isActiveLocationListenerRegistered) {
                        locationManager.removeUpdates(oldListener)
                    }
                } catch (e: Exception) {}
            }
            isActiveLocationListenerRegistered = false
            activeLocationListener = null

            val listener = object : android.location.LocationListener {
                override fun onLocationChanged(location: android.location.Location) {
                    latestFiredLocation = location
                    android.util.Log.d("GPS_ACTIVE", "Active Location updated: ${location.latitude}, ${location.longitude}, Acc: ${location.accuracy}")
                }
                override fun onStatusChanged(p: String?, s: Int, e: Bundle?) {}
                override fun onProviderEnabled(p: String) {}
                override fun onProviderDisabled(p: String) {}
            }

            val isGpsEnabled = try { locationManager.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER) } catch (e: Exception) { false }
            val isNetworkEnabled = try { locationManager.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER) } catch (e: Exception) { false }
            
            var registered = false
            // Prioritize GPS_PROVIDER. Avoid subscribing the same listener instance to multiple providers 
            // concurrently, which is a known source of duplicate AppOps tracking mismatch.
            if (isGpsEnabled) {
                try {
                    locationManager.requestLocationUpdates(
                        android.location.LocationManager.GPS_PROVIDER,
                        5000L,
                        10f,
                        listener
                    )
                    registered = true
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            } else if (isNetworkEnabled) {
                try {
                    locationManager.requestLocationUpdates(
                        android.location.LocationManager.NETWORK_PROVIDER,
                        5000L,
                        10f,
                        listener
                    )
                    registered = true
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            if (registered) {
                activeLocationListener = listener
                isActiveLocationListenerRegistered = true
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            val parsedUris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
            val uris = parsedUris ?: (data?.data?.let { arrayOf(it) })
            filePathCallback?.onReceiveValue(uris)
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[android.Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseGranted = permissions[android.Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        if (fineGranted || coarseGranted) {
            pendingGeolocationCallback?.let { callback ->
                callback.invoke(pendingGeolocationOrigin, true, true)
            }
            startActiveLocationUpdates()
        } else {
            pendingGeolocationCallback?.let { callback ->
                callback.invoke(pendingGeolocationOrigin, false, false)
            }
        }
        pendingGeolocationCallback = null
        pendingGeolocationOrigin = null
        runOnUiThread {
            webView?.evaluateJavascript(
                "javascript:(function() { " +
                "  if (typeof onAndroidLocationPermissionResult === 'function') { " +
                "    onAndroidLocationPermissionResult(${fineGranted || coarseGranted}); " +
                "  } " +
                "})()", null
            )
        }
    }

    val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            android.util.Log.d("NOTIF_PERM", "Notification permission granted.")
        } else {
            android.util.Log.d("NOTIF_PERM", "Notification permission denied.")
        }
        runOnUiThread {
            webView?.evaluateJavascript(
                "javascript:(function() { " +
                "  if (typeof onAndroidNotificationPermissionResult === 'function') { " +
                "    onAndroidNotificationPermissionResult($isGranted); " +
                "  } " +
                "})()", null
            )
        }
    }

    val upiPaymentLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val resultCode = result.resultCode
        val data = result.data
        var responseText = ""
        if (data != null) {
            responseText = data.getStringExtra("response")
                ?: data.getStringExtra("res")
                ?: data.getStringExtra("status")
                ?: ""
            
            if (responseText.isEmpty()) {
                val bundle = data.extras
                if (bundle != null) {
                    responseText = bundle.getString("response")
                        ?: bundle.getString("res")
                        ?: bundle.getString("status")
                        ?: ""
                    
                    if (responseText.isEmpty()) {
                        val sb = java.lang.StringBuilder()
                        for (key in bundle.keySet()) {
                            @Suppress("DEPRECATION")
                            val value = bundle.get(key)
                            if (value != null) {
                                sb.append(key).append("=").append(value).append("&")
                            }
                        }
                        responseText = sb.toString()
                    }
                }
            }
        }
        
        val status = if (resultCode == Activity.RESULT_OK) {
            if (responseText.isNotEmpty()) {
                responseText
            } else {
                "SUCCESS_NO_RESPONSE_DATA"
            }
        } else {
            if (responseText.isNotEmpty()) {
                "CANCELLED_OR_FAILED&$responseText"
            } else {
                "CANCELLED"
            }
        }
        
        runOnUiThread {
            val escapedStatus = status.replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
            webView?.evaluateJavascript(
                "javascript:(function() { " +
                "  if (typeof onAndroidUpiPaymentResult === 'function') { " +
                "    onAndroidUpiPaymentResult('$escapedStatus'); " +
                "  } " +
                "})()", null
            )
        }
    }

    val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val accountName = result.data?.getStringExtra(android.accounts.AccountManager.KEY_ACCOUNT_NAME) ?: ""
            if (accountName.isNotEmpty()) {
                val cleanName = accountName.substringBefore("@").replace(".", " ").replace("_", " ").split(" ")
                    .joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
                runOnUiThread {
                    webView?.evaluateJavascript(
                        "javascript:(function() { " +
                        "  if (typeof onAndroidGoogleAccountSelected === 'function') { " +
                        "    onAndroidGoogleAccountSelected('$accountName', '$cleanName'); " +
                        "  } " +
                        "})()", null
                    )
                }
            } else {
                runOnUiThread {
                    webView?.evaluateJavascript(
                        "javascript:(function() { " +
                        "  if (typeof onAndroidGoogleAccountPickerFailed === 'function') { " +
                        "    onAndroidGoogleAccountPickerFailed('No account selected'); " +
                        "  } " +
                        "})()", null
                    )
                }
            }
        } else {
            runOnUiThread {
                webView?.evaluateJavascript(
                    "javascript:(function() { " +
                    "  if (typeof onAndroidGoogleAccountPickerCancelled === 'function') { " +
                    "    onAndroidGoogleAccountPickerCancelled(); " +
                    "  } " +
                    "})()", null
                )
            }
        }
    }

    fun startGoogleSignInFlow() {
        try {
            val intent = android.accounts.AccountManager.newChooseAccountIntent(
                null, null, arrayOf("com.google"), null, null, null, null
            )
            googleSignInLauncher.launch(intent)
        } catch (e: Exception) {
            android.util.Log.e("GOOGLE_SIGNIN", "Failed to launch account chooser", e)
            runOnUiThread {
                webView?.evaluateJavascript(
                    "javascript:(function() { " +
                    "  if (typeof onAndroidGoogleAccountPickerFailed === 'function') { " +
                    "    onAndroidGoogleAccountPickerFailed('${e.message ?: "Account chooser error"}'); " +
                    "  } " +
                    "})()", null
                )
            }
        }
    }

    val startupPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[android.Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseGranted = permissions[android.Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        val notifGranted = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            permissions[android.Manifest.permission.POST_NOTIFICATIONS] ?: false
        } else {
            true
        }
        
        android.util.Log.d("STARTUP_PERM", "Startup Permissions: FineLocation=$fineGranted, CoarseLocation=$coarseGranted, Notification=$notifGranted")
        if (fineGranted || coarseGranted) {
            startActiveLocationUpdates()
        }
        
        runOnUiThread {
            webView?.evaluateJavascript(
                "javascript:(function() { " +
                "  if (typeof onAndroidLocationPermissionResult === 'function') { " +
                "    onAndroidLocationPermissionResult(${fineGranted || coarseGranted}); " +
                "  } " +
                "  if (typeof onAndroidNotificationPermissionResult === 'function') { " +
                "    onAndroidNotificationPermissionResult($notifGranted); " +
                "  } " +
                "})()", null
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        currentInstance = this
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleIntentForFcm(intent)

        // Pre-create WebView cache directories to prevent Chromium from logging directory-missing errors
        try {
            val webViewDir = java.io.File(cacheDir, "WebView/Default")
            if (!webViewDir.exists()) {
                webViewDir.mkdirs()
            }
            val httpCacheDir = java.io.File(webViewDir, "HTTP Cache")
            if (!httpCacheDir.exists()) {
                httpCacheDir.mkdirs()
            }
            val codeCacheDir = java.io.File(httpCacheDir, "Code Cache")
            if (!codeCacheDir.exists()) {
                codeCacheDir.mkdirs()
            }
            val jsCacheDir = java.io.File(codeCacheDir, "js")
            if (!jsCacheDir.exists()) {
                jsCacheDir.mkdirs()
            }
            val wasmCacheDir = java.io.File(codeCacheDir, "wasm")
            if (!wasmCacheDir.exists()) {
                wasmCacheDir.mkdirs()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Notification permission is requested gracefully on-demand from JavaScript via AndroidStorage.requestNotificationPermission()



        // Fetch and register Firebase Cloud Messaging (FCM) Token gracefully
        try {
            if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
                try {
                    com.google.firebase.FirebaseApp.initializeApp(this)
                } catch (defaultEx: Exception) {
                    val options = com.google.firebase.FirebaseOptions.Builder()
                        .setApiKey("AIzaSyDtlKng15Cyixb6HJx-mToBXHVVy28SXSA")
                        .setApplicationId("1:397565375990:android:a645b16c604372d7ce83d7")
                        .setProjectId("edappadi-kadai")
                        .setGcmSenderId("397565375990")
                        .build()
                    com.google.firebase.FirebaseApp.initializeApp(this, options)
                }
            }

            // Initialize Firebase App Check with Play Integrity provider
            try {
                val firebaseAppCheck = com.google.firebase.appcheck.FirebaseAppCheck.getInstance()
                firebaseAppCheck.installAppCheckProviderFactory(
                    com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory.getInstance()
                )
                android.util.Log.d("APP_CHECK", "Firebase App Check initialized with Play Integrity provider.")
            } catch (appCheckEx: Exception) {
                android.util.Log.e("APP_CHECK", "Failed to initialize Firebase App Check: ${appCheckEx.message}", appCheckEx)
            }

            // Initialize and configure Firebase Crashlytics
            try {
                val crashlytics = com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance()
                // Ensure crash reporting is enabled by default in production builds
                crashlytics.setCrashlyticsCollectionEnabled(true)
                crashlytics.setCustomKey("app_check_initialized", "true")
                crashlytics.log("Firebase Crashlytics and App Check successfully initialized in MainActivity onCreate.")
                android.util.Log.d("CRASHLYTICS", "Firebase Crashlytics initialized and enabled.")
            } catch (crashEx: Exception) {
                android.util.Log.e("CRASHLYTICS", "Failed to configure Firebase Crashlytics: ${crashEx.message}", crashEx)
            }

            setupFcmAndTopics()
        } catch (e: Exception) {
            android.util.Log.i("FCM_INIT", "Firebase Messaging initialization skipped or deferred gracefully: ${e.message}")
        }
        setContent {
            MyApplicationTheme {
                BackHandler {
                    webView?.let { webViewInstance ->
                        webViewInstance.evaluateJavascript(
                            "javascript:(function() { " +
                            "  if (typeof handleAndroidBack === 'function') { " +
                            "    return handleAndroidBack(); " +
                            "  } " +
                            "  return false; " +
                            "})()"
                        ) { result ->
                            if (result == "false" || result == "null") {
                                finish()
                            }
                        }
                    } ?: run {
                        finish()
                    }
                }
                Scaffold(
                    modifier = Modifier
                        .fillMaxSize()
                        .systemBarsPadding()
                        .imePadding()
                ) { innerPadding ->
                    val padding = innerPadding
                    
                    if (hasLoadFailedState.value && !isAppLoadedState.value) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color(0xFFF8FAFC))
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "⚠️",
                                style = MaterialTheme.typography.displayLarge
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "App Failed to Load",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF0F172A)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "App failed to load — please reinstall or contact support.\nசெயலி திறக்கவில்லை — தயவுசெய்து மீண்டும் தொடங்கவும்.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color(0xFF64748B),
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                            Button(
                                onClick = {
                                    hasLoadFailedState.value = false
                                    isAppLoadedState.value = false
                                    renderCrashCount = 0
                                    isSoftwareRenderingFallback.value = true
                                    webViewRecreateKey.value++
                                    scheduleIntegrityCheck()
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF10B981)
                                )
                            ) {
                                Text("Retry / மீண்டும் முயற்சி செய்")
                            }
                        }
                    } else {
                        key(webViewRecreateKey.value) {
                            AndroidView(
                                modifier = Modifier.fillMaxSize(),
                                factory = { context ->
                                    WebView(context).apply {
                                        this@MainActivity.webView = this
                                        layoutParams = android.view.ViewGroup.LayoutParams(
                                            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                                            android.view.ViewGroup.LayoutParams.MATCH_PARENT
                                        )
                                        
                                        // Disable native scrollbars and overscroll effect to deliver premium app look
                                        isVerticalScrollBarEnabled = false
                                        isHorizontalScrollBarEnabled = false
                                        overScrollMode = android.view.View.OVER_SCROLL_NEVER
                                        isDrawingCacheEnabled = false
                                        setBackgroundColor(android.graphics.Color.parseColor("#0a0a0a"))

                                        // Gracefully fallback to software rendering layer if hardware driver/mesa encounters issues
                                        if (isSoftwareRenderingFallback.value) {
                                            setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null)
                                        } else {
                                            setLayerType(android.view.View.LAYER_TYPE_NONE, null)
                                        }

                                        settings.apply {
                                            javaScriptEnabled = true
                                            domStorageEnabled = true
                                            @Suppress("DEPRECATION")
                                            databaseEnabled = true
                                            setGeolocationEnabled(true)
                                            allowFileAccess = true
                                            allowContentAccess = true
                                            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                                            useWideViewPort = true
                                            loadWithOverviewMode = true
                                            cacheMode = WebSettings.LOAD_NO_CACHE
                                            loadsImagesAutomatically = true
                                            setSupportZoom(false)
                                            builtInZoomControls = false
                                            displayZoomControls = false
                                            defaultTextEncodingName = "UTF-8"
                                            textZoom = 100
                                        }

                                        // Handle native intent actions (tel, whatsapp, intents, maps)
                                        webViewClient = object : WebViewClient() {
                                            override fun onRenderProcessGone(
                                                view: WebView?,
                                                detail: android.webkit.RenderProcessGoneDetail?
                                            ): Boolean {
                                                val didCrash = detail?.didCrash() == true
                                                android.util.Log.e("WebView", "Render process gone. Did crash: $didCrash")
                                                renderCrashCount++
                                                try {
                                                    val container = view?.parent as? android.view.ViewGroup
                                                    container?.removeView(view)
                                                    view?.destroy()
                                                } catch (e: Exception) {
                                                    android.util.Log.e("WebView", "Error cleaning up destroyed webView: ${e.message}")
                                                }
                                                this@MainActivity.webView = null
                                                runOnUiThread {
                                                    if (renderCrashCount <= 2) {
                                                        // Automatically recreate WebView with software rendering to bypass graphics driver / render node failure
                                                        isSoftwareRenderingFallback.value = true
                                                        hasLoadFailedState.value = false
                                                        webViewRecreateKey.value++
                                                        scheduleIntegrityCheck()
                                                    } else {
                                                        if (!isAppLoadedState.value) {
                                                            hasLoadFailedState.value = true
                                                        }
                                                    }
                                                }
                                                return true // Prevent host application termination
                                            }

                                            override fun onPageFinished(view: WebView?, url: String?) {
                                                super.onPageFinished(view, url)
                                                val sharedPrefs = getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)
                                                val token = sharedPrefs.getString("real_fcm_token", "") ?: ""
                                                if (token.isNotEmpty()) {
                                                    view?.evaluateJavascript(
                                                        "javascript:(function() { " +
                                                        "  if (typeof onAndroidFcmTokenReceived === 'function') { " +
                                                        "    onAndroidFcmTokenReceived('$token'); " +
                                                        "  } " +
                                                        "})()", null
                                                    )
                                                }
                                                // Verify DOM readiness immediately
                                                view?.evaluateJavascript(
                                                    "javascript:(function() { return !!(document && document.body && document.body.innerHTML && document.body.innerHTML.length > 50); })()"
                                                ) { result ->
                                                    if (result == "true") {
                                                        onJsAppLoaded()
                                                    } else {
                                                        scheduleIntegrityCheck()
                                                    }
                                                }
                                            }

                                        override fun onReceivedError(
                                            view: WebView?,
                                            request: android.webkit.WebResourceRequest?,
                                            error: android.webkit.WebResourceError?
                                        ) {
                                            super.onReceivedError(view, request, error)
                                            if (request?.isForMainFrame == true) {
                                                android.util.Log.e("INTEGRITY_CHECK", "Main frame error: ${error?.description}")
                                                runOnUiThread {
                                                    if (!isAppLoadedState.value) {
                                                        hasLoadFailedState.value = true
                                                    }
                                                }
                                            }
                                        }

                                        override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                                            if (url == null) return false
                                            if (url.startsWith("file:///")) {
                                                return false
                                            }
                                            
                                            val isSpecialScheme = !url.startsWith("http://") && !url.startsWith("https://")
                                                    || url.contains("google.com/maps")
                                                    || url.contains("maps.google")
                                                    || url.contains("wa.me")
                                                    || url.startsWith("whatsapp:")
                                                    || url.startsWith("tel:")

                                            if (isSpecialScheme) {
                                                try {
                                                    val intent = if (url.startsWith("intent:")) {
                                                        val parsed = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                                                        val fallback = parsed.getStringExtra("browser_fallback_url")
                                                        if (fallback != null && fallback.isNotEmpty()) {
                                                            Intent(Intent.ACTION_VIEW, Uri.parse(fallback))
                                                        } else {
                                                            parsed
                                                        }
                                                    } else {
                                                        Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                                    }
                                                    context.startActivity(intent)
                                                    return true
                                                } catch (e: Exception) {
                                                    e.printStackTrace()
                                                    // Fallback to basic map or external browser link opening
                                                    if (url.contains("google.com/maps") || url.contains("maps.google")) {
                                                        try {
                                                            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                                            context.startActivity(browserIntent)
                                                            return true
                                                        } catch (e2: Exception) {}
                                                    }
                                                    return true // Suppress the crash / bad web view schemes
                                                }
                                            }
                                            return false
                                        }
                                    }

                                    // OnShowFileChooser WebChromeClient override
                                    webChromeClient = object : WebChromeClient() {
                                        override fun onGeolocationPermissionsShowPrompt(
                                            origin: String?,
                                            callback: GeolocationPermissions.Callback?
                                        ) {
                                            val hasFine = androidx.core.content.ContextCompat.checkSelfPermission(
                                                context,
                                                android.Manifest.permission.ACCESS_FINE_LOCATION
                                            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                                            val hasCoarse = androidx.core.content.ContextCompat.checkSelfPermission(
                                                context,
                                                android.Manifest.permission.ACCESS_COARSE_LOCATION
                                            ) == android.content.pm.PackageManager.PERMISSION_GRANTED

                                            if (hasFine || hasCoarse) {
                                                callback?.invoke(origin, true, true)
                                            } else {
                                                pendingGeolocationCallback = callback
                                                pendingGeolocationOrigin = origin
                                                locationPermissionLauncher.launch(
                                                    arrayOf(
                                                        android.Manifest.permission.ACCESS_FINE_LOCATION,
                                                        android.Manifest.permission.ACCESS_COARSE_LOCATION
                                                    )
                                                )
                                            }
                                        }

                                        override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                                            if (consoleMessage != null) {
                                                val logMsg = "[JS Console] ${consoleMessage.message()} (Line: ${consoleMessage.lineNumber()}, Source: ${consoleMessage.sourceId()})"
                                                if (consoleMessage.messageLevel() == android.webkit.ConsoleMessage.MessageLevel.ERROR) {
                                                    android.util.Log.e("WebViewConsole", logMsg)
                                                } else if (consoleMessage.messageLevel() == android.webkit.ConsoleMessage.MessageLevel.WARNING) {
                                                    android.util.Log.w("WebViewConsole", logMsg)
                                                } else {
                                                    android.util.Log.d("WebViewConsole", logMsg)
                                                }
                                            }
                                            return true
                                        }

                                        override fun onShowFileChooser(
                                            webView: WebView?,
                                            filePathCallback: ValueCallback<Array<Uri>>?,
                                            fileChooserParams: FileChooserParams?
                                        ): Boolean {
                                            this@MainActivity.filePathCallback?.onReceiveValue(null)
                                            this@MainActivity.filePathCallback = filePathCallback

                                            try {
                                                val intent = fileChooserParams?.createIntent()
                                                if (intent != null) {
                                                    fileChooserLauncher.launch(intent)
                                                } else {
                                                    val fallbackIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                                                        type = "image/*"
                                                        addCategory(Intent.CATEGORY_OPENABLE)
                                                    }
                                                    fileChooserLauncher.launch(fallbackIntent)
                                                }
                                                return true
                                            } catch (e: Exception) {
                                                try {
                                                    val fallbackIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                                                        type = "image/*"
                                                        addCategory(Intent.CATEGORY_OPENABLE)
                                                    }
                                                    fileChooserLauncher.launch(fallbackIntent)
                                                    return true
                                                } catch (fallbackEx: Exception) {
                                                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                                                    this@MainActivity.filePathCallback = null
                                                    return false
                                                }
                                            }
                                        }
                                    }

                                    isFocusable = true
                                    isFocusableInTouchMode = true
                                    requestFocus()

                                    addJavascriptInterface(WebAppInterface(context), "AndroidStorage")

                                    clearCache(true)
                                    loadUrl("file:///android_asset/index.html")
                                    scheduleIntegrityCheck()
                                }
                            }
                        )
                        }
                    }
                }
            }
        }

        // Ask for Notification and Location permissions immediately on install/launch
        try {
            checkAndRequestStartupPermissions()
        } catch (e: Exception) {
            android.util.Log.e("STARTUP_PERM", "Failed to launch startup permissions: ${e.message}", e)
        }
    }

    fun hasLocationPermission(): Boolean {
        val fine = androidx.core.content.ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val coarse = androidx.core.content.ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    fun hasNotificationPermission(): Boolean {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            return androidx.core.content.ContextCompat.checkSelfPermission(
                this,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
        return true
    }

    private var hasRequestedStartupPermissions = false

    fun checkAndRequestStartupPermissions() {
        if (hasRequestedStartupPermissions) return
        hasRequestedStartupPermissions = true
        try {
            val needsLoc = !hasLocationPermission()
            val needsNotif = !hasNotificationPermission()
            if (needsLoc || needsNotif) {
                val permissionsToRequest = mutableListOf<String>()
                if (needsLoc) {
                    permissionsToRequest.add(android.Manifest.permission.ACCESS_FINE_LOCATION)
                    permissionsToRequest.add(android.Manifest.permission.ACCESS_COARSE_LOCATION)
                }
                if (needsNotif && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    permissionsToRequest.add(android.Manifest.permission.POST_NOTIFICATIONS)
                }
                if (permissionsToRequest.isNotEmpty()) {
                    startupPermissionLauncher.launch(permissionsToRequest.toTypedArray())
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("STARTUP_PERM", "Failed to launch startup permissions: ${e.message}", e)
        }
    }

    override fun onResume() {
        super.onResume()
        currentInstance = this
        webView?.evaluateJavascript("if (typeof window.onAndroidAppResume === 'function') { window.onAndroidAppResume(); }", null)
        isActivityInForeground = true
        checkPendingNotificationPayload()
        webView?.requestFocus()
        if (hasLocationPermission()) {
            startActiveLocationUpdates()
        }
        runOnUiThread {
            webView?.evaluateJavascript(
                "javascript:(function() { " +
                "  if (typeof onAndroidAppResume === 'function') { " +
                "    onAndroidAppResume(); " +
                "  } " +
                "})()", null
            )
        }
    }

    override fun onPause() {
        super.onPause()
        isActivityInForeground = false
        webView?.evaluateJavascript("if (typeof window.onAndroidAppPause === 'function') { window.onAndroidAppPause(); }", null)
        activeLocationListener?.let { listener ->
            try {
                if (isActiveLocationListenerRegistered) {
                    val locationManager = getLocationManager()
                    locationManager?.removeUpdates(listener)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        activeLocationListener = null
        isActiveLocationListenerRegistered = false
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            webView?.requestFocus()
        }
    }

    override fun onDestroy() {
        if (currentInstance == this) {
            currentInstance = null
        }
        webView = null
        activeLocationListener?.let { listener ->
            try {
                if (isActiveLocationListenerRegistered) {
                    val locationManager = getLocationManager()
                    locationManager?.removeUpdates(listener)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        activeLocationListener = null
        isActiveLocationListenerRegistered = false
        super.onDestroy()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntentForFcm(intent)
    }

    fun handleIntentForFcm(intent: Intent?) {
        if (intent == null) return
        val extras = intent.extras ?: return
        try {
            val payloadJsonExtra = extras.getString("payload_json")
            if (!payloadJsonExtra.isNullOrBlank()) {
                handleNotificationPayload(payloadJsonExtra)
                return
            }
            val orderId = extras.getString("orderId") ?: extras.getString("order_id") ?: extras.getString("order_id_fcm") ?: ""
            val type = extras.getString("type") ?: ""
            val screen = extras.getString("screen") ?: ""
            val title = extras.getString("title") ?: ""
            val body = extras.getString("body") ?: ""

            if (orderId.isNotBlank() || type.isNotBlank() || screen.isNotBlank() || title.isNotBlank()) {
                val json = org.json.JSONObject().apply {
                    put("orderId", orderId)
                    put("type", type)
                    put("screen", screen)
                    put("title", title)
                    put("body", body)
                    for (key in extras.keySet()) {
                        val value = extras.get(key)
                        if (value != null) {
                            put(key, value.toString())
                        }
                    }
                }
                handleNotificationPayload(json.toString())
            }
        } catch (e: Exception) {
            android.util.Log.e("FCM_INTENT", "Error handling FCM intent: ${e.message}")
        }
    }

    private fun setupFcmAndTopics() {
        try {
            val gmsAvailability = com.google.android.gms.common.GoogleApiAvailability.getInstance()
            val gmsResult = gmsAvailability.isGooglePlayServicesAvailable(this)
            if (gmsResult != com.google.android.gms.common.ConnectionResult.SUCCESS) {
                android.util.Log.i("FCM_INIT", "Google Play Services not available (code $gmsResult). FCM token fetch deferred gracefully.")
                return
            }

            val sharedPrefs = getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)

            fun subscribeTopicsSafely() {
                val topicsSubscribed = sharedPrefs.getBoolean("fcm_topics_subscribed_v2", false)
                if (!topicsSubscribed) {
                    try {
                        com.google.firebase.messaging.FirebaseMessaging.getInstance().subscribeToTopic("all_customers")
                            .addOnSuccessListener {
                                sharedPrefs.edit().putBoolean("fcm_topics_subscribed_v2", true).apply()
                                android.util.Log.d("FCM_INIT", "Successfully subscribed to all_customers topic.")
                            }
                            .addOnFailureListener { tEx ->
                                android.util.Log.w("FCM_INIT", "Topic all_customers subscription deferred: ${tEx.message}")
                                if (tEx.message?.contains("TOO_MANY_REGISTRATIONS", ignoreCase = true) == true) {
                                    purgeStaleFcmRegistrations(this@MainActivity)
                                }
                            }

                        com.google.firebase.messaging.FirebaseMessaging.getInstance().subscribeToTopic("announcements")
                            .addOnFailureListener { tEx ->
                                android.util.Log.w("FCM_INIT", "Topic announcements subscription deferred: ${tEx.message}")
                                if (tEx.message?.contains("TOO_MANY_REGISTRATIONS", ignoreCase = true) == true) {
                                    purgeStaleFcmRegistrations(this@MainActivity)
                                }
                            }
                    } catch (e: Exception) {
                        android.util.Log.w("FCM_INIT", "Safe topic subscription skipped: ${e.message}")
                    }
                }
            }

            fun fetchToken(retryCount: Int = 0) {
                try {
                    com.google.firebase.messaging.FirebaseMessaging.getInstance().token
                        .addOnCompleteListener { task ->
                            if (task.isSuccessful) {
                                val token = task.result
                                if (!token.isNullOrEmpty()) {
                                    android.util.Log.d("FCM_INIT", "FCM Registration Token: $token")
                                    runOnUiThread {
                                        webView?.evaluateJavascript(
                                            "javascript:(function() { " +
                                            "  if (typeof onAndroidFcmTokenReceived === 'function') { " +
                                            "    onAndroidFcmTokenReceived('$token'); " +
                                            "  } " +
                                            "})()", null
                                        )
                                    }
                                    sharedPrefs.edit()
                                        .putString("fcm_token", token)
                                        .putString("real_fcm_token", token)
                                        .apply()

                                    // Only subscribe to topics when token is valid and active
                                    subscribeTopicsSafely()
                                }
                            } else {
                                val ex = task.exception
                                android.util.Log.w("FCM_INIT", "FCM token registration deferred: ${ex?.message}")
                                if (ex?.message?.contains("TOO_MANY_REGISTRATIONS", ignoreCase = true) == true) {
                                    if (retryCount < 1) {
                                        purgeStaleFcmRegistrations(this@MainActivity) {
                                            fetchToken(retryCount + 1)
                                        }
                                        return@addOnCompleteListener
                                    }
                                }
                                if (sharedPrefs.getString("fcm_token", "").isNullOrEmpty()) {
                                    val fallbackToken = "fcm_fallback_" + java.util.UUID.randomUUID().toString().take(12)
                                    sharedPrefs.edit()
                                        .putString("fcm_token", fallbackToken)
                                        .putString("real_fcm_token", fallbackToken)
                                        .apply()
                                }
                            }
                        }
                } catch (e: Exception) {
                    android.util.Log.w("FCM_INIT", "Error initiating token fetch: ${e.message}")
                }
            }

            fetchToken(0)
        } catch (e: Exception) {
            android.util.Log.i("FCM_INIT", "Firebase Messaging initialization skipped or deferred gracefully: ${e.message}")
        }
    }

    class WebAppInterface(private val context: Context) {
        private val sharedPreferences = context.getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)

        @JavascriptInterface
        fun setOneSignalUser(userId: String) {
            // No-op stub for backwards compatibility
        }

        @JavascriptInterface
        fun logoutOneSignal() {
            // No-op stub for backwards compatibility
        }

        @JavascriptInterface
        fun setOneSignalTag(key: String, value: String) {
            // No-op stub for backwards compatibility
        }

        @JavascriptInterface
        fun setOneSignalAppId(appId: String) {
            // No-op stub for backwards compatibility
        }

        @JavascriptInterface
        fun getOneSignalId(): String {
            return ""
        }

        @JavascriptInterface
        fun getOneSignalSubscriptionId(): String {
            return ""
        }

        @JavascriptInterface
        fun promptOneSignalNotificationPermission() {
            requestNotificationPermission()
        }

        @JavascriptInterface
        fun promptGoogleSignIn(): Boolean {
            val activity = context as? MainActivity ?: return false
            activity.runOnUiThread {
                activity.startGoogleSignInFlow()
            }
            return true
        }

        @JavascriptInterface
        fun notifyAppLoaded() {
            (context as? MainActivity)?.onJsAppLoaded()
        }

        @JavascriptInterface
        fun onJsAppLoaded() {
            (context as? MainActivity)?.onJsAppLoaded()
        }

        @JavascriptInterface
        fun hasLocationPermission(): Boolean {
            val fine = androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            val coarse = androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.ACCESS_COARSE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            return fine || coarse
        }

        @JavascriptInterface
        fun hasNotificationPermission(): Boolean {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                return androidx.core.content.ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            }
            return true
        }

        @JavascriptInterface
        fun requestLocationPermission() {
            (context as? MainActivity)?.runOnUiThread {
                (context as? MainActivity)?.locationPermissionLauncher?.launch(
                    arrayOf(
                        android.Manifest.permission.ACCESS_FINE_LOCATION,
                        android.Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                (context as? MainActivity)?.runOnUiThread {
                    (context as? MainActivity)?.notificationPermissionLauncher?.launch(
                        android.Manifest.permission.POST_NOTIFICATIONS
                    )
                }
            }
        }

        @JavascriptInterface
        fun getAppVersionCode(): Int = BuildConfig.VERSION_CODE

        @JavascriptInterface
        fun getGeminiApiKey(): String {
            // Secure server-side Cloud Function proxy is used for AI requests.
            // Avoid exposing sensitive API keys to WebView / JavaScript environment.
            return ""
        }

        @JavascriptInterface
        fun startUpiPayment(upiUri: String): Boolean {
            val activity = context as? MainActivity ?: return false
            return try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    data = Uri.parse(upiUri)
                }
                activity.runOnUiThread {
                    try {
                        activity.upiPaymentLauncher.launch(intent)
                    } catch (e: android.content.ActivityNotFoundException) {
                        android.widget.Toast.makeText(activity, "யுபிஐ செயலிகள் ஏதும் இல்லை! / No UPI apps installed!", android.widget.Toast.LENGTH_LONG).show()
                        activity.webView?.evaluateJavascript(
                            "javascript:(function() { " +
                            "  if (typeof onAndroidUpiPaymentResult === 'function') { " +
                            "    onAndroidUpiPaymentResult('NO_UPI_APPS'); " +
                            "  } " +
                            "})()", null
                        )
                    } catch (e: Exception) {
                        android.util.Log.e("UPI_PAYMENT", "Error launching UPI intent", e)
                        activity.webView?.evaluateJavascript(
                            "javascript:(function() { " +
                            "  if (typeof onAndroidUpiPaymentResult === 'function') { " +
                            "    onAndroidUpiPaymentResult('LAUNCH_ERROR'); " +
                            "  } " +
                            "})()", null
                        )
                    }
                }
                true
            } catch (e: Exception) {
                android.util.Log.e("UPI_PAYMENT", "Error in startUpiPayment method", e)
                false
            }
        }

        @JavascriptInterface
        fun copyToClipboard(text: String): Boolean {
            val activity = context as? Activity
            if (activity != null && !activity.hasWindowFocus()) {
                android.util.Log.w("WebAppInterface", "Activity does not have window focus. Bypassing native copy to let Web API fallback handle it.")
                return false
            }
            return try {
                var success = false
                val latch = java.util.concurrent.CountDownLatch(1)
                activity?.runOnUiThread {
                    try {
                        if (activity.isFinishing || activity.isDestroyed) {
                            return@runOnUiThread
                        }
                        if (!activity.hasWindowFocus()) {
                            android.util.Log.w("WebAppInterface", "Activity does not have window focus on UI thread. Bypassing native copy.")
                            return@runOnUiThread
                        }
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                        if (clipboard != null) {
                            val clip = android.content.ClipData.newPlainText("Edappadi Kadai", text)
                            clipboard.setPrimaryClip(clip)
                            success = true
                        }
                    } catch (ex: Exception) {
                        android.util.Log.e("WebAppInterface", "Failed to set clip: ${ex.message}")
                    } finally {
                        latch.countDown()
                    }
                } ?: latch.countDown()
                latch.await(1, java.util.concurrent.TimeUnit.SECONDS)
                success
            } catch (e: Exception) {
                android.util.Log.e("WebAppInterface", "Failed to copy to clipboard natively: ${e.message}")
                false
            }
        }

        @JavascriptInterface
        fun minimizeApp() {
            (context as? Activity)?.runOnUiThread {
                (context as? Activity)?.moveTaskToBack(true)
            }
        }

        @JavascriptInterface
        fun exitApp() {
            (context as? Activity)?.runOnUiThread {
                (context as? Activity)?.finish()
            }
        }

        @JavascriptInterface
        fun saveData(key: String, value: String) {
            val encryptedValue = CryptoHelper.encrypt(value)
            sharedPreferences.edit().putString(key, encryptedValue).apply()
        }

        @JavascriptInterface
        fun getData(key: String, defaultValue: String): String {
            val storedValue = sharedPreferences.getString(key, "") ?: ""
            if (storedValue.isEmpty()) {
                return defaultValue
            }
            val decrypted = CryptoHelper.decrypt(context, key, storedValue)
            return if (decrypted.isEmpty()) defaultValue else decrypted
        }

        @JavascriptInterface
        fun getData(key: String): String {
            return getData(key, "")
        }

        @JavascriptInterface
        fun removeData(key: String) {
            sharedPreferences.edit().remove(key).apply()
        }

        @JavascriptInterface
        fun getNativeLocation(): String {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
                ?: return "NO_LOCATION_SERVICE"
            
            val hasFine = androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            val hasCoarse = androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.ACCESS_COARSE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            
            if (!hasFine && !hasCoarse) {
                (context as? MainActivity)?.runOnUiThread {
                    (context as? MainActivity)?.locationPermissionLauncher?.launch(
                        arrayOf(
                            android.Manifest.permission.ACCESS_FINE_LOCATION,
                            android.Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                }
                return "PERMISSION_REQUIRED"
            }
            
            val isGpsEnabled = locationManager.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)
            val isNetworkEnabled = locationManager.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER)
            if (!isGpsEnabled && !isNetworkEnabled) {
                (context as? MainActivity)?.runOnUiThread {
                    android.widget.Toast.makeText(context, "இருப்பிட சேவையை ஆன் செய்யவும் / Please turn on GPS Location!", android.widget.Toast.LENGTH_LONG).show()
                    try {
                        val intent = Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                        context.startActivity(intent)
                    } catch (secErr: Exception) {}
                }
                return "NO_LOCATION_SERVICE"
            }
            
            try {
                (context as? MainActivity)?.runOnUiThread {
                    val mainAct = context as? MainActivity
                    if (mainAct?.activeLocationListener == null) {
                        mainAct?.startActiveLocationUpdates()
                    }
                }

                val mainAct = context as? MainActivity
                var bestLocation: android.location.Location? = mainAct?.latestFiredLocation

                val providers = locationManager.getProviders(true)
                for (provider in providers) {
                    val l = try {
                        locationManager.getLastKnownLocation(provider)
                    } catch (se: SecurityException) {
                        null
                    } catch (e: Exception) {
                        null
                    } ?: continue

                    if (bestLocation == null) {
                        bestLocation = l
                    } else {
                        val timeDiff = l.time - bestLocation.time
                        val isSignificantlyNewer = timeDiff > 15000
                        val isNewer = timeDiff > 0
                        val isMoreAccurate = l.accuracy < bestLocation.accuracy
                        if (isSignificantlyNewer || (isNewer && isMoreAccurate)) {
                            bestLocation = l
                        }
                    }
                }
                
                // Deep fallback support: check even disabled providers for passive cached coordinates
                if (bestLocation == null) {
                    val allProviders = locationManager.getProviders(false)
                    for (provider in allProviders) {
                        val l = try {
                            locationManager.getLastKnownLocation(provider)
                        } catch (se: SecurityException) {
                            null
                        } catch (e: Exception) {
                            null
                        } ?: continue

                        if (bestLocation == null || l.accuracy < bestLocation.accuracy) {
                            bestLocation = l
                        }
                    }
                }

                bestLocation?.let {
                    val json = org.json.JSONObject().apply {
                        put("latitude", it.latitude)
                        put("longitude", it.longitude)
                        put("accuracy", it.accuracy.toDouble())
                    }
                    return json.toString()
                }
            } catch (e: SecurityException) {
                return "SECURITY_ERROR"
            } catch (e: Exception) {
                return "ERROR:" + e.message
            }
            return "NO_LOCATION"
        }

        @JavascriptInterface
        fun nativeReverseGeocode(lat: Double, lng: Double): String {
            return try {
                if (!android.location.Geocoder.isPresent()) {
                    return ""
                }
                val geocoder = android.location.Geocoder(context, java.util.Locale.getDefault())
                @Suppress("DEPRECATION")
                val addresses = geocoder.getFromLocation(lat, lng, 1)
                if (!addresses.isNullOrEmpty()) {
                    val addr = addresses[0]
                    val sb = StringBuilder()
                    for (i in 0..addr.maxAddressLineIndex) {
                        if (i > 0) sb.append(", ")
                        sb.append(addr.getAddressLine(i))
                    }
                    val fullAddress = sb.toString().ifEmpty {
                        listOfNotNull(addr.featureName, addr.thoroughfare, addr.subLocality, addr.locality, addr.adminArea, addr.postalCode)
                            .filter { it.isNotBlank() }
                            .joinToString(", ")
                    }
                    val json = org.json.JSONObject().apply {
                        put("displayName", fullAddress)
                        put("street", addr.thoroughfare ?: "")
                        put("area", addr.subLocality ?: addr.locality ?: "")
                        put("city", addr.locality ?: addr.subAdminArea ?: "")
                        put("postalCode", addr.postalCode ?: "")
                        put("lat", lat)
                        put("lng", lng)
                        put("latitude", lat)
                        put("longitude", lng)
                    }
                    json.toString()
                } else {
                    ""
                }
            } catch (e: Exception) {
                android.util.Log.w("GEOCODER", "Native reverse geocoding failed: ${e.message}")
                ""
            }
        }

        @JavascriptInterface
        fun nativeForwardGeocode(addressQuery: String): String {
            return try {
                if (!android.location.Geocoder.isPresent() || addressQuery.isBlank()) {
                    return ""
                }
                val geocoder = android.location.Geocoder(context, java.util.Locale.getDefault())
                @Suppress("DEPRECATION")
                val addresses = geocoder.getFromLocationName(addressQuery, 5)
                if (!addresses.isNullOrEmpty()) {
                    val arr = org.json.JSONArray()
                    for (addr in addresses) {
                        val sb = StringBuilder()
                        for (i in 0..addr.maxAddressLineIndex) {
                            if (i > 0) sb.append(", ")
                            sb.append(addr.getAddressLine(i))
                        }
                        val fullAddress = sb.toString().ifEmpty {
                            listOfNotNull(addr.featureName, addr.thoroughfare, addr.subLocality, addr.locality, addr.adminArea, addr.postalCode)
                                .filter { it.isNotBlank() }
                                .joinToString(", ")
                        }
                        val item = org.json.JSONObject().apply {
                            put("displayName", fullAddress)
                            put("lat", addr.latitude)
                            put("lng", addr.longitude)
                            put("latitude", addr.latitude)
                            put("longitude", addr.longitude)
                        }
                        arr.put(item)
                    }
                    arr.toString()
                } else {
                    ""
                }
            } catch (e: Exception) {
                android.util.Log.w("GEOCODER", "Native forward geocoding failed: ${e.message}")
                ""
            }
        }

        @JavascriptInterface
        fun printHtml(htmlContent: String, jobName: String) {
            (context as? Activity)?.runOnUiThread {
                try {
                    val printWebView = WebView(context)
                    printWebView.apply {
                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            defaultTextEncodingName = "UTF-8"
                        }
                    }
                    printWebView.webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            try {
                                val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager
                                val printAdapter = printWebView.createPrintDocumentAdapter(jobName)
                                val receiptMediaSize = PrintAttributes.MediaSize("EK_RECEIPT_80MM", "Receipt 80mm", 3150, 15000)
                                val attrs = PrintAttributes.Builder()
                                    .setMediaSize(receiptMediaSize)
                                    .setResolution(PrintAttributes.Resolution("EK_RES", "default", 300, 300))
                                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                    .build()
                                printManager?.print(jobName, printAdapter, attrs)
                            } catch (e: Exception) {
                                Toast.makeText(context, "Print error: ${e.message}", Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                    printWebView.loadDataWithBaseURL("file:///android_asset/", htmlContent, "text/html", "utf-8", null)
                } catch (e: Exception) {
                    Toast.makeText(context, "Initial print error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun shareText(title: String, text: String) {
            try {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, title)
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                context.startActivity(Intent.createChooser(intent, title))
            } catch (e: Exception) {
                // Ignore
            }
        }

        @JavascriptInterface
        fun getFcmToken(): String {
            // ★ MyFirebaseMessagingService.onNewToken() மூலம் சேமிக்கப்பட்ட
            //   உண்மையான FCM token-ஐ return செய் ★
            val realToken = sharedPreferences.getString("real_fcm_token", "")
            if (!realToken.isNullOrEmpty()) {
                return realToken
            }

            // Check if FirebaseApp is initialized to avoid E/FCM error logs
            val isFirebaseInitialized = try {
                com.google.firebase.FirebaseApp.getInstance()
                true
            } catch (e: IllegalStateException) {
                false
            }

            if (!isFirebaseInitialized) {
                // Return a graceful simulated fallback token so that local/simulated runs function without errors
                val fallbackToken = "simulated_fcm_token_" + java.util.UUID.randomUUID().toString().take(8)
                sharedPreferences.edit()
                    .putString("real_fcm_token", fallbackToken)
                    .putString("fcm_token", fallbackToken)
                    .apply()
                android.util.Log.i("FCM", "Firebase not initialized. Provided graceful simulated fallback token: $fallbackToken")
                return fallbackToken
            }

            // Check cached token first
            val cachedToken = sharedPreferences.getString("fcm_token", "")
            if (!cachedToken.isNullOrEmpty()) {
                return cachedToken
            }

            try {
                val gmsAvailability = com.google.android.gms.common.GoogleApiAvailability.getInstance()
                val gmsResult = gmsAvailability.isGooglePlayServicesAvailable(context)
                if (gmsResult == com.google.android.gms.common.ConnectionResult.SUCCESS) {
                    com.google.firebase.messaging.FirebaseMessaging.getInstance().token
                        .addOnSuccessListener { token ->
                            if (!token.isNullOrEmpty()) {
                                sharedPreferences.edit()
                                    .putString("real_fcm_token", token)
                                    .putString("fcm_token", token)
                                    .apply()
                            }
                        }
                        .addOnFailureListener { e ->
                            android.util.Log.d("FCM", "Async token fetch status: ${e.message}")
                            if (e.message?.contains("TOO_MANY_REGISTRATIONS", ignoreCase = true) == true) {
                                purgeStaleFcmRegistrations(context)
                            }
                        }
                }
            } catch (e: Exception) {
                android.util.Log.d("FCM", "FirebaseMessaging token fetch skipped: ${e.message}")
            }
            return ""
        }

        @JavascriptInterface
        fun simulateFcmPushNotification(token: String, title: String, body: String, dataPayloadJson: String) {
            android.util.Log.d("FCM_SIMULATOR", "Received FCM simulate request. Token: $token, Title: $title, Body: $body, Data: $dataPayloadJson")
            if (isActivityInForeground) {
                android.util.Log.d("FCM_SIMULATOR", "Suppressing native notification since app is in the foreground.")
                return
            }
            
            // Replicate exactly what MyFirebaseMessagingService does when receiving an FCM message
            try {
                val intent = Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    // Pass parameters if needed in the future
                    putExtra("order_id_fcm", "sim_payload")
                }
                
                val pendingIntentFlags = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_ONE_SHOT
                }

                val pendingIntent = PendingIntent.getActivity(
                    context, 0, intent, pendingIntentFlags
                )

                val channelId = "status_alerts"
                val channelName = "Order Status Notifications"
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    val channel = NotificationChannel(
                        channelId,
                        channelName,
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Real-time updates regarding your ongoing delivery and orders"
                        enableLights(true)
                        enableVibration(true)
                    }
                    notificationManager.createNotificationChannel(channel)
                }

                val largeIcon = getAppIconBitmap(context)

                val notificationBuilder = NotificationCompat.Builder(context, channelId)
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setContentIntent(pendingIntent)

                if (largeIcon != null) {
                    notificationBuilder.setLargeIcon(largeIcon)
                }

                notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun showNativeNotification(title: String, body: String) {
            try {
                val intent = Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                
                val pendingIntentFlags = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_ONE_SHOT
                }

                val pendingIntent = PendingIntent.getActivity(
                    context, 0, intent, pendingIntentFlags
                )

                val channelId = "status_alerts"
                val channelName = "Order Status Notifications"
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    val channel = NotificationChannel(
                        channelId,
                        channelName,
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Real-time updates regarding your ongoing delivery and orders"
                        enableLights(true)
                        enableVibration(true)
                    }
                    notificationManager.createNotificationChannel(channel)
                }

                val largeIcon = getAppIconBitmap(context)

                val notificationBuilder = NotificationCompat.Builder(context, channelId)
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setContentIntent(pendingIntent)

                if (largeIcon != null) {
                    notificationBuilder.setLargeIcon(largeIcon)
                }

                notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        private fun getAppIconBitmap(context: Context): android.graphics.Bitmap? {
            return try {
                val drawable = androidx.core.content.ContextCompat.getDrawable(context, R.mipmap.ic_launcher)
                if (drawable != null) {
                    val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 192
                    val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 192
                    val bitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
                    val canvas = android.graphics.Canvas(bitmap)
                    drawable.setBounds(0, 0, width, height)
                    drawable.draw(canvas)
                    bitmap
                } else {
                    null
                }
            } catch (e: Exception) {
                null
            }
        }
    }
}

