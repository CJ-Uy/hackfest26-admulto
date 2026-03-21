"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface UploadedFile {
  key: string;
  filename: string;
  size: number;
  status: "uploading" | "done" | "error";
}

interface PdfUploaderProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

export function PdfUploader({
  files,
  onFilesChange,
  disabled,
}: PdfUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newFiles = Array.from(fileList).filter(
        (f) => f.type === "application/pdf",
      );

      if (newFiles.length === 0) {
        toast.error("Please select PDF files only.");
        return;
      }

      // Add files in "uploading" state
      const pendingFiles: UploadedFile[] = newFiles.map((f) => ({
        key: "",
        filename: f.name,
        size: f.size,
        status: "uploading" as const,
      }));

      const allFiles = [...files, ...pendingFiles];
      onFilesChange(allFiles);

      // Upload
      const formData = new FormData();
      for (const f of newFiles) {
        formData.append("files", f);
      }

      try {
        const res = await fetch("/api/upload-pdfs", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error || "Upload failed");
        }

        const data = (await res.json()) as {
          uploads: { key: string; filename: string; size: number }[];
        };

        // Replace uploading files with completed ones
        const completedFiles = data.uploads.map((u) => ({
          ...u,
          status: "done" as const,
        }));

        const updatedFiles = files.concat(completedFiles);
        onFilesChange(updatedFiles);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Upload failed. Please try again.",
        );
        // Mark as error
        const errorFiles = allFiles.map((f) =>
          f.status === "uploading" ? { ...f, status: "error" as const } : f,
        );
        onFilesChange(errorFiles.filter((f) => f.status !== "error"));
      }
    },
    [files, onFilesChange],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) uploadFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function removeFile(index: number) {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-accent/50"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <Upload className="text-muted-foreground h-8 w-8" />
        <div>
          <p className="text-sm font-medium">
            Drop PDF files here or click to browse
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Max 10MB per file, 50MB total
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={`${file.filename}-${i}`}
              className="border-border bg-muted/30 flex items-center gap-3 rounded-lg border px-3 py-2"
            >
              {file.status === "uploading" ? (
                <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
              ) : file.status === "error" ? (
                <AlertCircle className="text-destructive h-4 w-4 shrink-0" />
              ) : (
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{file.filename}</p>
                <p className="text-muted-foreground text-xs">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
