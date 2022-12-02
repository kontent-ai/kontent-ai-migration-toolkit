import { yellow } from 'colors';
import { promises } from 'fs';
import { IFileServiceConfig } from './file.models';

export class FileService {
    constructor(public config: IFileServiceConfig) {}

    async loadFileAsync(filename: string): Promise<Buffer> {
        const filePath = this.getFilePath(filename);

        console.log(`Reading '${yellow(filePath)}'`);
        const file = await promises.readFile(filePath);

        return file;
    }

    async writeFileAsync(fileNameWithoutExtension: string, content: any): Promise<void> {
        const filePath = this.getFilePath(fileNameWithoutExtension);

        await promises.writeFile(filePath, content);
        console.log(`File '${yellow(filePath)}' saved`);
    }

    private getFilePath(filename: string) {
        return `./${filename}`;
    }
}
