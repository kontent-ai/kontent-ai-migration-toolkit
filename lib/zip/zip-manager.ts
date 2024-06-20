import JSZip from 'jszip';
import { Logger, MigrationData, getDefaultLogger } from '../core/index.js';
import { zipTransformer } from './zip-transformer.js';
import { zipPackager } from './zip-packager.js';

export function zipManager(logger?: Logger) {
    const loggerToUse = logger ?? getDefaultLogger();

    const createZipAsync = async (migrationData: MigrationData) => {
        loggerToUse.log({
            type: 'info',
            message: `Creating zip package`
        });

        return await zipTransformer(zipPackager(new JSZip()), loggerToUse).transformAsync(migrationData);
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
