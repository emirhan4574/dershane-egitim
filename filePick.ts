import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { HomeworkAttachment, ChatAttachment } from './types';

export async function pickAnyFile(): Promise<{
  uri: string;
  name: string;
  mimeType?: string;
} | null> {
  const res = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: '*/*',
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  return {
    uri: asset.uri,
    name: asset.name || 'belge',
    mimeType: asset.mimeType,
  };
}

export async function pickImage(): Promise<{
  uri: string;
  name: string;
} | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName || 'gorsel.jpg',
  };
}

export function toHomeworkAttachment(
  file: { uri: string; name: string; mimeType?: string },
  asLink = false
): HomeworkAttachment {
  if (asLink) return { type: 'link', label: file.name, uri: file.uri };
  const mime = (file.mimeType || '').toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.includes('image') || /\.(png|jpe?g|webp|gif)$/.test(name)) {
    return { type: 'image', label: file.name, uri: file.uri };
  }
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return { type: 'pdf', label: file.name, uri: file.uri };
  }
  if (mime.includes('video') || /\.(mp4|mov|webm)$/.test(name)) {
    return { type: 'video', label: file.name, uri: file.uri };
  }
  return { type: 'file', label: file.name, uri: file.uri };
}

export function toChatAttachment(file: {
  uri: string;
  name: string;
  mimeType?: string;
}): ChatAttachment {
  const hw = toHomeworkAttachment(file);
  return {
    type: hw.type === 'video' ? 'file' : hw.type === 'file' ? 'file' : hw.type,
    label: hw.label,
    uri: hw.uri,
  };
}
