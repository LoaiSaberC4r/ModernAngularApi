import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrafficPointConfigComponent } from './traffic-point-config-component';

describe('TrafficPointConfigComponent', () => {
  let component: TrafficPointConfigComponent;
  let fixture: ComponentFixture<TrafficPointConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrafficPointConfigComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrafficPointConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
