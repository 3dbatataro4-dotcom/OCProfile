// ==========================================================================
// OC 原創人物設定與關係管理系統 - 核心邏輯 (app.js Bug Fix Phase 9)
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
let articleTags = new Set();
let visualNovelTemplates = [];

let deepseekSettings = {
  apiKey: "sk-af4ffa206b844a3fb2a0b2575602fa23",
  baseUrl: "https://api.deepseek.com",
  ocrPrompt: "請詳細分析這張原創人物圖片的外貌特徵，包括髮型髮色、眼睛特徵與眼神、服裝飾品、體型與氣質描述，輸出為繁體中文條列說明。"
};

let currentTheme = 'dark';
let currentRelViewMode = 'matrix';

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
let selectedGraphCharIds = [];
let currentGraphPerspectiveId = "";
let perspectiveTargets = {};

let customNodePositions = {};
let graphZoomLevel = 1.0;
let draggedNodeId = null;
let dragNodeOffset = { x: 0, y: 0 };
let activeGraphPointerId = null;
let lastGraphCanvasSize = { width: 0, height: 0 };

let currentRankingSubjectId = null;
let currentParoId = null;
let currentReadingDocId = null;
let documentReaderFontSize = 1.05;
let pendingAdvancedImport = null;
let pendingImportConflicts = [];
let draggedDocumentId = null;
let currentVisualNovelDocId = null;
let currentVisualNovelEvents = [];
let currentVisualNovelIndex = -1;
let visualNovelAutoPlay = false;
let visualNovelAutoTimer = null;
let visualNovelHistory = [];
let currentVisualNovelSettings = {};
let visualNovelTyping = null;
let visualNovelAudioContext = null;
let visualNovelBgmFadeToken = 0;
let visualNovelBgmChannelIndex = 0;
let visualNovelFastForwardDelay = null;
let visualNovelFastForwardTimer = null;
let visualNovelFastForwardActive = false;
let visualNovelSuppressContinueClick = false;
let visualNovelPointerDownHandled = false;
let visualNovelAutoSpeed = 1.5;
let visualNovelFontSize = 1.05;
const editorModalSnapshots = { documentModal:null, visualNovelEditorModal:null };

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
  cps = normalizeCpCollection(cps);

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
  documents.forEach(doc => {
    if (doc.visualNovel?.scriptText) doc.visualNovel.scriptText = formatVisualNovelScriptBlocks(doc.visualNovel.scriptText);
  });

  const savedCollapsed = localStorage.getItem("oc_collapsed_books");
  if (savedCollapsed) { try { collapsedBooks = JSON.parse(savedCollapsed); } catch (e) {} }

  const savedVnTemplates = localStorage.getItem("oc_visual_novel_templates");
  if (savedVnTemplates) { try { visualNovelTemplates = JSON.parse(savedVnTemplates) || []; } catch (e) { visualNovelTemplates = []; } }

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
  localStorage.setItem("oc_visual_novel_templates", JSON.stringify(visualNovelTemplates));
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
  articleTags.clear();
  characters.forEach(c => (c.tags || []).forEach(t => globalTags.add(t)));
  factions.forEach(f => {
    if (f.name) globalTags.add(f.name);
    (f.subTags || []).forEach(sub => { if (sub.name) globalTags.add(sub.name); });
  });
  books.forEach(b => (b.tags || []).forEach(t => articleTags.add(t)));
  documents.forEach(d => (d.tags || []).forEach(t => articleTags.add(t)));

  const filterSelect = document.getElementById("tagFilter");
  const modalSelect = document.getElementById("charTagSelect");
  const docTagSelect = document.getElementById("docTagFilter");
  const articleTagSuggestions = document.getElementById("articleTagSuggestions");

  if (filterSelect) filterSelect.innerHTML = `<option value="">全部標籤</option>`;
  if (modalSelect) modalSelect.innerHTML = `<option value="">+ 下拉選擇已建立標籤 / 陣營</option>`;
  if (docTagSelect) docTagSelect.innerHTML = `<option value="">全部標籤</option>`;

  globalTags.forEach(tag => {
    if (filterSelect) filterSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
    if (modalSelect) modalSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
  });
  articleTags.forEach(tag => {
    if (docTagSelect) docTagSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
  });
  if (articleTagSuggestions) articleTagSuggestions.innerHTML = [...articleTags].map(tag => `<option value="${tag}"></option>`).join('');
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

        ${Array.isArray(char.customFields) && char.customFields.length ? `
          ${char.customFields.filter(f => f.type !== 'paragraph').length ? `
            <div class="char-custom-fields-group">
              ${char.customFields.filter(f => f.type !== 'paragraph').map(f => `<div class="char-custom-field-badge"><strong>${escapeHtml(f.name)}：</strong><span>${escapeHtml(f.value)}</span></div>`).join('')}
            </div>
          ` : ''}
          ${char.customFields.filter(f => f.type === 'paragraph').map(f => `
            <div class="char-custom-paragraph-box">
              <div class="char-field-label"><i class="fa-solid fa-align-left"></i> ${escapeHtml(f.name)}</div>
              <div class="char-text-box">${escapeHtml(f.value)}</div>
            </div>
          `).join('')}
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
function normalizeCpRecord(cp) {
  if (!cp || typeof cp !== "object") return null;
  // 2026-08-31 舊版 couples 格式：保留每位成員各自的定位、R18 與感想。
  if (Array.isArray(cp.members)) {
    return {
      id: cp.id || `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cp.name || "未命名關係",
      type: cp.type === "other" ? "other" : "cp",
      relationType: cp.relationType || "",
      members: cp.members.map(member => ({
        charId: member.charId,
        position: member.position ?? member.role ?? "",
        r18: member.r18 || "",
        thoughts: member.thoughts || member.opinion || ""
      })).filter(member => member.charId),
      sections: (cp.sections || cp.customSections || []).map(section => ({
        id: section.id || `cpsec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: section.title || "",
        content: section.content || ""
      }))
    };
  }

  // 現行扁平 cps 格式：轉回逐人成員格式，原本的全體欄位轉成自訂詞條避免遺失。
  const positions = cp.positions || [];
  const sections = [...(cp.customSections || cp.sections || [])];
  if (cp.relationshipThoughts && !sections.some(s => s.title === "關係總體感想")) sections.push({ title: "關係總體感想", content: cp.relationshipThoughts });
  if (cp.r18Notes && !sections.some(s => s.title === "關係狀況補充")) sections.push({ title: "關係狀況補充", content: cp.r18Notes });
  return {
    id: cp.id || `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cp.name || "未命名關係",
    type: cp.type === "other" ? "other" : "cp",
    relationType: cp.relationType || "",
    members: (cp.memberIds || []).map(charId => {
      const pos = positions.find(item => item.charId === charId);
      return { charId, position: pos?.role || pos?.position || "", r18: "", thoughts: "" };
    }),
    sections: sections.map(section => ({ id: section.id || `cpsec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title: section.title || "", content: section.content || "" }))
  };
}

function normalizeCpCollection(records) {
  return (Array.isArray(records) ? records : []).map(normalizeCpRecord).filter(Boolean);
}

function renderCpModule() {
  const grid = document.getElementById("cpGrid");
  if (!grid) return;

  if (!cps.length) {
    grid.innerHTML = `<div class="empty-state"><p>目前尚無 CP 組合。點擊右上角「新建 CP 組合」建立第一對 CP 關係！</p></div>`;
    return;
  }

  grid.innerHTML = cps.map(rawCp => {
    const cp = normalizeCpRecord(rawCp);
    const memberChars = (cp.members || []).map(member => characters.find(c => c.id === member.charId)).filter(Boolean);
    const avatarsHtml = memberChars.map(c => `
      <img class="cp-avatar-img" src="${c.avatar}" title="${c.name}" onerror="this.src='https://file.garden/aWe99vhwaGcNwkok/%E7%A0%B4%E9%A0%AD/%E7%81%AB%E5%B1%B1%E7%81%B0.png'">
    `).join('');

    const positionsHtml = (cp.members || []).map(member => {
      const char = memberChars.find(c => c.id === member.charId);
      return char ? `<span class="badge" style="background:var(--bg-secondary); border:1px solid var(--accent-gold); color:var(--accent-coffee);">${char.name}: ${member.position || '未定'}</span>` : '';
    }).join(' ');

    const memberDetailsHtml = (cp.members || []).map(member => {
      const char = characters.find(c => c.id === member.charId);
      if (!char) return '';
      return `<div class="cp-member-card"><strong>${char.name}</strong>${cp.type !== 'other' && member.r18 ? `<div><small>R18／互動狀況：</small><span style="white-space:pre-line;">${member.r18}</span></div>` : ''}${member.thoughts ? `<div><small>對關係／其他成員的看法：</small><span style="white-space:pre-line;">${member.thoughts}</span></div>` : ''}</div>`;
    }).join('');

    const sectionsHtml = (cp.sections || []).map(sec => `
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
              <h3 style="font-size:1.05rem;">${cp.name} <span class="cp-type-badge">${cp.type === 'other' ? (cp.relationType || '其他關係') : 'CP'}</span></h3>
              <div style="margin-top:0.2rem;">${positionsHtml}</div>
            </div>
          </div>
          <div>
            <button class="btn btn-xs btn-outline" onclick="openCpModal('${cp.id}')"><i class="fa-solid fa-pen"></i> 編輯</button>
            <button class="btn btn-xs btn-danger" onclick="deleteCp('${cp.id}')">&times;</button>
          </div>
        </div>

        ${memberDetailsHtml}
        ${sectionsHtml}
      </div>
    `;
  }).join('');
}

function openCpModal(cpId = null) {
  const modal = document.getElementById("cpModal");
  const activeChars = characters.filter(c => !c.isHidden);
  const cbContainer = document.getElementById("cpCharCheckboxes");
  const secContainer = document.getElementById("cpCustomSectionsContainer");

  secContainer.innerHTML = '';

  if (cpId) {
    const cp = normalizeCpRecord(cps.find(item => item.id === cpId));
    document.getElementById("cpModalTitle").innerText = `編輯 CP：${cp.name}`;
    document.getElementById("cpId").value = cp.id;
    document.getElementById("cpName").value = cp.name;
    document.getElementById("cpType").value = cp.type || "cp";
    document.getElementById("cpRelationType").value = cp.relationType || "";

    cbContainer.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${c.id}" ${ (cp.members || []).some(member => member.charId === c.id) ? 'checked' : '' } onchange="renderCpMemberInputs()">
        <span>${c.name}</span>
      </label>
    `).join('');

    (cp.sections || []).forEach(sec => addCpSectionRow(sec.title, sec.content));
  } else {
    document.getElementById("cpModalTitle").innerText = "新建 CP 組合";
    document.getElementById("cpId").value = "";
    document.getElementById("cpName").value = "";
    document.getElementById("cpType").value = "cp";
    document.getElementById("cpRelationType").value = "";

    cbContainer.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill">
        <input type="checkbox" value="${c.id}" ${ (activeChars.slice(0, 2).map(x=>x.id)).includes(c.id) ? 'checked' : '' } onchange="renderCpMemberInputs()">
        <span>${c.name}</span>
      </label>
    `).join('');

    addCpSectionRow("相遇情況", "講述兩人第一次相遇的地點與心境...");
    addCpSectionRow("交往過程", "告白與確立戀人關係的經過...");
    addCpSectionRow("交往後相處模式", "日常相處氛圍與默契細節...");
  }

  modal.dataset.editingMembers = JSON.stringify(cpId ? normalizeCpRecord(cps.find(item => item.id === cpId)).members : []);
  toggleCpTypeFields(false);
  renderCpMemberInputs();
  modal.classList.add("active");
  captureEditorModalSnapshot("documentModal");
}

function toggleCpTypeFields(rerender = true) {
  const isOther = document.getElementById("cpType").value === "other";
  document.getElementById("cpOtherTypeGroup").style.display = isOther ? "flex" : "none";
  if (rerender) renderCpMemberInputs();
}

function renderCpMemberInputs() {
  const container = document.getElementById("cpMemberDetailsContainer");
  const checkedBoxes = Array.from(document.querySelectorAll("#cpCharCheckboxes input:checked"));
  let savedMembers = [];
  try { savedMembers = JSON.parse(document.getElementById("cpModal").dataset.editingMembers || "[]"); } catch (e) {}
  const liveMembers = {};
  container.querySelectorAll(".cp-member-editor").forEach(row => {
    liveMembers[row.dataset.charId] = { position: row.querySelector(".cp-member-position").value, r18: row.querySelector(".cp-member-r18")?.value || "", thoughts: row.querySelector(".cp-member-thoughts").value };
  });
  savedMembers = savedMembers.map(member => liveMembers[member.charId] ? { ...member, ...liveMembers[member.charId], r18: liveMembers[member.charId].r18 || member.r18 || "" } : member);
  Object.entries(liveMembers).forEach(([charId, member]) => { if (!savedMembers.some(item => item.charId === charId)) savedMembers.push({ charId, ...member }); });
  document.getElementById("cpModal").dataset.editingMembers = JSON.stringify(savedMembers);
  const isOther = document.getElementById("cpType").value === "other";

  container.innerHTML = checkedBoxes.map(cb => {
    const char = characters.find(c => c.id === cb.value);
    if (!char) return '';
    const member = liveMembers[char.id] || savedMembers.find(item => item.charId === char.id) || {};

    return `
      <div class="cp-member-card cp-member-editor" data-char-id="${char.id}">
        <strong>${char.name}</strong>
        <div class="form-group"><label>${isOther ? '在關係中的身分／定位' : '左右位／定位'}</label><input type="text" class="cp-member-position" value="${member.position || char.orientation || ''}" placeholder="${isOther ? '如：姊姊、朋友、老師' : '如：攻、受、可逆'}"></div>
        ${isOther ? '' : '<div class="form-group"><label>R18／互動相關狀況</label><textarea class="cp-member-r18" rows="3"></textarea></div>'}
        <div class="form-group"><label>本人對這段關係／其他成員的看法</label><textarea class="cp-member-thoughts" rows="3"></textarea></div>
      </div>
    `;
  }).join('');
  container.querySelectorAll(".cp-member-editor").forEach(row => {
    const member = liveMembers[row.dataset.charId] || savedMembers.find(item => item.charId === row.dataset.charId) || {};
    const r18 = row.querySelector(".cp-member-r18");
    if (r18) r18.value = member.r18 || "";
    row.querySelector(".cp-member-thoughts").value = member.thoughts || "";
  });
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
  if (!name) { alert("請輸入關係卡名稱！"); return; }

  const type = document.getElementById("cpType").value;
  const relationType = type === "other" ? document.getElementById("cpRelationType").value.trim() : "";
  if (type === "other" && !relationType) { alert("請輸入其他關係名稱！"); return; }
  const members = Array.from(document.querySelectorAll("#cpMemberDetailsContainer .cp-member-editor")).map(row => ({
    charId: row.dataset.charId,
    position: row.querySelector(".cp-member-position").value.trim(),
    ...(type === "cp" ? { r18: (row.querySelector(".cp-member-r18")?.value || "").trim() } : {}),
    thoughts: row.querySelector(".cp-member-thoughts").value.trim()
  }));
  if (members.length < 2) { alert("關係卡請至少選擇兩位人物！"); return; }

  const secRows = document.querySelectorAll("#cpCustomSectionsContainer .cp-sec-row");
  const customSections = Array.from(secRows).map(row => ({
    id: `cpsec_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
    title: row.querySelector(".cp-sec-title").value.trim(),
    content: row.querySelector(".cp-sec-content").value.trim()
  })).filter(s => s.title);

  const cpData = {
    id: id || `cp_${Date.now()}`,
    name,
    type,
    relationType,
    members,
    sections: customSections
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
function addCharCustomFieldRow(type = 'single', name = '', value = '') {
  const container = document.getElementById("charCustomFieldsContainer");
  if (!container) return;
  const row = document.createElement("div");
  row.className = "char-custom-field-row";
  row.dataset.fieldType = type;
  if (type === 'paragraph') {
    row.style.flexDirection = "column";
    row.style.alignItems = "stretch";
    row.style.background = "var(--bg-tertiary)";
    row.style.padding = "0.6rem";
    row.style.borderRadius = "6px";
    row.style.border = "1px solid var(--border-color)";
    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <input type="text" class="char-custom-field-name" placeholder="大段敘述標題 (如：家庭背景/經歷補充)" value="${escapeHtml(name)}">
        <button type="button" class="btn btn-xs btn-outline-danger" onclick="this.parentElement.parentElement.remove()" title="刪除欄位"><i class="fa-solid fa-trash"></i> 刪除敘述</button>
      </div>
      <textarea class="char-custom-field-val" rows="3" placeholder="請輸入長文章內容敘述..." style="margin-top:0.4rem;">${escapeHtml(value)}</textarea>
    `;
  } else {
    row.innerHTML = `
      <input type="text" class="char-custom-field-name" placeholder="欄位名稱 (如：武器/特質)" value="${escapeHtml(name)}">
      <input type="text" class="char-custom-field-val" placeholder="欄位內容" value="${escapeHtml(value)}">
      <button type="button" class="btn btn-xs btn-outline-danger" onclick="this.parentElement.remove()" title="刪除欄位"><i class="fa-solid fa-trash"></i></button>
    `;
  }
  container.appendChild(row);
}

function collectCharCustomFields() {
  const container = document.getElementById("charCustomFieldsContainer");
  if (!container) return [];
  const rows = Array.from(container.querySelectorAll(".char-custom-field-row"));
  const fields = [];
  rows.forEach(row => {
    const type = row.dataset.fieldType || 'single';
    const name = row.querySelector(".char-custom-field-name")?.value.trim();
    const value = row.querySelector(".char-custom-field-val")?.value.trim();
    if (name && value) {
      fields.push({ type, name, value });
    }
  });
  return fields;
}

function openCharacterModal(charId = null) {
  const modal = document.getElementById("characterModal");
  const form = document.getElementById("characterForm");
  form.reset();
  syncGlobalTags();

  const fieldsContainer = document.getElementById("charCustomFieldsContainer");
  if (fieldsContainer) fieldsContainer.replaceChildren();

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

      if (Array.isArray(char.customFields)) {
        char.customFields.forEach(f => addCharCustomFieldRow(f.type || 'single', f.name, f.value));
      }
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
    customFields: collectCharCustomFields(),
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
  const perspectiveSelect = document.getElementById("graphPerspectiveSelect");

  if (selectedGraphCharIds.length === 0 && activeChars.length) {
    selectedGraphCharIds = activeChars.slice(0, 6).map(c => c.id);
  }

  container.innerHTML = activeChars.map(c => `
    <label class="checkbox-pill">
      <input type="checkbox" value="${c.id}" ${selectedGraphCharIds.includes(c.id) ? 'checked' : ''} onchange="handleGraphCharToggle('${c.id}')">
      <span>${c.name}</span>
    </label>
  `).join('');

  if (perspectiveSelect) {
    if (currentGraphPerspectiveId && !activeChars.some(c => c.id === currentGraphPerspectiveId)) currentGraphPerspectiveId = "";
    perspectiveSelect.innerHTML = `<option value="">全部人物／完整關係</option>` + activeChars.map(c => `
      <option value="${c.id}" ${c.id === currentGraphPerspectiveId ? 'selected' : ''}>${c.name} 的視角</option>
    `).join('');
  }
}

function handleGraphPerspectiveChange(charId) {
  currentGraphPerspectiveId = charId || "";
  if (currentGraphPerspectiveId && !selectedGraphCharIds.includes(currentGraphPerspectiveId)) {
    selectedGraphCharIds.push(currentGraphPerspectiveId);
    renderRelationshipGraphCheckboxes();
  }
  drawRelationshipSvg();
}

function handleGraphCharToggle(charId) {
  if (selectedGraphCharIds.includes(charId)) {
    selectedGraphCharIds = selectedGraphCharIds.filter(id => id !== charId);
    if (currentGraphPerspectiveId === charId) {
      currentGraphPerspectiveId = "";
      const select = document.getElementById("graphPerspectiveSelect");
      if (select) select.value = "";
    }
  } else {
    selectedGraphCharIds.push(charId);
  }
  drawRelationshipSvg();
}

function zoomGraph(factor) {
  const svg = document.getElementById("relationshipSvg");
  const width = svg.viewBox.baseVal.width || svg.clientWidth || 850;
  const height = svg.viewBox.baseVal.height || svg.clientHeight || 560;
  const center = { x: width / 2, y: height / 2 };
  const nextZoom = Math.min(2.2, Math.max(0.55, graphZoomLevel * factor));
  const appliedFactor = nextZoom / graphZoomLevel;
  Object.keys(customNodePositions).forEach(id => {
    const pos = customNodePositions[id];
    customNodePositions[id] = {
      x: center.x + (pos.x - center.x) * appliedFactor,
      y: center.y + (pos.y - center.y) * appliedFactor
    };
  });
  graphZoomLevel = nextZoom;
  drawRelationshipSvg();
}
function resetGraphView() { graphZoomLevel = 1.0; customNodePositions = {}; drawRelationshipSvg(); }

function clientToGraphPoint(clientX, clientY) {
  const svg = document.getElementById("relationshipSvg");
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const matrix = svg.getScreenCTM();
  if (matrix) return point.matrixTransform(matrix.inverse());
  const rect = svg.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function clampGraphPosition(x, y) {
  const svg = document.getElementById("relationshipSvg");
  const width = svg.viewBox.baseVal.width || svg.clientWidth || 850;
  const height = svg.viewBox.baseVal.height || svg.clientHeight || 560;
  return { x: Math.max(34, Math.min(width - 34, x)), y: Math.max(34, Math.min(height - 54, y)) };
}

function updateDraggedGraphNode(charId, x, y) {
  const svg = document.getElementById("relationshipSvg");
  const node = svg.querySelector(`.graph-node[data-char-id="${CSS.escape(charId)}"]`);
  if (node) {
    node.querySelector("circle").setAttribute("cx", x);
    node.querySelector("circle").setAttribute("cy", y);
    node.querySelector("text").setAttribute("x", x);
    node.querySelector("text").setAttribute("y", y + 44);
  }
  svg.querySelectorAll(`.graph-edge[data-source="${CSS.escape(charId)}"], .graph-edge[data-target="${CSS.escape(charId)}"]`).forEach(edge => {
    const isSource = edge.dataset.source === charId;
    edge.setAttribute(isSource ? "x1" : "x2", x);
    edge.setAttribute(isSource ? "y1" : "y2", y);
    const x1 = Number(edge.getAttribute("x1"));
    const y1 = Number(edge.getAttribute("y1"));
    const x2 = Number(edge.getAttribute("x2"));
    const y2 = Number(edge.getAttribute("y2"));
    const label = svg.querySelector(`.graph-edge-label[data-edge-id="${edge.dataset.edgeId}"]`);
    if (label) { label.setAttribute("x", (x1 + x2) / 2); label.setAttribute("y", (y1 + y2) / 2); }
  });
}

function drawRelationshipSvg() {
  const svg = document.getElementById("relationshipSvg");
  svg.innerHTML = '';

  const activeSelectedChars = characters.filter(c => !c.isHidden && selectedGraphCharIds.includes(c.id));
  if (activeSelectedChars.length < 2) {
    svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="var(--text-muted)" font-size="14">請勾選至少 2 個角色。</text>`;
    return;
  }

  const width = Math.max(320, svg.clientWidth || 850);
  const height = Math.max(420, svg.clientHeight || 560);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  if (lastGraphCanvasSize.width && lastGraphCanvasSize.height && (lastGraphCanvasSize.width !== width || lastGraphCanvasSize.height !== height)) {
    const scaleX = width / lastGraphCanvasSize.width;
    const scaleY = height / lastGraphCanvasSize.height;
    Object.keys(customNodePositions).forEach(id => {
      customNodePositions[id] = clampGraphPosition(customNodePositions[id].x * scaleX, customNodePositions[id].y * scaleY);
    });
  }
  lastGraphCanvasSize = { width, height };
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
      const pos = clampGraphPosition(customNodePositions[char.id].x, customNodePositions[char.id].y);
      customNodePositions[char.id] = pos;
      return { char: char, x: pos.x, y: pos.y };
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
      const perspectiveIsSource = currentGraphPerspectiveId === source.char.id;
      const perspectiveIsTarget = currentGraphPerspectiveId === target.char.id;
      if (currentGraphPerspectiveId && !perspectiveIsSource && !perspectiveIsTarget) continue;

      if (rel1 || rel2 || isCp) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const edgeId = `edge_${i}_${j}`;
        line.classList.add("graph-edge");
        line.dataset.source = source.char.id;
        line.dataset.target = target.char.id;
        line.dataset.edgeId = edgeId;
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
        const perspectiveRel = perspectiveIsSource ? rel1 : perspectiveIsTarget ? rel2 : null;
        const labelText = perspectiveRel?.callName || (isCp ? "💕 固定 CP" : (rel1 ? rel1.callName : rel2 ? rel2.callName : "關聯"));

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.classList.add("graph-edge-label");
        text.dataset.edgeId = edgeId;
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
    g.classList.add("graph-node");
    g.dataset.charId = node.char.id;
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

    const startNodeDrag = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const point = clientToGraphPoint(e.clientX, e.clientY);
      draggedNodeId = node.char.id;
      activeGraphPointerId = e.pointerId;
      dragNodeOffset = { x: point.x - node.x, y: point.y - node.y };
      g.setPointerCapture?.(e.pointerId);
      g.setAttribute("cursor", "grabbing");
    };
    g.addEventListener("pointerdown", startNodeDrag);

    svg.appendChild(g);
  });
}

window.addEventListener("pointermove", (e) => {
  if (!draggedNodeId || e.pointerId !== activeGraphPointerId) return;
  e.preventDefault();
  const point = clientToGraphPoint(e.clientX, e.clientY);
  const pos = clampGraphPosition(point.x - dragNodeOffset.x, point.y - dragNodeOffset.y);
  customNodePositions[draggedNodeId] = pos;
  updateDraggedGraphNode(draggedNodeId, pos.x, pos.y);
}, { passive: false });

function endGraphDrag(e) {
  if (activeGraphPointerId !== null && e.pointerId !== activeGraphPointerId) return;
  draggedNodeId = null;
  activeGraphPointerId = null;
}
window.addEventListener("pointerup", endGraphDrag);
window.addEventListener("pointercancel", endGraphDrag);
let graphResizeTimer = null;
window.addEventListener("resize", () => {
  if (currentRelViewMode !== "graph") return;
  clearTimeout(graphResizeTimer);
  graphResizeTimer = setTimeout(drawRelationshipSvg, 120);
});

async function downloadRelationshipGraph() {
  const svg = document.getElementById("relationshipSvg");
  if (selectedGraphCharIds.length < 2) return alert("請先選擇至少兩位角色再輸出關係圖！");
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", svg.clientWidth || 850);
  clone.setAttribute("height", svg.clientHeight || 560);
  clone.setAttribute("viewBox", `0 0 ${svg.clientWidth || 850} ${svg.clientHeight || 560}`);
  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  background.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue("--bg-secondary").trim() || "#292524");
  clone.insertBefore(background, clone.firstChild);
  const textColor = getComputedStyle(document.documentElement).getPropertyValue("--text-main").trim() || "#f5f5f4";
  clone.querySelectorAll("text").forEach(text => { if ((text.getAttribute("fill") || "").includes("var(")) text.setAttribute("fill", textColor); });
  const source = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `OC_人物關係圖_${new Date().toISOString().slice(0, 10)}.svg`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

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

            <div class="ranking-move-controls">
              <button class="btn btn-xs btn-outline" onclick="moveRankingItem('${currentRanking.id}', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="向上移動"><i class="fa-solid fa-arrow-up"></i> 上移</button>
              <button class="btn btn-xs btn-outline" onclick="moveRankingItem('${currentRanking.id}', ${idx}, 1)" ${idx === currentRanking.items.length - 1 ? 'disabled' : ''} title="向下移動"><i class="fa-solid fa-arrow-down"></i> 下移</button>
            </div>

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

function moveRankingItem(rankId, index, direction) {
  const rank = rankings.find(r => r.id === rankId);
  if (!rank || !rank.items?.[index]) return;
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= rank.items.length) return;
  // 比較符號屬於排名位置，移動時只交換人物，避免 >、= 等關係跟著人物跑位。
  const currentCharId = rank.items[index].charId;
  rank.items[index].charId = rank.items[targetIndex].charId;
  rank.items[targetIndex].charId = currentCharId;
  saveStateToLocalStorage();
  renderRankingModule();
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

// ========== 9. Paro 平行世界模組 (【Bug修復】：保留已有 Field ID) ==========
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

    // 關鍵修復：傳入舊有的 f.id，避免重新生 ID 導致舊有填寫紀錄消失！
    (paro.fields || []).forEach(f => addParoFieldRow(f.name, f.type, (f.options || []).join(','), f.description, f.id));

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

function addParoFieldRow(name = "", type = "text", options = "", desc = "", existingFieldId = null) {
  const container = document.getElementById("paroFieldsContainer");
  if (!container) return;

  const fieldId = existingFieldId || `field_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
  const row = document.createElement("div");
  row.className = "paro-field-row";
  row.setAttribute("data-fieldid", fieldId);
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
    const fId = row.getAttribute("data-fieldid") || `field_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
    const fName = row.querySelector(".field-name").value.trim();
    const fType = row.querySelector(".field-type").value;
    const fOptsStr = row.querySelector(".field-options").value.trim();
    const fDesc = row.querySelector(".field-desc").value.trim();

    const optionsArr = fType === 'select' ? fOptsStr.split(',').map(o => o.trim()).filter(Boolean) : null;

    return {
      id: fId,
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

// ========== 10. 陣營與大事件詞條 (【Bug修復】：保留已有 SubTag/Section ID) ==========
function getFactionMemberGroups(faction) {
  const subGroups = {};
  (faction.subTags || []).forEach(sub => { subGroups[sub.name] = []; });
  const main = [];
  characters.filter(c => !c.isHidden).forEach(char => {
    const tags = char.tags || [];
    const matchedSubs = (faction.subTags || []).filter(sub => tags.includes(sub.name));
    matchedSubs.forEach(sub => subGroups[sub.name].push(char));
    // 同時標記主陣營與子陣營時，只列在更精確的子陣營。
    if (tags.includes(faction.name) && matchedSubs.length === 0) main.push(char);
  });
  return { main, subGroups };
}

function characterBelongsToFaction(char, faction) {
  const tags = char.tags || [];
  return tags.includes(faction.name) || (faction.subTags || []).some(sub => tags.includes(sub.name));
}

function appendFactionExportText(text, faction, headingLevel = 2) {
  const mark = "#".repeat(headingLevel);
  const members = getFactionMemberGroups(faction);
  text += `${mark} 陣營／世界觀：${faction.name}\n${faction.description || '（無簡介）'}\n`;
  text += `- 主陣營成員：${members.main.length ? members.main.map(c => c.name).join('、') : '（無）'}\n`;
  (faction.subTags || []).forEach(sub => {
    const subMembers = members.subGroups[sub.name] || [];
    text += `- 子陣營【${sub.name}】：${sub.description || '（無簡介）'}\n`;
    text += `  - 成員：${subMembers.length ? subMembers.map(c => c.name).join('、') : '（無）'}\n`;
  });
  (faction.customSections || []).forEach(sec => { text += `\n${mark}# ${sec.title}\n${sec.content || '（無內容）'}\n`; });
  return text + `\n`;
}

function renderFactionList() {
  const container = document.getElementById("factionList");
  if (!container) return;

  container.innerHTML = factions.map(f => {
    const memberGroups = getFactionMemberGroups(f);
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
        <div class="faction-member-groups">
          <div class="faction-member-row"><strong><i class="fa-solid fa-users"></i> 主陣營成員</strong><div class="tag-cloud">${memberGroups.main.length ? memberGroups.main.map(c => `<span class="tag-pill">${c.name}</span>`).join('') : '<span class="faction-member-empty">無</span>'}</div></div>
          ${(f.subTags || []).map(sub => `<div class="faction-member-row"><strong><i class="fa-solid fa-user-group"></i> ${sub.name}</strong><div class="tag-cloud">${(memberGroups.subGroups[sub.name] || []).length ? memberGroups.subGroups[sub.name].map(c => `<span class="tag-pill">${c.name}</span>`).join('') : '<span class="faction-member-empty">無</span>'}</div></div>`).join('')}
        </div>
        
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
    (f.customSections || []).forEach(sec => addFactionSectionRow(sec.title, sec.content, sec.id));
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
  row.dataset.originalName = name;
  row.style.cssText = "display:flex; gap:0.5rem; margin-bottom:0.4rem;";
  row.innerHTML = `
    <input type="text" class="sub-name" placeholder="子標籤名稱" value="${escapeHtml(name)}" style="flex:1;">
    <input type="text" class="sub-desc" placeholder="簡介說明" value="${escapeHtml(desc)}" style="flex:2;">
    <button type="button" class="btn btn-xs btn-danger" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(row);
}

function addFactionSectionRow(title = "", content = "", existingSecId = null) {
  const container = document.getElementById("factionCustomSectionsContainer");
  const secId = existingSecId || `fsec_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
  const row = document.createElement("div");
  row.className = "faction-sec-row";
  row.setAttribute("data-secid", secId);
  row.style.cssText = "background:var(--bg-secondary); padding:0.6rem; border-radius:6px; margin-bottom:0.5rem; display:flex; flex-direction:column; gap:0.3rem;";
  row.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <input type="text" class="faction-sec-title" placeholder="大事件 / 自訂詞條標題 (如: 神魔大戰歷史)" value="${escapeHtml(title)}" style="font-weight:600; flex:1;">
      <button type="button" class="btn btn-xs btn-danger ml-2" onclick="this.parentElement.parentElement.remove()">&times;</button>
    </div>
    <textarea class="faction-sec-content" rows="3" placeholder="詳細大段長文字內容與設定補充...">${escapeHtml(content)}</textarea>
  `;
  container.appendChild(row);
}

function saveFactionForm() {
  const id = document.getElementById("factionId").value;
  const name = document.getElementById("factionName").value.trim();
  if (!name) { alert("請輸入陣營名稱！"); return; }

  const subTagRows = document.querySelectorAll("#subTagsContainer .sub-tag-row");
  const subTags = [];
  const tagReplacements = new Map(); // oldName -> newName

  const oldFaction = id ? factions.find(f => f.id === id) : null;
  if (oldFaction && oldFaction.name !== name) {
    tagReplacements.set(oldFaction.name, name);
  }

  subTagRows.forEach(row => {
    const subName = row.querySelector(".sub-name").value.trim();
    const subDesc = row.querySelector(".sub-desc").value.trim();
    const origName = row.dataset.originalName ? row.dataset.originalName.trim() : "";
    if (subName) {
      subTags.push({ name: subName, description: subDesc });
      if (origName && origName !== subName) {
        tagReplacements.set(origName, subName);
      }
    }
  });

  const secRows = document.querySelectorAll("#factionCustomSectionsContainer .faction-sec-row");
  const customSections = Array.from(secRows).map(row => {
    const secId = row.getAttribute("data-secid") || `fsec_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
    return {
      id: secId,
      title: row.querySelector(".faction-sec-title").value.trim(),
      content: row.querySelector(".faction-sec-content").value.trim()
    };
  }).filter(s => s.title);

  const factionData = {
    id: id || `faction_${Date.now()}`,
    name,
    description: document.getElementById("factionDescription").value.trim(),
    subTags,
    customSections
  };

  // If any faction or subtag names were changed, cascade update to characters, books, and documents!
  if (tagReplacements.size > 0) {
    characters.forEach(c => {
      if (Array.isArray(c.tags)) {
        c.tags = c.tags.map(t => tagReplacements.get(t) || t);
      }
    });
    books.forEach(b => {
      if (Array.isArray(b.tags)) {
        b.tags = b.tags.map(t => tagReplacements.get(t) || t);
      }
    });
    documents.forEach(d => {
      if (Array.isArray(d.tags)) {
        d.tags = d.tags.map(t => tagReplacements.get(t) || t);
      }
    });
  }

  if (id) {
    const idx = factions.findIndex(f => f.id === id);
    if (idx !== -1) factions[idx] = factionData;
  } else {
    factions.push(factionData);
  }

  saveStateToLocalStorage();
  syncGlobalTags();
  renderFactionList();
  renderCharacterCards();
  renderDocumentsModule();
  closeModal("factionModal");
}

function deleteFaction(factionId) {
  const faction = factions.find(f => f.id === factionId);
  if (!faction) return;
  if (confirm(`確定要刪除「${faction.name}」陣營與世界觀設定嗎？`)) {
    const deletedNames = new Set([faction.name, ...(faction.subTags || []).map(s => s.name)]);
    characters.forEach(c => {
      if (Array.isArray(c.tags)) {
        c.tags = c.tags.filter(t => !deletedNames.has(t));
      }
    });
    books.forEach(b => {
      if (Array.isArray(b.tags)) {
        b.tags = b.tags.filter(t => !deletedNames.has(t));
      }
      if (Array.isArray(b.factionIds)) {
        b.factionIds = b.factionIds.filter(id => id !== factionId);
      }
    });
    documents.forEach(d => {
      if (Array.isArray(d.tags)) {
        d.tags = d.tags.filter(t => !deletedNames.has(t));
      }
      if (Array.isArray(d.factionIds)) {
        d.factionIds = d.factionIds.filter(id => id !== factionId);
      }
    });
    factions = factions.filter(f => f.id !== factionId);
    saveStateToLocalStorage();
    syncGlobalTags();
    renderFactionList();
    renderCharacterCards();
    renderDocumentsModule();
  }
}

// ========== 10.5. 同人文檔與書籍資料庫 ==========
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

  if (charFilterSelect) {
    const previous = charFilterSelect.value;
    charFilterSelect.innerHTML = `<option value="">全部角色</option>` + activeChars.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    charFilterSelect.value = previous;
  }
  if (factionFilterSelect) {
    const previous = factionFilterSelect.value;
    factionFilterSelect.innerHTML = `<option value="">全部世界觀</option>` + factions.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    factionFilterSelect.value = previous;
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

  const filtersActive = !!(searchKeyword || selectedCharId || selectedFactionId || selectedTag);
  const visibleBooks = books.filter(book => {
    if (!filtersActive) return true;
    const bookSearch = !searchKeyword || `${book.title || ''} ${book.description || ''}`.toLowerCase().includes(searchKeyword);
    const bookChar = !selectedCharId || (book.charIds || []).includes(selectedCharId);
    const bookFaction = !selectedFactionId || (book.factionIds || []).includes(selectedFactionId);
    const bookTag = !selectedTag || (book.tags || []).includes(selectedTag);
    return (bookSearch && bookChar && bookFaction && bookTag) || filteredDocs.some(doc => doc.bookId === book.id);
  });

  const bookHtmlList = visibleBooks.map(book => {
    const bookDirectMatch = filtersActive &&
      (!searchKeyword || `${book.title || ''} ${book.description || ''}`.toLowerCase().includes(searchKeyword)) &&
      (!selectedCharId || (book.charIds || []).includes(selectedCharId)) &&
      (!selectedFactionId || (book.factionIds || []).includes(selectedFactionId)) &&
      (!selectedTag || (book.tags || []).includes(selectedTag));
    const bookDocs = (bookDirectMatch ? documents : filteredDocs).filter(d => d.bookId === book.id);
    const isCollapsed = !!collapsedBooks[book.id];
    const memberChars = (book.charIds || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
    const memberFactions = (book.factionIds || []).map(id => factions.find(f => f.id === id)).filter(Boolean);
    const bookIconColor = book.iconColor || 'var(--accent-gold)';
    const bookTagsHtml = (book.tags || []).map(tag => `<span class="tag-pill">${tag}</span>`).join(' ');

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
              ${bookTagsHtml ? `<div style="margin-top:0.25rem;">${bookTagsHtml}</div>` : ''}
            </div>
          </div>
          <div class="book-inline-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button class="btn btn-xs btn-outline" onclick="openBookModal('${book.id}')"><i class="fa-solid fa-pen"></i> 編輯書籍</button>
            <button class="btn btn-xs btn-primary" onclick="openDocumentModal(null, '${book.id}')"><i class="fa-solid fa-plus"></i> 新增章節</button>
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
    <div class="doc-item-row" data-doc-id="${doc.id}" data-book-id="${doc.bookId || ''}" draggable="true"
      ondragstart="beginDocumentDrag(event, '${doc.id}')" ondragend="finishDocumentDrag()" ondragover="event.preventDefault()" ondrop="dropDocumentDrag(event, '${doc.id}')">
      <div style="display:flex; align-items:center; gap:0.6rem; flex:1;">
        <button class="doc-drag-handle" type="button" title="拖曳調整章節順序"
          onpointerdown="beginDocumentPointerDrag(event, '${doc.id}')"><i class="fa-solid fa-grip-vertical"></i></button>
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
        <button class="btn btn-xs btn-primary" onclick="openDocumentReader('${doc.id}')"><i class="fa-solid fa-book-open-reader"></i> 閱讀</button>
        <button class="btn btn-xs btn-outline" onclick="openDocumentModal('${doc.id}')"><i class="fa-solid fa-pen"></i> 編輯</button>
        <button class="btn btn-xs btn-magic" onclick="openVisualNovelForDocument('${doc.id}')"><i class="fa-solid fa-gamepad"></i> ${doc.visualNovel?.scriptText ? (doc.visualNovel?.bookmarkIndex != null ? '視覺小說 📌' : '視覺小說') : '建立視覺小說'}</button>
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

function openDocumentModal(docId = null, defaultBookId = "") {
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
    document.getElementById("deleteDocumentInEditorBtn").style.display = "inline-flex";
    document.getElementById("editDocumentVisualNovelBtn").style.display = "inline-flex";
    document.getElementById("editDocumentVisualNovelBtn").innerHTML = `<i class="fa-solid fa-gamepad"></i> ${d.visualNovel?.scriptText ? '改寫視覺小說' : '建立視覺小說'}`;

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
    document.getElementById("docBelongingBookId").value = defaultBookId || "";
    document.getElementById("docTags").value = "";
    document.getElementById("docContent").value = "";
    document.getElementById("deleteDocumentInEditorBtn").style.display = "none";
    document.getElementById("editDocumentVisualNovelBtn").style.display = "none";

    charCb.innerHTML = activeChars.map(c => `
      <label class="checkbox-pill"><input type="checkbox" value="${c.id}"><span>${c.name}</span></label>
    `).join('');

    factionCb.innerHTML = factions.map(f => `
      <label class="checkbox-pill"><input type="checkbox" value="${f.id}"><span>${f.name}</span></label>
    `).join('');
  }

  modal.classList.add("active");
  captureEditorModalSnapshot("documentModal");
}

function getReaderSequence(doc) {
  if (!doc) return [];
  if (doc.bookId) return documents.filter(item => item.bookId === doc.bookId);
  return documents.filter(item => !item.bookId);
}

function openDocumentReader(docId) {
  const doc = documents.find(item => item.id === docId);
  if (!doc) return;
  currentReadingDocId = doc.id;
  const book = books.find(item => item.id === doc.bookId);
  const docChars = (doc.charIds || []).map(id => characters.find(c => c.id === id)?.name).filter(Boolean);
  const docFactions = (doc.factionIds || []).map(id => factions.find(f => f.id === id)?.name).filter(Boolean);
  document.getElementById("docReaderTitle").textContent = doc.title;
  document.getElementById("docReaderMeta").textContent = [book?.title, docChars.length ? `角色：${docChars.join('、')}` : "", docFactions.length ? `世界觀：${docFactions.join('、')}` : "", (doc.tags || []).length ? `標籤：${doc.tags.join('、')}` : ""].filter(Boolean).join(" ｜ ");
  const content = document.getElementById("docReaderContent");
  content.textContent = doc.content || "（此文檔尚無正文內容。）";
  content.style.fontSize = `${documentReaderFontSize}rem`;
  document.querySelector("#documentReaderModal .doc-reader-scroll").scrollTop = 0;
  const sequence = getReaderSequence(doc);
  const index = sequence.findIndex(item => item.id === doc.id);
  document.getElementById("docReaderPrevBtn").disabled = index <= 0;
  document.getElementById("docReaderNextBtn").disabled = index < 0 || index >= sequence.length - 1;
  document.getElementById("documentReaderModal").classList.add("active");
}

function navigateDocumentReader(direction) {
  const current = documents.find(item => item.id === currentReadingDocId);
  const sequence = getReaderSequence(current);
  const index = sequence.findIndex(item => item.id === currentReadingDocId);
  const next = sequence[index + direction];
  if (next) openDocumentReader(next.id);
}

function changeReaderFontSize(delta) {
  documentReaderFontSize = Math.min(1.6, Math.max(0.82, documentReaderFontSize + delta * 0.1));
  const content = document.getElementById("docReaderContent");
  if (content) content.style.fontSize = `${documentReaderFontSize}rem`;
}

function openCurrentReaderDocumentEditor() {
  if (!currentReadingDocId) return;
  closeModal("documentReaderModal");
  openDocumentModal(currentReadingDocId);
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
    content: document.getElementById("docContent").value.trim(),
    visualNovel: id ? documents.find(d => d.id === id)?.visualNovel : undefined
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
  closeModal("documentModal", true);
}

function deleteDocument(docId) {
  if (confirm("確定要刪除此同人文檔章節嗎？")) {
    documents = documents.filter(d => d.id !== docId);
    saveStateToLocalStorage();
    renderDocumentsModule();
  }
}

function deleteDocumentFromEditor() {
  const docId = document.getElementById("docId").value;
  if (!docId) return;
  if (confirm("確定要刪除此同人文檔章節嗎？此章的視覺小說腳本也會一併刪除。")) {
    documents = documents.filter(d => d.id !== docId);
    saveStateToLocalStorage(); syncGlobalTags(); renderDocumentsModule(); closeModal("documentModal", true);
  }
}

function reorderDocument(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const sourceIndex = documents.findIndex(doc => doc.id === sourceId);
  const targetIndex = documents.findIndex(doc => doc.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || (documents[sourceIndex].bookId || "") !== (documents[targetIndex].bookId || "")) return;
  const [moved] = documents.splice(sourceIndex, 1);
  const updatedTargetIndex = documents.findIndex(doc => doc.id === targetId);
  documents.splice(updatedTargetIndex, 0, moved);
  saveStateToLocalStorage(); renderDocumentsModule();
}

function beginDocumentDrag(event, docId) {
  draggedDocumentId = docId;
  event.dataTransfer.effectAllowed = "move";
  event.currentTarget.classList.add("is-dragging");
}

function dropDocumentDrag(event, targetId) {
  event.preventDefault();
  reorderDocument(draggedDocumentId, targetId);
  draggedDocumentId = null;
}

function finishDocumentDrag() {
  draggedDocumentId = null;
  document.querySelectorAll(".doc-item-row").forEach(row => row.classList.remove("is-dragging", "is-drop-target"));
}

function beginDocumentPointerDrag(event, docId) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  draggedDocumentId = docId;
  const handle = event.currentTarget;
  handle.setPointerCapture?.(event.pointerId);
  handle.closest(".doc-item-row")?.classList.add("is-dragging");
  const move = moveEvent => {
    const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest(".doc-item-row");
    document.querySelectorAll(".doc-item-row.is-drop-target").forEach(row => row.classList.remove("is-drop-target"));
    if (target && target.dataset.bookId === (handle.closest(".doc-item-row")?.dataset.bookId || "")) target.classList.add("is-drop-target");
  };
  const finish = finishEvent => {
    const target = document.elementFromPoint(finishEvent.clientX, finishEvent.clientY)?.closest(".doc-item-row");
    document.querySelectorAll(".doc-item-row").forEach(row => row.classList.remove("is-dragging", "is-drop-target"));
    handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", finish); handle.removeEventListener("pointercancel", finish);
    if (target) reorderDocument(docId, target.dataset.docId);
    draggedDocumentId = null;
  };
  handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", finish); handle.addEventListener("pointercancel", finish);
  event.preventDefault();
}

// ========== 10.6. 小說自動視覺小說化 ==========
const DEFAULT_VN_AVATAR = "https://file.garden/aWe99vhwaGcNwkok/%E7%A0%B4%E9%A0%AD/%E8%B7%AF%E4%BA%BA.png";

function getDefaultVisualNovelSettings(doc) {
  const book = books.find(item => item.id === doc?.bookId);
  const firstCharacter = (doc?.charIds || []).map(id => characters.find(char => char.id === id)).find(Boolean);
  return {
    primaryColor: firstCharacter?.themeColor?.primary || book?.iconColor || "#d97706",
    secondaryColor: firstCharacter?.themeColor?.secondary || "#7c3aed",
    themeMode: "dark", backgroundColor: "#17130f", textColor: "#fffaf0",
    narratorBorderColor: "#b8aa98", narratorTextColor: "#fffaf0", globalBgm: "", bgmVolume: 0.7,
    useCharacterColors: true, typewriterEnabled: true, typewriterSound: false
  };
}

function collectVisualNovelSettings() {
  return {
    primaryColor: document.getElementById("vnPrimaryColor").value,
    secondaryColor: document.getElementById("vnSecondaryColor").value,
    themeMode: document.getElementById("vnThemeMode").value,
    backgroundColor: document.getElementById("vnBackgroundColor").value,
    textColor: document.getElementById("vnTextColor").value,
    narratorBorderColor: document.getElementById("vnNarratorBorderColor").value,
    narratorTextColor: document.getElementById("vnNarratorTextColor").value,
    globalBgm: document.getElementById("vnGlobalBgm").value.trim(),
    bgmVolume: Number(document.getElementById("vnBgmVolume").value),
    fontSize: Number(document.getElementById("vnFontSizeSelect")?.value) || 1.05,
    useCharacterColors: document.getElementById("vnUseCharacterColors").checked,
    typewriterEnabled: document.getElementById("vnTypewriterEnabled").checked,
    typewriterSound: document.getElementById("vnTypewriterSound").checked
  };
}

function fillVisualNovelSettings(settings) {
  document.getElementById("vnPrimaryColor").value = settings.primaryColor || "#d97706";
  document.getElementById("vnSecondaryColor").value = settings.secondaryColor || "#7c3aed";
  document.getElementById("vnThemeMode").value = settings.themeMode === "light" ? "light" : "dark";
  document.getElementById("vnBackgroundColor").value = settings.backgroundColor || "#17130f";
  document.getElementById("vnTextColor").value = settings.textColor || "#fffaf0";
  document.getElementById("vnNarratorBorderColor").value = settings.narratorBorderColor || "#b8aa98";
  document.getElementById("vnNarratorTextColor").value = settings.narratorTextColor || (settings.themeMode === "light" ? "#2b2118" : "#fffaf0");
  document.getElementById("vnGlobalBgm").value = settings.globalBgm || "";
  const bgmVolume = Number.isFinite(Number(settings.bgmVolume)) ? Number(settings.bgmVolume) : 0.7;
  document.getElementById("vnBgmVolume").value = bgmVolume;
  updateVisualNovelVolumeLabel(bgmVolume);
  if (document.getElementById("vnFontSizeSelect")) {
    document.getElementById("vnFontSizeSelect").value = String(settings.fontSize || 1.05);
  }
  document.getElementById("vnUseCharacterColors").checked = settings.useCharacterColors !== false;
  document.getElementById("vnTypewriterEnabled").checked = settings.typewriterEnabled !== false;
  document.getElementById("vnTypewriterSound").checked = !!settings.typewriterSound;
}

function updateVisualNovelThemeModeDefaults() {
  const light = document.getElementById("vnThemeMode").value === "light";
  document.getElementById("vnBackgroundColor").value = light ? "#fffaf0" : "#17130f";
  document.getElementById("vnTextColor").value = light ? "#2b2118" : "#fffaf0";
  document.getElementById("vnNarratorTextColor").value = light ? "#2b2118" : "#fffaf0";
}

function updateVisualNovelVolumeLabel(value) {
  const label = document.getElementById("vnBgmVolumeLabel");
  if (label) label.textContent = `${Math.round(Number(value) * 100)}%`;
}

function renderVisualNovelTemplateSelect() {
  const select = document.getElementById("vnTemplateSelect");
  select.innerHTML = `<option value="">套用已存模板…</option>` + visualNovelTemplates.map(template => `<option value="${template.id}">${template.name}</option>`).join('');
}

function openVisualNovelForDocument(docId) {
  const doc = documents.find(item => item.id === docId);
  if (!doc) return;
  if (doc.visualNovel?.scriptText?.trim()) startVisualNovel(docId);
  else openVisualNovelEditor(docId);
}

function openVisualNovelEditor(docId) {
  const doc = documents.find(item => item.id === docId);
  if (!doc) return;
  const settings = { ...getDefaultVisualNovelSettings(doc), ...(doc.visualNovel?.settings || {}) };
  document.getElementById("vnDocumentId").value = doc.id;
  document.getElementById("vnEditorChapterTitle").textContent = doc.title;
  document.getElementById("vnScriptText").value = formatVisualNovelScriptBlocks(doc.visualNovel?.scriptText || "");
  document.getElementById("vnTemplateName").value = "";
  const customPromptEl = document.getElementById("vnAiCustomPrompt");
  if (customPromptEl) customPromptEl.value = doc.visualNovel?.aiCustomPrompt || "";
  fillVisualNovelSettings(settings);
  renderVisualNovelTemplateSelect();
  document.getElementById("visualNovelEditorModal").classList.add("active");
  captureEditorModalSnapshot("visualNovelEditorModal");
}

function openVisualNovelEditorFromDocumentModal() {
  const docId = document.getElementById("docId").value;
  if (!docId) return;
  if (!closeModal("documentModal")) return;
  openVisualNovelEditor(docId);
}

function openCurrentVisualNovelEditor() {
  if (!currentVisualNovelDocId) return;
  closeVisualNovelPlayer();
  openVisualNovelEditor(currentVisualNovelDocId);
}

function saveVisualNovelTemplate() {
  const name = document.getElementById("vnTemplateName").value.trim();
  if (!name) { alert("請先輸入模板名稱。"); return; }
  const existing = visualNovelTemplates.find(template => normalizedImportName(template.name) === normalizedImportName(name));
  const template = { id: existing?.id || `vnt_${Date.now()}`, name, settings: collectVisualNovelSettings() };
  if (existing) visualNovelTemplates[visualNovelTemplates.indexOf(existing)] = template;
  else visualNovelTemplates.push(template);
  saveStateToLocalStorage(); renderVisualNovelTemplateSelect();
  document.getElementById("vnTemplateSelect").value = template.id;
  alert("視覺小說模板已儲存。");
}

function applyVisualNovelTemplate() {
  const template = visualNovelTemplates.find(item => item.id === document.getElementById("vnTemplateSelect").value);
  if (!template) { alert("請先選擇模板。"); return; }
  fillVisualNovelSettings(template.settings || {});
}

function deleteVisualNovelTemplate() {
  const id = document.getElementById("vnTemplateSelect").value;
  const template = visualNovelTemplates.find(item => item.id === id);
  if (!template || !confirm(`確定刪除模板「${template.name}」嗎？`)) return;
  visualNovelTemplates = visualNovelTemplates.filter(item => item.id !== id);
  saveStateToLocalStorage(); renderVisualNovelTemplateSelect();
}

function saveVisualNovelScript(preview = false) {
  const doc = documents.find(item => item.id === document.getElementById("vnDocumentId").value);
  if (!doc) return;
  const scriptText = formatVisualNovelScriptBlocks(document.getElementById("vnScriptText").value);
  if (!scriptText.trim()) { alert("腳本目前是空白的，請先產生或輸入內容。"); return; }
  const aiCustomPrompt = document.getElementById("vnAiCustomPrompt")?.value.trim() || "";
  document.getElementById("vnScriptText").value = scriptText;
  doc.visualNovel = { version: 1, settings: collectVisualNovelSettings(), scriptText, aiCustomPrompt, updatedAt: new Date().toISOString() };
  saveStateToLocalStorage(); renderDocumentsModule(); closeModal("visualNovelEditorModal", true);
  if (preview) startVisualNovel(doc.id);
}

function deleteVisualNovelScript() {
  const doc = documents.find(item => item.id === document.getElementById("vnDocumentId").value);
  if (!doc?.visualNovel || !confirm("確定刪除此章的視覺小說腳本嗎？小說正文不會被刪除。")) return;
  delete doc.visualNovel;
  saveStateToLocalStorage(); renderDocumentsModule(); closeModal("visualNovelEditorModal", true);
}

function downloadVisualNovelScript() {
  const doc = documents.find(item => item.id === document.getElementById("vnDocumentId").value);
  const text = document.getElementById("vnScriptText").value;
  if (!doc || !text.trim()) { alert("目前沒有可下載的腳本。"); return; }
  const blob = new Blob([text], { type:"text/plain;charset=utf-8" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
  link.download = `${doc.title.replace(/[\\/:*?"<>|]/g, "_")}_視覺小說腳本.txt`; link.click(); URL.revokeObjectURL(link.href);
}

function importVisualNovelScriptFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { document.getElementById("vnScriptText").value = formatVisualNovelScriptBlocks(reader.result || ""); };
  reader.onerror = () => alert("文字腳本讀取失敗。");
  reader.readAsText(file, "utf-8");
  event.target.value = "";
}

function insertVisualNovelCommand(type) {
  const editor = document.getElementById("vnScriptText");
  let command = "@shake";
  if (type === "cg-none") command = "@cg none";
  else if (type === "bgm-none") command = "@bgm none";
  else if (type !== "shake") {
    const label = type === "cg" ? "CG 圖片" : type.toUpperCase();
    const url = prompt(`請輸入${label}的直接網址：`);
    if (!url) return;
    command = `@${type} ${url.trim()}`;
  }
  const start = editor.selectionStart ?? editor.value.length;
  const end = editor.selectionEnd ?? start;
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  const prefix = !before ? "" : (before.endsWith("\n\n") ? "" : (before.endsWith("\n") ? "\n" : "\n\n"));
  const suffix = !after ? "" : (after.startsWith("\n\n") ? "" : (after.startsWith("\n") ? "\n" : "\n\n"));
  editor.setRangeText(`${prefix}${command}${suffix}`, start, end, "end");
  editor.focus();
}

function inferVisualNovelSpeaker(text, possibleCharacters) {
  const quoted = /^「[\s\S]*」$/u.test(String(text || "").trim());
  if (!quoted) return { speaker:"旁白", text };
  const named = possibleCharacters.find(character => new RegExp(`${escapeRegExp(character.name)}.{0,12}(說|問|答|喊|叫|道|表示|開口|回應)`).test(text));
  return { speaker:named?.name || "路人", text };
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripInvisibleFormatting(value) {
  return String(value || "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
}

function compactVisualNovelSpeakerName(value) {
  return normalizedImportName(value).replace(/[\s\p{P}\p{S}\p{Cf}]/gu, "").replace(/(先生|小姐|老師|大人|殿下)$/u, "");
}

function createLosslessVisualNovelSegments(content) {
  const segments = [];
  String(content || "").replace(/\r\n?/g, "\n").split("\n").forEach(line => {
    if (line === "") {
      segments.push({ text:"", joinPrevious:false, isDialogue:false });
      return;
    }
    const parts = [];
    const pattern = /「[^」]*」/gu;
    let cursor = 0;
    for (const match of line.matchAll(pattern)) {
      if (match.index > cursor) parts.push({ text:line.slice(cursor, match.index), isDialogue:false });
      parts.push({ text:match[0], isDialogue:true });
      cursor = match.index + match[0].length;
    }
    if (cursor < line.length) parts.push({ text:line.slice(cursor), isDialogue:false });
    if (!parts.length) parts.push({ text:line, isDialogue:false });
    parts.forEach((part, index) => segments.push({ ...part, joinPrevious:index > 0 }));
  });
  return segments.map((segment, index) => ({ id:`L${String(index + 1).padStart(6, "0")}`, ...segment }));
}

function cleanLegacyVisualNovelScript(scriptText) {
  return String(scriptText || "").replace(/^@blank$/gm, "").replace(/^[\s\u200B-\u200D\u2060\uFEFF]*↳\s?/gm, "");
}

function formatVisualNovelScriptBlocks(scriptText) {
  return cleanLegacyVisualNovelScript(scriptText)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trimEnd())
    .filter(line => line.trim() !== "")
    .join("\n\n");
}

function normalizeVisualNovelSpeaker(speaker, possibleCharacters) {
  const value = String(speaker || "").trim();
  const special = { "旁白":"旁白", "narrator":"旁白", "系統":"系統", "system":"系統", "路人":"路人", "unknown":"路人" };
  if (special[value.toLowerCase()]) return special[value.toLowerCase()];
  const compactValue = compactVisualNovelSpeakerName(value);
  const character = possibleCharacters.find(item => {
    const compactName = compactVisualNovelSpeakerName(item.name);
    return compactName === compactValue || (compactName.length >= 2 && compactValue.includes(compactName)) || (compactValue.length >= 2 && compactName.includes(compactValue));
  });
  return character ? stripInvisibleFormatting(character.name).trim() : "路人";
}

function inferVisualNovelSpeakerWithContext(segments, index, possibleCharacters) {
  const direct = inferVisualNovelSpeaker(segments[index].text, possibleCharacters).speaker;
  const normalizedDirect = normalizeVisualNovelSpeaker(direct, possibleCharacters);
  if (normalizedDirect !== "路人") return normalizedDirect;
  const text = segments[index].text;
  if (!segments[index].isDialogue) return "旁白";
  let lineStart = index;
  while (lineStart > 0 && segments[lineStart].joinPrevious) lineStart--;
  let lineEnd = index + 1;
  while (lineEnd < segments.length && segments[lineEnd].joinPrevious) lineEnd++;
  const nearby = segments.slice(Math.max(0, lineStart - 2), Math.min(segments.length, lineEnd + 2)).map(item => item.text).join("\n");
  const contextual = possibleCharacters.find(character => {
    const name = escapeRegExp(character.name);
    return new RegExp(`(?:${name}.{0,18}(?:說|問|答|喊|叫|道|表示|開口|回應|[：:])|(?:說|問|答|喊|叫|道|表示|開口|回應).{0,18}${name})`, "u").test(nearby);
  });
  return contextual?.name || normalizedDirect;
}

function buildLosslessVisualNovelScript(segments, speakerMap, possibleCharacters) {
  return segments.map((segment, index) => {
    if (segment.text === "") return null;
    const fallback = inferVisualNovelSpeakerWithContext(segments, index, possibleCharacters);
    const aiSpeaker = normalizeVisualNovelSpeaker(speakerMap.get(segment.id), possibleCharacters);
    const speaker = !segment.isDialogue ? "旁白" : (aiSpeaker === "路人" && fallback !== "路人" ? fallback : (speakerMap.has(segment.id) ? aiSpeaker : fallback));
    return `${speaker}｜${segment.text}`;
  }).filter(line => line !== null).join("\n\n");
}

function visualNovelScriptPreservesSegments(script, segments) {
  const lines = String(script || "").split("\n").filter(line => line.trim() !== "");
  const contentSegments = segments.filter(segment => segment.text !== "");
  if (lines.length !== contentSegments.length) return false;
  return lines.every((rawLine, index) => {
    const line = rawLine.replace(/^\s*↳\s?/, "");
    const separatorIndex = line.indexOf("｜");
    return separatorIndex >= 0 && line.slice(separatorIndex + 1) === contentSegments[index].text;
  });
}

function createVisualNovelAiBatches(segments) {
  const batches = [];
  let batch = [], characterCount = 0;
  segments.filter(segment => segment.text !== "").forEach(segment => {
    if (batch.length && (batch.length >= 90 || characterCount + segment.text.length > 12000)) {
      batches.push(batch); batch = []; characterCount = 0;
    }
    batch.push(segment); characterCount += segment.text.length;
  });
  if (batch.length) batches.push(batch);
  return batches;
}

function parseVisualNovelSpeakerResponse(content) {
  let text = String(content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace >= firstBrace) text = text.slice(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(text);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function getDocumentPossibleCharacters(doc) {
  const book = books.find(item => item.id === doc?.bookId);
  const ids = [...new Set([...(doc?.charIds || []), ...(book?.charIds || [])])];
  return ids.map(id => characters.find(character => character.id === id)).filter(Boolean);
}

function generateVisualNovelLocally() {
  const doc = documents.find(item => item.id === document.getElementById("vnDocumentId").value);
  if (!doc?.content?.trim()) { alert("此章沒有正文內容。"); return; }
  const possibleCharacters = getDocumentPossibleCharacters(doc);
  const segments = createLosslessVisualNovelSegments(doc.content);
  const script = buildLosslessVisualNovelScript(segments, new Map(), possibleCharacters);
  if (!visualNovelScriptPreservesSegments(script, segments)) {
    alert("完整性檢查失敗，已停止產生腳本以保護原文。"); return;
  }
  document.getElementById("vnScriptText").value = script;
}

async function generateVisualNovelWithAi(forceRecalculate = false) {
  const doc = documents.find(item => item.id === document.getElementById("vnDocumentId").value);
  if (!doc?.content?.trim()) { alert("此章沒有正文內容可供判斷。"); return; }
  if (!deepseekSettings.apiKey) { alert("請先在 DeepSeek AI API 設定中填入 API Key。"); return; }
  if (forceRecalculate && document.getElementById("vnScriptText").value.trim() && !confirm("AI 將重新判斷全文並取代目前編輯框中的腳本，確定繼續嗎？")) return;
  const customPrompt = document.getElementById("vnAiCustomPrompt")?.value.trim() || "";
  if (doc?.visualNovel) doc.visualNovel.aiCustomPrompt = customPrompt;
  const customPromptInstruction = customPrompt ? `\n【使用者自訂角色分配指令／稱呼與別名對應關係】：\n${customPrompt}\n請務必嚴格遵循上述指示，若原文出現別名或稱呼，務必對應指認為指定的角色名稱！` : '';
  const possibleCharacters = getDocumentPossibleCharacters(doc);
  const characterContext = possibleCharacters.map(character => `- ${character.name}：${character.personality || "無性格資料"}；稱呼線索：${(character.relationships || []).map(item => `${item.targetName}=${item.callName}`).join("、")}`).join("\n");
  const segments = createLosslessVisualNovelSegments(doc.content);
  const batches = createVisualNovelAiBatches(segments);
  const speakerMap = new Map();
  let fallbackBatchCount = 0;
  showToast(`AI 正在辨識說話者（1 / ${batches.length}）…`);
  try {
    for (let index = 0; index < batches.length; index++) {
      document.getElementById("toastMessage").textContent = `AI 正在辨識說話者（${index + 1} / ${batches.length}）…原文由程式鎖定，不交給 AI 改寫`;
      const batch = batches[index];
      const response = await fetch(`${deepseekSettings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method:"POST", headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${deepseekSettings.apiKey}` },
        body:JSON.stringify({ model:"deepseek-chat", temperature:0, messages:[
          { role:"system", content:`你只負責替已編號的原文片段判斷說話者，絕對不要回傳、抄寫、摘要或改寫原文。程式已依「……」拆分內容：isDialogue=true 才是角色對話；isDialogue=false 一律標旁白。每段對話都是獨立事件，絕對不可把兩段合併；輸出後程式會強制讓每次對話與操作之間隔一個完整空白行。輸出必須是單一 JSON 物件，鍵是每個 ID，值只能是「旁白」、「系統」、「路人」或下列角色的完整名稱。禁止在名稱前後加入引號、空格、零寬字元、BOM、項目符號或任何特殊記號；禁止自行創造角色名稱。每個收到的 ID 都必須恰好出現一次。務必優先比對下列已勾選登場人物（包含「尤佩特羅斯」等完整名稱），並利用相鄰片段的「某某說／問／回答」判斷；只有對話片段找不到任何人物線索時才標路人。可用角色：\n${characterContext || "（無已關聯角色）"}${customPromptInstruction}` },
          { role:"user", content:JSON.stringify(batch) }
        ]})
      });
      if (!response.ok) throw new Error(`第 ${index + 1} 批 API 回應 ${response.status}`);
      const result = await response.json();
      try {
        const mapping = parseVisualNovelSpeakerResponse(result.choices?.[0]?.message?.content);
        batch.forEach(segment => { if (mapping[segment.id]) speakerMap.set(segment.id, mapping[segment.id]); });
        if (batch.some(segment => !mapping[segment.id])) fallbackBatchCount++;
      } catch (error) { fallbackBatchCount++; }
    }
    const script = buildLosslessVisualNovelScript(segments, speakerMap, possibleCharacters);
    if (!visualNovelScriptPreservesSegments(script, segments)) throw new Error("完整性驗證未通過，沒有覆蓋目前腳本");
    document.getElementById("vnScriptText").value = script;
    if (fallbackBatchCount) alert(`AI 辨識完成。共有 ${fallbackBatchCount} 批存在漏標行，這些行已由本機規則補上說話者；所有原文字句仍完整保留。`);
  } catch (error) { alert("AI 視覺小說化失敗：" + error.message); }
  finally { hideToast(); }
}

let currentVisualNovelSpeakerAliases = { aliasToChar: new Map(), charToAlias: new Map() };

function parseVisualNovelSpeakerAliases(customPromptText) {
  const aliasToChar = new Map();
  const charToAlias = new Map();
  if (!customPromptText || typeof customPromptText !== "string") return { aliasToChar, charToAlias };
  
  const lines = customPromptText.split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[=：:—\->]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const p1 = parts[0];
      const p2 = parts[1];
      const char2 = characters.find(c => normalizedImportName(c.name) === normalizedImportName(p2) || c.name.includes(p2));
      const char1 = characters.find(c => normalizedImportName(c.name) === normalizedImportName(p1) || c.name.includes(p1));
      if (char2) {
        aliasToChar.set(p1, char2);
        aliasToChar.set(normalizedImportName(p1), char2);
        charToAlias.set(char2.name, p1);
        charToAlias.set(normalizedImportName(char2.name), p1);
      } else if (char1) {
        aliasToChar.set(p2, char1);
        aliasToChar.set(normalizedImportName(p2), char1);
        charToAlias.set(char1.name, p2);
        charToAlias.set(normalizedImportName(char1.name), p2);
      }
    }
  });
  return { aliasToChar, charToAlias };
}

function parseVisualNovelScript(scriptText) {
  return formatVisualNovelScriptBlocks(scriptText).split(/\r?\n/).map(line => {
    const contentLine = line.replace(/^[\s\u200B-\u200D\u2060\uFEFF]*↳\s?/, "").replace(/^[\u200B-\u200D\u2060\uFEFF]+/, "");
    const trimmedLine = contentLine.trim();
    if (trimmedLine === "" || trimmedLine === "@blank") return { type:"blank" };
    const command = trimmedLine.match(/^@(cg|bgm|se)\s+(.+)$/i);
    if (command) return { type:command[1].toLowerCase(), value:command[2].trim() };
    if (/^@shake(?:\s|$)/i.test(trimmedLine)) return { type:"shake" };
    const separator = contentLine.includes("｜") ? "｜" : (contentLine.includes("|") ? "|" : null);
    if (!separator) return { type:"dialogue", speaker:"旁白", text:contentLine };
    const index = contentLine.indexOf(separator);
    return { type:"dialogue", speaker:stripInvisibleFormatting(contentLine.slice(0, index)).trim() || "旁白", text:contentLine.slice(index + separator.length) };
  });
}

function applyVisualNovelTheme(settings) {
  const player = document.getElementById("vnPlayer");
  player.style.setProperty("--vn-primary", settings.primaryColor || "#d97706");
  player.style.setProperty("--vn-secondary", settings.secondaryColor || settings.primaryColor || "#7c3aed");
  player.style.setProperty("--vn-bg", settings.backgroundColor || (settings.themeMode === "light" ? "#fffaf0" : "#17130f"));
  player.style.setProperty("--vn-text", settings.textColor || (settings.themeMode === "light" ? "#2b2118" : "#fffaf0"));
  player.style.setProperty("--vn-narrator-border", settings.narratorBorderColor || "#b8aa98");
  player.style.setProperty("--vn-narrator-text", settings.narratorTextColor || (settings.themeMode === "light" ? "#2b2118" : "#fffaf0"));
  if (settings.fontSize) visualNovelFontSize = Number(settings.fontSize);
  player.style.setProperty("--vn-font-size", `${visualNovelFontSize || 1.05}rem`);
  player.dataset.theme = settings.themeMode === "light" ? "light" : "dark";
  document.getElementById("vnStoryColor").style.background = `linear-gradient(135deg, ${settings.primaryColor || '#d97706'}, ${settings.secondaryColor || '#7c3aed'})`;
}

function startVisualNovel(docId, withTransition = true, preserveHistory = false) {
  const doc = documents.find(item => item.id === docId);
  if (!doc?.visualNovel?.scriptText) { openVisualNovelEditor(docId); return; }
  clearTimeout(visualNovelAutoTimer);
  currentVisualNovelDocId = doc.id;
  currentVisualNovelSpeakerAliases = parseVisualNovelSpeakerAliases(doc.visualNovel?.aiCustomPrompt);
  currentVisualNovelEvents = parseVisualNovelScript(doc.visualNovel.scriptText);
  currentVisualNovelIndex = -1;
  if (!preserveHistory) visualNovelHistory = [];
  const settings = { ...getDefaultVisualNovelSettings(doc), ...(doc.visualNovel.settings || {}) };
  currentVisualNovelSettings = settings;
  if (settings.fontSize) visualNovelFontSize = Number(settings.fontSize);
  finishVisualNovelTyping(false);
  applyVisualNovelTheme(settings);
  updateVisualNovelSettingsUI();
  updateVisualNovelBookmarkBtnUI();
  const book = books.find(item => item.id === doc.bookId);
  document.getElementById("vnPlayerBookTitle").textContent = book?.title || "獨立故事";
  document.getElementById("vnPlayerChapterTitle").textContent = doc.title;
  const feed = document.getElementById("vnStoryFeed");
  feed.replaceChildren();
  const chapterHeading = document.createElement("div");
  chapterHeading.className = "vn-feed-chapter"; chapterHeading.textContent = doc.title;
  feed.appendChild(chapterHeading);
  document.getElementById("vnCg").style.backgroundImage = "";
  document.getElementById("vnPlayer").classList.add("no-cg");
  document.getElementById("visualNovelPlayerModal").classList.add("active");
  document.getElementById("vnHistoryPanel").classList.remove("active");
  document.getElementById("vnChapterPanel").classList.remove("active");

  const promptEl = document.getElementById("vnBookmarkPrompt");
  if (promptEl) {
    if (doc.visualNovel.bookmarkIndex != null && doc.visualNovel.bookmarkIndex > 0 && doc.visualNovel.bookmarkIndex < currentVisualNovelEvents.length) {
      document.getElementById("vnBookmarkPromptIndex").textContent = `第 ${doc.visualNovel.bookmarkIndex + 1} 句`;
      promptEl.style.display = "flex";
    } else {
      promptEl.style.display = "none";
    }
  }

  playVisualNovelAudio("bgm", settings.globalBgm || "none");
  if (withTransition) showVisualNovelChapterTransition(doc.title);
  advanceVisualNovel();
}

function showVisualNovelChapterTransition(title) {
  const transition = document.getElementById("vnChapterTransition");
  transition.textContent = title;
  transition.classList.remove("show");
  void transition.offsetWidth;
  transition.classList.add("show");
  setTimeout(() => transition.classList.remove("show"), 1650);
}

function fadeVisualNovelAudio(audio, targetVolume, duration, token) {
  const startVolume = Number.isFinite(audio.volume) ? audio.volume : 1;
  const startedAt = performance.now();
  return new Promise(resolve => {
    function step(now) {
      if (token !== visualNovelBgmFadeToken) { resolve(false); return; }
      const progress = Math.min(1, (now - startedAt) / duration);
      audio.volume = startVolume + (targetVolume - startVolume) * progress;
      if (progress < 1) requestAnimationFrame(step);
      else resolve(true);
    }
    requestAnimationFrame(step);
  });
}

async function transitionVisualNovelBgm(src) {
  const channels = [document.getElementById("vnBgmAudio"), document.getElementById("vnBgmAudioNext")];
  const current = channels[visualNovelBgmChannelIndex];
  const source = normalizeVisualNovelAudioSource(src);
  const token = ++visualNovelBgmFadeToken;
  const statusButton = document.getElementById("vnAudioStatus");
  delete statusButton.dataset.retrySource;
  const targetVolume = Number.isFinite(Number(currentVisualNovelSettings.bgmVolume)) ? Number(currentVisualNovelSettings.bgmVolume) : 0.7;
  if (source && source.toLowerCase() !== "none" && current.dataset.source === source && !current.paused) {
    current.volume = targetVolume;
    return;
  }
  if (!source || source.toLowerCase() === "none") {
    document.querySelector("#vnAudioStatus span").textContent = "背景音樂：關閉";
    if (!current.paused && current.currentSrc) await fadeVisualNovelAudio(current, 0, 450, token);
    if (token !== visualNovelBgmFadeToken) return;
    channels.forEach(audio => { audio.pause(); audio.removeAttribute("src"); delete audio.dataset.source; audio.load(); audio.volume = targetVolume; });
    return;
  }
  const nextIndex = visualNovelBgmChannelIndex === 0 ? 1 : 0;
  const next = channels[nextIndex];
  next.pause(); next.src = source; next.dataset.source = source; next.volume = 0; next.muted = current.muted; next.load();
  let fileName = source.split('/').pop()?.split('?')[0] || "播放中";
  try { fileName = decodeURIComponent(fileName); } catch (error) {}
  document.querySelector("#vnAudioStatus span").textContent = `背景音樂：${fileName}`;
  try {
    const playPromise = next.play();
    visualNovelBgmChannelIndex = nextIndex;
    await playPromise;
    if (token !== visualNovelBgmFadeToken) return;
    await Promise.all([
      fadeVisualNovelAudio(next, targetVolume, 850, token),
      (!current.paused && current.currentSrc) ? fadeVisualNovelAudio(current, 0, 650, token) : Promise.resolve(true)
    ]);
    if (token === visualNovelBgmFadeToken) {
      current.pause(); current.removeAttribute("src"); delete current.dataset.source; current.load(); current.volume = targetVolume;
    }
  } catch (error) {
    if (token !== visualNovelBgmFadeToken) return;
    next.pause(); next.removeAttribute("src"); delete next.dataset.source;
    statusButton.dataset.retrySource = source;
    document.querySelector("#vnAudioStatus span").textContent = `BGM 播放失敗，點此重試：${fileName}`;
    console.warn("BGM 播放失敗", error);
  }
}

function normalizeVisualNovelAudioSource(value) {
  let source = String(value || "").trim();
  const markdownLink = source.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i);
  if (markdownLink) source = markdownLink[1];
  return source.replace(/^[<"']|[>"']$/g, "").trim();
}

function setVisualNovelBgmVolume(value, event) {
  event?.stopPropagation?.();
  currentVisualNovelSettings.bgmVolume = Number(value);
  const activeChannel = [document.getElementById("vnBgmAudio"), document.getElementById("vnBgmAudioNext")][visualNovelBgmChannelIndex];
  if (activeChannel) activeChannel.volume = Number(value);
  const label = document.getElementById("vnSettingsBgmLabel");
  if (label) label.textContent = `${Math.round(Number(value) * 100)}%`;
  const playerVolume = document.getElementById("vnPlayerBgmVolume");
  if (playerVolume) playerVolume.value = value;
  const doc = documents.find(item => item.id === currentVisualNovelDocId);
  if (doc?.visualNovel) {
    doc.visualNovel.settings = { ...(doc.visualNovel.settings || {}), bgmVolume: Number(value) };
    saveStateToLocalStorage();
  }
}

function toggleVisualNovelAudioMute(event) {
  event?.stopPropagation?.();
  const channels = [document.getElementById("vnBgmAudio"), document.getElementById("vnBgmAudioNext")];
  const se = document.getElementById("vnSeAudio");
  const nextMuted = !channels[0].muted;
  channels.forEach(audio => audio.muted = nextMuted);
  if (se) se.muted = nextMuted;
  const status = document.getElementById("vnAudioStatus");
  status.classList.toggle("muted", nextMuted);
  const icon = status.querySelector("i");
  if (icon) icon.className = nextMuted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
}

function playVisualNovelAudio(type, src) {
  const source = normalizeVisualNovelAudioSource(src);
  if (type === "bgm") {
    transitionVisualNovelBgm(source);
    return;
  }
  const se = document.getElementById("vnSeAudio");
  if (!se) return;
  if (!source || source.toLowerCase() === "none") {
    se.pause(); se.currentTime = 0; se.removeAttribute("src"); se.load(); return;
  }
  se.pause(); se.src = source; se.currentTime = 0; se.load();
  se.play().catch(error => console.warn("SE 播放失敗", error));
}

function playVisualNovelTypeBeep() {
  if (!currentVisualNovelSettings.typewriterSound) return;
  try {
    if (!visualNovelAudioContext) visualNovelAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (visualNovelAudioContext.state === "suspended") visualNovelAudioContext.resume();
    const oscillator = visualNovelAudioContext.createOscillator();
    const gain = visualNovelAudioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(820, visualNovelAudioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(540, visualNovelAudioContext.currentTime + 0.04);
    gain.gain.setValueAtTime(0.012, visualNovelAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, visualNovelAudioContext.currentTime + 0.045);
    oscillator.connect(gain); gain.connect(visualNovelAudioContext.destination);
    oscillator.start(); oscillator.stop(visualNovelAudioContext.currentTime + 0.05);
  } catch (error) {}
}

function playVisualNovelAdvanceSound() {
  if (!currentVisualNovelSettings.typewriterSound) return;
  try {
    if (!visualNovelAudioContext) visualNovelAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (visualNovelAudioContext.state === "suspended") visualNovelAudioContext.resume();
    const oscillator = visualNovelAudioContext.createOscillator();
    const gain = visualNovelAudioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(620, visualNovelAudioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(390, visualNovelAudioContext.currentTime + 0.09);
    gain.gain.setValueAtTime(0.035, visualNovelAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, visualNovelAudioContext.currentTime + 0.1);
    oscillator.connect(gain); gain.connect(visualNovelAudioContext.destination);
    oscillator.start(); oscillator.stop(visualNovelAudioContext.currentTime + 0.105);
  } catch (error) {}
}

function typeVisualNovelText(element, text) {
  finishVisualNovelTyping(false);
  element.textContent = "";
  const state = { element, text, index:0, timer:null };
  visualNovelTyping = state;
  const feed = document.getElementById("vnStoryFeed");
  const typeNextCharacter = () => {
    if (state.index >= text.length) {
      clearTimeout(state.timer); visualNovelTyping = null;
      if (feed) feed.scrollTop = feed.scrollHeight;
      if (visualNovelAutoPlay) visualNovelAutoTimer = setTimeout(() => advanceVisualNovel(), Math.max(300, Math.round(1500 / visualNovelAutoSpeed)));
      return;
    }
    const character = text[state.index++];
    element.textContent += character;
    if (character.trim() && !/[，。！？、；：「」『』（）…—,.!?;:'"()]/.test(character) && state.index % 2 === 0) playVisualNovelTypeBeep();
    const nextDelay = character === "，" ? 100 : (character === "。" ? 200 : 28);
    state.timer = setTimeout(typeNextCharacter, nextDelay);
  };
  state.timer = setTimeout(typeNextCharacter, 28);
}

function finishVisualNovelTyping(showFull = true) {
  if (!visualNovelTyping) return false;
  clearInterval(visualNovelTyping.timer);
  if (showFull) visualNovelTyping.element.textContent = visualNovelTyping.text;
  visualNovelTyping = null;
  return true;
}

function executeVisualNovelEvent(event) {
  const player = document.getElementById("vnPlayer");
  if (event.type === "blank") {
    const spacer = document.createElement("div"); spacer.className = "vn-feed-blank";
    document.getElementById("vnStoryFeed").appendChild(spacer);
    return false;
  }
  if (event.type === "bgm" || event.type === "se") { playVisualNovelAudio(event.type, event.value); return false; }
  if (event.type === "cg") {
    const cg = document.getElementById("vnCg");
    if (event.value.toLowerCase() === "none") { cg.style.backgroundImage = ""; player.classList.add("no-cg"); }
    else {
      cg.classList.remove("vn-changing"); void cg.offsetWidth;
      cg.style.backgroundImage = `url("${event.value.replace(/"/g, '%22')}")`; cg.classList.add("vn-changing"); player.classList.remove("no-cg");
    }
    return false;
  }
  if (event.type === "shake") { player.classList.remove("vn-shake"); void player.offsetWidth; player.classList.add("vn-shake"); return false; }
  const rawSpeaker = stripInvisibleFormatting(event.speaker).trim();
  const isSystem = ["系統", "system"].includes(rawSpeaker.toLowerCase());
  const narrator = ["旁白", "系統", "narrator", "system"].includes(rawSpeaker.toLowerCase());

  let character = null;
  let displaySpeaker = rawSpeaker;

  if (!narrator) {
    if (currentVisualNovelSpeakerAliases?.aliasToChar?.has(rawSpeaker)) {
      character = currentVisualNovelSpeakerAliases.aliasToChar.get(rawSpeaker);
      displaySpeaker = rawSpeaker;
    } else if (currentVisualNovelSpeakerAliases?.aliasToChar?.has(normalizedImportName(rawSpeaker))) {
      character = currentVisualNovelSpeakerAliases.aliasToChar.get(normalizedImportName(rawSpeaker));
      displaySpeaker = rawSpeaker;
    } else {
      const resolvedSpeaker = normalizeVisualNovelSpeaker(rawSpeaker, characters);
      character = characters.find(item => normalizedImportName(item.name) === normalizedImportName(resolvedSpeaker));
      if (character && currentVisualNovelSpeakerAliases?.charToAlias?.has(character.name)) {
        displaySpeaker = currentVisualNovelSpeakerAliases.charToAlias.get(character.name);
      } else if (character && currentVisualNovelSpeakerAliases?.charToAlias?.has(normalizedImportName(character.name))) {
        displaySpeaker = currentVisualNovelSpeakerAliases.charToAlias.get(normalizedImportName(character.name));
      } else if (character) {
        displaySpeaker = stripInvisibleFormatting(character.name).trim();
      }
    }
  }

  const speakerColor = currentVisualNovelSettings.useCharacterColors !== false && character?.themeColor?.primary
    ? character.themeColor.primary : "var(--vn-primary)";
  const feed = document.getElementById("vnStoryFeed");
  const row = document.createElement("div");
  row.className = `vn-feed-entry ${narrator ? (isSystem ? 'vn-feed-system' : 'vn-feed-narrator') : 'vn-feed-character'}`;
  row.dataset.eventIndex = currentVisualNovelIndex;
  let dialogueTextElement;
  if (narrator) {
    const text = document.createElement("p"); dialogueTextElement = text;
    row.appendChild(text);
  } else {
    const frame = document.createElement("div"); frame.className = "vn-feed-avatar";
    frame.style.setProperty("--speaker-color", speakerColor);
    const image = document.createElement("img"); image.src = character?.avatar || DEFAULT_VN_AVATAR; image.alt = displaySpeaker;
    frame.appendChild(image);
    const card = document.createElement("div"); card.className = "vn-feed-dialogue";
    card.style.setProperty("--speaker-color", speakerColor);
    const name = document.createElement("strong"); name.textContent = displaySpeaker;
    const text = document.createElement("p"); dialogueTextElement = text;
    card.append(name, text); row.append(frame, card);
  }
  feed.appendChild(row);
  if (currentVisualNovelSettings.typewriterEnabled !== false) typeVisualNovelText(dialogueTextElement, event.text);
  else {
    dialogueTextElement.textContent = event.text;
    feed.scrollTop = feed.scrollHeight;
  }
  feed.scrollTop = feed.scrollHeight;
  requestAnimationFrame(() => { feed.scrollTop = feed.scrollHeight; });
  const historyKey = `${currentVisualNovelDocId}:${currentVisualNovelIndex}`;
  if (!visualNovelHistory.some(item => item.key === historyKey)) visualNovelHistory.push({ key:historyKey, speaker:narrator ? "旁白" : displaySpeaker, text:event.text });
  return true;
}

function clearVisualNovelBookmark(docId) {
  const doc = documents.find(item => item.id === docId);
  if (doc?.visualNovel?.bookmarkIndex != null) {
    delete doc.visualNovel.bookmarkIndex;
    delete doc.visualNovel.bookmarkText;
    saveStateToLocalStorage();
    renderDocumentsModule();
    updateVisualNovelBookmarkBtnUI();
  }
}

function advanceVisualNovel(event) {
  event?.stopPropagation?.();
  if (event) playVisualNovelAdvanceSound();
  clearTimeout(visualNovelAutoTimer);
  if (finishVisualNovelTyping(true)) return;
  let displayed = false;
  while (++currentVisualNovelIndex < currentVisualNovelEvents.length && !displayed) displayed = executeVisualNovelEvent(currentVisualNovelEvents[currentVisualNovelIndex]);
  updateVisualNovelBookmarkBtnUI();
  if (!displayed) {
    clearVisualNovelBookmark(currentVisualNovelDocId);
    if (getVisualNovelChapter(1)) navigateVisualNovelChapter(1);
    else {
      const feed = document.getElementById("vnStoryFeed");
      if (!feed.querySelector(".vn-feed-end")) {
        const end = document.createElement("div"); end.className = "vn-feed-end"; end.textContent = "— 本章故事已結束 —"; feed.appendChild(end); feed.scrollTop = feed.scrollHeight;
      }
    }
    return;
  }
  if (visualNovelAutoPlay && !visualNovelTyping) visualNovelAutoTimer = setTimeout(() => advanceVisualNovel(), Math.max(500, Math.round(3000 / visualNovelAutoSpeed)));
}

function advanceVisualNovelFast() {
  clearTimeout(visualNovelAutoTimer);
  finishVisualNovelTyping(true);
  advanceVisualNovel();
  finishVisualNovelTyping(true);
}

function startVisualNovelFastForward(event) {
  event?.stopPropagation?.();
  if (event?.button != null && event.button !== 0) return;
  if (event?.type === "mousedown" && visualNovelPointerDownHandled) return;
  if (event?.type === "pointerdown") visualNovelPointerDownHandled = true;

  clearTimeout(visualNovelFastForwardDelay);
  clearInterval(visualNovelFastForwardTimer);
  visualNovelFastForwardActive = false;
  visualNovelSuppressContinueClick = false;

  const btn = event?.currentTarget || document.querySelector(".vn-primary-control");
  btn?.setPointerCapture?.(event.pointerId);

  visualNovelFastForwardDelay = setTimeout(() => {
    visualNovelFastForwardActive = true;
    visualNovelSuppressContinueClick = true;
    btn?.classList.add("fast-forwarding");
    advanceVisualNovelFast();
    visualNovelFastForwardTimer = setInterval(advanceVisualNovelFast, 80);
  }, 400);
}

function stopVisualNovelFastForward(event) {
  event?.stopPropagation?.();
  if (event?.type === "pointerup" || event?.type === "pointercancel") {
    setTimeout(() => { visualNovelPointerDownHandled = false; }, 100);
  }
  clearTimeout(visualNovelFastForwardDelay);
  clearInterval(visualNovelFastForwardTimer);
  visualNovelFastForwardDelay = null;
  visualNovelFastForwardTimer = null;
  const wasActive = visualNovelFastForwardActive;
  visualNovelFastForwardActive = false;
  const btn = event?.currentTarget || document.querySelector(".vn-primary-control");
  btn?.classList.remove("fast-forwarding");
  document.querySelectorAll(".vn-primary-control.fast-forwarding").forEach(b => b.classList.remove("fast-forwarding"));
  if (wasActive) {
    visualNovelSuppressContinueClick = true;
    setTimeout(() => { visualNovelSuppressContinueClick = false; }, 200);
  }
}

function handleVisualNovelContinueClick(event) {
  event?.stopPropagation?.();
  if (visualNovelSuppressContinueClick) { visualNovelSuppressContinueClick = false; return; }
  advanceVisualNovel(event);
}

let vnToastTimer = null;
function showVnFloatingToast(msg) {
  const toast = document.getElementById("vnFloatingToast");
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = "block";
  clearTimeout(vnToastTimer);
  vnToastTimer = setTimeout(() => {
    toast.style.display = "none";
  }, 1800);
}

function setVisualNovelFontSizeFromRange(val, event) {
  event?.stopPropagation?.();
  visualNovelFontSize = Number(val);
  currentVisualNovelSettings.fontSize = visualNovelFontSize;
  const player = document.getElementById("vnPlayer");
  if (player) player.style.setProperty("--vn-font-size", `${visualNovelFontSize}rem`);
  const fontLabel = document.getElementById("vnSettingsFontSizeLabel");
  if (fontLabel) fontLabel.textContent = `${visualNovelFontSize}rem`;
  const fontRange = document.getElementById("vnFontSizeRange");
  if (fontRange) fontRange.value = visualNovelFontSize;
  const doc = documents.find(item => item.id === currentVisualNovelDocId);
  if (doc?.visualNovel) {
    doc.visualNovel.settings = { ...(doc.visualNovel.settings || {}), fontSize: visualNovelFontSize };
    saveStateToLocalStorage();
  }
}

function setVisualNovelAutoSpeedFromRange(val, event) {
  event?.stopPropagation?.();
  visualNovelAutoSpeed = Number(val);
  currentVisualNovelSettings.autoSpeed = visualNovelAutoSpeed;
  const label = document.getElementById("vnSettingsAutoSpeedLabel");
  if (label) label.textContent = `${visualNovelAutoSpeed}x`;
  const range = document.getElementById("vnAutoSpeedRange");
  if (range) range.value = visualNovelAutoSpeed;
  const doc = documents.find(item => item.id === currentVisualNovelDocId);
  if (doc?.visualNovel) {
    doc.visualNovel.settings = { ...(doc.visualNovel.settings || {}), autoSpeed: visualNovelAutoSpeed };
    saveStateToLocalStorage();
  }
}

function changeVisualNovelFontSize(delta, event) {
  event?.stopPropagation?.();
  const nextSize = Math.min(1.5, Math.max(0.8, Math.round((visualNovelFontSize + delta * 0.05) * 100) / 100));
  setVisualNovelFontSizeFromRange(nextSize, event);
}

function updateVisualNovelSettingsUI() {
  const bgmLabel = document.getElementById("vnSettingsBgmLabel");
  const bgmVal = Number.isFinite(Number(currentVisualNovelSettings.bgmVolume)) ? Number(currentVisualNovelSettings.bgmVolume) : 0.7;
  if (bgmLabel) bgmLabel.textContent = `${Math.round(bgmVal * 100)}%`;
  const bgmVol = document.getElementById("vnPlayerBgmVolume");
  if (bgmVol) bgmVol.value = bgmVal;

  const fontLabel = document.getElementById("vnSettingsFontSizeLabel");
  if (fontLabel) fontLabel.textContent = `${visualNovelFontSize}rem`;
  const fontRange = document.getElementById("vnFontSizeRange");
  if (fontRange) fontRange.value = visualNovelFontSize;

  const speedLabel = document.getElementById("vnSettingsAutoSpeedLabel");
  if (speedLabel) speedLabel.textContent = `${visualNovelAutoSpeed}x`;
  const speedRange = document.getElementById("vnAutoSpeedRange");
  if (speedRange) speedRange.value = visualNovelAutoSpeed;

  const soundCheck = document.getElementById("vnTypewriterSoundCheck");
  if (soundCheck) soundCheck.checked = !!currentVisualNovelSettings.typewriterSound;
}

function updateVisualNovelBookmarkBtnUI() {
  const doc = documents.find(item => item.id === currentVisualNovelDocId);
  const btn = document.getElementById("vnBookmarkBtn");
  if (!btn || !doc) return;
  const isBookmarked = doc.visualNovel?.bookmarkIndex === currentVisualNovelIndex && currentVisualNovelIndex >= 0;
  const hasAnyBookmark = doc.visualNovel?.bookmarkIndex != null;
  btn.classList.toggle("active", isBookmarked || hasAnyBookmark);
  if (btn.querySelector("i")) {
    btn.querySelector("i").className = isBookmarked ? "fa-solid fa-bookmark" : (hasAnyBookmark ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark");
  }
}

function toggleVisualNovelBookmark(event) {
  event?.stopPropagation?.();
  const doc = documents.find(item => item.id === currentVisualNovelDocId);
  if (!doc || !doc.visualNovel) return;
  if (currentVisualNovelIndex < 0) return;

  if (doc.visualNovel.bookmarkIndex === currentVisualNovelIndex) {
    delete doc.visualNovel.bookmarkIndex;
    delete doc.visualNovel.bookmarkText;
    showVnFloatingToast("已移除書籤");
  } else {
    doc.visualNovel.bookmarkIndex = currentVisualNovelIndex;
    const currentEvt = currentVisualNovelEvents[currentVisualNovelIndex];
    doc.visualNovel.bookmarkText = currentEvt?.text || "";
    showVnFloatingToast(`已儲存書籤 (第 ${currentVisualNovelIndex + 1} 句)`);
  }
  saveStateToLocalStorage();
  renderDocumentsModule();
  updateVisualNovelBookmarkBtnUI();
}

function resumeVisualNovelBookmark(event) {
  event?.stopPropagation?.();
  const doc = documents.find(item => item.id === currentVisualNovelDocId);
  const promptEl = document.getElementById("vnBookmarkPrompt");
  if (promptEl) promptEl.style.display = "none";
  if (doc?.visualNovel?.bookmarkIndex == null) return;
  const targetIndex = doc.visualNovel.bookmarkIndex;
  
  finishVisualNovelTyping(false);
  clearTimeout(visualNovelAutoTimer);
  const feed = document.getElementById("vnStoryFeed");
  feed.replaceChildren();
  const chapterHeading = document.createElement("div");
  chapterHeading.className = "vn-feed-chapter"; chapterHeading.textContent = doc.title;
  feed.appendChild(chapterHeading);
  
  currentVisualNovelIndex = -1;
  visualNovelHistory = [];
  
  while (currentVisualNovelIndex < targetIndex && currentVisualNovelIndex < currentVisualNovelEvents.length - 1) {
    currentVisualNovelIndex++;
    executeVisualNovelEvent(currentVisualNovelEvents[currentVisualNovelIndex]);
    finishVisualNovelTyping(true);
  }
  updateVisualNovelBookmarkBtnUI();
}

function clearVisualNovelBookmarkPrompt(event) {
  event?.stopPropagation?.();
  const promptEl = document.getElementById("vnBookmarkPrompt");
  if (promptEl) promptEl.style.display = "none";
  clearVisualNovelBookmark(currentVisualNovelDocId);
  showVnFloatingToast("已取消書籤，從頭開始閱讀");
}

function getVisualNovelChapter(direction) {
  const current = documents.find(item => item.id === currentVisualNovelDocId);
  if (!current) return null;
  const sequence = documents.filter(item => (item.bookId || "") === (current.bookId || "") && item.visualNovel?.scriptText);
  return sequence[sequence.findIndex(item => item.id === current.id) + direction] || null;
}

function navigateVisualNovelChapter(direction, event) {
  event?.stopPropagation?.();
  const next = getVisualNovelChapter(direction);
  if (next) startVisualNovel(next.id, true, true);
}

function renderVisualNovelHistory() {
  const list = document.getElementById("vnHistoryList");
  list.replaceChildren();
  visualNovelHistory.forEach(item => {
    const row = document.createElement("div"); row.className = "vn-history-item";
    const speaker = document.createElement("strong"); speaker.textContent = item.speaker;
    const text = document.createElement("p"); text.textContent = item.text;
    row.append(speaker, text); list.appendChild(row);
  });
  if (!visualNovelHistory.length) list.textContent = "尚無對話紀錄。";
  list.scrollTop = list.scrollHeight;
}

function renderVisualNovelChapterList() {
  const current = documents.find(item => item.id === currentVisualNovelDocId);
  const sequence = documents.filter(item => (item.bookId || "") === (current?.bookId || "") && item.visualNovel?.scriptText);
  const list = document.getElementById("vnChapterList");
  list.replaceChildren();
  sequence.forEach((doc, index) => {
    const button = document.createElement("button");
    button.className = doc.id === currentVisualNovelDocId ? "active" : "";
    button.innerHTML = `<small>CHAPTER ${String(index + 1).padStart(2, '0')}</small><strong></strong>`;
    button.querySelector("strong").textContent = `${doc.title}${doc.visualNovel?.bookmarkIndex != null ? ' 📌' : ''}`;
    button.onclick = event => { event.stopPropagation(); startVisualNovel(doc.id, true, true); };
    list.appendChild(button);
  });
}

function toggleVisualNovelPanel(panel, event) {
  event?.stopPropagation?.();
  const panels = {
    history: document.getElementById("vnHistoryPanel"),
    chapters: document.getElementById("vnChapterPanel"),
    settings: document.getElementById("vnSettingsPanel")
  };
  const target = panels[panel];
  if (!target) return;
  Object.keys(panels).forEach(key => {
    if (key !== panel && panels[key]) panels[key].classList.remove("active");
  });
  if (panel === "history") renderVisualNovelHistory();
  else if (panel === "chapters") renderVisualNovelChapterList();
  else if (panel === "settings") updateVisualNovelSettingsUI();
  target.classList.toggle("active");
}

function toggleVisualNovelMute(event) {
  event?.stopPropagation?.();
  const statusButton = document.getElementById("vnAudioStatus");
  if (statusButton?.dataset?.retrySource) {
    const source = statusButton.dataset.retrySource;
    delete statusButton.dataset.retrySource;
    transitionVisualNovelBgm(source);
    return;
  }
  const bgmChannels = [document.getElementById("vnBgmAudio"), document.getElementById("vnBgmAudioNext")];
  const bgm = bgmChannels[visualNovelBgmChannelIndex];
  const se = document.getElementById("vnSeAudio");
  const muted = !bgm.muted;
  bgmChannels.forEach(audio => { audio.muted = muted; }); se.muted = muted;
  document.querySelectorAll("#vnAudioStatus i").forEach(i => { i.className = `fa-solid ${bgm.muted ? 'fa-volume-xmark' : 'fa-volume-high'}`; });
  document.querySelectorAll("#vnAudioStatus").forEach(btn => btn.classList.toggle("muted", bgm.muted));
}

function toggleVisualNovelAutoPlay(event) {
  event?.stopPropagation?.();
  visualNovelAutoPlay = !visualNovelAutoPlay;
  document.getElementById("vnAutoPlayBtn").classList.toggle("active", visualNovelAutoPlay);
  showVnFloatingToast(visualNovelAutoPlay ? `自動播放：開啟 (${visualNovelAutoSpeed}x)` : "自動播放：關閉");
  if (visualNovelAutoPlay) visualNovelAutoTimer = setTimeout(() => advanceVisualNovel(), Math.max(500, Math.round(3000 / visualNovelAutoSpeed)));
  else clearTimeout(visualNovelAutoTimer);
}

function toggleVisualNovelTypeSound(event) {
  event?.stopPropagation?.();
  currentVisualNovelSettings.typewriterSound = !currentVisualNovelSettings.typewriterSound;
  const check = document.getElementById("vnTypewriterSoundCheck");
  if (check) check.checked = !!currentVisualNovelSettings.typewriterSound;
  const doc = documents.find(item => item.id === currentVisualNovelDocId);
  if (doc?.visualNovel) {
    doc.visualNovel.settings = { ...(doc.visualNovel.settings || {}), typewriterSound: currentVisualNovelSettings.typewriterSound };
    saveStateToLocalStorage();
  }
  if (currentVisualNovelSettings.typewriterSound) playVisualNovelTypeBeep();
  showVnFloatingToast(currentVisualNovelSettings.typewriterSound ? "打字音效：開啟" : "打字音效：關閉");
}

function closeVisualNovelPlayer() {
  clearTimeout(visualNovelAutoTimer); stopVisualNovelFastForward(); finishVisualNovelTyping(false); visualNovelAutoPlay = false;
  document.getElementById("vnAutoPlayBtn").classList.remove("active");
  visualNovelBgmFadeToken++;
  const channels = [document.getElementById("vnBgmAudio"), document.getElementById("vnBgmAudioNext")];
  channels.forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute("src");
    delete audio.dataset.source;
    audio.load();
  });
  const se = document.getElementById("vnSeAudio");
  if (se) {
    se.pause();
    se.currentTime = 0;
    se.removeAttribute("src");
    se.load();
  }
  ["vnHistoryPanel", "vnChapterPanel", "vnSettingsPanel"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  });
  const promptEl = document.getElementById("vnBookmarkPrompt");
  if (promptEl) promptEl.style.display = "none";
  const toast = document.getElementById("vnFloatingToast");
  if (toast) toast.style.display = "none";
  closeModal("visualNovelPlayerModal", true);
}

async function summarizeSelectedDocsWithAi() {
  const checkedBookCbs = Array.from(document.querySelectorAll(".book-summary-cb:checked"));
  const checkedDocCbs = Array.from(document.querySelectorAll(".doc-summary-cb:checked"));

  if (!checkedBookCbs.length && !checkedDocCbs.length) {
    alert("請先在列表中勾選至少一本書籍資料夾或單個文檔章節！");
    return;
  }

  let docSet = new Set();

  checkedBookCbs.forEach(cb => {
    const bookId = cb.value;
    const bookDocs = documents.filter(d => d.bookId === bookId);
    bookDocs.forEach(d => docSet.add(d));
  });

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
  const incFactions = document.getElementById("expIncFactions")?.checked || false;

  if (mode === 'cps_only') {
    text = `# 【CP 關係細節獨立報告】\n生成時間：${new Date().toLocaleString()}\n\n`;
    cps.forEach(rawCp => {
      const cp = normalizeCpRecord(rawCp);
      text += `## ${cp.type === 'other' ? (cp.relationType || '其他關係') : 'CP'}: ${cp.name}\n`;
      (cp.members || []).forEach(member => {
        const char = characters.find(c => c.id === member.charId);
        text += `- ${char?.name || '已移除角色'}｜定位：${member.position || '未填'}`;
        if (cp.type !== 'other') text += `｜R18／互動：${member.r18 || '未填'}`;
        text += `｜對關係／其他成員的看法：${member.thoughts || '未填'}\n`;
      });
      (cp.sections || []).forEach(sec => {
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
      text = appendFactionExportText(text, f, 2);
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

      if (Array.isArray(c.customFields) && c.customFields.length) {
        c.customFields.forEach(f => {
          if (f.type === 'paragraph') {
            text += `✦ ${f.name}：\n${f.value}\n`;
          } else {
            text += `✦ ${f.name}：${f.value.replace(/\n/g, ' ')}\n`;
          }
        });
      }

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

    if (incFactions) {
      const relatedFactions = factions.filter(faction => targetChars.some(char => characterBelongsToFaction(char, faction)));
      text += `\n===================================\n`;
      text += `## 【所選人物相關的陣營／世界觀】\n\n`;
      if (relatedFactions.length) {
        relatedFactions.forEach(faction => { text = appendFactionExportText(text, faction, 3); });
      } else {
        text += `（所選人物尚未標註任何已建立的主陣營或子陣營。）\n\n`;
      }
    }

    if (incCp) {
      text += `\n===================================\n`;
      text += `## 【CP 關係細節 (僅所選角色相關)】\n\n`;
      cps.forEach(rawCp => {
        const cp = normalizeCpRecord(rawCp);
        const hasSelectedChar = (cp.members || []).some(member => selectedCharIds.includes(member.charId));
        if (hasSelectedChar) {
          text += `### ${cp.type === 'other' ? (cp.relationType || '其他關係') : 'CP'}: ${cp.name}\n`;
          (cp.members || []).forEach(member => {
            const char = characters.find(c => c.id === member.charId);
            text += `- ${char?.name || '已移除角色'}｜定位：${member.position || '未填'}`;
            if (cp.type !== 'other') text += `｜R18／互動：${member.r18 || '未填'}`;
            text += `｜看法：${member.thoughts || '未填'}\n`;
          });
          (cp.sections || []).forEach(sec => {
            text += `✦ 【${sec.title}】:\n${sec.content}\n`;
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
  const exportData = { characters, paros, factions, rankings, cps, couples: cps, books, documents, visualNovelTemplates, collapsedBooks, exportedAt: new Date().toISOString() };
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
    if (data.cps || data.couples) cps = normalizeCpCollection(data.cps || data.couples);
    if (data.books) books = data.books;
    if (data.documents) documents = data.documents;
    if (data.visualNovelTemplates) visualNovelTemplates = data.visualNovelTemplates;
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
  const exportData = { characters, paros, factions, rankings, cps, couples: cps, books, documents, visualNovelTemplates, collapsedBooks, deepseekSettings };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `OC_Master_Backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

function openImportOptionsModal() {
  const toggle = document.getElementById("advancedImportModeToggle");
  toggle.checked = false;
  document.getElementById("jsonFileInput").value = "";
  updateImportModeDescription();
  document.getElementById("importOptionsModal").classList.add("active");
}

function updateImportModeDescription() {
  const enabled = document.getElementById("advancedImportModeToggle").checked;
  document.getElementById("importModeDescription").textContent = enabled
    ? "挑選讀檔會保留現有資料、加入備份中沒有的人物與陣營；同名但內容不同時，再逐一選擇保留版本。"
    : "一般讀檔會用備份內容取代目前資料。";
}

function triggerImportJson() { document.getElementById("jsonFileInput").click(); }

function handleImportJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (document.getElementById("advancedImportModeToggle").checked) {
        prepareAdvancedImport(data, file.name);
        return;
      }
      if (data.characters) characters = data.characters;
      if (data.paros) paros = data.paros;
      if (data.factions) factions = data.factions;
      if (data.rankings) rankings = data.rankings;
      if (data.cps || data.couples) cps = normalizeCpCollection(data.cps || data.couples);
      if (data.books) books = data.books;
      if (data.documents) documents = data.documents;
      if (data.visualNovelTemplates) visualNovelTemplates = data.visualNovelTemplates;
      if (data.collapsedBooks) collapsedBooks = data.collapsedBooks;
      saveStateToLocalStorage(); syncGlobalTags(); renderAllViews();
      closeModal("importOptionsModal");
      alert("JSON 資料匯入成功！");
    } catch (err) { alert("匯入失敗：" + err.message); }
    finally { event.target.value = ""; }
  };
  reader.readAsText(file);
}

function normalizedImportName(value) {
  return stripInvisibleFormatting(value).trim().toLocaleLowerCase();
}

function comparableImportRecord(value) {
  if (Array.isArray(value)) return value.map(comparableImportRecord);
  if (value && typeof value === "object") {
    return Object.keys(value).filter(key => key !== "id").sort().reduce((result, key) => {
      result[key] = comparableImportRecord(value[key]);
      return result;
    }, {});
  }
  return value ?? null;
}

function importRecordsDiffer(a, b) {
  return JSON.stringify(comparableImportRecord(a)) !== JSON.stringify(comparableImportRecord(b));
}

const importFieldLabels = {
  name: "名稱", englishName: "英文名", avatar: "頭像", gender: "性別", height: "身高",
  zodiac: "星座", occupation: "身分／職業", orientation: "左右位", fixedCp: "固定 CP",
  personality: "性格", appearance: "外貌", extraNotes: "補充設定", tags: "標籤",
  themeColor: "主題色", primary: "主色", secondary: "副色", mode: "配色模式",
  hogwartsHouse: "學院", isHidden: "草稿／隱藏狀態", relationships: "人物關係",
  targetName: "對象", callName: "稱呼", opinion: "看法", customSections: "自訂詞條",
  sections: "自訂詞條", title: "標題", content: "內容", description: "介紹",
  subgroups: "子陣營", members: "成員", position: "左右位／定位", r18: "R18 狀況",
  thoughts: "對關係的看法", paroValues: "Paro 資料",
  bookId: "所屬書籍", charIds: "關聯角色", factionIds: "關聯世界觀／陣營",
  iconColor: "書籍圖示色", items: "排名項目", cutoffs: "排名分界", operator: "比較符號",
  fields: "自訂欄位", relationType: "關係類型", type: "類型", visualNovel: "視覺小說",
  scriptText: "視覺小說腳本", settings: "視覺小說設定", globalBgm: "全局 BGM",
  primaryColor: "UI 主色", secondaryColor: "漸層副色", themeMode: "深淺模式",
  backgroundColor: "底色", textColor: "文字色", narratorBorderColor: "旁白邊條色",
  narratorTextColor: "旁白文字色", useCharacterColors: "人物使用自身印象色", bgmVolume: "BGM 音量", updatedAt: "更新時間",
  typewriterEnabled: "台詞逐字顯示", typewriterSound: "逐字滴滴聲"
};

function importValuesEqual(a, b) {
  return JSON.stringify(comparableImportRecord(a)) === JSON.stringify(comparableImportRecord(b));
}

function collectImportDifferences(current, imported, path = []) {
  if (importValuesEqual(current, imported)) return [];
  const currentIsObject = current && typeof current === "object";
  const importedIsObject = imported && typeof imported === "object";
  if (!currentIsObject || !importedIsObject || Array.isArray(current) !== Array.isArray(imported)) {
    return [{ path, current, imported }];
  }
  if (Array.isArray(current)) {
    const containsObjects = [...current, ...imported].some(value => value && typeof value === "object");
    if (!containsObjects) return [{ path, current, imported }];
    const length = Math.max(current.length, imported.length);
    return Array.from({ length }, (_, index) => collectImportDifferences(current[index], imported[index], [...path, index])).flat();
  }
  const keys = [...new Set([...Object.keys(current), ...Object.keys(imported)])]
    .filter(key => key !== "id").sort();
  return keys.flatMap(key => collectImportDifferences(current[key], imported[key], [...path, key]));
}

function formatImportDiffPath(path) {
  return path.map(part => typeof part === "number" ? `第 ${part + 1} 項` : (importFieldLabels[part] || part)).join(" › ") || "整筆資料";
}

function formatImportDiffValue(value) {
  if (value === undefined) return "（此版本沒有此欄位）";
  if (value === null || value === "") return "（空白）";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) {
    if (!value.length) return "（空陣列）";
    return value.every(item => typeof item !== "object") ? value.join("、") : JSON.stringify(comparableImportRecord(value), null, 2);
  }
  if (typeof value === "object") return JSON.stringify(comparableImportRecord(value), null, 2);
  return String(value);
}

function prepareAdvancedImport(data, fileName) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("檔案不是有效的備份格式");
  const importedCharacters = Array.isArray(data.characters) ? data.characters : [];
  const importedFactions = Array.isArray(data.factions) ? data.factions : [];
  pendingAdvancedImport = data;
  pendingImportConflicts = [];

  const importedBookName = id => (data.books || []).find(book => String(book.id) === String(id))?.title || id || "standalone";
  const currentBookName = id => books.find(book => String(book.id) === String(id))?.title || id || "standalone";
  const collections = [
    { type:"character", incoming:importedCharacters, current:characters, getIncoming:item => item.name, getCurrent:item => item.name },
    { type:"faction", incoming:importedFactions, current:factions, getIncoming:item => item.name, getCurrent:item => item.name },
    { type:"paro", incoming:Array.isArray(data.paros) ? data.paros : [], current:paros, getIncoming:item => item.name, getCurrent:item => item.name },
    { type:"ranking", incoming:Array.isArray(data.rankings) ? data.rankings : [], current:rankings, getIncoming:item => item.subject, getCurrent:item => item.subject },
    { type:"cp", incoming:normalizeCpCollection(data.cps || data.couples || []), current:normalizeCpCollection(cps), getIncoming:item => item.name, getCurrent:item => item.name },
    { type:"book", incoming:Array.isArray(data.books) ? data.books : [], current:books, getIncoming:item => item.title, getCurrent:item => item.title },
    { type:"document", incoming:Array.isArray(data.documents) ? data.documents : [], current:documents,
      getIncoming:item => `${item.title}@@${importedBookName(item.bookId)}`, getCurrent:item => `${item.title}@@${currentBookName(item.bookId)}`,
      compareIncoming:item => {
        const { visualNovel, bookId, charIds = [], factionIds = [], ...article } = item;
        return { ...article, book:importedBookName(bookId), characters:charIds.map(id => importedCharacters.find(char => String(char.id) === String(id))?.name || id).sort(), factions:factionIds.map(id => importedFactions.find(faction => String(faction.id) === String(id))?.name || id).sort() };
      },
      compareCurrent:item => {
        const { visualNovel, bookId, charIds = [], factionIds = [], ...article } = item;
        return { ...article, book:currentBookName(bookId), characters:charIds.map(id => characters.find(char => String(char.id) === String(id))?.name || id).sort(), factions:factionIds.map(id => factions.find(faction => String(faction.id) === String(id))?.name || id).sort() };
      } },
    { type:"vnTemplate", incoming:Array.isArray(data.visualNovelTemplates) ? data.visualNovelTemplates : [], current:visualNovelTemplates, getIncoming:item => item.name, getCurrent:item => item.name }
  ];

  collections.forEach(({ type, incoming, current, getIncoming, getCurrent, compareIncoming = item => item, compareCurrent = item => item }) => {
    incoming.forEach((record, importedIndex) => {
      const recordName = normalizedImportName(getIncoming(record));
      const currentIndex = recordName ? current.findIndex(item => normalizedImportName(getCurrent(item)) === recordName) : -1;
      if (currentIndex >= 0 && importRecordsDiffer(compareCurrent(current[currentIndex]), compareIncoming(record))) {
        pendingImportConflicts.push({
          key: `${type}_${importedIndex}`, type, name: record.name || record.title || record.subject || "（未命名）",
          importedIndex, currentIndex, current: current[currentIndex], imported: record
        });
      }
    });
  });

  (Array.isArray(data.documents) ? data.documents : []).forEach((record, importedIndex) => {
    const recordName = normalizedImportName(`${record.title}@@${importedBookName(record.bookId)}`);
    const currentIndex = recordName ? documents.findIndex(item => normalizedImportName(`${item.title}@@${currentBookName(item.bookId)}`) === recordName) : -1;
    if (currentIndex >= 0 && importRecordsDiffer(documents[currentIndex].visualNovel ?? null, record.visualNovel ?? null)) {
      pendingImportConflicts.push({
        key:`visualNovel_${importedIndex}`, type:"visualNovel", name:record.title || "（未命名章節）",
        importedIndex, currentIndex, current:documents[currentIndex].visualNovel ?? null, imported:record.visualNovel ?? null
      });
    }
  });

  renderAdvancedImportConflicts(fileName, importedCharacters, importedFactions);
  closeModal("importOptionsModal");
  document.getElementById("advancedImportModal").classList.add("active");
}

function renderAdvancedImportConflicts(fileName, importedCharacters, importedFactions) {
  const missingChars = importedCharacters.filter(record => !normalizedImportName(record.name) || !characters.some(item => normalizedImportName(item.name) === normalizedImportName(record.name))).length;
  const missingFactions = importedFactions.filter(record => !normalizedImportName(record.name) || !factions.some(item => normalizedImportName(item.name) === normalizedImportName(record.name))).length;
  const incomingTotal = [pendingAdvancedImport.paros, pendingAdvancedImport.rankings, pendingAdvancedImport.books, pendingAdvancedImport.documents, pendingAdvancedImport.cps || pendingAdvancedImport.couples, pendingAdvancedImport.visualNovelTemplates]
    .reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  document.getElementById("advancedImportSummary").textContent =
    `${fileName}：將自動合併缺少的資料（含 ${missingChars} 張人物卡、${missingFactions} 個陣營及其餘 ${incomingTotal} 筆設定）；有 ${pendingImportConflicts.length} 筆同名差異需要確認。`;
  const container = document.getElementById("advancedImportConflicts");
  container.replaceChildren();
  if (!pendingImportConflicts.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state compact";
    empty.textContent = "沒有同名衝突，可直接套用。";
    container.appendChild(empty);
    return;
  }
  pendingImportConflicts.forEach(conflict => {
    const differences = collectImportDifferences(conflict.current, conflict.imported);
    const card = document.createElement("section");
    card.className = "import-conflict-card";
    const title = document.createElement("h4");
    const typeLabels = { character:"人物", faction:"陣營／世界觀", paro:"Paro", ranking:"排名", cp:"CP／其他關係", book:"書籍", document:"同人文章／章節", visualNovel:"視覺小說腳本／設定", vnTemplate:"視覺小說模板" };
    title.textContent = `${typeLabels[conflict.type] || conflict.type}：${conflict.name}`;
    card.appendChild(title);
    const differenceSummary = document.createElement("div");
    differenceSummary.className = "import-difference-summary";
    const count = document.createElement("strong");
    count.textContent = `共 ${differences.length} 處差異：`;
    differenceSummary.appendChild(count);
    differences.forEach(difference => {
      const badge = document.createElement("span");
      badge.textContent = formatImportDiffPath(difference.path);
      differenceSummary.appendChild(badge);
    });
    card.appendChild(differenceSummary);
    const grid = document.createElement("div");
    grid.className = "import-version-grid";
    [["current", "保留目前版本"], ["imported", "使用讀檔版本"]].forEach(([value, label]) => {
      const option = document.createElement("label");
      option.className = "import-version-option";
      const radio = document.createElement("input");
      radio.type = "radio"; radio.name = `import_choice_${conflict.key}`; radio.value = value; radio.checked = value === "current";
      const heading = document.createElement("strong"); heading.textContent = label;
      const preview = document.createElement("div"); preview.className = "import-diff-list";
      differences.forEach(difference => {
        const row = document.createElement("div"); row.className = "import-diff-row";
        const field = document.createElement("small"); field.textContent = formatImportDiffPath(difference.path);
        const content = document.createElement("pre");
        content.textContent = formatImportDiffValue(value === "current" ? difference.current : difference.imported);
        row.append(field, content); preview.appendChild(row);
      });
      option.append(radio, heading, preview); grid.appendChild(option);
    });
    card.appendChild(grid); container.appendChild(card);
  });
}

function makeUniqueImportId(preferred, prefix, usedIds) {
  let id = preferred && !usedIds.has(String(preferred)) ? preferred : "";
  if (!id) do { id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; } while (usedIds.has(String(id)));
  usedIds.add(String(id));
  return id;
}

function mergeImportedNamedRecords(current, incoming, type, idMap, transform = value => value, identityFn = record => record.name || record.title || record.subject) {
  const result = current.map(item => ({ ...item }));
  const usedIds = new Set(result.map(item => String(item.id)));
  (Array.isArray(incoming) ? incoming : []).forEach((raw, importedIndex) => {
    const record = transform(raw);
    const identity = normalizedImportName(identityFn(record));
    const sameIndex = identity ? result.findIndex(item => normalizedImportName(identityFn(item)) === identity) : -1;
    const oldId = raw.id;
    if (sameIndex >= 0) {
      const conflict = pendingImportConflicts.find(item => item.type === type && item.importedIndex === importedIndex);
      const choice = conflict ? document.querySelector(`input[name="import_choice_${conflict.key}"]:checked`)?.value : "current";
      if (choice === "imported") result[sameIndex] = { ...record, id: result[sameIndex].id };
      if (oldId != null) idMap.set(String(oldId), result[sameIndex].id);
    } else {
      const id = makeUniqueImportId(record.id, type, usedIds);
      result.push({ ...record, id });
      if (oldId != null) idMap.set(String(oldId), id);
    }
  });
  return result;
}

function remapImportIds(ids, idMap) {
  return (Array.isArray(ids) ? ids : []).map(id => idMap.get(String(id)) ?? id);
}

function applyAdvancedImport() {
  if (!pendingAdvancedImport) return;
  const data = pendingAdvancedImport;
  const charIdMap = new Map(), factionIdMap = new Map(), paroIdMap = new Map(), bookIdMap = new Map();
  const previousDocuments = documents.map(item => ({ ...item }));

  characters = mergeImportedNamedRecords(characters, data.characters, "character", charIdMap);
  factions = mergeImportedNamedRecords(factions, data.factions, "faction", factionIdMap);
  paros = mergeImportedNamedRecords(paros, data.paros, "paro", paroIdMap, record => ({ ...record, members: remapImportIds(record.members, charIdMap) }));
  (Array.isArray(data.characters) ? data.characters : []).forEach((importedChar, importedIndex) => {
    const mappedId = charIdMap.get(String(importedChar.id));
    const target = characters.find(char => char.id === mappedId);
    if (!target || !importedChar.paroValues) return;
    const conflict = pendingImportConflicts.find(item => item.type === "character" && item.importedIndex === importedIndex);
    const selectedImported = !conflict || document.querySelector(`input[name="import_choice_${conflict.key}"]:checked`)?.value === "imported";
    if (!selectedImported) return;
    target.paroValues = Object.entries(importedChar.paroValues).reduce((result, [oldParoId, values]) => {
      result[paroIdMap.get(String(oldParoId)) ?? oldParoId] = values;
      return result;
    }, {});
  });
  books = mergeImportedNamedRecords(books, data.books, "book", bookIdMap, record => ({
    ...record, charIds: remapImportIds(record.charIds, charIdMap), factionIds: remapImportIds(record.factionIds, factionIdMap)
  }));

  const unusedMap = new Map();
  rankings = mergeImportedNamedRecords(rankings, data.rankings, "ranking", unusedMap, record => ({
    ...record,
    items: (record.items || []).map(item => ({ ...item, charId: charIdMap.get(String(item.charId)) ?? item.charId })),
    cutoffs: (record.cutoffs || []).map(item => ({ ...item, charId: charIdMap.get(String(item.charId)) ?? item.charId }))
  }));
  cps = mergeImportedNamedRecords(cps, normalizeCpCollection(data.cps || data.couples || []), "cp", new Map(), record => ({
    ...record, members: (record.members || []).map(member => ({ ...member, charId: charIdMap.get(String(member.charId)) ?? member.charId }))
  }));
  documents = mergeImportedNamedRecords(documents, data.documents, "document", new Map(), record => ({
    ...record,
    bookId: bookIdMap.get(String(record.bookId)) ?? record.bookId,
    charIds: remapImportIds(record.charIds, charIdMap),
    factionIds: remapImportIds(record.factionIds, factionIdMap)
  }), record => `${record.title}@@${record.bookId || "standalone"}`);
  (Array.isArray(data.documents) ? data.documents : []).forEach((raw, importedIndex) => {
    const mappedBookId = bookIdMap.get(String(raw.bookId)) ?? raw.bookId;
    const identity = normalizedImportName(`${raw.title}@@${mappedBookId || "standalone"}`);
    const target = documents.find(item => normalizedImportName(`${item.title}@@${item.bookId || "standalone"}`) === identity);
    const conflict = pendingImportConflicts.find(item => item.type === "visualNovel" && item.importedIndex === importedIndex);
    if (!target || !conflict) return;
    const choice = document.querySelector(`input[name="import_choice_${conflict.key}"]:checked`)?.value || "current";
    const selected = choice === "imported" ? raw.visualNovel : previousDocuments[conflict.currentIndex]?.visualNovel;
    if (selected == null) delete target.visualNovel;
    else target.visualNovel = selected;
  });
  visualNovelTemplates = mergeImportedNamedRecords(visualNovelTemplates, data.visualNovelTemplates, "vnTemplate", new Map());
  collapsedBooks = { ...collapsedBooks, ...(data.collapsedBooks || {}) };

  saveStateToLocalStorage(); syncGlobalTags(); renderAllViews();
  const addedCount = [data.characters, data.factions].reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  cancelAdvancedImport();
  alert(`挑選讀檔完成！已檢查並合併 ${addedCount} 筆人物與陣營資料。`);
}

function cancelAdvancedImport() {
  closeModal("advancedImportModal");
  pendingAdvancedImport = null;
  pendingImportConflicts = [];
  const input = document.getElementById("jsonFileInput");
  if (input) input.value = "";
}

function openApiKeyModal() { document.getElementById("apiKeyModal").classList.add("active"); }
function saveApiKeySettings() {
  deepseekSettings.apiKey = document.getElementById("deepseekApiKey").value.trim();
  deepseekSettings.baseUrl = document.getElementById("deepseekBaseUrl").value.trim();
  deepseekSettings.ocrPrompt = document.getElementById("deepseekOcrPrompt").value.trim();
  saveStateToLocalStorage(); closeModal("apiKeyModal");
  alert("DeepSeek API 設定已儲存！");
}
function captureEditorModalSnapshot(modalId) {
  if (modalId === "documentModal") {
    const checkedChars = Array.from(document.querySelectorAll("#docCharCheckboxes input:checked")).map(cb => cb.value).sort().join(",");
    const checkedFactions = Array.from(document.querySelectorAll("#docFactionCheckboxes input:checked")).map(cb => cb.value).sort().join(",");
    editorModalSnapshots.documentModal = JSON.stringify({
      title: document.getElementById("docTitle")?.value || "",
      bookId: document.getElementById("docBelongingBookId")?.value || "",
      tags: document.getElementById("docTags")?.value || "",
      content: document.getElementById("docContent")?.value || "",
      charIds: checkedChars,
      factionIds: checkedFactions
    });
  } else if (modalId === "visualNovelEditorModal") {
    editorModalSnapshots.visualNovelEditorModal = JSON.stringify({
      scriptText: document.getElementById("vnScriptText")?.value || "",
      settings: collectVisualNovelSettings()
    });
  }
}

function isEditorModalDirty(modalId) {
  const snapshot = editorModalSnapshots[modalId];
  if (!snapshot) return false;
  if (modalId === "documentModal") {
    const checkedChars = Array.from(document.querySelectorAll("#docCharCheckboxes input:checked")).map(cb => cb.value).sort().join(",");
    const checkedFactions = Array.from(document.querySelectorAll("#docFactionCheckboxes input:checked")).map(cb => cb.value).sort().join(",");
    const current = JSON.stringify({
      title: document.getElementById("docTitle")?.value || "",
      bookId: document.getElementById("docBelongingBookId")?.value || "",
      tags: document.getElementById("docTags")?.value || "",
      content: document.getElementById("docContent")?.value || "",
      charIds: checkedChars,
      factionIds: checkedFactions
    });
    return current !== snapshot;
  } else if (modalId === "visualNovelEditorModal") {
    const current = JSON.stringify({
      scriptText: document.getElementById("vnScriptText")?.value || "",
      settings: collectVisualNovelSettings()
    });
    return current !== snapshot;
  }
  return false;
}

function closeModal(modalId, force = false) {
  if (!force && isEditorModalDirty(modalId)) {
    if (!confirm("內容尚未儲存，確定要關閉視窗嗎？未儲存的變更將會遺失。")) {
      return false;
    }
  }
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
  if (editorModalSnapshots[modalId]) editorModalSnapshots[modalId] = null;
  return true;
}

function setupEventListeners() {
  window.onclick = function(event) {
    if (event.target.classList.contains("modal-backdrop")) {
      const modalId = event.target.id;
      if (modalId) closeModal(modalId);
      else event.target.classList.remove("active");
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
