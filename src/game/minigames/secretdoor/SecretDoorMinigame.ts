import type { MinigameRunner } from '../types';
import { useProgressStore } from '@/lib/stores/gameStore';

/**
 * SecretDoorMinigame — la puerta de la habitación secreta.
 *
 * NO es un minijuego clásico: simplemente comprueba si `hatchUnlocked`
 * está true (lo setea el PC de Alex tras introducir `HAKU-KERO-NALA`).
 *
 *   - hatchUnlocked = true  → success → muro derrumba → entrada libre.
 *   - hatchUnlocked = false → diálogo "necesitas PC Alex" → aborted.
 */
export const runSecretDoorMinigame: MinigameRunner = (ctx) => {
  return new Promise((resolve) => {
    const unlocked = useProgressStore.getState().hatchUnlocked === true;
    if (unlocked) {
      resolve({ success: true, reason: 'completed' });
      return;
    }
    void (async () => {
      const dlg = (ctx.scene as { dialogSystem?: { show: (lines: string[], opts: { speaker: string; portrait: string }) => Promise<void> } }).dialogSystem;
      const lines = [
        '*una puerta con un panel electrónico parpadeando rojo.*',
        '"...no recuerdo haberla visto antes."',
        '"el PC de Alex tendrá algo que ver con esto."',
      ];
      if (dlg) {
        await dlg.show(lines, { speaker: 'María', portrait: 'maria' });
      }
      resolve({ success: false, reason: 'aborted' });
    })();
  });
};
