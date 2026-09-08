import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ExportResultDialog from '@/components/export-result-dialog'

import { ChevronLeft, ChevronRight, Search, X, PanelLeftClose, PanelLeftOpen, FileDown } from 'lucide-react'
import { RiskLevel, RISK_LEVEL_STYLE, RISK_LEVELS } from '@/store/onlineStore'
import { DEFAULT_QUALITY_STANDARD_ROWS } from '@/data/quality-standards'

interface RecordItem {
  originalOrder: number
  id: number
  sourceKey: string
  time: string
  summaryZh: string
  summaryAr: string
  rawContent: string
  playerMsgZh: string
  playerMsgAr: string
  descZh: string
  descAr: string
  riskLevel: RiskLevel | null
  errorCode: string
  annotator: string
  annotatedAt: string
  extInfo?: Record<string, string>
}

interface SelectionMenuState {
  open: boolean
  x: number
  y: number
  text: string
}

interface InlineComment {
  id: string
  index: number
  quote: string
  text: string
}

interface RecordAnnotationDraft {
  errorCodes: string[]
  manualRiskLevel: RiskLevel | null
  optimizationStrategy: string
  remark: string
}

interface ErrorCodeSuggestion {
  errorCode: string
  riskLevel: RiskLevel
  dimension: string
  standard: string
  category: string
  subCategory: string
  description: string
  keywordBlob: string
}

type ExportConclusion = '优秀' | '合格' | '不合格' | '未标注'

const CIRCLE_INDEX = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']

function getRiskWeight(level: RiskLevel | null) {
  if (!level) return 0
  if (level === '低风险错误') return 1
  if (level === '中风险错误') return 2
  if (level === '高风险错误') return 3
  if (level === '极高风险错误') return 4
  return 0
}

function getConclusion(level: RiskLevel | null): ExportConclusion {
  if (!level) return '未标注'
  if (level === '低风险错误' || level === '中风险错误') return '合格'
  if (level === '高风险错误' || level === '极高风险错误') return '不合格'
  return '优秀'
}

function getHighestRiskLabel(level: RiskLevel | null) {
  return level ?? '—'
}

function formatPercent(count: number, total: number) {
  if (!total) return '0.00%'
  return `${((count / total) * 100).toFixed(2)}%`
}

const ARABIC_SAMPLES = [
  {
    query: 'ما هي شروط تفعيل الإسقاط المحظوظ؟',
    answer:
      'يبدو أنك تبحث عن تفاصيل الإسقاط المحظوظ، وRay يتفهم اهتمامك! عادةً يظهر بشكل عشوائي بعد إكمال مباريات في الوضع الكلاسيكي، وغالبًا يحتوي على عناصر بخصومات جيدة ووقت شراء محدود.',
  },
  {
    query: 'هل استخدام الأسلحة في وضع وااو يزيد من القوة القتالية؟',
    answer:
      'في هذا الوضع، استخدام الأسلحة بانتظام يعزز الإتقان والتحكم في الارتداد. كما أن الملحقات المناسبة مثل المخمدات والمقابض تجعل السلاح أكثر فاعلية خصوصًا في القتال القريب.',
  },
  {
    query: 'كيف يتم ضبط الموسيقى الخلفية؟',
    answer:
      'لتغيير موسيقى اللوبي، انتقل من شاشة اللوبي إلى قسم الموسيقى، ثم اختر الإعدادات وحدد الموسيقى المطلوبة وأكد التغيير.',
  },
  {
    query: 'كم عدد الأشخاص الذين سيكونون في كاراكين عادةً؟',
    answer:
      'كاراكين خريطة صغيرة (2×2 كم) وتضم غالبًا 64 لاعبًا في المباراة الواحدة، وتتميز بوتيرة سريعة ومواجهات مكثفة.',
  },
  {
    query: 'تحسينات الأسلحة في أحدث إصدار',
    answer:
      'في التحديثات الأخيرة تم تحسين توازن عدة أسلحة لتعزيز التنوع، مع تحسين أداء بعض البنادق في المدى القريب والمتوسط.',
  },
  {
    query: 'كيف يمكنني تغيير الوضع الدائم إلى المترو الملكي؟',
    answer:
      'يمكنك اختيار المترو الملكي من واجهة الأوضاع ثم الرجوع إلى الردهة والبدء. يفضل ضبطه كوضع دائم من الإعدادات لسهولة الدخول لاحقًا.',
  },
  {
    query: 'أين مدخل طريق النمو؟',
    answer:
      'يمكن الوصول إلى طريق النمو من واجهة اللعبة الرئيسية عبر قائمة المباراة، وهو مسار تدريبي يساعد على تعلم أساسيات اللعب.',
  },
  {
    query: 'لماذا بطاقة المكافآت من البريد لم تظهر في المخزون؟',
    answer:
      'تحقق أولًا من صندوق البريد داخل اللعبة واضغط المطالبة، فبعض المكافآت تحتاج استلامًا يدويًا وقد تتأخر دقائق قبل ظهورها في المخزون.',
  },
]

const mockRecords: RecordItem[] = Array.from({ length: 20 }).map((_, idx) => {
  const ar = ARABIC_SAMPLES[idx % ARABIC_SAMPLES.length]
  return {
    originalOrder: idx,
    id: idx + 1,
    sourceKey: `source_${Math.floor(idx / 2) + 1}`,
    time: `2026-04-16 ${String(22 - Math.floor(idx / 3)).padStart(2, '0')}:${String(26 - (idx % 6) * 4).padStart(2, '0')}:36`,
    summaryZh:
      idx === 0
        ? '事件: 断线重连成功'
        : idx === 1
        ? '充值没到账怎么办'
        : idx === 2
        ? '我的角色被误封了'
        : idx % 5 === 0
        ? '事件: 玩家进入房间'
        : '事件: 玩家发起对局请求',
    summaryAr: ar.query,
    rawContent:
      '[{"tpl_type":1,"content":[{"desc_type":"question","content":"[{\\"resource_id\\":\\"2211160196400\\",\\"name\\":\\"card_image\\",\\"image\\":\\"https://cdn.gbot.qq.com/platform/20251029_1761718689_ltcm2p\\",\\"content_type\\":\\"image\\"}]"}]}]',
    playerMsgZh: idx % 3 === 0 ? '充值后没有到账，请帮我看一下' : '这个问题一直没有解决，能尽快处理吗？',
    playerMsgAr: ar.query,
    descZh:
      idx % 3 === 0
        ? '充值问题需要联系客服处理，请您提供订单号，我们会尽快核实并处理。'
        : '已收到反馈，请稍等，我们正在核查账号状态并尽快给您回复。',
    descAr: ar.answer,
    riskLevel:
      idx === 0
        ? '极高风险错误'
        : idx === 1
        ? '高风险错误'
        : idx === 2
        ? '中风险错误'
        : idx === 3
        ? '无风险'
        : idx < 10
        ? idx % 2 === 0
          ? '低风险错误'
          : '中风险错误'
        : null,
    errorCode: idx % 4 === 0 ? '#010101' : idx % 4 === 1 ? '#020101' : idx % 4 === 2 ? '#030101' : '#040101',
    annotator: idx % 3 === 0 ? 'yzhinan' : idx % 3 === 1 ? 'alice' : 'bob',
    annotatedAt: `2026-07-${String((idx % 27) + 1).padStart(2, '0')} ${String((idx % 9) + 10).padStart(2, '0')}:30`,
    extInfo:
      idx % 3 === 0
        ? {
            '角色 ID': `38271946${String(idx).padStart(2, '0')}`,
            等级: `Lv.${80 + (idx % 20)}`,
            战力: `${120000 + idx * 350}`,
            'VIP 等级': `VIP ${Math.min(8, 3 + (idx % 6))}`,
            绑定状态: idx % 2 === 0 ? '已绑定' : '未绑定',
          }
        : undefined,
  }
})

const RISK_BADGE = (level: RiskLevel | null) => {
  if (!level) return <span className="text-[10px] text-gray-300">— 未标注 —</span>
  const style = RISK_LEVEL_STYLE[level]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] shrink-0 ${style.badge}`}>
      <span className={`w-1 h-1 rounded-full ${style.dot}`} />
      {level}
    </span>
  )
}

function getRiskBorderColor(level: RiskLevel | null) {
  if (!level) return 'border-transparent'
  const map: Record<RiskLevel, string> = {
    无风险: 'border-slate-300',
    低风险错误: 'border-green-400',
    中风险错误: 'border-yellow-400',
    高风险错误: 'border-orange-400',
    极高风险错误: 'border-red-400',
  }
  return map[level]
}

function replaceArabicPunctuation(raw: string) {
  return raw
    .replace(/\?/g, '؟')
    .replace(/,/g, '،')
    .replace(/;/g, '؛')
}

function formatByLanguage(raw: string, language: 'zh' | 'ar') {
  if (language === 'ar') {
    return replaceArabicPunctuation(raw)
  }
  return raw
}

function formatTimeByLanguage(raw: string, language: 'zh' | 'ar') {
  if (language !== 'ar') return raw

  const parsed = new Date(raw.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return raw

  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(parsed)
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeInlineComments(comments: InlineComment[]) {
  return comments.map((item, index) => ({ ...item, index: index + 1 }))
}

function normalizeErrorCodeInput(value: string) {
  return value.trim().replace(/^#+/, '').toLowerCase()
}

const ERROR_CODE_SUGGESTIONS: ErrorCodeSuggestion[] = Array.from(
  new Map(
    DEFAULT_QUALITY_STANDARD_ROWS.filter((row) => row.errorCodeConfig.trim()).map((row) => {
      const code = row.errorCodeConfig.trim()
      const normalizedCode = normalizeErrorCodeInput(code)
      const keywordBlob = [code, normalizedCode, row.dimension, row.standard, row.category, row.subCategory, row.description].join(' ').toLowerCase()
      return [
        normalizedCode,
        {
          errorCode: code.startsWith('#') ? code : `#${code}`,
          riskLevel: row.riskLevel,
          dimension: row.dimension,
          standard: row.standard,
          category: row.category,
          subCategory: row.subCategory,
          description: row.description,
          keywordBlob,
        } as ErrorCodeSuggestion,
      ]
    })
  ).values()
)

function matchSuggestionByExactCode(input: string) {
  const normalized = normalizeErrorCodeInput(input)
  if (!normalized) return null
  return ERROR_CODE_SUGGESTIONS.find((item) => normalizeErrorCodeInput(item.errorCode) === normalized) ?? null
}

function toRiskTag(level: RiskLevel) {
  if (level === '无风险') return '无问题'
  return level
}

function computeRiskLevelByCodes(codes: string[]): RiskLevel | null {
  if (codes.length === 0) return null

  const levels = codes
    .map((code) => matchSuggestionByExactCode(code)?.riskLevel)
    .filter((level): level is RiskLevel => Boolean(level))

  if (levels.length === 0) return null

  return [...levels].sort((a, b) => getRiskWeight(b) - getRiskWeight(a))[0]
}

function appendMatchedErrorCodeTag(tags: string[], input: string) {
  const matched = matchSuggestionByExactCode(input)
  if (!matched) return tags
  if (tags.includes(matched.errorCode)) return tags
  return [...tags, matched.errorCode]
}

interface AnnotationWorkbenchProps {
  /** 当前任务名称，展示在顶部标题栏 */
  taskName: string
  /** 返回任务列表 */
  onBack: () => void
}

/** 人工标注工作台：问题列表 + 对话详情 + 标注面板，原样迁移自旧平台 Demo。 */
export default function AnnotationWorkbench({ taskName, onBack }: AnnotationWorkbenchProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const orderedRecords = useMemo(() => [...mockRecords].sort((a, b) => a.originalOrder - b.originalOrder), [])

  const [selectedId, setSelectedId] = useState(orderedRecords[7]?.id ?? orderedRecords[0].id)
  const [tab, setTab] = useState<'all' | 'unmarked' | 'marked'>('unmarked')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  const [errorCodeInput, setErrorCodeInput] = useState('')
  const [errorCodeTags, setErrorCodeTags] = useState<string[]>([])
  const [optimizationStrategy, setOptimizationStrategy] = useState('')
  const [remark, setRemark] = useState('')
  const [manualRiskLevel, setManualRiskLevel] = useState<RiskLevel | null>(null)
  const [showErrorCodeSuggestions, setShowErrorCodeSuggestions] = useState(false)
  const [annotationDraftById, setAnnotationDraftById] = useState<Record<number, RecordAnnotationDraft>>({})
  const [language, setLanguage] = useState<'zh' | 'ar'>('zh')

  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [extInfoPinned, setExtInfoPinned] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('onlineWorkbench.extInfoPinned') === '1'
  })

  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState>({ open: false, x: 0, y: 0, text: '' })
  const [highlightsByRecordId, setHighlightsByRecordId] = useState<Record<number, string[]>>({})
  const [inlineCommentsByRecordId, setInlineCommentsByRecordId] = useState<Record<number, InlineComment[]>>({})
  const inlineCommentRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const [exportOpen, setExportOpen] = useState(false)
  const [exportRiskLevels, setExportRiskLevels] = useState<RiskLevel[]>([])
  const [exportErrorCodeKeyword, setExportErrorCodeKeyword] = useState('')
  const [exportAnnotators, setExportAnnotators] = useState<string[]>([])

  const recordsWithDraft = useMemo(
    () =>
      orderedRecords.map((record) => {
        const draft = annotationDraftById[record.id]
        if (!draft) return record

        const riskLevelFromCodes = computeRiskLevelByCodes(draft.errorCodes)
        return {
          ...record,
          errorCode: draft.errorCodes.join('、'),
          riskLevel: draft.manualRiskLevel ?? riskLevelFromCodes,
        }
      }),
    [orderedRecords, annotationDraftById]
  )

  const selectedRecord = recordsWithDraft.find((r) => r.id === selectedId) ?? recordsWithDraft[0]
  const selectedIndex = recordsWithDraft.findIndex((r) => r.id === selectedId)
  const highlights = highlightsByRecordId[selectedRecord.id] ?? []
  const inlineComments = inlineCommentsByRecordId[selectedRecord.id] ?? []

  const commitCurrentDraft = (options?: { autoMarkNoRiskOnEmpty?: boolean }) => {
    if (!selectedRecord) return

    const mergedErrorCodes = appendMatchedErrorCodeTag(errorCodeTags, errorCodeInput)
    const hasExtraContent = optimizationStrategy.trim().length > 0 || remark.trim().length > 0
    const computedRiskLevel = computeRiskLevelByCodes(mergedErrorCodes)
    const shouldAutoMarkNoRisk = Boolean(options?.autoMarkNoRiskOnEmpty) && mergedErrorCodes.length === 0 && !manualRiskLevel
    const nextManualRiskLevel = manualRiskLevel ?? (shouldAutoMarkNoRisk ? '无风险' : null)

    if (!hasExtraContent && mergedErrorCodes.length === 0 && !nextManualRiskLevel) {
      setAnnotationDraftById((prev) => {
        const next = { ...prev }
        delete next[selectedRecord.id]
        return next
      })
      return
    }

    setAnnotationDraftById((prev) => ({
      ...prev,
      [selectedRecord.id]: {
        errorCodes: mergedErrorCodes,
        manualRiskLevel: nextManualRiskLevel,
        optimizationStrategy,
        remark,
      },
    }))

    if (!manualRiskLevel && computedRiskLevel !== '无风险' && shouldAutoMarkNoRisk) {
      setManualRiskLevel('无风险')
    }
  }

  const jumpToRecord = (targetId: number, options?: { autoMarkNoRiskOnEmpty?: boolean }) => {
    commitCurrentDraft(options)
    setSelectedId(targetId)
  }

  const goPrev = () => {
    if (selectedIndex > 0) jumpToRecord(recordsWithDraft[selectedIndex - 1].id)
  }

  const goNext = () => {
    if (selectedIndex < recordsWithDraft.length - 1) {
      jumpToRecord(recordsWithDraft[selectedIndex + 1].id, { autoMarkNoRiskOnEmpty: true })
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const active = document.activeElement as HTMLElement | null
      const inEditableContext =
        !!target?.closest(
          'input, textarea, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [data-radix-select-content], [data-radix-select-trigger]'
        ) ||
        !!active?.closest(
          'input, textarea, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [data-radix-select-content], [data-radix-select-trigger]'
        )

      if (inEditableContext) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrev()
        return
      }

      event.preventDefault()
      goNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const tabFilteredRecords = useMemo(() => {
    if (tab === 'all') return recordsWithDraft
    if (tab === 'unmarked') return recordsWithDraft.filter((r) => !r.riskLevel)
    return recordsWithDraft.filter((r) => !!r.riskLevel)
  }, [recordsWithDraft, tab])

  const searchedRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return tabFilteredRecords

    return tabFilteredRecords.filter((r) => {
      const contentZh = `${r.summaryZh} ${r.playerMsgZh} ${r.descZh}`.toLowerCase()
      const contentAr = `${r.summaryAr} ${r.playerMsgAr} ${r.descAr}`.toLowerCase()
      return contentZh.includes(q) || contentAr.includes(q)
    })
  }, [tabFilteredRecords, searchQuery])

  const allCount = recordsWithDraft.length
  const unmarkedCount = recordsWithDraft.filter((r) => !r.riskLevel).length
  const markedCount = recordsWithDraft.filter((r) => !!r.riskLevel).length

  const exportAnnotatorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          recordsWithDraft
            .filter((row) => row.annotator.trim().length > 0 && (!!row.riskLevel || row.errorCode.trim().length > 0))
            .map((row) => row.annotator.trim())
        )
      ).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
    [recordsWithDraft]
  )

  const filteredForExport = useMemo(() => {
    return recordsWithDraft.filter((row) => {
      const matchRisk = exportRiskLevels.length === 0 || (row.riskLevel ? exportRiskLevels.includes(row.riskLevel) : false)
      const matchCode = !exportErrorCodeKeyword.trim() || row.errorCode.toLowerCase().includes(exportErrorCodeKeyword.trim().toLowerCase())
      const matchAnnotator = exportAnnotators.length === 0 || exportAnnotators.includes(row.annotator)

      return matchRisk && matchCode && matchAnnotator
    })
  }, [recordsWithDraft, exportRiskLevels, exportErrorCodeKeyword, exportAnnotators])

  const dedupExportRows = useMemo(() => {
    const sorted = [...filteredForExport].sort(
      (a, b) => new Date(b.annotatedAt.replace(' ', 'T')).getTime() - new Date(a.annotatedAt.replace(' ', 'T')).getTime()
    )

    const map = new Map<string, RecordItem>()
    sorted.forEach((row) => {
      const key = `${row.sourceKey}_${row.annotator}`
      if (!map.has(key)) map.set(key, row)
    })
    return Array.from(map.values()).sort((a, b) => a.originalOrder - b.originalOrder)
  }, [filteredForExport])

  const handleRecordMouseUp = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''
    if (!text) {
      setSelectionMenu((prev) => ({ ...prev, open: false }))
      return
    }

    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    const rect = range?.getBoundingClientRect()
    if (!rect) return

    setSelectionMenu({
      open: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      text,
    })
  }

  const handleHighlight = () => {
    if (!selectionMenu.text) return
    setHighlightsByRecordId((prev) => {
      const current = prev[selectedRecord.id] ?? []
      if (current.includes(selectionMenu.text)) return prev
      return {
        ...prev,
        [selectedRecord.id]: [...current, selectionMenu.text],
      }
    })
    setSelectionMenu((prev) => ({ ...prev, open: false }))
    window.getSelection()?.removeAllRanges()
  }

  const handleCreateComment = () => {
    if (!selectionMenu.text) return
    setInlineCommentsByRecordId((prev) => {
      const current = prev[selectedRecord.id] ?? []
      const index = current.length + 1
      const id = `c_${Date.now()}_${selectedRecord.id}_${index}`
      return {
        ...prev,
        [selectedRecord.id]: [...current, { id, index, quote: selectionMenu.text, text: '' }],
      }
    })
    setSelectionMenu((prev) => ({ ...prev, open: false }))
    window.getSelection()?.removeAllRanges()
  }

  useEffect(() => {
    if (inlineComments.length === 0) return
    const latest = inlineComments[inlineComments.length - 1]
    const node = inlineCommentRefs.current[latest.id]
    if (node) node.focus()
  }, [inlineComments])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('onlineWorkbench.extInfoPinned', extInfoPinned ? '1' : '0')
  }, [extInfoPinned])

  useEffect(() => {
    if (!selectedRecord) return
    setSelectionMenu((prev) => ({ ...prev, open: false, text: '' }))
    window.getSelection()?.removeAllRanges()
  }, [selectedRecord?.id])

  useEffect(() => {
    if (searchParams.get('openExport') !== '1') return
    setExportOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('openExport')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!selectedRecord) return
    const draft = annotationDraftById[selectedRecord.id]
    if (draft) {
      setErrorCodeTags(draft.errorCodes)
      setErrorCodeInput('')
      setOptimizationStrategy(draft.optimizationStrategy)
      setRemark(draft.remark)
      setManualRiskLevel(draft.manualRiskLevel)
      return
    }

    setErrorCodeTags([])
    setErrorCodeInput('')
    setOptimizationStrategy('')
    setRemark('')
    setManualRiskLevel(null)
  }, [selectedRecord.id, annotationDraftById])

  const errorCodeSuggestions = useMemo(() => {
    const query = normalizeErrorCodeInput(errorCodeInput)
    if (!query) return []

    return ERROR_CODE_SUGGESTIONS.filter((item) => item.keywordBlob.includes(query) && !errorCodeTags.includes(item.errorCode)).slice(0, 8)
  }, [errorCodeInput, errorCodeTags])

  const autoMatchedSuggestion = useMemo(() => matchSuggestionByExactCode(errorCodeInput), [errorCodeInput])
  const mergedPreviewCodes = useMemo(() => {
    if (!autoMatchedSuggestion) return errorCodeTags
    if (errorCodeTags.includes(autoMatchedSuggestion.errorCode)) return errorCodeTags
    return [...errorCodeTags, autoMatchedSuggestion.errorCode]
  }, [errorCodeTags, autoMatchedSuggestion])
  const computedPreviewRisk = computeRiskLevelByCodes(mergedPreviewCodes)
  const livePanelRisk = manualRiskLevel ?? computedPreviewRisk ?? selectedRecord.riskLevel

  const commitInputAsTag = () => {
    setErrorCodeTags((prev) => appendMatchedErrorCodeTag(prev, errorCodeInput))
    setErrorCodeInput('')
    setShowErrorCodeSuggestions(false)
  }

  const handleErrorCodeChange = (value: string) => {
    setErrorCodeInput(value)
    setShowErrorCodeSuggestions(true)
  }

  const handleSelectErrorCodeSuggestion = (item: ErrorCodeSuggestion) => {
    setErrorCodeTags((prev) => (prev.includes(item.errorCode) ? prev : [...prev, item.errorCode]))
    setErrorCodeInput('')
    setShowErrorCodeSuggestions(false)
  }

  const handleRemoveErrorCodeTag = (code: string) => {
    setErrorCodeTags((prev) => prev.filter((item) => item !== code))
  }

  if (!selectedRecord) {
    return (
      <div className="legacy-scope h-full bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-base font-medium text-gray-900">当前任务暂无可标注数据</div>
          <div className="text-xs text-gray-500 mt-2">请返回任务列表重新进入，或检查任务数据是否已加载。</div>
          <Button size="sm" variant="outline" className="mt-4" onClick={onBack}>
            返回任务列表
          </Button>
        </div>
      </div>
    )
  }

  const selectedSummary = language === 'ar' ? selectedRecord.summaryAr : selectedRecord.summaryZh
  const selectedPlayerMsg = language === 'ar' ? selectedRecord.playerMsgAr : selectedRecord.playerMsgZh
  const selectedDesc = language === 'ar' ? selectedRecord.descAr : selectedRecord.descZh

  const renderedDesc = useMemo(() => {
    const text = formatByLanguage(selectedDesc, language)

    const highlightTokens = Array.from(
      new Set(highlights.map((h) => formatByLanguage(h, language).trim()).filter((h) => h.length > 0))
    )

    const commentedTokens = Array.from(
      new Set(
        inlineComments
          .filter((item) => item.text.trim().length > 0)
          .map((item) => formatByLanguage(item.quote, language).trim())
          .filter((quote) => quote.length > 0)
      )
    )

    const allTokens = Array.from(new Set([...highlightTokens, ...commentedTokens])).sort((a, b) => b.length - a.length)
    if (allTokens.length === 0) return <span>{text}</span>

    const pattern = new RegExp(`(${allTokens.map((token) => escapeRegExp(token)).join('|')})`, 'g')
    const segments = text.split(pattern)

    return (
      <>
        {segments.map((segment, idx) => {
          const isHighlighted = highlightTokens.includes(segment)
          const isCommented = commentedTokens.includes(segment)

          if (!isHighlighted && !isCommented) return <span key={idx}>{segment}</span>

          if (isHighlighted) {
            return (
              <mark
                key={idx}
                className={`bg-yellow-300 text-gray-900 px-0.5 rounded-sm ${
                  isCommented ? 'underline decoration-orange-500 decoration-2 underline-offset-2' : ''
                }`}
              >
                {segment}
              </mark>
            )
          }

          return (
            <span key={idx} className="underline decoration-orange-500 decoration-2 underline-offset-2">
              {segment}
            </span>
          )
        })}
      </>
    )
  }, [selectedDesc, highlights, inlineComments, language])

  const getInlineCommentExportValue = (recordId: number) => {
    const comments = inlineCommentsByRecordId[recordId] ?? []
    return comments.map((item) => `${CIRCLE_INDEX[(item.index - 1) % CIRCLE_INDEX.length]}${item.text || '（空）'}`).join('\n')
  }

  const exportColumns = [
    '整体维度',
    '大类',
    '小类',
    '标准',
    '回复标准说明',
    '错误码',
    '错误等级',
    '错误项说明',
    '质检结论',
    '原始最高风险等级',
    '风险标签',
    '划词评论',
  ]

  const exportRowsForXlsx = useMemo(
    () =>
      dedupExportRows.map((row) => {
        const allCodes = row.errorCode
          .split(/[、,\s]+/)
          .map((code) => code.trim())
          .filter(Boolean)
        const primaryCode = allCodes[0] ?? ''
        const matched = matchSuggestionByExactCode(primaryCode)
        const risk = row.riskLevel
        const conclusion = getConclusion(risk)
        const highestRisk = getHighestRiskLabel(risk)

        return {
          整体维度: matched?.dimension ?? '—',
          大类: matched?.category ?? '—',
          小类: matched?.subCategory ?? '—',
          标准: matched?.standard ?? '—',
          回复标准说明: matched?.description ?? '—',
          错误码: row.errorCode || '—',
          错误等级: risk ?? '—',
          错误项说明: allCodes.length > 1 ? `多错误码(${allCodes.length})` : matched?.description ?? '—',
          质检结论: conclusion,
          原始最高风险等级: highestRisk,
          风险标签: risk ? toRiskTag(risk) : '—',
          划词评论: getInlineCommentExportValue(row.id) || '—',
        }
      }),
    [dedupExportRows, inlineCommentsByRecordId]
  )

  const exportSummary = useMemo(() => {
    const total = dedupExportRows.length
    const distribution = {
      无风险: dedupExportRows.filter((row) => row.riskLevel === '无风险').length,
      低风险错误: dedupExportRows.filter((row) => row.riskLevel === '低风险错误').length,
      中风险错误: dedupExportRows.filter((row) => row.riskLevel === '中风险错误').length,
      高风险错误: dedupExportRows.filter((row) => row.riskLevel === '高风险错误').length,
      极高风险错误: dedupExportRows.filter((row) => row.riskLevel === '极高风险错误').length,
      未标注: dedupExportRows.filter((row) => !row.riskLevel).length,
    }

    const qualifiedCount = dedupExportRows.filter((row) => {
      const conclusion = getConclusion(row.riskLevel)
      return conclusion === '优秀' || conclusion === '合格'
    }).length

    return {
      total,
      distribution,
      qualifiedCount,
      qualifiedRate: formatPercent(qualifiedCount, total),
    }
  }, [dedupExportRows])

  return (
    <div className="legacy-scope h-full flex flex-col">
      <div className="flex flex-col h-full">
        <div className="h-11 bg-white border-b border-gray-200 flex items-center justify-between px-4 gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onBack} className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-900 truncate">{taskName}</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExportOpen(true)}>
            <FileDown className="w-3.5 h-3.5 mr-1" />
            导出
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className={`${leftCollapsed ? 'w-10' : 'w-72'} bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all`}>
            <div className="p-2 border-b border-gray-100 flex items-center gap-1 text-xs">
              {!leftCollapsed &&
                (
                  [
                    { key: 'all', label: `全部 ${allCount}` },
                    { key: 'unmarked', label: `待标注 ${unmarkedCount}` },
                    { key: 'marked', label: `已标注 ${markedCount}` },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                      tab === t.key ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}

              <button
                onClick={() => setLeftCollapsed((v) => !v)}
                className="ml-auto p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                title={leftCollapsed ? '展开问题列表' : '折叠问题列表'}
              >
                {leftCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
              </button>
            </div>

            {!leftCollapsed && (
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 pl-7 pr-7 text-[11px]"
                    placeholder="搜索问题内容/对话文本"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {searchedRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-300 text-xs gap-2">
                  <Search className="w-6 h-6" />
                  {!leftCollapsed && '未找到匹配问题'}
                </div>
              ) : (
                searchedRecords.map((record) => {
                  const serial = recordsWithDraft.findIndex((r) => r.id === record.id) + 1
                  const riskBorderColor = getRiskBorderColor(record.riskLevel)
                  return (
                    <button
                      key={record.id}
                      onClick={() => jumpToRecord(record.id)}
                      className={`group text-left transition-colors ${
                        selectedId === record.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                      } ${leftCollapsed ? `border-l-2 ${riskBorderColor} w-full aspect-square flex items-center justify-center` : 'w-full border-b border-gray-50 px-3 py-2'}`}
                    >
                      {leftCollapsed ? (
                        <span
                          className={`text-[11px] font-medium ${
                            selectedId === record.id ? 'text-blue-600' : 'text-gray-600'
                          }`}
                        >
                          {serial}
                        </span>
                      ) : (
                        <>
                          <div className={`flex items-center justify-between gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                            <div
                              className={`text-[11px] truncate ${selectedId === record.id ? 'text-blue-600 font-medium' : 'text-gray-700'} ${
                                language === 'ar' ? 'text-right' : ''
                              }`}
                            >
                              {formatTimeByLanguage(record.time, language)}
                            </div>
                            {RISK_BADGE(record.riskLevel)}
                          </div>
                          <div className={`text-[11px] text-gray-400 truncate mt-0.5 ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                            {language === 'ar' ? record.summaryAr : record.summaryZh}
                          </div>
                        </>
                      )}
                    </button>
                  )
                })
              )}
            </div>

            {!leftCollapsed && (
              <div className="flex items-center justify-center gap-1 py-2 border-t border-gray-100 text-[11px] text-gray-400">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                {[1, 2, 3, 4, 5].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-5 h-5 flex items-center justify-center rounded ${
                      page === p ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <span>···</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
                <span className="ml-1">25条/页</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <div className="h-10 border-b border-gray-100 flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-400 shrink-0">对话详情</span>
                <span className="text-xs text-gray-300 truncate">{selectedSummary}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setExtInfoPinned((prev) => !prev)}
                  className={`h-7 px-3 rounded-md text-xs border transition-colors ${
                    extInfoPinned
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  补充信息
                </button>

                <Select value={language} onValueChange={(v: 'zh' | 'ar') => setLanguage(v)}>
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 space-y-4 relative"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              onMouseUp={handleRecordMouseUp}
            >
              <div>
                <pre
                  dir="ltr"
                  className="text-[11px] leading-5 text-gray-500 whitespace-pre-wrap break-all bg-gray-50 rounded-md p-3 max-h-40 overflow-y-auto"
                >
                  {selectedRecord.rawContent}
                </pre>
              </div>

              {extInfoPinned && selectedRecord.extInfo ? (
                <div className="rounded-md border border-gray-200 bg-gray-50/70 p-3">
                  <div className="text-xs text-gray-500 mb-2">补充信息</div>
                  <div className="space-y-1.5">
                    {Object.entries(selectedRecord.extInfo).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-[84px_1fr] gap-2 text-xs">
                        <span className="text-gray-400">{key}</span>
                        <span className="text-gray-700 break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className={language === 'ar' ? 'text-right' : 'text-left'}>
                <div className="text-xs text-orange-500 font-medium mb-1">玩家:</div>
                <div
                  className="text-sm text-gray-900 bg-orange-50 inline-block px-3 py-1.5 rounded-md whitespace-pre-wrap break-words max-w-[78%]"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                  style={language === 'ar' ? { unicodeBidi: 'plaintext', textAlign: 'right' } : undefined}
                >
                  {formatByLanguage(selectedPlayerMsg, language)}
                </div>
                <div className="text-[11px] text-gray-300 mt-1">{formatTimeByLanguage(selectedRecord.time, language)}</div>
              </div>

              <div className={language === 'ar' ? 'text-right' : 'text-left'}>
                <div className="text-xs text-blue-500 font-medium mb-1">客服（描述）:</div>
                <div
                  className="text-[11px] leading-5 text-gray-600 whitespace-pre-wrap break-words bg-blue-50/60 rounded-md p-3 max-w-[82%]"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                  style={language === 'ar' ? { unicodeBidi: 'plaintext', textAlign: 'right' } : undefined}
                >
                  {renderedDesc}
                </div>
                <div className="text-[11px] text-gray-300 mt-1">{formatTimeByLanguage(selectedRecord.time, language)}</div>
              </div>

              {selectionMenu.open && (
                <div
                  className="fixed z-50 -translate-x-1/2 -translate-y-full bg-gray-900 text-white text-xs rounded-md shadow-lg px-1 py-1 flex items-center gap-1"
                  style={{ left: selectionMenu.x, top: selectionMenu.y }}
                >
                  <button
                    className="px-2 py-1 rounded hover:bg-white/15"
                    onClick={() => {
                      navigator.clipboard.writeText(selectionMenu.text)
                      setSelectionMenu((prev) => ({ ...prev, open: false }))
                    }}
                  >
                    复制
                  </button>
                  <button className="px-2 py-1 rounded hover:bg-white/15" onClick={handleHighlight}>
                    高亮
                  </button>
                  <button className="px-2 py-1 rounded hover:bg-white/15" onClick={handleCreateComment}>
                    评论
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
              <span>open_id: 8698850042786625888</span>
              <span>game_id: 21116</span>
            </div>
          </div>

          <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0">
            <div className="h-11 flex items-center justify-between px-4 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">标注</span>
              {RISK_BADGE(livePanelRisk)}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="relative">
                <label className="text-xs text-gray-500 mb-1 block">错误码</label>
                {errorCodeTags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {errorCodeTags.map((code) => (
                      <span key={code} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                        {code}
                        <button type="button" className="text-blue-500 hover:text-blue-700" onClick={() => handleRemoveErrorCodeTag(code)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Input
                  value={errorCodeInput}
                  onChange={(e) => handleErrorCodeChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitInputAsTag()
                    }
                  }}
                  onFocus={() => setShowErrorCodeSuggestions(true)}
                  onBlur={() => window.setTimeout(() => commitInputAsTag(), 120)}
                  placeholder="请输入完整错误码或关键字后回车"
                  className="h-8 text-xs"
                />
                {showErrorCodeSuggestions && errorCodeSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                    {errorCodeSuggestions.map((item) => (
                      <button
                        key={item.errorCode}
                        type="button"
                        className="w-full text-left px-2.5 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectErrorCodeSuggestion(item)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-gray-800">{item.errorCode}</span>
                          <span className="text-[11px] text-gray-400">{toRiskTag(item.riskLevel)}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">{item.standard}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">风险等级</label>
                <Select value={manualRiskLevel ?? '__AUTO__'} onValueChange={(value) => setManualRiskLevel(value === '__AUTO__' ? null : (value as RiskLevel))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="自动按错误码推导" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__AUTO__">自动（按错误码推导）</SelectItem>
                    {RISK_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">优化策略</label>
                <Select value={optimizationStrategy} onValueChange={setOptimizationStrategy}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="请选择优化策略" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MQA补充">MQA补充</SelectItem>
                    <SelectItem value="知识修正">知识修正</SelectItem>
                    <SelectItem value="Prompt调优">Prompt调优</SelectItem>
                    <SelectItem value="业务排查">业务排查</SelectItem>
                    <SelectItem value="算法排查">算法排查</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">备注</label>
                <Textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="请输入备注(选填)"
                  className="text-xs min-h-24 resize-none"
                  maxLength={500}
                />
                <div className="text-right text-[11px] text-gray-300 mt-1">{remark.length} / 500</div>
              </div>

              <div className="space-y-2">
                {inlineComments.map((item) => {
                  const circle = CIRCLE_INDEX[(item.index - 1) % CIRCLE_INDEX.length] || `${item.index}.`
                  return (
                    <div key={item.id} className="rounded-md border border-blue-100 bg-blue-50/50 p-2">
                      <div className="text-[11px] text-blue-600 mb-1 flex items-center justify-between gap-2">
                        <span>
                          {circle} 划词：{item.quote}
                        </span>
                        <button
                          type="button"
                          className="text-[11px] text-red-500 hover:text-red-600"
                          onClick={() => {
                            setInlineCommentsByRecordId((prev) => {
                              const current = prev[selectedRecord.id] ?? []
                              const filtered = current.filter((c) => c.id !== item.id)
                              return {
                                ...prev,
                                [selectedRecord.id]: normalizeInlineComments(filtered),
                              }
                            })
                          }}
                        >
                          删除
                        </button>
                      </div>
                      <Input
                        ref={(node) => {
                          inlineCommentRefs.current[item.id] = node
                        }}
                        value={item.text}
                        onChange={(e) => {
                          const value = e.target.value
                          setInlineCommentsByRecordId((prev) => {
                            const current = prev[selectedRecord.id] ?? []
                            const updated = current.map((c) => (c.id === item.id ? { ...c, text: value } : c))
                            const filtered = updated.filter((c) => c.text.trim().length > 0)
                            return {
                              ...prev,
                              [selectedRecord.id]: normalizeInlineComments(filtered),
                            }
                          })
                        }}
                        className="h-7 text-xs bg-white"
                        placeholder="请输入该划词评论"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-gray-100 p-3 flex items-center gap-2 shrink-0">
              <Button variant="outline" className="flex-1 h-8 text-xs" onClick={goPrev}>
                上一条
              </Button>
              <Button className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={goNext}>
                下一条
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ExportResultDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        riskLevels={exportRiskLevels}
        onRiskLevelsChange={setExportRiskLevels}
        errorCodeKeyword={exportErrorCodeKeyword}
        onErrorCodeKeywordChange={setExportErrorCodeKeyword}
        annotatorOptions={exportAnnotatorOptions}
        selectedAnnotators={exportAnnotators}
        onSelectedAnnotatorsChange={setExportAnnotators}
        dedupCount={dedupExportRows.length}
        rawCount={filteredForExport.length}
        onConfirm={() => {
          const worksheet = XLSX.utils.json_to_sheet(exportRowsForXlsx, { header: exportColumns })
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, '标注结果')

          const summaryRows: Array<{ 统计项: string; 数值: string | number }> = [
            { 统计项: '总标注数', 数值: exportSummary.total },
            { 统计项: '合格数（优秀+合格）', 数值: exportSummary.qualifiedCount },
            { 统计项: '合格率', 数值: exportSummary.qualifiedRate },
            { 统计项: '', 数值: '' },
            { 统计项: '风险等级', 数值: '数量（占比）' },
            ...RISK_LEVELS.map((level) => ({
              统计项: level,
              数值: `${exportSummary.distribution[level]}（${formatPercent(exportSummary.distribution[level], exportSummary.total)}）`,
            })),
            {
              统计项: '未标注',
              数值: `${exportSummary.distribution.未标注}（${formatPercent(exportSummary.distribution.未标注, exportSummary.total)}）`,
            },
          ]
          const summarySheet = XLSX.utils.json_to_sheet(summaryRows, { header: ['统计项', '数值'], skipHeader: true })
          XLSX.utils.book_append_sheet(workbook, summarySheet, '统计汇总')

          const now = new Date()
          const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(
            now.getHours()
          ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
          const filename = `线上标注导出_${stamp}.xlsx`

          XLSX.writeFile(workbook, filename)
          setExportOpen(false)
          window.alert(
            `导出成功：${filename}\n导出条数（去重后）: ${dedupExportRows.length}\n原始匹配条数: ${filteredForExport.length}\n合格率（优秀+合格）: ${exportSummary.qualifiedRate}`
          )
        }}
      />
    </div>
  )
}
