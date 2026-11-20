import { useState, type FormEvent } from 'react';
import { Cloud, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { toUserMessage } from '@/lib/errors';
import { useApp } from '@/state/AppContext';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';

type Mode = 'signin' | 'signup';

/** Entrada a la cuenta (solo cuando los datos se guardan en la nube). */
export function LoginScreen() {
  const { storage } = useApp();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Escribe un correo válido.');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await storage.auth!.signIn(email, password);
      } else {
        const user = await storage.auth!.signUp(email, password);
        if (!user) {
          setInfo('Te enviamos un correo para confirmar tu cuenta. Ábrelo, confirma y luego inicia sesión aquí.');
          setMode('signin');
        }
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <img src="/icons/icon.svg" alt="" className="mb-5 size-14 rounded-2xl" />
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Mi Asistente</h1>
        <p className="mb-6 mt-1 flex items-center gap-1.5 text-[15px] text-muted">
          <Cloud size={16} /> Tus datos sincronizados en todos tus dispositivos.
        </p>

        <Segmented
          className="mb-5"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: 'signin', label: 'Iniciar sesión' },
            { value: 'signup', label: 'Crear cuenta' },
          ]}
        />

        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <Field label="Correo">
            <TextInput type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
          </Field>
          <Field label="Contraseña" hint={mode === 'signup' ? 'Mínimo 6 caracteres.' : undefined}>
            <div className="relative">
              <TextInput
                type={show ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-12"
              />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </Field>

          {error && <p className="rounded-2xl bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{error}</p>}
          {info && <p className="rounded-2xl bg-success-soft px-3.5 py-3 text-sm font-medium text-success">{info}</p>}

          <Button type="submit" block size="lg" disabled={busy} icon={mode === 'signin' ? <LogIn size={19} /> : <UserPlus size={19} />}>
            {busy ? 'Un momento…' : mode === 'signin' ? 'Entrar' : 'Crear mi cuenta'}
          </Button>
        </form>
      </div>
    </div>
  );
}
