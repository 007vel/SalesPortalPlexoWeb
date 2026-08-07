import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ResourcePayload, TrainingResource, TrainingResourceType } from '../training-resource-store/training-resource-store';

export interface ResourceDialogData {
  resource?: TrainingResource;
}

@Component({
  selector: 'app-resource-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './resource-dialog.html',
  styleUrl: './resource-dialog.scss',
})
export class ResourceDialog {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ResourceDialog, ResourcePayload | undefined>);
  private readonly data = inject<ResourceDialogData>(MAT_DIALOG_DATA);

  readonly isEditing = !!this.data.resource;
  readonly dialogTitle = computed(() => (this.isEditing ? 'Edit resource' : 'Add resource'));

  readonly missingRequiredFields = signal({ title: false, category: false, url: false });

  readonly form = this.fb.nonNullable.group({
    title: [this.data.resource?.title ?? ''],
    category: [this.data.resource?.category ?? ''],
    type: [this.data.resource?.type ?? ('video' as TrainingResourceType)],
    duration: [this.data.resource?.duration ?? ''],
    featured: [this.data.resource?.featured ? 'yes' : 'no'],
    url: [this.data.resource?.url ?? ''],
    description: [this.data.resource?.description ?? ''],
  });

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  submit(): void {
    const v = this.form.getRawValue();
    const title = v.title.trim();
    const category = v.category.trim();
    const url = v.url.trim();

    this.missingRequiredFields.set({ title: !title, category: !category, url: !url });
    if (!title || !category || !url) return;

    this.dialogRef.close({
      title,
      category,
      url,
      type: v.type,
      duration: v.duration.trim(),
      featured: v.featured === 'yes',
      description: v.description.trim(),
    });
  }
}
