import { ResultError } from './Error';

export interface Result {
  isSuccess: boolean;
  isFailure: boolean;
  error: ResultError;
}
