# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.4.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v2.3.0...v2.4.0) (2025-01-02)


### Features

* updates deps ([81916c9](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/81916c99bc015df9a03c431c972bb904144ff0d9))


### Bug Fixes

* Correctly assert whether content item should be updated when collection changes (fixes https://github.com/kontent-ai/kontent-ai-migration-toolkit/issues/24) ([c2b157d](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/c2b157d3f95fb8939695e577e32e5bd950b116ec))
* Handle new line in link tag regex (fixes https://github.com/kontent-ai/kontent-ai-migration-toolkit/issues/25) ([4eb103a](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/4eb103a1f35db355320fc686bd4cb09d454ab642))

## [2.3.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v2.2.2...v2.3.0) (2024-12-12)

### Features

-   Updates deps, improves types a bit, removes browser note from readme due to outstanding issues
    ([446575e](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/446575ebd7950f33bd8ecf06b6ec924bcc77e289))
-   Skips failed items during import so that the import script continues even if some items fail to import for various reasons.
-   Adds support creating detailed report file upon importing data. This can be enabled both in CLI using the `createReportFile` option or
    in code using the same option.

### Bug Fixes

-   Fixes import when multiple language variants reference same content item (fixes
    https://github.com/kontent-ai/kontent-ai-migration-toolkit/issues/19)
    ([0aeff7a](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/0aeff7a7c2f1088cd1a2ba9fe518cf398a07224a))
-   Remove unnecessary handling for not found error code (fixes https://github.com/kontent-ai/kontent-ai-migration-toolkit/issues/20)
    ([0383b52](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/0383b525cc9bdf0c1d12291862fd12c23d828fb9))

### [2.2.2](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v2.2.1...v2.2.2) (2024-11-07)

### Bug Fixes

-   Adds missing props to element models (rich text, url slug & date time)
    ([a552afe](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/a552afe0c86b52b187daff0cea65d46228cfcd7e))

### [2.2.1](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v2.2.0...v2.2.1) (2024-10-29)

### Bug Fixes

-   Correctly forwards 'baseUrl' config to management client
    ([8136c68](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/8136c68029f9a4847a56ad93b697604f741b672a))

## [2.2.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v2.1.1...v2.2.0) (2024-10-29)

### Features

-   Handles intermediate workflow steps transitions
-   updates deps ([e42f04d](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/e42f04d5ab08ce602292a31f34469b058fac9bb9))

### Bug Fixes

-   Fixes number element import transform (fixes https://github.com/kontent-ai/kontent-ai-migration-toolkit/issues/17)
    ([b5b27b9](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/b5b27b9c1f22c34cbccf49bf5393bd3b82bd7ccc))
-   handles exceptions when tracking events (fixes https://github.com/kontent-ai/kontent-ai-migration-toolkit/issues/14)
    ([28f3ea9](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/28f3ea95ee3114ef92b0eb0142bfa64f60b7501b))

### [2.1.1](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v2.1.0...v2.1.1) (2024-10-08)

### Bug Fixes

-   updates deps which fixes possibility of sending incorrect headers
    ([1dbf50f](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/1dbf50f7ce08bdc070af7703d670b49da4c13367))

## [2.1.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v2.0.0...v2.1.0) (2024-10-08)

### Features

-   adds tracking header
    ([07ab957](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/07ab957b97271610b9a4177edcc6bafdb890f388))
-   updates deps ([2ff8ccc](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/2ff8ccc34c4c57fddbc49bb6e3299a0826ca2054))

## [2.0.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v1.5.1...v2.0.0) (2024-10-03)

### ⚠ BREAKING CHANGES

-   Flattens element value stored to ensure that some future changes (such as support for new option) does not require breaking change
-   Adds support for migrating 'display_timezone' value between envrionments. To support this, it was required to change the contract for
    DateTime element value type.

### Features

-   Adds support for migrating 'display_timezone' value between envrionments. To support this, it was required to change the contract for
    DateTime element value type.
    ([9d00460](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/9d00460ab3fbd479a1f3dad403bbf3a730743192))
-   Flattens element value stored to ensure that some future changes (such as support for new option) does not require breaking change
    ([d618afa](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/d618afac913685e632f87ffba2c0ca2baac9f1e2))
-   updates deps ([7f1d466](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/7f1d4667b59753bb28b4b5e218656809d7c94667))
-   uses `buffer` npm package
    ([40b50d5](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/40b50d53d1ff27d66cb197a6297ee1d2ee717228))

### Bug Fixes

-   adds processing for asset links
    ([2e5a3df](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/2e5a3df30367d63f77b435ef6b106026d92c1eaf))
-   Update number transform to check for nullish values
    ([94041bd](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/94041bded425404bd7edff0174601f9b450f72d0))
-   update number transform to check for nullish values instead of falsey ones
    ([6562bd9](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/6562bd947f5bcfc20389b734b2308d6a3e9ed30b))

### [1.5.1](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v1.5.0...v1.5.1) (2024-09-09)

### Bug Fixes

-   fix importing asset description to non-existent language
    ([571edd9](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/571edd97e756716a26a8503987ed4c6bdc59403c))

## [1.5.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v1.4.0...v1.5.0) (2024-08-15)

### Features

-   adds support for exporting / importing asset folder assignments
    ([a6a4372](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/a6a4372121be8b57831236ef8b5f7a5409d6f8ee))
-   updates deps ([af7f3be](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/af7f3be6ec88f78e67cbb9141da9771e02b645a3))
-   updates deps (& fixes Axios vulnerability)
    ([1b09e9d](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/1b09e9d040d694476802b5dc2c950f697bb00251))

## [1.4.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v1.3.0...v1.4.0) (2024-07-30)

### Features

-   updates deps & uses `changeWorkflowOfLanguageVariant` instead of deprecated `changeWorkflowStepOfLanguageVariant`
    ([6642938](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/6642938ba773560b372f30ee5160b6d72af46837))

### Bug Fixes

-   Fixes mapping of taxonomy elements & correctly flatten snippet elements (fixes
    https://github.com/kontent-ai/kontent-ai-migration-toolkit/issues/5)
    ([838e0b2](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/838e0b260e1b001e52816b42e3288e6d3473b3b6))

## [1.3.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v1.2.0...v1.3.0) (2024-07-18)

### Features

-   Changes order of MigrationItem generics
    ([d54a9a3](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/d54a9a355c496725876c5a215f80d648ac85463a))

## [1.2.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v1.1.0...v1.2.0) (2024-07-18)

### Features

-   Adds support for strongly typed system props (i.e. hint for available workflows, types, collection and more)
    ([08df178](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/08df178cad22a122def7e78ea5a81f7e705eacd0))
-   updates deps ([138d2ff](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/138d2fff545bccfb5e0fbd962848d1d0692288ad))

## [1.1.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v1.0.1...v1.1.0) (2024-07-16)

### Features

-   Implements data validation with Zod & refactors migration models
    ([2bf1a72](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/2bf1a7278669cc37839f971438f46bff06949a53))
-   updates deps ([7edc5f0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/7edc5f0a51757ea71b27bd1fa17fa6e378f2aa75))

### Bug Fixes

-   Correctly use `filename` from config props
    ([a5274cd](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/a5274cd10abd13623979921fc60a1cc38b9d96de))

### [1.0.1](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v1.0.0...v1.0.1) (2024-07-10)

### Bug Fixes

-   Fixes commands --help
    ([c416cbd](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/commit/c416cbdc0ea3d94d706dfbcab9d9ef29cc1bb1a2))

## [1.0.0](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/compare/v1.0.0-29...v1.0.0) (2024-07-10)
