"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResetPasswordPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔑 Načtení tokenu z URL (SAFE pro Next.js build)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);

      let t = url.searchParams.get("access_token");

      // fallback pro hash (#access_token=...)
      if (!t && window.location.hash) {
        const hashParams = new URLSearchParams(
          window.location.hash.replace("#", "")
        );
        t = hashParams.get("access_token");
      }

      setToken(t);
    }
  }, []);

  const handleReset = async () => {
    if (!token) return setMessage("Chybí token!");
    if (!newPassword || !confirmPassword)
      return setMessage("Vyplňte všechna pole!");
    if (newPassword !== confirmPassword)
      return setMessage("Hesla se neshodují!");

    setLoading(true);
    try {
      // nastav session z tokenu
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: token,
      });

      if (sessionError) {
        setMessage("Chyba při ověřování tokenu: " + sessionError.message);
        return;
      }

      // změna hesla
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setMessage("Chyba: " + updateError.message);
      } else {
        setMessage(
          "Heslo úspěšně změněno! Přesměrování na přihlášení..."
        );
        setTimeout(() => router.push("/"), 3000);
      }
    } catch (err: any) {
      setMessage("Neočekávaná chyba: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔴 čekáme než se načte token
  if (token === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B132B] text-white">
        Načítání...
      </div>
    );
  }

  // ❌ token neexistuje
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B132B] text-white px-4">
        <h1 className="text-2xl font-bold mb-4">Reset hesla</h1>
        <p className="text-red-400 text-center">
          Neplatný nebo chybějící odkaz.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B132B] text-white px-4">
      <h1 className="text-2xl font-bold mb-4">Reset hesla</h1>

      <input
        type="password"
        placeholder="Nové heslo"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="px-4 py-2 rounded-lg mb-4 text-black w-full max-w-sm"
      />

      <input
        type="password"
        placeholder="Potvrzení hesla"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="px-4 py-2 rounded-lg mb-4 text-black w-full max-w-sm"
      />

      <button
        onClick={handleReset}
        disabled={loading}
        className="bg-orange-500 px-6 py-2 rounded-lg w-full max-w-sm font-semibold hover:bg-orange-600 transition"
      >
        {loading ? "Čekejte..." : "Změnit heslo"}
      </button>

      {message && <p className="mt-4 text-center">{message}</p>}
    </div>
  );
}