'use client';

import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { buildGameConfig } from '@/game/config';

/**
 * Wrapper React que monta un Phaser.Game dentro de un div.
 *
 * S1 (Día 10): single-instance enforcement vía BroadcastChannel.
 *   - Cuando se monta esta pestaña, abre un canal 'theflat-instance' y
 *     hace ping. Si otra pestaña responde "claimed", muestra modal Jinx
 *     en vez del juego.
 *   - Si nadie responde en 250ms, esta pestaña reclama el dominio.
 *   - Mientras viva, responde a otros pings con "claimed" para que las
 *     pestañas nuevas se autoexilien.
 *   - Al desmontar (cerrar pestaña / SPA navigation), libera el canal.
 *
 * Botón "tomar el control" en el modal: envía "yield" por el canal,
 * recarga la pestaña actual. La otra pestaña recibe yield y muestra el
 * modal a su vez.
 */
export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [conflict, setConflict] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Single-instance check.
    if (typeof window === 'undefined') return;
    if (typeof BroadcastChannel === 'undefined') {
      // Fallback — navegadores sin BroadcastChannel: no hay enforcement.
      mountGame();
      return;
    }
    const channel = new BroadcastChannel('theflat-instance');
    channelRef.current = channel;
    let claimed = false;
    let resolved = false;

    const claim = () => {
      if (claimed) return;
      claimed = true;
      resolved = true;
      // Yo soy el "dueño". Respondo a pings + ATIENDO yields.
      channel.onmessage = (ev) => {
        if (ev.data?.type === 'ping') {
          channel.postMessage({ type: 'claimed' });
        } else if (ev.data?.type === 'yield') {
          // Otra pestaña tomó el control. Debo:
          //   1) Dejar de responder a pings (ya no soy el dueño).
          //   2) Destruir mi Phaser y mostrar conflict screen.
          //   3) Esperar a que la otra termine su reload con
          //      'released' o seguir vivo en estado de conflicto.
          claimed = false;
          channel.onmessage = (ev2) => {
            if (ev2.data?.type === 'released') {
              window.location.reload();
            }
          };
          setConflict(true);
          if (gameRef.current) {
            gameRef.current.destroy(true);
            gameRef.current = null;
          }
        }
      };
      mountGame();
    };

    const surrender = () => {
      if (resolved) return;
      resolved = true;
      setConflict(true);
      // En modo "yo cedo", escucho por si la otra desaparece.
      channel.onmessage = (ev) => {
        if (ev.data?.type === 'released') {
          window.location.reload();
        }
      };
    };

    channel.onmessage = (ev) => {
      if (ev.data?.type === 'claimed') {
        surrender();
      } else if (ev.data?.type === 'ping') {
        // Aún no he claim'd, ignoro.
      }
    };
    channel.postMessage({ type: 'ping' });

    // Si nadie responde en 250ms, claim.
    const timer = setTimeout(() => {
      if (!resolved) claim();
    }, 250);

    return () => {
      clearTimeout(timer);
      try {
        channel.postMessage({ type: 'released' });
      } catch {
        /* canal puede estar cerrado */
      }
      channel.close();
      channelRef.current = null;
    };

    function mountGame() {
      if (!containerRef.current || gameRef.current) return;
      const game = new Phaser.Game(buildGameConfig(containerRef.current));
      gameRef.current = game;
    }
  }, []);

  // Cleanup secundario para el game al desmontar (cubre HMR + nav).
  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  if (conflict) {
    return <ConflictScreen channelRef={channelRef} />;
  }

  return (
    <div
      ref={containerRef}
      id="phaser-root"
      className="h-screen w-screen"
      aria-label="The Flat — área de juego"
    />
  );
}

/**
 * Pantalla "ya hay una pestaña abierta" estilizada Jinx (Arcane). Paleta:
 *   - rosa Hi-Fi (#ff2e9f) acento principal
 *   - cyan eléctrico (#00e5ff) glow
 *   - púrpura profundo (#2a0e3d) fondo
 * Tipografía Silkscreen (ya cargada). Animación de glitch sutil sobre el
 * título.
 */
function ConflictScreen({
  channelRef,
}: {
  channelRef: React.MutableRefObject<BroadcastChannel | null>;
}) {
  const handleTake = () => {
    // Pide a la pestaña actual-dueña que suelte. Le damos un margen de
    // 350ms para que destruya su Phaser y deje de responder a pings.
    // Luego nos recargamos: en el ping siguiente nadie responderá y nos
    // claimearemos como nuevos dueños.
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({ type: 'yield' });
      } catch {
        /* canal cerrado */
      }
    }
    setTimeout(() => window.location.reload(), 350);
  };
  return (
    <div className="flex h-screen w-screen items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse at center, #2a0e3d 0%, #120420 70%, #06010d 100%)',
        fontFamily: "'Silkscreen', monospace",
        color: '#fbcfe8',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Líneas de scanline cutre */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, rgba(255,46,159,0.04) 0px, rgba(255,46,159,0.04) 1px, transparent 1px, transparent 4px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          maxWidth: 480,
          padding: '32px 28px',
          border: '2px solid #ff2e9f',
          background: '#170628',
          boxShadow:
            '0 0 0 2px #00e5ff, 0 0 28px rgba(255,46,159,0.6), inset 0 0 28px rgba(0,229,255,0.12)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: '#ff2e9f',
            letterSpacing: 2,
            textShadow: '0 0 12px #ff2e9f, 2px 0 #00e5ff, -2px 0 #ff2e9f',
            marginBottom: 6,
          }}
        >
          ¡EH!
        </div>
        <div
          style={{
            fontSize: 14,
            color: '#00e5ff',
            letterSpacing: 1,
            marginBottom: 22,
            textShadow: '0 0 8px #00e5ff',
          }}
        >
          THE FLAT YA ESTÁ ABIERTO
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#fbcfe8',
            lineHeight: 1.6,
            marginBottom: 22,
          }}
        >
          tienes el juego abierto en otra pestaña.
          <br />
          aquí no se puede entrar dos veces a la vez.
          <br />
          ciérrala primero o toma el control.
        </div>
        <button
          onClick={handleTake}
          style={{
            cursor: 'pointer',
            fontFamily: "'Silkscreen', monospace",
            fontSize: 12,
            fontWeight: 700,
            color: '#170628',
            background: '#ff2e9f',
            border: '2px solid #00e5ff',
            padding: '10px 22px',
            boxShadow: '0 0 16px rgba(255,46,159,0.8)',
            letterSpacing: 1,
          }}
        >
          TOMAR EL CONTROL
        </button>
        <div
          style={{
            marginTop: 18,
            fontSize: 8,
            color: '#6b21a8',
            letterSpacing: 2,
          }}
        >
          ◆ THE FLAT · v0.9 ◆
        </div>
      </div>
    </div>
  );
}
