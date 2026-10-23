/* Always-visible desktop vertical controls, synchronized with native scrolling. */
(()=>{
 const bound=new WeakSet();
 function bind(editor){if(bound.has(editor))return;let host=editor.closest('.vnp-script-shell');if(editor.id==='vnScriptText'&&!host)return;if(!host){host=document.createElement('div');editor.before(host);host.append(editor);}bound.add(editor);host.classList.add('oc-vertical-scroll-host');const rail=document.createElement('input');rail.type='range';rail.min='0';rail.max='10000';rail.step='1';rail.value='0';rail.className='oc-vertical-scroll';rail.setAttribute('aria-label',editor.id==='vnScriptText'?'劇本直向捲動進度':'文檔直向捲動進度');rail.setAttribute('aria-orientation','vertical');host.append(rail);
  const update=()=>{const max=editor.scrollHeight-editor.clientHeight;rail.hidden=max<2||!editor.clientHeight;rail.value=max>0?Math.round(editor.scrollTop/max*10000):0;rail.setAttribute('aria-valuetext',Math.round(Number(rail.value)/100)+'%');rail.style.top=(editor.offsetTop+5)+'px';rail.style.height=Math.max(20,editor.offsetHeight-10)+'px';rail.style.setProperty('--oc-scroll-thumb',Math.max(25,Math.min(90,editor.clientHeight/editor.scrollHeight*editor.clientHeight))+'px');};
  rail.addEventListener('input',()=>{editor.scrollTop=(editor.scrollHeight-editor.clientHeight)*Number(rail.value)/10000;update();});editor.addEventListener('scroll',update,{passive:true});editor.addEventListener('input',()=>requestAnimationFrame(update));new ResizeObserver(update).observe(editor);update();
 }
 let queued=false;const scan=()=>{queued=false;document.querySelectorAll('#vnScriptText,#docContent').forEach(bind);};new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(scan);}}).observe(document.body,{childList:true,subtree:true});scan();
})();
