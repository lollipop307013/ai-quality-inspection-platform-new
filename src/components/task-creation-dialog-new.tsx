import React, { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Checkbox } from './ui/checkbox'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { CalendarIcon, Plus, CheckCircle, AlertCircle, X, Download, Upload } from 'lucide-react'
import { format } from 'date-fns'

// 简单的 className 合并函数
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

interface TaskCreationDialogProps {
  children: React.ReactNode
  onTaskCreated?: (taskData: any) => void
  editingTask?: any
  isEditMode?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function TaskCreationDialog({ 
  children, 
  onTaskCreated, 
  editingTask, 
  isEditMode = false, 
  open: controlledOpen, 
  onOpenChange 
}: TaskCreationDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  const [currentStep, setCurrentStep] = useState(0)

  // Step1：任务基本信息
  const [taskName, setTaskName] = useState('')
  const [autoAddTimeTag, setAutoAddTimeTag] = useState(false) // 自动增加时间标识
  const [taskDescription, setTaskDescription] = useState('')
  const [dataType, setDataType] = useState<'dialogue'>('dialogue') // 一期仅支持对话质检
  
  // Step2：标注项配置
  const [selectedAnnotationTypes, setSelectedAnnotationTypes] = useState<string[]>([])
  
  // Step3：数据来源配置
  const [executionType, setExecutionType] = useState<'single' | 'periodic'>('single')
  const [dataSource, setDataSource] = useState<'online' | 'import'>('online')
  
  // 数据来源配置
  const [onlineConfig, setOnlineConfig] = useState({
    database: '', // 数据库选择
    dataSources: [] as Array<{ channel: string; gameId: string }>, // 数据组合
    taskQuantity: 0, // 会话数量（选填）
    keywords: '' as string, // 关键词过滤
    filterRules: [] as string[] // 规则过滤
  })
  
  // 周期任务配置
  const [periodicConfig, setPeriodicConfig] = useState({
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    scheduleType: 'daily' as 'daily' | 'weekly', // 节点类型：每天或每周
    selectedWeekdays: [] as number[], // 选中的星期几（周日=0, 周一=1, ...）
    weekdayDataRanges: {} as Record<number, number>, // 每个星期几的数据范围配置（默认1天）
    executionTime: '23:59'
  })
  
  // 单次任务时间范围
  const [singleTimeRange, setSingleTimeRange] = useState({
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined
  })

  // 手动导入文件
  const [manualImportFile, setManualImportFile] = useState<File | null>(null)
  const [forceDialogueFormat, setForceDialogueFormat] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 模拟数据
  const databaseOptions = [
    { id: 'quality_inspection_message_table', name: '质检消息表' }
  ]

  const channelOptions = [
    { id: 'enterprise_wechat', name: '企业微信渠道' },
    { id: 'qq_channel', name: 'QQ甄选渠道' },
    { id: 'game_sdk', name: '游戏内SDK渠道' },
    { id: 'mini_program', name: '小程序渠道' }
  ]

  const gameOptions = [
    { id: '1197', name: '【SDK3】火影忍者-手游 (and 火影忍者公众号)' },
    { id: '1180', name: '拳皇98终极之战OL(1180)' },
    { id: '1187', name: '英雄杀（手游）(1187)' },
    { id: '1191', name: '王者荣耀(1191)' },
    { id: '1194', name: 'CFM 穿越火线手游(1194)' },
    { id: '1211', name: '御龙在天手游(1211)' },
    { id: '1217', name: '新剑侠情缘(1217)' },
    { id: '1243', name: '【H5】魂斗罗:归来(1243)' }
  ]

  const availableAnnotationTypes = [
    {
      id: 'error_code',
      name: '错误码标注',
      description: '基于质检标准配置中的错误码进行标注',
      color: 'bg-red-100 text-red-800'
    }
  ]

  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  // 步骤配置
  const steps = [
    { id: 'basic', title: '基本信息配置', description: '填写任务名称、描述等基本信息' },
    { id: 'annotation-types', title: '标注项目配置', description: '选择需要的标注字段' },
    { id: 'data-source', title: '数据来源配置', description: '配置数据源和任务频次' },
    { id: 'preview', title: '确认与创建', description: '最终预览并创建任务' }
  ]

  // 处理函数
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const canProceedToNext = () => {
    switch (currentStep) {
      case 0: // Step1：基本信息配置
        return taskName.trim() !== '' && Boolean(dataType)
      case 1: // Step2：标注项目配置
        return selectedAnnotationTypes.length > 0
      case 2: // Step3：数据来源配置
        if (dataSource === 'online') {
          // 必须选择数据库
          if (!onlineConfig.database) return false
          // 至少需要一个数据源组合
          if (onlineConfig.dataSources.length === 0) return false
          // 验证每个数据源的渠道和游戏ID都已填写
          if (onlineConfig.dataSources.some(ds => !ds.channel || !ds.gameId)) return false
          
          if (executionType === 'single') {
            return singleTimeRange.startDate && singleTimeRange.endDate
          }
          if (executionType === 'periodic') {
            // 周期任务验证
            if (!periodicConfig.startDate || !periodicConfig.endDate) return false
            if (periodicConfig.scheduleType === 'daily') {
              return true // 每天不需要额外配置
            }
            if (periodicConfig.scheduleType === 'weekly') {
              return periodicConfig.selectedWeekdays.length > 0 // 至少选择一个星期几
            }
            return true
          }
          return true
        } else {
          // 手动导入：必须上传文件
          return !!manualImportFile
        }
      case 3: // Step4：确认与创建
        return true
      default:
        return true
    }
  }

  const handleAnnotationTypeChange = (typeId: string, checked: boolean) => {
    if (checked) {
      setSelectedAnnotationTypes([...selectedAnnotationTypes, typeId])
    } else {
      setSelectedAnnotationTypes(selectedAnnotationTypes.filter(id => id !== typeId))
    }
  }



  // 计算某个星期几可以配置的最大数据范围（单向回溯，避免重叠）
  const getMaxDataRangeForWeekday = (weekday: number) => {
    const sortedWeekdays = [...periodicConfig.selectedWeekdays].sort((a, b) => a - b)
    const currentIndex = sortedWeekdays.indexOf(weekday)
    
    if (currentIndex === -1) return 7 // 未选中的情况
    
    if (currentIndex === 0) {
      // 第一个节点，需要计算到前一周最后一个节点的距离
      const lastWeekday = sortedWeekdays[sortedWeekdays.length - 1]
      const distance = (weekday - lastWeekday + 7) % 7
      return distance === 0 ? 7 : distance
    } else {
      // 其他节点，计算到前一个节点的距离
      const prevWeekday = sortedWeekdays[currentIndex - 1]
      const distance = (weekday - prevWeekday + 7) % 7
      return distance === 0 ? 7 : distance
    }
  }

  // 切换星期几的选中状态
  const toggleWeekday = (weekday: number) => {
    const newSelectedWeekdays = periodicConfig.selectedWeekdays.includes(weekday)
      ? periodicConfig.selectedWeekdays.filter(w => w !== weekday)
      : [...periodicConfig.selectedWeekdays, weekday].sort((a, b) => a - b)
    
    // 如果取消选中，清除该星期几的数据范围配置
    const newWeekdayDataRanges = { ...periodicConfig.weekdayDataRanges }
    if (!newSelectedWeekdays.includes(weekday)) {
      delete newWeekdayDataRanges[weekday]
    } else if (!newWeekdayDataRanges[weekday]) {
      // 新选中的星期几，默认1天
      newWeekdayDataRanges[weekday] = 1
    }
    
    setPeriodicConfig({
      ...periodicConfig,
      selectedWeekdays: newSelectedWeekdays,
      weekdayDataRanges: newWeekdayDataRanges
    })
  }

  // 更新某个星期几的数据范围
  const updateWeekdayDataRange = (weekday: number, days: number) => {
    setPeriodicConfig({
      ...periodicConfig,
      weekdayDataRanges: {
        ...periodicConfig.weekdayDataRanges,
        [weekday]: days
      }
    })
  }

  const addDataSource = () => {
    setOnlineConfig({
      ...onlineConfig,
      dataSources: [...onlineConfig.dataSources, { channel: '', gameId: '' }]
    })
  }

  const removeDataSource = (index: number) => {
    const newSources = onlineConfig.dataSources.filter((_, i) => i !== index)
    setOnlineConfig({ ...onlineConfig, dataSources: newSources })
  }

  const updateDataSource = (index: number, field: 'channel' | 'gameId', value: string) => {
    const newSources = [...onlineConfig.dataSources]
    newSources[index][field] = value
    setOnlineConfig({ ...onlineConfig, dataSources: newSources })
  }



  const downloadTemplate = () => {
    const link = document.createElement('a')
    link.setAttribute('href', `${import.meta.env.BASE_URL}templates/人工质检任务_手动导入模板草案.xlsx`)
    link.setAttribute('download', '人工质检任务_手动导入模板草案.xlsx')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  const handleManualFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setManualImportFile(file)
  }

  const handleSubmit = () => {
    const taskQuantity = onlineConfig.taskQuantity || 100
    
    // 生成最终任务名称（如果开启了时间标识）
    let finalTaskName = taskName
    if (autoAddTimeTag) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      finalTaskName = `${taskName}${year}${month}${day}`
    }
    
    const newTask = {
      id: Date.now(),
      name: finalTaskName,
      description: taskDescription || `这是一个${executionType === 'periodic' ? '周期性' : '单次'}质检任务`,
      status: 'pending',
      totalCount: taskQuantity,
      completedCount: 0,
      errorRate: '0.0',
      similarity: '100.0',
      annotators: [],
      createdAt: new Date().toLocaleDateString(),
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      taskType: executionType,
      config: {
        dataType,
        taskName,
        autoAddTimeTag,
        executionType,
        dataSource,
        onlineConfig,
        periodicConfig,
        singleTimeRange,
        selectedAnnotationTypes
      }
    }
    
    console.log('创建任务:', newTask)
    
    if (onTaskCreated) {
      onTaskCreated(newTask)
    }
    
    setOpen(false)
    
    // 重置表单
    resetForm()
  }

  const resetForm = () => {
    setCurrentStep(0)
    setTaskName('')
    setAutoAddTimeTag(false)
    setTaskDescription('')
    setDataType('dialogue')
    setExecutionType('single')
    setDataSource('online')
    setOnlineConfig({
      database: '',
      dataSources: [],
      taskQuantity: 0,
      keywords: '',
      filterRules: []
    })
    setPeriodicConfig({
      startDate: undefined,
      endDate: undefined,
      scheduleType: 'daily',
      selectedWeekdays: [],
      weekdayDataRanges: {},
      executionTime: '23:59'
    })
    setSingleTimeRange({
      startDate: undefined,
      endDate: undefined
    })
    setSelectedAnnotationTypes([])
    setManualImportFile(null)
    setForceDialogueFormat(true)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[86vh] overflow-hidden flex flex-col p-3">
        <style>{`
          .scrollbar-thin::-webkit-scrollbar {
            width: 6px;
          }
          .scrollbar-thin::-webkit-scrollbar-track {
            background: transparent;
          }
          .scrollbar-thin::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 3px;
          }
          .scrollbar-thin::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}</style>
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="text-xs font-medium flex items-center">
            <Plus className="w-4 h-4 mr-1.5" />
            {isEditMode ? '编辑质检任务' : '创建质检任务'}
          </DialogTitle>
        </DialogHeader>

        {/* 步骤指示器 - 紧凑样式，贴近设计稿 */}
        <div className="flex items-center justify-between pb-3 border-b sticky top-0 bg-white z-10">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <div
                className={`flex items-center justify-center w-3.5 h-3.5 rounded-full border ${
                  index <= currentStep ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-transparent'
                }`}
              >
                •
              </div>
              <div className="ml-2 min-w-0">
                <p className={`text-[11px] leading-4 truncate ${index === currentStep ? 'text-gray-900' : 'text-gray-500'}`}>
                  第{index + 1}步：{step.title}
                </p>
                <p className="text-[10px] leading-4 text-gray-400 truncate">{step.description}</p>
              </div>
              {index < steps.length - 1 && <div className="mx-2 h-px flex-1 bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* 步骤内容 - 可滚动区域 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-[500px] pr-2">
          {/* Step1：基本信息配置 */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">第1步：基本信息配置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="task-name">任务名称 *</Label>
                      <span className="text-xs text-gray-500">{taskName.length}/30</span>
                    </div>
                    <Input
                      id="task-name"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value.slice(0, 30))}
                      placeholder="请输入任务名称（最多30个字符）"
                      maxLength={30}
                    />
                  </div>

                  <div>
                    <Label>数据类型 *</Label>
                    <Select value={dataType} onValueChange={(value: 'dialogue') => setDataType(value)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="选择数据类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dialogue">对话标注</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500 mt-1">
                      一期仅支持对话标注，不可配置
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <Label htmlFor="auto-time-tag" className="font-medium text-gray-700">自动增加时间标识</Label>
                      <p className="text-sm text-gray-600 mt-1">开启后，在生成新任务时，会在任务名后自动增加年月日后缀，适合周期任务</p>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        id="auto-time-tag"
                        onClick={() => setAutoAddTimeTag(!autoAddTimeTag)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          autoAddTimeTag ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            autoAddTimeTag ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="task-description">任务描述（选填）</Label>
                      <span className="text-xs text-gray-500">{taskDescription.length}/500</span>
                    </div>
                    <Textarea
                      id="task-description"
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value.slice(0, 500))}
                      placeholder="请描述任务的标注目标和要求（最多500个字符）"
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step2：标注项目配置 */}
          {currentStep === 1 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold text-gray-900">第2步：标注项目配置</h3>
              <div>
                <Label className="text-xs">选择可用的字段类型</Label>
                <div
                  className={`mt-2 w-[180px] rounded border px-3 py-2 cursor-pointer transition-colors ${
                    selectedAnnotationTypes.includes('error_code')
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => handleAnnotationTypeChange('error_code', !selectedAnnotationTypes.includes('error_code'))}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedAnnotationTypes.includes('error_code')}
                      onChange={() => {}}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs text-gray-800">错误码标注</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">基于质检标准配置中的错误码进行标注</p>
                </div>
              </div>

              {selectedAnnotationTypes.length === 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  请至少选择一种标注类型
                </div>
              )}
            </div>
          )}

          {/* Step3：数据来源配置 */}
          {currentStep === 2 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold text-gray-900">第3步：数据来源配置</h3>

              <div>
                <Label className="text-xs">数据来源 *</Label>
                <RadioGroup
                  value={dataSource}
                  onValueChange={(value: 'online' | 'import') => setDataSource(value)}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="online" id="online" />
                    <Label htmlFor="online" className="text-xs">数据库导入</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="import" id="import" />
                    <Label htmlFor="import" className="text-xs">手动导入</Label>
                  </div>
                </RadioGroup>
              </div>

              {dataSource === 'online' && (
                <div className="space-y-3 border rounded p-3 bg-blue-50/20">
                  <div>
                    <Label className="text-xs">选择数据库 *</Label>
                    <Select value={onlineConfig.database} onValueChange={(value) => setOnlineConfig({ ...onlineConfig, database: value })}>
                      <SelectTrigger className="mt-1.5 h-8 text-xs">
                        <SelectValue placeholder="请选择数据库" />
                      </SelectTrigger>
                      <SelectContent>
                        {databaseOptions.map((db) => (
                          <SelectItem key={db.id} value={db.id}>{db.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs">数据源配置（渠道+游戏ID）*</Label>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addDataSource}>
                        <Plus className="w-3.5 h-3.5 mr-1" />添加
                      </Button>
                    </div>
                    {onlineConfig.dataSources.length === 0 ? (
                      <div className="text-[11px] text-gray-500 border border-dashed rounded px-3 py-3">请添加至少一个数据源组合</div>
                    ) : (
                      <div className="space-y-2">
                        {onlineConfig.dataSources.map((source, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Select value={source.channel} onValueChange={(value) => updateDataSource(index, 'channel', value)}>
                              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="选择渠道" /></SelectTrigger>
                              <SelectContent>
                                {channelOptions.map((channel) => (
                                  <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={source.gameId} onValueChange={(value) => updateDataSource(index, 'gameId', value)}>
                              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="选择游戏ID" /></SelectTrigger>
                              <SelectContent>
                                {gameOptions.map((game) => (
                                  <SelectItem key={game.id} value={game.id}>{game.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 px-0" onClick={() => removeDataSource(index)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {dataSource === 'import' && (
                <div className="space-y-3 border rounded p-3 bg-amber-50/10">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleManualFileChange}
                  />

                  <div>
                    <Label className="text-xs">上传文件（选填）</Label>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={triggerUpload}>
                        <Upload className="w-3.5 h-3.5 mr-1" /> 选择文件
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-blue-600" onClick={downloadTemplate}>
                        <Download className="w-3.5 h-3.5 mr-1" /> 下载模板
                      </Button>
                    </div>
                  </div>

                  {manualImportFile && (
                    <div className="flex items-center justify-between border rounded px-2.5 py-2 bg-white">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded bg-green-500 text-white text-[10px] flex items-center justify-center">XLS</div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-800 truncate">{manualImportFile.name}</p>
                          <p className="text-[10px] text-gray-400">{(manualImportFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => setManualImportFile(null)}
                      >
                        删除
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="force-dialogue-format"
                      checked={forceDialogueFormat}
                      onCheckedChange={(checked) => setForceDialogueFormat(Boolean(checked))}
                    />
                    <Label htmlFor="force-dialogue-format" className="text-xs text-gray-600">强制保持对话格式</Label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step4：确认与创建 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">第4步：确认与创建</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">任务配置总览</h3>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex">
                        <span className="font-medium text-gray-700 w-32">任务名称：</span>
                        <span className="text-gray-900">{taskName}</span>
                      </div>
                      
                      <div className="flex">
                        <span className="font-medium text-gray-700 w-32">数据类型：</span>
                        <span className="text-gray-900">对话标注</span>
                      </div>
                      
                      {taskDescription && (
                        <div className="flex">
                          <span className="font-medium text-gray-700 w-32">任务描述：</span>
                          <span className="text-gray-900">{taskDescription}</span>
                        </div>
                      )}
                      
                      <div className="flex">
                        <span className="font-medium text-gray-700 w-32">标注类型：</span>
                        <span className="text-gray-900">
                          {selectedAnnotationTypes.map(id => 
                            availableAnnotationTypes.find(t => t.id === id)?.name
                          ).join('、')}
                        </span>
                      </div>
                      
                      <div className="flex">
                        <span className="font-medium text-gray-700 w-32">任务类型：</span>
                        <span className="text-gray-900">{executionType === 'single' ? '单次任务' : '周期任务'}</span>
                      </div>
                      
                      <div className="flex">
                        <span className="font-medium text-gray-700 w-32">数据源数量：</span>
                        <span className="text-gray-900">{onlineConfig.dataSources.length}组</span>
                      </div>
                      
                      {onlineConfig.taskQuantity > 0 && (
                        <div className="flex">
                          <span className="font-medium text-gray-700 w-32">会话数量：</span>
                          <span className="text-gray-900">{onlineConfig.taskQuantity}条</span>
                        </div>
                      )}
                      
                      {onlineConfig.keywords && (
                        <div className="flex">
                          <span className="font-medium text-gray-700 w-32">关键词过滤：</span>
                          <span className="text-gray-900 whitespace-pre-wrap">{onlineConfig.keywords}</span>
                        </div>
                      )}
                      
                      {onlineConfig.filterRules.length > 0 && (
                        <div className="flex">
                          <span className="font-medium text-gray-700 w-32">规则过滤：</span>
                          <span className="text-gray-900">
                            {onlineConfig.filterRules.map(rule => {
                              if (rule === 'no_bot_reply') return '无Bot回复'
                              if (rule === 'pure_push') return '纯推送消息'
                              if (rule === 'pure_image') return '纯图片会话'
                              return rule
                            }).join('、')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        配置已完成，点击"创建任务"按钮即可创建
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* 底部按钮 - 固定在底部 */}
        <div className="flex justify-between pt-4 border-t mt-4 flex-shrink-0">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            上一步
          </Button>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={nextStep}
                disabled={!canProceedToNext()}
              >
                下一步
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceedToNext()}
              >
                创建任务
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
