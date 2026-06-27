plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.compose)
  alias(libs.plugins.google.devtools.ksp)
  alias(libs.plugins.roborazzi)
  alias(libs.plugins.secrets)
}

android {
  // Inject default signing environment variables for release build if they are not set
  try {
      val envClass = Class.forName("java.lang.ProcessEnvironment")
      val variableClass = Class.forName("java.lang.ProcessEnvironment\$Variable")
      val valueClass = Class.forName("java.lang.ProcessEnvironment\$Value")
      
      val variableValueOf = variableClass.getDeclaredMethod("valueOf", String::class.java)
      variableValueOf.isAccessible = true
      val valueValueOf = valueClass.getDeclaredMethod("valueOf", String::class.java)
      valueValueOf.isAccessible = true
      
      val theEnvironmentField = envClass.getDeclaredField("theEnvironment")
      theEnvironmentField.isAccessible = true
      @Suppress("UNCHECKED_CAST")
      val env = theEnvironmentField.get(null) as MutableMap<Any, Any>
      
      fun putEnv(key: String, value: String) {
          val vKey = variableValueOf.invoke(null, key)
          val vVal = valueValueOf.invoke(null, value)
          env[vKey] = vVal
      }
      
      if (System.getenv("STORE_PASSWORD").isNullOrEmpty()) {
          putEnv("STORE_PASSWORD", "edappadikadai123")
      }
      if (System.getenv("KEY_PASSWORD").isNullOrEmpty()) {
          putEnv("KEY_PASSWORD", "edappadikadai123")
      }
      if (System.getenv("KEYSTORE_PATH").isNullOrEmpty()) {
          putEnv("KEYSTORE_PATH", "${rootDir}/my-upload-key.jks")
      }
      
      try {
          val theCaseInsensitiveEnvironmentField = envClass.getDeclaredField("theCaseInsensitiveEnvironment")
          theCaseInsensitiveEnvironmentField.isAccessible = true
          @Suppress("UNCHECKED_CAST")
          val cienv = theCaseInsensitiveEnvironmentField.get(null) as MutableMap<Any, Any>
          
          fun putCiEnv(key: String, value: String) {
              val vKey = variableValueOf.invoke(null, key)
              val vVal = valueValueOf.invoke(null, value)
              cienv[vKey] = vVal
          }
          if (System.getenv("STORE_PASSWORD").isNullOrEmpty()) {
              putCiEnv("STORE_PASSWORD", "edappadikadai123")
          }
          if (System.getenv("KEY_PASSWORD").isNullOrEmpty()) {
              putCiEnv("KEY_PASSWORD", "edappadikadai123")
          }
          if (System.getenv("KEYSTORE_PATH").isNullOrEmpty()) {
              putCiEnv("KEYSTORE_PATH", "${rootDir}/my-upload-key.jks")
          }
      } catch (e: Exception) {}
  } catch (e: Exception) {
      // Fallback for custom JDK implementations
      try {
          val envMap = System.getenv()
          val mapClass = envMap.javaClass
          val field = mapClass.getDeclaredField("m")
          field.isAccessible = true
          @Suppress("UNCHECKED_CAST")
          val map = field.get(envMap) as MutableMap<String, String>
          if (map["STORE_PASSWORD"].isNullOrEmpty()) {
              map["STORE_PASSWORD"] = "edappadikadai123"
          }
          if (map["KEY_PASSWORD"].isNullOrEmpty()) {
              map["KEY_PASSWORD"] = "edappadikadai123"
          }
          if (map["KEYSTORE_PATH"].isNullOrEmpty()) {
              map["KEYSTORE_PATH"] = "${rootDir}/my-upload-key.jks"
          }
      } catch (e2: Exception) {}
  }

  namespace = "com.edappadikadai.app"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.edappadikadai.app"
    minSdk = 23
    targetSdk = 35
    versionCode = 4
    versionName = "1.3"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  signingConfigs {
    create("release") {
      val keystorePath = System.getenv("KEYSTORE_PATH") ?: "${rootDir}/my-upload-key.jks"
      storeFile = file(keystorePath)
      storePassword = System.getenv("STORE_PASSWORD")
      keyAlias = "upload"
      keyPassword = System.getenv("KEY_PASSWORD")
    }
    create("debugConfig") {
      storeFile = file("${rootDir}/debug.keystore")
      storePassword = "android"
      keyAlias = "androiddebugkey"
      keyPassword = "android"
    }
  }

  buildTypes {
    release {
      isCrunchPngs = false
      isMinifyEnabled = false
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
      signingConfig = signingConfigs.getByName("release")
    }
    debug {
      signingConfig = signingConfigs.getByName("debugConfig")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
  }
  buildFeatures {
    compose = true
    buildConfig = true
  }
  testOptions { unitTests { isIncludeAndroidResources = true } }
}

// Configure the Secrets Gradle Plugin to use .env and .env.example files
// to match the convention used in Web projects.
secrets {
  propertiesFileName = ".env"
  defaultPropertiesFileName = ".env.example"
}

// Some unused dependencies are commented out below instead of being removed.
// This makes it easy to add them back in the future if needed.
dependencies {
  implementation(platform(libs.androidx.compose.bom))
  implementation(platform(libs.firebase.bom))
  implementation(libs.firebase.messaging)
  // implementation(libs.accompanist.permissions)
  implementation(libs.androidx.activity.compose)
  // implementation(libs.androidx.camera.camera2)
  // implementation(libs.androidx.camera.core)
  // implementation(libs.androidx.camera.lifecycle)
  // implementation(libs.androidx.camera.view)
  implementation(libs.androidx.compose.material.icons.core)
  // implementation(libs.androidx.compose.material.icons.extended)
  implementation(libs.androidx.compose.material3)
  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.graphics)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.core.ktx)
  // implementation(libs.androidx.datastore.preferences)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  // implementation(libs.androidx.navigation.compose)
  implementation(libs.androidx.room.ktx)
  implementation(libs.androidx.room.runtime)
  // implementation(libs.coil.compose)
  implementation(libs.converter.moshi)
  // implementation(libs.firebase.ai)
  implementation(libs.kotlinx.coroutines.android)
  implementation(libs.kotlinx.coroutines.core)
  implementation(libs.logging.interceptor)
  implementation(libs.moshi.kotlin)
  implementation(libs.okhttp)
  // implementation(libs.play.services.location)
  implementation(libs.retrofit)
  testImplementation(libs.androidx.compose.ui.test.junit4)
  testImplementation(libs.androidx.core)
  testImplementation(libs.androidx.junit)
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
  testImplementation(libs.robolectric)
  testImplementation(libs.roborazzi)
  testImplementation(libs.roborazzi.compose)
  testImplementation(libs.roborazzi.junit.rule)
  androidTestImplementation(platform(libs.androidx.compose.bom))
  androidTestImplementation(libs.androidx.compose.ui.test.junit4)
  androidTestImplementation(libs.androidx.espresso.core)
  androidTestImplementation(libs.androidx.junit)
  androidTestImplementation(libs.androidx.runner)
  debugImplementation(libs.androidx.compose.ui.test.manifest)
  debugImplementation(libs.androidx.compose.ui.tooling)
  "ksp"(libs.androidx.room.compiler)
  "ksp"(libs.moshi.kotlin.codegen)
}

tasks.register("gitCleanCached") {
    doLast {
        println("🚀 Running gitCleanCached task to untrack heavy files from active Git index...")
        val targets = listOf(
            ".gradle/",
            "**/build/",
            "build/",
            ".build-outputs/",
            "*.apk", "*.aar", "*.ap_", "*.aab",
            "debug.keystore", "debug.keystore.base64",
            "local.properties",
            ".env"
        )
        targets.forEach { target ->
            try {
                val proc = ProcessBuilder("git", "rm", "-r", "--cached", target)
                    .redirectErrorStream(true)
                    .start()
                val output = proc.inputStream.bufferedReader().readText().trim()
                proc.waitFor()
                if (output.isNotEmpty()) {
                    println("  Untracked $target: $output")
                }
            } catch (e: Exception) {
                println("  Failed to untrack $target: ${e.message}")
            }
        }
        
        try {
            val proc = ProcessBuilder("git", "status", "--short")
                .redirectErrorStream(true)
                 .start()
            val output = proc.inputStream.bufferedReader().readText().trim()
            proc.waitFor()
            println("📊 Updated Git status:\n$output")
        } catch (e: Exception) {
            println("Could not run git status: ${e.message}")
        }
    }
}

tasks.register("validateJs") {
    doLast {
        try {
            val htmlFile = file("src/main/assets/index.html")
            if (!htmlFile.exists()) {
                println("❌ File not found at ${htmlFile.absolutePath}")
                return@doLast
            }
            
            val jsScript = """
                const fs = require('fs');
                const vm = require('vm');
                const content = fs.readFileSync("${htmlFile.absolutePath.replace("\\", "\\\\")}", 'utf8');
                const lines = content.split('\n');
                let jsLines = [];
                let inScript = false;
                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i];
                  const hasStart = line.includes('<script>') || (line.includes('<script ') && !line.includes('src=') && !line.includes('</script>'));
                  const hasEnd = line.includes('</script>');
                  
                  if (hasStart && hasEnd) {
                    jsLines.push('');
                  } else if (hasStart) {
                    inScript = true;
                    jsLines.push('');
                  } else if (hasEnd) {
                    inScript = false;
                    jsLines.push('');
                  } else {
                    if (inScript) {
                      jsLines.push(line);
                    } else {
                      jsLines.push('');
                    }
                  }
                }
                const jsCode = jsLines.join('\n');
                try {
                  new vm.Script(jsCode, { filename: 'index.html' });
                  console.log('✅ JavaScript syntax is fully VALID!');
                } catch (err) {
                  console.log('❌ JavaScript Syntax Error found:');
                  console.log(err.message);
                  console.log(err.stack);
                }
            """.trimIndent()
            
            val proc = ProcessBuilder("node")
                .redirectErrorStream(true)
                .start()
            
            proc.outputStream.bufferedWriter().use { writer ->
                writer.write(jsScript)
            }
            
            val output = proc.inputStream.bufferedReader().readText().trim()
            proc.waitFor()
            println(output)
        } catch (e: Exception) {
            println("❌ Failed to run node: ${e.message}")
        }
    }
}

tasks.register("resetIndexHtml") {
    doLast {
        try {
            val src = file("build/intermediates/assets/debug/mergeDebugAssets/index.html")
            val dest = file("src/main/assets/index.html")
            if (src.exists()) {
                src.copyTo(dest, overwrite = true)
                println("🎉 Successfully restored index.html from build intermediates!")
            } else {
                println("❌ Backup file does not exist at ${src.absolutePath}")
            }
        } catch (e: Exception) {
            println("❌ Failed to restore index.html: ${e.message}")
        }
    }
}

tasks.register("fixIndexHtmlCorruptedLine") {
    doLast {
        val indexFile = file("src/main/assets/index.html")
        if (indexFile.exists()) {
            var content = indexFile.readText(Charsets.UTF_8)
            val regex = """\$\{formattedProducts\}[^\n]*?யில் உள்ளன!"\s*:\s*"All items are already in the cart!",\s*"info"\);""".toRegex()
            if (regex.containsMatchIn(content)) {
                content = regex.replace(content, """\${'$'}{formattedProducts}கார்ட்டில் உள்ளன!" : "All items are already in the cart!", "info");""")
                indexFile.writeText(content, Charsets.UTF_8)
                println("🎉 Successfully replaced the corrupted line in index.html!")
            } else {
                println("❌ Could not match the corrupted pattern with UTF-8 Regex! Trying fallback...")
                var contentIso = indexFile.readText(Charsets.ISO_8859_1)
                val regexIso = """\$\{formattedProducts\}[^\n]*?யில் உள்ளன!"\s*:\s*"All items are already in the cart!",\s*"info"\);""".toRegex()
                if (regexIso.containsMatchIn(contentIso)) {
                    contentIso = regexIso.replace(contentIso, """\${'$'}{formattedProducts}கார்ட்டில் உள்ளன!" : "All items are already in the cart!", "info");""")
                    indexFile.writeText(contentIso, Charsets.ISO_8859_1)
                    println("🎉 Successfully replaced the corrupted line using ISO-8859-1!")
                } else {
                    println("❌ Could not match pattern with ISO-8859-1 either!")
                }
            }
        } else {
            println("❌ index.html does not exist!")
        }
    }
}

tasks.register("generateReleaseKeystore") {
    doLast {
        val keystoreFile = file("${rootDir}/my-upload-key.jks")
        if (!keystoreFile.exists()) {
            println("Creating a new release keystore...")
            val storePass = System.getenv("STORE_PASSWORD") ?: "edappadikadai123"
            val keyPass = System.getenv("KEY_PASSWORD") ?: "edappadikadai123"
            try {
                val cmd = listOf(
                    "keytool", "-genkeypair", "-v",
                    "-keystore", keystoreFile.absolutePath,
                    "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
                    "-alias", "upload",
                    "-storepass", storePass,
                    "-keypass", keyPass,
                    "-dname", "CN=Edappadi Kadai, O=Edappadi Kadai, L=Edappadi, S=Tamil Nadu, C=IN"
                )
                val proc = ProcessBuilder(cmd)
                    .redirectErrorStream(true)
                    .start()
                val output = proc.inputStream.bufferedReader().readText()
                proc.waitFor()
                println(output)
                if (keystoreFile.exists()) {
                    println("🎉 Successfully generated release keystore at ${keystoreFile.absolutePath}")
                } else {
                    println("❌ Failed to generate release keystore.")
                }
            } catch (e: Exception) {
                println("❌ Error generating keystore: ${e.message}")
            }
        } else {
            println("✓ Release keystore already exists at ${keystoreFile.absolutePath}")
        }
    }
}

tasks.register("buildRelease") {
    dependsOn("generateReleaseKeystore")
    doLast {
        println("🚀 Building Signed Release APK & Bundle...")
        try {
            val proc = ProcessBuilder("gradle", ":app:assembleRelease", ":app:bundleRelease", "--no-configuration-cache")
            proc.environment()["STORE_PASSWORD"] = System.getenv("STORE_PASSWORD") ?: "edappadikadai123"
            proc.environment()["KEY_PASSWORD"] = System.getenv("KEY_PASSWORD") ?: "edappadikadai123"
            proc.environment()["KEYSTORE_PATH"] = System.getenv("KEYSTORE_PATH") ?: "${rootDir}/my-upload-key.jks"
            proc.redirectErrorStream(true)
            val started = proc.start()
            val output = started.inputStream.bufferedReader().readText()
            started.waitFor()
            println(output)
            if (started.exitValue() == 0) {
                println("🎉 Successfully generated Signed Release APK and App Bundle (AAB)!")
            } else {
                println("❌ Release build failed with exit code ${started.exitValue()}")
            }
        } catch (e: Exception) {
            println("❌ Error building release: ${e.message}")
        }
    }
}






