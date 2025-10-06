import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwitcherLangComponent } from './switcher-lang-component';

describe('SwitcherLangComponent', () => {
  let component: SwitcherLangComponent;
  let fixture: ComponentFixture<SwitcherLangComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwitcherLangComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SwitcherLangComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
