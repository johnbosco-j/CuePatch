package app.riven.cuepatch;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.SystemClock;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Locale;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Drives the released desk's controls and reads the result rendered by the native SDK. */
@RunWith(AndroidJUnit4.class)
public class ReleaseInferenceTest {
    private final Instrumentation test = InstrumentationRegistry.getInstrumentation();
    private WebView desk;

    private String evaluate(String script) throws Exception {
        ArrayBlockingQueue<String> result = new ArrayBlockingQueue<>(1);
        test.runOnMainSync(() -> desk.evaluateJavascript(script, result::add));
        String json = result.poll(10, TimeUnit.SECONDS);
        if (json == null) throw new AssertionError("The desk did not answer");
        return new JSONTokener(json).nextValue().toString();
    }

    private void await(String condition, int seconds) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + seconds * 1000L;
        while (SystemClock.elapsedRealtime() < deadline) {
            if ("true".equals(evaluate(condition))) return;
            SystemClock.sleep(400);
        }
        fail("Timed out waiting for the desk: " + condition);
    }

    @Test public void openingMicrophoneUsesFirebaseAndPreservesOtherCues() throws Exception {
        String route = InstrumentationRegistry.getArguments().getString("route", "hybrid");
        assertTrue("Expected private or hybrid", route.equals("private") || route.equals("hybrid"));
        Intent intent = test.getTargetContext().getPackageManager()
                .getLaunchIntentForPackage(test.getTargetContext().getPackageName());
        Activity activity = test.startActivitySync(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try {
            test.runOnMainSync(() -> {
                ViewGroup content = activity.findViewById(android.R.id.content);
                desk = (WebView) content.getChildAt(0);
            });
            await("Boolean(document.querySelector('a[href=\"checks.html\"]'))", 30);
            evaluate("document.querySelector('a[href=\"checks.html\"]').click(); true");
            await("Boolean(document.querySelector('#run:not(:disabled)'))", 30);
            evaluate("const scenario=document.querySelector('#case'); scenario.value='2';"
                    + "scenario.dispatchEvent(new Event('change'));"
                    + "const mode=document.querySelector('#route'); mode.value='" + route + "';"
                    + "mode.dispatchEvent(new Event('change')); document.querySelector('#run').click(); true");
            await("Boolean(document.querySelector('#results article'))", 200);
            String status = evaluate("document.querySelector('#status').textContent");
            String compare = evaluate("document.querySelector('#results article p').textContent");
            assertEquals(status, "Cue IDs match", compare);
            String source = evaluate("document.querySelector('#results article p:nth-of-type(2)').textContent");
            String observed = source.toLowerCase(Locale.ROOT);
            assertTrue("Missing Firebase inference source: " + source,
                    observed.contains("device") || observed.contains("cloud"));
            if (route.equals("private")) assertTrue("Private request used " + source, observed.contains("device"));
            String detail = evaluate("document.querySelector('#results article').innerText");
            assertTrue(detail, detail.contains("AU-01") && detail.contains("Missed cues · none")
                    && detail.contains("Unexpected cues · none"));
            Log.i("CuePatchReleaseTest", "Opening microphone: only AU-01. Firebase source: " + source);
        } finally {
            test.runOnMainSync(activity::finish);
        }
    }
}
