# Use the official Node.js slim image
FROM node:20-slim

# Install system dependencies: Python 3, pip, and FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Symlink python3 to python to match execution command
RUN ln -s /usr/bin/python3 /usr/bin/python

# Install yt-dlp globally in Python using pip
RUN python3 -m pip install --break-system-packages -U yt-dlp

# Set the working directory
WORKDIR /usr/src/app

# Copy project package files and install npm dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application files
COPY . .

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

# Expose port 3000
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Use entrypoint to generate fresh cookies before starting the server
CMD [ "./entrypoint.sh" ]
