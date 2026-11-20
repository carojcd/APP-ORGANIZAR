/**
 * Dictado por voz con la Web Speech API (Chrome en Android la soporta).
 * Requiere contexto seguro (HTTPS o localhost).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { LOCALE } from '@/config/locale';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function getCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Permiso de micrófono denegado. Actívalo en la configuración del navegador.',
  'service-not-allowed': 'El navegador no permite el dictado en esta conexión. Usa HTTPS.',
  'no-speech': 'No escuché nada. Intenta de nuevo.',
  'audio-capture': 'No se encontró un micrófono.',
  network: 'El dictado necesita conexión a internet.',
};

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const ctor = getCtor();
  const supported = ctor !== null;
  const secure = typeof window !== 'undefined' ? window.isSecureContext : true;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback(() => {
    setError(null);
    if (!ctor) {
      setError('Tu navegador no soporta dictado por voz. Prueba con Chrome.');
      return;
    }
    if (!secure) {
      setError('El micrófono requiere HTTPS. Abre la app con "npm run dev:https" o desde localhost.');
      return;
    }
    try {
      const rec = new ctor();
      rec.lang = LOCALE.speechLang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      finalRef.current = '';
      rec.onresult = (e) => {
        let interimText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalRef.current += r[0].transcript;
          else interimText += r[0].transcript;
        }
        setInterim(finalRef.current + interimText);
      };
      rec.onerror = (e) => {
        if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'No pude usar el micrófono.');
      };
      rec.onend = () => {
        setListening(false);
        setInterim('');
        const text = finalRef.current.trim();
        if (text) onFinalRef.current(text);
        recRef.current = null;
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setError('No pude iniciar el dictado.');
      setListening(false);
    }
  }, [ctor, secure]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, secure, listening, interim, error, start, stop, clearError: () => setError(null) };
}
