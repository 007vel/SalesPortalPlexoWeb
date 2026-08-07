import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Auth } from '../auth/auth';
import { TrainingResourceStore } from '../training-resource-store/training-resource-store';

type UploadKind = 'video' | 'image' | 'pdf' | 'doc';

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];

function detectKind(fileName: string): UploadKind {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  return 'doc';
}

@Component({
  selector: 'app-rep-video-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './rep-video-dialog.html',
  styleUrl: './rep-video-dialog.scss',
})
export class RepVideoDialog {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly dialogRef = inject(MatDialogRef<RepVideoDialog, boolean>);

  private pendingFile: File | null = null;

  readonly pendingFileName = signal<string | null>(null);
  readonly pendingFileKind = signal<UploadKind | null>(null);
  readonly isVideo = computed(() => this.pendingFileKind() === 'video');
  readonly validationError = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    title: [''],
    category: [''],
    duration: [''],
    description: [''],
  });

  handleFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.pendingFile = file;
    this.pendingFileName.set(file.name);
    this.pendingFileKind.set(detectKind(file.name));

    const titleControl = this.form.controls.title;
    if (!titleControl.value.trim()) {
      titleControl.setValue(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    }
    input.value = '';
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  submit(): void {
    const { title, category, duration, description } = this.form.getRawValue();
    const trimmedTitle = title.trim();
    const file = this.pendingFile;

    if (!trimmedTitle) {
      this.validationError.set('Give it a title');
      return;
    }
    if (!file) {
      this.validationError.set('Choose a file to upload');
      return;
    }
    const repId = this.auth.session()?.repId;
    if (!repId) {
      this.validationError.set('You must be signed in to upload');
      return;
    }
    this.validationError.set(null);

    this.submitting.set(true);
    this.trainingResourceStore
      .uploadDocument(
        {
          title: trimmedTitle,
          category: category.trim() || 'Team Uploads',
          length: this.isVideo() ? duration.trim() : '',
          description: description.trim() || `Uploaded file: ${file.name}`,
          roleId: repId,
        },
        file,
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogRef.close(true);
        },
        error: () => {
          this.submitting.set(false);
          this.validationError.set('Upload failed — try again');
        },
      });
  }
}
