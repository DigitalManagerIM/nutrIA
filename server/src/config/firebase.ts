import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseBucket: any = null;

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

if (serviceAccountJson && storageBucket) {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket,
      });
    }
    firebaseBucket = admin.storage().bucket();
    console.log('[Firebase] Storage initialized ✅');
  } catch (e) {
    console.error('[Firebase] init error — falling back to local disk:', e);
  }
} else {
  console.log('[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_STORAGE_BUCKET not set — using local disk storage');
}

/**
 * Stores a file buffer either in Firebase Storage (production) or local disk (dev).
 * Returns the public URL (Firebase) or the local file path (dev).
 */
export async function storeFile(
  buffer: Buffer,
  mimetype: string,
  userId: string,
  filename: string
): Promise<string> {
  if (firebaseBucket) {
    const destination = `uploads/${userId}/${filename}`;
    const file = firebaseBucket.file(destination);
    await file.save(buffer, {
      metadata: { contentType: mimetype },
      public: true,
    });
    return `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${destination}`;
  }

  // Local disk fallback (dev mode)
  const dir = path.join(process.env.UPLOAD_DIR || './uploads', userId);
  fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

/**
 * Deletes a file from Firebase Storage (by its storage path, not full URL).
 * No-op if Firebase is not configured or file doesn't exist.
 */
export async function deleteStoredFile(storagePath: string): Promise<void> {
  if (!firebaseBucket) return;
  try {
    // Accept both full URL and relative path
    const destination = storagePath.includes('storage.googleapis.com')
      ? storagePath.split(`${process.env.FIREBASE_STORAGE_BUCKET}/`)[1]
      : storagePath;
    if (destination) await firebaseBucket.file(destination).delete();
  } catch {
    // Ignore if file doesn't exist
  }
}

export { firebaseBucket };
