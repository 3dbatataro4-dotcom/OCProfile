// ==========================================================================
// 預設資料庫 (包含 PDF 解析角色、無預設標籤、主題色、Paro自訂欄位與評分排名初始資料)
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

// PDF 解析的主要角色資料 (已按照要求去除所有標籤 tags: [])
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
    extraNotes: "【R18相關】：行房時非常興奮，很開心。體力極好，容易過頭。喜歡視覺系SM。\n附註：如果是在現代/歡樂向世界觀。可以是活潑開朗的大男孩性格。",
    tags: [], // 去除舊標籤，由使用者自行建立
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
    extraNotes: "身分：前國王。現在是自由身。有強大的占卜能力。有一棟自己的城堡。\n【R18相關】：曾經以為自己是攻方，但現在無所謂了。能接受納西的各種嘗試。早洩。（但儲精量高）。體力一般。",
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
    personality: "高智商，高自尊，超小心眼。喜歡清靜。話少。深謀遠慮，還算平靜。但一旦確定方向就不顧後果，且非常果決。偏執。",
    appearance: "神仙顏值。180cm，天蠍座，淡藍色中長髮（通常扎成單辮子），金眼，眼神無神又銳利。難以猜測想法。表情冷淡。",
    extraNotes: "【R18相關】：表情看似平淡的玩弄受方。會用各種技巧、道具，以此觀察對方反應，得到樂趣。（但不會太不尊重人）",
    tags: [],
    themeColor: { primary: "#0284c7", secondary: "#e0f2fe", mode: "gradient" },
    hogwartsHouse: "Slytherin",
    isHidden: false,
    relationships: [
      { targetName: "納希瑟斯", callName: "學生/納希瑟斯", opinion: "學生。有點吵/煩。但還算重要。" },
      { targetName: "尼古拉斯．維納托", callName: "維納托", opinion: "學生找的戀人。隨便他。" },
      { targetName: "蜜拉思", callName: "蜜拉思", opinion: "同事。看起來很有趣。挺喜歡的。" },
      { targetName: "海神", callName: "海神", opinion: "不熟。替自己趕海的。但不打算揭穿。會叫蜜拉思小花的，他的朋友。" }
    ]
  },
  {
    id: "char_melas",
    name: "蜜拉思",
    englishName: "Melas",
    avatar: `${AVATAR_BASE_URL}%E8%9C%9C%E6%8B%89%E6%80%9D.png`,
    gender: "男",
    height: "172cm",
    zodiac: "白羊座",
    occupation: "下層區的神（擅長詛咒）",
    orientation: "受",
    fixedCp: "奧拉",
    personality: "思考靈活，隨心所欲。想法縝密、但目的單純。行事不擇手段。利己主義。被欺負了會叫。不服輸！不怎麼活潑，他平常不會努力挑事。",
    appearance: "白髮（紫色漸層），深邃的紅紫色眼睛，有黑眼圈。頭戴紫色小花。身材清瘦。172cm，白羊座。",
    extraNotes: "身分：下層區的神，擅長詛咒。年紀比奧拉大。\n【R18相關】：有點氣。但不能怎麼辦。還算正常。",
    tags: [],
    themeColor: { primary: "#a855f7", secondary: "#7e22ce", mode: "single" },
    hogwartsHouse: "Slytherin",
    isHidden: false,
    relationships: [
      { targetName: "納希瑟斯", callName: "納希瑟斯", opinion: "覺得他長的不錯，有時候看他不知道該怎麼辦的時候很好笑。" },
      { targetName: "尼古拉斯．維納托", callName: "小天才:-)", opinion: "看這個腦子不差的人掙扎很好笑也很好玩。" },
      { targetName: "奧拉", callName: "奧拉", opinion: "同事，一開始覺得和奧拉在一起（交往）我賺。後面也沒虧，但他比我想得幼稚多了 :/" },
      { targetName: "海神", callName: "海神", opinion: "朋友。會幫我慶祝生日。" },
      { targetName: "冥神", callName: "冥神", opinion: "朋友，會和海神一起幫我慶祝生日。" }
    ]
  },
  {
    id: "char_minshin",
    name: "冥神",
    englishName: "Hades",
    avatar: `${AVATAR_BASE_URL}%E5%86%A5%E7%A5%9E.png`,
    gender: "男",
    height: "190cm",
    zodiac: "摩羯座",
    occupation: "地下的冥神",
    orientation: "攻",
    fixedCp: "海神",
    personality: "看似清冷平淡，實則吉祥物。話很少，通常只有一個字或簡單手勢。面癱，幾乎完全沒有表情。喜歡閃亮亮的東西。呆萌。",
    appearance: "黑長直，頭戴前後黑紗，眼睛被遮住，平時看不到。實則眼神銳利，灰色眼睛與白色瞳孔。後腦掛了一輪黑色新月。全色盲。190cm。",
    extraNotes: "【R18相關】：開開心心進行。專心～✨\n他怕黑、畏光、怕寂寞、怕奧拉。但他喜歡海神。",
    tags: [],
    themeColor: { primary: "#334155", secondary: "#0f172a", mode: "single" },
    hogwartsHouse: "Hufflepuff",
    isHidden: false,
    relationships: [
      { targetName: "奧拉", callName: "天上來的", opinion: "他不喜歡螃蟹，感覺在欺負小花，他看起來很兇，我有點怕他。" },
      { targetName: "蜜拉思", callName: "小花", opinion: "挺喜歡的，小花。" },
      { targetName: "海神", callName: "海神", opinion: "閃亮亮的，他每天都很開心。我喜歡這個。" }
    ]
  },
  {
    id: "char_haishin",
    name: "海神",
    englishName: "Poseidon",
    avatar: `${AVATAR_BASE_URL}%E6%B5%B7%E7%A5%9E.png`,
    gender: "男",
    height: "184cm",
    zodiac: "雙魚座",
    occupation: "海神（原天上的時間神老么）",
    orientation: "受",
    fixedCp: "冥神",
    personality: "樂天、開朗、隨心所欲、橫衝直撞，不顧他人眼光。喜歡出去玩。喜歡和好朋友（冥神）待在一起。口頭禪是：「天天開心！」和「哈哈！」",
    appearance: "金色捲髮，長長的水母頭。藍眼。不好好穿衣服，基本上只掛了塊布。頭上有一塊貝殼裝飾。紅色盲，有臉盲症，184cm。路癡。3C癡。",
    extraNotes: "身分：海神。其實原本是天上的時間神老么，但被家人放水流，被冥神撿走後培養成快樂的海神。\n【R18相關】：開開心心進行～高興！不喜歡被別人打斷～",
    tags: [],
    themeColor: { primary: "#38bdf8", secondary: "#fef08a", mode: "gradient" },
    hogwartsHouse: "Gryffindor",
    isHidden: false,
    relationships: [
      { targetName: "奧拉", callName: "誰？/天上來的！", opinion: "天上來的。他不吃海鮮，我覺得很奇怪。他欺負小花，我不太喜歡他。" },
      { targetName: "蜜拉思", callName: "小花", opinion: "小花是好朋友！我喜歡！他頭上有花很好認！他會吃我送的螃蟹！" },
      { targetName: "冥神", callName: "大黑", opinion: "大黑很照顧我！我喜歡大黑！" }
    ]
  },
  {
    id: "char_manmu",
    name: "小目",
    englishName: "Manmu",
    avatar: `${AVATAR_BASE_URL}%E5%B0%8F%E7%9B%AE.png`,
    gender: "男",
    height: "186cm",
    zodiac: "巨蟹座",
    occupation: "科技總裁（本身是仿生人）",
    orientation: "攻",
    fixedCp: "茉莉",
    personality: "有點沒有安全感，幽默風趣，八點檔和爽文看多了，喜歡學總裁的行為和語氣。在受方身邊很有安全感，喜歡向受方撒嬌。",
    appearance: "186cm，巨蟹座。粉紅色黃色漸層短髮。淡藍色眼睛。帶著單邊耳環。由於是仿生人，外貌被茉莉監修過。",
    extraNotes: "補充：曾經憧憬並追求過林恩，後被溫柔的茉莉吸引。雖然曾是乞丐，但被一位好心女子（科絲塔）救下，並結拜為兄妹。\n【R18相關】：把自己交給茉莉！",
    tags: [],
    themeColor: { primary: "#ec4899", secondary: "#f59e0b", mode: "gradient" },
    hogwartsHouse: "Slytherin",
    isHidden: false,
    relationships: [
      { targetName: "茉莉", callName: "我的，芒果", opinion: "我，目總，閃亮登場✨✨✨✨✨" },
      { targetName: "林恩", callName: "林恩", opinion: "我曾經，喜歡過的人。但現在我只愛我的芒果！！！！！！" },
      { targetName: "彼得", callName: "彼得", opinion: "曾經的情敵，但我並不討厭他！" },
      { targetName: "喬諾娜", callName: "我最親愛的二哥", opinion: "我最親愛的家人，我親愛的，二哥。" },
      { targetName: "科絲塔", callName: "科絲塔小公主", opinion: "我親愛的！科絲塔小公主！！！！✨" }
    ]
  },
  {
    id: "char_mollie",
    name: "茉莉",
    englishName: "Mollie",
    avatar: `${AVATAR_BASE_URL}%E8%8C%89%E8%8E%89.png`,
    gender: "男",
    height: "175cm",
    zodiac: "雙魚座",
    occupation: "社畜醫生 / 兼職維修仿生人",
    orientation: "受",
    fixedCp: "小目",
    personality: "被壓榨的苦逼社畜（林恩的員工），因此會抽菸喝酒吸毒。但不會辭職（因為林恩給很多）。對所有人態度和善。對小目很有耐心跟包容心。",
    appearance: "白短髮，平劉海。粉色挑染。粉色眼睛。嘴唇左邊有一顆美人痣。穿舌環，有剪舌，很多耳釘。雙手都有穿三對手腕環。",
    extraNotes: "身分：社畜醫生，兼職維修仿生人。在小目為了事業而受損時經常幫助他。\n【R18相關】：照我，喜歡的，來～",
    tags: [],
    themeColor: { primary: "#f43f5e", secondary: "#fda4af", mode: "single" },
    hogwartsHouse: "Hufflepuff",
    isHidden: false,
    relationships: [
      { targetName: "小目", callName: "我的芒果～", opinion: "喜歡～這是我的芒果～他對我最好～" },
      { targetName: "林恩", callName: "林恩", opinion: "壓榨我的上司，但他給的很多，我不敢頂撞他。" },
      { targetName: "彼得", callName: "彼得", opinion: "上司的上司。超級有錢。不敢頂撞他。" },
      { targetName: "喬諾娜", callName: "喬諾娜", opinion: "芒果的，哥哥。我的，朋友～" },
      { targetName: "科絲塔", callName: "科絲塔小公主", opinion: "我親愛的！科絲塔小公主！✨" }
    ]
  },
  {
    id: "char_virdrakos",
    name: "維爾德拉克斯",
    englishName: "Virdrakos / Lanlan",
    avatar: `${AVATAR_BASE_URL}%E8%98%AD%E8%98%AD.png`,
    gender: "男",
    height: "191cm",
    zodiac: "金牛座",
    occupation: "走私船 S.S. 諾埃瑪號船員（龍族）",
    orientation: "攻",
    fixedCp: "喬諾娜",
    personality: "開朗，幽默，道德觀低下，對外人毫不在乎，但對朋友沒有脾氣，非常大方友善。還算有錢。有點怕鬼。說話不油膩。對待朋友的性格很軟。",
    appearance: "191cm，金牛座。龍族，海草一般的深藍綠色捲長髮（綁起低馬尾到屁股），深綠色到亮橘色的角（只剩一根），有尾巴。尖耳朵。",
    extraNotes: "綽號：蘭蘭。與粗魯暴力的龍族不合而離家出走，現在在一艘負責運送貨物的非法走私船——S.S. 諾埃瑪號上工作。\n【R18相關】：開開心心進行。會講幽默笑話。",
    tags: [],
    themeColor: { primary: "#10b981", secondary: "#f97316", mode: "gradient" },
    hogwartsHouse: "Gryffindor",
    isHidden: false,
    relationships: [
      { targetName: "喬諾娜", callName: "喬諾娜", opinion: "蘭蘭的老婆呀！蘭蘭都叫他喬諾娜呀！" },
      { targetName: "科絲塔", callName: "小瓜", opinion: "老婆的妹妹呀！" },
      { targetName: "尼奧扎里奧斯", callName: "表哥", opinion: "蘭蘭的表哥呀。但蘭蘭沒事也不會找他呀！" },
      { targetName: "林恩", callName: "林恩", opinion: "一個有錢的大老闆，我希望他幫我找角。" }
    ]
  },
  {
    id: "char_jornona",
    name: "喬諾娜",
    englishName: "Jornona",
    avatar: `${AVATAR_BASE_URL}%E5%96%AC%E8%AF%BA%E5%A8%9C.png`,
    gender: "男",
    height: "176cm",
    zodiac: "巨蟹座",
    occupation: "走私船員 / 歌手（仿生人）",
    orientation: "受",
    fixedCp: "蘭蘭",
    personality: "同性戀，覺得蘭蘭的身材很棒，很快就暈船了。很有自知之明，個性平易近人好相處。喜歡吃櫻桃。喜歡唱歌，動不動就會來一句。",
    appearance: "176cm，巨蟹座。粉紅色黃色漸層長直髮（綁起低馬尾到屁股）。淡藍色眼睛。帶著單邊耳環（櫻桃造型）。",
    extraNotes: "身分：是個仿生人。曾是乞丐（流浪歌手），但被一位好心女子（科絲塔）救下並結拜為兄妹。現在在走私船 S.S. 諾埃瑪號上被蘭蘭養。\n【R18相關】：開開心心進行。體力一般。",
    tags: [],
    themeColor: { primary: "#f472b6", secondary: "#fbbf24", mode: "gradient" },
    hogwartsHouse: "Hufflepuff",
    isHidden: false,
    relationships: [
      { targetName: "蘭蘭", callName: "蘭蘭", opinion: "我最喜歡的蘭蘭～" },
      { targetName: "小目", callName: "小目", opinion: "我弟。好家人。講話很油，很讓人受不了～我快吐了～" },
      { targetName: "林恩", callName: "林董", opinion: "我老闆！" },
      { targetName: "科絲塔", callName: "小瓜", opinion: "我最好的家人！" }
    ]
  },
  {
    id: "char_kleion",
    name: "克里昂",
    englishName: "Kleion",
    avatar: `${AVATAR_BASE_URL}%E5%85%8B%E9%87%8C%E6%98%82.png`,
    gender: "男",
    height: "177cm",
    zodiac: "白羊座",
    occupation: "生前半精靈 / 現幽靈復生",
    orientation: "攻",
    fixedCp: "科絲塔",
    personality: "直男。覺得大家都是男同有點奇怪。陽光善良且正直，很有常識。相當靈巧。還算細心體貼。常識人。偶爾吐槽役。",
    appearance: "177cm，金色短髮，平劉海，臉頰兩側的頭髮有橘紅色挑染。眼睛是藍色與黃色的漸層。尖耳朵。單邊羽毛耳環。",
    extraNotes: "身分：納希瑟斯最好的朋友。死後百年被好心女士（科絲塔）路過掃墓，意外變成幽靈復生。\n【R18相關】：他很正常。會和科絲塔說體力就是國力！",
    tags: [],
    themeColor: { primary: "#eab308", secondary: "#f97316", mode: "gradient" },
    hogwartsHouse: "Gryffindor",
    isHidden: false,
    relationships: [
      { targetName: "納希瑟斯", callName: "納希瑟斯", opinion: "我兄弟。關係很好，但我沒想到他是同性戀。" },
      { targetName: "尼古拉斯．維納托", callName: "維納托先生", opinion: "不熟。我兄弟找的女朋友。" },
      { targetName: "科絲塔", callName: "科絲塔", opinion: "我女朋友，說我不好心的時候她就不好心。" }
    ]
  },
  {
    id: "char_costa",
    name: "科絲塔．希艾拉",
    englishName: "Costa Ciara",
    avatar: `${AVATAR_BASE_URL}%E7%A7%91%E7%B5%B2%E5%A1%94.png`,
    gender: "女",
    height: "159cm",
    zodiac: "射手座",
    occupation: "仿生人 / 家務處理",
    orientation: "受",
    fixedCp: "克里昂",
    personality: "善良可愛。不太聰明，有時候笨笨的。反應有點慢。喜歡看子供向動畫（彩虹小馬）。句尾經常會有口癖『BATA』。討厭化學。",
    appearance: "159cm，射手座。一頭綠色的長髮，編成細細的低側馬尾。有黃色的挑染，看似無辜下垂的黃色眼睛。綠色水滴的單邊耳環。",
    extraNotes: "綽號『小瓜』。收養了流落街頭瀕死的小目和喬諾娜，把他們視為自己的哥哥。後掃墓意外救活克里昂。\n【R18相關】：她很正常。但在克里昂體力太好的時候覺得克里昂不好心！",
    tags: [],
    themeColor: { primary: "#84cc16", secondary: "#facc15", mode: "gradient" },
    hogwartsHouse: "Hufflepuff",
    isHidden: false,
    relationships: [
      { targetName: "茉莉", callName: "好心的先生", opinion: "救了我一命，最好心的先生！！" },
      { targetName: "小目", callName: "哥哥", opinion: "我哥，總裁，希望他早點睡BATA。" },
      { targetName: "喬諾娜", callName: "哥哥", opinion: "我有哥夫的哥哥，最好的家人！" },
      { targetName: "克里昂", callName: "克里昂/不好心", opinion: "我男朋友BATA。教我化學得時候非常不好心。" }
    ]
  },
  {
    id: "char_peter",
    name: "彼得",
    englishName: "Peter",
    avatar: `${AVATAR_BASE_URL}%E6%AF%BC%E5%BE%97.png`,
    gender: "男",
    height: "185cm",
    zodiac: "巨蟹座",
    occupation: "國王 / 教會『紙會』信徒 / 公司持有者",
    orientation: "攻",
    fixedCp: "林恩",
    personality: "有責任感。但不愛管閒事。純陰體質，容易招邪、中邪。有強迫症。對陌生人的態度不太好，會很冷漠，沒有禮貌。有時候會暴粗口『shit』。",
    appearance: "185cm，巨蟹座。長得挺好看的。灰色的眼瞳，長長的睫毛。駝色與象牙白色之間的長髮。頭上戴著黑色的王冠。",
    extraNotes: "【R18相關】：彼得有強迫症，他沒辦法在太凌亂的地方做。\n因為中邪體質，喜歡吉祥的東西，並且加入了『紙會』得到了不死的賜福。認為林恩非常吉祥（貓貓）。",
    tags: [],
    themeColor: { primary: "#475569", secondary: "#d97706", mode: "gradient" },
    hogwartsHouse: "Slytherin",
    isHidden: false,
    relationships: [
      { targetName: "納希瑟斯", callName: "Yellow Shit", opinion: "林恩手機桌面是他。但我覺得他是黃色的便便。" },
      { targetName: "尼古拉斯．維納托", callName: "維納托", opinion: "朋友。人不錯，會給我出謀劃策。但我通常不聽。" },
      { targetName: "林恩", callName: "貓貓/我的貓/貓/林恩", opinion: "全世界最吉祥的人！靠近他我就不會中邪，神醫！" }
    ]
  },
  {
    id: "char_lynn",
    name: "林恩",
    englishName: "Lynn",
    avatar: `${AVATAR_BASE_URL}%E6%9E%97%E6%81%A9.png`,
    gender: "男",
    height: "178cm",
    zodiac: "天蠍座",
    occupation: "商業大佬 / 前醫生",
    orientation: "受",
    fixedCp: "彼得",
    personality: "身為一個商業大佬，他務實、心狠手辣、利益至上。但態度一直非常軟爛、淡定。處變不驚。顏控，喜歡長得好看的人。",
    appearance: "178cm，天蠍座。紫色蓬鬆捲短髮，金色的眼睛，左眼下有一顆美人痣。貓嘴。",
    extraNotes: "身分：商業大佬，茉莉和小目的上司。維納托的朋友。最好的朋友是納希瑟斯 <3。\n【R18相關】：只要彼得不抽風就很正常。",
    tags: [],
    themeColor: { primary: "#9333ea", secondary: "#eab308", mode: "gradient" },
    hogwartsHouse: "Ravenclaw",
    isHidden: false,
    relationships: [
      { targetName: "納希瑟斯", callName: "我的鏡子小河！", opinion: "全世界最好看的人！！！愛他（的臉），長真的超好看的！！比心比心。" },
      { targetName: "尼古拉斯．維納托", callName: "維納托", opinion: "一個朋友，一個挺好的合作夥伴，腦子不錯。" },
      { targetName: "彼得", callName: "彼得/創意寶寶", opinion: "一個國王，太有創意了，都不知道他腦子裡裝了什麼，涼拌。" }
    ]
  }
];

// PDF 預設 Paro 及支援自訂欄位
const PRESET_PAROS = [
  {
    id: "paro_hogwarts",
    name: "霍格華茲魔法學校 (Hogwarts Paro)",
    description: "魔法世界觀。每個人物隸屬於四大學院。",
    fields: [
      { id: "house", name: "學院分院", type: "select", options: ["Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff"] },
      { id: "wand", name: "魔杖與護法", type: "text" }
    ],
    members: ["char_narcissus", "char_venator", "char_ora", "char_melas", "char_minshin", "char_haishin", "char_manmu", "char_mollie", "char_virdrakos", "char_jornona", "char_kleion", "char_costa", "char_peter", "char_lynn"]
  },
  {
    id: "paro_abo",
    name: "ABO 世界觀 Paro",
    description: "Alpha / Beta / Omega 基因世界觀設定。",
    fields: [
      { id: "abo_type", name: "ABO 性別", type: "select", options: ["Alpha", "Beta", "Omega"] },
      { id: "feromone", name: "信息素氣味", type: "text" }
    ],
    members: ["char_narcissus", "char_venator", "char_manmu", "char_mollie"]
  },
  {
    id: "paro_modern",
    name: "現代 / 歡樂向 Paro",
    description: "轉生或平移至現代都市生活。",
    fields: [
      { id: "net_name", name: "網路暱稱/網名", type: "text" },
      { id: "job", name: "現代職業", type: "text" }
    ],
    members: ["char_narcissus", "char_manmu", "char_mollie", "char_lynn", "char_peter"]
  }
];

// 世界觀與陣營層級結構預設
const PRESET_FACTIONS = [
  {
    id: "faction_gods",
    name: "神聖天界與冥界陣營",
    description: "掌管時間、海洋、冥界與詛咒的高維神明們。",
    subTags: [
      { id: "sub_god_high", name: "天界/時間神系", description: "奧拉、海神（原時間老么）", members: ["char_ora", "char_haishin"] },
      { id: "sub_god_under", name: "冥界與下層區", description: "冥神、蜜拉思", members: ["char_minshin", "char_melas"] }
    ]
  },
  {
    id: "faction_business",
    name: "現代商業與醫療集團",
    description: "由林恩與彼得控制的商業公司、醫院與科技事業。",
    subTags: [
      { id: "sub_biz_exec", name: "高層決策組", description: "林恩、彼得", members: ["char_lynn", "char_peter"] },
      { id: "sub_biz_tech", name: "科技與維修部", description: "小目、茉莉", members: ["char_manmu", "char_mollie"] }
    ]
  }
];

// 預設評分與排名主題板塊
const PRESET_RANKINGS = [
  {
    id: "rank_beauty",
    subject: "顏值評比",
    items: [
      { charId: "char_narcissus", operator: ">" },
      { charId: "char_ora", operator: ">" },
      { charId: "char_manmu", operator: "=" },
      { charId: "char_venator", operator: ">" },
      { charId: "char_costa", operator: "" }
    ],
    cutoffs: [
      { charId: "char_ora", label: "神仙級顏值" },
      { charId: "char_venator", label: "俊美英秀" },
      { charId: "char_costa", label: "可愛清秀" }
    ]
  },
  {
    id: "rank_cook",
    subject: "廚藝排名",
    items: [
      { charId: "char_jornona", operator: ">" },
      { charId: "char_kleion", operator: ">" },
      { charId: "char_costa", operator: ">" },
      { charId: "char_mollie", operator: ">" },
      { charId: "char_haishin", operator: ">" },
      { charId: "char_peter", operator: "" }
    ],
    cutoffs: [
      { charId: "char_costa", label: "大廚 / 熟食級" },
      { charId: "char_haishin", label: "普通家常" },
      { charId: "char_peter", label: "廚房爆炸級" }
    ]
  }
];
