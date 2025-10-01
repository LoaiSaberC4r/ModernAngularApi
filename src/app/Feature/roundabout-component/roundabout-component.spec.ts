import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoundaboutComponent } from './roundabout-component';

describe('RoundaboutComponent', () => {
  let component: RoundaboutComponent;
  let fixture: ComponentFixture<RoundaboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoundaboutComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoundaboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
