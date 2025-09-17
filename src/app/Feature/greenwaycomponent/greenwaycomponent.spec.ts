import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Greenwaycomponent } from './greenwaycomponent';

describe('Greenwaycomponent', () => {
  let component: Greenwaycomponent;
  let fixture: ComponentFixture<Greenwaycomponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Greenwaycomponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Greenwaycomponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
