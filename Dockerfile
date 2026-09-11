FROM node:24-alpine
WORKDIR /app
COPY dist ./dist
COPY server/server.mjs server/seed.json ./server/
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/data
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/server.mjs"]
