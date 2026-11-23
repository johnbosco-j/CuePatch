package app.riven.cuepatch

import android.content.Context
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.recaptcha.RecaptchaAppCheckProviderFactory

internal fun configureAppCheck(context: Context) {
    val siteKey = context.getString(R.string.app_check_site_key)
    FirebaseAppCheck.getInstance().installAppCheckProviderFactory(RecaptchaAppCheckProviderFactory.getInstance(siteKey))
}
