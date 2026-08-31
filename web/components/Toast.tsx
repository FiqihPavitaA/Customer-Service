"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/* ===========================================================
   Toast — pengganti helper toast(msg) di dashboard.js.
   Perilaku dipertahankan: satu pesan di bawah-tengah, hilang
   sendiri setelah 2600 ms, pesan baru me-reset hitungannya.
   Pemakaian di komponen: const toast = useToast(); toast('...')
   =========================================================== */

const TOAST_MS = 2600;

const ToastContext = createContext<((msg: string) => void) | null>(null);

/** Hook pemanggil toast. Aman dipanggil dari komponen mana pun di dalam shell. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast harus dipakai di dalam <ToastProvider>.");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  // Bersihkan timer bila komponen dilepas agar tidak set state pada node mati.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-60 -translate-x-1/2 rounded-xl bg-green-dark px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgb(15_23_42/0.25)] [animation:toast-up_0.2s_ease]"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
