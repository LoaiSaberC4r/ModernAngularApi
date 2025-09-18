import { TestBed } from '@angular/core/testing';

import { ITemplatePatternService } from './itemplate-pattern-service';

describe('ITemplatePatternService', () => {
  let service: ITemplatePatternService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ITemplatePatternService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
