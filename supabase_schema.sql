-- ==========================================
-- SCRIPT DE BANCO DE DADOS - SUPABASE
-- PLATAFORMA DE PRESENÇA JIU-JITSU
-- ==========================================

-- 1. Criação da tabela de Aulas
CREATE TABLE IF NOT EXISTS public.aulas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    horario VARCHAR(10) NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    professor VARCHAR(100),
    limite_vagas INTEGER NOT NULL CHECK (limite_vagas > 0),
    ativa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Criação da tabela de Presenças
CREATE TABLE IF NOT EXISTS public.presencas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aula_id UUID NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    confirmado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Índices de Performance e Integridade
-- Índice para busca rápida de aulas ativas
CREATE INDEX IF NOT EXISTS aulas_ativa_idx ON public.aulas(ativa) WHERE (ativa = true);

-- Índice para busca rápida de presenças por aula
CREATE INDEX IF NOT EXISTS presencas_aula_id_idx ON public.presencas(aula_id);

-- GESTÃO SÊNIOR: Índice único case-insensitive para evitar nomes duplicados na mesma aula.
-- Isso garante integridade no nível do banco de dados, independente do cliente.
CREATE UNIQUE INDEX IF NOT EXISTS unique_aula_nome_lower_idx 
ON public.presencas (aula_id, lower(trim(nome)));


-- 4. Configuração de Row Level Security (RLS)
-- Como a plataforma não possui login por design, liberamos acesso anônimo controlado pelas políticas abaixo.

-- Habilitar RLS nas tabelas
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

-- Políticas para a tabela de Aulas
CREATE POLICY "Permitir leitura pública das aulas" 
ON public.aulas FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Permitir inserção pública de aulas" 
ON public.aulas FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de aulas" 
ON public.aulas FOR UPDATE 
TO public 
USING (true);

-- Políticas para a tabela de Presenças
CREATE POLICY "Permitir leitura pública das presenças" 
ON public.presencas FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Permitir inserção pública de presenças" 
ON public.presencas FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Permitir remoção pública de presenças" 
ON public.presencas FOR DELETE 
TO public 
USING (true);


-- 5. Ativação do Realtime (Supabase Realtime)
-- Adiciona as tabelas ao canal de publicação do Supabase para escuta em tempo real.
BEGIN;
  -- Remove as tabelas se já estiverem em outra publicação (evita erros)
  -- Adiciona à publicação oficial supabase_realtime
  ALTER PUBLICATION supabase_realtime ADD TABLE public.aulas;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.presencas;
COMMIT;
