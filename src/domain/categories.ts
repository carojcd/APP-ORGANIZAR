import type { CategoryId } from './types';

/**
 * Registro de categorías. Para agregar una nueva basta con añadirla aquí
 * (o, en una etapa futura, cargarla desde la base de datos): la interfaz,
 * los filtros y el intérprete la recogen automáticamente.
 */
export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  description: string;
  /** Nombre del ícono Lucide (ver components/ui/CategoryIcon.tsx). */
  icon: 'briefcase' | 'palette' | 'user' | 'wallet' | 'tag';
  /** Clave de color definida en index.css (--cat-<color>). */
  color: 'work' | 'freelance' | 'personal' | 'finance' | 'neutral';
  /** Palabras que el intérprete demo usa para clasificar. */
  keywords: string[];
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'work',
    label: 'Trabajo',
    description: 'Actividades laborales, reuniones, proyectos y entregas.',
    icon: 'briefcase',
    color: 'work',
    keywords: [
      'trabajo', 'oficina', 'reunion', 'reuniones', 'junta', 'comite', 'jefe', 'equipo', 'informe',
      'presentacion', 'proyecto', 'empresa', 'laboral', 'pendientes de mi trabajo', 'correo', 'llamada',
    ],
  },
  {
    id: 'freelance',
    label: 'Freelance',
    description: 'Clientes independientes, proyectos, diseños, entregas y cobros.',
    icon: 'palette',
    color: 'freelance',
    keywords: [
      'freelance', 'cliente', 'clientes', 'diseno', 'disenos', 'logo', 'propuesta', 'cotizacion',
      'brief', 'mockup', 'independiente', 'branding', 'landing',
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    description: 'Citas, diligencias, actividades y compromisos personales.',
    icon: 'user',
    color: 'personal',
    keywords: [
      'cita', 'medico', 'odontologo', 'gimnasio', 'gym', 'cumpleanos', 'familia', 'mama', 'papa',
      'comprar', 'mercado', 'diligencia', 'banco', 'pasaporte', 'peluqueria', 'cena', 'almuerzo',
      'amigos', 'viaje', 'mascota', 'veterinario',
    ],
  },
  {
    id: 'finance',
    label: 'Finanzas',
    description: 'Cuentas por pagar, cuotas, vencimientos, deudas y dinero por cobrar.',
    icon: 'wallet',
    color: 'finance',
    keywords: [
      'pagar', 'pago', 'pagos', 'cuota', 'factura', 'recibo', 'servicios publicos', 'arriendo',
      'tarjeta', 'credito', 'deuda', 'prestamo', 'cobrar', 'cobro', 'me deben', 'transferir',
      'impuesto', 'predial', 'administracion', 'falabella', 'netflix', 'internet', 'luz', 'agua', 'gas',
    ],
  },
];

const FALLBACK: CategoryDefinition = {
  id: 'other',
  label: 'Otra',
  description: 'Categoría no registrada.',
  icon: 'tag',
  color: 'neutral',
  keywords: [],
};

export function getCategory(id: CategoryId): CategoryDefinition {
  return CATEGORIES.find((c) => c.id === id) ?? { ...FALLBACK, id, label: id };
}

export function isKnownCategory(id: string): boolean {
  return CATEGORIES.some((c) => c.id === id);
}

export const DEFAULT_CATEGORY_ID: CategoryId = 'personal';
