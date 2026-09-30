// Credencial del alumno (tamaño tarjeta de crédito, 85,6 × 54 mm). La usan la
// hoja de impresión por curso y el botón QR de cada alumno, así salen iguales.
export const ESTILOS_CREDENCIAL = `
  .cred { width: 85.6mm; height: 54mm; box-sizing: border-box; border: 0.3mm dashed #C9D0CB; border-radius: 3.5mm;
          background: #FFFFFF; color: #16211D; padding: 4mm; display: grid; grid-template-columns: 1fr 34mm; gap: 3mm;
          break-inside: avoid; page-break-inside: avoid; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .cred-datos { display: flex; flex-direction: column; min-width: 0; }
  .cred-colegio { display: flex; align-items: center; gap: 2mm; font-size: 2.6mm; font-weight: 700; color: #1D5C47; text-transform: uppercase; letter-spacing: .2mm; }
  .cred-colegio img { width: 6mm; height: 6mm; object-fit: contain; }
  .cred-nombre { margin-top: auto; font-size: 4.6mm; font-weight: 800; line-height: 1.15; overflow-wrap: anywhere; }
  .cred-curso { font-size: 3.2mm; color: #5B6660; margin-top: 1mm; }
  .cred-pie { margin-top: auto; font-size: 2.2mm; color: #6B7670; }
  .cred-qr { width: 34mm; height: 34mm; align-self: center; image-rendering: pixelated; }
`

export default function Credencial({ credencial, colegio, logo }) {
  return (
    <div className="cred">
      <div className="cred-datos">
        <div className="cred-colegio">
          {logo && <img src={logo} alt="" />}
          <span>{colegio || 'KoleTap'}</span>
        </div>
        <div className="cred-nombre">{credencial.nombre}</div>
        <div className="cred-curso">{credencial.curso}</div>
        <div className="cred-pie">Credencial KoleTap · personal e intransferible</div>
      </div>
      <img className="cred-qr" src={credencial.qr_img} alt={`QR de ${credencial.nombre}`} />
    </div>
  )
}
