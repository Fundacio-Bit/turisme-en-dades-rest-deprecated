FROM node:8.11.3
WORKDIR /usr/src/turisme-en-dades-rest
COPY *.* ./
ADD auth ./auth
ADD build ./build
ADD schemas ./schemas
RUN npm install
EXPOSE 3000
CMD ["node", "server.js"]
