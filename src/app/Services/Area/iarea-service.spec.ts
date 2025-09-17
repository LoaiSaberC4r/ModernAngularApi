import { TestBed } from '@angular/core/testing';

import { IAreaService } from './iarea-service';

describe('IAreaService', () => {
  let service: IAreaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IAreaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
