import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ResourceDialog } from './resource-dialog';

describe('ResourceDialog', () => {
  let component: ResourceDialog;
  let fixture: ComponentFixture<ResourceDialog>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  async function setup(data: { resource?: unknown } = {}) {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ResourceDialog],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResourceDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  it('should create in "add" mode with an empty form', async () => {
    await setup();
    expect(component.isEditing).toBe(false);
    expect(component.dialogTitle()).toBe('Add resource');
  });

  it('pre-fills the form and reports "edit" mode when a resource is passed', async () => {
    await setup({
      resource: {
        id: '1', title: 'Existing', category: 'Cat', type: 'pdf', duration: '', featured: true, description: '', url: 'https://a',
      },
    });
    expect(component.isEditing).toBe(true);
    expect(component.dialogTitle()).toBe('Edit resource');
    expect(component.form.getRawValue().title).toBe('Existing');
    expect(component.form.getRawValue().featured).toBe('yes');
  });

  it('submit() flags missing required fields and does not close', async () => {
    await setup();
    component.submit();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.missingRequiredFields()).toEqual({ title: true, category: true, url: true });
  });

  it('submit() closes with the payload when valid', async () => {
    await setup();
    component.form.setValue({
      title: 'New', category: 'Cat', type: 'doc', duration: '', featured: 'no', url: 'https://a', description: '',
    });
    component.submit();
    expect(dialogRef.close).toHaveBeenCalledWith({
      title: 'New', category: 'Cat', type: 'doc', duration: '', featured: false, url: 'https://a', description: '',
    });
  });

  it('cancel() closes with undefined', async () => {
    await setup();
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
