// ==========================================================================
// 預設資料庫 (包含 PDF 解析角色、CP關係、大事件詞條與書籍文檔資料庫)
// ==========================================================================

const AVATAR_BASE_URL = "https://file.garden/aWe99vhwaGcNwkok/%E7%A0%B4%E9%A0%AD/";

// 全部 62 個頭像檔案名稱與網址映射
const PRESET_AVATARS = [
  "DBA.png", "DBB.png", "伊莉莎白.png", "保羅.png", "元首.png", "克里昂.png", 
  "公民老師.png", "卡洛特.png", "卡繆.png", "厄瑞斯.png", "哈蘇.png", "喬倫娜.png", 
  "喬若娜.png", "喬諾娜.png", "多馬.png", "奧吉莉亞.png", "奧拉.png", "安德烈.png", 
  "小蕾.png", "小雅各.png", "尼奧扎里奧斯.png", "張飛.png", "彼得.png", "恩雅.png", 
  "拉扎爾.png", "拿但業.png", "提法洛恩.png", "星星.png", "朗川.png", "林恩.png", 
  "格納季.png", "沈默茜.png", "浩瀚花.png", "滿目.png", "火山灰.png", "猶大.png", 
  "盧卡斯.png", "科絲塔.png", "約翰.png", "納希瑟斯.png", "索托斯.png", "維納托.png", 
  "艾薇.png", "茉莉.png", "莉莉斯.png", "萬里長城.png", "蕾.png", "薇薇安.png", 
  "蘭蘭.png", "蜜拉思.png", "西爾維亞.png", "西門.png", "諾維安.png", "貝文.png", 
  "達利亞.png", "達太.png", "阿凡達.png", "阿朵菈.png", "雅各.png", "韭菜.png", 
  "韻華.png", "默茜.png"
].map(filename => ({
  name: filename.replace(/\.(png|jpg|jpeg)$/i, ''),
  filename: filename,
  url: `${AVATAR_BASE_URL}${encodeURIComponent(filename)}`
}));

// PDF 解析的主要角色資料
const INITIAL_CHARACTERS = [
  {
    id: "char_narcissus",
    name: "納希瑟斯",
    englishName: "Narcissus",
    avatar: `${AVATAR_BASE_URL}%E7%B4%8D%E5%B8%8C%E7%91%9F%E6%96%AF.png`,
    gender: "男",
    height: "182cm",
    zodiac: "天秤座",
    occupation: "能看家護衛的旅行者",
    orientation: "攻",
    fixedCp: "尼古拉斯．維納托",
    personality: "溫和，平易近人。因為過去的經歷，變得有些謹慎。做事果決。開朗。對大家的態度不會太恭敬。",
    appearance: "神仙顏值，美貌舉世無雙。182cm，天秤座，蓬鬆捲金髮（通常扎成低馬尾），紫眼，眼睛裡有閃爍的星星。",
    extraNotes: "【關係與互動細節】：交往時非常開心投入。體力極好，容易過頭。喜歡視覺系質感氛圍。\n附註：如果是在現代/歡樂向世界觀，可以是活潑開朗的大男孩性格。",
    tags: [],
    themeColor: { primary: "#f59e0b", secondary: "#8b5cf6", mode: "gradient" },
    hogwartsHouse: "Slytherin",
    isHidden: false,
    relationships: [
      { targetName: "尼古拉斯．維納托", callName: "維納托先生", opinion: "最喜歡最喜歡的！戀人！" },
      { targetName: "奧拉", callName: "老師", opinion: "重要的老師！喜歡！同時是舅舅。" },
      { targetName: "蜜拉思", callName: "蜜拉思", opinion: "不熟。老師的同事？" },
      { targetName: "林恩", callName: "林恩", opinion: "好朋友！" },
      { targetName: "彼得", callName: "彼得", opinion: "他叫我yellow shit，我要跟維納托先生告狀。" },
      { targetName: "克里昂", callName: "克里昂", opinion: "最好的兄弟！" },
      { targetName: "科絲塔", callName: "科絲塔", opinion: "不熟。（兄弟的女朋友？）" }
    ],
    paroValues: {
      paro_hogwarts: { house: "Slytherin", roleNotes: "五年級級長，擅長變形學" },
      paro_modern: { identity: "歡樂向活潑大男孩" }
    }
  },
  {
    id: "char_venator",
    name: "尼古拉斯．維納托",
    englishName: "Nicolaus Venator",
    avatar: `${AVATAR_BASE_URL}%E7%B6%AD%E7%B4%8D%E6%89%98.png`,
    gender: "男",
    height: "188.54cm",
    zodiac: "射手座",
    occupation: "前國王 / 自由身占卜師",
    orientation: "受",
    fixedCp: "納希瑟斯",
    personality: "自信、天才、略為自大。開朗，但沒什麼朋友。獨立、大方，他是常識人。他不會兇別人。他有禮貌。自稱『本王』或者『本天才』。",
    appearance: "白髮藍眼，長直髮，扎成高馬尾。身高為 188.54cm，星座為射手。俊美、氣場強大。眼瞳如海般深邃。",
    extraNotes: "身分：前國王。現在是自由身。有強大的占卜能力。有一棟自己的城堡。\n【關係與互動細節】：能接受納西的各種嘗試與互動。",
    tags: [],
    themeColor: { primary: "#3b82f6", secondary: "#06b6d4", mode: "gradient" },
    hogwartsHouse: "Ravenclaw",
    isHidden: false,
    relationships: [
      { targetName: "納希瑟斯", callName: "納西", opinion: "本王最可愛的戀人！" },
      { targetName: "奧拉", callName: "大天才？", opinion: "戀人的舅舅兼老師。有點接不上話。" },
      { targetName: "蜜拉思", callName: "蜜拉思", opinion: "可能是禍害戀人的罪魁禍首。會看自己熱鬧。不喜歡。" },
      { targetName: "林恩", callName: "林恩", opinion: "本王最好的好朋友！" },
      { targetName: "彼得", callName: "彼得", opinion: "沒有禮貌，但是是本王唯二的朋友之一。" },
      { targetName: "克里昂", callName: "克里昂", opinion: "兄弟的好朋友！本王會對他友善的！" }
    ],
    paroValues: {
      paro_hogwarts: { house: "Ravenclaw", roleNotes: "占卜學導師" }
    }
  },
  {
    id: "char_ora",
    name: "奧拉",
    englishName: "Ora",
    avatar: `${AVATAR_BASE_URL}%E5%A5%A7%E6%8B%89.png`,
    gender: "男",
    height: "180cm",
    zodiac: "天蠍座",
    occupation: "天上的神（掌管時間的金線）",
    orientation: "攻",
    fixedCp: "蜜拉思",
    personality: "性格冷漠，很少有情緒波動。做事嚴謹，冷酷無情。外冷內熱，在沒人的時候性格很好。只會對自己的固定CP（蜜拉思）表達真實的情感。",
    appearance: "高顏值，美貌。粉紫色中長髮，瞳孔顏色同髮色。180cm，天蠍座。身上有金屬質感手環裝飾。",
    extraNotes: "身分：天上的神。納西瑟斯的舅舅兼老師。與蜜拉思是固定CP。\n【關係細節】：經驗極其豐富。會嘗試各種情境與玩法。",
    tags: [],
    themeColor: { primary: "#a855f7", secondary: "#ec4899", mode: "gradient" },
    hogwartsHouse: "Slytherin",
    isHidden: false,
    relationships: [
      { targetName: "蜜拉思", callName: "蜜拉思", opinion: "唯一的例外與牽絆。深沉的愛意。" },
      { targetName: "納希瑟斯", callName: "納西", opinion: "疼愛的外甥兼學生。" },
      { targetName: "尼古拉斯．維納托", callName: "維納托", opinion: "外甥的戀人。" }
    ],
    paroValues: {
      paro_hogwarts: { house: "Slytherin", roleNotes: "黑魔法防禦術教授" }
    }
  },
  {
    id: "char_miras",
    name: "蜜拉思",
    englishName: "Miras",
    avatar: `${AVATAR_BASE_URL}%E8%9C%9C%E6%8B%89%E6%80%9D.png`,
    gender: "男",
    height: "185cm",
    zodiac: "雙魚座",
    occupation: "冥界的主神 / 靈魂指引者",
    orientation: "受",
    fixedCp: "奧拉",
    personality: "優雅、帶有神秘微笑，心思縝密，極具魅力與誘惑力。",
    appearance: "深紫髮色與幽藍眼瞳，氣場華麗深邃。",
    extraNotes: "與奧拉為固定 CP，默契極佳。",
    tags: [],
    themeColor: { primary: "#7c3aed", secondary: "#4c1d95", mode: "gradient" },
    hogwartsHouse: "Slytherin",
    isHidden: false,
    relationships: [
      { targetName: "奧拉", callName: "親愛的奧拉", opinion: "互為命運共同體。" }
    ],
    paroValues: {
      paro_hogwarts: { house: "Slytherin", roleNotes: "魔藥學教授" }
    }
  }
];

// 預設 Paro 平行世界
const PRESET_PAROS = [
  {
    id: "paro_hogwarts",
    name: "霍格華茲魔法學校 Paro",
    description: "角色們化身為霍格華茲學院的教授與學生，展開魔法世界的日常與冒險。",
    fields: [
      { id: "house", name: "霍格華茲學院", type: "select", options: ["Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff", "阿茲卡班"], description: "選擇分配學院" },
      { id: "class_room", name: "幾年幾班/社團", type: "text", options: null, description: "例如: 五年級A班 / 魁地奇球隊" },
      { id: "roommate", name: "宿舍室友", type: "text", options: null, description: "例如: 林恩" },
      { id: "cadre", name: "幹部職稱", type: "text", options: null, description: "例如: 級長 / 男生學生會主席" }
    ],
    members: ["char_narcissus", "char_venator", "char_ora", "char_miras"]
  },
  {
    id: "paro_flower",
    name: "花吐症 Paro",
    description: "單相思的奇幻設定，無法表達愛意時會吐出花瓣。",
    fields: [
      { id: "flower_type", name: "吐出的花朵種類", type: "text", options: null, description: "例如: 金色鬱金香" },
      { id: "flower_reason", name: "發病原因與心境", type: "text", options: null, description: "對戀人的深沉思念" }
    ],
    members: ["char_narcissus", "char_venator"]
  }
];

// 預設陣營與世界觀 (支援無限自訂大事件與大段詞條)
const PRESET_FACTIONS = [
  {
    id: "faction_celestial",
    name: "神聖天界與冥界陣營",
    description: "掌管宇宙秩序、時間金線與生死輪迴的高階神明陣營。",
    subTags: [
      { name: "時間守護者", description: "掌控時間金線與命運節點的神祇" },
      { name: "黃昏領域", description: "掌管黃昏與迷霧邊界" }
    ],
    customSections: [
      { id: "sec_1", title: "神魔大戰歷史與創世誓約", content: "在遠古第一紀元，天界與冥界簽訂《金線誓約》，劃分了世俗與神界的邊界。奧拉與蜜拉思在此戰中一舉奠定主神地位，共同掌管世間靈魂與時間流向。" },
      { id: "sec_2", title: "天界禁律與金線法則", content: "1. 凡神明不可隨意干涉凡人命線。\n2. 時間金線一旦剪斷即無法逆轉，否則引發時空崩塌。\n3. 禁忌之術需消耗神核力量。" }
    ]
  },
  {
    id: "faction_travelers",
    name: "自由旅行者與王國陣營",
    description: "穿梭於各個大陸與王國之間的探險家、前國王與學者。",
    subTags: [
      { name: "前王室", description: "前國王與貴族勢力" },
      { name: "占卜學會", description: "研究星象與命運占卜的學者" }
    ],
    customSections: [
      { id: "sec_3", title: "王國興衰史與占卜城堡", content: "尼古拉斯．維納托曾作為前國王統治繁榮的王國，後退位成為自由占卜師，城堡至今保存著珍貴古籍與星象占卜儀器。" }
    ]
  }
];

// 預設評分與排名
const PRESET_RANKINGS = [
  {
    id: "rank_beauty",
    subject: "顏值與美貌排名",
    items: [
      { charId: "char_narcissus", operator: ">" },
      { charId: "char_ora", operator: "=" },
      { charId: "char_venator", operator: ">" },
      { charId: "char_miras", operator: "" }
    ],
    cutoffs: [
      { charId: "char_narcissus", label: "神仙級顏值（舉世無雙）" },
      { charId: "char_venator", label: "俊美英氣級" }
    ]
  },
  {
    id: "rank_cooking",
    subject: "廚藝實力評比",
    items: [
      { charId: "char_miras", operator: ">" },
      { charId: "char_narcissus", operator: ">" },
      { charId: "char_ora", operator: ">" },
      { charId: "char_venator", operator: "" }
    ],
    cutoffs: [
      { charId: "char_miras", label: "大廚級別" },
      { charId: "char_ora", label: "黑暗料理級" }
    ]
  }
];

// 預設 CP 關係細節資料庫 (支援多角CP、左右位、無限自訂大段詞條)
const PRESET_CPS = [
  {
    id: "cp_narcissus_venator",
    name: "納希瑟斯 × 尼古拉斯．維納托",
    memberIds: ["char_narcissus", "char_venator"],
    positions: [
      { charId: "char_narcissus", role: "攻" },
      { charId: "char_venator", role: "受" }
    ],
    r18Notes: "納希瑟斯體力極好容易過頭；維納托儲精量高，能接受納西的各種嘗試與互動。",
    relationshipThoughts: "互相信任與傾慕，相處甜度極高。維納托雖自稱本王但極其疼寵納西，納西常向維納托告狀與撒嬌。",
    customSections: [
      { id: "cp_sec_meet", title: "相遇情況", content: "在旅途中因為占卜命運而相遇，維納托被納希瑟斯舉世無雙的美貌與真誠吸引，納西則對維納托的自信與禮貌深感著迷。" },
      { id: "cp_sec_dating", title: "交往過程", content: "經歷了諸多冒險與考察後，雙方坦白心意。維納托將納西帶回城堡，二人確立了極其穩固且甜蜜的戀人關係。" },
      { id: "cp_sec_daily", title: "交往後相處模式", content: "維納托在城堡中與納西共度時光。納西遇到不滿的事情（例如彼得的惡言）會立刻跑去找維納托告狀，維納托會認真幫他討回公道。" }
    ]
  },
  {
    id: "cp_ora_miras",
    name: "奧拉 × 蜜拉思",
    memberIds: ["char_ora", "char_miras"],
    positions: [
      { charId: "char_ora", role: "攻" },
      { charId: "char_miras", role: "受" }
    ],
    r18Notes: "經驗極其豐富，愛意深沉纏綿，喜愛氛圍質感與各種情節嘗試。",
    relationshipThoughts: "既是多年同事與神界夥伴，也是命運相互糾纏的神明侶伴。外人面前冷酷，私下極具深情與牽絆。",
    customSections: [
      { id: "cp_sec_meet2", title: "相遇情況", content: "神界創世初期，共同掌管時間金線與冥界靈魂，於寂靜的神殿中確立牽絆。" },
      { id: "cp_sec_dating2", title: "交往過程", content: "在漫長無盡的世紀交鋒與陪伴中達成默契，成為不可分割的靈魂眷侶。" },
      { id: "cp_sec_daily2", title: "交往後相處模式", content: "奧拉表面冷酷無情，但唯獨對蜜拉思展現真實情緒與極高的獨佔欲。" }
    ]
  }
];

// 預設書籍與同人文檔資料庫 (不參與預設導出，支援 AI 大綱總結)
const PRESET_BOOKS = [
  {
    id: "book_main_story",
    title: "【主線同人集】時間與金線之歌",
    description: "講述納希瑟斯與維納托的冒險故事以及神明間的恩怨糾葛。",
    charIds: ["char_narcissus", "char_venator", "char_ora", "char_miras"],
    factionIds: ["faction_celestial"],
    tags: ["主線", "奇幻", "長篇"]
  }
];

const PRESET_DOCUMENTS = [
  {
    id: "doc_chap1",
    bookId: "book_main_story",
    title: "第一章：黃昏與占卜城堡的初相遇",
    charIds: ["char_narcissus", "char_venator"],
    factionIds: ["faction_travelers"],
    tags: ["初遇", "甜文"],
    content: "納希瑟斯漫步在林間的小路上，遠處聳立著一座古老而優雅的城堡。城堡的主人正是聲名遠播的占卜師維納托。夕陽西下，金色的光輝灑在城堡的尖頂上，兩人在此拉開了命運的序幕……"
  },
  {
    id: "doc_chap2",
    bookId: "book_main_story",
    title: "第二章：金線織成的時間密語",
    charIds: ["char_ora", "char_miras"],
    factionIds: ["faction_celestial"],
    tags: ["神明", "強強"],
    content: "奧拉修長的手指輕輕撥動著懸浮在半空中的金線，身旁的蜜拉思優雅地端著茶杯，嘴角帶著一抹神秘的笑意。在無數靈魂交織的深夜，時間與死神的誓約比恆星更加堅固……"
  }
];
