import { ResultError } from './Error';

export interface ResultV<T> {
  value: T[] ;
  isSuccess: boolean;
  isFailure: boolean;
  error: ResultError;
}
