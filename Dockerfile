FROM node:8.11.3
COPY *.* ./
ADD rest-api ./rest-api
RUN npm install
EXPOSE 3000
CMD ["node", "./rest-api/server.js"]
