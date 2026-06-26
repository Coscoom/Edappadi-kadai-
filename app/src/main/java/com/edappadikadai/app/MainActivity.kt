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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.edappadikadai.app.ui.theme.MyApplicationTheme

@SuppressLint("InvalidFragmentVersionForActivityResult")
class MainActivity : ComponentActivity() {

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var webView: WebView? = null
    private var pendingGeolocationCallback: GeolocationPermissions.Callback? = null
    private var pendingGeolocationOrigin: String? = null
    private var activeLocationListener: android.location.LocationListener? = null
    var latestFiredLocation: android.location.Location? = null

    fun startActiveLocationUpdates() {
        val locationManager = getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager ?: return
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
                    locationManager.removeUpdates(oldListener)
                } catch (e: Exception) {}
            }

            val listener = object : android.location.LocationListener {
                override fun onLocationChanged(location: android.location.Location) {
                    latestFiredLocation = location
                    android.util.Log.d("GPS_ACTIVE", "Active Location updated: ${location.latitude}, ${location.longitude}, Acc: ${location.accuracy}")
                }
                override fun onStatusChanged(p: String?, s: Int, e: Bundle?) {}
                override fun onProviderEnabled(p: String) {}
                override fun onProviderDisabled(p: String) {}
            }
            activeLocationListener = listener

            val isGpsEnabled = locationManager.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)
            val isNetworkEnabled = locationManager.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER)
            
            // Prioritize GPS_PROVIDER. Avoid subscribing the same listener instance to multiple providers 
            // concurrently, which is a known source of duplicate AppOps tracking mismatch.
            if (isGpsEnabled) {
                locationManager.requestLocationUpdates(
                    android.location.LocationManager.GPS_PROVIDER,
                    5000L,
                    10f,
                    listener
                )
            } else if (isNetworkEnabled) {
                locationManager.requestLocationUpdates(
                    android.location.LocationManager.NETWORK_PROVIDER,
                    5000L,
                    10f,
                    listener
                )
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
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
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
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Fetch and register Firebase Cloud Messaging (FCM) Token gracefully
        try {
            com.google.firebase.FirebaseApp.initializeApp(this)
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    android.util.Log.d("FCM_INIT", "FCM Registration Token: $token")
                    val sharedPrefs = getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)
                    sharedPrefs.edit()
                        .putString("fcm_token", token)
                        .putString("real_fcm_token", token)
                        .apply()
                } else {
                    android.util.Log.w("FCM_INIT", "FCM token registration deferred: running in simulated mode", task.exception)
                }
            }
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
                    val padding = innerPadding // suppress unused variable warning if any
                    
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { context ->
                            WebView(context).apply {
                                this@MainActivity.webView = this
                                setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
                                layoutParams = android.view.ViewGroup.LayoutParams(
                                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                                    android.view.ViewGroup.LayoutParams.MATCH_PARENT
                                )
                                
                                // Disable native scrollbars and overscroll effect to deliver premium app look
                                isVerticalScrollBarEnabled = false
                                isHorizontalScrollBarEnabled = false
                                overScrollMode = android.view.View.OVER_SCROLL_NEVER
                                
                                // Clean WebView settings for Local PWA support
                                settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    databaseEnabled = true
                                    setGeolocationEnabled(true)
                                    allowFileAccess = true
                                    allowContentAccess = true
                                    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                                    useWideViewPort = true
                                    loadWithOverviewMode = true
                                    cacheMode = WebSettings.LOAD_DEFAULT
                                    loadsImagesAutomatically = true
                                    setSupportZoom(false)
                                    builtInZoomControls = false
                                    displayZoomControls = false
                                    offscreenPreRaster = true
                                    @Suppress("DEPRECATION")
                                    setRenderPriority(WebSettings.RenderPriority.HIGH)
                                }

                                // Handle native intent actions (tel, whatsapp, intents, maps)
                                webViewClient = object : WebViewClient() {
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
                                            this@MainActivity.filePathCallback?.onReceiveValue(null)
                                            this@MainActivity.filePathCallback = null
                                            return false
                                        }
                                    }
                                }

                                isFocusable = true
                                isFocusableInTouchMode = true
                                requestFocus()

                                addJavascriptInterface(WebAppInterface(context), "AndroidStorage")

                                loadUrl("file:///android_asset/index.html")
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        webView?.requestFocus()
        startActiveLocationUpdates()
    }

    override fun onPause() {
        super.onPause()
        activeLocationListener?.let { listener ->
            try {
                val locationManager = getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
                locationManager?.removeUpdates(listener)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        activeLocationListener = null
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            webView?.requestFocus()
        }
    }

    override fun onDestroy() {
        webView = null
        activeLocationListener?.let { listener ->
            try {
                val locationManager = getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
                locationManager?.removeUpdates(listener)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        activeLocationListener = null
        super.onDestroy()
    }

    class WebAppInterface(private val context: Context) {
        private val sharedPreferences = context.getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)

        @JavascriptInterface
        fun getAppVersionCode(): Int = BuildConfig.VERSION_CODE

        @JavascriptInterface
        fun getGeminiApiKey(): String {
            return try {
                com.edappadikadai.app.BuildConfig.GEMINI_API_KEY
            } catch (e: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun saveData(key: String, value: String) {
            sharedPreferences.edit().putString(key, value).apply()
        }

        @JavascriptInterface
        fun getData(key: String, defaultValue: String): String {
            return sharedPreferences.getString(key, defaultValue) ?: defaultValue
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
                    val l = locationManager.getLastKnownLocation(provider) ?: continue
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
                        val l = locationManager.getLastKnownLocation(provider) ?: continue
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
                                printManager?.print(jobName, printAdapter, PrintAttributes.Builder().build())
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

            // Token இன்னும் fetch ஆகவில்லை எனில், synchronous-ஆக fetch முயற்சி செய்:
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> if (!token.isNullOrEmpty()) { sharedPreferences.edit().putString("real_fcm_token", token).putString("fcm_token", token).apply() } }.addOnFailureListener { e -> android.util.Log.e("FCM", "Async token fetch failed: ${e.message}") }; return ""
        }

        @JavascriptInterface
        fun simulateFcmPushNotification(token: String, title: String, body: String, dataPayloadJson: String) {
            android.util.Log.d("FCM_SIMULATOR", "Received FCM simulate request. Token: $token, Title: $title, Body: $body, Data: $dataPayloadJson")
            
            // Replicate exactly what MyFirebaseMessagingService does when receiving an FCM message
            try {
                val intent = Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
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

                val largeIcon = try {
                    BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)
                } catch (e: Exception) {
                    null
                }

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
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
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

                val largeIcon = try {
                    BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)
                } catch (e: Exception) {
                    null
                }

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
    }
}

