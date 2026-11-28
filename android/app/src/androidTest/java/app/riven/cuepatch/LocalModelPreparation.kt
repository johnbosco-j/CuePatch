package app.riven.cuepatch

import android.os.SystemClock
import android.util.Log
import com.google.firebase.Firebase
import com.google.firebase.ai.DownloadStatus
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout

/** Prepares a freshly provisioned Test Lab phone before exercising the release's private route. */
@OptIn(PublicPreviewAPI::class)
internal object LocalModelPreparation {
    @JvmStatic
    fun prepare() = runBlocking {
        val extension = checkNotNull(Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
            modelName = "gemini-3.5-flash-lite",
            onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE)
        ).onDeviceExtension) { "Firebase did not provide an on-device extension" }
        withTimeout(420_000L) {
            val startupDeadline = SystemClock.elapsedRealtime() + 180_000
            var previous: OnDeviceModelStatus? = null
            var requestedDownload = false
            while (true) {
                val status = extension.checkStatus()
                if (status != previous) Log.i("CuePatchReleaseTest", "Firebase on-device model: $status")
                previous = status
                when (status) {
                    OnDeviceModelStatus.AVAILABLE -> return@withTimeout
                    OnDeviceModelStatus.DOWNLOADABLE -> if (!requestedDownload) {
                        requestedDownload = true
                        extension.download().collect { update ->
                            if (update is DownloadStatus.DownloadFailed) error("Firebase model download failed: $update")
                        }
                    }
                    OnDeviceModelStatus.DOWNLOADING -> Unit
                    else -> if (SystemClock.elapsedRealtime() >= startupDeadline) {
                        Log.i("CuePatchReleaseTest", "Model still $status after 180 seconds; exercising the app's private request.")
                        return@withTimeout
                    }
                }
                delay(3_000)
            }
        }
    }
}
