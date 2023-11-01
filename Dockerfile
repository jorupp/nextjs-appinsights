FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

# RUN yarn build

# If using npm comment out above and use below instead
RUN npm run build

# Next tree-shakes application insights and inlines it into a server-side bundle, but we need the actual importable library to use here
# Additional libraries will need to be added here if we add `require()` more libraries from `app-insights.js` or `job-engine.js`,
#   but this should automatically handle version updates or new dependencies added by applicationinsights.
FROM base as extra_libs_builder
WORKDIR /app
COPY package-lock.json ./input-package-lock.json
RUN cat input-package-lock.json | grep "\"node_modules/applicationinsights\"" -A 1 | grep version | sed 's/.*: "\(.*\)".*/applicationinsights@\1/' | xargs npm install

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# since we can't customize the content of server.js normally, we'll just add some files and do some string-manipulation on server.js to include them
COPY --chown=nextjs:nodejs app-insights.js .
# load env variables and intialize app insights and the job engine
# with app insights hooked this early, we don't need to do anything else to track the incoming HTTP requests
RUN sed -i 's/^const path = /require("@next\/env").loadEnvConfig(".\/", false)\nconst appInsights = require(".\/app-insights").default;\n\0/' server.js

# Copy in the extra libraries we need to run our extra JS files
COPY --from=extra_libs_builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]