import { RenderDiagnostics } from './client';
import { runDiagnostics } from './server';

export default async function DiagPage() {
    const results = await runDiagnostics();

    return (
        <RenderDiagnostics results={results} buildId={process.env.BUILD_ID} />
    );
}
