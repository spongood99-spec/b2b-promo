import { create } from 'zustand';

export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message) => {
    const id = Date.now() + Math.random();
    set((state) => ({ toasts: [...state.toasts, { id, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
}));
