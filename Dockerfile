FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY index.html ./
EXPOSE 3000
CMD ["sh", "-c", "serve -s . -l ${PORT:-3000}"]
