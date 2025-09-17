import { TestBed } from '@angular/core/testing';

import { ISignalrService } from './isignalr-service';

describe('ISignalrService', () => {
  let service: ISignalrService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ISignalrService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
