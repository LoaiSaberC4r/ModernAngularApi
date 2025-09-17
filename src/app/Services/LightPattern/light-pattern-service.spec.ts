import { TestBed } from '@angular/core/testing';

import { LightPatternService } from './light-pattern-service';

describe('LightPatternService', () => {
  let service: LightPatternService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LightPatternService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
