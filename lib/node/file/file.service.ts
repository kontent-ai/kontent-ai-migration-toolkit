import { yellow } from 'colors';
import { promises } from 'fs';
import { IFileServiceConfig } from './file.models';

export class FileService {
    constructor(public config: IFileServiceConfig) {}

    private readonly zipExtension: string = '.zip';

    async loadFileAsync(fileNameWithoutExtension: string): Promise<Buffer> {
        const filePath = this.getFilePath(fileNameWithoutExtension);

        console.log(`Reading file '${yellow(filePath)}'`);
        const file = await promises.readFile(filePath);
        console.log(`Reading file completed`);

        return file;
    }

    async writeFileAsync(fileNameWithoutExtension: string, content: any): Promise<void> {
        const filePath = this.getFilePath(fileNameWithoutExtension);

        await promises.writeFile(filePath, content);
        console.log(`File saved`);
    }

    private getFilePath(fileNameWithoutExtension: string) {
        const filenameWithExtension = fileNameWithoutExtension + this.zipExtension;
        return `./${filenameWithExtension}`;
    }
}
