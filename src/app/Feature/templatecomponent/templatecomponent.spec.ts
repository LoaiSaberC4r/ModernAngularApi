import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Templatecomponent } from './templatecomponent';

describe('Templatecomponent', () => {
  let component: Templatecomponent;
  let fixture: ComponentFixture<Templatecomponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Templatecomponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Templatecomponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
