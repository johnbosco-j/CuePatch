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
menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
navigation.addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && menu.getAttribute('aria-expanded')==='true'){
    setMenu(false);menu.focus();
  }
});
document.addEventListener('pointerdown',event=>{
  if(!event.target.closest('.capsule') && menu.getAttribute('aria-expanded')==='true') setMenu(false);
});
const sections = [...navigation.querySelectorAll('a[href^="#"]')].filter(link=>link.hash!=='#top');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    const current = entries.find(entry => entry.isIntersecting);
    if (!current) return;
    for (const link of sections) {
      if (link.hash === '#' + current.target.id) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
  }, {rootMargin:'-10% 0px -30% 0px'});
  for (const link of sections) observer.observe(document.querySelector(link.hash));
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
const offlineStatus=document.getElementById('offline-status');
if (offlineStatus) {
  if (!('serviceWorker' in navigator) || location.protocol==='file:') {
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
