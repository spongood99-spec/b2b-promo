export const STATUS_LABELS = {
  proposed: '제안됨',
  in_review: '검토중',
  approved: '승인됨',
  rejected: '반려됨',
  active: '진행중',
  closed: '종료',
  cancelled: '취소됨',
};

// 상태색 자체를 텍스트 색으로 쓰면 옅은 배경 위에서 WCAG AA(4.5:1) 대비를 만족하지 못하는
// 색이 많다(예: 승인됨 2.88:1). 텍스트는 고정된 짙은 색으로 통일하고, 상태색은 배경 톤과
// 왼쪽 보더로만 표현해 대비를 보장한다.
export function StatusBadge({ status }) {
  return (
    <span
      className="status-badge"
      style={{
        color: '#1F2933',
        background: `color-mix(in srgb, var(--status-${status}) 20%, white)`,
        borderLeft: `3px solid var(--status-${status})`,
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
