package com.aistudio.edappadikadai.epdfdk

import android.app.Activity
import android.app.PendingIntent
import android.app.NotificationManager
import android.app.NotificationChannel
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
import com.aistudio.edappadikadai.epdfdk.ui.theme.MyApplicationTheme

@SuppressLint("InvalidFragmentVersionForActivityResult")
class MainActivity : ComponentActivity() {

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var webView: WebView? = null
    private var pendingGeolocationCallback: GeolocationPermissions.Callback? = null
    private var pendingGeolocationOrigin: String? = null

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

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[android.Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseGranted = permissions[android.Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        if (fineGranted || coarseGranted) {
            pendingGeolocationCallback?.let { callback ->
                callback.invoke(pendingGeolocationOrigin, true, true)
            }
            webView?.reload()
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
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    android.util.Log.d("FCM_INIT", "FCM Registration Token: $token")
                    val sharedPrefs = getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)
                    sharedPrefs.edit().putString("fcm_token", token).apply()
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
                                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                                    useWideViewPort = true
                                    loadWithOverviewMode = true
                                    cacheMode = WebSettings.LOAD_DEFAULT
                                    loadsImagesAutomatically = true
                                    setSupportZoom(false)
                                    builtInZoomControls = false
                                    displayZoomControls = false
                                    offscreenPreRaster = true
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
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            webView?.requestFocus()
        }
    }

    override fun onDestroy() {
        webView = null
        super.onDestroy()
    }

    class WebAppInterface(private val context: Context) {
        private val sharedPreferences = context.getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)

        @JavascriptInterface
        fun getGeminiApiKey(): String {
            return try {
                com.aistudio.edappadikadai.epdfdk.BuildConfig.GEMINI_API_KEY
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
            val token = sharedPreferences.getString("fcm_token", "")
            if (!token.isNullOrEmpty()) {
                return token
            }
            // Generate a persistent, realistic simulator token prefix for this device if FCM isn't fully registered 
            // to fulfill push simulation in development environments seamlessly
            val generated = "fcm_sim_" + java.util.UUID.randomUUID().toString().substring(0, 8)
            sharedPreferences.edit().putString("fcm_token", generated).apply()
            return generated
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

                val notificationBuilder = NotificationCompat.Builder(context, channelId)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setContentIntent(pendingIntent)

                notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}

