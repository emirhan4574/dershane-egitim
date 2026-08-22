/** Belge türü yardımcıları (OCR artık kullanılmıyor; Gemini kullanılıyor). */

export function isImageFile(nameOrUri: string, mimeType?: string): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(nameOrUri);
}
