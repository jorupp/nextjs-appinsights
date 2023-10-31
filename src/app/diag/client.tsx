'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { H1 } from '@/components/ui/headings';
import {
    DiagnosticResult,
    FAILURE,
    SUCCESS,
} from './shared';
// import { trackTrace } from '@/features/logging/unified';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

// only show a few characters of the message initially so we can the full overview on the screen to start with
const initialContentLimit = 50;

export const RenderDiagnosticItem = ({
    result,
}: {
    result: DiagnosticResult;
}) => {
    const [expanded, setExpanded] = useState(false);
    const content =
        result.status === SUCCESS ? result.result : result.errorString;
    const showMore =
        !expanded && !!content && content.length > initialContentLimit;

    const trim = (str: string) => {
        if (!str) return str;
        if (expanded) return str;
        if (str.length > initialContentLimit) {
            return str.substring(0, initialContentLimit) + '...';
        }
        return str;
    };
    return (
        <Card
            className={cn('flex-1', 'basis-48', 'shrink-0', {
                'bg-red-50': result.status === FAILURE,
                'bg-green-50': result.status === SUCCESS,
            })}
        >
            <CardHeader>{result.name}</CardHeader>
            <CardContent>
                {result.status === SUCCESS && (
                    <>
                        <dt className="text-green-900 font-bold">SUCCESS</dt>
                        <dl>{trim(result.result)}</dl>
                    </>
                )}
                {result.status === FAILURE && (
                    <>
                        <dt className="text-red-900 font-bold">
                            {result.errorString?.indexOf(result.errorMessage) >=
                            0
                                ? 'FAILURE'
                                : result.errorMessage}
                        </dt>
                        <dl>{trim(result.errorString)}</dl>
                    </>
                )}
                {showMore && (
                    <Button onClick={() => setExpanded(true)}>Show more</Button>
                )}
            </CardContent>
        </Card>
    );
};

export const RenderDiagnostics = ({
    results,
    buildId,
}: {
    results: DiagnosticResult[];
    buildId?: string;
}) => {
    const [clientOnlyResults, setClientOnlyResults] = useState<
        DiagnosticResult[]
    >([]);
    useEffect(() => {
        (async () => {
            setClientOnlyResults(await runDiagnostics());
        })();
    }, []);
    return (
        <div className="max-h-full overflow-auto">
            <H1>Diagnostics</H1>
            {buildId && <h3>Build Id: {buildId}</h3>}
            <div className="flex flex-wrap gap-2 margin-2">
                {results.concat(clientOnlyResults).map((result, ix) => (
                    <RenderDiagnosticItem key={ix} result={result} />
                ))}
            </div>
        </div>
    );
};

const runDiagnostics = async (): Promise<DiagnosticResult[]> => {
    return Promise.all([
        // applicationInsights(),
        dummy(),
    ]);
};

const dummy = async() => runTest('Dummy', async() => {}, () => 'Dummy complete');

// const applicationInsights = async () =>
//     runTest(
//         'Application Insights (client)',
//         async () => {
//             if (
//                 !trackTrace({ message: 'diagnostics test message from client' })
//             )
//                 throw new Error(
//                     'Application Insights is not enabled - check that connection string is correct',
//                 );
//         },
//         () => `Sent trace message to Application Insights from client`,
//     );

/**
 * Helpers to build diagnostic results
 */
function failure(name: string, error: any): DiagnosticResult {
    return {
        name,
        status: FAILURE,
        errorMessage: error?.message ?? error?.toString() ?? 'Unknown error',
        errorString: error?.toString() ?? 'Unknown',
    };
}

function success(name: string, result: string): DiagnosticResult {
    return {
        name,
        status: SUCCESS,
        result,
    };
}

async function runTest<T>(
    name: string,
    getData: () => Promise<T>,
    buildResult: (data: T) => string,
): Promise<DiagnosticResult> {
    try {
        const data = await getData();
        return success(name, buildResult(data));
    } catch (e: any) {
        return failure(name, e);
    }
}
