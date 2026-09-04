"use client";

/* ===========================================================
   Autentikasi (Step 7) — Supabase Auth, dengan jalan mundur
   otomatis ke mode demo.

   TIGA KEADAAN yang mungkin, dan semuanya harus jalan:

     1. Kredensial belum diisi  -> mode demo. Pengguna aktif
        dipaku ke DEMO_USER, tidak ada layar login. Persis
        seperti sebelum Step 7, supaya demo tidak rusak.
     2. Sudah diisi, belum login -> status "out". Console
        mengalihkan ke halaman depan.
     3. Sudah login              -> status "in" + profil dari
        tabel public.profiles (nama tampilan & peran).

   YANG PERLU DIPAHAMI SOAL KEAMANAN:
   Pengalihan halaman di sini adalah kenyamanan, BUKAN pengaman.
   Yang benar-benar menjaga data adalah RLS di Supabase — setiap
   kebijakan berbunyi `to authenticated`, jadi tanpa sesi yang sah
   query balik kosong walaupun seseorang memaksa membuka /beranda.
   Jangan pernah menaruh rahasia di komponen klien dengan alasan
   "halamannya kan sudah dijaga login".
   =========================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { DEMO_USER } from "@/lib/db";
import type { ProfileRow } from "@/lib/db";

export type AuthStatus = "loading" | "in" | "out";

type AuthValue = {
  status: AuthStatus;
  /** Profil dari public.profiles; DEMO_USER selama mode demo. */
  profile: ProfileRow | null;
  /** true bila peran 'admin' — dipakai UI untuk menyembunyikan aksi. */
  isAdmin: boolean;
  /** true bila berjalan tanpa Supabase. */
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isDemo = !isSupabaseConfigured();

  const [status, setStatus] = useState<AuthStatus>(isDemo ? "in" : "loading");
  const [profile, setProfile] = useState<ProfileRow | null>(
    isDemo ? DEMO_USER : null,
  );

  useEffect(() => {
    if (isDemo) return;
    const sb = getSupabase();
    if (!sb) return;

    let batal = false;

    /* Ambil profil dari tabel, bukan dari metadata auth.users:
       peran ('cs' | 'admin') hanya ada di public.profiles dan
       itulah yang dipakai aturan RLS is_admin(). */
    const muatProfil = async (userId: string) => {
      const { data, error } = await sb
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (batal) return;
      if (error) {
        // Sesi sah tapi profilnya belum ada — bisa terjadi bila
        // pengguna dibuat sebelum trigger handle_new_user dipasang.
        console.error("[auth] profil tidak terbaca:", error.message);
        setProfile(null);
      } else {
        setProfile(data as ProfileRow);
      }
      setStatus("in");
    };

    sb.auth.getSession().then(({ data }) => {
      if (batal) return;
      if (data.session) void muatProfil(data.session.user.id);
      else setStatus("out");
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (batal) return;
      if (session) void muatProfil(session.user.id);
      else {
        setProfile(null);
        setStatus("out");
      }
    });

    return () => {
      batal = true;
      sub.subscription.unsubscribe();
    };
  }, [isDemo]);

  /** @returns pesan galat untuk ditampilkan, atau null bila berhasil. */
  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return "Supabase belum dikonfigurasi.";
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (!error) return null;
    // Pesan bawaan Supabase berbahasa Inggris dan cukup teknis.
    if (error.message.includes("Invalid login credentials")) {
      return "Email atau kata sandi salah.";
    }
    if (error.message.includes("Email not confirmed")) {
      return "Email belum dikonfirmasi. Minta admin mencentang Auto Confirm.";
    }
    return error.message;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      profile,
      isAdmin: profile?.role === "admin",
      isDemo,
      signIn,
      signOut,
    }),
    [status, profile, isDemo, signIn, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return v;
}
