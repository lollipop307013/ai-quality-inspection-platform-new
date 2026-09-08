import { ReactNode } from 'react'
import { CircleHelp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RiskLevel } from '@/store/onlineStore'

interface ExportResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  riskLevels: RiskLevel[]
  onRiskLevelsChange: (levels: RiskLevel[]) => void
  errorCodeKeyword: string
  onErrorCodeKeywordChange: (value: string) => void
  annotatorOptions: string[]
  selectedAnnotators: string[]
  onSelectedAnnotatorsChange: (annotators: string[]) => void
  dedupCount: number
  rawCount: number
  onConfirm: () => void
  confirmDisabled?: boolean
  title?: string
  showFilters?: boolean
  summaryContent?: ReactNode
}

const ALL_RISK_LEVELS: RiskLevel[] = ['无风险', '低风险错误', '中风险错误', '高风险错误', '极高风险错误']

export default function ExportResultDialog({
  open,
  onOpenChange,
  riskLevels,
  onRiskLevelsChange,
  errorCodeKeyword,
  onErrorCodeKeywordChange,
  annotatorOptions,
  selectedAnnotators,
  onSelectedAnnotatorsChange,
  dedupCount,
  rawCount,
  onConfirm,
  confirmDisabled,
  title = '导出标注结果',
  showFilters = true,
  summaryContent,
}: ExportResultDialogProps) {
  const annotatorLabel =
    selectedAnnotators.length === 0
      ? '选择标注人（可多选）'
      : `${selectedAnnotators.slice(0, 2).join('、')}${selectedAnnotators.length > 2 ? ` 等${selectedAnnotators.length}人` : ''}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{title}</span>
            {showFilters && (
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-gray-400 hover:text-gray-500 cursor-help" aria-label="导出筛选说明">
                      <CircleHelp className="w-3.5 h-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={6}
                    className="max-w-xs rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] leading-4 text-gray-600 shadow-sm"
                  >
                    按风险等级、错误码、标注人筛选；多条件为 AND 关系。
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {!showFilters && summaryContent}
          {showFilters && (
            <>
              <div>
                <div className="text-xs text-gray-500 mb-2">风险等级</div>
                <div className="flex items-center flex-wrap gap-4">
                  {ALL_RISK_LEVELS.map((level) => (
                    <label key={level} className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                      <Checkbox
                        checked={riskLevels.includes(level)}
                        onCheckedChange={(checked) => {
                          onRiskLevelsChange(
                            checked ? [...riskLevels, level] : riskLevels.filter((item) => item !== level)
                          )
                        }}
                      />
                      {level.replace('错误', '')}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">错误码</div>
                  <Input
                    value={errorCodeKeyword}
                    onChange={(e) => onErrorCodeKeywordChange(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="输入错误码关键字"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">标注人</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-8 justify-between text-xs font-normal">
                        <span className="truncate text-gray-700">{annotatorLabel}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                      <div className="max-h-44 overflow-y-auto space-y-1">
                        {annotatorOptions.length === 0 ? (
                          <div className="text-xs text-gray-400 px-1 py-1">暂无有标注记录的标注人</div>
                        ) : (
                          annotatorOptions.map((name) => (
                            <label key={name} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50 text-xs text-gray-700">
                              <Checkbox
                                checked={selectedAnnotators.includes(name)}
                                onCheckedChange={(checked) => {
                                  onSelectedAnnotatorsChange(
                                    checked
                                      ? [...selectedAnnotators, name]
                                      : selectedAnnotators.filter((item) => item !== name)
                                  )
                                }}
                              />
                              <span className="truncate">{name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </>
          )}

          <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
            预计导出 <span className="font-semibold text-gray-900">{dedupCount}</span> 条（去重后，原始{' '}
            <span className="font-semibold text-gray-900">{rawCount}</span> 条）
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={onConfirm} disabled={confirmDisabled}>
            导出 .xlsx
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
