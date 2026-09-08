// 审核场景演示：6 种场景，全部为「接口原始形态（FactReviewRaw）」
// 通过 review-mapper 映射为前端 ReviewItem，确保字段与真实接口一致。
// 任务：一个独立的「批量导入审核」任务（同 task_id + 同 created_at 聚合），排在最前。
import type { FactReviewRaw } from "./review-types";
import { mapFactRawListToReviewItems } from "./review-mapper";

const TASK_ID = "SCENARIO-DEMO";
const CREATED_AT = "2026-08-20 10:00";

const scenarioReviewRaw: FactReviewRaw[] = [
  // ─────────────────────────────────────────────────────────
  // 场景1：新增·无冲突·无重复
  // 训练场压枪技巧，全语言文本完整，关联实体有已有+建议新增
  // ─────────────────────────────────────────────────────────
  {
    fact_id: 90101,
    fact_text: "在 PUBG MOBILE 中，玩家可以在训练场中练习压枪与跟枪技巧，以提升实战中的射击稳定性。",
    fact_text_en: "In PUBG MOBILE, players can practice recoil control and target tracking in the Training Ground to improve shooting stability in real matches.",
    fact_text_ar: "في لعبة PUBG MOBILE، يمكن للاعبين ممارسة التحكم في الارتداد وتتبع الهدف في ميدان التدريب لتحسين دقة التصويب في المباريات.",
    fact_text_tr: "PUBG MOBILE'da oyuncular, gerçek maçlarda nişangah istikrarını artırmak için Eğitim Alanı'nda geri tepme kontrolü ve hedef takibi pratikği yapabilir.",
    fact_text_ru: "В PUBG MOBILE игроки могут отрабатывать контроль отдачи и сопровождение цели на тренировочной площадке для повышения точности стрельбы в реальных матчах.",
    fact_text_zh_hk: "在 PUBG MOBILE 中，玩家可以喺訓練場練習壓槍同跟槍技巧，以提升實戰中嘅射擊穩定性。",
    title: "训练场可以练习压枪吗？",
    source_type: "import",
    entity_ids: [14001, 14002],
    event_ids: [],
    review_status: "pending",
    review_priority: "low",
    contradicting_fact_ids: [],
    duplicate_fact_ids: [],
    action: "create",
    related_entity_names: ["训练场", "射击技巧"],
    suggested_new_entities: [
      { name: "压枪辅助功能", reason: "事实文本提及但库中无匹配实体，建议新建" },
    ],
    confidence: "high",
    task_id: TASK_ID,
    created_at: CREATED_AT,
    source_original: "问题：训练场可以练习压枪吗？\n答案：在 PUBG MOBILE 中，玩家可以在训练场中练习压枪与跟枪技巧，以提升实战中的射击稳定性。训练场提供了多种武器供玩家选择，并且支持无限弹药模式。",
  },

  // ─────────────────────────────────────────────────────────
  // 场景2：新增·有冲突
  // 待审核事实：「队友语音聊天可以在对局中直接翻译」
  // 与库内事实 #10086：「无法在对局中直接翻译，需开启按语言匹配」结论相反
  // ─────────────────────────────────────────────────────────
  {
    fact_id: 90102,
    fact_text: "在 PUBG MOBILE 中，队友语音聊天可以在对局中直接翻译。",
    fact_text_en: "In PUBG MOBILE, teammate voice chat can be translated directly during matches.",
    fact_text_ar: "في لعبة PUBG MOBILE، يمكن ترجمة محادثات الفريق الصوتية مباشرة أثناء المباريات.",
    fact_text_tr: "PUBG MOBILE'da takım arkadaşı sesli sohbeti maçlar sırasında doğrudan çevrilebilir.",
    fact_text_ru: "В PUBG MOBILE голосовой чат с товарищами по команде переводится напрямую во время матча.",
    fact_text_zh_hk: "在 PUBG MOBILE 中，隊友語音聊天可以喺對局中直接翻譯。",
    title: "队友语音聊天可以被翻译吗？",
    source_type: "import",
    entity_ids: [],
    event_ids: [],
    review_status: "pending",
    review_priority: "high",
    contradicting_fact_ids: [10086],
    duplicate_fact_ids: [],
    action: "create",
    contradicting_facts: [
      {
        fact_id: 10086,
        fact_text: "在 PUBG MOBILE 中，队友语音聊天无法在对局中直接翻译，需在游戏大厅开启「按语言匹配」功能方可实现语言筛选。",
        fact_text_en: "In PUBG MOBILE, teammate voice chat cannot be translated directly during matches; the 'Match By Language' feature must be enabled in the lobby to filter by language.",
        fact_text_ar: "في لعبة PUBG MOBILE، لا يمكن ترجمة محادثات الفريق الصوتية مباشرة أثناء المباريات؛ يجب تفعيل ميزة 'المطابقة حسب اللغة' في الردهة.",
        fact_text_tr: "PUBG MOBILE'da takım arkadaşı sesli sohbeti maçlar sırasında doğrudan çevrilemez; dile göre filtreleme için lobide 'Dile Göre Eşleştir' özelliği etkinleştirilmelidir.",
        fact_text_ru: "В PUBG MOBILE голосовой чат с командой не переводится напрямую во время матча; в лобби необходимо включить функцию 'Подбор по языку'.",
        reason: "新结论『可以在对局中直接翻译』与已有事实 #10086『无法直接翻译，需开启按语言匹配』结论完全相反，存在严重冲突。",
      },
    ],
    related_entity_names: ["Ray", "匹配功能"],
    suggested_new_entities: [
      { name: "Ray（角色）", reason: "事实文本提及但库中无匹配实体", linked_item_id: 252 },
      { name: "语音翻译功能", reason: "AI 识别为新实体候选，建议新建" },
    ],
    confidence: "low",
    task_id: TASK_ID,
    created_at: CREATED_AT,
    source_original: "问题：队友语音聊天可以被翻译吗？\n答案1：队友语音聊天无法在对局中直接翻译，需在大厅开启按语言匹配。\n答案2（存疑）：可以直接翻译。",
    term_refs: [{ term: "按语言匹配", reference: "Match By Language" }],
  },

  // ─────────────────────────────────────────────────────────
  // 场景3：新增·有重复
  // 待审核事实：「载具空中控制通过 Ctrl 键触发，用于微调落地位置」
  // 与库内事实 #10087：「按下 Ctrl 键可进行空中控制以调整落地姿态」语义几乎相同
  // ─────────────────────────────────────────────────────────
  {
    fact_id: 90103,
    fact_text: "在 PUBG MOBILE 中，使用载具时按下 Ctrl 键可进行空中控制以调整落地姿态，适合在高空跳伞时精准落点。",
    fact_text_en: "In PUBG MOBILE, pressing Ctrl while in a vehicle performs air control to adjust landing posture, useful for precise landing when skydiving from high altitude.",
    fact_text_ar: "في لعبة PUBG MOBILE، يؤدي الضغط على Ctrl أثناء ركوب المركبة إلى تحكم هوائي لتعديل وضع الهبوط، مفيد للهبوط الدقيق عند القفز من ارتفاع شاهق.",
    fact_text_tr: "PUBG MOBILE'da araçtayken Ctrl tuşuna basmak, yüksek rakımdan atlayışlarda hassas iniş için iniş duruşunu ayarlamak amacıyla hava kontrolü sağlar.",
    fact_text_ru: "В PUBG MOBILE нажатие Ctrl на транспорте выполняет воздушный контроль для корректировки приземления, что полезно для точного приземления при прыжке с большой высоты.",
    fact_text_zh_hk: "在 PUBG MOBILE 中，使用載具時按下 Ctrl 鍵可進行空中控制以調整落地姿態，適合高空跳傘時精準落點。",
    title: "载具空中控制怎么操作？",
    source_type: "import",
    entity_ids: [],
    event_ids: [],
    review_status: "pending",
    review_priority: "medium",
    contradicting_fact_ids: [],
    duplicate_fact_ids: [10087],
    action: "create",
    duplicate_facts: [
      {
        fact_id: 10087,
        fact_text: "在 PUBG MOBILE 中，载具空中控制通过 Ctrl 键触发，用于微调落地位置，是高空跳伞时控制落点的常用技巧。",
        fact_text_en: "In PUBG MOBILE, vehicle air control is triggered by the Ctrl key to fine-tune landing position, a common technique to control landing spots when skydiving.",
        fact_text_ar: "في لعبة PUBG MOBILE، يتم تشغيل التحكم الهوائي للمركبة بمفتاح Ctrl لضبط موقع الهبوط بدقة.",
        fact_text_tr: "PUBG MOBILE'da araç hava kontrolü, iniş konumunu ince ayarlamak için Ctrl tuşuyla tetiklenir.",
        fact_text_ru: "В PUBG MOBILE воздушный контроль транспорта активируется клавишей Ctrl для точной настройки места приземления.",
        reason: "与已有事实 #10087 高度重复：两者均描述「Ctrl 键触发载具空中控制调整落地」，核心信息完全一致，仅措辞略有不同，建议合并或引用。",
      },
    ],
    related_entity_names: ["载具", "空中控制"],
    confidence: "low",
    task_id: TASK_ID,
    created_at: CREATED_AT,
    source_original: "问题：载具空中控制怎么操作？\n答案：使用载具时按下 Ctrl 键可进行空中控制，高空时可精准控制落点。",
  },

  // ─────────────────────────────────────────────────────────
  // 场景4：覆盖·有重复
  // 覆盖更新事实 #10101（训练场多武器版），与库内 #10102 重复
  // live_fact 为当前线上版本，diff 体现「增加了多武器描述」
  // ─────────────────────────────────────────────────────────
  {
    fact_id: 10101,
    fact_text: "在 PUBG MOBILE 中，玩家可在训练场中练习压枪与跟枪技巧，以提升实战射击稳定性。训练场支持 M416、AKM、UMP45 等多种武器，并提供无限弹药模式。",
    fact_text_en: "In PUBG MOBILE, players can practice recoil control and target tracking in the Training Ground to improve combat shooting stability. The Training Ground supports multiple weapons including M416, AKM, and UMP45, with unlimited ammunition mode available.",
    fact_text_ar: "في لعبة PUBG MOBILE، يمكن للاعبين ممارسة التحكم في الارتداد وتتبع الهدف في ميدان التدريب. يدعم ميدان التدريب أسلحة متعددة منها M416 وAKM وUMP45، مع توفر وضع الذخيرة اللامحدودة.",
    fact_text_tr: "PUBG MOBILE'da oyuncular, Eğitim Alanı'nda geri tepme kontrolü ve hedef takibi pratikği yapabilir. Eğitim Alanı M416, AKM ve UMP45 dahil birçok silahı destekler ve sınırsız mühimmat modu sunar.",
    fact_text_ru: "В PUBG MOBILE игроки могут отрабатывать контроль отдачи на тренировочной площадке. Площадка поддерживает несколько видов оружия, включая M416, AKM и UMP45, с режимом бесконечных патронов.",
    fact_text_zh_hk: "在 PUBG MOBILE 中，玩家可喺訓練場練習壓槍同跟槍技巧，提升實戰射擊穩定性。訓練場支援 M416、AKM、UMP45 等多種武器，並提供無限彈藥模式。",
    title: "训练场可以练习压枪吗？",
    source_type: "import",
    entity_ids: [14001],
    event_ids: [],
    review_status: "pending",
    review_priority: "medium",
    contradicting_fact_ids: [],
    duplicate_fact_ids: [10102],
    action: "update",
    live_fact: {
      fact_text: "在 PUBG MOBILE 中，玩家可以在训练场中练习压枪与跟枪技巧，以提升实战中的射击稳定性。",
      fact_text_en: "In PUBG MOBILE, players can practice recoil control and target tracking in the Training Ground to improve shooting stability in real matches.",
      fact_text_ar: "في لعبة PUBG MOBILE، يمكن للاعبين ممارسة التحكم في الارتداد وتتبع الهدف في ميدان التدريب.",
      fact_text_tr: "PUBG MOBILE'da oyuncular, Eğitim Alanı'nda geri tepme kontrolü ve hedef takibi pratikği yapabilir.",
      fact_text_ru: "В PUBG MOBILE игроки могут отрабатывать контроль отдачи и сопровождение цели на тренировочной площадке.",
      fact_text_zh_hk: "在 PUBG MOBILE 中，玩家可以喺訓練場練習壓槍同跟槍技巧，以提升實戰中嘅射擊穩定性。",
    },
    duplicate_facts: [
      {
        fact_id: 10102,
        fact_text: "在 PUBG MOBILE 中，训练场支持 M416、AKM、UMP45 等多种武器进行压枪练习，并可使用无限弹药模式。",
        fact_text_en: "In PUBG MOBILE, the Training Ground supports recoil practice with multiple weapons including M416, AKM, and UMP45, with unlimited ammunition available.",
        fact_text_ar: "في لعبة PUBG MOBILE، يدعم ميدان التدريب ممارسة التحكم في الارتداد بأسلحة متعددة منها M416 وAKM وUMP45.",
        fact_text_tr: "PUBG MOBILE'da Eğitim Alanı M416, AKM ve UMP45 ile geri tepme pratiği destekler.",
        fact_text_ru: "В PUBG MOBILE тренировочная площадка поддерживает отработку отдачи с несколькими видами оружия, включая M416, AKM и UMP45.",
        reason: "新版本「支持 M416/AKM/UMP45 多武器 + 无限弹药」的描述与事实 #10102 内容高度重复，覆盖后建议删除或合并 #10102。",
      },
    ],
    related_entity_names: ["训练场", "M416", "AKM"],
    confidence: "low",
    task_id: TASK_ID,
    created_at: CREATED_AT,
    source_original: "覆盖更新：训练场练习压枪（补充多武器列表）。",
  },

  // ─────────────────────────────────────────────────────────
  // 场景5：覆盖·有冲突
  // 覆盖更新事实 #10103（语音翻译新版），新版说「可直接翻译」
  // live_fact（当前线上）说「无法翻译需开语言匹配」
  // 同时与库内 #10104 结论冲突
  // ─────────────────────────────────────────────────────────
  {
    fact_id: 10103,
    fact_text: "在 PUBG MOBILE 中，队友语音聊天可以在对局中直接翻译，系统会自动检测语言并实时转换为本地语言，无需额外设置。",
    fact_text_en: "In PUBG MOBILE, teammate voice chat can be translated directly during matches; the system automatically detects the language and converts it to the local language in real time without extra settings.",
    fact_text_ar: "في لعبة PUBG MOBILE، يمكن ترجمة محادثات الفريق الصوتية مباشرة أثناء المباريات؛ يكتشف النظام اللغة تلقائياً ويحولها إلى اللغة المحلية في الوقت الفعلي دون إعدادات إضافية.",
    fact_text_tr: "PUBG MOBILE'da takım arkadaşı sesli sohbeti maçlar sırasında doğrudan çevrilebilir; sistem dili otomatik olarak algılar ve ek ayar gerektirmeden yerel dile çevirir.",
    fact_text_ru: "В PUBG MOBILE голосовой чат с командой можно переводить напрямую во время матча; система автоматически определяет язык и переводит его на местный язык в реальном времени без дополнительных настроек.",
    fact_text_zh_hk: "在 PUBG MOBILE 中，隊友語音聊天可以喺對局中直接翻譯，系統會自動檢測語言並即時轉換為本地語言，無需額外設定。",
    title: "队友语音聊天可以被翻译吗？",
    source_type: "import",
    entity_ids: [],
    event_ids: [],
    review_status: "pending",
    review_priority: "high",
    contradicting_fact_ids: [10104],
    duplicate_fact_ids: [],
    action: "update",
    live_fact: {
      fact_text: "在 PUBG MOBILE 中，队友语音聊天无法在对局中直接翻译，需在游戏大厅开启「按语言匹配」功能方可实现语言筛选。",
      fact_text_en: "In PUBG MOBILE, teammate voice chat cannot be translated directly during matches; the 'Match By Language' feature must be enabled in the lobby to filter by language.",
      fact_text_ar: "في لعبة PUBG MOBILE، لا يمكن ترجمة محادثات الفريق الصوتية مباشرة أثناء المباريات؛ يجب تفعيل ميزة 'المطابقة حسب اللغة' في الردهة.",
      fact_text_tr: "PUBG MOBILE'da takım arkadaşı sesli sohbeti maçlar sırasında doğrudan çevrilemez; dile göre filtreleme için lobide 'Dile Göre Eşleştir' özelliği etkinleştirilmelidir.",
      fact_text_ru: "В PUBG MOBILE голосовой чат с командой не переводится напрямую во время матча; для фильтрации по языку необходимо включить функцию 'Подбор по языку' в лобби.",
      fact_text_zh_hk: "在 PUBG MOBILE 中，隊友語音聊天無法喺對局中直接翻譯，需在大廳開啟「按語言匹配」功能方可實現語言篩選。",
    },
    contradicting_facts: [
      {
        fact_id: 10104,
        fact_text: "在 PUBG MOBILE 中，队友语音聊天无法在对局中直接翻译，需开启「按语言匹配」功能才能与同语言玩家匹配，本质是语言筛选而非翻译。",
        fact_text_en: "In PUBG MOBILE, teammate voice chat cannot be translated directly during matches; 'Match By Language' is a language filter for matchmaking, not a real-time translation feature.",
        fact_text_ar: "في لعبة PUBG MOBILE، لا يمكن ترجمة المحادثات الصوتية للفريق مباشرة؛ 'المطابقة حسب اللغة' هي مرشح لغوي للتوفيق وليست ميزة ترجمة فورية.",
        fact_text_tr: "PUBG MOBILE'da takım sesli sohbeti doğrudan çevrilemez; 'Dile Göre Eşleştir' eşleşme için bir dil filtresidir, gerçek zamanlı çeviri özelliği değildir.",
        fact_text_ru: "В PUBG MOBILE голосовой чат не переводится напрямую; 'Подбор по языку' — это языковой фильтр для матчмейкинга, а не функция перевода в реальном времени.",
        reason: "新版本结论（系统自动实时翻译）与事实 #10104（无法翻译，按语言匹配是语言筛选非翻译）存在根本性冲突，需人工确认以哪版为准。",
      },
    ],
    related_entity_names: ["按语言匹配", "语音功能"],
    confidence: "low",
    task_id: TASK_ID,
    created_at: CREATED_AT,
    source_original: "覆盖更新：队友语音聊天翻译功能说明（新版本）。",
    term_refs: [{ term: "按语言匹配", reference: "Match By Language" }],
  },

  // ─────────────────────────────────────────────────────────
  // 场景6：删除
  // 删除线上事实 #10105（沙漠地图加油站，旧版本内容）
  // live_fact 为当前线上版本，审核人需确认是否删除
  // ─────────────────────────────────────────────────────────
  {
    fact_id: 10105,
    fact_text: "在 PUBG MOBILE 中，旧版本的沙漠地图包含可破坏的加油站设施，该设施在当前版本中已移除。",
    fact_text_en: "In the old version of PUBG MOBILE, the desert map contained destructible gas station facilities, which have been removed in the current version.",
    fact_text_ar: "في الإصدار القديم من لعبة PUBG MOBILE، احتوت خريطة الصحراء على منشآت محطات وقود قابلة للتدمير، تمت إزالتها في الإصدار الحالي.",
    fact_text_tr: "PUBG MOBILE'ın eski sürümünde çöl haritasında yıkılabilir benzin istasyonu tesisleri bulunuyordu; bunlar güncel sürümde kaldırıldı.",
    fact_text_ru: "В старой версии PUBG MOBILE на пустынной карте были разрушаемые объекты заправочных станций, удалённые в текущей версии.",
    fact_text_zh_hk: "在 PUBG MOBILE 舊版本中，沙漠地圖包含可破壞嘅加油站設施，該設施在當前版本中已移除。",
    title: "沙漠地图有加油站吗？",
    source_type: "import",
    entity_ids: [],
    event_ids: [],
    review_status: "pending",
    review_priority: "medium",
    contradicting_fact_ids: [],
    duplicate_fact_ids: [],
    action: "delete",
    live_fact: {
      fact_text: "在 PUBG MOBILE 中，旧版本的沙漠地图包含可破坏的加油站设施。",
      fact_text_en: "In the old version of PUBG MOBILE, the desert map contained destructible gas station facilities.",
      fact_text_ar: "في الإصدار القديم من لعبة PUBG MOBILE، احتوت خريطة الصحراء على منشآت محطات وقود قابلة للتدمير.",
      fact_text_tr: "PUBG MOBILE'ın eski sürümünde çöl haritasında yıkılabilir benzin istasyonu tesisleri bulunuyordu.",
      fact_text_ru: "В старой версии PUBG MOBILE на пустынной карте были разрушаемые объекты заправочных станций.",
      fact_text_zh_hk: "在 PUBG MOBILE 舊版本中，沙漠地圖包含可破壞嘅加油站設施。",
    },
    related_entity_names: ["沙漠地图", "加油站"],
    confidence: "high",
    task_id: TASK_ID,
    created_at: CREATED_AT,
    source_original: "删除请求：沙漠地图加油站设施（旧版本内容，当前版本已移除，保留该事实会造成信息误导）。",
  },
];

/** 经映射层转换为前端 ReviewItem（与真实接口返回经同一映射函数处理） */
export const scenarioReviewItems = mapFactRawListToReviewItems(scenarioReviewRaw);
