"use client";

import { useState, useEffect, useCallback } from "react";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface GoogleArtifact {
  id: string;
  title: string;
  lastModified: string;
  owner: string;
  url: string;
  source: "google-docs" | "gmail" | "spreadsheet" | "drive";
  mimeType?: string;
}

type ArtifactFilter = "all" | "google-docs" | "gmail" | "spreadsheet" | "drive";

// ──────────────────────────────────────────────
// Token
// ──────────────────────────────────────────────

export function getGoogleToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("google_access_token");
}

// ──────────────────────────────────────────────
// Google Docs
// ──────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  owners?: { displayName: string }[];
  webViewLink: string;
  mimeType: string;
}

export async function fetchGoogleDocs(): Promise<GoogleArtifact[]> {
  try {
    const token = getGoogleToken();
    if (!token) return [];

    const query = encodeURIComponent("mimeType='application/vnd.google-apps.document'");
    const fields = encodeURIComponent("files(id,name,modifiedTime,owners,webViewLink,mimeType)");
    const url =
      `https://www.googleapis.com/drive/v3/files` +
      `?q=${query}` +
      `&orderBy=modifiedTime%20desc` +
      `&pageSize=10` +
      `&fields=${fields}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];

    const data: { files: DriveFile[] } = await res.json();

    return data.files.map((file) => ({
      id: file.id,
      title: file.name,
      lastModified: file.modifiedTime,
      owner: file.owners?.[0]?.displayName ?? "Unknown",
      url: file.webViewLink,
      source: "google-docs" as const,
      mimeType: file.mimeType,
    }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// Gmail
// ──────────────────────────────────────────────

interface GmailMessageRef {
  id: string;
  threadId: string;
}

interface GmailMessageMeta {
  id: string;
  payload: {
    headers: { name: string; value: string }[];
  };
}

function extractHeader(msg: GmailMessageMeta, name: string): string {
  return msg.payload.headers.find((h) => h.name === name)?.value ?? "";
}

export async function fetchGmailMessages(): Promise<GoogleArtifact[]> {
  try {
    const token = getGoogleToken();
    if (!token) return [];

    const listRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=10",
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listRes.ok) return [];

    const listData: { messages?: GmailMessageRef[] } = await listRes.json();
    if (!listData.messages?.length) return [];

    const messages = await Promise.all(
      listData.messages.map(async (ref) => {
        const res = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${ref.id}` +
            `?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return null;
        return res.json() as Promise<GmailMessageMeta>;
      })
    );

    return messages
      .filter((msg): msg is GmailMessageMeta => msg !== null)
      .map((msg) => ({
        id: msg.id,
        title: extractHeader(msg, "Subject") || "(no subject)",
        lastModified: extractHeader(msg, "Date"),
        owner: extractHeader(msg, "From"),
        url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
        source: "gmail" as const,
      }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// Drive Files (all types)
// ──────────────────────────────────────────────

function mimeToSource(mimeType: string): GoogleArtifact["source"] {
  if (mimeType === "application/vnd.google-apps.document") return "google-docs";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "spreadsheet";
  if (mimeType.includes("email") || mimeType.includes("rfc822")) return "gmail";
  return "drive";
}

export async function fetchDriveFiles(): Promise<GoogleArtifact[]> {
  try {
    const token = getGoogleToken();
    if (!token) return [];

    const fields = encodeURIComponent("files(id,name,modifiedTime,owners,webViewLink,mimeType)");
    const url =
      `https://www.googleapis.com/drive/v3/files` +
      `?orderBy=modifiedTime%20desc` +
      `&pageSize=10` +
      `&fields=${fields}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];

    const data: { files: DriveFile[] } = await res.json();

    return data.files.map((file) => ({
      id: file.id,
      title: file.name,
      lastModified: file.modifiedTime,
      owner: file.owners?.[0]?.displayName ?? "Unknown",
      url: file.webViewLink,
      source: mimeToSource(file.mimeType),
      mimeType: file.mimeType,
    }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// Aggregate
// ──────────────────────────────────────────────

export async function fetchAllGoogleArtifacts(): Promise<GoogleArtifact[]> {
  const [docs, emails, drive] = await Promise.all([
    fetchGoogleDocs(),
    fetchGmailMessages(),
    fetchDriveFiles(),
  ]);

  const merged = [...docs, ...emails, ...drive];

  // Dedupe by id, keeping the first occurrence
  const seen = new Set<string>();
  const unique = merged.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Sort by lastModified descending
  return unique.sort(
    (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  );
}

// ──────────────────────────────────────────────
// React Hook
// ──────────────────────────────────────────────

interface UseGoogleArtifactsReturn {
  artifacts: GoogleArtifact[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGoogleArtifacts(filter: ArtifactFilter = "all"): UseGoogleArtifactsReturn {
  const [artifacts, setArtifacts] = useState<GoogleArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const all = await fetchAllGoogleArtifacts();
        if (cancelled) return;

        const filtered = filter === "all" ? all : all.filter((a) => a.source === filter);
        setArtifacts(filtered);
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filter, refreshKey]);

  return { artifacts, loading, error, refetch };
}
