import JSZip from 'jszip';
import { ExportResult } from '../export/export.models.js';
import { Logger, getDefaultLogger } from '../core/index.js';
import { ZipPackage } from './zip-package.class.js';
import { ZipContext } from './zip.models.js';
import { zipTransformer } from './zip-transformer.js';

export function zipManager(logger?: Logger, zipContext?: ZipContext) {
    const loggerToUse = logger ?? getDefaultLogger(zipContext);

    const createZipAsync = async (exportData: ExportResult) => {
        loggerToUse.log({
            type: 'info',
            message: `Creating zip package`
        });

        return await zipTransformer(new ZipPackage(new JSZip(), loggerToUse, zipContext)).transformAsync(exportData);
    };

    const parseZipAsync = async (zipFile: Buffer) => {
        loggerToUse.log({
            type: 'info',
            message: `Parsing zip file`
        });

        const zipPackage = new ZipPackage(await JSZip.loadAsync(zipFile, {}), loggerToUse, zipContext);
        return await zipTransformer(zipPackage).parseAsync();
    };

    return {
        createZipAsync,
        parseZipAsync
    };
}
