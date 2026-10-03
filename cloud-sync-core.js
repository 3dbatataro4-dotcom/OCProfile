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
  function relationshipChanges(left,right,before,characterId,names){const l=relationRows(left,names),r=relationRows(right,names),b=relationRows(before,names),changes=[],fieldNames={callName:'稱呼',opinion:'看法',isMainline:'主線／番外',targetName:'對象名稱'};for(const targetKey of new Set([...l.keys(),...r.keys(),...b.keys()])){const local=l.get(targetKey),remote=r.get(targetKey),base=b.get(targetKey);if(equal(local,remote))continue;const merged=local&&remote?mergeFields(local,remote,base):null;const conflict=!!base&&(!local||!remote)||!!merged?.conflicts.length;const targetName=local?.targetName||remote?.targetName||base?.targetName||targetKey;changes.push({key:`characters:${characterId}:relationship:${encodeURIComponent(targetKey)}`,kind:'characterRelationship',group:'characters',id:characterId,characterId,targetKey,targetName,sourceName:left?.name||right?.name||before?.name||characterId,local,remote,base,merged:merged&&!merged.conflicts.length?merged.merged:null,conflict,status:conflict?(!local||!remote?'稱呼／看法的刪除需要確認':`同一對象的 ${merged.conflicts.map(field=>fieldNames[field]||field).join('、')} 同時被修改`):'不同對象或欄位自動合併',choice:conflict?(local?'local':'remote'):'merged'});}return changes;}
  function perspectiveChanges(left,right,before,characterId){const rows=value=>new Map((Array.isArray(value?.value)?value.value:[]).map(name=>[nameKey(name),name])),l=rows(left),r=rows(right),b=rows(before),changes=[];for(const targetKey of new Set([...l.keys(),...r.keys(),...b.keys()])){const local=l.get(targetKey),remote=r.get(targetKey),base=b.get(targetKey);if(local&&remote)continue;const conflict=!!base&&(!local||!remote);changes.push({key:`perspectiveTargets:${characterId}:${encodeURIComponent(targetKey)}`,kind:'perspectiveTarget',group:'perspectiveTargets',id:characterId,targetKey,targetName:local||remote||base,local,remote,base,conflict,status:conflict?'是否刪除此對象的視角項目':'新增視角對象',choice:local?'local':'remote'});}return changes;}
  function compare(local,remote,base=null){
    local=validate(local);remote=validate(remote);if(base)base=validate(base);if(local.scope!==remote.scope)throw new Error('同步區域不相符。');
    const result=[];
    for(const group of collections[local.scope]){
      const l=new Map(local.data[group].map(r=>[String(r.id),r])),r=new Map(remote.data[group].map(r=>[String(r.id),r])),b=new Map((base?.data[group]||[]).map(r=>[String(r.id),r]));
      const names=group==='characters'?characterNames(local,remote,base):null;
      for(const id of new Set([...l.keys(),...r.keys(),...b.keys()])){
        const left=l.get(id),right=r.get(id),before=b.get(id);if(equal(left,right))continue;
        if(group==='characters'&&left&&right){const lc=characterCore(left),rc=characterCore(right),bc=characterCore(before);if(!equal(lc,rc)){const conflict=!!base&&!equal(lc,bc)&&!equal(rc,bc);result.push({key:group+':'+id,kind:'characterCore',group,id,local:lc,remote:rc,base:bc,conflict,status:conflict?'人物卡其他欄位同時修改':'人物卡其他欄位不同',choice:base&&equal(lc,bc)?'remote':'local'});}result.push(...relationshipChanges(left,right,before,id,names));continue;}
        if(group==='perspectiveTargets'){result.push(...perspectiveChanges(left,right,before,id));continue;}
        const conflict=!!base&&!equal(left,before)&&!equal(right,before);
        const status=!left?(before?'本機已刪除':'雲端新增'):!right?(before?'雲端已刪除':'本機新增'):conflict?'雙方都有修改':'內容不同';
        result.push({key:group+':'+id,group,id,local:left,remote:right,base:before,conflict,status,choice:!right?'local':!left&&before?'local':!left?'remote':base&&equal(left,before)?'remote':'local'});
      }
    }
    return result;
  }
  function plan(local,remote,base=null,direction='upload'){
    const changes=compare(local,remote,base);
    for(const d of changes){
      if(d.kind==='characterRelationship'||d.kind==='perspectiveTarget'){
        d.choice=d.conflict?(d.local?'local':'remote'):(d.merged?'merged':d.local?'local':'remote');
        continue;
      }
      d.conflict=base?!equal(d.local,d.base)&&!equal(d.remote,d.base):!!d.local&&!!d.remote;
      d.choice=d.conflict?(direction==='download'?'remote':'local'):base?(equal(d.local,d.base)?'remote':'local'):(d.remote?'remote':'local');
      if(d.conflict)d.status=(!d.local||!d.remote)?'刪除與修改衝突':'雙方內容不同';
    }
    return changes;
  }
  function merge(local,remote,changes,decisions){
    const out=clone(validate(local)),maps=Object.fromEntries(collections[local.scope].map(k=>[k,new Map()])),adopted=[];
    for(const change of changes){const choice=decisions[change.key]||change.choice;if(choice==='copy'&&change.remote&&!mapFields.has(change.group)&&!change.kind)maps[change.group].set(change.id,(typeof globalThis.crypto?.randomUUID==='function'?globalThis.crypto.randomUUID():'cs'+Date.now().toString(36)+Math.random().toString(36).slice(2,9)));}
    for(const change of changes){const choice=decisions[change.key]||change.choice;if(choice==='local')continue;
      if(change.kind)continue;
      const rows=out.data[change.group],index=rows.findIndex(r=>String(r.id)===change.id);
      if(choice==='remote'&&index>=0)rows.splice(index,1);
      if(change.remote){const row=clone(change.remote);if(choice==='copy')row.id=maps[change.group].get(change.id)||row.id;rows.push(row);adopted.push([change.group,row]);}
    }
    for(const change of changes.filter(change=>change.kind==='characterCore')){const choice=decisions[change.key]||change.choice;if(choice==='local')continue;const index=out.data.characters.findIndex(row=>String(row.id)===change.id),current=out.data.characters[index];if(index>=0&&current){const relationships=current.relationships;out.data.characters[index]={...clone(change.remote),...(relationships!==undefined?{relationships}:{})};}}
    for(const change of changes.filter(change=>change.kind==='characterRelationship')){const choice=decisions[change.key]||change.choice,selected=choice==='merged'?change.merged:choice==='remote'?change.remote:change.local;const character=out.data.characters.find(row=>String(row.id)===change.characterId);if(!character)continue;const names=characterNames(local,remote,null),rows=character.relationships||[];character.relationships=rows.filter(row=>relationKey(row,names)!==change.targetKey);if(selected)character.relationships.push(clone(selected));}
    for(const change of changes.filter(change=>change.kind==='perspectiveTarget')){const choice=decisions[change.key]||change.choice,selected=choice==='remote'?change.remote:change.local;let row=out.data.perspectiveTargets.find(item=>String(item.id)===change.id);if(!row){row={id:change.id,value:[]};out.data.perspectiveTargets.push(row);}row.value=(Array.isArray(row.value)?row.value:[]).filter(name=>nameKey(name)!==change.targetKey);if(selected)row.value.push(selected);}
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
    return validate(out);
  }
  function delta(remote,next,note=''){
    remote=validate(remote);next=validate(next);if(remote.scope!==next.scope)throw new Error('增量同步區域不相符。');const changes=[],orders={};
    for(const group of collections[next.scope]){const before=new Map(remote.data[group].map(row=>[String(row.id),row])),after=new Map(next.data[group].map(row=>[String(row.id),row])),start=changes.length;for(const id of new Set([...before.keys(),...after.keys()])){const value=after.get(id);if(!equal(before.get(id),value))changes.push({group,id,value:value===undefined?null:scrub(clone(value))});}if(changes.length>start)orders[group]=next.data[group].map(row=>String(row.id));}
    return {format:'oc-cloud-delta',version:1,scope:next.scope,note:postgresSafeText(String(note||'')).slice(0,16),changes,orders};
  }
  const api={collections,mapFields,scrub,stable,equal,postgresSafeText,encodeUtf8Chunks,snapshot,validate,source,compare,plan,merge,delta};root.CloudSyncCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
