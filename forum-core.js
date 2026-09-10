/* Independent forum model. No references to the character editor's storage. */
(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => globalThis.crypto.randomUUID();
  const list = value => Array.isArray(value) ? value : [];
  const tags = value => [...new Set((Array.isArray(value) ? value : String(value || '').split(/[,，\n]/)).map(x => String(x).trim()).filter(Boolean))];
  const groups = ['boards', 'characters', 'worlds', 'factions', 'relationships', 'accounts', 'users', 'posts', 'comments', 'tagCatalog', 'favoriteFolders', 'profiles'];
  function initial() {
    const official = id(), fan = id();
    return { format: 'oc-fandom-forum', version: 1, boards: [{ id: id(), name: '綜合交流', description: '跨作品同好交流' }], characters: [], worlds: [], factions: [], relationships: [],
      accounts: [{ id: official, name: '官方編輯部', owned: true, official: true, gender: '女', color: '#d9ae70', color2: '#9c78c9' }, { id: fan, name: '我的同人帳號', owned: true, official: false, gender: '女', color: '#ad87c5', color2: '#709cac' }], users: [],
      posts: [], comments: [], tagCatalog: [], favoriteFolders: [], activeUser: fan, profiles: [], activeProfile: 'inherit',
      generation: { boardId: '', tags: '', type: '隨機', min: 1, max: 3, comments: 3, interval: 15, allowNew: true, enabled: false, nextAt: 0, prompt: '', atmosphere: '允許逆 CP、拆官配、角色爭議與對家拌嘴；不同用戶有各自立場。' } };
  }
  function validate(data) {
    if (!data || data.format !== 'oc-fandom-forum' || data.version !== 1) throw new Error('不是支援的同人論壇備份（版本 1）。');
    if (!data.accounts && Array.isArray(data.users)) { data.accounts = data.users.filter(x => x.owned); data.users = data.users.filter(x => !x.owned); }
    if(data.favoriteFolders===undefined)data.favoriteFolders=[];
    if(data.tagCatalog===undefined)data.tagCatalog=tags(list(data.posts).flatMap(p=>list(p.tags))).map(name=>({id:id(),name}));
    if (data.profiles === undefined) data.profiles = [];
    for (const key of groups) {
      if (!Array.isArray(data[key])) throw new Error('備份缺少資料表：' + key);
      const seen = new Set();
      for (const row of data[key]) {
        if (!row || typeof row.id !== 'string' || !row.id || seen.has(row.id)) throw new Error(key + ' 含無效或重複 ID。');
        seen.add(row.id);
      }
    }
    for (const post of data.posts) {
      if (typeof post.title !== 'string' || typeof post.content !== 'string') throw new Error('貼文格式錯誤。');
    }
    for (const comment of data.comments) if (typeof comment.content !== 'string') throw new Error('留言格式錯誤。');
    const identities = new Set(data.accounts.map(x => x.id));
    if (data.users.some(x => identities.has(x.id))) throw new Error('我的帳號與同好帳號不能共用 ID。');
    data.accounts.forEach(x => x.owned = true); data.users.forEach(x => { x.owned = false; x.official = false; });
    return data;
  }
  // User-requested portable API settings include credentials; schedules remain local.
  function portable(state) {
    return { format: state.format, version: 1, activeProfile:state.activeProfile, ...Object.fromEntries(groups.map(k => [k, clone(state[k])])) };
  }
  function dependencies(data, selected) {
    const chosen = new Set(selected);
    let changed = true;
    const add = (key, ref) => { if (ref && data[key].some(x => x.id === ref) && !chosen.has(key + ':' + ref)) { chosen.add(key + ':' + ref); changed = true; } };
    while (changed) {
      changed = false;
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
      for (const b of data.boards.filter(x => chosen.has('boards:' + x.id))) for (const key of ['worlds','factions','relationships']) data[key].filter(x => x.boardId === b.id).forEach(x => add(key, x.id));
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
      if (key === 'posts' || key === 'comments') {row.authorId = identity(row.authorId);row.likedBy=list(row.likedBy).map(identity);}
      if(key==='posts')row.folderIds=list(row.folderIds).map(id=>ref('favoriteFolders',id));
      if (key === 'posts') { row.boardId = ref('boards', row.boardId); row.charIds = list(row.charIds).map(x => ref('characters', x)); }
      if (key === 'comments') { row.postId = ref('posts', row.postId); row.parentId = ref('comments', row.parentId); }
      if (key === 'users' || key === 'accounts') {
        row.charIds = list(row.charIds).map(x => ref('characters', x));
        row.links = list(row.links).map(x => ({ ...x, userId: identity(x.userId) }));
        row.history = list(row.history).map(x => ({ ...x, postId: ref('posts', x.postId), commentId: ref('comments', x.commentId), partnerId: identity(x.partnerId) }));
      }
      if (['characters','worlds','factions','relationships'].includes(key)) {
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
  const api = { clone, id, list, tags, groups, initial, validate, portable, dependencies, subset, merge, endpoint, request, parseResponse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ForumCore = api;
})(globalThis);
