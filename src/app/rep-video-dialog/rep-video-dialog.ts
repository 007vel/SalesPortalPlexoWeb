import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Auth } from '../auth/auth';
import { Toast } from '../toast/toast';
import { TrainingResourceStore, TrainingResourceType, detectFileKind } from '../training-resource-store/training-resource-store';

@Component({
  selector: 'app-rep-video-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
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
  readonly isVideo = computed(() => this.pendingFileKind() === 'video');
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
    this.pendingFileKind.set(detectFileKind(file.name));

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
          this.toast.show('Upload failed — try again');
        },
      });
  }
}
