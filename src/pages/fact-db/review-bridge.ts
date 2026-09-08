// 管理页（实体/事件/事实）与内容审核工作台之间的跨页跳转桥。
// 通过全局自定义事件传递定位请求，App 监听后切换菜单并透传给 ReviewTab 定位。

import type { ReviewObjectType } from "./review-types";
import { mockReviewItems } from "./review-mock";

/** 跨页定位请求：管理页点击「有待审版本」标签后跳转到审核工作台。 */
export interface ReviewLocator {
  objectType?: ReviewObjectType;
  objectId?: number;
  /** 每次跳转的唯一递增标识，用于触发重复跳转。 */
  requestId: number;
}

/** 全局导航事件名。 */
export const REVIEW_NAV_EVENT = "factdb:navigate-review";

let requestSeq = 0;

/** 发起跳转：切到内容审核并定位到覆盖该对象的待审条目。 */
export function navigateToReview(objectType: ReviewObjectType, objectId: number) {
  const detail: ReviewLocator = { objectType, objectId, requestId: ++requestSeq };
  window.dispatchEvent(new CustomEvent<ReviewLocator>(REVIEW_NAV_EVENT, { detail }));
}

/** 发起跳转：仅切到内容审核工作台任务列表（不定位具体条目）。 */
export function navigateToReviewList() {
  const detail: ReviewLocator = { requestId: ++requestSeq };
  window.dispatchEvent(new CustomEvent<ReviewLocator>(REVIEW_NAV_EVENT, { detail }));
}

/** 解析审核条目的 objectId（"#10042" → 10042；"新建·未分配" / "QA-1001" → null）。 */
export function parseReviewObjectId(objectId?: string): number | null {
  if (!objectId) return null;
  const match = objectId.match(/^#(\d+)$/);
  return match ? Number(match[1]) : null;
}

/**
 * 静态索引：哪些线上对象存在「覆盖更新且待审核」的版本。
 * 管理页据此在标题后展示「有待审版本」标签。
 */
export function buildPendingCoverIndex(): Record<ReviewObjectType, Set<number>> {
  const index: Record<ReviewObjectType, Set<number>> = { fact: new Set(), entity: new Set(), event: new Set() };
  for (const item of mockReviewItems) {
    if (item.changeType !== "update" || item.status !== "pending") continue;
    const id = parseReviewObjectId(item.objectId);
    if (id == null) continue;
    index[item.objectType].add(id);
  }
  return index;
}
