"use client";

/* ===========================================================
   Store mode demo — "database" yang hidup di memori browser.
   Dibuat pada Step 6b (MIGRATION.md Fase 3).

   Kenapa ada: halaman React butuh satu sumber data bersama
   (mis. jumlah chat belum dibaca dipakai Rail dan halaman
   Chat sekaligus). Sebelum Supabase menyala, sumber itu adalah
   modul ini. Bentuk datanya sudah mengikuti schema.sql, jadi
   penggantinya nanti hanya menukar isi fungsi, bukan UI.

   BATASAN YANG DISENGAJA — tidak disembunyikan:
   - Data hidup di memori satu tab. Refresh = kembali ke seed.
   - Tidak ada sinkronisasi antar admin (itu justru yang akan
     dibuktikan TEST-PLAN-SINKRONISASI.md setelah Supabase).
   - Tidak ada autentikasi; pengguna aktif dipaku ke DEMO_USER.

   Cara menukar ke Supabase nanti: lihat lib/db/index.ts.
   =========================================================== */

import { useCallback, useSyncExternalStore } from "react";
import {
  DEMO_USER,
  SEED_AI_FLAGS,
  SEED_BROADCAST,
  SEED_CANCELS,
  SEED_CANCEL_COUNT,
  SEED_CONVERSATIONS,
  SEED_ESCALATIONS,
  SEED_REFUNDS,
  SEED_REVIEWS,
  SEED_SETTINGS,
} from "./seed";
import type {
  AiFlagRow,
  BroadcastTask,
  Cancel,
  ChatMessage,
  Conversation,
  EscalationRow,
  Refund,
  Review,
  SettingsRow,
} from "./types";

type DbState = {
  conversations: Conversation[];
  escalations: EscalationRow[];
  settings: SettingsRow;
  aiFlags: AiFlagRow[];
  reviews: Review[];
  refunds: Refund[];
  cancels: Cancel[];
  cancelCount: typeof SEED_CANCEL_COUNT;
  broadcast: Record<string, BroadcastTask[]>;
};

/** Salinan dalam supaya seed tidak ikut berubah saat data diedit. */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

let state: DbState = {
  conversations: clone(SEED_CONVERSATIONS),
  escalations: clone(SEED_ESCALATIONS),
  settings: clone(SEED_SETTINGS),
  aiFlags: clone(SEED_AI_FLAGS),
  reviews: clone(SEED_REVIEWS),
  refunds: clone(SEED_REFUNDS),
  cancels: clone(SEED_CANCELS),
  cancelCount: clone(SEED_CANCEL_COUNT),
  broadcast: clone(SEED_BROADCAST),
};

const listeners = new Set<() => void>();

function setState(patch: Partial<DbState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Pembaca state. Selector harus mengembalikan nilai yang stabil
 * (referensi array/objek dari state, bukan hasil .map/.filter baru)
 * supaya useSyncExternalStore tidak merender tanpa henti.
 */
export function useDb<T>(selector: (s: DbState) => T): T {
  const get = useCallback(() => selector(state), [selector]);
  return useSyncExternalStore(subscribe, get, get);
}

/* ===========================================================
   conversations
   =========================================================== */

export const selectConversations = (s: DbState) => s.conversations;
export const selectEscalations = (s: DbState) => s.escalations;

export function useConversations() {
  return useDb(selectConversations);
}

/** Jumlah percakapan belum dibaca — badge 💬 di rail. */
export function useUnreadCount() {
  return useDb(
    useCallback((s: DbState) => s.conversations.filter((c) => c.unread).length, []),
  );
}

/** Tandai percakapan sudah dibaca (dipanggil saat dibuka). */
export function markRead(id: string) {
  const next = state.conversations.map((c) =>
    c.id === id && c.unread ? { ...c, unread: false } : c,
  );
  if (next.some((c, i) => c !== state.conversations[i])) {
    setState({ conversations: next });
  }
}

/** Tambah balasan CS ke sebuah percakapan. */
export function appendMessage(id: string, content: string) {
  const now = new Date().toISOString();
  const msg: ChatMessage = { role: "assistant", content, timestamp: now };
  setState({
    conversations: state.conversations.map((c) =>
      c.id === id
        ? {
            ...c,
            messages: [...c.messages, msg],
            updated_at: now,
            last_message_at: now,
          }
        : c,
    ),
  });
}

/** Perbarui panel saran AI setelah /api/chat menjawab. */
export function setAiSuggestion(id: string, suggestion: string, action: Conversation["action"]) {
  setState({
    conversations: state.conversations.map((c) =>
      c.id === id ? { ...c, ai_suggestion: suggestion, action } : c,
    ),
  });
}

/* ===========================================================
   settings
   =========================================================== */

export const selectSettings = (s: DbState) => s.settings;

export function useSettings() {
  return useDb(selectSettings);
}

export function saveSettings(patch: Partial<Omit<SettingsRow, "id">>) {
  setState({
    settings: {
      ...state.settings,
      ...patch,
      updated_at: new Date().toISOString(),
      updated_by: DEMO_USER.id,
    },
  });
}

/* ===========================================================
   ai_flags
   =========================================================== */

export const selectAiFlags = (s: DbState) => s.aiFlags;

export function useAiFlags() {
  return useDb(selectAiFlags);
}

/* ===========================================================
   Pesanan — ulasan, refund, pembatalan
   (bukan tabel Supabase; sumber akhirnya API marketplace)
   =========================================================== */

export const selectReviews = (s: DbState) => s.reviews;
export const selectRefunds = (s: DbState) => s.refunds;
export const selectCancels = (s: DbState) => s.cancels;
export const selectCancelCount = (s: DbState) => s.cancelCount;

export function useReviews() {
  return useDb(selectReviews);
}
export function useRefunds() {
  return useDb(selectRefunds);
}
export function useCancels() {
  return useDb(selectCancels);
}
export function useCancelCount() {
  return useDb(selectCancelCount);
}

/**
 * Putuskan permintaan pembatalan.
 * 'batal'  = setujui  -> pesanan dibatalkan
 * 'lanjut' = tolak    -> pesanan tetap dilanjutkan
 * Mengembalikan berapa baris yang benar-benar berubah, supaya
 * pemanggil bisa menyusun pesan toast seperti pesanan.js lama.
 */
export function decideCancels(orders: string[], decision: "batal" | "lanjut") {
  const target = new Set(orders);
  let changed = 0;
  const count = { ...state.cancelCount };

  const cancels = state.cancels.map((c) => {
    if (!target.has(c.order) || c.status !== "menunggu") return c;
    changed++;
    count.menunggu = Math.max(0, count.menunggu - 1);
    if (decision === "batal") {
      count.batal++;
      return { ...c, status: "batal" as const, note: null };
    }
    count.proses++;
    return { ...c, status: "proses" as const, note: "Pesanan Dilanjutkan" };
  });

  if (changed) setState({ cancels, cancelCount: count });
  return changed;
}

/* ===========================================================
   broadcast
   =========================================================== */

export const selectBroadcast = (s: DbState) => s.broadcast;

export function useBroadcast() {
  return useDb(selectBroadcast);
}

export function addBroadcastTask(marketplace: string, task: BroadcastTask) {
  setState({
    broadcast: {
      ...state.broadcast,
      [marketplace]: [task, ...(state.broadcast[marketplace] ?? [])],
    },
  });
}

/* ===========================================================
   Utilitas demo
   =========================================================== */

/** Kembalikan seluruh data ke seed — tombol "Atur ulang data demo". */
export function resetDemoData() {
  setState({
    conversations: clone(SEED_CONVERSATIONS),
    escalations: clone(SEED_ESCALATIONS),
    settings: clone(SEED_SETTINGS),
    aiFlags: clone(SEED_AI_FLAGS),
    reviews: clone(SEED_REVIEWS),
    refunds: clone(SEED_REFUNDS),
    cancels: clone(SEED_CANCELS),
    cancelCount: clone(SEED_CANCEL_COUNT),
    broadcast: clone(SEED_BROADCAST),
  });
}
