import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import '@/legacy-tailwind.css'
import TaskCreationDialog from '@/components/task-creation-dialog-new'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import ExportResultDialog from '@/components/export-result-dialog'
import { ChevronDown, MoreHorizontal, Plus, Search } from 'lucide-react'
import { RiskLevel, useOnlineChannelStore } from '@/store/onlineStore'
import AnnotationWorkbench from './AnnotationWorkbench'

type TaskStatus = '进行中' | '待分配' | '待处理'

type PageMode = 'task' | 'trigger'

interface OnlineTask {
  id: string
  projectId: string
  channelId: string
  name: string
  status: TaskStatus
  sourceScene: string
  sourceEvent: string
  channel: string
  createdAt: string
  progressDone: number
  progressTotal: number
}

interface TriggerCard {
  id: string
  projectId: string
  channelId: string
  name: string
  status: '启用' | '停用'
  sourceScene: string
  sourceEvent: string
  channel: string
  latestRunAt: string
}

const statusStyle: Record<TaskStatus, string> = {
  进行中: 'bg-blue-100 text-blue-600 border-blue-200',
  待分配: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  待处理: 'bg-gray-100 text-gray-500 border-gray-200',
}

const triggerStatusStyle: Record<TriggerCard['status'], string> = {
  启用: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  停用: 'bg-gray-100 text-gray-500 border-gray-200',
}

const mockTasks: OnlineTask[] = [
  {
    id: 'test',
    projectId: 'p_21116',
    channelId: 'sdk',
    name: 'test',
    status: '进行中',
    sourceScene: 'CodeV 无要玩助手',
    sourceEvent: '测量行动(21116)',
    channel: 'SDK',
    createdAt: '2026/07/22',
    progressDone: 2,
    progressTotal: 587,
  },
  {
    id: 'test-2',
    projectId: 'p_21116',
    channelId: 'weixin',
    name: 'test-微信',
    status: '待处理',
    sourceScene: 'CodeV 无要玩助手',
    sourceEvent: '测量行动(21116)',
    channel: '微信',
    createdAt: '2026/07/22',
    progressDone: 0,
    progressTotal: 587,
  },
  {
    id: 'wss',
    projectId: 'p_21200',
    channelId: 'sdk',
    name: '瓦手试点5',
    status: '待分配',
    sourceScene: '甄选离线质检agent',
    sourceEvent: '离线回归(21200)',
    channel: 'SDK',
    createdAt: '2026/04/17',
    progressDone: 0,
    progressTotal: 498,
  },
  {
    id: 'wss-qa',
    projectId: 'p_21200',
    channelId: 'app',
    name: '瓦手试点5 QA',
    status: '待分配',
    sourceScene: '甄选离线质检agent',
    sourceEvent: '离线回归(21200)',
    channel: 'App',
    createdAt: '2026/04/14',
    progressDone: 0,
    progressTotal: 518,
  },
  {
    id: 'wss-2',
    projectId: 'p_1116',
    channelId: 'web',
    name: '瓦手试点-Web',
    status: '待分配',
    sourceScene: 'Codixir:测试平台',
    sourceEvent: '线上灰度(1116)',
    channel: 'Web',
    createdAt: '2026/04/14',
    progressDone: 0,
    progressTotal: 430,
  },
]

const mockTriggers: TriggerCard[] = [
  {
    id: 'tg-1',
    projectId: 'p_21116',
    channelId: 'sdk',
    name: 'test',
    status: '启用',
    sourceScene: 'CodeV 无要玩助手',
    sourceEvent: '测量行动(21116)',
    channel: 'SDK',
    latestRunAt: '2026-07-17 10:26:58',
  },
  {
    id: 'tg-2',
    projectId: 'p_21116',
    channelId: 'weixin',
    name: '手广试点5',
    status: '启用',
    sourceScene: 'CodeV 无要玩助手',
    sourceEvent: '测量行动(21116)',
    channel: '微信',
    latestRunAt: '2026-04-17 10:26:58',
  },
  {
    id: 'tg-3',
    projectId: 'p_21200',
    channelId: 'app',
    name: '瓦手试点-App',
    status: '启用',
    sourceScene: '甄选离线质检agent',
    sourceEvent: '离线回归(21200)',
    channel: 'App',
    latestRunAt: '2026-04-14 13:06',
  },
]

/** 人工质检任务：任务卡片列表 + 触发器列表，原样迁移自旧平台 Demo，进入任务后在同页面内切到标注工作台。 */
export default function TaskListPage() {
  const [view, setView] = useState<'list' | 'workbench'>('list')
  const [activeTask, setActiveTask] = useState<OnlineTask | null>(null)

  const [pageMode, setPageMode] = useState<PageMode>('task')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [selectedTaskForExport, setSelectedTaskForExport] = useState<OnlineTask | null>(null)
  const [exportRiskLevels, setExportRiskLevels] = useState<RiskLevel[]>([])
  const [exportErrorCodeKeyword, setExportErrorCodeKeyword] = useState('')
  const [exportAnnotators, setExportAnnotators] = useState<string[]>([])

  const { getCurrentProject, getCurrentChannel } = useOnlineChannelStore()
  const currentProject = getCurrentProject()
  const currentChannel = getCurrentChannel()

  const scopedTasks = useMemo(() => {
    return mockTasks.filter((task) => {
      if (!currentProject || !currentChannel) return true
      return task.projectId === currentProject.id && task.channelId === currentChannel.id
    })
  }, [currentProject, currentChannel])

  const scopedTriggers = useMemo(() => {
    return mockTriggers.filter((trigger) => {
      if (!currentProject || !currentChannel) return true
      return trigger.projectId === currentProject.id && trigger.channelId === currentChannel.id
    })
  }, [currentProject, currentChannel])

  const filteredTasks = useMemo(() => {
    return scopedTasks.filter((task) => {
      const keyword = searchQuery.trim().toLowerCase()
      const matchKeyword =
        !keyword ||
        task.name.toLowerCase().includes(keyword) ||
        task.sourceScene.toLowerCase().includes(keyword) ||
        task.sourceEvent.toLowerCase().includes(keyword)

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'progress' && task.status === '进行中') ||
        (statusFilter === 'pending' && task.status === '待分配') ||
        (statusFilter === 'todo' && task.status === '待处理')

      return matchKeyword && matchStatus
    })
  }, [scopedTasks, searchQuery, statusFilter])

  const filteredTriggers = useMemo(() => {
    return scopedTriggers.filter((trigger) => {
      const keyword = searchQuery.trim().toLowerCase()
      const matchKeyword =
        !keyword ||
        trigger.name.toLowerCase().includes(keyword) ||
        trigger.sourceScene.toLowerCase().includes(keyword) ||
        trigger.sourceEvent.toLowerCase().includes(keyword)

      const matchStatus = statusFilter === 'all' || (statusFilter === 'progress' && trigger.status === '启用')
      return matchKeyword && matchStatus
    })
  }, [scopedTriggers, searchQuery, statusFilter])

  const exportAnnotatorOptions = useMemo(() => {
    return Array.from(new Set(scopedTasks.map((task) => task.name).filter((name) => name.trim().length > 0))).sort((a, b) =>
      a.localeCompare(b, 'zh-Hans-CN')
    )
  }, [scopedTasks])

  const handleTaskExport = () => {
    if (!selectedTaskForExport) return
    const row = {
      任务ID: selectedTaskForExport.id,
      任务名称: selectedTaskForExport.name,
      状态: selectedTaskForExport.status,
      项目: selectedTaskForExport.sourceScene,
      事件: selectedTaskForExport.sourceEvent,
      渠道: selectedTaskForExport.channel,
      创建时间: selectedTaskForExport.createdAt,
      任务进度: `${selectedTaskForExport.progressDone}/${selectedTaskForExport.progressTotal}`,
    }

    const sheet = XLSX.utils.json_to_sheet([row])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, '任务导出')

    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(
      now.getHours()
    ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    const filename = `任务导出_${selectedTaskForExport.id}_${stamp}.xlsx`

    XLSX.writeFile(workbook, filename)
    setExportOpen(false)
    window.alert(`导出成功：${filename}`)
  }

  if (view === 'workbench' && activeTask) {
    return <AnnotationWorkbench taskName={activeTask.name} onBack={() => setView('list')} />
  }

  return (
    <div className="legacy-scope h-full overflow-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-base font-semibold text-gray-900">人工质检任务</h1>
          <p className="text-xs text-gray-400 mt-1">
            当前范围：{currentProject?.name ?? '--'} / {currentChannel?.name ?? '--'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="progress">进行中</SelectItem>
              <SelectItem value="pending">待分配</SelectItem>
              <SelectItem value="todo">待处理</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索任务名称"
              className="h-7 pl-8 text-xs w-44"
            />
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        {pageMode === 'task' ? (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPageMode('trigger')}>
            触发器列表
          </Button>
        ) : (
          <>
            <TaskCreationDialog
              open={showCreateDialog}
              onOpenChange={setShowCreateDialog}
              onTaskCreated={(task) => {
                console.log('人工任务创建成功：', task)
                setShowCreateDialog(false)
              }}
            >
              <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-3">
                <Plus className="w-3.5 h-3.5 mr-1" />
                创建任务
              </Button>
            </TaskCreationDialog>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPageMode('task')}>
              任务列表
            </Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {pageMode === 'task'
          ? filteredTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded border border-gray-200 px-3 py-2.5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-4 h-4 rounded-full bg-gray-700 text-white text-[10px] flex items-center justify-center">
                      i
                    </div>
                    <span className="text-[13px] font-semibold text-gray-900 truncate">{task.name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 rounded-sm ${statusStyle[task.status]}`}
                    >
                      {task.status}
                    </Badge>
                  </div>
                </div>

                <div className="text-[10px] text-gray-400 leading-4 mb-2.5">
                  <div>源自: {task.sourceScene} / {task.sourceEvent} / {task.channel} / 简介：-</div>
                  <div>创建时间: {task.createdAt}</div>
                  <div>任务进度: {task.progressDone}/{task.progressTotal}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-5.5 text-[10px] px-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                    onClick={() => {
                      setActiveTask(task)
                      setView('workbench')
                    }}
                  >
                    进入任务
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5.5 text-[10px] px-1.5 text-gray-600"
                    onClick={() => {
                      setSelectedTaskForExport(task)
                      setExportOpen(true)
                    }}
                  >
                    下载
                  </Button>
                  <Button variant="ghost" size="sm" className="h-5.5 text-[10px] px-1 text-gray-600">
                    更多
                  </Button>
                  <MoreHorizontal className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                </div>
              </div>
            ))
          : filteredTriggers.map((trigger) => (
              <div
                key={trigger.id}
                className="bg-white rounded border border-gray-200 px-3 py-2.5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-4 h-4 rounded-full bg-gray-700 text-white text-[10px] flex items-center justify-center">
                      i
                    </div>
                    <span className="text-[13px] font-semibold text-gray-900 truncate">{trigger.name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 rounded-sm ${triggerStatusStyle[trigger.status]}`}
                    >
                      {trigger.status}
                    </Badge>
                  </div>
                </div>

                <div className="text-[10px] text-gray-400 leading-4 mb-2.5">
                  <div>源自: {trigger.sourceScene} / {trigger.sourceEvent} / {trigger.channel} / 简介：-</div>
                  <div>最新触发时间: {trigger.latestRunAt}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-5.5 text-[10px] px-2">
                    触发配置
                  </Button>
                  <Button variant="ghost" size="sm" className="h-5.5 text-[10px] px-1.5 text-gray-600">
                    关闭
                  </Button>
                  <Button variant="ghost" size="sm" className="h-5.5 text-[10px] px-1 text-gray-600">
                    更多
                  </Button>
                  <MoreHorizontal className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                </div>
              </div>
            ))}
      </div>

      <div className="flex items-center justify-end gap-3 mt-4 text-xs text-gray-400">
        <span>共 {pageMode === 'task' ? filteredTasks.length : filteredTriggers.length} 条</span>
        <button className="w-5 h-5 flex items-center justify-center rounded border border-blue-500 text-blue-600">1</button>
        <span className="flex items-center gap-1">
          21 条/页
          <ChevronDown className="w-3 h-3" />
        </span>
      </div>

      <ExportResultDialog
        open={exportOpen}
        onOpenChange={(open) => {
          setExportOpen(open)
          if (!open) setSelectedTaskForExport(null)
        }}
        riskLevels={exportRiskLevels}
        onRiskLevelsChange={setExportRiskLevels}
        errorCodeKeyword={exportErrorCodeKeyword}
        onErrorCodeKeywordChange={setExportErrorCodeKeyword}
        annotatorOptions={exportAnnotatorOptions}
        selectedAnnotators={exportAnnotators}
        onSelectedAnnotatorsChange={setExportAnnotators}
        dedupCount={selectedTaskForExport ? 1 : 0}
        rawCount={selectedTaskForExport ? 1 : 0}
        onConfirm={handleTaskExport}
        confirmDisabled={!selectedTaskForExport}
        title="导出任务信息"
        showFilters={false}
        summaryContent={
          selectedTaskForExport ? (
            <div className="rounded-md border border-gray-200 divide-y divide-gray-100 text-xs">
              {[
                { label: '任务名称', value: selectedTaskForExport.name },
                { label: '任务状态', value: selectedTaskForExport.status },
                {
                  label: '来源',
                  value: `${selectedTaskForExport.sourceScene} / ${selectedTaskForExport.sourceEvent} / ${selectedTaskForExport.channel}`,
                },
                { label: '创建时间', value: selectedTaskForExport.createdAt },
                {
                  label: '任务进度',
                  value: `${selectedTaskForExport.progressDone}/${selectedTaskForExport.progressTotal}`,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start px-3 py-2 gap-3">
                  <span className="w-16 shrink-0 text-gray-400">{item.label}</span>
                  <span className="text-gray-900 break-all">{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
              未选择任务，请从任务卡片点击"下载"后重试
            </div>
          )
        }
      />
    </div>
  )
}
