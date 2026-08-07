import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import {
  ResourcePayload,
  TrainingResource,
  TrainingResourceStore,
  trainingResourceTypeIcon,
  trainingResourceTypeLabel,
} from '../training-resource-store/training-resource-store';
import { DocumentTemplateStore, DocTemplateKind } from '../document-template-store/document-template-store';
import { ResourceDialog } from '../resource-dialog/resource-dialog';
import { Toast } from '../toast/toast';

@Component({
  selector: 'app-admin-settings',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTableModule],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss',
})
export class AdminSettings {
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly trainingResourceStore = inject(TrainingResourceStore);
  private readonly documentTemplateStore = inject(DocumentTemplateStore);
  private readonly toast = inject(Toast);

  readonly resources = this.trainingResourceStore.resources;
  readonly templates = this.documentTemplateStore.templates;
  readonly typeIcon = trainingResourceTypeIcon;
  readonly typeLabel = trainingResourceTypeLabel;
  readonly displayedColumns = ['resource', 'category', 'type', 'featured', 'actions'];

  readonly hubLinkControl = this.fb.nonNullable.control(this.trainingResourceStore.sharedHubLink());

  saveHubLink(): void {
    const url = this.hubLinkControl.value.trim();
    this.trainingResourceStore.setSharedHubLink(url);
    this.toast.show(url ? 'Primary hub link updated' : 'Primary hub link cleared');
  }

  openResourceModal(resource?: TrainingResource): void {
    this.dialog
      .open(ResourceDialog, { data: { resource } })
      .afterClosed()
      .subscribe((payload: ResourcePayload | undefined) => {
        if (!payload) return;
        if (resource) {
          this.trainingResourceStore.updateResource(resource.id, payload);
          this.toast.show('Resource updated');
        } else {
          this.trainingResourceStore.addResource(payload);
          this.toast.show('Resource added to the hub');
        }
      });
  }

  // Admins are a more trusted actor than reps — delete here is immediate,
  // unlike the rep-side remove flow which confirms first.
  deleteResource(id: string): void {
    this.trainingResourceStore.remove(id).subscribe(() => this.toast.show('Resource removed'));
  }

  handleTemplateUpload(kind: DocTemplateKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.documentTemplateStore.replace(kind, file.name);
    this.toast.show('Template replaced');
    input.value = '';
  }
}