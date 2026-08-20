export const STATUS_LABELS = {
  proposed: '제안됨',
  in_review: '검토중',
  approved: '승인됨',
  rejected: '반려됨',
  active: '진행중',
  closed: '종료',
  cancelled: '취소됨',
};

export function StatusBadge({ status }) {
  return (
    <span
      className="status-badge"
      style={{
        color: `var(--status-${status})`,
        background: `color-mix(in srgb, var(--status-${status}) 12%, white)`,
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
