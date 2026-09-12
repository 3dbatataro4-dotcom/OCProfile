/* Independent forum model. No references to the character editor's storage. */
(function (root) {
  'use strict';
  const Chat=root.ForumChatCore||(typeof require==='function'?require('./forum-chat-core.js'):null);
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => (typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9));
  const list = value => Array.isArray(value) ? value : [];
  const tags = value => {
    const arr = Array.isArray(value) ? value : String(value || '').split(/[,，\n]/);
    const seen = new Set();
    const res = [];
    for (const x of arr) {
      const s = String(x || '').trim();
      if (!s) continue;
      const lower = s.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        res.push(s);
      }
    }
    return res;
  };
  const WORLD_TERMS={home:'世界大廳',feed:'社群動態',members:'居民名冊',publish:'發布動態',manage:'世界管理'};
  const FANDOM_TERMS={home:'同好廣場',feed:'論壇動態',members:'同好管理',publish:'創作發布',manage:'管理中心'};
  const section = (value, fallback='綜合交流') => typeof value==='string'
    ? {id:id(),name:value.trim()||fallback,englishName:'',slogan:'',description:''}
    : {id:String(value?.id||id()),name:String(value?.name||fallback).trim()||fallback,englishName:String(value?.englishName||''),slogan:String(value?.slogan||''),description:String(value?.description||'')};
  const groups = ['boards', 'characters', 'worlds', 'factions', 'relationships', 'loreEntries', 'accounts', 'users', 'posts', 'comments', 'tagCatalog', 'favoriteFolders', 'chatContacts', 'chats', 'chatMessages', 'profiles'];
  function initial() {
    const official = id(), fan = id();
    const boardId=id();
    return { format: 'oc-fandom-forum', version: 1, forumStructureVersion:2, activeBoardId:boardId, boards: [{ id: boardId, name: '同人放映室', englishName: 'Fandom Archive', slogan: 'Every story deserves an echo.', kind:'fandom', mode:'fandom', displayName:'同人放映室', subBoards: [{id:id(),name:'綜合交流',description:'跨作品同好交流'}], theme:{ preset:'system',primary:'', secondary:'', surfaceTint:'' }, terminology:{...FANDOM_TERMS}, aiInstruction:'', linkedParoSourceId:null, description: '給喜歡的角色一封情書，給同好的創作一點回聲。', worldview:'' }], characters: [], worlds: [], factions: [], relationships: [], loreEntries: [],
      accounts: [{ id: official, name: '官方編輯部', owned: true, official: true, gender: '女', color: '#d9ae70', color2: '#9c78c9' }, { id: fan, name: '我的同人帳號', owned: true, official: false, gender: '女', color: '#ad87c5', color2: '#709cac' }], users: [],
      posts: [], comments: [], tagCatalog: [], favoriteFolders: [], chatContacts: [], chats: [], chatMessages: [], activeUser: fan, profiles: [], activeProfile: 'inherit',
      generation: { boardId: '', tags: '', type: '隨機', min: 1, max: 3, comments: 3, interval: 15, allowNew: true, enabled: false, nextAt: 0, prompt: '', atmosphere: '允許逆 CP、拆官配、角色爭議與對家拌嘴；不同用戶有各自立場。' } };
  }
  function migrateHierarchy(data){
    if(Number(data.forumStructureVersion)>=2)return;
    const original=list(data.boards), remap=new Map(), sourceSection=new Map(), next=[];
    const legacy=original.filter(b=>b.mode!=='world'&&(!b.displayName||b.displayName==='同人放映室'));
    const legacyIds=new Set(legacy.map(b=>b.id));
    if(legacy.length){
      const root=legacy[0]; root.name='同人放映室';root.displayName='同人放映室';root.mode='fandom';root.kind='fandom';
      const raw=[];
      for(const b of legacy){
        remap.set(b.id,root.id);sourceSection.set(b.id,String(b.name||'綜合交流').replace(/^同人放映室$/,'綜合交流'));
        raw.push(...list(b.subBoards),{name:sourceSection.get(b.id),description:b.description||''});
      }
      const seen=new Set();root.subBoards=raw.map(x=>section(x)).filter(x=>{const k=x.name.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
      next.push(root);
    }
    for(const b of original)if(!legacyIds.has(b.id)){remap.set(b.id,b.id);next.push(b);}
    const move=row=>{if(row&&remap.has(row.boardId))row.boardId=remap.get(row.boardId);};
    for(const p of list(data.posts)){const old=p.boardId;p.subBoard=p.subBoard||sourceSection.get(old)||'綜合交流';move(p);}
    for(const key of ['characters','worlds','factions','relationships','loreEntries','tagCatalog','favoriteFolders'])for(const row of list(data[key]))move(row);
    for(const u of list(data.users)){u.forumIds=[...new Set(list(u.forumIds).map(x=>remap.get(x)||x))];u.forumRoles=Object.fromEntries(Object.entries(u.forumRoles||{}).map(([k,v])=>[remap.get(k)||k,v]));}
    data.activeBoardId=remap.get(data.activeBoardId)||next[0]?.id;data.boards=next;data.forumStructureVersion=2;
  }
  function validate(data) {
    if (!data || data.format !== 'oc-fandom-forum' || data.version !== 1) throw new Error('不是支援的同人論壇備份（版本 1）。');
    if (!data.accounts && Array.isArray(data.users)) { data.accounts = data.users.filter(x => x.owned); data.users = data.users.filter(x => !x.owned); }
    migrateHierarchy(data);
    Chat.migrate(data);
    if(data.favoriteFolders===undefined)data.favoriteFolders=[];
    if(data.tagCatalog===undefined)data.tagCatalog=tags(list(data.posts).flatMap(p=>list(p.tags))).map(name=>({id:id(),name}));
    if(data.loreEntries===undefined)data.loreEntries=[];
    if (data.profiles === undefined) data.profiles = [];
    if(!data.boards.length)data.boards.push({id:id(),name:'綜合交流',description:'跨作品同好交流'});
    for(const [index,board] of data.boards.entries()){
      board.englishName=String(board.englishName||'Fandom Archive');
      board.slogan=String(board.slogan||'Every story deserves an echo.');
      board.kind=board.kind==='paro'?'paro':'fandom';
      board.mode=board.mode==='world'?'world':'fandom';
      board.displayName=String(board.displayName||(board.mode==='world'?(board.name||'校園論壇'):'同人放映室'));
      const seenSections=new Set();board.subBoards=list(board.subBoards).map(x=>section(x,board.mode==='world'?'世界大廳':'綜合交流')).filter(x=>{const k=x.name.toLowerCase();if(seenSections.has(k))return false;seenSections.add(k);return true;});
      if(!board.subBoards.length)board.subBoards=[section(board.mode==='world'?'世界大廳':'綜合交流')];
      if(!board.theme||typeof board.theme!=='object')board.theme={preset:'system',primary:'',secondary:'',surfaceTint:''};
      else board.theme={preset:String(board.theme.preset||((board.theme.primary||board.theme.secondary)?'custom':'system')),primary:String(board.theme.primary||''),secondary:String(board.theme.secondary||''),surfaceTint:String(board.theme.surfaceTint||'')};
      const defaults=board.mode==='world'?WORLD_TERMS:FANDOM_TERMS;board.terminology={...defaults,...(board.terminology&&typeof board.terminology==='object'?board.terminology:{})};
      board.aiInstruction=String(board.aiInstruction||'');
      board.userTypes=tags(board.userTypes?.length?board.userTypes:['萌新','角色廚','作品廚','CP廚','單推','CB廚','逆CP廚','創作者']);
      board.userCreationRules=String(board.userCreationRules||'');
      board.linkedParoSourceId=board.mode==='world'&&board.linkedParoSourceId?String(board.linkedParoSourceId):null;
      board.description=String(board.description||'');
      board.worldview=String(board.worldview||'');
      if(index===0&&!board.generation&&data.generation)board.generation=clone(data.generation);
    }
    if(!data.activeBoardId||!data.boards.some(b=>b.id===data.activeBoardId))data.activeBoardId=data.boards[0].id;
    for(const user of list(data.users)){user.forumIds=list(user.forumIds);if(!user.forumIds.length){const ids=new Set(list(data.posts).filter(p=>p.authorId===user.id).map(p=>p.boardId));for(const charId of list(user.charIds)){const boardId=list(data.characters).find(c=>c.id===charId)?.boardId;if(boardId)ids.add(boardId);}user.forumIds=ids.size?[...ids]:[data.activeBoardId];}if(!user.forumRoles||typeof user.forumRoles!=='object'||Array.isArray(user.forumRoles))user.forumRoles={};}
    if(list(data.tagCatalog).some(row=>row.boardId===undefined))data.tagCatalog=list(data.tagCatalog).flatMap(row=>row.boardId!==undefined?[row]:data.boards.map((board,index)=>({...row,id:index? id():row.id,boardId:board.id})));
    if(list(data.favoriteFolders).some(row=>row.boardId===undefined)){
      const maps=new Map();data.favoriteFolders=list(data.favoriteFolders).flatMap(row=>{if(row.boardId!==undefined)return [row];const copies=data.boards.map((board,index)=>({...row,id:index?id():row.id,boardId:board.id}));maps.set(row.id,new Map(copies.map(copy=>[copy.boardId,copy.id])));return copies;});
      for(const post of list(data.posts))post.folderIds=list(post.folderIds).map(folderId=>maps.get(folderId)?.get(post.boardId)||folderId);
    }
    for (const key of groups) {
      if (!Array.isArray(data[key])) data[key] = [];
      const seen = new Set();
      data[key] = data[key].filter(row => {
        if (!row || typeof row.id !== 'string' || !row.id || seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });
    }
    for (const post of data.posts) {
      if (typeof post.title !== 'string' || typeof post.content !== 'string') throw new Error('貼文格式錯誤。');
      const board=data.boards.find(b=>b.id===post.boardId)||data.boards[0], byName=board.subBoards.find(s=>s.name===(post.subBoard||''));
      if(!board.subBoards.some(s=>s.id===post.subBoardId))post.subBoardId=byName?.id||board.subBoards[0].id;
      post.subBoard=board.subBoards.find(s=>s.id===post.subBoardId)?.name||board.subBoards[0].name;
    }
    for (const comment of data.comments) if (typeof comment.content !== 'string') throw new Error('留言格式錯誤。');
    const identities = new Set(data.accounts.map(x => x.id));
    if (data.users.some(x => identities.has(x.id))) throw new Error('我的帳號與同好帳號不能共用 ID。');
    data.accounts.forEach(x => x.owned = true); data.users.forEach(x => { x.owned = false; x.official = false; });
    return Chat.validate(data);
  }
  // User-requested portable API settings include credentials; schedules remain local.
  function portable(state) {
    return { format: state.format, version: 1, forumStructureVersion:2, activeBoardId:state.activeBoardId, activeUser:state.activeUser, activeProfile:state.activeProfile, ...Object.fromEntries(groups.map(k => [k, clone(state[k])])) };
  }
  function dependencies(data, selected) {
    const chosen = new Set(selected);
    let changed = true;
    const add = (key, ref) => { if (ref && data[key].some(x => x.id === ref) && !chosen.has(key + ':' + ref)) { chosen.add(key + ':' + ref); changed = true; } };
    while (changed) {
      changed = false;
      for(const r of data.chats.filter(r=>chosen.has('chats:'+r.id))){add('accounts',r.accountId);list(r.contactIds).forEach(id=>add('chatContacts',id));data.chatMessages.filter(m=>m.chatId===r.id).forEach(m=>add('chatMessages',m.id));}
      for(const m of data.chatMessages.filter(m=>chosen.has('chatMessages:'+m.id))){add('chats',m.chatId);add('chatContacts',m.senderId);list(m.mentionIds).forEach(id=>add('chatContacts',id));}
      for(const c of data.chatContacts.filter(c=>chosen.has('chatContacts:'+c.id)))if(c.kind==='user')add('users',c.userId);
      for (const p of data.posts.filter(x => chosen.has('posts:' + x.id))) {
        for(const id of list(p.folderIds))add('favoriteFolders',id);
        for(const liker of list(p.likedBy)){add('users',liker);add('accounts',liker);}
        for(const name of list(p.tags))for(const tag of data.tagCatalog.filter(t=>t.name===name))add('tagCatalog',tag.id);
        add('users', p.authorId); add('accounts', p.authorId); add('boards', p.boardId); list(p.charIds).forEach(x => add('characters', x));
        data.comments.filter(x => x.postId === p.id).forEach(x => add('comments', x.id));
      }
      for (const c of data.comments.filter(x => chosen.has('comments:' + x.id))) { add('posts', c.postId); add('users', c.authorId); add('accounts', c.authorId); add('comments', c.parentId); }
      for (const u of [...data.users.filter(x => chosen.has('users:' + x.id)), ...data.accounts.filter(x => chosen.has('accounts:' + x.id))]) {
        list(u.charIds).forEach(x => add('characters', x));
        list(u.links).forEach(x => { add('users', x.userId); add('accounts', x.userId); });
      }
      for (const key of ['characters','worlds','factions','relationships']) for (const row of data[key].filter(x => chosen.has(key + ':' + x.id))) {
        add('boards', row.boardId);
        list(row.members).forEach(x => add('characters', typeof x === 'string' ? x : x.charId));
      }
      // A selected story carries its board's world and relationship context too.
      for (const b of data.boards.filter(x => chosen.has('boards:' + x.id))) {
        for (const key of ['characters','worlds','factions','relationships','loreEntries','tagCatalog','favoriteFolders','posts']) data[key].filter(x => x.boardId === b.id).forEach(x => add(key, x.id));
        data.users.filter(x=>list(x.forumIds).includes(b.id)).forEach(x=>add('users',x.id));
      }
      for(const row of data.loreEntries.filter(x=>chosen.has('loreEntries:'+x.id)))add('boards',row.boardId);
      for(const u of data.users.filter(x=>chosen.has('users:'+x.id)))list(u.forumIds).forEach(id=>add('boards',id));
    }
    return chosen;
  }
  function subset(data, selected) {
    const chosen = dependencies(data, selected);
    const out = portable(data);
    for (const k of groups) out[k] = out[k].filter(x => chosen.has(k + ':' + x.id));
    return out;
  }
  function merge(state, incoming, decisions) {
    validate(incoming);
    const out = clone(state), maps = Object.fromEntries(groups.map(k => [k, new Map()]));
    for (const key of groups) for (const row of incoming[key]) {
      const action = decisions[key + ':' + row.id] || 'keep';
      maps[key].set(row.id, action === 'copy' ? id() : row.id);
    }
    const ref = (key, value) => maps[key].get(value) || value;
    const identity = value => maps.accounts.get(value) || maps.users.get(value) || value;
    for (const key of groups) for (const source of incoming[key]) {
      const action = decisions[key + ':' + source.id] || 'keep';
      const index = out[key].findIndex(x => x.id === source.id);
      if (index >= 0 && action === 'keep') continue;
      const row = clone(source); row.id = ref(key, source.id);
      if(key==='chatContacts'&&row.kind==='user')row.userId=identity(row.userId);
      if(key==='chats'){row.accountId=identity(row.accountId);row.contactIds=list(row.contactIds).map(id=>ref('chatContacts',id));}
      if(key==='chatMessages'){row.chatId=ref('chats',row.chatId);if(row.senderId!=='self')row.senderId=ref('chatContacts',row.senderId);row.mentionIds=list(row.mentionIds).map(id=>ref('chatContacts',id));if(row.replyTo)row.replyTo=ref('chatMessages',row.replyTo);}
      if (key === 'posts' || key === 'comments') {row.authorId = identity(row.authorId);row.likedBy=list(row.likedBy).map(identity);}
      if(key==='posts')row.folderIds=list(row.folderIds).map(id=>ref('favoriteFolders',id));
      if (key === 'posts') { row.boardId = ref('boards', row.boardId); row.charIds = list(row.charIds).map(x => ref('characters', x)); }
      if (key === 'comments') { row.postId = ref('posts', row.postId); row.parentId = ref('comments', row.parentId); }
      if (key === 'users' || key === 'accounts') {
        row.charIds = list(row.charIds).map(x => ref('characters', x));
        if(key==='users'){row.forumIds=list(row.forumIds).map(x=>ref('boards',x));row.forumRoles=Object.fromEntries(Object.entries(row.forumRoles||{}).map(([boardId,value])=>[ref('boards',boardId),value]));}
        row.links = list(row.links).map(x => ({ ...x, userId: identity(x.userId) }));
        row.history = list(row.history).map(x => ({ ...x, postId: ref('posts', x.postId), commentId: ref('comments', x.commentId), partnerId: identity(x.partnerId) }));
      }
      if (['characters','worlds','factions','relationships','loreEntries','tagCatalog','favoriteFolders'].includes(key)) {
        row.boardId = ref('boards', row.boardId);
        if (Array.isArray(row.members)) row.members = row.members.map(x => typeof x === 'string' ? ref('characters', x) : {...x, charId: ref('characters', x.charId)});
        if (row.paroValues) row.paroValues = Object.fromEntries(Object.entries(row.paroValues).map(([k,v]) => [ref('worlds', k),v]));
      }
      if (index >= 0 && action === 'replace') out[key][index] = row; else out[key].push(row);
    }
    // Remove broken links from partial/hand-edited files and prevent cyclic comment chains.
    const exists = (k, value) => out[k].some(x => x.id === value);
    out.comments = out.comments.filter(x => exists('posts', x.postId));
    for (const c of out.comments) {
      const visited = new Set([c.id]); let parent = c.parentId;
      while (parent) {
        const p = out.comments.find(x => x.id === parent && x.postId === c.postId);
        if (!p || visited.has(parent)) { c.parentId = null; break; }
        visited.add(parent); parent = p.parentId;
      }
    }
    if (!state.profiles.length && incoming.activeProfile && out.profiles.some(p=>p.id===ref('profiles',incoming.activeProfile))) out.activeProfile=ref('profiles',incoming.activeProfile);
    return validate(out);
  }
  function endpoint(profile) {
    const u = new URL(profile.baseUrl);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))) throw new Error('API 網址需使用 HTTPS（本機服務可用 HTTP）。');
    if (u.username || u.password || u.search || u.hash) throw new Error('請填寫不含金鑰、查詢參數的 API 基礎網址。');
    const base = u.href.replace(/\/+$/, '');
    if (profile.type === 'gemini') {
      const normalized = base.replace(/\/models(?:\/.*)?$/, '');
      return normalized + (/\/v\d+(?:beta\d*|alpha\d*)?$/.test(normalized) ? '' : '/v1beta') + '/models/' + encodeURIComponent(profile.model.replace(/^models\//, '')) + ':generateContent';
    }
    return /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
  }
  function request(profile, key, system, payload) {
    const url = endpoint(profile);
    if (profile.type === 'gemini') return { url, options: { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }], generationConfig: { responseMimeType: 'application/json' } }) } };
    return { url, options: { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ model: profile.model, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(payload) }] }) } };
  }
  function parseResponse(raw, type) {
    const text = type === 'gemini' ? list(raw.candidates?.[0]?.content?.parts).filter(x => !x.thought).map(x => x.text || '').join('') : raw.choices?.[0]?.message?.content;
    if (!text) throw new Error('模型沒有回傳文字；可能受內容限制或模型不支援。');
    try { return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch { throw new Error('模型回傳格式不完整，請重試或切換模型；現有內容未被覆蓋。'); }
  }
  function getHot15Tags(state, boardId) {
    const posts = list(state?.posts).filter(p => p.boardId === boardId);
    const comments = list(state?.comments);
    const tagCatalog = list(state?.tagCatalog);
    const tagMap = new Map();

    for (const p of posts) {
      const postTags = tags(p.tags);
      if (!postTags.length) continue;
      const likesCount = Array.isArray(p.likedBy) ? p.likedBy.length : 0;
      const commentsCount = comments.filter(c => c.postId === p.id && !c.deleted && c.kind !== 'chapter').length;
      const interactionCount = likesCount + commentsCount;

      for (const tag of postTags) {
        const catItem = tagCatalog.find(t => t.name === tag && (t.boardId === boardId || t.boardId == null));
        if (catItem && catItem.showInSearch === false) continue;

        const stat = tagMap.get(tag) || { name: tag, postCount: 0, interactions: 0 };
        stat.postCount += 1;
        stat.interactions += interactionCount;
        tagMap.set(tag, stat);
      }
    }

    const sorted = Array.from(tagMap.values()).sort((a, b) => {
      if (b.postCount !== a.postCount) return b.postCount - a.postCount;
      if (b.interactions !== a.interactions) return b.interactions - a.interactions;
      return a.name.localeCompare(b.name, 'zh-TW');
    });

    return sorted.slice(0, 15);
  }
  function mergeBoard(data, sourceBoardId, targetBoardId, targetSubBoardName) {
    const boards = list(data.boards);
    const sourceBoard = boards.find(b => b.id === sourceBoardId);
    const targetBoard = boards.find(b => b.id === targetBoardId);
    if (!sourceBoard || !targetBoard) throw new Error('來源論壇或目標論壇不存在。');
    if (sourceBoardId === targetBoardId) throw new Error('無法將論壇合併至自身。');

    const subName = (targetSubBoardName || sourceBoard.name || '新子板塊').trim();
    const newSubBoard = section({
      id: id(),
      name: subName,
      englishName: sourceBoard.englishName || '',
      slogan: sourceBoard.slogan || '',
      description: sourceBoard.description || sourceBoard.worldview || ''
    });

    targetBoard.subBoards = list(targetBoard.subBoards);
    if (!targetBoard.subBoards.some(s => s.name.toLowerCase() === newSubBoard.name.toLowerCase())) {
      targetBoard.subBoards.push(newSubBoard);
    } else {
      const existing = targetBoard.subBoards.find(s => s.name.toLowerCase() === newSubBoard.name.toLowerCase());
      if (existing) {
        if (!existing.englishName) existing.englishName = newSubBoard.englishName;
        if (!existing.slogan) existing.slogan = newSubBoard.slogan;
        if (!existing.description) existing.description = newSubBoard.description;
      }
    }

    const matchedSub = targetBoard.subBoards.find(s => s.name.toLowerCase() === newSubBoard.name.toLowerCase()) || newSubBoard;

    for (const p of list(data.posts)) {
      if (p.boardId === sourceBoardId) {
        p.boardId = targetBoardId;
        p.subBoardId = matchedSub.id;
        p.subBoard = matchedSub.name;
      }
    }

    for (const key of ['characters', 'worlds', 'factions', 'relationships', 'loreEntries', 'favoriteFolders']) {
      for (const row of list(data[key])) {
        if (row.boardId === sourceBoardId) {
          row.boardId = targetBoardId;
        }
      }
    }

    for (const tag of list(data.tagCatalog)) {
      if (tag.boardId === sourceBoardId) {
        tag.boardId = targetBoardId;
      }
    }

    for (const u of list(data.users)) {
      const ids = list(u.forumIds);
      if (ids.includes(sourceBoardId)) {
        u.forumIds = [...new Set(ids.map(x => x === sourceBoardId ? targetBoardId : x))];
        if (u.forumRoles && u.forumRoles[sourceBoardId]) {
          if (!u.forumRoles[targetBoardId]) u.forumRoles[targetBoardId] = u.forumRoles[sourceBoardId];
          delete u.forumRoles[sourceBoardId];
        }
      }
    }

    data.boards = data.boards.filter(b => b.id !== sourceBoardId);
    if (data.activeBoardId === sourceBoardId) {
      data.activeBoardId = targetBoardId;
    }

    return { mergedBoard: targetBoard, newSubBoard: matchedSub };
  }
  const api = { clone, id, list, tags, groups, initial, validate, portable, dependencies, subset, merge, endpoint, request, parseResponse, getHot15Tags, mergeBoard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ForumCore = api;
})(globalThis);
