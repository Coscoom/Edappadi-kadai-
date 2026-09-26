package com.edappadikadai.app

import android.app.Application
import android.content.Context
import android.system.Os
import java.io.File

class EdappadiApplication : Application() {

    companion object {
        init {
            configureMesaEnvironment()
        }

        var pendingNotificationPayload: String? = null

        fun configureMesaEnvironment() {
            try {
                Os.setenv("MESA_LOG_FILE", "/dev/null", true)
                Os.setenv("GALLIUM_LOG_FILE", "/dev/null", true)
                Os.setenv("MESA_LOG_LEVEL", "none", true)
                Os.setenv("MESA_DEBUG", "silent", true)
                Os.setenv("LIBGL_DEBUG", "quiet", true)
                Os.setenv("MESA_SILENT", "1", true)
                Os.setenv("EGL_LOG_LEVEL", "fatal", true)
                Os.setenv("LIBGL_ALWAYS_SOFTWARE", "1", true)
                Os.setenv("LIBGL_DRI3_DISABLE", "1", true)
                Os.setenv("LIBGL_DRI2_DISABLE", "1", true)
                Os.setenv("DRI_NO_DRIVER_CHECK", "1", true)
                Os.setenv("MESA_NO_ERROR", "1", true)
                Os.setenv("GALLIUM_DRIVER", "llvmpipe", true)
                Os.setenv("MESA_LOADER_DRIVER_OVERRIDE", "swrast", true)
                Os.setenv("DRI_PRIME", "0", true)
            } catch (e: Throwable) {
                // ignore
            }
        }

        fun ensureWebViewCacheDirectories(context: Context) {
            try {
                val cache = context.cacheDir ?: return
                val hierarchy = listOf(
                    cache,
                    File(cache, "WebView"),
                    File(cache, "WebView/Default"),
                    File(cache, "WebView/Default/HTTP Cache"),
                    File(cache, "WebView/Default/HTTP Cache/Code Cache"),
                    File(cache, "WebView/Default/HTTP Cache/Code Cache/js"),
                    File(cache, "WebView/Default/HTTP Cache/Code Cache/wasm")
                )
                for (dir in hierarchy) {
                    if (dir.exists() && !dir.isDirectory) {
                        dir.delete()
                    }
                    if (!dir.exists()) {
                        dir.mkdirs()
                    }
                    try {
                        dir.setReadable(true, false)
                        dir.setWritable(true, false)
                        dir.setExecutable(true, false)
                        Os.chmod(dir.absolutePath, 511) // 0777 octal
                    } catch (ignored: Throwable) {}
                }
            } catch (e: Throwable) {
                // ignore
            }
        }
    }

    override fun attachBaseContext(base: Context?) {
        super.attachBaseContext(base)
        configureMesaEnvironment()
    }

    override fun onCreate() {
        super.onCreate()
        configureMesaEnvironment()
        ensureWebViewCacheDirectories(this)
    }
}


