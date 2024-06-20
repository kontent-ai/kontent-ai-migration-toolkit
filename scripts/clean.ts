import fs from 'fs';
import chalk from 'chalk';

removePath('dist');

function removePath(path: string): void {
    if (fs.existsSync(path)) {
        fs.rmSync(path, { recursive: true });
        console.log(`Path '${chalk.yellow(path)}' has been deleted`);
    }
}
