import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Toast } from './toast';

describe('Toast', () => {
  let toast: Toast;
  let snackBar: MatSnackBar;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    toast = TestBed.inject(Toast);
    snackBar = TestBed.inject(MatSnackBar);
  });

  it('should create', () => {
    expect(toast).toBeTruthy();
  });

  it('shows a message via MatSnackBar with the expected duration', () => {
    const openSpy = vi.spyOn(snackBar, 'open');
    toast.show('Copied plexopro.com/1234');
    expect(openSpy).toHaveBeenCalledWith('Copied plexopro.com/1234', undefined, { duration: 2600 });
  });
});
