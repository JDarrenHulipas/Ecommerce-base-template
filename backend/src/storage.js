// Almacenamiento de imágenes subidas por el panel admin.
//
// Dos modos:
//   - S3 (producción): si S3_BUCKET está definido, las imágenes se guardan en
//     el bucket y se sirven/borran desde ahí vía la API.
//   - Disco local (desarrollo/tests): si no hay S3_BUCKET, se usan UPLOAD_DIR.
//
// La URL pública es siempre /api/imagenes/<clave>, igual en ambos modos, así
// el frontend y la columna imagen_s3 no cambian.

const fs = require('fs');
const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const { s3Bucket, s3Region, s3Endpoint, uploadDir } = require('./config/env');

let cliente = null;

function getClienteS3() {
  if (!cliente) {
    cliente = new S3Client({
      region: s3Region,
      ...(s3Endpoint
        ? { endpoint: s3Endpoint, forcePathStyle: true }
        : {}),
    });
  }
  return cliente;
}

function usaS3() {
  return Boolean(s3Bucket);
}

async function subirImagen(clave, buffer, contentType) {
  if (usaS3()) {
    await getClienteS3().send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: clave,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return;
  }
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, clave), buffer);
}

// Devuelve true si el objeto existía (y se borró), false si no existía.
async function borrarImagen(clave) {
  if (usaS3()) {
    try {
      await getClienteS3().send(
        new HeadObjectCommand({ Bucket: s3Bucket, Key: clave })
      );
    } catch {
      return false;
    }
    await getClienteS3().send(
      new DeleteObjectCommand({ Bucket: s3Bucket, Key: clave })
    );
    return true;
  }
  try {
    fs.unlinkSync(path.join(uploadDir, clave));
    return true;
  } catch {
    return false;
  }
}

// Middleware para servir /api/imagenes/<clave> desde S3.
// Si no hay S3 configurado, pasa al siguiente (express.static local lo sirve).
async function servirImagen(req, res, next) {
  if (!usaS3()) return next();
  const clave = String(req.path).replace(/^\/+/, '');
  if (!clave) return next();
  try {
    const objeto = await getClienteS3().send(
      new GetObjectCommand({ Bucket: s3Bucket, Key: clave })
    );
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Content-Type', objeto.ContentType || 'application/octet-stream');
    objeto.Body.pipe(res);
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NoSuchKey') {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    next(err);
  }
}

module.exports = { usaS3, subirImagen, borrarImagen, servirImagen };
