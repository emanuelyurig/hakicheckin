export interface Aula {
  id: string;
  data: string;
  horario: string;
  tipo: string;
  professor?: string;
  limite_vagas: number;
  ativa: boolean;
  created_at?: string;
}

export interface Presenca {
  id: string;
  aula_id: string;
  nome: string;
  confirmado_em: string;
}

export interface AulaStats {
  tipo: string;
  horario: string;
  data: string;
  totalConfirmados: number;
  vagasRestantes: number;
  limiteVagas: number;
}
