/* Character tier lists. Each subject owns its tiers, roster and ordering. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const key=()=>`tier_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const palette=[['紅','#b97375'],['橙','#d49b6a'],['黃','#d1be76'],['綠','#83ad98'],['藍','#8199b9'],['靛','#817eaf'],['紫','#ac85ac']];
  const quadrantPalettes={
    1:['#f6d8de','#f3c3d0','#f9e3e4','#e9b3c4'],
    2:['#d9ecd9','#bfe0c9','#eaf2d6','#b4d8c2'],
    3:['#f8e4bf','#f8d6a8','#f9eccd','#edc79c'],
    4:['#dce5f5','#d8d7f0','#c5d8ee','#e7ddf5']
  };
  const defaults=['S','A','B','C','D'].map((name,index)=>[name,palette[index][1]]);
  const quadrantDefaults=()=>({left:'左側',right:'右側',top:'上方',bottom:'下方',palette:1,points:[]});
  let editing=false,picker=null,pickerSet=new Set(),pickerSearch='',pickerFaction='',drag=null,nativeDragId='',nativeSourceTier='',dropPreview=null,textPreview=null,textPreviewReturnFocus=null,pngDialog=null,pickedId='',suppressTileClickUntil=0;
  const roster=()=>characters.filter(char=>!char.isHidden);
  const char=id=>characters.find(row=>String(row.id)===String(id));
  const rank=()=>rankings.find(row=>String(row.id)===String(currentRankingSubjectId))||rankings[0];
  const tier=(list,id)=>list.tiers.find(row=>row.id===id);
  const save=()=>saveStateToLocalStorage();
  function normalize(list){
    if(Array.isArray(list.tiers)){
      list.poolIds=Array.isArray(list.poolIds)?[...new Set(list.poolIds.map(String))]:[...new Set([...(list.tiers||[]).flatMap(row=>row.entries||[]).map(row=>String(row.charId)),...roster().map(row=>String(row.id))])];
      list.description=String(list.description||'');list.mode=list.mode==='quadrant'?'quadrant':'tier';
      list.quadrant={...quadrantDefaults(),...(list.quadrant||{})};
      if(!quadrantPalettes[list.quadrant.palette])list.quadrant.palette=1;
      if(!Array.isArray(list.quadrant.points))list.quadrant.points=[];
      return list;
    }
    const items=Array.isArray(list.items)?list.items:[],cuts=new Map((list.cutoffs||[]).map(row=>[String(row.charId),row.label]));
    if(items.length){list.tiers=[];for(const item of items){const cutoff=cuts.get(String(item.charId));if(cutoff||!list.tiers.length)list.tiers.push({id:key(),name:cutoff||'未分級',color:palette[list.tiers.length%palette.length][1],entries:[]});list.tiers.at(-1).entries.push({charId:String(item.charId),equalNext:item.operator==='='});}}
    else list.tiers=defaults.map(([name,color])=>({id:key(),name,color,entries:[]}));
    list.poolIds=[...new Set([...roster().map(row=>String(row.id)),...items.map(row=>String(row.charId))])];
    list.description=String(list.description||'');list.mode='tier';list.quadrant=quadrantDefaults();delete list.items;delete list.cutoffs;save();return list;
  }
  function selectedIds(list){return new Set([...(list.poolIds||[]).map(String),...list.tiers.flatMap(row=>row.entries.map(entry=>String(entry.charId))),...(list.quadrant?.points||[]).map(point=>String(point.charId))]);}
  function unranked(list){const placed=new Set(list.mode==='quadrant'?list.quadrant.points.map(point=>String(point.charId)):list.tiers.flatMap(row=>row.entries.map(entry=>String(entry.charId))));return [...selectedIds(list)].filter(id=>!placed.has(id)&&char(id));}
  function tile(id,slot,tierId='',index=0,equalNext=false,position=null){const person=char(id);if(!person)return '';const style=position?` style="left:clamp(var(--tl-point-inset),${Math.max(0,Math.min(100,Number(position.x)||0))}%,calc(100% - var(--tl-point-inset)));top:clamp(var(--tl-point-inset),${Math.max(0,Math.min(100,Number(position.y)||0))}%,calc(100% - var(--tl-point-inset)))"`:'';return `<div class="tl-person${pickedId===String(id)?' tl-picked':''}"${style} data-char="${esc(id)}" data-slot="${slot}" data-tier="${esc(tierId)}" data-index="${index}" draggable="${editing}" tabindex="${editing?'0':'-1'}" role="img" aria-label="${esc(person.name)}${equalNext?'，與後一位約等於':''}" title="${esc(person.name)}${editing?' · 拖曳或點選後選擇階級；雙擊切換約等於':''}"><div class="tl-image"><img src="${esc(person.avatar||DEFAULT_VN_AVATAR)}" alt="" loading="lazy" draggable="false"></div>${equalNext?'<b class="tl-equals" title="與後一位約等於">≈</b>':''}</div>`;}
  function render(){const bar=$('rankingSubjectBar'),card=$('rankingCard');if(!bar||!card)return;if(!rankings.length){bar.innerHTML='';card.innerHTML='<div class="tl-empty">還沒有 Tier List。按右上角建立第一個主題。</div>';return;}
    const list=normalize(rank());currentRankingSubjectId=list.id;if(list.mode==='quadrant')return renderQuadrantBoard(bar,card,list);
    bar.innerHTML=rankings.map(row=>`<button type="button" class="tl-subject ${row.id===list.id?'active':''}" data-tl="subject" data-id="${esc(row.id)}">${esc(row.subject)}${row.mode==='quadrant'?' ◫':''}</button>`).join('');
    card.className='ranking-card tl-board';card.dataset.rankId=list.id;
    card.innerHTML=`<header class="tl-head"><div><small>TIER LIST / CHARACTER ARCHIVE</small>${editing?`<input class="tl-title-input" data-tl-field="subject" maxlength="100" value="${esc(list.subject)}" aria-label="主題名稱">`:`<h3>${esc(list.subject)}</h3>`}${editing?`<textarea class="tl-description-input" data-tl-field="description" rows="2" placeholder="寫下這個排名主題的簡介">${esc(list.description)}</textarea>`:`<p>${esc(list.description||'為這份 Tier List 寫一段簡介。')}</p>`}</div><div class="tl-head-actions"><button type="button" class="btn btn-outline" data-tl="text">匯出文字</button><button type="button" class="btn btn-outline" data-tl="png">匯出 PNG</button><button type="button" class="btn ${editing?'btn-primary':'btn-outline'}" data-tl="edit" aria-pressed="${editing}">${editing?'完成編輯':'開啟編輯'}</button></div></header><div class="tl-rows">${list.tiers.map((row,index)=>`<section class="tl-row" data-drop-tier="${esc(row.id)}" style="--tier-color:${esc(row.color)}"><div class="tl-label">${editing?`<input data-tier-name="${esc(row.id)}" maxlength="40" value="${esc(row.name)}" aria-label="階級名稱"><div class="tl-tier-controls"><select data-tier-palette="${esc(row.id)}" aria-label="內建階級顏色"><option value="">自訂</option>${palette.map(([name,color])=>`<option value="${color}" ${row.color.toLowerCase()===color?'selected':''}>${name}</option>`).join('')}</select><input type="color" value="${esc(row.color)}" data-tier-color="${esc(row.id)}" aria-label="自訂階級顏色"><button type="button" data-tl="tier-up" data-id="${esc(row.id)}" ${index===0?'disabled':''} title="上移階級">↑</button><button type="button" data-tl="tier-down" data-id="${esc(row.id)}" ${index===list.tiers.length-1?'disabled':''} title="下移階級">↓</button><button type="button" data-tl="tier-remove" data-id="${esc(row.id)}" title="刪除階級">×</button></div>`:`<strong>${esc(row.name)}</strong>`}</div><div class="tl-lane">${row.entries.map((entry,i)=>tile(entry.charId,'tier',row.id,i,!!entry.equalNext&&i<row.entries.length-1)).join('')}${!row.entries.length?'<span class="tl-lane-empty">將人物拖曳到這個階級</span>':''}</div></section>`).join('')}</div>${editing?'<button type="button" class="tl-add-tier" data-tl="tier-add">＋ 新增階級</button>':''}<section class="tl-pin" data-drop-pool><div class="tl-pin-head"><div><small>PIN IMAGES</small><h4>待排名人物 <span>${unranked(list).length}</span></h4><p>${editing?'在電腦拖曳頭像放入階級；也可先點頭像再點階級。雙擊已排名頭像可設為「約等於」。':'開啟編輯後可拖曳或點選頭像進行排名。'}</p></div>${editing?'<button type="button" class="btn btn-outline" data-tl="people">選擇人物</button>':''}</div><div class="tl-pin-grid">${unranked(list).map((id,index)=>tile(id,'pool','',index)).join('')||'<span class="tl-lane-empty">人物都已放進階級</span>'}</div></section>${editing?'<footer class="tl-foot"><button type="button" class="btn btn-danger" data-tl="delete">刪除此 Tier List</button></footer>':''}`;
    card.querySelector('.tl-head-actions')?.insertAdjacentHTML('afterbegin',editing?'<button type="button" class="btn btn-outline" data-tl="mode">切換為象限模式</button>':'');
    list.tiers.forEach(row=>{const label=[...card.querySelectorAll('.tl-row')].find(node=>node.dataset.dropTier===row.id)?.querySelector('.tl-label');if(!label)return;if(row.note)label.title=row.note;if(editing){const details=document.createElement('details');details.className='tl-note-editor';details.innerHTML=`<summary>隱藏註釋${row.note?' •':''}</summary><textarea data-tier-note="${esc(row.id)}" rows="3" placeholder="僅在滑鼠懸停與文字匯出顯示">${esc(row.note||'')}</textarea>`;label.append(details);}});
  }
  function renderQuadrantBoard(bar,card,list){
    const axis=(side)=>editing?`<input data-quadrant-axis="${side}" maxlength="30" value="${esc(list.quadrant[side])}" aria-label="象限${{left:'左',right:'右',top:'上',bottom:'下'}[side]}端標籤">`:`<strong>${esc(list.quadrant[side])}</strong>`;
    bar.innerHTML=rankings.map(row=>`<button type="button" class="tl-subject ${row.id===list.id?'active':''}" data-tl="subject" data-id="${esc(row.id)}">${esc(row.subject)}${row.mode==='quadrant'?' ◫':''}</button>`).join('');
    card.className='ranking-card tl-board tl-quadrant-mode';card.dataset.rankId=list.id;
    card.innerHTML=`<header class="tl-head"><div><small>QUADRANT / CHARACTER ARCHIVE</small>${editing?`<input class="tl-title-input" data-tl-field="subject" maxlength="100" value="${esc(list.subject)}" aria-label="主題名稱">`:`<h3>${esc(list.subject)}</h3>`}${editing?`<textarea class="tl-description-input" data-tl-field="description" rows="2" placeholder="寫下這個評比主題的簡介">${esc(list.description)}</textarea>`:`<p>${esc(list.description||'為這份象限評比寫一段簡介。')}</p>`}</div><div class="tl-head-actions">${editing?'<button type="button" class="btn btn-outline" data-tl="mode">切換為 Tier List</button>':''}<button type="button" class="btn btn-outline" data-tl="png">匯出 PNG</button><button type="button" class="btn ${editing?'btn-primary':'btn-outline'}" data-tl="edit" aria-pressed="${editing}">${editing?'完成編輯':'開啟編輯'}</button></div></header><div class="tl-quadrant-shell"><div class="tl-q-top">${axis('top')}</div><div class="tl-q-middle"><div class="tl-q-left">${axis('left')}</div><div class="tl-quadrant" data-drop-quadrant><div class="tl-q-center-x"></div><div class="tl-q-center-y"></div>${list.quadrant.points.map(point=>tile(point.charId,'quadrant','',0,false,point)).join('')}</div><div class="tl-q-right">${axis('right')}</div></div><div class="tl-q-bottom">${axis('bottom')}</div></div><section class="tl-pin" data-drop-pool><div class="tl-pin-head"><div><small>PIN IMAGES</small><h4>待放置人物 <span>${unranked(list).length}</span></h4><p>${editing?'拖曳頭像到象限任意位置，或先點頭像再點圖表。':'開啟編輯後可拖曳頭像到象限圖。'}</p></div>${editing?'<button type="button" class="btn btn-outline" data-tl="people">選擇人物</button>':''}</div><div class="tl-pin-grid">${unranked(list).map((id,index)=>tile(id,'pool','',index)).join('')||'<span class="tl-lane-empty">人物都已放進象限</span>'}</div></section>${editing?'<footer class="tl-foot"><button type="button" class="btn btn-danger" data-tl="delete">刪除此評分主題</button></footer>':''}`;
    const colors=quadrantPalettes[list.quadrant.palette];
    const board=card.querySelector('.tl-quadrant');
    ['tl','tr','bl','br'].forEach((corner,index)=>board.style.setProperty(`--q-${corner}`,colors[index]));
    card.querySelector('.tl-quadrant-shell').insertAdjacentHTML('afterbegin',`<div class="tl-q-palette-control"><span>象限配色</span>${editing?`<select data-quadrant-palette aria-label="象限配色方案">${[1,2,3,4].map(number=>`<option value="${number}" ${Number(list.quadrant.palette)===number?'selected':''}>配色方案 ${number}</option>`).join('')}</select>`:`<strong>配色方案 ${list.quadrant.palette}</strong>`}<div class="tl-q-swatches" aria-hidden="true">${colors.map(color=>`<i style="background:${color}"></i>`).join('')}</div></div>`);
  }
  function createSubject(){const name=prompt('評分主題名稱');if(!name?.trim())return;const list={id:`rank_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,subject:name.trim(),description:'',mode:'tier',tiers:defaults.map(([label,color])=>({id:key(),name:label,color,note:'',entries:[]})),quadrant:quadrantDefaults(),poolIds:roster().map(row=>String(row.id))};rankings.push(list);currentRankingSubjectId=list.id;editing=true;save();render();}
  function updateRankField(field,value){const list=rank();if(!list)return;list[field]=value.trim();save();render();}
  function addTier(){const list=rank();list.tiers.push({id:key(),name:`新階級 ${list.tiers.length+1}`,color:palette[list.tiers.length%palette.length][1],note:'',entries:[]});save();render();}
  function moveTier(id,direction){const list=rank(),index=list.tiers.findIndex(row=>row.id===id),target=index+direction;if(index<0||target<0||target>=list.tiers.length)return;[list.tiers[index],list.tiers[target]]=[list.tiers[target],list.tiers[index]];save();render();}
  function removeTier(id){const list=rank();if(list.tiers.length<=1)return alert('至少需要一個階級。');const row=tier(list,id);if(!row)return;if(row.entries.length&&!confirm(`刪除「${row.name}」？其中人物會回到待排名區。`))return;list.tiers=list.tiers.filter(item=>item.id!==id);save();render();}
  function movePerson(id,targetTier,targetIndex){const list=rank();if(!list||!selectedIds(list).has(String(id)))return;for(const row of list.tiers){const index=row.entries.findIndex(entry=>String(entry.charId)===String(id));if(index>=0){row.entries.splice(index,1);if(row.entries[index-1])row.entries[index-1].equalNext=false;}}
    if(targetTier){const row=tier(list,targetTier);if(!row)return;row.entries.splice(Math.max(0,Math.min(row.entries.length,targetIndex)),0,{charId:String(id),equalNext:false});}pickedId='';save();render();}
  function movePoint(id,x,y){const list=rank();if(!list||!selectedIds(list).has(String(id)))return;list.quadrant.points=list.quadrant.points.filter(point=>String(point.charId)!==String(id));list.quadrant.points.push({charId:String(id),x:Math.max(5,Math.min(95,Number(x)||0)),y:Math.max(5,Math.min(95,Number(y)||0))});pickedId='';save();render();}
  function unplacePerson(id){const list=rank();if(list.mode!=='quadrant')return movePerson(id,'',0);list.quadrant.points=list.quadrant.points.filter(point=>String(point.charId)!==String(id));pickedId='';save();render();}
  function toggleEqual(id){if(!editing)return;const list=rank();for(const row of list.tiers){const index=row.entries.findIndex(entry=>String(entry.charId)===String(id));if(index>=0&&index<row.entries.length-1){row.entries[index].equalNext=!row.entries[index].equalNext;save();render();return;}}}
  function textFor(list,allowed){normalize(list);if(list.mode==='quadrant')return '';const included=allowed?new Set(allowed.map(String)):null;return [`# ${list.subject}`,...(list.description?[list.description]:[]),...list.tiers.map(row=>{const entries=row.entries.map((entry,index)=>({entry,index,person:char(entry.charId)})).filter(({entry,person})=>person?.name&&(!included||included.has(String(entry.charId))));return `【${row.name}】${entries.map(({index,person},i)=>`${i?(row.entries.slice(entries[i-1].index,index).every(item=>item.equalNext)?'=':'>'):''}${person.name}`).join('')}${row.note?`\n註釋：${row.note}`:''}`;})].join('\n');}
  function download(name,blob){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function safeFile(value){return String(value||'Tier List').replace(/[\\/:*?"<>|]/g,'_');}
  function closeTextPreview(){textPreview?.remove();textPreview=null;textPreviewReturnFocus?.focus?.();textPreviewReturnFocus=null;}
  async function copyPreviewText(){const input=textPreview?.querySelector('textarea'),button=textPreview?.querySelector('[data-preview="copy"]');if(!input||!button)return;try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(input.value);else{input.select();if(!document.execCommand('copy'))throw Error('copy failed');}button.textContent='已複製';}catch{input.focus();input.select();button.textContent='請手動複製';}}
  function exportText(){const list=rank();if(!list||list.mode==='quadrant')return;closeTextPreview();textPreviewReturnFocus=document.activeElement;const filename=`${safeFile(list.subject)}.txt`;textPreview=document.createElement('div');textPreview.className='tl-text-preview-backdrop';textPreview.innerHTML=`<section class="tl-text-preview" role="dialog" aria-modal="true" aria-label="文字匯出預覽"><header><div><small>TEXT EXPORT</small><h3>文字匯出預覽</h3><p>確認內容後，可以複製或下載 TXT。</p></div><button type="button" class="tl-text-preview-close" data-preview="close" aria-label="關閉">×</button></header><textarea aria-label="匯出文字內容" spellcheck="false"></textarea><footer><button type="button" class="btn btn-outline" data-preview="copy">複製文字</button><button type="button" class="btn btn-primary" data-preview="download">下載 TXT</button></footer></section>`;textPreview.querySelector('textarea').value=textFor(list);textPreview.addEventListener('click',event=>{if(event.target===textPreview||event.target.closest('[data-preview="close"]'))closeTextPreview();else if(event.target.closest('[data-preview="copy"]'))copyPreviewText();else if(event.target.closest('[data-preview="download"]'))download(filename,new Blob([textPreview.querySelector('textarea').value],{type:'text/plain;charset=utf-8'}));});document.body.append(textPreview);textPreview.querySelector('textarea').focus();}
  function imageFor(person){
    return new Promise(resolve=>{
      if(!person)return resolve(null);
      const original=person.avatar||DEFAULT_VN_AVATAR;
      const local=original.startsWith(AVATAR_BASE_URL)?'_人物頭像/'+original.slice(AVATAR_BASE_URL.length):null;
      const image=new Image();
      let fallback=false,done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
      const timer=setTimeout(()=>finish(null),8000);
      image.onload=()=>finish(image);
      image.onerror=()=>{if(local&&!fallback){fallback=true;image.crossOrigin='anonymous';image.src=original;}else finish(null);};
      if(!local&&/^https?:/i.test(original))image.crossOrigin='anonymous';
      image.src=local||original;
    });
  }
  function visibleTierEntries(row){return row.entries.map((entry,index)=>({entry,index,person:char(entry.charId)})).filter(item=>!!item.person);}
  function wrapCanvasText(ctx,value,maxWidth){
    const lines=[];
    for(const paragraph of String(value||'').split('\n')){
      let line='';
      for(const letter of paragraph){
        if(line&&ctx.measureText(line+letter).width>maxWidth){lines.push(line);line=letter;}
        else line+=letter;
      }
      lines.push(line);
    }
    return lines;
  }
  function drawAvatar(ctx,image,person,cx,cy,r){
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
    ctx.fillStyle='#f3ede8';ctx.fillRect(cx-r,cy-r,r*2,r*2);
    if(image){
      const ratio=Math.min(r*2/image.width,r*2/image.height);
      const width=image.width*ratio,height=image.height*ratio;
      ctx.drawImage(image,cx-width/2,cy-height/2,width,height);
    }else{
      ctx.fillStyle='#8b7386';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='700 '+Math.round(r*.72)+'px sans-serif';
      ctx.fillText(String(person.name||'').slice(0,1),cx,cy);
    }
    ctx.restore();
  }
  async function canvasDownload(canvas,list){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('無法產生圖片');
    download(safeFile(list.subject)+'.png',blob);
  }
  async function exportQuadrantPng(list){
    const width=1200,measure=document.createElement('canvas').getContext('2d');
    measure.font='18px sans-serif';
    const descLines=list.description?wrapCanvasText(measure,list.description,1100):[];
    const top=150+descLines.length*28,board={x:140,y:top+55,size:920},height=board.y+board.size+110;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f6f2ed';ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#322b34';ctx.font='700 42px sans-serif';ctx.fillText(list.subject,44,66);
    ctx.fillStyle='#7b7180';ctx.font='18px sans-serif';
    descLines.forEach((line,index)=>ctx.fillText(line,46,101+index*28));
    const colors=quadrantPalettes[list.quadrant.palette]||quadrantPalettes[1];
    colors.forEach((color,index)=>{ctx.fillStyle=color;ctx.fillRect(board.x+(index%2)*460,board.y+Math.floor(index/2)*460,460,460);});
    ctx.strokeStyle='#a99ba4';ctx.lineWidth=2;ctx.strokeRect(board.x,board.y,board.size,board.size);
    ctx.beginPath();ctx.moveTo(board.x+460,board.y);ctx.lineTo(board.x+460,board.y+920);
    ctx.moveTo(board.x,board.y+460);ctx.lineTo(board.x+920,board.y+460);ctx.stroke();
    ctx.fillStyle='#514651';ctx.font='700 24px sans-serif';ctx.textAlign='center';
    ctx.fillText(list.quadrant.top,600,board.y-18,480);
    ctx.fillText(list.quadrant.bottom,600,board.y+board.size+42,480);
    ctx.textAlign='right';ctx.fillText(list.quadrant.left,board.x-14,board.y+470,130);
    ctx.textAlign='left';ctx.fillText(list.quadrant.right,board.x+board.size+14,board.y+470,130);
    const points=list.quadrant.points.map(point=>({point,person:char(point.charId)})).filter(item=>!!item.person);
    const images=new Map(await Promise.all(points.map(async item=>[String(item.point.charId),await imageFor(item.person)])));
    points.forEach(({point,person})=>{
      const cx=board.x+board.size*Math.max(0,Math.min(100,Number(point.x)||0))/100;
      const cy=board.y+board.size*Math.max(0,Math.min(100,Number(point.y)||0))/100;
      drawAvatar(ctx,images.get(String(point.charId)),person,cx,cy,42);
    });
    ctx.fillStyle='#8b7b82';ctx.font='18px sans-serif';ctx.textAlign='left';
    ctx.fillText('CHARACTER QUADRANT · 人設卡工坊',44,height-28);
    await canvasDownload(canvas,list);
  }
  async function exportTierPng(list,layout,includeNotes){
    const narrow=layout==='narrow',horizontal=layout==='horizontal';
    const width=narrow?760:horizontal?2200:1200,margin=narrow?20:horizontal?20:44,labelWidth=narrow?250:horizontal?240:190;
    const tileWidth=narrow?140:horizontal?128:105,tileHeight=narrow?144:horizontal?130:120,avatarSize=narrow?124:horizontal?116:98,perRow=narrow?3:horizontal?15:8,gap=12;
    const contentWidth=width-margin*2-labelWidth;
    const measure=document.createElement('canvas').getContext('2d');
    measure.font='18px sans-serif';
    const descLines=list.description?wrapCanvasText(measure,list.description,width-margin*2):[];
    const top=125+descLines.length*28;
    measure.font='16px sans-serif';
    const rows=list.tiers.map(row=>{
      const entries=visibleTierEntries(row);
      const lines=Math.max(1,Math.ceil(entries.length/perRow));
      const contentHeight=Math.max(avatarSize+20,lines*tileHeight+12);
      const noteLines=includeNotes&&row.note?wrapCanvasText(measure,row.note,contentWidth-28):[];
      return {row,entries,contentHeight,noteLines,height:contentHeight+(noteLines.length?noteLines.length*24+20:0)};
    });
    const height=top+rows.reduce((sum,item)=>sum+item.height+gap,0)+56;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f6f2ed';ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#322b34';ctx.font='700 42px sans-serif';ctx.fillText(list.subject,margin,66,width-margin*2);
    ctx.fillStyle='#7b7180';ctx.font='18px sans-serif';
    descLines.forEach((line,index)=>ctx.fillText(line,margin+2,101+index*28));
    const people=[...new Map(rows.flatMap(item=>item.entries.map(({entry,person})=>[String(entry.charId),person]))).entries()];
    const images=new Map(await Promise.all(people.map(async ([id,person])=>[id,await imageFor(person)])));
    let y=top;
    for(const item of rows){
      const {row,entries,contentHeight,noteLines,height:rowHeight}=item;
      ctx.fillStyle='#fffdfa';ctx.fillRect(margin,y,width-margin*2,rowHeight);
      ctx.fillStyle=row.color;ctx.fillRect(margin,y,labelWidth,rowHeight);
      ctx.fillStyle='#fff';ctx.font='700 '+(narrow?25:horizontal?30:23)+'px sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(row.name,margin+labelWidth/2,y+contentHeight/2,labelWidth-26);ctx.textBaseline='alphabetic';
      entries.forEach(({entry,index,person},visibleIndex)=>{
        const col=visibleIndex%perRow,line=Math.floor(visibleIndex/perRow);
        const x=margin+labelWidth+12+col*tileWidth,cy=y+8+line*tileHeight+avatarSize/2;
        const cx=x+avatarSize/2;
        drawAvatar(ctx,images.get(String(entry.charId)),person,cx,cy,avatarSize/2);
        const next=entries[visibleIndex+1];
        if(next&&row.entries.slice(index,next.index).every(part=>part.equalNext)){
          ctx.fillStyle='#d17650';ctx.font='700 22px sans-serif';ctx.textAlign='left';
          ctx.fillText('≈',x+tileWidth-18,cy+8);
        }
      });
      if(noteLines.length){
        const noteY=y+contentHeight;
        ctx.fillStyle='#e8dedc';ctx.fillRect(margin+labelWidth,noteY,contentWidth,rowHeight-contentHeight);
        ctx.fillStyle='#544b50';ctx.font='16px sans-serif';ctx.textAlign='left';
        noteLines.forEach((line,index)=>ctx.fillText(line,margin+labelWidth+14,noteY+25+index*24,contentWidth-28));
      }
      y+=rowHeight+gap;
    }
    ctx.fillStyle='#8b7b82';ctx.font='18px sans-serif';ctx.textAlign='left';
    ctx.fillText('CHARACTER TIER LIST · 人設卡工坊',margin+14,height-30);
    await canvasDownload(canvas,list);
  }
  function closePngDialog(){pngDialog?.remove();pngDialog=null;}
  async function exportPng(){
    const list=rank();if(!list)return;
    if(list.mode==='quadrant'){
      try{await exportQuadrantPng(list);}catch(error){alert('PNG 匯出失敗：'+error.message);}
      return;
    }
    closePngDialog();
    pngDialog=document.createElement('div');pngDialog.className='tl-png-backdrop';
    pngDialog.innerHTML='<section class="tl-png-dialog" role="dialog" aria-modal="true" aria-label="PNG 匯出設定">'+
      '<header><div><small>IMAGE EXPORT</small><h3>匯出 PNG</h3><p>選擇版型與階級註釋。</p></div><button type="button" data-png="close" aria-label="關閉">×</button></header>'+
      '<div class="tl-png-options"><fieldset><legend>圖片版型</legend>'+
      '<label class="tl-png-layout"><input type="radio" name="tl-png-layout" value="wide" checked><span class="tl-png-layout-icon default"></span><span><strong>默認</strong><small>默認輸出的版本</small></span></label>'+
      '<label class="tl-png-layout"><input type="radio" name="tl-png-layout" value="horizontal"><span class="tl-png-layout-icon horizontal"></span><span><strong>橫版</strong><small>每行容納較多人物</small></span></label>'+
      '<label class="tl-png-layout"><input type="radio" name="tl-png-layout" value="narrow"><span class="tl-png-layout-icon narrow"></span><span><strong>窄版</strong><small>適合手機查看。頭像較大。</small></span></label>'+
      '</fieldset><label class="tl-png-note"><input type="checkbox" data-png-notes><span>在圖片中顯示階級註釋</span></label></div>'+
      '<footer><button type="button" class="btn btn-outline" data-png="close">取消</button><button type="button" class="btn btn-primary" data-png="save">下載 PNG</button></footer></section>';
    pngDialog.addEventListener('click',async event=>{
      if(event.target===pngDialog||event.target.closest('[data-png="close"]')){closePngDialog();return;}
      const button=event.target.closest('[data-png="save"]');if(!button)return;
      button.disabled=true;button.textContent='正在產生圖片…';
      try{
        const layout=pngDialog.querySelector('input[name="tl-png-layout"]:checked').value;
        const includeNotes=pngDialog.querySelector('[data-png-notes]').checked;
        await exportTierPng(list,layout,includeNotes);
        closePngDialog();
      }catch(error){
        alert('PNG 匯出失敗：'+error.message);
        button.disabled=false;button.textContent='下載 PNG';
      }
    });
    document.body.append(pngDialog);
    pngDialog.querySelector('input[name="tl-png-layout"]').focus();
  }
  function filteredPeople(){const search=pickerSearch.toLocaleLowerCase();return roster().filter(person=>(!search||`${person.name} ${person.englishName||''}`.toLocaleLowerCase().includes(search))&&(!pickerFaction||characterBelongsToFaction(person,factions.find(row=>String(row.id)===pickerFaction))));}
  function renderPicker(){if(!picker)return;const visible=filteredPeople();picker.innerHTML=`<div class="tl-picker-shell" role="dialog" aria-modal="true" aria-label="選擇排名人物"><header><div><small>CHARACTER ROSTER</small><h3>選擇排名人物</h3></div><button type="button" data-tlp="close" aria-label="關閉">×</button></header><div class="tl-picker-filters"><input type="search" name="oc_filter_tierlist_people" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-tlp-search placeholder="搜尋人物名字" value="${esc(pickerSearch)}"><select data-tlp-faction><option value="">所有陣營</option>${factions.map(row=>`<option value="${esc(row.id)}" ${String(row.id)===pickerFaction?'selected':''}>${esc(row.name)}</option>`).join('')}</select></div><div class="tl-picker-bulk"><button type="button" data-tlp="all">全選所有角色</button><button type="button" data-tlp="visible">選取目前篩選</button><button type="button" data-tlp="none">清除目前篩選</button><span>已選 ${pickerSet.size} 人</span></div><div class="tl-picker-grid">${visible.map(person=>`<label><input type="checkbox" data-tlp-char="${esc(person.id)}" ${pickerSet.has(String(person.id))?'checked':''}><img src="${esc(person.avatar||DEFAULT_VN_AVATAR)}" alt=""><span>${esc(person.name)}</span></label>`).join('')||'<p>沒有符合的人物。</p>'}</div><footer><button type="button" class="btn btn-outline" data-tlp="close">取消</button><button type="button" class="btn btn-primary" data-tlp="save">套用人物選擇</button></footer></div>`;}
  function openPeople(){const list=rank();pickerSet=selectedIds(list);pickerSearch='';pickerFaction='';picker=document.createElement('div');picker.className='tl-picker-backdrop';document.body.append(picker);renderPicker();picker.querySelector('[data-tlp-search]')?.focus();}
  function closePeople(){picker?.remove();picker=null;}
  function savePeople(){const list=rank();list.poolIds=[...pickerSet];for(const row of list.tiers)row.entries=row.entries.filter(entry=>pickerSet.has(String(entry.charId)));list.quadrant.points=list.quadrant.points.filter(point=>pickerSet.has(String(point.charId)));save();closePeople();render();}
  function onBoardClick(event){const action=event.target.closest('[data-tl]');if(action&&($('rankingCard')?.contains(action)||$('rankingSubjectBar')?.contains(action))){const name=action.dataset.tl,id=action.dataset.id;if(name==='subject'){pickedId='';currentRankingSubjectId=id;render();}else if(name==='edit'){editing=!editing;pickedId='';render();}else if(name==='mode'){const list=rank();list.mode=list.mode==='quadrant'?'tier':'quadrant';pickedId='';save();render();}else if(name==='people')openPeople();else if(name==='tier-add')addTier();else if(name==='tier-up')moveTier(id,-1);else if(name==='tier-down')moveTier(id,1);else if(name==='tier-remove')removeTier(id);else if(name==='text')exportText();else if(name==='png')exportPng();else if(name==='delete'){const list=rank();if(confirm(`確定刪除「${list.subject}」評分主題？`)){rankings=rankings.filter(row=>row.id!==list.id);currentRankingSubjectId=rankings[0]?.id||null;save();render();}}return;}
    if(!editing||!$('rankingCard')?.contains(event.target)||event.target.closest('button,input,textarea,select,summary,details')||Date.now()<suppressTileClickUntil)return;
    const person=event.target.closest('.tl-person');if(person){pickedId=pickedId===person.dataset.char?'':person.dataset.char;document.querySelectorAll('#rankingCard .tl-picked').forEach(node=>node.classList.remove('tl-picked'));if(pickedId)person.classList.add('tl-picked');return;}
    if(!pickedId)return;const target=event.target.closest('[data-drop-tier],[data-drop-pool],[data-drop-quadrant]');if(!target)return;const row=target.dataset.dropTier;if(row)movePerson(pickedId,row,tier(rank(),row)?.entries.length||0);else if(target.hasAttribute('data-drop-quadrant')){const bounds=target.getBoundingClientRect();movePoint(pickedId,(event.clientX-bounds.left)/bounds.width*100,(event.clientY-bounds.top)/bounds.height*100);}else unplacePerson(pickedId);
  }
  function onBoardChange(event){if(!editing||!$('rankingCard')?.contains(event.target))return;const field=event.target.dataset.tlField,list=rank();if(field==='subject')return updateRankField('subject',event.target.value||list.subject);if(field==='description')return updateRankField('description',event.target.value);if(event.target.hasAttribute('data-quadrant-palette')){list.quadrant.palette=Number(event.target.value);save();render();return;}if(event.target.dataset.quadrantAxis){list.quadrant[event.target.dataset.quadrantAxis]=event.target.value.trim();save();render();return;}if(event.target.dataset.tierNote){const row=tier(list,event.target.dataset.tierNote);if(row){row.note=event.target.value.trim();save();render();}return;}if(event.target.dataset.tierName){const row=tier(list,event.target.dataset.tierName);if(row){row.name=event.target.value.trim()||row.name;save();render();}}if(event.target.dataset.tierPalette&&event.target.value){const row=tier(list,event.target.dataset.tierPalette);if(row){row.color=event.target.value;save();render();}}if(event.target.dataset.tierColor){const row=tier(list,event.target.dataset.tierColor);if(row){row.color=event.target.value;save();render();}}}
  function onBoardInput(event){if(!editing||!$('rankingCard')?.contains(event.target))return;const list=rank();if(event.target.dataset.quadrantAxis){list.quadrant[event.target.dataset.quadrantAxis]=event.target.value.trim();save();}else if(event.target.dataset.tierNote){const row=tier(list,event.target.dataset.tierNote);if(row){row.note=event.target.value.trim();event.target.closest('.tl-label').title=row.note;save();}}}
  function onPickerClick(event){if(!picker)return;const action=event.target.closest('[data-tlp]')?.dataset.tlp;if(!action)return;if(action==='close')closePeople();if(action==='save')savePeople();if(action==='all'){pickerSet=new Set(roster().map(row=>String(row.id)));renderPicker();}if(action==='visible'){filteredPeople().forEach(row=>pickerSet.add(String(row.id)));renderPicker();}if(action==='none'){filteredPeople().forEach(row=>pickerSet.delete(String(row.id)));renderPicker();}}
  function onPickerInput(event){if(!picker)return;if(event.target.matches('[data-tlp-search]')){pickerSearch=event.target.value;renderPicker();picker.querySelector('[data-tlp-search]')?.focus();picker.querySelector('[data-tlp-search]')?.setSelectionRange(pickerSearch.length,pickerSearch.length);}if(event.target.matches('[data-tlp-faction]')){pickerFaction=event.target.value;renderPicker();}if(event.target.matches('[data-tlp-char]')){event.target.checked?pickerSet.add(event.target.dataset.tlpChar):pickerSet.delete(event.target.dataset.tlpChar);picker.querySelector('.tl-picker-bulk span').textContent=`已選 ${pickerSet.size} 人`;}}
  function clearDropPreview(){dropPreview?.remove();dropPreview=null;}
  function previewTierPosition(id,row,x,y){const lane=row?.querySelector('.tl-lane');if(!lane||rank()?.mode==='quadrant'){clearDropPreview();return;}if(!dropPreview){dropPreview=document.createElement('div');dropPreview.className='tl-drop-preview';dropPreview.setAttribute('aria-hidden','true');const source=$('rankingCard')?.querySelector(`.tl-person[data-char="${CSS.escape(String(id))}"] .tl-image`);if(source)dropPreview.append(source.cloneNode(true));}const tiles=[...lane.querySelectorAll('.tl-person')].filter(tile=>tile.dataset.char!==String(id));let closest=null,distance=Infinity;for(const tile of tiles){const bounds=tile.getBoundingClientRect(),centerX=bounds.left+bounds.width/2,centerY=bounds.top+bounds.height/2,score=(x-centerX)**2+(y-centerY)**2;if(score<distance){closest=tile;distance=score;}}lane.insertBefore(dropPreview,closest&&(x<closest.getBoundingClientRect().left+closest.getBoundingClientRect().width/2||y<closest.getBoundingClientRect().top-8)?closest:closest?.nextSibling||null);}
  function previewIndex(id,row){if(!dropPreview||dropPreview.parentElement!==row.querySelector('.tl-lane'))return null;return [...dropPreview.parentElement.children].slice(0,[...dropPreview.parentElement.children].indexOf(dropPreview)).filter(node=>node.classList.contains('tl-person')&&node.dataset.char!==String(id)).length;}
  function dropPerson(id,element,x,y,sourceTier){const quadrant=element?.closest('[data-drop-quadrant]'),row=element?.closest('[data-drop-tier]'),pool=element?.closest('[data-drop-pool]');if(quadrant){clearDropPreview();const bounds=quadrant.getBoundingClientRect();movePoint(id,(x-bounds.left)/bounds.width*100,(y-bounds.top)/bounds.height*100);return;}if(row){const preview=previewIndex(id,row),target=element.closest('.tl-person'),entries=tier(rank(),row.dataset.dropTier)?.entries||[];if(target?.dataset.char===id&&preview===null){clearDropPreview();return;}let index=preview??entries.length;if(preview===null&&target){const bounds=target.getBoundingClientRect(),neighbor=target.previousElementSibling?.classList.contains('tl-person')?target.previousElementSibling:target.nextElementSibling?.classList.contains('tl-person')?target.nextElementSibling:null,vertical=neighbor&&Math.abs(neighbor.getBoundingClientRect().x-bounds.x)<bounds.width/2;index=Number(target.dataset.index)+(vertical?Number(y>bounds.top+bounds.height/2):Number(x>bounds.left+bounds.width/2));}if(preview===null&&sourceTier===row.dataset.dropTier){const from=entries.findIndex(entry=>String(entry.charId)===id);if(from>=0&&from<index)index--;}clearDropPreview();movePerson(id,row.dataset.dropTier,index);}else{clearDropPreview();if(pool)unplacePerson(id);}}
  function nativeDragStart(event){const tile=event.target.closest('.tl-person');if(!tile)return;if(!editing||!$('rankingCard')?.contains(tile)){event.preventDefault();return;}nativeDragId=tile.dataset.char;nativeSourceTier=tile.dataset.tier;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',nativeDragId);tile.classList.add('tl-drag-source');}
  function nativeDragOver(event){if(!nativeDragId)return;const target=event.target.closest('[data-drop-tier],[data-drop-pool],[data-drop-quadrant]');if(!target||!$('rankingCard')?.contains(target)){clearDropPreview();return;}event.preventDefault();event.dataTransfer.dropEffect='move';document.querySelectorAll('.tl-drop-active').forEach(node=>node.classList.remove('tl-drop-active'));target.classList.add('tl-drop-active');if(target.hasAttribute('data-drop-tier'))previewTierPosition(nativeDragId,target,event.clientX,event.clientY);else clearDropPreview();const edge=100;if(event.clientY<edge+90)window.scrollBy(0,-15);else if(event.clientY>window.innerHeight-edge)window.scrollBy(0,15);}
  function nativeDrop(event){if(!nativeDragId)return;const target=event.target.closest('[data-drop-tier],[data-drop-pool],[data-drop-quadrant]');if(!target||!$('rankingCard')?.contains(target))return;event.preventDefault();const id=nativeDragId,sourceTier=nativeSourceTier;nativeDragId='';nativeSourceTier='';suppressTileClickUntil=Date.now()+150;dropPerson(id,event.target,event.clientX,event.clientY,sourceTier);document.querySelectorAll('.tl-drop-active,.tl-drag-source').forEach(node=>node.classList.remove('tl-drop-active','tl-drag-source'));}
  function nativeDragEnd(){nativeDragId='';nativeSourceTier='';clearDropPreview();document.querySelectorAll('.tl-drop-active,.tl-drag-source').forEach(node=>node.classList.remove('tl-drop-active','tl-drag-source'));}
  function beginDrag(event){if(event.pointerType==='mouse')return;const tile=event.target.closest('.tl-person');if(!editing||!tile||!$('rankingCard')?.contains(tile)||event.button!==0)return;const startX=event.clientX,startY=event.clientY;drag={id:tile.dataset.char,startX,startY,pointerId:event.pointerId,source:tile,ghost:null,scrollFrame:0};tile.setPointerCapture?.(event.pointerId);}
  function autoScrollDrag(){if(!drag?.ghost)return;const y=drag.lastY,edge=105,top=110,bottom=window.innerHeight-70;let delta=0;if(y<top+edge)delta=-Math.min(24,(top+edge-y)/4);else if(y>bottom-edge)delta=Math.min(24,(y-(bottom-edge))/4);if(delta)window.scrollBy(0,delta);drag.scrollFrame=requestAnimationFrame(autoScrollDrag);}
  function dragMove(event){if(!drag||event.pointerId!==drag.pointerId)return;drag.lastX=event.clientX;drag.lastY=event.clientY;if(!drag.ghost&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<7)return;if(!drag.ghost){drag.ghost=drag.source.cloneNode(true);drag.ghost.classList.add('tl-drag-ghost');document.body.append(drag.ghost);drag.source.classList.add('tl-drag-source');drag.scrollFrame=requestAnimationFrame(autoScrollDrag);}drag.ghost.style.left=`${event.clientX+12}px`;drag.ghost.style.top=`${event.clientY+12}px`;document.querySelectorAll('.tl-drop-active').forEach(node=>node.classList.remove('tl-drop-active'));const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-drop-tier],[data-drop-pool],[data-drop-quadrant]');target?.classList.add('tl-drop-active');if(target?.hasAttribute('data-drop-tier'))previewTierPosition(drag.id,target,event.clientX,event.clientY);else clearDropPreview();event.preventDefault();}
  function dragEnd(event){if(!drag||event.pointerId!==drag.pointerId)return;const active=drag;drag=null;cancelAnimationFrame(active.scrollFrame);active.ghost?.remove();active.source.classList.remove('tl-drag-source');document.querySelectorAll('.tl-drop-active').forEach(node=>node.classList.remove('tl-drop-active'));if(!active.ghost||event.type==='pointercancel'){clearDropPreview();return;}suppressTileClickUntil=Date.now()+150;const x=event.clientX||active.lastX,y=event.clientY||active.lastY;dropPerson(active.id,document.elementFromPoint(x,y),x,y,active.source.dataset.tier);}
  document.addEventListener('click',onBoardClick);document.addEventListener('change',onBoardChange);document.addEventListener('input',onBoardInput);document.addEventListener('dblclick',event=>{const tile=event.target.closest('.tl-person[data-slot="tier"]');if(tile&&$('rankingCard')?.contains(tile))toggleEqual(tile.dataset.char);});document.addEventListener('dragstart',nativeDragStart);document.addEventListener('dragover',nativeDragOver);document.addEventListener('drop',nativeDrop);document.addEventListener('dragend',nativeDragEnd);document.addEventListener('pointerdown',beginDrag);document.addEventListener('pointermove',dragMove);document.addEventListener('pointerup',dragEnd);document.addEventListener('pointercancel',dragEnd);document.addEventListener('click',onPickerClick);document.addEventListener('input',onPickerInput);document.addEventListener('change',onPickerInput);
  document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(textPreview)closeTextPreview();if(pngDialog)closePngDialog();});
  window.OCTierList={render,createSubject,textFor,exportText,exportPng,openPeople,visibleTierEntries};
})();
