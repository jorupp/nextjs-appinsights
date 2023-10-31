export const SUCCESS = 'success';
export const FAILURE = 'failure';

export type DiagnosticResult = {
    name: string;
} & (
    | {
          status: typeof SUCCESS;
          result: string;
      }
    | {
          status: typeof FAILURE;
          errorMessage: string;
          errorString: string;
      }
);
