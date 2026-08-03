// types/carbone.d.ts
// Declaración mínima de tipos para Carbone (la librería no publica sus propios tipos).
declare module 'carbone' {
  interface CarboneOptions {
    convertTo?: string;
    lang?: string;
    timezone?: string;
    [key: string]: unknown;
  }

  type RenderCallback = (err: Error | null, result: Buffer | string) => void;

  interface Carbone {
    render(
      templatePath: string,
      data: unknown,
      options: CarboneOptions,
      callback: RenderCallback,
    ): void;
    render(templatePath: string, data: unknown, callback: RenderCallback): void;
    set(options: CarboneOptions): void;
  }

  const carbone: Carbone;
  export default carbone;
}
