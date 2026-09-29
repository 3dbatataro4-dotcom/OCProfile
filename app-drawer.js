/* Personal application drawer and embedded web app launcher. */
(()=>{
  'use strict';
  const KEY='oc_application_drawer_v1';
  const RESTORE_KEY='oc_system_app_cloud_restore_v1';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const forumApp={id:'oc-forum',name:'同人論壇',kind:'internal',icon:'fa-comments',subtitle:'虛擬論壇',order:0,persistentBack:false};
  const lotteryApp={id:'oc-lottery',name:'星願召喚',kind:'internal',icon:'fa-dice',subtitle:'人物抽獎',order:1,persistentBack:false};
  const scoreApp={id:'oc-scoreboard',name:'人物記分板',kind:'internal',icon:'fa-list-ol',subtitle:'人物計分',order:2,persistentBack:false};
  const musicApp={id:'oc-music',name:'音樂媒體',kind:'internal',icon:'fa-headphones',subtitle:'音樂與 MV',order:3,persistentBack:false};
  let apps=[];
  const systemRestoreDefaults={'oc-forum':false,'oc-lottery':false,'oc-scoreboard':false,'oc-music':true};
  function restorePreferences(){try{return {...systemRestoreDefaults,...JSON.parse(localStorage.getItem(RESTORE_KEY)||'{}')};}catch{return {...systemRestoreDefaults};}}
  function setCloudRestore(id,value){const prefs=restorePreferences();prefs[id]=!!value;try{localStorage.setItem(RESTORE_KEY,JSON.stringify(prefs));}catch{}}
  function shouldCloudRestore(id){return restorePreferences()[id]!==false;}
  let drawerOpen=false;
  let embeddedOpen=false;
  let managerOpen=false;
  let activeAppId='';
  let revealTimer=0;
  let previewToken=0;
  function safeApps(input){
    const rows=Array.isArray(input)?input:[];
    const internalApps=[forumApp,lotteryApp,scoreApp,musicApp],internalIds=new Set(internalApps.map(item=>item.id));
    const normalized=[...internalApps.map((base,index)=>{const saved=rows.find(item=>item?.id===base.id);return {...base,order:saved&&Number.isFinite(Number(saved.order))?Number(saved.order):index,persistentBack:!!saved?.persistentBack};}),...rows.filter(item=>item&&!internalIds.has(item.id)&&typeof item.name==='string'&&typeof item.url==='string').map((item,index)=>({id:String(item.id),name:item.name.trim().slice(0,40),url:item.url,category:typeof item.category==='string'?item.category.trim().slice(0,30):'',iconUrl:typeof item.iconUrl==='string'?item.iconUrl:'',faviconUrl:typeof item.faviconUrl==='string'?item.faviconUrl:'',persistentBack:!!item.persistentBack,order:Number.isFinite(Number(item.order))?Number(item.order):index+3})).filter(item=>item.name&&validUrl(item.url))];
    return normalized.sort((a,b)=>a.order-b.order).map((item,index)=>({...item,order:index}));
  }
  function validUrl(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol);}catch{return false;}}
  function settingsRow(){return Array.isArray(mediaLibrary)?mediaLibrary.find(item=>item?.kind==='settings'&&item.id==='__oc_media_settings__'):null;}
  function load(){try{const saved=settingsRow()?.applicationApps??localStorage.getItem(KEY)??'[]';apps=safeApps(Array.isArray(saved)?saved:JSON.parse(saved));}catch{apps=safeApps([]);}}
  function persist(){apps=safeApps(apps);const row=settingsRow()||{id:'__oc_media_settings__',kind:'settings'};if(!settingsRow())mediaLibrary.push(row);row.applicationApps=apps;try{saveStateToLocalStorage();}catch(error){alert('應用已暫存於本頁，但瀏覽器儲存空間不足；請先匯出人設卡備份。');}try{localStorage.setItem(KEY,JSON.stringify(apps));}catch{}}
  function fallbackIcon(url){try{return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(new URL(url).origin)}&sz=128`;}catch{return '';}}
  async function discoverLinkedIcon(url){
    if(!validUrl(url))return '';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);
    try{
      const response=await fetch(url,{mode:'cors',credentials:'omit',redirect:'follow',signal:controller.signal});
      if(!response.ok)return '';
      const html=await response.text(),doc=new DOMParser().parseFromString(html,'text/html');
      const links=[...doc.querySelectorAll('link[rel][href]')].filter(link=>(link.rel||'').toLocaleLowerCase().split(/\s+/).includes('icon'));
      const pngIcons=links.filter(link=>(link.getAttribute('type')||'').trim().toLowerCase()==='image/png');
      const otherIcons=links.filter(link=>!pngIcons.includes(link));
      for(const link of [...pngIcons,...otherIcons]){try{const href=link.getAttribute('href')?.trim();if(!href)continue;const found=new URL(href,response.url||url);if(['http:','https:'].includes(found.protocol))return found.href;}catch{}}
    }catch{}finally{clearTimeout(timer);}
    return '';
  }
  async function resolveIcon(url,custom=''){if(custom&&validUrl(custom))return custom;return await discoverLinkedIcon(url)||(()=>{try{return new URL('/favicon.ico',url).href;}catch{return fallbackIcon(url);}})();}
  function iconMarkup(app){
    if(app.id===forumApp.id)return '<span class="app-tile-icon app-forum-icon"><i class="fa-solid fa-comments"></i><b>✦</b></span>';
    if(app.id===lotteryApp.id)return '<span class="app-tile-icon app-lottery-icon"><i class="fa-solid fa-dice-d20"></i><b>✧</b></span>';
    if(app.id===scoreApp.id)return '<span class="app-tile-icon app-score-icon"><i class="fa-solid fa-ranking-star"></i><b>＋</b></span>';
    if(app.id===musicApp.id)return '<span class="app-tile-icon app-music-icon"><i class="fa-solid fa-headphones"></i><b>♫</b></span>';
    const source=app.iconUrl||app.faviconUrl||(()=>{try{return new URL('/favicon.ico',app.url).href;}catch{return '';}})();
    const fallback=fallbackIcon(app.url);
    return `<span class="app-tile-icon app-site-icon"><img src="${esc(source||fallback)}" alt="" loading="lazy" onerror="OCApps.faviconError(this,'${esc(fallback)}')"><i class="fa-solid fa-globe"></i></span>`;
  }
  function render(){
    $('applicationAppGrid').innerHTML=apps.map((app,index)=>`<article class="application-app-tile" data-app-id="${esc(app.id)}" style="--app-stagger:${Math.min(index,12)*35}ms"><button type="button" class="application-app-launch" onclick="OCApps.launch('${esc(app.id)}')" aria-label="開啟${esc(app.name)}">${iconMarkup(app)}<strong>${esc(app.name)}</strong><small>${esc(app.kind==='internal'?app.subtitle:(app.category||'網址應用'))}</small></button>${managerOpen?`<div class="application-app-edit-actions"><button type="button" class="app-order-handle" aria-label="拖曳排序${esc(app.name)}" title="按住拖曳排序（鍵盤可用上下方向鍵）"><i class="fa-solid fa-grip-vertical"></i></button>${app.kind!=='internal'?`<button type="button" onclick="OCApps.editApp('${esc(app.id)}')" aria-label="編輯${esc(app.name)}" title="編輯"><i class="fa-solid fa-pen"></i></button><button type="button" onclick="OCApps.deleteApp('${esc(app.id)}')" aria-label="刪除${esc(app.name)}" title="刪除"><i class="fa-solid fa-trash"></i></button>`:''}</div>`:''}</article>`).join('')+(managerOpen?'<button type="button" class="application-add-tile" onclick="OCApps.resetEditor()"><span><i class="fa-solid fa-plus"></i></span><strong>新增網址應用</strong><small>加入另一個創作工具</small></button>':'');
    $('applicationManager').hidden=!managerOpen;
    const restoreList=$('systemAppRestoreOptions');if(restoreList)restoreList.innerHTML=[forumApp,lotteryApp,scoreApp,musicApp].map(app=>`<label><input type="checkbox" data-system-restore="${esc(app.id)}" ${shouldCloudRestore(app.id)?'checked':''}><span><strong>${esc(app.name)}</strong><small>全域雲端完整復原時，以雲端資料覆蓋此裝置</small></span></label>`).join('');
    $('applicationDrawer').classList.toggle('is-managing',managerOpen);
    $('applicationDrawer').setAttribute('aria-hidden',String(!drawerOpen));
    $('applicationDrawer').hidden=!drawerOpen;
    $('applicationDrawer').classList.toggle('is-open',drawerOpen);
    $('embeddedApplication').hidden=!embeddedOpen;
    $('embeddedApplication').classList.toggle('is-open',embeddedOpen);
    $('embeddedApplication').setAttribute('aria-hidden',String(!embeddedOpen));
    const activeApp=apps.find(app=>app.id===activeAppId);
    $('embeddedApplication').classList.toggle('has-persistent-back',!!activeApp?.persistentBack);
    $('embeddedApplication').classList.remove('is-back-revealed');
    document.body.classList.toggle('application-overlay-open',drawerOpen||embeddedOpen);
  }
  function guardUrl(){return location.pathname+location.search+'#oc-app';}
  function replaceWithGuard(){try{history.replaceState({ocGuard:true,sessionId:history.state?.sessionId||'oc-app-drawer'},'',guardUrl());}catch{}}
  function openDrawer(){load();if(!drawerOpen){drawerOpen=true;try{history.pushState({ocAppDrawer:true},'',''+location.pathname+location.search+'#oc-app-drawer');}catch{}}render();}
  function closeDrawer(){if(!drawerOpen)return;drawerOpen=false;managerOpen=false;resetEditor();replaceWithGuard();render();}
  function closeDrawerFromBack(){drawerOpen=false;managerOpen=false;resetEditor();render();}
  function toggleManager(){managerOpen=!managerOpen;if(managerOpen)resetEditor();render();if(managerOpen)$('applicationManager').scrollIntoView({behavior:'smooth',block:'start'});}
  function moveApp(id,direction){const index=apps.findIndex(app=>app.id===id),target=index+direction;if(index<0||target<0||target>=apps.length)return;[apps[index],apps[target]]=[apps[target],apps[index]];apps.forEach((app,position)=>app.order=position);persist();render();$('applicationAppGrid').querySelector(`[data-app-id="${CSS.escape(id)}"] .app-order-handle`)?.focus({preventScroll:true});}
  let draggedTile=null,dragPointerId=null,dragStart={x:0,y:0};
  function placeDraggedTile(x,y){if(!draggedTile)return;const target=document.elementFromPoint(x,y)?.closest('.application-app-tile');if(!target||target===draggedTile)return;const rect=target.getBoundingClientRect(),before=y<rect.top+rect.height/2||(Math.abs(y-(rect.top+rect.height/2))<rect.height*.18&&x<rect.left+rect.width/2),grid=$('applicationAppGrid');grid.insertBefore(draggedTile,before?target:target.nextSibling);}
  function finishTileDrag(){if(!draggedTile)return;const grid=$('applicationAppGrid'),ordered=[...grid.querySelectorAll('.application-app-tile[data-app-id]')].map(tile=>apps.find(app=>app.id===tile.dataset.appId)).filter(Boolean);if(ordered.length===apps.length){apps=ordered;apps.forEach((app,index)=>app.order=index);persist();}draggedTile.classList.remove('is-dragging');draggedTile=null;dragPointerId=null;render();}
  function installTileSorting(){const grid=$('applicationAppGrid');grid.addEventListener('pointerdown',event=>{const handle=event.target.closest('.app-order-handle');if(!handle||!managerOpen||event.button!==0)return;draggedTile=handle.closest('.application-app-tile');dragPointerId=event.pointerId;dragStart={x:event.clientX,y:event.clientY};draggedTile.classList.add('is-dragging');event.preventDefault();});document.addEventListener('pointermove',event=>{if(!draggedTile||event.pointerId!==dragPointerId)return;if(Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y)>4){event.preventDefault();placeDraggedTile(event.clientX,event.clientY);}},{passive:false});document.addEventListener('pointerup',event=>{if(draggedTile&&event.pointerId===dragPointerId)finishTileDrag();});document.addEventListener('pointercancel',event=>{if(draggedTile&&event.pointerId===dragPointerId)finishTileDrag();});grid.addEventListener('keydown',event=>{const handle=event.target.closest('.app-order-handle');if(!handle)return;const tile=handle.closest('.application-app-tile'),id=tile?.dataset.appId;if(event.key==='ArrowUp'){event.preventDefault();moveApp(id,-1);}else if(event.key==='ArrowDown'){event.preventDefault();moveApp(id,1);}});}
  function faviconError(image,fallback){if(!image.dataset.fallbackTried&&fallback&&image.src!==fallback){image.dataset.fallbackTried='true';image.src=fallback;return;}image.parentElement?.classList.add('is-failed');image.remove();}
  let previewTimer=0;
  function previewFavicon(){clearTimeout(previewTimer);const token=++previewToken;previewTimer=setTimeout(async()=>{const url=$('appEditorUrl').value.trim(),custom=$('appEditorIcon').value.trim(),preview=$('appEditorIconPreview');preview.classList.remove('is-failed');const source=validUrl(custom)?custom:await resolveIcon(url);if(token!==previewToken)return;preview.innerHTML=source?`<img src="${esc(source)}" alt="" onerror="OCApps.faviconError(this,'${esc(fallbackIcon(url))}')"><i class="fa-solid fa-globe"></i>`:'<i class="fa-solid fa-globe"></i>';},180);}
  function resetEditor(clearId=true){if(clearId)$('appEditorId').value='';$('appEditorName').value='';$('appEditorUrl').value='';$('appEditorCategory').value='';$('appEditorIcon').value='';$('appEditorPersistentBack').checked=false;$('appEditorHeading').textContent='新增網址應用';const preview=$('appEditorIconPreview');preview?.classList.remove('is-launchable');if(preview){preview.title='圖示預覽';preview.setAttribute('aria-disabled','true');preview.tabIndex=-1;}previewFavicon();}
  function editApp(id){const app=apps.find(row=>row.id===id&&row.kind!=='internal');if(!app)return;$('appEditorId').value=app.id;$('appEditorName').value=app.name;$('appEditorUrl').value=app.url;$('appEditorCategory').value=app.category||'';$('appEditorIcon').value=app.iconUrl||'';$('appEditorPersistentBack').checked=!!app.persistentBack;$('appEditorHeading').textContent='編輯應用';const preview=$('appEditorIconPreview');preview?.classList.add('is-launchable');if(preview){preview.title='點擊圖示即可開啟目前應用';preview.removeAttribute('aria-disabled');preview.tabIndex=0;}previewFavicon();$('appEditorName').focus();}
  async function saveApp(){const name=$('appEditorName').value.trim(),url=$('appEditorUrl').value.trim(),category=$('appEditorCategory').value.trim().slice(0,30),iconUrl=$('appEditorIcon').value.trim(),persistentBack=$('appEditorPersistentBack').checked,id=$('appEditorId').value;if(!name)return alert('請輸入應用名稱。');if(!validUrl(url))return alert('請輸入有效的 HTTP 或 HTTPS 網址。');if(iconUrl&&!validUrl(iconUrl))return alert('圖示網址需使用 HTTP 或 HTTPS。');const old=apps.find(app=>app.id===id);const app={id:old?.id||`app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,name,url,category,iconUrl,faviconUrl:iconUrl?'':await resolveIcon(url),persistentBack,order:old?.order??apps.length};apps=old?apps.map(row=>row.id===id?app:row):[...apps,app];persist();render();resetEditor();$('applicationManager').scrollIntoView({behavior:'smooth',block:'start'});}
  function deleteApp(id){const app=apps.find(row=>row.id===id&&row.kind!=='internal');if(!app||!confirm(`刪除「${app.name}」這個應用捷徑？`))return;apps=apps.filter(row=>row.id!==id);persist();if($('appEditorId').value===id)resetEditor();render();}
  function systemDataRow(){return Array.isArray(mediaLibrary)?mediaLibrary.find(row=>row?.id==='__oc_media_settings__'&&row.kind==='settings'):null;}
  async function exportLocalBackup(){try{const row=systemDataRow()||{},music=await window.OCMusic?.exportData?.();const data={format:'oc-system-apps-backup',version:1,exportedAt:new Date().toISOString(),apps,restorePreferences:restorePreferences(),lotteryData:row.lotteryData||null,scoreboardData:row.scoreboardData||null,music};const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`系統應用存檔-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(error){alert(`匯出失敗：${error.message}`);}}
  async function importLocalBackup(input){const file=input.files?.[0];input.value='';if(!file)return;try{const data=JSON.parse(await file.text());if(data.format!=='oc-system-apps-backup'||data.version!==1)throw new Error('這不是系統應用獨立存檔。');if(!confirm('讀取後會以存檔中的召喚、記分板、音樂資料與應用捷徑取代本機對應內容；論壇與人物卡不會變動。確定繼續？'))return;let row=systemDataRow();if(!row){row={id:'__oc_media_settings__',kind:'settings'};mediaLibrary.push(row);}if(data.lotteryData)row.lotteryData=data.lotteryData;if(data.scoreboardData)row.scoreboardData=data.scoreboardData;if(Array.isArray(data.apps)){apps=safeApps(data.apps);row.applicationApps=apps;try{localStorage.setItem(KEY,JSON.stringify(apps));}catch{}}if(data.restorePreferences)localStorage.setItem(RESTORE_KEY,JSON.stringify({...systemRestoreDefaults,...data.restorePreferences}));if(data.music)await window.OCMusic?.importData?.(data.music);saveStateToLocalStorage();render();alert('系統應用存檔已讀取。');}catch(error){alert(`讀取失敗：${error.message}`);}}
  function launchUrl(id,name,url){if(!validUrl(url))return alert('這個應用網址無效，請在「管理應用」中修改。');activeAppId=id;embeddedOpen=true;$('embeddedAppName').textContent=name||'應用';$('embeddedAppExternal').href=url;try{history.pushState({ocEmbeddedApp:true},'',''+location.pathname+location.search+'#oc-app-embed');}catch{}render();const frame=$('embeddedAppFrame');frame.src='about:blank';requestAnimationFrame(()=>{if(embeddedOpen&&activeAppId===id)frame.src=url;});}
  function launch(id){const app=apps.find(row=>row.id===id);if(!app)return;if(app.id===forumApp.id){closeDrawer();window.OCForum?.open?.();return;}if(app.id===lotteryApp.id){closeDrawer();window.OCLottery?.open?.();return;}if(app.id===scoreApp.id){closeDrawer();window.OCScoreboard?.open?.();return;}if(app.id===musicApp.id){closeDrawer();window.OCMusic?.open?.();return;}launchUrl(app.id,app.name,app.url);}
  function launchEditorApp(){const id=$('appEditorId').value;if(!id)return;launchUrl(id,$('appEditorName').value.trim(),$('appEditorUrl').value.trim());}
  function revealBackBar(){const overlay=$('embeddedApplication');if(!embeddedOpen||overlay.classList.contains('has-persistent-back'))return;overlay.classList.add('is-back-revealed');clearTimeout(revealTimer);revealTimer=setTimeout(()=>overlay.classList.remove('is-back-revealed'),3600);}
  function closeEmbedded(fromBack=false){if(!embeddedOpen)return;embeddedOpen=false;activeAppId='';clearTimeout(revealTimer);$('embeddedAppFrame').src='about:blank';if(!fromBack)replaceWithGuard();render();}
  function closeEmbeddedButton(){closeEmbedded(false);}
  function handleBack(){if(embeddedOpen){closeEmbedded(true);return true;}if(drawerOpen){closeDrawerFromBack();return true;}return false;}
  function install(){load();installTileSorting();const preview=$('appEditorIconPreview');preview?.addEventListener('click',()=>{if(preview.classList.contains('is-launchable'))launchEditorApp();});preview?.addEventListener('keydown',event=>{if(preview.classList.contains('is-launchable')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();launchEditorApp();}});preview?.setAttribute('role','button');preview?.setAttribute('tabindex','0');const edge=$('embeddedBackReveal');let start=null;edge.addEventListener('touchstart',event=>{if(event.touches.length===1)start={y:event.touches[0].clientY,x:event.touches[0].clientX};},{passive:true});edge.addEventListener('touchend',event=>{if(!start)return;const dy=event.changedTouches[0].clientY-start.y,dx=event.changedTouches[0].clientX-start.x;if(dy>24&&Math.abs(dx)<70)revealBackBar();start=null;},{passive:true});edge.addEventListener('pointerenter',()=>{if(matchMedia('(hover:hover)').matches)revealBackBar();});document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(embeddedOpen)closeEmbeddedButton();else if(drawerOpen)closeDrawer();}});}
  window.OCApps={openDrawer,closeDrawer,toggleManager,launch,launchEditorApp,editApp,deleteApp,moveApp,saveApp,resetEditor,previewFavicon,faviconError,revealBackBar,closeEmbedded:closeEmbeddedButton,handleBack,shouldCloudRestore,exportLocalBackup,importLocalBackup};
  document.addEventListener('change',event=>{const input=event.target.closest('[data-system-restore]');if(input)setCloudRestore(input.dataset.systemRestore,input.checked);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
