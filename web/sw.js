// The build replaces this stamp with a digest of the local UI. Cloud requests and credentials never enter this cache.
const CACHE='cuepatch-desk-__ASSET_HASH__';
const shell=new URL('./',self.registration.scope).href;
const files=['./','index.html','style.css','core.js','ai.js','config.js','app.js','production.js','navigation.js','checks.html','checks.js','crew.html','crew-page.js','crew-copy.js','crew-view.js'];
const urls=new Set(files.map(file=>new URL(file,shell).href));
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    try {
      for(const url of urls){
        const response=await fetch(new Request(url,{cache:'reload',credentials:'omit'}));
        if(!response.ok || new URL(response.url).origin!==self.location.origin)throw Error('Desk asset unavailable');
        if(url===shell && !(await response.clone().text()).includes('id="call-block"'))throw Error('Unexpected app document');
        await cache.put(url,response);
      }
      await self.skipWaiting();
    } catch(error){await caches.delete(CACHE);throw error;}
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith('cuepatch-desk-') && key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET' || new URL(request.url).origin!==self.location.origin)return;
  const path=new URL(request.url);path.hash='';path.search='';
  const offlineChecks=new URL('checks',shell).href;
  const offlineCrew=new URL('crew',shell).href;
  if(!urls.has(path.href) && path.href!==offlineChecks && path.href!==offlineCrew)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(async()=>{
      const cache=await caches.open(CACHE);
      return await cache.match(path.href===offlineChecks?new URL('checks.html',shell).href:path.href===offlineCrew?new URL('crew.html',shell).href:path.href) || Response.error();
    }));
  } else {
    event.respondWith(fetch(request).catch(async()=>await (await caches.open(CACHE)).match(path.href) || Response.error()));
  }
});
