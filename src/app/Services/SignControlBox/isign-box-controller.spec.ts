import { TestBed } from '@angular/core/testing';

import { ISignBoxControlService } from './isign-box-controlService';

describe('ISignBoxController', () => {
  let service: ISignBoxControlService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ISignBoxControlService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
