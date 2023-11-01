import {
    ApplicationInsights,
    SeverityLevel,
} from '@microsoft/applicationinsights-web';
import type { TelemetryClient, wrapWithCorrelationContext } from 'applicationinsights';
import { nanoid } from 'nanoid';

export type { SeverityLevel } from '@microsoft/applicationinsights-web';

// cannot import this from @microsoft/applicationinsights-web or @microsoft/applicationinsights-common for some reason
export const enum eSeverityLevel {
    Verbose = 0,
    Information = 1,
    Warning = 2,
    Error = 3,
    Critical = 4,
}

interface BrowserState {
    appInsights: ApplicationInsights;
}
const getBrowserClient = () =>
    (
        (typeof window !== 'undefined' &&
            ((window as any).__AI_STATE__ as BrowserState | undefined)) ||
        undefined
    )?.appInsights;
const getServerClient = () =>
    (global as any).__APP_INSIGHTS_CLIENT__ as TelemetryClient | undefined;
const getServerWrapWithCorrelationContext = () =>
    (global as any).__APP_INSIGHTS_WRAP_WITH_CORRELATION_CONTEXT__ as typeof wrapWithCorrelationContext | undefined;


export interface ExceptionTelemetry {
    exception: Error;
    properties?: Record<string, unknown>;
}
export const trackException = (telemetry: ExceptionTelemetry) => {
    const serverClient = getServerClient();
    if (serverClient) {
        serverClient.trackException(telemetry);
        return true;
    } else {
        const browserClient = getBrowserClient();
        if (browserClient) {
            browserClient.trackException(telemetry);
            return true;
        }
    }
    return false;
};

export interface TraceTelemetry {
    message: string;
    properties?: Record<string, unknown>;
    severity?: SeverityLevel;
}
export const trackTrace = (telemetry: TraceTelemetry) => {
    const serverClient = getServerClient();
    if (serverClient) {
        serverClient.trackTrace(telemetry);
        return true;
    } else {
        const browserClient = getBrowserClient();
        if (browserClient) {
            const { severity, ...rest } = telemetry;
            browserClient.trackTrace({ severityLevel: severity, ...rest });
            return true;
        }
    }
    return false;
};

export interface MetricTelemetry {
    name: string;
    value: number;
}
export const trackMetric = (telemetry: MetricTelemetry) => {
    const serverClient = getServerClient();
    if (serverClient) {
        serverClient.trackMetric(telemetry);
        return true;
    } else {
        const browserClient = getBrowserClient();
        if (browserClient) {
            const { name, value } = telemetry;
            browserClient.trackMetric({ name, average: value });
            return true;
        }
    }
    return false;
};

export const trackDurationMetric = async <T>(
    name: string,
    call: () => Promise<T>,
): Promise<T> => {
    const start = Date.now();
    try {
        return await call();
    } finally {
        trackMetric({ name, value: Date.now() - start });
    }
};

export interface DependencyTelemetry {
    dependencyTypeName: string;
    name: string;
    data: string;
    target?: string;
    duration: number;
    resultCode: number;
    success: boolean;
    properties?: Record<string, unknown>;
}
export const trackDependency = (telemetry: DependencyTelemetry) => {
    const serverClient = getServerClient();
    if (serverClient) {
        serverClient.trackDependency(telemetry);
        return true;
    } else {
        const browserClient = getBrowserClient();
        if (browserClient) {
            const { dependencyTypeName, resultCode, ...rest } = telemetry;
            const id = nanoid(); // TODO: not sure where we should be generating this from
            browserClient.trackDependencyData({
                id,
                responseCode: resultCode,
                type: dependencyTypeName,
                ...rest,
            });
            return true;
        }
    }
    return false;
};

// Helper to track a dependency call - note that this will be in _addition_ to any auto-tracked dependencies
export const trackDependencyCall = async <T>(
    dependencyTypeName: string,
    name: string,
    data: string,
    target: string | undefined,
    call: () => Promise<T>,
    props?: Record<string, unknown>,
    getExtraProps?: (result: T) => Record<string, unknown>,
): Promise<T> => {
    async function trackCall() {
        const start = Date.now();
        let success = false;
        const finalProps: Record<string, unknown> = {};
        if (props) {
            Object.assign(finalProps, props);
        }
        try {
            const retVal = await call();
            if (retVal && Array.isArray(retVal)) {
                finalProps.resultCount = retVal.length;
            }
            if (getExtraProps) {
                Object.assign(finalProps, getExtraProps(retVal) || {});
            }
            success = true;
            return retVal;
        } finally {
            trackDependency({
                dependencyTypeName,
                name,
                target,
                data,
                resultCode: success ? 200 : 500,
                success,
                duration: Date.now() - start,
                properties: finalProps,
            });
        }
    }
    const wrap = getServerWrapWithCorrelationContext();
    if (wrap) {
        return await wrap(trackCall)();
    } else {
        return await trackCall();
    }
};
