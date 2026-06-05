/**
 * upload.js — Cloudinary image upload middleware
 * Supports: dormitory images, room images, profile pictures
 * Uses multer + cloudinary-storage (streams directly to Cloudinary)
 */

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const dormitoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ktx-hust/dormitories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'fill', quality: 'auto:good' }],
  },
});

const roomStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ktx-hust/rooms',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 600, crop: 'fill', quality: 'auto:good' }],
  },
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ktx-hust/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto:good' }],
  },
});

const fileLimits = { fileSize: 5 * 1024 * 1024 }; // 5MB max

const uploadDormitory = multer({ storage: dormitoryStorage, limits: fileLimits });
const uploadRoom      = multer({ storage: roomStorage, limits: fileLimits });
const uploadAvatar    = multer({ storage: avatarStorage, limits: fileLimits });

module.exports = {
  cloudinary,
  uploadDormitory,
  uploadRoom,
  uploadAvatar,
};
