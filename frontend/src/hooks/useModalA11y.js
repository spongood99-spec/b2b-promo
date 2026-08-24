import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 모달 공통 접근성: 열릴 때 첫 입력에 포커스, Esc로 닫기, Tab이 모달 밖으로 빠지지 않도록 순환,
// 닫힐 때 트리거 요소로 포커스 복원.
// 모달이 별도 컴포넌트로 항상 마운트되어 있지 않고 조건부 렌더링되는 경우를 위해
// enabled(모달이 실제로 열려 있는지)를 받아 그때만 동작한다.
export function useModalA11y(onClose, enabled = true) {
  const firstFieldRef = useRef(null);
  const containerRef = useRef(null);
  const triggerElRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    triggerElRef.current = document.activeElement;
    firstFieldRef.current?.focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusable = Array.from(containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerElRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { firstFieldRef, containerRef };
}
