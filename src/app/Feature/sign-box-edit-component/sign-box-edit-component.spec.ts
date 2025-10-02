import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignBoxEditComponent } from './sign-box-edit-component';

describe('SignBoxEditComponent', () => {
  let component: SignBoxEditComponent;
  let fixture: ComponentFixture<SignBoxEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignBoxEditComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignBoxEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
