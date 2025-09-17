import { TestBed } from '@angular/core/testing';

import { IGovernateService } from './igovernate-service';

describe('IGovernateService', () => {
  let service: IGovernateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IGovernateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
