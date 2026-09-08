export interface GbotChannel {
  id: string
  name: string
  projectId: string
}

export interface GbotProject {
  id: string
  name: string
  channels: GbotChannel[]
}

export const fallbackMockProjects: GbotProject[] = [
  {
    id: 'p_21116',
    name: 'CodeV 无我要玩助手：测量行动(21116)',
    channels: [
      { id: 'sdk', name: 'SDK', projectId: 'p_21116' },
      { id: 'weixin', name: '微信', projectId: 'p_21116' },
      { id: 'qq', name: 'QQ', projectId: 'p_21116' },
    ],
  },
  {
    id: 'p_21200',
    name: '甄选离线质检agent(21200)',
    channels: [
      { id: 'sdk', name: 'SDK', projectId: 'p_21200' },
      { id: 'app', name: 'App', projectId: 'p_21200' },
    ],
  },
  {
    id: 'p_1116',
    name: 'Codixir:测试平台(1116)',
    channels: [
      { id: 'sdk', name: 'SDK', projectId: 'p_1116' },
      { id: 'web', name: 'Web', projectId: 'p_1116' },
      { id: 'mini_program', name: '小程序', projectId: 'p_1116' },
    ],
  },
]

function withTimeout(ms: number): AbortController {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller
}

function normalizeProjects(payload: unknown): GbotProject[] {
  const rawProjects = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
    ? (payload as { data: unknown[] }).data
    : Array.isArray((payload as { projects?: unknown })?.projects)
    ? ((payload as { projects: unknown[] }).projects as unknown[])
    : []

  const projects = rawProjects
    .map((item) => {
      const project = item as {
        id?: string | number
        projectId?: string | number
        name?: string
        projectName?: string
        channels?: Array<{ id?: string | number; channelId?: string | number; name?: string; channelName?: string }>
      }

      const projectId = String(project.id ?? project.projectId ?? '').trim()
      const projectName = String(project.name ?? project.projectName ?? '').trim()
      const channels = Array.isArray(project.channels)
        ? project.channels
            .map((c) => {
              const channelId = String(c.id ?? c.channelId ?? '').trim()
              const channelName = String(c.name ?? c.channelName ?? '').trim()
              if (!channelId || !channelName) return null
              return { id: channelId, name: channelName, projectId }
            })
            .filter((c): c is GbotChannel => !!c)
        : []

      if (!projectId || !projectName || channels.length === 0) return null
      return { id: projectId, name: projectName, channels }
    })
    .filter((p): p is GbotProject => !!p)

  return projects
}

export async function fetchGbotProjects(): Promise<GbotProject[]> {
  const controller = withTimeout(7000)
  try {
    const res = await fetch('/api/gbot/business/channels', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      credentials: 'include',
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const json = (await res.json()) as unknown
    const normalized = normalizeProjects(json)
    if (normalized.length > 0) return normalized
    throw new Error('gbot response is empty')
  } finally {
    controller.abort()
  }
}
