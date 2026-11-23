function openIssuedCopy() {
  const root=document.getElementById('crew-page');
  try {
    const copy=CrewCopy.read(location.hash);
    CrewPage.render(document,root,copy);
    const print=document.createElement('button');print.type='button';print.textContent='Print crew copy';print.onclick=()=>window.print();root.append(print);
  } catch {
    document.title='CuePatch · Crew copy';
    const heading=document.createElement('h1');heading.textContent='Crew copy unavailable';
    const message=document.createElement('p');message.textContent='Ask the show caller for the complete crew link or the offline HTML copy.';
    root.replaceChildren(heading,message);
  }
}
window.addEventListener('hashchange',openIssuedCopy);openIssuedCopy();
