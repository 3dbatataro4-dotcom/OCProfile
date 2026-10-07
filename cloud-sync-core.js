(function(root){
  'use strict';
  const collections={workshop:['characters','paros','factions','rankings','cps','books','documents','timelines','mediaLibrary','visualNovelTemplates','visualNovelPreferences','collapsedBooks','perspectiveTargets'],forum:['boards','characters','worlds','factions','relationships','loreEntries','accounts','users','posts','comments','tagCatalog','favoriteFolders','chatContacts','chats','chatMessages']};
  const mapFields=new Set(['visualNovelPreferences','collapsedBooks','perspectiveTargets']);
  const banned=new Set(['apikey','apikeys','key','authorization','accesstoken','refreshtoken','password','secret','servicekey','servicerole','profiles','activeprofile','deepseeksettings','generation','session','sessions']);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function postgresSafeText(value){
    const text=String(value);let out='';
    for(let i=0;i<text.length;i++){const code=text.charCodeAt(i);if(code===0){out+='�';continue;}if(code>=0xD800&&code<=0xDBFF){const next=text.charCodeAt(i+1);if(next>=0xDC00&&next<=0xDFFF){out+=text[i]+text[++i];}else out+='�';continue;}out+=code>=0xDC00&&code<=0xDFFF?'�':text[i];}
    return out;
  }
  function encodeUtf8Chunks(value,maxBytes=36864){
    const bytes=new TextEncoder().encode(String(value)),chunks=[];
    for(let offset=0;offset<bytes.length;offset+=maxBytes){const part=bytes.subarray(offset,Math.min(bytes.length,offset+maxBytes));let binary='';for(let i=0;i<part.length;i+=8192)binary+=String.fromCharCode(...part.subarray(i,Math.min(part.length,i+8192)));chunks.push(btoa(binary));}
    return chunks.length?chunks:[''];
  }
  function scrub(value){
    if(Array.isArray(value))return value.map(scrub);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!banned.has(k.toLowerCase().replace(/[^a-z]/g,''))).map(([k,v])=>[postgresSafeText(k),scrub(v)]));
    return typeof value==='string'?postgresSafeText(value):value;
  }
  function stable(x){if(Array.isArray(x))return '['+x.map(stable).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';return JSON.stringify(x);}
  const equal=(a,b)=>stable(a)===stable(b);
  function snapshot(scope,source){
    if(!collections[scope])throw new Error('未知同步區域。');
    const data={};for(const k of collections[scope])data[k]=mapFields.has(k)?Object.entries(source[k]||{}).map(([id,value])=>({id,value:scrub(value)})):scrub(clone(source[k]||[]));
    return validate({format:'oc-cloud-save',version:1,scope,data});
  }
  function validate(payload){
    if(!payload||payload.format!=='oc-cloud-save'||payload.version!==1||!collections[payload.scope]||!payload.data)throw new Error('雲端存檔格式不正確。');
    if(payload.scope==='workshop')payload={...payload,data:{...payload.data,timelines:payload.data.timelines||[],mediaLibrary:payload.data.mediaLibrary||[],visualNovelPreferences:payload.data.visualNovelPreferences||[]}};
    if(payload.scope==='forum'){payload={...payload,data:{...payload.data}};for(const key of ['chatContacts','chats','chatMessages','loreEntries'])if(payload.data[key]===undefined)payload.data[key]=[];}
    if(payload.scope==='forum'&&payload.data.favoriteFolders===undefined)payload={...payload,data:{...payload.data,favoriteFolders:[]}};
    if(payload.scope==='forum'&&payload.data.tagCatalog===undefined)payload={...payload,data:{...payload.data,tagCatalog:[]}};
    for(const k of collections[payload.scope]){if(!Array.isArray(payload.data[k]))throw new Error('雲端資料缺少 '+k);const ids=new Set();for(const r of payload.data[k]){if(!r||!['string','number'].includes(typeof r.id)||!String(r.id)||ids.has(String(r.id)))throw new Error(k+' 存在重複或無效 ID。');ids.add(String(r.id));}}
    return {format:'oc-cloud-save',version:1,scope:payload.scope,data:Object.fromEntries(collections[payload.scope].map(k=>[k,scrub(payload.data[k])]))};
  }
  function source(payload){const clean=validate(payload);return Object.fromEntries(Object.entries(clean.data).map(([k,rows])=>[k,mapFields.has(k)?Object.fromEntries(rows.map(r=>[r.id,r.value])):clone(rows)]));}
  const nameKey=value=>String(value||'').normalize('NFKC').replace(/\s+/gu,'').toLocaleLowerCase();
  function characterNames(local,remote,base){const names=new Map();for(const payload of [base,remote,local])for(const row of payload?.data.characters||[])if(row?.name)names.set(nameKey(row.name),String(row.id));return names;}
  function relationKey(row,names){const id=row?.targetId||names.get(nameKey(row?.targetName));return id?`id:${id}`:`name:${nameKey(row?.targetName)}`;}
  function relationRows(character,names){const rows=new Map();for(const row of character?.relationships||[])if(row?.targetName||row?.targetId)rows.set(relationKey(row,names),row);return rows;}
  function characterCore(row){if(!row)return row;const value=clone(row);delete value.relationships;return value;}
  function mergeFields(left,right,before){const merged={},conflicts=[];for(const field of new Set([...Object.keys(before||{}),...Object.keys(left||{}),...Object.keys(right||{})])){const l=left?.[field],r=right?.[field],b=before?.[field];if(equal(l,r)){if(l!==undefined)merged[field]=clone(l);}else if(equal(l,b)){if(r!==undefined)merged[field]=clone(r);}else if(equal(r,b)){if(l!==undefined)merged[field]=clone(l);}else conflicts.push(field);}return {merged,conflicts};}
  const Order=root.SaveOrder||(typeof require==='function'?require('./save-order.js'):null);
  const Preference=root.SavePreference||(typeof require==='function'?require('./save-preference.js'):null);
  const blank=value=>value===undefined||value===null||value===''||Array.isArray(value)&&value.length===0||value&&typeof value==='object'&&Object.keys(value).length===0;
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const keyed=value=>Array.isArray(value)&&value.every(row=>object(row)&&row.id!==undefined)&&new Set(value.map(row=>String(row.id))).size===value.length;
  function fieldChanges(group,id,left,right,before,hasBase){
    const changes=[],recordName=left.name||right.name||left.title||right.title||id;
    function visit(l,r,b,path){
      if(equal(l,r))return;
      if(!['visualNovelPage','cues'].includes(path.at(-1))&&object(l)&&object(r)&&(b===undefined||object(b))){for(const key of new Set([...Object.keys(l),...Object.keys(r),...Object.keys(b||{})]))if(key!=='id'&&!(key==='order'&&path.includes('events')))visit(l[key],r[key],b?.[key],[...path,key]);return;}
      if(path.at(-1)!=='mainTimelineOrder'&&keyed(l)&&keyed(r)&&(b===undefined||keyed(b))){
        const key=path.at(-1),lo=Order.ids(l,key),ro=Order.ids(r,key),bo=b?Order.ids(b,key):undefined;
        if(!equal(lo,ro))changes.push({key:group+':'+id+':order:'+encodeURIComponent(JSON.stringify(path)),kind:'recordOrder',group,id,path,recordName,local:lo,remote:ro,base:bo,choice:Order.choice(lo,ro,bo),conflict:!!bo&&Order.changed(lo,bo)&&Order.changed(ro,bo),status:'整組排列順序'});
        const lm=new Map(l.map(row=>[String(row.id),row])),rm=new Map(r.map(row=>[String(row.id),row])),bm=new Map((b||[]).map(row=>[String(row.id),row]));for(const key of new Set([...lm.keys(),...rm.keys(),...bm.keys()]))visit(lm.get(key),rm.get(key),bm.get(key),[...path,{id:key}]);return;}
      const removal=b!==undefined&&(l===undefined||r===undefined),unknown=!hasBase||b===undefined;
      const conflict=removal||(!unknown&&!equal(l,b)&&!equal(r,b))||(unknown&&!blank(l)&&!blank(r));
      const choice=conflict?(l===undefined?'remote':'local'):unknown?(blank(l)?'remote':'local'):equal(l,b)?'remote':'local';
      const fieldLabel=path.map(part=>typeof part==='string'?part:'項目 '+part.id).join(' / ');
      changes.push({key:group+':'+id+':field:'+encodeURIComponent(JSON.stringify(path)),kind:'recordField',group,id,path,recordName,fieldLabel,local:l,remote:r,base:b,conflict,choice,status:conflict?'同一欄位不同，保留本機並等待確認':'不同欄位自動合併'});
    }
    visit(left,right,before,[]);return changes;
  }
  function applyField(row,path,value){let target=row;for(let i=0;i<path.length-1;i++){const part=path[i],next=path[i+1];if(typeof part==='object'){let found=target.find(item=>String(item.id)===part.id);if(!found){found={id:part.id};target.push(found);}target=found;}else{if(!target[part]||typeof target[part]!=='object')target[part]=typeof next==='object'?[]:{};target=target[part];}}const last=path.at(-1);if(typeof last==='object'){const index=target.findIndex(item=>String(item.id)===last.id);if(index>=0){if(value===undefined)target.splice(index,1);else target[index]=clone(value);}else if(value!==undefined)target.push(clone(value));}else if(value===undefined)delete target[last];else target[last]=clone(value);}
  function relationshipChanges(left,right,before,characterId,names){const l=relationRows(left,names),r=relationRows(right,names),b=relationRows(before,names),changes=[],fieldNames={callName:'稱呼',opinion:'看法',isMainline:'主線／番外',targetName:'對象名稱'};for(const targetKey of new Set([...l.keys(),...r.keys(),...b.keys()])){const local=l.get(targetKey),remote=r.get(targetKey),base=b.get(targetKey);if(equal(local,remote))continue;const merged=local&&remote?mergeFields(local,remote,base):null;const conflict=!!base&&(!local||!remote)||!!merged?.conflicts.length;const targetName=local?.targetName||remote?.targetName||base?.targetName||targetKey;changes.push({key:`characters:${characterId}:relationship:${encodeURIComponent(targetKey)}`,kind:'characterRelationship',group:'characters',id:characterId,characterId,targetKey,targetName,sourceName:left?.name||right?.name||before?.name||characterId,local,remote,base,merged:merged&&!merged.conflicts.length?merged.merged:null,conflict,status:conflict?(!local||!remote?'稱呼／看法的刪除需要確認':`同一對象的 ${merged.conflicts.map(field=>fieldNames[field]||field).join('、')} 同時被修改`):'不同對象或欄位自動合併',choice:conflict?(local?'local':'remote'):'merged'});}return changes;}
  function perspectiveChanges(left,right,before,characterId){const rows=value=>new Map((Array.isArray(value?.value)?value.value:[]).map(name=>[nameKey(name),name])),l=rows(left),r=rows(right),b=rows(before),changes=[];for(const targetKey of new Set([...l.keys(),...r.keys(),...b.keys()])){const local=l.get(targetKey),remote=r.get(targetKey),base=b.get(targetKey);if(local&&remote)continue;const conflict=!!base&&(!local||!remote);changes.push({key:`perspectiveTargets:${characterId}:${encodeURIComponent(targetKey)}`,kind:'perspectiveTarget',group:'perspectiveTargets',id:characterId,targetKey,targetName:local||remote||base,local,remote,base,conflict,status:conflict?'是否刪除此對象的視角項目':'新增視角對象',choice:local?'local':'remote'});}return changes;}
  function compare(local,remote,base=null){
    local=validate(local);remote=validate(remote);if(base)base=validate(base);if(local.scope!==remote.scope)throw new Error('同步區域不相符。');
    const result=[];
    for(const group of collections[local.scope]){
      const l=new Map(local.data[group].map(r=>[String(r.id),r])),r=new Map(remote.data[group].map(r=>[String(r.id),r])),b=new Map((base?.data[group]||[]).map(r=>[String(r.id),r]));
      const names=group==='characters'?characterNames(local,remote,base):null;
      let collectionOrderChange=null;if(local.scope==='workshop'&&['documents','books','timelines'].includes(group)){const lo=[...l.keys()],ro=[...r.keys()],bo=base?[...b.keys()]:undefined;if(!equal(lo,ro))collectionOrderChange={key:group+':collection-order',kind:'collectionOrder',group,id:'__collection_order__',recordName:({documents:'文章',books:'書籍',timelines:'時間線'})[group]+'排列順序',local:lo,remote:ro,base:bo,choice:Order.choice(lo,ro,bo),conflict:!!bo&&Order.changed(lo,bo)&&Order.changed(ro,bo),status:'完整清單的排列順序'};}
      for(const id of new Set([...l.keys(),...r.keys(),...b.keys()])){
        const left=l.get(id),right=r.get(id),before=b.get(id);if(equal(left,right))continue;
        if(group==='characters'&&left&&right){const lc=characterCore(left),rc=characterCore(right),bc=characterCore(before);if(!equal(lc,rc))result.push(...fieldChanges(group,id,lc,rc,bc,!!base));result.push(...relationshipChanges(left,right,before,id,names));continue;}
        if(local.scope==='workshop'&&left&&right&&group!=='perspectiveTargets'){result.push(...fieldChanges(group,id,left,right,before,!!base));continue;}
        if(group==='perspectiveTargets'){result.push(...perspectiveChanges(left,right,before,id));continue;}
        const conflict=!!base&&!equal(left,before)&&!equal(right,before);
        const status=!left?(before?'本機已刪除':'雲端新增'):!right?(before?'雲端已刪除':'本機新增'):conflict?'雙方都有修改':'內容不同';
        result.push({key:group+':'+id,group,id,local:left,remote:right,base:before,conflict,status,choice:!right?'local':!left&&before?'local':!left?'remote':base&&equal(left,before)?'remote':'local'});
      }
      if(collectionOrderChange)result.push(collectionOrderChange);
    }
    return result;
  }
  function plan(local,remote,base=null,direction='upload'){
    const changes=compare(local,remote,base);
    for(const d of changes){
      if(base&&d.base!==undefined&&!d.kind&&(d.local===undefined||d.remote===undefined))d.conflict=true;
      if(['collectionOrder','recordOrder'].includes(d.kind)){d.choice=Order.choice(d.local,d.remote,d.base);d.recommendation='排列順序整組採用'+(d.choice==='local'?'本機':'雲端')+'，保留另一端新增項目';d.reviewRequired=true;continue;}
      if(d.kind==='recordField'){
        const key=d.path.at(-1);d.choice=Preference.choose(d.local,d.remote,typeof key==='string'?key:'','remote');
        if(d.path[0]==='visualNovelPage'){const l=local.data[d.group].find(row=>String(row.id)===d.id),r=remote.data[d.group].find(row=>String(row.id)===d.id);if(l?.visualNovel?.scriptText!==r?.visualNovel?.scriptText)d.choice=Preference.choose(l?.visualNovel?.scriptText,r?.visualNovel?.scriptText);}
        if(Array.isArray(d.local)&&Array.isArray(d.remote)){if(d.path.at(-1)==='mainTimelineOrder'){d.orderSource=Order.choice(Order.ids(d.local),Order.ids(d.remote),d.base?Order.ids(d.base):undefined);d.merged=Order.mergeRows(d.local,d.remote,d.base);}else d.merged=Preference.merge(d.local,d.remote);d.choice='merged';}
      }else if(d.kind==='characterRelationship'&&d.local&&d.remote){d.merged=Preference.merge(d.local,d.remote);d.choice='merged';}
      else d.choice=Preference.choose(d.local,d.remote);
      d.recommendation=d.choice==='merged'?'保留兩端新增內容，文字採用較完整版本':d.choice==='local'?'本機內容較多／雲端缺少，建議保留本機':'雲端內容較多或相同，建議採用雲端';
      if(d.orderSource)d.recommendation='主線順序整組採用'+(d.orderSource==='local'?'本機':'雲端')+'，保留另一端新增節點';
      d.reviewRequired=d.conflict||d.choice==='local'&&!Preference.empty(d.local)||d.local===undefined||d.remote===undefined||Preference.amount(d.local)!==Preference.amount(d.remote);
    }
    return changes;
  }
  function merge(local,remote,changes,decisions){
    const out=clone(validate(local)),maps=Object.fromEntries(collections[local.scope].map(k=>[k,new Map()])),adopted=[];
    for(const change of changes){const choice=decisions[change.key]||change.choice;if(choice==='copy'&&change.remote&&!mapFields.has(change.group)&&!change.kind)maps[change.group].set(change.id,(typeof globalThis.crypto?.randomUUID==='function'?globalThis.crypto.randomUUID():'cs'+Date.now().toString(36)+Math.random().toString(36).slice(2,9)));}
    for(const change of changes){const choice=decisions[change.key]||change.choice;if(choice==='local')continue;
      if(change.kind)continue;
      const rows=out.data[change.group],index=rows.findIndex(r=>String(r.id)===change.id);
      
      if(choice==='remote'&&change.remote===undefined&&index>=0)rows.splice(index,1);
      if(change.remote){const row=clone(change.remote);if(choice==='copy')row.id=maps[change.group].get(change.id)||row.id;if(choice==='remote'&&index>=0)rows[index]=row;else rows.push(row);adopted.push([change.group,row]);}
    }
    for(const change of changes.filter(change=>change.kind==='recordField')){const row=out.data[change.group].find(row=>String(row.id)===change.id);if(!row)continue;const choice=decisions[change.key]||change.choice;applyField(row,change.path,choice==='merged'?change.merged:choice==='remote'?change.remote:change.local);}
    for(const change of changes.filter(change=>change.kind==='characterCore')){const choice=decisions[change.key]||change.choice;if(choice==='local')continue;const index=out.data.characters.findIndex(row=>String(row.id)===change.id),current=out.data.characters[index];if(index>=0&&current){const relationships=current.relationships;out.data.characters[index]={...clone(change.remote),...(relationships!==undefined?{relationships}:{})};}}
    for(const change of changes.filter(change=>change.kind==='characterRelationship')){const choice=decisions[change.key]||change.choice,selected=choice==='merged'?change.merged:choice==='remote'?change.remote:change.local;const character=out.data.characters.find(row=>String(row.id)===change.characterId);if(!character)continue;const names=characterNames(local,remote,null),rows=character.relationships||[];character.relationships=rows.filter(row=>relationKey(row,names)!==change.targetKey);if(selected)character.relationships.push(clone(selected));}
    for(const change of changes.filter(change=>change.kind==='perspectiveTarget')){const choice=decisions[change.key]||change.choice,selected=choice==='remote'?change.remote:change.local;let row=out.data.perspectiveTargets.find(item=>String(item.id)===change.id);if(!row){row={id:change.id,value:[]};out.data.perspectiveTargets.push(row);}row.value=(Array.isArray(row.value)?row.value:[]).filter(name=>nameKey(name)!==change.targetKey);if(selected)row.value.push(selected);}
    for(const change of changes.filter(d=>['collectionOrder','recordOrder'].includes(d.kind))){const chosen=decisions[change.key]||change.choice,preferred=chosen==='local'?change.local:change.remote,other=chosen==='local'?change.remote:change.local;
      if(change.kind==='collectionOrder')out.data[change.group]=Order.reorder(out.data[change.group],preferred,other);
      else{const row=out.data[change.group].find(row=>String(row.id)===change.id);if(!row)continue;let array=row;for(const part of change.path)array=typeof part==='object'?array?.find(item=>String(item.id)===part.id):array?.[part];if(!Array.isArray(array))continue;const ordered=Order.reorder(array,preferred,other);array.splice(0,array.length,...ordered);if(change.path.at(-1)==='events')array.forEach((event,index)=>event.order=index+1);}
    }
    const remap=(group,id)=>maps[group]?.get(String(id))??id;
    const identity=id=>maps.accounts?.get(String(id))??maps.users?.get(String(id))??id;
    function rewrite(value,key=''){
      const targets={replyTo:'chatMessages',chatId:'chats',senderId:'chatContacts',boardId:'boards',bookId:'books',charId:'characters',postId:'posts',parentId:'comments',commentId:'comments'};
      if(['authorId','userId','partnerId','accountId'].includes(key))return identity(value);
      if(targets[key]&&value!==null&&typeof value!=='object')return remap(targets[key],value);
      if((key==='contactIds'||key==='mentionIds')&&Array.isArray(value))return value.map(id=>remap('chatContacts',id));
      if(key==='forumIds'&&Array.isArray(value))return value.map(id=>remap('boards',id));
      if(key==='forumRoles'&&value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([id,role])=>[remap('boards',id),role]));
      if(key==='likedBy'&&Array.isArray(value))return value.map(identity);
      if(key==='folderIds'&&Array.isArray(value))return value.map(id=>remap('favoriteFolders',id));
      if(key==='charIds'||key==='factionIds')return value.map(id=>remap(key==='charIds'?'characters':'factions',id));
      if(key==='paroValues'&&value)return Object.fromEntries(Object.entries(value).map(([id,v])=>[remap(local.scope==='forum'?'worlds':'paros',id),v]));
      if(Array.isArray(value))return value.map(v=>key==='members'&&typeof v==='string'?remap('characters',v):rewrite(v));
      if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v,k)]));
      return value;
    }
    for(const [group,row]of adopted){const mapped=rewrite(row);Object.assign(row,mapped);}
    if(local.scope==='forum'){
      const rooms=new Map(out.data.chats.map(r=>[r.id,r])),contacts=new Set(out.data.chatContacts.map(c=>c.id));
      for(const r of rooms.values())if(!Array.isArray(r.contactIds)||r.contactIds.length<1||r.contactIds.length>11||r.contactIds.some(id=>!contacts.has(id)))throw new Error('請一併保留對話中的聯絡人；群組上限為12人（含你）。');
      for(const m of out.data.chatMessages)if(!rooms.has(m.chatId)||(m.senderId!=='self'&&!contacts.has(m.senderId)))throw new Error('請一併保留聊天訊息所屬的對話與聯絡人。');
      const posts=new Set(out.data.posts.map(p=>p.id));
      for(const c of out.data.comments){if(!posts.has(c.postId))throw new Error('有保留的留言仍屬於被刪除的文章。請保留該文章，或同時採用相關留言的刪除。');if(c.parentId&&!out.data.comments.some(p=>p.id===c.parentId&&p.postId===c.postId))c.parentId=null;}
      const byId=new Map(out.data.comments.map(c=>[c.id,c]));
      for(const c of out.data.comments){const seen=new Set([c.id]);let parent=c.parentId;while(parent){if(seen.has(parent))throw new Error('留言回覆關係形成循環，請調整合併選擇。');seen.add(parent);parent=byId.get(parent)?.parentId;}}
    }
    if(out.scope==='workshop'){const deleted=new Set(out.data.mediaLibrary.filter(row=>row.kind==='media-tombstone'&&['albums','music'].includes(row.collection)).map(row=>row.targetId));out.data.mediaLibrary=out.data.mediaLibrary.filter(row=>row.kind==='media-tombstone'||!deleted.has(row.id));}
    return validate(out);
  }
  function delta(remote,next,note=''){
    remote=validate(remote);next=validate(next);if(remote.scope!==next.scope)throw new Error('增量同步區域不相符。');const changes=[],orders={};
    for(const group of collections[next.scope]){const before=new Map(remote.data[group].map(row=>[String(row.id),row])),after=new Map(next.data[group].map(row=>[String(row.id),row])),start=changes.length;for(const id of new Set([...before.keys(),...after.keys()])){const value=after.get(id);if(!equal(before.get(id),value))changes.push({group,id,value:value===undefined?null:scrub(clone(value))});}if(changes.length>start||!equal(remote.data[group].map(row=>String(row.id)),next.data[group].map(row=>String(row.id))))orders[group]=next.data[group].map(row=>String(row.id));}
    return {format:'oc-cloud-delta',version:1,scope:next.scope,note:postgresSafeText(String(note||'')).slice(0,16),changes,orders};
  }
  const api={collections,mapFields,scrub,stable,equal,postgresSafeText,encodeUtf8Chunks,snapshot,validate,source,compare,plan,merge,delta};root.CloudSyncCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
