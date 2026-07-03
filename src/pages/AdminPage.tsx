import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlusCircle, Users, Clock, Calendar, Trophy, Trash2, 
  FileSpreadsheet, FileText, Ban, Loader2, Sparkles, CheckCircle2, UserCheck
} from 'lucide-react';

import { dbService } from '../services/db';
import { useToast } from '../contexts/ToastContext';
import { useRealtime } from '../hooks/useRealtime';
  import AdminLogin from "../pages/AdminLogin";

// Validation Schema using Zod
const classSchema = z.object({
  data: z.string().min(1, 'A data é obrigatória.'),
  horario: z.string().min(1, 'O horário é obrigatório.'),
  tipo: z.string().min(1, 'O tipo de aula é obrigatório.'),
  professor: z.string().optional(),
  limite_vagas: z.coerce.number()
    .min(1, 'O limite deve ser de pelo menos 1 vaga.')
    .max(500, 'O limite máximo recomendado é de 500 vagas.'),
});

type ClassFormValues = z.infer<typeof classSchema>;

export default function AdminPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // 1. Fetch active class
  const { 
    data: activeClass, 
    isLoading: isLoadingClass, 
    refetch: refetchClass 
  } = useQuery({
    queryKey: ['activeClass'],
    queryFn: () => dbService.getAulaAtiva(),
  });

  // 2. Fetch presences for the active class (enabled only if activeClass exists)
  const { 
    data: presencas = [], 
    isLoading: isLoadingPresencas 
  } = useQuery({
    queryKey: ['presencas', activeClass?.id],
    queryFn: () => dbService.getPresencas(activeClass!.id),
    enabled: !!activeClass?.id,
  });

  // 3. Setup real-time listeners for updates
  useRealtime(activeClass?.id);

  // 4. Form integration
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema) as any, // Cast to any to bypass strict version-mismatch react-hook-form type checks
    defaultValues: {
      data: new Date().toISOString().split('T')[0],
      horario: '',
      tipo: '',
      professor: '',
      limite_vagas: 20,
    },
  });

  // Load existing active class values into form on mount/change
  useEffect(() => {
    if (activeClass) {
      setValue('data', activeClass.data);
      setValue('horario', activeClass.horario);
      setValue('tipo', activeClass.tipo);
      setValue('professor', activeClass.professor || '');
      setValue('limite_vagas', activeClass.limite_vagas);
    }
  }, [activeClass, setValue]);

  // 5. Mutation: Save / Update active class
  const saveClassMutation = useMutation({
    mutationFn: async (values: ClassFormValues) => {
      return dbService.salvarAula({
        tipo: values.tipo,
        data: values.data,
        horario: values.horario,
        professor: values.professor,
        limite_vagas: values.limite_vagas,
      });
    },
    onSuccess: (data) => {
      toast.success(
        activeClass 
          ? 'Aula atualizada com sucesso!' 
          : 'Nova aula ativa criada!'
      );
      queryClient.invalidateQueries({ queryKey: ['activeClass'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao salvar a aula.');
    },
  });

  // 6. Mutation: Delete individual presence
  const removePresenceMutation = useMutation({
    mutationFn: async (id: string) => {
      return dbService.removerPresenca(id);
    },
    onSuccess: () => {
      toast.success('Presença removida da lista.');
      queryClient.invalidateQueries({ queryKey: ['presencas', activeClass?.id] });
      queryClient.invalidateQueries({ queryKey: ['activeClass'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao remover presença.');
    },
  });

  // 7. Mutation: Clear entire list of presences for current active class
  const clearListMutation = useMutation({
    mutationFn: async () => {
      if (!activeClass) return;
      return dbService.limparLista(activeClass.id);
    },
    onSuccess: () => {
      toast.success('Lista de presenças limpa com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['presencas', activeClass?.id] });
      queryClient.invalidateQueries({ queryKey: ['activeClass'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao limpar a lista.');
    },
  });

  const onSubmit = (data: ClassFormValues) => {
    saveClassMutation.mutate(data);
  };

  const handleClearList = () => {
    if (!activeClass) return;
    const confirmacao = window.confirm(
      `Deseja realmente remover TODAS as ${presencas.length} presenças confirmadas da aula de hoje? A aula continuará ativa.`
    );
    if (confirmacao) {
      clearListMutation.mutate();
    }
  };

  // 8. CSV Export for Excel
  const handleExportExcel = () => {
    if (!activeClass || presencas.length === 0) {
      toast.error('Não há presenças registradas para exportação.');
      return;
    }

    // Header and Rows
    const headers = ['Ordem', 'Nome Completo', 'Horário de Confirmação', 'Aula', 'Data', 'Horário da Aula', 'Professor'];
    const rows = presencas.map((p, index) => [
      index + 1,
      p.nome,
      new Date(p.confirmado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      activeClass.tipo,
      activeClass.data,
      activeClass.horario,
      activeClass.professor || 'N/A'
    ]);

    // Construct CSV content with Excel friendly delimiter and BOM
    const csvContent = 
      '\uFEFF' + // UTF-8 BOM
      [headers.join(';'), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Chamada_JiuJitsu_${activeClass.data}_${activeClass.horario.replace(':', 'h')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Arquivo Excel (.CSV) gerado com sucesso!');
  };

  // 9. PDF Print Friendly Handler
  const handleExportPDF = () => {
    if (!activeClass || presencas.length === 0) {
      toast.error('Não há presenças registradas para exportação.');
      return;
    }
    window.print();
  };

  // Statistics
  const totalConfirmados = presencas.length;
  const vagasRestantes = activeClass ? Math.max(0, activeClass.limite_vagas - totalConfirmados) : 0;



const [authenticated, setAuthenticated] = useState(
  sessionStorage.getItem("admin-auth") === "true"
);

if (!authenticated) {
  return <AdminLogin onSuccess={() => setAuthenticated(true)} />;
}

  return (
    <div className="flex-grow bg-[#0A0A0A] py-10 px-4 sm:px-6 lg:px-8 print:bg-white print:text-black">
      
      {/* Printable Sheet Wrapper (Hidden on screen, styled for paper printing) */}
      <div className="hidden print:block font-serif max-w-4xl mx-auto p-8 text-black bg-white">
        <div className="border-b-4 border-black pb-4 text-center">
          <h1 className="text-3xl font-bold uppercase tracking-widest font-sans">
            LISTA DE CHAMADA - JIU-JITSU
          </h1>
          <p className="text-sm font-semibold tracking-wider font-mono mt-1">
            HAKI • ACADEMIA DE LUTA
          </p>
        </div>

        {activeClass && (
          <div className="grid grid-cols-2 gap-4 my-6 text-sm border-b-2 border-zinc-300 pb-4">
            <div>
              <p><strong>Aula:</strong> {activeClass.tipo}</p>
              <p><strong>Professor:</strong> {activeClass.professor || 'N/A'}</p>
            </div>
            <div className="text-right">
              <p><strong>Data:</strong> {new Date(activeClass.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              <p><strong>Horário:</strong> {activeClass.horario}</p>
            </div>
          </div>
        )}

        <div className="my-4 flex items-center justify-between text-xs font-semibold bg-zinc-100 p-2 border">
          <span>Total de Vagas: {activeClass?.limite_vagas}</span>
          <span>Presenças Confirmadas: {totalConfirmados}</span>
          <span>Vagas Livres: {vagasRestantes}</span>
        </div>

        <table className="w-full text-left border-collapse border border-zinc-400 mt-4 text-sm">
          <thead>
            <tr className="bg-zinc-200 text-zinc-800 uppercase text-xs">
              <th className="border border-zinc-400 p-2.5 w-16 text-center">Ordem</th>
              <th className="border border-zinc-400 p-2.5">Nome Completo do Atleta</th>
              <th className="border border-zinc-400 p-2.5 w-32 text-center">Confirmação</th>
              <th className="border border-zinc-400 p-2.5 w-40 text-center">Assinatura / Visto</th>
            </tr>
          </thead>
          <tbody>
            {presencas.map((p, idx) => (
              <tr key={p.id}>
                <td className="border border-zinc-400 p-2.5 text-center font-bold">{idx + 1}</td>
                <td className="border border-zinc-400 p-2.5 font-medium uppercase">{p.nome}</td>
                <td className="border border-zinc-400 p-2.5 text-center text-xs">
                  {new Date(p.confirmado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="border border-zinc-400 p-2.5"></td>
              </tr>
            ))}
            {presencas.length === 0 && (
              <tr>
                <td colSpan={4} className="border border-zinc-400 p-8 text-center text-zinc-500 italic">
                  Nenhum aluno confirmado nesta aula até o momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-16 flex justify-between text-xs text-zinc-600 font-mono">
          <span>Impresso em: {new Date().toLocaleString('pt-BR')}</span>
          <span>Visto do Responsável: _______________________________________</span>
        </div>
      </div>


      {/* Screen Interactive Workspace */}
      <div className="max-w-7xl mx-auto flex flex-col gap-8 print:hidden">
        
        {/* UPPER STATUS SUMMARY BENTO GRID */}
        {activeClass && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-[#111] border-2 border-[#333] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em] block">Aula Ativa</span>
              <p className="font-black text-lg text-white truncate mt-1.5 uppercase tracking-tight">
                {activeClass.tipo}
              </p>
            </div>

            <div className="bg-[#111] border-2 border-[#333] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em] block">Data / Horário</span>
              <p className="font-black text-lg text-white mt-1.5 uppercase tracking-tight">
                {new Date(activeClass.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • {activeClass.horario}
              </p>
            </div>

            <div className="bg-[#111] border-2 border-[#333] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em] block">Professor</span>
              <p className="font-black text-lg text-orange-600 truncate mt-1.5 uppercase tracking-tight">
                {activeClass.professor || 'Não informado'}
              </p>
            </div>

            <div className="bg-[#111] border-2 border-[#333] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em] block">Confirmados</span>
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className="font-black text-2xl text-white">{totalConfirmados}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">/ {activeClass.limite_vagas} vagas</span>
              </div>
            </div>

            <div className={`border-2 rounded-2xl p-5 flex flex-col justify-between shadow-sm ${
              vagasRestantes === 0 ? 'bg-orange-950/10 border-orange-600' : 'bg-[#111] border-[#333]'
            }`}>
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em] block">Vagas Livres</span>
              <p className={`font-black text-2xl mt-1.5 ${vagasRestantes === 0 ? 'text-orange-500' : 'text-white'}`}>
                {vagasRestantes}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: CADASTRO/CONFIG CARD */}
          <div className="lg:col-span-5 bg-[#111] border-2 border-[#333] rounded-3xl p-6 sm:p-8 shadow-md">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#222]">
              <h2 className="text-base font-black text-white tracking-tight uppercase flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-orange-600" />
                Definir Aula Ativa
              </h2>
              {activeClass && (
                <span className="bg-orange-600/10 text-orange-500 border border-orange-500/20 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-ping" />
                  Ativa
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              
              {/* Tipo de Aula */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">
                  Tipo da Aula
                </label>
                <input
                  type="text"
                  placeholder="Ex: Jiu-Jitsu No-Gi (Graduados)"
                  disabled={saveClassMutation.isPending}
                  {...register('tipo')}
                  className={`w-full bg-[#0A0A0A] text-white placeholder-zinc-700 rounded-xl px-4 py-3.5 text-sm font-bold border focus:outline-none transition-all ${
                    errors.tipo ? 'border-orange-500/60 focus:border-orange-500 focus:ring-1 focus:ring-red-500' : 'border-[#333] focus:border-orange-600 focus:ring-1 focus:ring-red-600'
                  }`}
                />
                {errors.tipo && (
                  <p className="mt-1.5 text-xs text-orange-500 font-semibold">{errors.tipo.message}</p>
                )}
              </div>

              {/* Data & Horário */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">
                    Data da Aula
                  </label>
                  <input
                    type="date"
                    disabled={saveClassMutation.isPending}
                    {...register('data')}
                    className={`w-full bg-[#0A0A0A] text-white rounded-xl px-4 py-3.5 text-sm font-bold border focus:outline-none transition-all ${
                      errors.data ? 'border-orange-500/60 focus:border-orange-500 focus:ring-1 focus:ring-red-500' : 'border-[#333] focus:border-orange-600 focus:ring-1 focus:ring-red-600'
                    }`}
                  />
                  {errors.data && (
                    <p className="mt-1.5 text-xs text-orange-500 font-semibold">{errors.data.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">
                    Horário de Início
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 19:30"
                    disabled={saveClassMutation.isPending}
                    {...register('horario')}
                    className={`w-full bg-[#0A0A0A] text-white placeholder-zinc-700 rounded-xl px-4 py-3.5 text-sm font-bold border focus:outline-none transition-all ${
                      errors.horario ? 'border-orange-500/60 focus:border-orange-500 focus:ring-1 focus:ring-red-500' : 'border-[#333] focus:border-orange-600 focus:ring-1 focus:ring-red-600'
                    }`}
                  />
                  {errors.horario && (
                    <p className="mt-1.5 text-xs text-orange-500 font-semibold">{errors.horario.message}</p>
                  )}
                </div>
              </div>

              {/* Professor */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">
                  Professor / Instrutor (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mestre Helio Gracie"
                  disabled={saveClassMutation.isPending}
                  {...register('professor')}
                  className="w-full bg-[#0A0A0A] text-white placeholder-zinc-700 rounded-xl px-4 py-3.5 text-sm font-bold border border-[#333] focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all"
                />
              </div>

              {/* Limite de Vagas */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">
                  Limite Máximo de Vagas
                </label>
                <input
                  type="number"
                  placeholder="20"
                  disabled={saveClassMutation.isPending}
                  {...register('limite_vagas')}
                  className={`w-full bg-[#0A0A0A] text-white placeholder-zinc-700 rounded-xl px-4 py-3.5 text-sm font-bold border focus:outline-none transition-all ${
                    errors.limite_vagas ? 'border-orange-500/60 focus:border-orange-500 focus:ring-1 focus:ring-red-500' : 'border-[#333] focus:border-orange-600 focus:ring-1 focus:ring-red-600'
                  }`}
                />
                {errors.limite_vagas && (
                  <p className="mt-1.5 text-xs text-orange-500 font-semibold">{errors.limite_vagas.message}</p>
                )}
              </div>

              {/* Action Submit Button */}
              <button
                type="submit"
                disabled={saveClassMutation.isPending}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-black py-4 px-4 rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 mt-2 uppercase tracking-wider text-xs sm:text-sm cursor-pointer"
              >
                {saveClassMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <span>{activeClass ? 'Atualizar Dados da Aula' : 'Salvar e Ativar Aula'}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* RIGHT PANEL: LIST OF CONFIRMATIONS */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {/* Actions Panel (Excel, PDF, Clear) */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111] border-2 border-[#333] rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                Ações da Lista
              </span>
              
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportExcel}
                  disabled={!activeClass || presencas.length === 0}
                  className="bg-[#0A0A0A] border border-[#333] hover:border-orange-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-900 text-zinc-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  title="Exportar para arquivo legível no Excel (.CSV)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-rose-500" />
                  Excel
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={!activeClass || presencas.length === 0}
                  className="bg-[#0A0A0A] border border-[#333] hover:border-orange-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-900 text-zinc-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  title="Exportar Folha de Chamada para Impressão"
                >
                  <FileText className="w-4 h-4 text-rose-500" />
                  PDF/Imprimir
                </button>

                <button
                  onClick={handleClearList}
                  disabled={!activeClass || presencas.length === 0 || clearListMutation.isPending}
                  className="bg-orange-950/20 hover:bg-orange-950/40 border border-orange-900/40 hover:border-orange-500/40 text-orange-400 disabled:opacity-50 disabled:cursor-not-allowed px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  title="Limpar somente os alunos confirmados da aula ativa"
                >
                  <Ban className="w-4 h-4 text-orange-500" />
                  Limpar Lista
                </button>
              </div>
            </div>

            {/* Attendance List Card */}
            <div className="bg-[#111] border-2 border-[#333] rounded-3xl overflow-hidden shadow-md">
              <div className="p-5 border-b border-[#222] flex items-center justify-between">
                <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-600" />
                  Lista de Presença em Tempo Real
                </h3>
                <span className="text-[10px] font-black text-gray-500 uppercase">
                  Ordenado por Confirmação
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0A0A0A] text-gray-500 text-[9px] uppercase font-bold tracking-[0.15em] border-b border-[#222]">
                      <th className="py-4 px-5 w-16 text-center">Ordem</th>
                      <th className="py-4 px-4">Nome do Atleta</th>
                      <th className="py-4 px-4 w-36 text-center">Confirmado Em</th>
                      <th className="py-4 px-5 w-24 text-center">Ações</th>
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-[#222] text-sm">
                    <AnimatePresence initial={false}>
                      {presencas.map((presenca, index) => (
                        <motion.tr
                          key={presenca.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, x: -30 }}
                          className="hover:bg-zinc-900/40 transition-colors group"
                        >
                          {/* Ordem */}
                          <td className="py-3 px-5 text-center font-black text-gray-500">
                            {index + 1}º
                          </td>

                          {/* Nome */}
                          <td className="py-3 px-4 font-black uppercase text-white tracking-tight">
                            {presenca.nome}
                          </td>

                          {/* Horário */}
                          <td className="py-3 px-4 text-center text-xs text-gray-400 font-bold">
                            {new Date(presenca.confirmado_em).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>

                          {/* Remover Button */}
                          <td className="py-3 px-5 text-center">
                            <button
                              onClick={() => removePresenceMutation.mutate(presenca.id)}
                              disabled={removePresenceMutation.isPending}
                              className="text-gray-500 hover:text-orange-500 hover:bg-orange-950/20 p-1.5 rounded-lg transition-all inline-flex items-center justify-center cursor-pointer"
                              title="Remover presença do atleta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>

                    {presencas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 px-6 text-center">
                          <div className="max-w-xs mx-auto flex flex-col items-center justify-center text-gray-500 gap-2">
                            <Ban className="w-8 h-8 text-zinc-700" />
                            <p className="text-xs font-black uppercase tracking-widest">
                              Nenhuma Presença
                            </p>
                            <p className="text-[11px] text-zinc-500 leading-normal font-semibold">
                              {activeClass 
                                ? 'Os alunos que confirmarem presença através do link aparecerão aqui instantaneamente.'
                                : 'Defina e salve a aula do dia para começar a receber confirmações.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tabela Footer Summary info */}
              <div className="bg-[#0A0A0A] px-5 py-3.5 border-t border-[#222] flex justify-between items-center text-xs text-gray-500 font-bold uppercase tracking-wider">
                <span>Total Confirmados: <strong className="text-white font-black">{totalConfirmados}</strong></span>
                <span>Vagas Restantes: <strong className="text-white font-black">{vagasRestantes}</strong></span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
