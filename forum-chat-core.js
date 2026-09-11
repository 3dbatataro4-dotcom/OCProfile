(function(root){
  'use strict';
  const list=v=>Array.isArray(v)?v:[],id=()=>(typeof globalThis.crypto?.randomUUID==='function'?globalThis.crypto.randomUUID():'fc'+Date.now().toString(36)+Math.random().toString(36).slice(2,9));
  function migrate(s){
    for(const key of ['chatContacts','chats','chatMessages'])if(s[key]===undefined)s[key]=[];
    if(!['chatContacts','chats','chatMessages'].every(k=>Array.isArray(s[k])))throw new Error('聊天資料表格式不正確。');
    for(const u of list(s.users)){
      if(!list(u.messages).length)continue;
      const contactId='legacy-contact-'+u.id,roomId='legacy-chat-'+u.id;
      if(!s.chatContacts.some(c=>c.id===contactId))s.chatContacts.push({id:contactId,kind:'user',userId:u.id,name:u.name,avatar:u.avatar||''});
      if(!s.chats.some(c=>c.id===roomId))s.chats.push({id:roomId,name:u.name,kind:'direct',accountId:s.activeUser||list(s.accounts).find(a=>!a.official)?.id||s.accounts?.[0]?.id||'',contactIds:[contactId],createdAt:u.messages[0].createdAt||Date.now(),legacy:true});
      for(const [i,m]of u.messages.entries()){
        const messageId='legacy-message-'+u.id+'-'+(m.id||i);
        if(!s.chatMessages.some(x=>x.id===messageId))s.chatMessages.push({id:messageId,chatId:roomId,senderId:m.from==='me'?'self':contactId,senderName:m.from==='me'?'我（舊版紀錄）':u.name,content:String(m.content||''),createdAt:m.createdAt||Date.now(),legacy:true});
      }
      delete u.messages;
    }
    return s;
  }
  function validate(s){
    for(const contact of s.chatContacts)if(!['user','character'].includes(contact.kind)||typeof contact.name!=='string')throw new Error('聯絡人格式不正確。');
    for(const room of s.chats){
      if(!['direct','group'].includes(room.kind)||!Array.isArray(room.contactIds)||new Set(room.contactIds).size!==room.contactIds.length||room.contactIds.length<1||room.contactIds.length>11||(room.kind==='direct'&&room.contactIds.length!==1))throw new Error('對話成員不正確：群組最多包含你與 11 位聯絡人。');
    }
    for(const m of s.chatMessages)if(typeof m.content!=='string'||typeof m.chatId!=='string'||typeof m.senderId!=='string')throw new Error('聊天訊息格式不正確。');
    return s;
  }
  function choose(contacts,text,explicit=[],random=Math.random){
    const byId=new Set(contacts.map(c=>c.id)),tagged=[...new Set(explicit)].filter(x=>byId.has(x));
    if(tagged.length)return tagged;
    // Prefer the longest matching name so calling 阿明 does not also call 明.
    const matched=contacts.filter(c=>c.name&&text.includes(c.name));
    const named=matched.filter(c=>!matched.some(other=>other.id!==c.id&&other.name.length>c.name.length&&other.name.includes(c.name)));
    if(named.length)return named.map(c=>c.id);
    if(!contacts.length)return [];
    const shuffled=[...contacts];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    return shuffled.slice(0,1+Math.floor(random()*Math.min(3,shuffled.length))).map(c=>c.id);
  }
  const api={migrate,validate,choose,id};root.ForumChatCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
