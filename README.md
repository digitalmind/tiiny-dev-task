# Tiny Host - Resumable File Uploader

A robust file upload system with resumable uploads, pause/resume functionality, and AWS S3 integration. Built with React frontend and Node.js backend.

## Features

- **Resumable Uploads**: Resume interrupted uploads from where they left off
- **Pause/Resume**: Manual pause and resume during upload
- **Chunk-based Upload**: Large files split into manageable chunks
- **S3 Integration**: Direct upload to AWS S3 or DigitalOcean Spaces
- **Progress Tracking**: Real-time upload progress with chunk-level details
- **Error Handling**: Comprehensive error handling with retry logic
- **Network Resilience**: Handles network interruptions gracefully
- **Processing State**: File assembly progress indication

## Architecture

### Frontend (React)

- **Chunking Strategy**: 1MB chunks for optimal balance of performance and reliability
- **State Management**: React hooks with localStorage persistence
- **Progress Calculation**: Client-side progress tracking using chunk metadata
- **Error Recovery**: Exponential backoff retry logic for network failures

### Backend (Node.js + Express)

- **S3 Integration**: AWS SDK v3 for cloud storage
- **Chunk Assembly**: Server-side file reconstruction from chunks
- **Metadata Management**: S3-based metadata storage for upload state
- **Cleanup**: Automatic cleanup of temporary chunks after assembly

## Implementation Decisions

### 1. Chunking Strategy

**Decision**: 1MB chunks

- **Pros**: Good balance between memory usage and network efficiency
- **Cons**: More HTTP requests for large files
- **Alternative Considered**: 5MB chunks (too large for unreliable networks)

**Chunk Upload Flow**:

```
File → Split into 1MB chunks → Upload chunks individually → Server assembles → S3 storage
```

### 2. localStorage Usage for Upload Metadata

**Decision**: Client-side metadata storage

- **Stores**: File ID, chunk progress, file details, timestamps
- **Benefits**:
  - No server polling needed for progress
  - Immediate resume capability
  - Works offline for progress tracking
- **Limitations**:
  - Browser storage limits (5-10MB)
  - Lost on browser data clear
  - Per-domain isolation

**Metadata Structure**:

```javascript
{
  fileId: "file-1234567890",
  fileName: "document.pdf",
  totalSize: 5242880,
  totalChunks: 5,
  uploadedChunks: [0, 1, 2],
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

### 3. File Selection on Resume

**Problem**: Browser security limitations prevent automatic file access

- **Browser Limitation**: Cannot access file objects after page refresh
- **Security Model**: File objects are not serializable to localStorage
- **User Experience**: User must re-select the same file to resume

**Implementation**:

```javascript
// File verification on resume
const isResumable = (file) => {
  const fileId = generateFileId(file);
  const metadata = localStorage.getItem(`upload-${fileId}`);
  return (
    metadata &&
    file.name === metadata.fileName &&
    file.size === metadata.totalSize &&
    file.lastModified === metadata.lastModified
  );
};
```

### 4. Retry Logic

**Strategy**: Exponential backoff for network errors

- **Max Retries**: 5 attempts
- **Base Delay**: 1 second, doubles each retry
- **Retryable Errors**: Network timeouts, connection failures
- **Non-Retryable**: Server errors (5xx), user aborts

```javascript
const uploadChunk = async (chunk, chunkIndex, retryCount = 0) => {
  const MAX_RETRIES = 5;
  const BASE_DELAY = 1000;

  // Exponential backoff
  const delay = BASE_DELAY * Math.pow(2, retryCount);

  if (retryCount >= MAX_RETRIES) {
    throw new Error("Max retries exceeded");
  }

  // Retry logic...
};
```

### 5. S3 Integration

**Decision**: AWS SDK v3 with optional endpoint

- **Flexibility**: Works with AWS S3 and DigitalOcean Spaces
- **Endpoint Configuration**: Optional S3_ENDPOINT for custom providers
- **Error Handling**: Proper handling of NoSuchKey errors for metadata

**Environment Variables**:

```bash
# Required
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name

# Optional
S3_ENDPOINT=https://ams3.digitaloceanspaces.com  # For DigitalOcean
AWS_REGION=us-east-1
```

### 6. Progress Calculation

**Strategy**: Client-side calculation from chunk metadata

- **Benefits**: No server polling, immediate updates
- **Calculation**: Sum of completed chunks + current chunk progress
- **Persistence**: Survives page refreshes

```javascript
const calculateProgress = (uploadedChunks, currentChunkProgress) => {
  const completedBytes = uploadedChunks.reduce(
    (sum, chunkIndex) => sum + fileChunks[chunkIndex].size,
    0
  );
  const currentBytes = currentChunkProgress || 0;
  return ((completedBytes + currentBytes) / totalBytes) * 100;
};
```

## Browser Limitations and Workarounds

### 1. File Object Serialization

- **Limitation**: File objects cannot be stored in localStorage
- **Workaround**: Store file metadata (name, size, lastModified) for verification
- **Impact**: User must re-select file after page refresh

### 2. XMLHttpRequest for Progress

- **Decision**: XHR over Fetch API for upload progress
- **Reason**: Fetch API doesn't support upload progress events
- **Benefits**: Real-time progress tracking and abort capability

### 3. Memory Management

- **Challenge**: Large files can consume significant memory
- **Solution**: Stream processing with 1MB chunks
- **Benefit**: Predictable memory usage regardless of file size

### 4. Network Resilience

- **Challenge**: Unreliable networks can interrupt uploads
- **Solution**: Chunk-level retry with exponential backoff
- **Result**: Robust uploads even on poor connections

## Error Handling Strategy

### 1. Network Errors

- **Detection**: Timeout, connection failure, network unavailable
- **Action**: Automatic retry with exponential backoff
- **Fallback**: Manual resume after max retries

### 2. Server Errors

- **Detection**: 5xx status codes
- **Action**: Immediate stop (no retry)
- **Reason**: Server issues won't resolve with retries

### 3. User Aborts

- **Detection**: Manual pause or page navigation
- **Action**: Clean abort, preserve progress
- **Benefit**: Can resume from exact point

### 4. File Assembly Errors

- **Detection**: Assembly endpoint failures
- **Action**: Clear error message with retry option
- **Recovery**: Manual retry or start over

## Performance Considerations

### 1. Chunk Size Optimization

- **1MB chunks**: Optimal for most use cases
- **Memory usage**: ~1MB per chunk in memory
- **Network efficiency**: Good balance of overhead vs. reliability

### 2. S3 Operations

- **Parallel uploads**: Chunks uploaded sequentially for simplicity
- **Assembly**: Server-side assembly to reduce client complexity
- **Cleanup**: Automatic cleanup of temporary chunks

### 3. UI Responsiveness

- **Progress updates**: Real-time without blocking UI
- **State management**: Efficient React state updates
- **Error handling**: Non-blocking error recovery

## Security Considerations

### 1. File Validation

- **Client-side**: Basic file size and type checks
- **Server-side**: Multer validation for uploaded chunks
- **Recommendation**: Add server-side file type validation

### 2. CORS Configuration

- **Current**: Open CORS for development
- **Production**: Restrict to specific origins

### 3. S3 Access

- **IAM**: Minimal required permissions
- **Bucket policy**: Restrict access to specific paths
- **Recommendation**: Use presigned URLs for direct upload

## Future Improvements

### 1. Direct S3 Upload

- **Current**: Server as proxy
- **Future**: Presigned URLs for direct client-to-S3 upload
- **Benefits**: Reduced server load, better scalability

### 2. Parallel Chunk Uploads

- **Current**: Sequential uploads
- **Future**: Parallel chunk uploads with concurrency control
- **Benefits**: Faster uploads for large files

### 3. File Type Validation

- **Current**: Basic validation
- **Future**: Comprehensive file type checking
- **Benefits**: Better security and user experience

## Setup Instructions

### 1. Environment Variables

```bash
# Backend (.env)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
AWS_REGION=us-east-1
S3_ENDPOINT=https://ams3.digitaloceanspaces.com  # Optional
```

### 2. Installation

```bash
# Install dependencies
pnpm install

# create .env in apps/backend with you AWS S3 credentials (check .env.example)

# Start apps
pnpm dev
```

### 3. S3 Bucket Setup

- Create S3 bucket or DigitalOcean Space
- Configure CORS for your domain
- Set up IAM permissions for upload/delete operations

## Assumptions and Limitations

### 1. File ID Generation

- **Current**: Simple hash-based generation
- **Limitation**: Not collision-proof for very large scale
- **Alternative**: UUID-based generation for production

### 2. Browser Compatibility

- **Supported**: Modern browsers with ES6+ support
- **Limitation**: No IE11 support
- **Alternative**: Polyfills for older browsers

### 3. File Size Limits

- **Client-side**: Browser memory limitations
- **Server-side**: S3 object size limits (5TB)
- **Recommendation**: Add file size validation

### 4. Concurrent Uploads

- **Current**: Single file upload at a time
- **Limitation**: No concurrent upload support
- **Future**: Multi-file upload queue

## Testing Considerations

### 1. Network Simulation

- Test with slow network conditions
- Verify retry logic with network failures
- Test sleep/wake scenarios

### 2. File Types

- Test with various file types and sizes
- Verify chunk assembly correctness
- Test with very large files

### 3. Browser Compatibility

- Test across different browsers
- Verify localStorage behavior
- Test with different network conditions
