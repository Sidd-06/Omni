# Use the official Node.js slim image
FROM node:20-slim

# Install system dependencies: Python 3, pip, FFmpeg, and curl
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Symlink python3 to python to match execution command
RUN ln -s /usr/bin/python3 /usr/bin/python

# Install yt-dlp and the PO Token provider plugin (bypasses YouTube bot checks on datacenter IPs)
RUN python3 -m pip install --break-system-packages -U yt-dlp bgutil-ytdlp-pot-provider

# Download the Rust-based PO Token provider server binary
RUN curl -L -o /usr/local/bin/bgutil-pot https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/latest/download/bgutil-pot-linux-x86_64 \
    && chmod +x /usr/local/bin/bgutil-pot

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

# Use entrypoint to generate fresh cookies and start the POT server before launching
CMD [ "./entrypoint.sh" ]
