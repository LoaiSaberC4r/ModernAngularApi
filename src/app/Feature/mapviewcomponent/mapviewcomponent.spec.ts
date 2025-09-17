import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Mapviewcomponent } from './mapviewcomponent';

describe('Mapviewcomponent', () => {
  let component: Mapviewcomponent;
  let fixture: ComponentFixture<Mapviewcomponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mapviewcomponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Mapviewcomponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
