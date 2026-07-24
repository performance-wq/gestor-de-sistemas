// Generador de archivos ZIP en el navegador, sin dependencias.
// Usa el método "store" (sin compresión): las imágenes/videos ya están
// comprimidos y así evitamos una librería externa. Suficiente para empaquetar
// las respuestas del onboarding y reutilizarlas con herramientas de IA.

interface Entrada {
  nombre: string; // ruta dentro del zip, ej. "imagenes/logo.png"
  datos: Uint8Array;
}

// Tabla CRC-32 (estándar IEEE 802.3), calculada una sola vez.
const CRC_TABLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Fecha/hora en formato MS-DOS que usa el ZIP.
function fechaDos(d = new Date()) {
  const time =
    (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date =
    ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xffff, date: date & 0xffff };
}

export function crearZip(archivos: Entrada[]): Blob {
  const codificador = new TextEncoder();
  const { time, date } = fechaDos();
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let offset = 0;

  for (const a of archivos) {
    const nombre = codificador.encode(a.nombre);
    const crc = crc32(a.datos);
    const tam = a.datos.length;

    // Cabecera local (30 bytes + nombre)
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // firma
    local.setUint16(4, 20, true); // versión
    local.setUint16(6, 0x0800, true); // flag: nombres en UTF-8
    local.setUint16(8, 0, true); // método: store
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, tam, true); // comprimido
    local.setUint32(22, tam, true); // sin comprimir
    local.setUint16(26, nombre.length, true);
    local.setUint16(28, 0, true); // extra
    locales.push(new Uint8Array(local.buffer), nombre, a.datos);

    // Cabecera central (46 bytes + nombre)
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, time, true);
    central.setUint16(14, date, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, tam, true);
    central.setUint32(24, tam, true);
    central.setUint16(28, nombre.length, true);
    central.setUint32(42, offset, true); // offset de la cabecera local
    centrales.push(new Uint8Array(central.buffer), nombre);

    offset += 30 + nombre.length + tam;
  }

  const tamCentral = centrales.reduce((s, b) => s + b.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, offset, true); // inicio del directorio central
  centrales.push(new Uint8Array(fin.buffer));

  // Concatenar todas las partes en un único buffer.
  const partes = [...locales, ...centrales];
  const total = partes.reduce((s, b) => s + b.length, 0);
  const salida = new Uint8Array(total);
  let pos = 0;
  for (const b of partes) {
    salida.set(b, pos);
    pos += b.length;
  }
  return new Blob([salida], { type: "application/zip" });
}
