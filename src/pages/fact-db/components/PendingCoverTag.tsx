import React from "react";
import { navigateToReview } from "../review-bridge";
import type { ReviewObjectType } from "../review-types";

/**
 * 管理页标题后的「有待审版本」标签。
 * 点击跳转到内容审核工作台，并定位到覆盖该对象的待审条目。
 */
export default function PendingCoverTag({ objectType, objectId }: { objectType: ReviewObjectType; objectId: number }) {
  return (
    <span
      className="pending-cover-tag"
      title="该数据存在覆盖的待审核版本，点击前往内容审核"
      onClick={(e) => {
        e.stopPropagation();
        navigateToReview(objectType, objectId);
      }}
    >
      有待审版本
    </span>
  );
}
