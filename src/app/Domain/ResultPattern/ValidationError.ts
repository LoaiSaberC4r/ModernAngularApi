import { ResultError } from './Error';

export interface ValidationError {
  errorMessages: string[];
  propertyNames: string[];
  error: ResultError;
  isSuccess: boolean;
  isFailure: boolean;
}

export interface ErrorType {
  error: ValidationError;
  headers: string;
  message: string;
  name: string;
  status: number;
  statusText: string;
  url: string;
  type: string;
}
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  traceId: string;
}
export interface ErrorProblemDetails
{
error: ProblemDetails;

}