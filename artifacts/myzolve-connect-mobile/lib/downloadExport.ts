import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export type ExportLinks = {
  pdfUrl: string;
  csvUrl: string;
  year: number;
};

export async function downloadAndShareExport(links: ExportLinks): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.open(links.pdfUrl, "_blank");
      setTimeout(() => window.open(links.csvUrl, "_blank"), 250);
    }
    return;
  }

  const dir = `${FileSystem.cacheDirectory ?? ""}ledger-exports/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // already exists
  }

  const pdfPath = `${dir}year-of-care-${links.year}.pdf`;
  const csvPath = `${dir}year-of-care-${links.year}.csv`;

  const [pdfRes, csvRes] = await Promise.all([
    FileSystem.downloadAsync(links.pdfUrl, pdfPath).catch(() => null),
    FileSystem.downloadAsync(links.csvUrl, csvPath).catch(() => null),
  ]);

  const canShare = await Sharing.isAvailableAsync().catch(() => false);
  if (!canShare) return;

  if (pdfRes) {
    try {
      await Sharing.shareAsync(pdfPath, {
        mimeType: "application/pdf",
        dialogTitle: `Year of Care ${links.year} — PDF`,
      });
    } catch {
      // user dismissed or share failed
    }
  }
  if (csvRes) {
    try {
      await Sharing.shareAsync(csvPath, {
        mimeType: "text/csv",
        dialogTitle: `Year of Care ${links.year} — CSV`,
      });
    } catch {
      // user dismissed or share failed
    }
  }
}
