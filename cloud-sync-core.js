(function(root){
  'use strict';
  const collections={workshop:['characters','paros','factions','rankings','cps','books','documents','visualNovelTemplates','collapsedBooks','perspectiveTargets'],forum:['boards','characters','worlds','factions','relationships','loreEntries','accounts','users','posts','comments','tagCatalog','favoriteFolders','chatContacts','chats','chatMessages']};
  const mapFields=new Set(['collapsedBooks','perspectiveTargets']);
  const banned=new Set(['apikey','apikeys','key','authorization','accesstoken','refreshtoken','password','secret','servicekey','servicerole','profiles','activeprofile','deepseeksettings','generation','session','sessions']);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function encodeUtf8Chunks(value,maxBytes=36864){
    const bytes=new TextEncoder().encode(String(value)),chunks=[];
    for(let offset=0;offset<bytes.length;offset+=maxBytes){const part=bytes.subarray(offset,Math.min(bytes.length,offset+maxBytes));let binary='';for(let i=0;i<part.length;i+=8192)binary+=String.fromCharCode(...part.subarray(i,Math.min(part.length,i+8192)));chunks.push(btoa(binary));}
    return chunks.length?chunks:[''];
  }
  function scrub(value){
    if(Array.isArray(value))return value.map(scrub);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!banned.has(k.toLowerCase().replace(/[^a-z]/g,''))).map(([k,v])=>[k,scrub(v)]));
    return value;
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
    if(payload.scope==='forum'){payload={...payload,data:{...payload.data}};for(const key of ['chatContacts','chats','chatMessages','loreEntries'])if(payload.data[key]===undefined)payload.data[key]=[];}
    if(payload.scope==='forum'&&payload.data.favoriteFolders===undefined)payload={...payload,data:{...payload.data,favoriteFolders:[]}};
    if(payload.scope==='forum'&&payload.data.tagCatalog===undefined)payload={...payload,data:{...payload.data,tagCatalog:[]}};
    for(const k of collections[payload.scope]){if(!Array.isArray(payload.data[k]))throw new Error('雲端資料缺少 '+k);const ids=new Set();for(const r of payload.data[k]){if(!r||!['string','number'].includes(typeof r.id)||!String(r.id)||ids.has(String(r.id)))throw new Error(k+' 存在重複或無效 ID。');ids.add(String(r.id));}}
    return {format:'oc-cloud-save',version:1,scope:payload.scope,data:Object.fromEntries(collections[payload.scope].map(k=>[k,scrub(payload.data[k])]))};
  }
  function source(payload){const clean=validate(payload);return Object.fromEntries(Object.entries(clean.data).map(([k,rows])=>[k,mapFields.has(k)?Object.fromEntries(rows.map(r=>[r.id,r.value])):clone(rows)]));}
  function compare(local,remote,base=null){
    local=validate(local);remote=validate(remote);if(base)base=validate(base);if(local.scope!==remote.scope)throw new Error('同步區域不相符。');
    const result=[];
    for(const group of collections[local.scope]){
      const l=new Map(local.data[group].map(r=>[String(r.id),r])),r=new Map(remote.data[group].map(r=>[String(r.id),r])),b=new Map((base?.data[group]||[]).map(r=>[String(r.id),r]));
      for(const id of new Set([...l.keys(),...r.keys(),...b.keys()])){
        const left=l.get(id),right=r.get(id),before=b.get(id);if(equal(left,right))continue;
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
      d.conflict=base?!equal(d.local,d.base)&&!equal(d.remote,d.base):!!d.local&&!!d.remote;
      d.choice=d.conflict?(direction==='download'?'remote':'local'):base?(equal(d.local,d.base)?'remote':'local'):(d.remote?'remote':'local');
      if(d.conflict)d.status=(!d.local||!d.remote)?'刪除與修改衝突':'雙方內容不同';
    }
    return changes;
  }
  function merge(local,remote,changes,decisions){
    const out=clone(validate(local)),maps=Object.fromEntries(collections[local.scope].map(k=>[k,new Map()])),adopted=[];
    for(const change of changes){const choice=decisions[change.key]||change.choice;if(choice==='copy'&&change.remote&&!mapFields.has(change.group))maps[change.group].set(change.id,globalThis.crypto.randomUUID());}
    for(const change of changes){const choice=decisions[change.key]||change.choice;if(choice==='local')continue;
      const rows=out.data[change.group],index=rows.findIndex(r=>String(r.id)===change.id);
      if(choice==='remote'&&index>=0)rows.splice(index,1);
      if(change.remote){const row=clone(change.remote);if(choice==='copy')row.id=maps[change.group].get(change.id)||row.id;rows.push(row);adopted.push([change.group,row]);}
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
    return validate(out);
  }
  const api={collections,mapFields,scrub,stable,equal,encodeUtf8Chunks,snapshot,validate,source,compare,plan,merge};root.CloudSyncCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
