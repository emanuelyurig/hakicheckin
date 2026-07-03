import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { dbService } from '../services/db';

export function useRealtime(activeClassId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = dbService.inscreverRealtime(() => {
      // Invalidate both the active class state and the current presences list
      queryClient.invalidateQueries({ queryKey: ['activeClass'] });
      
      if (activeClassId) {
        queryClient.invalidateQueries({ queryKey: ['presencas', activeClassId] });
      } else {
        // If no ID passed yet, invalidate any active presence lists
        queryClient.invalidateQueries({ queryKey: ['presencas'] });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeClassId, queryClient]);
}
