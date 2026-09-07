import type { ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PlatformLayout from './layouts/PlatformLayout';
import { createPageMenu, PageMeta, PrototypePage } from './page';
import type { PageScenarioDefinitions } from './pageScenario';

interface PageModule {
  default: ComponentType;
}

interface MetaModule {
  default: PageMeta;
}

interface ScenarioModule {
  default: PageScenarioDefinitions;
}

const pageModules = import.meta.glob<PageModule>(
  ['./pages/**/index.tsx', '!./pages/**/components/**'],
  { eager: true },
);

const metaModules = import.meta.glob<MetaModule>('./pages/**/meta.ts', {
  eager: true,
});

const scenarioModules = import.meta.glob<ScenarioModule>('./pages/**/scenarios.ts', {
  eager: true,
});

const readmeModules = import.meta.glob<string>('./pages/**/README.md', {
  eager: true,
  import: 'default',
  query: '?raw',
});

const pages = Object.entries(pageModules)
  .map<PrototypePage>(([source, page]) => {
    const metaSource = source.replace(/index\.tsx$/, 'meta.ts');
    const scenarioSource = source.replace(/index\.tsx$/, 'scenarios.ts');
    const meta = metaModules[metaSource]?.default;
    const scenarios = scenarioModules[scenarioSource]?.default;

    if (!meta) {
      throw new Error(`Missing page metadata: ${metaSource}`);
    }
    if (!scenarios) {
      throw new Error(`Missing page scenarios: ${scenarioSource}`);
    }

    const codePath = source
      .replace(/^\.\/pages\//, '')
      .replace(/\/index\.tsx$/, '');

    return {
      path: `/${codePath}`,
      Component: page.default,
      meta,
      scenarios,
    };
  })
  .sort((left, right) => {
    const leftTop = left.meta.menu.label;
    const rightTop = right.meta.menu.label;
    if (leftTop === '工作台' && rightTop !== '工作台') return -1;
    if (rightTop === '工作台' && leftTop !== '工作台') return 1;
    if (leftTop === '运营工具' && rightTop !== '运营工具') return 1;
    if (rightTop === '运营工具' && leftTop !== '运营工具') return -1;
    return left.path.localeCompare(right.path);
  });

const menu = createPageMenu(pages);
const pageScenarios = Object.fromEntries(
  pages.map(({ path, scenarios }) => [path, scenarios]),
);
const pageReadmes = Object.fromEntries(
  Object.entries(readmeModules).map(([source, content]) => {
    const codePath = source
      .replace(/^\.\/pages\//, '')
      .replace(/\/README\.md$/, '');

    return [`/${codePath}`, content];
  }),
);

/** 应用根组件：把自动发现的页面装配为路由，统一运行在 AppShell 内。 */
export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={(
          <PlatformLayout
            menu={menu}
            pageReadmes={pageReadmes}
            pageScenarios={pageScenarios}
          />
        )}
      >
        <Route
          index
          element={pages[0] ? <Navigate to={pages[0].path} replace /> : null}
        />
        {pages.map(({ path, Component }) => (
          <Route
            key={path}
            path={path.replace(/^\//, '')}
            element={<Component />}
          />
        ))}
        <Route path="*" element={null} />
      </Route>
    </Routes>
  );
}
