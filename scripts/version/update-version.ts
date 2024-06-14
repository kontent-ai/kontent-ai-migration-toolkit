import { createVersionFile } from './file-version-script.js';

createVersionFile(new Date(), './lib/metadata.ts', 'libMetadata');
