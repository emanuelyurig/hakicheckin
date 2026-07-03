import React, { useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Users, Clock, Calendar, Trophy, AlertTriangle, CheckCircle, UserPlus, ArrowRight } from 'lucide-react';

import { dbService } from '../services/db';
import { useToast } from '../contexts/ToastContext';
import { useRealtime } from '../hooks/useRealtime';

// Form validation schema using Zod
const schema = z.object({
  nomeCompleto: z
    .string()
    .min(1, 'O nome completo é obrigatório.')
    .refine((val) => val.trim().length > 0, {
      message: 'O nome não pode conter apenas espaços.',
    }),
});

type FormValues = z.infer<typeof schema>;

export default function StudentPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Fetch active class
  const { 
    data: activeClass, 
    isLoading: isLoadingClass, 
    isError: isErrorClass,
    refetch: refetchClass
  } = useQuery({
    queryKey: ['activeClass'],
    queryFn: () => dbService.getAulaAtiva(),
  });

  // 2. Fetch presences for active class (if it exists)
  const { 
    data: presencas = [], 
    isLoading: isLoadingPresencas 
  } = useQuery({
    queryKey: ['presencas', activeClass?.id],
    queryFn: () => dbService.getPresencas(activeClass!.id),
    enabled: !!activeClass?.id,
  });

  // 3. Register real-time updates
  useRealtime(activeClass?.id);

  // 4. React Hook Form Setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nomeCompleto: '',
    },
  });

  // 5. Setup mutation for presence confirmation
  const confirmMutation = useMutation({
    mutationFn: async (nomeCompleto: string) => {
      if (!activeClass) throw new Error('Não há aula ativa no momento.');
      return dbService.confirmarPresenca(activeClass.id, nomeCompleto);
    },
    onSuccess: () => {
      toast.success('✅ Presença confirmada com sucesso!');
      
      // Reset form field
      reset({ nomeCompleto: '' });
      
      // Focus back on name input
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);

      // Invalidate queries to update UI
      queryClient.invalidateQueries({ queryKey: ['presencas', activeClass?.id] });
      queryClient.invalidateQueries({ queryKey: ['activeClass'] });
    },
    onError: (err: any) => {
      const msg = err.message || 'Erro ao confirmar presença.';
      toast.error(msg);
      
      // Still set focus back to input even on error for fluid mobile workflow
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    },
  });

  // Auto focus input on page mount if active class is loaded
  useEffect(() => {
    if (activeClass && !isLoadingClass) {
      nameInputRef.current?.focus();
    }
  }, [activeClass, isLoadingClass]);

  const onSubmit = (data: FormValues) => {
    confirmMutation.mutate(data.nomeCompleto);
  };

  // Helper calculation
  const totalConfirmados = presencas.length;
  const vagasRestantes = activeClass ? Math.max(0, activeClass.limite_vagas - totalConfirmados) : 0;
  const isFull = activeClass && totalConfirmados >= activeClass.limite_vagas;

  // Render loading state
  if (isLoadingClass) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#09090b] p-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-zinc-800 border-t-red-600 animate-spin" />
          <Shield className="w-6 h-6 text-orange-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="mt-4 text-zinc-400 font-mono text-sm tracking-wider animate-pulse">
          Buscando aula ativa...
        </p>
      </div>
    );
  }

  // Render error or no active class state
  if (!activeClass) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#09090b] px-4 py-12 text-center max-w-md mx-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#0c0c0e] border border-zinc-800/80 p-8 rounded-2xl shadow-xl w-full"
        >
          <div className="w-14 h-14 rounded-full bg-orange-950/40 border border-orange-500/30 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-7 h-7 text-orange-500 animate-bounce" />
          </div>
          
          <h2 className="text-xl font-bold text-zinc-50 tracking-wide uppercase">
            Nenhuma Aula Ativa
          </h2>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            Não há nenhuma aula cadastrada para o dia de hoje no momento. Por favor, aguarde o professor enviar o link de confirmação.
          </p>
          
          <div className="mt-8 pt-6 border-t border-zinc-900 flex justify-center">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              HAKI • Academia de Jiu-Jitsu
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-grow bg-[#0A0A0A] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-[380px] w-full flex flex-col gap-6">
        
        {/* HERO TITLE CARD (Bold Typography theme: bg-[#111111] border-2 border-[#333] rounded-[48px] p-8 shadow-[0_0_50px_rgba(225,29,72,0.1)]) */}
        <motion.div
          initial={{ y: -15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-[#111111] border-2 border-[#333] rounded-[44px] p-8 flex flex-col relative shadow-[0_0_50px_rgba(225,29,72,0.1)] overflow-hidden"
        >
          {/* Top aesthetic connector */}
          <div className="h-5 w-28 bg-[#222] absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl border-x border-b border-[#333]" />
          
          <div className="mt-4 flex flex-col items-center text-center">
            <div className="text-orange-600 font-black text-2xl tracking-tighter italic">
              HAKI <span className="text-white">SCHOOL</span>
            </div>
            <div className="text-[10px] text-gray-500 tracking-[0.2em] uppercase font-bold mt-1">
              Brazilian Jiu-Jitsu
            </div>
          </div>

          {/* ACTIVE CLASS CONTAINER (bg-[#1A1A1A] rounded-2xl p-4 border border-[#333]) */}
          <div className="mt-8 bg-[#1A1A1A] rounded-2xl p-4.5 border border-[#333]">
            <div className="flex justify-between items-start mb-3">
              <span className="bg-orange-600 text-white text-[9px] font-black px-2 py-0.5 rounded tracking-wider uppercase animate-pulse">
                JIU-JITSU
              </span>
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                {activeClass.horario}
              </span>
            </div>

            <h2 className="text-xl font-black leading-tight mb-1 uppercase tracking-tight text-white">
              {activeClass.tipo}
            </h2>
            
            {activeClass.professor ? (
              <p className="text-gray-500 text-xs font-semibold mb-4">
                Prof. {activeClass.professor}
              </p>
            ) : (
              <p className="text-gray-500 text-xs font-semibold mb-4">
               HAKI • Aula do Dia
              </p>
            )}

            {/* STATS COUNT GRID (bg-black/40 rounded-lg p-2 border border-[#222]) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-black/40 rounded-xl p-3 border border-[#222] text-center">
                <div className="text-[9px] text-gray-500 uppercase font-black tracking-wider">Confirmados</div>
                <div className="text-lg font-black text-white mt-0.5">
                  {isLoadingPresencas ? '...' : totalConfirmados}
                </div>
              </div>
              
              <div className="bg-black/40 rounded-xl p-3 border border-[#222] text-center">
                <div className="text-[9px] text-gray-500 uppercase font-black tracking-wider">Vagas Rest.</div>
                <div className={`text-lg font-black mt-0.5 ${vagasRestantes === 0 ? 'text-orange-500' : 'text-white'}`}>
                  {isLoadingPresencas ? '...' : vagasRestantes}
                </div>
              </div>
            </div>
          </div>

          {/* INPUT FORM */}
          <div className="mt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label 
                  htmlFor="nomeCompleto" 
                  className="text-[10px] text-gray-400 font-bold uppercase ml-1 tracking-wider block"
                >
                  Seu Nome Completo
                </label>
                
                <input
                  id="nomeCompleto"
                  type="text"
                  autoComplete="off"
                  placeholder="Ex: Marcelo Almeida"
                  disabled={confirmMutation.isPending || isFull}
                  {...register('nomeCompleto')}
                  ref={(e) => {
                    register('nomeCompleto').ref(e);
                    nameInputRef.current = e;
                  }}
                  className={`w-full bg-[#0A0A0A] border rounded-xl px-4 py-3.5 text-sm focus:outline-none transition-all text-white placeholder-zinc-700 ${
                    errors.nomeCompleto 
                      ? 'border-orange-500/80 focus:border-orange-500 focus:ring-1 focus:ring-red-500' 
                      : 'border-[#333] focus:border-orange-600 focus:ring-1 focus:ring-red-600'
                  }`}
                />

                {errors.nomeCompleto && (
                  <p className="text-[11px] font-semibold text-orange-500 flex items-center gap-1 mt-1 px-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {errors.nomeCompleto.message}
                  </p>
                )}
              </div>

              {isFull ? (
                <div className="bg-orange-950/20 border border-orange-900/40 p-3.5 rounded-xl flex items-start gap-2 text-left">
                  <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-orange-400 uppercase tracking-wider">AULA LOTADA</h4>
                    <p className="text-[11px] text-orange-300/80 mt-0.5 leading-relaxed font-medium">
                      Não há vagas adicionais para esta aula.
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  id="btn-confirmar"
                  type="submit"
                  disabled={confirmMutation.isPending}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-black py-4 rounded-xl shadow-lg shadow-red-950/20 active:scale-[0.98] transition-all uppercase tracking-wider text-xs sm:text-sm cursor-pointer"
                >
                  {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar Presença'}
                </button>
              )}
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-zinc-900 text-center">
            <div className="text-[9px] text-gray-600 uppercase font-bold tracking-widest">
              Ambiente Seguro 
            </div>
          </div>
        </motion.div>

        {/* RECENT ACTIVITY LOG */}
        <AnimatePresence>
          {presencas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-[#111] border-2 border-[#333] rounded-3xl p-5 shadow-md"
            >
              <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                PRESENÇAS REGISTRADAS
              </h3>
              
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {presencas.slice().reverse().map((presenca) => (
                  <div 
                    key={presenca.id} 
                    className="bg-[#1A1A1A] border border-[#222] text-zinc-300 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-600" />
                    <span className="uppercase tracking-tight">{presenca.nome}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
      </div>
    </div>
  );
}
