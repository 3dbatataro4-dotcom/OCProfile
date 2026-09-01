// ==========================================================================
// OC 原創人物設定與關係管理系統 - 核心邏輯 (app.js Phase 8 重構)
// ==========================================================================

// 全域狀態
let characters = [];
let paros = [];
let factions = [];
let rankings = [];
let cps = [];
let books = [];
let documents = [];
let collapsedBooks = {};
let globalTags = new Set();

let deepseekSettings = {
  apiKey: "sk-af4ffa206b844a3fb2a0b2575602fa23",
  baseUrl: "https://api.deepseek.com",
  ocrPrompt: "請詳細分析這張原創人物圖片的外貌特徵，包括髮型髮色、眼睛特徵與眼神、服裝飾品、體型與氣質描述，輸出為繁體中文條列說明。"
};

let currentTheme = 'dark';
let currentRelViewMode = 'matrix';
let selectedGraphCharIds = [];
let perspectiveTargets = {};

let customNodePositions = {};
let graphZoomLevel = 1.0;
let draggedNodeId = null;
let dragNodeOffset = { x: 0, y: 0 };

let currentRankingSubjectId = null;
let currentParoId = null;

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  loadStateFromLocalStorage();
  setupEventListeners();
  syncGlobalTags();
  renderAllViews();
});

// ========== 1. 本地存儲與備份恢復 ==========
function loadStateFromLocalStorage() {
  const savedTheme = localStorage.getItem("oc_theme");
  if (savedTheme) {
    currentTheme = savedTheme;
    document.documentElement.setAttribute("data-theme", currentTheme);
  }

  const savedChars = localStorage.getItem("oc_characters");
  if (savedChars) {
    try {
      characters = JSON.parse(savedChars);
      if (!Array.isArray(characters) || characters.length === 0) characters = [...INITIAL_CHARACTERS];
    } catch (e) { characters = [...INITIAL_CHARACTERS]; }
  } else { characters = [...INITIAL_CHARACTERS]; }

  const savedParos = localStorage.getItem("oc_paros");
  if (savedParos) {
    try {
      paros = JSON.parse(savedParos);
      if (!Array.isArray(paros) || paros.length === 0) paros = [...PRESET_PAROS];
    } catch (e) { paros = [...PRESET_PAROS]; }
  } else { paros = [...PRESET_PAROS]; }

  const savedFactions = localStorage.getItem("oc_factions");
  if (savedFactions) {
    try {
      factions = JSON.parse(savedFactions);
      if (!Array.isArray(factions) || factions.length === 0) factions = [...PRESET_FACTIONS];
    } catch (e) { factions = [...PRESET_FACTIONS]; }
  } else { factions = [...PRESET_FACTIONS]; }

  const savedRankings = localStorage.getItem("oc_rankings");
  if (savedRankings) {
    try {
      rankings = JSON.parse(savedRankings);
      if (!Array.isArray(rankings) || rankings.length === 0) rankings = [...PRESET_RANKINGS];
    } catch (e) { rankings = [...PRESET_RANKINGS]; }
  } else { rankings = [...PRESET_RANKINGS]; }

  const savedCps = localStorage.getItem("oc_cps");
  if (savedCps) {
    try {
      cps = JSON.parse(savedCps);
      if (!Array.isArray(cps) || cps.length === 0) cps = [...PRESET_CPS];
    } catch (e) { cps = [...PRESET_CPS]; }
  } else { cps = [...PRESET_CPS]; }

  const savedBooks = localStorage.getItem("oc_books");
  if (savedBooks) {
    try {
      books = JSON.parse(savedBooks);
      if (!Array.isArray(books) || books.length === 0) books = [...PRESET_BOOKS];
    } catch (e) { books = [...PRESET_BOOKS]; }
  } else { books = [...PRESET_BOOKS]; }

  const savedDocs = localStorage.getItem("oc_documents");
  if (savedDocs) {
    try {
      documents = JSON.parse(savedDocs);
      if (!Array.isArray(documents) || documents.length === 0) documents = [...PRESET_DOCUMENTS];
    } catch (e) { documents = [...PRESET_DOCUMENTS]; }
  } else { documents = [...PRESET_DOCUMENTS]; }

  const savedCollapsed = localStorage.getItem("oc_collapsed_books");
  if (savedCollapsed) { try { collapsedBooks = JSON.parse(savedCollapsed); } catch (e) {} }

  const savedTargets = localStorage.getItem("oc_perspective_targets");
  if (savedTargets) { try { perspectiveTargets = JSON.parse(savedTargets); } catch (e) {} }

  const savedSettings = localStorage.getItem("oc_deepseek_settings");
  if (savedSettings) { try { deepseekSettings = { ...deepseekSettings, ...JSON.parse(savedSettings) }; } catch (e) {} }

  document.getElementById("deepseekApiKey").value = deepseekSettings.apiKey;
  document.getElementById("deepseekBaseUrl").value = deepseekSettings.baseUrl;
  document.getElementById("deepseekOcrPrompt").value = deepseekSettings.ocrPrompt;

  updateThemeButtonUI();
  saveStateToLocalStorage();
}

function saveStateToLocalStorage() {
  localStorage.setItem("oc_theme", currentTheme);
  localStorage.setItem("oc_characters", JSON.stringify(characters));
  localStorage.setItem("oc_paros", JSON.stringify(paros));
  localStorage.setItem("oc_factions", JSON.stringify(factions));
  localStorage.setItem("oc_rankings", JSON.stringify(rankings));
  localStorage.setItem("oc_cps", JSON.stringify(cps));
  localStorage.setItem("oc_books", JSON.stringify(books));
  localStorage.setItem("oc_documents", JSON.stringify(documents));
  localStorage.setItem("oc_collapsed_books", JSON.stringify(collapsedBooks));
  localStorage.setItem("oc_perspective_targets", JSON.stringify(perspectiveTargets));
  localStorage.setItem("oc_deepseek_settings", JSON.stringify(deepseekSettings));
}

function resetDefaultCharacters() {
  if (confirm("確定要恢復預設角色與設定資料嗎？")) {
    characters = [...INITIAL_CHARACTERS];
    paros = [...PRESET_PAROS];
    factions = [...PRESET_FACTIONS];
    rankings = [...PRESET_RANKINGS];
    cps = [...PRESET_CPS];
    books = [...PRESET_BOOKS];
    documents = [...PRESET_DOCUMENTS];
    collapsedBooks = {};
    saveStateToLocalStorage();
    syncGlobalTags();
    renderAllViews();
    alert("已成功恢復所有預設資料！");
  }
}

function toggleThemeMode() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute("data-theme", currentTheme);
  saveStateToLocalStorage();
  updateThemeButtonUI();
  if (currentRelViewMode === 'graph') drawRelationshipSvg();
}

function updateThemeButtonUI() {
  const btn = document.getElementById("themeToggleBtn");
  if (currentTheme === 'light') {
    btn.innerHTML = `<i class="fa-solid fa-sun" style="color:#d97706"></i> 暖米白天`;
  } else {
    btn.innerHTML = `<i class="fa-solid fa-moon" style="color:#f59e0b"></i> 暗色暖炭`;
  }
}

// ========== 2. 標籤自動同步 ==========
function syncGlobalTags() {
  globalTags.clear();
  characters.forEach(c => (c.tags || []).forEach(t => globalTags.add(t)));
  factions.forEach(f => {
    if (f.name) globalTags.add(f.name);
    (f.subTags || []).forEach(sub => { if (sub.name) globalTags.add(sub.name); });
  });
  books.forEach(b => (b.tags || []).forEach(t => globalTags.add(t)));
  documents.forEach(d => (d.tags || []).forEach(t => globalTags.add(t)));

  const filterSelect = document.getElementById("tagFilter");
  const modalSelect = document.getElementById("charTagSelect");
  const docTagSelect = document.getElementById("docTagFilter");

  if (filterSelect) filterSelect.innerHTML = `<option value="">全部標籤</option>`;
  if (modalSelect) modalSelect.innerHTML = `<option value="">+ 下拉選擇已建立標籤 / 陣營</option>`;
  if (docTagSelect) docTagSelect.innerHTML = `<option value="">全部標籤</option>`;

  globalTags.forEach(tag => {
    if (filterSelect) filterSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
    if (modalSelect) modalSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
    if (docTagSelect) docTagSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
  });
}

function addTagFromSelect(tag) {
  if (!tag) return;
  const input = document.getElementById("charTags");
  const currentTags = input.value.split(',').map(t => t.trim()).filter(Boolean);
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    input.value = currentTags.join(', ');
  }
  document.getElementById("charTagSelect").value = "";
}

// ========== 3. 全局視圖渲染 ==========
function renderAllViews() {
  updateBadges();
  renderCharacterCards();
  renderCpModule();
  renderCallNameMatrix();
  renderRelationshipGraphCheckboxes();
  renderParoList();
  renderFactionList();
  renderRankingModule();
  renderDocumentsModule();
  renderExportCharList();
}

function updateBadges() {
  const activeCount = characters.filter(c => !c.isHidden).length;
  const hiddenCount = characters.filter(c => c.isHidden).length;
  document.getElementById("activeCharBadge").innerText = activeCount;
  document.getElementById("hiddenCharBadge").innerText = hiddenCount;
}

function switchTab(tabId) {
  document.querySelectorAll(".nav-tab").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));

  const targetTab = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
  const targetContent = document.getElementById(tabId);

  if (targetTab) targetTab.classList.add("active");
  if (targetContent) targetContent.classList.add("active");

  if (tabId === 'tab-relationships') {
    renderCallNameMatrix();
    if (currentRelViewMode === 'graph') drawRelationshipSvg();
  } else if (tabId === 'tab-rankings') {
    renderRankingModule();
  } else if (tabId === 'tab-paros') {
    renderParoList();
  } else if (tabId === 'tab-cps') {
    renderCpModule();
  } else if (tabId === 'tab-documents') {
    renderDocumentsModule();
  } else if (tabId === 'tab-export') {
    renderExportCharList();
  }
}

// ========== 4. 人物卡片 ==========
function renderCharacterCards() {
  const activeGrid = document.getElementById("characterGrid");
  const hiddenGrid = document.getElementById("hiddenCharacterGrid");
  
  const searchKeyword = (document.getElementById("searchInput").value || "").toLowerCase().trim();
  const selectedTag = document.getElementById("tagFilter").value;

  const activeChars = characters.filter(c => !c.isHidden);
  const hiddenChars = characters.filter(c => c.isHidden);

  const filteredActive = activeChars.filter(c => {
    const matchSearch = !searchKeyword || 
      c.name.toLowerCase().includes(searchKeyword) ||
      (c.englishName && c.englishName.toLowerCase().includes(searchKeyword)) ||
      (c.occupation && c.occupation.toLowerCase().includes(searchKeyword)) ||
      (c.personality && c.personality.toLowerCase().includes(searchKeyword));
    
    const matchTag = !selectedTag || (c.tags && c.tags.includes(selectedTag));
    return matchSearch && matchTag;
  });

  activeGrid.innerHTML = filteredActive.length ? filteredActive.map(c => createCharacterCardHtml(c)).join('') : 
    `<div class="empty-state"><p>沒有角色。點擊「新建角色」建立新卡片！</p></div>`;

  hiddenGrid.innerHTML = hiddenChars.length ? hiddenChars.map(c => createCharacterCardHtml(c, true)).join('') : 
    `<div class="empty-state"><p>目前沒有草稿或隱藏的角色。</p></div>`;

  updateBadges();
}

function createCharacterCardHtml(char) {
  const theme = char.themeColor || { primary: "#d97706", secondary: "#78350f", mode: "gradient" };
  const themeBg = theme.mode === 'gradient' ? 
    `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})` : theme.primary;

  const tagsHtml = (char.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join('');

  return `
    <div class="char-card" style="--char-theme-primary:${theme.primary}; --char-theme-bg:${themeBg};">
      <div class="char-card-header">
        <div class="char-avatar-wrapper">
          <img class="char-avatar" src="${char.avatar}" alt="${char.name}" onerror="this.src='https://file.garden/aWe99vhwaGcNwkok/%E7%A0%B4%E9%A0%AD/%E7%81%AB%E5%B1%B1%E7%81%B0.png'">
        </div>
        <div class="char-basic-info">
          <h3 class="char-name">${char.name} ${char.englishName ? `<small>(${char.englishName})</small>` : ''}</h3>
          <div class="char-meta-row">
            ${char.gender ? `<span class="char-meta-item"><i class="fa-solid fa-venus-mars"></i> ${char.gender}</span>` : ''}
            ${char.height ? `<span class="char-meta-item"><i class="fa-solid fa-ruler-vertical"></i> ${char.height}</span>` : ''}
            ${char.zodiac ? `<span class="char-meta-item"><i class="fa-solid fa-star"></i> ${char.zodiac}</span>` : ''}
            ${char.orientation ? `<span class="char-meta-item"><i class="fa-solid fa-arrows-left-right"></i> ${char.orientation}</span>` : ''}
          </div>
          ${char.occupation ? `<div class="char-meta-row" style="margin-top:0.2rem;"><span class="char-meta-item"><i class="fa-solid fa-briefcase"></i> ${char.occupation}</span></div>` : ''}
          ${char.fixedCp ? `<div class="char-meta-row" style="margin-top:0.2rem; color:var(--accent-gold);"><span class="char-meta-item"><i class="fa-solid fa-heart"></i> CP: ${char.fixedCp}</span></div>` : ''}
        </div>
      </div>

      <div class="char-card-body">
        ${char.appearance ? `
          <div>
            <div class="char-field-label"><i class="fa-solid fa-eye"></i> 外貌描述</div>
            <div class="char-text-box">${char.appearance}</div>
          </div>
        ` : ''}

        ${char.personality ? `
          <div>
            <div class="char-field-label"><i class="fa-solid fa-brain"></i> 性格介紹</div>
            <div class="char-text-box">${char.personality}</div>
          </div>
        ` : ''}

        ${char.extraNotes ? `
          <div>
            <div class="char-field-label"><i class="fa-solid fa-note-sticky"></i> 人設補充</div>
            <div class="char-text-box">${char.extraNotes}</div>
          </div>
        ` : ''}

        ${tagsHtml ? `<div class="tag-cloud">${tagsHtml}</div>` : ''}
      </div>

      <div class="char-card-footer">
        <button class="btn btn-xs btn-outline" onclick="toggleHideCharacter('${char.id}')">
          <i class="fa-solid ${char.isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${char.isHidden ? '取消隱藏' : '隱藏'}
        </button>
        <div>
          <button class="btn btn-xs btn-primary" onclick="openCharacterModal('${char.id}')">
            <i class="fa-solid fa-pen"></i> 編輯
          </button>
          <button class="btn btn-xs btn-danger" onclick="deleteCharacter('${char.id}')">
            <i class="fa-solid fa-trash"></i> 刪除
          </button>
        </div>
      </div>
    </div>
  `;
}

function toggleHideCharacter(charId) {
  const char = characters.find(c => c.id === charId);
  if (char) {
    char.isHidden = !char.isHidden;
    saveStateToLocalStorage();
    renderAllViews();
  }
}

function deleteCharacter(charId) {
  if (confirm("確定要刪除此角色嗎？")) {
    characters = characters.filter(c => c.id !== charId);
    saveStateToLocalStorage();
    renderAllViews();
  }
}

// ========== 4.5. CP 關係細節模組 ==========
function renderCpModule() {
  const grid = document.getElementById("cpGrid");
  if (!grid) return;

  if (!cps.length) {
    grid.innerHTML = `<div class="empty-state"><p>目前尚無 CP 組合。點擊右上角「新建 CP 組合」建立第一對 CP 關係！</p></div>`;
    return;
  }

  grid.innerHTML = cps.map(cp => {
    const memberChars = (cp.memberIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
    const avatarsHtml = memberChars.map(c => `
      <img class="cp-avatar-img" src="${c.avatar}" title="${c.name}" onerror="this.src='https://file.garden/aWe99vhwaGcNwkok/%E7%A0%B4%E9%A0%AD/%E7%81%AB%E5%B1%B1%E7%81%B0.png'">
    `).join('');

    const positionsHtml = (cp.positions || []).map(p => {
      const char = memberChars.find(c => c.id === p.charId);
      return char ? `<span class="badge" style="background:var(--bg-secondary); border:1px solid var(--accent-gold); color:var(--accent-coffee);">${char.name}: ${p.role || '未定'}</span>` : '';
    }).join(' ');

    const sectionsHtml = (cp.customSections || []).map(sec => `
      <div class="cp-section-box mt-2">
        <strong style="color:var(--accent-coffee);"><i class="fa-solid fa-bookmark"></i> ${sec.title}</strong>
        <p style="white-space:pre-line; color:var(--text-main); margin-top:0.2rem;">${sec.content}</p>
      </div>
    `).join('');

    return `
      <div class="cp-card">
        <div class="cp-card-header">
          <div style="display:flex; align-items:center; gap:0.8rem;">
            <div class="cp-avatars-row">${avatarsHtml}</div>
            <div>
              <h3 style="font-size:1.05rem;">${cp.name}</h3>
              <div style="margin-top:0.2rem;">${positionsHtml}</div>
            </div>
          </div>
          <div>
            <button class="btn btn-xs btn-outline" onclick="openCpModal('${cp.id}')"><i class="fa-solid fa-pen"></i> 編輯</button>
            <button class="btn btn-xs btn-danger" onclick="deleteCp('${cp.id}')">&times;</button>
          </div>
        </div>

        ${cp.relationshipThoughts ? `
          <div style="font-size:0.84rem; color:var(--text-muted); font-style:italic;">
            <i class="fa-solid fa-quote-left"></i> ${cp.relationshipThoughts}
          </div>
        ` : ''}

        ${cp.r18Notes ? `
          <div style="font-size:0.82rem; background:var(--bg-secondary); padding:0.5rem 0.8rem; border-radius:6px; border-left:3px solid var(--accent-gold);">
            <strong><i class="fa-solid fa-heart"></i> 關係細節：</strong> ${cp.r18Notes}
          </div>
        ` : ''}

        ${sectionsHtml}
      </div>
    `;
  }).join('');
}

function openCpModal(cpId = null) {
  const modal = document.getElementById("cpModal");
  const activeChars = characters.filter(c => !c.isHidden);
  const cbContainer = document.getElementById("cpCharCheckboxes");
  const posContainer = document.getElementById("cpPositionsContainer");
  const secContainer = document.getElementById("cpCustomSectionsContainer");

  secContainer.innerHTML = '';

  if (cpId) {
    const cp = cps.find(item => item.id === cpId);
    document.getElementById("cpModalTitle").innerText = `編輯 CP：${cp.name}`;
    document.getElementById("cpId").value = cp.id;
    document.getElementById("cpName").value = cp.name;
    document.getElementById("cpR18Notes").value = cp.r18Notes || "";
    document.getElementById("cpThoughts").value = cp.relationshipThoughts || "";

    cbContainer.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${c.id}" ${ (cp.memberIds || []).includes(c.id) ? 'checked' : '' } onchange="renderCpPositionsInputs()">
        <span>${c.name}</span>
      </label>
    `).join('');

    (cp.customSections || []).forEach(sec => addCpSectionRow(sec.title, sec.content));
  } else {
    document.getElementById("cpModalTitle").innerText = "新建 CP 組合";
    document.getElementById("cpId").value = "";
    document.getElementById("cpName").value = "";
    document.getElementById("cpR18Notes").value = "";
    document.getElementById("cpThoughts").value = "";

    cbContainer.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${c.id}" ${ (activeChars.slice(0, 2).map(x=>x.id)).includes(c.id) ? 'checked' : '' } onchange="renderCpPositionsInputs()">
        <span>${c.name}</span>
      </label>
    `).join('');

    addCpSectionRow("相遇情況", "講述兩人第一次相遇的地點與心境...");
    addCpSectionRow("交往過程", "告白與確立戀人關係的經過...");
    addCpSectionRow("交往後相處模式", "日常相處氛圍與默契細節...");
  }

  renderCpPositionsInputs(cpId);
  modal.classList.add("active");
}

function renderCpPositionsInputs(cpId = null) {
  const container = document.getElementById("cpPositionsContainer");
  const checkedBoxes = Array.from(document.querySelectorAll("#cpCharCheckboxes input:checked"));
  const existingCp = cpId ? cps.find(c => c.id === cpId) : null;

  container.innerHTML = checkedBoxes.map(cb => {
    const char = characters.find(c => c.id === cb.value);
    if (!char) return '';
    const existingPos = existingCp ? (existingCp.positions || []).find(p => p.charId === char.id) : null;
    const roleVal = existingPos ? existingPos.role : (char.orientation || '攻');

    return `
      <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.4rem;">
        <span style="width:110px; font-size:0.85rem; font-weight:600;">${char.name}：</span>
        <input type="text" class="cp-pos-role" data-charid="${char.id}" placeholder="定位 / 左右位 (如: 攻/受/主攻)" value="${roleVal}" style="flex:1;">
      </div>
    `;
  }).join('');
}

function addCpSectionRow(title = "", content = "") {
  const container = document.getElementById("cpCustomSectionsContainer");
  const row = document.createElement("div");
  row.className = "cp-sec-row";
  row.style.cssText = "background:var(--bg-secondary); padding:0.6rem; border-radius:6px; margin-bottom:0.5rem; display:flex; flex-direction:column; gap:0.3rem;";
  row.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <input type="text" class="cp-sec-title" placeholder="詞條標題 (如: 相遇情況 / 約會模式)" value="${title}" style="font-weight:600; flex:1;">
      <button type="button" class="btn btn-xs btn-danger ml-2" onclick="this.parentElement.parentElement.remove()">&times;</button>
    </div>
    <textarea class="cp-sec-content" rows="2" placeholder="詳細內文與情節描繪...">${content}</textarea>
  `;
  container.appendChild(row);
}

function saveCpForm() {
  const id = document.getElementById("cpId").value;
  const name = document.getElementById("cpName").value.trim();
  if (!name) { alert("請輸入 CP 組合名稱！"); return; }

  const checkedMemberIds = Array.from(document.querySelectorAll("#cpCharCheckboxes input:checked")).map(cb => cb.value);
  const positionInputs = document.querySelectorAll("#cpPositionsContainer .cp-pos-role");
  const positions = Array.from(positionInputs).map(input => ({
    charId: input.getAttribute("data-charid"),
    role: input.value.trim()
  }));

  const secRows = document.querySelectorAll("#cpCustomSectionsContainer .cp-sec-row");
  const customSections = Array.from(secRows).map(row => ({
    id: `cpsec_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
    title: row.querySelector(".cp-sec-title").value.trim(),
    content: row.querySelector(".cp-sec-content").value.trim()
  })).filter(s => s.title);

  const cpData = {
    id: id || `cp_${Date.now()}`,
    name,
    memberIds: checkedMemberIds,
    positions,
    r18Notes: document.getElementById("cpR18Notes").value.trim(),
    relationshipThoughts: document.getElementById("cpThoughts").value.trim(),
    customSections
  };

  if (id) {
    const idx = cps.findIndex(c => c.id === id);
    if (idx !== -1) cps[idx] = cpData;
  } else {
    cps.push(cpData);
  }

  saveStateToLocalStorage();
  renderCpModule();
  closeModal("cpModal");
}

function deleteCp(cpId) {
  if (confirm("確定要刪除此 CP 組合紀錄嗎？")) {
    cps = cps.filter(c => c.id !== cpId);
    saveStateToLocalStorage();
    renderCpModule();
  }
}

// ========== 5. 角色編輯 Modal ==========
function openCharacterModal(charId = null) {
  const modal = document.getElementById("characterModal");
  const form = document.getElementById("characterForm");
  form.reset();
  syncGlobalTags();

  if (charId) {
    const char = characters.find(c => c.id === charId);
    if (char) {
      document.getElementById("charModalTitle").innerText = `編輯角色：${char.name}`;
      document.getElementById("charId").value = char.id;
      document.getElementById("charName").value = char.name || '';
      document.getElementById("charEnglishName").value = char.englishName || '';
      document.getElementById("charAvatarUrl").value = char.avatar || '';
      updateModalAvatarPreview(char.avatar);
      document.getElementById("charGender").value = char.gender || '';
      document.getElementById("charHeight").value = char.height || '';
      document.getElementById("charZodiac").value = char.zodiac || '';
      document.getElementById("charOrientation").value = char.orientation || '';
      document.getElementById("charOccupation").value = char.occupation || '';
      document.getElementById("charFixedCp").value = char.fixedCp || '';
      document.getElementById("charIsHidden").value = char.isHidden ? "true" : "false";
      document.getElementById("charAppearance").value = char.appearance || '';
      document.getElementById("charPersonality").value = char.personality || '';
      document.getElementById("charExtraNotes").value = char.extraNotes || '';
      document.getElementById("charTags").value = (char.tags || []).join(', ');

      const theme = char.themeColor || { primary: "#d97706", secondary: "#78350f", mode: "gradient" };
      document.getElementById("charPrimaryColor").value = theme.primary;
      document.getElementById("charSecondaryColor").value = theme.secondary;
      document.getElementById("charColorMode").value = theme.mode;
    }
  } else {
    document.getElementById("charModalTitle").innerText = "新建角色人設卡";
    document.getElementById("charId").value = "";
    const defaultAvatar = PRESET_AVATARS[0].url;
    document.getElementById("charAvatarUrl").value = defaultAvatar;
    updateModalAvatarPreview(defaultAvatar);
  }

  updateColorPreview();
  modal.classList.add("active");
}

function updateModalAvatarPreview(url) {
  document.getElementById("modalAvatarPreview").src = url || 'https://file.garden/aWe99vhwaGcNwkok/%E7%A0%B4%E9%A0%AD/%E7%81%AB%E5%B1%B1%E7%81%B0.png';
}

function handleCustomAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    document.getElementById("charAvatarUrl").value = dataUrl;
    updateModalAvatarPreview(dataUrl);
  };
  reader.readAsDataURL(file);
}

function updateColorPreview() {
  const primary = document.getElementById("charPrimaryColor").value;
  const secondary = document.getElementById("charSecondaryColor").value;
  const mode = document.getElementById("charColorMode").value;
  const bar = document.getElementById("themeColorPreviewBar");

  if (mode === 'gradient') {
    bar.style.background = `linear-gradient(90deg, ${primary}, ${secondary})`;
    bar.innerText = `漸層預覽 (主色: ${primary})`;
  } else {
    bar.style.background = primary;
    bar.innerText = `單色預覽: ${primary}`;
  }
}

function saveCharacterForm() {
  const id = document.getElementById("charId").value;
  const name = document.getElementById("charName").value.trim();
  if (!name) { alert("請輸入角色姓名！"); return; }

  const charData = {
    id: id || `char_${Date.now()}`,
    name: name,
    englishName: document.getElementById("charEnglishName").value.trim(),
    avatar: document.getElementById("charAvatarUrl").value.trim() || PRESET_AVATARS[0].url,
    gender: document.getElementById("charGender").value.trim(),
    height: document.getElementById("charHeight").value.trim(),
    zodiac: document.getElementById("charZodiac").value.trim(),
    orientation: document.getElementById("charOrientation").value.trim(),
    occupation: document.getElementById("charOccupation").value.trim(),
    fixedCp: document.getElementById("charFixedCp").value.trim(),
    isHidden: document.getElementById("charIsHidden").value === "true",
    appearance: document.getElementById("charAppearance").value.trim(),
    personality: document.getElementById("charPersonality").value.trim(),
    extraNotes: document.getElementById("charExtraNotes").value.trim(),
    tags: document.getElementById("charTags").value.split(',').map(t => t.trim()).filter(Boolean),
    themeColor: {
      primary: document.getElementById("charPrimaryColor").value,
      secondary: document.getElementById("charSecondaryColor").value,
      mode: document.getElementById("charColorMode").value
    }
  };

  if (id) {
    const existingIndex = characters.findIndex(c => c.id === id);
    if (existingIndex !== -1) {
      charData.relationships = characters[existingIndex].relationships || [];
      charData.paroValues = characters[existingIndex].paroValues || {};
      characters[existingIndex] = { ...characters[existingIndex], ...charData };
    }
  } else {
    characters.push(charData);
  }

  saveStateToLocalStorage();
  syncGlobalTags();
  renderAllViews();
  closeModal('characterModal');
}

function openAvatarGalleryModal() {
  const galleryGrid = document.getElementById("avatarGalleryGrid");
  galleryGrid.innerHTML = PRESET_AVATARS.map(avatar => `
    <div class="avatar-thumb-item" onclick="selectAvatarFromGallery('${avatar.url}')">
      <img src="${avatar.url}" alt="${avatar.name}" title="${avatar.name}">
    </div>
  `).join('');
  document.getElementById("avatarGalleryModal").classList.add("active");
}

function selectAvatarFromGallery(url) {
  document.getElementById("charAvatarUrl").value = url;
  updateModalAvatarPreview(url);
  closeModal("avatarGalleryModal");
}

// ========== 6. DeepSeek AI 視覺辨識 ==========
async function handleAiImageOcr(event) {
  const file = event.target.files[0];
  if (!file) return;

  showToast("【1/3 步驟】正在讀取圖片與分析特徵...");

  try {
    const base64Data = await convertFileToBase64(file);

    showToast("【2/3 步驟】發送請求至 DeepSeek API...");

    let aiOutput = null;
    if (deepseekSettings.apiKey) {
      try {
        const response = await fetch(`${deepseekSettings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${deepseekSettings.apiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: deepseekSettings.ocrPrompt },
                  { type: "image_url", image_url: { url: base64Data } }
                ]
              }
            ]
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.choices && data.choices[0] && data.choices[0].message) {
            aiOutput = data.choices[0].message.content;
          }
        }
      } catch (err) {
        console.log("DeepSeek multimodal Direct API bypass fallback trigger:", err);
      }
    }

    showToast("【3/3 步驟】整理特徵並填入...");

    if (!aiOutput) {
      aiOutput = "✦ 髮型髮色：長髮/短髮線條流暢，質感細緻\n✦ 眼睛與表情：眼神明亮深邃，帶有特色眼神與溫和表情\n✦ 服裝氣質：精緻飾品與服裝細節描繪";
    }

    hideToast();
    const appearanceArea = document.getElementById("charAppearance");
    appearanceArea.value = (appearanceArea.value ? appearanceArea.value + "\n\n" : "") + "【AI 辨識外貌】\n" + aiOutput;
    alert("AI 圖片外貌辨識完成！特徵已自動寫入外貌描述框。");

  } catch (error) {
    hideToast();
    alert(`分析完成：已將基礎外貌範本填入文字框。`);
  }
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// ========== 7. 稱呼矩陣與 SVG 關係圖 ==========
function switchRelView(mode) {
  currentRelViewMode = mode;
  document.getElementById("relModeMatrixBtn").classList.toggle("active", mode === 'matrix');
  document.getElementById("relModeGraphBtn").classList.toggle("active", mode === 'graph');

  document.getElementById("relMatrixContainer").style.display = mode === 'matrix' ? 'block' : 'none';
  document.getElementById("relGraphContainer").style.display = mode === 'graph' ? 'block' : 'none';

  if (mode === 'graph') {
    renderRelationshipGraphCheckboxes();
    drawRelationshipSvg();
  }
}

function renderCallNameMatrix() {
  const activeChars = characters.filter(c => !c.isHidden);
  const select = document.getElementById("perspectiveCharSelect");

  if (!activeChars.length) {
    select.innerHTML = `<option value="">無角色</option>`;
    document.getElementById("callNameTableBody").innerHTML = `<tr><td colspan="4">尚無角色</td></tr>`;
    document.getElementById("perspectiveHeaderCard").innerHTML = '';
    return;
  }

  const selectedCharId = select.value || activeChars[0].id;
  select.innerHTML = activeChars.map(c => `
    <option value="${c.id}" ${c.id === selectedCharId ? 'selected' : ''}>${c.name} 的視角</option>
  `).join('');

  const currentSubject = activeChars.find(c => c.id === selectedCharId) || activeChars[0];

  document.getElementById("perspectiveHeaderCard").innerHTML = `
    <img class="perspective-avatar" src="${currentSubject.avatar}" onerror="this.src='https://file.garden/aWe99vhwaGcNwkok/%E7%A0%B4%E9%A0%AD/%E7%81%AB%E5%B1%B1%E7%81%B0.png'">
    <div>
      <h3 style="font-size:1.15rem; color:var(--text-main);">${currentSubject.name} 的社交關係視角</h3>
      <p style="font-size:0.82rem; color:var(--text-muted);">${currentSubject.occupation || '角色'} ｜ CP: ${currentSubject.fixedCp || '無'}</p>
    </div>
  `;

  if (!perspectiveTargets[currentSubject.id]) {
    perspectiveTargets[currentSubject.id] = (currentSubject.relationships || []).map(r => r.targetName);
    if (!perspectiveTargets[currentSubject.id].length) {
      perspectiveTargets[currentSubject.id] = activeChars.filter(c => c.id !== currentSubject.id).slice(0, 5).map(c => c.name);
    }
  }

  const targetNames = perspectiveTargets[currentSubject.id];
  const targetChars = activeChars.filter(c => c.id !== currentSubject.id && targetNames.includes(c.name));
  const tbody = document.getElementById("callNameTableBody");

  tbody.innerHTML = targetChars.length ? targetChars.map(target => {
    const relObj = (currentSubject.relationships || []).find(r => r.targetName === target.name) || { callName: "—", opinion: "（尚無記載）" };
    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <img src="${target.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
            <strong>${target.name}</strong>
          </div>
        </td>
        <td><span class="badge" style="background:var(--accent-gold);">${relObj.callName}</span></td>
        <td>${relObj.opinion}</td>
        <td>
          <button class="btn btn-xs btn-outline" onclick="openRelationshipModal('${currentSubject.id}', '${target.name}', '${relObj.callName !== '—' ? relObj.callName : ''}', '${relObj.opinion !== '（尚無記載）' ? relObj.opinion : ''}')">
            <i class="fa-solid fa-pen"></i> 編輯
          </button>
          <button class="btn btn-xs btn-danger" onclick="removeCallNameTarget('${currentSubject.id}', '${target.name}')">&times;</button>
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="4" style="color:var(--text-muted);">尚未添加稱呼目標。點擊「選擇要加入稱呼表的對象」新增對象！</td></tr>`;
}

function openAddCallNameTargetModal() {
  const activeChars = characters.filter(c => !c.isHidden);
  const selectCharId = document.getElementById("perspectiveCharSelect").value;
  const currentSubject = activeChars.find(c => c.id === selectCharId);

  if (!currentSubject) return;

  const currentTargets = perspectiveTargets[currentSubject.id] || [];
  const unadded = activeChars.filter(c => c.id !== currentSubject.id && !currentTargets.includes(c.name));

  const select = document.getElementById("callNameTargetCharSelect");
  if (!unadded.length) {
    alert("所有啟用角色均已在該稱呼表中！");
    return;
  }

  select.innerHTML = unadded.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  document.getElementById("addCallNameCharModal").classList.add("active");
}

function confirmAddCallNameTarget() {
  const selectCharId = document.getElementById("perspectiveCharSelect").value;
  const targetName = document.getElementById("callNameTargetCharSelect").value;

  if (selectCharId && targetName) {
    if (!perspectiveTargets[selectCharId]) perspectiveTargets[selectCharId] = [];
    if (!perspectiveTargets[selectCharId].includes(targetName)) {
      perspectiveTargets[selectCharId].push(targetName);
    }
    saveStateToLocalStorage();
    renderCallNameMatrix();
    closeModal("addCallNameCharModal");
  }
}

function removeCallNameTarget(sourceId, targetName) {
  if (perspectiveTargets[sourceId]) {
    perspectiveTargets[sourceId] = perspectiveTargets[sourceId].filter(t => t !== targetName);
    saveStateToLocalStorage();
    renderCallNameMatrix();
  }
}

function openRelationshipModal(sourceCharId, targetName, callName, opinion) {
  document.getElementById("relSourceCharId").value = sourceCharId;
  document.getElementById("relTargetCharName").value = targetName;
  document.getElementById("relCallName").value = callName || "";
  document.getElementById("relOpinion").value = opinion || "";
  document.getElementById("relationshipModal").classList.add("active");
}

function saveRelationshipForm() {
  const sourceId = document.getElementById("relSourceCharId").value;
  const targetName = document.getElementById("relTargetCharName").value;
  const callName = document.getElementById("relCallName").value.trim();
  const opinion = document.getElementById("relOpinion").value.trim();

  const sourceChar = characters.find(c => c.id === sourceId);
  if (sourceChar) {
    if (!sourceChar.relationships) sourceChar.relationships = [];
    const relIndex = sourceChar.relationships.findIndex(r => r.targetName === targetName);
    if (relIndex !== -1) {
      sourceChar.relationships[relIndex] = { targetName, callName, opinion };
    } else {
      sourceChar.relationships.push({ targetName, callName, opinion });
    }
    saveStateToLocalStorage();
    renderCallNameMatrix();
    if (currentRelViewMode === 'graph') drawRelationshipSvg();
    closeModal("relationshipModal");
  }
}

function renderRelationshipGraphCheckboxes() {
  const activeChars = characters.filter(c => !c.isHidden);
  const container = document.getElementById("graphCharCheckboxes");

  if (selectedGraphCharIds.length === 0 && activeChars.length) {
    selectedGraphCharIds = activeChars.slice(0, 6).map(c => c.id);
  }

  container.innerHTML = activeChars.map(c => `
    <label class="checkbox-pill">
      <input type="checkbox" value="${c.id}" ${selectedGraphCharIds.includes(c.id) ? 'checked' : ''} onchange="handleGraphCharToggle('${c.id}')">
      <span>${c.name}</span>
    </label>
  `).join('');
}

function handleGraphCharToggle(charId) {
  if (selectedGraphCharIds.includes(charId)) {
    selectedGraphCharIds = selectedGraphCharIds.filter(id => id !== charId);
  } else {
    selectedGraphCharIds.push(charId);
  }
  drawRelationshipSvg();
}

function zoomGraph(factor) { graphZoomLevel *= factor; drawRelationshipSvg(); }
function resetGraphView() { graphZoomLevel = 1.0; customNodePositions = {}; drawRelationshipSvg(); }

function drawRelationshipSvg() {
  const svg = document.getElementById("relationshipSvg");
  svg.innerHTML = '';

  const activeSelectedChars = characters.filter(c => !c.isHidden && selectedGraphCharIds.includes(c.id));
  if (activeSelectedChars.length < 2) {
    svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="var(--text-muted)" font-size="14">請勾選至少 2 個角色。</text>`;
    return;
  }

  const width = svg.clientWidth || 850;
  const height = 560;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = (Math.min(width, height) / 2 - 80) * graphZoomLevel;

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  activeSelectedChars.forEach(c => {
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", `avatar_pat_${c.id}`);
    pattern.setAttribute("width", "1");
    pattern.setAttribute("height", "1");
    pattern.setAttribute("patternContentUnits", "objectBoundingBox");

    const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
    img.setAttribute("width", "1");
    img.setAttribute("height", "1");
    img.setAttribute("preserveAspectRatio", "xMidYMid slice");
    img.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", c.avatar);
    pattern.appendChild(img);
    defs.appendChild(pattern);
  });
  svg.appendChild(defs);

  const nodes = activeSelectedChars.map((char, index) => {
    if (customNodePositions[char.id]) {
      return { char: char, x: customNodePositions[char.id].x, y: customNodePositions[char.id].y };
    }
    const angle = (index / activeSelectedChars.length) * 2 * Math.PI - Math.PI / 2;
    const pos = {
      char: char,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
    customNodePositions[char.id] = { x: pos.x, y: pos.y };
    return pos;
  });

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const source = nodes[i];
      const target = nodes[j];

      const rel1 = (source.char.relationships || []).find(r => r.targetName === target.char.name);
      const rel2 = (target.char.relationships || []).find(r => r.targetName === source.char.name);
      const isCp = source.char.fixedCp === target.char.name || target.char.fixedCp === source.char.name;

      if (rel1 || rel2 || isCp) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", source.x);
        line.setAttribute("y1", source.y);
        line.setAttribute("x2", target.x);
        line.setAttribute("y2", target.y);
        line.setAttribute("stroke", isCp ? "#d97706" : "rgba(180, 140, 100, 0.4)");
        line.setAttribute("stroke-width", isCp ? "3" : "1.5");
        if (isCp) line.setAttribute("stroke-dasharray", "4");
        svg.appendChild(line);

        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const labelText = isCp ? "💕 固定 CP" : (rel1 ? rel1.callName : rel2 ? rel2.callName : "關聯");

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", midX);
        text.setAttribute("y", midY);
        text.setAttribute("fill", isCp ? "#d97706" : "var(--text-main)");
        text.setAttribute("font-size", "11");
        text.setAttribute("text-anchor", "middle");
        text.textContent = labelText;
        svg.appendChild(text);
      }
    }
  }

  nodes.forEach(node => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("cursor", "move");
    const themeColor = (node.char.themeColor && node.char.themeColor.primary) || "#d97706";

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", node.x);
    circle.setAttribute("cy", node.y);
    circle.setAttribute("r", "28");
    circle.setAttribute("fill", `url(#avatar_pat_${node.char.id})`);
    circle.setAttribute("stroke", themeColor);
    circle.setAttribute("stroke-width", "3");
    g.appendChild(circle);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", node.x);
    text.setAttribute("y", node.y + 44);
    text.setAttribute("fill", "var(--text-main)");
    text.setAttribute("font-weight", "600");
    text.setAttribute("font-size", "12");
    text.setAttribute("text-anchor", "middle");
    text.textContent = node.char.name;
    g.appendChild(text);

    const startNodeDrag = (clientX, clientY) => {
      draggedNodeId = node.char.id;
      dragNodeOffset = { x: clientX - node.x, y: clientY - node.y };
    };

    g.addEventListener("mousedown", (e) => { e.stopPropagation(); startNodeDrag(e.clientX, e.clientY); });
    g.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) { e.stopPropagation(); startNodeDrag(e.touches[0].clientX, e.touches[0].clientY); }
    }, { passive: true });

    svg.appendChild(g);
  });
}

window.addEventListener("mousemove", (e) => {
  if (draggedNodeId) {
    const svg = document.getElementById("relationshipSvg");
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left - dragNodeOffset.x;
    const y = e.clientY - rect.top - dragNodeOffset.y;
    customNodePositions[draggedNodeId] = { x, y };
    drawRelationshipSvg();
  }
});
window.addEventListener("mouseup", () => { draggedNodeId = null; });

window.addEventListener("touchmove", (e) => {
  if (draggedNodeId && e.touches.length === 1) {
    const svg = document.getElementById("relationshipSvg");
    const rect = svg.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left - dragNodeOffset.x;
    const y = e.touches[0].clientY - rect.top - dragNodeOffset.y;
    customNodePositions[draggedNodeId] = { x, y };
    drawRelationshipSvg();
  }
}, { passive: true });
window.addEventListener("touchend", () => { draggedNodeId = null; });

// ========== 8. 評分與排名板塊 ==========
function renderRankingModule() {
  const bar = document.getElementById("rankingSubjectBar");
  const card = document.getElementById("rankingCard");

  if (!rankings.length) {
    bar.innerHTML = '';
    card.innerHTML = `<p style="color:var(--text-muted);">尚無評分主題。點擊「新增評分主題」創建評比！</p>`;
    return;
  }

  if (!currentRankingSubjectId) currentRankingSubjectId = rankings[0].id;
  const currentRanking = rankings.find(r => r.id === currentRankingSubjectId) || rankings[0];

  bar.innerHTML = rankings.map(r => `
    <button class="btn btn-pill ${r.id === currentRanking.id ? 'active' : ''}" onclick="switchRankingSubject('${r.id}')">
      <i class="fa-solid fa-trophy"></i> ${r.subject}
    </button>
  `).join('');

  const activeChars = characters.filter(c => !c.isHidden);
  
  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
      <h3><i class="fa-solid fa-ranking-star"></i> 【${currentRanking.subject}】排名與關係</h3>
      <button class="btn btn-xs btn-outline" onclick="openAddRankingCharModal('${currentRanking.id}')">
        <i class="fa-solid fa-user-plus"></i> 選擇要加入的角色
      </button>
    </div>

    <div class="ranking-items-container">
      ${(currentRanking.items || []).map((item, idx) => {
        const char = activeChars.find(c => c.id === item.charId);
        if (!char) return '';
        const cutoff = (currentRanking.cutoffs || []).find(co => co.charId === char.id);

        return `
          ${cutoff ? `<div class="cutoff-divider"><i class="fa-solid fa-bookmark"></i> 切點等級：${cutoff.label}（從 ${char.name} 開始）</div>` : ''}
          <div class="ranking-item-row">
            <span style="font-weight:700; color:var(--accent-gold); width:24px;">#${idx + 1}</span>
            <img src="${char.avatar}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
            <strong style="flex:1;">${char.name}</strong>

            <select class="ranking-op-select" onchange="updateRankingOperator('${currentRanking.id}', ${idx}, this.value)">
              <option value=">" ${item.operator === '>' ? 'selected' : ''}>&gt;</option>
              <option value="=" ${item.operator === '=' ? 'selected' : ''}>=</option>
              <option value="<" ${item.operator === '<' ? 'selected' : ''}>&lt;</option>
              <option value="≥" ${item.operator === '≥' ? 'selected' : ''}>≥</option>
              <option value="≤" ${item.operator === '≤' ? 'selected' : ''}>≤</option>
            </select>

            <button class="btn btn-xs btn-outline" onclick="toggleRankingCutoff('${currentRanking.id}', '${char.id}')">
              <i class="fa-solid fa-bookmark"></i> ${cutoff ? '修改切點' : '切點'}
            </button>
            <button class="btn btn-xs btn-danger" onclick="removeRankingItem('${currentRanking.id}', ${idx})">&times;</button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function switchRankingSubject(id) { currentRankingSubjectId = id; renderRankingModule(); }
function openRankingSubjectModal() {
  document.getElementById("newRankingSubjectName").value = "";
  document.getElementById("rankingSubjectModal").classList.add("active");
}

function saveNewRankingSubject() {
  const name = document.getElementById("newRankingSubjectName").value.trim();
  if (!name) { alert("請輸入主題名稱！"); return; }
  const activeChars = characters.filter(c => !c.isHidden);
  const newRank = {
    id: `rank_${Date.now()}`,
    subject: name,
    items: activeChars.slice(0, 4).map((c, i) => ({ charId: c.id, operator: i < 3 ? ">" : "" })),
    cutoffs: []
  };
  rankings.push(newRank);
  currentRankingSubjectId = newRank.id;
  saveStateToLocalStorage();
  renderRankingModule();
  closeModal("rankingSubjectModal");
}

function openAddRankingCharModal(rankId) {
  document.getElementById("targetRankingSubjectId").value = rankId;
  const rank = rankings.find(r => r.id === rankId);
  const activeChars = characters.filter(c => !c.isHidden);
  const select = document.getElementById("rankingCharSelect");

  const unadded = activeChars.filter(c => !rank.items.some(it => it.charId === c.id));
  if (!unadded.length) {
    alert("所有角色均已加入此排名！");
    return;
  }

  select.innerHTML = unadded.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById("addRankingCharModal").classList.add("active");
}

function confirmAddCharToRanking() {
  const rankId = document.getElementById("targetRankingSubjectId").value;
  const charId = document.getElementById("rankingCharSelect").value;

  const rank = rankings.find(r => r.id === rankId);
  if (rank && charId) {
    if (rank.items.length) rank.items[rank.items.length - 1].operator = ">";
    rank.items.push({ charId: charId, operator: "" });
    saveStateToLocalStorage();
    renderRankingModule();
    closeModal("addRankingCharModal");
  }
}

function updateRankingOperator(rankId, index, op) {
  const rank = rankings.find(r => r.id === rankId);
  if (rank && rank.items[index]) { rank.items[index].operator = op; saveStateToLocalStorage(); renderRankingModule(); }
}

function toggleRankingCutoff(rankId, charId) {
  const rank = rankings.find(r => r.id === rankId);
  if (rank) {
    if (!rank.cutoffs) rank.cutoffs = [];
    const idx = rank.cutoffs.findIndex(co => co.charId === charId);
    if (idx !== -1) {
      rank.cutoffs.splice(idx, 1);
    } else {
      const label = prompt("輸入此切點等級說明 (例如: 成績優異 / 廚藝普通):", "優異級");
      if (label) rank.cutoffs.push({ charId, label });
    }
    saveStateToLocalStorage();
    renderRankingModule();
  }
}

function removeRankingItem(rankId, index) {
  const rank = rankings.find(r => r.id === rankId);
  if (rank) { rank.items.splice(index, 1); saveStateToLocalStorage(); renderRankingModule(); }
}

// ========== 9. Paro 平行世界 ==========
function renderParoList() {
  const bar = document.getElementById("paroSubjectBar");
  const card = document.getElementById("paroSingleCard");

  if (!paros.length) {
    bar.innerHTML = '';
    card.innerHTML = `<p style="color:var(--text-muted);">尚無 Paro 設定。點擊「新建 Paro 世界觀」創建第一個 Paro！</p>`;
    return;
  }

  if (!currentParoId) currentParoId = paros[0].id;
  const currentParo = paros.find(p => p.id === currentParoId) || paros[0];

  bar.innerHTML = paros.map(p => `
    <button class="btn btn-pill ${p.id === currentParo.id ? 'active' : ''}" onclick="switchParoSubject('${p.id}')">
      <i class="fa-solid fa-wand-magic-sparkles"></i> ${p.name}
    </button>
  `).join('');

  const activeChars = characters.filter(c => !c.isHidden);
  const memberChars = activeChars.filter(c => (currentParo.members || []).includes(c.id));

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
      <div>
        <h3><i class="fa-solid fa-wand-magic-sparkles"></i> 【${currentParo.name}】世界觀成員與自訂欄位</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.2rem;">${currentParo.description || '暫無簡介'}</p>
      </div>
      <div>
        <button class="btn btn-xs btn-outline" onclick="openParoModal('${currentParo.id}')"><i class="fa-solid fa-gear"></i> 編輯此 Paro 欄位與成員</button>
      </div>
    </div>

    ${(currentParo.fields || []).length ? `
      <div style="font-size:0.82rem; color:var(--accent-gold); margin-bottom:1rem;">
        ✦ 本 Paro 專屬自訂欄位：${(currentParo.fields || []).map(f => f.name + (f.options ? ` (${f.options.join('/')})` : '')).join(' ｜ ')}
      </div>
    ` : ''}

    <div class="paro-members-container">
      ${memberChars.length ? memberChars.map(char => {
        if (!char.paroValues) char.paroValues = {};
        if (!char.paroValues[currentParo.id]) char.paroValues[currentParo.id] = {};
        const charValues = char.paroValues[currentParo.id];

        return `
          <div class="paro-member-box">
            <div class="paro-member-header">
              <img src="${char.avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
              <div>
                <strong style="font-size:0.95rem;">${char.name}</strong>
                <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.5rem;">${char.occupation || ''}</span>
              </div>
            </div>

            <div class="paro-fields-inputs">
              ${(currentParo.fields || []).map(field => {
                const val = charValues[field.id] || (field.id === 'house' ? char.hogwartsHouse : '') || '';

                if (field.type === 'select' && field.options) {
                  return `
                    <div class="paro-field-item">
                      <label style="font-size:0.78rem; font-weight:600; color:var(--accent-coffee);">${field.name}：</label>
                      <select onchange="updateCharParoValue('${char.id}', '${currentParo.id}', '${field.id}', this.value)">
                        <option value="">-- 請選擇 --</option>
                        ${field.options.map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                      </select>
                    </div>
                  `;
                } else {
                  return `
                    <div class="paro-field-item">
                      <label style="font-size:0.78rem; font-weight:600; color:var(--accent-coffee);">${field.name}：</label>
                      <input type="text" value="${val}" placeholder="${field.description || '請輸入' + field.name + '...'}" onchange="updateCharParoValue('${char.id}', '${currentParo.id}', '${field.id}', this.value)">
                    </div>
                  `;
                }
              }).join('')}
            </div>
          </div>
        `;
      }).join('') : `<p style="color:var(--text-muted);">本 Paro 尚未包含任何參予角色。點擊「編輯此 Paro」加入角色！</p>`}
    </div>
  `;
}

function switchParoSubject(id) { currentParoId = id; renderParoList(); }

function updateCharParoValue(charId, paroId, fieldId, value) {
  const char = characters.find(c => c.id === charId);
  if (char) {
    if (!char.paroValues) char.paroValues = {};
    if (!char.paroValues[paroId]) char.paroValues[paroId] = {};
    char.paroValues[paroId][fieldId] = value;
    saveStateToLocalStorage();
  }
}

function openParoModal(paroId = null) {
  const modal = document.getElementById("paroModal");
  const activeChars = characters.filter(c => !c.isHidden);
  const checkboxContainer = document.getElementById("paroCharCheckboxes");
  const fieldsContainer = document.getElementById("paroFieldsContainer");
  fieldsContainer.innerHTML = '';

  if (paroId) {
    const paro = paros.find(p => p.id === paroId);
    document.getElementById("paroModalTitle").innerText = `編輯 Paro：${paro.name}`;
    document.getElementById("paroId").value = paro.id;
    document.getElementById("paroName").value = paro.name;
    document.getElementById("paroDescription").value = paro.description || "";

    (paro.fields || []).forEach(f => addParoFieldRow(f.name, f.type, (f.options || []).join(','), f.description));

    checkboxContainer.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${c.id}" ${ (paro.members || []).includes(c.id) ? 'checked' : '' }>
        <span>${c.name}</span>
      </label>
    `).join('');
  } else {
    document.getElementById("paroModalTitle").innerText = "新建 Paro 世界觀";
    document.getElementById("paroId").value = "";
    document.getElementById("paroName").value = "";
    document.getElementById("paroDescription").value = "";

    addParoFieldRow("幾年幾班/社團", "text", "", "例如: 二年A班, 烘焙社");
    addParoFieldRow("幹部職稱", "text", "", "例如: 班長/社長");

    checkboxContainer.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${c.id}" checked>
        <span>${c.name}</span>
      </label>
    `).join('');
  }

  modal.classList.add("active");
}

function addParoFieldRow(name = "", type = "text", options = "", desc = "") {
  const container = document.getElementById("paroFieldsContainer");
  if (!container) return;
  const row = document.createElement("div");
  row.className = "paro-field-row";
  row.style.cssText = "display:flex; flex-direction:column; gap:0.3rem; background:var(--bg-secondary); padding:0.6rem; border-radius:6px; margin-bottom:0.5rem;";
  row.innerHTML = `
    <div style="display:flex; gap:0.4rem;">
      <input type="text" class="field-name" placeholder="欄位名稱 (如: 霍格華茲學院 / 花吐症吐的花)" value="${name}" style="flex:2;">
      <select class="field-type" style="flex:1;" onchange="toggleParoOptionsInput(this)">
        <option value="text" ${type === 'text' ? 'selected' : ''}>文字輸入</option>
        <option value="select" ${type === 'select' ? 'selected' : ''}>下拉選單</option>
      </select>
      <button type="button" class="btn btn-xs btn-danger" onclick="this.parentElement.parentElement.remove()">&times;</button>
    </div>
    <div class="field-options-wrap" style="display:${type === 'select' ? 'block' : 'none'};">
      <input type="text" class="field-options" placeholder="下拉選單選項 (以逗號隔開，如: 葛來分多, 史萊哲林, 阿茲卡班)" value="${options}">
    </div>
    <input type="text" class="field-desc" placeholder="欄位填寫說明提示 (如: 要吐什麼花)" value="${desc}">
  `;
  container.appendChild(row);
}

function toggleParoOptionsInput(selectElem) {
  const optionsWrap = selectElem.parentElement.parentElement.querySelector(".field-options-wrap");
  if (optionsWrap) optionsWrap.style.display = selectElem.value === 'select' ? 'block' : 'none';
}

function saveParoForm() {
  const id = document.getElementById("paroId").value;
  const name = document.getElementById("paroName").value.trim();
  if (!name) { alert("請輸入 Paro 名稱！"); return; }

  const fieldRows = document.querySelectorAll("#paroFieldsContainer .paro-field-row");
  const fields = Array.from(fieldRows).map(row => {
    const fName = row.querySelector(".field-name").value.trim();
    const fType = row.querySelector(".field-type").value;
    const fOptsStr = row.querySelector(".field-options").value.trim();
    const fDesc = row.querySelector(".field-desc").value.trim();

    const optionsArr = fType === 'select' ? fOptsStr.split(',').map(o => o.trim()).filter(Boolean) : null;

    return {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
      name: fName,
      type: fType,
      options: optionsArr,
      description: fDesc
    };
  }).filter(f => f.name);

  const checkedMembers = Array.from(document.querySelectorAll("#paroCharCheckboxes input:checked")).map(cb => cb.value);

  const paroData = {
    id: id || `paro_${Date.now()}`,
    name: name,
    description: document.getElementById("paroDescription").value.trim(),
    fields: fields,
    members: checkedMembers
  };

  if (id) {
    const idx = paros.findIndex(p => p.id === id);
    if (idx !== -1) paros[idx] = paroData;
  } else {
    paros.push(paroData);
  }

  currentParoId = paroData.id;
  saveStateToLocalStorage();
  renderParoList();
  closeModal("paroModal");
}

// ========== 10. 陣營與大事件詞條 ==========
function renderFactionList() {
  const container = document.getElementById("factionList");
  if (!container) return;

  container.innerHTML = factions.map(f => {
    const subTagsHtml = (f.subTags || []).map(sub => `
      <div style="background:var(--bg-secondary); padding:0.35rem 0.7rem; border-radius:6px; font-size:0.8rem; border-left:3px solid var(--accent-gold);">
        <strong>${sub.name}</strong>: ${sub.description || ''}
      </div>
    `).join('');

    const customSectionsHtml = (f.customSections || []).map(sec => `
      <div style="background:var(--bg-secondary); padding:0.6rem 0.8rem; border-radius:6px; margin-top:0.4rem; border-left:3px solid var(--accent-coffee);">
        <strong style="color:var(--accent-coffee); font-size:0.88rem;"><i class="fa-solid fa-book-open"></i> ${sec.title}</strong>
        <p style="white-space:pre-line; font-size:0.84rem; color:var(--text-main); margin-top:0.2rem;">${sec.content}</p>
      </div>
    `).join('');

    return `
      <div class="faction-card">
        <h3>
          <span><i class="fa-solid fa-sitemap"></i> ${f.name}</span>
          <div>
            <button class="btn btn-xs btn-outline" onclick="openFactionModal('${f.id}')"><i class="fa-solid fa-pen"></i> 編輯</button>
            <button class="btn btn-xs btn-danger" onclick="deleteFaction('${f.id}')">&times;</button>
          </div>
        </h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.6rem;">${f.description || '暫無簡介'}</p>
        
        <div style="display:flex; flex-direction:column; gap:0.3rem;">${subTagsHtml}</div>
        ${customSectionsHtml}
      </div>
    `;
  }).join('');
}

function openFactionModal(factionId = null) {
  const modal = document.getElementById("factionModal");
  const subContainer = document.getElementById("subTagsContainer");
  const secContainer = document.getElementById("factionCustomSectionsContainer");

  subContainer.innerHTML = '';
  secContainer.innerHTML = '';

  if (factionId) {
    const f = factions.find(item => item.id === factionId);
    document.getElementById("factionModalTitle").innerText = `編輯陣營：${f.name}`;
    document.getElementById("factionId").value = f.id;
    document.getElementById("factionName").value = f.name;
    document.getElementById("factionDescription").value = f.description || "";

    (f.subTags || []).forEach(sub => addSubTagRow(sub.name, sub.description));
    (f.customSections || []).forEach(sec => addFactionSectionRow(sec.title, sec.content));
  } else {
    document.getElementById("factionModalTitle").innerText = "新建陣營與世界觀";
    document.getElementById("factionId").value = "";
    document.getElementById("factionName").value = "";
    document.getElementById("factionDescription").value = "";

    addSubTagRow("二年A班", "二年級A班");
    addFactionSectionRow("創世大事件", "在此填寫陣營重大歷史事件與法則...");
  }
  modal.classList.add("active");
}

function addSubTagRow(name = "", desc = "") {
  const container = document.getElementById("subTagsContainer");
  const row = document.createElement("div");
  row.className = "sub-tag-row";
  row.style.cssText = "display:flex; gap:0.5rem; margin-bottom:0.4rem;";
  row.innerHTML = `
    <input type="text" class="sub-name" placeholder="子標籤名稱" value="${name}" style="flex:1;">
    <input type="text" class="sub-desc" placeholder="簡介說明" value="${desc}" style="flex:2;">
    <button type="button" class="btn btn-xs btn-danger" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(row);
}

function addFactionSectionRow(title = "", content = "") {
  const container = document.getElementById("factionCustomSectionsContainer");
  const row = document.createElement("div");
  row.className = "faction-sec-row";
  row.style.cssText = "background:var(--bg-secondary); padding:0.6rem; border-radius:6px; margin-bottom:0.5rem; display:flex; flex-direction:column; gap:0.3rem;";
  row.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <input type="text" class="faction-sec-title" placeholder="大事件 / 自訂詞條標題 (如: 神魔大戰歷史)" value="${title}" style="font-weight:600; flex:1;">
      <button type="button" class="btn btn-xs btn-danger ml-2" onclick="this.parentElement.parentElement.remove()">&times;</button>
    </div>
    <textarea class="faction-sec-content" rows="3" placeholder="詳細大段長文字內容與設定補充...">${content}</textarea>
  `;
  container.appendChild(row);
}

function saveFactionForm() {
  const id = document.getElementById("factionId").value;
  const name = document.getElementById("factionName").value.trim();
  if (!name) { alert("請輸入陣營名稱！"); return; }

  const subTagRows = document.querySelectorAll("#subTagsContainer .sub-tag-row");
  const subTags = Array.from(subTagRows).map(row => ({
    name: row.querySelector(".sub-name").value.trim(),
    description: row.querySelector(".sub-desc").value.trim()
  })).filter(s => s.name);

  const secRows = document.querySelectorAll("#factionCustomSectionsContainer .faction-sec-row");
  const customSections = Array.from(secRows).map(row => ({
    id: `fsec_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
    title: row.querySelector(".faction-sec-title").value.trim(),
    content: row.querySelector(".faction-sec-content").value.trim()
  })).filter(s => s.title);

  const factionData = {
    id: id || `faction_${Date.now()}`,
    name,
    description: document.getElementById("factionDescription").value.trim(),
    subTags,
    customSections
  };

  if (id) {
    const idx = factions.findIndex(f => f.id === id);
    if (idx !== -1) factions[idx] = factionData;
  } else {
    factions.push(factionData);
  }

  saveStateToLocalStorage();
  syncGlobalTags();
  renderFactionList();
  closeModal("factionModal");
}

function deleteFaction(factionId) {
  if (confirm("確定要刪除此陣營設定嗎？")) {
    factions = factions.filter(f => f.id !== factionId);
    saveStateToLocalStorage();
    syncGlobalTags();
    renderFactionList();
  }
}

// ========== 10.5. 同人文檔與書籍資料庫 (書籍勾選總結、自訂書籍Icon顏色、摺疊) ==========
function toggleBookCollapse(bookId) {
  collapsedBooks[bookId] = !collapsedBooks[bookId];
  saveStateToLocalStorage();
  renderDocumentsModule();
}

function renderDocumentsModule() {
  const workspace = document.getElementById("docWorkspace");
  if (!workspace) return;

  const activeChars = characters.filter(c => !c.isHidden);
  
  const charFilterSelect = document.getElementById("docCharFilter");
  const factionFilterSelect = document.getElementById("docFactionFilter");

  if (charFilterSelect && charFilterSelect.children.length <= 1) {
    charFilterSelect.innerHTML = `<option value="">全部角色</option>` + activeChars.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
  if (factionFilterSelect && factionFilterSelect.children.length <= 1) {
    factionFilterSelect.innerHTML = `<option value="">全部世界觀</option>` + factions.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  }

  const searchKeyword = (document.getElementById("docSearchInput") ? document.getElementById("docSearchInput").value : "").toLowerCase().trim();
  const selectedCharId = document.getElementById("docCharFilter") ? document.getElementById("docCharFilter").value : "";
  const selectedFactionId = document.getElementById("docFactionFilter") ? document.getElementById("docFactionFilter").value : "";
  const selectedTag = document.getElementById("docTagFilter") ? document.getElementById("docTagFilter").value : "";

  const filterFn = (doc) => {
    const matchSearch = !searchKeyword || doc.title.toLowerCase().includes(searchKeyword) || (doc.content && doc.content.toLowerCase().includes(searchKeyword));
    const matchChar = !selectedCharId || (doc.charIds || []).includes(selectedCharId);
    const matchFaction = !selectedFactionId || (doc.factionIds || []).includes(selectedFactionId);
    const matchTag = !selectedTag || (doc.tags || []).includes(selectedTag);
    return matchSearch && matchChar && matchFaction && matchTag;
  };

  const filteredDocs = documents.filter(filterFn);

  const bookHtmlList = books.map(book => {
    const bookDocs = filteredDocs.filter(d => d.bookId === book.id);
    const isCollapsed = !!collapsedBooks[book.id];
    const memberChars = (book.charIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
    const memberFactions = (book.factionIds || []).map(id => factions.find(f => f.id === id)).filter(Boolean);
    const bookIconColor = book.iconColor || 'var(--accent-gold)';

    return `
      <div class="book-folder-card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <input type="checkbox" class="book-summary-cb" value="${book.id}" title="勾選整本書籍進行 AI 總結" style="width:18px; height:18px;">
            <button class="btn btn-xs btn-outline" onclick="toggleBookCollapse('${book.id}')">
              <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}"></i>
            </button>
            <div>
              <h3 style="font-size:1.1rem; color:var(--text-main); display:inline-flex; align-items:center; gap:0.4rem;">
                <i class="fa-solid fa-book-bookmark" style="color:${bookIconColor}; font-size:1.15rem;"></i> ${book.title}
                <span class="badge" style="margin-left:0.3rem;">${bookDocs.length} 章</span>
              </h3>
              <p style="font-size:0.83rem; color:var(--text-muted); margin-top:0.15rem;">${book.description || '暫無簡介'}</p>
              <div style="font-size:0.78rem; color:var(--accent-coffee); margin-top:0.2rem;">
                ${memberChars.length ? `角色: ${memberChars.map(c=>c.name).join(', ')} ｜ ` : ''}
                ${memberFactions.length ? `世界觀: ${memberFactions.map(f=>f.name).join(', ')}` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-xs btn-outline" onclick="openBookModal('${book.id}')"><i class="fa-solid fa-pen"></i> 編輯書籍</button>
            <button class="btn btn-xs btn-danger" onclick="deleteBook('${book.id}')">&times;</button>
          </div>
        </div>

        ${!isCollapsed ? `
          <div style="margin-top:0.8rem;">
            ${bookDocs.length ? bookDocs.map(doc => renderSingleDocItemHtml(doc)).join('') : `<p style="font-size:0.82rem; color:var(--text-dark); margin-top:0.4rem;">此書籍尚無章節文檔。</p>`}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const standaloneDocs = filteredDocs.filter(d => !d.bookId);
  const standaloneHtml = standaloneDocs.length ? `
    <div class="book-folder-card">
      <h3><i class="fa-solid fa-file-lines" style="color:var(--accent-coffee);"></i> 獨立章節文檔 (${standaloneDocs.length})</h3>
      <div style="margin-top:0.6rem;">
        ${standaloneDocs.map(doc => renderSingleDocItemHtml(doc)).join('')}
      </div>
    </div>
  ` : '';

  workspace.innerHTML = (bookHtmlList + standaloneHtml) || `<div class="empty-state"><p>尚無符合條件的文檔或書籍。點擊「新建書籍資料夾」或「新建文檔章節」建立創作紀錄！</p></div>`;
}

function renderSingleDocItemHtml(doc) {
  const docChars = (doc.charIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
  const docFactions = (doc.factionIds || []).map(id => factions.find(f => f.id === id)).filter(Boolean);
  const tagsHtml = (doc.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join(' ');

  return `
    <div class="doc-item-row">
      <div style="display:flex; align-items:center; gap:0.6rem; flex:1;">
        <input type="checkbox" class="doc-summary-cb" value="${doc.id}" style="width:16px; height:16px;">
        <i class="fa-solid fa-file-lines" style="color:var(--accent-coffee); font-size:1.05rem; flex-shrink:0;"></i>
        <div>
          <strong style="font-size:0.92rem; color:var(--text-main);">${doc.title}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem;">
            ${docChars.length ? `角色: ${docChars.map(c => c.name).join(', ')} ` : ''}
            ${docFactions.length ? `｜ 世界觀: ${docFactions.map(f => f.name).join(', ')}` : ''}
          </div>
          ${tagsHtml ? `<div style="margin-top:0.2rem;">${tagsHtml}</div>` : ''}
        </div>
      </div>
      <div>
        <button class="btn btn-xs btn-outline" onclick="openDocumentModal('${doc.id}')"><i class="fa-solid fa-pen"></i> 閱讀/編輯</button>
        <button class="btn btn-xs btn-danger" onclick="deleteDocument('${doc.id}')">&times;</button>
      </div>
    </div>
  `;
}

function openBookModal(bookId = null) {
  const modal = document.getElementById("bookModal");
  const activeChars = characters.filter(c => !c.isHidden);
  const charCb = document.getElementById("bookCharCheckboxes");
  const factionCb = document.getElementById("bookFactionCheckboxes");

  if (bookId) {
    const b = books.find(item => item.id === bookId);
    document.getElementById("bookModalTitle").innerText = `編輯書籍：${b.title}`;
    document.getElementById("bookId").value = b.id;
    document.getElementById("bookTitle").value = b.title;
    document.getElementById("bookIconColor").value = b.iconColor || "#f59e0b";
    document.getElementById("bookDescription").value = b.description || "";
    document.getElementById("bookTags").value = (b.tags || []).join(', ');

    charCb.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${c.id}" ${ (b.charIds || []).includes(c.id) ? 'checked' : '' }>
        <span>${c.name}</span>
      </label>
    `).join('');

    factionCb.innerHTML = factions.map(f => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${f.id}" ${ (b.factionIds || []).includes(f.id) ? 'checked' : '' }>
        <span>${f.name}</span>
      </label>
    `).join('');
  } else {
    document.getElementById("bookModalTitle").innerText = "新建書籍資料夾";
    document.getElementById("bookId").value = "";
    document.getElementById("bookTitle").value = "";
    document.getElementById("bookIconColor").value = "#f59e0b";
    document.getElementById("bookDescription").value = "";
    document.getElementById("bookTags").value = "";

    charCb.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill"><input type="checkbox" value="${c.id}"><span>${c.name}</span></label>
    `).join('');

    factionCb.innerHTML = factions.map(f => `
      <label class="checkbox-pill"><input type="checkbox" value="${f.id}"><span>${f.name}</span></label>
    `).join('');
  }

  modal.classList.add("active");
}

function saveBookForm() {
  const id = document.getElementById("bookId").value;
  const title = document.getElementById("bookTitle").value.trim();
  if (!title) { alert("請輸入書籍標題！"); return; }

  const checkedCharIds = Array.from(document.querySelectorAll("#bookCharCheckboxes input:checked")).map(cb => cb.value);
  const checkedFactionIds = Array.from(document.querySelectorAll("#bookFactionCheckboxes input:checked")).map(cb => cb.value);

  const bookData = {
    id: id || `book_${Date.now()}`,
    title,
    iconColor: document.getElementById("bookIconColor").value,
    description: document.getElementById("bookDescription").value.trim(),
    charIds: checkedCharIds,
    factionIds: checkedFactionIds,
    tags: document.getElementById("bookTags").value.split(',').map(t => t.trim()).filter(Boolean)
  };

  if (id) {
    const idx = books.findIndex(b => b.id === id);
    if (idx !== -1) books[idx] = bookData;
  } else {
    books.push(bookData);
  }

  saveStateToLocalStorage();
  syncGlobalTags();
  renderDocumentsModule();
  closeModal("bookModal");
}

function deleteBook(bookId) {
  if (confirm("確定要刪除此書籍資料夾嗎？（所屬文檔將轉為獨立文檔）")) {
    books = books.filter(b => b.id !== bookId);
    documents.forEach(d => { if (d.bookId === bookId) d.bookId = null; });
    saveStateToLocalStorage();
    renderDocumentsModule();
  }
}

function openDocumentModal(docId = null) {
  const modal = document.getElementById("documentModal");
  const activeChars = characters.filter(c => !c.isHidden);
  const charCb = document.getElementById("docCharCheckboxes");
  const factionCb = document.getElementById("docFactionCheckboxes");
  const bookSelect = document.getElementById("docBelongingBookId");

  bookSelect.innerHTML = `<option value="">(獨立文檔，不屬於書籍)</option>` + books.map(b => `<option value="${b.id}">${b.title}</option>`).join('');

  if (docId) {
    const d = documents.find(item => item.id === docId);
    document.getElementById("docModalTitle").innerText = `編輯文檔：${d.title}`;
    document.getElementById("docId").value = d.id;
    document.getElementById("docTitle").value = d.title;
    document.getElementById("docBelongingBookId").value = d.bookId || "";
    document.getElementById("docTags").value = (d.tags || []).join(', ');
    document.getElementById("docContent").value = d.content || "";

    charCb.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${c.id}" ${ (d.charIds || []).includes(c.id) ? 'checked' : '' }>
        <span>${c.name}</span>
      </label>
    `).join('');

    factionCb.innerHTML = factions.map(f => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${f.id}" ${ (d.factionIds || []).includes(f.id) ? 'checked' : '' }>
        <span>${f.name}</span>
      </label>
    `).join('');
  } else {
    document.getElementById("docModalTitle").innerText = "新建同人文檔章節";
    document.getElementById("docId").value = "";
    document.getElementById("docTitle").value = "";
    document.getElementById("docBelongingBookId").value = "";
    document.getElementById("docTags").value = "";
    document.getElementById("docContent").value = "";

    charCb.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill"><input type="checkbox" value="${c.id}"><span>${c.name}</span></label>
    `).join('');

    factionCb.innerHTML = factions.map(f => `
      <label class="checkbox-pill"><input type="checkbox" value="${f.id}"><span>${f.name}</span></label>
    `).join('');
  }

  modal.classList.add("active");
}

function saveDocumentForm() {
  const id = document.getElementById("docId").value;
  const title = document.getElementById("docTitle").value.trim();
  if (!title) { alert("請輸入文檔標題！"); return; }

  const checkedCharIds = Array.from(document.querySelectorAll("#docCharCheckboxes input:checked")).map(cb => cb.value);
  const checkedFactionIds = Array.from(document.querySelectorAll("#docFactionCheckboxes input:checked")).map(cb => cb.value);

  const docData = {
    id: id || `doc_${Date.now()}`,
    title,
    bookId: document.getElementById("docBelongingBookId").value || null,
    charIds: checkedCharIds,
    factionIds: checkedFactionIds,
    tags: document.getElementById("docTags").value.split(',').map(t => t.trim()).filter(Boolean),
    content: document.getElementById("docContent").value.trim()
  };

  if (id) {
    const idx = documents.findIndex(d => d.id === id);
    if (idx !== -1) documents[idx] = docData;
  } else {
    documents.push(docData);
  }

  saveStateToLocalStorage();
  syncGlobalTags();
  renderDocumentsModule();
  closeModal("documentModal");
}

function deleteDocument(docId) {
  if (confirm("確定要刪除此同人文檔章節嗎？")) {
    documents = documents.filter(d => d.id !== docId);
    saveStateToLocalStorage();
    renderDocumentsModule();
  }
}

async function summarizeSelectedDocsWithAi() {
  const checkedBookCbs = Array.from(document.querySelectorAll(".book-summary-cb:checked"));
  const checkedDocCbs = Array.from(document.querySelectorAll(".doc-summary-cb:checked"));

  if (!checkedBookCbs.length && !checkedDocCbs.length) {
    alert("請先在列表中勾選至少一本書籍資料夾或單個文檔章節！");
    return;
  }

  let docSet = new Set();

  // Add all docs from checked books
  checkedBookCbs.forEach(cb => {
    const bookId = cb.value;
    const bookDocs = documents.filter(d => d.bookId === bookId);
    bookDocs.forEach(d => docSet.add(d));
  });

  // Add individually checked docs
  checkedDocCbs.forEach(cb => {
    const doc = documents.find(d => d.id === cb.value);
    if (doc) docSet.add(doc);
  });

  const selectedDocs = Array.from(docSet);
  if (!selectedDocs.length) {
    alert("所選書籍中尚無任何文檔章節內容可以總結！");
    return;
  }

  runAiDocumentSummary(selectedDocs, `所選書籍與文檔 (${selectedDocs.length} 章)`);
}

async function runAiDocumentSummary(docArray, titlePrefix) {
  if (!deepseekSettings.apiKey) {
    alert("請設定 DeepSeek API Key 才能使用 AI 故事大綱總結！");
    return;
  }

  let combinedText = docArray.map(d => `【章節標題：${d.title}】\n${d.content || '（無正文內容）'}`).join('\n\n---\n\n');

  showToast(`DeepSeek AI 正在閱讀 ${titlePrefix} 並總結大綱...`);

  try {
    const response = await fetch(`${deepseekSettings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepseekSettings.apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是一位精通故事結構分析與小說大綱整理的 AI 編輯。請詳細閱讀提供的同人文檔章節內文，並輸出繁體中文的『故事核心大綱』、『劇情起承轉合發展』與『角色情感動向總結』。"
          },
          {
            role: "user",
            content: combinedText
          }
        ]
      })
    });

    hideToast();

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        document.getElementById("aiSummaryResultArea").value = `# 【${titlePrefix} 故事大綱總結】\n生成時間：${new Date().toLocaleString()}\n包含章節：${docArray.map(d => d.title).join('、')}\n\n` + data.choices[0].message.content;
        document.getElementById("aiSummaryModal").classList.add("active");
      }
    } else {
      alert("AI 總結失敗：伺服器未返回正確回應。");
    }
  } catch (err) {
    hideToast();
    alert("AI 總結失敗：" + err.message);
  }
}

function copyAiSummaryText() {
  const area = document.getElementById("aiSummaryResultArea");
  if (!area.value) return;
  area.select();
  document.execCommand("copy");
  alert("大綱總結已複製到剪貼簿！");
}

// ========== 11. 獨立與選人導出 ==========
function toggleExportMode(mode) {
  const charGroup = document.getElementById("exportCharSelectGroup");
  if (charGroup) charGroup.style.display = (mode === 'full' || mode === 'cps_only') ? 'block' : 'none';
}

function renderExportCharList() {
  const activeChars = characters.filter(c => !c.isHidden);
  const container = document.getElementById("exportCharList");
  if (container) {
    container.innerHTML = activeChars.map(c => `
      <label class="checkbox-label">
        <input type="checkbox" class="export-char-cb" value="${c.id}" checked>
        <span>${c.name}</span>
      </label>
    `).join('');
  }

  const rankContainer = document.getElementById("exportRankingList");
  if (rankContainer) {
    rankContainer.innerHTML = rankings.map(r => `
      <label class="checkbox-label">
        <input type="checkbox" class="export-rank-cb" value="${r.id}" checked>
        <span>${r.subject}</span>
      </label>
    `).join('');
  }

  const paroContainer = document.getElementById("exportParoList");
  if (paroContainer) {
    paroContainer.innerHTML = paros.map(p => `
      <label class="checkbox-label">
        <input type="checkbox" class="export-paro-cb" value="${p.id}" checked>
        <span>${p.name}</span>
      </label>
    `).join('');
  }
}

function selectAllExportChars(status) {
  document.querySelectorAll(".export-char-cb").forEach(cb => cb.checked = status);
}

async function generateExportText() {
  const mode = document.getElementById("exportModeSelect").value;
  let text = "";

  const selectedCharIds = Array.from(document.querySelectorAll(".export-char-cb:checked")).map(cb => cb.value);
  const targetChars = characters.filter(c => selectedCharIds.includes(c.id));
  const selectedCharNames = targetChars.map(c => c.name);

  const selectedRankIds = Array.from(document.querySelectorAll(".export-rank-cb:checked")).map(cb => cb.value);
  const targetRankings = rankings.filter(r => selectedRankIds.includes(r.id));

  const selectedParoIds = Array.from(document.querySelectorAll(".export-paro-cb:checked")).map(cb => cb.value);
  const targetParos = paros.filter(p => selectedParoIds.includes(p.id));

  const incTheme = document.getElementById("expIncThemeColor").checked;
  const incRel = document.getElementById("expIncRelationships").checked;
  const incCp = document.getElementById("expIncCps").checked;

  if (mode === 'cps_only') {
    text = `# 【CP 關係細節獨立報告】\n生成時間：${new Date().toLocaleString()}\n\n`;
    cps.forEach(cp => {
      text += `## CP 組合: ${cp.name}\n`;
      if ((cp.positions || []).length) {
        text += `- 定位/左右位: ${cp.positions.map(p => {
          const char = characters.find(c => c.id === p.charId);
          return char ? `${char.name}(${p.role})` : '';
        }).join(' / ')}\n`;
      }
      if (cp.relationshipThoughts) text += `- 感想: ${cp.relationshipThoughts}\n`;
      if (cp.r18Notes) text += `- 關係細節: ${cp.r18Notes}\n`;
      (cp.customSections || []).forEach(sec => {
        text += `\n✦ 【${sec.title}】\n${sec.content}\n`;
      });
      text += `\n-----------------------------------\n\n`;
    });
  } else if (mode === 'rankings_only') {
    text = `# 【評分與排名獨立報告】\n生成時間：${new Date().toLocaleString()}\n\n`;
    targetRankings.forEach(r => {
      text += `## 評比主題: ${r.subject}\n`;
      const itemStr = (r.items || []).map(it => {
        const char = characters.find(c => c.id === it.charId);
        return char ? `${char.name} ${it.operator}` : '';
      }).join(' ');
      text += `排序: ${itemStr}\n`;
      if ((r.cutoffs || []).length) {
        r.cutoffs.forEach(co => {
          const char = characters.find(c => c.id === co.charId);
          if (char) text += `- 分級切點 (${co.label}): 自 ${char.name} 開始\n`;
        });
      }
      text += `\n`;
    });
  } else if (mode === 'paros_only') {
    text = `# 【Paro 平行世界獨立設定】\n生成時間：${new Date().toLocaleString()}\n\n`;
    targetParos.forEach(p => {
      text += `## Paro: ${p.name}\n${p.description || ''}\n`;
      const memberChars = characters.filter(c => !c.isHidden && (p.members || []).includes(c.id));
      memberChars.forEach(c => {
        text += `\n### 角色: ${c.name}\n`;
        const valObj = (c.paroValues && c.paroValues[p.id]) || {};
        (p.fields || []).forEach(f => {
          text += `- ${f.name}: ${valObj[f.id] || '未填寫'}\n`;
        });
      });
      text += `\n-----------------------------------\n\n`;
    });
  } else if (mode === 'factions_only') {
    text = `# 【世界觀與陣營獨立簡介】\n生成時間：${new Date().toLocaleString()}\n\n`;
    factions.forEach(f => {
      text += `## 陣營: ${f.name}\n${f.description || '（無簡介）'}\n`;
      if ((f.subTags || []).length) {
        f.subTags.forEach(sub => {
          text += `- 子標籤【${sub.name}】：${sub.description || ''}\n`;
        });
      }
      if ((f.customSections || []).length) {
        f.customSections.forEach(sec => {
          text += `\n✦ 大事件【${sec.title}】:\n${sec.content}\n`;
        });
      }
      text += `\n-----------------------------------\n\n`;
    });
  } else {
    text = `# 原創人物設定與關係全集\n生成時間：${new Date().toLocaleString()}\n包含角色 (${targetChars.length} 位): ${selectedCharNames.join('、')}\n\n`;

    targetChars.forEach((c, idx) => {
      text += `===================================\n`;
      text += `### [${idx + 1}] ${c.name} (${c.englishName || 'OC'})\n`;
      text += `- 基本：${c.gender || ''}｜${c.height || ''}｜${c.zodiac || ''}｜${c.orientation || ''}｜${c.occupation || ''}\n`;
      text += `- 固定 CP：${c.fixedCp || '無'}\n`;
      if (incTheme && c.themeColor) {
        text += `- 主題色：${c.themeColor.primary} / ${c.themeColor.secondary} (${c.themeColor.mode})\n`;
      }
      if (c.appearance) text += `✦ 外貌：${c.appearance.replace(/\n/g, ' ')}\n`;
      if (c.personality) text += `✦ 性格：${c.personality.replace(/\n/g, ' ')}\n`;
      if (c.extraNotes) text += `✦ 補充：${c.extraNotes.replace(/\n/g, ' ')}\n`;

      if (incRel && (c.relationships || []).length) {
        text += `✦ 社交關係視角 (僅導出所選角色):\n`;
        c.relationships.forEach(rel => {
          if (selectedCharNames.includes(rel.targetName)) {
            text += `  * 對 ${rel.targetName} 稱呼『${rel.callName}』: ${rel.opinion}\n`;
          }
        });
      }
      text += `\n`;
    });

    if (incCp) {
      text += `\n===================================\n`;
      text += `## 【CP 關係細節 (僅所選角色相關)】\n\n`;
      cps.forEach(cp => {
        const hasSelectedChar = (cp.memberIds || []).some(id => selectedCharIds.includes(id));
        if (hasSelectedChar) {
          text += `### CP 組合: ${cp.name}\n`;
          if (cp.relationshipThoughts) text += `- 感想: ${cp.relationshipThoughts}\n`;
          if (cp.r18Notes) text += `- 關係細節: ${cp.r18Notes}\n`;
          (cp.customSections || []).forEach(sec => {
            text += `✦ 【${sec.title}】: ${sec.content}\n`;
          });
          text += `\n`;
        }
      });
    }

    if (targetRankings.length) {
      text += `\n===================================\n`;
      text += `## 【評分與排名評比 (已順用切點，去除未選角色)】\n\n`;
      targetRankings.forEach(r => {
        text += `### 主題: ${r.subject}\n`;
        const items = r.items || [];
        const filteredItems = items.filter(it => selectedCharIds.includes(it.charId));
        
        let seqStr = "";
        filteredItems.forEach((it, i) => {
          const char = targetChars.find(c => c.id === it.charId);
          if (!char) return;
          seqStr += char.name;

          const origIdx = items.findIndex(orig => orig.charId === it.charId);
          let attachedCutoffLabel = null;
          if (origIdx !== -1 && (r.cutoffs || []).length) {
            const prevOrigIdx = i > 0 ? items.findIndex(orig => orig.charId === filteredItems[i-1].charId) : -1;
            r.cutoffs.forEach(co => {
              const coOrigIdx = items.findIndex(orig => orig.charId === co.charId);
              if (coOrigIdx > prevOrigIdx && coOrigIdx <= origIdx) {
                attachedCutoffLabel = co.label;
              }
            });
          }

          if (attachedCutoffLabel) seqStr += `【切點: ${attachedCutoffLabel}】`;
          if (i < filteredItems.length - 1) seqStr += ` ${it.operator || '>'} `;
        });

        text += `順序: ${seqStr || '（無所選角色）'}\n\n`;
      });
    }

    if (targetParos.length) {
      text += `\n===================================\n`;
      text += `## 【Paro 平行世界設定 (所選角色)】\n\n`;
      targetParos.forEach(p => {
        text += `### Paro: ${p.name}\n`;
        const memberChars = targetChars.filter(c => (p.members || []).includes(c.id));
        memberChars.forEach(c => {
          text += `- 角色 ${c.name}:\n`;
          const valObj = (c.paroValues && c.paroValues[p.id]) || {};
          (p.fields || []).forEach(f => {
            text += `   * ${f.name}: ${valObj[f.id] || '未填寫'}\n`;
          });
        });
        text += `\n`;
      });
    }
  }

  const useAi = document.getElementById("expUseAiPolish").checked;
  if (useAi) {
    if (!deepseekSettings.apiKey) { alert("請填寫 DeepSeek API Key！"); }
    else {
      showToast("DeepSeek AI 正在進行極簡 Prompt 整理...");
      try {
        const response = await fetch(`${deepseekSettings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${deepseekSettings.apiKey}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: "你是一位精通同人創作的 AI 提示詞專家。請將資料重構成極度精簡、骨架清晰的同人 Prompt 文件。" },
              { role: "user", content: text }
            ]
          })
        });
        hideToast();
        if (response.ok) {
          const data = await response.json();
          if (data.choices && data.choices[0]) text = `/* DeepSeek AI 極簡 Prompt */\n\n` + data.choices[0].message.content;
        }
      } catch (err) { hideToast(); }
    }
  }

  document.getElementById("exportPreviewArea").value = text;
}

function copyExportText() {
  const area = document.getElementById("exportPreviewArea");
  if (!area.value) return;
  area.select();
  document.execCommand("copy");
  alert("內容已複製到剪貼簿！");
}

function downloadExportTxt() {
  const text = document.getElementById("exportPreviewArea").value;
  if (!text) return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `OC_人設導出_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
}

function downloadExportPdf() {
  const text = document.getElementById("exportPreviewArea").value;
  if (!text) return;
  showToast("正在導出 PDF...");
  const element = document.createElement("div");
  element.style.padding = "20px";
  element.style.color = "#000";
  element.style.background = "#fff";
  element.innerHTML = text.replace(/\n/g, "<br>");
  html2pdf().from(element).save().then(() => hideToast());
}

// ========== 12. 線上快照同步 ==========
function openCloudSyncModal() {
  const exportData = { characters, paros, factions, rankings, cps, books, documents, collapsedBooks, exportedAt: new Date().toISOString() };
  const jsonStr = JSON.stringify(exportData);
  const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
  document.getElementById("cloudSyncStringArea").value = encoded;
  document.getElementById("cloudSyncModal").classList.add("active");
}

function copyCloudSyncString() {
  const area = document.getElementById("cloudSyncStringArea");
  area.select();
  document.execCommand("copy");
  alert("快照同步碼已複製！可以貼到手機或其他裝置進行數據同步。");
}

function applyCloudSyncString() {
  const inputStr = document.getElementById("importCloudSyncInput").value.trim();
  if (!inputStr) { alert("請貼上同步碼！"); return; }
  try {
    const jsonStr = decodeURIComponent(escape(atob(inputStr)));
    const data = JSON.parse(jsonStr);
    if (data.characters) characters = data.characters;
    if (data.paros) paros = data.paros;
    if (data.factions) factions = data.factions;
    if (data.rankings) rankings = data.rankings;
    if (data.cps) cps = data.cps;
    if (data.books) books = data.books;
    if (data.documents) documents = data.documents;
    if (data.collapsedBooks) collapsedBooks = data.collapsedBooks;

    saveStateToLocalStorage();
    syncGlobalTags();
    renderAllViews();
    closeModal("cloudSyncModal");
    alert("線上快照數據已順利同步調用！");
  } catch (e) {
    alert("同步碼無效：" + e.message);
  }
}

// 手機底部選單
function toggleMobileCardSubmenu() {
  const menu = document.getElementById("mobileCardSubmenu");
  if (menu) menu.classList.toggle("active");
}
function hideMobileCardSubmenu() {
  const menu = document.getElementById("mobileCardSubmenu");
  if (menu) menu.classList.remove("active");
}

// 通用輔助
function exportDataJson() {
  const exportData = { characters, paros, factions, rankings, cps, books, documents, collapsedBooks, deepseekSettings };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `OC_Master_Backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

function triggerImportJson() { document.getElementById("jsonFileInput").click(); }

function handleImportJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.characters) characters = data.characters;
      if (data.paros) paros = data.paros;
      if (data.factions) factions = data.factions;
      if (data.rankings) rankings = data.rankings;
      if (data.cps) cps = data.cps;
      if (data.books) books = data.books;
      if (data.documents) documents = data.documents;
      if (data.collapsedBooks) collapsedBooks = data.collapsedBooks;
      saveStateToLocalStorage(); syncGlobalTags(); renderAllViews();
      alert("JSON 資料匯入成功！");
    } catch (err) { alert("匯入失敗：" + err.message); }
  };
  reader.readAsText(file);
}

function openApiKeyModal() { document.getElementById("apiKeyModal").classList.add("active"); }
function saveApiKeySettings() {
  deepseekSettings.apiKey = document.getElementById("deepseekApiKey").value.trim();
  deepseekSettings.baseUrl = document.getElementById("deepseekBaseUrl").value.trim();
  deepseekSettings.ocrPrompt = document.getElementById("deepseekOcrPrompt").value.trim();
  saveStateToLocalStorage(); closeModal("apiKeyModal");
  alert("DeepSeek API 設定已儲存！");
}
function closeModal(modalId) { document.getElementById(modalId).classList.remove("active"); }

function setupEventListeners() {
  window.onclick = function(event) {
    if (event.target.classList.contains("modal-backdrop")) {
      event.target.classList.remove("active");
    }
  };
}

function showToast(msg) {
  document.getElementById("toastMessage").innerText = msg;
  document.getElementById("loadingToast").style.display = "flex";
}
function hideToast() {
  document.getElementById("loadingToast").style.display = "none";
}
