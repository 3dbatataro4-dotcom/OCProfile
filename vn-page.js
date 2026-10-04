/* Advanced visual-novel page options. The original reader remains the default. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const id=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const moods=['開心','悲傷','感動','浪漫','恐怖','憤怒','俏皮','寧靜','日常','神秘','嚴肅','緊張'];
  const expressions=['普通','喜','怒','哀','樂','驚'];
  const promptDefaults={
    speaker:'你只負責替已編號的原文片段判斷說話者，絕對不要回傳、抄寫、摘要或改寫原文。程式已依「……」拆分內容：isSystem=true 或整行由【】包住時一律標系統；其餘 isDialogue=false 標旁白，isDialogue=true 才判斷角色。每段對話都是獨立事件，絕對不可把兩段合併。輸出必須是單一 JSON 物件，鍵是每個 ID，值只能是「旁白」、「系統」、「路人」或可用角色的完整名稱。每個收到的 ID 都必須恰好出現一次。利用相鄰片段的說話線索判斷；找不到人物線索時才標路人。',
    scene:'先依故事開頭選擇一個適合的場景，在第一句回傳已提供的場景素材 ID。之後只有地點或時間造成畫面明顯轉換時才回傳新 ID；同一場景持續時回傳空字串。',
    music:'先依故事開頭選擇一首適合的背景音樂，在第一句回傳已提供的音樂 ID。之後以完整段落與場景為單位判斷，只有情緒明顯且持續轉折時才換曲，同一段至少維持約十句台詞；其餘回傳空字串。',
    emotion:'判斷人物情緒（普通、喜、怒、哀、樂、驚或素材庫已有的自訂情緒）與橫版站位（left、center、right）；旁白不需站位。',
    hide:'判斷橫版何時應降下所有說話人，例如對話結束、轉入純旁白段落或切換場景。只有需要清空畫面人物的第一句回傳 true，其餘回傳 false。'
  };
  const promptNames={speaker:'說話人',scene:'場景切換',music:'背景音樂',emotion:'情緒與站位',hide:'降下所有說話人'};
  function promptFor(kind,doc){let global={};try{global=JSON.parse(localStorage.getItem('vnp-ai-prompt-defaults')||'{}');}catch{}return [global[kind]||promptDefaults[kind],doc?.visualNovelPage?.promptOverrides?.[kind]].filter(Boolean).join('\n\n本篇補充：\n');}
  function renderPromptEditor(){const box=$('vnpPromptFields'),doc=documents.find(row=>row.id===$('vnDocumentId')?.value);if(!box||!doc)return;let global={};try{global=JSON.parse(localStorage.getItem('vnp-ai-prompt-defaults')||'{}');}catch{}box.innerHTML=Object.keys(promptDefaults).map(kind=>`<section><h4>${promptNames[kind]}</h4><label>預設指令<textarea data-prompt-kind="${kind}" data-prompt-scope="global" rows="4">${esc(global[kind]||promptDefaults[kind])}</textarea></label><label>本篇補充<textarea data-prompt-kind="${kind}" data-prompt-scope="story" rows="3" placeholder="只在這篇故事增加判斷條件">${esc(doc.visualNovelPage?.promptOverrides?.[kind]||'')}</textarea></label></section>`).join('');}
  document.addEventListener('change',event=>{const field=event.target.closest?.('#vnpPromptFields [data-prompt-kind]');if(!field)return;const kind=field.dataset.promptKind,value=field.value.trim();if(field.dataset.promptScope==='global'){let global={};try{global=JSON.parse(localStorage.getItem('vnp-ai-prompt-defaults')||'{}');}catch{}if(value)global[kind]=value;else delete global[kind];localStorage.setItem('vnp-ai-prompt-defaults',JSON.stringify(global));}else{const doc=documents.find(row=>row.id===$('vnDocumentId')?.value);if(!doc)return;doc.visualNovelPage=doc.visualNovelPage||{};doc.visualNovelPage.promptOverrides={...(doc.visualNovelPage.promptOverrides||{}),[kind]:value};saveStateToLocalStorage();}});
  const defaultConfig=()=>({mode:'classic',sceneFolderIds:[],sceneAssetIds:[],musicFolderIds:[],musicAssetIds:[],allMusic:false,spriteLibraryId:'',layoutTemplateId:'',highlightSpeaker:true,avatarCharacterIds:[],autoScene:false,cues:{}});
  let context=null,modal=null,player=null,events=[],eventIndex=-1,currentDoc=null,currentConfig=null,playing=false,autoTimer=0,openingTimer=0,typingTimer=0,skipTimer=0,skipMode=false,skipBusy=false,typingFullText='',typeAudio=null,orientationHandler=null,history=[],sceneSource='',cgSource='',activeMusicId='',music=null,menuOpen=false,autoMode=false;
  let dialogueCount=0,lastMusicChangeAt=-Infinity,pendingMusicId='';
  const resolvedAssetIds=new Map();
  async function prepareOpening(){const first=events.find(event=>event.type==='bg'&&event.value&&event.value!=='none');if(first){sceneSource=await source(first.value);applyScene();}else{const firstCue=Object.values(currentConfig?.cues||{}).find(cue=>cue.sceneId),row=assets('bg').find(item=>item.id===firstCue?.sceneId);if(row){sceneSource=await source(row.url||`asset:${row.id}`);applyScene();}}openingTimer=setTimeout(()=>{$('vnpOpening')?.classList.add('is-gone');next();},1700);}
  const assets=type=>mediaLibrary.filter(row=>row?.kind==='vn-asset'&&row.assetType===type&&row.listed!==false);
  const folders=type=>mediaLibrary.filter(row=>row?.kind==='vn-folder'&&row.assetType===type);
  const libraries=()=>mediaLibrary.filter(row=>row?.kind==='vn-sprite-library');
  function inheritsBook(doc){
    if(!books.some(book=>book.id===doc?.bookId))return false;
    const own=doc.visualNovelPage||{};
    if(typeof own.inheritBook==='boolean')return own.inheritBook;
    const defaults=defaultConfig();
    return !Object.keys(defaults).some(key=>key!=='cues'&&Object.hasOwn(own,key)&&JSON.stringify(own[key])!==JSON.stringify(defaults[key]));
  }
  function configFor(doc){
    const parent=books.find(book=>book.id===doc?.bookId)?.visualNovelPage||{},own=doc?.visualNovelPage||{},overrides={};
    if(!inheritsBook(doc))for(const [key,value] of Object.entries(own)){
      if(own.inheritBook===false||(!Array.isArray(value)&&value!==''&&value!=null)||(Array.isArray(value)&&value.length))overrides[key]=value;
    }
    return {...defaultConfig(),...parent,...overrides,cues:own.cues||{}};
  }
  function classicCue(doc,event){
    const cue=configFor(doc).cues?.[event?.sourceLineIndex]||{};
    const scene=linkedAssets(doc,'bg').find(row=>row.id===cue.sceneId);
    const track=linkedAssets(doc,'bgm').find(row=>row.id===cue.musicId);
    return {sceneSource:scene?(scene.url||`asset:${scene.id}`):'',musicSource:track?(track.url||`asset:${track.id}`):''};
  }
  const scopeRecord=()=>context?.type==='book'?books.find(row=>row.id===context.id):documents.find(row=>row.id===context?.id);
  const scopeLabel=()=>context?.type==='book'?'整本書':'本篇文章';
  function requireSaved(type,recordId){if(recordId)return true;alert(`請先儲存${type==='book'?'書籍':'文檔'}，再設定視覺小說頁面。`);return false;}
  function openFromBook(){const recordId=$('bookId')?.value;if(requireSaved('book',recordId))open('book',recordId);}
  function openFromDocument(){const recordId=$('docId')?.value;if(requireSaved('doc',recordId))open('doc',recordId);}
  function openFromEditor(){const recordId=$('vnDocumentId')?.value;if(requireSaved('doc',recordId))open('doc',recordId);}
  function open(type,recordId){context={type,id:recordId};if(!scopeRecord())return;modal=$('vnPageModal');if(!modal){modal=document.createElement('div');modal.id='vnPageModal';modal.className='modal-backdrop vn-page-backdrop';document.body.append(modal);}modal.replaceChildren();renderSettings();modal.classList.add('active');}
  function settingsDraft(){if(!modal?.querySelector('[name="vnpMode"]'))return null;const folderIds=[...modal.querySelectorAll('[data-link-folder]:checked')].map(el=>el.dataset.linkFolder),assetIds=[...modal.querySelectorAll('[data-link-asset]:checked')].map(el=>el.dataset.linkAsset);return {mode:modal.querySelector('[name="vnpMode"]:checked')?.value||'classic',sceneFolderIds:folderIds.filter(id=>folders('bg').some(row=>row.id===id)),musicFolderIds:folderIds.filter(id=>folders('bgm').some(row=>row.id===id)),sceneAssetIds:assetIds.filter(id=>assets('bg').some(row=>row.id===id)),musicAssetIds:assetIds.filter(id=>assets('bgm').some(row=>row.id===id)),spriteLibraryId:$('vnpSpriteLibrary')?.value||'',layoutTemplateId:$('vnpLayoutTemplate')?.value||'',highlightSpeaker:!!$('vnpHighlight')?.checked,autoScene:!!$('vnpAutoScene')?.checked,allMusic:!!$('vnpAllMusic')?.checked};}
  function close(){modal?.classList.remove('active');context=null;}
  function optionGrid(type,selectedFolders,selectedAssets){const label=type==='bg'?'場景':'音樂',rows=assets(type),group=folders(type);return `<section class="vnp-panel"><div class="vnp-panel-head"><div><small>${type==='bg'?'SCENE LIBRARY':'MUSIC LIBRARY'}</small><h3>關聯${label}素材</h3></div><button type="button" class="btn btn-xs btn-outline" data-action="open-library" data-type="${type}">管理共用素材庫 ↗</button></div><p class="vnp-help">勾選這本書／篇文檔可使用的資料夾或個別素材。素材新增與編輯在共用素材庫完成。</p><div class="vnp-folder-list">${group.map(folder=>`<label><input type="checkbox" data-link-folder="${esc(folder.id)}" ${selectedFolders.includes(folder.id)?'checked':''}><span><i class="fa-solid fa-folder"></i> ${esc(folder.name)}</span></label>`).join('')||'<small>尚無資料夾</small>'}</div><div class="vnp-asset-list">${rows.map(row=>`<label><input type="checkbox" data-link-asset="${esc(row.id)}" ${selectedAssets.includes(row.id)?'checked':''}><span>${esc(row.title||'未命名')}${row.folderId?` <small>· ${esc(group.find(folder=>folder.id===row.folderId)?.name||'')}</small>`:''}${type==='bgm'?` <small>${esc((row.tags||[]).join('、'))}</small>`:''}</span></label>`).join('')||'<small>尚無素材</small>'}</div>${type==='bgm'?'<label class="vnp-check"><input id="vnpAllMusic" type="checkbox"> 包含整個音樂庫（之後新增的音樂也會納入）</label>':''}</section>`;}
  function spritePanel(config){return `<section class="vnp-panel"><div class="vnp-panel-head"><div><small>CAST & EXPRESSIONS</small><h3>關聯立繪素材庫</h3></div><button type="button" class="btn btn-xs btn-outline" data-action="open-library" data-type="sprite">管理共用素材庫 ↗</button></div><label class="vnp-field">${scopeLabel()}使用的立繪庫<select id="vnpSpriteLibrary"><option value="">不使用（人物頭像）</option>${libraries().map(row=>`<option value="${esc(row.id)}" ${config.spriteLibraryId===row.id?'selected':''}>${esc(row.name)}</option>`).join('')}</select></label><div id="vnpSpriteEditor"></div></section>`;}
  function renderSettings(){const record=scopeRecord(),config={...(context?.type==='doc'?configFor(record):{...defaultConfig(),...(record?.visualNovelPage||{})}),...(settingsDraft()||{})};modal.innerHTML=`<div class="modal-box modal-lg vnp-shell" role="dialog" aria-modal="true"><header class="vnp-header"><div><small>VISUAL NOVEL · PAGE STUDIO</small><h2>視覺小說頁面設置</h2><p>${esc(record?.title||'')} · ${scopeLabel()}</p></div><button type="button" data-action="close" aria-label="關閉">×</button></header><div class="vnp-body"><section class="vnp-panel"><div class="vnp-panel-head"><div><small>READING EXPERIENCE</small><h3>對話模板</h3></div></div><div class="vnp-mode-grid"><label><input type="radio" name="vnpMode" value="classic" ${config.mode==='classic'?'checked':''}><b>原版視覺小說</b><small>沿用目前閱讀介面 · 預設</small></label><label><input type="radio" name="vnpMode" value="landscape" ${config.mode==='landscape'?'checked':''}><b>進階橫版</b><small>左・中・右，最多三位人物</small></label><label><input type="radio" name="vnpMode" value="portrait" ${config.mode==='portrait'?'checked':''}><b>進階直版</b><small>單一正比立繪與漸層對話框</small></label></div><label class="vnp-check"><input id="vnpHighlight" type="checkbox" ${config.highlightSpeaker!==false?'checked':''}> 橫版微微高亮並放大說話者，其他人物稍微壓暗</label><label class="vnp-check"><input id="vnpAutoScene" type="checkbox" ${config.autoScene?'checked':''}> 舊版逐句場景標註自動切換</label></section>${optionGrid('bg',config.sceneFolderIds||[],config.sceneAssetIds||[])}${optionGrid('bgm',config.musicFolderIds||[],config.musicAssetIds||[])}${spritePanel(config)}<section class="vnp-panel"><small>MANUAL NOTES</small><h3>腳本與 AI 分工</h3><p>說話人仍在原編輯器判斷。場景、人物情緒／橫版站位、音樂各有獨立 AI 按鈕；AI 將場景、音樂與人物退場寫入劇本指令，不改寫原文台詞。劇本可用 <code>@bg</code>、<code>@cg</code>、<code>@bgm</code> 及 <code>none</code> 手動切換。進階閱讀器支援每句手動修正。</p></section></div><footer class="vnp-footer"><button type="button" class="btn btn-outline" data-action="close">取消</button><button type="button" class="btn btn-primary" data-action="save">儲存頁面設置</button></footer></div>`;if($('vnpAllMusic'))$('vnpAllMusic').checked=!!config.allMusic;renderSpriteEditor();modal.onclick=handleSettingsClick;}
  function save(){const record=scopeRecord();if(!record)return;const previous=record.visualNovelPage||{};record.visualNovelPage={...defaultConfig(),...previous,mode:modal.querySelector('[name="vnpMode"]:checked')?.value||'classic',sceneFolderIds:[...modal.querySelectorAll('[data-link-folder]:checked')].filter(el=>folders('bg').some(row=>row.id===el.dataset.linkFolder)).map(el=>el.dataset.linkFolder),sceneAssetIds:[...modal.querySelectorAll('[data-link-asset]:checked')].filter(el=>assets('bg').some(row=>row.id===el.dataset.linkAsset)).map(el=>el.dataset.linkAsset),musicFolderIds:[...modal.querySelectorAll('[data-link-folder]:checked')].filter(el=>folders('bgm').some(row=>row.id===el.dataset.linkFolder)).map(el=>el.dataset.linkFolder),musicAssetIds:[...modal.querySelectorAll('[data-link-asset]:checked')].filter(el=>assets('bgm').some(row=>row.id===el.dataset.linkAsset)).map(el=>el.dataset.linkAsset),spriteLibraryId:$('vnpSpriteLibrary')?.value||'',allMusic:!!$('vnpAllMusic')?.checked,highlightSpeaker:$('vnpHighlight')?.checked!==false,autoScene:!!$('vnpAutoScene')?.checked};saveStateToLocalStorage();close();}
  function renderSpriteEditor(){const library=libraries().find(row=>row.id===$('vnpSpriteLibrary')?.value),box=$('vnpSpriteEditor');if(!box)return;if(!library){box.innerHTML='<p class="vnp-help">選擇或建立立繪庫後，可替人物設定普通與其他表情立繪。沒有立繪的人物會使用以人物主題色呈現的路人剪影。</p>';return;}box.innerHTML=`<div class="vnp-sprite-head"><strong>${esc(library.name)}</strong><button type="button" class="btn btn-xs btn-outline" data-action="rename-library">重新命名</button></div><p class="vnp-help">選擇人物後填入圖片網址，或上傳本機圖片。頭像裁切範圍使用百分比；所有表情共用普通立繪的裁切框。</p><label class="vnp-field">加入人物<select id="vnpAddCharacter"><option value="">選擇人物</option>${characters.filter(char=>!library.cast?.[char.id]).map(char=>`<option value="${esc(char.id)}">${esc(char.name)}</option>`).join('')}</select></label><button type="button" class="btn btn-xs btn-outline" data-action="add-character">＋ 加入人物</button><label class="vnp-check"><input id="vnpLibraryAll" type="checkbox" ${library.allCharacters?'checked':''}> 這個立繪庫關聯全部人物</label>${Object.entries(library.cast||{}).map(([charId,entry])=>{const char=characters.find(row=>String(row.id)===String(charId));return `<details class="vnp-cast"><summary>${esc(char?.name||charId)} <small>${Object.keys(entry.images||{}).length} 種表情</small></summary><div class="vnp-crop"><label>頭像裁切 X <input type="number" min="0" max="100" data-crop="x" data-char="${esc(charId)}" value="${Number(entry.crop?.x)||25}"></label><label>Y <input type="number" min="0" max="100" data-crop="y" data-char="${esc(charId)}" value="${Number(entry.crop?.y)||0}"></label><label>寬 <input type="number" min="1" max="100" data-crop="w" data-char="${esc(charId)}" value="${Number(entry.crop?.w)||50}"></label><label>高 <input type="number" min="1" max="100" data-crop="h" data-char="${esc(charId)}" value="${Number(entry.crop?.h)||50}"></label></div><div class="vnp-crop-board" data-crop-board="${esc(charId)}"><img alt="立繪裁切預覽"><span class="vnp-crop-box"></span><small>拖曳框選頭像範圍</small></div>${[...new Set([...expressions,...Object.keys(entry.images||{})])].map(mood=>`<div class="vnp-expression"><strong>${esc(mood)}</strong><input type="url" data-image-url="${esc(mood)}" data-char="${esc(charId)}" value="${esc(entry.images?.[mood]||'')}" placeholder="https:// 圖片網址"><input type="file" accept="image/*" data-image-file="${esc(mood)}" data-char="${esc(charId)}"></div>`).join('')}<button type="button" class="btn btn-xs btn-outline" data-action="new-expression" data-char="${esc(charId)}">＋ 自訂情緒</button><label class="vnp-check"><input type="checkbox" data-avatar-mode="${esc(charId)}" ${entry.avatarMode?'checked':''}> 此人物預設使用左下角頭像模式</label></details>`}).join('')}`;hydrateCropBoards();}
  function paintCropBoard(board,entry){const crop=entry?.crop||{x:25,y:0,w:50,h:50},box=board.querySelector('.vnp-crop-box');if(!box)return;box.style.left=`${crop.x}%`;box.style.top=`${crop.y}%`;box.style.width=`${crop.w}%`;box.style.height=`${crop.h}%`;}
  async function hydrateCropBoards(){const library=libraries().find(row=>row.id===$('vnpSpriteLibrary')?.value);for(const board of modal?.querySelectorAll('[data-crop-board]')||[]){const entry=library?.cast?.[board.dataset.cropBoard];paintCropBoard(board,entry);const image=board.querySelector('img'),url=await source(entry?.images?.['普通']);if(image?.isConnected&&url)image.src=url;}}
  let cropDrag=null;
  document.addEventListener('pointerdown',event=>{const board=event.target.closest?.('[data-crop-board]');if(!board||!modal?.contains(board))return;const rect=board.getBoundingClientRect();cropDrag={board,charId:board.dataset.cropBoard,x:Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100)),y:Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100))};board.setPointerCapture?.(event.pointerId);event.preventDefault();});
  document.addEventListener('pointermove',event=>{if(!cropDrag)return;const {board,x,y}=cropDrag,rect=board.getBoundingClientRect(),x2=Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100)),y2=Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100)),box=board.querySelector('.vnp-crop-box');if(box){box.style.left=`${Math.min(x,x2)}%`;box.style.top=`${Math.min(y,y2)}%`;box.style.width=`${Math.abs(x2-x)}%`;box.style.height=`${Math.abs(y2-y)}%`;}});
  document.addEventListener('pointerup',event=>{if(!cropDrag)return;const {board,charId,x,y}=cropDrag;cropDrag=null;const rect=board.getBoundingClientRect(),x2=Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100)),y2=Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100)),library=libraries().find(row=>row.id===$('vnpSpriteLibrary')?.value),entry=library?.cast?.[charId];if(!entry)return;entry.crop={x:Math.round(Math.min(x,x2)),y:Math.round(Math.min(y,y2)),w:Math.max(1,Math.round(Math.abs(x2-x))),h:Math.max(1,Math.round(Math.abs(y2-y)))};for(const [key,value] of Object.entries(entry.crop)){const input=modal.querySelector(`[data-crop="${key}"][data-char="${CSS.escape(charId)}"]`);if(input)input.value=value;}paintCropBoard(board,entry);saveStateToLocalStorage();});
  function uploadAsset(type){const input=document.createElement('input');input.type='file';input.accept=type==='bg'?'image/png,image/jpeg,image/webp,image/gif,image/avif':'audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;const limit=type==='bg'?20:50;if(file.size>limit*1024*1024)return alert(`檔案不可超過 ${limit} MB。`);const title=prompt('素材名稱',file.name.replace(/\.[^.]+$/,''));if(title===null)return;const group=folders(type),folderId=group.length?prompt(`所屬資料夾 ID（可留空）：\n${group.map(row=>`${row.name}: ${row.id}`).join('\n')}`)||'':'';const tags=type==='bgm'?prompt(`情緒標籤（逗號分隔）：\n${moods.join('、')}`)||'':'';const assetId=id('vna');try{await OCFeatures.storeFile(assetId,file);mediaLibrary.push({id:assetId,kind:'vn-asset',assetType:type,title:title.trim()||file.name,folderId:group.some(row=>row.id===folderId)?folderId:'',tags:tags.split(/[,，、]/).map(value=>value.trim()).filter(Boolean),type:file.type,size:file.size,localOnly:true,listed:true,createdAt:Date.now()});saveStateToLocalStorage();renderSettings();}catch(error){alert(`素材儲存失敗：${error.message}`);}};input.click();}
  async function handleSettingsClick(event){const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(action==='close')return close();if(action==='save')return save();if(action==='new-folder'){const name=prompt('資料夾名稱（例如：校園）');if(!name?.trim())return;mediaLibrary.push({id:id('vnf'),kind:'vn-folder',assetType:button.dataset.type,name:name.trim()});saveStateToLocalStorage();return renderSettings();}if(action==='rename-folder'){const row=mediaLibrary.find(item=>item.id===button.dataset.id),name=prompt('資料夾名稱',row?.name||'');if(row&&name?.trim()){row.name=name.trim();saveStateToLocalStorage();renderSettings();}return;}if(action==='upload-asset')return uploadAsset(button.dataset.type);if(action==='new-asset'){const type=button.dataset.type,title=prompt(type==='bg'?'場景名稱（如 校園-教室）':'音樂名稱');if(!title?.trim())return;const url=prompt('素材直接網址（https://）。若要上傳本機素材，可在劇本編輯器的素材庫上傳後回來編輯。');if(!url?.trim()||!/^https?:\/\//i.test(url.trim()))return alert('請輸入有效的 HTTPS 圖片或音訊網址。');const group=folders(type),folderId=group.length?prompt(`資料夾 ID（可留空）：\n${group.map(row=>`${row.name}: ${row.id}`).join('\n')}`)||'':'';const tags=type==='bgm'?prompt(`情緒標籤（逗號分隔）\n建議：${moods.join('、')}`)||'':'';mediaLibrary.push({id:id('vna'),kind:'vn-asset',assetType:type,title:title.trim(),url:url.trim(),folderId:group.some(row=>row.id===folderId)?folderId:'',tags:tags.split(/[,，、]/).map(s=>s.trim()).filter(Boolean),listed:true,createdAt:Date.now()});saveStateToLocalStorage();return renderSettings();}if(action==='edit-asset'){const row=mediaLibrary.find(item=>item.id===button.dataset.id);if(!row)return;const title=prompt('素材名稱',row.title||'');if(title===null)return;row.title=title.trim()||row.title;const group=folders(row.assetType),folder=prompt(`所屬資料夾 ID（留空為根目錄）：\n${group.map(item=>`${item.name}: ${item.id}`).join('\n')}`,row.folderId||'');if(folder!==null)row.folderId=group.some(item=>item.id===folder)?folder:'';if(row.assetType==='bgm'){const tags=prompt('情緒標籤（逗號分隔）',(row.tags||[]).join('、'));if(tags!==null)row.tags=tags.split(/[,，、]/).map(s=>s.trim()).filter(Boolean);}saveStateToLocalStorage();return renderSettings();}if(action==='all-music'){modal.querySelectorAll('[data-link-asset]').forEach(input=>{if(assets('bgm').some(row=>row.id===input.dataset.linkAsset))input.checked=true;});return;}if(action==='new-library'){const name=prompt('立繪素材庫名稱');if(!name?.trim())return;const row={id:id('vns'),kind:'vn-sprite-library',name:name.trim(),cast:{},allCharacters:false};mediaLibrary.push(row);saveStateToLocalStorage();renderSettings();$('vnpSpriteLibrary').value=row.id;renderSpriteEditor();return;}const library=libraries().find(row=>row.id===$('vnpSpriteLibrary')?.value);if(!library)return;if(action==='rename-library'){const name=prompt('立繪素材庫名稱',library.name);if(name?.trim()){library.name=name.trim();saveStateToLocalStorage();renderSettings();$('vnpSpriteLibrary').value=library.id;renderSpriteEditor();}return;}if(action==='add-character'){const charId=$('vnpAddCharacter')?.value;if(charId){library.cast=library.cast||{};library.cast[charId]={images:{},crop:{x:25,y:0,w:50,h:50},avatarMode:false};saveStateToLocalStorage();renderSpriteEditor();}return;}if(action==='new-expression'){const name=prompt('自訂情緒名稱');if(!name?.trim())return;library.cast[button.dataset.char].images[name.trim()]='';saveStateToLocalStorage();return renderSpriteEditor();}}
  document.addEventListener('change',async event=>{if(!modal?.classList.contains('active')||!modal.contains(event.target))return;const target=event.target;if(target.id==='vnpSpriteLibrary')return renderSpriteEditor();const library=libraries().find(row=>row.id===$('vnpSpriteLibrary')?.value);if(!library)return;if(target.id==='vnpLibraryAll'){library.allCharacters=target.checked;saveStateToLocalStorage();return;}const cast=library.cast?.[target.dataset.char];if(!cast)return;if(target.dataset.crop){cast.crop[target.dataset.crop]=Math.max(0,Math.min(100,Number(target.value)||0));saveStateToLocalStorage();}if(target.dataset.avatarMode){cast.avatarMode=target.checked;saveStateToLocalStorage();}if(target.dataset.imageUrl){cast.images[target.dataset.imageUrl]=target.value.trim();saveStateToLocalStorage();}if(target.dataset.imageFile){const file=target.files?.[0];if(!file)return;if(!file.type.startsWith('image/'))return alert('請選擇圖片。');const assetId=id('vna');try{await OCFeatures.storeFile(assetId,file);mediaLibrary.push({id:assetId,kind:'vn-asset',assetType:'sprite',title:`${characters.find(row=>String(row.id)===String(target.dataset.char))?.name||'人物'}-${target.dataset.imageFile}`,type:file.type,size:file.size,localOnly:true,listed:false,createdAt:Date.now()});cast.images[target.dataset.imageFile]=`asset:${assetId}`;saveStateToLocalStorage();}catch(error){alert(`立繪儲存失敗：${error.message}`);}}});
  function linkedAssets(doc,type){const cfg=configFor(doc),folderIds=type==='bg'?cfg.sceneFolderIds:cfg.musicFolderIds,assetIds=type==='bg'?cfg.sceneAssetIds:cfg.musicAssetIds;return assets(type).filter(row=>assetIds?.includes(row.id)||folderIds?.includes(row.folderId)||(type==='bgm'&&cfg.allMusic));}
  function materializeAiCommands(doc,cues,kinds){
    const editor=$('vnScriptText');if(!editor)return cues;
    const oldEvents=parseVisualNovelScript(editor.value),oldCues={...cues};
    const remembered=doc.visualNovelPage?.aiCommands||[];
    let rows=oldEvents.map(event=>event.sourceLine);
    if(rows.some(line=>line==null))rows=editor.value.split(/\r?\n/).filter(line=>line.trim());
    const remove=new Set();
    for(const marker of remembered.filter(row=>kinds.includes(row.kind))){
      const index=rows.findIndex((line,i)=>!remove.has(i)&&line===marker.command&&rows.slice(i+1).find(next=>!/^(@|sys\()/i.test(next.trim()))===marker.nextLine);
      if(index>=0)remove.add(index);
    }
    rows=rows.filter((_,index)=>!remove.has(index));
    const oldDialogue=oldEvents.filter(row=>row.type==='dialogue');
    const output=[],markers=[];let ordinal=0,activeScene='',activeMusic='';
    const identity=(value,type)=>{if(value==='none')return '';if(value.startsWith('asset:'))return value.slice(6);return mediaLibrary.find(item=>item.kind==='vn-asset'&&item.assetType===type&&item.url===value)?.id||value;};
    for(const row of rows){
      const event=parseVisualNovelScript(row)[0];
      if(event?.type==='dialogue'){
        const sourceCue=oldCues[oldDialogue[ordinal]?.sourceLineIndex]||{};
        const commands=[];
        if(kinds.includes('hide')&&sourceCue.hideAll)commands.push(['hide','@hide all']);
        if(kinds.includes('scene')&&sourceCue.sceneId&&sourceCue.sceneId!==activeScene)commands.push(['scene',`@bg asset:${sourceCue.sceneId}`]);
        if(kinds.includes('music')&&sourceCue.musicId&&sourceCue.musicId!==activeMusic)commands.push(['music',`@bgm asset:${sourceCue.musicId}`]);
        for(const [kind,command] of commands){output.push(command);markers.push({kind,command,nextLine:row});if(kind==='scene')activeScene=sourceCue.sceneId;if(kind==='music')activeMusic=sourceCue.musicId;}
        ordinal++;
      }
      output.push(row);
      if(event?.type==='bg')activeScene=identity(event.value,'bg');
      if(event?.type==='bgm')activeMusic=identity(event.value,'bgm');
    }
    const newEvents=parseVisualNovelScript(output.join('\n')).filter(row=>row.type==='dialogue'),remapped={};
    newEvents.forEach((row,index)=>{const old=oldCues[oldDialogue[index]?.sourceLineIndex];if(old){const cue={...old};for(const kind of kinds){if(kind==='scene'){delete cue.sceneId;delete cue.sceneSource;}if(kind==='music'){delete cue.musicId;delete cue.musicSource;}if(kind==='hide')delete cue.hideAll;}if(Object.keys(cue).length)remapped[row.sourceLineIndex]=cue;}});
    editor.value=output.join('\n\n');doc.visualNovelPage={...doc.visualNovelPage,aiCommands:[...remembered.filter(row=>!kinds.includes(row.kind)),...markers]};
    return remapped;
  }
  async function ensureOpeningAsset(kind,doc,script,lines,choices,cues){
    if(!['scene','music'].includes(kind)||!choices.length||!lines.length)return false;
    const field=kind==='scene'?'sceneId':'musicId',source=kind==='scene'?'sceneSource':'musicSource',first=lines[0],current=cues[first.sourceLineIndex]||{};
    const events=parseVisualNovelScript(script),firstDialogue=events.findIndex(row=>row.type==='dialogue');
    const oldAi=new Set((doc.visualNovelPage?.aiCommands||[]).filter(row=>row.kind===kind).map(row=>row.command));
    const manualOpening=events.slice(0,firstDialogue).some(row=>row.type===(kind==='scene'?'bg':'bgm')&&!oldAi.has(row.sourceLine));
    if(manualOpening){if(current[source]==='ai'){const next={...current};delete next[field];delete next[source];cues[first.sourceLineIndex]=next;}return false;}
    if(current[source]==='manual'||choices.some(choice=>choice.id===current[field]))return false;
    const sample=lines.slice(0,8).map(row=>({speaker:row.speaker,text:row.text.slice(0,500)}));
    let selected='';
    try{
      const result=await requestDeepSeek({model:'deepseek-v4-flash',thinking:{type:'disabled'},temperature:0,max_tokens:200,response_format:{type:'json_object'},messages:[{role:'system',content:`你是視覺小說的開場${kind==='scene'?'場景':'背景音樂'}選擇器。根據開頭片段，必須從可用素材中選出最適合的一個。只回傳 {"id":"素材 ID"}，不得創造 ID。可用素材：${JSON.stringify(choices)}`},{role:'user',content:JSON.stringify(sample)}]});
      selected=JSON.parse(result.choices?.[0]?.message?.content||'{}').id;
    }catch(error){console.warn('開場素材 AI 選擇失敗，改用第一個關聯素材：',error);}
    if(!choices.some(choice=>choice.id===selected))selected=choices[0].id;
    cues[first.sourceLineIndex]={...current,[field]:selected,[source]:'ai'};
    if(kind==='music')for(let i=1;i<Math.min(10,lines.length);i++){
      const cue=cues[lines[i].sourceLineIndex];
      if(cue?.musicId&&cue.musicSource!=='manual'){const next={...cue};delete next.musicId;delete next.musicSource;cues[lines[i].sourceLineIndex]=next;}
    }
    return true;
  }
  async function analyze(kind,options={}){
    const doc=documents.find(row=>row.id===$('vnDocumentId')?.value);
    if(!doc)return alert('請先開啟文章的視覺小說編輯器。');
    if(!deepseekSettings.apiKey)return alert('請先設定 DeepSeek API Key。');
    const script=$('vnScriptText')?.value||doc.visualNovel?.scriptText||'';
    const lines=parseVisualNovelScript(script).filter(row=>row.type==='dialogue');
    if(!lines.length)return alert('請先產生或輸入說話腳本。');
    const sceneChoices=linkedAssets(doc,'bg'),musicChoices=linkedAssets(doc,'bgm');
    if(kind==='scene'&&!sceneChoices.length)return alert('請先在頁面設置關聯場景素材或資料夾。');
    if(kind==='music'&&!musicChoices.length)return alert('請先在頁面設置關聯音樂素材或資料夾。');
    const choices=kind==='scene'?sceneChoices.map(row=>({id:row.id,name:row.title})):kind==='music'?musicChoices.map(row=>({id:row.id,name:row.title,tags:row.tags||[]})):characters.map(row=>({id:row.id,name:row.name}));
    const cues={...(options.cues||doc.visualNovelPage?.cues||{})};
    if(kind==='scene')for(const row of lines){const cue=cues[row.sourceLineIndex];if(cue?.sceneId&&cue.sceneSource!=='manual'){const next={...cue};delete next.sceneId;delete next.sceneSource;cues[row.sourceLineIndex]=next;}}
    if(kind==='music')for(const row of lines){const cue=cues[row.sourceLineIndex];if(cue?.musicId&&cue.musicSource!=='manual'){const next={...cue};delete next.musicId;delete next.musicSource;cues[row.sourceLineIndex]=next;}}
    const chunks=[];for(let i=0;i<lines.length;i+=55)chunks.push(lines.slice(i,i+55));
    const label={scene:'場景',emotion:'情緒與站位',music:'音樂',hide:'降下所有說話人'}[kind];
    let lastMusicOrdinal=-Infinity,lastMusicId='',ordinal=0,changes=0;
    showToast(`AI 正在獨立判斷${label}…`);
    try{
      for(const chunk of chunks){
        const request=chunk.map(row=>({line:row.sourceLineIndex,speaker:row.speaker,text:row.text.slice(0,500),...(row===lines[0]&&['scene','music'].includes(kind)?{opening:true}:{} )}));
        const instruction=promptFor(kind,doc);
        const result=await requestDeepSeek({model:'deepseek-v4-flash',thinking:{type:'disabled'},temperature:0,max_tokens:4000,response_format:{type:'json_object'},messages:[{role:'system',content:`你是視覺小說標註器。${instruction}${['scene','music'].includes(kind)?'標有 opening:true 的整篇第一句，必須從可用素材中選一個合適的 ID；後續只在切換時回傳 ID。':''}只回傳 JSON 物件，鍵為行號，值為 ${kind==='emotion'?'{"emotion":"普通","position":"center"}':kind==='hide'?'布林值 true 或 false':'素材 ID 字串或空字串'}。禁止改寫原文，禁止創造素材 ID。可用選項：${JSON.stringify(choices)}`},{role:'user',content:JSON.stringify(request)}]});
        const parsed=JSON.parse(result.choices?.[0]?.message?.content||'{}');
        for(const row of chunk){
          const value=parsed[String(row.sourceLineIndex)],old=cues[row.sourceLineIndex]||{};
          if(kind==='emotion'){
            if(old.emotionSource!=='manual'&&value&&typeof value==='object')cues[row.sourceLineIndex]={...old,emotion:String(value.emotion||'普通').slice(0,24),position:['left','center','right'].includes(value.position)?value.position:'center',emotionSource:'ai'};
          }else if(kind==='hide'){
            if(value===true||value==='true')cues[row.sourceLineIndex]={...old,hideAll:true};
          }else if(kind==='scene'){
            if(old.sceneSource!=='manual'&&choices.some(choice=>choice.id===value))cues[row.sourceLineIndex]={...old,sceneId:value,sceneSource:'ai'};
          }else{
            if(old.musicSource==='manual'&&old.musicId){lastMusicId=old.musicId;lastMusicOrdinal=ordinal;}
            else if(choices.some(choice=>choice.id===value)&&value!==lastMusicId&&ordinal-lastMusicOrdinal>=10){cues[row.sourceLineIndex]={...old,musicId:value,musicSource:'ai'};lastMusicId=value;lastMusicOrdinal=ordinal;changes++;}
            ordinal++;
          }
        }
      }
      await ensureOpeningAsset(kind,doc,script,lines,choices,cues);
      if(kind==='music')changes=lines.filter(row=>cues[row.sourceLineIndex]?.musicId).length;
      const finalCues=options.persist!==false&&kind!=='emotion'?materializeAiCommands(doc,cues,[kind]):cues;
      if(options.persist!==false){doc.visualNovelPage={...doc.visualNovelPage,cues:finalCues};doc.visualNovel={...doc.visualNovel,scriptText:$('vnScriptText').value};saveStateToLocalStorage();renderAnnotations();}
      if(!options.silent)alert(`已完成${label}獨立標註，共檢查 ${lines.length} 句${kind==='music'?`，保留 ${changes} 個段落換曲點`:''}；正文與說話人保持不變。`);
      return {cues,lines:lines.length,changes};
    }catch(error){if(options.silent)throw error;alert(`AI 標註失敗：${error.message}`);return null;}finally{hideToast();}
  }
  let analyzingAll=false;
  async function analyzeAll(){
    if(analyzingAll)return;
    const doc=documents.find(row=>row.id===$('vnDocumentId')?.value),editor=$('vnScriptText');
    if(!doc||!editor)return;
    if(!deepseekSettings.apiKey)return alert('請先設定 DeepSeek API Key。');
    analyzingAll=true;
    const oldScript=editor.value,oldNovel=doc.visualNovel?structuredClone(doc.visualNovel):null,oldPage=doc.visualNovelPage?structuredClone(doc.visualNovelPage):null,controls=[...document.querySelectorAll('#visualNovelEditorModal button,#visualNovelEditorModal input,#visualNovelEditorModal select,#visualNovelEditorModal textarea')];
    const disabled=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
    $('visualNovelEditorModal')?.setAttribute('aria-busy','true');
    try{
      if(!await generateVisualNovelWithAi(true)){if(oldNovel)doc.visualNovel=oldNovel;else delete doc.visualNovel;return;}
      if($('vnDocumentId')?.value!==doc.id)throw new Error('編輯中的篇章已變更');
      const prior=new Map();
      for(const row of parseVisualNovelScript(oldScript))if(row.type==='dialogue'){
        if(!prior.has(row.text))prior.set(row.text,[]);
        prior.get(row.text).push(doc.visualNovelPage?.cues?.[row.sourceLineIndex]);
      }
      let cues={};
      for(const row of parseVisualNovelScript(editor.value))if(row.type==='dialogue'){
        const cue=prior.get(row.text)?.shift();if(cue)cues[row.sourceLineIndex]={...cue};
      }
      const skipped=[];
      for(const kind of ['emotion','scene','music','hide']){
        if(kind==='scene'&&!linkedAssets(doc,'bg').length){skipped.push('場景');continue;}
        if(kind==='music'&&!linkedAssets(doc,'bgm').length){skipped.push('音樂');continue;}
        const result=await analyze(kind,{silent:true,persist:false,cues});
        if($('vnDocumentId')?.value!==doc.id)throw new Error('編輯中的篇章已變更');
        if(!result)throw new Error('沒有可標註的台詞');
        cues=result.cues;
      }
      cues=materializeAiCommands(doc,cues,['scene','music','hide']);
      doc.visualNovel={...doc.visualNovel,scriptText:editor.value,settings:collectVisualNovelSettings(),aiCustomPrompt:$('vnAiCustomPrompt')?.value.trim()||'',eventIndexVersion:2,updatedAt:new Date().toISOString()};
      doc.visualNovelPage={...doc.visualNovelPage,cues};
      alignVisualNovelBookmarkToScript(doc,parseVisualNovelScript(editor.value));
      saveStateToLocalStorage();renderAnnotations();
      alert(`已完成並儲存說話人、情緒、場景、音樂及降下人物判斷。場景、音樂與清空人物時機已直接寫入劇本。${skipped.length?`尚未關聯${skipped.join('與')}素材，因此略過這些項目。`:''}`);
    }catch(error){
      if(oldNovel)doc.visualNovel=oldNovel;else delete doc.visualNovel;
      if(oldPage)doc.visualNovelPage=oldPage;else delete doc.visualNovelPage;
      if($('vnDocumentId')?.value===doc.id)editor.value=oldScript;
      renderAnnotations();alert(`一鍵判斷未完成：${error.message}。已保留原本腳本與標註。`);
    }
    finally{analyzingAll=false;controls.forEach((control,index)=>control.disabled=disabled[index]);$('visualNovelEditorModal')?.removeAttribute('aria-busy');hideToast();}
  }
  function renderAnnotations(){
    const panel=$('vnpAnnotations'),editor=$('vnScriptText'),doc=documents.find(row=>row.id===$('vnDocumentId')?.value);
    if(!panel||!editor||!doc)return;
    renderCommandColors();
    const commands=parseVisualNovelScript(editor.value).filter(row=>['cg','bg','bgm','se','shake','sys'].includes(row.type));
    panel.innerHTML=commands.length?`<details><summary>劇本指令 <b>${commands.length}</b> 個 · 點選可定位修改</summary><div class="vnp-command-list">${commands.map(row=>`<button type="button" data-jump-line="${row.sourceLineIndex}"><code>${esc(row.type==='sys'?`@${row.command} ${row.args.join(' ')}`:row.type==='shake'?'@shake':`@${row.type} ${row.value}`)}</code></button>`).join('')}</div></details>`:'<small>場景、音樂及人物動作會以橘色指令寫在劇本中，可直接修改。</small>';

  }
  function renderCommandColors(){const editor=$('vnScriptText');if(!editor)return;let shell=editor.parentElement;if(!shell?.classList.contains('vnp-script-shell')){shell=document.createElement('div');shell.className='vnp-script-shell';editor.before(shell);shell.append(editor);const mirror=document.createElement('pre');mirror.className='vnp-script-mirror';mirror.setAttribute('aria-hidden','true');shell.prepend(mirror);editor.addEventListener('scroll',()=>{mirror.scrollTop=editor.scrollTop;mirror.scrollLeft=editor.scrollLeft;});}const mirror=shell.querySelector('.vnp-script-mirror');mirror.innerHTML=(editor.value||' ').split('\n').map(line=>/^(?:\s*@|\s*sys\([^)]*\))/i.test(line)?`<span class="vnp-command-color">${esc(line||' ')}</span>`:esc(line||' ')).join('\n')+'\n';mirror.scrollTop=editor.scrollTop;mirror.scrollLeft=editor.scrollLeft;}
  let annotationTimer=0;
  document.addEventListener('input',event=>{if(event.target?.id!=='vnScriptText')return;clearTimeout(annotationTimer);annotationTimer=setTimeout(renderAnnotations,180);});
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#vnpAnnotations [data-jump-line]');if(!button)return;
    const editor=$('vnScriptText'),target=Number(button.dataset.jumpLine),lines=editor?.value.split(/\r?\n/)||[];if(!editor||!Number.isInteger(target))return;
    let nonEmpty=0,offset=0;for(const line of lines){if(line.trim()){if(nonEmpty===target)break;nonEmpty++;}offset+=line.length+1;}
    editor.focus();editor.setSelectionRange(offset,offset);editor.scrollTop=Math.max(0,(target-2)*parseFloat(getComputedStyle(editor).lineHeight||22));
  });
  async function source(value){if(!value||value==='none')return '';try{const url=await OCVnAssets.resolve(value),row=mediaLibrary.find(item=>item.kind==='vn-asset'&&(value===`asset:${item.id}`||value===item.url));if(row)resolvedAssetIds.set(url,row.id);return url;}catch{return '';}}
  function findChar(name){return characters.find(row=>row.name===name||row.englishName===name||String(row.aliases||'').split(/[,，、]/).includes(name));}
  function themeColor(char){return char?.themeColor?.primary||currentDoc?.visualNovel?.settings?.primaryColor||'#9d78ad';}
  function luminance(hex){const value=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(value))return 0;const rgb=[0,2,4].map(i=>parseInt(value.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
  function contrast(hex){return luminance(hex)>.43?'#1d1720':'#fff';}
  function spriteEntry(char){return libraries().find(row=>row.id===currentConfig?.spriteLibraryId)?.cast?.[char?.id];}
  async function spriteSource(char,mood){const entry=spriteEntry(char),value=entry?.images?.[mood]||entry?.images?.['普通'];return source(value);}
  async function expressionAvatar(doc,char,eventIndex,explicitEmotion){if(!char)return '';const cfg=configFor(doc),entry=libraries().find(row=>row.id===cfg.spriteLibraryId)?.cast?.[char.id],cue=cfg.cues?.[eventIndex]||{},mood=explicitEmotion||parseVisualNovelScript(doc.visualNovel?.scriptText||'').find(row=>row.sourceLineIndex===eventIndex)?.emotion||cue.emotion||'普通';return source(entry?.images?.[mood]||entry?.images?.['普通']||'');}
  function applyAvatarCrop(image,doc,char){const cfg=configFor(doc),entry=libraries().find(row=>row.id===cfg.spriteLibraryId)?.cast?.[char?.id];if(!entry?.crop)return;image.style.cssText+=avatarCropStyle(entry);image.parentElement.style.overflow='hidden';image.parentElement.style.position='relative';}
  function avatarCropStyle(entry){const crop=entry?.crop||{},w=Math.max(1,Number(crop.w)||50),h=Math.max(1,Number(crop.h)||50),x=Math.max(0,Number(crop.x)||0),y=Math.max(0,Number(crop.y)||0);return `width:${10000/w}%;height:${10000/h}%;max-width:none;position:absolute;left:-${100*x/w}%;top:-${100*y/h}%;object-fit:fill;`;}
  function renderPlayer(){if(!player)return;const cfg=currentConfig,settings=currentDoc.visualNovel?.settings||{},accent=settings.primaryColor||'#9d78ad',second=settings.secondaryColor||accent,bright=(luminance(accent)+luminance(second))/2>.43;player.className=`vnp-player vnp-${cfg.mode}${menuOpen?' menu-open':''}`;player.style.setProperty('--vnp-accent',accent);player.style.setProperty('--vnp-second',second);player.style.setProperty('--vnp-ink',contrast(accent));player.style.setProperty('--vnp-chapter-ink',bright?'#221a28':'#fff');player.style.setProperty('--vnp-opening-wash',bright?'#ffffffaa':'#080710aa');player.innerHTML=`<div class="vnp-scene" id="vnpScene"></div><div class="vnp-sprites" id="vnpSprites"></div><div class="vnp-cg" id="vnpCg"></div><div class="vnp-chapter-opening" id="vnpOpening"><div class="vnp-geometry"></div><div><small>STORY CHRONICLE · ${esc(books.find(book=>book.id===currentDoc.bookId)?.title||'VISUAL NOVEL')}</small><strong>${String(Math.max(1,documents.filter(doc=>doc.bookId===currentDoc.bookId).findIndex(doc=>doc.id===currentDoc.id)+1)).padStart(2,'0')}</strong><h1>${esc(currentDoc.title)}</h1></div></div><header class="vnp-player-top"><button data-player="back" aria-label="返回">←</button><button data-player="menu" aria-label="設定與功能">☰</button></header><div class="vnp-dialogue" id="vnpDialogue"><div class="vnp-name" id="vnpName"></div><div class="vnp-text" id="vnpText"></div><button class="vnp-next" data-player="next" aria-label="下一句">⌄</button></div><aside class="vnp-menu" id="vnpMenu"><h2>系統設定</h2><label>文字大小 <input id="vnpFont" type="range" min="14" max="32" value="${Number(localStorage.getItem('vnp-font')||20)}"></label><label>BGM 音量 <input id="vnpMusicVolume" type="range" min="0" max="1" step=".05" value="${Number(localStorage.getItem('vnp-music-volume')||.65)}"></label><label>音效音量 <input id="vnpSeVolume" type="range" min="0" max="1" step=".05" value="${Number(localStorage.getItem('vnp-se-volume')||.65)}"></label><label>打字音量 <input id="vnpTypeVolume" type="range" min="0" max="1" step=".05" value="${Number(localStorage.getItem('vnp-type-volume')||.5)}"></label><label><input id="vnpTypeSound" type="checkbox" ${localStorage.getItem('vnp-type-sound')==='off'?'':'checked'}> 打字音</label><div class="vnp-menu-actions"><button data-player="bookmark">書籤</button><button data-player="auto">自動 ${autoMode?'✓':''}</button><button data-player="skip">SKIP</button><button data-player="history">回顧</button><button data-player="chapters">章節</button><button data-player="edit">快速編輯</button><button data-player="full-edit">完整編輯器</button><button data-player="stage">調整本句演出</button><button data-player="close-menu">返回閱讀</button></div><div id="vnpMenuExtra"></div></aside><audio id="vnpMusic" loop preload="none"></audio><audio id="vnpSe" preload="none"></audio>`;music=$('vnpMusic');music.volume=Number(localStorage.getItem('vnp-music-volume')||.65);player.style.setProperty('--vnp-font',`${Number(localStorage.getItem('vnp-font')||20)}px`);player.addEventListener('click',handlePlayerClick);player.addEventListener('input',handlePlayerInput);player.addEventListener('change',handlePlayerInput);}
  async function openAdvanced(docId){const doc=documents.find(row=>row.id===docId);if(!doc?.visualNovel?.scriptText)return false;const cfg=configFor(doc);if(cfg.mode==='classic')return false;currentDoc=doc;currentConfig=cfg;events=parseVisualNovelScript(doc.visualNovel.scriptText);eventIndex=Number.isInteger(doc.visualNovel.bookmarkIndex)&&doc.visualNovel.bookmarkIndex>0&&confirm(`找到第 ${doc.visualNovel.bookmarkIndex+1} 句書籤。要從書籤繼續嗎？`)?Math.min(doc.visualNovel.bookmarkIndex-1,events.length-1):-1;history=[];sceneSource='';cgSource='';activeMusicId='';dialogueCount=0;lastMusicChangeAt=-Infinity;pendingMusicId='';menuOpen=false;autoMode=false;playing=true;const needsLandscape=cfg.mode==='landscape';player=document.createElement('div');player.id='vnpAdvancedPlayer';document.body.append(player);document.body.classList.add('vnp-reading');renderPlayer();const start=()=>{if(!player||!playing)return;const mismatched=matchMedia('(pointer: coarse)').matches&&(needsLandscape?innerHeight>innerWidth:innerWidth>innerHeight);if(mismatched){let gate=$('vnpOrientationGate');if(!gate){gate=document.createElement('div');gate.id='vnpOrientationGate';gate.className='vnp-orientation-gate';gate.innerHTML=`<i class="fa-solid fa-mobile-screen-button"></i><h2>請先${needsLandscape?'橫置':'直立'}手機</h2><p>畫面方向正確後會自動開始閱讀。</p><button type="button" onclick="OCVnPage.closePlayer()">返回</button>`;player.append(gate);}return;}$('vnpOrientationGate')?.remove();window.removeEventListener('resize',start);prepareOpening();};orientationHandler=start;window.addEventListener('resize',start);start();return true;}
  function resolveSpriteTarget(value){const key=String(value||'').toLowerCase(),slot={l:'left',c:'center',r:'right'}[key]||key;const visible=player?._visible||[];return visible.find(row=>row.position===slot||String(row.char.id)===String(value)||row.char.name===value)?.char;}
  function paintSpriteEffect(node){if(!node)return;const state=node._effect||{};node.style.setProperty('--vnp-move-x',`${state.x||0}%`);node.style.setProperty('--vnp-move-y',`${state.y||0}%`);node.style.setProperty('--vnp-scale',state.scale||1);node.style.setProperty('--vnp-flip',state.flip?-1:1);node.style.setProperty('--vnp-closer',state.closer?1.18:1);node.style.transitionDuration=`${state.seconds??.5}s`;}
  function runSystemCommand(event){const [target,a,b,c]=event.args||[],box=$('vnpSprites');if(!box)return;const nodes=[...box.querySelectorAll('.vnp-sprite')],nodeFor=value=>{const char=resolveSpriteTarget(value);return nodes.find(node=>node.dataset.char===String(char?.id));};
    if(event.command==='hide'){player._visible=[];box.replaceChildren();return;}
    if(event.command==='front'){const first=nodeFor(target),second=nodeFor(a);nodes.forEach(node=>node.style.zIndex=node===first?'7':node===second?'6':'1');return;}
    if(event.command==='closer'){nodes.forEach(node=>{node._effect={...(node._effect||{}),closer:target!=='off'&&node===nodeFor(target)};paintSpriteEffect(node);});return;}
    const node=nodeFor(target);if(!node)return;const state=node._effect||{};
    if(event.command==='move'){if(a==='default'){state.x=0;state.y=0;state.seconds=0;}else{state.x=Math.max(-100,Math.min(100,Number(a)||0));state.y=Math.max(-100,Math.min(100,Number(b)||0));state.seconds=Math.max(0,Number(c)||0);} }
    if(event.command==='scale'){state.scale=Math.max(.01,Math.min(5,Number(a)||1));state.seconds=Math.max(0,Number(b)||0);}
    if(event.command==='flip')state.flip=a==='on';
    if(event.command==='jump'){node.classList.remove('is-jumping');void node.offsetWidth;node.classList.add('is-jumping');}
    node._effect=state;paintSpriteEffect(node);
  }
  async function next(force=false){
    if(!playing)return;
    if(typingTimer){clearInterval(typingTimer);typingTimer=0;const text=$('vnpText');if(text)text.textContent=typingFullText;if(!force)return;}
    clearTimeout(autoTimer);eventIndex++;
    if(eventIndex>=events.length){const list=documents.filter(row=>row.bookId===currentDoc.bookId&&row.visualNovel?.scriptText),position=list.findIndex(row=>row.id===currentDoc.id);if(position>=0&&list[position+1]){closePlayer();openAdvanced(list[position+1].id);}else closePlayer();return;}
    const event=events[eventIndex];if(event.type==='blank'||event.type==='shake')return next();
    if(event.type==='sys'){runSystemCommand(event);return next(true);}
    if(['cg','bg','bgm','se'].includes(event.type)){
      if(event.type==='cg'){cgSource=await source(event.value);const box=$('vnpCg');box.style.backgroundImage=cgSource?`url("${cgSource.replace(/"/g,'%22')}")`:'';box.classList.toggle('is-visible',!!cgSource);}
      if(event.type==='bg'){if(currentConfig.mode==='landscape'){player._visible=[];$('vnpSprites')?.replaceChildren();}sceneSource=await source(event.value);applyScene();}
      if(event.type==='bgm'){pendingMusicId='';await playMusic(event.value);}
      if(event.type==='se')await playEffect(event.value);
      return next();
    }
    dialogueCount++;
    const cue=currentConfig.cues?.[event.sourceLineIndex]||{};
    if(cue.sceneId&&currentConfig.autoScene){const row=assets('bg').find(item=>item.id===cue.sceneId);if(row){sceneSource=await source(row.url||`asset:${row.id}`);applyScene();}}
    if(cue.musicId&&cue.musicId!==activeMusicId)pendingMusicId=cue.musicId;
    if(pendingMusicId&&(cue.musicSource==='manual'||dialogueCount-lastMusicChangeAt>=8)){
      const row=assets('bgm').find(item=>item.id===pendingMusicId);
      if(row)await playMusic(row.url||`asset:${row.id}`,row.id);
      pendingMusicId='';
    }
    await showDialogue(event,cue);
    if(autoMode)autoTimer=setTimeout(next,Math.max(1800,Math.min(6500,(event.text?.length||0)*85+900)));
  }
  function applyScene(){const box=$('vnpScene');if(!box)return;box.style.backgroundImage=sceneSource?`url("${sceneSource.replace(/"/g,'%22')}")`:'';const frame=currentConfig?.mode==='portrait'?mediaLibrary.find(item=>item.id===resolvedAssetIds.get(sceneSource))?.portraitFrame:null;box.style.backgroundPosition=frame?`${Math.min(100,frame.x+frame.w/2)}% ${Math.min(100,frame.y+frame.h/2)}%`:'center';box.style.backgroundSize=frame&&frame.w<45?`${Math.min(180,4500/frame.w)}% auto`:'cover';$('vnpOpening')?.style.setProperty('--opening-scene',sceneSource?`url("${sceneSource.replace(/"/g,'%22')}")`:'none');}
  async function playMusic(value,assetId=''){const audio=music;if(!audio)return;if(!value||value==='none'){audio.pause();audio.removeAttribute('src');activeMusicId='';lastMusicChangeAt=dialogueCount;return;}const url=await source(value);if(!url)return;if(audio.src!==url)audio.src=url;activeMusicId=assetId||value;lastMusicChangeAt=dialogueCount;if(audio.paused)audio.play().catch(()=>{});}
  async function playEffect(value){const url=await source(value),audio=$('vnpSe');if(!url||!audio)return;audio.pause();audio.src=url;audio.currentTime=0;audio.volume=Number(localStorage.getItem('vnp-se-volume')||.65);audio.play().catch(()=>{});}
  function typeBlip(){if(localStorage.getItem('vnp-type-sound')==='off')return;const volume=Number(localStorage.getItem('vnp-type-volume')||.5);if(volume<=0)return;try{typeAudio=typeAudio||new (window.AudioContext||window.webkitAudioContext)();if(typeAudio.state==='suspended')typeAudio.resume().catch(()=>{});const oscillator=typeAudio.createOscillator(),gain=typeAudio.createGain(),now=typeAudio.currentTime;oscillator.type='sine';oscillator.frequency.value=580;gain.gain.setValueAtTime(Math.min(.036,volume*.05),now);gain.gain.exponentialRampToValueAtTime(.0002,now+.035);oscillator.connect(gain).connect(typeAudio.destination);oscillator.start(now);oscillator.stop(now+.04);}catch{}}
  async function showDialogue(event,cue){const char=findChar(event.speaker),narrator=!char||event.speaker==='旁白',name=$('vnpName'),text=$('vnpText'),dialogue=$('vnpDialogue'),mood=event.emotion||cue.emotion||'普通';dialogue.classList.toggle('is-narrator',narrator);name.innerHTML=narrator?'<strong>旁白</strong>':`<strong>${esc(char.name)}</strong>${char.englishName?`<small>${esc(char.englishName)}</small>`:''}`;name.style.background=narrator?'var(--vnp-accent)':themeColor(char);name.style.color=contrast(narrator?currentDoc.visualNovel?.settings?.primaryColor:themeColor(char));clearInterval(typingTimer);typingFullText=event.text||'';const glyphs=[...typingFullText];text.textContent='';let typed=0;typingTimer=setInterval(()=>{if(!player||!text.isConnected){clearInterval(typingTimer);typingTimer=0;return;}typed=Math.min(glyphs.length,typed+2);text.textContent=glyphs.slice(0,typed).join('');if(typed%6===0)typeBlip();if(typed>=glyphs.length){clearInterval(typingTimer);typingTimer=0;}},28);history.push({index:eventIndex,speaker:event.speaker,text:event.text});await renderSprites(char,mood,cue);}
  async function renderSprites(char,mood,cue){
    const box=$('vnpSprites');if(!box||!player)return;
    const current=String(char?.id||'narrator'),mode=currentConfig.mode,slots=mode==='portrait'?['center']:['left','center','right'];
    const previous=player._visible||[],existing=previous.find(row=>String(row.char?.id)===current);
    let visible=mode==='portrait'?[]:previous.filter(row=>String(row.char?.id)!==current);
    if(char){
      const requested=slots.includes(cue.position)?cue.position:(mode==='portrait'?'center':(existing?.position||(visible.length===0?'center':visible.length===1?'right':'left')));
      const position=existing?.position&&!cue.position?existing.position:visible.some(row=>row.position===requested)?slots.find(slot=>!visible.some(row=>row.position===slot))||requested:requested;
      visible.push({char,position,mood});
    }
    visible=visible.slice(-slots.length);player._visible=visible;
    const token=Symbol();player._spriteToken=token;
    const resolved=await Promise.all(visible.map(async row=>{
      const url=await spriteSource(row.char,row.mood),entry=spriteEntry(row.char);
      const avatarMode=(String(row.char.id)===current?cue.avatarMode:undefined)??(entry?.avatarMode||currentConfig.avatarCharacterIds?.includes(row.char.id));
      return {...row,url,entry,avatarMode};
    }));
    if(player?._spriteToken!==token)return;
    const wanted=new Set(resolved.map(row=>String(row.char.id)));
    box.querySelectorAll('.vnp-sprite').forEach(node=>{if(!wanted.has(node.dataset.char))node.remove();});
    for(const row of resolved){
      const charId=String(row.char.id);let node=[...box.children].find(item=>item.dataset.char===charId);
      if(!node){node=document.createElement('div');node.dataset.char=charId;box.append(node);}
      const nextClass=`vnp-sprite vnp-slot-${row.position}${charId===current?' is-speaking':' is-muted'}${row.avatarMode?' is-avatar':''}`;
      if(node.className!==nextClass)node.className=nextClass;
      if(row.url){
        let image=node.querySelector('img');if(!image){node.replaceChildren();image=document.createElement('img');image.alt=row.char.name;node.append(image);}
        if(image.dataset.source!==row.url){image.src=row.url;image.dataset.source=row.url;}
        image.style.cssText=row.avatarMode?avatarCropStyle(row.entry):'';
      }else if(!node.querySelector('.vnp-fallback')){
        node.replaceChildren();const fallback=document.createElement('div');fallback.className='vnp-fallback';fallback.style.setProperty('--fallback-a',themeColor(row.char));fallback.style.setProperty('--fallback-b',row.char.themeColor?.secondary||themeColor(row.char));fallback.innerHTML='<i class="fa-solid fa-user"></i>';node.append(fallback);
      }
    }
    box.classList.toggle('no-highlight',currentConfig.highlightSpeaker===false);
  }
  function closePlayer(){playing=false;clearTimeout(autoTimer);clearTimeout(openingTimer);clearInterval(typingTimer);clearInterval(skipTimer);typingTimer=0;skipTimer=0;skipMode=false;skipBusy=false;if(orientationHandler)window.removeEventListener('resize',orientationHandler);orientationHandler=null;music?.pause();$('vnpSe')?.pause();player?.remove();player=null;music=null;document.body.classList.remove('vnp-reading');}
  function openMenu(extra=''){menuOpen=true;player?.classList.add('menu-open');if(extra)$('vnpMenuExtra').innerHTML=extra;}
  async function editStage(){const row=events[eventIndex];if(!row||row.type!=='dialogue')return alert('請先進入一句對話。');const current=currentConfig.cues?.[row.sourceLineIndex]||{},emotion=prompt('本句情緒（普通、喜、怒、哀、樂、驚或自訂名稱）',current.emotion||'普通');if(emotion===null)return;const position=currentConfig.mode==='landscape'?prompt('橫版站位：left / center / right',current.position||'center'):'center';if(position===null)return;const sceneChoices=linkedAssets(currentDoc,'bg'),musicChoices=linkedAssets(currentDoc,'bgm');const sceneId=prompt(`場景素材 ID（留空維持場景）：\n${sceneChoices.map(item=>`${item.title}: ${item.id}`).join('\n')}`,current.sceneId||'');if(sceneId===null)return;const musicId=prompt(`音樂素材 ID（留空維持音樂）：\n${musicChoices.map(item=>`${item.title}: ${item.id}`).join('\n')}`,current.musicId||'');if(musicId===null)return;const avatarMode=confirm('這一句要使用左下角頭像模式嗎？按「取消」會使用正比立繪。');const cue={...current,avatarMode,emotion:emotion.trim()||'普通',position:['left','center','right'].includes(position)?position:'center',sceneId:sceneChoices.some(item=>item.id===sceneId)?sceneId:'',musicId:musicChoices.some(item=>item.id===musicId)?musicId:''};currentConfig.cues={...(currentConfig.cues||{}),[row.sourceLineIndex]:cue};currentDoc.visualNovelPage={...defaultConfig(),...currentDoc.visualNovelPage,cues:currentConfig.cues};saveStateToLocalStorage();if(cue.sceneId){const scene=sceneChoices.find(item=>item.id===cue.sceneId);sceneSource=await source(scene.url||`asset:${scene.id}`);applyScene();}if(cue.musicId){const selected=musicChoices.find(item=>item.id===cue.musicId);await playMusic(selected.url||`asset:${selected.id}`,selected.id);}showDialogue(row,cue);}
  function handlePlayerClick(event){const button=event.target.closest('[data-player]');if(!button){if(!menuOpen)next();return;}event.stopPropagation();const action=button.dataset.player;if(action==='back')return closePlayer();if(action==='menu')return openMenu();if(action==='close-menu'){menuOpen=false;player.classList.remove('menu-open');return;}if(action==='next')return next();if(action==='auto'){autoMode=!autoMode;button.textContent=`自動 ${autoMode?'✓':''}`;if(autoMode)autoTimer=setTimeout(next,2200);else clearTimeout(autoTimer);return;}if(action==='skip'){skipMode=!skipMode;button.textContent=skipMode?'停止 SKIP':'SKIP';clearInterval(skipTimer);if(skipMode){autoMode=false;clearTimeout(autoTimer);skipTimer=setInterval(async()=>{if(skipBusy)return;skipBusy=true;try{await next(true);}finally{skipBusy=false;}},180);}return;}if(action==='bookmark'){currentDoc.visualNovel.bookmarkIndex=eventIndex;saveStateToLocalStorage();return alert('已將目前位置存為書籤。');}if(action==='history')return openMenu(`<h3>對話回顧</h3><div class="vnp-history">${history.slice(-30).map(row=>`<p><b>${esc(row.speaker)}</b> ${esc(row.text)}</p>`).join('')}</div>`);if(action==='chapters'){const list=documents.filter(row=>row.bookId===currentDoc.bookId&&row.visualNovel?.scriptText);return openMenu(`<h3>章節選擇</h3>${list.map((row,i)=>`<button data-player="chapter" data-id="${esc(row.id)}">${String(i+1).padStart(2,'0')} · ${esc(row.title)}</button>`).join('')}`);}if(action==='chapter'){closePlayer();return openAdvanced(button.dataset.id);}if(action==='edit'){const row=events[eventIndex];if(!row||row.type!=='dialogue')return;const speaker=prompt('說話人（可用括號標註情緒）',row.speaker+(row.emotion?'（'+row.emotion+'）':''));if(speaker===null)return;const content=prompt('說話內容',row.text);if(content===null)return;const lines=currentDoc.visualNovel.scriptText.split(/\r?\n/);lines[row.sourceLineIndex]=`${speaker.trim()||'旁白'}｜${content}`;currentDoc.visualNovel.scriptText=lines.join('\n');saveStateToLocalStorage();events=parseVisualNovelScript(currentDoc.visualNovel.scriptText);showDialogue(events[eventIndex],currentConfig.cues?.[row.sourceLineIndex]||{});return;}if(action==='stage')return editStage();if(action==='full-edit'){const docId=currentDoc.id;closePlayer();openVisualNovelEditor(docId);return;}}
  function handlePlayerInput(event){const target=event.target;if(target.id==='vnpFont'){player.style.setProperty('--vnp-font',`${target.value}px`);localStorage.setItem('vnp-font',target.value);}if(target.id==='vnpMusicVolume'){if(music)music.volume=Number(target.value);localStorage.setItem('vnp-music-volume',target.value);}if(target.id==='vnpSeVolume')localStorage.setItem('vnp-se-volume',target.value);if(target.id==='vnpTypeVolume')localStorage.setItem('vnp-type-volume',target.value);if(target.id==='vnpTypeSound')localStorage.setItem('vnp-type-sound',target.checked?'on':'off');}
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-action="open-library"]');if(!button||!modal?.contains(button))return;event.stopImmediatePropagation();window.OCVnLibrary?.open(button.dataset.type);},true);
  renderSpriteEditor=function(){const box=$('vnpSpriteEditor');if(box)box.innerHTML='<p class="vnp-help">人物表情、立繪與頭像裁切請在共用素材庫管理；這裡只選擇要關聯的立繪庫。</p>';};
  const baseRenderSettings=renderSettings;
  renderSettings=function(){
    const selected=$('vnpLayoutTemplate')?.value,inheritDraft=$('vnpInheritBook')?.checked;
    baseRenderSettings();
    const record=scopeRecord();
    window.OCVnLayout?.injectSettings(modal,record,context?.type==='doc'?configFor(record):{...defaultConfig(),...(record?.visualNovelPage||{})});
    if(selected&&$('vnpLayoutTemplate')?.querySelector(`option[value="${CSS.escape(selected)}"]`))$('vnpLayoutTemplate').value=selected;
    const book=context?.type==='doc'?books.find(row=>row.id===record?.bookId):null;
    if(book){
      const section=document.createElement('section');section.className='vnp-panel';
      section.innerHTML=`<label class="vnp-check"><input id="vnpInheritBook" type="checkbox" ${(inheritDraft??inheritsBook(record))?'checked':''}> 沿用整本書的對話模板與關聯素材</label><p class="vnp-help">跟隨「${esc(book.title||'所屬小說')}」的對話版型、版面模板、場景、音樂與立繪庫。每篇的 AI 標註仍獨立保存；取消勾選即可自訂本篇。</p>`;
      modal.querySelector('.vnp-body').prepend(section);
      const toggle=$('vnpInheritBook');
      const update=()=>{
        if(toggle.checked){
          const cfg={...defaultConfig(),...book.visualNovelPage};
          modal.querySelectorAll('[name="vnpMode"]').forEach(input=>input.checked=input.value===cfg.mode);
          modal.querySelectorAll('[data-link-folder]').forEach(input=>input.checked=[...cfg.sceneFolderIds,...cfg.musicFolderIds].includes(input.dataset.linkFolder));
          modal.querySelectorAll('[data-link-asset]').forEach(input=>input.checked=[...cfg.sceneAssetIds,...cfg.musicAssetIds].includes(input.dataset.linkAsset));
          for(const [key,field] of [['spriteLibraryId','vnpSpriteLibrary'],['allMusic','vnpAllMusic'],['highlightSpeaker','vnpHighlight'],['autoScene','vnpAutoScene']]){
            const input=$(field);if(input){if(input.type==='checkbox')input.checked=!!cfg[key];else input.value=cfg[key];}
          }
          modal.querySelector('.vnl-settings')?.remove();window.OCVnLayout?.injectSettings(modal,record,cfg);
        }
        modal.querySelectorAll('.vnp-body input,.vnp-body select,#vnlOpenStudio').forEach(input=>{if(input!==toggle)input.disabled=toggle.checked;});
      };
      toggle.addEventListener('change',update);update();
    }
    const notes=modal.querySelector('.vnp-body>section:last-child p');
    if(notes)notes.textContent='可用一鍵判斷說話人、場景、人物情緒、音樂及人物退場，也可分別執行。場景、音樂和退場時機直接寫入劇本指令；情緒與站位仍保存為逐句設定。劇本台詞保持原文。';
  };
  const baseSave=save;
  save=function(){
    const record=scopeRecord();if(!record)return;
    if($('vnpInheritBook')?.checked){record.visualNovelPage={...record.visualNovelPage,inheritBook:true};saveStateToLocalStorage();close();return;}
    record.visualNovelPage={...record.visualNovelPage,inheritBook:false,layoutTemplateId:$('vnpLayoutTemplate')?.value||''};baseSave();
  };
  const baseRenderPlayer=renderPlayer;
  renderPlayer=function(){baseRenderPlayer();window.OCVnLayout?.apply(player,currentConfig);};
  const legacyStart=window.startVisualNovel;
  window.startVisualNovel=function(docId,withTransition=true,preserveHistory=false){const doc=documents.find(row=>row.id===docId);if(doc&&configFor(doc).mode!=='classic'){openAdvanced(docId);return;}return legacyStart(docId,withTransition,preserveHistory);};
  window.OCVnPage={open,openFromBook,openFromDocument,openFromEditor,close,refreshSettings:()=>modal?.classList.contains('active')&&renderSettings(),renderAnnotations,renderPromptEditor,promptFor,analyze,analyzeAll,configFor,classicCue,closePlayer,expressionAvatar,applyAvatarCrop};
})();


