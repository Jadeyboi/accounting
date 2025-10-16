declare module "jspdf" {
  const jsPDF: any;
  export default jsPDF;
}

declare module "html2canvas" {
  const html2canvas: any;
  export default html2canvas;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_UPLOAD_PROXY_URL?: string;
  // add other env vars here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
