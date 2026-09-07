import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

/**
 * 原型页面使用的 Mock 业务上下文。
 *
 * 这里的数据不来自真实业务接口，只用于让原型页面读取并响应顶部业务切换。
 */
export interface PrototypeBusinessContext {
  project_id: string;
  game_id: string;
}

/**
 * 原型页面使用的 Mock 用户信息。
 *
 * 这里的数据不代表真实登录用户，也不能用于生产环境的身份或权限判断。
 */
export interface PrototypeUserInfo {
  user_id: string;
  avatar: string;
  user_name: string;
}

interface PrototypeBusinessOption extends PrototypeBusinessContext {
  name: string;
}

interface PrototypeBusinessContextValue {
  currentBusiness: PrototypeBusinessOption;
  businessOptions: readonly PrototypeBusinessOption[];
  selectBusiness: (projectId: string) => void;
}

const MOCK_BUSINESS_OPTIONS: readonly PrototypeBusinessOption[] = [
  {
    project_id: 'mock-project-delta',
    game_id: 'mock-game-delta',
    name: '三角洲行动',
  },
  {
    project_id: 'mock-project-zhijilab',
    game_id: 'mock-game-zhijilab',
    name: 'ZhijiLab 默认项目组',
  },
  {
    project_id: 'mock-project-ai-platform',
    game_id: 'mock-game-ai-platform',
    name: 'AI 平台项目组',
  },
  {
    project_id: 'mock-project-content-creation',
    game_id: 'mock-game-content-creation',
    name: '内容创作项目组',
  },
  {
    project_id: 'mock-project-pubgm',
    game_id: 'mock-game-pubgm',
    name: 'PUBGM 项目组',
  },
  {
    project_id: 'mock-project-fcm',
    game_id: 'mock-game-fcm',
    name: 'FCM 项目组',
  },
  {
    project_id: 'mock-project-shikong',
    game_id: 'mock-game-shikong',
    name: '失控进化',
  },
];

const MOCK_USER_INFO: PrototypeUserInfo = {
  user_id: 'mock-user-pm',
  avatar: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2232%22 fill=%22%23005AFF%22/%3E%3Ctext x=%2232%22 y=%2239%22 text-anchor=%22middle%22 font-family=%22Arial,sans-serif%22 font-size=%2220%22 font-weight=%22600%22 fill=%22white%22%3EPM%3C/text%3E%3C/svg%3E',
  user_name: '原型评审用户',
};

const BusinessContext = createContext<PrototypeBusinessContextValue | null>(null);
const UserContext = createContext<PrototypeUserInfo | null>(null);

/**
 * 为 AppShell 与页面注入仅供原型使用的 Mock 业务上下文和用户信息。
 */
export function PrototypeContextProvider({ children }: PropsWithChildren) {
  const [currentProjectId, setCurrentProjectId] = useState(
    MOCK_BUSINESS_OPTIONS[0].project_id,
  );

  const businessContextValue = useMemo<PrototypeBusinessContextValue>(() => {
    const currentBusiness = MOCK_BUSINESS_OPTIONS.find(
      ({ project_id }) => project_id === currentProjectId,
    ) ?? MOCK_BUSINESS_OPTIONS[0];

    return {
      currentBusiness,
      businessOptions: MOCK_BUSINESS_OPTIONS,
      selectBusiness: setCurrentProjectId,
    };
  }, [currentProjectId]);

  return (
    <UserContext.Provider value={MOCK_USER_INFO}>
      <BusinessContext.Provider value={businessContextValue}>
        {children}
      </BusinessContext.Provider>
    </UserContext.Provider>
  );
}

function useRequiredBusinessContext() {
  const context = useContext(BusinessContext);

  if (!context) {
    throw new Error('Prototype business context must be used within PrototypeContextProvider.');
  }

  return context;
}

/**
 * 获取原型页面当前所处业务的 Mock `project_id` 与 `game_id`。
 *
 * 顶部业务选择器切换后，使用该 Hook 的页面组件会自动重新渲染。
 * 本 Hook 仅供原型页面使用，不会请求或返回真实业务上下文。
 */
export function useCurrentBusiness(): PrototypeBusinessContext {
  const { currentBusiness } = useRequiredBusinessContext();

  return useMemo(() => ({
    project_id: currentBusiness.project_id,
    game_id: currentBusiness.game_id,
  }), [currentBusiness.game_id, currentBusiness.project_id]);
}

/**
 * 获取原型页面当前用户的 Mock `user_id`、`avatar` 与 `user_name`。
 *
 * 本 Hook 仅供原型页面展示使用，不代表真实登录态，不能用于权限判断。
 */
export function useCurrentUser(): PrototypeUserInfo {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('Prototype user context must be used within PrototypeContextProvider.');
  }

  return context;
}

/**
 * AppShell 顶部业务选择器使用的 Mock 切换能力，仅供原型基础设施使用。
 */
export function usePrototypeBusinessSwitcher() {
  return useRequiredBusinessContext();
}
