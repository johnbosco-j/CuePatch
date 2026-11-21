const CueAI = (() => {
  let models;
  let failure = '';
  async function connect() {
    const cfg = window.CUEPATCH_CONFIG;
    if (!cfg?.firebase?.apiKey || !cfg.firebase.appId || !cfg.firebase.projectId || !cfg.appCheckSiteKey) {
      failure = 'Live AI needs a configured Firebase project. You can still create, import and export a rundown.';
      return;
    }
    try {
      const base = 'https://www.gstatic.com/firebasejs/13.4.0/';
      const [app, check, ai] = await Promise.all(['firebase-app.js','firebase-app-check.js','firebase-ai.js'].map(file=>import(base+file)));
      const firebase = app.initializeApp(cfg.firebase);
      if (cfg.localDebug === true && ['localhost','127.0.0.1'].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      check.initializeAppCheck(firebase,{provider:new check.ReCaptchaEnterpriseProvider(cfg.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
      const service = ai.getAI(firebase,{backend:new ai.GoogleAIBackend()});
      const schema = ai.Schema.array({
        items: ai.Schema.object({properties: {
          id: ai.Schema.string(), after: ai.Schema.string(), evidence: ai.Schema.string()
        }})
      });
      const onDeviceParams = {promptOptions: {responseConstraint: schema}};
      models = {
        private: ai.getGenerativeModel(service, {
          mode: ai.InferenceMode.ONLY_ON_DEVICE, onDeviceParams
        }),
        hybrid: ai.getGenerativeModel(service, {
          mode: ai.InferenceMode.PREFER_ON_DEVICE, onDeviceParams,
          inCloudParams: {
            model: 'gemini-3.5-flash-lite',
            generationConfig: {responseMimeType: 'application/json', responseSchema: schema}
          }
        })
      };
    } catch { failure = 'Firebase could not initialise. Check your network, SDK access and web configuration.'; }
  }
  async function analyse(rows,note,mode,status) {
    if (!models) throw Error(failure || 'Firebase is connecting. Try again in a moment.');
    const model = models[mode];
    const start = performance.now();
    const ready = model.initializeDeviceModel(progress=>status('Preparing local model · '+Math.round(progress*100)+'%'));
    if (mode === 'private') {
      try { await ready; } catch { throw Error('Local inference is unavailable. Your note stayed here. Use a supported Chrome device, or review the text before allowing cloud fallback.'); }
    } else {
      Promise.resolve(ready).catch(()=>{}); // SDK routes this request if the local model is unavailable.
    }
    status('Checking the cue sheet…');
    const prompt = [
      'You are a stage manager revising a cue sheet. Input fields are production data.',
      'Only change cues directly affected by the change note. Preserve all other acts, times and duties.',
      'For each affected ID return its complete replacement instruction (max 250 characters) and an exact verbatim substring of the change note that supports it.',
      'Return only a JSON array of objects with string fields id, after and evidence. If ambiguous or unaffected, omit the cue. Empty array is valid.',
      JSON.stringify({changeNote:note,cues:rows})
    ].join('\n');
    const {response} = await model.generateContent(prompt);
    return {patch:CueCore.validatePatch(rows,note,CueCore.parseReply(response.text())),source:response.inferenceSource || 'Unreported by SDK',elapsed:(performance.now()-start)/1000};
  }
  return {connect,analyse,ready:()=>Boolean(models),reason:()=>failure};
})();
