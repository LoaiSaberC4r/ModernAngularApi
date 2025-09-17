import { TestBed } from '@angular/core/testing';

import { ISignBoxController } from './isign-box-controller';

describe('ISignBoxController', () => {
  let service: ISignBoxController;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ISignBoxController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
