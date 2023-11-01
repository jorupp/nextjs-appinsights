export async function register() {
    const appInsights = await import('applicationinsights');

    console.log('configuring Application Insights via instrumentation.ts');
    try {
        // https://learn.microsoft.com/en-us/azure/azure-monitor/app/nodejs#sdk-configuration
        appInsights
            .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
            .setAutoDependencyCorrelation(true)
            .setAutoCollectRequests(true)
            .setAutoCollectPerformance(true, true)
            .setAutoCollectExceptions(true)
            .setAutoCollectDependencies(true)
            .setAutoCollectConsole(true, true) // collect console.log calls too
            .setUseDiskRetryCaching(true)
            .setSendLiveMetrics(true)
            .setAutoCollectPerformance(true, true) // don't try to load native module - it may not be available on the target platform and we don't want to have to build it custom
            .setDistributedTracingMode(appInsights.DistributedTracingModes.AI);
    
        appInsights.start();
        if (false) {
            // set to true to write server-side telemetry info to console
            appInsights.defaultClient.addTelemetryProcessor((e, ctx) => {
                const baseType = e?.data?.baseType;
                if (baseType) {
                    if (baseType === 'RemoteDependencyData') {
                        const {
                            name,
                            data,
                            target,
                            type,
                            duration,
                            resultCode,
                            success,
                        } = e?.data?.baseData || {};
                        console.log(
                            `RemoteDependencyData: ${[
                                type,
                                name,
                                data,
                                target,
                                duration,
                                resultCode,
                                success,
                            ].join(', ')}`,
                        );
                    } else if (baseType === 'MetricData') {
                        // ignore
                    } else if (baseType === 'MessageData') {
                        // ignore - this includes console.log calls, so if we report this we'll get an infinite loop
                    } else {
                        console.log(`baseType: ${baseType}`);
                    }
                }
                return true;
            });
        }
    
        const appInsightsClient = appInsights.defaultClient;
        (global as any).__APP_INSIGHTS_CLIENT__ = appInsightsClient;
    
        appInsightsClient.trackTrace({
            message: 'Application Insights configuration complete (via trace)',
        });
        console.log('Application insights configuration complete');
    } catch (e) {
        console.error('Error configuring Application Insights', e);
    }

}