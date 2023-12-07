import { parse } from 'csv-parse';
import { AsyncParser, FieldInfo } from 'json2csv';
import { IParsedAsset } from '../../import/index.js';
import { Readable } from 'stream';
import { IFileData } from '../file-processor.models.js';
import { IExportAsset } from '../../export/index.js';
import { BaseAssetProcessorService } from '../base-asset-processor.service.js';

export class AssetCsvProcessorService extends BaseAssetProcessorService {
    private readonly csvDelimiter: string = ',';
    public readonly name: string = 'csv';

    async transformAssetsAsync(assets: IExportAsset[]): Promise<IFileData[]> {
        const asssetFiels: FieldInfo<string>[] = this.getAssetFields();
        const stream = new Readable();
        stream.push(JSON.stringify(assets));
        stream.push(null); // required to end the stream

        const parsingProcessor = this.geCsvParser({
            fields: asssetFiels
        }).fromInput(stream);

        const data = (await parsingProcessor.promise()) ?? '';

        return [
            {
                filename: 'assets.csv',
                data: data,
                itemsCount: assets.length
            }
        ];
    }

    async parseAssetsAsync(text: string): Promise<IParsedAsset[]> {
        const parsedAssets: IParsedAsset[] = [];
        let index = 0;
        const parser = parse(text, {
            cast: true,
            delimiter: this.csvDelimiter
        });

        let parsedColumns: string[] = [];

        for await (const record of parser) {
            if (index === 0) {
                // process header row
                parsedColumns = record;
            } else {
                // process data row
                const parsedAsset: IParsedAsset = {
                    assetId: '',
                    extension: '',
                    filename: '',
                    url: ''
                };

                let fieldIndex: number = 0;
                for (const columnName of parsedColumns) {
                    const columnValue = record[fieldIndex];
                    (parsedAsset as any)[columnName] = columnValue;
                    fieldIndex++;
                }

                parsedAssets.push(parsedAsset);
            }
            index++;
        }

        return parsedAssets;
    }

    private geCsvParser(config: { fields: string[] | FieldInfo<string>[] }): AsyncParser<string> {
        return new AsyncParser({
            delimiter: this.csvDelimiter,
            fields: config.fields
        });
    }

    private getAssetFields(): FieldInfo<string>[] {
        return [
            ...this.getSystemAssetFields().map((m) => {
                const field: FieldInfo<string> = {
                    label: m,
                    value: m
                };

                return field;
            })
        ];
    }
}
