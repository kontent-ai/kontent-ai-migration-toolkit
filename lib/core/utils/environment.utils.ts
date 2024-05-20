export function getEnvironmentRequiredValue(variableName: string): string {
    const value = getEnvironmentOptionalValue(variableName);

    if (!value) {
        throw new Error(`Missing environment variable '${variableName}'`);
    }

    return value;
}

export function getEnvironmentOptionalValue(variableName: string): string | undefined {
    // get value from environment variables first
    let value = process.env[variableName];

    if (!value) {
        return undefined;
    }

    return value;
}
