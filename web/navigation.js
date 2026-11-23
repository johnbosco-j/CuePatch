const startLink = document.getElementById('start-link');
startLink?.addEventListener('click', () => {
  document.getElementById('new-show').open = true;
  document.getElementById('show-name').focus({preventScroll:true});
});
const menu = document.querySelector('.menu-toggle');
const navigation = document.getElementById('navigation');
function setMenu(open) {
  menu.setAttribute('aria-expanded',String(open));
  menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');
  navigation.classList.toggle('is-open',open);
}
menu.addEventListener('click',()=>{
  const open=menu.getAttribute('aria-expanded')!=='true';
  setMenu(open);
  if(open)navigation.querySelector('a')?.focus({preventScroll:true});
});
navigation.addEventListener('click',()=>setMenu(false));
const mobileLayout=matchMedia('(max-width:760px)');
mobileLayout.addEventListener('change',()=>setMenu(false));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && menu.getAttribute('aria-expanded')==='true'){
    setMenu(false);menu.focus();
  }
});
document.addEventListener('pointerdown',event=>{
  if(!event.target.closest('.capsule') && menu.getAttribute('aria-expanded')==='true') setMenu(false);
});
document.addEventListener('focusin',event=>{
  if(menu.getAttribute('aria-expanded')==='true' && !event.target.closest('.capsule'))setMenu(false);
});
// Large cue sheets can keep a parent section visible across several phone panels.
// Highlight the section crossing the sticky header, including a nested handoff or change panel.
const rails=[navigation,document.querySelector('.mobile-sections')].filter(Boolean)
  .map(rail=>[...rail.querySelectorAll('a[href^="#"]')].filter(a=>a.hash!=='#top')
    .map(link=>({link,section:document.getElementById(link.hash.slice(1))})).filter(item=>item.section))
  .filter(items=>items.length);
if(rails.length) {
  const header=document.querySelector('.capsule');
  let scheduled=false;
  function updateSections() {
    scheduled=false;
    const line=header.getBoundingClientRect().bottom+32;
    for(const items of rails){
      let active=null,nearest=-Infinity;
      for(const item of items) {
        const rect=item.section.getBoundingClientRect();
        if(rect.top<=line && rect.bottom>line && rect.top>=nearest){active=item;nearest=rect.top;}
      }
      for(const item of items){
        if(item===active)item.link.setAttribute('aria-current','location');
        else item.link.removeAttribute('aria-current');
      }
    }
  }
  function scheduleUpdate() {
    if(!scheduled){scheduled=true;requestAnimationFrame(updateSections);}
  }
  addEventListener('scroll',scheduleUpdate,{passive:true});
  addEventListener('resize',scheduleUpdate);
  if('ResizeObserver' in window)new ResizeObserver(scheduleUpdate).observe(document.querySelector('main'));
  scheduleUpdate();
}
if (matchMedia('(pointer:fine) and (prefers-reduced-motion:no-preference)').matches) {
  document.querySelectorAll('.panel,.show-map').forEach(panel=>{
    panel.addEventListener('pointermove',event=>{
      const rect=panel.getBoundingClientRect();
      panel.style.setProperty('--mx',String(event.clientX-rect.left)+'px');
      panel.style.setProperty('--my',String(event.clientY-rect.top)+'px');
    },{passive:true});
  });
}
if (window.CuePatchAndroid) {
  const target=document.getElementById('mode');
  if(target) {
    const model=document.createElement('button');
    model.type='button';model.className='example';model.textContent='Check on-device model';
    model.onclick=()=>window.CuePatchAndroid.postMessage(JSON.stringify({action:'modelStatus'}));
    target.insertAdjacentElement('afterend',model);
  }
}
const offlineStatus=document.getElementById('offline-status');
if (offlineStatus) {
  if (window.CuePatchAndroid) {
    offlineStatus.textContent='Offline desk installed';
    document.querySelectorAll('a[href$=".apk"]').forEach(link=>link.hidden=true);
  } else if (!('serviceWorker' in navigator) || location.protocol==='file:') {
    offlineStatus.textContent='Offline reload unavailable';
  } else {
    navigator.serviceWorker.register('./sw.js').then(registration=>{
      const update=()=>{if(registration.active?.state==='activated') offlineStatus.textContent='Offline desk ready';};
      const worker=registration.installing;
      worker?.addEventListener('statechange',()=>{
        if(worker.state==='redundant' && !registration.active) offlineStatus.textContent='Offline desk unavailable';
        update();
      });
      update();navigator.serviceWorker.ready.then(update);
    }).catch(()=>{offlineStatus.textContent='Offline desk unavailable';});
  }
}
