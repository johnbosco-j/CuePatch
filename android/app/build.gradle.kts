plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

val recaptchaKey = providers.environmentVariable("CUEPATCH_ANDROID_RECAPTCHA_SITE_KEY").orNull
    ?: rootProject.file("recaptcha-site-key.txt").takeIf { it.isFile }?.readText()?.trim().orEmpty()

android {
    namespace = "app.riven.cuepatch"
    compileSdk = 36
    testBuildType = "release"
    defaultConfig {
        applicationId = "app.riven.cuepatch"
        minSdk = 26
        targetSdk = 35
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        versionCode = 1
        versionName = "1.0.0"
        resValue("string", "app_check_site_key", recaptchaKey)
    }
    sourceSets["main"].assets.srcDir("../../web")
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
kotlin { jvmToolchain(17) }

dependencies {
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    implementation("com.google.firebase:firebase-ai:18.2.0")
    implementation("com.google.firebase:firebase-ai-ondevice:16.0.0-beta08")
    releaseImplementation("com.google.firebase:firebase-appcheck-recaptcha:20.1.0")
    debugImplementation("com.google.firebase:firebase-appcheck-debug:20.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("androidx.webkit:webkit:1.13.0")
}

val validateReleaseAttestation by tasks.registering {
    doLast {
        require(recaptchaKey.matches(Regex("[A-Za-z0-9_-]{15,128}"))) {
            "Configure the public Android reCAPTCHA Enterprise key in recaptcha-site-key.txt or CUEPATCH_ANDROID_RECAPTCHA_SITE_KEY."
        }
    }
}
tasks.matching { it.name == "preReleaseBuild" }.configureEach { dependsOn(validateReleaseAttestation) }
