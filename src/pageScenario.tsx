import {
  createContext,
  Fragment,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { useSearchParams } from 'react-router-dom';

const SCENARIO_QUERY_KEY = '__scenario';

export interface PageScenarioDefinition {
  label: string;
  description: string;
}

export type PageScenarioDefinitions = {
  default: PageScenarioDefinition;
} & Record<string, PageScenarioDefinition>;

interface PageScenarioContextValue {
  scenario: string;
  scenarios: PageScenarioDefinitions;
  setScenario: (scenario: string) => void;
}

interface PageScenarioProviderProps {
  children: ReactNode;
  scenarios: PageScenarioDefinitions;
}

const PageScenarioContext = createContext<PageScenarioContextValue | null>(null);

export function definePageScenarios<T extends PageScenarioDefinitions>(scenarios: T): T {
  Object.entries(scenarios).forEach(([key, definition]) => {
    if (!/^[a-z][a-z0-9-]*$/.test(key)) {
      throw new Error(`Invalid page scenario key: ${key}`);
    }
    if (!definition.label.trim() || !definition.description.trim()) {
      throw new Error(`Page scenario ${key} requires a label and description`);
    }
  });

  return scenarios;
}

/** 页面预览场景上下文：从 URL 查询参数读写当前场景，供工具面板与页面共享。 */
export function PageScenarioProvider({
  children,
  scenarios,
}: PageScenarioProviderProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryScenario = searchParams.get(SCENARIO_QUERY_KEY);
  const scenario = queryScenario && scenarios[queryScenario]
    ? queryScenario
    : 'default';

  useEffect(() => {
    if (queryScenario && !scenarios[queryScenario]) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete(SCENARIO_QUERY_KEY);
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [queryScenario, scenarios, searchParams, setSearchParams]);

  const value = useMemo<PageScenarioContextValue>(() => ({
    scenario,
    scenarios,
    setScenario: (nextScenario) => {
      if (!scenarios[nextScenario]) return;

      const nextSearchParams = new URLSearchParams(searchParams);
      if (nextScenario === 'default') {
        nextSearchParams.delete(SCENARIO_QUERY_KEY);
      } else {
        nextSearchParams.set(SCENARIO_QUERY_KEY, nextScenario);
      }
      setSearchParams(nextSearchParams, { replace: true });
    },
  }), [scenario, scenarios, searchParams, setSearchParams]);

  return (
    <PageScenarioContext.Provider value={value}>
      {children}
    </PageScenarioContext.Provider>
  );
}

/** 场景边界：切换预览场景时重新挂载页面，确保页面本地状态被重置。 */
export function PageScenarioBoundary({ children }: { children: ReactNode }) {
  const { scenario } = useRequiredPageScenarioContext();

  return <Fragment key={scenario}>{children}</Fragment>;
}

function useRequiredPageScenarioContext() {
  const context = useContext(PageScenarioContext);

  if (!context) {
    throw new Error('Page scenario APIs must be used inside PageScenarioProvider');
  }

  return context;
}

export function usePageScenario<T extends string = string>(): T {
  return useRequiredPageScenarioContext().scenario as T;
}

export function usePageScenarioController() {
  return useRequiredPageScenarioContext();
}
