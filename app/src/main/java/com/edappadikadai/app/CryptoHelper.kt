package com.edappadikadai.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object CryptoHelper {
    private const val TAG = "CryptoHelper"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "EdappadiKadaiSecureKey_v2"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_SEPARATOR = "]"
    private const val XOR_KEY = "LYO_EDAPPADI_KADAI_SECURE_KEY_2026_9876"

    init {
        initKey()
    }

    private fun initKey() {
        try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
            keyStore.load(null)
            if (!keyStore.containsAlias(KEY_ALIAS)) {
                val keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    ANDROID_KEYSTORE
                )
                val keyGenParameterSpec = KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build()
                keyGenerator.init(keyGenParameterSpec)
                keyGenerator.generateKey()
                android.util.Log.i(TAG, "Successfully generated secure KeyStore AES key.")
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error initializing KeyStore key", e)
        }
    }

    private fun getSecretKey(): SecretKey? {
        return try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
            keyStore.load(null)
            val entry = keyStore.getEntry(KEY_ALIAS, null)
            if (entry is KeyStore.SecretKeyEntry) {
                entry.secretKey
            } else {
                null
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to retrieve secret key", e)
            null
        }
    }

    /**
     * Encrypt a plain-text string using AES-256 GCM via KeyStore.
     */
    fun encrypt(plainText: String): String {
        if (plainText.isEmpty()) return ""
        try {
            val secretKey = getSecretKey() ?: return ""
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey)
            val iv = cipher.iv
            val encryptedBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
            
            val ivString = Base64.encodeToString(iv, Base64.NO_WRAP)
            val encryptedString = Base64.encodeToString(encryptedBytes, Base64.NO_WRAP)
            
            return "$ivString$IV_SEPARATOR$encryptedString"
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Encryption failed", e)
            return ""
        }
    }

    /**
     * Decrypt a cipher-text string. If the string is legacy, or decryption fails, handles appropriately.
     */
    fun decrypt(context: Context, key: String, encryptedData: String): String {
        if (encryptedData.isEmpty()) return ""
        
        // Check if this is Keystore-encrypted
        val parts = encryptedData.split(IV_SEPARATOR)
        if (parts.size != 2) {
            // It might be plaintext JSON or legacy XOR JSON
            return handleLegacyOrPlaintext(context, key, encryptedData)
        }

        try {
            val iv = Base64.decode(parts[0], Base64.NO_WRAP)
            val encryptedBytes = Base64.decode(parts[1], Base64.NO_WRAP)
            
            val secretKey = getSecretKey() ?: throw IllegalStateException("Keystore key not available")
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
            
            val decryptedBytes = cipher.doFinal(encryptedBytes)
            return String(decryptedBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Decryption failed for key '$key'. Clearing corrupted cache.", e)
            // Clear corrupted key automatically as requested
            try {
                val sharedPreferences = context.getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)
                sharedPreferences.edit().remove(key).apply()
            } catch (ex: Exception) {
                android.util.Log.e(TAG, "Failed to remove corrupted preference '$key'", ex)
            }
            return ""
        }
    }

    /**
     * Legacy XOR decrypt function
     */
    private fun decryptXorText(enc: String): String {
        if (enc.isEmpty()) return ""
        return try {
            val decodedBytes = Base64.decode(enc, Base64.DEFAULT)
            val dec = String(decodedBytes, Charsets.UTF_8)
            val sb = StringBuilder()
            for (i in dec.indices) {
                sb.append((dec[i].code xor XOR_KEY[i % XOR_KEY.length].code).toChar())
            }
            sb.toString()
        } catch (e: Exception) {
            ""
        }
    }

    /**
     * Check if a string is a legacy XOR encrypted JSON settings payload, and migrate it transparently.
     */
    private fun handleLegacyOrPlaintext(context: Context, key: String, rawData: String): String {
        if (rawData.trim().startsWith("{") && rawData.trim().endsWith("}")) {
            // It is valid JSON. Let's inspect it to see if it's the legacy XOR settings.
            try {
                val json = JSONObject(rawData)
                if (key == "ek_settings" && json.optBoolean("_encrypted", false)) {
                    android.util.Log.i(TAG, "Legacy XOR-encrypted settings detected. Migrating to Keystore AES-256 GCM...")
                    
                    // Decrypt sensitive fields using the legacy XOR algorithm
                    val sensitiveFields = listOf("upiPrimary", "upiSecondary", "upiMerchantName", "smsApiKey", "smsTwilioSid", "smsTwilioToken")
                    for (field in sensitiveFields) {
                        if (json.has(field)) {
                            val encValue = json.optString(field, "")
                            if (encValue.isNotEmpty()) {
                                json.put(field, decryptXorText(encValue))
                            }
                        }
                    }
                    // Remove the _encrypted legacy flag
                    json.remove("_encrypted")
                    
                    // Re-save/migrate the plaintext JSON to Keystore encrypted storage
                    val migratedPlaintext = json.toString()
                    val secureCipher = encrypt(migratedPlaintext)
                    if (secureCipher.isNotEmpty()) {
                        val sharedPreferences = context.getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)
                        sharedPreferences.edit().putString(key, secureCipher).apply()
                        android.util.Log.i(TAG, "Legacy settings successfully migrated to AES-256 GCM.")
                    }
                    return migratedPlaintext
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error handling legacy JSON parse / migration", e)
            }
            
            // If it is just plain JSON (unencrypted), encrypt it now so it is never plaintext on disk
            try {
                val secureCipher = encrypt(rawData)
                if (secureCipher.isNotEmpty()) {
                    val sharedPreferences = context.getSharedPreferences("EdappadiKadaiPrefs", Context.MODE_PRIVATE)
                    sharedPreferences.edit().putString(key, secureCipher).apply()
                    android.util.Log.i(TAG, "Plaintext cache auto-secured with AES-256 GCM.")
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error encrypting plaintext data on-the-fly", e)
            }
            return rawData
        }
        return rawData
    }
}
