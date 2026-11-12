package de.beim.klingelton

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.content.IntentCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private val worker = Executors.newSingleThreadExecutor()

    private var pageReady = false
    private var pendingUri: Uri? = null

    /** Datei, die die Web-Oberfläche gerade unter /picked/ abholen darf. */
    @Volatile private var pickedSource: PickedSource? = null
    private var pickCounter = 0

    /** Für Android 8/9: Bytes, die nach Wahl des Speicherorts geschrieben werden. */
    private var pendingSaveBytes: ByteArray? = null

    private sealed class PickedSource {
        data class CachedFile(val file: File) : PickedSource()
        data class Content(val uri: Uri) : PickedSource()
    }

    // Android-Fotoauswahl: zeigt nur Videos aus der Galerie, keine Kamera
    private val pickVideo = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let(::processUri)
    }

    // Allgemeine Dateiauswahl (Dateien-App, Google Drive, Downloads …)
    private val pickFile = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let(::processUri)
    }

    private val createDocument = registerForActivityResult(ActivityResultContracts.CreateDocument("audio/mpeg")) { uri ->
        val bytes = pendingSaveBytes
        pendingSaveBytes = null
        if (uri == null || bytes == null) return@registerForActivityResult
        val ok = runCatching {
            contentResolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("Kein Ausgabestrom")
        }.isSuccess
        toast(if (ok) getString(R.string.saved, displayName(uri) ?: "") else getString(R.string.save_failed))
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        )
        super.onCreate(savedInstanceState)

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/picked/") { servePicked() }
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            isVerticalScrollBarEnabled = false
            overScrollMode = WebView.OVER_SCROLL_NEVER
            addJavascriptInterface(AndroidBridge(), "AndroidBridge")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)

                // Nur die eigene, lokale Seite anzeigen
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    request.url.host != WebViewAssetLoader.DEFAULT_DOMAIN

                override fun onPageFinished(view: WebView, url: String) {
                    pageReady = true
                    pendingUri?.let {
                        pendingUri = null
                        processUri(it)
                    }
                }
            }
        }

        val root = FrameLayout(this).apply {
            setBackgroundResource(R.drawable.bg_gradient)
            addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(root)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.__appBack ? window.__appBack() : false") { result ->
                    if (result != "true") finish()
                }
            }
        })

        if (savedInstanceState == null) handleShareIntent(intent)
        webView.loadUrl("https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/www/index.html")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleShareIntent(intent)
    }

    override fun onDestroy() {
        worker.shutdownNow()
        webView.destroy()
        super.onDestroy()
    }

    private fun handleShareIntent(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND) return
        val uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java) ?: return
        if (pageReady) processUri(uri) else pendingUri = uri
    }

    /** Ausgewählte Datei vorbereiten und an die Web-Oberfläche übergeben. */
    private fun processUri(uri: Uri) {
        val name = displayName(uri) ?: "klingelton.mp4"
        val mime = contentResolver.getType(uri) ?: ""
        callJs("onNativePickStart", JSONObject.quote(name))

        worker.execute {
            val dir = File(cacheDir, "picked").apply { mkdirs() }
            dir.listFiles()?.forEach { it.delete() }

            // 41 s statt 40 s: die Web-Seite schneidet exakt und blendet sanft aus
            val trimmed = AudioTrimmer.trimAudio(this, uri, dir, 41_000_000L)
            pickedSource = if (trimmed != null) PickedSource.CachedFile(trimmed) else PickedSource.Content(uri)

            runOnUiThread {
                if (isDestroyed) return@runOnUiThread
                val info = JSONObject()
                    .put("name", name)
                    .put("type", mime)
                    .put("url", "https://${WebViewAssetLoader.DEFAULT_DOMAIN}/picked/${++pickCounter}")
                callJs("onNativeFile", info.toString())
            }
        }
    }

    private fun servePicked(): WebResourceResponse? {
        val stream = try {
            when (val source = pickedSource) {
                is PickedSource.CachedFile -> FileInputStream(source.file)
                is PickedSource.Content -> contentResolver.openInputStream(source.uri)
                null -> null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Datei nicht lesbar", e)
            null
        } ?: return WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), null)
        return WebResourceResponse("application/octet-stream", null, stream)
    }

    private fun callJs(function: String, argument: String) {
        webView.post {
            webView.evaluateJavascript("window.$function && window.$function($argument)", null)
        }
    }

    private fun displayName(uri: Uri): String? = runCatching {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    }.getOrNull() ?: uri.lastPathSegment

    private fun toast(message: String) = runOnUiThread {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    /** Speichert direkt in den Ordner „Ringtones“, damit der Ton in den Klingelton-Einstellungen auftaucht. */
    private fun saveToRingtones(bytes: ByteArray, fileName: String, mime: String): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        val resolver = contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Audio.Media.DISPLAY_NAME, fileName)
            put(MediaStore.Audio.Media.MIME_TYPE, mime)
            put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_RINGTONES)
            put(MediaStore.Audio.Media.IS_RINGTONE, 1)
            put(MediaStore.Audio.Media.IS_PENDING, 1)
        }
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val uri = resolver.insert(collection, values) ?: return null
        return try {
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("Kein Ausgabestrom")
            values.clear()
            values.put(MediaStore.Audio.Media.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            displayName(uri) ?: fileName
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            throw e
        }
    }

    private fun safeFileName(name: String): String =
        name.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_").ifBlank { "klingelton.mp3" }

    /** Wird aus JavaScript aufgerufen (läuft auf einem Hintergrund-Thread des WebViews). */
    inner class AndroidBridge {
        @JavascriptInterface
        fun pickVideo() = runOnUiThread {
            pickVideo.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.VideoOnly))
        }

        @JavascriptInterface
        fun pickFile() = runOnUiThread {
            pickFile.launch("*/*")
        }

        /** Rückgabe: "ok", "pending" (Speicherort wird gewählt) oder "error". */
        @JavascriptInterface
        fun saveFile(base64: String, fileName: String, mime: String): String {
            val name = safeFileName(fileName)
            return try {
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val savedName = saveToRingtones(bytes, name, mime) ?: return "error"
                    toast(getString(R.string.saved_ringtones, savedName))
                    "ok"
                } else {
                    pendingSaveBytes = bytes
                    runOnUiThread { createDocument.launch(name) }
                    "pending"
                }
            } catch (e: Exception) {
                Log.e(TAG, "Speichern fehlgeschlagen", e)
                "error"
            }
        }

        @JavascriptInterface
        fun shareFile(base64: String, fileName: String, mime: String) {
            try {
                val dir = File(cacheDir, "share").apply { mkdirs() }
                dir.listFiles()?.forEach { it.delete() }
                val file = File(dir, safeFileName(fileName))
                file.writeBytes(Base64.decode(base64, Base64.DEFAULT))
                val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = mime
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                runOnUiThread {
                    startActivity(Intent.createChooser(send, getString(R.string.share_title)))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Teilen fehlgeschlagen", e)
                toast(getString(R.string.save_failed))
            }
        }
    }

    companion object {
        private const val TAG = "Klingelton"
    }
}
