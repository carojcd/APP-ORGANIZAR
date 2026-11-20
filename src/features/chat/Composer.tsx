import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Square } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  autoStartVoice?: boolean;
  onVoiceStarted?: () => void;
}

/** Caja de texto con dictado por voz. El texto dictado se puede revisar antes de enviar. */
export function Composer({ onSend, disabled, autoStartVoice, onVoiceStarted }: Props) {
  const [text, setText] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeechRecognition((finalText) => {
    setText((prev) => (prev ? `${prev.trim()} ${finalText}` : finalText));
    areaRef.current?.focus();
  });

  useEffect(() => {
    if (autoStartVoice) {
      onVoiceStarted?.();
      speech.start();
    }
    // Solo al montar / cuando se solicita.
  }, [autoStartVoice]);

  // Auto-alto del textarea.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text, speech.interim]);

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText('');
  };

  const shown = speech.listening && speech.interim ? `${text ? text + ' ' : ''}${speech.interim}` : text;

  return (
    <div className="border-t border-line bg-bg/90 px-3 pb-3 pt-2 backdrop-blur-xl">
      {speech.error && (
        <button className="mb-2 w-full rounded-2xl bg-danger-soft px-3 py-2 text-left text-[13px] font-medium text-danger" onClick={speech.clearError}>
          {speech.error}
        </button>
      )}
      <div className={cn('flex items-end gap-2 rounded-[26px] border bg-surface p-1.5 pl-4 shadow-card transition', speech.listening ? 'border-danger/50' : 'border-line focus-within:border-accent')}>
        <textarea
          ref={areaRef}
          rows={1}
          value={shown}
          readOnly={speech.listening}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={speech.listening ? 'Te escucho…' : 'Escribe una instrucción…'}
          aria-label="Mensaje para el asistente"
          maxLength={1000}
          enterKeyHint="send"
          className="max-h-36 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-6 outline-none placeholder:text-faint"
        />
        {text.trim() && !speech.listening ? (
          <button
            onClick={submit}
            disabled={disabled}
            aria-label="Enviar"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition active:scale-95 disabled:opacity-50"
          >
            <ArrowUp size={21} strokeWidth={2.5} />
          </button>
        ) : (
          <button
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            aria-label={speech.listening ? 'Detener dictado' : 'Dictar por voz'}
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-95',
              speech.listening ? 'animate-pulse-ring bg-danger text-white' : 'bg-fg text-bg',
            )}
          >
            {speech.listening ? <Square size={16} fill="currentColor" /> : <Mic size={20} />}
          </button>
        )}
      </div>
    </div>
  );
}
