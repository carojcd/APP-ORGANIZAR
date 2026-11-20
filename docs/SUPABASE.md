# Supabase: tus datos en la nube

Con Supabase, lo que anotas en el Mac aparece en el teléfono (y al revés), con inicio de sesión.

## Pasos
1. Crea una cuenta gratis en https://supabase.com y un proyecto nuevo (región: São Paulo o la más cercana).
2. **Crear las tablas:** menú *SQL Editor* → *New query* → pega todo `supabase/schema.sql` → *Run*.
3. **Entrar sin confirmar correo** (recomendado para uso personal): *Authentication* → *Sign In / Providers* → *Email* → desactiva **Confirm email** → *Save*.
4. **Copiar los datos de conexión:** *Project Settings* → *API Keys* (o el botón *Connect*):
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Publishable key** (o *anon public*) → `VITE_SUPABASE_ANON_KEY`
   - ⚠️ Nunca uses la *secret key* ni *service_role*.
5. Agrega ambas líneas a tu `.env.local` (debajo de `GEMINI_API_KEY`) y reinicia `npm run dev:https`.
6. En la app: **Crear cuenta** con tu correo y una contraseña.
7. **Cierra el registro** para que nadie más cree cuentas: *Authentication* → *Sign In / Providers* → desactiva **Allow new users to sign up**.
8. Opcional: en cada dispositivo, *Configuración → Subir datos de este dispositivo* para llevar a la nube lo que anotaste antes.

## Cómo funciona
- `src/services/storage/supabase/SupabaseProvider.ts` implementa el mismo contrato que IndexedDB: la interfaz no cambió.
- Seguridad con Row Level Security: cada usuario solo puede leer y modificar sus filas.
- Realtime: los cambios de otro dispositivo llegan en vivo; además se refresca al volver a la app.
- Para volver al modo local: `VITE_STORAGE_PROVIDER=local` en `.env.local`.

## Limitación actual
Sin internet no se puede guardar en la nube (la app avisa con un error). El modo sin conexión con sincronización posterior queda para una etapa futura.
