package app.riven.cuepatch

import android.app.AlertDialog
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.print.PrintManager
import android.text.TextUtils
import android.view.View
import android.view.WindowInsets
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.firebase.Firebase
import com.google.firebase.ai.DownloadStatus
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File

class DeskActivity : Activity() {
    private lateinit var desk: WebView
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var analysis: Job? = null
    private var selectFile: ValueCallback<Array<Uri>>? = null
    private var pendingExport: File? = null
    private var printView: WebView? = null

    private companion object {
        const val ORIGIN = "https://appassets.androidplatform.net"
        const val HOME = "$ORIGIN/assets/index.html"
        const val IMPORT = 71
        const val EXPORT = 72
        const val MAX_FILE = 5_000_000
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureAppCheck(this)
        desk = WebView(this)
        setContentView(desk)
        window.statusBarColor = Color.WHITE
        window.navigationBarColor = Color.WHITE
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        if (android.os.Build.VERSION.SDK_INT >= 35) {
            desk.setOnApplyWindowInsetsListener { view, incoming ->
                val bars = incoming.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime())
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                incoming
            }
        }
        savedInstanceState?.getString("export")?.let { name ->
            if (name.matches(Regex("issued-[0-9]+[.]tmp"))) {
                pendingExport = File(cacheDir, name).takeIf { it.isFile }
            }
        }
        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        desk.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }
        desk.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
                val resource = assets.shouldInterceptRequest(request.url)
                    ?: return WebResourceResponse("text/plain", "utf-8", 403, "Unavailable", emptyMap(), ByteArrayInputStream(byteArrayOf()))
                resource.responseHeaders = mapOf("Content-Security-Policy" to
                    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-src 'none'; form-action 'none'; base-uri 'none'")
                return resource
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == WebViewAssetLoader.DEFAULT_DOMAIN &&
                    uri.path in setOf("/assets/index.html", "/assets/checks.html", "/assets/crew.html")) return false
                if (request.isForMainFrame && uri.scheme == "https" && request.hasGesture()) {
                    try { startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)) }
                    catch (_: ActivityNotFoundException) { message("A browser is required to open this link.") }
                }
                return true
            }
        }
        desk.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                selectFile?.onReceiveValue(null)
                selectFile = callback
                val picker = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/plain", "application/octet-stream"))
                try { startActivityForResult(picker, IMPORT) }
                catch (_: ActivityNotFoundException) { selectFile = null; callback.onReceiveValue(null); message("File picker unavailable.") }
                return true
            }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(desk, "CuePatchAndroid", setOf(ORIGIN)) { _, message, _, main, reply ->
                if (main) receive(message.data.orEmpty(), reply)
            }
        } else {
            message("Update Android System WebView to enable native AI and exports.")
        }
        if (savedInstanceState == null || desk.restoreState(savedInstanceState) == null) desk.loadUrl(HOME)
    }

    private fun receive(raw: String, reply: JavaScriptReplyProxy) {
        if (raw.length > MAX_FILE * 2 + 1024) return
        val msg = runCatching { JSONObject(raw) }.getOrNull() ?: return
        when (msg.optString("action")) {
            "analyse" -> analyse(msg, reply)
            "modelStatus" -> inspectLocalModel()
            "save" -> saveFile(msg)
            "share" -> {
                val uri = Uri.parse(msg.optString("url"))
                if (uri.scheme != "https" || uri.path != "/crew.html" || uri.fragment?.startsWith("v1.") != true ||
                    uri.toString().length > 9000) return
                val share = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, uri.toString())
                startActivity(Intent.createChooser(share, "Share this crew copy"))
            }
            "print" -> printSheet(msg.optString("text").take(80_000))
        }
    }

    @OptIn(PublicPreviewAPI::class)
    private fun inspectLocalModel() {
        scope.launch {
            try {
                val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
                    modelName = "gemini-3.5-flash-lite", onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE)
                ).onDeviceExtension
                val status = model?.checkStatus()
                val dialog = AlertDialog.Builder(this@DeskActivity).setTitle("On-device model")
                    .setNegativeButton("Close", null)
                val detail = when (status) {
                    OnDeviceModelStatus.AVAILABLE -> "Gemini Nano is ready for local rehearsal notes."
                    OnDeviceModelStatus.DOWNLOADING -> "Android is downloading the model. Check again after the download finishes."
                    OnDeviceModelStatus.DOWNLOADABLE -> "Gemini Nano is available for this device. Download the model over Wi-Fi to prepare for offline rehearsal."
                    else -> "Android reports that the on-device model is unavailable. The desk still works offline. For online analysis, choose the cloud fallback mode."
                }
                if (status == OnDeviceModelStatus.DOWNLOADABLE) {
                    dialog.setPositiveButton("Download model") { _, _ ->
                        scope.launch {
                            try {
                                model.download().collect { progress ->
                                    when (progress) {
                                        is DownloadStatus.DownloadStarted -> message("Model download started.")
                                        is DownloadStatus.DownloadFailed -> message("Model download failed. Check storage and connectivity.")
                                        DownloadStatus.DownloadCompleted -> message("On-device model ready.")
                                        else -> Unit
                                    }
                                }
                            } catch (cancelled: CancellationException) { throw cancelled }
                            catch (_: Exception) { message("Android could not complete the model download.") }
                        }
                    }
                }
                dialog.setMessage(detail).show()
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { message("Android could not check model availability.") }
        }
    }

    @OptIn(PublicPreviewAPI::class)
    private fun analyse(msg: JSONObject, reply: JavaScriptReplyProxy) {
        val id = msg.optString("id")
        val prompt = msg.optString("prompt")
        val mode = when (msg.optString("mode")) {
            "private" -> InferenceMode.ONLY_ON_DEVICE
            "hybrid" -> InferenceMode.PREFER_ON_DEVICE
            else -> return
        }
        if (!id.matches(Regex("[a-zA-Z0-9-]{1,64}"))) return
        fun answer(text: String? = null, source: String? = null, error: String? = null) {
            if (isDestroyed) return
            val result = JSONObject().put("id", id)
            if (error != null) result.put("error", error) else result.put("text", text).put("source", source)
            runCatching { reply.postMessage(result.toString()) }
        }
        if (prompt.isBlank() || prompt.length > 70_000) { answer(error = "The cue sheet exceeds the supported input size."); return }
        if (analysis?.isActive == true) { answer(error = "A cue analysis is already running."); return }
        analysis = scope.launch {
            try {
                val response = withTimeout(180_000) {
                    val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
                        modelName = "gemini-3.5-flash-lite", onDeviceConfig = OnDeviceConfig(mode = mode)
                    )
                    model.generateContent(prompt)
                }
                val text = response.text
                if (text.isNullOrBlank()) answer(error = "Firebase returned an empty response.")
                else answer(text = text, source = response.inferenceSource.toString())
            } catch (_: kotlinx.coroutines.TimeoutCancellationException) {
                answer(error = "Firebase timed out. Check model availability or connectivity and try again.")
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (e: Exception) {
                val detail = e.javaClass.simpleName
                answer(error = if (mode == InferenceMode.ONLY_ON_DEVICE)
                    "On-device inference could not finish ($detail). Check Gemini Nano availability on this device; cloud execution was disabled."
                else "Firebase could not finish the hybrid request ($detail). Check connectivity, App Check registration and model quota.")
            }
        }
    }

    private fun saveFile(msg: JSONObject) {
        if (pendingExport != null) { message("Finish saving the current file first."); return }
        val content = msg.optString("text")
        if (content.toByteArray(Charsets.UTF_8).size > MAX_FILE) { message("File exceeds the 5 MB limit."); return }
        val type = msg.optString("type").substringBefore(';')
        if (type !in setOf("text/plain", "text/html", "application/json")) return
        val name = msg.optString("name").replace(Regex("[^a-zA-Z0-9._-]"), "-").take(96)
        val file = runCatching { File.createTempFile("issued-", ".tmp", cacheDir).apply { writeText(content) } }.getOrNull()
        if (file == null) { message("Unable to prepare this file."); return }
        pendingExport = file
        val picker = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(type)
            .putExtra(Intent.EXTRA_TITLE, name)
        try { startActivityForResult(picker, EXPORT) }
        catch (_: ActivityNotFoundException) { pendingExport = null; file.delete(); message("File picker unavailable.") }
    }

    private fun printSheet(text: String) {
        if (text.isBlank()) return
        printView?.destroy()
        val page = WebView(this)
        printView = page
        page.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                (getSystemService(Context.PRINT_SERVICE) as PrintManager)
                    .print("CuePatch crew copy", view.createPrintDocumentAdapter("Crew calling copy"), null)
            }
        }
        page.loadDataWithBaseURL(null, "<meta charset=utf-8><title>Crew calling copy</title><pre style='white-space:pre-wrap;font:15px/1.6 monospace'>${TextUtils.htmlEncode(text)}</pre>", "text/html", "UTF-8", null)
    }

    override fun onActivityResult(code: Int, result: Int, data: Intent?) {
        super.onActivityResult(code, result, data)
        val uri = data?.data?.takeIf { result == RESULT_OK && it.scheme == "content" }
        if (code == IMPORT) {
            selectFile?.onReceiveValue(uri?.let { arrayOf(it) })
            selectFile = null
        } else if (code == EXPORT) {
            val file = pendingExport ?: return
            pendingExport = null
            if (uri == null) { file.delete(); return }
            scope.launch {
                val ok = withContext(Dispatchers.IO) {
                    runCatching {
                        requireNotNull(contentResolver.openOutputStream(uri, "wt")).use { output -> file.inputStream().use { it.copyTo(output) } }
                    }.isSuccess.also { file.delete() }
                }
                message(if (ok) "File saved." else "Unable to save this file. Try another location.")
            }
        }
    }

    private fun message(text: String) = android.widget.Toast.makeText(this, text, Toast.LENGTH_LONG).show()
    override fun onSaveInstanceState(out: Bundle) {
        super.onSaveInstanceState(out)
        desk.saveState(out)
        pendingExport?.let { out.putString("export", it.name) }
    }
    @Deprecated("Compatibility with API 26")
    override fun onBackPressed() {
        desk.evaluateJavascript("(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return true}var m=document.querySelector('.menu-toggle[aria-expanded=true]');if(m){m.click();return true}return false})()") { result ->
            if (result != "true") { if (desk.canGoBack()) desk.goBack() else finish() }
        }
    }
    override fun onDestroy() {
        scope.cancel()
        selectFile?.onReceiveValue(null)
        printView?.destroy()
        desk.destroy()
        super.onDestroy()
    }
}
