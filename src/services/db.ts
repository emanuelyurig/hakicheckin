import { supabase, isMock, mockRealtimeHub } from '../lib/supabase';
import { Aula, Presenca } from '../types';

// Helper function to generate UUID v4 for mock mode
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Ensure initial mock data exists if we are in mock mode
function initializeMockData() {
  if (typeof window === 'undefined') return;
  
  const currentAula = localStorage.getItem('supabase_mock_aula');
  if (!currentAula) {
    // Create a default active class so the app is immediately alive and exciting!
    const defaultAula: Aula = {
      id: generateUUID(),
      tipo: 'Jiu-Jitsu Fundamental (Gi)',
      data: new Date().toISOString().split('T')[0],
      horario: '19:00',
      professor: 'Mestre Carlos Gracie',
      limite_vagas: 20,
      ativa: true,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('supabase_mock_aula', JSON.stringify(defaultAula));
    
    // Add some default test presences so the list isn't empty and feels real
    const defaultPresencas: Presenca[] = [
      {
        id: generateUUID(),
        aula_id: defaultAula.id,
        nome: 'Bruno Silva',
        confirmado_em: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
      {
        id: generateUUID(),
        aula_id: defaultAula.id,
        nome: 'Amanda Oliveira',
        confirmado_em: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
      },
      {
        id: generateUUID(),
        aula_id: defaultAula.id,
        nome: 'Lucas Santos',
        confirmado_em: new Date(Date.now() - 900000).toISOString(), // 15 mins ago
      }
    ];
    localStorage.setItem('supabase_mock_presencas', JSON.stringify(defaultPresencas));
  }
}

// Initialize on import
if (isMock) {
  initializeMockData();
}

export const dbService = {
  /**
   * Fetch the currently active class. Max 1.
   */
  async getAulaAtiva(): Promise<Aula | null> {
    if (isMock) {
      const data = localStorage.getItem('supabase_mock_aula');
      return data ? JSON.parse(data) : null;
    }

    try {
      const { data, error } = await supabase!
        .from('aulas')
        .select('*')
        .eq('ativa', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active class:', error);
        throw error;
      }

      return data as Aula | null;
    } catch (err) {
      console.warn('Real Supabase query failed, falling back to local simulation:', err);
      // Fallback to mock state if connection error
      const data = localStorage.getItem('supabase_mock_aula');
      return data ? JSON.parse(data) : null;
    }
  },

  /**
   * Save or update the active class.
   */
  async salvarAula(aulaInput: Omit<Aula, 'id' | 'ativa' | 'created_at'>): Promise<Aula> {
    // Sanitize input
    const sanitizedInput = {
      tipo: aulaInput.tipo.trim(),
      data: aulaInput.data,
      horario: aulaInput.horario,
      professor: aulaInput.professor?.trim() || undefined,
      limite_vagas: Number(aulaInput.limite_vagas),
    };

    if (isMock) {
      const existing = await this.getAulaAtiva();
      let updated: Aula;

      if (existing) {
        // Update existing
        updated = {
          ...existing,
          ...sanitizedInput,
          ativa: true,
        };
      } else {
        // Create new
        updated = {
          id: generateUUID(),
          ...sanitizedInput,
          ativa: true,
          created_at: new Date().toISOString(),
        };
      }

      localStorage.setItem('supabase_mock_aula', JSON.stringify(updated));
      
      // If creating a new class or updating, we might keep or clear presences? 
      // The instruction says: "Sempre haverá apenas uma aula ativa. Se já existir, atualizar os dados. Não criar outra."
      // So updating keeps the existing class ID. No need to clear presences unless they press "Limpar Lista".
      
      mockRealtimeHub.publish('UPDATE', 'aulas', updated);
      return updated;
    }

    const existing = await this.getAulaAtiva();
    let result: any;

    if (existing) {
      const { data, error } = await supabase!
        .from('aulas')
        .update({
          tipo: sanitizedInput.tipo,
          data: sanitizedInput.data,
          horario: sanitizedInput.horario,
          professor: sanitizedInput.professor,
          limite_vagas: sanitizedInput.limite_vagas,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase!
        .from('aulas')
        .insert({
          tipo: sanitizedInput.tipo,
          data: sanitizedInput.data,
          horario: sanitizedInput.horario,
          professor: sanitizedInput.professor,
          limite_vagas: sanitizedInput.limite_vagas,
          ativa: true,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return result as Aula;
  },

  /**
   * Get all presences for a specific class, sorted by confirmation time.
   */
  async getPresencas(aulaId: string): Promise<Presenca[]> {
    if (isMock) {
      const allStr = localStorage.getItem('supabase_mock_presencas');
      if (!allStr) return [];
      const all: Presenca[] = JSON.parse(allStr);
      // Filter by this class ID and sort ascending by date
      return all
        .filter((p) => p.aula_id === aulaId)
        .sort((a, b) => new Date(a.confirmado_em).getTime() - new Date(b.confirmado_em).getTime());
    }

    const { data, error } = await supabase!
      .from('presencas')
      .select('*')
      .eq('aula_id', aulaId)
      .order('confirmado_em', { ascending: true });

    if (error) {
      console.error('Error fetching presences:', error);
      throw error;
    }

    return data as Presenca[];
  },

  /**
   * Confirm presence for a student.
   * Includes validations:
   * - Name mandatory, no spaces only
   * - Trim and remove extra spacing
   * - Case-insensitive uniqueness check
   * - Spot limit check
   */
  async confirmarPresenca(aulaId: string, nomeCompleto: string): Promise<Presenca> {
    // 1. Sanitize name: remove extra spaces (replace multiple spaces with single space)
    const sanitizedNome = nomeCompleto.trim().replace(/\s+/g, ' ');

    if (!sanitizedNome) {
      throw new Error('O nome completo é obrigatório.');
    }

    // 2. Fetch class and check limit
    const aula = await this.getAulaAtiva();
    if (!aula || aula.id !== aulaId) {
      throw new Error('Aula ativa não encontrada.');
    }

    // 3. Fetch current presences to validate uniqueness and availability
    const presencas = await this.getPresencas(aulaId);

    // Duplicated check
    const jaConfirmado = presencas.some(
      (p) => p.nome.toLowerCase().trim() === sanitizedNome.toLowerCase()
    );

    if (jaConfirmado) {
      throw new Error('Você já confirmou presença nesta aula.');
    }

    // Spots check
    if (presencas.length >= aula.limite_vagas) {
      throw new Error('Esta aula já atingiu o limite de vagas.');
    }

    const novaPresenca: Omit<Presenca, 'id'> = {
      aula_id: aulaId,
      nome: sanitizedNome,
      confirmado_em: new Date().toISOString(),
    };

    if (isMock) {
      const created: Presenca = {
        id: generateUUID(),
        ...novaPresenca,
      };

      const allStr = localStorage.getItem('supabase_mock_presencas') || '[]';
      const all: Presenca[] = JSON.parse(allStr);
      all.push(created);
      localStorage.setItem('supabase_mock_presencas', JSON.stringify(all));

      mockRealtimeHub.publish('INSERT', 'presencas', created);
      return created;
    }

    const { data, error } = await supabase!
      .from('presencas')
      .insert({
        aula_id: aulaId,
        nome: sanitizedNome,
        confirmado_em: novaPresenca.confirmado_em,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint check from DB if somehow reached
      if (error.code === '23505') {
        throw new Error('Você já confirmou presença nesta aula.');
      }
      throw error;
    }

    return data as Presenca;
  },

  /**
   * Remove a student's presence (freeing up a spot)
   */
  async removerPresenca(presencaId: string): Promise<void> {
    if (isMock) {
      const allStr = localStorage.getItem('supabase_mock_presencas') || '[]';
      let all: Presenca[] = JSON.parse(allStr);
      const target = all.find((p) => p.id === presencaId);
      
      if (target) {
        all = all.filter((p) => p.id !== presencaId);
        localStorage.setItem('supabase_mock_presencas', JSON.stringify(all));
        mockRealtimeHub.publish('DELETE', 'presencas', target);
      }
      return;
    }

    const { error } = await supabase!
      .from('presencas')
      .delete()
      .eq('id', presencaId);

    if (error) throw error;
  },

  /**
   * Clear all presences for the active class.
   * Keeps the class configuration intact.
   */
  async limparLista(aulaId: string): Promise<void> {
    if (isMock) {
      const allStr = localStorage.getItem('supabase_mock_presencas') || '[]';
      let all: Presenca[] = JSON.parse(allStr);
      // Remove presences for this class
      all = all.filter((p) => p.aula_id !== aulaId);
      localStorage.setItem('supabase_mock_presencas', JSON.stringify(all));
      
      // Publish event
      mockRealtimeHub.publish('DELETE', 'presencas', { aula_id: aulaId });
      return;
    }

    const { error } = await supabase!
      .from('presencas')
      .delete()
      .eq('aula_id', aulaId);

    if (error) throw error;
  },

  /**
   * Realtime subscription for a class's presences and details.
   * Triggers callback on any change to 'presencas' or 'aulas' table.
   */
  inscreverRealtime(callback: () => void): () => void {
    if (isMock) {
      return mockRealtimeHub.subscribe(() => {
        callback();
      });
    }

    // Subscribe to both aulas and presencas tables for instant updates
    const channel = supabase!
      .channel('jiujitsu_attendance_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presencas' },
        () => {
          callback();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'aulas' },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }
};
