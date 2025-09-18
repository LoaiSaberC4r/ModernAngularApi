import { TestBed } from '@angular/core/testing';

import { ITemplateService } from './itemplate-service';

describe('ITemplateService', () => {
  let service: ITemplateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ITemplateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
