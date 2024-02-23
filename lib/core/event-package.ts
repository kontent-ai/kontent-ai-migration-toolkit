import { IEventPackage } from '@kontent-ai-consulting/tools-analytics';
import PackageJson from '../../package.json' assert { type: 'json' };

export const eventPackage: IEventPackage = {
    name: PackageJson.name,
    version: PackageJson.version
};
