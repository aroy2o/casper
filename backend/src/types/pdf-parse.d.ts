declare module "pdf-parse" {
  const pdfParse: (data: Buffer | Uint8Array | ArrayBuffer) => Promise<{ text?: string }>;

  export default pdfParse;
}