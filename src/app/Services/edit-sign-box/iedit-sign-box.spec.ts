import { TestBed } from '@angular/core/testing';

import { IeditSignBox } from './iedit-sign-box';

describe('IeditSignBox', () => {
  let service: IeditSignBox;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IeditSignBox);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
