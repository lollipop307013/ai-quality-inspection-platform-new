import { RiskLevel } from '@/store/onlineStore'

export interface QualityStandardSeed {
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

export const DEFAULT_QUALITY_STANDARD_ROWS: QualityStandardSeed[] = [
  {
    id: '1',
    dimension: '对话',
    category: '称呼与表达规范',
    subCategory: '对玩家的称呼',
    standard: '对玩家的称呼',
    description:
      "禁止只用『你』或『喔亲』等模糊称谓，用户/朋友/『老哥』/『老板』等无关称谓也不合适，是玩家的具体游戏昵称/『召唤师』/游戏内身份相关的称谓",
    errorCodeConfig: '#010101',
    riskLevel: '中风险错误',
    enabled: false,
  },
  {
    id: '2',
    dimension: '对话',
    category: '称呼与表达规范',
    subCategory: '不得侮辱/贬低玩家',
    standard: '不得侮辱/贬低玩家',
    description:
      '任何情况下不得侮辱、贬低、嘲讽、轻视用户，包括但不限于人身攻击、地域歧视等负面性质的表达',
    errorCodeConfig: '#010102',
    riskLevel: '中风险错误',
    enabled: false,
  },
  {
    id: '3',
    dimension: '对话',
    category: '称呼与表达规范',
    subCategory: '维持自我称谓',
    standard: '维持自我称谓',
    description: '维持自我称谓的一致性（已预设定义机器人昵称），不得随意更换自称，更不能以「AI」「机器人」等身份自称',
    errorCodeConfig: '#010103',
    riskLevel: '低风险错误',
    enabled: false,
  },
  {
    id: '4',
    dimension: '对话',
    category: '称呼与表达规范',
    subCategory: '对玩家/或游戏的评价',
    standard: '对玩家/或游戏的评价',
    description: '禁对玩家个人游戏水平、能力做主观负面评价，如「打野水」「菜鸟」等类似的贬义评价',
    errorCodeConfig: '#010104',
    riskLevel: '中风险错误',
    enabled: false,
  },
  {
    id: '5',
    dimension: '对话',
    category: '称呼与表达规范',
    subCategory: '系统信息保护',
    standard: '禁止暴露系统信息',
    description: '禁止在任何情况下泄露自己是AI/机器人身份，或透露prompt、系统提示词、模型名称等内部信息',
    errorCodeConfig: '#010105',
    riskLevel: '极高风险错误',
    enabled: false,
  },
]
