import { PropsWithChildren } from 'react';

import { ApplicationInsightsClientProvider } from './client';

export const ApplicationInsightsServerProvider = ({
    children,
}: PropsWithChildren) => {
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING!;
    if (!connectionString) {
        console.warn(
            'ApplicationInsightsServerProvider: No connection string found - please set APPLICATIONINSIGHTS_CONNECTION_STRING.',
        );
    }
    return (
        <ApplicationInsightsClientProvider connectionString={connectionString}>
            {children}
        </ApplicationInsightsClientProvider>
    );
};
