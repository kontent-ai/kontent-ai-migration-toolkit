import { Buffer as BufferProxy } from 'buffer';
import JSZip from 'jszip';
import { Logger, MigrationData, getDefaultLogger } from '../core/index.js';
import { zipPackager } from './zip-packager.js';
import { zipTransformer } from './zip-transformer.js';
import { FileBinaryData } from './zip.models.js';

export function zipManager(logger?: Logger) {
    const loggerToUse = logger ?? getDefaultLogger();

    const createZipAsync = async (migrationData: MigrationData): Promise<FileBinaryData> => {
        loggerToUse.log({
            type: 'info',
            message: `Creating zip package`
        });

        return await zipTransformer(zipPackager(new JSZip()), loggerToUse).transformAsync(migrationData);
    };

    const parseZipAsync = async (zipFile: BufferProxy): Promise<MigrationData> => {
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
