import * as DocumentPicker from "expo-document-picker";

/**
 * Lets a learner upload their own notes/textbook excerpt/PDF and teach
 * *that* material back to the Feynman mentor, instead of only the six
 * fixed FEYNMAN_TOPICS in chat.tsx. Two steps: pick a file on-device, then
 * hand it to the backend to extract plain text (PDF parsing has no good
 * pure-JS/React-Native story, so this always goes through the server).
 */

const ALLOWED_MIME_TYPES = ["application/pdf", "text/plain", "text/markdown"];

// Keep this comfortably under typical serverless-function body limits (the
// backend enforces the real limit too — see feynman.ts's multer config —
// this is just to fail fast on-device before spending a round trip).
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export async function pickStudyDocument(): Promise<PickedDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_MIME_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_UPLOAD_BYTES) {
    throw new Error("That file is too large — keep it under 8MB.");
  }
  return {
    uri: asset.uri,
    name: asset.name ?? "document",
    mimeType: asset.mimeType ?? "application/octet-stream",
    size: asset.size,
  };
}

export interface ExtractedDocument {
  name: string;
  text: string;
  truncated: boolean;
}

export async function extractDocumentText({
  baseUrl,
  token,
  doc,
}: {
  baseUrl: string;
  token: string | null;
  doc: PickedDocument;
}): Promise<ExtractedDocument> {
  if (!baseUrl) {
    throw new Error("Upload isn't available in this environment.");
  }

  const form = new FormData();
  // React Native's fetch/FormData accepts this {uri, name, type} shape in
  // place of a real Blob/File — this is the standard RN upload pattern.
  form.append("file", {
    uri: doc.uri,
    name: doc.name,
    type: doc.mimeType,
  } as unknown as Blob);

  const res = await fetch(`${baseUrl}/api/feynman/extract-text`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Deliberately no Content-Type — fetch/RN sets the multipart
      // boundary itself; setting it by hand here breaks the upload.
    },
    body: form,
  });

  const data = (await res.json().catch(() => ({}))) as {
    text?: string;
    truncated?: boolean;
    error?: string;
  };
  if (!res.ok || !data.text) {
    throw new Error(data.error ?? "Couldn't read that file. Try a different one.");
  }
  return { name: doc.name, text: data.text, truncated: Boolean(data.truncated) };
}
