import 'server-only'
import { v2 as cloudinary } from 'cloudinary'

// Se configura sola con la variable CLOUDINARY_URL (cloudinary://key:secret@cloud).
cloudinary.config({ secure: true })

export async function uploadImage(file: File, folder: string): Promise<{ url: string; publicId: string }> {
  const buffer = Buffer.from(await file.arrayBuffer())
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: 'image' }, (err, res) => {
        if (err || !res) return reject(err ?? new Error('Cloudinary no devolvió resultado'))
        resolve({ url: res.secure_url, publicId: res.public_id })
      })
      .end(buffer)
  })
}

export async function deleteImages(publicIds: string[]): Promise<void> {
  if (publicIds.length === 0) return
  await cloudinary.api.delete_resources(publicIds, { resource_type: 'image' })
}
