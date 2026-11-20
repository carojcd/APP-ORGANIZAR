# Mi Asistente — PWA de organización personal

Asistente personal de agenda, tareas y pagos que se maneja **conversando** (texto o voz).
Etapa 1: interfaz completa, chat funcional en **modo demostración** (intérprete local en español) y persistencia en el navegador (IndexedDB).

## Requisitos
- Node.js 20 o superior (probado con Node 22).

## Ejecutar

```bash
npm install
```

```bash
npm run dev
```

- En el computador: http://localhost:5173
- En el teléfono (misma red Wi‑Fi): la URL `Network` que imprime Vite, por ejemplo `http://192.168.1.20:5173`.

### Micrófono e instalación en Android
Chrome solo permite micrófono, Service Worker e instalación en **contextos seguros** (HTTPS o localhost).
Por HTTP en la red local la app funciona, pero sin dictado. Opciones:

1. **HTTPS local** (recomendado para probar la voz):
   ```bash
   npm run dev:https
   ```
   Abre `https://IP:5173` en el teléfono y acepta la advertencia del certificado autofirmado.
2. **Marcar el origen como seguro** en Chrome Android: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, agrega `http://IP:5173` y reinicia Chrome. Así también funciona la instalación y el modo sin conexión.

### Versión de producción (con Service Worker / sin conexión)
```bash
npm run build
```
```bash
npm run preview
```

### Pruebas
```bash
npm test
```

## Comandos de ejemplo para el chat
- "Mañana tengo una reunión con Don Vitto a las 9 de la mañana."
- "Recuérdame pagar Falabella el próximo viernes."
- "Agrega un pago pendiente de servicios públicos por $350.000."
- "¿Qué tengo pendiente hoy?" · "¿Qué pagos tengo pendientes este mes?"
- "Marca como completada la entrega de FLM." · "Cambia la reunión de mañana para las 3 de la tarde."

## Documentación
- [Arquitectura](docs/ARQUITECTURA.md)
- [Reglas de interpretación de fechas y horas](docs/INTERPRETACION.md)
- [Cómo conectar Gemini](docs/GEMINI.md)
- [Datos en la nube con Supabase](docs/SUPABASE.md)
