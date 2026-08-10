import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TrainingResourceType } from '../training-resource-store/training-resource-store';

export interface MediaViewerDialogData {
  title: string;
  type: TrainingResourceType;
  /** Object URL (`URL.createObjectURL`) for the fetched blob — owned by the caller, which revokes it once this dialog closes. */
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

  download(): void {
    const a = document.createElement('a');
    a.href = this.data.url;
    a.download = this.data.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
