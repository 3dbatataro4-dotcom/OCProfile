/* Manual cloud saves. Provider credentials never enter these snapshots. */
(()=>{
  'use strict';
  const C=CloudSyncCore,URL='https://tblaedenqehnphnielce.supabase.co',KEY='sb_publishable_sU27YVhiCvgvm1u3pdAYZw_LWh3NKCP';
  const SESSION='oc_cloud_auth_v1';
  localStorage.removeItem('oc_cloud_unlocked_v1');
  const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let modal,selected=new Set(['workshop','forum']),session=null,preview=null,working=false,backupTimesLoading=false;
  const cloudHeads={workshop:null,forum:null};
  const scopeNames={workshop:'人設卡工坊',forum:'同人論壇'};
  try{session=JSON.parse(localStorage.getItem(SESSION)||'null');}catch{}
  const labels={chatContacts:'私訊聯絡人',chats:'私人對話',chatMessages:'聊天紀錄',favoriteFolders:'收藏資料夾',tagCatalog:'論壇 Tag',characters:'人物',paros:'世界觀',worlds:'世界觀',factions:'陣營',rankings:'排名',cps:'CP',books:'書籍',documents:'文章',visualNovelTemplates:'劇場模板',customPresetAvatars:'自訂預設頭像',collapsedBooks:'書籍摺疊',perspectiveTargets:'視角設定',boards:'論壇空間',relationships:'關係',loreEntries:'注意詞條',accounts:'我的帳號',users:'同好帳號',posts:'貼文',comments:'留言'};
  const baselineKey=scope=>`oc_cloud_base_${session.user.id}_${scope}`;
  function workshop(){return {characters,paros,factions,rankings,cps,books,documents,visualNovelTemplates,customPresetAvatars,collapsedBooks,perspectiveTargets};}
  function snapshot(scope){return scope==='forum'?OCForum.cloudSnapshot():C.snapshot(scope,workshop());}
  function assign(d){({characters,paros,factions,rankings,cps,books,documents,visualNovelTemplates,customPresetAvatars=customPresetAvatars,collapsedBooks,perspectiveTargets}=d);}
  function apply(payload){
    const data=C.source(payload);
    if(payload.scope==='forum')return OCForum.applyCloud(data);
    const old=workshop(),keys=['oc_characters','oc_paros','oc_factions','oc_rankings','oc_cps','oc_books','oc_documents','oc_visual_novel_templates','oc_collapsed_books','oc_perspective_targets'];
    const stored=keys.map(k=>[k,localStorage.getItem(k)]);
    try{assign(data);saveStateToLocalStorage();}catch(err){assign(old);for(const [k,v]of stored){try{v===null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch{}}throw err;}
    syncGlobalTags();renderAllViews();
  }
  function message(text){modal.querySelector('[role=status]').textContent=text;}
  async function request(path,body,auth=true){
    if(auth){if(!session?.access_token)throw new Error('請先登入雲端帳號。');if(session.expires_at<Date.now()/1000+60){const renewed=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token},false);keepSession(renewed);}}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    try{
      const hasBody=body!==undefined&&body!==null,serialized=hasBody?JSON.stringify(body):'';
      if(hasBody&&!serialized)throw new Error('無法建立雲端同步內容。');
      // Parsing locally catches damaged serialization before anything is sent.
      if(hasBody)JSON.parse(serialized);
      const send=async asBlob=>{
        const response=await fetch(URL+path,{method:hasBody?'POST':'GET',headers:{apikey:KEY,'Content-Type':'application/json;charset=UTF-8','Accept':'application/json',...(auth?{Authorization:'Bearer '+session.access_token}:{})},...(hasBody?{body:asBlob?new Blob([serialized],{type:'application/json;charset=UTF-8'}):serialized}:{}),signal:controller.signal});
        const raw=response.status===204?'':await response.text();
        let result={};
        if(raw)try{result=JSON.parse(raw);}catch{throw new Error(`Supabase 回傳了無法解析的內容（HTTP ${response.status}）。`);}
        return {response,result};
      };
      let {response,result}=await send(false);
      // PGRST102 means PostgREST could not see a valid JSON request body. A few
      // mobile WebViews mishandle a large string body; Blob uses a separate and
      // reliable upload path. PGRST102 is safe to retry because the RPC did not run.
      if(!response.ok&&result.code==='PGRST102'&&hasBody)({response,result}=await send(true));
      if(!response.ok){const reason=result.message||result.error_description||result.msg||result.error||'連線失敗';let error;if(String(reason).includes('SYNC_CONFLICT'))error=new Error('雲端已被另一台裝置更新，請重新刷新檢查。');else if(['PGRST205','PGRST202','42P01'].includes(result.code))error=new Error('雲端資料表尚未建立或版本較舊。請在 Supabase SQL Editor 重新執行最新的 supabase/setup.sql；既有雲端存檔不會被刪除。');else if(result.code==='PGRST102')error=new Error(`手機未能完整送出同步內容（${new Blob([serialized]).size} bytes）。`);else error=new Error(reason);error.code=result.code;throw error;}
      return result;
    }finally{clearTimeout(timer);}
  }
  async function pushSnapshot(scope,revision,payload){
    const serialized=JSON.stringify(payload),bytes=new TextEncoder().encode(serialized).length;
    if(bytes<=98304){try{return await request('/rest/v1/rpc/oc_push_snapshot',{p_scope:scope,p_expected_revision:revision,p_payload:payload});}catch(err){if(err.code!=='PGRST102')throw err;}}
    const chunks=C.encodeUtf8Chunks(serialized),uploadId=(typeof globalThis.crypto?.randomUUID==='function'?globalThis.crypto.randomUUID():'cs'+Date.now().toString(36)+Math.random().toString(36).slice(2,9));
    for(let i=0;i<chunks.length;i++){
      message(`${scopeNames[scope]}正在分段上傳（${i+1} / ${chunks.length}）…`);
      await request('/rest/v1/rpc/oc_stage_snapshot_chunk',{p_scope:scope,p_upload_id:uploadId,p_chunk_index:i,p_chunk:chunks[i]});
    }
    return request('/rest/v1/rpc/oc_commit_snapshot_chunks',{p_scope:scope,p_expected_revision:revision,p_upload_id:uploadId,p_chunk_count:chunks.length});
  }
  function keepSession(value){session={access_token:value.access_token,refresh_token:value.refresh_token,expires_at:value.expires_at||Date.now()/1000+value.expires_in,user:{id:value.user.id,email:value.user.email}};localStorage.setItem(SESSION,JSON.stringify(session));}
  async function head(scope){const rows=await request('/rest/v1/oc_sync_heads?scope=eq.'+scope+'&select=revision,payload,updated_at');if(!rows.length)return {revision:0,payload:C.snapshot(scope,{})};return {...rows[0],payload:C.validate(rows[0].payload)};}
  function formatBackupTime(value){
    if(!value)return '尚未建立雲端備份';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return '時間資料無法辨識';
    return date.toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  }
  function backupTimesHtml(){
    const available=Object.values(cloudHeads).filter(item=>item?.updated_at);
    const latest=available.sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at))[0];
    return `<section class="oc-cloud-backup-times" aria-label="雲端備份時間"><div class="oc-cloud-time-summary"><span>雲端最近備份</span><strong>${backupTimesLoading?'正在讀取…':formatBackupTime(latest?.updated_at)}</strong><small>顯示兩個存檔區域中最近一次成功上傳的時間</small></div><div class="oc-cloud-time-list">${Object.entries(scopeNames).map(([scope,name])=>{const item=cloudHeads[scope];return `<article><span>${e(name)}</span><time${item?.updated_at?` datetime="${e(item.updated_at)}"`:''}>${backupTimesLoading&&!item?'正在讀取…':e(formatBackupTime(item?.updated_at))}</time>${item?.revision?`<small>雲端版本 #${e(item.revision)}</small>`:'<small>尚無版本紀錄</small>'}</article>`;}).join('')}</div></section>`;
  }
  function updateBackupTimesUi(){const target=modal?.querySelector('#cloud-backup-times');if(target)target.innerHTML=backupTimesHtml();}
  async function refreshBackupTimes(){
    if(!session)return;
    backupTimesLoading=true;updateBackupTimesUi();
    try{const rows=await Promise.all(Object.keys(scopeNames).map(async scope=>[scope,await head(scope)]));for(const [scope,value] of rows)cloudHeads[scope]=value;}
    finally{backupTimesLoading=false;updateBackupTimesUi();}
  }
  const button=(action,text)=>`<button type="button" class="btn btn-outline" data-cloud="${action}">${text}</button>`;
  function manualBackupHtml(){return `<section class="oc-cloud-manual"><div class="oc-cloud-section-heading"><div><small>LOCAL BACKUP</small><h3>手動備份與讀取</h3></div><p>下載到裝置，不必登入；讀取時會自動辨識備份類型。</p></div><div class="oc-cloud-manual-actions">${button('export-complete','⬇ 完整備份')} ${button('export-workshop','人物工坊')} ${button('export-forum','同人論壇')} ${button('import-auto','⬆ 自動辨識並讀取')}</div><input hidden type="file" data-cloud-file accept=".json,.jason,application/json,text/json,text/plain"><p class="oc-cloud-info">完整備份同時包含人設卡工坊與論壇；也可以分開下載。讀取前會先顯示辨識結果並請你確認。</p></section>`;}
  function shell(content){modal.innerHTML=`<section class="oc-cloud-panel" role="dialog" aria-modal="true" aria-labelledby="cloud-title"><header><div><small>YOUR PRIVATE ARCHIVE</small><h2 id="cloud-title">雲端存檔</h2></div>${button('close','✕ 關閉')}</header>${content}<p role="status" aria-live="polite"></p></section>`;}
  function render(){
    if(!session){shell(`${manualBackupHtml()}<div class="oc-cloud-login"><div class="oc-cloud-section-heading"><div><small>CLOUD ARCHIVE</small><h3>登入雲端存檔</h3></div><p>登入同一帳號，在不同裝置間同步。</p></div><form data-form="login"><label>雲端帳號 Email<input name="email" type="email" autocomplete="username" required></label><label>雲端帳號密碼<input name="password" type="password" autocomplete="current-password" required></label><button class="btn btn-primary">登入</button></form><p class="oc-cloud-info">首次使用：先執行 <a href="supabase/setup.sql" target="_blank" rel="noopener">資料表設定 SQL</a>，再到 Supabase → Authentication → Users 建立使用者。</p></div>`);return;}

    shell(`${manualBackupHtml()}<section class="oc-cloud-online"><div class="oc-cloud-account"><div><small>CLOUD ARCHIVE</small><p class="oc-cloud-info">${e(session.user.email)}</p></div>${button('logout','登出')}</div><div id="cloud-backup-times">${backupTimesHtml()}</div><div class="oc-cloud-tools oc-cloud-scopes"><strong>同步內容</strong>${Object.entries(scopeNames).map(([key,name])=>`<label><input type="checkbox" data-scope="${key}" ${selected.has(key)?'checked':''}>${name}</label>`).join('')}</div><div class="oc-cloud-main-actions">${button('upload','↑ 上傳到雲端') }${button('download','↓ 合併雲端資料')}${button('restore','↙ 從雲端完整復原')}</div><p class="oc-cloud-info">上傳／下載會合併兩端資料；完整復原則直接採用雲端版本。大型論壇會自動分段傳送，AI 金鑰只留在手動備份與本機。</p><div id="cloud-diff"></div></section>`);
    if(preview){
      const rows=preview.items.flatMap(item=>item.changes.filter(d=>d.conflict).map(d=>({...d,scope:item.scope}))),automatic=preview.items.reduce((n,p)=>n+p.changes.filter(d=>!d.conflict).length,0);
      const modifiedRows=rows.filter(d=>d.local&&d.remote);
      const addedRows=rows.filter(d=>!d.local||!d.remote);
      const renderArticle=(d,i)=>`<article class="oc-cloud-row"><div><strong>${e(scopeNames[d.scope])} / ${e(labels[d.group])} · ${e(d.local?.name||d.remote?.name||d.local?.title||d.remote?.title||d.id)}</strong><span>${e(d.status)}</span></div><label>處理方式<select data-choice="${i}" data-scope-key="${d.scope}" data-change-key="${e(d.key)}"><option value="local" ${d.choice==='local'?'selected':''}>保留本機${d.local?'':'（刪除）'}</option><option value="remote" ${d.choice==='remote'?'selected':''}>採用雲端${d.remote?'':'（刪除）'}</option>${d.local&&d.remote&&!C.mapFields.has(d.group)?'<option value="copy">保留兩份</option>':''}</select></label><details><summary>展開比較內容</summary><div class="oc-cloud-compare"><div>本機<pre>${e(d.local?JSON.stringify(d.local,null,2):'已刪除／不存在')}</pre></div><div>雲端<pre>${e(d.remote?JSON.stringify(d.remote,null,2):'已刪除／不存在')}</pre></div></div></details></article>`;

      modal.querySelector('#cloud-diff').innerHTML=`<div class="oc-cloud-sticky-actions"><div><h3 style="margin:0">有 ${rows.length} 項內容需要你決定</h3><small>修改 ${modifiedRows.length} 筆 · 新增/刪除 ${addedRows.length} 筆</small></div><div class="oc-cloud-confirm" style="position:static;padding:0;border:none">${button('confirm','確認並繼續'+(preview.direction==='upload'?'上傳':'下載'))}${button('cancel','取消')}</div></div><p>其餘 ${automatic} 項更新會自動合併。${preview.reason?e(preview.reason):''}</p>${modifiedRows.length?`<details class="oc-cloud-group"><summary><strong>修改項（${modifiedRows.length} 筆）</strong><span>點擊展開比較</span></summary><div class="oc-cloud-group-body">${modifiedRows.map((d,i)=>renderArticle(d,i)).join('')}</div></details>`:''}${addedRows.length?`<details class="oc-cloud-group"><summary><strong>新增項／刪除項（${addedRows.length} 筆）</strong><span>點擊展開比較</span></summary><div class="oc-cloud-group-body">${addedRows.map((d,i)=>renderArticle(d,i+modifiedRows.length)).join('')}</div></details>`:''}<div class="oc-cloud-confirm">${button('confirm','確認並繼續'+(preview.direction==='upload'?'上傳':'下載'))}${button('cancel','取消')}</div>`;
    }
  }
  async function start(direction){
    if(!selected.size)throw new Error('請至少選擇一個同步區域。');
    preview=null;render();message('正在檢查雲端資料…');
    const items=[];
    // Read every selected area before making any changes.
    for(const scope of selected){const local=snapshot(scope),remote=await head(scope);cloudHeads[scope]=remote;let base=null;try{base=C.validate(JSON.parse(localStorage.getItem(baselineKey(scope))));}catch{}
      if(direction==='download'&&remote.revision===0){items.push({scope,local,remote:remote.payload,revision:0,changes:[],skip:true});continue;}
      items.push({scope,local,remote:remote.payload,revision:remote.revision,changes:C.plan(local,remote.payload,base,direction)});
    }
    preview={items,direction};
    if(items.some(p=>p.changes.some(d=>d.conflict))){render();message('已暫停同步，請選擇衝突項目的處理方式。');return;}
    await commit();
  }
  async function restore(){
    if(!selected.size)throw new Error('請至少選擇一個復原區域。');
    if(!confirm('確定以雲端存檔完整復原勾選區域？目前本機內容會先保存為復原前備份，再由雲端版本取代。'))return;
    const rows=[];
    message('正在讀取並驗證雲端存檔…');
    for(const scope of selected){const local=snapshot(scope),remote=await head(scope);cloudHeads[scope]=remote;if(remote.revision)rows.push({scope,local,remote:remote.payload});}
    if(!rows.length)throw new Error('勾選區域尚無雲端存檔，未更動本機。');
    for(const row of rows)localStorage.setItem('oc_cloud_before_'+row.scope,JSON.stringify(row.local));
    const applied=[];
    try{
      for(const row of rows){apply(row.remote);localStorage.setItem(baselineKey(row.scope),JSON.stringify(row.remote));applied.push(row);}
    }catch(err){for(const row of applied.reverse())try{apply(row.local);}catch{}throw new Error('復原未完成，本機已盡可能回復原狀：'+err.message);}
    render();message(rows.map(row=>scopeNames[row.scope]).join('、')+'已從雲端完整復原。');
  }
  async function commit(){
    if(!preview)throw new Error('請先選擇上傳或下載。');
    const pending=preview,decisions=Object.fromEntries(pending.items.map(p=>[p.scope,{}]));
    modal.querySelectorAll('[data-choice]').forEach(el=>decisions[el.dataset.scopeKey][el.dataset.changeKey]=el.value);
    // Compute and validate all results before modifying either save area.
    const results=[];
    for(const p of pending.items){if(p.skip)continue;try{results.push({...p,merged:C.merge(p.local,p.remote,p.changes,decisions[p.scope])});}catch(err){p.changes.forEach(d=>d.conflict=true);pending.reason=err.message;render();message('相關資料需要一起保留或刪除，請調整選擇。');return;}}
    for(const p of results){const latest=await head(p.scope);if(latest.revision!==p.revision)throw new Error(scopeNames[p.scope]+'的雲端版本已更新，請重新點選上傳或下載。');}
    for(const p of results){if(!C.equal(snapshot(p.scope),p.local))throw new Error(scopeNames[p.scope]+'的本機資料已改變，請重新點選上傳或下載。');localStorage.setItem('oc_cloud_before_'+p.scope,JSON.stringify(p.local));}
    const done=[];
    try{
      for(const p of results){
        if(!C.equal(snapshot(p.scope),p.local))throw new Error(scopeNames[p.scope]+'的本機資料已改變，請重新同步。');
        const upload=pending.direction==='upload';let uploaded=false;
        if(upload&&!C.equal(p.merged,p.remote)){await pushSnapshot(p.scope,p.revision,p.merged);uploaded=true;const saved=await head(p.scope);cloudHeads[p.scope]=saved;if(!C.equal(saved.payload,p.merged))throw new Error(scopeNames[p.scope]+'上傳後的雲端內容與預期不同，未更動本機。若資料表設定較舊，請重新執行最新 supabase/setup.sql，再同步。');}
        if(!C.equal(snapshot(p.scope),p.local))throw new Error(scopeNames[p.scope]+(uploaded?'已上傳，但本機有新修改，未覆蓋本機。':'的本機資料已改變。'));
        try{apply(p.merged);}catch(err){throw new Error(scopeNames[p.scope]+(uploaded?'已上傳，但本機套用失敗：':'套用失敗：')+err.message);}
        try{localStorage.setItem(baselineKey(p.scope),JSON.stringify(upload?p.merged:p.remote));}catch{}
        done.push(scopeNames[p.scope]);
      }
    }catch(err){preview=null;render();throw new Error((done.length?'已完成：'+done.join('、')+'。其餘未完成。':'')+err.message);}
    const skipped=pending.items.filter(p=>p.skip).map(p=>scopeNames[p.scope]);
    preview=null;render();message((done.length?done.join('、')+'已'+(pending.direction==='upload'?'上傳':'下載')+'完成。':'')+(skipped.length?skipped.join('、')+'尚無雲端存檔，本機資料保持原狀。':''));
  }
  async function run(fn){if(working)return;working=true;modal.setAttribute('aria-busy','true');try{await fn();}catch(err){message(err.name==='AbortError'?'連線逾時，請重新刷新比對再試。':err.message);}finally{working=false;modal.removeAttribute('aria-busy');}}
  function close(){if(working)return;modal.hidden=true;preview=null;document.body.style.overflow=modal.dataset.previousOverflow||'';window.OCCloud.returnFocus?.focus();}
  window.OCCloud={isOpen:()=>!!modal&&!modal.hidden,open(){
    if(working)return;selected=new Set(['workshop','forum']);preview=null;
    if(!modal){modal=document.createElement('div');modal.className='oc-cloud-overlay';modal.hidden=true;document.body.append(modal);
      modal.addEventListener('submit',event=>{event.preventDefault();run(async()=>{const form=event.target,fields=new FormData(form);const result=await request('/auth/v1/token?grant_type=password',{email:fields.get('email'),password:fields.get('password')},false);form.reset();keepSession(result);render();await refreshBackupTimes();message('登入成功，已讀取雲端備份時間。');});});
      modal.addEventListener('click',event=>{const action=event.target.closest('[data-cloud]')?.dataset.cloud;if(!action||working)return;if(action==='close')return close();if(action==='export-complete'){exportDataJson();message('完整備份已下載到裝置。');return;}if(action==='export-workshop'){exportWorkshopDataJson();message('人設卡工坊備份已下載到裝置。');return;}if(action==='export-forum'){try{exportForumDataJson();message('論壇備份已下載到裝置。');}catch(err){message(err.message);}return;}if(action==='import-auto'){modal.querySelector('[data-cloud-file]')?.click();return;}run(async()=>{if(action==='upload'||action==='download')return start(action);if(action==='restore')return restore();if(action==='confirm')return commit();if(action==='cancel'){preview=null;render();return;}if(action==='logout'){try{await request('/auth/v1/logout',{});}finally{localStorage.removeItem(SESSION);session=null;preview=null;cloudHeads.workshop=null;cloudHeads.forum=null;render();}}});});
      modal.addEventListener('change',event=>{if(event.target.matches('[data-scope]')&&!working){const key=event.target.dataset.scope;event.target.checked?selected.add(key):selected.delete(key);preview=null;render();}});
      modal.addEventListener('change',event=>{if(!event.target.matches('[data-cloud-file]'))return;const input=event.target,file=input.files?.[0];run(async()=>{try{const result=await importBackupFileAutomatically(file);if(result&&!result.cancelled){render();message(`已自動辨識並讀取「${result.label}」備份。`);}}finally{input.value='';}});});
      modal.addEventListener('keydown',event=>{if(event.key==='Escape')close();if(event.key==='Tab'){const items=[...modal.querySelectorAll('button,input,select,a,summary')].filter(el=>el.getClientRects().length),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
    }
    this.returnFocus=document.activeElement;modal.dataset.previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';modal.hidden=false;render();modal.querySelector('input,button')?.focus();
    if(session)refreshBackupTimes().catch(err=>message('備份時間暫時無法讀取：'+err.message));
  }};
})();
