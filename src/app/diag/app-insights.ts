
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
        // skip actually sending to AppInsights for now
        // trackDependency({
        //     dependencyTypeName,
        //     name,
        //     target,
        //     data,
        //     resultCode: success ? 200 : 500,
        //     success,
        //     duration: Date.now() - start,
        //     properties: finalProps,
        // });
    }
};
