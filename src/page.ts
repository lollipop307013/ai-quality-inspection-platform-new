import type { ComponentType } from 'react';
import type { PageScenarioDefinitions } from './pageScenario';

export interface MenuMeta {
  label: string;
  icon?: string;
}

export interface PageMenuMeta extends MenuMeta {
  child?: PageMenuMeta;
}

export interface PageMeta {
  menu: PageMenuMeta;
}

export interface PrototypePage {
  path: string;
  Component: ComponentType;
  meta: PageMeta;
  scenarios: PageScenarioDefinitions;
}

export interface PageMenuItem extends MenuMeta {
  path?: string;
  children?: PageMenuItem[];
}

export interface PageMenuGroup extends MenuMeta {
  path?: string;
  children: PageMenuItem[];
}

export function definePageMeta(meta: PageMeta): PageMeta {
  return meta;
}

function appendPageMenuItem(
  items: PageMenuItem[],
  meta: PageMenuMeta,
  path: string,
) {
  const { child, ...itemMeta } = meta;
  let item = items.find(({ label }) => label === itemMeta.label);

  if (!item) {
    item = {
      ...itemMeta,
      ...(child ? { children: [] } : { path }),
    };
    items.push(item);
  }

  if (child) {
    item.children ??= [];
    appendPageMenuItem(item.children, child, path);
  } else {
    item.path = path;
  }
}

export function createPageMenu(pages: PrototypePage[]): PageMenuGroup[] {
  return pages.reduce<PageMenuGroup[]>((groups, page) => {
    const { child, ...groupMeta } = page.meta.menu;
    let group = groups.find(({ label }) => label === groupMeta.label);

    if (!group) {
      group = { ...groupMeta, children: [] };
      groups.push(group);
    }

    if (child) {
      appendPageMenuItem(group.children, child, page.path);
    } else {
      group.path = page.path;
    }

    return groups;
  }, []);
}

export function pageMenuContainsPath(item: PageMenuItem, path: string): boolean {
  return item.path === path
    || item.children?.some((child) => pageMenuContainsPath(child, path))
    || false;
}

export function getFirstPageMenuPath(item: PageMenuItem): string | undefined {
  return item.path
    || item.children?.map(getFirstPageMenuPath).find(Boolean);
}
