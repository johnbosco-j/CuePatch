# CuePatch · BuildHybridAI 2026 submission workbook

## Project pitch

One backstage change can make four crew sheets wrong. CuePatch finds affected cues, shows the instruction and evidence for each proposed edit, and lets the show caller issue a revised calling copy.

**Audience**  Stage managers and student production crews handling sound, lighting, camera and stage from an English-language rundown. Campus events make a practical first pilot. The larger opportunity is any touring or volunteer-run production that distributes different copies of the same show. This build focuses on one caller and crew-specific file exports.

**The rehearsal**  It is 17:58. The host will deliver the opening welcome at the centre lectern with its fixed mic. The singer still opens the first song from stage left with a handheld mic. A global replacement would damage the next act. The caller must locate the host's entrance, mic, lighting mark and camera frame. Look for four correct edits and four protected cues.

**Why hybrid matters**  A caller can process private rehearsal notes in a prepared booth with unreliable connectivity. A volunteer with an ordinary online laptop can opt into cloud fallback and use the same sheet-review workflow. Capture both results with their SDK source labels. Only describe a local or cloud run as successful after observing it.

## What to put on Devpost after live verification

**Title**  CuePatch

**Tagline**  Turn a last-minute stage change into reviewed cue sheets for every crew.

**Description draft**  Minutes before curtain, the host moves to a lectern. Sound needs a different microphone, lighting needs a new mark, and camera needs a new opening frame. The next performer still needs the original setup. CuePatch gives the stage manager one place to review the consequences. Each proposal links an existing cue to an exact phrase in the rehearsal note. The caller approves changes individually and exports a versioned sheet for each department.

CuePatch uses the Firebase AI Logic Web SDK with App Check. A local-only mode handles private rehearsal notes on a supported Chrome device. An opt-in hybrid mode prefers the on-device model and permits cloud fallback. The review desk displays the source returned by the SDK. Both modes feed the same validation and approval process. On November 21, two live Brave requests returned the cloud source. The opening change matched all four expected cues in 2.88 seconds. A separate first-song change matched only the camera cue in 2.1 seconds, and the caller approved revision 2. Local-only mode reported the local model unavailable on that installation. A successful Chrome on-device run and a crew pilot are still pending.

**Built during the event**  New Web/Chrome app, original example rundown, import and export, review and selective approval, session revision history, Firebase integration, tests and hosting configuration. Codex assisted implementation. Include any additional teammates, assets or pre-existing work added before submission.

## Live acceptance record

Use fresh revisions for each trial. The table gives acceptance targets. Observed results are recorded above.

| Test on actual hardware | Pass condition | Evidence to keep |
| --- | --- | --- |
| Online supported Chrome, local-only | Model returns a live result with a local SDK source | Chrome version, device, source, time |
| Same prepared tab, disconnected; use a new note | Response from the device while offline, correct edits survive approval | Uncut capture of mode, network change and output |
| Online Chrome with local model unavailable, hybrid permission | SDK returns cloud source; receipt and output visible | Second device/profile, source, elapsed seconds |
| Same unsupported client, local-only | No cloud revision; user sees actionable failure | Network inspection and visible message |
| App Check enforced | Hosted judge session succeeds; unregistered debug client attempting cloud inference fails | Console enforcement state and outcome, with credentials cropped |
| Human review | Select only one change, verify remaining instructions, filter crew, export, refresh | Revised crew file and visible revision |
| Blank or ambiguous note | Blank cannot run. For ambiguous input, inspect any unsupported changes and record failures | Raw outcome, no invented benchmark |

### Rehearsal cases

| Note to enter | Expected affected cues on the original sheet |
| --- | --- |
| For the opening welcome only, move the host to the centre lectern and use the lectern mic. The first song stays as rehearsed. | ST-01, AU-01, LX-01, VC-01 |
| Keep everything as rehearsed except for the first song camera shot. Use a wide shot of the singer. | VC-02 |
| During the opening welcome, keep the host on the stage-left mark but use the headset instead of the handheld. | AU-01 |
| All positions, microphone assignments, lighting and camera shots stay as rehearsed. | None |

Measure correct cue IDs, missed IDs, spurious IDs and seconds to a correct crew handoff. Inspect replacement text as well as IDs. If a model links the correct ID to an incorrect instruction, count it as a failed edit. Use a fresh note during recording to distinguish a live call from the embedded walkthrough.

### Impact evidence from LICET

Invite three willing event volunteers, ideally a caller, sound operator and camera or lighting operator. Ask them to provide two comparable, de-identified rehearsal changes and mark the expected cues before seeing AI output. Give each volunteer one case on a plain sheet and one using CuePatch. Alternate which condition is first. Time both from note received to correct crew handoff. Record missed and accidental changes, device and inference source. Report the actual sample size, median times, mistakes and one limitation. Three rehearsal trials support a pilot observation, not a general productivity claim.

## Demo video · target 2 minutes 40 seconds

| Time | Show | Suggested narration |
| --- | --- | --- |
| 0:00–0:12 | The original welcome and first song rows. Highlight both stage-left instructions. | “Two minutes to curtain. Our host has moved to the lectern. The singer still needs stage left. Which four cues just became wrong?” |
| 0:12–0:30 | Actual local result from a prepared offline tab, then the same workflow returning the actual cloud source on a second client. | “The booth can work offline. On another laptop, the caller can permit cloud fallback. These labels come from Firebase after each request.” |
| 0:30–1:12 | Enter a new change on camera. Open the differences. Show the quoted evidence and the untouched singer cues. | Walk through one easy change and one that another crew could miss. |
| 1:12–1:43 | Accept selected cues, filter Sound, export and open the revised crew file. | “The caller releases the revision. The operator gets a sheet they can use at the console.” |
| 1:43–2:08 | Show the unsupported-device local-only path, then the visible cloud permission. Briefly show the runtime call. | Explain exactly when the full sheet can leave the device. |
| 2:08–2:40 | One measured, consented rehearsal result and the free demo URL. | Give the sample size and result. If no pilot ran, show one factual timed case and label it a demonstration. |

Use your own screen recording and voice, English narration/captions, original or cleared content, and a clean browser profile. Keep tokens, user accounts, notifications and backstage personal data out of frame.

## Submission work order

| Order | Work | Evidence required before moving on |
| --- | --- | --- |
| 1 | Connect the dedicated Firebase app and App Check on its final host. | Cloud request succeeds from a clean browser. |
| 2 | Prepare a supported Chrome device, then run the live rehearsal checks. | Capture a device result offline and an actual cloud fallback online. Export the test reports. |
| 3 | Have an available crew member check the proposed wording. | Record missed cues and corrections. If nobody is available, describe the demonstration as a controlled test. |
| 4 | Publish the source, verify the free build, record the English demo and upload it publicly to YouTube. | A signed-out viewer can open all three links. |
| 5 | Complete the Devpost entry and verify the submitted status. | Submission receipt visible under My Projects. |

The official deadline is December 1 at 3:30 a.m. IST. Keep judge access working through December 16 PT. A four-day model quota account cannot cover that judging window on its own.

## Submission gate

- Confirm entrant and team eligibility, add all contributors as members on Devpost, and name the representative. India is outside the listed excluded locations. Each member still needs to satisfy the individual rules.
- Choose **Web (Chrome)**. Add another category only after a native supported implementation runs via Firebase AI Logic and appears in the demo. A responsive web layout by itself is the Web entry.
- Provide a working, free judge path and clean-browser instructions. Use the dedicated demo project. The rules bar production API keys, live secrets, confidential commercial data and PII in submission materials.
- Make the GitHub/GitLab repo public with source, assets, instructions and the root MIT LICENSE visible in About. Confirm both Firebase model paths execute. State new work and disclose reused material.
- Upload the real demo publicly on YouTube, check the video and repo from a signed-out browser, and add the app, video and repo URLs to Devpost. A private or unlisted video does not match the published visibility requirement.
- Stage one checks viability. Stage two gives implementation, design, impact and idea equal weight; implementation breaks ties first. Demonstrate inference provenance, a complete handoff, observed pilot results and why the next act needs protection.
- Registration and project submission are separate. Check the final submission status before the deadline.

Sources: [official rules](https://firebasehybridaihackathon.devpost.com/rules), [FAQ](https://firebasehybridaihackathon.devpost.com/details/faqs), [updates](https://firebasehybridaihackathon.devpost.com/updates), [resources](https://firebasehybridaihackathon.devpost.com/resources).
