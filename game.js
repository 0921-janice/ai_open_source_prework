// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldSize = 2048; // World map is 2048x2048 pixels
        
        // Game state
        this.playerId = null;
        this.players = {};
        this.avatars = {};
        this.ws = null;
        
        // Camera/viewport system
        this.camera = {
            x: 0,
            y: 0
        };
        
        // Keyboard input tracking
        this.pressedKeys = new Set();
        this.movementInterval = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupKeyboard();
        this.loadWorldMap();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateCamera();
            this.draw();
        });
    }
    
    setupKeyboard() {
        // Handle keydown events
        document.addEventListener('keydown', (event) => {
            if (this.isArrowKey(event.code)) {
                event.preventDefault(); // Prevent page scrolling
                this.handleKeyDown(event.code);
            }
        });
        
        // Handle keyup events
        document.addEventListener('keyup', (event) => {
            if (this.isArrowKey(event.code)) {
                event.preventDefault();
                this.handleKeyUp(event.code);
            }
        });
    }
    
    isArrowKey(code) {
        return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code);
    }
    
    getDirectionFromKeyCode(code) {
        const keyToDirection = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        return keyToDirection[code];
    }
    
    handleKeyDown(code) {
        if (!this.pressedKeys.has(code)) {
            this.pressedKeys.add(code);
            this.startContinuousMovement();
        }
    }
    
    handleKeyUp(code) {
        if (this.pressedKeys.has(code)) {
            this.pressedKeys.delete(code);
            if (this.pressedKeys.size === 0) {
                this.stopContinuousMovement();
            }
        }
    }
    
    startContinuousMovement() {
        if (this.movementInterval) return; // Already moving
        
        // Send move commands continuously while keys are pressed
        this.movementInterval = setInterval(() => {
            if (this.pressedKeys.size > 0) {
                this.handleMultipleKeys();
            }
        }, 30); // Send move command every 30ms for more responsive movement
    }
    
    handleMultipleKeys() {
        const directions = [];
        
        // Convert pressed keys to directions
        for (const key of this.pressedKeys) {
            const direction = this.getDirectionFromKeyCode(key);
            if (direction) {
                directions.push(direction);
            }
        }
        
        if (directions.length === 0) return;
        
        // Handle diagonal movement
        if (directions.length > 1) {
            // For diagonal movement, we'll send click-to-move commands
            // Calculate a small step in the combined direction
            const stepSize = 8; // Smaller movement steps
            let deltaX = 0;
            let deltaY = 0;
            
            directions.forEach(direction => {
                switch (direction) {
                    case 'up':
                        deltaY -= stepSize;
                        break;
                    case 'down':
                        deltaY += stepSize;
                        break;
                    case 'left':
                        deltaX -= stepSize;
                        break;
                    case 'right':
                        deltaX += stepSize;
                        break;
                }
            });
            
            // Get current player position and calculate target
            if (this.playerId && this.players[this.playerId]) {
                const player = this.players[this.playerId];
                const targetX = Math.max(0, Math.min(this.worldSize, player.x + deltaX));
                const targetY = Math.max(0, Math.min(this.worldSize, player.y + deltaY));
                
                this.sendClickToMoveCommand(targetX, targetY);
            }
        } else {
            // Single direction movement
            this.sendMoveCommand(directions[0]);
        }
    }
    
    stopContinuousMovement() {
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
            this.movementInterval = null;
            this.sendStopCommand();
        }
    }
    
    sendMoveCommand(direction) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const message = {
            action: 'move',
            direction: direction
        };
        this.ws.send(JSON.stringify(message));
    }
    
    sendClickToMoveCommand(x, y) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const message = {
            action: 'move',
            x: x,
            y: y
        };
        this.ws.send(JSON.stringify(message));
    }
    
    sendStopCommand() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const message = {
            action: 'stop'
        };
        this.ws.send(JSON.stringify(message));
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.draw();
        };
        this.worldImage.onerror = () => {
            console.error('Failed to load world map image');
            this.drawError();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    connectToServer() {
        try {
            this.ws = new WebSocket('wss://codepath-mmorg.onrender.com');
            
            this.ws.onopen = () => {
                console.log('Connected to game server');
                this.joinGame();
            };
            
            this.ws.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from game server');
                this.stopContinuousMovement(); // Stop movement when disconnected
                // Attempt to reconnect after 3 seconds
                setTimeout(() => this.connectToServer(), 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
        }
    }
    
    joinGame() {
        const message = {
            action: 'join_game',
            username: 'Janice'
        };
        this.ws.send(JSON.stringify(message));
    }
    
    handleServerMessage(data) {
        console.log('Received message:', data);
        
        switch (data.action) {
            case 'join_game':
                if (data.success) {
                    this.playerId = data.playerId;
                    this.players = data.players;
                    this.avatars = data.avatars;
                    this.updateCamera();
                    this.draw();
                } else {
                    console.error('Failed to join game:', data.error);
                }
                break;
                
            case 'player_joined':
                this.players[data.player.id] = data.player;
                this.avatars[data.avatar.name] = data.avatar;
                this.draw();
                break;
                
            case 'players_moved':
                Object.assign(this.players, data.players);
                this.updateCamera();
                this.draw();
                break;
                
            case 'player_left':
                delete this.players[data.playerId];
                this.draw();
                break;
                
            default:
                console.log('Unknown message type:', data.action);
        }
    }
    
    updateCamera() {
        if (!this.playerId || !this.players[this.playerId]) return;
        
        const player = this.players[this.playerId];
        
        // Center camera on player
        this.camera.x = player.x - this.canvas.width / 2;
        this.camera.y = player.y - this.canvas.height / 2;
        
        // Constrain camera to world boundaries
        this.camera.x = Math.max(0, Math.min(this.camera.x, this.worldSize - this.canvas.width));
        this.camera.y = Math.max(0, Math.min(this.camera.y, this.worldSize - this.canvas.height));
    }
    
    drawWorld() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map with camera offset
        this.ctx.drawImage(
            this.worldImage,
            this.camera.x, this.camera.y, this.canvas.width, this.canvas.height,  // Source: visible portion
            0, 0, this.canvas.width, this.canvas.height  // Destination: full canvas
        );
    }
    
    draw() {
        this.drawWorld();
        this.drawPlayers();
    }
    
    drawPlayers() {
        Object.values(this.players).forEach(player => {
            this.drawPlayer(player);
        });
    }
    
    drawPlayer(player) {
        const avatar = this.avatars[player.avatar];
        if (!avatar) return;
        
        // Calculate screen position (world position - camera offset)
        const screenX = player.x - this.camera.x;
        const screenY = player.y - this.camera.y;
        
        // Only draw if player is visible on screen
        if (screenX < -50 || screenX > this.canvas.width + 50 || 
            screenY < -50 || screenY > this.canvas.height + 50) {
            return;
        }
        
        // Get the appropriate frame for the player's direction and animation
        const direction = player.facing;
        const frameIndex = player.animationFrame || 0;
        const frameData = avatar.frames[direction] && avatar.frames[direction][frameIndex];
        
        if (!frameData) return;
        
        // Create image from base64 data if not already cached
        let avatarImage = avatar._cachedImages;
        if (!avatarImage) {
            avatarImage = avatar._cachedImages = {};
        }
        
        if (!avatarImage[`${direction}_${frameIndex}`]) {
            const img = new Image();
            img.onload = () => {
                avatarImage[`${direction}_${frameIndex}`] = img;
                this.draw(); // Redraw when image loads
            };
            img.src = frameData;
            return; // Skip drawing this frame until image loads
        }
        
        const img = avatarImage[`${direction}_${frameIndex}`];
        
        // Calculate avatar size (preserve aspect ratio)
        const maxSize = 64; // Maximum avatar size
        const aspectRatio = img.width / img.height;
        let avatarWidth = maxSize;
        let avatarHeight = maxSize / aspectRatio;
        
        // If height is larger, scale by height instead
        if (avatarHeight > maxSize) {
            avatarHeight = maxSize;
            avatarWidth = maxSize * aspectRatio;
        }
        
        // Center the avatar on the player position
        const drawX = screenX - avatarWidth / 2;
        const drawY = screenY - avatarHeight / 2;
        
        // Handle west direction by flipping horizontally
        if (direction === 'west') {
            this.ctx.save();
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(img, -drawX - avatarWidth, drawY, avatarWidth, avatarHeight);
            this.ctx.restore();
        } else {
            this.ctx.drawImage(img, drawX, drawY, avatarWidth, avatarHeight);
        }
        
        // Draw username label
        this.drawPlayerLabel(player.username, screenX, drawY - 10);
    }
    
    drawPlayerLabel(username, x, y) {
        this.ctx.save();
        
        // Draw background for better readability
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        const textWidth = this.ctx.measureText(username).width;
        const padding = 4;
        
        this.ctx.fillRect(
            x - textWidth / 2 - padding, 
            y - 12, 
            textWidth + padding * 2, 
            16
        );
        
        // Draw text
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(username, x, y);
        
        this.ctx.restore();
    }
    
    drawError() {
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Failed to load world map', this.canvas.width / 2, this.canvas.height / 2);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
