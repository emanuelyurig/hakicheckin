import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, UserCheck, Database, Info } from 'lucide-react';
import { isMock } from '../lib/supabase';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-sans selection:bg-orange-600 selection:text-white">
      {/* Decorative top bar */}
      <div className="h-1.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 w-full" />

      {/* Header */}
      <header className="border-b-2 border-[#222] bg-[#0A0A0A] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Gym Brand */}
          <Link 
            to="/" 
            className="flex items-center gap-3 group transition-transform active:scale-98"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-black font-black shadow-[0_0_20px_rgba(225,29,72,0.35)] group-hover:shadow-[0_0_25px_rgba(225,29,72,0.55)] transition-all">
              <Shield className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tighter text-white font-sans block leading-none italic">
                HAKI <span className="text-orange-600">SCHOOL</span>
              </span>
              <span className="text-[9px] text-zinc-500 tracking-[0.25em] uppercase font-black block mt-0.5">
                BRAZILIAN JIU-JITSU
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2 ${
                !isAdmin
                  ? 'bg-orange-600 text-white shadow-lg shadow-red-950/20'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>ALUNO</span>
            </Link>

             <Link
              to="/admin"
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2 ${
                isAdmin
                  ? 'bg-[#1A1A1A] text-white border-2 border-[#333]'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-orange-500" />
              <span>ADMIN</span>
            </Link> 
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[#222] bg-[#0C0C0C] py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
              &copy; {new Date().getFullYear()} HAKI PRESENÇA JIU-JITSU. TODOS OS DIREITOS RESERVADOS.
            </p>
            <p className="text-[9px] text-zinc-600 mt-1 font-mono tracking-widest uppercase">
              OSS - O RESPEITO ACIMA DE TUDO 
            </p>
          </div>

          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2 bg-[#111] px-4 py-2 rounded-full border border-[#222]">
            <Database className={`w-3.5 h-3.5 ${isMock ? 'text-amber-500' : 'text-rose-500'}`} />
            <span className="text-[9px] font-black tracking-[0.15em] text-zinc-400 uppercase">
              STATUS: {isMock ? (
                <span className="text-amber-500">SIMULADOR ATIVO</span>
              ) : (
                <span className="text-rose-500">SUPABASE CLOUD</span>
              )}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
