/* Manual cloud saves. Provider credentials never enter these snapshots. */
(()=>{
  'use strict';
  const C=CloudSyncCore,URL='https://tblaedenqehnphnielce.supabase.co',KEY='sb_publishable_sU27YVhiCvgvm1u3pdAYZw_LWh3NKCP';
  const SESSION='oc_cloud_auth_v1';
  localStorage.removeItem('oc_cloud_unlocked_v1');
  const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let modal,selected=new Set(['workshop','forum']),session=null,preview=null,working=false;
  const scopeNames={workshop:'人設卡工坊',forum:'同人論壇'};
  try{session=JSON.parse(localStorage.getItem(SESSION)||'null');}catch{}
  const labels={favoriteFolders:'收藏資料夾',tagCatalog:'論壇 Tag',characters:'人物',paros:'世界觀',worlds:'世界觀',factions:'陣營',rankings:'排名',cps:'CP',books:'書籍',documents:'文章',visualNovelTemplates:'劇場模板',collapsedBooks:'書籍摺疊',perspectiveTargets:'視角設定',boards:'作品板塊',relationships:'關係',accounts:'我的帳號',users:'同好帳號',posts:'貼文',comments:'留言'};
  const baselineKey=scope=>`oc_cloud_base_${session.user.id}_${scope}`;
  function workshop(){return {characters,paros,factions,rankings,cps,books,documents,visualNovelTemplates,collapsedBooks,perspectiveTargets};}
  function snapshot(scope){return scope==='forum'?OCForum.cloudSnapshot():C.snapshot(scope,workshop());}
  function assign(d){({characters,paros,factions,rankings,cps,books,documents,visualNovelTemplates,collapsedBooks,perspectiveTargets}=d);}
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
      const response=await fetch(URL+path,{method:body?'POST':'GET',headers:{apikey:KEY,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+session.access_token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
      const result=response.status===204?{}:await response.json();
      if(!response.ok){const reason=result.message||result.error_description||result.msg||result.error||'連線失敗';if(String(reason).includes('SYNC_CONFLICT'))throw new Error('雲端已被另一台裝置更新，請重新刷新檢查。');if(['PGRST205','PGRST202','42P01'].includes(result.code))throw new Error('雲端資料表尚未建立。請先在 Supabase SQL Editor 執行 supabase/setup.sql。');throw new Error(reason);}
      return result;
    }finally{clearTimeout(timer);}
  }
  function keepSession(value){session={access_token:value.access_token,refresh_token:value.refresh_token,expires_at:value.expires_at||Date.now()/1000+value.expires_in,user:{id:value.user.id,email:value.user.email}};localStorage.setItem(SESSION,JSON.stringify(session));}
  async function head(scope){const rows=await request('/rest/v1/oc_sync_heads?scope=eq.'+scope+'&select=revision,payload,updated_at');if(!rows.length)return {revision:0,payload:C.snapshot(scope,{})};return {...rows[0],payload:C.validate(rows[0].payload)};}
  const button=(action,text)=>`<button type="button" class="btn btn-outline" data-cloud="${action}">${text}</button>`;
  function shell(content){modal.innerHTML=`<section class="oc-cloud-panel" role="dialog" aria-modal="true" aria-labelledby="cloud-title"><header><div><small>YOUR PRIVATE ARCHIVE</small><h2 id="cloud-title">雲端存檔</h2></div>${button('close','✕ 關閉')}</header>${content}<p role="status" aria-live="polite"></p></section>`;}
  function render(){
    if(!session){shell(`<p>登入同一個雲端帳號，即可在不同裝置手動同步。</p><form data-form="login"><label>雲端帳號 Email<input name="email" type="email" autocomplete="username" required></label><label>雲端帳號密碼<input name="password" type="password" autocomplete="current-password" required></label><button class="btn btn-primary">登入</button></form><p>首次使用：先執行 <a href="supabase/setup.sql" target="_blank" rel="noopener">資料表設定 SQL</a>，再到 Supabase → Authentication → Users 建立使用者。這裡填的是該使用者密碼。</p>`);return;}

    shell(`<div class="oc-cloud-account"><p class="oc-cloud-info">${e(session.user.email)}</p>${button('logout','登出')}</div><div class="oc-cloud-tools oc-cloud-scopes"><strong>同步內容</strong>${Object.entries(scopeNames).map(([key,name])=>`<label><input type="checkbox" data-scope="${key}" ${selected.has(key)?'checked':''}>${name}</label>`).join('')}</div><div class="oc-cloud-main-actions">${button('upload','↑ 上傳') }${button('download','↓ 下載')}</div><p class="oc-cloud-info">自動合併沒有衝突的更新；有衝突時才需要挑選版本。下載會保留本機尚未上傳的修改。AI 金鑰只留在本機。</p><div id="cloud-diff"></div>`);
    if(preview){
      const rows=preview.items.flatMap(item=>item.changes.filter(d=>d.conflict).map(d=>({...d,scope:item.scope}))),automatic=preview.items.reduce((n,p)=>n+p.changes.filter(d=>!d.conflict).length,0);
      modal.querySelector('#cloud-diff').innerHTML=`<h3>有 ${rows.length} 項內容需要你決定</h3><p>其餘 ${automatic} 項更新會自動合併。${preview.reason?e(preview.reason):''}</p>${rows.map((d,i)=>`<article class="oc-cloud-row"><div><strong>${e(scopeNames[d.scope])} / ${e(labels[d.group])} · ${e(d.local?.name||d.remote?.name||d.local?.title||d.remote?.title||d.id)}</strong><span>${e(d.status)}</span></div><label>處理方式<select data-choice="${i}" data-scope-key="${d.scope}" data-change-key="${e(d.key)}"><option value="local" ${d.choice==='local'?'selected':''}>保留本機${d.local?'':'（刪除）'}</option><option value="remote" ${d.choice==='remote'?'selected':''}>採用雲端${d.remote?'':'（刪除）'}</option>${d.local&&d.remote&&!C.mapFields.has(d.group)?'<option value="copy">保留兩份</option>':''}</select></label><details><summary>展開比較內容</summary><div class="oc-cloud-compare"><div>本機<pre>${e(d.local?JSON.stringify(d.local,null,2):'已刪除／不存在')}</pre></div><div>雲端<pre>${e(d.remote?JSON.stringify(d.remote,null,2):'已刪除／不存在')}</pre></div></div></details></article>`).join('')}<div class="oc-cloud-confirm">${button('confirm','確認並繼續'+(preview.direction==='upload'?'上傳':'下載'))}${button('cancel','取消本次同步')}</div>`;
    }
  }
  async function start(direction){
    if(!selected.size)throw new Error('請至少選擇一個同步區域。');
    preview=null;render();message('正在檢查雲端資料…');
    const items=[];
    // Read every selected area before making any changes.
    for(const scope of selected){const local=snapshot(scope),remote=await head(scope);let base=null;try{base=C.validate(JSON.parse(localStorage.getItem(baselineKey(scope))));}catch{}
      if(direction==='download'&&remote.revision===0){items.push({scope,local,remote:remote.payload,revision:0,changes:[],skip:true});continue;}
      items.push({scope,local,remote:remote.payload,revision:remote.revision,changes:C.plan(local,remote.payload,base,direction)});
    }
    preview={items,direction};
    if(items.some(p=>p.changes.some(d=>d.conflict))){render();message('已暫停同步，請選擇衝突項目的處理方式。');return;}
    await commit();
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
        if(upload&&!C.equal(p.merged,p.remote)){await request('/rest/v1/rpc/oc_push_snapshot',{p_scope:p.scope,p_expected_revision:p.revision,p_payload:p.merged});uploaded=true;const saved=await head(p.scope);if(!C.equal(saved.payload,p.merged))throw new Error(scopeNames[p.scope]+'上傳後的雲端內容與預期不同，未更動本機。若資料表設定較舊，請重新執行最新 supabase/setup.sql，再同步。');}
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
      modal.addEventListener('submit',event=>{event.preventDefault();run(async()=>{const form=event.target,fields=new FormData(form);const result=await request('/auth/v1/token?grant_type=password',{email:fields.get('email'),password:fields.get('password')},false);form.reset();keepSession(result);render();message('登入成功，可直接上傳或下載。');});});
      modal.addEventListener('click',event=>{const action=event.target.closest('[data-cloud]')?.dataset.cloud;if(!action||working)return;if(action==='close')return close();run(async()=>{if(action==='upload'||action==='download')return start(action);if(action==='confirm')return commit();if(action==='cancel'){preview=null;render();return;}if(action==='logout'){try{await request('/auth/v1/logout',{});}finally{localStorage.removeItem(SESSION);session=null;preview=null;render();}}});});
      modal.addEventListener('change',event=>{if(event.target.matches('[data-scope]')&&!working){const key=event.target.dataset.scope;event.target.checked?selected.add(key):selected.delete(key);preview=null;render();}});
      modal.addEventListener('keydown',event=>{if(event.key==='Escape')close();if(event.key==='Tab'){const items=[...modal.querySelectorAll('button,input,select,a,summary')].filter(el=>el.getClientRects().length),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
    }
    this.returnFocus=document.activeElement;modal.dataset.previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';modal.hidden=false;render();modal.querySelector('input,button')?.focus();
  }};
})();
