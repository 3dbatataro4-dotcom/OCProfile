/* Loads the CG, scenes, sprites, music and effects of chosen visual-novel chapters before reading.
   Images stay decoded in memory; audio is held as a full download, and OCVnAssets.resolve hands the player that copy. */
(()=>{'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const KINDS={cg:'CG',bg:'場景',sprite:'立繪',bgm:'音樂',se:'音效'},AUDIO=new Set(['bgm','se']),WORKERS=4;
  const status=new Map();   // source value -> 'done' | 'failed'
  const keepImages=new Map(),keepAudio=new Map(),audioCopies=new Map(); // resolved url -> decoded image / buffering element / blob url
  let selected=new Set(),filter='',job=null;

  const isVn=doc=>!!doc?.visualNovel?.scriptText?.trim();
  const vnDocs=()=>documents.filter(isVn);
  const label=doc=>doc.title||'未命名章節';

  function speakerOf(doc,name,cast){if(['旁白','系統','narrator','system'].includes(String(name||'').toLowerCase()))return null;const profile=doc.visualNovel?.characterProfiles?.find(p=>[p.displayName,...String(p.aliases||'').split(/[,，、/]/)].some(n=>n?.trim()===name));return cast.find(c=>String(c.id)===String(profile?.charId))||cast.find(c=>c.name===name||c.englishName===name||String(c.aliases||'').split(/[,，、]/).some(n=>n.trim()===name))||window.OCVnPersona?.guest?.(doc,name)||null;}
  function spriteImages(doc,char){if(char?.isStoryGuest)return char.images||{};return window.OCVnStudio?.entry?.(doc,char)?.images||{};}

  // Everything a chapter can show or play, following the same lookups as the player.
  function collect(doc){const items=new Map(),cfg=window.OCVnPage?.configFor?.(doc)||{},cues=cfg.cues||{},cast=window.OCVnStudio?.cast?.(doc)||OCRecordPolicy.characters();
    const add=(value,kind)=>{const v=String(value||'').trim();if(!v||['none','-','default'].includes(v.toLowerCase())||items.has(v))return;items.set(v,kind);};
    const assetOf=id=>mediaLibrary.find(row=>row.id===id&&row.kind==='vn-asset'),rowSource=row=>row&&(row.url||`asset:${row.id}`);
    for(const event of parseVisualNovelScript(doc.visualNovel.scriptText)){
      if(['cg','bg','bgm','se'].includes(event.type)){add(event.value,event.type);continue;}
      if(event.type==='sys'&&event.command==='show'){const char=speakerOf(doc,event.args?.[0],cast),images=spriteImages(doc,char);add(event.args?.[3]||images[event.args?.[1]||'普通']||images['普通']||char?.avatar,'sprite');continue;}
      if(event.type!=='dialogue')continue;
      const cue=cues[event.sourceLineIndex]||{};if(cue.sceneId&&cfg.autoScene)add(rowSource(assetOf(cue.sceneId)),'bg');if(cue.musicId)add(rowSource(assetOf(cue.musicId)),'bgm');
      const char=speakerOf(doc,event.speaker,cast);if(!char||(char.isBookNPC&&char.showSprite===false)||(char.isStoryGuest&&cfg.guest?.showSprite===false))continue;
      const images=spriteImages(doc,char),mood=event.emotion||cue.emotion||'普通',profile=doc.visualNovel?.characterProfiles?.find(p=>String(p.charId)===String(char.id));
      add(profile?.avatar,'sprite');add(images[mood]||images['普通']||char.avatar,'sprite');if(cfg.mode==='classic')add(char.avatar,'sprite');
    }
    add(doc.visualNovel?.settings?.globalBgm,'bgm');return items;}
  function collectMany(docs){const all=new Map();for(const doc of docs)for(const [value,kind] of collect(doc))if(!all.has(value))all.set(value,{kind,doc:label(doc)});return all;}
  function missingCount(doc){let n=0;for(const value of collect(doc).keys())if(status.get(value)!=='done')n++;return n;}

  async function resolveAny(value){const match=String(value).match(/^asset:([a-zA-Z0-9_-]+)$/);if(match){const row=mediaLibrary.find(item=>item.id===match[1]);if(!row)throw new Error('素材已被移除');return window.OCFeatures.source(row);}return value;}
  function withTimeout(start,ms,message){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(message)),ms);start(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
  async function loadImage(url){if(keepImages.has(url))return;await withTimeout((ok,fail)=>{const image=new Image();image.onload=async()=>{try{await image.decode();}catch{}keepImages.set(url,image);ok();};image.onerror=()=>fail(new Error('圖片無法載入'));image.src=url;},90000,'圖片載入逾時');try{await window.OCVnPersona?.imageInfo?.(url);}catch{}}
  async function loadAudio(url){if(url.startsWith('blob:')||url.startsWith('data:')||audioCopies.has(url)||keepAudio.has(url))return;
    try{const response=await fetch(url,{mode:'cors',credentials:'omit'});if(!response.ok)throw new Error(`HTTP ${response.status}`);audioCopies.set(url,URL.createObjectURL(await response.blob()));return;}catch{}
    // Hosts without CORS cannot be copied; let the browser buffer them instead.
    await withTimeout((ok,fail)=>{const audio=new Audio();audio.preload='auto';audio.addEventListener('canplaythrough',()=>{keepAudio.set(url,audio);ok();},{once:true});audio.addEventListener('error',()=>fail(new Error('音訊無法載入')),{once:true});audio.src=url;audio.load();},120000,'音訊載入逾時');}
  async function loadOne(value,kind){const url=await resolveAny(value);if(AUDIO.has(kind))await loadAudio(url);else await loadImage(url);}

  async function start(){if(job?.running)return;const docs=[...selected].map(id=>documents.find(d=>d.id===id)).filter(isVn);if(!docs.length)return;const all=collectMany(docs),queue=[...all].filter(([value])=>status.get(value)!=='done');
    job={running:true,cancelled:false,total:queue.length,finished:0,failed:[],current:''};paint();let cursor=0;
    await Promise.all(Array.from({length:Math.min(WORKERS,queue.length)},async()=>{while(cursor<queue.length&&!job.cancelled){const [value,info]=queue[cursor++];job.current=`${KINDS[info.kind]} · ${info.doc}`;paintProgress();try{await loadOne(value,info.kind);status.set(value,'done');}catch(error){status.set(value,'failed');job.failed.push({name:assetName(value),kind:info.kind,doc:info.doc,reason:error.message||'載入失敗'});}job.finished++;paintProgress();}}));
    job.running=false;job.current='';paint();}
  function assetName(value){const id=String(value).match(/^asset:(.+)$/)?.[1];if(id){const row=mediaLibrary.find(item=>item.id===id);return row?.title||row?.caption||id;}try{return decodeURIComponent(new URL(value).pathname.split('/').pop())||value;}catch{return String(value).slice(0,40);}}
  function release(){if(job?.running)return;for(const url of audioCopies.values())URL.revokeObjectURL(url);audioCopies.clear();keepImages.clear();for(const audio of keepAudio.values())audio.removeAttribute('src');keepAudio.clear();status.clear();job=null;paint();}

  function bookGroups(){const docs=vnDocs(),q=filter.trim().toLowerCase(),match=doc=>!q||label(doc).toLowerCase().includes(q)||String(books.find(b=>b.id===doc.bookId)?.title||'').toLowerCase().includes(q),groups=books.map(book=>({id:book.id,title:book.title||'未命名書籍',docs:docs.filter(doc=>doc.bookId===book.id&&match(doc))})).filter(g=>g.docs.length),loose=docs.filter(doc=>!books.some(b=>b.id===doc.bookId)&&match(doc));if(loose.length)groups.push({id:'',title:'獨立文檔',docs:loose});return groups;}
  function chapterRow(doc){const items=collect(doc),left=missingCount(doc),ready=items.size>0&&left===0;return `<label class="vnpl-chapter"><input type="checkbox" data-vnpl-doc="${esc(doc.id)}" ${selected.has(doc.id)?'checked':''}><span>${esc(label(doc))}</span><small class="${ready?'is-ready':''}">${ready?'<i class="fa-solid fa-check"></i> 已加載':`${items.size} 項素材`}</small></label>`;}
  function groupHtml(group,open){const on=group.docs.filter(d=>selected.has(d.id)).length;return `<details class="vnpl-book" ${open?'open':''}><summary><input type="checkbox" data-vnpl-book="${esc(group.id)}" ${on===group.docs.length?'checked':''} ${on&&on<group.docs.length?'data-partial="1"':''} aria-label="全選 ${esc(group.title)}"><b>${esc(group.title)}</b><small>${on?`已選 ${on}／`:''}${group.docs.length} 章</small></summary><div>${group.docs.map(chapterRow).join('')}</div></details>`;}
  function summaryHtml(){const docs=[...selected].map(id=>documents.find(d=>d.id===id)).filter(isVn);if(!docs.length)return '<span>請勾選書籍或章節。</span>';const all=collectMany(docs),count={};let left=0;for(const [value,info] of all){count[info.kind]=(count[info.kind]||0)+1;if(status.get(value)!=='done')left++;}return `<span><b>${docs.length}</b> 章 · <b>${all.size}</b> 項素材${left<all.size?`（${all.size-left} 項已加載）`:''}</span><em>${Object.keys(KINDS).filter(k=>count[k]).map(k=>`${KINDS[k]} ${count[k]}`).join(' · ')||'這些章節沒有用到素材'}</em>`;}
  function progressHtml(){if(!job)return '';const pct=job.total?Math.round(job.finished/job.total*100):100,failed=job.failed.length;return `<section class="vnpl-progress"><div class="vnpl-bar"><i data-vnpl-bar style="width:${pct}%"></i></div><p data-vnpl-text>${progressText()}</p>${!job.running&&failed?`<details class="vnpl-failed" open><summary>${failed} 項無法載入</summary><ul>${job.failed.slice(0,30).map(row=>`<li><b>${esc(KINDS[row.kind])}</b> ${esc(row.name)} <small>${esc(row.doc)}｜${esc(row.reason)}</small></li>`).join('')}</ul><p>雲端素材需要先登入。閱讀時這些素材會照常即時載入。</p></details>`:''}</section>`;}
  function progressText(){if(!job)return '';if(job.running)return `正在加載 ${job.finished}／${job.total}${job.current?` · ${esc(job.current)}`:''}`;if(job.cancelled)return `已停止，完成 ${job.finished}／${job.total} 項。`;if(!job.total)return '所選章節的素材都已加載完成。';return job.failed.length?`完成 ${job.finished-job.failed.length}／${job.total} 項。`:`全部完成，共 ${job.total} 項。現在可以開始閱讀了。`;}
  function paintProgress(){const bar=document.querySelector('[data-vnpl-bar]'),text=document.querySelector('[data-vnpl-text]');if(bar&&job)bar.style.width=`${job.total?Math.round(job.finished/job.total*100):100}%`;if(text)text.innerHTML=progressText();}
  function paint(focusBook=''){const modal=$('vnPreloadModal');if(!modal?.classList.contains('active'))return;const list=modal.querySelector('[data-vnpl-list]'),openBooks=new Set([...modal.querySelectorAll('.vnpl-book[open] [data-vnpl-book]')].map(n=>n.dataset.vnplBook)),scroll=list?.scrollTop||0,groups=bookGroups();
    list.innerHTML=groups.map(g=>groupHtml(g,focusBook===g.id||openBooks.has(g.id)||!!filter.trim()||groups.length===1)).join('')||'<p class="vnpl-empty">沒有符合的視覺小說章節。</p>';list.scrollTop=scroll;
    list.querySelectorAll('[data-partial]').forEach(n=>{n.indeterminate=true;});
    modal.querySelector('[data-vnpl-summary]').innerHTML=summaryHtml();modal.querySelector('[data-vnpl-progress]').innerHTML=progressHtml();
    const running=!!job?.running,go=modal.querySelector('[data-vnpl-start]');go.hidden=running;go.disabled=!selected.size;modal.querySelector('[data-vnpl-stop]').hidden=!running;modal.querySelector('[data-vnpl-release]').hidden=running||!status.size;}
  function open(bookId=''){let modal=$('vnPreloadModal');if(!modal){modal=document.createElement('div');modal.id='vnPreloadModal';modal.className='modal-backdrop vnpl-backdrop';modal.innerHTML=`<div class="modal-box vnpl-box" role="dialog" aria-modal="true" aria-labelledby="vnplTitle"><header class="vnpl-head"><div><small>STORY PRELOAD</small><h2 id="vnplTitle">視覺小說預加載</h2><p>選擇書籍或章節，先把用到的 CG、場景、立繪、音樂與音效載入，閱讀時就不會卡頓。</p></div><button type="button" class="vnpl-close" data-vnpl-close aria-label="關閉"><i class="fa-solid fa-xmark"></i></button></header><label class="vnpl-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-vnpl-search placeholder="搜尋書名或章節"></label><div class="vnpl-list" data-vnpl-list></div><div data-vnpl-progress></div><footer class="vnpl-foot"><div class="vnpl-summary" data-vnpl-summary></div><div class="vnpl-actions"><button type="button" class="btn btn-outline" data-vnpl-release title="清除已加載的素材，釋放記憶體">釋放記憶體</button><button type="button" class="btn btn-outline" data-vnpl-stop hidden>停止</button><button type="button" class="btn btn-primary" data-vnpl-start><i class="fa-solid fa-cloud-arrow-down"></i> 開始加載</button></div></footer></div>`;document.body.append(modal);modal.addEventListener('click',onClick);modal.addEventListener('change',onChange);modal.addEventListener('input',onInput);}
    if(bookId)for(const doc of vnDocs())if(doc.bookId===bookId)selected.add(doc.id);if(bookId&&!vnDocs().some(doc=>doc.bookId===bookId)&&typeof showToast==='function')showToast('這本書還沒有視覺小說章節。');selected=new Set([...selected].filter(id=>isVn(documents.find(d=>d.id===id))));modal.classList.add('active');paint(bookId);}
  function onClick(event){const t=event.target;if(t===event.currentTarget||t.closest('[data-vnpl-close]')){event.currentTarget.classList.remove('active');return;}if(t.closest('[data-vnpl-start]')){start();return;}if(t.closest('[data-vnpl-stop]')){if(job)job.cancelled=true;return;}if(t.closest('[data-vnpl-release]'))release();if(t.matches('summary input'))event.stopPropagation();}
  function onChange(event){const t=event.target;if(t.dataset.vnplDoc){t.checked?selected.add(t.dataset.vnplDoc):selected.delete(t.dataset.vnplDoc);paint();return;}if(t.dataset.vnplBook!==undefined){for(const doc of vnDocs().filter(d=>t.dataset.vnplBook?d.bookId===t.dataset.vnplBook:!books.some(b=>b.id===d.bookId)))t.checked?selected.add(doc.id):selected.delete(doc.id);paint();}}
  function onInput(event){if(event.target.matches('[data-vnpl-search]')){filter=event.target.value;paint();}}
  window.OCVnPreload={open,collect,held:url=>audioCopies.get(url)||''};
})();
