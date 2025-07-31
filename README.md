# File Uploader

This is a monorepo for simplifying local tests

## Project Setup

## Project Test

## Implementation Notes

### Calculating the upload progress

I have used chunk upload data and the current uploading chunk to calculate the upload progress, this enables resuming the progress on page refresh as well as lacks the need to poll the backend constantly for the progress date.

## Assumptions and limitations

- To keep the dependencies minimal, a simple hashing is used for fileId generation which is not collision proof.
- CORS is enabled for \* for the sake of simplicity
-
