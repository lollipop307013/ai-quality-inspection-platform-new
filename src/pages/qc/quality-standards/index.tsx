import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import '@/legacy-tailwind.css'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Upload,
  Download,
  Plus,
  MoreHorizontal,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useOnlineChannelStore, RiskLevel, RISK_LEVEL_STYLE, normalizeRiskLevel, RISK_LEVELS } from '@/store/onlineStore'
import { DEFAULT_QUALITY_STANDARD_ROWS } from '@/data/quality-standards'

interface StandardRow {
  id: string
  dimension: string
  category: string
  subCategory: string
  standard: string
  description: string
  errorCodeConfig: string
  riskLevel: RiskLevel
  enabled: boolean
}

type LevelKey = 'dimension' | 'category' | 'subCategory' | 'standard'
type EditableField = LevelKey | 'description' | 'errorCodeConfig' | 'riskLevel'

const initialRows: StandardRow[] = DEFAULT_QUALITY_STANDARD_ROWS.map((row) => ({ ...row }))

const TEMPLATE_HEADERS = ['整体维度', '大类', '小类', '标准', '回复标准说明', '错误码', '错误等级', '错误项说明']
const VALID_RISK_LEVELS = RISK_LEVELS
const INLINE_EDIT_INPUT_CLASS = 'w-full h-7 rounded border border-blue-300 bg-white px-2 text-xs text-gray-700 outline-none focus:ring-1 focus:ring-blue-300'
const INLINE_EDIT_SELECT_CLASS = 'h-7 rounded border border-blue-300 bg-white px-2 text-xs text-gray-700 outline-none focus:ring-1 focus:ring-blue-300'
const INLINE_EDIT_TEXT_CLASS =
  'cursor-text inline-flex min-h-[20px] w-full items-center rounded px-1 -mx-1 text-gray-700 hover:bg-blue-50/70 transition-colors'

type ImportStep = 'intro' | 'select' | 'errors' | null

interface ImportErrorItem {
  row: number
  field: string
  reason: string
}

interface DeleteConfirmPlan {
  level: LevelKey
  target: string
  affectedIds: string[]
  standardCount: number
  errorCodeCount: number
}

function createRow(seed?: Partial<StandardRow>): StandardRow {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    dimension: '',
    category: '',
    subCategory: '',
    standard: '',
    description: '',
    errorCodeConfig: '#000000',
    riskLevel: '低风险错误',
    enabled: false,
    ...seed,
  }
}

function askInput(title: string, fallback = '') {
  const value = window.prompt(title, fallback)
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

function requireDoubleConfirm(actionText: string, targetText: string) {
  const first = window.confirm(`确认执行「${actionText}」？\n\n对象：${targetText}`)
  if (!first) return false
  return window.confirm('再次确认：该操作将影响当前标准结构，是否继续？')
}

function levelLabel(level: LevelKey) {
  if (level === 'dimension') return '维度'
  if (level === 'category') return '大类'
  if (level === 'subCategory') return '小类'
  return '标准'
}

/** 质检标准配置：维度/大类/小类/标准四级联动表格，原样迁移自旧平台 Demo。 */
export default function QualityStandardsPage() {
  const [rows, setRows] = useState<StandardRow[]>(initialRows)
  const { getCurrentChannel } = useOnlineChannelStore()
  const currentChannel = getCurrentChannel()

  const [importStep, setImportStep] = useState<ImportStep>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileCheckPassed, setFileCheckPassed] = useState(false)
  const [importErrors, setImportErrors] = useState<ImportErrorItem[]>([])
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState<DeleteConfirmPlan | null>(null)
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: EditableField } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getSameLevelIndexes = (level: LevelKey, row: StandardRow, source: StandardRow[]) => {
    if (level === 'dimension') {
      return source.reduce<number[]>((acc, item, idx) => {
        if (item.dimension === row.dimension) acc.push(idx)
        return acc
      }, [])
    }
    if (level === 'category') {
      return source.reduce<number[]>((acc, item, idx) => {
        if (item.dimension === row.dimension && item.category === row.category) acc.push(idx)
        return acc
      }, [])
    }
    if (level === 'subCategory') {
      return source.reduce<number[]>((acc, item, idx) => {
        if (item.dimension === row.dimension && item.category === row.category && item.subCategory === row.subCategory) {
          acc.push(idx)
        }
        return acc
      }, [])
    }
    return source.reduce<number[]>((acc, item, idx) => {
      if (item.id === row.id) acc.push(idx)
      return acc
    }, [])
  }

  const insertAfterIndexes = (source: StandardRow[], indexes: number[], newRows: StandardRow[]) => {
    if (indexes.length === 0) {
      return [...source, ...newRows]
    }
    const next = [...source]
    const insertAt = Math.max(...indexes) + 1
    next.splice(insertAt, 0, ...newRows)
    return next
  }

  const handleAddSibling = (level: LevelKey, row: StandardRow) => {
    if (!requireDoubleConfirm(`新增同级${levelLabel(level)}`, level === 'standard' ? row.standard || '空标准' : row[level])) return

    setRows((prev) => {
      const indexes = getSameLevelIndexes(level, row, prev)

      if (level === 'dimension') {
        const name = askInput('请输入新维度名称')
        if (!name) return prev
        return insertAfterIndexes(prev, indexes, [createRow({ dimension: name })])
      }

      if (level === 'category') {
        if (!row.dimension) return prev
        const name = askInput('请输入新大类名称')
        if (!name) return prev
        return insertAfterIndexes(prev, indexes, [createRow({ dimension: row.dimension, category: name })])
      }

      if (level === 'subCategory') {
        if (!row.dimension || !row.category) return prev
        const name = askInput('请输入新小类名称')
        if (!name) return prev
        return insertAfterIndexes(prev, indexes, [createRow({ dimension: row.dimension, category: row.category, subCategory: name })])
      }

      if (!row.dimension || !row.category || !row.subCategory) return prev
      const standard = askInput('请输入标准名称')
      if (!standard) return prev
      const description = askInput('请输入标准说明', '待补充') || '待补充'
      const errorCodeConfig = askInput('请输入错误码（如 #010201）', '#010201') || '#010201'
      const riskInput = askInput(`请输入错误等级（${VALID_RISK_LEVELS.join(' / ')}）`, '低风险错误') || '低风险错误'
      const riskLevel = normalizeRiskLevel(riskInput)

      return insertAfterIndexes(prev, indexes, [
        createRow({
          dimension: row.dimension,
          category: row.category,
          subCategory: row.subCategory,
          standard,
          description,
          errorCodeConfig,
          riskLevel,
        }),
      ])
    })
  }

  const handleEditLevel = (level: LevelKey, row: StandardRow) => {
    const target = level === 'standard' ? row.standard || '空标准' : row[level]
    if (!target) return
    if (!requireDoubleConfirm(`编辑${levelLabel(level)}`, target)) return

    setRows((prev) => {
      const indexes = getSameLevelIndexes(level, row, prev)
      if (indexes.length === 0) return prev
      const next = [...prev]

      if (level === 'standard') {
        const base = next[indexes[0]]
        const standard = askInput('请输入新的标准名称', base.standard)
        if (!standard) return prev
        const description = askInput('请输入新的标准说明', base.description) || base.description
        const errorCodeConfig = askInput('请输入新的错误码', base.errorCodeConfig) || base.errorCodeConfig
        const riskInput = askInput(`请输入错误等级（${VALID_RISK_LEVELS.join(' / ')}）`, base.riskLevel) || base.riskLevel
        const riskLevel = normalizeRiskLevel(riskInput)

        next[indexes[0]] = { ...base, standard, description, errorCodeConfig, riskLevel }
        return next
      }

      const label = levelLabel(level)
      const oldValue = next[indexes[0]][level]
      const newValue = askInput(`请输入新的${label}名称`, oldValue)
      if (!newValue) return prev
      indexes.forEach((idx) => {
        next[idx] = { ...next[idx], [level]: newValue }
      })
      return next
    })
  }

  const handleDeleteLevel = (level: LevelKey, row: StandardRow) => {
    const target = level === 'standard' ? row.standard || '空标准' : row[level]
    if (!target) return

    const indexes = getSameLevelIndexes(level, row, rows)
    if (indexes.length === 0) return

    const affectedRows = indexes.map((idx) => rows[idx])
    const standardCount = new Set(affectedRows.map((item) => item.standard).filter((item) => item.trim().length > 0)).size
    const errorCodeCount = new Set(affectedRows.map((item) => item.errorCodeConfig).filter((item) => item.trim().length > 0)).size

    setDeleteConfirmPlan({
      level,
      target,
      affectedIds: affectedRows.map((item) => item.id),
      standardCount,
      errorCodeCount,
    })
  }

  const confirmDeleteLevel = () => {
    if (!deleteConfirmPlan) return

    setRows((prev) => {
      const deleted = new Set(deleteConfirmPlan.affectedIds)
      const remaining = prev.filter((item) => !deleted.has(item.id))
      return remaining.length > 0 ? remaining : [createRow()]
    })
    setDeleteConfirmPlan(null)
  }

  const handleAddDefinition = (level: LevelKey, row: StandardRow) => {
    if (!requireDoubleConfirm(`新增${levelLabel(level)}定义`, `行 ${row.id}`)) return

    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === row.id)
      if (idx < 0) return prev
      const next = [...prev]
      const target = { ...next[idx] }

      if (level === 'dimension') {
        const name = askInput('请输入维度定义')
        if (!name) return prev
        target.dimension = name
      }

      if (level === 'category') {
        if (!target.dimension) {
          window.alert('请先定义维度')
          return prev
        }
        const name = askInput('请输入大类定义')
        if (!name) return prev
        target.category = name
      }

      if (level === 'subCategory') {
        if (!target.dimension || !target.category) {
          window.alert('请先定义维度和大类')
          return prev
        }
        const name = askInput('请输入小类定义')
        if (!name) return prev
        target.subCategory = name
      }

      if (level === 'standard') {
        if (!target.dimension || !target.category || !target.subCategory) {
          window.alert('请先定义维度/大类/小类')
          return prev
        }
        const standard = askInput('请输入标准名称')
        if (!standard) return prev
        const description = askInput('请输入标准说明', '待补充') || '待补充'
        const errorCodeConfig = askInput('请输入错误码（如 #010201）', '#010201') || '#010201'
        const riskInput = askInput(`请输入错误等级（${VALID_RISK_LEVELS.join(' / ')}）`, '低风险错误') || '低风险错误'

        target.standard = standard
        target.description = description
        target.errorCodeConfig = errorCodeConfig
        target.riskLevel = normalizeRiskLevel(riskInput)
      }

      next[idx] = target
      return next
    })
  }

  const beginCellEdit = (row: StandardRow, field: EditableField) => {
    setEditingCell({ rowId: row.id, field })
    if (field === 'riskLevel') {
      setEditingValue(normalizeRiskLevel(row.riskLevel))
      return
    }
    setEditingValue((row[field] ?? '').toString())
  }

  const commitCellEdit = () => {
    if (!editingCell) return

    setRows((prev) => {
      const idx = prev.findIndex((item) => item.id === editingCell.rowId)
      if (idx < 0) return prev

      const next = [...prev]
      const base = next[idx]

      if (editingCell.field === 'description' || editingCell.field === 'errorCodeConfig') {
        next[idx] = { ...base, [editingCell.field]: editingValue.trim() }
        return next
      }

      if (editingCell.field === 'riskLevel') {
        next[idx] = { ...base, riskLevel: normalizeRiskLevel(editingValue) }
        return next
      }

      const level = editingCell.field as LevelKey
      const indexes = getSameLevelIndexes(level, base, prev)
      indexes.forEach((targetIdx) => {
        next[targetIdx] = { ...next[targetIdx], [level]: editingValue.trim() }
      })
      return next
    })

    setEditingCell(null)
    setEditingValue('')
  }

  const cancelCellEdit = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new()

    const templateSheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS])
    XLSX.utils.book_append_sheet(wb, templateSheet, '导入模板')

    const instructionRows = [
      ['知几标注标准 - 导入模板填写说明'],
      [],
      ['一、导入流程'],
      ['1. 下载模板 → 2. 按模板填写质检标准 → 3. 上传 .xlsx 文件 → 4. 系统校验并导入'],
      [],
      ['二、字段要求'],
      ['8 列表头：整体维度、大类、小类、标准、回复标准说明、错误码、错误等级、错误项说明'],
      ['· 表头不可修改，不可使用合并单元格'],
      ['· 错误码需保留 # 前缀，同一错误码必须唯一'],
      [],
      ['三、错误等级顺序'],
      ['无风险 < 低风险错误 < 中风险错误 < 高风险错误 < 极高风险错误'],
      [],
      ['四、整体判定标准'],
      ['优秀 = 无任何问题出现'],
      ['合格 = 无高/极高风险场景出现'],
      ['不合格 = 出现任意一个高/极高风险场景'],
    ]
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructionRows)
    XLSX.utils.book_append_sheet(wb, instructionSheet, '填写说明')

    const referenceRows = [
      TEMPLATE_HEADERS,
      ['对话', '称呼与表达规范', '对玩家的称呼', '对玩家的称呼', '禁止只用模糊称谓，应使用具体游戏昵称等称谓', '#010101', '中风险错误', '使用了模糊或不当的称谓'],
      ['对话', '人设一致性', '身份认知', '身份认知偏离', '不应承认自己是AI/语言模型', '#020101', '极高风险错误', '承认自己是AI或程序'],
    ]
    const referenceSheet = XLSX.utils.aoa_to_sheet(referenceRows)
    XLSX.utils.book_append_sheet(wb, referenceSheet, '通用标准参考')

    XLSX.writeFile(wb, '知几标注标准_导入模板.xlsx')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx')
    const isSizeOk = file.size <= 10 * 1024 * 1024
    setFileCheckPassed(isXlsx && isSizeOk)
    setImportStep('select')
  }

  const handleStartValidateImport = () => {
    if (!selectedFile) return
    const mockErrors: ImportErrorItem[] = [
      { row: 5, field: '错误等级', reason: '值"高危"不合法，仅允许4个合法值' },
      { row: 12, field: '错误码', reason: '错误码未保留 # 前缀（当前: ER0001）' },
      { row: 18, field: '大类', reason: '必填字段为空' },
    ]
    setImportErrors(mockErrors)
    setImportStep('errors')
  }

  const closeImportDialog = () => {
    setImportStep(null)
    setSelectedFile(null)
    setFileCheckPassed(false)
    setImportErrors([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleExportConfig = () => {
    const wb = XLSX.utils.book_new()
    const exportRows = [
      TEMPLATE_HEADERS,
      ...rows.map((r) => [r.dimension, r.category, r.subCategory, r.standard, r.description, r.errorCodeConfig, r.riskLevel, '']),
    ]
    const sheet = XLSX.utils.aoa_to_sheet(exportRows)
    XLSX.utils.book_append_sheet(wb, sheet, '质检标准配置')
    XLSX.writeFile(wb, `质检标准配置_${currentChannel?.name ?? ''}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const rowSpanInfo = useMemo(() => {
    const info: { dimensionSpan: number; categorySpan: number; isFirstOfDimension: boolean; isFirstOfCategory: boolean }[] = []
    rows.forEach((row, idx) => {
      const isFirstOfDimension = idx === 0 || rows[idx - 1].dimension !== row.dimension
      const isFirstOfCategory = idx === 0 || rows[idx - 1].category !== row.category || rows[idx - 1].dimension !== row.dimension

      let dimensionSpan = 0
      if (isFirstOfDimension) {
        for (let i = idx; i < rows.length && rows[i].dimension === row.dimension; i++) dimensionSpan++
      }

      let categorySpan = 0
      if (isFirstOfCategory) {
        for (let i = idx; i < rows.length && rows[i].dimension === row.dimension && rows[i].category === row.category; i++) categorySpan++
      }

      info.push({ dimensionSpan, categorySpan, isFirstOfDimension, isFirstOfCategory })
    })
    return info
  }, [rows])

  const renderLevelCell = (row: StandardRow, level: LevelKey, value: string) => {
    const hasValue = Boolean(value?.trim())
    const isEditing = editingCell?.rowId === row.id && editingCell.field === level

    return (
      <div className="group relative min-h-[32px] pb-4 pr-10">
        {isEditing ? (
          <input
            autoFocus
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={commitCellEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitCellEdit()
              if (e.key === 'Escape') cancelCellEdit()
            }}
            className={INLINE_EDIT_INPUT_CLASS}
          />
        ) : hasValue ? (
          <span className={INLINE_EDIT_TEXT_CLASS} onDoubleClick={() => beginCellEdit(row, level)} title="双击编辑">
            {value}
          </span>
        ) : (
          <button
            type="button"
            className="text-blue-600 hover:text-blue-700 text-[11px]"
            onClick={() => handleAddDefinition(level, row)}
          >
            + 添加{levelLabel(level)}定义
          </button>
        )}

        {!isEditing && (
          <div className="absolute right-0 bottom-0 hidden group-hover:flex items-center gap-1">
            <button
              type="button"
              className="inline-flex items-center justify-center h-4 w-4 rounded text-blue-600 hover:bg-blue-50"
              title="新增同级"
              aria-label="新增同级"
              onClick={() => handleAddSibling(level, row)}
            >
              <Plus className="h-3 w-3" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-4 w-4 rounded text-gray-500 hover:bg-gray-100"
                  title="更多操作"
                  aria-label="更多操作"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-28">
                <DropdownMenuItem onClick={() => handleEditLevel(level, row)}>编辑</DropdownMenuItem>
                <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => handleDeleteLevel(level, row)}>
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="legacy-scope flex bg-white p-4"
      style={{ margin: '-16px', minHeight: 'calc(100% + 32px)' }}
    >
      <div className="flex-1 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-sm font-semibold text-gray-900">质检标准配置</h1>
        </div>

        <div className="flex items-center justify-between mb-3 mt-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setImportStep('intro')}>
              <Upload className="w-3.5 h-3.5 mr-1" />
              导入配置
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExportConfig}>
              <Download className="w-3.5 h-3.5 mr-1" />
              导出配置
            </Button>
          </div>
          <div className="text-[11px] text-gray-400">从左到右逐层维护：维度 → 大类 → 小类 → 标准</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left font-medium w-20">维度</th>
                <th className="px-3 py-2.5 text-left font-medium w-28">大类</th>
                <th className="px-3 py-2.5 text-left font-medium w-32">小类</th>
                <th className="px-3 py-2.5 text-left font-medium w-36">标准</th>
                <th className="px-3 py-2.5 text-left font-medium">标准说明</th>
                <th className="px-3 py-2.5 text-left font-medium w-32">错误码配置项</th>
                <th className="px-3 py-2.5 text-left font-medium w-28">错误等级</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const info = rowSpanInfo[idx]
                const style = RISK_LEVEL_STYLE[normalizeRiskLevel(row.riskLevel)]

                return (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/60 align-top">
                    {info.isFirstOfDimension ? (
                      <td rowSpan={info.dimensionSpan} className="px-3 py-2.5 border-r border-gray-100 text-gray-700">
                        {renderLevelCell(row, 'dimension', row.dimension)}
                      </td>
                    ) : null}

                    {info.isFirstOfCategory ? (
                      <td rowSpan={info.categorySpan} className="px-3 py-2.5 border-r border-gray-100 text-gray-700">
                        {renderLevelCell(row, 'category', row.category)}
                      </td>
                    ) : null}

                    <td className="px-3 py-2.5 border-r border-gray-100 text-gray-700">{renderLevelCell(row, 'subCategory', row.subCategory)}</td>

                    <td className="px-3 py-2.5 border-r border-gray-100 text-gray-700">{renderLevelCell(row, 'standard', row.standard)}</td>

                    <td className="px-3 py-2.5 border-r border-gray-100 text-gray-500 leading-5 max-w-md whitespace-pre-wrap break-words">
                      {editingCell?.rowId === row.id && editingCell.field === 'description' ? (
                        <input
                          autoFocus
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={commitCellEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitCellEdit()
                            if (e.key === 'Escape') cancelCellEdit()
                          }}
                          className={INLINE_EDIT_INPUT_CLASS}
                        />
                      ) : (
                        <span className={INLINE_EDIT_TEXT_CLASS} onDoubleClick={() => beginCellEdit(row, 'description')} title="双击编辑">
                          {row.description || '-'}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 border-r border-gray-100 text-blue-600">
                      {editingCell?.rowId === row.id && editingCell.field === 'errorCodeConfig' ? (
                        <input
                          autoFocus
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={commitCellEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitCellEdit()
                            if (e.key === 'Escape') cancelCellEdit()
                          }}
                          className={INLINE_EDIT_INPUT_CLASS}
                        />
                      ) : (
                        <span className={INLINE_EDIT_TEXT_CLASS} onDoubleClick={() => beginCellEdit(row, 'errorCodeConfig')} title="双击编辑">
                          {row.errorCodeConfig || '-'}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      {editingCell?.rowId === row.id && editingCell.field === 'riskLevel' ? (
                        <select
                          autoFocus
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={commitCellEdit}
                          className={INLINE_EDIT_SELECT_CLASS}
                        >
                          {VALID_RISK_LEVELS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${style.badge} cursor-pointer`}
                          onDoubleClick={() => beginCellEdit(row, 'riskLevel')}
                          title="双击编辑"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {row.riskLevel}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={importStep === 'intro'} onOpenChange={(open) => !open && closeImportDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>导入质检标准说明</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600 leading-relaxed space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <div className="font-medium text-gray-900 mb-1">导入流程</div>
              1. 下载模板 → 2. 按模板填写质检标准 → 3. 上传 .xlsx 文件 → 4. 系统校验并导入
            </div>
            <div>
              <div className="font-medium text-gray-900 mb-1">字段要求</div>
              8 列表头：整体维度、大类、小类、标准、回复标准说明、错误码、错误等级、错误项说明
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>表头不可修改，不可使用合并单元格</li>
                <li>错误码需保留 # 前缀，同一错误码必须唯一</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-gray-900 mb-1">错误等级</div>
              无风险 &lt; 低风险错误 &lt; 中风险错误 &lt; 高风险错误 &lt; 极高风险错误
            </div>
          </div>
          <DialogFooter className="flex items-center sm:justify-between">
            <Button variant="outline" size="sm" onClick={closeImportDialog}>
              取消
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="w-3.5 h-3.5 mr-1" />
                下载导入模板
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => fileInputRef.current?.click()}>
                我已了解，选择文件
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileSelect} />

      <Dialog open={importStep === 'select'} onOpenChange={(open) => !open && closeImportDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>上传 Excel 标注数据</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-gray-200 rounded-md py-6 text-center text-gray-400 text-sm cursor-pointer hover:border-blue-300 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="w-6 h-6 mx-auto mb-1 text-gray-300" />
              拖拽或点击选择 .xlsx 文件
            </div>
            {selectedFile && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                  fileCheckPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="font-medium text-gray-800 truncate flex-1">{selectedFile.name}</span>
                {fileCheckPassed ? (
                  <span className="text-green-600 text-xs flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 格式/大小检查通过
                  </span>
                ) : (
                  <span className="text-red-600 text-xs flex items-center gap-1 shrink-0">
                    <XCircle className="w-3.5 h-3.5" /> 仅支持 .xlsx，且不超过 10MB
                  </span>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              重新选择
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={!fileCheckPassed} onClick={handleStartValidateImport}>
              开始校验并导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importStep === 'errors'} onOpenChange={(open) => !open && closeImportDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              上传 Excel 标注数据
              <span className="ml-2 text-xs font-normal text-red-500">（{importErrors.length} 项错误）</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {importErrors.map((err, idx) => (
              <div key={idx} className="bg-red-50 rounded-md px-3 py-2 text-xs flex gap-3">
                <span className="text-red-500 shrink-0 w-10">行 {err.row}</span>
                <span className="text-red-500 shrink-0 w-16">{err.field}</span>
                <span className="text-gray-600">{err.reason}</span>
              </div>
            ))}
            <div className="text-xs text-gray-400 pt-1">请修正以上 {importErrors.length} 项错误后重新上传。</div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeImportDialog}>
              取消
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setImportStep('select')
                setSelectedFile(null)
                setFileCheckPassed(false)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            >
              重新选择文件
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmPlan} onOpenChange={(open) => !open && setDeleteConfirmPlan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除{deleteConfirmPlan ? levelLabel(deleteConfirmPlan.level) : ''}确认</DialogTitle>
          </DialogHeader>

          <div className="text-sm text-gray-600 space-y-2">
            <p>
              即将删除：<span className="font-medium text-gray-900">{deleteConfirmPlan?.target ?? '-'}</span>
            </p>
            <p className="text-rose-600">该操作不可撤销，请确认是否继续。</p>
            <div className="rounded-md border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 leading-5">
              将删除标准 <span className="font-semibold">{deleteConfirmPlan?.standardCount ?? 0}</span> 条，关联错误码{' '}
              <span className="font-semibold">{deleteConfirmPlan?.errorCodeCount ?? 0}</span> 条。
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmPlan(null)}>
              取消
            </Button>
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={confirmDeleteLevel}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
