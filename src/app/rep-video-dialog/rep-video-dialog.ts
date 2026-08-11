import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../auth/auth';
import { Toast } from '../toast/toast';
import { TrainingResourceStore, TrainingResourceType, detectFileKind } from '../training-resource-store/training-resource-store';

@Component({
  selector: 'app-rep-video-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './rep-video-dialog.html',
  styleUrl: './rep-video-dialog.scss',
})
export class RepVideoDialog {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly toast = inject(Toast);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly dialogRef = inject(MatDialogRef<RepVideoDialog, boolean>);
  private readonly data = inject<{ mode?: 'admin' } | null>(MAT_DIALOG_DATA, { optional: true });

  readonly isAdminUpload = this.data?.mode === 'admin';

  private pendingFile: File | null = null;

  readonly pendingFileName = signal<string | null>(null);
  readonly pendingFileKind = signal<TrainingResourceType | null>(null);
  readonly pendingFileSize = signal<number | null>(null);
  readonly isVideo = computed(() => this.pendingFileKind() === 'video');
  readonly submitting = signal(false);
  readonly uploaded = signal(false);
  readonly dragActive = signal(false);

  /** Icon shown on the dropzone/file chip for each detected file kind. */
  private static readonly KIND_ICON: Record<TrainingResourceType, string> = {
    video: 'movie',
    image: 'image',
    pdf: 'picture_as_pdf',
    doc: 'description',
    link: 'link',
  };

  readonly pendingFileIcon = computed(() => {
    const kind = this.pendingFileKind();
    return kind ? RepVideoDialog.KIND_ICON[kind] : 'upload_file';
  });

  readonly pendingFileSizeLabel = computed(() => {
    const bytes = this.pendingFileSize();
    if (bytes === null) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  });

  /** How long the "Added!" confirmation stays up before the dialog closes. */
  private static readonly SUCCESS_DELAY_MS = 900;

  readonly form = this.fb.nonNullable.group({
    title: [''],
    category: [''],
    duration: [''],
    description: [''],
    language: ['English' as 'English' | 'Spanish'],
  });

  handleFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setFile(file);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(): void {
    this.dragActive.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setFile(file);
  }

  clearFile(event: Event): void {
    event.stopPropagation();
    this.pendingFile = null;
    this.pendingFileName.set(null);
    this.pendingFileKind.set(null);
    this.pendingFileSize.set(null);
  }

  private setFile(file: File): void {
    this.pendingFile = file;
    this.pendingFileName.set(file.name);
    this.pendingFileKind.set(detectFileKind(file.name));
    this.pendingFileSize.set(file.size);

    const titleControl = this.form.controls.title;
    if (!titleControl.value.trim()) {
      titleControl.setValue(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  submit(): void {
    const { title, category, duration, description, language } = this.form.getRawValue();
    const trimmedTitle = title.trim();
    const trimmedCategory = category.trim();
    const file = this.pendingFile;

    if (!trimmedTitle) {
      this.toast.show('Give it a title');
      return;
    }
    if (!trimmedCategory) {
      this.toast.show('Give it a category');
      return;
    }
    if (!file) {
      this.toast.show('Choose a file to upload');
      return;
    }

    let roleId: string | undefined;
    if (!this.isAdminUpload) {
      roleId = this.auth.session()?.repId;
      if (!roleId) {
        this.toast.show('You must be signed in to upload');
        return;
      }
    }

    this.submitting.set(true);
    this.trainingResourceStore
      .uploadDocument(
        {
          title: trimmedTitle,
          category: trimmedCategory,
          length: this.isVideo() ? duration.trim() : '',
          description: description.trim() || `Uploaded file: ${file.name}`,
          roleId,
          uploadedBy: this.isAdminUpload ? 'Admin' : 'Rep',
          language,
        },
        file,
      )
      .subscribe({
        next: () => {
          this.uploaded.set(true);
          setTimeout(() => this.dialogRef.close(true), RepVideoDialog.SUCCESS_DELAY_MS);
        },
        error: () => {
          this.submitting.set(false);
          this.toast.show('Upload failed — try again');
        },
      });
  }
}
