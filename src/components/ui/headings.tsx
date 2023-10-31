import { cn } from '@/lib/utils';

export const H1 = ({
    children,
    className,
    ...props
}: {
    children: React.ReactNode;
    className?: string | undefined;
}) => (
    <h1 className={cn('text-2xl font-bold', className)} {...props}>
        {children}
    </h1>
);

export const H2 = ({
    children,
    className,
    ...props
}: {
    children: React.ReactNode;
    className?: string | undefined;
}) => (
    <h2 className={cn('text-xl font-bold', className)} {...props}>
        {children}
    </h2>
);

export const H3 = ({
    children,
    className,
    ...props
}: {
    children: React.ReactNode;
    className?: string | undefined;
}) => (
    <h3 className={cn('text-lg font-bold', className)} {...props}>
        {children}
    </h3>
);

export const H4 = ({
    children,
    className,
    ...props
}: {
    children: React.ReactNode;
    className?: string | undefined;
}) => (
    <h1 className={cn('text-base font-bold', className)} {...props}>
        {children}
    </h1>
);
