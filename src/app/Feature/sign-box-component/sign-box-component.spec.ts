import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignBoxComponent } from './sign-box-component';

describe('SignBoxComponent', () => {
  let component: SignBoxComponent;
  let fixture: ComponentFixture<SignBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignBoxComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
