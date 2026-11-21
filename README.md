# CuePatch

A stage manager turns one last-minute rehearsal change into reviewed revisions for sound, lighting, camera and stage. Each suggestion names a cue, shows its old and new instructions and quotes the rehearsal note. The caller decides which edits to release. Each crew can export its own calling copy.

## Use the show desk

Open the deployed show desk in a desktop browser. Choose **Start a show**, enter the production name and paste spreadsheet rows with four columns (ID, time in HH:MM, crew and instruction). Tab-separated or vertical-bar-separated lines are supported. Alternatively import an existing rundown JSON, or use the included eight-cue campus showcase. The desk accepts 1–60 cues.

Enter a rehearsal change. For a supported, prepared Chrome device, choose **On-device only**. In Brave and other online browsers without the local model, choose **On-device with cloud fallback** to allow Firebase to process the sheet. Click **Find affected cues**. Review each proposed edit against its highlighted quote and select only the changes to issue. **Approve selected cues** creates a revision. Filter by crew, choose **Export sheet** to inspect that department’s calling copy and **Download text file** to save it.

The example-note button fills the note field. Every proposal requires a successful Firebase response. The tab retains its approved revision across refreshes. Use **Download rundown JSON** to carry the approved cue list into another session. Cue IDs, times and crew assignments remain fixed when approving generated instruction changes.

## Observed on November 21, 2026

Two live requests from Brave used the dedicated project with App Check. Moving the opening host to the lectern returned precisely the four opening cues in 2.88 seconds. A new camera note about the first song returned VC-02 alone in 2.1 seconds. The caller approved that edit as revision 2. Brave reported the on-device model unavailable in local-only mode. A successful on-device/offline run on supported Chrome still needs hardware verification.

## Interface

CuePatch adapts the entrant’s pre-existing Riven design reference to a stage caller’s desk. The white and gray surfaces use a single red accent. Instrument Sans and italic Instrument Serif carry the heading hierarchy, with DM Mono for cue IDs, times and revisions. The capsule navigation, orbital overview, grouped crew filters, keyboard controls and reduced-motion layout were implemented for this entry. The orbit uses browser CSS. No company photos or 3D assets ship with the app.

## Run the Firebase version

1. Use a dedicated Firebase project. In Firebase Console enable **AI Logic** with the **Gemini Developer API**. Register a web app. Register the same web app in App Check with a **reCAPTCHA Enterprise** web key for your demo domain. Confirm that enforcement for Firebase AI Logic is active.
2. From this directory copy `web/config.js` to `config.local.js`. Fill `firebase` with the demo app's browser configuration from Project Settings and `appCheckSiteKey` with the public Enterprise site key. These values are delivered to the browser. Keep their source file outside version control. Never enter a Gemini API key, service-account credential, reCAPTCHA secret or App Check debug token in those fields.
3. For localhost only, set `localDebug: true`. Register the browser-generated debug token privately in the Firebase console as described in the official guide. Use `localDebug: false` with the registered live domain.
4. Build and serve. Python 3 is required for these commands. The app loads Firebase JS SDK 13.4.0 from Google's CDN when configured. A first online load is required.

```sh
python3 build.py
python3 -m http.server 8080 --directory dist
```

5. Open http://localhost:8080 in desktop Chrome. Follow the Firebase Web guide and event FAQ to enable the supported built-in model for your Chrome channel. Allow the initial model download to complete online. Enter a rehearsal change and select **Find affected cues**.
6. For the on-device rehearsal, initialise the model and complete a live local run while online first. Leave the tab open, take the browser offline and try a different note. Offline cold launch and offline model installation are outside this build. For the fallback test use a second online Chrome profile/device without a usable local model, choose **On-device with cloud fallback**, and run the same note. Record the actual source returned by the SDK. Network status at the top describes browser connectivity only.
7. For hosting, build with the production demo configuration, then use the authenticated Firebase CLI command below. Replace PROJECT_ID with the dedicated project ID. Verify App Check and the live URL in a clean judging browser. Keep hosting and model access available through December 16 PT.

```sh
firebase deploy --only hosting --project PROJECT_ID
```

## Measure a live rehearsal

Choose **Test live Firebase inference** in the show desk footer. Each click
runs one new Firebase request against the same eight fictional cues. Select
one of four cases and a routing mode. The results show the SDK source, elapsed
seconds, missed cue IDs, extra cue IDs and the proposed wording. Download the
JSON before closing the page. Failed requests appear as failures. To evaluate an offline run, open and
prepare the checks page while online, then disconnect with that tab open.

## Where inference happens

`web/ai.js` dynamically imports Firebase App, App Check and AI Logic. It initializes App Check, calls `getAI` and creates separate `ONLY_ON_DEVICE` and `PREFER_ON_DEVICE` models. The button handler initializes the device model during a user gesture and calls `generateContent`. Both routes use Firebase AI Logic. The fallback option sends the full change note and cue list to the cloud when the SDK selects cloud execution. The default mode is local only. Use fictional or authorised, non-confidential data for judging.

The UI reads `response.inferenceSource` from each completed request and measures elapsed time including model preparation. Invalid JSON, invented evidence, unknown IDs and repeated IDs stop the revision. An exact quote establishes a source for review. A person still checks whether the proposed instruction is justified and whether the model missed another cue.

The tab stores the current rundown, revision numbers, changed IDs and source labels in session storage. Raw rehearsal notes and unapproved proposals are held in page memory. A revised instruction can contain text derived from the note. Exported files contain the approved instructions.

## Tests

```sh
node --test tests/*.test.cjs
```

Tests cover cue validation, partial approval and review state. These run with Node 20+ and no package installation. Real device inference, cloud fallback, enforcement and venue usability require the live acceptance checks in SUBMISSION.md.

## Project provenance

New project started November 20, 2026 for #BuildHybridAI. Original application code and fictional rehearsal material were created during the event with Codex assistance. The Firebase SDK and its dependencies retain their respective licenses. The application source uses the MIT license. The Riven design system supplied the visual reference. All CuePatch application logic, stage instructions and interface implementation were created for this event.

## References

- [Official rules](https://firebasehybridaihackathon.devpost.com/rules) and [event FAQ](https://firebasehybridaihackathon.devpost.com/details/faqs)
- [Firebase hybrid Web setup](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started) and [source reporting](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options)
- [Firebase App Check for Web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Central Connecticut State University stage management handbook](https://www.ccsu.edu/sites/default/files/2025-08/Updated%20SM%20and%20ASM%20Handbook%202025%20mf.pdf) for the prompt-book and cue-coordination workflow. Its production materials are not distributed with CuePatch.
