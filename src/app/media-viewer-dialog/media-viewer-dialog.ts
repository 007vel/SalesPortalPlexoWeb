import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TrainingResourceType } from '../training-resource-store/training-resource-store';

export interface MediaViewerDialogData {
  title: string;
  type: TrainingResourceType;
  /**
   * Either a blob object URL (`URL.createObjectURL`, owned by the caller, which revokes it once this
   * dialog closes) or, for videos, the raw range-enabled streaming URL — used directly as the <video>
   * src so playback can start without waiting for the whole file to download.
   */
  url: string;
  fileName: string;
}

@Component({
  selector: 'app-media-viewer-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './media-viewer-dialog.html',
  styleUrl: './media-viewer-dialog.scss',
})
export class MediaViewerDialog {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dialogRef = inject(MatDialogRef<MediaViewerDialog>);
  readonly data = inject<MediaViewerDialogData>(MAT_DIALOG_DATA);

  /** Only iframe (`pdf`) needs a resource-url trust bypass — img/video src accept blob: URLs directly. */
  readonly safeUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.data.url);

  close(): void {
    this.dialogRef.close();
  }

  /**
   * Fetches to a blob before saving rather than setting `<a download>` on `data.url` directly —
   * for video that url is a cross-origin stream URL, and the `download` attribute is ignored by
   * browsers on cross-origin links, so it wouldn't reliably force a save.
   */
  download(): void {
    fetch(this.data.url)
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = this.data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      });
  }
}
