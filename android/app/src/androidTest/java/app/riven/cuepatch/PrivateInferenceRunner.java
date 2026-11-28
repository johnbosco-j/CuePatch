package app.riven.cuepatch;

import android.os.Bundle;
import androidx.test.runner.AndroidJUnitRunner;

/** Selects private mode in Test Lab's console, which has no runner-argument field. */
public final class PrivateInferenceRunner extends AndroidJUnitRunner {
    @Override public void onCreate(Bundle arguments) {
        Bundle privateArguments = new Bundle(arguments);
        privateArguments.putString("route", "private");
        super.onCreate(privateArguments);
    }
}
