import { ChangeDetectorRef, Component, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Auth } from '../auth/auth';
import { RepDirectoryStore } from '../rep-directory-store/rep-directory-store';
import { RepProfileStore } from '../rep-profile-store/rep-profile-store';
import { Toast } from '../toast/toast';

@Component({
  selector: 'app-rep-links',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './rep-links.html',
  styleUrl: './rep-links.scss',
})
export class RepLinks {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly directory = inject(RepDirectoryStore);
  private readonly repProfileStore = inject(RepProfileStore);
  private readonly toast = inject(Toast);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = this.fb.nonNullable.group({
    googleLink: [''],
    resourceLink: [''],
  });

  constructor() {
  
    effect(() => {
      const profile = this.repProfileStore.profile();
      if (this.form.pristine) {
        this.form.patchValue({ googleLink: profile.googleLink, resourceLink: profile.resourceLink }, { emitEvent: false });
     
        this.cdr.detectChanges();
      }
    });
  }

  save(): void {
    const { googleLink, resourceLink } = this.form.getRawValue();
    const trimmedGoogleLink = googleLink.trim();
    const trimmedResourceLink = resourceLink.trim();

    const repId = Number(this.auth.session()?.repId);
    if (!repId) {
      this.toast.show('Failed to save links');
      return;
    }

    this.directory.updateLinksByRepId(repId, trimmedGoogleLink, trimmedResourceLink).subscribe({
      next: () => this.toast.show('Links saved'),
      error: () => this.toast.show('Failed to save links'),
    });
  }
}