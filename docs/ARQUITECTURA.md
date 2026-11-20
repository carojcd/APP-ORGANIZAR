# Arquitectura

```
UI (React)  ──►  AppContext  ──►  AssistantService ──► AIProvider (demo | gemini)
   │                 │                    │                 └─ devuelve acciones JSON
   │                 │                    └─► ActionExecutor ──► ItemRepository
   │                 └──────────────────────────────────────────► StorageProvider (IndexedDB | Supabase)
   └─ componentes solo usan interfaces, nunca implementaciones concretas
```

## Capas
| Carpeta | Responsabilidad |
|---|---|
| `src/config` | Configuración regional (es-CO, America/Bogota, COP) y variables de entorno públicas. |
| `src/domain` | Tipos, categorías extensibles, validación y reglas puras (duplicados, orden, filtros). |
| `src/lib` | Fechas en zona Bogotá, formatos (DD/MM/AAAA, 12 h, COP), texto, errores. |
| `src/services/storage` | Contrato `StorageProvider` + implementación IndexedDB. Supabase: esqueleto. |
| `src/services/ai` | Contrato `AIProvider`, esquema de acciones y su validador, proveedor demo y proveedor Gemini (inactivo). |
| `src/services/assistant` | `AssistantService` (orquesta) y `ActionExecutor` (ejecuta y redacta con el resultado real). |
| `src/services/notifications` | Contrato de notificaciones; recordatorios locales con la app abierta. FCM: etapa futura. |
| `src/state` | Estado global (React Context) y selectores derivados. |
| `src/components`, `src/features` | UI reutilizable y pantallas (Inicio, Asistente, Agenda, Tareas, Pagos). |
| `public/sw.js` | Service Worker: caché de la app, modo sin conexión, punto de entrada para push. |

## Decisiones clave
- **La IA solo interpreta.** Devuelve acciones JSON (`create_item`, `update_item`, `complete_item`, `delete_item`, `query_items`, `clarify`, `reply`). El `ActionExecutor` las ejecuta y la confirmación se redacta *después* de que el almacenamiento respondió. Si algo falla, el mensaje lo dice.
- **Nunca se inventan fechas ni a. m./p. m.**: se responde con `clarify` y opciones rápidas.
- **Fechas como `AAAA-MM-DD` en zona Bogotá**, independientes de la zona del dispositivo.
- **Sin router ni librerías de fechas**: navegación por hash (compatible con el botón atrás de Android) y utilidades propias.
- **Duplicados**: un registro abierto con misma categoría, mismas palabras clave en el título y misma fecha/hora se considera duplicado (chat y formulario).

## Sustituir IndexedDB por Supabase
1. Implementar `StorageProvider` en `src/services/storage/supabase/`.
2. Devolverlo desde `getStorage()` cuando `VITE_STORAGE_PROVIDER=supabase`.
3. La UI no cambia.
