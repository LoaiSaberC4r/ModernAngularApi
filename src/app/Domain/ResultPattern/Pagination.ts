import { ResultError } from './Error';
import { PaginateValue } from './PaginateValue';

export interface Pagination<T> {
  value: PaginateValue<T>;
  isSuccess: boolean;
  isFailure: boolean;
  error: ResultError;
}
