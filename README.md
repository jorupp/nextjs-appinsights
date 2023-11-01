This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

> [!WARNING]
> **this branch does not actually work** - see details [below](#application-insights-issues).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Application Insights issues

This branch tries to use [NextJS instrumentation](https://nextjs.org/docs/pages/building-your-application/optimizing/instrumentation), but it fails during `npm run dev` with the following errors.  It appears to be due to the way some of the dependencies are referenced conflicting with the way NextJS tries to import them.

```txt
Module not found: Can't resolve '@azure/functions-core' in '<projectdir>\node_modules\applicationinsights\out\AutoCollection'

Import trace for requested module:
./node_modules/applicationinsights/out/AutoCollection/AzureFunctionsHook.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js
Module not found: Can't resolve 'applicationinsights-native-metrics' in '<projectdir>\node_modules\applicationinsights\out\AutoCollection'

Import trace for requested module:
./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/async-listener/index.js
Module not found: Can't resolve 'zlib' in '<projectdir>\node_modules\async-listener'

Import trace for requested module:
./node_modules/async-listener/index.js
./node_modules/continuation-local-storage/context.js
./node_modules/applicationinsights/out/AutoCollection/CorrelationContextManager.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/async-listener/index.js
Module not found: Can't resolve 'crypto' in '<projectdir>\node_modules\async-listener'

Import trace for requested module:
./node_modules/async-listener/index.js
./node_modules/continuation-local-storage/context.js
./node_modules/applicationinsights/out/AutoCollection/CorrelationContextManager.js
./node_modules/applicationinsights/out/applicationinsights.js
 ⚠ ./node_modules/applicationinsights/out/AutoCollection/AzureFunctionsHook.js
Module not found: Can't resolve '@azure/functions-core' in '<projectdir>\node_modules\applicationinsights\out\AutoCollection'

Import trace for requested module:
./node_modules/applicationinsights/out/AutoCollection/AzureFunctionsHook.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js
Module not found: Can't resolve 'applicationinsights-native-metrics' in '<projectdir>\node_modules\applicationinsights\out\AutoCollection'

Import trace for requested module:
./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/async-listener/index.js
Module not found: Can't resolve 'zlib' in '<projectdir>\node_modules\async-listener'

Import trace for requested module:
./node_modules/async-listener/index.js
./node_modules/continuation-local-storage/context.js
./node_modules/applicationinsights/out/AutoCollection/CorrelationContextManager.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/async-listener/index.js
Module not found: Can't resolve 'crypto' in '<projectdir>\node_modules\async-listener'

Import trace for requested module:
./node_modules/async-listener/index.js
./node_modules/continuation-local-storage/context.js
./node_modules/applicationinsights/out/AutoCollection/CorrelationContextManager.js
./node_modules/applicationinsights/out/applicationinsights.js
 ⚠ ./node_modules/applicationinsights/out/AutoCollection/AzureFunctionsHook.js
Module not found: Can't resolve '@azure/functions-core' in '<projectdir>\node_modules\applicationinsights\out\AutoCollection'

Import trace for requested module:
./node_modules/applicationinsights/out/AutoCollection/AzureFunctionsHook.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js
Module not found: Can't resolve 'applicationinsights-native-metrics' in '<projectdir>\node_modules\applicationinsights\out\AutoCollection'

Import trace for requested module:
./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/async-listener/index.js
Module not found: Can't resolve 'zlib' in '<projectdir>\node_modules\async-listener'

Import trace for requested module:
./node_modules/async-listener/index.js
./node_modules/continuation-local-storage/context.js
./node_modules/applicationinsights/out/AutoCollection/CorrelationContextManager.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/async-listener/index.js
Module not found: Can't resolve 'crypto' in '<projectdir>\node_modules\async-listener'

Import trace for requested module:
./node_modules/async-listener/index.js
./node_modules/continuation-local-storage/context.js
./node_modules/applicationinsights/out/AutoCollection/CorrelationContextManager.js
./node_modules/applicationinsights/out/applicationinsights.js
 ⚠ ./node_modules/applicationinsights/out/AutoCollection/AzureFunctionsHook.js
Module not found: Can't resolve '@azure/functions-core' in '<projectdir>\node_modules\applicationinsights\out\AutoCollection'

Import trace for requested module:
./node_modules/applicationinsights/out/AutoCollection/AzureFunctionsHook.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js
Module not found: Can't resolve 'applicationinsights-native-metrics' in '<projectdir>\node_modules\applicationinsights\out\AutoCollection'

Import trace for requested module:
./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/async-listener/index.js
Module not found: Can't resolve 'zlib' in '<projectdir>\node_modules\async-listener'

Import trace for requested module:
./node_modules/async-listener/index.js
./node_modules/continuation-local-storage/context.js
./node_modules/applicationinsights/out/AutoCollection/CorrelationContextManager.js
./node_modules/applicationinsights/out/applicationinsights.js

./node_modules/async-listener/index.js
Module not found: Can't resolve 'crypto' in '<projectdir>\node_modules\async-listener'

Import trace for requested module:
./node_modules/async-listener/index.js
./node_modules/continuation-local-storage/context.js
./node_modules/applicationinsights/out/AutoCollection/CorrelationContextManager.js
./node_modules/applicationinsights/out/applicationinsights.js
```
