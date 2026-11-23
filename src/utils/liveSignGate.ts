/**
 * Confirma palavras em frames enviados à API Python.
 * Não usa heurísticas do modo demonstração e não interpreta movimento.
 */
export class LiveSignGate {
  private candidate = '';
  private count = 0;
  private missed = 0;
  private lastEmitted = '';
  private lastAt = 0;

  constructor(
    private confirmations = 2,
    private confidenceMin = 0.72,
    private repeatDelayMs = 1200,
  ) {}

  push(label: string | null, confidence: number, now = Date.now()): string | null {
    const next = confidence >= this.confidenceMin ? (label || '').trim().toUpperCase() : '';
    if (!next || next === 'DESCONHECIDO') {
      this.candidate = '';
      this.count = 0;
      this.missed++;
      if (this.missed >= 2) this.lastEmitted = '';
      return null;
    }
    this.missed = 0;
    if (next !== this.candidate) {
      this.candidate = next;
      this.count = 1;
    } else {
      this.count++;
    }

    // Mudança de palavra libera imediatamente a nova palavra depois da confirmação.
    if (this.count < this.confirmations) return null;
    if (next === this.lastEmitted && now - this.lastAt < this.repeatDelayMs) return null;
    // A mesma configuração mantida não deve gerar palavras duplicadas;
    // para repetir o mesmo sinal, afaste as mãos da câmera por dois envios.
    if (next === this.lastEmitted) return null;
    this.lastEmitted = next;
    this.lastAt = now;
    return next;
  }

  reset() {
    this.candidate = '';
    this.count = 0;
    this.missed = 0;
    this.lastEmitted = '';
    this.lastAt = 0;
  }
}
