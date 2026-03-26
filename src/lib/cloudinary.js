const cloudinary = require('cloudinary').v2;

// CLOUDINARY_URL (formato cloudinary://key:secret@cloud) é lida automaticamente pelo SDK.
// Variáveis separadas servem como fallback.
if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

module.exports = cloudinary;
