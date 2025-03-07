#!/bin/bash

# Stop any running processes
echo "Stopping any running processes..."
pkill -f "bun run index.ts"
pkill -f "serve -s dist"

# Install dependencies for server
echo "Installing server dependencies..."
cd server
bun install

# Install dependencies for client
echo "Installing client dependencies..."
cd ../client
bun install

# Create production environment file if it doesn't exist
if [ ! -f .env.production ]; then
  echo "Creating production environment file..."
  cat > .env.production << EOL
VITE_SERVER_PORT=5000
VITE_WS_REMOTE_URL=http://146.190.192.108:5000
VITE_DEBUG_MODE=true
VITE_PEERJS_HOST=
VITE_PEERJS_PORT=
VITE_PEERJS_PATH=
VITE_PEERJS_SECURE=true
EOL
fi

# Build client for production
echo "Building client for production..."
bun run build

# Start the server in the background
echo "Starting server on port 5000..."
cd ../server
nohup bun run index.ts --port 5000 --debug > server.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# Wait for server to start
echo "Waiting for server to start..."
sleep 3

# Serve the client build
echo "Serving client on port 5173..."
cd ../client
rm .env
cp .env.example .env
nohup serve -s dist -l 5173 > client.log 2>&1 &
CLIENT_PID=$!
echo "Client started with PID: $CLIENT_PID"

echo "Deployment complete!"
echo "Server running on http://146.190.192.108:5000"
echo "Client running on http://146.190.192.108:5173"
echo ""
echo "To view server logs: tail -f server/server.log"
echo "To view client logs: tail -f client/client.log" 