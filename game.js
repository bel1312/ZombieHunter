const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const game = {
    player: { x: 400, y: 300, health: 100, angle: 0, speed: 3 },
    bullets: [],
    zombies: [],
    bosses: [],
    particles: [],
    bloodSplats: [],
    pillars: [
        {x: 150, y: 100, radius: 25, type: 'standing', broken: false},
        {x: 600, y: 150, radius: 20, type: 'lying', broken: true},
        {x: 200, y: 400, radius: 25, type: 'standing', broken: false},
        {x: 550, y: 450, radius: 15, type: 'half', broken: true},
        {x: 350, y: 200, radius: 25, type: 'standing', broken: false},
        {x: 100, y: 350, radius: 18, type: 'lying', broken: false}
    ],
    level: 1,
    score: 0,
    zombiesKilled: 0,
    currentWeapon: 0,
    lastShot: 0,
    keys: {},
    mouse: { x: 0, y: 0, down: false },
    gameTime: 0,
    nextBoss: 50
};

// Weapons system
const weapons = [
    { name: 'Pistol', damage: 25, fireRate: 300, ammo: Infinity, unlockLevel: 1 },
    { name: 'Uzi', damage: 15, fireRate: 80, ammo: Infinity, unlockLevel: 2 },
    { name: 'Shotgun', damage: 20, fireRate: 600, ammo: Infinity, unlockLevel: 3, spread: 3 },
    { name: 'SMG', damage: 20, fireRate: 100, ammo: Infinity, unlockLevel: 4 },
    { name: 'Rifle', damage: 50, fireRate: 800, ammo: Infinity, unlockLevel: 6 },
    { name: 'Rocket', damage: 100, fireRate: 1000, ammo: Infinity, unlockLevel: 8, explosive: true }
];

// Input handling
document.addEventListener('keydown', (e) => game.keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', (e) => game.keys[e.key.toLowerCase()] = false);
document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    game.mouse.x = e.clientX - rect.left;
    game.mouse.y = e.clientY - rect.top;
});
document.addEventListener('mousedown', () => game.mouse.down = true);
document.addEventListener('mouseup', () => game.mouse.down = false);
document.addEventListener('keydown', (e) => {
    const num = parseInt(e.key);
    if (num >= 1 && num <= 6 && weapons[num-1].unlockLevel <= game.level) {
        game.currentWeapon = num - 1;
    }
});

function spawnZombie() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    
    switch(side) {
        case 0: x = Math.random() * canvas.width; y = -20; break;
        case 1: x = canvas.width + 20; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + 20; break;
        case 3: x = -20; y = Math.random() * canvas.height; break;
    }
    
    game.zombies.push({
        x, y, health: 50 + game.level * 10, speed: 0.3 + game.level * 0.05,
        size: 15, type: 'normal'
    });
}

function spawnBoss() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    
    switch(side) {
        case 0: x = Math.random() * canvas.width; y = -30; break;
        case 1: x = canvas.width + 30; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + 30; break;
        case 3: x = -30; y = Math.random() * canvas.height; break;
    }
    
    game.bosses.push({
        x, y, health: 300 + game.level * 50, speed: 0.2 + game.level * 0.03,
        size: 30, type: 'boss', lastAttack: 0
    });
}

function updatePlayer() {
    // Store old position
    const oldX = game.player.x;
    const oldY = game.player.y;
    
    // Movement
    if (game.keys['w']) game.player.y -= game.player.speed;
    if (game.keys['s']) game.player.y += game.player.speed;
    if (game.keys['a']) game.player.x -= game.player.speed;
    if (game.keys['d']) game.player.x += game.player.speed;

    // Check pillar collisions
    for (const pillar of game.pillars) {
        const dist = Math.hypot(game.player.x - pillar.x, game.player.y - pillar.y);
        if (dist < pillar.radius + 15) {
            game.player.x = oldX;
            game.player.y = oldY;
            break;
        }
    }

    // Boundaries
    game.player.x = Math.max(15, Math.min(canvas.width - 15, game.player.x));
    game.player.y = Math.max(15, Math.min(canvas.height - 15, game.player.y));

    // Aim
    game.player.angle = Math.atan2(game.mouse.y - game.player.y, game.mouse.x - game.player.x);

    // Shooting
    if (game.mouse.down && Date.now() - game.lastShot > weapons[game.currentWeapon].fireRate) {
        shoot();
        game.lastShot = Date.now();
    }
}

function shoot() {
    const weapon = weapons[game.currentWeapon];
    
    if (weapon.name === 'Shotgun') {
        // Shotgun fires 3 pellets in spread
        for (let i = 0; i < 3; i++) {
            const spreadAngle = (i - 1) * 0.3; // Wider spread
            const angle = game.player.angle + spreadAngle;
            
            game.bullets.push({
                x: game.player.x,
                y: game.player.y,
                vx: Math.cos(angle) * 8,
                vy: Math.sin(angle) * 8,
                damage: weapon.damage,
                explosive: weapon.explosive || false
            });
        }
    } else {
        // Regular single shot
        const angle = game.player.angle;
        
        game.bullets.push({
            x: game.player.x,
            y: game.player.y,
            vx: Math.cos(angle) * 8,
            vy: Math.sin(angle) * 8,
            damage: weapon.damage,
            explosive: weapon.explosive || false
        });
    }
}

function updateBullets() {
    game.bullets = game.bullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        
        // Remove if out of bounds
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            return false;
        }
        
        // Check pillar collisions
        for (const pillar of game.pillars) {
            const dist = Math.hypot(bullet.x - pillar.x, bullet.y - pillar.y);
            if (dist < pillar.radius) {
                return false;
            }
        }
        
        // Check zombie collisions
        for (let i = game.zombies.length - 1; i >= 0; i--) {
            const zombie = game.zombies[i];
            const dist = Math.hypot(bullet.x - zombie.x, bullet.y - zombie.y);
            
            if (dist < zombie.size) {
                zombie.health -= bullet.damage;
                
                if (bullet.explosive) {
                    // Explosive damage to nearby zombies
                    game.zombies.forEach(z => {
                        const explosionDist = Math.hypot(bullet.x - z.x, bullet.y - z.y);
                        if (explosionDist < 50) {
                            z.health -= bullet.damage * 0.5;
                        }
                    });
                    createExplosion(bullet.x, bullet.y);
                }
                
                // Blood splash effect
                createBloodSplash(zombie.x, zombie.y);
                
                if (zombie.health <= 0) {
                    game.zombies.splice(i, 1);
                    game.score += 10;
                    game.zombiesKilled++;
                }
                return false;
            }
        }
        
        // Check boss collisions
        for (let i = game.bosses.length - 1; i >= 0; i--) {
            const boss = game.bosses[i];
            const dist = Math.hypot(bullet.x - boss.x, bullet.y - boss.y);
            
            if (dist < boss.size) {
                boss.health -= bullet.damage;
                
                if (bullet.explosive) {
                    createExplosion(bullet.x, bullet.y);
                }
                
                // Blood splash effect
                createBloodSplash(boss.x, boss.y);
                
                if (boss.health <= 0) {
                    game.bosses.splice(i, 1);
                    game.score += 100;
                    game.zombiesKilled += 10;
                }
                return false;
            }
        }
        
        return true;
    });
}

function updateZombies() {
    game.zombies.forEach(zombie => {
        // Move towards player
        let dx = game.player.x - zombie.x;
        let dy = game.player.y - zombie.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 0) {
            // Check for pillar in the way
            let blocked = false;
            for (const pillar of game.pillars) {
                const pillarDist = Math.hypot(zombie.x - pillar.x, zombie.y - pillar.y);
                if (pillarDist < pillar.radius + 30) { // Detection range
                    blocked = true;
                    // Calculate direction to go around pillar
                    const pillarDx = pillar.x - zombie.x;
                    const pillarDy = pillar.y - zombie.y;
                    // Go perpendicular to pillar direction
                    dx = -pillarDy;
                    dy = pillarDx;
                    // Normalize
                    const perpDist = Math.hypot(dx, dy);
                    if (perpDist > 0) {
                        dx /= perpDist;
                        dy /= perpDist;
                    }
                    break;
                }
            }
            
            if (!blocked) {
                dx /= dist;
                dy /= dist;
            }
            
            zombie.x += dx * zombie.speed;
            zombie.y += dy * zombie.speed;
        }
        
        // Damage player on contact
        if (dist < zombie.size + 15) {
            game.player.health -= 0.5;
        }
    });
}

function updateBosses() {
    game.bosses.forEach(boss => {
        // Move towards player
        let dx = game.player.x - boss.x;
        let dy = game.player.y - boss.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 0) {
            // Check for pillar in the way
            let blocked = false;
            for (const pillar of game.pillars) {
                const pillarDist = Math.hypot(boss.x - pillar.x, boss.y - pillar.y);
                if (pillarDist < pillar.radius + 40) { // Detection range
                    blocked = true;
                    // Calculate direction to go around pillar
                    const pillarDx = pillar.x - boss.x;
                    const pillarDy = pillar.y - boss.y;
                    // Go perpendicular to pillar direction
                    dx = -pillarDy;
                    dy = pillarDx;
                    // Normalize
                    const perpDist = Math.hypot(dx, dy);
                    if (perpDist > 0) {
                        dx /= perpDist;
                        dy /= perpDist;
                    }
                    break;
                }
            }
            
            if (!blocked) {
                dx /= dist;
                dy /= dist;
            }
            
            boss.x += dx * boss.speed;
            boss.y += dy * boss.speed;
        }
        
        // Damage player on contact
        if (dist < boss.size + 15) {
            game.player.health -= 1;
        }
        
        // Boss special attack
        if (Date.now() - boss.lastAttack > 2000 && dist < 200) {
            // Spawn mini zombies around boss
            for (let i = 0; i < 3; i++) {
                const angle = (Math.PI * 2 / 3) * i;
                game.zombies.push({
                    x: boss.x + Math.cos(angle) * 40,
                    y: boss.y + Math.sin(angle) * 40,
                    health: 30,
                    speed: 0.6,
                    size: 10,
                    type: 'mini'
                });
            }
            boss.lastAttack = Date.now();
        }
    });
}

function createExplosion(x, y) {
    for (let i = 0; i < 10; i++) {
        game.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 30,
            color: `hsl(${Math.random() * 60 + 10}, 100%, 50%)`
        });
    }
}

function createBloodSplash(x, y) {
    // Create blood splat on ground
    game.bloodSplats.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        size: Math.random() * 8 + 4,
        alpha: 0.8
    });
    
    // Create blood particles
    for (let i = 0; i < 5; i++) {
        game.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 20,
            color: `rgb(139, 0, 0)`
        });
    }
}

function updateParticles() {
    game.particles = game.particles.filter(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.95;
        particle.vy *= 0.95;
        particle.life--;
        return particle.life > 0;
    });
    
    // Blood splats persist (no fading)
}

function updateGame() {
    game.gameTime++;
    
    // Spawn zombies
    if (Math.random() < 0.008 + game.level * 0.003) {
        spawnZombie();
    }
    
    // Spawn boss
    if (game.zombiesKilled >= game.nextBoss) {
        spawnBoss();
        game.nextBoss += 50 + game.level * 10;
    }
    
    // Level progression
    if (game.zombiesKilled >= game.level * 20) {
        game.level++;
        game.player.health = Math.min(100, game.player.health + 25);
    }
    
    // Game over
    if (game.player.health <= 0) {
        alert(`Game Over! Final Score: ${game.score}`);
        location.reload();
    }
}

function render() {
    // Draw background
    ctx.fillStyle = '#6b6b6b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw pillars (varied types)
    game.pillars.forEach(pillar => {
        ctx.save();
        ctx.translate(pillar.x, pillar.y);
        
        if (pillar.type === 'lying') {
            // Lying pillar (oval)
            ctx.fillStyle = '#3a3a3a';
            ctx.scale(2.5, 1);
            ctx.beginPath();
            ctx.arc(1, 1, pillar.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = pillar.broken ? '#4a4a4a' : '#5a5a5a';
            ctx.beginPath();
            ctx.arc(0, 0, pillar.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
            
            // Texture lines
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 1;
            for (let i = -pillar.radius; i < pillar.radius; i += 4) {
                ctx.beginPath();
                ctx.moveTo(i, -pillar.radius * 0.6);
                ctx.lineTo(i, pillar.radius * 0.6);
                ctx.stroke();
            }
        } else if (pillar.type === 'half') {
            // Half broken pillar
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.arc(1, 1, pillar.radius, 0, Math.PI);
            ctx.fill();
            
            ctx.fillStyle = '#4a4a4a';
            ctx.beginPath();
            ctx.arc(0, 0, pillar.radius, 0, Math.PI);
            ctx.fill();
            
            // Broken edge
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(-pillar.radius, -2, pillar.radius * 2, 4);
        } else {
            // Standing pillar (circle)
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.arc(1, 1, pillar.radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = pillar.broken ? '#4a4a4a' : '#5a5a5a';
            ctx.beginPath();
            ctx.arc(0, 0, pillar.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // 3D highlight
            ctx.fillStyle = pillar.broken ? '#6a6a6a' : '#7a7a7a';
            ctx.beginPath();
            ctx.arc(-3, -3, pillar.radius * 0.7, 0, Math.PI * 2);
            ctx.fill();
            
            // Stone texture
            ctx.fillStyle = '#3a3a3a';
            for (let i = 0; i < 3; i++) {
                const angle = (i * Math.PI * 2) / 3;
                const x = Math.cos(angle) * pillar.radius * 0.5;
                const y = Math.sin(angle) * pillar.radius * 0.5;
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.restore();
    });
    
    // Draw blood splats
    game.bloodSplats.forEach(splat => {
        ctx.fillStyle = `rgba(139, 0, 0, ${splat.alpha})`;
        ctx.beginPath();
        ctx.arc(splat.x, splat.y, splat.size, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Draw player
    ctx.save();
    ctx.translate(game.player.x, game.player.y);
    ctx.rotate(game.player.angle);
    
    // Body (shoulders/torso)
    ctx.fillStyle = '#4a90e2';
    ctx.fillRect(-8, -4, 16, 8);
    
    // Head
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Arms
    ctx.fillStyle = '#4a90e2';
    ctx.fillRect(-10, -2, 6, 4); // Left arm
    ctx.fillRect(8, -2, 6, 4);   // Right arm
    
    // Hands
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath();
    ctx.arc(-7, 0, 2, 0, Math.PI * 2); // Left hand
    ctx.fill();
    ctx.beginPath();
    ctx.arc(11, 0, 2, 0, Math.PI * 2); // Right hand
    ctx.fill();
    
    // Gun (held in right hand)
    ctx.fillStyle = '#333';
    ctx.fillRect(13, -1, 8, 2);
    
    ctx.restore();
    
    // Draw bullets
    ctx.fillStyle = '#ffff00';
    game.bullets.forEach(bullet => {
        ctx.fillRect(bullet.x - 2, bullet.y - 2, 4, 4);
    });
    
    // Draw zombies
    game.zombies.forEach(zombie => {
        ctx.save();
        ctx.translate(zombie.x, zombie.y);
        
        // Body (shoulders/torso)
        ctx.fillStyle = zombie.type === 'mini' ? '#8b4513' : '#654321';
        ctx.fillRect(-6, -3, 12, 6);
        
        // Head
        ctx.fillStyle = '#90ee90';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Arms extended forward
        ctx.fillStyle = zombie.type === 'mini' ? '#8b4513' : '#654321';
        ctx.fillRect(-8, -1, 6, 2); // Left arm
        ctx.fillRect(2, -1, 6, 2);  // Right arm
        
        // Hands
        ctx.fillStyle = '#90ee90';
        ctx.beginPath();
        ctx.arc(-8, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(8, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
    
    // Draw bosses
    game.bosses.forEach(boss => {
        ctx.save();
        ctx.translate(boss.x, boss.y);
        
        // Body (larger shoulders/torso)
        ctx.fillStyle = '#4a0e4e';
        ctx.fillRect(-12, -6, 24, 12);
        
        // Head (larger)
        ctx.fillStyle = '#6b8e23';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Arms extended forward (larger)
        ctx.fillStyle = '#4a0e4e';
        ctx.fillRect(-16, -2, 10, 4); // Left arm
        ctx.fillRect(6, -2, 10, 4);   // Right arm
        
        // Hands (larger)
        ctx.fillStyle = '#6b8e23';
        ctx.beginPath();
        ctx.arc(-16, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(16, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        // Health bar
        const healthPercent = boss.health / (300 + game.level * 50);
        ctx.fillStyle = '#333';
        ctx.fillRect(boss.x - boss.size/2, boss.y - boss.size/2 - 10, boss.size, 5);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(boss.x - boss.size/2, boss.y - boss.size/2 - 10, boss.size * healthPercent, 5);
    });
    
    // Draw particles
    game.particles.forEach(particle => {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life / 30;
        ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
        ctx.globalAlpha = 1;
    });
    
    // Update UI
    document.getElementById('level').textContent = game.level;
    document.getElementById('score').textContent = game.score;
    document.getElementById('health').textContent = Math.max(0, Math.floor(game.player.health));
    document.getElementById('weapon').textContent = weapons[game.currentWeapon].name;
    document.getElementById('ammo').textContent = weapons[game.currentWeapon].ammo === Infinity ? '∞' : weapons[game.currentWeapon].ammo;
}

function gameLoop() {
    updatePlayer();
    updateBullets();
    updateZombies();
    updateBosses();
    updateParticles();
    updateGame();
    render();
    requestAnimationFrame(gameLoop);
}

// Start game
gameLoop();