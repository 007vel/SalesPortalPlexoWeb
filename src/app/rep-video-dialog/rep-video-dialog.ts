import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';
import { TrainingResourceStore } from '../training-resource-store/training-resource-store';

@Component({
  selector: 'app-rep-video-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './rep-video-dialog.html',
  styleUrl: './rep-video-dialog.scss',
})
export class RepVideoDialog {
  private readonly fb = inject(FormBuilder);
  private readonly repProfileStore = inject(RepProfileStore);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly dialogRef = inject(MatDialogRef<RepVideoDialog, boolean>);

  readonly pendingVideoFileName = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: [''],
    category: [''],
    duration: [''],
    url: [''],
    description: [''],
  });

  handleVideoFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.pendingVideoFileName.set(file.name);
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
    const { title, category, duration, url, description } = this.form.getRawValue();
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    const pendingFile = this.pendingVideoFileName();

    if (!trimmedTitle) {
      this.validationError.set('Give the video a title');
      return;
    }
    if (!trimmedUrl && !pendingFile) {
      this.validationError.set('Choose a file or paste a video link');
      return;
    }
    this.validationError.set(null);

    const repName = this.repProfileStore.profile().name;
    const addedBy = repName ? repName.split(' ')[0] : 'a rep';

    this.trainingResourceStore.addVideo({
      title: trimmedTitle,
      category: category.trim() || 'Team Uploads',
      duration: duration.trim(),
      description: description.trim() || (pendingFile ? `Uploaded file: ${pendingFile}` : 'Shared by a team member.'),
      url: trimmedUrl || `https://training.plexopro.com/uploads/${encodeURIComponent(pendingFile || trimmedTitle)}`,
      addedBy,
    });

    this.dialogRef.close(true);
  }
}
