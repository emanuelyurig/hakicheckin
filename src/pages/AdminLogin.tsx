import { useState } from "react";

export default function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (password === import.meta.env.VITE_ADMIN_PASSWORD) {
      sessionStorage.setItem("admin-auth", "true");
      onSuccess();
    } else {
      alert("Senha incorreta");
    }
  };

  
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="bg-zinc-900 p-8 rounded-xl w-80">
        <h2 className="text-white text-xl mb-4">Área Administrativa</h2>

        <input
          type="password"
          className="w-full p-3 rounded bg-zinc-800 text-white"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />

        <button
          onClick={handleLogin}
          className="mt-4 w-full bg-red-600 text-white py-3 rounded"
        >
          Entrar
        </button>
      </div>
    </div>
  );
}