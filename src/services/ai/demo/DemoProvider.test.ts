import { describe, expect, it } from 'vitest';
import { interpretDemo } from './DemoProvider';
import type { AssistantAction, PendingIntent } from '../types';

// Viernes 20 de noviembre de 2026.
const today = '2026-11-20';
const run = (text: string, pending: PendingIntent | null = null) => interpretDemo(text, { today, pending }).actions[0];
const created = (text: string) => {
  const a = run(text);
  expect(a.type).toBe('create_item');
  return (a as Extract<AssistantAction, { type: 'create_item' }>).item;
};

describe('crear registros desde lenguaje natural', () => {
  it('reunión mañana a las 9 de la mañana', () => {
    const item = created('Mañana tengo una reunión con Don Vitto a las 9 de la mañana.');
    expect(item).toMatchObject({ title: 'Reunión con Don Vitto', categoryId: 'work', date: '2026-11-21', time: '09:00' });
  });

  it('recordatorio de pago el próximo viernes', () => {
    const item = created('Recuérdame pagar Falabella el próximo viernes.');
    expect(item).toMatchObject({ title: 'Pagar Falabella', categoryId: 'finance', date: '2026-11-27', dueDate: '2026-11-27' });
    expect(item.reminderMinutesBefore).toBe(0);
  });

  it('entrega freelance el miércoles', () => {
    const item = created('Tengo que entregar tres diseños para un cliente freelance el miércoles.');
    expect(item).toMatchObject({
      title: 'Entregar tres diseños para un cliente freelance',
      categoryId: 'freelance',
      date: '2026-11-25',
      dueDate: '2026-11-25',
    });
  });

  it('pendientes de trabajo el lunes', () => {
    const item = created('El lunes debo revisar los pendientes de mi trabajo.');
    expect(item).toMatchObject({ title: 'Revisar los pendientes de mi trabajo', categoryId: 'work', date: '2026-11-23' });
  });

  it('pago con monto y sin fecha (no inventa fecha)', () => {
    const item = created('Agrega un pago pendiente de servicios públicos por $350.000.');
    expect(item).toMatchObject({ title: 'Pago pendiente de servicios públicos', categoryId: 'finance', amount: 350000 });
    expect(item.date ?? null).toBeNull();
  });

  it('montos en distintos formatos', () => {
    expect(created('Pagar arriendo 1,5 millones el 30').amount).toBe(1_500_000);
    expect(created('Cuota del carro 850 mil el 5 de diciembre').amount).toBe(850_000);
    expect(created('Cobrarle a Ana $1\'200.000 mañana')).toMatchObject({ amount: 1_200_000, direction: 'collect' });
  });
});

describe('fechas relativas', () => {
  const dateOf = (t: string) => created(t).date;
  it('pasado mañana', () => expect(dateOf('Pasado mañana llamar al banco')).toBe('2026-11-22'));
  it('dentro de tres días', () => expect(dateOf('Dentro de tres días enviar el informe')).toBe('2026-11-23'));
  it('en 2 semanas', () => expect(dateOf('Renovar pasaporte en 2 semanas')).toBe('2026-12-04'));
  it('este viernes = hoy (es viernes)', () => expect(dateOf('Este viernes cena con amigos')).toBe('2026-11-20'));
  it('este lunes', () => expect(dateOf('Este lunes ir al gimnasio')).toBe('2026-11-23'));
  it('el próximo lunes', () => expect(dateOf('El próximo lunes ir al médico')).toBe('2026-11-23'));
  it('martes de la próxima semana', () => expect(dateOf('El martes de la próxima semana cita odontólogo')).toBe('2026-11-24'));
  it('fecha DD/MM', () => expect(dateOf('Pagar predial el 15/12')).toBe('2026-12-15'));
  it('día del mes ya pasado → mes siguiente', () => expect(dateOf('Pagar tarjeta el 10')).toBe('2026-12-10'));
  it('día y mes sin año pasado → año siguiente', () => expect(dateOf('Declaración de renta el 3 de enero')).toBe('2027-01-03'));
  it('hoy', () => expect(dateOf('Hoy comprar mercado')).toBe('2026-11-20'));
  it('"antes del" fija vencimiento', () => {
    const item = created('Enviar propuesta al cliente antes del jueves');
    expect(item.dueDate).toBe('2026-11-26');
    expect(item.date).toBeNull();
  });
});

describe('ambigüedades: pregunta en vez de inventar', () => {
  it('"el viernes" dicho un viernes', () => {
    const a = run('El viernes tengo cita médica');
    expect(a.type).toBe('clarify');
  });
  it('la próxima semana sin día', () => {
    const a = run('La próxima semana revisar contrato');
    expect(a.type).toBe('clarify');
    if (a.type === 'clarify') expect(a.options).toHaveLength(5);
  });
  it('hora sin a. m./p. m.', () => {
    const a = run('Mañana llamar a Pedro a las 3');
    expect(a.type).toBe('clarify');
    if (a.type !== 'clarify') return;
    expect(a.pending.missing).toBe('meridiem');
    const resolved = run('3:00 p. m.', a.pending);
    expect(resolved).toMatchObject({ type: 'create_item', item: { date: '2026-11-21', time: '15:00', title: 'Llamar a Pedro' } });
  });
  it('hora sin fecha pide el día y luego a. m./p. m.', () => {
    const a = run('Reunión de equipo a las 10');
    expect(a.type).toBe('clarify');
    if (a.type !== 'clarify') return;
    expect(a.pending.missing).toBe('date');
    const b = run('Mañana', a.pending);
    expect(b.type).toBe('clarify');
    if (b.type !== 'clarify') return;
    expect(b.pending.missing).toBe('meridiem');
    expect(run('a. m.', b.pending)).toMatchObject({ type: 'create_item', item: { date: '2026-11-21', time: '10:00' } });
  });
  it('cancelar una aclaración', () => {
    const a = run('Mañana llamar a Pedro a las 3');
    if (a.type !== 'clarify') throw new Error('se esperaba clarify');
    expect(run('cancelar', a.pending).type).toBe('reply');
  });
  it('fecha imposible', () => {
    expect(run('Pagar algo el 31 de febrero').type).toBe('reply');
  });
});

describe('horas', () => {
  const timeOf = (t: string) => created(t).time;
  it('3 de la tarde', () => expect(timeOf('Mañana dentista a las 3 de la tarde')).toBe('15:00'));
  it('8 y media de la noche', () => expect(timeOf('Hoy cena a las 8 y media de la noche')).toBe('20:30'));
  it('9am', () => expect(timeOf('Mañana a las 9am llamar al contador')).toBe('09:00'));
  it('4:30 p. m.', () => expect(timeOf('Mañana reunión 4:30 p. m.')).toBe('16:30'));
  it('formato 24 h', () => expect(timeOf('Mañana reunión a las 16:00')).toBe('16:00'));
  it('mediodía', () => expect(timeOf('Mañana almuerzo con mamá al mediodía')).toBe('12:00'));
  it('pista "en la tarde"', () => expect(timeOf('Mañana en la tarde a las 4 ir al banco')).toBe('16:00'));
});

describe('consultas, cambios, completar y eliminar', () => {
  it('¿Qué tengo pendiente hoy?', () => {
    expect(run('¿Qué tengo pendiente hoy?')).toMatchObject({
      type: 'query_items',
      query: { from: today, to: today, statuses: ['pending', 'in_progress'] },
    });
  });
  it('¿Qué pagos tengo pendientes este mes?', () => {
    expect(run('¿Qué pagos tengo pendientes este mes?')).toMatchObject({
      type: 'query_items',
      query: { categoryIds: ['finance'], from: '2026-11-01', to: '2026-11-30' },
    });
  });
  it('¿Qué tengo esta semana?', () => {
    expect(run('¿Qué tengo esta semana?')).toMatchObject({ type: 'query_items', query: { from: today, to: '2026-11-22' } });
  });
  it('Marca como completada la entrega de FLM', () => {
    expect(run('Marca como completada la entrega de FLM.')).toMatchObject({
      type: 'complete_item',
      target: { text: 'entrega de FLM' },
    });
  });
  it('Ya pagué Falabella', () => {
    expect(run('Ya pagué Falabella')).toMatchObject({ type: 'complete_item', target: { text: 'Falabella' } });
  });
  it('Cambia la reunión de mañana para las 3 de la tarde', () => {
    expect(run('Cambia la reunión de mañana para las 3 de la tarde.')).toMatchObject({
      type: 'update_item',
      target: { text: 'reunión', date: '2026-11-21' },
      changes: { time: '15:00' },
    });
  });
  it('Mueve el pago del arriendo al lunes', () => {
    expect(run('Mueve el pago del arriendo al lunes')).toMatchObject({
      type: 'update_item',
      target: { text: 'pago del arriendo' },
      changes: { date: '2026-11-23' },
    });
  });
  it('Elimina la cita con el odontólogo', () => {
    expect(run('Elimina la cita con el odontólogo')).toMatchObject({ type: 'delete_item', target: { text: 'cita con el odontólogo' } });
  });
  it('selección de candidato por número', () => {
    const pending: PendingIntent = {
      action: { type: 'complete_item', target: { text: 'reunión' } },
      missing: 'target',
      candidates: [
        { id: 'a', title: 'Reunión A' },
        { id: 'b', title: 'Reunión B' },
      ],
    };
    expect(run('2', pending)).toMatchObject({ type: 'complete_item', target: { id: 'b' } });
  });
  it('saludo y ayuda', () => {
    expect(run('Hola').type).toBe('reply');
    expect(run('¿Qué puedes hacer?').type).toBe('reply');
  });
});
