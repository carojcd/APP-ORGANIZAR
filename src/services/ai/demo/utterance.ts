/**
 * Texto del usuario con una versión "plegada" (minúsculas, sin tildes) de
 * IGUAL longitud que el original. Así los índices de una coincidencia sobre
 * el texto plegado sirven para recortar el original y conservar mayúsculas
 * en nombres propios ("Don Vitto").
 */
export function fold(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    let base = ch.normalize('NFD')[0]?.toLowerCase() ?? ch;
    if (base.length !== 1) base = ch;
    if ('¿?¡!;"“”()«»'.includes(base)) base = ' ';
    out += base;
  }
  return out;
}

export class Utterance {
  readonly original: string;
  readonly folded: string;
  private readonly consumed: boolean[];

  constructor(text: string) {
    this.original = text;
    this.folded = fold(text);
    this.consumed = new Array(text.length).fill(false);
  }

  /** Texto plegado con lo ya consumido reemplazado por espacios. */
  get masked(): string {
    let out = '';
    for (let i = 0; i < this.folded.length; i++) out += this.consumed[i] ? ' ' : this.folded[i];
    return out;
  }

  /** Busca un patrón sobre el texto aún no consumido. */
  match(re: RegExp): RegExpExecArray | null {
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    const regex = new RegExp(re.source, flags);
    return regex.exec(this.masked);
  }

  has(re: RegExp): boolean {
    return re.test(this.masked);
  }

  consume(start: number, end: number): void {
    for (let i = Math.max(0, start); i < Math.min(end, this.consumed.length); i++) this.consumed[i] = true;
  }

  consumeMatch(m: RegExpExecArray): void {
    this.consume(m.index, m.index + m[0].length);
  }

  /** Texto original sin las partes consumidas, con espacios normalizados. */
  remainder(): string {
    let out = '';
    for (let i = 0; i < this.original.length; i++) out += this.consumed[i] ? ' ' : this.original[i];
    return out.replace(/\s+/g, ' ').trim();
  }
}
