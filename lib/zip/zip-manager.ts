import JSZip from 'jszip';
import { ExportResult } from '../export/export.models.js';
import { Logger, getDefaultLogger } from '../core/index.js';
import { ZipContext } from './zip.models.js';
import { zipTransformer } from './zip-transformer.js';
import { zipPackager } from './zip-packager.js';

export function zipManager(logger?: Logger, zipContext?: ZipContext) {
    const loggerToUse = logger ?? getDefaultLogger(zipContext);

    const createZipAsync = async (exportData: ExportResult) => {
        loggerToUse.log({
            type: 'info',
            message: `Creating zip package`
        });

        return await zipTransformer(zipPackager(new JSZip()), loggerToUse).transformAsync(exportData);
    };

    const parseZipAsync = async (zipFile: Buffer) => {
        loggerToUse.log({
            type: 'info',
            message: `Parsing zip file`
        });

        const zipPackage = zipPackager(await JSZip.loadAsync(zipFile, {}));
        return await zipTransformer(zipPackage, loggerToUse).parseAsync();
    };

    return {
        createZipAsync,
        parseZipAsync
    };
}
