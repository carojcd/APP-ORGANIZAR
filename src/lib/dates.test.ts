import { describe, expect, it } from 'vitest';
import { addDays, endOfMonth, startOfWeek, toInstant, todayKey, weekday } from './dates';
import { formatCOP, formatDate, formatTime } from './format';

describe('fechas en America/Bogota', () => {
  it('hoy usa la zona de Bogotá, no la del dispositivo', () => {
    // 2026-11-21 03:00 UTC = 2026-11-20 22:00 en Bogotá.
    expect(todayKey(new Date('2026-11-21T03:00:00Z'))).toBe('2026-11-20');
  });
  it('aritmética de fechas', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
    expect(weekday('2026-11-20')).toBe(5);
  });
  it('fecha + hora local a instante', () => {
    expect(toInstant('2026-11-20', '09:00').toISOString()).toBe('2026-11-20T14:00:00.000Z');
  });
});

describe('formatos regionales', () => {
  it('DD/MM/AAAA', () => expect(formatDate('2026-03-05')).toBe('05/03/2026'));
  it('12 h', () => {
    expect(formatTime('00:15')).toBe('12:15 a. m.');
    expect(formatTime('15:00')).toBe('3:00 p. m.');
  });
  it('COP sin decimales', () => expect(formatCOP(350000)).toMatch(/\$\s?350\.000/));
});
