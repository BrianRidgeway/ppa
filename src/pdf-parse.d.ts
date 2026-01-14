declare module 'pdf-parse' {
  function pdf(data: Buffer): Promise<any>;
  export = pdf;
}
