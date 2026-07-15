FROM node:18

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Hugging Face Spaces runs on port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server.js"]
