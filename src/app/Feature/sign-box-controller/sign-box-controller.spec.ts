import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignBoxController } from './sign-box-controller';

describe('SignBoxController', () => {
  let component: SignBoxController;
  let fixture: ComponentFixture<SignBoxController>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignBoxController]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignBoxController);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
