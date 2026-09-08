// 线上标注平台原型 - 全局状态（渠道管理 + 风险等级映射）
// 对应 PRD《质检平台优化与标注体验升级》子需求 1/2/3/4/7
import { create } from 'zustand'
import { fetchGbotProjects, fallbackMockProjects, GbotProject, GbotChannel } from '@/services/gbot-channel-service'

// ---------------- 子需求 7：风险等级命名优化 ----------------
// 新命名：无风险 < 低风险错误 < 中风险错误 < 高风险错误(原"严重错误") < 极高风险错误(原"高风险错误")
export type RiskLevel = '无风险' | '低风险错误' | '中风险错误' | '高风险错误' | '极高风险错误'

export const RISK_LEVELS: RiskLevel[] = ['无风险', '低风险错误', '中风险错误', '高风险错误', '极高风险错误']

// 存量旧命名 -> 新命名 映射表（向后兼容）
export const LEGACY_RISK_LEVEL_MAP: Record<string, RiskLevel> = {
  无风险: '无风险',
  低风险错误: '低风险错误',
  中风险错误: '中风险错误',
  严重错误: '高风险错误', // 旧"严重错误" -> 新"高风险错误"
  高风险错误: '极高风险错误', // 旧"高风险错误" -> 新"极高风险错误"
  // 兼容旧版"低/中/高风严谨"策略命名
  低风严谨: '低风险错误',
  中风严谨: '中风险错误',
  高风严谨: '高风险错误',
  严重违规: '高风险错误',
}

export function normalizeRiskLevel(raw: string): RiskLevel {
  return LEGACY_RISK_LEVEL_MAP[raw] ?? '无风险'
}

export const RISK_LEVEL_STYLE: Record<RiskLevel, { badge: string; dot: string; text: string }> = {
  无风险: { badge: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400', text: 'text-slate-600' },
  低风险错误: { badge: 'bg-green-50 text-green-600 border-green-200', dot: 'bg-green-500', text: 'text-green-600' },
  中风险错误: { badge: 'bg-yellow-50 text-yellow-600 border-yellow-200', dot: 'bg-yellow-500', text: 'text-yellow-600' },
  高风险错误: { badge: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-500', text: 'text-orange-600' },
  极高风险错误: { badge: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500', text: 'text-red-600' },
}

export const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  无风险: 0,
  低风险错误: 1,
  中风险错误: 2,
  高风险错误: 3,
  极高风险错误: 4,
}

const CURRENT_USER = 'yzhinan'
const CHANNEL_STORAGE_KEY = 'online_channel_memory_v1'

interface ChannelMemoryMap {
  [userKey: string]: {
    [projectId: string]: string // projectId -> channelId
  }
}

function loadChannelMemory(): ChannelMemoryMap {
  try {
    const raw = localStorage.getItem(CHANNEL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveChannelMemory(map: ChannelMemoryMap) {
  try {
    localStorage.setItem(CHANNEL_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore storage errors
  }
}

function rememberChannel(projectId: string, channelId: string) {
  const memory = loadChannelMemory()
  memory[CURRENT_USER] = { ...(memory[CURRENT_USER] || {}), [projectId]: channelId }
  saveChannelMemory(memory)
}

function resolveSelection(projects: GbotProject[], currentProjectId?: string, currentChannelId?: string) {
  if (projects.length === 0) {
    return { projectId: '', channelId: '' }
  }

  const memory = loadChannelMemory()
  const userMemory = memory[CURRENT_USER] || {}

  const preferredProject =
    projects.find((p) => p.id === currentProjectId) ||
    projects.find((p) => p.id === Object.keys(userMemory)[0]) ||
    projects[0]

  const preferredChannel =
    preferredProject.channels.find((c) => c.id === currentChannelId) ||
    preferredProject.channels.find((c) => c.id === userMemory[preferredProject.id]) ||
    preferredProject.channels[0]

  return {
    projectId: preferredProject.id,
    channelId: preferredChannel?.id || '',
  }
}

interface OnlineChannelState {
  projects: GbotProject[]
  currentProjectId: string
  currentChannelId: string
  channelLoading: boolean
  channelUpdatedAt: number
  channelError: string | null
  setProject: (projectId: string) => void
  setChannel: (channelId: string) => void
  refreshChannels: () => Promise<void>
  getCurrentProject: () => GbotProject | undefined
  getCurrentChannel: () => GbotChannel | undefined
}

const initialSelection = resolveSelection(fallbackMockProjects)

export const useOnlineChannelStore = create<OnlineChannelState>((set, get) => ({
  projects: fallbackMockProjects,
  currentProjectId: initialSelection.projectId,
  currentChannelId: initialSelection.channelId,
  channelLoading: false,
  channelUpdatedAt: Date.now(),
  channelError: null,

  // 子需求 3：切换项目时保留当前渠道（若新项目下不存在同名渠道，则回退到该项目下第一个渠道）
  setProject: (projectId: string) => {
    const state = get()
    const project = state.projects.find((p) => p.id === projectId)
    if (!project) return

    const currentProject = state.projects.find((p) => p.id === state.currentProjectId)
    const currentChannel = currentProject?.channels.find((c) => c.id === state.currentChannelId)
    const sameNameChannel = currentChannel ? project.channels.find((c) => c.name === currentChannel.name) : undefined
    const nextChannelId = sameNameChannel?.id || project.channels[0]?.id || ''

    set({ currentProjectId: projectId, currentChannelId: nextChannelId })
    if (nextChannelId) {
      rememberChannel(projectId, nextChannelId)
    }
  },

  setChannel: (channelId: string) => {
    const state = get()
    set({ currentChannelId: channelId })
    rememberChannel(state.currentProjectId, channelId)
  },

  // 子需求 4：接入 gbot 渠道数据源 + 5 分钟内可见新增渠道
  refreshChannels: async () => {
    set({ channelLoading: true, channelError: null })

    try {
      const projects = await fetchGbotProjects()
      const state = get()
      const selection = resolveSelection(projects, state.currentProjectId, state.currentChannelId)

      set({
        projects,
        currentProjectId: selection.projectId,
        currentChannelId: selection.channelId,
        channelUpdatedAt: Date.now(),
        channelLoading: false,
        channelError: null,
      })

      if (selection.projectId && selection.channelId) {
        rememberChannel(selection.projectId, selection.channelId)
      }
    } catch (error) {
      const state = get()
      // 接口失败时保留当前状态，不让页面抖动；记录错误用于UI提示
      set({
        channelLoading: false,
        channelUpdatedAt: Date.now(),
        channelError: error instanceof Error ? error.message : '渠道刷新失败',
        projects: state.projects.length > 0 ? state.projects : fallbackMockProjects,
      })
    }
  },

  getCurrentProject: () => {
    const state = get()
    return state.projects.find((p) => p.id === state.currentProjectId)
  },

  getCurrentChannel: () => {
    const state = get()
    const project = state.projects.find((p) => p.id === state.currentProjectId)
    return project?.channels.find((c) => c.id === state.currentChannelId)
  },
}))
